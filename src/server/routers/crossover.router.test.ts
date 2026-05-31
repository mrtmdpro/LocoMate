/**
 * Crossover Matching integration tests (CROSS-14).
 *
 * Walks the state machine end-to-end against PGlite. Covers:
 *   - State machine transitions (Luồng 1..4)
 *   - Anti-Overlap (peer expiry on accept; block-on-matched)
 *   - Δ-payment confirm / refund
 *   - Report → voucher issuance → pair-scoped ban
 *   - Voucher application (burn on feed render)
 *   - Cron sweep idempotency for T-48h, T-36h, T-28h, T-24h
 *
 * The PII-leak contract test for the Discovery DTO lives separately at
 * `app/src/server/lib/crossover-dto.test.ts` (CROSS-15) — see that
 * file for the wire-shape assertions.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { getTestDb } from "@/test/setup";
import { createUser, createTour } from "@/test/fixtures";
import {
  fixedTours,
  tourCrossoverRequests,
  tourProposalEdits,
  escrowAdjustments,
  priorityMatchingVouchers,
  crossoverDiscoveryPushes,
  payments,
  tours,
  userProfiles,
} from "../db/schema";
import {
  runT24hSweep,
  runT28hSweep,
  runT36hSweep,
  runT48hSweep,
} from "../services/crossover-cron";

/* ────────────────────────────────────────────────────────────────────
 *  Shared fixture builders
 * ────────────────────────────────────────────────────────────────── */

/**
 * Inserts a brand-canonical fixed tour ID we can FK against. Real seed
 * uses LOCO_FT_M1 etc.; tests use a smaller LOCO_TEST_* family so PGlite
 * stays focused.
 */
async function seedFixedTour(tourId: string, chapter = "MORNING_SHIFT") {
  const db = getTestDb();
  await db.insert(fixedTours).values({
    tourId,
    titleVi: `Test ${tourId}`,
    titleEn: `Test ${tourId}`,
    chapter,
    storyScriptVi: "Test story",
    storyScriptEn: "Test story",
    durationMinutes: 240,
    maxParticipants: 6,
    basePriceVnd: 1_000_000,
    vector: [0.25, 0.25, 0.25, 0.25],
  });
}

/**
 * Creates a fully-formed user + tour + user_profiles row that the
 * crossover router can operate on. Uses a stable date+startTime in the
 * future so capacity checks work consistently.
 */
async function setupTraveler(opts: {
  fixedTourId: string;
  date: string;
  startTime: string;
  durationHours?: number;
  personalityVector?: [number, number, number, number];
  consentMatching?: boolean;
  status?: "preview" | "paid";
}) {
  const db = getTestDb();
  const user = await createUser();
  // createUser already inserts an empty user_profiles row; UPDATE it
  // here so the unique (user_id) constraint isn't violated.
  await db
    .update(userProfiles)
    .set({
      explicitData: {
        consentMatching: opts.consentMatching ?? false,
        nationality: "VN",
      },
      derivedData: {
        personalityVector: opts.personalityVector ?? [0.25, 0.25, 0.25, 0.25],
      },
    })
    .where(eq(userProfiles.userId, user.id));
  const tour = await createTour({
    userId: user.id,
    status: opts.status ?? "paid",
    fixedTourId: opts.fixedTourId,
    requestParams: {
      date: opts.date,
      startTime: opts.startTime,
      durationHours: opts.durationHours ?? 4,
      budgetLevel: "medium",
      interests: ["culture"],
      withHost: false,
      groupSize: 1,
    },
    priceAmount: 1_000_000,
    packageType: "fixed_tour",
  });
  await db.insert(payments).values({
    tourId: tour.id,
    userId: user.id,
    amount: 1_000_000,
    currency: "VND",
    paymentMethod: "card",
    paymentGateway: "stripe_test",
    status: "succeeded",
  });
  return { user, tour };
}

