import { z } from "zod";
import { eq, desc, and, or, inArray, sql, asc, ilike, isNull } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import {
  messages,
  matches,
  users,
  messageReactions,
  tours,
  experiences,
  hostProfiles,
} from "../../db/schema";
import { tourTimeWindow } from "@/lib/tour-time";
import { readRequestParams } from "../../lib/tour-request-shape";
import {
  verifyMatchParticipant,
  getBlockedCounterpartyIds,
  sanitizeMessageForClient,
} from "./shared";

export const chatConversationProcedures = {
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
} satisfies TRPCRouterRecord;
