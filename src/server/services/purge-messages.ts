import { sql } from "drizzle-orm";
import { messages, matches } from "@/server/db/schema";

/**
 * Minimal Drizzle-shaped interface `purgeStaleMessages` needs. Using an
 * explicit structural type lets us call it with either the prod
 * postgres-js driver or the PGlite test driver without a
 * `PgliteDatabase<...>` mismatch. We only need `execute`.
 */
type DrizzleLike = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * Hard-delete chat messages older than `retentionDays` (30 days by
 * default -- the platform-committed retention window). Also clears
 * matches that have no surviving messages AND no active `matched`
 * status so the inbox doesn't accumulate empty conversation rows.
 *
 * Implementation notes:
 *   - Batch the DELETE in chunks so a long-running retention run
 *     doesn't hold row locks on the messages table (Neon is a
 *     single-primary DB; chunked deletes with a RETURNING id let us
 *     observe progress and bail cleanly on timeout).
 *   - Called by the /api/cron/purge-messages route + the admin
 *     `chat.purgeStale` tRPC procedure.
 */

const CHUNK_SIZE = 1000;

export async function purgeStaleMessages(
  db: DrizzleLike,
  retentionDays = 30,
): Promise<{ deletedMessages: number; deletedMatches: number }> {
  // Hard-delete old messages in chunks. Includes rows soft-deleted by
  // user unsend or account-deletion tombstoning -- the privacy promise
  // is "gone after 30 days", not "soft-gone after 30 days".
  let totalMessages = 0;
  // Separate chunked delete loop so one call can run for several
  // seconds against a big backlog without hitting Vercel's function
  // timeout. Each iteration commits independently.
  for (;;) {
    const result = await db.execute(sql`
      WITH stale AS (
        SELECT id FROM ${messages}
        WHERE created_at < NOW() - (${retentionDays} || ' days')::interval
        ORDER BY created_at
        LIMIT ${CHUNK_SIZE}
      )
      DELETE FROM ${messages}
      USING stale
      WHERE ${messages}.id = stale.id
      RETURNING ${messages}.id
    `);
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const n = rows.length;
    totalMessages += n;
    if (n < CHUNK_SIZE) break;
  }

  // Clean up matches with zero surviving messages AND status != 'matched'.
  // Empty "pending" pairs (swipes that never converted) accumulate
  // forever otherwise. We keep 'matched' rows even without messages so
  // the inbox shows "Say hello!" empty-state for intentional matches.
  const matchResult = await db.execute(sql`
    DELETE FROM ${matches}
    WHERE status <> 'matched'
      AND NOT EXISTS (
        SELECT 1 FROM ${messages} m WHERE m.match_id = ${matches}.id
      )
    RETURNING id
  `);
  const matchRows = Array.isArray(matchResult)
    ? matchResult
    : (matchResult as { rows?: unknown[] }).rows ?? [];

  return {
    deletedMessages: totalMessages,
    deletedMatches: matchRows.length,
  };
}
