import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createTour,
  createExperience,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { tours } from "@/server/db/schema";

describe("tour.assignHost", () => {
  test("rejects assignment on an experience-backed tour (price is pinned)", async () => {
    // Regression guard for adv-01: previously a traveler could book a 4.5M
    // experience tour, then call assignHost to have tour.priceAmount
    // overwritten to 1M (group tier) and pay the lower price at checkout.
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
      priceAmount: 4_500_000,
    });

    // Create the tour the way experience.book would.
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      priceAmount: 4_500_000,
      packageType: "host_experience",
      status: "preview",
    });

    // Any other approved host.
    const { host: otherHost } = await createHost();

    const caller = await callerAs(traveler);
    await expect(
      caller.tour.assignHost({ tourId: tour.id, hostId: otherHost.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/experience|already assigned/i),
    });

    // Verify the tour price + package type were NOT mutated.
    const [after] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(after.priceAmount).toBe(4_500_000);
    expect(after.packageType).toBe("host_experience");
  });

  test("allows assignment on an algorithmic (non-experience) tour + recomputes price/package", async () => {
    // Regression guard for UI-18: add-host-post-creation must flip
    // priceAmount to TOUR_PRICING.withHostSolo and packageType to 'solo_mate'
    // so the host upsell the user saw is actually charged.
    const traveler = await createUser();
    const { host } = await createHost();
    const tour = await createTour({
      userId: traveler.id,
      packageType: "loco_route",
      status: "preview",
      priceAmount: 250_000,
      requestParams: {
        date: "2099-01-01",
        startTime: "09:00",
        durationHours: 3,
        budgetLevel: "medium",
        interests: ["culture"],
        withHost: false,
        groupSize: 1,
      },
    });

    const caller = await callerAs(traveler);
    const result = await caller.tour.assignHost({ tourId: tour.id, hostId: host.id });
    expect(result.hostId).toBe(host.id);
    // Must equal computeTourPrice({ withHost: true, groupSize: 1 }) from
    // src/lib/pricing.ts TOUR_PRICING.withHostSolo.
    expect(result.priceAmount).toBe(750_000);

    // Database state reflects the flip on every field the UI reads downstream.
    const [after] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(after.priceAmount).toBe(750_000);
    expect(after.packageType).toBe("solo_mate");
    const params = after.requestParams as { withHost?: boolean };
    expect(params.withHost).toBe(true);
  });

  test("rejects non-owner", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const { host } = await createHost();
    const tour = await createTour({
      userId: owner.id,
      packageType: "loco_route",
      status: "preview",
    });
    const caller = await callerAs(attacker);
    await expect(
      caller.tour.assignHost({ tourId: tour.id, hostId: host.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("rejects after the tour is paid", async () => {
    const traveler = await createUser();
    const { host } = await createHost();
    const tour = await createTour({
      userId: traveler.id,
      packageType: "loco_route",
      status: "paid",
    });
    const caller = await callerAs(traveler);
    await expect(
      caller.tour.assignHost({ tourId: tour.id, hostId: host.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects unauth callers", async () => {
    const owner = await createUser();
    const { host } = await createHost();
    const tour = await createTour({ userId: owner.id });
    const caller = await callerAs(null);
    await expect(
      caller.tour.assignHost({ tourId: tour.id, hostId: host.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
