import { z } from "zod";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { users, userProfiles, swipeActions, matches } from "../db/schema";
import { readExplicitData, readDerivedData } from "../lib/profile-shape";
import { MatchCandidateSchema } from "../lib/match-candidate-dto";

export const matchRouter = router({
  getCandidates: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const swiped = await ctx.db
        .select({ targetId: swipeActions.targetId })
        .from(swipeActions)
        .where(eq(swipeActions.swiperId, ctx.user.id));

      const swipedIds = swiped.map((s) => s.targetId);
      swipedIds.push(ctx.user.id);

      const conditions = [
        eq(users.isActive, true),
        eq(users.role, "traveler"),
        eq(userProfiles.onboardingCompleted, true),
      ];

      if (swipedIds.length > 0) {
        conditions.push(notInArray(users.id, swipedIds));
      }

      // Read the profile blobs server-side ONLY to derive the whitelisted
      // projection — they never cross the wire. Identity columns
      // (displayName/avatarUrl) are not selected at all. The strict
      // `MatchCandidateSchema.parse` is defence-in-depth: any field that
      // drifts outside the whitelist throws here, not on the client.
      const candidates = await ctx.db
        .select({
          id: users.id,
          explicitData: userProfiles.explicitData,
          derivedData: userProfiles.derivedData,
        })
        .from(users)
        .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(and(...conditions))
        .limit(input.limit);

      return candidates.map((c) => {
        const explicit = readExplicitData(c.explicitData);
        const derived = readDerivedData(c.derivedData);
        return MatchCandidateSchema.parse({
          candidateUserId: c.id,
          interests: explicit.interests ?? [],
          personalityLabel: derived.personalityLabel ?? null,
          personalityVector: derived.personalityVector ?? null,
          compatibilityScore: Math.floor(40 + Math.random() * 55),
        });
      });
    }),

  swipe: protectedProcedure
    .input(z.object({ targetId: z.string().uuid(), action: z.enum(["like", "skip"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(swipeActions).values({
        swiperId: ctx.user.id,
        targetId: input.targetId,
        action: input.action,
      });

      if (input.action === "like") {
        const reciprocal = await ctx.db.query.swipeActions.findFirst({
          where: and(
            eq(swipeActions.swiperId, input.targetId),
            eq(swipeActions.targetId, ctx.user.id),
            eq(swipeActions.action, "like")
          ),
        });

        if (reciprocal) {
          const [userA, userB] = [ctx.user.id, input.targetId].sort();
          await ctx.db.insert(matches).values({
            userAId: userA,
            userBId: userB,
            score: "0.8500",
            status: "matched",
            matchedAt: new Date(),
          });
          return { matched: true };
        }
      }

      return { matched: false };
    }),

  getMatches: protectedProcedure.query(async ({ ctx }) => {
    const userMatches = await ctx.db
      .select()
      .from(matches)
      .where(and(
        eq(matches.status, "matched"),
        sql`(${matches.userAId} = ${ctx.user.id} OR ${matches.userBId} = ${ctx.user.id})`
      ));

    const enriched = await Promise.all(
      userMatches.map(async (m) => {
        const otherId = m.userAId === ctx.user.id ? m.userBId : m.userAId;
        // Post chat-overhaul, userAId / userBId are nullable (see
        // matches FK rewrite in user.deleteAccount / schema). When the
        // counterparty deleted their account, otherId is null and we
        // return no user -- the inbox UI renders a "deleted user" row.
        const otherUser = otherId
          ? await ctx.db.query.users.findFirst({ where: eq(users.id, otherId) })
          : null;
        return { ...m, otherUser };
      })
    );

    return enriched;
  }),

  unmatch: protectedProcedure
    .input(z.object({ matchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(matches)
        .set({ status: "unmatched" })
        .where(eq(matches.id, input.matchId));
      return { success: true };
    }),
});
