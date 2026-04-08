import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { tours, tourStops, userProfiles } from "../db/schema";
import { generateTour } from "../services/tour-engine";

export const tourRouter = router({
  create: protectedProcedure
    .input(z.object({
      date: z.string(),
      startTime: z.string(),
      durationHours: z.number().min(2).max(6),
      budgetLevel: z.enum(["low", "medium", "high"]),
      interests: z.array(z.string()).min(1),
      withHost: z.boolean().default(false),
      groupSize: z.number().min(1).max(4).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });

      const tourResult = await generateTour(
        { userId: ctx.user.id, ...input },
        (profile?.derivedData as Record<string, unknown>) || {}
      );

      const [tour] = await ctx.db
        .insert(tours)
        .values({
          userId: ctx.user.id,
          status: "preview",
          requestParams: input,
          tourData: tourResult,
          packageType: tourResult.packageType,
          priceAmount: tourResult.priceAmount,
        })
        .returning();

      for (let i = 0; i < tourResult.stops.length; i++) {
        const stop = tourResult.stops[i];
        await ctx.db.insert(tourStops).values({
          tourId: tour.id,
          placeId: stop.placeId,
          stopOrder: i,
          durationMinutes: stop.durationMinutes,
          notes: stop.localTip,
        });
      }

      return tour;
    }),

  getPreview: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour || tour.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const data = tour.tourData as Record<string, unknown>;
      const allStops = (data.stops as unknown[]) || [];
      const previewStops = allStops.slice(0, 3);
      const lockedCount = allStops.length - previewStops.length;

      return {
        ...tour,
        tourData: { ...data, stops: previewStops, lockedStops: lockedCount, isPreview: true },
      };
    }),

  getFullTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour || tour.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (tour.status !== "paid" && tour.status !== "active" && tour.status !== "completed") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tour not unlocked. Please complete payment." });
      }
      return tour;
    }),

  startTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tours)
        .set({ status: "active", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(tours.id, input.tourId))
        .returning();
      return updated;
    }),

  markStopVisited: protectedProcedure
    .input(z.object({ stopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tourStops)
        .set({ visitedAt: new Date() })
        .where(eq(tourStops.id, input.stopId))
        .returning();
      return updated;
    }),

  completeTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tours)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(tours.id, input.tourId))
        .returning();
      return updated;
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tours)
      .where(eq(tours.userId, ctx.user.id))
      .orderBy(desc(tours.createdAt));
  }),
});
