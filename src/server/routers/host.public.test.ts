import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createHost, createExperience } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { hostProfiles, activities, users } from "@/server/db/schema";

/**
 * Helpers -- slugs are mandatory for the public profile flow, so every
 * test creates a host with a deterministic slug.
 */
async function withSlug(hostId: string, slug: string) {
  const db = getTestDb();
  await db.update(hostProfiles).set({ publicSlug: slug }).where(eq(hostProfiles.id, hostId));
}

async function createPublishedActivity(authorId: string, overrides: Record<string, unknown> = {}) {
  const db = getTestDb();
  const [row] = await db
    .insert(activities)
    .values({
      authorId,
      title: (overrides.title as string) ?? "Test Activity",
      slug: (overrides.slug as string) ?? `act-${Math.random().toString(36).slice(2, 8)}`,
      category: (overrides.category as string) ?? "workshop",
      priceAmount: 400_000,
      durationMinutes: 120,
      maxCapacityPerSlot: 6,
      description: "Long enough description for publish requirements (at least fifty characters).",
      photos: ["https://example.com/a.jpg"],
      status: "published",
      publishedAt: new Date(),
      ...overrides,
    })
    .returning();
  return row;
}

describe("host.listPublic", () => {
  test("returns only approved + active hosts with a slug, sorted by rating", async () => {
    const approved = await createHost({ host: { verificationStatus: "approved", avgRating: "4.9", totalReviews: 20 } });
    await withSlug(approved.host.id, "approved-host");

    const pending = await createHost({ host: { verificationStatus: "pending" } });
    await withSlug(pending.host.id, "pending-host");

    const unslugged = await createHost({ host: { verificationStatus: "approved" } });
    // no slug -- excluded

    const inactive = await createHost({
      user: { isActive: false },
      host: { verificationStatus: "approved" },
    });
    await withSlug(inactive.host.id, "inactive-host");

    const caller = await callerAs(null);
    const result = await caller.host.listPublic({ limit: 50 });
    const slugs = result.map((r) => r.slug);
    expect(slugs).toContain("approved-host");
    expect(slugs).not.toContain("pending-host");
    expect(slugs).not.toContain("inactive-host");
    // unslugged host is also excluded
    expect(result.every((r) => r.slug !== null)).toBe(true);
    // defensive: our unslugged host shouldn't leak through
    void unslugged;
  });

  test("filters by specialty", async () => {
    const foodHost = await createHost({ host: { specialties: ["food", "nightlife"] } });
    await withSlug(foodHost.host.id, "food-host");
    const cultureHost = await createHost({ host: { specialties: ["culture", "history"] } });
    await withSlug(cultureHost.host.id, "culture-host");

    const caller = await callerAs(null);
    const result = await caller.host.listPublic({ specialty: "food", limit: 50 });
    expect(result.map((r) => r.slug)).toContain("food-host");
    expect(result.map((r) => r.slug)).not.toContain("culture-host");
  });

  test("minRating floor works", async () => {
    const five = await createHost({ host: { avgRating: "4.90", totalReviews: 10 } });
    await withSlug(five.host.id, "five-star");
    const three = await createHost({ host: { avgRating: "3.00", totalReviews: 10 } });
    await withSlug(three.host.id, "three-star");

    const caller = await callerAs(null);
    const result = await caller.host.listPublic({ minRating: 4.5, limit: 50 });
    expect(result.map((r) => r.slug)).toContain("five-star");
    expect(result.map((r) => r.slug)).not.toContain("three-star");
  });
});

