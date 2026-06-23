import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { db as prodDb } from "../db";
import {
  activitySlots,
  coupons,
  experiences,
  fixedTours,
  orderItems,
  orders,
  payments,
  productVariants,
  tours,
} from "../db/schema";

type AppDb = typeof prodDb;

export type PaymentFinalizationResult = {
  success: true;
  paymentId: string;
  tourId?: string | null;
  orderId?: string | null;
  alreadyProcessed: boolean;
};

async function ensureTourStillAvailable(db: AppDb, tourId: string) {
  const tour = await db.query.tours.findFirst({
    where: eq(tours.id, tourId),
  });
  if (!tour) throw new TRPCError({ code: "NOT_FOUND" });

  if (tour.experienceId) {
    const exp = await db.query.experiences.findFirst({
      where: eq(experiences.id, tour.experienceId),
    });
    if (!exp || exp.status !== "published") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This experience is no longer available. Please book another.",
      });
    }
  } else if (tour.fixedTourId) {
    const ft = await db.query.fixedTours.findFirst({
      where: eq(fixedTours.tourId, tour.fixedTourId),
    });
    if (!ft || !ft.isActive) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This Fixed Tour is no longer available. Please book another.",
      });
    }
  }

  return tour;
}

async function finishTourPayment(
  db: AppDb,
  paymentId: string,
  tourId: string,
  gatewayTxnId: string,
): Promise<PaymentFinalizationResult> {
  await ensureTourStillAvailable(db, tourId);

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(payments)
      .set({
        status: "succeeded",
        gatewayTxnId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning();

    if (updated.length === 0) {
      const latest = await tx.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      });
      if (latest?.status === "succeeded") {
        return {
          success: true,
          paymentId,
          tourId: latest.tourId,
          alreadyProcessed: true,
        };
      }
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Payment already processed",
      });
    }

    const [tour] = await tx
      .update(tours)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(tours.id, tourId))
      .returning({
        id: tours.id,
        experienceId: tours.experienceId,
      });
    if (!tour) throw new TRPCError({ code: "NOT_FOUND" });

    if (updated[0].appliedCouponId) {
      const redeemed = await tx
        .update(coupons)
        .set({
          redeemedAt: new Date(),
          redeemedTourId: tourId,
        })
        .where(
          and(
            eq(coupons.id, updated[0].appliedCouponId),
            isNull(coupons.redeemedAt),
          ),
        )
        .returning({ id: coupons.id });
      if (redeemed.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "coupon:REDEEMED_CONCURRENTLY",
        });
      }
    }

    if (tour.experienceId) {
      await tx
        .update(experiences)
        .set({ totalBookings: sql`${experiences.totalBookings} + 1` })
        .where(eq(experiences.id, tour.experienceId));
    }

    return { success: true, paymentId, tourId, alreadyProcessed: false };
  });
}

async function finishOrderPayment(
  db: AppDb,
  paymentId: string,
  orderId: string,
  gatewayTxnId: string,
): Promise<PaymentFinalizationResult> {
  return db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });

    const updated = await tx
      .update(payments)
      .set({
        status: "succeeded",
        paidAt: new Date(),
        gatewayTxnId,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning();

    if (updated.length === 0) {
      const latest = await tx.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      });
      if (latest?.status === "succeeded" || order.status === "paid") {
        return {
          success: true,
          paymentId,
          orderId,
          alreadyProcessed: true,
        };
      }
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Payment already processed",
      });
    }

    if (order.status !== "pending") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Order already processed",
      });
    }

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
          .where(
            and(
              eq(activitySlots.id, line.activitySlotId),
              sql`${activitySlots.bookedCount} + ${line.quantity} <= ${activitySlots.capacity}`,
            ),
          )
          .returning();
        if (!slot) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A slot sold out before you could confirm. Refreshing cart.",
          });
        }
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
          .where(
            and(
              eq(productVariants.id, line.productVariantId),
              sql`${productVariants.stockQuantity} >= ${line.quantity}`,
            ),
          )
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
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    return { success: true, paymentId, orderId, alreadyProcessed: false };
  });
}

export async function finalizeSucceededPayment(
  db: AppDb,
  paymentId: string,
  gatewayTxnId: string,
): Promise<PaymentFinalizationResult> {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
  if (payment.gatewayTxnId && payment.gatewayTxnId !== gatewayTxnId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Provider intent mismatch for payment",
    });
  }
  if (payment.status === "succeeded") {
    return {
      success: true,
      paymentId,
      tourId: payment.tourId,
      orderId: payment.orderId,
      alreadyProcessed: true,
    };
  }
  if (payment.status !== "pending") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Payment already processed",
    });
  }
  if (payment.tourId) {
    return finishTourPayment(db, payment.id, payment.tourId, gatewayTxnId);
  }
  if (payment.orderId) {
    return finishOrderPayment(db, payment.id, payment.orderId, gatewayTxnId);
  }
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Payment is not linked to an order or tour",
  });
}

export async function markProviderPaymentFailed(db: AppDb, paymentId: string) {
  const [updated] = await db
    .update(payments)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
    .returning({ id: payments.id });
  return { paymentId, updated: Boolean(updated) };
}
