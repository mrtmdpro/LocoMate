import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { __resetChatRateLimit, rateLimit } from "@/server/services/chat-ratelimit";
import {
  OAUTH_CALLBACK_RATE_LIMIT,
  OAUTH_RATE_LIMIT_WINDOW_SEC,
  oauthRateLimitKey,
} from "@/server/services/oauth-rate-limit";

describe("/api/auth/google/callback rate limit", () => {
  beforeEach(() => __resetChatRateLimit());

  it("returns 429 when OAuth callback attempts exceed the IP bucket", async () => {
    const ip = "203.0.113.11";
    const key = oauthRateLimitKey("callback", ip);
    for (let i = 0; i < OAUTH_CALLBACK_RATE_LIMIT; i++) {
      await rateLimit({
        key,
        limit: OAUTH_CALLBACK_RATE_LIMIT,
        windowSec: OAUTH_RATE_LIMIT_WINDOW_SEC,
      });
    }

    const res = await GET(
      new Request("http://localhost/api/auth/google/callback?error=access_denied", {
        headers: { "x-real-ip": ip },
      }),
    );

    expect(res.status).toBe(429);
    await expect(res.text()).resolves.toBe("Too many OAuth attempts");
  });
});
