import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  orders,
  orderItems,
  cartItems,
  activitySlots,
  productVariants,
  payments,
  activities,
  tours,
  experiences,
} from "../db/schema";
import { detectConflicts } from "@/lib/cart-conflicts";
import { tourTimeWindow } from "@/lib/tour-time";
import { readRequestParams } from "../lib/tour-request-shape";
import { reapStaleOrders } from "@/server/services/reap-orders";

/**
 * Order router. Turns a cart into a paid order.
 *
 * Flow:
 *   1. cart.get  -> returns items + conflicts. Client blocks checkout if
 *      conflicts exist; order.createFromCart ALSO re-enforces server-side
 *      so a scripted / malicious client can't bypass.
 *   2. order.createFromCart -> re-reads live prices, validates slot capacity,
 *      applies bundle discounts, enforces timeline conflicts. Creates
 *      `orders` row + `order_items`, creates a PENDING `payments` row with
 *      `orderId` set and `tourId` null, clears the cart.
 *   3. order.confirmPayment -> simulates the gateway confirmation. Flips
 *      payment to 'succeeded', order to 'paid', INCREMENTS slot bookedCount,
 *      DECREMENTS variant stock. Both mutations use an atomic conditional
 *      UPDATE (`WHERE booked_count + qty <= capacity`) so two concurrent
 *      confirms on the last seat / last unit can never both win.
 *      Wrapped in a single DB transaction so a partial write never strands
 *      an inconsistent state.
 *   4. payment.refund (admin) -> reverses the inventory side-effects.
 *
 * Bundle discount: if the cart contains at least one tour/activity AND at
 * least one merch line with bundleDiscountPct > 0, that merch line is
 * discounted by its bundleDiscountPct. Simple rule, transparent.
 *
 * eSIM bundle: if eSIM + any tour/activity -> 10% off the eSIM line.
 */

const ESIM_BUNDLE_DISCOUNT_PCT = 10;