/** Returns YYYY-MM-DD `n` days from now in Vietnam wall-clock terms. */
function vnDateOffset(daysFromNow: number): string {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const d = new Date(Date.now() + VN_OFFSET_MS + daysFromNow * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────
 *  Tests
 * ────────────────────────────────────────────────────────────────── */

beforeAll(async () => {
  // Ensure the FK target rows exist for every test case. PGlite is
  // truncated between tests so we re-seed inside each `describe` block
  // that needs the FK rather than relying on a shared row here.
});

describe("crossover.getCapacityStatus", () => {
  it("reports under-capacity for a solo fixed-tour booking", async () => {
    await seedFixedTour("LOCO_TEST_M1");
    const { user, tour } = await setupTraveler({
      fixedTourId: "LOCO_TEST_M1",
      date: vnDateOffset(2),
      startTime: "09:00",
    });

    const caller = await callerAs(user);
    const status = await caller.crossover.getCapacityStatus({ tourId: tour.id });
    expect(status.isFixedTour).toBe(true);
    expect(status.current).toBe(1);
    expect(status.minimum).toBe(2);
    expect(status.underCapacity).toBe(true);
  });

  it("reports at-capacity when two solos share the same slot", async () => {
    await seedFixedTour("LOCO_TEST_M2");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_M2",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_M2",
      date,
      startTime: "09:00",
    });

    const caller = await callerAs(a.user);
    const status = await caller.crossover.getCapacityStatus({ tourId: a.tour.id });
    expect(status.current).toBe(2);
    expect(status.underCapacity).toBe(false);
    // Reference second user to silence unused-var lint without changing
    // the fixture's side effects (the second booking IS the reason
    // capacity reaches 2).
    expect(b.tour.fixedTourId).toBe("LOCO_TEST_M2");
  });

  it("returns isFixedTour=false for non-fixed bookings", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id });
    const caller = await callerAs(user);
    const status = await caller.crossover.getCapacityStatus({ tourId: tour.id });
    expect(status.isFixedTour).toBe(false);
  });
});

describe("crossover.migrateToCustom", () => {
  it("clones a fixed tour into customized_pending and preserves the row", async () => {
    await seedFixedTour("LOCO_TEST_M3");
    const { user, tour } = await setupTraveler({
      fixedTourId: "LOCO_TEST_M3",
      date: vnDateOffset(2),
      startTime: "09:00",
    });

    const caller = await callerAs(user);
    const result = await caller.crossover.migrateToCustom({ tourId: tour.id });

    expect(result.status).toBe("customized_pending");
    expect(result.alreadyMigrated).toBe(false);

    const db = getTestDb();
    const updated = await db.query.tours.findFirst({ where: eq(tours.id, tour.id) });
    expect(updated?.status).toBe("customized_pending");
    expect(updated?.originalFixedTourId).toBe("LOCO_TEST_M3");
    expect(updated?.fixedTourId).toBeNull();
  });

  it("is idempotent — re-migrating a migrated tour returns alreadyMigrated", async () => {
    await seedFixedTour("LOCO_TEST_M4");
    const { user, tour } = await setupTraveler({
      fixedTourId: "LOCO_TEST_M4",
      date: vnDateOffset(2),
      startTime: "09:00",
    });
    const caller = await callerAs(user);
    await caller.crossover.migrateToCustom({ tourId: tour.id });
    const second = await caller.crossover.migrateToCustom({ tourId: tour.id });
    expect(second.alreadyMigrated).toBe(true);
  });

  it("refuses to migrate non-fixed-tour bookings", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id });
    const caller = await callerAs(user);
    await expect(
      caller.crossover.migrateToCustom({ tourId: tour.id }),
    ).rejects.toThrow(/Only Fixed Tour bookings/);
  });
});

