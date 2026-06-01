import { describe, test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  isProtectedPath,
  verifyAccessCookie,
  stripLocale,
} from "./lib/auth-gate";
import { signToken, signRefreshToken } from "./server/middleware/auth";

// The full middleware composes next-intl, which can't load under Vitest's ESM
// resolver (same limitation as the known wizard.test.tsx). The gate decision
// — "redirect unauth iff isProtectedPath && !verifyAccessCookie" — lives in
// the next-intl-free auth-gate module and is fully exercised here.
const LOCALES = ["en", "vi"] as const;

describe("middleware auth gate", () => {
  test("protected (main) routes are gated, with and without a locale prefix", () => {
    expect(isProtectedPath("/vi/home", LOCALES)).toBe(true);
    expect(isProtectedPath("/home", LOCALES)).toBe(true);
    expect(isProtectedPath("/vi/profile", LOCALES)).toBe(true);
    expect(isProtectedPath("/vi/admin/products", LOCALES)).toBe(true);
  });

  test("public + auth routes are NOT gated (no redirect loop)", () => {
    expect(isProtectedPath("/vi/experiences", LOCALES)).toBe(false);
    expect(isProtectedPath("/vi/login", LOCALES)).toBe(false);
    expect(isProtectedPath("/vi/register", LOCALES)).toBe(false);
    expect(isProtectedPath("/", LOCALES)).toBe(false);
    expect(isProtectedPath("/vi", LOCALES)).toBe(false);
  });

  test("stripLocale peels a known locale prefix only", () => {
    expect(stripLocale("/vi/home", LOCALES)).toEqual({ locale: "vi", rest: "/home" });
    expect(stripLocale("/home", LOCALES)).toEqual({ locale: null, rest: "/home" });
  });

  test("a valid access cookie satisfies the gate", async () => {
    const token = signToken({ userId: randomUUID(), role: "traveler" });
    expect(await verifyAccessCookie(token)).toBe(true);
  });

  test("a missing cookie fails the gate (unauth -> redirect)", async () => {
    expect(await verifyAccessCookie(undefined)).toBe(false);
  });

  test("a refresh token in the access slot is rejected", async () => {
    const refresh = signRefreshToken({ userId: randomUUID(), role: "traveler" });
    expect(await verifyAccessCookie(refresh)).toBe(false);
  });

  test("garbage in the access slot is rejected", async () => {
    expect(await verifyAccessCookie("not-a-jwt")).toBe(false);
  });
});
