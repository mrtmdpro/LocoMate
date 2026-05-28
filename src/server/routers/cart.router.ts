import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import {
  cartItems,
  activities,
  activitySlots,
  products,
  productVariants,
} from "../db/schema";
import { detectConflicts } from "@/lib/cart-conflicts";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";

/**
 * Server-side strings for cart lines that are synthesized (eSIM, guide
 * add-on, fallback "Item") rather than read from a bilingual DB column.
 * Mirrors `cart.page.line.*` in messages/{en,vi}.json so the cart router
 * can return ready-to-render strings without dragging next-intl into the
 * tRPC server. Keep in lockstep with the message files; only ~5 keys so
 * the DRY cost is negligible.
 */
const CART_LINE_STRINGS = {
  vi: {
    fallback: "Mục",
    esimLabel: (gb: number | "?") => `eSIM · ${gb} GB`,
    esimSubtitle: "Kích hoạt khi tới nơi",
    guideLabel: "Hướng dẫn viên địa phương",
    guideForSubtitle: (title: string) => `Cho ${title}`,
  },
  en: {
    fallback: "Item",
    esimLabel: (gb: number | "?") => `eSIM · ${gb} GB`,
    esimSubtitle: "Activates on arrival",
    guideLabel: "Local guide add-on",
    guideForSubtitle: (title: string) => `For ${title}`,
  },
} as const;

/**
 * Persistent multi-line cart. One row per line item, scoped to the caller.
 * Kinds: 'activity' | 'merch' | 'esim' | 'guide_addon'.
 *
 * Note: 'fixed_tour' is NOT a cart kind. Fixed tours (bundled Experiences)
 * are booked directly via `experience.book`, which writes a `tours` row
 * and routes the user straight to `/tour/[id]/checkout`. A cart doesn't
 * model the required date / startTime / groupSize per line, so carrying
 * fixed tours through the cart would require either per-line scheduling
 * or a throwaway bundle step -- the direct-book path is simpler.
 *
 * Pricing: the cart captures a priceSnapshot at add time so the total is
 * stable across sessions even if the host updates their listing. Final
 * authority still runs at order.createFromCart which re-reads live prices
 * from the source tables, so a long-abandoned cart can't be exploited to
 * lock a favourable price.
 *
 * Time conflicts: the detector returns overlapping pairs so the UI can
 * highlight rows and block checkout until the user resolves them. Server
 * side, order.createFromCart re-runs the same detector and refuses to
 * convert a conflicting cart.
 */

