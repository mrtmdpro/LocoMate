import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import {
  createUser,
  createHost,
  createExperience,
  createTour,
  createPayment,
} from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { experiences, payments, tours } from "@/server/db/schema";

describe("payment.createIntent", () => {
  test("creates a pending payment with amount pulled from the tour", async () => {
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, priceAmount: 750_000 });
    const caller = await callerAs(traveler);

    const intent = await caller.payment.createIntent({
      tourId: tour.id,
      paymentMethod: "card",
    });

    expect(intent.amount).toBe(750_000);
    expect(intent.currency).toBe("VND");
    const [row] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, intent.paymentId));
    expect(row.status).toBe("pending");
    expect(row.userId).toBe(traveler.id);
    expect(row.tourId).toBe(tour.id);
  });

  test("rejects when caller does not own the tour", async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const tour = await createTour({ userId: owner.id });
    const caller = await callerAs(otherUser);

    await expect(
      caller.payment.createIntent({ tourId: tour.id, paymentMethod: "card" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("rejects unauth callers", async () => {
    const owner = await createUser();
    const tour = await createTour({ userId: owner.id });
    const caller = await callerAs(null);
    await expect(
      caller.payment.createIntent({ tourId: tour.id, paymentMethod: "card" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("payment.confirm", () => {
  test("rejects unauth callers", async () => {
    const owner = await createUser();
    const tour = await createTour({ userId: owner.id });
    const payment = await createPayment({
      tourId: tour.id,
      userId: owner.id,
      status: "pending",
    });
    const caller = await callerAs(null);
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("happy path: experience-backed tour flips to paid AND bumps totalBookings", async () => {
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
      priceAmount: 800_000,
    });
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      priceAmount: 800_000,
      packageType: "host_experience",
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      amount: 800_000,
      status: "pending",
    });

    const caller = await callerAs(traveler);
    const result = await caller.payment.confirm({ paymentId: payment.id });
    expect(result.success).toBe(true);

    const [finalPayment] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(finalPayment.status).toBe("succeeded");
    expect(finalPayment.paidAt).toBeInstanceOf(Date);

    const [finalTour] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(finalTour.status).toBe("paid");

    const [finalExp] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(finalExp.totalBookings).toBe(1);
  });

  test("algorithmic tour (no experienceId) flips to paid but does NOT bump any counter", async () => {
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    // A separate published experience exists; its counter must NOT move.
    const unrelatedExp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });
    const tour = await createTour({
      userId: traveler.id,
      experienceId: null,
      packageType: "loco_route",
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      amount: 250_000,
      status: "pending",
    });

    const caller = await callerAs(traveler);
    await caller.payment.confirm({ paymentId: payment.id });

    const [expAfter] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, unrelatedExp.id));
    expect(expAfter.totalBookings).toBe(0);

    const [tourAfter] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(tourAfter.status).toBe("paid");
  });

  test("rejects non-owner confirming a payment (FORBIDDEN)", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const tour = await createTour({ userId: owner.id });
    const payment = await createPayment({
      tourId: tour.id,
      userId: owner.id,
      status: "pending",
    });
    const caller = await callerAs(attacker);
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("rejects double-confirming an already-succeeded payment (PRECONDITION_FAILED)", async () => {
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
    });
    const caller = await callerAs(traveler);
    await caller.payment.confirm({ paymentId: payment.id });
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects confirming a legacy tour payment after the tour time passed", async () => {
    const traveler = await createUser();
    const past = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    const tour = await createTour({
      userId: traveler.id,
      requestParams: {
        date: past,
        startTime: "09:00",
        durationHours: 2,
        budgetLevel: "medium",
        interests: ["culture"],
        withHost: false,
        groupSize: 1,
      },
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
    });
    const caller = await callerAs(traveler);

    await expect(caller.payment.confirm({ paymentId: payment.id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/already passed|too soon/i),
    });
  });

  test("rejects confirming a payment whose experience was archived after booking", async () => {
    // Regression guard for adv-07: previously a traveler who booked an
    // experience, then saw the host archive it, could still confirm payment
    // and the archived-experience's totalBookings would tick up.
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      packageType: "host_experience",
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
    });

    // Host archives AFTER booking but before payment confirm.
    await getTestDb()
      .update(experiences)
      .set({ status: "archived" })
      .where(eq(experiences.id, exp.id));

    const caller = await callerAs(traveler);
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/no longer available/i),
    });

    // Counter must not have been bumped on the archived listing.
    const [expAfter] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(expAfter.totalBookings).toBe(0);
  });

  test("double-confirm is idempotent (guard runs before transaction begins)", async () => {
    // Renamed from the misleading "transaction rollback" framing: this test
    // verifies the pre-transaction PRECONDITION_FAILED guard, not rollback
    // semantics. The real rollback test is below.
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      packageType: "host_experience",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
    });

    const caller = await callerAs(traveler);
    await caller.payment.confirm({ paymentId: payment.id });
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const [expFinal] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(expFinal.totalBookings).toBe(1);
  });

  test("transaction actually rolls back: counter overflow inside tx leaves payment pending", async () => {
    // Force an error INSIDE ctx.db.transaction by pre-setting totalBookings
    // to PG INT4 max (2_147_483_647). The `+ 1` increment overflows the
    // integer column and Postgres raises `22003 numeric_value_out_of_range`,
    // which must roll back the whole tx: payment stays 'pending', tour stays
    // 'preview'.
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });
    await getTestDb()
      .update(experiences)
      .set({ totalBookings: 2_147_483_647 })
      .where(eq(experiences.id, exp.id));
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      packageType: "host_experience",
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
    });

    const caller = await callerAs(traveler);
    await expect(
      caller.payment.confirm({ paymentId: payment.id }),
    ).rejects.toThrow();

    // All three writes inside the tx must be rolled back.
    const [paymentAfter] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(paymentAfter.status).toBe("pending");
    expect(paymentAfter.paidAt).toBeNull();

    const [tourAfter] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(tourAfter.status).toBe("preview");

    const [expAfter] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(expAfter.totalBookings).toBe(2_147_483_647);
  });
});

