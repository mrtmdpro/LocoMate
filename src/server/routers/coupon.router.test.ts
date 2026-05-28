import { describe, test, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createTour } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { coupons } from "@/server/db/schema";
import { issueWrapUpCoupon } from "@/server/services/wrap-up-coupon";
import type { db as ProdDb } from "@/server/db";

/**
 * PGlite is API-compatible with the production postgres-js client at
 * the drizzle query-builder level — only the underlying type lineage
 * differs. Casting here bridges the two so we can pass the test DB
 * into services whose signature is typed against the prod client.
 */
const testDb = () => getTestDb() as unknown as typeof ProdDb;

/**
 * Helper: issue a wrap-up coupon directly, bypassing the
 * tour.completeTour mutation. Used by the validate/payment tests that
 * already have a tour fixture and just want a coupon attached to it.
 */
async function seedCoupon(opts: {
  userId: string;
  sourceTourId: string;
  /** Override expiry — default 90 days in the future. */
  expiresAt?: Date;
  /** Override redeemed status — default null (still usable). */
  redeemedAt?: Date;
  redeemedTourId?: string;
}) {
  const db = getTestDb();
  // For non-default expiries we have to insert manually so we can set
  // the exact timestamp. For the happy path we go through the service
  // to exercise its code path.
  if (opts.expiresAt || opts.redeemedAt) {
    const code = `WRAP-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01OI]/g, "X")}`;
    const [row] = await db
      .insert(coupons)
      .values({
        code,
        kind: "wrap_up",
        recipientUserId: opts.userId,
        sourceTourId: opts.sourceTourId,
        discountPct: 10,
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 90 * 86_400_000),
        redeemedAt: opts.redeemedAt ?? null,
        redeemedTourId: opts.redeemedTourId ?? null,
      })
      .returning();
    return row;
  }
  const issued = await issueWrapUpCoupon(testDb(), opts.sourceTourId, opts.userId);
  if (!issued) throw new Error("seedCoupon failed");
  const [row] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, issued.id));
  return row;
}

describe("issueWrapUpCoupon (service)", () => {
  test("issues a 10% coupon with WRAP- code and 90-day expiry", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" });

    const issued = await issueWrapUpCoupon(testDb(), tour.id, user.id);
    expect(issued).not.toBeNull();
    expect(issued!.code).toMatch(/^WRAP-[A-Z2-9]{6}$/);
    expect(issued!.discountPct).toBe(10);
    const daysOut =
      (issued!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(daysOut).toBeGreaterThan(89);
    expect(daysOut).toBeLessThan(91);
  });

  test("idempotent: second issuance for the same tour returns the existing row", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "completed" });

    const first = await issueWrapUpCoupon(testDb(), tour.id, user.id);
    const second = await issueWrapUpCoupon(testDb(), tour.id, user.id);
    expect(second!.id).toBe(first!.id);
    expect(second!.code).toBe(first!.code);

    const rows = await getTestDb()
      .select()
      .from(coupons)
      .where(eq(coupons.sourceTourId, tour.id));
    expect(rows).toHaveLength(1);
  });
});

describe("coupon.validate", () => {
  test("happy path: returns 10% discount + computed total", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 1_000_000,
    });

    const caller = await callerAs(user);
    const result = await caller.coupon.validate({
      code: c.code,
      tourId: targetTour.id,
    });
    expect(result.discountPct).toBe(10);
    expect(result.originalPriceVnd).toBe(1_000_000);
    expect(result.discountedPriceVnd).toBe(900_000);
    expect(result.savingsVnd).toBe(100_000);
  });

  test("rejects unauth callers (UNAUTHORIZED)", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "preview" });
    const caller = await callerAs(null);
    await expect(
      caller.coupon.validate({ code: "WRAP-ABCDEF", tourId: tour.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("rejects malformed code (Zod regex)", async () => {
    const user = await createUser();
    const tour = await createTour({ userId: user.id, status: "preview" });
    const caller = await callerAs(user);
    await expect(
      caller.coupon.validate({ code: "wrap-lower", tourId: tour.id }),
    ).rejects.toBeDefined();
  });

  test("rejects when the coupon belongs to another user", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const sourceTour = await createTour({
      userId: owner.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: owner.id,
      sourceTourId: sourceTour.id,
    });
    const attackerTour = await createTour({
      userId: attacker.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(attacker);
    await expect(
      caller.coupon.validate({ code: c.code, tourId: attackerTour.id }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("NOT_YOURS"),
    });
  });

  test("rejects an expired coupon", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
      expiresAt: new Date(Date.now() - 60_000), // 1 min in the past
    });
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    await expect(
      caller.coupon.validate({ code: c.code, tourId: targetTour.id }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("EXPIRED"),
    });
  });

  test("rejects an already-redeemed coupon", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const otherTour = await createTour({
      userId: user.id,
      status: "paid",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
      redeemedAt: new Date(),
      redeemedTourId: otherTour.id,
    });
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    await expect(
      caller.coupon.validate({ code: c.code, tourId: targetTour.id }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("ALREADY_REDEEMED"),
    });
  });

  test("rejects a tour that's already been paid for", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    const paidTour = await createTour({
      userId: user.id,
      status: "paid",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    await expect(
      caller.coupon.validate({ code: c.code, tourId: paidTour.id }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("TOUR_ALREADY_PAID"),
    });
  });

  test("floors the discounted price (no fractional VND)", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    // Price chosen so 10% off lands on a non-integer.
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 333_335,
    });
    const caller = await callerAs(user);
    const result = await caller.coupon.validate({
      code: c.code,
      tourId: targetTour.id,
    });
    // 333_335 * 0.9 = 300_001.5 → floored to 300_001.
    expect(result.discountedPriceVnd).toBe(300_001);
  });
});

