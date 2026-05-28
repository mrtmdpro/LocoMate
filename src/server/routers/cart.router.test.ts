import { describe, test, expect } from "vitest";
import { callerAs } from "@/test/trpc";
import { createUser, createHost, createExperience } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { activities, activitySlots, products, productVariants } from "@/server/db/schema";

async function createActivityWithSlot(authorId: string, price = 400_000) {
  const db = getTestDb();
  const [act] = await db
    .insert(activities)
    .values({
      authorId,
      title: "Test Act",
      slug: `test-act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: "workshop",
      priceAmount: price,
      durationMinutes: 120,
      maxCapacityPerSlot: 6,
      description: "A test activity with enough description to satisfy publish.",
      photos: ["https://example.com/a.jpg"],
      highlights: ["one", "two"],
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
      endsAt: new Date(now.getTime() + 120 * 60_000),
      capacity: 6,
      bookedCount: 0,
      status: "open",
    })
    .returning();
  return { activity: act, slot };
}

async function createProductWithVariant(price = 200_000, stock = 10) {
  const db = getTestDb();
  const [product] = await db
    .insert(products)
    .values({
      sku: `TEST-${Date.now()}`,
      title: "Test Product",
      slug: `test-product-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "apparel",
      basePriceVnd: price,
      photos: ["https://example.com/p.jpg"],
      isActive: true,
      bundleDiscountPct: 15,
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

describe("cart.add + get", () => {
  test("activity line adds with slot + price snapshot", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id, 500_000);

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 2 });

    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].kind).toBe("activity");
    expect(cart.items[0].priceSnapshotVnd).toBe(500_000);
    expect(cart.items[0].lineTotalVnd).toBe(1_000_000);
    expect(cart.subtotalVnd).toBe(1_000_000);
  });

  test("conflict detection flags overlapping activity slots", async () => {
    const host = await createHost();
    const { activity: a1, slot: s1 } = await createActivityWithSlot(host.user.id, 300_000);
    // Second activity at an overlapping time window.
    const db = getTestDb();
    const [a2] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Test Act 2",
        slug: `test-act2-${Date.now()}`,
        category: "food",
        priceAmount: 350_000,
        durationMinutes: 90,
        maxCapacityPerSlot: 4,
        description: "Another activity for conflict detection coverage here.",
        photos: ["https://example.com/b.jpg"],
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    // Overlap: s1 is at t0..t0+120; make s2 at t0+60..t0+150.
    const s1Start = new Date(s1.startsAt);
    const [s2] = await db
      .insert(activitySlots)
      .values({
        activityId: a2.id,
        startsAt: new Date(s1Start.getTime() + 60 * 60_000),
        endsAt: new Date(s1Start.getTime() + 150 * 60_000),
        capacity: 4,
        bookedCount: 0,
        status: "open",
      })
      .returning();

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: a1.id, activitySlotId: s1.id, quantity: 1 });
    await caller.cart.add({ kind: "activity", activityId: a2.id, activitySlotId: s2.id, quantity: 1 });

    const cart = await caller.cart.get();
    expect(cart.conflicts).toHaveLength(1);
    expect(cart.conflicts[0].labelA).toBeTruthy();
    expect(cart.conflicts[0].labelB).toBeTruthy();
  });

  test("merch line respects stock + variant price", async () => {
    const { variant } = await createProductWithVariant(250_000, 5);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 3 });

    const cart = await caller.cart.get();
    expect(cart.items[0].priceSnapshotVnd).toBe(250_000);
    expect(cart.items[0].lineTotalVnd).toBe(750_000);

    await expect(
      caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 10 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("fixed_tour kind is rejected -- tours must be booked via experience.book", async () => {
    // fixed_tour has been removed from the cart discriminated union. The
    // canonical path for booking a bundled Experience is experience.book,
    // which writes a tours row with status='preview' and redirects to
    // /tour/[id]/checkout. Trying to route a tour through the cart leaks
    // scheduling metadata and competes with the direct-book flow, so we
    // reject it at the input layer.
    const exp = await createExperience({ priceAmount: 1_000_000, status: "published" });
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await expect(
      // Cast because the discriminated union no longer includes this kind;
      // we're asserting Zod's discriminator rejection.
      caller.cart.add({
        kind: "fixed_tour",
        experienceId: exp.id,
        quantity: 2,
      } as unknown as Parameters<typeof caller.cart.add>[0]),
    ).rejects.toThrow();
  });
});

