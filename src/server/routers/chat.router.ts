import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { messages, matches, users } from "../db/schema";

async function verifyMatchParticipant(db: typeof import("../db").db, matchId: string, userId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant in this conversation" });
  }
  if (match.status !== "matched") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conversation not available" });
  }
  return match;
}

export const chatRouter = router({
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    const userMatches = await ctx.db
      .select()
      .from(matches)
      .where(and(
        eq(matches.status, "matched"),
        sql`(${matches.userAId} = ${ctx.user.id} OR ${matches.userBId} = ${ctx.user.id})`
      ));

    const conversations = await Promise.all(
      userMatches.map(async (m) => {
        const otherId = m.userAId === ctx.user.id ? m.userBId : m.userAId;
        const [otherUser] = await ctx.db
          .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, role: users.role })
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);
        const lastMessage = await ctx.db.query.messages.findFirst({
          where: eq(messages.matchId, m.id),
          orderBy: desc(messages.createdAt),
        });
        const unreadCount = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(and(
            eq(messages.matchId, m.id),
            eq(messages.isRead, false),
            sql`${messages.senderId} != ${ctx.user.id}`
          ));

        return {
          matchId: m.id,
          otherUser,
          lastMessage,
          unreadCount: Number(unreadCount[0]?.count || 0),
          matchedAt: m.matchedAt,
        };
      })
    );

    return conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() ?? a.matchedAt?.getTime() ?? 0;
      const bTime = b.lastMessage?.createdAt?.getTime() ?? b.matchedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }),

  getMessages: protectedProcedure
    .input(z.object({ matchId: z.string().uuid(), limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);
      const result = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.matchId, input.matchId))
        .orderBy(desc(messages.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return result.reverse();
    }),

  sendMessage: protectedProcedure
    .input(z.object({ matchId: z.string().uuid(), content: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await verifyMatchParticipant(ctx.db, input.matchId, ctx.user.id);
      const [msg] = await ctx.db
        .insert(messages)
        .values({
          matchId: input.matchId,
          senderId: ctx.user.id,
          content: input.content,
          messageType: "text",
        })
        .returning();
      return msg;
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
          sql`${messages.senderId} != ${ctx.user.id}`,
          eq(messages.isRead, false)
        ));
      return { success: true };
    }),
});
