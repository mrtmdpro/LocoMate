import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { messages, messageReactions } from "../../db/schema";
import { publishChatEvent } from "@/server/services/chat-pubsub";
import {
  verifyMatchParticipant,
  ALLOWED_REACTION_EMOJIS,
  MAX_REACTIONS_PER_USER_PER_MESSAGE,
  isUniqueViolation,
} from "./shared";

export const chatReactionProcedures = {
  addReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        emoji: z.string().min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_REACTION_EMOJIS.has(input.emoji)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That emoji is not available",
        });
      }
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyMatchParticipant(ctx.db, msg.matchId, ctx.user.id);

      // Cap total distinct emojis this user can pile on one message.
      const mine = await ctx.db
        .select({ id: messageReactions.id })
        .from(messageReactions)
        .where(and(
          eq(messageReactions.messageId, input.messageId),
          eq(messageReactions.userId, ctx.user.id),
        ));
      if (mine.length >= MAX_REACTIONS_PER_USER_PER_MESSAGE) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Max ${MAX_REACTIONS_PER_USER_PER_MESSAGE} reactions per message.`,
        });
      }

      // UNIQUE(message_id, user_id, emoji) makes this idempotent -- a
      // double-click just re-inserts the same row and gets silently
      // absorbed. We catch + swallow the conflict explicitly so the
      // mutation doesn't error on a natural double-click race. Match
      // by Postgres error code 23505 (unique_violation) AND the
      // English message, since postgres-js and PGlite surface the
      // error slightly differently.
      try {
        await ctx.db.insert(messageReactions).values({
          messageId: input.messageId,
          userId: ctx.user.id,
          emoji: input.emoji,
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }

      void publishChatEvent(msg.matchId, {
        type: "reaction.added",
        messageId: input.messageId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  removeReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        emoji: z.string().min(1).max(16),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      await verifyMatchParticipant(ctx.db, msg.matchId, ctx.user.id);

      await ctx.db
        .delete(messageReactions)
        .where(and(
          eq(messageReactions.messageId, input.messageId),
          eq(messageReactions.userId, ctx.user.id),
          eq(messageReactions.emoji, input.emoji),
        ));

      void publishChatEvent(msg.matchId, {
        type: "reaction.removed",
        messageId: input.messageId,
        emoji: input.emoji,
        userId: ctx.user.id,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
