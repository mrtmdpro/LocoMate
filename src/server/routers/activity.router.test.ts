import { describe, test, expect } from "vitest";
import { callerAs } from "@/test/trpc";
import { createUser, createHost } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { activities, activitySlots } from "@/server/db/schema";

/**
 * Minimal smoke coverage for the new activity router. Deeper cases (slot
 * capacity race, time overlap windows, photo validation) will follow in a
 * dedicated sprint; this locks the happy paths and auth gates.
 */

async function createActivity(overrides: Partial<typeof activities.$inferInsert> = {}) {
  const db = getTestDb();
  const [row] = await db
    .insert(activities)
    .values({
      authorId: overrides.authorId ?? null,
      title: overrides.title ?? "Test Activity",
      slug: overrides.slug ?? `test-activity-${Date.now()}`,
      subtitle: overrides.subtitle ?? "A quick one",
      description: overrides.description ?? "This activity covers the essentials in ninety minutes.",
      category: overrides.category ?? "workshop",
      priceAmount: overrides.priceAmount ?? 350_000,
      durationMinutes: overrides.durationMinutes ?? 90,
      maxCapacityPerSlot: overrides.maxCapacityPerSlot ?? 6,
      photos: overrides.photos ?? ["https://example.com/photo.jpg"],
      highlights: overrides.highlights ?? ["One", "Two"],
      status: overrides.status ?? "published",
      publishedAt: overrides.publishedAt ?? (overrides.status === "published" || !overrides.status ? new Date() : null),
      ...overrides,
    })
    .returning();
  return row;
}

async function createSlot(activityId: string, overrides: Partial<typeof activitySlots.$inferInsert> = {}) {
  const db = getTestDb();
  const now = new Date(Date.now() + 2 * 86400_000);
  const [row] = await db
    .insert(activitySlots)
    .values({
      activityId,
      startsAt: overrides.startsAt ?? now,
      endsAt: overrides.endsAt ?? new Date(now.getTime() + 90 * 60_000),
      capacity: overrides.capacity ?? 6,
      bookedCount: overrides.bookedCount ?? 0,
      status: overrides.status ?? "open",
    })
    .returning();
  return row;
}

describe("activity.list", () => {
  test("returns only published activities", async () => {
    const { user } = await createHost();
    await createActivity({ authorId: user.id, status: "published", title: "Live one" });
    await createActivity({ authorId: user.id, status: "draft", title: "Draft one" });

    const caller = await callerAs(null);
    const result = await caller.activity.list({ limit: 20, offset: 0 });
    const titles = result.map((a) => a.title);
    expect(titles).toContain("Live one");
    expect(titles).not.toContain("Draft one");
  });

  test("filters by category", async () => {
    const { user } = await createHost();
    await createActivity({ authorId: user.id, category: "workshop", title: "Workshop" });
    await createActivity({ authorId: user.id, category: "ticket", title: "Ticket" });

    const caller = await callerAs(null);
    const result = await caller.activity.list({ category: "workshop", limit: 20, offset: 0 });
    expect(result.every((a) => a.category === "workshop")).toBe(true);
    expect(result.some((a) => a.title === "Workshop")).toBe(true);
  });
});

describe("activity.getSlots", () => {
  test("returns only future open slots by default", async () => {
    const activity = await createActivity({});
    const past = new Date(Date.now() - 86400_000);
    const future = new Date(Date.now() + 86400_000);
    await createSlot(activity.id, { startsAt: past, endsAt: new Date(past.getTime() + 60_000) });
    const futureSlot = await createSlot(activity.id, { startsAt: future, endsAt: new Date(future.getTime() + 60_000) });
    await createSlot(activity.id, { startsAt: future, endsAt: new Date(future.getTime() + 60_000), status: "sold_out" });

    const caller = await callerAs(null);
    const slots = await caller.activity.getSlots({ activityId: activity.id });
    const ids = slots.map((s) => s.id);
    expect(ids).toContain(futureSlot.id);
    // sold_out + past excluded
    expect(slots.every((s) => s.status === "open")).toBe(true);
    expect(slots.every((s) => new Date(s.startsAt).getTime() > Date.now() - 1000)).toBe(true);
  });
});

describe("activity.publish", () => {
  test("rejects unverified host", async () => {
    const { user } = await createHost({ host: { verificationStatus: "pending" } });
    const activity = await createActivity({ authorId: user.id, status: "draft", publishedAt: null });
    const caller = await callerAs(user);
    await expect(caller.activity.publish({ id: activity.id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("requires description >= 50 chars", async () => {
    const { user } = await createHost();
    const activity = await createActivity({
      authorId: user.id,
      status: "draft",
      publishedAt: null,
      description: "Too short.",
    });
    const caller = await callerAs(user);
    await expect(caller.activity.publish({ id: activity.id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  test("happy path: verified host + valid content flips status to published", async () => {
    const { user } = await createHost();
    const activity = await createActivity({ authorId: user.id, status: "draft", publishedAt: null });
    const caller = await callerAs(user);
    const out = await caller.activity.publish({ id: activity.id });
    expect(out.status).toBe("published");
    expect(out.publishedAt).toBeTruthy();
  });

  test("rejects non-owner", async () => {
    const owner = await createHost();
    const intruder = await createHost();
    const activity = await createActivity({ authorId: owner.user.id, status: "draft", publishedAt: null });
    const caller = await callerAs(intruder.user);
    await expect(caller.activity.publish({ id: activity.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("activity.addSlot / removeSlot", () => {
  test("add requires ownership and valid time range", async () => {
    const { user } = await createHost();
    const activity = await createActivity({ authorId: user.id });
    const caller = await callerAs(user);
    await expect(
      caller.activity.addSlot({
        activityId: activity.id,
        startsAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 86400_000).toISOString(), // ends BEFORE start
        capacity: 4,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("remove refuses when booked", async () => {
    const { user } = await createHost();
    const activity = await createActivity({ authorId: user.id });
    const slot = await createSlot(activity.id, { bookedCount: 2 });
    const caller = await callerAs(user);
    await expect(caller.activity.removeSlot({ slotId: slot.id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});
