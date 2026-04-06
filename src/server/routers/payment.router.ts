import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { payments, tours } from "../db/schema";

export const paymentRouter = router({
  createIntent: protectedProcedure
    .input(z.object({ tourId: z.string().uuid(), paymentMethod: z.enum(["card", "qr"]) }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });

      const [payment] = await ctx.db
        .insert(payments)
        .values({
          tourId: input.tourId,
          userId: ctx.user.id,
          amount: tour.priceAmount,
          currency: "VND",
          paymentMethod: input.paymentMethod,
          paymentGateway: "stripe_test",
          status: "pending",
        })
        .returning();

      return {
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        clientSecret: `pi_test_${payment.id.slice(0, 8)}_secret`,
      };
    }),

  confirm: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.query.payments.findFirst({
        where: eq(payments.id, input.paymentId),
      });
      if (!payment) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(payments)
        .set({
          status: "succeeded",
          gatewayTxnId: `txn_test_${Date.now()}`,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, input.paymentId));

      await ctx.db
        .update(tours)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(tours.id, payment.tourId));

      return { success: true, tourId: payment.tourId };
    }),
});
