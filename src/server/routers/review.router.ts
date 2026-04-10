import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { reviews, tours } from "../db/schema";

export const reviewRouter = router({
  submitTourReview: protectedProcedure
    .input(z.object({
      tourId: z.string().uuid(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: and(eq(tours.id, input.tourId), eq(tours.userId, ctx.user.id)),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.query.reviews.findFirst({
        where: and(eq(reviews.targetType, "tour"), eq(reviews.targetId, input.tourId), eq(reviews.reviewerId, ctx.user.id)),
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already reviewed" });

      const [review] = await ctx.db
        .insert(reviews)
        .values({
          reviewerId: ctx.user.id,
          targetType: "tour",
          targetId: input.tourId,
          rating: input.rating,
          comment: input.comment || null,
        })
        .returning();

      return review;
    }),

  getTourReview: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.reviews.findFirst({
        where: and(eq(reviews.targetType, "tour"), eq(reviews.targetId, input.tourId), eq(reviews.reviewerId, ctx.user.id)),
      });
    }),
});
