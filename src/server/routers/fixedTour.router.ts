import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc, gte, inArray, type SQL } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  fixedTours,
  fixedTourSteps,
  fixedTourTags,
  activities,
  activitySlots,
  tours,
  tourStops,
  userProfiles,
} from "../db/schema";
import { rankByCosine } from "../lib/cosine";

/* ──────────────────────────────────────────────────────────────────────
 *  Zod enums — must stay in lockstep with the DB CHECK constraints in
 *  scripts/create-fixed-tour-tables.ts and the seed file.
 * ────────────────────────────────────────────────────────────────────── */
const chapterSchema = z.enum([
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
  "EVENING_SHIFT",
]);

const tagClassSchema = z.enum(["MATERIAL", "PERSONA", "KEYWORD"]);

const userVectorSchema = z
  .array(z.number().min(0).max(1))
  .length(4)
  .optional();

/**
 * Reads the user's 4-D personality vector from `user_profiles.derivedData`
 * if present. Returns null when the user has not completed the quiz yet
 * — the consumer should fall back to a default order in that case.
 */
async function getUserVector(
  ctx: { db: typeof import("../db").db; user: { id: string } | null },
): Promise<number[] | null> {
  if (!ctx.user) return null;
  const profile = await ctx.db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, ctx.user.id),
  });
  const derived = (profile?.derivedData ?? {}) as Record<string, unknown>;
  const vec = derived.personalityVector;
  if (Array.isArray(vec) && vec.length === 4 && vec.every((v) => typeof v === "number")) {
    return vec as number[];
  }
  return null;
}

/**
 * Loads tags for a set of tour IDs and groups them per tour. One query,
 * O(n) post-processing. Used by both `list` and `getById` so the wire
 * format stays consistent.
 */
async function loadTagsByTour(
  db: typeof import("../db").db,
  tourIds: readonly string[],
): Promise<Record<string, { material: string[]; persona: string[]; keyword: string[] }>> {
  if (tourIds.length === 0) return {};
  const rows = await db
    .select({
      tourId: fixedTourTags.tourId,
      tagClass: fixedTourTags.tagClass,
      tagKey: fixedTourTags.tagKey,
    })
    .from(fixedTourTags)
    .where(inArray(fixedTourTags.tourId, tourIds as string[]));

  const out: Record<string, { material: string[]; persona: string[]; keyword: string[] }> = {};
  for (const id of tourIds) {
    out[id] = { material: [], persona: [], keyword: [] };
  }
  for (const r of rows) {
    const bucket = out[r.tourId];
    if (!bucket) continue;
    if (r.tagClass === "MATERIAL") bucket.material.push(r.tagKey);
    else if (r.tagClass === "PERSONA") bucket.persona.push(r.tagKey);
    else if (r.tagClass === "KEYWORD") bucket.keyword.push(r.tagKey);
  }
  return out;
}