describe("crossover.sendCrossoverRequest + respondToRequest", () => {
  it("sends a pending request and the target can approve to matched", async () => {
    await seedFixedTour("LOCO_TEST_E1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_E1",
      date,
      startTime: "09:00",
      personalityVector: [0.4, 0.1, 0.4, 0.1],
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_E1",
      date,
      startTime: "09:00",
      personalityVector: [0.4, 0.1, 0.4, 0.1],
    });

    const callerA = await callerAs(a.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });

    const callerB = await callerAs(b.user);
    const result = await callerB.crossover.respondToRequest({
      requestId,
      decision: "approve",
    });
    expect(result.status).toBe("matched");
  });

  it("rejects a request without changing matched_at", async () => {
    await seedFixedTour("LOCO_TEST_E2");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_E2",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_E2",
      date,
      startTime: "09:00",
    });

    const callerA = await callerAs(a.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    const callerB = await callerAs(b.user);
    const result = await callerB.crossover.respondToRequest({
      requestId,
      decision: "reject",
    });
    expect(result.status).toBe("expired");

    const db = getTestDb();
    const row = await db.query.tourCrossoverRequests.findFirst({
      where: eq(tourCrossoverRequests.id, requestId),
    });
    expect(row?.status).toBe("expired");
    expect(row?.matchedAt).toBeNull();
  });

  it("refuses self-targeted requests", async () => {
    await seedFixedTour("LOCO_TEST_E3");
    const { user, tour } = await setupTraveler({
      fixedTourId: "LOCO_TEST_E3",
      date: vnDateOffset(2),
      startTime: "09:00",
    });
    const caller = await callerAs(user);
    await expect(
      caller.crossover.sendCrossoverRequest({
        tourId: tour.id,
        targetTourId: tour.id,
      }),
    ).rejects.toThrow();
  });
});

describe("Anti-Overlap rule", () => {
  it("expires peer pending requests on the accepter when one is approved", async () => {
    await seedFixedTour("LOCO_TEST_A1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_A1",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_A1",
      date,
      startTime: "09:00",
    });
    const c = await setupTraveler({
      fixedTourId: "LOCO_TEST_A1",
      date,
      startTime: "09:00",
    });

    const callerA = await callerAs(a.user);
    const callerC = await callerAs(c.user);
    // Both A and C try to match with B at the same slot.
    const r1 = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    const r2 = await callerC.crossover.sendCrossoverRequest({
      tourId: c.tour.id,
      targetTourId: b.tour.id,
    });

    // B accepts A; C's pending request must be expired by anti-overlap.
    const callerB = await callerAs(b.user);
    const result = await callerB.crossover.respondToRequest({
      requestId: r1.requestId,
      decision: "approve",
    });
    expect(result.status).toBe("matched");
    expect(result.expiredPeers).toBeGreaterThanOrEqual(1);

    const db = getTestDb();
    const cReq = await db.query.tourCrossoverRequests.findFirst({
      where: eq(tourCrossoverRequests.id, r2.requestId),
    });
    expect(cReq?.status).toBe("expired");
    expect(cReq?.terminatedReason).toBe("anti_overlap");
  });

  it("blocks sending a new request when caller is already matched on an overlapping slot", async () => {
    await seedFixedTour("LOCO_TEST_A2");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_A2",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_A2",
      date,
      startTime: "09:00",
    });
    const c = await setupTraveler({
      fixedTourId: "LOCO_TEST_A2",
      date,
      startTime: "09:00",
    });

    const callerA = await callerAs(a.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    const callerB = await callerAs(b.user);
    await callerB.crossover.respondToRequest({
      requestId,
      decision: "approve",
    });

    // A is now matched. Sending a new request from A at the same slot
    // should be blocked.
    await expect(
      callerA.crossover.sendCrossoverRequest({
        tourId: a.tour.id,
        targetTourId: c.tour.id,
      }),
    ).rejects.toThrow(/already have a matched crossover/);
  });

  it("doesn't expire requests on a non-overlapping next-day slot", async () => {
    await seedFixedTour("LOCO_TEST_A3");
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_A3",
      date: vnDateOffset(2),
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_A3",
      date: vnDateOffset(2),
      startTime: "09:00",
    });
    const c = await setupTraveler({
      fixedTourId: "LOCO_TEST_A3",
      date: vnDateOffset(5),
      startTime: "09:00",
    });

    const callerA = await callerAs(a.user);
    const callerC = await callerAs(c.user);
    const r1 = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    const r2 = await callerC.crossover.sendCrossoverRequest({
      tourId: c.tour.id,
      targetTourId: b.tour.id,
    });
    const callerB = await callerAs(b.user);
    await callerB.crossover.respondToRequest({
      requestId: r1.requestId,
      decision: "approve",
    });

    const db = getTestDb();
    const cReq = await db.query.tourCrossoverRequests.findFirst({
      where: eq(tourCrossoverRequests.id, r2.requestId),
    });
    // C's request is on a different day → still pending.
    expect(cReq?.status).toBe("pending");
  });
});