describe("coupon.getMine", () => {
  test("returns only the caller's unredeemed, non-expired coupons", async () => {
    const me = await createUser();
    const other = await createUser();
    const meTour = await createTour({ userId: me.id, status: "completed" });
    const otherTour = await createTour({
      userId: other.id,
      status: "completed",
    });

    // 1) my unredeemed coupon — should be returned
    const mineActive = await seedCoupon({
      userId: me.id,
      sourceTourId: meTour.id,
    });
    // 2) my expired coupon — should be filtered out
    const meTour2 = await createTour({ userId: me.id, status: "completed" });
    await seedCoupon({
      userId: me.id,
      sourceTourId: meTour2.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    // 3) my redeemed coupon — should be filtered out
    const meTour3 = await createTour({ userId: me.id, status: "completed" });
    const redeemedAgainst = await createTour({
      userId: me.id,
      status: "paid",
    });
    await seedCoupon({
      userId: me.id,
      sourceTourId: meTour3.id,
      redeemedAt: new Date(),
      redeemedTourId: redeemedAgainst.id,
    });
    // 4) another user's coupon — must not leak
    await seedCoupon({ userId: other.id, sourceTourId: otherTour.id });

    const caller = await callerAs(me);
    const list = await caller.coupon.getMine();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(mineActive.id);
  });
});

describe("payment.createIntent + confirm with coupon", () => {
  test("createIntent applies the percent discount and stores appliedCouponId", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 1_000_000,
    });

    const caller = await callerAs(user);
    const intent = await caller.payment.createIntent({
      tourId: targetTour.id,
      paymentMethod: "card",
      couponCode: c.code,
    });
    expect(intent.amount).toBe(900_000);
    expect(intent.appliedCouponId).toBe(c.id);

    // Coupon must NOT be marked redeemed at this stage.
    const db = getTestDb();
    const [stillUsable] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, c.id));
    expect(stillUsable.redeemedAt).toBeNull();
  });

  test("confirm atomically flips the coupon to redeemed", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    const targetTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    const intent = await caller.payment.createIntent({
      tourId: targetTour.id,
      paymentMethod: "card",
      couponCode: c.code,
    });
    await caller.payment.confirm({ paymentId: intent.paymentId });

    const db = getTestDb();
    const [finalCoupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, c.id));
    expect(finalCoupon.redeemedAt).toBeInstanceOf(Date);
    expect(finalCoupon.redeemedTourId).toBe(targetTour.id);
  });

  test("concurrent confirm: only one transaction wins, the other gets PRECONDITION_FAILED", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
    });
    const tourA = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const tourB = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    const intentA = await caller.payment.createIntent({
      tourId: tourA.id,
      paymentMethod: "card",
      couponCode: c.code,
    });
    const intentB = await caller.payment.createIntent({
      tourId: tourB.id,
      paymentMethod: "card",
      couponCode: c.code,
    });

    // Fire both confirms concurrently — exactly one settles successfully.
    const results = await Promise.allSettled([
      caller.payment.confirm({ paymentId: intentA.paymentId }),
      caller.payment.confirm({ paymentId: intentB.paymentId }),
    ]);
    const wins = results.filter((r) => r.status === "fulfilled");
    const losses = results.filter((r) => r.status === "rejected");
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect((losses[0] as PromiseRejectedResult).reason).toMatchObject({
      message: expect.stringContaining("REDEEMED_CONCURRENTLY"),
    });

    // The coupon ends up redeemed exactly once.
    const db = getTestDb();
    const [finalCoupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, c.id));
    expect(finalCoupon.redeemedAt).toBeInstanceOf(Date);
  });

  test("re-using an already-redeemed code at createIntent is rejected", async () => {
    const user = await createUser();
    const sourceTour = await createTour({
      userId: user.id,
      status: "completed",
    });
    const burnedAgainst = await createTour({
      userId: user.id,
      status: "paid",
    });
    const c = await seedCoupon({
      userId: user.id,
      sourceTourId: sourceTour.id,
      redeemedAt: new Date(),
      redeemedTourId: burnedAgainst.id,
    });
    const newTour = await createTour({
      userId: user.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(user);
    await expect(
      caller.payment.createIntent({
        tourId: newTour.id,
        paymentMethod: "card",
        couponCode: c.code,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("ALREADY_REDEEMED"),
    });
  });
});

describe("isolation: cross-user coupons cannot be applied", () => {
  test("createIntent rejects another user's coupon (FORBIDDEN)", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const sourceTour = await createTour({
      userId: owner.id,
      status: "completed",
    });
    const c = await seedCoupon({
      userId: owner.id,
      sourceTourId: sourceTour.id,
    });
    const attackerTour = await createTour({
      userId: attacker.id,
      status: "preview",
      priceAmount: 500_000,
    });
    const caller = await callerAs(attacker);
    await expect(
      caller.payment.createIntent({
        tourId: attackerTour.id,
        paymentMethod: "card",
        couponCode: c.code,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("NOT_YOURS"),
    });
  });
});

// Sanity check on the and/eq import — kept inside the file to avoid
// a "no unused imports" complaint if a future edit drops one of the
// describe blocks above.
void and;
