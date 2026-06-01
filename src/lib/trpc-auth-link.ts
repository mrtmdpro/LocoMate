import { createTRPCClient, httpLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@/server/routers/_app";
import { useAuthStore } from "@/stores/auth";

/**
 * Custom tRPC link that intercepts UNAUTHORIZED (HTTP 401) responses on BOTH
 * queries and mutations, attempts a single-flight silent `auth.refreshToken`
 * call (the refresh token rides automatically in the `lm_refresh` httpOnly
 * cookie — no token argument), and replays the original operation.
 *
 * Post-Cluster-C: tokens are httpOnly cookies, so the client never reads or
 * sends them explicitly; `credentials: "include"` on the fetch link is what
 * carries them. The only client-held credential is the LEGACY localStorage
 * token left over from before the migration, which the upgrade shim below
 * attaches as a one-time Bearer header so the server can mint cookies.
 *
 * Single-flight: concurrent 401s share one refresh promise.
 *
 * Final fallback: if refresh itself 401s (no/again-invalid refresh cookie), we
 * clear the user and bounce to `/login?returnTo=<here>`.
 */

const LEGACY_KEY = "locomate-auth";

/**
 * Reads the access token from the pre-Cluster-C persisted Zustand blob, if an
 * existing device still has one. Returns null once cleared / on fresh installs.
 */
export function getLegacyAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: unknown };
    };
    const token = parsed?.state?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Strips the legacy access/refresh tokens out of the persisted blob after the
 * server has upgraded the session to cookies. Preserves the persisted `user`.
 */
export function clearLegacyTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      state?: Record<string, unknown>;
      version?: number;
    };
    if (parsed?.state) {
      delete parsed.state.accessToken;
      delete parsed.state.refreshToken;
      window.localStorage.setItem(LEGACY_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Non-fatal: a malformed blob just means nothing to clear.
  }
}

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Standalone vanilla client used only to call `auth.refreshToken`. Kept
 * separate from the React-bound client so the refresh call itself never loops
 * back through `authLink`. `credentials: "include"` carries the refresh cookie.
 */
const refreshClient = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: "/api/trpc",
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

/**
 * Best-effort server logout: revokes the current refresh session row and
 * clears the httpOnly cookies. Always clears any leftover legacy tokens too.
 * Callers still update the Zustand store + navigate themselves.
 */
export async function serverLogout(): Promise<void> {
  try {
    await refreshClient.auth.logout.mutate();
  } catch {
    // Non-fatal: cookies expire on their own; the session row may already be
    // gone (e.g. account deletion cascade).
  }
  clearLegacyTokens();
}

async function performRefresh(): Promise<boolean> {
  const { logout } = useAuthStore.getState();
  try {
    await refreshClient.auth.refreshToken.mutate();
    return true;
  } catch {
    logout();
    return false;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  const returnTo = encodeURIComponent(here || "/");
  // Avoid a redirect loop if we're already on /login.
  if (window.location.pathname.endsWith("/login")) return;
  window.location.href = `/login?returnTo=${returnTo}`;
}

function isUnauthorized(err: unknown): boolean {
  const data = (err as { data?: { httpStatus?: number; code?: string } } | null)?.data;
  return data?.httpStatus === 401 || data?.code === "UNAUTHORIZED";
}

export const authLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable((observer) => {
      let retried = false;
      let activeSub: { unsubscribe: () => void } | null = null;

      const run = () => {
        activeSub = next(op).subscribe({
          next(value) {
            observer.next(value);
          },
          error(err) {
            if (isUnauthorized(err) && !retried) {
              retried = true;
              // Skip refresh for the refresh call itself (defensive -- the
              // dedicated refreshClient already bypasses this link, but if
              // someone calls auth.refreshToken through the main client we
              // don't want to recurse).
              if (op.path === "auth.refreshToken") {
                observer.error(err);
                return;
              }
              tryRefresh().then((ok) => {
                if (ok) {
                  run();
                } else {
                  redirectToLogin();
                  observer.error(err);
                }
              });
              return;
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
      };

      run();

      return () => {
        activeSub?.unsubscribe();
      };
    });
  };
};
