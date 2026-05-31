import { z } from "zod";
import {
  eq,
  desc,
  and,
  or,
  inArray,
  lt,
  gt,
  sql,
  ilike,
  asc,
  isNull,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  messages,
  matches,
  users,
  messageReactions,
  messageReports,
  userBlocks,
  tours,
  experiences,
  hostProfiles,
} from "../db/schema";
import { tourTimeWindow } from "@/lib/tour-time";
import { readRequestParams } from "../lib/tour-request-shape";
import { purgeStaleMessages } from "@/server/services/purge-messages";
import {
  applyContactInfoMask,
  moderateWithOpenAI,
} from "@/server/services/chat-moderation";
import { publishChatEvent } from "@/server/services/chat-pubsub";
import { enforceChatRateLimit } from "@/server/services/chat-ratelimit";
import { db as serverDb } from "@/server/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Seconds during which a sender may still edit their own message. Keep
 * short to match the Airbnb / Messenger "oops, typo" use case without
 * letting senders rewrite history after the recipient replied.
 */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Seconds during which a sender may unsend (soft-delete) their message.
 * Longer than EDIT_WINDOW because "I sent this to the wrong thread" is
 * a realer mistake than a typo, and the recipient might not yet have
 * opened the chat.
 */
const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_REACTIONS_PER_USER_PER_MESSAGE = 3;

// Curated emoji set surfaced by the UI picker. Kept small to avoid a
// full emoji library and to keep reaction grouping readable.
const ALLOWED_REACTION_EMOJIS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "✅",
  "🔥",
  "👏",
  "😀",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyMatchParticipant(
  db: typeof import("../db").db,
  matchId: string,
  userId: string,
) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
  // userAId / userBId are now nullable (account deletion sets them NULL).
  // A caller is still a participant iff they equal one of the non-null sides.
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
  }
  if (match.status !== "matched") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conversation not available" });
  }
  return match;
}

/**
 * Apply the caller's block list as a filter. Returns the list of user IDs
 * the caller has either blocked or been blocked by -- matches involving
 * any of these counterparties should be hidden. One round-trip, one `OR`.
 */
