import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray, type SQL } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { experiences, users, hostProfiles, tours, tourStops, places } from "../db/schema";
import { matchLabelToPlace } from "@/lib/place-match";
import { vietnamDayBoundsUtc } from "@/lib/time";
import { tourTimeWindow } from "@/lib/tour-time";
import { overlapsAny } from "@/lib/cart-conflicts";

// Shared set of experience columns surfaced to the client. Explicit list so
// schema additions (e.g. internal review notes) never accidentally leak via
// `.select()`. Keep in sync with src/test/fixtures.ts assertions.
//
// Bilingual columns: every customer-visible text field has both `_vi` and
// `_en` siblings alongside the legacy non-suffixed column. The UI picks the
// right field via `pickLocaleField(row, "title", locale)` so the router
// stays locale-agnostic and the response cache key isn't fragmented.
const experienceColumns = {
  id: experiences.id,
  title: experiences.title,
  titleVi: experiences.titleVi,
  titleEn: experiences.titleEn,
  slug: experiences.slug,
  subtitle: experiences.subtitle,
  subtitleVi: experiences.subtitleVi,
  subtitleEn: experiences.subtitleEn,
  description: experiences.description,
  descriptionVi: experiences.descriptionVi,
  descriptionEn: experiences.descriptionEn,
  category: experiences.category,
  durationMinutes: experiences.durationMinutes,
  priceAmount: experiences.priceAmount,
  maxGroupSize: experiences.maxGroupSize,
  photos: experiences.photos,
  highlights: experiences.highlights,
  highlightsVi: experiences.highlightsVi,
  highlightsEn: experiences.highlightsEn,
  included: experiences.included,
  includedVi: experiences.includedVi,
  includedEn: experiences.includedEn,
  schedule: experiences.schedule,
  scheduleVi: experiences.scheduleVi,
  scheduleEn: experiences.scheduleEn,
  hostRequired: experiences.hostRequired,
  avgRating: experiences.avgRating,
  totalBookings: experiences.totalBookings,
  kind: experiences.kind,
  status: experiences.status,
  authorId: experiences.authorId,
  publishedAt: experiences.publishedAt,
  createdAt: experiences.createdAt,
  // Author info -- nullable columns when the experience is curated (authorId
  // is null) and the left join returns no row.
  authorDisplayName: users.displayName,
  authorAvatarUrl: users.avatarUrl,
  // publicSlug is the URL handle for the host's profile page at
  // `/hosts/:authorSlug`. Null for curated experiences.
  authorSlug: hostProfiles.publicSlug,
  hostBio: hostProfiles.bio,
  hostBioVi: hostProfiles.bioVi,
  hostBioEn: hostProfiles.bioEn,
  hostAvgRating: hostProfiles.avgRating,
  hostTotalReviews: hostProfiles.totalReviews,
  hostLanguages: hostProfiles.languages,
};

/** Parses Vietnam-local YYYY-MM-DD back into a Date for "is in the past?" checks. */
function isDateInPastVietnam(isoDate: string): boolean {
  return isoDate < vietnamDayBoundsUtc().isoDate;
}

/**
 * Returns true iff the string is an ISO 8601 calendar-valid YYYY-MM-DD.
 * Rejects impossibilities like 2026-02-31 or 2026-13-01 that pass the regex
 * alone. Used on `book` input so bogus dates cannot be persisted and then
 * silently vanish from the host dashboard's `requestParams->>'date'` filter.
 */
function isCalendarValidIsoDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === isoDate;
}

