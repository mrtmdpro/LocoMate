import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import { __resetChatRateLimit, rateLimit } from "@/server/services/chat-ratelimit";
import {
  OAUTH_RATE_LIMIT_WINDOW_SEC,
  OAUTH_START_RATE_LIMIT,
  oauthRateLimitKey,
} from "@/server/services/oauth-rate-limit";

describe("/api/auth/google rate limit", () => {
  beforeEach(() => __resetChatRateLimit());

  it("returns 429 when OAuth start attempts exceed the IP bucket", async () => {
    const ip = "203.0.113.10";
    const key = oauthRateLimitKey("start", ip);
    for (let i = 0; i < OAUTH_START_RATE_LIMIT; i++) {
      await rateLimit({
        key,
        limit: OAUTH_START_RATE_LIMIT,
        windowSec: OAUTH_RATE_LIMIT_WINDOW_SEC,
      });
    }

    const res = await GET(
      new Request("http://localhost/api/auth/google", {
        headers: { "x-forwarded-for": `${ip}, 10.0.0.2` },
      }),
    );

    expect(res.status).toBe(429);
    await expect(res.text()).resolves.toBe("Too many OAuth attempts");
  });
});
