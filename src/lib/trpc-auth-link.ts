import { createTRPCClient, httpLink, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@/server/routers/_app";
import { useAuthStore } from "@/stores/auth";

/**
 * Custom tRPC link that intercepts UNAUTHORIZED (HTTP 401) responses on
 * BOTH queries and mutations, attempts a single-flight silent
 * `auth.refreshToken` call using the persisted refresh token, and replays
 * the original operation with the new access token.
 *
 * The previous setup only retried *queries* via `defaultOptions.queries.retry`,
 * so mutations like `cart.add` would fail silently on an expired JWT --
 * users saw `toast.error("UNAUTHORIZED")` and assumed the button was
 * broken. Now an expired token recovers transparently.
 *
 * Single-flight: concurrent 401s share one refresh promise, so adding three
 * items to cart in quick succession doesn't spawn three refresh requests.
 *
 * Final fallback: if refresh itself returns 401 (or no refresh token is
 * stored), we clear auth and bounce the user to `/login?returnTo=<here>`
 * preserving where they were so they can resume after re-auth.
 */

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Standalone vanilla client used only to call `auth.refreshToken`. Kept
 * separate from the React-bound client so the refresh call itself never
 * loops back through `authLink`.
 */
const refreshClient = createTRPCClient<AppRouter>({
  links: [httpLink({ url: "/api/trpc" })],
});

async function performRefresh(): Promise<boolean> {
  const { refreshToken, setToken, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return false;
  }
  try {
    const { accessToken } = await refreshClient.auth.refreshToken.mutate({ refreshToken });
    setToken(accessToken);
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
