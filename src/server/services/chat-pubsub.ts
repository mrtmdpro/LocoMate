import { Redis } from "@upstash/redis";

/**
 * Chat real-time pub/sub over Upstash Redis.
 *
 * Publishers (send/edit/delete/react/mark-read/typing) push JSON
 * events to a channel keyed per match: `chat:{matchId}`. The SSE
 * route at /api/chat/stream/[matchId] SUBSCRIBEs to that channel
 * and forwards events to the connected browser.
 *
 * When Upstash creds aren't configured (preview / local / tests) the
 * functions are no-ops. The client already polls as a safety net, so
 * the feature degrades gracefully -- sends still land, the UI still
 * catches up on the next 3s poll tick.
 */

export type ChatEvent =
  | {
      type: "message.new";
      message: {
        id: string;
        matchId: string;
        senderId: string | null;
        content: string;
        createdAt: Date | null;
        attachmentUrl?: string | null;
        attachmentKind?: string | null;
      };
    }
  | { type: "message.edited"; id: string; content: string; editedAt: string }
  | { type: "message.deleted"; id: string }
  | {
      type: "reaction.added";
      messageId: string;
      emoji: string;
      userId: string;
    }
  | {
      type: "reaction.removed";
      messageId: string;
      emoji: string;
      userId: string;
    }
  | { type: "typing.start"; userId: string }
  | { type: "read.advance"; userId: string };

let redisCache: Redis | null = null;
function getRedis(): Redis | null {
  if (redisCache) return redisCache;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redisCache = new Redis({ url, token });
  return redisCache;
}

export async function publishChatEvent(
  matchId: string,
  event: ChatEvent,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return; // degrade gracefully; client polling fallback catches up.
  try {
    const channel = `chat:${matchId}`;
    await redis.publish(channel, JSON.stringify(event));
    // Ring buffer: keep last 50 events per match so an SSE reconnect
    // with Last-Event-Id can replay missed events. Trimmed on each
    // publish so unbounded growth is impossible.
    await redis.zadd(`${channel}:log`, {
      score: Date.now(),
      member: JSON.stringify({ ...event, _ts: Date.now() }),
    });
    await redis.zremrangebyrank(`${channel}:log`, 0, -51);
    await redis.expire(`${channel}:log`, 60 * 60 * 24); // 24h TTL
  } catch {
    // Intentional swallow -- pubsub outage must not break the hot path.
  }
}

/**
 * Fetch recent events for a match, newest last. Used by the SSE route
 * on reconnect to replay events the client missed.
 */
export async function getRecentChatEvents(
  matchId: string,
  sinceTs = 0,
): Promise<Array<ChatEvent & { _ts: number }>> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const channel = `chat:${matchId}:log`;
    const raw = await redis.zrange(channel, sinceTs, "+inf", {
      byScore: true,
    });
    return (raw as string[]).map((s) => JSON.parse(s));
  } catch {
    return [];
  }
}