async function getBlockedCounterpartyIds(
  db: typeof import("../db").db,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ a: userBlocks.blockerId, b: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
  const out = new Set<string>();
  for (const r of rows) {
    if (r.a !== userId) out.add(r.a);
    if (r.b !== userId) out.add(r.b);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const chatRouter = router({
  /**
   * Inbox view. Returns every conversation the caller participates in,
   * hydrated with the "other" user, the most recent message, unread count,
   * and the upcoming/past tour-stage filter applied if requested.
   *
   * Conversations where the other party has deleted their account are
   * still returned; `otherUser` is null so the UI can render "[deleted
   * user]". The thread remains readable (tombstoned content) until the
   * 30-day retention cron purges it.
   */
  getConversations: protectedProcedure
    .input(
      z
        .object({
          filter: z.enum(["all", "unread"]).default("all"),
          q: z.string().max(120).optional(),
        })
        .default({ filter: "all" }),
    )
    .query(async ({ ctx, input }) => {
      const myId = ctx.user.id;
      const blockedSet = await getBlockedCounterpartyIds(ctx.db, myId);

      const userMatches = await ctx.db
        .select()
        .from(matches)
        .where(and(
          eq(matches.status, "matched"),
          or(eq(matches.userAId, myId), eq(matches.userBId, myId)),
        ));

      // Drop conversations where the counterparty is blocked either way.
      const visibleMatches = userMatches.filter((m) => {
        const otherId = m.userAId === myId ? m.userBId : m.userAId;
        if (!otherId) return true; // deleted-user tombstone; still show.
        return !blockedSet.has(otherId);
      });

      if (visibleMatches.length === 0) return [];

      const otherIds = visibleMatches
        .map((m) => (m.userAId === myId ? m.userBId : m.userAId))
        .filter((x): x is string => !!x);
      const matchIds = visibleMatches.map((m) => m.id);

      const otherUsers = otherIds.length
        ? await ctx.db
            .select({
              id: users.id,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
              role: users.role,
            })
            .from(users)
            .where(inArray(users.id, otherIds))
        : [];
      const userById = new Map(otherUsers.map((u) => [u.id, u]));

      // Grouped aggregate: last-message id + unread-for-caller count per
      // match. Excludes soft-deleted rows from the "last message" pick so
      // the inbox doesn't surface "[deleted]" as a preview.
      const aggregates = await ctx.db
        .select({
          matchId: messages.matchId,
          lastMessageId: sql<string | null>`(
            array_agg(${messages.id} ORDER BY ${messages.createdAt} DESC)
              FILTER (WHERE ${messages.deletedAt} IS NULL)
          )[1]`,
          unreadCount: sql<string>`count(*) filter (
            where ${messages.isRead} = false
              AND ${messages.senderId} <> ${myId}
              AND ${messages.deletedAt} IS NULL
          )::text`,
        })
        .from(messages)
        .where(inArray(messages.matchId, matchIds))
        .groupBy(messages.matchId);
      const aggByMatch = new Map(aggregates.map((a) => [a.matchId, a]));

      const lastIds = aggregates
        .map((a) => a.lastMessageId)
        .filter((id): id is string => !!id);
      const lastMessages = lastIds.length
        ? await ctx.db.select().from(messages).where(inArray(messages.id, lastIds))
        : [];
      const lastById = new Map(lastMessages.map((m) => [m.id, m]));

      let out = visibleMatches.map((m) => {
        const otherId = m.userAId === myId ? m.userBId : m.userAId;
        const agg = aggByMatch.get(m.id);
        const last = agg?.lastMessageId ? lastById.get(agg.lastMessageId) ?? null : null;
        return {
          matchId: m.id,
          otherUser: otherId ? userById.get(otherId) ?? null : null,
          lastMessage: last,
          unreadCount: Number(agg?.unreadCount ?? 0),
          matchedAt: m.matchedAt,
        };
      });

      if (input.filter === "unread") {
        out = out.filter((c) => c.unreadCount > 0);
      }

      if (input.q && input.q.trim().length > 0) {
        const needle = input.q.trim().toLowerCase();
        out = out.filter((c) => {
          const name = (c.otherUser?.displayName ?? "").toLowerCase();
          const preview = (c.lastMessage?.content ?? "").toLowerCase();
          return name.includes(needle) || preview.includes(needle);
        });
      }

      return out.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt?.getTime() ?? (a.matchedAt?.getTime() ?? 0);
        const bTime = b.lastMessage?.createdAt?.getTime() ?? (b.matchedAt?.getTime() ?? 0);
        return bTime - aTime;
      });
    }),

  /**
   * Cursor-paginated message stream. `cursor` is the OLDEST message the
   * client already has; a null cursor returns the newest page. Result is
   * returned ASC so the UI renders top-to-bottom; prepend the next page
   * above the current first message when scrolling up.
   *
   * Secondary sort by id stabilises the order when two messages share
   * createdAt (possible during burst sends or historical seed data).
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        matchId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        // Cursor = { createdAt, id }. Null = newest page.
        cursor: z
          .object({
            createdAt: z.string(),
            id: z.string().uuid(),
          })
          .nullable()
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);

      const whereParts = [eq(messages.matchId, input.matchId)];
      if (input.cursor) {
        // "Older than the cursor" = (createdAt < cursor.createdAt)
        // OR (createdAt = cursor.createdAt AND id < cursor.id). Matches
        // the ordering of the primary + secondary sort.
        whereParts.push(
          sql`(${messages.createdAt} < ${input.cursor.createdAt}::timestamptz
               OR (${messages.createdAt} = ${input.cursor.createdAt}::timestamptz
                   AND ${messages.id} < ${input.cursor.id}::uuid))`,
        );
      }

      const result = await ctx.db
        .select()
        .from(messages)
        .where(and(...whereParts))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(input.limit + 1); // +1 to detect if there's another page.

      const hasMore = result.length > input.limit;
      const page = hasMore ? result.slice(0, input.limit) : result;
      const nextCursor = hasMore && page.length > 0
        ? {
            createdAt:
              page[page.length - 1].createdAt?.toISOString() ??
              new Date().toISOString(),
            id: page[page.length - 1].id,
          }
        : null;

      // Return in ASC order for UI render; tombstones included so the UI
      // can show "message deleted" placeholders instead of silent gaps.
      const items = page.reverse().map(sanitizeMessageForClient);

      // Reactions for this page, aggregated per message.
      const reactionRows = items.length
        ? await ctx.db
            .select()
            .from(messageReactions)
            .where(inArray(messageReactions.messageId, items.map((m) => m.id)))
        : [];
      const reactionsByMessage = new Map<
        string,
        Array<{ emoji: string; count: number; reactedByMe: boolean }>
      >();
      for (const r of reactionRows) {
        const bucket = reactionsByMessage.get(r.messageId) ?? [];
        const existing = bucket.find((x) => x.emoji === r.emoji);
        if (existing) {
          existing.count += 1;
          if (r.userId === ctx.user.id) existing.reactedByMe = true;
        } else {
          bucket.push({
            emoji: r.emoji,
            count: 1,
            reactedByMe: r.userId === ctx.user.id,
          });
        }
        reactionsByMessage.set(r.messageId, bucket);
      }

      const hydrated = items.map((m) => ({
        ...m,
        reactions: reactionsByMessage.get(m.id) ?? [],
      }));

      return { items: hydrated, nextCursor };
    }),

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

  // -------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Reports (Trust & Safety)
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Block / unblock
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Context-aware quick-reply chips
  //
  // Drives the chip bar above the composer. Two tiers:
  //   Tier A -- booking chips when the caller + counterparty share a
  //             paid/active tour in the next 7 days. Booking-specific
  //             copy (arrival time, meeting point, on-my-way, running
  //             late) with `insertText` that the UI drops into the
  //             composer for the user to edit before sending.
  //   Tier C -- role-aware static fallback when there's no shared tour.
  //             Traveler + host defaults differ so the copy matches the
  //             sender's typical next line.
  //
  // Tier B (LLM smart replies) is intentionally NOT wired here; it's a
  // clean extension point if we ever want it (append after the Tier A
  // list, before falling through to Tier C).
  // -------------------------------------------------------------------

  getContextChips: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const match = await verifyMatchParticipant(
        ctx.db,
        input.matchId,
        ctx.user.id,
      );
      const otherId = match.userAId === ctx.user.id ? match.userBId : match.userAId;

      type Chip = {
        kind: "booking" | "static";
        label: string;
        insertText: string;
        icon: "clock" | "pin" | "ticket" | null;
      };

      const role = ctx.user.role;

      // Tier C: role-aware fallbacks. Same shape as Tier A so the UI
      // doesn't branch; used as the sole reply when no shared tour.
      const fallbackFor = (r: string): Chip[] => {
        if (r === "host" || r === "admin") {
          return [
            { kind: "static", label: "Sounds good!", insertText: "Sounds good!", icon: null },
            { kind: "static", label: "Let me check", insertText: "Let me check and get back to you shortly.", icon: null },
            { kind: "static", label: "Sending details", insertText: "I'll send the details shortly.", icon: null },
          ];
        }
        // Default to traveler copy for everyone else.
        return [
          { kind: "static", label: "Thanks!", insertText: "Thanks!", icon: null },
          { kind: "static", label: "Sounds good", insertText: "Sounds good, see you then!", icon: null },
          { kind: "static", label: "Send a photo?", insertText: "Could you send a photo?", icon: null },
        ];
      };

      // If the counterparty deleted their account, there's no shared-
      // tour surface to query -- go straight to Tier C.
      if (!otherId) return fallbackFor(role);

      // Shared-tour lookup. Two symmetric cases:
      //   - caller is the traveler  -> tours.userId = caller, tours.hostId
      //     resolves to a hostProfiles row whose userId = counterparty.
      //   - caller is the host      -> tours.userId = counterparty, and
      //     tours.hostId resolves to caller's hostProfiles.
      // One SELECT with an `OR` covers both; the left-join to
      // hostProfiles+users tells us which case matched. `LIMIT 5` keeps
      // the payload small; we filter + sort in JS by temporal proximity.
      const rows = await ctx.db
        .select({
          tourId: tours.id,
          status: tours.status,
          requestParams: tours.requestParams,
          scheduleJson: experiences.schedule,
          experienceTitle: experiences.title,
          hostUserId: users.id,
        })
        .from(tours)
        .leftJoin(experiences, eq(tours.experienceId, experiences.id))
        .leftJoin(hostProfiles, eq(tours.hostId, hostProfiles.id))
        .leftJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(
          inArray(tours.status, ["paid", "active", "completed"]),
          or(
            // Caller is the traveler, counterparty is the host's user.
            and(
              eq(tours.userId, ctx.user.id),
              eq(hostProfiles.userId, otherId),
            ),
            // Caller is the host, counterparty is the traveler.
            and(
              eq(tours.userId, otherId),
              eq(hostProfiles.userId, ctx.user.id),
            ),
          ),
        ))
        .limit(5);

      // Pick the best candidate: active-now beats upcoming; upcoming
      // picks the nearest start time. Completed tours drop off the
      // chip bar entirely -- nothing booking-actionable remains.
      const now = Date.now();
      const classified = rows
        .map((r) => {
          const win = tourTimeWindow(readRequestParams(r.requestParams));
          if (!win) return null;
          const startMs = win.startsAt.getTime();
          const endMs = win.endsAt.getTime();
          const isActive = now >= startMs && now <= endMs;
          const delta = startMs - now;
          const isUpcoming = delta > 0 && delta < 7 * 86400_000;
          if (!isActive && !isUpcoming) return null;
          return { row: r, startMs, endMs, isActive, delta };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => {
          // Active tours first; then upcoming by soonest.
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          return a.delta - b.delta;
        });

      if (classified.length === 0) return fallbackFor(role);

      const best = classified[0];
      const rp = best.row.requestParams as { date?: string; startTime?: string } | null;
      const startTime = typeof rp?.startTime === "string" ? rp.startTime : null;
      const schedule = Array.isArray(best.row.scheduleJson)
        ? (best.row.scheduleJson as Array<{ label?: unknown }>)
        : [];
      const firstStopLabel =
        typeof schedule[0]?.label === "string" && schedule[0].label.trim().length > 0
          ? schedule[0].label.trim()
          : null;

      const chips: Chip[] = [];

      if (startTime) {
        chips.push({
          kind: "booking",
          label: `I'll arrive at ${startTime}`,
          insertText: `I'll arrive at ${startTime}, see you then!`,
          icon: "clock",
        });
      }
      if (firstStopLabel) {
        // Short label for the pill; fuller sentence in insertText so the
        // composer contents read naturally.
        const labelShort =
          firstStopLabel.length > 28
            ? `${firstStopLabel.slice(0, 28).trimEnd()}…`
            : firstStopLabel;
        chips.push({
          kind: "booking",
          label: `Meeting point: ${labelShort}`,
          insertText: `Meeting at ${firstStopLabel}. Does that work?`,
          icon: "pin",
        });
      }
      if (best.isActive) {
        chips.push({
          kind: "booking",
          label: "On my way",
          insertText: "On my way! See you in a few minutes.",
          icon: "clock",
        });
        chips.push({
          kind: "booking",
          label: "Running ~5 min late",
          insertText: "Running ~5 min late, sorry!",
          icon: "clock",
        });
      }

      // Cap at 4 booking chips so the row stays scannable on mobile.
      // If the booking side produced nothing actionable (e.g. a paid
      // tour without startTime + schedule, and not active yet), fall
      // through to Tier C rather than rendering an empty row.
      if (chips.length === 0) return fallbackFor(role);
      return chips.slice(0, 4);
    }),

  // -------------------------------------------------------------------
  // Search + export
  // -------------------------------------------------------------------

  /**
   * Case-insensitive ILIKE search over message content across every
   * conversation the caller participates in. Scoped by `matchId` when
   * provided. Excludes soft-deleted tombstones so "[message deleted]"
   * doesn't pollute results. Results newest first.
   */
  searchMessages: protectedProcedure
    .input(
      z.object({
        q: z.string().min(2).max(120),
        matchId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const myId = ctx.user.id;
      const myMatches = await ctx.db
        .select({ id: matches.id })
        .from(matches)
        .where(and(
          eq(matches.status, "matched"),
          or(eq(matches.userAId, myId), eq(matches.userBId, myId)),
        ));
      const matchIds = input.matchId
        ? [input.matchId].filter((id) => myMatches.some((m) => m.id === id))
        : myMatches.map((m) => m.id);
      if (matchIds.length === 0) return [];

      return ctx.db
        .select()
        .from(messages)
        .where(and(
          inArray(messages.matchId, matchIds),
          ilike(messages.content, `%${input.q}%`),
          isNull(messages.deletedAt),
        ))
        .orderBy(desc(messages.createdAt))
        .limit(input.limit);
    }),

  /**
   * Full chat history export -- "give me everything I ever sent/received".
   * Returns a JSON-safe structure the client can save locally. Subject
   * to the 30-day retention window; older messages are already gone.
   */
  exportHistory: protectedProcedure.query(async ({ ctx }) => {
    const myId = ctx.user.id;
    const myMatches = await ctx.db
      .select()
      .from(matches)
      .where(or(eq(matches.userAId, myId), eq(matches.userBId, myId)));
    if (myMatches.length === 0) return { exportedAt: new Date().toISOString(), conversations: [] };

    const matchIds = myMatches.map((m) => m.id);
    const allMessages = await ctx.db
      .select()
      .from(messages)
      .where(inArray(messages.matchId, matchIds))
      .orderBy(asc(messages.createdAt));
    const byMatch = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      const bucket = byMatch.get(msg.matchId) ?? [];
      bucket.push(msg);
      byMatch.set(msg.matchId, bucket);
    }

    return {
      exportedAt: new Date().toISOString(),
      conversations: myMatches.map((m) => ({
        matchId: m.id,
        matchedAt: m.matchedAt,
        messages: (byMatch.get(m.id) ?? []).map((msg) => ({
          id: msg.id,
          senderId: msg.senderId,
          content: msg.content,
          messageType: msg.messageType,
          attachmentUrl: msg.attachmentUrl,
          createdAt: msg.createdAt,
          editedAt: msg.editedAt,
          deletedAt: msg.deletedAt,
        })),
      })),
    };
  }),

  // -------------------------------------------------------------------
  // Typing indicator (no persistence; pushes via SSE pubsub only)
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Start-with-host (unchanged contract from the prior version; kept
  // here alongside the new procedures so there's one source of truth).
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Admin procedures -- /admin/flagged page, retention manual trigger.
  // -------------------------------------------------------------------

  adminListFlagged: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          report: messageReports,
          message: messages,
          sender: {
            id: users.id,
            displayName: users.displayName,
            email: users.email,
          },
        })
        .from(messageReports)
        .innerJoin(messages, eq(messageReports.messageId, messages.id))
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messageReports.status, "open"))
        .orderBy(desc(messageReports.createdAt))
        .limit(input.limit);
    }),

  adminResolveReport: adminProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
        resolution: z.enum(["resolved", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(messageReports)
        .set({
          status: input.resolution,
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(messageReports.id, input.reportId));
      return { success: true };
    }),

  adminPurgeStale: adminProcedure
    .input(z.object({ retentionDays: z.number().int().min(1).max(365).default(30) }).default({ retentionDays: 30 }))
    .mutation(async ({ ctx, input }) => {
      return purgeStaleMessages(ctx.db, input.retentionDays);
    }),
});

// ---------------------------------------------------------------------------
// Utility: shape a raw message row for the client. Soft-deleted rows get
// their content/attachment scrubbed to make the tombstone render obvious.
// ---------------------------------------------------------------------------

function sanitizeMessageForClient(row: typeof messages.$inferSelect) {
  if (row.deletedAt) {
    return {
      ...row,
      content: "[message deleted]",
      attachmentUrl: null,
      attachmentKind: null,
    };
  }
  return row;
}

/**
 * Detect a Postgres "unique violation" across both the postgres-js
 * driver (production) and PGlite (tests). postgres-js surfaces code
 * '23505' on the error object; PGlite sometimes wraps it under a
 * different shape. Matching on both covers us either way.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  if (e.code === "23505") return true;
  if (e.cause?.code === "23505") return true;
  const msg = e.message ?? e.cause?.message ?? "";
  return /unique|duplicate/i.test(msg);
}

// Satisfy unused-import linting for symbols used only conditionally.
void lt;
void gt;
