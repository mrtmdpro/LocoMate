import { jwtVerify } from "jose";

/**
 * Edge-safe auth-gate primitives for `middleware.ts`. Kept free of any
 * next-intl / next-server imports so the logic is unit-testable in Vitest
 * (those packages fail to load under the test runner's ESM resolver).
 */

// First URL segment (after any locale prefix) of every route that lives under
// the authenticated `(main)` route group. Route groups are invisible in the
// URL, so the gate matches on these concrete prefixes instead.
export const PROTECTED_SEGMENTS = new Set([
  "admin",
  "activities",
  "cart",
  "chat",
  "fixed-tours",
  "home",
  "host",
  "host-setup",
  "letters",
  "onboarding",
  "orders",
  "payments",
  "plan",
  "profile",
  "saved",
  "security",
  "settings",
  "shop",
  "store",
  "tour",
  "tours",
]);

export function stripLocale(
  pathname: string,
  locales: readonly string[],
): { locale: string | null; rest: string } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0])) {
    return { locale: segments[0], rest: "/" + segments.slice(1).join("/") };
  }
  return { locale: null, rest: pathname };
}

export function isProtectedPath(
  pathname: string,
  locales: readonly string[],
): boolean {
  const { rest } = stripLocale(pathname, locales);
  const firstSegment = rest.split("/").filter(Boolean)[0] ?? "";
  return PROTECTED_SEGMENTS.has(firstSegment);
}

let secretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  if (!secretKey) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must be set to a string of at least 32 characters");
    }
    secretKey = new TextEncoder().encode(secret);
  }
  return secretKey;
}

/**
 * Verify the access cookie with `jose` (Edge-compatible; `jsonwebtoken` is
 * not). A refresh token presented in the access slot is rejected; tokens
 * minted before the `typ` claim existed have no `typ` and pass (transition
 * compat).
 */
export async function verifyAccessCookie(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.typ === "string" && payload.typ !== "access") return false;
    return typeof payload.userId === "string";
  } catch {
    return false;
  }
}
