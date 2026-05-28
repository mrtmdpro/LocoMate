import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createHost, createExperience, createTour } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import {
  activities,
  activitySlots,
  products,
  productVariants,
  orders,
  orderItems,
  payments,
} from "@/server/db/schema";

// ---- small factories local to this file ----------------------------------

async function createActivityWithSlot(authorId: string, overrides: {
  priceAmount?: number;
  capacity?: number;
  startsAt?: Date;
  endsAt?: Date;
} = {}) {
  const db = getTestDb();
  const [act] = await db
    .insert(activities)
    .values({
      authorId,
      title: "Hardening Act",
      slug: `hardening-act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: "workshop",
      priceAmount: overrides.priceAmount ?? 400_000,
      durationMinutes: 120,
      maxCapacityPerSlot: overrides.capacity ?? 6,
      description: "A test activity with enough description to satisfy publish rules.",
      photos: ["https://example.com/a.jpg"],
      highlights: ["one", "two"],
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const startsAt = overrides.startsAt ?? new Date(Date.now() + 2 * 86400_000);
  const endsAt = overrides.endsAt ?? new Date(startsAt.getTime() + 2 * 3600_000);
  const [slot] = await db
    .insert(activitySlots)
    .values({
      activityId: act.id,
      startsAt,
      endsAt,
      capacity: overrides.capacity ?? 6,
    })
    .returning();
  return { activity: act, slot };
}

async function createMerchWithStock(stock = 5, price = 200_000) {
  const db = getTestDb();
  const [product] = await db
    .insert(products)
    .values({
      sku: `HARD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Hardening Product",
      slug: `hardening-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "apparel",
      basePriceVnd: price,
      photos: ["https://example.com/p.jpg"],
      isActive: true,
    })
    .returning();
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: product.id,
      sku: `${product.sku}-V1`,
      label: "Default",
      stockQuantity: stock,
      isActive: true,
    })
    .returning();
  return { product, variant };
}

// ---- Phase 2: experience.book host-collision + isAvailable ---------------

describe("experience.book host-collision", () => {
  test("blocks a second booking that overlaps a PAID tour on the same host", async () => {
    const host = await createHost();
    const exp = await createExperience({
      authorId: host.user.id,
      durationMinutes: 180, // 3h window
    });

    const travelerA = await createUser();
    const travelerB = await createUser();

    // A books + pays: seed a paid tour directly on the same host at 10:00 for 3h.
    const date = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await createTour({
      userId: travelerA.id,
      hostId: host.host.id,
      experienceId: exp.id,
      status: "paid",
      packageType: "host_experience",
      priceAmount: exp.priceAmount,
      requestParams: {
        date,
        startTime: "10:00",
        durationHours: 3,
        groupSize: 1,
        interests: [exp.category],
        withHost: true,
        budgetLevel: "medium",
      },
    });

    // B tries to book at 11:00 (1h into A's window). Should fail with host busy.
    const callerB = await callerAs(travelerB);
    await expect(
      callerB.experience.book({
        experienceId: exp.id,
        date,
        startTime: "11:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/host is already booked/i),
    });
  });

  test("preview tours from other travelers DO NOT block a new booking", async () => {
    const host = await createHost();
    const exp = await createExperience({
      authorId: host.user.id,
      durationMinutes: 120,
    });

    const abandoner = await createUser();
    const realBuyer = await createUser();
    const date = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    // Abandoner started but never paid.
    await createTour({
      userId: abandoner.id,
      hostId: host.host.id,
      experienceId: exp.id,
      status: "preview",
      packageType: "host_experience",
      priceAmount: exp.priceAmount,
      requestParams: {
        date,
        startTime: "14:00",
        durationHours: 2,
        groupSize: 1,
        interests: [exp.category],
        withHost: true,
        budgetLevel: "medium",
      },
    });

    // Real buyer books the same slot: should succeed.
    const caller = await callerAs(realBuyer);
    const res = await caller.experience.book({
      experienceId: exp.id,
      date,
      startTime: "14:00",
      groupSize: 1,
    });
    expect(res.tourId).toBeTruthy();
  });

  test("rejects booking when host is paused (isAvailable=false)", async () => {
    const host = await createHost({ host: { isAvailable: false } });
    const exp = await createExperience({ authorId: host.user.id });
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    const date = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date,
        startTime: "10:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/paused/i),
    });
  });

  test("blocks a user from booking two tours that overlap each other", async () => {
    const host = await createHost();
    const exp = await createExperience({
      authorId: host.user.id,
      durationMinutes: 120,
    });
    const traveler = await createUser();
    const date = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    // Seed the user's first PAID tour 10:00-12:00.
    await createTour({
      userId: traveler.id,
      hostId: host.host.id,
      experienceId: exp.id,
      status: "paid",
      packageType: "host_experience",
      priceAmount: exp.priceAmount,
      requestParams: {
        date,
        startTime: "10:00",
        durationHours: 2,
        groupSize: 1,
        interests: [exp.category],
        withHost: true,
        budgetLevel: "medium",
      },
    });
    // Try to book another tour 11:00-13:00. Should fail.
    const caller = await callerAs(traveler);
    await expect(
      caller.experience.book({
        experienceId: exp.id,
        date,
        startTime: "11:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/already have a booking/i),
    });
  });
});

// ---- Phase 2: activity.addSlot guards ------------------------------------

describe("activity.addSlot guards", () => {
  test("rejects slot with capacity > activity.maxCapacityPerSlot", async () => {
    const host = await createHost();
    const { activity } = await createActivityWithSlot(host.user.id, { capacity: 6 });
    const caller = await callerAs(host.user);
    await expect(
      caller.activity.addSlot({
        activityId: activity.id,
        startsAt: new Date(Date.now() + 5 * 86400_000).toISOString(),
        endsAt: new Date(Date.now() + 5 * 86400_000 + 2 * 3600_000).toISOString(),
        capacity: 10, // exceeds max 6
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/exceed/i),
    });
  });

  test("rejects slot that overlaps another slot across the host's activities", async () => {
    const host = await createHost();
    // First activity has a slot at t0..t0+2h (from createActivityWithSlot).
    const { slot: firstSlot } = await createActivityWithSlot(host.user.id);

    // Create a second activity that belongs to the same host.
    const db = getTestDb();
    const [act2] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Sibling Act",
        slug: `sibling-${Date.now()}`,
        category: "food",
        priceAmount: 200_000,
        durationMinutes: 60,
        maxCapacityPerSlot: 4,
        description: "Another activity owned by the same host, distinct topic.",
        photos: ["https://example.com/b.jpg"],
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    // Overlapping window (start 30min into firstSlot).
    const proposedStart = new Date(firstSlot.startsAt.getTime() + 30 * 60_000);
    const proposedEnd = new Date(proposedStart.getTime() + 60 * 60_000);
    const caller = await callerAs(host.user);
    await expect(
      caller.activity.addSlot({
        activityId: act2.id,
        startsAt: proposedStart.toISOString(),
        endsAt: proposedEnd.toISOString(),
        capacity: 4,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/overlaps/i),
    });
  });

  test("happy path: adds a non-overlapping slot within capacity", async () => {
    const host = await createHost();
    const { activity } = await createActivityWithSlot(host.user.id, { capacity: 6 });
    const caller = await callerAs(host.user);
    const startsAt = new Date(Date.now() + 7 * 86400_000);
    const endsAt = new Date(startsAt.getTime() + 2 * 3600_000);
    const slot = await caller.activity.addSlot({
      activityId: activity.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity: 4,
    });
    expect(slot.capacity).toBe(4);
    expect(slot.bookedCount).toBe(0);
  });
});

// ---- Phase 1: order.createFromCart conflict hard-block -------------------

describe("order.createFromCart conflict enforcement", () => {
  test("rejects a cart with two overlapping activity slots", async () => {
    const host = await createHost();
    // Slot A: t0..t0+2h
    const { activity: a1, slot: s1 } = await createActivityWithSlot(host.user.id);
    // Activity B with an overlapping slot.
    const db = getTestDb();
    const [a2] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Conflicting Act",
        slug: `conflict-${Date.now()}`,
        category: "food",
        priceAmount: 300_000,
        durationMinutes: 90,
        maxCapacityPerSlot: 4,
        description: "Different activity that overlaps in time with the first one.",
        photos: ["https://example.com/c.jpg"],
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    const s1Start = new Date(s1.startsAt);
    const s2Start = new Date(s1Start.getTime() + 30 * 60_000);
    const s2End = new Date(s2Start.getTime() + 60 * 60_000);
    const [s2] = await db
      .insert(activitySlots)
      .values({ activityId: a2.id, startsAt: s2Start, endsAt: s2End, capacity: 4 })
      .returning();

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: a1.id, activitySlotId: s1.id, quantity: 1 });
    await caller.cart.add({ kind: "activity", activityId: a2.id, activitySlotId: s2.id, quantity: 1 });

    await expect(caller.order.createFromCart()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/overlaps/i),
    });
  });

  test("rejects a cart activity that overlaps the user's already-paid tour", async () => {
    const host = await createHost();
    const exp = await createExperience({ authorId: host.user.id });
    const traveler = await createUser();

    // User has a paid tour 10:00-12:00 on day D.
    const date = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await createTour({
      userId: traveler.id,
      hostId: host.host.id,
      experienceId: exp.id,
      status: "paid",
      packageType: "host_experience",
      priceAmount: exp.priceAmount,
      requestParams: {
        date,
        startTime: "10:00",
        durationHours: 2,
        groupSize: 1,
        interests: [exp.category],
        withHost: true,
        budgetLevel: "medium",
      },
    });

    // Add an activity slot that overlaps that window.
    const vnOffsetMs = 7 * 3600_000;
    const slotStart = new Date(Date.parse(`${date}T11:00:00Z`) - vnOffsetMs);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60_000);
    const { activity, slot } = await createActivityWithSlot(host.user.id, {
      startsAt: slotStart,
      endsAt: slotEnd,
    });

    const caller = await callerAs(traveler);
    await caller.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    await expect(caller.order.createFromCart()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/overlaps/i),
    });
  });
});

// ---- Phase 4: order.cancel + payment.refund -------------------------------

describe("order.cancel", () => {
  test("cancels a pending order; reject if already paid", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 1 });
    const { orderId } = await caller.order.createFromCart();

    await caller.order.cancel({ orderId, reason: "changed_mind" });

    const db = getTestDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("cancelled");
    expect(order.cancelReason).toBe("changed_mind");
    // Payment should be cancelled too.
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    expect(pay.status).toBe("cancelled");

    // Double-cancel rejected.
    await expect(caller.order.cancel({ orderId })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("payment.refund", () => {
  test("activity refund decrements bookedCount and re-opens slot", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id, {
      capacity: 2,
    });
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    await callerUser.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 2,
    });
    const { orderId } = await callerUser.order.createFromCart();
    await callerUser.order.confirmPayment({ orderId });

    // Slot should be sold_out (2/2).
    const db = getTestDb();
    const [slotAfterPay] = await db
      .select()
      .from(activitySlots)
      .where(eq(activitySlots.id, slot.id));
    expect(slotAfterPay.bookedCount).toBe(2);
    expect(slotAfterPay.status).toBe("sold_out");

    // Admin refunds.
    const admin = await createUser({ role: "admin" });
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    const callerAdmin = await callerAs(admin);
    await callerAdmin.payment.refund({ paymentId: pay.id, reason: "test" });

    const [slotAfterRefund] = await db
      .select()
      .from(activitySlots)
      .where(eq(activitySlots.id, slot.id));
    expect(slotAfterRefund.bookedCount).toBe(0);
    expect(slotAfterRefund.status).toBe("open");

    const [payAfter] = await db.select().from(payments).where(eq(payments.id, pay.id));
    expect(payAfter.status).toBe("refunded");
    expect(payAfter.refundAmount).toBeGreaterThan(0);
  });

  test("merch refund restores stockQuantity", async () => {
    const { variant } = await createMerchWithStock(5);
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    await callerUser.cart.add({
      kind: "merch",
      productVariantId: variant.id,
      quantity: 3,
    });
    const { orderId } = await callerUser.order.createFromCart();
    await callerUser.order.confirmPayment({ orderId });

    const db = getTestDb();
    const [vAfter] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant.id));
    expect(vAfter.stockQuantity).toBe(2);

    const admin = await createUser({ role: "admin" });
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    const callerAdmin = await callerAs(admin);
    await callerAdmin.payment.refund({ paymentId: pay.id });

    const [vRestored] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant.id));
    expect(vRestored.stockQuantity).toBe(5);
  });

  test("double-refund rejected", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    await callerUser.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    const { orderId } = await callerUser.order.createFromCart();
    await callerUser.order.confirmPayment({ orderId });

    const db = getTestDb();
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    const admin = await createUser({ role: "admin" });
    const callerAdmin = await callerAs(admin);
    await callerAdmin.payment.refund({ paymentId: pay.id });
    await expect(
      callerAdmin.payment.refund({ paymentId: pay.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("non-admin caller cannot refund", async () => {
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    // Create any payment row; we just need its id to try to refund.
    await expect(
      callerUser.payment.refund({
        paymentId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---- Phase 5: order.reapStale ---------------------------------------------

describe("order.reapStale", () => {
  test("cancels pending orders older than the cutoff, leaves fresh ones", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    await callerUser.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    const { orderId } = await callerUser.order.createFromCart();

    // Back-date the order to 2 hours ago.
    const db = getTestDb();
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    await db
      .update(orders)
      .set({ createdAt: twoHoursAgo })
      .where(eq(orders.id, orderId));

    const admin = await createUser({ role: "admin" });
    const callerAdmin = await callerAs(admin);
    const res = await callerAdmin.order.reapStale({ olderThanMinutes: 30 });
    expect(res.cancelled).toBe(1);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("cancelled");
    expect(order.cancelReason).toBe("payment_abandoned");
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, orderId));
    expect(pay.status).toBe("cancelled");
  });

  test("does not touch already-paid orders", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const callerUser = await callerAs(traveler);
    await callerUser.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    const { orderId } = await callerUser.order.createFromCart();
    await callerUser.order.confirmPayment({ orderId });

    const db = getTestDb();
    await db
      .update(orders)
      .set({ createdAt: new Date(Date.now() - 2 * 3600_000) })
      .where(eq(orders.id, orderId));

    const admin = await createUser({ role: "admin" });
    const callerAdmin = await callerAs(admin);
    const res = await callerAdmin.order.reapStale({ olderThanMinutes: 30 });
    expect(res.cancelled).toBe(0);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("paid");
  });
});

// ---- Phase 3: fixed_tour deprecation on the server side -------------------

describe("fixed_tour cart deprecation", () => {
  test("order.createFromCart rejects historical fixed_tour rows", async () => {
    const host = await createHost();
    const exp = await createExperience({ authorId: host.user.id });
    const traveler = await createUser();
    // Write the deprecated row directly (bypassing cart.add which now
    // rejects it), to simulate a historical pre-deprecation row.
    const db = getTestDb();
    const { cartItems } = await import("@/server/db/schema");
    await db.insert(cartItems).values({
      userId: traveler.id,
      kind: "fixed_tour",
      experienceId: exp.id,
      quantity: 1,
      priceSnapshotVnd: exp.priceAmount,
      metadata: { title: exp.title },
    });
    const caller = await callerAs(traveler);
    await expect(caller.order.createFromCart()).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/experience page/i),
    });
  });
});

// silence unused import warnings for imports we might only conditionally use
void orderItems;