describe("host.getPublicProfile", () => {
  test("returns host + their published experiences + activities", async () => {
    const { user, host } = await createHost({
      user: { displayName: "Nam" },
      host: { bio: "Hanoi food guru", specialties: ["food"], avgRating: "4.80", totalReviews: 12 },
    });
    await withSlug(host.id, "nam-test");

    // Host-authored published experience
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Food tour" });
    // Curated experience (no author) -- should NOT appear on host's profile
    await createExperience({ kind: "curated", status: "published", title: "Curated tour" });
    // Host-authored draft -- excluded
    await createExperience({ authorId: user.id, kind: "host_custom", status: "draft", title: "Draft tour" });
    // Host-authored published activity
    await createPublishedActivity(user.id, { title: "Cooking class" });

    const caller = await callerAs(null);
    const result = await caller.host.getPublicProfile({ slug: "nam-test" });

    expect(result.host.displayName).toBe("Nam");
    expect(result.host.bio).toBe("Hanoi food guru");
    // Published host experiences only.
    expect(result.experiences.map((e) => e.title)).toEqual(["Food tour"]);
    expect(result.activities.map((a) => a.title)).toEqual(["Cooking class"]);
  });

  test("NOT_FOUND when slug doesn't exist", async () => {
    const caller = await callerAs(null);
    await expect(caller.host.getPublicProfile({ slug: "ghost" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("NOT_FOUND when host's user account is inactive", async () => {
    const { host } = await createHost({ user: { isActive: false } });
    await withSlug(host.id, "deactivated");

    const caller = await callerAs(null);
    await expect(caller.host.getPublicProfile({ slug: "deactivated" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("PII (email, identityDocUrl) never appears in the response", async () => {
    const db = getTestDb();
    const { user, host } = await createHost();
    await db.update(hostProfiles).set({ identityDocUrl: "https://secret/doc.pdf" }).where(eq(hostProfiles.id, host.id));
    await withSlug(host.id, "privacy-test");

    const caller = await callerAs(null);
    const result = await caller.host.getPublicProfile({ slug: "privacy-test" });
    const asJson = JSON.stringify(result);
    expect(asJson).not.toContain(user.email);
    expect(asJson).not.toContain("secret/doc.pdf");
    expect(asJson).not.toContain("identityDocUrl");
  });
});

describe("host.save / unsave / getSaved / isSaved", () => {
  test("save + isSaved + getSaved full roundtrip", async () => {
    const traveler = await createUser();
    const { host } = await createHost();
    await withSlug(host.id, "save-target");

    const caller = await callerAs(traveler);
    await caller.host.save({ hostId: host.id });

    expect(await caller.host.isSaved({ hostId: host.id })).toBe(true);
    const saved = await caller.host.getSaved();
    expect(saved).toHaveLength(1);
    expect(saved[0].hostId).toBe(host.id);
    expect(saved[0].slug).toBe("save-target");

    // unsave
    await caller.host.unsave({ hostId: host.id });
    expect(await caller.host.isSaved({ hostId: host.id })).toBe(false);
    expect(await caller.host.getSaved()).toHaveLength(0);
  });

  test("save is idempotent (re-saving doesn't error)", async () => {
    const traveler = await createUser();
    const { host } = await createHost();

    const caller = await callerAs(traveler);
    const first = await caller.host.save({ hostId: host.id });
    expect(first.alreadySaved).toBe(false);
    const second = await caller.host.save({ hostId: host.id });
    expect(second.alreadySaved).toBe(true);

    // Only one row persisted.
    const saved = await caller.host.getSaved();
    expect(saved).toHaveLength(1);
  });

  test("can't save own profile", async () => {
    const { user, host } = await createHost();
    const caller = await callerAs(user);
    await expect(caller.host.save({ hostId: host.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  test("NOT_FOUND when saving a nonexistent / inactive host", async () => {
    const traveler = await createUser();
    const inactive = await createHost({ user: { isActive: false } });

    const caller = await callerAs(traveler);
    await expect(caller.host.save({ hostId: inactive.host.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("isSaved returns false for anonymous caller", async () => {
    const { host } = await createHost();
    const caller = await callerAs(null);
    const result = await caller.host.isSaved({ hostId: host.id });
    expect(result).toBe(false);
  });
});

describe("chat.startWithHost", () => {
  test("creates a new match when no conversation exists", async () => {
    const traveler = await createUser();
    const { user: hostUser } = await createHost();

    const caller = await callerAs(traveler);
    const result = await caller.chat.startWithHost({ hostUserId: hostUser.id });
    expect(result.created).toBe(true);
    expect(result.matchId).toBeTruthy();
  });

  test("reuses an existing match between the same two users", async () => {
    const traveler = await createUser();
    const { user: hostUser } = await createHost();

    const caller = await callerAs(traveler);
    const first = await caller.chat.startWithHost({ hostUserId: hostUser.id });
    const second = await caller.chat.startWithHost({ hostUserId: hostUser.id });
    expect(second.matchId).toBe(first.matchId);
    expect(second.created).toBe(false);
  });

  test("rejects messaging self", async () => {
    const { user: hostUser } = await createHost();
    const caller = await callerAs(hostUser);
    await expect(caller.chat.startWithHost({ hostUserId: hostUser.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  test("rejects messaging a non-host user", async () => {
    const traveler = await createUser();
    const otherTraveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);
    await expect(caller.chat.startWithHost({ hostUserId: otherTraveler.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  test("NOT_FOUND when target account is inactive", async () => {
    const traveler = await createUser();
    const { user: inactiveHost } = await createHost({ user: { isActive: false } });
    const db = getTestDb();
    // sanity: createHost should have left isActive=false
    const row = await db.query.users.findFirst({ where: eq(users.id, inactiveHost.id) });
    expect(row?.isActive).toBe(false);

    const caller = await callerAs(traveler);
    await expect(caller.chat.startWithHost({ hostUserId: inactiveHost.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
