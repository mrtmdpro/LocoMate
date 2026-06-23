import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  payments,
  tours,
  experiences,
  orders,
  orderItems,
  activitySlots,
  productVariants,
  coupons,
} from "../db/schema";
import { rateLimit } from "../services/chat-ratelimit";
import { getPaymentProvider } from "../services/payment-gateway";
import { finalizeSucceededPayment } from "../services/payment-finalization";
import { TOUR_PRICING } from "@/lib/pricing";
import { COUPON_CODE_REGEX } from "@/lib/coupon-format";

export const paymentRouter = router({
  createIntent: protectedProcedure
    .input(
      z.object({
        tourId: z.string().uuid(),
        paymentMethod: z.enum(["card", "qr"]),
        // Optional wrap-up coupon code applied at /checkout. The
        // validation re-runs here server-side; the client's preview
        // from `coupon.validate.useQuery` is advisory only — never
        // trust client-computed prices.
        couponCode: z
          .string()
          .regex(COUPON_CODE_REGEX, "Invalid coupon code format")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });
      if (tour.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });

      // Server-authoritative price. Start at the tour's persisted
      // priceAmount; apply the coupon discount if a code was supplied.
      // We do NOT mark the coupon redeemed here — that flip is the
      // atomic UPDATE inside `confirm()` so a cancelled checkout never
      // burns the code.
      let amount = tour.priceAmount;
      let appliedCouponId: string | null = null;

      if (input.couponCode) {
        if (!tour.priceAmount || tour.priceAmount <= 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "coupon:TOUR_PRICE_ZERO",
          });
        }
        const coupon = await ctx.db.query.coupons.findFirst({
          where: eq(coupons.code, input.couponCode),
        });
        if (!coupon)
          throw new TRPCError({ code: "BAD_REQUEST", message: "coupon:NOT_FOUND" });
        if (coupon.recipientUserId !== ctx.user.id)
          throw new TRPCError({ code: "FORBIDDEN", message: "coupon:NOT_YOURS" });
        if (coupon.redeemedAt)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "coupon:ALREADY_REDEEMED",
          });
        if (coupon.expiresAt.getTime() <= Date.now())
          throw new TRPCError({ code: "BAD_REQUEST", message: "coupon:EXPIRED" });
        amount = Math.floor((amount * (100 - coupon.discountPct)) / 100);
        appliedCouponId = coupon.id;
      }

      return ctx.db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            tourId: input.tourId,
            userId: ctx.user.id,
            amount,
            currency: TOUR_PRICING.currency,
            paymentMethod: input.paymentMethod,
            paymentGateway: "stripe",
            status: "pending",
            appliedCouponId,
          })
          .returning();

        const providerIntent = await getPaymentProvider().createPaymentIntent({
          amount,
          currency: TOUR_PRICING.currency,
          description: `LocoMate tour ${input.tourId}`,
          idempotencyKey: `tour-payment:${payment.id}`,
          metadata: {
            kind: "tour",
            paymentId: payment.id,
            tourId: input.tourId,
            userId: ctx.user.id,
          },
        });
        if (!providerIntent.clientSecret) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Payment provider did not return a client secret",
          });
        }

        await tx
          .update(payments)
          .set({
            gatewayTxnId: providerIntent.id,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));

        return {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          clientSecret: providerIntent.clientSecret,
          appliedCouponId,
        };
      });
    }),

  confirm: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await rateLimit({
        key: `payment:confirm:${ctx.user.id}`,
        limit: 20,
        windowSec: 60,
      });
      const payment = await ctx.db.query.payments.findFirst({
        where: eq(payments.id, input.paymentId),
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
      if (payment.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your payment" });
      if (payment.status !== "pending") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment cannot be confirmed" });

      // Legacy tour-based payments only. Post-pivot, multi-line order
      // payments use payment.orderId and a different confirm path
      // (order.router.confirmPayment); see src/server/routers/order.router.ts.
      if (!payment.tourId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Use order.confirmPayment for order-based payments",
        });
      }
      if (!payment.gatewayTxnId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payment is missing a provider intent",
        });
      }
      const providerIntent = await getPaymentProvider().retrievePaymentIntent(
        payment.gatewayTxnId,
      );
      if (providerIntent.status !== "succeeded") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Provider payment has not succeeded",
        });
      }

      const finalized = await finalizeSucceededPayment(
        ctx.db,
        input.paymentId,
        providerIntent.id,
      );
      return { success: true, tourId: finalized.tourId };
    }),

  /**
   * Refund a succeeded payment. Reverses the inventory side-effects
   * committed at confirmation time so the slot / product / experience
   * counters stay honest. Admin-only for MVP; there is no in-app
   * "traveler requests refund" flow.
   *
   * Transactional. For order-linked payments we iterate the
   * `order_items` and:
   *   - activity line -> decrement activity_slots.booked_count, flip
   *     status back to 'open' if it had been auto-marked 'sold_out'.
   *   - merch line    -> increment product_variants.stock_quantity.
   *   - esim / guide_addon -> nothing to reverse.
   * For legacy tour-linked payments we flip the tour to 'refunded' and
   * decrement the experience's public totalBookings so the marketplace
   * ranking forgets it.
   *
   * Idempotent: already-refunded payments are rejected loudly so
   * accidental double-submits don't double-restore stock.
   */
  refund: adminProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
        reason: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const payment = await tx.query.payments.findFirst({
          where: eq(payments.id, input.paymentId),
        });
        if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
        if (payment.status !== "succeeded") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              payment.status === "refunded"
                ? "Payment is already refunded"
                : "Only succeeded payments can be refunded",
          });
        }

        if (payment.orderId) {
          // Multi-line order path: reverse each activity + merch line.
          const lines = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, payment.orderId));
          for (const line of lines) {
            if (line.kind === "activity" && line.activitySlotId) {
              // Drop the seat count AND re-open the slot in case the
              // original booking had filled it. The CHECK constraint
              // (booked_count >= 0) catches any accounting bug here.
              await tx
                .update(activitySlots)
                .set({
                  bookedCount: sql`GREATEST(${activitySlots.bookedCount} - ${line.quantity}, 0)`,
                  status: "open",
                })
                .where(eq(activitySlots.id, line.activitySlotId));
            } else if (line.kind === "merch" && line.productVariantId) {
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: sql`${productVariants.stockQuantity} + ${line.quantity}`,
                })
                .where(eq(productVariants.id, line.productVariantId));
            }
            // esim / guide_addon / fixed_tour-legacy: nothing to restore.
          }
          await tx
            .update(orders)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(eq(orders.id, payment.orderId));
        } else if (payment.tourId) {
          // Legacy tour-linked payment. Flip the tour status, and if the
          // tour was an experience booking, decrement the listing's
          // public booking counter so marketplace ranking forgets it.
          const [tour] = await tx
            .update(tours)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(eq(tours.id, payment.tourId))
            .returning({ id: tours.id, experienceId: tours.experienceId });
          if (tour?.experienceId) {
            await tx
              .update(experiences)
              .set({
                totalBookings: sql`GREATEST(${experiences.totalBookings} - 1, 0)`,
              })
              .where(eq(experiences.id, tour.experienceId));
          }
        } else {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Payment is not linked to an order or tour",
          });
        }

        await tx
          .update(payments)
          .set({
            status: "refunded",
            refundAmount: payment.amount,
            refundReason: input.reason ?? "admin_refund",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));

        return { paymentId: payment.id, refundedVnd: payment.amount };
      });
    }),

  // Returns the signed-in user's payment records, newest first. The payments
  // page was previously iterating `tour.getHistory` and hardcoding
  // `isRefunded = false` for every row; this procedure surfaces the real
  // `status` + `refundAmount` from the `payments` table so refunded / failed /
  // pending rows render honestly.
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        refundAmount: payments.refundAmount,
        refundReason: payments.refundReason,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        paymentMethod: payments.paymentMethod,
        tourId: payments.tourId,
        tourTitle: sql<string | null>`${tours.tourData}->>'title'`,
        packageType: tours.packageType,
      })
      .from(payments)
      .leftJoin(tours, eq(payments.tourId, tours.id))
      .where(eq(payments.userId, ctx.user.id))
      .orderBy(desc(payments.createdAt));
  }),

  /* ──────────────────────────────────────────────────────────────────
   *  Crossover Δ-payment plumbing (MOCK MODE)
   *
   *  `refundPartial` is the lower-level lever — admin-gated so it can
   *  service ANY partial refund (Δ < 0 escrows, customer-service
   *  one-offs, support tickets). The escrow-flip itself lives on
   *  `crossover.refundEscrowDelta` / `crossover.confirmEscrowDelta`
   *  because the chat-surface UI calls it once both parties have
   *  agreed to a merged itinerary; those procedures wrap the same
   *  underlying state transition but with party-not-admin auth.
   *
   *  Phase C will swap the body of all three for real Stripe calls
   *  (Payment Intent confirmation for Δ > 0, partial refund for Δ < 0).
   *  The router signatures stay identical so the in-chat Payment
   *  Element doesn't need a rewrite — only the server-side body changes.
   * ────────────────────────────────────────────────────────────── */

  /**
   * MOCK partial refund. Bumps the original payment's `refund_amount`
   * by `amount`. No Stripe call. Phase C will hit
   * `stripe.refunds.create({ amount })`.
   *
   * Admin-only because in Phase B/C the refund decision is automated
   * (Δ < 0 → refund). Manual invocation should be rare and audited.
   */
  refundPartial: adminProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
        amount: z.number().int().positive(),
        reason: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.query.payments.findFirst({
        where: eq(payments.id, input.paymentId),
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });

      const existingRefund = payment.refundAmount ?? 0;
      if (existingRefund + input.amount > payment.amount) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Refund would exceed the original charge.",
        });
      }

      // MOCK MODE — real Stripe partial refund goes here in Phase C.
      await ctx.db
        .update(payments)
        .set({
          refundAmount: existingRefund + input.amount,
          refundReason: input.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      return { success: true, refundedTotal: existingRefund + input.amount };
    }),
});
