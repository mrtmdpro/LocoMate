import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql, gte, lte, desc, asc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, hostProcedure } from "../trpc";
import {
  activities,
  activitySlots,
  users,
  hostProfiles,
  places,
  fixedTourSteps,
  fixedTours,
} from "../db/schema";
import { slugify } from "@/lib/slugify";
import type { db as serverDb } from "../db";

/**
 * Activity (a-la-carte ticket / workshop / class / performance) router.
 *
 * Distinguished from `experience.router`:
 *   - experiences = bundled Fixed Tours (stays the same)
 *   - activities  = individual tickets a traveler mixes into a day via the
 *                   cart + timeline builder.
 *
 * Lifecycle mirrors host experiences (draft -> published -> archived) so
 * hosts have one mental model for "publishing stuff on LOCOMATE".
 */

// Columns a public caller is allowed to see. No author PII beyond what the
// host intentionally exposes via hostProfiles.
//
// Bilingual columns: every customer-visible text field has both `_vi` and
// `_en` siblings alongside the legacy non-suffixed column. The UI calls
// `pickLocaleField(row, "title", locale)` to choose the right one.
const activityPublicColumns = {
  id: activities.id,
  title: activities.title,
  titleVi: activities.titleVi,
  titleEn: activities.titleEn,
  slug: activities.slug,
  subtitle: activities.subtitle,
  subtitleVi: activities.subtitleVi,
  subtitleEn: activities.subtitleEn,
  description: activities.description,
  descriptionVi: activities.descriptionVi,
  descriptionEn: activities.descriptionEn,
  category: activities.category,
  priceAmount: activities.priceAmount,
  currency: activities.currency,
  durationMinutes: activities.durationMinutes,
  maxCapacityPerSlot: activities.maxCapacityPerSlot,
  placeId: activities.placeId,
  photos: activities.photos,
  highlights: activities.highlights,
  highlightsVi: activities.highlightsVi,
  highlightsEn: activities.highlightsEn,
  included: activities.included,
  includedVi: activities.includedVi,
  includedEn: activities.includedEn,
  requirements: activities.requirements,
  requirementsVi: activities.requirementsVi,
  requirementsEn: activities.requirementsEn,
  guideOptional: activities.guideOptional,
  guideAddonVnd: activities.guideAddonVnd,
  status: activities.status,
  avgRating: activities.avgRating,
  totalBookings: activities.totalBookings,
  publishedAt: activities.publishedAt,
  authorId: activities.authorId,
  // Atom provenance — set on backfilled atoms, null on host-authored
  // activities. The list query joins through `fixed_tour_steps` →
  // `fixed_tours` to surface the parent tour's title for the "From: X"
  // badge on /activities cards.
  sourceFixedTourStepId: activities.sourceFixedTourStepId,
} as const;

async function findUniqueActivitySlug(
  db: typeof serverDb,
  base: string,
  excludeId?: string,
): Promise<string> {
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await db.query.activities.findFirst({
      where: excludeId
        ? and(eq(activities.slug, slug), sql`${activities.id} <> ${excludeId}`)
        : eq(activities.slug, slug),
    });
    if (!existing) return slug;
    slug = `${base}-${n++}`;
    if (n > 200) throw new Error("Could not find unique slug");
  }
}

