import { describe, test, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { rateLimit, enforceChatRateLimit, __resetChatRateLimit } from "./chat-ratelimit";

describe("rateLimit", () => {
  beforeEach(() => __resetChatRateLimit());

  test("allows up to the limit then throws TOO_MANY_REQUESTS (429)", async () => {
    const key = "test:rl:1.2.3.4";
    await rateLimit({ key, limit: 3, windowSec: 60 });
    await rateLimit({ key, limit: 3, windowSec: 60 });
    await rateLimit({ key, limit: 3, windowSec: 60 });

    let thrown: unknown;
    try {
      await rateLimit({ key, limit: 3, windowSec: 60 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe("TOO_MANY_REQUESTS");
  });

  test("different keys have independent buckets", async () => {
    await rateLimit({ key: "k:a", limit: 1, windowSec: 60 });
    // A different key is unaffected by k:a being exhausted.
    await expect(rateLimit({ key: "k:b", limit: 1, windowSec: 60 })).resolves.toBeUndefined();
    await expect(rateLimit({ key: "k:a", limit: 1, windowSec: 60 })).rejects.toBeInstanceOf(TRPCError);
  });

  test("enforceChatRateLimit still throttles a chatty user (back-compat wrapper)", async () => {
    const userId = "chatter";
    // Burst limit is 10/min.
    for (let i = 0; i < 10; i++) {
      await enforceChatRateLimit(userId);
    }
    await expect(enforceChatRateLimit(userId)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