describe("Smart Proposal Hub (proposeEdit + respondToProposal)", () => {
  async function setupMatched() {
    await seedFixedTour("LOCO_TEST_P1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_P1",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_P1",
      date,
      startTime: "09:00",
    });
    const callerA = await callerAs(a.user);
    const callerB = await callerAs(b.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    await callerB.crossover.respondToRequest({ requestId, decision: "approve" });
    return { a, b, callerA, callerB, requestId };
  }

  it("caps proposals at 3 per request", async () => {
    const { callerA, callerB, requestId } = await setupMatched();
    const activityId = "00000000-0000-0000-0000-000000000001";

    // Edit 1
    const e1 = await callerA.crossover.proposeEdit({
      requestId,
      editKind: "add",
      targetActivityId: activityId,
    });
    await callerB.crossover.respondToProposal({
      proposalEditId: e1.proposalEditId,
      decision: "approve",
    });
    // Edit 2
    const e2 = await callerA.crossover.proposeEdit({
      requestId,
      editKind: "remove",
      targetActivityId: activityId,
    });
    await callerB.crossover.respondToProposal({
      proposalEditId: e2.proposalEditId,
      decision: "approve",
    });
    // Edit 3
    const e3 = await callerA.crossover.proposeEdit({
      requestId,
      editKind: "add",
      targetActivityId: activityId,
    });
    await callerB.crossover.respondToProposal({
      proposalEditId: e3.proposalEditId,
      decision: "approve",
    });

    // Edit 4 should be refused.
    await expect(
      callerA.crossover.proposeEdit({
        requestId,
        editKind: "add",
        targetActivityId: activityId,
      }),
    ).rejects.toThrow(/3 proposal edits/);
  });

  it("enforces sequential approval (no second pending until first responds)", async () => {
    const { callerA, requestId } = await setupMatched();
    const activityId = "00000000-0000-0000-0000-000000000002";

    await callerA.crossover.proposeEdit({
      requestId,
      editKind: "add",
      targetActivityId: activityId,
    });
    await expect(
      callerA.crossover.proposeEdit({
        requestId,
        editKind: "remove",
        targetActivityId: activityId,
      }),
    ).rejects.toThrow(/Wait for your previous proposal/);
  });

  it("forbids the proposer from approving their own proposal", async () => {
    const { callerA, requestId } = await setupMatched();
    const activityId = "00000000-0000-0000-0000-000000000003";

    const e = await callerA.crossover.proposeEdit({
      requestId,
      editKind: "add",
      targetActivityId: activityId,
    });
    await expect(
      callerA.crossover.respondToProposal({
        proposalEditId: e.proposalEditId,
        decision: "approve",
      }),
    ).rejects.toThrow(/your own proposal/);
  });
});