export const activityRouter = router({
  /**
   * Public list. Filters: category, hostAuthorId, price range. Pagination is
   * offset-based for MVP simplicity.
   */
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        authorId: z.string().uuid().optional(),
        maxPriceVnd: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      }).default({ limit: 20, offset: 0 }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(activities.status, "published")];
      if (input.category) conditions.push(eq(activities.category, input.category));
      if (input.authorId) conditions.push(eq(activities.authorId, input.authorId));
      if (input.maxPriceVnd) conditions.push(lte(activities.priceAmount, input.maxPriceVnd));

      return ctx.db
        .select({
          ...activityPublicColumns,
          authorDisplayName: users.displayName,
          authorAvatar: users.avatarUrl,
          authorSlug: hostProfiles.publicSlug,
          placeName: places.name,
          placeNameVi: places.nameVi,
          placeNameEn: places.nameEn,
          placeLatitude: places.latitude,
          placeLongitude: places.longitude,
          // Source-tour resolution for the "From: <Tour Title>" badge.
          // Both joins are LEFT — atoms have these populated, normal
          // host-authored activities pass through with nulls.
          sourceTourId: fixedTours.tourId,
          sourceTourTitleVi: fixedTours.titleVi,
          sourceTourTitleEn: fixedTours.titleEn,
        })
        .from(activities)
        .leftJoin(users, eq(activities.authorId, users.id))
        .leftJoin(hostProfiles, eq(hostProfiles.userId, users.id))
        .leftJoin(places, eq(activities.placeId, places.id))
        .leftJoin(fixedTourSteps, eq(activities.sourceFixedTourStepId, fixedTourSteps.id))
        .leftJoin(fixedTours, eq(fixedTourSteps.tourId, fixedTours.tourId))
        .where(and(...conditions))
        .orderBy(desc(activities.publishedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * Public detail by slug. Does NOT return slots -- call getSlots separately
   * for that (slots change frequently, so we cache them on a shorter TTL).
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          ...activityPublicColumns,
          authorDisplayName: users.displayName,
          authorAvatar: users.avatarUrl,
          authorSlug: hostProfiles.publicSlug,
          authorBio: hostProfiles.bio,
          authorBioVi: hostProfiles.bioVi,
          authorBioEn: hostProfiles.bioEn,
          authorLanguages: hostProfiles.languages,
          placeName: places.name,
          placeNameVi: places.nameVi,
          placeNameEn: places.nameEn,
          placeAddress: places.address,
          placeLatitude: places.latitude,
          placeLongitude: places.longitude,
        })
        .from(activities)
        .leftJoin(users, eq(activities.authorId, users.id))
        .leftJoin(hostProfiles, eq(hostProfiles.userId, users.id))
        .leftJoin(places, eq(activities.placeId, places.id))
        .where(and(eq(activities.slug, input.slug), eq(activities.status, "published")));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" });
      return row;
    }),

  /**
   * Upcoming slots for an activity. Returns only open / not-full / future
   * slots by default so the picker doesn't render garbage.
   */
  getSlots: publicProcedure
    .input(
      z.object({
        activityId: z.string().uuid(),
        includeSoldOut: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const conditions = [
        eq(activitySlots.activityId, input.activityId),
        gte(activitySlots.startsAt, now),
      ];
      if (!input.includeSoldOut) {
        conditions.push(eq(activitySlots.status, "open"));
      }
      return ctx.db
        .select()
        .from(activitySlots)
        .where(and(...conditions))
        .orderBy(asc(activitySlots.startsAt))
        .limit(40);
    }),

  // -------------------------------------------------------------------
  // Host-facing CRUD. All write paths require `hostProcedure` so only
  // verified hosts (or admins) can touch the catalogue.
  // -------------------------------------------------------------------

  listMine: hostProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(activities)
      .where(eq(activities.authorId, ctx.user.id))
      .orderBy(desc(activities.createdAt));
  }),

  create: hostProcedure
    .input(
      z.object({
        title: z.string().min(8).max(200),
        subtitle: z.string().max(300).optional(),
        description: z.string().max(5000).optional(),
        category: z.string().min(2).max(40),
        priceAmount: z.number().int().min(50_000).max(5_000_000),
        durationMinutes: z.number().int().min(30).max(720),
        maxCapacityPerSlot: z.number().int().min(1).max(30),
        placeId: z.string().uuid().optional(),
        photos: z.array(z.string().url()).max(6).default([]),
        highlights: z.array(z.string()).max(8).default([]),
        included: z.array(z.string()).max(8).default([]),
        requirements: z.array(z.string()).max(8).default([]),
        guideOptional: z.boolean().default(true),
        guideAddonVnd: z.number().int().min(0).max(2_000_000).default(200_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.title);
      const slug = await findUniqueActivitySlug(ctx.db, base);
      const [created] = await ctx.db
        .insert(activities)
        .values({
          ...input,
          slug,
          authorId: ctx.user.id,
          status: "draft",
        })
        .returning();
      return created;
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(8).max(200).optional(),
          subtitle: z.string().max(300).optional(),
          description: z.string().max(5000).optional(),
          category: z.string().min(2).max(40).optional(),
          priceAmount: z.number().int().min(50_000).max(5_000_000).optional(),
          durationMinutes: z.number().int().min(30).max(720).optional(),
          maxCapacityPerSlot: z.number().int().min(1).max(30).optional(),
          placeId: z.string().uuid().nullable().optional(),
          photos: z.array(z.string().url()).max(6).optional(),
          highlights: z.array(z.string()).max(8).optional(),
          included: z.array(z.string()).max(8).optional(),
          requirements: z.array(z.string()).max(8).optional(),
          guideOptional: z.boolean().optional(),
          guideAddonVnd: z.number().int().min(0).max(2_000_000).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, input.id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your activity" });
      }
      // Published activities are locked except for price + photo fields; force
      // archive-and-republish for structural edits to protect booked customers.
      if (existing.status === "published") {
        const structural = ["title", "description", "durationMinutes", "category"] as const;
        for (const key of structural) {
          if (key in input.patch) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Cannot edit ${key} while published. Archive, edit, and republish instead.`,
            });
          }
        }
      }
      const [updated] = await ctx.db
        .update(activities)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(eq(activities.id, input.id))
        .returning();
      return updated;
    }),

  publish: hostProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, input.id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your activity" });
      }
      if (existing.status === "published") {
        return existing; // idempotent
      }
      // Content checks -- mirror host-experience.publish gate rules.
      if (!existing.description || existing.description.length < 50) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Description must be at least 50 characters" });
      }
      if (!Array.isArray(existing.photos) || existing.photos.length < 1) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "At least 1 photo is required" });
      }
      if (!Array.isArray(existing.highlights) || existing.highlights.length < 2) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "At least 2 highlights are required" });
      }
      // Host must be verified to publish.
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (ctx.user.role !== "admin" && (!host || host.verificationStatus !== "approved")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Complete host verification before publishing",
        });
      }

      const [updated] = await ctx.db
        .update(activities)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(activities.id, input.id))
        .returning();
      return updated;
    }),

  archive: hostProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, input.id),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your activity" });
      }
      const [updated] = await ctx.db
        .update(activities)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(activities.id, input.id))
        .returning();
      return updated;
    }),

  // -------------------------------------------------------------------
  // Slot management -- hosts manage their own calendar.
  // -------------------------------------------------------------------

  addSlot: hostProcedure
    .input(
      z.object({
        activityId: z.string().uuid(),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        capacity: z.number().int().min(1).max(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, input.activityId),
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      if (activity.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (new Date(input.endsAt) <= new Date(input.startsAt)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "endsAt must be after startsAt" });
      }
      // Cap the slot's capacity at the activity's advertised
      // maxCapacityPerSlot so travelers don't see a slot holding more
      // people than the listing promised. Also keeps the per-slot UX
      // consistent with the activity's description.
      if (input.capacity > activity.maxCapacityPerSlot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Slot capacity cannot exceed the activity's max of ${activity.maxCapacityPerSlot}.`,
        });
      }
      // Overlap check across ALL of this host's slots (not just slots on
      // this one activity). A host cannot physically run two activities
      // simultaneously, so an overlap -- even with a different activity
      // they own -- is a scheduling error.
      if (ctx.user.role !== "admin") {
        const siblingSlots = await ctx.db
          .select({
            startsAt: activitySlots.startsAt,
            endsAt: activitySlots.endsAt,
          })
          .from(activitySlots)
          .innerJoin(activities, eq(activitySlots.activityId, activities.id))
          .where(
            and(
              eq(activities.authorId, ctx.user.id),
              eq(activitySlots.status, "open"),
            ),
          );
        const proposedStart = new Date(input.startsAt).getTime();
        const proposedEnd = new Date(input.endsAt).getTime();
        for (const existing of siblingSlots) {
          const eStart = existing.startsAt.getTime();
          const eEnd = existing.endsAt.getTime();
          if (proposedStart < eEnd && eStart < proposedEnd) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "This slot overlaps another of your scheduled slots. Move it to a free window.",
            });
          }
        }
      }
      const [slot] = await ctx.db
        .insert(activitySlots)
        .values({
          activityId: input.activityId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          capacity: input.capacity,
        })
        .returning();
      return slot;
    }),

  removeSlot: hostProcedure
    .input(z.object({ slotId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [slot] = await ctx.db
        .select({ activityId: activitySlots.activityId, bookedCount: activitySlots.bookedCount })
        .from(activitySlots)
        .where(eq(activitySlots.id, input.slotId));
      if (!slot) throw new TRPCError({ code: "NOT_FOUND" });
      const activity = await ctx.db.query.activities.findFirst({
        where: eq(activities.id, slot.activityId),
      });
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      if (activity.authorId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (slot.bookedCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot remove a slot with existing bookings",
        });
      }
      await ctx.db.delete(activitySlots).where(eq(activitySlots.id, input.slotId));
      return { ok: true };
    }),

  // Bulk fetch by id set. Used by cart to validate + hydrate line labels.
  getManyByIds: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(20) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      return ctx.db
        .select(activityPublicColumns)
        .from(activities)
        .where(inArray(activities.id, input.ids));
    }),
});
