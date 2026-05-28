import { describe, test, expect } from "vitest";
import { and, eq, gte } from "drizzle-orm";
import { getTestDb } from "@/test/setup";
import { createHost } from "@/test/fixtures";
import { activities, activitySlots } from "@/server/db/schema";
import { topupActivitySlots } from "./topup-activity-slots";

async function createPublishedActivity(authorId: string, opts: { capacity?: number; durationMinutes?: number } = {}) {
  const db = getTestDb();
  const [row] = await db
    .insert(activities)
    .values({
      authorId,
      title: `Topup Test Act ${Math.random().toString(36).slice(2, 8)}`,
      slug: `topup-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: "workshop",
      priceAmount: 500_000,
      durationMinutes: opts.durationMinutes ?? 120,
      maxCapacityPerSlot: opts.capacity ?? 6,
      description: "A test activity for the slot-topup script.",
      photos: ["https://example.com/a.jpg"],
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  return row;
}

async function countFutureOpenSlots(activityId: string, now: Date = new Date()): Promise<number> {
  const db = getTestDb();
  const rows = await db
    .select()
    .from(activitySlots)
    .where(
      and(
        eq(activitySlots.activityId, activityId),
        gte(activitySlots.startsAt, now),
        eq(activitySlots.status, "open"),
      ),
    );
  return rows.length;
}

describe("topupActivitySlots", () => {
  test("activity with NO future slots gets 6 fresh rolling slots inserted", async () => {
    const db = getTestDb();
    const host = await createHost();
    const act = await createPublishedActivity(host.user.id);

    // Drop in a few stale (past) slots to ensure the past doesn't count.
    const past = new Date(Date.now() - 5 * 86400_000);
    await db.insert(activitySlots).values({
      activityId: act.id,
      startsAt: past,
      endsAt: new Date(past.getTime() + 60 * 60_000),
      capacity: act.maxCapacityPerSlot,
      bookedCount: 0,
      status: "open",
    });

    const result = await topupActivitySlots(db);
    expect(result.toppedUpActivities).toBeGreaterThanOrEqual(1);
    expect(result.insertedSlots).toBeGreaterThanOrEqual(6);
    expect(await countFutureOpenSlots(act.id)).toBe(6);
  });

  test("activity with PLENTY of future slots is skipped (no inserts)", async () => {
    const db = getTestDb();
    const host = await createHost();
    const act = await createPublishedActivity(host.user.id);

    const future = new Date(Date.now() + 5 * 86400_000);
    await db.insert(activitySlots).values(
      [0, 1, 2, 3].map((i) => ({
        activityId: act.id,
        startsAt: new Date(future.getTime() + i * 86400_000),
        endsAt: new Date(future.getTime() + i * 86400_000 + 60 * 60_000),
        capacity: act.maxCapacityPerSlot,
        bookedCount: 0,
        status: "open" as const,
      })),
    );

    const before = await countFutureOpenSlots(act.id);
    expect(before).toBe(4);

    const result = await topupActivitySlots(db);
    // The healthy activity must be skipped. (Other test fixtures may also
    // be in the DB; assert via the per-activity count, not the global
    // total, so this test is independent of other activities present.)
    expect(await countFutureOpenSlots(act.id)).toBe(4);
    expect(result.skippedActivities).toBeGreaterThanOrEqual(1);
  });

  test("activity with 1 future slot (below threshold) gets topped up", async () => {
    const db = getTestDb();
    const host = await createHost();
    const act = await createPublishedActivity(host.user.id);

    const soonish = new Date(Date.now() + 2 * 86400_000);
    await db.insert(activitySlots).values({
      activityId: act.id,
      startsAt: soonish,
      endsAt: new Date(soonish.getTime() + 60 * 60_000),
      capacity: act.maxCapacityPerSlot,
      bookedCount: 0,
      status: "open",
    });

    expect(await countFutureOpenSlots(act.id)).toBe(1);
    await topupActivitySlots(db);
    // 1 existing + 6 inserted.
    expect(await countFutureOpenSlots(act.id)).toBe(7);
  });

  test("idempotent: a second run after a topup is a no-op for that activity", async () => {
    const db = getTestDb();
    const host = await createHost();
    const act = await createPublishedActivity(host.user.id);

    await topupActivitySlots(db);
    const afterFirst = await countFutureOpenSlots(act.id);
    await topupActivitySlots(db);
    const afterSecond = await countFutureOpenSlots(act.id);

    expect(afterFirst).toBe(6);
    expect(afterSecond).toBe(6);
  });

  test("unpublished (draft) activities are NOT topped up", async () => {
    const db = getTestDb();
    const host = await createHost();
    const [draft] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Draft Activity",
        slug: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: "workshop",
        priceAmount: 500_000,
        durationMinutes: 120,
        maxCapacityPerSlot: 6,
        description: "Draft activity, should not be considered.",
        photos: ["https://example.com/d.jpg"],
        status: "draft",
      })
      .returning();

    await topupActivitySlots(db);
    expect(await countFutureOpenSlots(draft.id)).toBe(0);
  });

  test("inserted slots span the next ~14 days at varied local-VN hours", async () => {
    const db = getTestDb();
    const host = await createHost();
    const act = await createPublishedActivity(host.user.id, { durationMinutes: 90 });

    const now = new Date();
    await topupActivitySlots(db, now);

    const inserted = await db
      .select()
      .from(activitySlots)
      .where(eq(activitySlots.activityId, act.id));
    expect(inserted).toHaveLength(6);
    for (const s of inserted) {
      // All slots are in the future relative to `now`.
      expect(s.startsAt.getTime()).toBeGreaterThan(now.getTime());
      // None are more than 15 days out (14 days + buffer).
      expect(s.startsAt.getTime()).toBeLessThan(now.getTime() + 15 * 86400_000);
      // endsAt - startsAt == durationMinutes
      expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(90 * 60_000);
    }
    // Hours are not all identical (the rotation actually varies the time).
    const uniqueHours = new Set(inserted.map((s) => s.startsAt.getUTCHours()));
    expect(uniqueHours.size).toBeGreaterThan(1);
  });
});
