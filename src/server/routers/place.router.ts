import { z } from "zod";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { places, savedPlaces } from "../db/schema";

export const placeRouter = router({
  getFeed: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(places.isActive, true), eq(places.isVerified, true)];

      if (input.category) {
        conditions.push(eq(places.category, input.category));
      }

      if (input.search) {
        conditions.push(ilike(places.name, `%${input.search}%`));
      }

      const results = await ctx.db
        .select()
        .from(places)
        .where(and(...conditions))
        .orderBy(desc(places.visitCount))
        .limit(input.limit)
        .offset(input.offset);

      return { places: results, total: results.length };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const place = await ctx.db.query.places.findFirst({
        where: eq(places.id, input.id),
      });
      return place;
    }),

  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string().min(1).max(250) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.places.findFirst({
        where: eq(places.slug, input.slug),
      });
    }),

  getByIds: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(100) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      const results = await ctx.db
        .select()
        .from(places)
        .where(sql`${places.id} IN (${sql.join(input.ids.map((id) => sql`${id}`), sql`, `)})`);
      return results;
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select()
        .from(places)
        .where(and(
          eq(places.isActive, true),
          ilike(places.name, `%${input.query}%`)
        ))
        .limit(input.limit);
      return results;
    }),

  savePlace: protectedProcedure
    .input(z.object({ placeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(savedPlaces).values({
        userId: ctx.user.id,
        placeId: input.placeId,
      }).onConflictDoNothing();
      return { saved: true };
    }),

  unsavePlace: protectedProcedure
    .input(z.object({ placeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(savedPlaces).where(
        and(eq(savedPlaces.userId, ctx.user.id), eq(savedPlaces.placeId, input.placeId))
      );
      return { saved: false };
    }),

  isSaved: protectedProcedure
    .input(z.object({ placeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.savedPlaces.findFirst({
        where: and(eq(savedPlaces.userId, ctx.user.id), eq(savedPlaces.placeId, input.placeId)),
      });
      return { saved: !!row };
    }),

  getSavedPlaces: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ placeId: savedPlaces.placeId, savedAt: savedPlaces.createdAt })
        .from(savedPlaces)
        .where(eq(savedPlaces.userId, ctx.user.id))
        .orderBy(desc(savedPlaces.createdAt));
      if (rows.length === 0) return [];
      const placeIds = rows.map((r) => r.placeId);
      const placeRows = await ctx.db
        .select()
        .from(places)
        .where(sql`${places.id} IN (${sql.join(placeIds.map((id) => sql`${id}`), sql`, `)})`);
      return placeRows;
    }),

  nearby: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().default(5),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const distanceExpr = sql<number>`(
        6371 * acos(
          cos(radians(${input.latitude})) * cos(radians(${places.latitude})) *
          cos(radians(${places.longitude}) - radians(${input.longitude})) +
          sin(radians(${input.latitude})) * sin(radians(${places.latitude}))
        )
      )`;

      const results = await ctx.db
        .select()
        .from(places)
        .where(eq(places.isActive, true))
        .orderBy(distanceExpr)
        .limit(input.limit);

      return results;
    }),
});