const ADD_ITEM_SCHEMAS = {
  activity: z.object({
    kind: z.literal("activity"),
    activityId: z.string().uuid(),
    activitySlotId: z.string().uuid(),
    quantity: z.number().int().min(1).max(12).default(1),
  }),
  merch: z.object({
    kind: z.literal("merch"),
    productVariantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10).default(1),
  }),
  esim: z.object({
    kind: z.literal("esim"),
    dataPackageGb: z.number().int().min(3).max(50),
    priceSnapshotVnd: z.number().int().min(0),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  guide_addon: z.object({
    kind: z.literal("guide_addon"),
    parentActivityId: z.string().uuid(),
  }),
} as const;

export const cartRouter = router({
  /**
   * Get the full cart with hydrated metadata. Each line has `displayLabel`
   * and `thumbnail` fields populated from the linked entity -- saves the
   * client from issuing N follow-up queries.
   *
   * `locale` is optional so existing callers (tests, plan/build) keep
   * their English-default behavior. The cart page passes the current
   * route locale so titles/subtitles render in the user's language
   * (uses pickLocaleField for activity/product bilingual columns and the
   * CART_LINE_STRINGS table for purely-synthesized rows like eSIM /
   * guide_addon / fallback).
   */
  get: protectedProcedure
    .input(z.object({ locale: z.enum(["vi", "en"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
    const locale: Locale = input?.locale ?? "en";
    const lineStrings = CART_LINE_STRINGS[locale];

    const items = await ctx.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, ctx.user.id))
      .orderBy(asc(cartItems.createdAt));
    if (items.length === 0) {
      return { items: [], subtotalVnd: 0, conflicts: [] };
    }

    // Hydrate: fetch names / photos / slots in parallel.
    const activityIds = items.map((i) => i.activityId || i.parentActivityId).filter((x): x is string => !!x);
    const slotIds = items.map((i) => i.activitySlotId).filter((x): x is string => !!x);
    const variantIds = items.map((i) => i.productVariantId).filter((x): x is string => !!x);

    const [acts, slots, variants] = await Promise.all([
      activityIds.length
        ? ctx.db.select().from(activities).where(inArray(activities.id, activityIds))
        : Promise.resolve([] as (typeof activities.$inferSelect)[]),
      slotIds.length
        ? ctx.db.select().from(activitySlots).where(inArray(activitySlots.id, slotIds))
        : Promise.resolve([] as (typeof activitySlots.$inferSelect)[]),
      variantIds.length
        ? ctx.db
            .select({
              variant: productVariants,
              product: products,
            })
            .from(productVariants)
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(inArray(productVariants.id, variantIds))
        : Promise.resolve([] as { variant: typeof productVariants.$inferSelect; product: typeof products.$inferSelect }[]),
    ]);

    const actMap = new Map(acts.map((a) => [a.id, a]));
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const variantMap = new Map(variants.map((v) => [v.variant.id, v]));

    const hydrated = items.map((item) => {
      let displayLabel: string = lineStrings.fallback;
      let thumbnail: string | null = null;
      let lineSubtitle: string | null = null;
      let slotStartsAt: string | null = null;
      let slotEndsAt: string | null = null;

      if (item.kind === "activity" && item.activityId) {
        const act = actMap.get(item.activityId);
        const slot = item.activitySlotId ? slotMap.get(item.activitySlotId) : null;
        if (act) {
          displayLabel = pickLocaleField<string>(act, "title", locale) ?? act.title;
          thumbnail = Array.isArray(act.photos) ? act.photos[0] ?? null : null;
          lineSubtitle = pickLocaleField<string>(act, "subtitle", locale) ?? act.subtitle;
        }
        if (slot) {
          slotStartsAt = slot.startsAt.toISOString();
          slotEndsAt = slot.endsAt.toISOString();
        }
      } else if (item.kind === "merch" && item.productVariantId) {
        const joined = variantMap.get(item.productVariantId);
        if (joined) {
          const productTitle = pickLocaleField<string>(joined.product, "title", locale) ?? joined.product.title;
          displayLabel = `${productTitle} · ${joined.variant.label}`;
          thumbnail = joined.product.photos?.[0] ?? null;
        }
      } else if (item.kind === "esim") {
        const data = (item.metadata as { dataPackageGb?: number } | null)?.dataPackageGb;
        displayLabel = lineStrings.esimLabel(data ?? "?");
        lineSubtitle = lineStrings.esimSubtitle;
      } else if (item.kind === "guide_addon" && item.parentActivityId) {
        const act = actMap.get(item.parentActivityId);
        displayLabel = lineStrings.guideLabel;
        const parentTitle = act ? (pickLocaleField<string>(act, "title", locale) ?? act.title) : null;
        lineSubtitle = parentTitle ? lineStrings.guideForSubtitle(parentTitle) : null;
      }

      const lineTotalVnd = item.priceSnapshotVnd * item.quantity;
      return {
        ...item,
        displayLabel,
        thumbnail,
        lineSubtitle,
        lineTotalVnd,
        slotStartsAt,
        slotEndsAt,
      };
    });

    const subtotalVnd = hydrated.reduce((acc, x) => acc + x.lineTotalVnd, 0);

    // Delegate overlap detection to lib/cart-conflicts so this matches
    // exactly what order.createFromCart enforces server-side. Keeping the
    // check in one place prevents the UI from allowing a checkout the
    // server then rejects or vice-versa.
    const conflicts = detectConflicts(
      hydrated.map((x) => ({
        id: x.id,
        label: x.displayLabel,
        startsAt: x.slotStartsAt,
        endsAt: x.slotEndsAt,
      })),
    );

    return { items: hydrated, subtotalVnd, conflicts };
  }),

  add: protectedProcedure
    .input(
      z.discriminatedUnion("kind", [
        ADD_ITEM_SCHEMAS.activity,
        ADD_ITEM_SCHEMAS.merch,
        ADD_ITEM_SCHEMAS.esim,
        ADD_ITEM_SCHEMAS.guide_addon,
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      // Identity-keyed merge. Re-adding the same line (same activity+slot,
      // same variant, or same parent for a guide add-on) bumps the existing
      // row's quantity instead of inserting a duplicate. This matches what
      // users expect from "Add to cart" -- re-clicking shouldn't fragment a
      // single purchase into N rows -- and prevents the regression where a
      // slow-network user re-clicks because no feedback appeared and ends
      // up with 3 lines in /cart. eSIM keeps INSERT because each purchase
      // is a distinct line by design (different package or different trip).
      //
      // Capacity / stock checks always run against the *prospective* total
      // (existing.quantity + input.quantity) so merge can never bypass a
      // slot's capacity or a variant's stock.

      if (input.kind === "activity") {
        const act = await ctx.db.query.activities.findFirst({
          where: eq(activities.id, input.activityId),
        });
        if (!act || act.status !== "published") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Activity not available" });
        }
        const slot = await ctx.db.query.activitySlots.findFirst({
          where: eq(activitySlots.id, input.activitySlotId),
        });
        if (!slot || slot.activityId !== input.activityId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Slot does not belong to this activity" });
        }
        if (slot.status !== "open") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Slot is not open" });
        }

        const [existing] = await ctx.db
          .select()
          .from(cartItems)
          .where(
            and(
              eq(cartItems.userId, ctx.user.id),
              eq(cartItems.kind, "activity"),
              eq(cartItems.activityId, input.activityId),
              eq(cartItems.activitySlotId, input.activitySlotId),
            ),
          )
          .limit(1);

        const prospectiveQty = (existing?.quantity ?? 0) + input.quantity;
        if (slot.bookedCount + prospectiveQty > slot.capacity) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not enough seats left in this slot" });
        }

        if (existing) {
          const [updated] = await ctx.db
            .update(cartItems)
            .set({ quantity: prospectiveQty, updatedAt: new Date() })
            .where(eq(cartItems.id, existing.id))
            .returning();
          return updated;
        }

        const [created] = await ctx.db
          .insert(cartItems)
          .values({
            userId: ctx.user.id,
            kind: "activity",
            activityId: input.activityId,
            activitySlotId: input.activitySlotId,
            quantity: input.quantity,
            priceSnapshotVnd: act.priceAmount,
            metadata: { title: act.title, slug: act.slug, durationMinutes: act.durationMinutes },
          })
          .returning();
        return created;
      }

      if (input.kind === "merch") {
        const [joined] = await ctx.db
          .select({ variant: productVariants, product: products })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(eq(productVariants.id, input.productVariantId));
        if (!joined || !joined.variant.isActive || !joined.product.isActive) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product variant not available" });
        }

        const [existing] = await ctx.db
          .select()
          .from(cartItems)
          .where(
            and(
              eq(cartItems.userId, ctx.user.id),
              eq(cartItems.kind, "merch"),
              eq(cartItems.productVariantId, input.productVariantId),
            ),
          )
          .limit(1);

        const prospectiveQty = (existing?.quantity ?? 0) + input.quantity;
        if (joined.variant.stockQuantity < prospectiveQty) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not enough stock" });
        }

        const priceSnapshotVnd = joined.variant.priceOverrideVnd ?? joined.product.basePriceVnd;

        if (existing) {
          const [updated] = await ctx.db
            .update(cartItems)
            .set({ quantity: prospectiveQty, updatedAt: new Date() })
            .where(eq(cartItems.id, existing.id))
            .returning();
          return updated;
        }

        const [created] = await ctx.db
          .insert(cartItems)
          .values({
            userId: ctx.user.id,
            kind: "merch",
            productVariantId: input.productVariantId,
            quantity: input.quantity,
            priceSnapshotVnd,
            metadata: { title: joined.product.title, label: joined.variant.label, slug: joined.product.slug },
          })
          .returning();
        return created;
      }

      if (input.kind === "esim") {
        // Intentionally no merge -- each eSIM purchase is a distinct line
        // (different package, different trip, gifting, etc).
        const [created] = await ctx.db
          .insert(cartItems)
          .values({
            userId: ctx.user.id,
            kind: "esim",
            quantity: 1,
            priceSnapshotVnd: input.priceSnapshotVnd,
            metadata: { dataPackageGb: input.dataPackageGb, ...(input.metadata ?? {}) },
          })
          .returning();
        return created;
      }

      // guide_addon -- merge to a single line per parent activity, always qty 1.
      const act = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, input.parentActivityId),
      });
      if (!act) throw new TRPCError({ code: "NOT_FOUND" });
      const guidePrice = act.guideAddonVnd ?? 0;
      if (guidePrice <= 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This activity has no guide add-on" });
      }

      const [existingAddon] = await ctx.db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, ctx.user.id),
            eq(cartItems.kind, "guide_addon"),
            eq(cartItems.parentActivityId, input.parentActivityId),
          ),
        )
        .limit(1);

      if (existingAddon) {
        // Already added -- keep qty pinned at 1, just touch updatedAt so
        // the cart reflects "just added" ordering.
        const [updated] = await ctx.db
          .update(cartItems)
          .set({ quantity: 1, updatedAt: new Date() })
          .where(eq(cartItems.id, existingAddon.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(cartItems)
        .values({
          userId: ctx.user.id,
          kind: "guide_addon",
          parentActivityId: input.parentActivityId,
          quantity: 1,
          priceSnapshotVnd: guidePrice,
          metadata: { activityTitle: act.title },
        })
        .returning();
      return created;
    }),

  updateQuantity: protectedProcedure
    .input(z.object({ cartItemId: z.string().uuid(), quantity: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.id, input.cartItemId), eq(cartItems.userId, ctx.user.id)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // Capacity re-check for activity lines so a traveler can't silently
      // over-book a slot that partly sold out since they added it.
      if (row.kind === "activity" && row.activitySlotId) {
        const slot = await ctx.db.query.activitySlots.findFirst({
          where: eq(activitySlots.id, row.activitySlotId),
        });
        if (!slot) throw new TRPCError({ code: "NOT_FOUND" });
        if (slot.bookedCount + input.quantity > slot.capacity) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not enough seats" });
        }
      }

      const [updated] = await ctx.db
        .update(cartItems)
        .set({ quantity: input.quantity, updatedAt: new Date() })
        .where(eq(cartItems.id, input.cartItemId))
        .returning();
      return updated;
    }),

  remove: protectedProcedure
    .input(z.object({ cartItemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(cartItems)
        .where(and(eq(cartItems.id, input.cartItemId), eq(cartItems.userId, ctx.user.id)));
      return { ok: true };
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(cartItems).where(eq(cartItems.userId, ctx.user.id));
    return { ok: true };
  }),

  // Fast unread-like counter for the top-nav cart icon.
  getCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ count: sql<string>`count(*)::text` })
      .from(cartItems)
      .where(eq(cartItems.userId, ctx.user.id));
    return Number(row?.count ?? 0);
  }),
});
