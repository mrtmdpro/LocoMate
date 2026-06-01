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

let redisClient: Redis | null = null;
let redisChecked = false;

function getRedis(): Redis | null {
  if (redisChecked) return redisClient;
  redisChecked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// One Upstash Ratelimit instance per (limit, windowSec) config, cached so we
// don't rebuild the sliding-window machinery on every call.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${limit}:${windowSec}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "rl",
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

// ---- Local fallback -------------------------------------------------------

// Single in-memory bucket store keyed by the caller-supplied `key`. Keys are
// unique per endpoint (e.g. `auth:login:ip:1.2.3.4`) so configs never collide.
const localBuckets = new Map<string, number[]>();

function localCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = (localBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= limit) {
    localBuckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  localBuckets.set(key, stamps);
  return true;
}

// ---- Public API -----------------------------------------------------------

const TOO_MANY = (message: string) =>
  new TRPCError({ code: "TOO_MANY_REQUESTS", message });

/**
 * General-purpose fixed-window rate limit. Backed by Upstash when configured;
 * falls back to a process-local in-memory window in dev / preview / tests.
 *
 * Throws `TOO_MANY_REQUESTS` when the bucket is exhausted. Callers pick a
 * stable `key` (IP for unauthenticated endpoints, userId for authenticated
 * ones) namespaced by feature.
 */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
  message?: string;
}): Promise<void> {
  const { key, limit, windowSec } = opts;
  const message = opts.message ?? "Too many requests. Please slow down.";
  const limiter = getLimiter(limit, windowSec);
  if (limiter) {
    const { success } = await limiter.limit(key);
    if (!success) throw TOO_MANY(message);
    return;
  }
  if (!localCheck(key, limit, windowSec * 1000)) throw TOO_MANY(message);
}

/**
 * Chat-message limiter: 10 messages / 60s (burst) AND 100 / 24h (daily),
 * keyed by userId. Thin wrapper over `rateLimit` so existing callers + tests
 * keep working unchanged.
 */
export async function enforceChatRateLimit(userId: string): Promise<void> {
  await rateLimit({
    key: `chat:burst:${userId}`,
    limit: 10,
    windowSec: 60,
    message: "You're sending too fast. Please wait a moment.",
  });
  await rateLimit({
    key: `chat:daily:${userId}`,
    limit: 100,
    windowSec: 86_400,
    message: "Daily message limit reached. Try again tomorrow.",
  });
}

/**
 * Test-only: flush the in-memory buckets so tests don't leak state
 * across cases. Has no effect on the Upstash path.
 */
export function __resetChatRateLimit(): void {
  localBuckets.clear();
}