export const fixedTourRouter = router({
  /**
   * Lists curated Fixed Tours, optionally filtered by chapter and/or by a
   * set of MATERIAL tag keys. When the caller is signed in AND has a
   * personality vector saved, the result also carries `matchPercent` per
   * tour, sorted descending; otherwise tours are returned in canonical
   * (tour_id) order so the chapter hub renders deterministically for
   * anonymous users.
   */
  list: publicProcedure
    .input(
      z
        .object({
          chapter: chapterSchema.optional(),
          /** Comma-separated `tag_key`s in the MATERIAL class. e.g. `["#HuongMen", "#ThanhTao"]`. */
          materials: z.array(z.string().min(1).max(50)).max(10).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [eq(fixedTours.isActive, true)];
      if (input?.chapter) {
        conditions.push(eq(fixedTours.chapter, input.chapter));
      }

      // Material-tag filter joins through fixed_tour_tags. We compose it as
      // a subselect-style `IN` rather than a JOIN-DISTINCT so the SELECT
      // shape stays clean.
      let tourIdSubset: string[] | null = null;
      if (input?.materials && input.materials.length > 0) {
        const tagged = await ctx.db
          .select({ tourId: fixedTourTags.tourId })
          .from(fixedTourTags)
          .where(
            and(
              eq(fixedTourTags.tagClass, "MATERIAL"),
              inArray(fixedTourTags.tagKey, input.materials),
            ),
          );
        tourIdSubset = Array.from(new Set(tagged.map((r) => r.tourId)));
        if (tourIdSubset.length === 0) {
          return {
            tours: [],
            userHasVector: false,
            userVector: null as [number, number, number, number] | null,
          };
        }
        conditions.push(inArray(fixedTours.tourId, tourIdSubset));
      }

      const rows = await ctx.db
        .select({
          tourId: fixedTours.tourId,
          titleVi: fixedTours.titleVi,
          titleEn: fixedTours.titleEn,
          chapter: fixedTours.chapter,
          storyScriptVi: fixedTours.storyScriptVi,
          storyScriptEn: fixedTours.storyScriptEn,
          durationMinutes: fixedTours.durationMinutes,
          maxParticipants: fixedTours.maxParticipants,
          basePriceVnd: fixedTours.basePriceVnd,
          vector: fixedTours.vector,
        })
        .from(fixedTours)
        .where(and(...conditions))
        .orderBy(asc(fixedTours.tourId));

      const tagsByTour = await loadTagsByTour(
        ctx.db,
        rows.map((r) => r.tourId),
      );

      // Rank by cosine if the user has a saved vector. Otherwise return in
      // canonical tour_id order (the SELECT's ORDER BY).
      const userVec = await getUserVector(ctx);
      const baseShape = rows.map((r) => ({
        ...r,
        vector: r.vector as [number, number, number, number],
        tags: tagsByTour[r.tourId] ?? { material: [], persona: [], keyword: [] },
      }));

      if (userVec) {
        const ranked = rankByCosine(
          userVec,
          baseShape.map((b) => ({ id: b.tourId, vector: b.vector })),
        );
        const byId = new Map(baseShape.map((b) => [b.tourId, b]));
        return {
          tours: ranked
            .map((r) => {
              const base = byId.get(r.id);
              if (!base) return null;
              return { ...base, matchPercent: r.matchPercent };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null),
          userHasVector: true,
          // Exposed so client surfaces (the `/experiences` Top-Match
          // card) can compute per-axis contribution and explain WHY a
          // tour matches the user. The vector is the same 4-tuple the
          // user saw their quiz produce — no new PII surfaced.
          userVector: userVec as [number, number, number, number],
        };
      }

      return {
        tours: baseShape.map((b) => ({ ...b, matchPercent: null as number | null })),
        userHasVector: false,
        userVector: null as [number, number, number, number] | null,
      };
    }),

  /**
   * Single-tour detail with its ordered steps + grouped tags. Powers the
   * `/fixed-tours/[id]` page. Throws NOT_FOUND if the tour_id is unknown
   * or inactive.
   */
  getById: publicProcedure
    .input(z.object({ tourId: z.string().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.fixedTours.findFirst({
        where: and(
          eq(fixedTours.tourId, input.tourId),
          eq(fixedTours.isActive, true),
        ),
      });
      if (!tour) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Fixed tour ${input.tourId} not found`,
        });
      }

      const steps = await ctx.db
        .select()
        .from(fixedTourSteps)
        .where(eq(fixedTourSteps.tourId, tour.tourId))
        .orderBy(asc(fixedTourSteps.stepOrder));

      const tagsByTour = await loadTagsByTour(ctx.db, [tour.tourId]);

      // Compute matchPercent for signed-in users with a saved quiz vector.
      const userVec = await getUserVector(ctx);
      const matchPercent = userVec
        ? rankByCosine(userVec, [
            { id: tour.tourId, vector: tour.vector as [number, number, number, number] },
          ])[0].matchPercent
        : null;

      return {
        ...tour,
        vector: tour.vector as [number, number, number, number],
        steps,
        tags: tagsByTour[tour.tourId] ?? { material: [], persona: [], keyword: [] },
        matchPercent,
      };
    }),

  /**
   * Books a curated Fixed Tour. Mirrors the shape of `experience.book` so
   * downstream `/tour/[id]/active` / `/tour/[id]/checkout` continue to work
   * unchanged. Materializes `tour_stops` from `fixed_tour_steps` (using
   * lat/long when present) and writes the new `tours.fixed_tour_id` FK
   * instead of `experience_id`.
   *
   * The `requestParams.date` + `startTime` storage shape matches the
   * experience booking flow so the host dashboard + analytics queries
   * don't need a parallel reader.
   */
  book: protectedProcedure
    .input(
      z.object({
        tourId: z.string().min(1).max(30),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        groupSize: z.number().int().min(1).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.fixedTours.findFirst({
        where: and(
          eq(fixedTours.tourId, input.tourId),
          eq(fixedTours.isActive, true),
        ),
      });
      if (!tour) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Fixed tour ${input.tourId} not found`,
        });
      }
      if (input.groupSize > tour.maxParticipants) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This tour is capped at ${tour.maxParticipants} travelers per booking.`,
        });
      }
      // Solo bookings on Fixed Tours are intentionally rejected: a Fixed
      // Tour is a shared experience that needs a minimum group to run, and
      // travelers wanting a solo equivalent get pointed at the Customized
      // Tour flow (`/plan/build`) where atoms are bookable individually.
      // The error message is the literal i18n key string the UI maps to
      // a localized toast + a "Try Customized Tour" link.
      if (input.groupSize < tour.minParticipants) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This tour needs at least ${tour.minParticipants} guests. Try the Customized Tour to build the same itinerary solo.`,
          cause: { code: "FIXED_TOUR_MIN_PARTICIPANTS", minParticipants: tour.minParticipants },
        });
      }

      const steps = await ctx.db
        .select()
        .from(fixedTourSteps)
        .where(eq(fixedTourSteps.tourId, tour.tourId))
        .orderBy(asc(fixedTourSteps.stepOrder));

      // Compute the per-stop wall-clock time by adding `targetTimeOffset`
      // minutes to the requested `startTime`. Pure string math so DST /
      // timezone shifts can't surprise us.
      const [startH, startM] = input.startTime.split(":").map((n) => parseInt(n, 10));
      const startMins = startH * 60 + startM;
      const formattedSteps = steps.map((step) => {
        const total = startMins + step.targetTimeOffset;
        const h = String(Math.floor(total / 60) % 24).padStart(2, "0");
        const m = String(total % 60).padStart(2, "0");
        return {
          placeId: null,
          name: step.locationNameVi,
          nameEn: step.locationNameEn,
          category: "fixed_tour_stop",
          scheduledTime: `${h}:${m}`,
          durationMinutes: 60,
          localTip: step.actionLogVi,
          localTipEn: step.actionLogEn,
          estimatedSpend: "",
          travelToNext: "",
          latitude: step.latitude,
          longitude: step.longitude,
        };
      });

      const totalPrice = tour.basePriceVnd * input.groupSize;

      const tourPkId = await ctx.db.transaction(async (tx) => {
        const [tourRow] = await tx
          .insert(tours)
          .values({
            userId: ctx.user.id,
            fixedTourId: tour.tourId,
            status: "preview",
            packageType: "fixed_tour",
            priceAmount: totalPrice,
            priceCurrency: "VND",
            requestParams: {
              date: input.date,
              startTime: input.startTime,
              groupSize: input.groupSize,
              fixedTourId: tour.tourId,
              chapter: tour.chapter,
              durationHours: Math.ceil(tour.durationMinutes / 60),
              budgetLevel: "medium",
            },
            tourData: {
              title: tour.titleVi,
              titleEn: tour.titleEn,
              description: tour.storyScriptVi,
              descriptionEn: tour.storyScriptEn,
              stops: formattedSteps,
              totalDurationMinutes: tour.durationMinutes,
              isFromFixedTour: true,
              fixedTourId: tour.tourId,
              chapter: tour.chapter,
              pricePerPerson: tour.basePriceVnd,
              groupSize: input.groupSize,
            },
          })
          .returning({ id: tours.id });

        if (formattedSteps.length > 0) {
          await tx.insert(tourStops).values(
            formattedSteps.map((s, idx) => ({
              tourId: tourRow.id,
              placeId: s.placeId,
              stopOrder: idx,
              durationMinutes: s.durationMinutes,
            })),
          );
        }

        return tourRow.id;
      });

      return { tourId: tourPkId };
    }),

  /**
   * Rank-only query: returns `[{ tourId, matchPercent }]` for every tour
   * the user has access to. Optional `chapter` filter narrows to a single
   * time-of-day slot. Use from the home page when you only need the top
   * N tours, not the full list with bilingual text.
   *
   * When the user has no saved vector, every match is 0 and the order is
   * canonical (tour_id ascending) — UI should detect `userHasVector ===
   * false` and skip the match pill.
   */
  rank: publicProcedure
    .input(
      z
        .object({
          chapter: chapterSchema.optional(),
          userVector: userVectorSchema,
          limit: z.number().int().min(1).max(15).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [eq(fixedTours.isActive, true)];
      if (input?.chapter) {
        conditions.push(eq(fixedTours.chapter, input.chapter));
      }
      const rows = await ctx.db
        .select({
          tourId: fixedTours.tourId,
          titleVi: fixedTours.titleVi,
          titleEn: fixedTours.titleEn,
          chapter: fixedTours.chapter,
          basePriceVnd: fixedTours.basePriceVnd,
          vector: fixedTours.vector,
        })
        .from(fixedTours)
        .where(and(...conditions))
        .orderBy(asc(fixedTours.tourId));

      // Caller-provided vector wins (lets the chat page preview a ranking
      // before saving the user's quiz result). Otherwise read from the
      // saved profile.
      const userVec = input?.userVector ?? (await getUserVector(ctx));

      const baseShape = rows.map((r) => ({
        ...r,
        vector: r.vector as [number, number, number, number],
      }));

      if (!userVec) {
        const slice = input?.limit ? baseShape.slice(0, input.limit) : baseShape;
        return {
          tours: slice.map((b) => ({ ...b, matchPercent: null as number | null })),
          userHasVector: false,
        };
      }

      const ranked = rankByCosine(
        userVec,
        baseShape.map((b) => ({ id: b.tourId, vector: b.vector })),
      );
      const byId = new Map(baseShape.map((b) => [b.tourId, b]));
      const merged = ranked
        .map((r) => {
          const base = byId.get(r.id);
          if (!base) return null;
          return { ...base, matchPercent: r.matchPercent };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        tours: input?.limit ? merged.slice(0, input.limit) : merged,
        userHasVector: true,
      };
    }),

  /**
   * Internal helper exposed for the chat onboarding page to validate a
   * just-computed vector against the catalog without first saving it.
   * Identical to `rank({ userVector })` but explicit about returning
   * exactly `topN` matches.
   */
  previewRank: publicProcedure
    .input(
      z.object({
        userVector: z.array(z.number().min(0).max(1)).length(4),
        topN: z.number().int().min(1).max(15).default(3),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          tourId: fixedTours.tourId,
          titleVi: fixedTours.titleVi,
          titleEn: fixedTours.titleEn,
          chapter: fixedTours.chapter,
          vector: fixedTours.vector,
        })
        .from(fixedTours)
        .where(eq(fixedTours.isActive, true));

      const ranked = rankByCosine(
        input.userVector,
        rows.map((r) => ({
          id: r.tourId,
          vector: r.vector as [number, number, number, number],
        })),
      );
      const byId = new Map(rows.map((r) => [r.tourId, r]));
      return ranked
        .slice(0, input.topN)
        .map((r) => {
          const base = byId.get(r.id);
          if (!base) return null;
          return {
            tourId: base.tourId,
            titleVi: base.titleVi,
            titleEn: base.titleEn,
            chapter: base.chapter,
            matchPercent: r.matchPercent,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }),

  /**
   * Recipes: every active Fixed Tour rendered as an ordered list of
   * atom-activities. Feeds the "Cẩm nang Hướng dẫn" widget on
   * `/plan/build` so solo travelers can recreate any Fixed Tour
   * itinerary by adding its atoms one tap at a time.
   *
   * The query pre-resolves `earliestOpenSlotId` for every atom in a
   * single round-trip (15 tours x ~3 atoms = 45 atoms total). That way
   * the "+ Add to my day" button can fire `cart.add` directly without an
   * extra slot-lookup query per click.
   *
   * Steps that don't yet have a linked atom (curator hasn't run the
   * backfill, or the backfill skipped a step) come back with
   * `activityId: null`; the widget renders those as narrative-only.
   */
  recipes: publicProcedure.query(async ({ ctx }) => {
    const tourRows = await ctx.db
      .select()
      .from(fixedTours)
      .where(eq(fixedTours.isActive, true))
      .orderBy(asc(fixedTours.tourId));

    if (tourRows.length === 0) {
      return { recipes: [] as const };
    }

    const tourIds = tourRows.map((t) => t.tourId);
    const stepRows = await ctx.db
      .select()
      .from(fixedTourSteps)
      .where(inArray(fixedTourSteps.tourId, tourIds))
      .orderBy(asc(fixedTourSteps.tourId), asc(fixedTourSteps.stepOrder));

    // Hydrate atom details (price + photos + slug) in one shot.
    const atomIds = stepRows
      .map((s) => s.activityId)
      .filter((x): x is string => !!x);

    const atomRows = atomIds.length
      ? await ctx.db
          .select({
            id: activities.id,
            slug: activities.slug,
            priceAmount: activities.priceAmount,
            photos: activities.photos,
            durationMinutes: activities.durationMinutes,
          })
          .from(activities)
          .where(inArray(activities.id, atomIds))
      : [];
    const atomById = new Map(atomRows.map((a) => [a.id, a]));

    // Cheapest one-trip resolution of "earliest open slot per atom":
    // pull every future open slot ordered by startsAt, take the first
    // per activityId. Reasonable scale (15 tours x 3 atoms x ~6 slots).
    const now = new Date();
    const slotRows = atomIds.length
      ? await ctx.db
          .select({
            id: activitySlots.id,
            activityId: activitySlots.activityId,
            startsAt: activitySlots.startsAt,
            capacity: activitySlots.capacity,
            bookedCount: activitySlots.bookedCount,
          })
          .from(activitySlots)
          .where(
            and(
              inArray(activitySlots.activityId, atomIds),
              gte(activitySlots.startsAt, now),
              eq(activitySlots.status, "open"),
            ),
          )
          .orderBy(asc(activitySlots.startsAt))
      : [];

    const earliestSlotByAtom = new Map<string, { id: string; startsAt: Date; seatsLeft: number }>();
    for (const slot of slotRows) {
      if (earliestSlotByAtom.has(slot.activityId)) continue;
      earliestSlotByAtom.set(slot.activityId, {
        id: slot.id,
        startsAt: slot.startsAt,
        seatsLeft: slot.capacity - slot.bookedCount,
      });
    }

    // Group steps under their tour, decorated with atom + slot resolution.
    const stepsByTour = new Map<string, typeof stepRows>();
    for (const step of stepRows) {
      const list = stepsByTour.get(step.tourId) ?? [];
      list.push(step);
      stepsByTour.set(step.tourId, list);
    }

    const recipes = tourRows.map((tour) => {
      const tourSteps = stepsByTour.get(tour.tourId) ?? [];
      return {
        tourId: tour.tourId,
        titleVi: tour.titleVi,
        titleEn: tour.titleEn,
        chapter: tour.chapter,
        storyScriptVi: tour.storyScriptVi,
        storyScriptEn: tour.storyScriptEn,
        durationMinutes: tour.durationMinutes,
        minParticipants: tour.minParticipants,
        maxParticipants: tour.maxParticipants,
        basePriceVnd: tour.basePriceVnd,
        steps: tourSteps.map((step) => {
          const atom = step.activityId ? atomById.get(step.activityId) ?? null : null;
          const earliestSlot = atom ? earliestSlotByAtom.get(atom.id) ?? null : null;
          return {
            stepId: step.id,
            stepOrder: step.stepOrder,
            targetTimeOffset: step.targetTimeOffset,
            locationNameVi: step.locationNameVi,
            locationNameEn: step.locationNameEn,
            actionLogVi: step.actionLogVi,
            actionLogEn: step.actionLogEn,
            // Atom resolution — null when the curator hasn't backfilled.
            activityId: atom?.id ?? null,
            activitySlug: atom?.slug ?? null,
            atomPriceVnd: atom?.priceAmount ?? null,
            atomPhoto: atom?.photos?.[0] ?? null,
            earliestOpenSlotId: earliestSlot?.id ?? null,
            earliestSlotStartsAt: earliestSlot?.startsAt?.toISOString() ?? null,
          };
        }),
      };
    });

    return { recipes };
  }),
});

export type FixedTourChapter = z.infer<typeof chapterSchema>;
export type FixedTourTagClass = z.infer<typeof tagClassSchema>;
