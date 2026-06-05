import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure, protectedProcedure } from "../../trpc";
import { savedHosts, hostProfiles, users } from "../../db/schema";

export const hostSavedProcedures = {
  /**
   * Check whether the caller has saved a host. Returns null for anonymous
   * callers so the client doesn't thrash an auth-gated query on public
   * pages. Used by /hosts/[slug] to render the Save button correctly.
   */
  isSaved: publicProcedure
    .input(z.object({ hostId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user) return false;
      const row = await ctx.db.query.savedHosts.findFirst({
        where: and(eq(savedHosts.userId, ctx.user.id), eq(savedHosts.hostId, input.hostId)),
      });
      return !!row;
    }),

  /**
   * Save a host to the caller's favorites. Idempotent: re-saving returns
   * ok without a DB error. No host-role restriction -- any signed-in user
   * can save hosts for future reference.
   */
  save: protectedProcedure
    .input(z.object({ hostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Confirm the host exists + is an active account, otherwise we'd
      // silently create dangling rows that 404 on render.
      const [host] = await ctx.db
        .select({ userId: hostProfiles.userId })
        .from(hostProfiles)
        .innerJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(eq(hostProfiles.id, input.hostId), eq(users.isActive, true)));
      if (!host) throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
      if (host.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't save your own profile" });
      }

      // Pre-check rather than catch-on-write. Unique-violation shapes
      // differ between PGlite, postgres-js, and drizzle wrappers, so a
      // try/catch on `code === '23505'` is fragile across drivers.
      // A single SELECT + INSERT has a tiny race window (two concurrent
      // saves from the same user), but the UNIQUE index makes that a DB
      // error either way -- we just re-read and return idempotent.
      const existing = await ctx.db.query.savedHosts.findFirst({
        where: and(eq(savedHosts.userId, ctx.user.id), eq(savedHosts.hostId, input.hostId)),
      });
      if (existing) {
        return { ok: true, alreadySaved: true };
      }
      try {
        await ctx.db.insert(savedHosts).values({
          userId: ctx.user.id,
          hostId: input.hostId,
        });
      } catch (err) {
        // Fallback: if a race got there first, the unique index wins and
        // we treat it as already-saved.
        const maybePgCode = (err as { code?: string; cause?: { code?: string } }).code
          ?? (err as { cause?: { code?: string } }).cause?.code;
        if (maybePgCode === "23505") {
          return { ok: true, alreadySaved: true };
        }
        throw err;
      }
      return { ok: true, alreadySaved: false };
    }),

  unsave: protectedProcedure
    .input(z.object({ hostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(savedHosts).where(and(
        eq(savedHosts.userId, ctx.user.id),
        eq(savedHosts.hostId, input.hostId),
      ));
      return { ok: true };
    }),

  /**
   * List the caller's saved hosts. Used by a future /saved/hosts view.
   * Joins against `users` + `hostProfiles` so the list can render without
   * follow-up queries.
   */
  getSaved: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        hostId: savedHosts.hostId,
        slug: hostProfiles.publicSlug,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: hostProfiles.bio,
        specialties: hostProfiles.specialties,
        avgRating: hostProfiles.avgRating,
        totalReviews: hostProfiles.totalReviews,
        savedAt: savedHosts.createdAt,
      })
      .from(savedHosts)
      .innerJoin(hostProfiles, eq(savedHosts.hostId, hostProfiles.id))
      .innerJoin(users, eq(hostProfiles.userId, users.id))
      .where(and(eq(savedHosts.userId, ctx.user.id), eq(users.isActive, true)))
      .orderBy(desc(savedHosts.createdAt));
  }),
} satisfies TRPCRouterRecord;
