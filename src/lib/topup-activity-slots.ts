import { and, eq, gte, sql } from "drizzle-orm";
import { activities, activitySlots } from "@/server/db/schema";

/**
 * Keep every published activity bookable by topping up time slots whose
 * `startsAt` has crossed into the past.
 *
 * Why this exists: `seed.ts` writes ~6 slots per activity at
 * `now + 1..13 days` *at seed time*. Once a deployment crosses that 13-day
 * window, `activity.getSlots` (which filters `startsAt < now`) returns
 * empty, and every activity detail page becomes a dead-end. This function
 * is purely additive: it never deletes, never updates, just inserts new
 * rolling slots when fewer than `MIN_FUTURE_SLOTS` open slots remain.
 *
 * Idempotent: running it twice in a row inserts on the first pass and is
 * a no-op on the second. Safe to wire as a Vercel Cron job and to call
 * ad-hoc from `pnpm slots:topup`.
 */

const MIN_FUTURE_SLOTS = 3;
const SLOTS_TO_INSERT = 6;
const START_HOUR_POOL_VN = [9, 11, 14, 16, 18, 20];
// VN is UTC+7, so to put a slot at e.g. 09:00 local we set UTC hour to 02.
const VN_UTC_OFFSET_HOURS = 7;

export interface TopupResult {
  scannedActivities: number;
  skippedActivities: number;
  toppedUpActivities: number;
  insertedSlots: number;
}

/**
 * The Drizzle client surface this function uses. Both the postgres-js
 * client used in prod and the PGlite client used in tests satisfy this
 * shape, but their concrete Drizzle types differ -- so we type-erase
 * here rather than over-specifying.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleClient = any;

export async function topupActivitySlots(db: DrizzleClient, now: Date = new Date()): Promise<TopupResult> {
  const published = await db
    .select({
      id: activities.id,
      maxCapacity: activities.maxCapacityPerSlot,
      durationMinutes: activities.durationMinutes,
    })
    .from(activities)
    .where(eq(activities.status, "published"));

  let scanned = 0;
  let skipped = 0;
  let topped = 0;
  let inserted = 0;

  for (const act of published as Array<{ id: string; maxCapacity: number; durationMinutes: number }>) {
    scanned += 1;

    const [row] = await db
      .select({ count: sql<string>`count(*)::text` })
      .from(activitySlots)
      .where(
        and(
          eq(activitySlots.activityId, act.id),
          gte(activitySlots.startsAt, now),
          eq(activitySlots.status, "open"),
        ),
      );
    const futureOpen = Number(row?.count ?? 0);
    if (futureOpen >= MIN_FUTURE_SLOTS) {
      skipped += 1;
      continue;
    }

    // Build SLOTS_TO_INSERT rolling slots spread over the next 14 days at
    // varied local-VN hours. Mirrors the cadence in seed.ts so the picker
    // still reads as a real calendar rather than a single block.
    const newSlots: typeof activitySlots.$inferInsert[] = [];
    for (let i = 0; i < SLOTS_TO_INSERT; i += 1) {
      const daysAhead = 2 + ((i + scanned) % 12); // 2..13 days out
      const localHour = START_HOUR_POOL_VN[(i + scanned) % START_HOUR_POOL_VN.length];
      const startsAt = new Date(now);
      startsAt.setUTCDate(startsAt.getUTCDate() + daysAhead);
      startsAt.setUTCHours(localHour - VN_UTC_OFFSET_HOURS, 0, 0, 0);
      const endsAt = new Date(startsAt.getTime() + act.durationMinutes * 60 * 1000);
      newSlots.push({
        activityId: act.id,
        startsAt,
        endsAt,
        capacity: act.maxCapacity,
        bookedCount: 0,
        status: "open",
      });
    }

    await db.insert(activitySlots).values(newSlots);
    topped += 1;
    inserted += newSlots.length;
  }

  return {
    scannedActivities: scanned,
    skippedActivities: skipped,
    toppedUpActivities: topped,
    insertedSlots: inserted,
  };
}
