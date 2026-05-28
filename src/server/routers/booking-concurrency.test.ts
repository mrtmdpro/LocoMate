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
} from "@/server/db/schema";

/**
 * Concurrent booking exclusion.
 *
 * PGlite is single-connection but Drizzle still emits a conditional UPDATE
 * (`... WHERE booked_count + qty <= capacity`) so two simultaneous
 * confirmPayment calls from different users on the same capacity-1 slot
 * cannot both win. That's the same exclusion we'd see under Neon; this
 * test documents the invariant and guards against a future refactor that
 * accidentally splits the read + write.
 */

async function seedSeatForOne(authorId: string) {
  const db = getTestDb();
  const [act] = await db
    .insert(activities)
    .values({
      authorId,
      title: "Concurrency Act",
      slug: `concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "workshop",
      priceAmount: 500_000,
      durationMinutes: 60,
      maxCapacityPerSlot: 1,
      description: "Single-seat activity used to verify concurrent confirms.",
      photos: ["https://example.com/c.jpg"],
      highlights: ["one", "two"],
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  const startsAt = new Date(Date.now() + 2 * 86400_000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const [slot] = await db
    .insert(activitySlots)
    .values({
      activityId: act.id,
      startsAt,
      endsAt,
      capacity: 1,
    })
    .returning();
  return { activity: act, slot };
}

async function seedOneStockUnit() {
  const db = getTestDb();
  const [product] = await db
    .insert(products)
    .values({
      sku: `CONC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Concurrent Merch",
      slug: `conc-merch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "apparel",
      basePriceVnd: 150_000,
      photos: ["https://example.com/m.jpg"],
      isActive: true,
    })
    .returning();
  const [variant] = await db
    .insert(productVariants)
    .values({
      productId: product.id,
      sku: `${product.sku}-V1`,
      label: "Default",
      stockQuantity: 1,
      isActive: true,
    })
    .returning();
  return { product, variant };
}

describe("activity slot concurrency", () => {
  test("two concurrent confirmPayment calls on a capacity-1 slot: exactly one wins", async () => {
    const host = await createHost();
    const { activity, slot } = await seedSeatForOne(host.user.id);

    const buyerA = await createUser();
    const buyerB = await createUser();
    const callerA = await callerAs(buyerA);
    const callerB = await callerAs(buyerB);

    await callerA.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    await callerB.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });

    const { orderId: orderA } = await callerA.order.createFromCart();
    const { orderId: orderB } = await callerB.order.createFromCart();

    const results = await Promise.allSettled([
      callerA.order.confirmPayment({ orderId: orderA }),
      callerB.order.confirmPayment({ orderId: orderB }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // Loser gets the documented "sold out before you could confirm" error.
    expect(
      (rejected[0] as PromiseRejectedResult).reason,
    ).toMatchObject({ code: "PRECONDITION_FAILED" });

    // Slot booked_count is exactly 1; CHECK constraint would reject anything else.
    const db = getTestDb();
    const [slotAfter] = await db
      .select()
      .from(activitySlots)
      .where(eq(activitySlots.id, slot.id));
    expect(slotAfter.bookedCount).toBe(1);
    expect(slotAfter.status).toBe("sold_out");
  });
});

describe("merch stock concurrency", () => {
  test("two concurrent confirmPayment calls for the last unit: exactly one wins", async () => {
    const { variant } = await seedOneStockUnit();

    const buyerA = await createUser();
    const buyerB = await createUser();
    const callerA = await callerAs(buyerA);
    const callerB = await callerAs(buyerB);

    await callerA.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });
    await callerB.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });

    const { orderId: orderA } = await callerA.order.createFromCart();
    const { orderId: orderB } = await callerB.order.createFromCart();

    const results = await Promise.allSettled([
      callerA.order.confirmPayment({ orderId: orderA }),
      callerB.order.confirmPayment({ orderId: orderB }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const db = getTestDb();
    const [vAfter] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant.id));
    expect(vAfter.stockQuantity).toBe(0);
  });
});

describe("capacity edge cases at confirm", () => {
  test("exactly-at-capacity succeeds, +1 fails", async () => {
    // Seed a 2-seat slot. First buyer takes 2 (exactly at capacity) -> pass.
    // Second buyer tries to add 1 -> rejected at cart.add (pre-payment
    // check that the router makes).
    const host = await createHost();
    const db = getTestDb();
    const [act] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Capacity Edge",
        slug: `capacity-edge-${Date.now()}`,
        category: "workshop",
        priceAmount: 200_000,
        durationMinutes: 60,
        maxCapacityPerSlot: 2,
        description: "Two-seat slot used to verify exact-capacity edge case.",
        photos: ["https://example.com/cap.jpg"],
        highlights: ["one", "two"],
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    const startsAt = new Date(Date.now() + 2 * 86400_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const [slot] = await db
      .insert(activitySlots)
      .values({
        activityId: act.id,
        startsAt,
        endsAt,
        capacity: 2,
      })
      .returning();

    const buyerA = await createUser();
    const callerA = await callerAs(buyerA);
    await callerA.cart.add({
      kind: "activity",
      activityId: act.id,
      activitySlotId: slot.id,
      quantity: 2,
    });
    const { orderId } = await callerA.order.createFromCart();
    await callerA.order.confirmPayment({ orderId });

    const [slotAfter] = await db
      .select()
      .from(activitySlots)
      .where(eq(activitySlots.id, slot.id));
    expect(slotAfter.bookedCount).toBe(2);
    expect(slotAfter.status).toBe("sold_out");

    // Second buyer tries to add 1 -- slot is sold_out now. cart.add enforces
    // `slot.status !== 'open'` so this should be rejected at add time.
    const buyerB = await createUser();
    const callerB = await callerAs(buyerB);
    await expect(
      callerB.cart.add({
        kind: "activity",
        activityId: act.id,
        activitySlotId: slot.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("stale cart + sold-out slot: confirm surfaces clear error", async () => {
    // Buyer A adds to a 1-seat slot while it's still open, Buyer B then
    // fully books it via a fresh cart. When A finally confirms, the
    // conditional UPDATE can't satisfy the capacity predicate and the
    // mutation throws the "sold out before you could confirm" message.
    const host = await createHost();
    const { activity, slot } = await seedSeatForOne(host.user.id);

    const buyerA = await createUser();
    const buyerB = await createUser();
    const callerA = await callerAs(buyerA);
    const callerB = await callerAs(buyerB);

    // A adds + creates order first (but doesn't confirm).
    await callerA.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    const { orderId: orderA } = await callerA.order.createFromCart();

    // B adds, creates, confirms. Slot now 1/1.
    await callerB.cart.add({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: slot.id,
      quantity: 1,
    });
    const { orderId: orderB } = await callerB.order.createFromCart();
    await callerB.order.confirmPayment({ orderId: orderB });

    // A tries to confirm -- conditional UPDATE fails.
    await expect(
      callerA.order.confirmPayment({ orderId: orderA }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/sold out/i),
    });
  });
});
