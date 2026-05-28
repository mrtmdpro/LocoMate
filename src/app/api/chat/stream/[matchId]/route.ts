import { db } from "@/server/db";
import { verifyToken } from "@/server/middleware/auth";
import { matches } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { Redis } from "@upstash/redis";

/**
 * Server-Sent Events endpoint that forwards chat events to the
 * conversation view. Wire-shape:
 *
 *   data: {"type":"message.new","message":{...},"_ts":1718283}
 *
 * Design:
 *   - Upstash REST doesn't expose a blocking SUBSCRIBE, so we poll
 *     the match's ring buffer every 1500 ms. Latency end-to-end is
 *     ~1.5 s which is well under the 3 s polling we're replacing on
 *     the client, and the server-side poll collapses fan-out.
 *   - Client reconnects with a `Last-Event-Id` header; we replay any
 *     events in the ring buffer with a newer `_ts`.
 *   - Node runtime (longer timeout than Edge); we close after the
 *     Vercel function timeout minus a safety margin so the client
 *     reconnects cleanly.
 *   - Participant auth: same JWT as tRPC. Non-participants get 403.
 *
 * Degradation: if Upstash isn't configured, we still open a stream
 * and keep it alive with heartbeats; the client polling fallback
 * already handles updates. Zero new infra is required to ship this
 * route.
 */

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 30_000;
// Stay under Vercel's Hobby 300 s timeout with a generous safety net.
const MAX_STREAM_MS = 280_000;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function verifyParticipant(matchId: string, userId: string): Promise<boolean> {
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match || match.status !== "matched") return false;
  return match.userAId === userId || match.userBId === userId;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ matchId: string }> },
): Promise<Response> {
  const { matchId } = await context.params;

  // Auth: accept either Authorization header (native fetch) or a cookie
  // (browser EventSource which can't set headers). The cookie name
  // `locomate-auth` matches what the Zustand store writes at login.
  const auth = request.headers.get("authorization") ?? "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/(?:^|;\s*)locomate-auth=([^;]+)/);
    if (match) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        token = parsed?.state?.accessToken ?? "";
      } catch {
        // fall through -> 401
      }
    }
  }
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const ok = await verifyParticipant(matchId, payload.userId);
  if (!ok) {
    return new Response("Forbidden", { status: 403 });
  }

  const redis = getRedis();
  const channel = `chat:${matchId}:log`;
  const startedAt = Date.now();

  // Use the Last-Event-Id header for replay on reconnect. If absent,
  // start from "now" so the client doesn't receive ancient events.
  const lastEventId = request.headers.get("last-event-id");
  let lastTs = lastEventId ? Number(lastEventId) : Date.now();
  if (!Number.isFinite(lastTs)) lastTs = Date.now();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Initial comment + retry hint tells the browser how long to wait
      // before reconnecting if this stream is closed.
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      controller.enqueue(encoder.encode(`: connected ${new Date().toISOString()}\n\n`));

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", close);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          close();
        }
      }, HEARTBEAT_INTERVAL_MS);

      const pollTick = async () => {
        if (closed || !redis) return;
        try {
          // `byScore` fetch events with score strictly greater than lastTs.
          const entries = await redis.zrange(channel, lastTs + 1, "+inf", {
            byScore: true,
          });
          for (const raw of entries as string[]) {
            let parsed: { _ts: number } | null = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              continue;
            }
            if (!parsed) continue;
            const ts = parsed._ts ?? Date.now();
            lastTs = Math.max(lastTs, ts);
            controller.enqueue(
              encoder.encode(
                `id: ${ts}\nevent: chat\ndata: ${raw}\n\n`,
              ),
            );
          }
        } catch {
          // Intentionally swallow -- transient Upstash errors shouldn't
          // tear down the long-lived stream.
        }
      };

      const poller = setInterval(() => void pollTick(), POLL_INTERVAL_MS);

      // Auto-close before hitting Vercel's function timeout so the
      // browser reconnects cleanly with a Last-Event-Id header.
      const deadline = setTimeout(() => {
        clearInterval(heartbeat);
        clearInterval(poller);
        close();
      }, MAX_STREAM_MS - (Date.now() - startedAt));

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(poller);
        clearTimeout(deadline);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable buffering in case any intermediary proxy sees it.
      "x-accel-buffering": "no",
    },
  });
}
