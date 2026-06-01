import { describe, test, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { GET } from "./[matchId]/route";
import { signToken, verifyToken } from "@/server/middleware/auth";
import { ACCESS_COOKIE, readCookie } from "@/server/lib/auth-cookies";

function ctx(matchId: string) {
  return { params: Promise.resolve({ matchId }) };
}

// NOTE: the test runner uses happy-dom, which treats `Cookie` as a forbidden
// request header and silently drops it from a constructed `Request`. So we
// can't inject `lm_access` as a cookie here; the cookie→JWT path the route
// uses is instead validated at the helper level (last test), and the
// end-to-end cookie auth is covered by the manual preview sign-off. The
// `Authorization` header is NOT forbidden, so the 401 paths below are genuine.
describe("chat SSE route auth", () => {
  test("returns 401 with no cookie and no Authorization header", async () => {
    const req = new Request("http://localhost/api/chat/stream/abc");
    const res = await GET(req, ctx("abc"));
    expect(res.status).toBe(401);
  });

  test("returns 401 when the bearer token is garbage", async () => {
    const req = new Request("http://localhost/api/chat/stream/abc", {
      headers: { authorization: "Bearer not-a-jwt" },
    });
    const res = await GET(req, ctx("abc"));
    expect(res.status).toBe(401);
  });

  test("returns 401 when a refresh token is presented in the access slot", async () => {
    // Defends the typ enforcement at the SSE boundary too.
    const { signRefreshToken } = await import("@/server/middleware/auth");
    const refresh = signRefreshToken({ userId: randomUUID(), role: "traveler" });
    const req = new Request("http://localhost/api/chat/stream/abc", {
      headers: { authorization: `Bearer ${refresh}` },
    });
    const res = await GET(req, ctx("abc"));
    expect(res.status).toBe(401);
  });

  test("the lm_access cookie value is a raw JWT the route can verify", () => {
    // Mirrors exactly what the route does: read the cookie, then verifyToken.
    const userId = randomUUID();
    const token = signToken({ userId, role: "traveler" });
    const parsed = readCookie(`lm_access=${token}`, ACCESS_COOKIE);
    expect(parsed).toBe(token);
    expect(verifyToken(parsed as string).userId).toBe(userId);
  });
});
