import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { messages, matches, users } from "../../db/schema";
import {
  applyContactInfoMask,
  moderateWithOpenAI,
} from "@/server/services/chat-moderation";
import { publishChatEvent } from "@/server/services/chat-pubsub";
import { enforceChatRateLimit } from "@/server/services/chat-ratelimit";
import { db as serverDb } from "@/server/db";
import {
  verifyMatchParticipant,
  getBlockedCounterpartyIds,
  EDIT_WINDOW_MS,
  UNSEND_WINDOW_MS,
} from "./shared";

export const chatMessagingProcedures = {
  sendMessage: protectedProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        content: z.string().min(1).max(2000),
        attachmentUrl: z.string().url().optional(),
        attachmentKind: z.literal("image").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const match = await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);

      // Block check: if EITHER side of the match has blocked the other,
      // sending is not allowed. Symmetric -- doesn't matter who blocked
      // whom, the channel is silenced.
      const blockedSet = await getBlockedCounterpartyIds(ctx.db, ctx.user.id);
      const otherId = match.userAId === ctx.user.id ? match.userBId : match.userAId;
      if (otherId && blockedSet.has(otherId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot message this user.",
        });
      }

      // Rate limit: 10/min, 100/day per caller. Returns early if bucket
      // exhausted; does NOT record an attempt-count side-channel (the
      // error is the feedback, no telemetry until we have Sentry).
      await enforceChatRateLimit(ctx.user.id);

      // Contact-info soft mask: hosts trying to move chat off-platform
      // get their phone / URL / messaging-app handles redacted with a
      // string of bullets. We don't refuse the send -- legitimate
      // meeting-point text ("7 Mã Mây, Hoàn Kiếm") would false-positive
      // a strict URL reject.
      const masked = applyContactInfoMask(input.content);

      const [msg] = await ctx.db
        .insert(messages)
        .values({
          matchId: input.matchId,
          senderId: ctx.user.id,
          content: masked.content,
          messageType: input.attachmentUrl ? "image" : "text",
          attachmentUrl: input.attachmentUrl ?? null,
          attachmentKind: input.attachmentKind ?? null,
          flagged: masked.didMask, // soft-signal; admin can triage
          flagReason: masked.didMask ? "contact_info" : null,
        })
        .returning();

      // Publish to SSE subscribers. Failures here must NOT break the
      // client send -- polling fallback will catch up. Fire-and-forget.
      void publishChatEvent(input.matchId, { type: "message.new", message: msg });

      // OpenAI moderation in the background. Running it inline would add
      // 200-400 ms to the send latency; running it AFTER we've returned
      // lets the hot path stay snappy. If the model flags high-confidence
      // harassment / sexual / violence content we flip `flagged=true` so
      // the admin queue surfaces it for review. The API is free per
      // OpenAI ToS. If the env isn't configured the call is a no-op.
      void (async () => {
        try {
          const result = await moderateWithOpenAI(msg.content);
          if (result.flagged) {
            await serverDb
              .update(messages)
              .set({
                flagged: true,
                flagReason: result.category ?? "openai_moderation",
              })
              .where(eq(messages.id, msg.id));
          }
        } catch {
          // Swallow -- moderation is best-effort.
        }
      })();

      return msg;
    }),

  /**
   * Edit a message the caller sent within EDIT_WINDOW_MS. Original
   * content is replaced (no edit history retained for MVP); `editedAt`
   * is set so the UI can render a subtle "edited" marker.
   */
  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.senderId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the sender can edit" });
      }
      if (existing.deletedAt) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Deleted messages cannot be edited" });
      }
      const createdAt = existing.createdAt?.getTime() ?? 0;
      if (Date.now() - createdAt > EDIT_WINDOW_MS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Edit window has closed (15 minutes).",
        });
      }

      const masked = applyContactInfoMask(input.content);
      const [updated] = await ctx.db
        .update(messages)
        .set({
          content: masked.content,
          editedAt: new Date(),
          flagged: existing.flagged || masked.didMask,
          flagReason: masked.didMask ? "contact_info" : existing.flagReason,
        })
        .where(eq(messages.id, input.messageId))
        .returning();

      void publishChatEvent(existing.matchId, {
        type: "message.edited",
        id: updated.id,
        content: updated.content,
        editedAt: updated.editedAt!.toISOString(),
      });

      return updated;
    }),

  /**
   * Unsend (soft-delete) a message within UNSEND_WINDOW_MS. Row stays
   * in the DB so the audit trail survives until the 30-day retention
   * cron purges it; UI renders a "Message deleted" tombstone.
   */
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.senderId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the sender can unsend" });
      }
      if (existing.deletedAt) return existing; // idempotent
      const createdAt = existing.createdAt?.getTime() ?? 0;
      if (Date.now() - createdAt > UNSEND_WINDOW_MS) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Unsend window has closed (24 hours).",
        });
      }

      const [updated] = await ctx.db
        .update(messages)
        .set({
          deletedAt: new Date(),
          deletedReason: "user_unsent",
          // Also scrub content + attachment so a post-retention leak
          // (e.g. database backup) can't resurrect the unsent message.
          content: "[message deleted]",
          attachmentUrl: null,
          attachmentKind: null,
        })
        .where(eq(messages.id, input.messageId))
        .returning();

      void publishChatEvent(existing.matchId, {
        type: "message.deleted",
        id: updated.id,
      });

      return updated;
    }),

  markRead: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);
      await ctx.db
        .update(messages)
        .set({ isRead: true })
        .where(and(
          eq(messages.matchId, input.matchId),
          sql`${messages.senderId} <> ${ctx.user.id}`,
          eq(messages.isRead, false),
        ));
      // Tell the sender the read frontier advanced. Useful for Seen
      // indicators in the sender's UI.
      void publishChatEvent(input.matchId, {
        type: "read.advance",
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  typingStart: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);
      void publishChatEvent(input.matchId, {
        type: "typing.start",
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  startWithHost: protectedProcedure
    .input(z.object({ hostUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.hostUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't message yourself" });
      }
      const target = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.hostUserId),
      });
      if (!target || !target.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
      }
      if (target.role !== "host" && target.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Recipient is not a host" });
      }

      // Also block a traveler from starting a thread with a user they've
      // blocked (or who blocked them) -- the UI already hides the CTA,
      // but a scripted caller could try anyway.
      const blockedSet = await getBlockedCounterpartyIds(ctx.db, ctx.user.id);
      if (blockedSet.has(input.hostUserId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot message this user.",
        });
      }

      const [sortedA, sortedB] = [ctx.user.id, input.hostUserId].sort();
      const existing = await ctx.db.query.matches.findFirst({
        where: and(eq(matches.userAId, sortedA), eq(matches.userBId, sortedB)),
      });
      if (existing) {
        if (existing.status !== "matched") {
          await ctx.db
            .update(matches)
            .set({ status: "matched", matchedAt: existing.matchedAt ?? new Date() })
            .where(eq(matches.id, existing.id));
        }
        return { matchId: existing.id, created: false };
      }

      const [created] = await ctx.db
        .insert(matches)
        .values({
          userAId: sortedA,
          userBId: sortedB,
          score: "1.0000",
          status: "matched",
          matchedAt: new Date(),
        })
        .returning();
      return { matchId: created.id, created: true };
    }),
} satisfies TRPCRouterRecord;
