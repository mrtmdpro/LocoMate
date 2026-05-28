import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, ne, sql, asc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { tours, tourStops, userProfiles, hostProfiles, places, experiences } from "../db/schema";
import { generateTour } from "../services/_legacy/tour-engine";
import { computeTourPrice } from "@/lib/pricing";
import { llmGenerate, type AiTone } from "../services/llm";
import { lookupFixedTourCategory } from "../lib/fixed-tour-category";

export const tourRouter = router({
  create: protectedProcedure
    .input(z.object({
      date: z.string(),
      startTime: z.string(),
      durationHours: z.number().min(2).max(6),
      budgetLevel: z.enum(["low", "medium", "high"]),
      interests: z.array(z.string()).min(1),
      withHost: z.boolean().default(false),
      groupSize: z.number().min(1).max(4).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });

      const tourResult = await generateTour(
        { userId: ctx.user.id, ...input },
        (profile?.derivedData as Record<string, unknown>) || {}
      );

      const [tour] = await ctx.db
        .insert(tours)
        .values({
          userId: ctx.user.id,
          status: "preview",
          requestParams: input,
          tourData: tourResult,
          packageType: tourResult.packageType,
          priceAmount: tourResult.priceAmount,
        })
        .returning();

      for (let i = 0; i < tourResult.stops.length; i++) {
        const stop = tourResult.stops[i];
        await ctx.db.insert(tourStops).values({
          tourId: tour.id,
          placeId: stop.placeId,
          stopOrder: i,
          durationMinutes: stop.durationMinutes,
          notes: stop.localTip,
        });
      }

      return tour;
    }),

  getPreview: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour || tour.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const data = tour.tourData as Record<string, unknown>;
      const allStops = (data.stops as unknown[]) || [];
      const previewStops = allStops.slice(0, 3);
      const lockedCount = allStops.length - previewStops.length;

      return {
        ...tour,
        tourData: { ...data, stops: previewStops, lockedStops: lockedCount, isPreview: true },
      };
    }),

  getFullTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour || tour.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (tour.status !== "paid" && tour.status !== "active" && tour.status !== "completed") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tour not unlocked. Please complete payment." });
      }

      // Hydrate each stop with the latest lat/lng from places so the active-
      // tour map always uses live coordinates even if the snapshot in
      // `tour_data.stops` is stale (legacy tour) or was never populated
      // (legacy experience.book bug). tour_stops rows (when present) are
      // the authoritative order-preserving source of truth; we fall back
      // to the JSON stops for older tours that predate the tour_stops
      // insert.
      const hydratedStops = await ctx.db
        .select({
          stopOrder: tourStops.stopOrder,
          placeId: tourStops.placeId,
          name: places.name,
          category: places.category,
          latitude: places.latitude,
          longitude: places.longitude,
          address: places.address,
        })
        .from(tourStops)
        .leftJoin(places, eq(tourStops.placeId, places.id))
        .where(eq(tourStops.tourId, input.tourId))
        .orderBy(tourStops.stopOrder);

      return {
        ...tour,
        // `stopLocations` maps stop_order -> { lat, lng, placeName } when
        // a place is linked. The client merges this against its
        // tour_data.stops array by index so every stop gets the freshest
        // coordinates without requiring a tour_data rewrite.
        stopLocations: hydratedStops.map((s) => ({
          stopOrder: s.stopOrder,
          placeId: s.placeId,
          placeName: s.name,
          category: s.category,
          latitude: s.latitude !== null ? Number(s.latitude) : null,
          longitude: s.longitude !== null ? Number(s.longitude) : null,
          address: s.address,
        })),
      };
    }),

  startTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({ where: eq(tours.id, input.tourId) });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });
      if (tour.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });
      if (tour.status !== "paid") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Tour must be paid before starting" });

      const [updated] = await ctx.db
        .update(tours)
        .set({ status: "active", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(tours.id, input.tourId))
        .returning();
      return updated;
    }),

  markStopVisited: protectedProcedure
    .input(z.object({ stopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const stop = await ctx.db.query.tourStops.findFirst({ where: eq(tourStops.id, input.stopId) });
      if (!stop) throw new TRPCError({ code: "NOT_FOUND" });
      const tour = await ctx.db.query.tours.findFirst({ where: eq(tours.id, stop.tourId) });
      if (!tour || tour.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour stop" });

      const [updated] = await ctx.db
        .update(tourStops)
        .set({ visitedAt: new Date() })
        .where(eq(tourStops.id, input.stopId))
        .returning();
      return updated;
    }),

  completeTour: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({ where: eq(tours.id, input.tourId) });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });
      if (tour.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });
      if (tour.status !== "active") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Tour must be active to complete" });

      const [updated] = await ctx.db
        .update(tours)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(tours.id, input.tourId))
        .returning();

      // Phase A.6 — schedule the digital thank-you letter to land an hour
      // after completion. Wrapped in try/catch so a letter failure can't
      // block the tour-complete response; the cron will catch up later
      // if the schedule succeeds but rendering doesn't.
      try {
        const { scheduleThankYouLetter } = await import("../services/thank-you-letter");
        await scheduleThankYouLetter(ctx.db, input.tourId, ctx.user.id, 60);
      } catch (err) {
        console.error("scheduleThankYouLetter failed", { tourId: input.tourId, err });
      }

      // Wrap-up coupon — 10% off the next tour, 90-day expiry, single-use.
      // Same best-effort + idempotent contract as the thank-you letter:
      // wrapped in try/catch so coupon issuance can't block the
      // tour-complete response, and idempotent via the partial unique
      // index on (source_tour_id) WHERE kind='wrap_up' so a re-run of
      // completeTour returns the existing row.
      try {
        const { issueWrapUpCoupon } = await import("../services/wrap-up-coupon");
        await issueWrapUpCoupon(ctx.db, input.tourId, ctx.user.id);
      } catch (err) {
        console.error("issueWrapUpCoupon failed", { tourId: input.tourId, err });
      }
      return updated;
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tours)
      .where(eq(tours.userId, ctx.user.id))
      .orderBy(desc(tours.createdAt));
  }),

  // Assigns a host to a traveler's tour. Called from /tour/[id]/hosts when
  // the user picks a host card for an algorithmically-generated tour. The
  // mutation validates:
  //   - tour ownership (caller owns the tour)
  //   - tour is still in a pre-paid state (can't reassign after payment)
  //   - tour is NOT an experience-backed booking (host + price are fixed)
  //   - host exists, is available, is approved
  // Without this link the /host dashboard would permanently render an empty
  // state (the `tours.hostId` column was never populated by any mutation).
  assignHost: protectedProcedure
    .input(z.object({
      tourId: z.string().uuid(),
      hostId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      if (tour.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });
      }
      if (tour.status !== "preview") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Host can only be assigned before checkout",
        });
      }
      // Experience-backed and Fixed-Tour-backed bookings both have their
      // host, price, and itinerary pinned at booking time. Letting
      // `assignHost` overwrite those fields would let a traveler swap in
      // a cheaper algorithmic price tier on top of a premium template.
      if (
        tour.experienceId ||
        tour.fixedTourId ||
        tour.packageType === "host_experience" ||
        tour.packageType === "fixed_tour"
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This tour was booked from a template; host is already assigned.",
        });
      }

      const host = await ctx.db.query.hostProfiles.findFirst({
        where: and(
          eq(hostProfiles.id, input.hostId),
          eq(hostProfiles.isAvailable, true),
          eq(hostProfiles.verificationStatus, "approved"),
        ),
      });
      if (!host) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Host is not available",
        });
      }

      // Adding a host is a pricing event. Recompute the tour price treating
      // withHost=true using the original groupSize so /checkout charges what
      // the host-picker and preview page advertise. Without this, a user who
      // created a self-guided tour (250k) and then added a host would be
      // shown a "+500,000 VND" label but charged only 250k.
      const params = (tour.requestParams ?? {}) as {
        withHost?: boolean;
        groupSize?: number;
      };
      const groupSize = typeof params.groupSize === "number" ? params.groupSize : 1;
      const newPrice = computeTourPrice({ withHost: true, groupSize });
      const newPackageType = groupSize > 1 ? "social_tour" : "solo_mate";

      const [updated] = await ctx.db
        .update(tours)
        .set({
          hostId: host.id,
          priceAmount: newPrice,
          packageType: newPackageType,
          requestParams: { ...params, withHost: true, groupSize },
          updatedAt: new Date(),
        })
        .where(eq(tours.id, input.tourId))
        .returning();

      return { hostId: updated.hostId, priceAmount: updated.priceAmount };
    }),

  /**
   * Phase A.9 — Dynamic Re-routing AI mockup.
   *
   * On the active-tour screen the user (or guide) hits "Báo cáo sự cố"
   * with a reason (rain / closure / discomfort / other). We return three
   * nearby places via the proximity logic from Phase A.5, then ask the
   * LLM service for a one-line italic-serif rationale per swap.
   *
   * Implementation notes:
   *   - This procedure does NOT mutate the tour. The client decides whether
   *     to swap; the actual itinerary write goes through `addHost` /
   *     `completeStop` later.
   *   - With `LLM_MOCK_MODE=true` the rationale is one of 3 canned
   *     Vietnamese sentences per (tone, category).
   *   - Tone is read from the user's saved `aiTone`, defaulting to
   *     `thu-thi`.
   *   - We need a lat/lng to centre the search. Use the most recently
   *     visited tour stop's place — that's where the user actually is.
   *     If no stop has been visited yet, fall back to the tour's first
   *     stop with a place reference.
   */
  proposeAlternatives: protectedProcedure
    .input(
      z.object({
        tourId: z.string().uuid(),
        reason: z.enum(["rain", "closed", "discomfort", "other"]),
        radiusKm: z.number().min(0.2).max(5).default(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });
      if (tour.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });

      // Find the user's current locus: most recently visited stop's place;
      // fallback to the first stop with a place; ultimate fallback Hoàn Kiếm.
      const stops = await ctx.db
        .select()
        .from(tourStops)
        .where(eq(tourStops.tourId, input.tourId))
        .orderBy(desc(tourStops.visitedAt), asc(tourStops.stopOrder));
      const referenceStop = stops.find((s) => s.placeId);
      let centerLat = 21.0288;
      let centerLng = 105.8525;
      let originName = "Hồ Hoàn Kiếm";
      if (referenceStop?.placeId) {
        const place = await ctx.db.query.places.findFirst({
          where: eq(places.id, referenceStop.placeId),
        });
        if (place) {
          centerLat = place.latitude;
          centerLng = place.longitude;
          originName = place.name;
        }
      }

      // Same Haversine pattern as place.getNearby — different filter
      // (don't bias toward visitCount; the user wants the most-fit, not
      // the most-hidden).
      const distanceExpr = sql<number>`(
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(${centerLat})) * cos(radians(${places.latitude})) *
            cos(radians(${places.longitude}) - radians(${centerLng})) +
            sin(radians(${centerLat})) * sin(radians(${places.latitude}))
          ))
        )
      )`;

      const excludeIds = stops
        .map((s) => s.placeId)
        .filter((id): id is string => !!id);
      const baseWhere = and(
        eq(places.isActive, true),
        sql`${distanceExpr} <= ${input.radiusKm}`,
      );

      const rows = await ctx.db
        .select({
          id: places.id,
          name: places.name,
          slug: places.slug,
          category: places.category,
          latitude: places.latitude,
          longitude: places.longitude,
          address: places.address,
          photos: places.photos,
          priceRange: places.priceRange,
          avgRating: places.avgRating,
          distanceKm: distanceExpr,
        })
        .from(places)
        .where(
          excludeIds.length > 0
            ? and(
                baseWhere,
                sql`${places.id} NOT IN (${sql.join(excludeIds.map((id) => sql`${id}`), sql`, `)})`,
                ne(places.id, referenceStop?.placeId ?? "00000000-0000-0000-0000-000000000000"),
              )
            : baseWhere,
        )
        .orderBy(distanceExpr)
        .limit(3);

      // Pull tone + nickname for the LLM call.
      const profile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (profile?.explicitData ?? {}) as { nickname?: string; aiTone?: AiTone };

      // Rationales in parallel — mocked in Phase A so 3 calls cost nothing.
      const rationales = await Promise.all(
        rows.map((p) =>
          llmGenerate({
            feature: "rerouting-rationale",
            prompt: `from=${originName} to=${p.name} category=${p.category} reason=${input.reason}`,
            user: { nickname: explicit.nickname, tone: explicit.aiTone },
          }),
        ),
      );

      return {
        origin: { name: originName, latitude: centerLat, longitude: centerLng },
        reason: input.reason,
        alternatives: rows.map((p, i) => ({
          ...p,
          walkMinutes: Math.max(1, Math.round((p.distanceKm * 1000) / 80)),
          rationale: rationales[i],
        })),
      };
    }),

  /**
   * Phase A.10 — Wrap-up storytelling pages.
   *
   * Returns an ordered array of wrap-up pages for a completed (or active)
   * tour:
   *   1. Cover — nickname + tour title
   *   2..N-1. One per visited stop, with an italic-serif paragraph
   *           generated by the LLM service.
   *   3. Closer — total walk time + stops + brand sign-off.
   *
   * Designed to be called once when the /wrap-up page mounts. The LLM
   * generates paragraphs in parallel; in mock mode that's near-instant.
   */
  getWrapUpPages: protectedProcedure
    .input(z.object({ tourId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND" });
      if (tour.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });

      const profile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicit = (profile?.explicitData ?? {}) as { nickname?: string; aiTone?: AiTone };
      const nickname = explicit.nickname?.trim() || "Lữ khách";
      const tone = explicit.aiTone ?? "thu-thi";

      const td = tour.tourData as
        | { title?: string; stops?: { name?: string; category?: string; placeId?: string }[] }
        | null;
      const title = td?.title ?? "Một ngày Hà Nội";
      const stops = (td?.stops ?? []).filter((s) => s?.name).slice(0, 5);

      const stopParagraphs = await Promise.all(
        stops.map((s) =>
          llmGenerate({
            feature: "wrap-up-page",
            prompt: `tour=${input.tourId} stop=${s.name} category=${s.category ?? ""}`,
            user: { nickname, tone },
          }),
        ),
      );

      // Pull a category for the closer copy. Experience-backed tours
      // read `experiences.category` directly; Fixed-Tour-backed tours
      // derive a synthetic category from their MATERIAL tag so the
      // wrap-up closer renders brand-correct copy for both catalogs.
      let experienceCategory: string | undefined;
      if (tour.experienceId) {
        const exp = await ctx.db.query.experiences.findFirst({
          where: eq(experiences.id, tour.experienceId),
        });
        experienceCategory = exp?.category;
      } else if (tour.fixedTourId) {
        experienceCategory =
          (await lookupFixedTourCategory(ctx.db, tour.fixedTourId)) ?? undefined;
      }

      // Infographic stats — totalMinutes, totalKm, personaAxisKey.
      // Derived once here so the wrap-up page renders a stable shape
      // (the UI hides the km row when it comes back null).
      const { deriveWrapUpStats } = await import("../services/wrap-up-stats");
      const stats = await deriveWrapUpStats(
        ctx.db,
        tour,
        profile?.derivedData as Record<string, unknown> | null | undefined,
      );

      return {
        nickname,
        tone,
        cover: {
          kind: "cover" as const,
          eyebrow: "Một ngày của",
          name: nickname,
          title,
          tagline: "Locomate wrap-up · Cuốn sổ ký ức số",
        },
        stops: stops.map((s, i) => ({
          kind: "stop" as const,
          name: s.name ?? `Điểm ${i + 1}`,
          category: s.category ?? "cultural",
          paragraph: stopParagraphs[i],
        })),
        stats,
        closer: {
          kind: "closer" as const,
          totalStops: stops.length,
          category: experienceCategory,
          signOff: closerSignOff(experienceCategory),
        },
      };
    }),
});

function closerSignOff(category?: string): string {
  switch (category) {
    case "thanh-tao-xu-bac":
      return "Hẹn gặp dưới một mái ngói khác.";
    case "hon-dat-nghe-nhan":
      return "Đôi tay đã chạm vào nghề — không quên được nữa.";
    case "huong-men-nong-say":
      return "Vị giác là cửa ngõ, và bạn đã mở.";
    default:
      return "Hà Nội vẫn còn vài món chưa kể.";
  }
}
