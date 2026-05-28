import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createHost } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import {
  activities,
  activitySlots,
  products,
  productVariants,
  orders,
  payments,
} from "@/server/db/schema";

async function createActivityWithSlot(authorId: string, capacity = 6) {
  const db = getTestDb();
  const [act] = await db
    .insert(activities)
    .values({
      authorId,
      title: "Order Test Activity",
      slug: `order-act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "workshop",
      priceAmount: 500_000,
      durationMinutes: 90,
      maxCapacityPerSlot: capacity,
      description: "Enough chars to satisfy any validation we might add later.",
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const now = new Date(Date.now() + 2 * 86400_000);
  const [slot] = await db
    .insert(activitySlots)
    .values({
      activityId: act.id,
      startsAt: now,
      endsAt: new Date(now.getTime() + 90 * 60_000),
      capacity,
      bookedCount: 0,
      status: "open",
    })
    .returning();
  return { activity: act, slot };
}

async function createProductWithVariant(stock = 10) {
  const db = getTestDb();
  const [product] = await db
    .insert(products)
    .values({
      sku: `PR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Order Test Product",
      slug: `order-product-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "apparel",
      basePriceVnd: 200_000,
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

describe("order.createFromCart", () => {
  test("creates order + pending payment and clears cart", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 2 });

    const out = await caller.order.createFromCart();
    expect(out.orderId).toBeTruthy();
    expect(out.paymentId).toBeTruthy();
    expect(out.totalVnd).toBe(1_000_000);

    // Cart is cleared.
    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(0);

    // Payment is pending + uses orderId (not tourId).
    const db = getTestDb();
    const [p] = await db.select().from(payments).where(eq(payments.id, out.paymentId));
    expect(p.status).toBe("pending");
    expect(p.orderId).toBe(out.orderId);
    expect(p.tourId).toBeNull();
  });

  test("applies ESIM_BUNDLE_10 when eSIM + activity are both in cart", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 1 });
    await caller.cart.add({ kind: "esim", dataPackageGb: 15, priceSnapshotVnd: 300_000 });

    const out = await caller.order.createFromCart();
    // Subtotal = 500k (activity) + 300k (esim) = 800k
    // Bundle discount on eSIM = 10% of 300k = 30k
    // Total = 800k - 30k = 770k
    expect(out.totalVnd).toBe(770_000);

    const db = getTestDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, out.orderId));
    expect(order.discountVnd).toBe(30_000);
    expect(order.bundleCodes).toContain("ESIM_BUNDLE_10");
  });

  test("rejects empty cart", async () => {
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await expect(caller.order.createFromCart()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("order.confirmPayment", () => {
  test("flips order + payment to paid, decrements slot capacity and stock", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id, 4);
    const { variant } = await createProductWithVariant(5);

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 2 });
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 3 });

    const out = await caller.order.createFromCart();
    await caller.order.confirmPayment({ orderId: out.orderId });

    const db = getTestDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, out.orderId));
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBeTruthy();

    const [postSlot] = await db.select().from(activitySlots).where(eq(activitySlots.id, slot.id));
    expect(postSlot.bookedCount).toBe(2);

    const [postVariant] = await db.select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(postVariant.stockQuantity).toBe(2);
  });

  test("rejects double-confirm", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 1 });
    const out = await caller.order.createFromCart();
    await caller.order.confirmPayment({ orderId: out.orderId });

    await expect(caller.order.confirmPayment({ orderId: out.orderId })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

describe("order auth isolation", () => {
  test("cannot confirm another user's order", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id);
    const ownerTraveler = await createUser();
    const ownerCaller = await callerAs(ownerTraveler);
    await ownerCaller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 1 });
    const out = await ownerCaller.order.createFromCart();

    const intruder = await createUser();
    const intruderCaller = await callerAs(intruder);
    await expect(intruderCaller.order.confirmPayment({ orderId: out.orderId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
