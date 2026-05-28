import { z } from "zod";
import { eq, and, ilike, ne, sql, desc, asc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { places, savedPlaces } from "../db/schema";

export const placeRouter = router({
  getFeed: publicProcedure
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

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(places)
        .where(and(...conditions));

      const results = await ctx.db
        .select()
        .from(places)
        .where(and(...conditions))
        .orderBy(desc(places.visitCount))
        .limit(input.limit)
        .offset(input.offset);

      return { places: results, total: Number(countResult?.count ?? 0) };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const place = await ctx.db.query.places.findFirst({
        where: eq(places.id, input.id),
      });
      return place;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(250) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.places.findFirst({
        where: eq(places.slug, input.slug),
      });
    }),

  getByIds: publicProcedure
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

  nearby: publicProcedure
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
        .where(and(eq(places.isActive, true), sql`${distanceExpr} <= ${input.radiusKm}`))
        .orderBy(distanceExpr)
        .limit(input.limit);

      return results;
    }),

  /**
   * Phase A.5 — Proximity Smart Suggestion (a.k.a. "vòng tròn vệ tinh").
   *
   * Given a seed place, return up to `limit` nearby hidden-gem candidates
   * within `radiusKm`. "Hidden gem" is sorted by `visitCount ASC` so the
   * lesser-known places surface first — exactly the value-add the doc
   * promises ("ngõ ngách không có trên Google Maps").
   *
   * Implementation: Haversine on the existing `(latitude, longitude)` btree
   * index. PostGIS isn't required because the result set is tiny and the
   * places table is < 1k rows in the Hanoi pilot.
   *
   * Returns the seed place's coordinates alongside the matches so the
   * client can render the satellite ring without a second round-trip.
   */
  getNearby: publicProcedure
    .input(z.object({
      placeId: z.string().uuid(),
      radiusKm: z.number().min(0.1).max(10).default(1.5),
      limit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const seed = await ctx.db.query.places.findFirst({
        where: eq(places.id, input.placeId),
      });
      if (!seed) return { seed: null, nearby: [] as Array<typeof places.$inferSelect & { distanceKm: number }> };

      const distanceExpr = sql<number>`(
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(${seed.latitude})) * cos(radians(${places.latitude})) *
            cos(radians(${places.longitude}) - radians(${seed.longitude})) +
            sin(radians(${seed.latitude})) * sin(radians(${places.latitude}))
          ))
        )
      )`;

      const rows = await ctx.db
        .select({
          // Spread every column so the client can render any place field
          // (photos, slug, category) without a second fetch.
          id: places.id,
          name: places.name,
          nameVi: places.nameVi,
          nameEn: places.nameEn,
          slug: places.slug,
          description: places.description,
          descriptionVi: places.descriptionVi,
          descriptionEn: places.descriptionEn,
          category: places.category,
          latitude: places.latitude,
          longitude: places.longitude,
          address: places.address,
          photos: places.photos,
          openingHours: places.openingHours,
          priceRange: places.priceRange,
          experienceTags: places.experienceTags,
          emotionalTags: places.emotionalTags,
          source: places.source,
          isVerified: places.isVerified,
          isActive: places.isActive,
          contributedBy: places.contributedBy,
          avgRating: places.avgRating,
          totalReviews: places.totalReviews,
          visitCount: places.visitCount,
          createdAt: places.createdAt,
          updatedAt: places.updatedAt,
          distanceKm: distanceExpr,
        })
        .from(places)
        .where(
          and(
            eq(places.isActive, true),
            ne(places.id, input.placeId),
            sql`${distanceExpr} <= ${input.radiusKm}`,
          ),
        )
        // Hidden-gem-first ordering: lower visitCount wins, tie-break by
        // distance (closer wins) so the result feels physically coherent.
        .orderBy(asc(places.visitCount), distanceExpr)
        .limit(input.limit);

      return {
        seed: { id: seed.id, name: seed.name, latitude: seed.latitude, longitude: seed.longitude },
        nearby: rows,
      };
    }),
});
