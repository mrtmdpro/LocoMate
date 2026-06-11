import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { reviews, tours, hostProfiles } from "../db/schema";

export const reviewRouter = router({
  submitTourReview: protectedProcedure
    .input(z.object({
      tourId: z.string().uuid(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(500).optional(),
      // FR-POST-04 — optional photos (max 3). The reviews.photos text[] column
      // already exists; the uploader UI is a follow-up but the contract is
      // complete so a future client can attach field photos.
      photos: z.array(z.string().url()).max(3).optional(),
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

      return ctx.db.transaction(async (tx) => {
        const [review] = await tx
          .insert(reviews)
          .values({
            reviewerId: ctx.user.id,
            targetType: "tour",
            targetId: input.tourId,
            rating: input.rating,
            comment: input.comment || null,
            photos: input.photos ?? [],
          })
          .returning();

        // A tour review IS a review of the guide who led it. Recompute the
        // host's public rating from every review of their tours so the host
        // dashboard tile + the /hosts directory sort reflect reality (nothing
        // wrote hostProfiles.avgRating before). Hosts whose avg dips below 3.5
        // after >= 5 reviews are surfaceable via that threshold (derived; see
        // host.adminListFlaggedHosts).
        if (tour.hostId) {
          const [agg] = await tx
            .select({
              avg: sql<string>`coalesce(avg(${reviews.rating}), 0)`,
              count: sql<number>`count(*)::int`,
            })
            .from(reviews)
            .innerJoin(tours, eq(reviews.targetId, tours.id))
            .where(and(eq(reviews.targetType, "tour"), eq(tours.hostId, tour.hostId)));

          await tx
            .update(hostProfiles)
            .set({
              avgRating: Number(agg?.avg ?? 0).toFixed(2),
              totalReviews: agg?.count ?? 0,
              updatedAt: new Date(),
            })
            .where(eq(hostProfiles.id, tour.hostId));
        }

        return review;
      });
    }),

  getTourReview: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.reviews.findFirst({
        where: and(eq(reviews.targetType, "tour"), eq(reviews.targetId, input.tourId), eq(reviews.reviewerId, ctx.user.id)),
      });
    }),
});
