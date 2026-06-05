import { z } from "zod";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { hostProcedure } from "../../trpc";
import { hostProfiles, tours, users, experiences, tourStops, places } from "../../db/schema";

// ---------------------------------------------------------------------
// Routes: stop heatmap + drill-down.
//
// "Stops" are rows in `tour_stops` that point to `places`. Each row says
// "on tour X, we visited place Y". We aggregate across all tours hosted
// by the caller to produce:
//   - heatmap markers (one per unique place, size = visit count)
//   - drill-down (list of tours + experiences that used a given place)
// ---------------------------------------------------------------------

export const hostHeatmapProcedures = {
  /**
   * Aggregated stop heatmap. Returns one row per unique place visited on
   * any of the host's tours, with `visitCount` and `experienceCount`. The
   * /host/routes page uses this to size Leaflet markers by popularity.
   * Places outside Hanoi would still appear here if the host led tours
   * there (future-proof), so we include lat/lng directly.
   */
  getStopHeatmap: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    return ctx.db
      .select({
        placeId: places.id,
        placeName: places.name,
        placeSlug: places.slug,
        category: places.category,
        latitude: places.latitude,
        longitude: places.longitude,
        visitCount: sql<string>`count(distinct ${tourStops.tourId})::text`,
        experienceCount: sql<string>`count(distinct ${tours.experienceId})::text`,
      })
      .from(tourStops)
      .innerJoin(tours, eq(tourStops.tourId, tours.id))
      .innerJoin(places, eq(tourStops.placeId, places.id))
      .where(and(
        eq(tours.hostId, host.id),
        inArray(tours.status, ["paid", "active", "completed"]),
      ))
      .groupBy(places.id, places.name, places.slug, places.category, places.latitude, places.longitude)
      .orderBy(desc(sql`count(distinct ${tourStops.tourId})`));
  }),

  /**
   * Drill-down for a specific stop: which tours + experiences passed
   * through it, which traveler was on each, status, and gross. Powers the
   * pop-over when the host clicks a marker on the routes map.
   */
  getStopDetail: hostProcedure
    .input(z.object({ placeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return null;

      const [place] = await ctx.db
        .select({
          id: places.id,
          name: places.name,
          slug: places.slug,
          category: places.category,
          latitude: places.latitude,
          longitude: places.longitude,
        })
        .from(places)
        .where(eq(places.id, input.placeId));
      if (!place) return null;

      const rows = await ctx.db
        .select({
          tourId: tours.id,
          status: tours.status,
          scheduledDate: sql<string | null>`${tours.requestParams}->>'date'`,
          experienceId: experiences.id,
          experienceTitle: experiences.title,
          travelerName: users.displayName,
          travelerAvatar: users.avatarUrl,
          grossVnd: tours.priceAmount,
        })
        .from(tourStops)
        .innerJoin(tours, eq(tourStops.tourId, tours.id))
        .leftJoin(experiences, eq(tours.experienceId, experiences.id))
        .leftJoin(users, eq(tours.userId, users.id))
        .where(and(
          eq(tourStops.placeId, input.placeId),
          eq(tours.hostId, host.id),
          inArray(tours.status, ["paid", "active", "completed"]),
        ))
        .orderBy(desc(sql`${tours.requestParams}->>'date'`))
        .limit(20);

      return { place, tours: rows };
    }),
} satisfies TRPCRouterRecord;