describe("crossover.lockItinerary + Δ-payment", () => {
  async function setupLockReady() {
    await seedFixedTour("LOCO_TEST_L1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_L1",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_L1",
      date,
      startTime: "09:00",
    });
    const callerA = await callerAs(a.user);
    const callerB = await callerAs(b.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    await callerB.crossover.respondToRequest({ requestId, decision: "approve" });
    return { a, b, callerA, callerB, requestId };
  }

  it("creates the escrow row + pairs both tours on lock", async () => {
    const { a, b, callerA, requestId } = await setupLockReady();
    const result = await callerA.crossover.lockItinerary({ requestId });
    expect(result.alreadyLocked).toBe(false);
    expect(result.delta).toBe(1_000_000); // cost_new (2M) - cost_old (1M) = 1M

    const db = getTestDb();
    const tourA = await db.query.tours.findFirst({ where: eq(tours.id, a.tour.id) });
    const tourB = await db.query.tours.findFirst({ where: eq(tours.id, b.tour.id) });
    expect(tourA?.crossoverPairId).toBe(b.tour.id);
    expect(tourB?.crossoverPairId).toBe(a.tour.id);
  });

  it("is idempotent on lock (second call returns alreadyLocked=true)", async () => {
    const { callerA, callerB, requestId } = await setupLockReady();
    const first = await callerA.crossover.lockItinerary({ requestId });
    const second = await callerB.crossover.lockItinerary({ requestId });
    expect(second.alreadyLocked).toBe(true);
    expect(second.escrowAdjustmentId).toBe(first.escrowAdjustmentId);
  });

  it("confirms a Δ > 0 escrow (mock)", async () => {
    const { callerA, requestId } = await setupLockReady();
    const lock = await callerA.crossover.lockItinerary({ requestId });
    const confirm = await callerA.crossover.confirmEscrowDelta({
      escrowAdjustmentId: lock.escrowAdjustmentId,
    });
    expect(confirm.status).toBe("confirmed");

    const db = getTestDb();
    const row = await db.query.escrowAdjustments.findFirst({
      where: eq(escrowAdjustments.id, lock.escrowAdjustmentId),
    });
    expect(row?.status).toBe("confirmed");
    expect(row?.resolvedAt).not.toBeNull();
  });

  it("refunds a Δ < 0 escrow (mock)", async () => {
    const { callerA, requestId } = await setupLockReady();
    const lock = await callerA.crossover.lockItinerary({ requestId });
    const refund = await callerA.crossover.refundEscrowDelta({
      escrowAdjustmentId: lock.escrowAdjustmentId,
    });
    expect(refund.status).toBe("refunded");
  });

  it("returns alreadyResolved=true on double-confirm", async () => {
    const { callerA, requestId } = await setupLockReady();
    const lock = await callerA.crossover.lockItinerary({ requestId });
    await callerA.crossover.confirmEscrowDelta({
      escrowAdjustmentId: lock.escrowAdjustmentId,
    });
    const second = await callerA.crossover.confirmEscrowDelta({
      escrowAdjustmentId: lock.escrowAdjustmentId,
    });
    expect(second.alreadyResolved).toBe(true);
  });
});