export const experienceRouter = router({
  /**
   * Public marketplace listing. Always filters `status='published'` so
   * drafts/archived/rejected listings never leak to travelers.
   */
  list: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          kind: z.enum(["curated", "host_custom", "all"]).optional().default("all"),
          authorId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [
        eq(experiences.isActive, true),
        eq(experiences.status, "published"),
      ];
      if (input?.category) {
        conditions.push(eq(experiences.category, input.category));
      }
      if (input?.kind && input.kind !== "all") {
        conditions.push(eq(experiences.kind, input.kind));
      }
      if (input?.authorId) {
        conditions.push(eq(experiences.authorId, input.authorId));
      }

      return ctx.db
        .select(experienceColumns)
        .from(experiences)
        // Authors who have deactivated their account must not leak via the
        // join. `users.isActive=false` produces null author columns, which
        // the UI treats the same as a curated listing.
        .leftJoin(
          users,
          and(eq(experiences.authorId, users.id), eq(users.isActive, true)),
        )
        .leftJoin(hostProfiles, eq(users.id, hostProfiles.userId))
        .where(and(...conditions))
        .orderBy(desc(experiences.totalBookings));
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select(experienceColumns)
        .from(experiences)
        .leftJoin(
          users,
          and(eq(experiences.authorId, users.id), eq(users.isActive, true)),
        )
        .leftJoin(hostProfiles, eq(users.id, hostProfiles.userId))
        .where(
          and(
            eq(experiences.slug, input.slug),
            eq(experiences.isActive, true),
            eq(experiences.status, "published"),
          ),
        );
      return rows[0] ?? null;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select(experienceColumns)
        .from(experiences)
        .leftJoin(
          users,
          and(eq(experiences.authorId, users.id), eq(users.isActive, true)),
        )
        .leftJoin(hostProfiles, eq(users.id, hostProfiles.userId))
        .where(
          and(
            eq(experiences.id, input.id),
            eq(experiences.isActive, true),
            eq(experiences.status, "published"),
          ),
        );
      return rows[0] ?? null;
    }),

  /**
   * Books a published experience. Persists a `tours` row with
   * `status='preview'` and redirects the UI into the existing /checkout flow.
   *
   * Authoritative fields (never trusted from the client):
   *   - priceAmount comes from the experience row.
   *   - hostId resolves from authorId->hostProfiles.id.
   *   - tourData (title/description/stops) is built from experience fields.
   *
   * Client-supplied fields (revalidated):
   *   - date must be today-or-future in Vietnam time.
   *   - groupSize in [1, experience.maxGroupSize].
   *   - startTime matches HH:MM format.
   */
  book: protectedProcedure
    .input(
      z.object({
        experienceId: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date YYYY-MM-DD"),
        startTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM"),
        groupSize: z.number().int().min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const experience = await ctx.db.query.experiences.findFirst({
        where: and(
          eq(experiences.id, input.experienceId),
          eq(experiences.status, "published"),
          eq(experiences.isActive, true),
        ),
      });
      if (!experience) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Experience not available",
        });
      }
      // Belt-and-suspenders: host_custom listings whose author has been
      // deleted (authorId=NULL via FK SET NULL) should be unbookable.
      // deleteAccount archives these up front, but an edge case (direct DB
      // write, future admin tooling) could still orphan a published row.
      if (experience.kind === "host_custom" && !experience.authorId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This experience is no longer available.",
        });
      }

      const maxGroupSize = experience.maxGroupSize ?? 1;
      if (input.groupSize > maxGroupSize) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This experience fits a maximum of ${maxGroupSize} travelers.`,
        });
      }

      if (!isCalendarValidIsoDate(input.date)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Booking date is not a valid calendar date.",
        });
      }
      if (isDateInPastVietnam(input.date)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Booking date must be today or later.",
        });
      }

      // Resolve hostProfile from the experience author, if any. Re-check
      // verificationStatus at booking time so a host that gets their
      // verification revoked AFTER publishing cannot silently keep accepting
      // paid bookings. Curated experiences (authorId=null) skip this.
      let hostProfileId: string | null = null;
      if (experience.authorId) {
        const host = await ctx.db.query.hostProfiles.findFirst({
          where: and(
            eq(hostProfiles.userId, experience.authorId),
            eq(hostProfiles.verificationStatus, "approved"),
          ),
        });
        if (!host) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This experience is temporarily unavailable. Please try another.",
          });
        }
        // Host must also be accepting bookings. tour.assignHost already
        // enforces this; mirroring here so the direct experience.book path
        // doesn't silently schedule a paused host.
        if (host.isAvailable === false) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This host is currently paused and not accepting new bookings.",
          });
        }
        hostProfileId = host.id;
      }

      // Compute the proposed booking window up-front so we can use it
      // for the traveler-side overlap check below AND the host-side
      // collision check (Phase 2).
      const proposedWindow = tourTimeWindow({
        date: input.date,
        startTime: input.startTime,
        durationHours: Math.ceil(experience.durationMinutes / 60),
      });

      // Traveler-side collision: user cannot book a tour that overlaps
      // any tour they've ALREADY paid for. Preview/cancelled/refunded
      // tours don't block (they represent no commitment).
      if (proposedWindow) {
        const userPaidTours = await ctx.db
          .select({
            id: tours.id,
            requestParams: tours.requestParams,
          })
          .from(tours)
          .where(
            and(
              eq(tours.userId, ctx.user.id),
              inArray(tours.status, ["paid", "active", "completed"]),
            ),
          );
        const userWindows = userPaidTours
          .map((t) => tourTimeWindow(t.requestParams as Record<string, unknown> | null))
          .filter((w): w is NonNullable<typeof w> => !!w);
        if (overlapsAny(proposedWindow, userWindows)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "You already have a booking at this time. Pick another slot or cancel the other booking first.",
          });
        }
      }

      // Host-side collision: a single host cannot physically run two tours
      // at the same time. Block if any OTHER traveler has already PAID
      // (or started / completed) a booking with this host in an overlapping
      // window. Preview tours are NOT considered "the host's schedule"
      // because travelers routinely abandon them.
      if (proposedWindow && hostProfileId) {
        const hostBookedTours = await ctx.db
          .select({
            id: tours.id,
            requestParams: tours.requestParams,
          })
          .from(tours)
          .where(
            and(
              eq(tours.hostId, hostProfileId),
              inArray(tours.status, ["paid", "active", "completed"]),
            ),
          );
        const hostWindows = hostBookedTours
          .map((t) => tourTimeWindow(t.requestParams as Record<string, unknown> | null))
          .filter((w): w is NonNullable<typeof w> => !!w);
        if (overlapsAny(proposedWindow, hostWindows)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "This host is already booked at that time. Please pick another slot.",
          });
        }
      }

      // `experience.schedule` is shaped `[{ time, label }]` -- a narrative
      // timeline the host writes in the publish wizard. The active-tour
      // page, however, renders a `TourStop` shape (placeId, name,
      // scheduledTime, durationMinutes, localTip, latitude, longitude).
      // Without the transform below, every stop on /tour/[id]/active
      // renders blank because `stop.name` is `undefined` (the raw entry
      // has `label`, not `name`).
      //
      // We also best-effort match each label against `places.name` so we
      // can attach lat/lng for the map overlay. Unmatched stops still
      // render fine; they just don't appear as pins on the map.
      const scheduleRaw = (
        Array.isArray(experience.schedule) ? experience.schedule : []
      ) as Array<{ time?: unknown; label?: unknown }>;

      const allPlaces = await ctx.db
        .select({
          id: places.id,
          name: places.name,
          latitude: places.latitude,
          longitude: places.longitude,
          category: places.category,
        })
        .from(places);

      const perStopDuration = Math.max(
        15,
        Math.round(experience.durationMinutes / Math.max(1, scheduleRaw.length)),
      );

      const scheduleStops = scheduleRaw.map((entry) => {
        const label = typeof entry.label === "string" ? entry.label : "";
        const time = typeof entry.time === "string" ? entry.time : "";
        // Token-overlap match: catches "Meet at Hoan Kiem Lake" -> "Hoan
        // Kiem Lake & Ngoc Son Temple" which a plain substring match misses.
        const match = matchLabelToPlace(label, allPlaces);
        return {
          placeId: match?.id ?? null,
          name: label || match?.name || "Stop",
          category: match?.category ?? experience.category,
          scheduledTime: time,
          durationMinutes: perStopDuration,
          localTip: "",
          estimatedSpend: "",
          travelToNext: "",
          latitude: match ? Number(match.latitude) : null,
          longitude: match ? Number(match.longitude) : null,
        };
      });

      // Experience priceAmount is the PER-PERSON rate (labelled "VND / person"
      // on the listing + detail stats). tours.priceAmount persists the total
      // charge so /checkout and the payment row see a single authoritative
      // number. Dialog total, tour total, and checkout total all agree.
      const totalPrice = experience.priceAmount * input.groupSize;

      // Wrap the tour + tour_stops inserts in a transaction so a partial
      // write (e.g. valid tour but failed stops insert) never leaves the
      // UI with a tour it can't render. Also enables the /host/routes
      // heatmap to include these bookings via matched tour_stops.place_id.
      const tourId = await ctx.db.transaction(async (tx) => {
        const [tourRow] = await tx
          .insert(tours)
          .values({
            userId: ctx.user.id,
            hostId: hostProfileId,
            experienceId: experience.id,
            status: "preview",
            packageType: "host_experience",
            priceAmount: totalPrice,
            priceCurrency: "VND",
            requestParams: {
              date: input.date,
              startTime: input.startTime,
              groupSize: input.groupSize,
              withHost: !!hostProfileId,
              interests: [experience.category],
              durationHours: Math.ceil(experience.durationMinutes / 60),
              budgetLevel: "medium",
            },
            tourData: {
              title: experience.title,
              description: experience.description ?? "",
              stops: scheduleStops,
              totalDurationMinutes: experience.durationMinutes,
              isFromExperience: true,
              experienceId: experience.id,
              pricePerPerson: experience.priceAmount,
              groupSize: input.groupSize,
            },
          })
          .returning({ id: tours.id });

        // Insert one tour_stops row per schedule entry. Entries without a
        // matched place still get a row (place_id=null) so stop_order stays
        // contiguous; the routes heatmap's INNER JOIN on places naturally
        // excludes them from the aggregation.
        if (scheduleStops.length > 0) {
          await tx.insert(tourStops).values(
            scheduleStops.map((s, idx) => ({
              tourId: tourRow.id,
              placeId: s.placeId,
              stopOrder: idx,
              durationMinutes: s.durationMinutes,
            })),
          );
        }

        return tourRow.id;
      });

      return { tourId };
    }),

  /**
   * Helper the checkout / confirmation page uses to show a friendly list of
   * a user's recent experience-backed tours. Protected because it exposes
   * tour history.
   */
  getMyBookings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        tourId: tours.id,
        tourStatus: tours.status,
        experienceId: experiences.id,
        title: experiences.title,
        slug: experiences.slug,
        priceAmount: tours.priceAmount,
        createdAt: tours.createdAt,
      })
      .from(tours)
      .innerJoin(experiences, eq(tours.experienceId, experiences.id))
      .where(
        and(
          eq(tours.userId, ctx.user.id),
          inArray(tours.status, ["preview", "paid", "active", "completed"]),
        ),
      )
      .orderBy(desc(tours.createdAt));
  }),
});
