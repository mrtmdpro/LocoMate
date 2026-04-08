import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure, hostProcedure } from "../trpc";
import { hostProfiles, hostAvailability, tours, users } from "../db/schema";

export const hostRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
  }),

  updateProfile: hostProcedure
    .input(z.object({
      bio: z.string().max(300).optional(),
      languages: z.array(z.string()).optional(),
      specialties: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(hostProfiles.userId, ctx.user.id))
        .returning();
      return updated;
    }),

  setAvailability: hostProcedure
    .input(z.object({
      slots: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        isActive: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return;

      await ctx.db.delete(hostAvailability).where(eq(hostAvailability.hostId, host.id));

      for (const slot of input.slots) {
        await ctx.db.insert(hostAvailability).values({ hostId: host.id, ...slot });
      }
      return { success: true };
    }),

  getBookings: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    return ctx.db
      .select()
      .from(tours)
      .where(and(eq(tours.hostId, host.id)));
  }),

  getAvailableHosts: protectedProcedure
    .input(z.object({ interests: z.array(z.string()).optional() }))
    .query(async ({ ctx }) => {
      const hosts = await ctx.db
        .select({
          id: hostProfiles.id,
          userId: hostProfiles.userId,
          bio: hostProfiles.bio,
          languages: hostProfiles.languages,
          specialties: hostProfiles.specialties,
          avgRating: hostProfiles.avgRating,
          totalReviews: hostProfiles.totalReviews,
          totalTours: hostProfiles.totalTours,
          verificationStatus: hostProfiles.verificationStatus,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(hostProfiles)
        .innerJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(
          eq(hostProfiles.isAvailable, true),
          eq(hostProfiles.verificationStatus, "approved")
        ));

      return hosts;
    }),
});