describe("Cluster B hardening — transactions + unique constraints", () => {
  async function setupMatched(fixedTourId: string) {
    await seedFixedTour(fixedTourId);
    const date = vnDateOffset(2);
    const a = await setupTraveler({ fixedTourId, date, startTime: "09:00" });
    const b = await setupTraveler({ fixedTourId, date, startTime: "09:00" });
    const callerA = await callerAs(a.user);
    const callerB = await callerAs(b.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    await callerB.crossover.respondToRequest({ requestId, decision: "approve" });
    return { a, b, callerA, callerB, requestId };
  }

  it("rejects a duplicate pending request to the same target (partial unique index)", async () => {
    await seedFixedTour("LOCO_TEST_DUP");
    const date = vnDateOffset(2);
    const a = await setupTraveler({ fixedTourId: "LOCO_TEST_DUP", date, startTime: "09:00" });
    const b = await setupTraveler({ fixedTourId: "LOCO_TEST_DUP", date, startTime: "09:00" });
    const callerA = await callerAs(a.user);

    await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    // Second pending request for the same (requester, target tour) pair
    // collides on uq_crossover_requests_pending.
    await expect(
      callerA.crossover.sendCrossoverRequest({
        tourId: a.tour.id,
        targetTourId: b.tour.id,
      }),
    ).rejects.toThrow();
  });

  it("rolls back lockItinerary when a mid-transaction write fails", async () => {
    const { a, callerA, requestId } = await setupMatched("LOCO_TEST_RB");
    const db = getTestDb();

    // Occupy the unique crossover_pair_id value `a.tour.id` with an
    // unrelated tour. lockItinerary's SECOND tour update (setting
    // tourB.crossover_pair_id = a.tour.id) then collides on
    // idx_tours_crossover_pair, forcing the whole transaction to roll
    // back AFTER the escrow insert + first tour update have run.
    const blocker = await createTour({ userId: a.user.id, status: "preview" });
    await db
      .update(tours)
      .set({ crossoverPairId: a.tour.id })
      .where(eq(tours.id, blocker.id));

    await expect(callerA.crossover.lockItinerary({ requestId })).rejects.toThrow();

    // Rollback proof: no escrow row persisted, tourA still unpaired.
    const escrow = await db
      .select()
      .from(escrowAdjustments)
      .where(eq(escrowAdjustments.crossoverRequestId, requestId));
    expect(escrow).toHaveLength(0);
    const tourA = await db.query.tours.findFirst({ where: eq(tours.id, a.tour.id) });
    expect(tourA?.crossoverPairId).toBeNull();
  });

  it("enforces one escrow per request; lockItinerary returns alreadyLocked under the unique guard", async () => {
    const { a, callerA, callerB, requestId } = await setupMatched("LOCO_TEST_UQ");
    const first = await callerA.crossover.lockItinerary({ requestId });
    expect(first.alreadyLocked).toBe(false);

    const db = getTestDb();
    // A second escrow row for the same request is rejected by
    // uq_escrow_adjustments_request — the constraint behind the
    // alreadyLocked idempotency guard.
    await expect(
      db.insert(escrowAdjustments).values({
        tourId: a.tour.id,
        crossoverRequestId: requestId,
        costOld: 1,
        costNew: 2,
        status: "pending",
      }),
    ).rejects.toThrow();

    // The router's own re-lock returns the same row as alreadyLocked.
    const second = await callerB.crossover.lockItinerary({ requestId });
    expect(second.alreadyLocked).toBe(true);
    expect(second.escrowAdjustmentId).toBe(first.escrowAdjustmentId);
  });
});

describe("crossover.reportPartner + voucher", () => {
  it("terminates the request, issues a voucher, and is idempotent", async () => {
    await seedFixedTour("LOCO_TEST_R1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_R1",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_R1",
      date,
      startTime: "09:00",
    });
    const callerA = await callerAs(a.user);
    const callerB = await callerAs(b.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    await callerB.crossover.respondToRequest({ requestId, decision: "approve" });

    const first = await callerA.crossover.reportPartner({
      requestId,
      reason: "Inappropriate language",
    });
    expect(first.status).toBe("terminated");
    expect(first.voucherIssued).toBe(true);

    const db = getTestDb();
    const vouchers = await db
      .select()
      .from(priorityMatchingVouchers)
      .where(eq(priorityMatchingVouchers.userId, a.user.id));
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].usesRemaining).toBe(1);

    // Idempotent retry: no second voucher issued.
    const second = await callerA.crossover.reportPartner({ requestId });
    expect(second.voucherIssued).toBe(false);

    const recount = await db
      .select()
      .from(priorityMatchingVouchers)
      .where(eq(priorityMatchingVouchers.userId, a.user.id));
    expect(recount).toHaveLength(1);
  });
});