describe("cart.updateQuantity + remove + clear", () => {
  test("remove line subtracts subtotal", async () => {
    const { variant } = await createProductWithVariant(100_000, 10);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    const item = await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });
    let cart = await caller.cart.get();
    expect(cart.subtotalVnd).toBe(100_000);
    await caller.cart.remove({ cartItemId: item.id });
    cart = await caller.cart.get();
    expect(cart.items).toHaveLength(0);
  });

  test("clear empties cart", async () => {
    const { variant } = await createProductWithVariant(100_000, 10);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });
    await caller.cart.clear();
    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(0);
  });
});

describe("cart requires auth", () => {
  test("anonymous caller is rejected", async () => {
    const caller = await callerAs(null);
    await expect(caller.cart.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// Locale-aware hydration: `cart.get` accepts an optional locale and uses
// it to pick localized title/subtitle from bilingual activity/product
// rows AND to render synthesized strings (eSIM, guide_addon, fallback)
// in the user's language. Pins this so the `/vi/cart` page never reverts
// to mixed English+VI rendering.
describe("cart.get locale-aware hydration", () => {
  test("activity line uses titleVi/subtitleVi when locale='vi'", async () => {
    const db = getTestDb();
    const host = await createHost();
    const [act] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Bat Trang Pottery Throwing",
        titleVi: "Vuốt gốm Bát Tràng",
        titleEn: "Bat Trang Pottery Throwing",
        slug: `loc-act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: "workshop",
        priceAmount: 400_000,
        durationMinutes: 120,
        maxCapacityPerSlot: 6,
        description: "Bilingual test activity.",
        subtitle: "Make, fire, glaze, take home",
        subtitleVi: "Vuốt, nung, tráng men, mang về",
        subtitleEn: "Make, fire, glaze, take home",
        photos: ["https://example.com/a.jpg"],
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    const slotStart = new Date(Date.now() + 86400_000);
    const [slot] = await db
      .insert(activitySlots)
      .values({
        activityId: act.id,
        startsAt: slotStart,
        endsAt: new Date(slotStart.getTime() + 120 * 60_000),
        capacity: 6,
        bookedCount: 0,
        status: "open",
      })
      .returning();

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: act.id, activitySlotId: slot.id, quantity: 1 });

    const vi = await caller.cart.get({ locale: "vi" });
    expect(vi.items[0].displayLabel).toBe("Vuốt gốm Bát Tràng");
    expect(vi.items[0].lineSubtitle).toBe("Vuốt, nung, tráng men, mang về");

    const en = await caller.cart.get({ locale: "en" });
    expect(en.items[0].displayLabel).toBe("Bat Trang Pottery Throwing");
    expect(en.items[0].lineSubtitle).toBe("Make, fire, glaze, take home");
  });

  test("eSIM line uses Vietnamese 'Kích hoạt khi tới nơi' subtitle under locale='vi'", async () => {
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({
      kind: "esim",
      dataPackageGb: 15,
      priceSnapshotVnd: 267_000,
      metadata: { planName: "Explorer" },
    });

    const vi = await caller.cart.get({ locale: "vi" });
    const esim = vi.items.find((i) => i.kind === "esim");
    expect(esim?.displayLabel).toBe("eSIM · 15 GB");
    expect(esim?.lineSubtitle).toBe("Kích hoạt khi tới nơi");

    const en = await caller.cart.get({ locale: "en" });
    const esimEn = en.items.find((i) => i.kind === "esim");
    expect(esimEn?.lineSubtitle).toBe("Activates on arrival");
  });

  test("guide_addon uses 'Hướng dẫn viên địa phương' / 'Cho <title>' under locale='vi'", async () => {
    const db = getTestDb();
    const host = await createHost();
    const [act] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Egg Coffee Workshop",
        titleVi: "Workshop cà phê trứng",
        titleEn: "Egg Coffee Workshop",
        slug: `loc-guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: "workshop",
        priceAmount: 320_000,
        durationMinutes: 75,
        maxCapacityPerSlot: 4,
        description: "Bilingual host activity for guide-addon coverage.",
        photos: ["https://example.com/g.jpg"],
        status: "published",
        publishedAt: new Date(),
        guideOptional: true,
        guideAddonVnd: 100_000,
      })
      .returning();

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "guide_addon", parentActivityId: act.id });

    const vi = await caller.cart.get({ locale: "vi" });
    const addon = vi.items.find((i) => i.kind === "guide_addon");
    expect(addon?.displayLabel).toBe("Hướng dẫn viên địa phương");
    expect(addon?.lineSubtitle).toBe("Cho Workshop cà phê trứng");

    const en = await caller.cart.get({ locale: "en" });
    const addonEn = en.items.find((i) => i.kind === "guide_addon");
    expect(addonEn?.displayLabel).toBe("Local guide add-on");
    expect(addonEn?.lineSubtitle).toBe("For Egg Coffee Workshop");
  });

  test("locale defaults to 'en' when not provided (backward compatibility)", async () => {
    const { variant } = await createProductWithVariant(150_000, 10);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });
    // No `locale` field -- existing callers like plan/build keep their
    // English-default behavior.
    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(1);
    // Product was seeded with title="Test Product" (legacy column), no
    // titleEn/titleVi -- pickLocaleField falls back to the legacy column,
    // so the label still renders.
    expect(cart.items[0].displayLabel).toMatch(/Test Product/);
  });
});

