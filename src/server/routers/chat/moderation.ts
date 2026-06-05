import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { messages, messageReports, userBlocks, users } from "../../db/schema";
import { verifyMatchParticipant, isUniqueViolation } from "./shared";

export const chatModerationProcedures = {
  reportMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        reason: z.enum([
          "harassment",
          "spam",
          "inappropriate",
          "scam",
          "off_platform",
          "other",
        ]),
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyMatchParticipant(ctx.db, msg.matchId, ctx.user.id);

      await ctx.db.insert(messageReports).values({
        messageId: input.messageId,
        reporterId: ctx.user.id,
        reason: input.reason,
        notes: input.notes ?? null,
      });
      // Also flip the message's flag so admin review surfaces it.
      await ctx.db
        .update(messages)
        .set({ flagged: true, flagReason: input.reason })
        .where(eq(messages.id, input.messageId));

      return { success: true };
    }),

  blockUser: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot block yourself" });
      }
      try {
        await ctx.db.insert(userBlocks).values({
          blockerId: ctx.user.id,
          blockedId: input.userId,
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
      return { success: true };
    }),

  unblockUser: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userBlocks)
        .where(and(
          eq(userBlocks.blockerId, ctx.user.id),
          eq(userBlocks.blockedId, input.userId),
        ));
      return { success: true };
    }),

  getBlocked: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        blockedAt: userBlocks.createdAt,
      })
      .from(userBlocks)
      .innerJoin(users, eq(userBlocks.blockedId, users.id))
      .where(eq(userBlocks.blockerId, ctx.user.id))
      .orderBy(desc(userBlocks.createdAt));
  }),
} satisfies TRPCRouterRecord;