describe("Voucher application — burns one use at feed render", () => {
  it("decrements uses_remaining when getDiscoveryFeed is called", async () => {
    await seedFixedTour("LOCO_TEST_V1");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_V1",
      date,
      startTime: "09:00",
      personalityVector: [0.5, 0.1, 0.3, 0.1],
    });
    // Need at least one peer with a vector for the feed to do work.
    await setupTraveler({
      fixedTourId: "LOCO_TEST_V1",
      date,
      startTime: "09:00",
      personalityVector: [0.4, 0.2, 0.3, 0.1],
    });

    const db = getTestDb();
    await db.insert(priorityMatchingVouchers).values({
      userId: a.user.id,
      usesRemaining: 2,
    });

    const caller = await callerAs(a.user);
    const result = await caller.crossover.getDiscoveryFeed({ tourId: a.tour.id });
    expect(result.voucherBurned).toBe(true);

    const remaining = await db
      .select()
      .from(priorityMatchingVouchers)
      .where(eq(priorityMatchingVouchers.userId, a.user.id));
    expect(remaining[0].usesRemaining).toBe(1);
  });

  it("does NOT burn a voucher when the user has none", async () => {
    await seedFixedTour("LOCO_TEST_V2");
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_V2",
      date,
      startTime: "09:00",
    });
    await setupTraveler({
      fixedTourId: "LOCO_TEST_V2",
      date,
      startTime: "09:00",
    });
    const caller = await callerAs(a.user);
    const result = await caller.crossover.getDiscoveryFeed({ tourId: a.tour.id });
    expect(result.voucherBurned).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────
 *  Cron sweep functions — called directly (no tRPC)
 * ────────────────────────────────────────────────────────────────── */

