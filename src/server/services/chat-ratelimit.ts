import { TRPCError } from "@trpc/server";

/**
 * Chat rate limiter. Two buckets per user:
 *   - burst: 10 messages per 60 seconds (prevents flood)
 *   - daily: 100 messages per 24 hours   (prevents spammers)
 *
 * Uses Upstash Redis via @upstash/ratelimit when the env is configured
 * (production). Falls back to a process-local in-memory map in preview /
 * local dev / tests so the limiter doesn't silently no-op when Upstash
 * creds are missing. In-memory fallback is NOT multi-worker safe, which
 * is fine for its intended uses.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---- Shared state ---------------------------------------------------------

let cached: {
  burst: Ratelimit;
  daily: Ratelimit;
  redis: Redis;
} | null = null;

function getUpstash(): typeof cached {
  if (cached !== null) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  cached = {
    redis,
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "chat:burst",
    }),
    daily: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "86400 s"),
      prefix: "chat:daily",
    }),
  };
  return cached;
}

// ---- Local fallback -------------------------------------------------------

const local = {
  burst: new Map<string, number[]>(),
  daily: new Map<string, number[]>(),
};

function localCheck(
  map: Map<string, number[]>,
  userId: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = (map.get(userId) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= limit) {
    map.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  map.set(userId, stamps);
  return true;
}

// ---- Public API -----------------------------------------------------------

export async function enforceChatRateLimit(userId: string): Promise<void> {
  const upstash = getUpstash();
  if (upstash) {
    const [burst, daily] = await Promise.all([
      upstash.burst.limit(userId),
      upstash.daily.limit(userId),
    ]);
    if (!burst.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "You're sending too fast. Please wait a moment.",
      });
    }
    if (!daily.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Daily message limit reached. Try again tomorrow.",
      });
    }
    return;
  }
  // In-memory fallback (dev / test).
  const burstOk = localCheck(local.burst, userId, 10, 60_000);
  if (!burstOk) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You're sending too fast. Please wait a moment.",
    });
  }
  const dailyOk = localCheck(local.daily, userId, 100, 86_400_000);
  if (!dailyOk) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Daily message limit reached. Try again tomorrow.",
    });
  }
}

/**
 * Test-only: flush the in-memory buckets so tests don't leak state
 * across cases. Has no effect on the Upstash path.
 */
export function __resetChatRateLimit(): void {
  local.burst.clear();
  local.daily.clear();
}
