import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { emergencyContacts } from "../../db/schema";

export const userEmergencyProcedures = {
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

  updateEmergencyContact: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      phone: z.string().min(5).max(20),
      relationship: z.string().max(50).optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(emergencyContacts)
        .set(data)
        .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, ctx.user.id)))
        .returning();
      return updated;
    }),

  deleteEmergencyContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(emergencyContacts)
        .where(and(eq(emergencyContacts.id, input.id), eq(emergencyContacts.userId, ctx.user.id)));
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
