import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createExperience,
  createPlace,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { tours, experiences, hostProfiles, tourStops } from "@/server/db/schema";

describe("experience.list", () => {
  test("returns only published experiences (drafts/archived/rejected hidden)", async () => {
    const { user } = await createHost();
    await createExperience({ authorId: user.id, kind: "host_custom", status: "draft", title: "Draft Tour" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "archived", title: "Archived Tour" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Visible Tour" });
    await createExperience({ kind: "curated", status: "published", title: "Curated Tour" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list();

    const titles = rows.map((r) => r.title).sort();
    expect(titles).toEqual(["Curated Tour", "Visible Tour"]);
  });

  test("`kind` filter narrows to host_custom", async () => {
    const { user } = await createHost();
    await createExperience({ kind: "curated", status: "published", title: "Curated A" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Host A" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Host B" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list({ kind: "host_custom" });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === "host_custom")).toBe(true);
  });

  test("`kind` filter narrows to curated", async () => {
    const { user } = await createHost();
    await createExperience({ kind: "curated", status: "published", title: "Curated A" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Host A" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list({ kind: "curated" });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("curated");
  });

  test("`authorId` filter narrows to a single host", async () => {
    const a = await createHost({ user: { displayName: "Host A" } });
    const b = await createHost({ user: { displayName: "Host B" } });
    await createExperience({ authorId: a.user.id, kind: "host_custom", status: "published", title: "A-1" });
    await createExperience({ authorId: a.user.id, kind: "host_custom", status: "published", title: "A-2" });
    await createExperience({ authorId: b.user.id, kind: "host_custom", status: "published", title: "B-1" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list({ authorId: a.user.id });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.authorId === a.user.id)).toBe(true);
  });

  test("author join fills host columns for host_custom, nulls for curated", async () => {
    const { user } = await createHost({ user: { displayName: "Nam" } });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", title: "Host-made" });
    await createExperience({ kind: "curated", status: "published", title: "LOCOMATE-made" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list();
    const hostRow = rows.find((r) => r.title === "Host-made")!;
    const curatedRow = rows.find((r) => r.title === "LOCOMATE-made")!;

    expect(hostRow.authorDisplayName).toBe("Nam");
    // createHost fixture sets avgRating='4.80'. Locking the exact value
    // verifies the join is actually wired, not just returning null.
    expect(hostRow.hostAvgRating).toBe("4.80");

    expect(curatedRow.authorDisplayName).toBeNull();
    expect(curatedRow.hostBio).toBeNull();
  });

  test("orders results by desc(totalBookings) so popular listings surface first", async () => {
    const { user } = await createHost();
    await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Mid",
      totalBookings: 5,
    });
    await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Top",
      totalBookings: 20,
    });
    await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      title: "Bottom",
      totalBookings: 1,
    });

    const caller = await callerAs(null);
    const rows = await caller.experience.list({ kind: "host_custom" });
    expect(rows.map((r) => r.title)).toEqual(["Top", "Mid", "Bottom"]);
  });

  test("category filter composes with kind filter", async () => {
    const { user } = await createHost();
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", category: "food", title: "Food Tour" });
    await createExperience({ authorId: user.id, kind: "host_custom", status: "published", category: "cultural", title: "Culture Tour" });

    const caller = await callerAs(null);
    const rows = await caller.experience.list({ kind: "host_custom", category: "food" });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Food Tour");
  });
});

describe("experience.getBySlug", () => {
  test("returns published experience with author info", async () => {
    const { user } = await createHost({ user: { displayName: "Linh" } });
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      slug: "linhs-secret-alley",
      title: "Linh's Secret Alley",
    });

    const caller = await callerAs(null);
    const result = await caller.experience.getBySlug({ slug: exp.slug! });

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Linh's Secret Alley");
    expect(result!.authorDisplayName).toBe("Linh");
  });

  test("returns null for drafts", async () => {
    const { user } = await createHost();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
      slug: "draft-tour",
    });

    const caller = await callerAs(null);
    const result = await caller.experience.getBySlug({ slug: exp.slug! });
    expect(result).toBeNull();
  });

  test("returns null for unknown slug", async () => {
    const caller = await callerAs(null);
    const result = await caller.experience.getBySlug({ slug: "nonexistent" });
    expect(result).toBeNull();
  });
});

