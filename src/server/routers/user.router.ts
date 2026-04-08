import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { userProfiles, users, emergencyContacts } from "../db/schema";
import { onboardingSchema } from "@/lib/validations/auth";
import { computeDerivedProfile } from "../services/profile-engine";

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.user.id),
    });
    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        displayName: ctx.user.displayName,
        role: ctx.user.role,
        avatarUrl: ctx.user.avatarUrl,
      },
      profile,
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      displayName: z.string().min(2).max(100).optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  submitOnboarding: protectedProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const derived = computeDerivedProfile(input);

      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: input,
          derivedData: derived,
          onboardingCompleted: true,
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true, derived };
    }),

  getEmergencyContacts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.emergencyContacts.findMany({
      where: eq(emergencyContacts.userId, ctx.user.id),
    });
  }),

  setEmergencyContact: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      phone: z.string().min(5).max(20),
      relationship: z.string().max(50).optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [contact] = await ctx.db
        .insert(emergencyContacts)
        .values({ userId: ctx.user.id, ...input })
        .returning();
      return contact;
    }),
});
