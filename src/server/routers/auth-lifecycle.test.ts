import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { getTestDb } from "@/test/setup";
import { createUser } from "@/test/fixtures";
import { sessions } from "@/server/db/schema";

function getCookie(resHeaders: Headers, name: string): string | null {
  for (const c of resHeaders.getSetCookie()) {
    const m = c.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return m[1];
  }
  return null;
}

function rawCookie(resHeaders: Headers, name: string): string | null {
  return resHeaders.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? null;
}

describe("auth lifecycle — cookies, rotation, logout", () => {
  test("login sets httpOnly access + refresh cookies and returns no tokens in the body", async () => {
    // createUser hashes "password123" by default.
    await createUser({ email: "cookie@test.com" });
    const resHeaders = new Headers();
    const caller = await callerAs(null, { resHeaders, clientIp: "10.0.0.1" });

    const result = await caller.auth.login({
      email: "cookie@test.com",
      password: "password123",
    });

    // Body carries the user but NOT tokens.
    expect(result.user.email).toBe("cookie@test.com");
    expect((result as Record<string, unknown>).accessToken).toBeUndefined();
    expect((result as Record<string, unknown>).refreshToken).toBeUndefined();

    const access = rawCookie(resHeaders, "lm_access");
    const refresh = rawCookie(resHeaders, "lm_refresh");
    expect(access).toContain("HttpOnly");
    expect(access).toContain("SameSite=Lax");
    expect(refresh).toContain("HttpOnly");
    // Refresh cookie is scoped to the tRPC endpoint path.
    expect(refresh).toContain("Path=/api/trpc");
  });

  test("refreshToken rotates the session cookie and the old refresh token stops working", async () => {
    const user = await createUser({ email: "rot@test.com" });

    // Login to mint the first session.
    const loginHeaders = new Headers();
    const loginCaller = await callerAs(null, { resHeaders: loginHeaders });
    await loginCaller.auth.login({ email: "rot@test.com", password: "password123" });
    const firstRefresh = getCookie(loginHeaders, "lm_refresh");
    expect(firstRefresh).toBeTruthy();

    // Refresh with the cookie -> new access + rotated refresh.
    const refreshHeaders = new Headers();
    const refreshCaller = await callerAs(null, {
      resHeaders: refreshHeaders,
      cookieHeader: `lm_refresh=${firstRefresh}`,
    });
    await refreshCaller.auth.refreshToken();
    const secondRefresh = getCookie(refreshHeaders, "lm_refresh");
    expect(secondRefresh).toBeTruthy();
    expect(secondRefresh).not.toBe(firstRefresh);
    expect(rawCookie(refreshHeaders, "lm_access")).toContain("HttpOnly");

    // Replaying the original refresh token now fails (rotated + reuse-detected).
    const replayHeaders = new Headers();
    const replayCaller = await callerAs(null, {
      resHeaders: replayHeaders,
      cookieHeader: `lm_refresh=${firstRefresh}`,
    });
    await expect(replayCaller.auth.refreshToken()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    // Reuse detection revoked the whole family, including the live successor.
    const live = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(live.every((r) => r.revokedAt !== null)).toBe(true);
  });

  test("logout revokes the current session and clears cookies", async () => {
    const user = await createUser({ email: "out@test.com" });
    const loginHeaders = new Headers();
    const loginCaller = await callerAs(null, { resHeaders: loginHeaders });
    await loginCaller.auth.login({ email: "out@test.com", password: "password123" });
    const refresh = getCookie(loginHeaders, "lm_refresh");

    const logoutHeaders = new Headers();
    const logoutCaller = await callerAs(null, {
      resHeaders: logoutHeaders,
      cookieHeader: `lm_refresh=${refresh}`,
    });
    await logoutCaller.auth.logout();

    // Session row revoked.
    const rows = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);

    // Cookies cleared (Max-Age=0).
    expect(rawCookie(logoutHeaders, "lm_access")).toContain("Max-Age=0");
    expect(rawCookie(logoutHeaders, "lm_refresh")).toContain("Max-Age=0");
  });

  test("auth.me upgrades a legacy Bearer session to httpOnly cookies", async () => {
    const user = await createUser({ email: "upgrade@test.com" });
    const resHeaders = new Headers();
    // Simulate the legacy-localStorage shim: authenticated via Bearer.
    const caller = await callerAs(user, { resHeaders, authSource: "bearer" });

    const me = await caller.auth.me();
    expect(me.user?.id).toBe(user.id);

    // The probe minted fresh cookies + a session row for the upgrade.
    expect(rawCookie(resHeaders, "lm_access")).toContain("HttpOnly");
    expect(rawCookie(resHeaders, "lm_refresh")).toContain("HttpOnly");
    const rows = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(rows).toHaveLength(1);
  });

  test("auth.me via cookie does NOT re-mint cookies", async () => {
    const user = await createUser({ email: "cookieonly@test.com" });
    const resHeaders = new Headers();
    const caller = await callerAs(user, { resHeaders, authSource: "cookie" });
    await caller.auth.me();
    expect(resHeaders.getSetCookie()).toHaveLength(0);
  });
});
