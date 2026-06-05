import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { hostProcedure } from "../../trpc";
import { hostProfiles, hostAvailability } from "../../db/schema";

export const hostAvailabilityProcedures = {
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

  // Narrow mutation for the "Accepting Requests" switch on the dashboard.
  // Distinct from `setAvailability(slots)` which replaces the day-of-week
  // schedule; this only flips the boolean.
  setAvailable: hostProcedure
    .input(z.object({ isAvailable: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({ isAvailable: input.isAvailable, updatedAt: new Date() })
        .where(eq(hostProfiles.userId, ctx.user.id))
        .returning({ isAvailable: hostProfiles.isAvailable });
      if (!updated) {
        // Role is host but no hostProfiles row yet -- onboarding not done.
        // PRECONDITION_FAILED keeps this out of INTERNAL_SERVER_ERROR buckets
        // in error-monitoring; it's a recoverable user-state issue.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Host profile not found. Complete host setup first.",
        });
      }
      return { isAvailable: updated.isAvailable };
    }),
} satisfies TRPCRouterRecord;