// Identity-keyed merge regression coverage. The original `cart.add` always
// INSERTed, which produced duplicate rows whenever a user re-clicked
// "Thêm vào giỏ" (commonly because the old auto-redirect + missing
// feedback made them think the click failed). These tests pin the merge
// behavior in place so the duplicate-row UX regression can't return.
describe("cart.add idempotency", () => {
  test("re-adding the same activity slot merges into one row with summed quantity", async () => {
    const host = await createHost();
    const { activity, slot } = await createActivityWithSlot(host.user.id, 400_000);

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 1 });
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 2 });

    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].lineTotalVnd).toBe(1_200_000);
  });

  test("merge respects slot capacity against the *prospective* total, not just the new delta", async () => {
    const host = await createHost();
    // Slot capacity is 6. First add 4, then try to add 3 more (7 > 6).
    // Pre-merge this passed because the check was only `delta > capacity`;
    // post-merge it must catch the combined 7 against capacity 6.
    const { activity, slot } = await createActivityWithSlot(host.user.id, 200_000);

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 4 });
    await expect(
      caller.cart.add({ kind: "activity", activityId: activity.id, activitySlotId: slot.id, quantity: 3 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(4);
  });

  test("re-adding the same merch variant merges quantity instead of duplicating", async () => {
    const { variant } = await createProductWithVariant(150_000, 10);
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 1 });
    await caller.cart.add({ kind: "merch", productVariantId: variant.id, quantity: 2 });

    const cart = await caller.cart.get();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].lineTotalVnd).toBe(450_000);
  });

  test("guide_addon merge keeps quantity pinned at 1 (no doubling)", async () => {
    const host = await createHost();
    const db = getTestDb();
    // Activity with a guide add-on -- the helper doesn't set one so we
    // create directly to also exercise the guideAddonVnd path.
    const [activity] = await db
      .insert(activities)
      .values({
        authorId: host.user.id,
        title: "Guided walk",
        slug: `guided-walk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: "cultural",
        priceAmount: 500_000,
        durationMinutes: 90,
        maxCapacityPerSlot: 8,
        description: "A guided walk that satisfies the publish length requirement.",
        photos: ["https://example.com/g.jpg"],
        status: "published",
        publishedAt: new Date(),
        guideOptional: true,
        guideAddonVnd: 100_000,
      })
      .returning();

    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({ kind: "guide_addon", parentActivityId: activity.id });
    await caller.cart.add({ kind: "guide_addon", parentActivityId: activity.id });

    const cart = await caller.cart.get();
    const addonLines = cart.items.filter((i) => i.kind === "guide_addon");
    expect(addonLines).toHaveLength(1);
    expect(addonLines[0].quantity).toBe(1);
  });

  test("eSIM lines stay distinct (no merge) -- each purchase is its own line", async () => {
    const traveler = await createUser();
    const caller = await callerAs(traveler);
    await caller.cart.add({
      kind: "esim",
      dataPackageGb: 15,
      priceSnapshotVnd: 267_000,
      metadata: { planName: "Explorer" },
    });
    await caller.cart.add({
      kind: "esim",
      dataPackageGb: 15,
      priceSnapshotVnd: 267_000,
      metadata: { planName: "Explorer" },
    });

    const cart = await caller.cart.get();
    const esimLines = cart.items.filter((i) => i.kind === "esim");
    expect(esimLines).toHaveLength(2);
  });
});