/**
 * Coupon-driven discount paths. Full happy-path + rollback + race tests
 * live in coupon.router.test.ts; these are the payment-side smoke tests
 * proving the integration points stay intact under the new branch.
 */
describe("payment.* with applied coupon", () => {
  test("createIntent persists payments.applied_coupon_id and the discounted amount", async () => {
    const { createUser, createTour } = await import("@/test/fixtures");
    const { coupons } = await import("@/server/db/schema");
    const { issueWrapUpCoupon } = await import("@/server/services/wrap-up-coupon");
    type ProdDb = (typeof import("@/server/db"))["db"];

    const traveler = await createUser();
    const sourceTour = await createTour({
      userId: traveler.id,
      status: "completed",
    });
    // PGlite is API-compatible with the production postgres-js client
    // at the drizzle query-builder level. The cast bridges the two
    // type lineages so the service signature can stay precise.
    const dbCast = getTestDb() as unknown as ProdDb;
    const c = await issueWrapUpCoupon(dbCast, sourceTour.id, traveler.id);
    expect(c).not.toBeNull();
    const targetTour = await createTour({
      userId: traveler.id,
      status: "preview",
      priceAmount: 1_000_000,
    });

    const caller = await callerAs(traveler);
    const intent = await caller.payment.createIntent({
      tourId: targetTour.id,
      paymentMethod: "card",
      couponCode: c!.code,
    });
    expect(intent.amount).toBe(900_000);

    const [paymentRow] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, intent.paymentId));
    expect(paymentRow.amount).toBe(900_000);
    expect(paymentRow.appliedCouponId).toBe(c!.id);

    // Coupon stays unredeemed at the intent stage — only confirm()
    // flips it.
    const [couponRow] = await getTestDb()
      .select()
      .from(coupons)
      .where(eq(coupons.id, c!.id));
    expect(couponRow.redeemedAt).toBeNull();
  });

  test("confirm flips the coupon to redeemed and points it at the redeemed tour", async () => {
    const { createUser, createTour } = await import("@/test/fixtures");
    const { coupons } = await import("@/server/db/schema");
    const { issueWrapUpCoupon } = await import("@/server/services/wrap-up-coupon");
    type ProdDb = (typeof import("@/server/db"))["db"];

    const traveler = await createUser();
    const sourceTour = await createTour({
      userId: traveler.id,
      status: "completed",
    });
    const dbCast = getTestDb() as unknown as ProdDb;
    const c = await issueWrapUpCoupon(dbCast, sourceTour.id, traveler.id);
    const targetTour = await createTour({
      userId: traveler.id,
      status: "preview",
      priceAmount: 500_000,
    });

    const caller = await callerAs(traveler);
    const intent = await caller.payment.createIntent({
      tourId: targetTour.id,
      paymentMethod: "card",
      couponCode: c!.code,
    });
    await caller.payment.confirm({ paymentId: intent.paymentId });

    const [couponRow] = await getTestDb()
      .select()
      .from(coupons)
      .where(eq(coupons.id, c!.id));
    expect(couponRow.redeemedAt).toBeInstanceOf(Date);
    expect(couponRow.redeemedTourId).toBe(targetTour.id);
  });
});