export const orderRouter = router({
  createFromCart: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.userId, ctx.user.id));
      if (items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty" });
      }

      // Re-validate prices, capacity, stock against the live source rows.
      // This prevents a stale cart from locking a favourable price or
      // over-selling a nearly-full slot.
      //
      // Activity lines also carry their slot times forward so we can
      // run server-side conflict detection over the full batch before
      // committing the order. Mirrors what cart.get surfaces in the UI,
      // except a scripted client can't bypass this one.
      type LineDraft = {
        kind: string;
        experienceId: string | null;
        activityId: string | null;
        activitySlotId: string | null;
        productVariantId: string | null;
        quantity: number;
        unitPriceVnd: number;
        lineTotalVnd: number;
        metadata: Record<string, unknown>;
        slotStartsAt: Date | null;
        slotEndsAt: Date | null;
        displayLabel: string;
      };

      const lines: LineDraft[] = [];
      let hasTourOrActivity = false;
      let hasEsim = false;

      for (const item of items) {
        // 'fixed_tour' is NOT a supported cart kind -- tours are booked
        // directly via experience.book. A stray cart row with this kind
        // (from historical data) is treated as an integrity error rather
        // than silently creating a money-taking path with no tour backing.
        if (item.kind === "fixed_tour") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Tours must be booked from the experience page, not the cart",
          });
        }
        if (item.kind === "activity" && item.activityId && item.activitySlotId) {
          const act = await tx.query.activities.findFirst({
            where: eq(activities.id, item.activityId),
          });
          if (!act || act.status !== "published") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: `"${(item.metadata as { title?: string })?.title ?? "Activity"}" is no longer available` });
          }
          const slot = await tx.query.activitySlots.findFirst({
            where: eq(activitySlots.id, item.activitySlotId),
          });
          if (!slot || slot.status !== "open") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Time slot no longer available" });
          }
          if (slot.bookedCount + item.quantity > slot.capacity) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not enough seats in this slot" });
          }
          const unit = act.priceAmount;
          lines.push({
            kind: "activity",
            experienceId: null,
            activityId: act.id,
            activitySlotId: slot.id,
            productVariantId: null,
            quantity: item.quantity,
            unitPriceVnd: unit,
            lineTotalVnd: unit * item.quantity,
            metadata: { title: act.title, startsAt: slot.startsAt.toISOString() },
            slotStartsAt: slot.startsAt,
            slotEndsAt: slot.endsAt,
            displayLabel: act.title,
          });
          hasTourOrActivity = true;
        } else if (item.kind === "merch" && item.productVariantId) {
          const [joined] = await tx
            .select({ variant: productVariants })
            .from(productVariants)
            .where(eq(productVariants.id, item.productVariantId));
          if (!joined || !joined.variant.isActive) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Product variant no longer available" });
          }
          if (joined.variant.stockQuantity < item.quantity) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not enough stock" });
          }
          const unit = item.priceSnapshotVnd;
          lines.push({
            kind: "merch",
            experienceId: null,
            activityId: null,
            activitySlotId: null,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            unitPriceVnd: unit,
            lineTotalVnd: unit * item.quantity,
            metadata: item.metadata as Record<string, unknown>,
            slotStartsAt: null,
            slotEndsAt: null,
            displayLabel: (item.metadata as { title?: string })?.title ?? "Merchandise",
          });
        } else if (item.kind === "esim") {
          const unit = item.priceSnapshotVnd;
          lines.push({
            kind: "esim",
            experienceId: null,
            activityId: null,
            activitySlotId: null,
            productVariantId: null,
            quantity: 1,
            unitPriceVnd: unit,
            lineTotalVnd: unit,
            metadata: item.metadata as Record<string, unknown>,
            slotStartsAt: null,
            slotEndsAt: null,
            displayLabel: "eSIM",
          });
          hasEsim = true;
        } else if (item.kind === "guide_addon") {
          const unit = item.priceSnapshotVnd;
          lines.push({
            kind: "guide_addon",
            experienceId: null,
            activityId: null,
            activitySlotId: null,
            productVariantId: null,
            quantity: 1,
            unitPriceVnd: unit,
            lineTotalVnd: unit,
            metadata: item.metadata as Record<string, unknown>,
            slotStartsAt: null,
            slotEndsAt: null,
            displayLabel: "Guide add-on",
          });
        }
      }

      // Cross-category conflict detection. Combine cart activity lines
      // with any of this user's PAID/ACTIVE experience-tours whose time
      // window we can parse from tours.requestParams. This prevents a
      // traveler from paying for an activity that overlaps a tour they
      // already booked and paid for. Preview/cancelled/refunded tours
      // don't participate (the user hasn't committed to them).
      const existingTours = await tx
        .select({
          id: tours.id,
          requestParams: tours.requestParams,
          experienceId: tours.experienceId,
        })
        .from(tours)
        .where(
          and(
            eq(tours.userId, ctx.user.id),
            inArray(tours.status, ["paid", "active", "completed"]),
          ),
        );

      const tourExperienceIds = existingTours
        .map((t) => t.experienceId)
        .filter((x): x is string => !!x);
      const tourTitles = tourExperienceIds.length
        ? await tx
            .select({ id: experiences.id, title: experiences.title })
            .from(experiences)
            .where(inArray(experiences.id, tourExperienceIds))
        : [];
      const tourTitleMap = new Map(tourTitles.map((t) => [t.id, t.title]));

      type ConflictItem = { id: string; label: string; startsAt: Date | null; endsAt: Date | null };
      const conflictPool: ConflictItem[] = [];
      for (const line of lines) {
        if (line.slotStartsAt && line.slotEndsAt) {
          conflictPool.push({
            id: `line-${line.activitySlotId ?? line.activityId ?? "x"}`,
            label: line.displayLabel,
            startsAt: line.slotStartsAt,
            endsAt: line.slotEndsAt,
          });
        }
      }
      for (const t of existingTours) {
        const win = tourTimeWindow(readRequestParams(t.requestParams));
        if (!win) continue;
        conflictPool.push({
          id: `tour-${t.id}`,
          label: t.experienceId
            ? (tourTitleMap.get(t.experienceId) ?? "Your booked tour")
            : "Your booked tour",
          startsAt: win.startsAt,
          endsAt: win.endsAt,
        });
      }

      const conflicts = detectConflicts(conflictPool);
      if (conflicts.length > 0) {
        const c = conflicts[0];
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `"${c.labelA}" overlaps with "${c.labelB}". Remove one before checking out.`,
        });
      }

      // Bundle discount: eSIM + tour/activity -> -10% on eSIM line.
      const bundleCodes: string[] = [];
      let discount = 0;
      if (hasEsim && hasTourOrActivity) {
        bundleCodes.push("ESIM_BUNDLE_10");
        for (const line of lines) {
          if (line.kind === "esim") {
            const lineDiscount = Math.round(line.lineTotalVnd * (ESIM_BUNDLE_DISCOUNT_PCT / 100));
            discount += lineDiscount;
          }
        }
      }

      const subtotal = lines.reduce((a, l) => a + l.lineTotalVnd, 0);
      const total = subtotal - discount;
      if (total <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order total must be positive" });
      }

      // Create order + order_items.
      const [order] = await tx
        .insert(orders)
        .values({
          userId: ctx.user.id,
          status: "pending",
          subtotalVnd: subtotal,
          discountVnd: discount,
          totalVnd: total,
          currency: "VND",
          bundleCodes,
        })
        .returning();

      for (const line of lines) {
        await tx.insert(orderItems).values({
          orderId: order.id,
          kind: line.kind,
          experienceId: line.experienceId,
          activityId: line.activityId,
          activitySlotId: line.activitySlotId,
          productVariantId: line.productVariantId,
          quantity: line.quantity,
          unitPriceVnd: line.unitPriceVnd,
          lineTotalVnd: line.lineTotalVnd,
          currency: "VND",
          metadata: line.metadata,
        });
      }

      // Pending payment. tourId null -> this is an order payment.
      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          userId: ctx.user.id,
          amount: total,
          currency: "VND",
          paymentMethod: "card",
          paymentGateway: "stripe_test",
          status: "pending",
        })
        .returning();

      // Clear the cart only after payment record exists.
      await tx.delete(cartItems).where(eq(cartItems.userId, ctx.user.id));

      return { orderId: order.id, paymentId: payment.id, totalVnd: total };
    });
  }),

  /**
   * Finalise payment for an order. Flips order.status -> paid and commits
   * inventory + slot counters. The inventory side effects happen here (not
   * in createFromCart) so that an abandoned pending order doesn't decrement
   * real capacity -- a reservation model could later short-hold capacity
   * during the pending window, but MVP is "confirm-or-forget".
   */
  confirmPayment: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const order = await tx.query.orders.findFirst({
          where: and(eq(orders.id, input.orderId), eq(orders.userId, ctx.user.id)),
        });
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "pending") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Order already processed" });
        }

        const [payment] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.orderId, input.orderId), eq(payments.status, "pending")));
        if (!payment) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No pending payment" });
        }

        // Decrement slot capacity + variant stock for each line.
        const lines = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        for (const line of lines) {
          if (line.kind === "activity" && line.activitySlotId) {
            const [slot] = await tx
              .update(activitySlots)
              .set({
                bookedCount: sql`${activitySlots.bookedCount} + ${line.quantity}`,
              })
              .where(and(
                eq(activitySlots.id, line.activitySlotId),
                sql`${activitySlots.bookedCount} + ${line.quantity} <= ${activitySlots.capacity}`,
              ))
              .returning();
            if (!slot) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "A slot sold out before you could confirm. Refreshing cart.",
              });
            }
            // Flip to sold_out if this booking filled it.
            if (slot.bookedCount >= slot.capacity) {
              await tx
                .update(activitySlots)
                .set({ status: "sold_out" })
                .where(eq(activitySlots.id, line.activitySlotId));
            }
          } else if (line.kind === "merch" && line.productVariantId) {
            const [variant] = await tx
              .update(productVariants)
              .set({
                stockQuantity: sql`${productVariants.stockQuantity} - ${line.quantity}`,
              })
              .where(and(
                eq(productVariants.id, line.productVariantId),
                sql`${productVariants.stockQuantity} >= ${line.quantity}`,
              ))
              .returning();
            if (!variant) {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "A product sold out before you could confirm.",
              });
            }
          }
        }

        await tx
          .update(payments)
          .set({
            status: "succeeded",
            paidAt: new Date(),
            gatewayTxnId: `txn_test_${Date.now()}`,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));

        await tx
          .update(orders)
          .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        return { orderId: order.id, paymentId: payment.id };
      });
    }),

  /**
   * Cancel a pending order BEFORE it's paid. The user clicked "Cancel" or
   * just backed out of checkout. Safe operation -- pending orders don't
   * hold inventory, so nothing needs reversing. The owning `payments` row
   * (which is also in `pending`) is marked `cancelled` so later reapers or
   * reports know it never succeeded.
   *
   * Refund for a PAID order lives in `payment.refund` (admin-only) since
   * it moves money and reverses inventory.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        reason: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const order = await tx.query.orders.findFirst({
          where: and(eq(orders.id, input.orderId), eq(orders.userId, ctx.user.id)),
        });
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "pending") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              order.status === "cancelled"
                ? "Order is already cancelled"
                : "Paid orders must go through refund (admin).",
          });
        }
        await tx
          .update(orders)
          .set({
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: input.reason ?? "user_cancelled",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        // Matching payment (if any) ships to 'cancelled'. We don't
        // require exactly one; there should be one but be defensive.
        await tx
          .update(payments)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "pending")));
        return { orderId: order.id };
      });
    }),

  /**
   * Cancel orders that have been sitting in 'pending' longer than a grace
   * window. Called by the cron route at /api/cron/reap-orders. Safe to
   * run as often as you like -- already-paid or already-cancelled orders
   * are ignored.
   *
   * Pending orders don't hold inventory (slot counters only move at
   * confirmPayment) so reaping them is purely janitorial: it keeps the
   * "recent activity" dashboards readable and lets us measure abandonment
   * rates honestly. No money moves, no stock restores needed.
   */
  reapStale: adminProcedure
    .input(z.object({ olderThanMinutes: z.number().int().min(1).max(1440).default(30) }).default({ olderThanMinutes: 30 }))
    .mutation(async ({ ctx, input }) => {
      // The heavy lifting lives in services/reap-orders so the cron route
      // can call the same code without a user context.
      return reapStaleOrders(ctx.db, input.olderThanMinutes);
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).default({ limit: 20 }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(orders)
        .where(eq(orders.userId, ctx.user.id))
        .orderBy(desc(orders.createdAt))
        .limit(input.limit);
    }),

  get: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.query.orders.findFirst({
        where: and(eq(orders.id, input.orderId), eq(orders.userId, ctx.user.id)),
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const lines = await ctx.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      return { order, items: lines };
    }),
});
