import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { thankYouLetters } from "../../db/schema";

export const userLetterProcedures = {
  /**
   * Phase A.6 — list the user's thank-you letters. Only sent ones are
   * returned (un-sent rows are scheduled but not yet rendered). Newest
   * first.
   */
  getThankYouLetters: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(thankYouLetters)
      .where(and(
        eq(thankYouLetters.userId, ctx.user.id),
        // Sent only — `isNull` would be the inverse; we want sentAt set.
      ))
      .orderBy(desc(thankYouLetters.sentAt));
    return rows.filter((r) => r.sentAt !== null);
  }),

  /** Mark a letter as read so the bell stops badging. */
  markLetterRead: protectedProcedure
    .input(z.object({ letterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(thankYouLetters)
        .set({ readAt: new Date() })
        .where(and(
          eq(thankYouLetters.id, input.letterId),
          eq(thankYouLetters.userId, ctx.user.id),
        ));
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
