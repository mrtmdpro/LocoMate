/**
 * httpOnly auth-cookie helpers (Cluster C auth lifecycle).
 *
 * Framework-agnostic: emits raw `Set-Cookie` header values appended onto the
 * fetch adapter's `resHeaders` (the tRPC route handler wires this through to
 * `createContext`). No next/headers dependency so this stays usable from any
 * runtime.
 *
 * Two cookies:
 *   - `lm_access`  short-lived access JWT, path `/` (the SSE route + tRPC read it).
 *   - `lm_refresh` opaque 7-day refresh token, scoped to the refresh endpoint
 *     path so it is never sent on ordinary requests.
 *
 * Both are httpOnly + SameSite=Lax. `Secure` is set outside local dev so the
 * cookie survives http://localhost during development.
 */

export const ACCESS_COOKIE = "lm_access";
export const REFRESH_COOKIE = "lm_refresh";

// `lm_refresh` is only ever read by auth.refreshToken / auth.logout, which the
// browser reaches through the single tRPC endpoint. Scope the cookie to that
// path so it does not ride along on every page / API request.
export const REFRESH_COOKIE_PATH = "/api/trpc";

const ACCESS_MAX_AGE = 15 * 60; // 15 minutes, matches the access JWT TTL.
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matches the session TTL.

function isSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; path: string },
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecure()) parts.push("Secure");
  return parts.join("; ");
}

export function setAuthCookies(
  resHeaders: Headers,
  tokens: { accessToken: string; refreshToken: string },
): void {
  resHeaders.append(
    "set-cookie",
    serializeCookie(ACCESS_COOKIE, tokens.accessToken, {
      maxAge: ACCESS_MAX_AGE,
      path: "/",
    }),
  );
  resHeaders.append(
    "set-cookie",
    serializeCookie(REFRESH_COOKIE, tokens.refreshToken, {
      maxAge: REFRESH_MAX_AGE,
      path: REFRESH_COOKIE_PATH,
    }),
  );
}

export function clearAuthCookies(resHeaders: Headers): void {
  resHeaders.append(
    "set-cookie",
    serializeCookie(ACCESS_COOKIE, "", { maxAge: 0, path: "/" }),
  );
  resHeaders.append(
    "set-cookie",
    serializeCookie(REFRESH_COOKIE, "", { maxAge: 0, path: REFRESH_COOKIE_PATH }),
  );
}

/**
 * Parse a single cookie value out of a raw `Cookie` header. Returns null when
 * absent. Used by `createContext` and the SSE route to read `lm_access`.
 */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