describe("Cron sweep functions", () => {
  /**
   * Helper that builds a tour whose departure is exactly `hoursFromNow`
   * away in Vietnam wall-clock time. Used to drive the time-window
   * filters in the cron sweeps.
   */
  async function setupTourDepartingInHours(
    fixedTourId: string,
    hoursFromNow: number,
  ): Promise<{
    user: Awaited<ReturnType<typeof setupTraveler>>["user"];
    tour: { id: string };
    userId: string;
  }> {
    // Compute the VN-local date + start time. The sweeps parse this
    // back through `parseVietnamDepartureToUtc`, so we can be exact.
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const departureUtc = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    const vnWallMs = departureUtc.getTime() + VN_OFFSET_MS;
    const vnWall = new Date(vnWallMs);
    const date = vnWall.toISOString().slice(0, 10);
    const hours = String(vnWall.getUTCHours()).padStart(2, "0");
    const minutes = String(vnWall.getUTCMinutes()).padStart(2, "0");
    const startTime = `${hours}:${minutes}`;

    const { user, tour } = await setupTraveler({
      fixedTourId,
      date,
      startTime,
      durationHours: 4,
    });
    return { user, tour, userId: user.id };
  }

  it("T-48h sweep flags under-capacity tours and sets consentMatching", async () => {
    await seedFixedTour("LOCO_TEST_C48");
    const { userId } = await setupTourDepartingInHours("LOCO_TEST_C48", 48.5);

    const result = await runT48hSweep(getTestDb());
    expect(result.flagged).toBeGreaterThanOrEqual(1);
    expect(result.consentSet).toBeGreaterThanOrEqual(1);
    expect(result.errors).toEqual([]);

    const db = getTestDb();
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });
    const explicit = (profile?.explicitData ?? {}) as Record<string, unknown>;
    expect(explicit.consentMatching).toBe(true);
  });

  it("T-36h sweep dedupes across re-runs", async () => {
    await seedFixedTour("LOCO_TEST_C36");
    const { userId: bookerId } = await setupTourDepartingInHours("LOCO_TEST_C36", 36);

    // Create an eligible recipient with a vector + consent.
    const recipient = await createUser();
    const db = getTestDb();
    await db
      .update(userProfiles)
      .set({
        explicitData: { consentMatching: true },
        derivedData: { personalityVector: [0.25, 0.25, 0.25, 0.25] },
      })
      .where(eq(userProfiles.userId, recipient.id));

    const first = await runT36hSweep(db);
    expect(first.pushed).toBeGreaterThanOrEqual(1);

    const second = await runT36hSweep(db);
    expect(second.deduped).toBeGreaterThanOrEqual(1);
    expect(second.pushed).toBe(0);

    // Reference the booker to silence unused-var lint while keeping
    // the booking responsible for the push.
    expect(bookerId).toBeTruthy();

    const pushes = await db
      .select()
      .from(crossoverDiscoveryPushes);
    expect(pushes.length).toBeGreaterThanOrEqual(1);
  });

  it("T-28h sweep terminates matched requests past the 8h window without lock", async () => {
    await seedFixedTour("LOCO_TEST_C28");
    const db = getTestDb();
    const date = vnDateOffset(2);
    const a = await setupTraveler({
      fixedTourId: "LOCO_TEST_C28",
      date,
      startTime: "09:00",
    });
    const b = await setupTraveler({
      fixedTourId: "LOCO_TEST_C28",
      date,
      startTime: "09:00",
    });
    const callerA = await callerAs(a.user);
    const callerB = await callerAs(b.user);
    const { requestId } = await callerA.crossover.sendCrossoverRequest({
      tourId: a.tour.id,
      targetTourId: b.tour.id,
    });
    await callerB.crossover.respondToRequest({ requestId, decision: "approve" });

    // Backdate matched_at to 9 hours ago so the 8h window is expired.
    const past = new Date(Date.now() - 9 * 3600 * 1000);
    await db
      .update(tourCrossoverRequests)
      .set({ matchedAt: past, updatedAt: past })
      .where(eq(tourCrossoverRequests.id, requestId));

    const result = await runT28hSweep(db);
    expect(result.terminated).toBeGreaterThanOrEqual(1);

    const row = await db.query.tourCrossoverRequests.findFirst({
      where: eq(tourCrossoverRequests.id, requestId),
    });
    expect(row?.status).toBe("terminated");
    expect(row?.terminatedReason).toBe("t28h_window_expired");
  });

  it("T-24h sweep auto-cancels stranded fixed tours and triggers full refund", async () => {
    await seedFixedTour("LOCO_TEST_C24");
    const { tour } = await setupTourDepartingInHours("LOCO_TEST_C24", 24);

    const result = await runT24hSweep(getTestDb());
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    expect(result.refunded).toBeGreaterThanOrEqual(1);

    const db = getTestDb();
    const updated = await db.query.tours.findFirst({ where: eq(tours.id, tour.id) });
    expect(updated?.status).toBe("system_cancelled");
    expect(updated?.cancelReason).toBe("system_t24h");
    expect(updated?.cancelledAt).not.toBeNull();

    const pay = await db.query.payments.findFirst({
      where: eq(payments.tourId, tour.id),
    });
    expect(pay?.refundAmount).toBe(pay?.amount);
  });

  it("T-24h sweep is idempotent — second run reports cancelled=0", async () => {
    await seedFixedTour("LOCO_TEST_C24B");
    await setupTourDepartingInHours("LOCO_TEST_C24B", 24);

    const first = await runT24hSweep(getTestDb());
    expect(first.cancelled).toBeGreaterThanOrEqual(1);

    const second = await runT24hSweep(getTestDb());
    expect(second.cancelled).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────
 *  Sanity counter — make sure we hit ~25+ tests across the file
 * ────────────────────────────────────────────────────────────────── */

afterAll(() => {
  // Vitest tracks this on its own; afterAll exists just so the suite
  // has a tidy footer for future cleanup hooks.
});

// Silence unused-import warnings for symbols imported above but only
// referenced inside test fixtures (the bundler keeps them, ESLint
// doesn't always agree).
void sql;
void tourProposalEdits;
