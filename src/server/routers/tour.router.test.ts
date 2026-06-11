import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createTour,
  createExperience,
  createPayment,
  createTourStop,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { tours, payments } from "@/server/db/schema";

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

describe("tour.cancelByTraveler — FR-PAY-04 refund", () => {
  // createTour defaults the departure to 2 days out (> 24h), so the default
  // path is a full refund. Tier math itself is unit-tested in
  // src/lib/refund-policy.test.ts; these guard the wiring + state writes.

  test("> 24h before departure: full refund, tour cancelled, payment refunded", async () => {
    const user = await createUser();
    const tour = await createTour({
      userId: user.id,
      status: "paid",
      priceAmount: 1_000_000,
    });
    await createPayment({
      tourId: tour.id,
      userId: user.id,
      amount: 1_000_000,
      status: "succeeded",
      paidAt: new Date(),
    });

    const caller = await callerAs(user);
    const res = await caller.tour.cancelByTraveler({ tourId: tour.id });
    expect(res.refundPct).toBe(100);
    expect(res.refundVnd).toBe(1_000_000);

    const [after] = await getTestDb().select().from(tours).where(eq(tours.id, tour.id));
    expect(after.status).toBe("cancelled");
    expect(after.cancelReason).toBe("traveler_cancelled");

    const [pay] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.tourId, tour.id));
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(1_000_000);
  });

  test("rejects cancelling a tour that isn't paid (preview)", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "preview" });
    const caller = await callerAs(user);
    await expect(
      caller.tour.cancelByTraveler({ tourId: tour.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects cancelling an active (already started) tour", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "active" });
    const caller = await callerAs(user);
    await expect(
      caller.tour.cancelByTraveler({ tourId: tour.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("a different user cannot cancel someone else's tour (FORBIDDEN)", async () => {
    const owner = await createUser();
    const other = await createUser();
    const tour = await createTour({ userId: owner.id, status: "paid" });
    const caller = await callerAs(other);
    await expect(
      caller.tour.cancelByTraveler({ tourId: tour.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("getCancellationQuote previews a full refund for a far-future paid tour", async () => {
    const user = await createUser();
    const tour = await createTour({
      userId: user.id,
      status: "paid",
      priceAmount: 1_500_000,
    });
    const caller = await callerAs(user);
    const quote = await caller.tour.getCancellationQuote({ tourId: tour.id });
    expect(quote.cancellable).toBe(true);
    expect(quote.refundPct).toBe(100);
    expect(quote.refundVnd).toBe(1_500_000);
    expect(quote.paidVnd).toBe(1_500_000);
  });
});

describe("tour.markStopVisited persistence (+ getFullTour stopLocations)", () => {
  test("markStopVisited persists visitedAt, surfaced by getFullTour with the stop id", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "active" });
    const stop0 = await createTourStop({ tourId: tour.id, stopOrder: 0 });
    await createTourStop({ tourId: tour.id, stopOrder: 1 });
    const caller = await callerAs(user);

    await caller.tour.markStopVisited({ stopId: stop0.id });

    const full = await caller.tour.getFullTour({ tourId: tour.id });
    expect(full.stopLocations).toHaveLength(2);
    const s0 = full.stopLocations.find((s) => s.stopOrder === 0);
    const s1 = full.stopLocations.find((s) => s.stopOrder === 1);
    // The id is now exposed so the client can persist visits...
    expect(s0?.id).toBe(stop0.id);
    // ...and visitedAt re-seeds visited state after a refresh.
    expect(s0?.visitedAt).not.toBeNull();
    expect(s1?.visitedAt).toBeNull();
  });

  test("markStopVisited rejects a stop on another user's tour", async () => {
    const owner = await createUser();
    const other = await createUser();
    const tour = await createTour({ userId: owner.id, status: "active" });
    const stop = await createTourStop({ tourId: tour.id, stopOrder: 0 });
    const caller = await callerAs(other);
    await expect(
      caller.tour.markStopVisited({ stopId: stop.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