describe("experience.book", () => {
  const tomorrowIso = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 2); // +2 days UTC to avoid VN/UTC edge
    return d.toISOString().slice(0, 10);
  };

  test("persists tourData.stops in the TourStop shape (not the raw schedule shape)", async () => {
    // Regression: prior to Apr 2026 the book() mutation wrote tourData.stops
    // = experience.schedule directly, leaving every stop as { time, label }
    // and causing /tour/[id]/active to render blank stop names. The page
    // expects { name, scheduledTime, durationMinutes, ... }.
    const { user } = await createHost();
    const traveler = await createUser();
    await createPlace({ name: "Hoan Kiem Lake", latitude: 21.0288, longitude: 105.8525 });
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      durationMinutes: 120,
      schedule: [
        { time: "09:00", label: "Meet at Hoan Kiem Lake" },
        { time: "10:00", label: "A stop with no matching place" },
      ],
    });

    const caller = await callerAs(traveler);
    const { tourId } = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 1,
    });

    const [tour] = await getTestDb().select().from(tours).where(eq(tours.id, tourId));
    const td = tour.tourData as { stops: Array<Record<string, unknown>> };
    expect(td.stops).toHaveLength(2);

    const first = td.stops[0];
    expect(first.name).toBe("Meet at Hoan Kiem Lake");
    expect(first.scheduledTime).toBe("09:00");
    expect(first.durationMinutes).toBe(60); // 120 / 2 stops
    // Matched place -> placeId + coordinates populated.
    expect(first.placeId).toBeTruthy();
    expect(first.latitude).toBe(21.0288);
    expect(first.longitude).toBe(105.8525);

    // Unmatched label still renders (name + scheduledTime) but with null
    // placeId / coordinates so the UI knows not to render a map pin.
    const second = td.stops[1];
    expect(second.name).toBe("A stop with no matching place");
    expect(second.placeId).toBeNull();
    expect(second.latitude).toBeNull();
    expect(second.longitude).toBeNull();
  });

  test("inserts tour_stops rows so /host/routes heatmap includes these bookings", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const place = await createPlace({ name: "Long Bien Bridge Walk", latitude: 21.043, longitude: 105.857 });
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      schedule: [{ time: "09:00", label: "Long Bien Bridge" }],
    });

    const caller = await callerAs(traveler);
    const { tourId } = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 1,
    });

    const stopsRows = await getTestDb().select().from(tourStops).where(eq(tourStops.tourId, tourId));
    expect(stopsRows).toHaveLength(1);
    expect(stopsRows[0].placeId).toBe(place.id);
    expect(stopsRows[0].stopOrder).toBe(0);
    void host; // referenced for setup symmetry
  });

  test("happy path: creates a tour row with price = pricePerPerson * groupSize", async () => {
    const { user, host } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      priceAmount: 800_000, // per-person rate on the experience
      maxGroupSize: 4,
    });

    const caller = await callerAs(traveler);
    const result = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 2,
    });

    expect(result.tourId).toMatch(/^[0-9a-f-]{36}$/);

    const [tour] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, result.tourId));

    expect(tour.userId).toBe(traveler.id);
    expect(tour.hostId).toBe(host.id);
    expect(tour.experienceId).toBe(exp.id);
    expect(tour.status).toBe("preview");
    expect(tour.packageType).toBe("host_experience");
    // The tour's total price is per-person * groupSize so the checkout row
    // and the dialog the traveler saw agree end-to-end.
    expect(tour.priceAmount).toBe(800_000 * 2);

    // Verify pricePerPerson + groupSize are preserved in tourData so the
    // checkout / receipt can show a breakdown.
    const td = tour.tourData as {
      pricePerPerson?: number;
      groupSize?: number;
      isFromExperience?: boolean;
    };
    expect(td.pricePerPerson).toBe(800_000);
    expect(td.groupSize).toBe(2);
    expect(td.isFromExperience).toBe(true);
  });

  test("rejects booking a draft experience with NOT_FOUND", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: draft.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects booking an archived experience", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const archived = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "archived",
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: archived.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects oversize group with PRECONDITION_FAILED", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      maxGroupSize: 2,
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 3,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects past date with PRECONDITION_FAILED", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: "2020-01-01",
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects invalid startTime via Zod", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: tomorrowIso(),
        startTime: "9am",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects unauthenticated callers (UNAUTHORIZED)", async () => {
    const { user } = await createHost();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });

    const caller = await callerAs(null);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("tour priceAmount = pricePerPerson * groupSize for N > 1", async () => {
    // Regression guard for the "dialog promises 4M, server charges 1M" bug.
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      priceAmount: 1_000_000,
      maxGroupSize: 8,
    });
    const caller = await callerAs(traveler);
    const result = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 4,
    });
    const [tour] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, result.tourId));
    expect(tour.priceAmount).toBe(4_000_000);
  });

  test("rejects orphan host_custom experience (author deleted)", async () => {
    // Regression guard for the "host deletes account, listing becomes
    // bookable orphan" bug. Defense-in-depth: the deletion flow archives,
    // but we still reject at book time if somehow a hostless host_custom
    // reaches us.
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: null,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("books a curated experience (no author, no hostId)", async () => {
    const traveler = await createUser();
    const exp = await createExperience({ kind: "curated", status: "published" });

    const caller = await callerAs(traveler);
    const result = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 1,
    });

    const [tour] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, result.tourId));
    expect(tour.hostId).toBeNull();
    expect(tour.experienceId).toBe(exp.id);
  });

  test("rejects booking when experience author's verification was revoked", async () => {
    // Host publishes while approved, later verification regresses; traveler
    // tries to book -> PRECONDITION_FAILED.
    const { user } = await createHost({ host: { verificationStatus: "approved" } });
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });
    await getTestDb()
      .update(hostProfiles)
      .set({ verificationStatus: "rejected" })
      .where(eq(hostProfiles.userId, user.id));
    const traveler = await createUser();

    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: tomorrowIso(),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test.each([
    ["2026-02-31", "impossible February day"],
    ["2026-13-01", "month > 12"],
    ["2026-00-05", "month = 0"],
  ])("rejects calendar-invalid date %s (%s) with BAD_REQUEST", async (badDate) => {
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date: badDate,
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("price is taken server-side from the experience, never from the client", async () => {
    const { user } = await createHost();
    const traveler = await createUser();
    const exp = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
      priceAmount: 1_500_000, // per-person
    });

    // Even if the input somehow leaked a price field, Zod strips unknown keys
    // (strict schema). The tour price must equal experience.priceAmount *
    // groupSize, computed server-side.
    const caller = await callerAs(traveler);
    const result = await caller.experience.book({
      experienceId: exp.id,
      date: tomorrowIso(),
      startTime: "09:00",
      groupSize: 1,
    });

    const [tour] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, result.tourId));
    expect(tour.priceAmount).toBe(1_500_000);
    // Corresponding DB-level check: the experience per-person rate was unchanged.
    const [current] = await getTestDb()
      .select({ priceAmount: experiences.priceAmount })
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(current.priceAmount).toBe(1_500_000);
  });
});

describe("experience.getMyBookings", () => {
  test("returns only the caller's experience-backed tours", async () => {
    const traveler = await createUser();
    const otherTraveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });

    const callerA = await callerAs(traveler);
    await callerA.experience.book({
      experienceId: exp.id,
      date: "2099-01-01",
      startTime: "09:00",
      groupSize: 1,
    });
    const callerB = await callerAs(otherTraveler);
    await callerB.experience.book({
      experienceId: exp.id,
      date: "2099-01-01",
      startTime: "09:00",
      groupSize: 1,
    });

    const mine = await callerA.experience.getMyBookings();
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe(exp.title);
  });

  test("rejects unauth callers", async () => {
    const caller = await callerAs(null);
    await expect(caller.experience.getMyBookings()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
