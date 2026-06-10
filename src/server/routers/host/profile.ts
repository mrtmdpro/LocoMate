import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql, gte, desc, inArray } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import {
  publicProcedure,
  protectedProcedure,
  hostProcedure,
  adminProcedure,
} from "../../trpc";
import {
  hostProfiles,
  hostAvailability,
  users,
  experiences,
  activities,
} from "../../db/schema";
import { hostPublicSlug } from "../../lib/host-slug";

export const hostProfileProcedures = {
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
  }),

  // ---------------------------------------------------------------------
  // Public host profile + directory.
  //
  // Exposes *only* host-facing display data (bio, languages, specialties,
  // verification status, rating, totals). NEVER returns email, phone, or
  // identity document URLs. Deactivated user accounts 404 so a host who
  // quits the platform doesn't leave a ghost profile.
  // ---------------------------------------------------------------------

  /**
   * Public directory list. Used by /hosts index page. Supports filters for
   * specialty, language, and minimum rating. Only returns verified +
   * active hosts so anonymous browsers don't see pending / archived
   * profiles.
   */
  listPublic: publicProcedure
    .input(
      z
        .object({
          specialty: z.string().optional(),
          language: z.string().optional(),
          minRating: z.number().min(0).max(5).optional(),
          limit: z.number().int().min(1).max(50).default(24),
        })
        .default({ limit: 24 }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(hostProfiles.verificationStatus, "approved"),
        eq(users.isActive, true),
        // Require a slug so we can always construct a link target.
        sql`${hostProfiles.publicSlug} IS NOT NULL`,
      ];
      if (input.specialty) {
        // Postgres text[] membership.
        conditions.push(sql`${input.specialty} = ANY(${hostProfiles.specialties})`);
      }
      if (input.language) {
        // `languages` is a jsonb array of strings.
        conditions.push(sql`${hostProfiles.languages} @> ${JSON.stringify([input.language])}::jsonb`);
      }
      if (typeof input.minRating === "number") {
        conditions.push(gte(hostProfiles.avgRating, input.minRating.toFixed(2)));
      }

      return ctx.db
        .select({
          id: hostProfiles.id,
          slug: hostProfiles.publicSlug,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: hostProfiles.bio,
          languages: hostProfiles.languages,
          specialties: hostProfiles.specialties,
          avgRating: hostProfiles.avgRating,
          totalReviews: hostProfiles.totalReviews,
          totalTours: hostProfiles.totalTours,
          isAvailable: hostProfiles.isAvailable,
          verifiedAt: hostProfiles.verifiedAt,
        })
        .from(hostProfiles)
        .innerJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(hostProfiles.avgRating), desc(hostProfiles.totalReviews))
        .limit(input.limit);
    }),

  /**
   * Public host profile by slug. Returns host stats + their published
   * experiences + published activities + user's "saved" state (when caller
   * is authenticated). NEVER exposes PII.
   */
  getPublicProfile: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [host] = await ctx.db
        .select({
          id: hostProfiles.id,
          userId: hostProfiles.userId,
          slug: hostProfiles.publicSlug,
          bio: hostProfiles.bio,
          bioVi: hostProfiles.bioVi,
          bioEn: hostProfiles.bioEn,
          languages: hostProfiles.languages,
          specialties: hostProfiles.specialties,
          verificationStatus: hostProfiles.verificationStatus,
          verifiedAt: hostProfiles.verifiedAt,
          avgRating: hostProfiles.avgRating,
          totalReviews: hostProfiles.totalReviews,
          totalTours: hostProfiles.totalTours,
          isAvailable: hostProfiles.isAvailable,
          createdAt: hostProfiles.createdAt,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(hostProfiles)
        .innerJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(
          eq(hostProfiles.publicSlug, input.slug),
          eq(users.isActive, true),
        ));

      if (!host) throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });

      // Host-authored, published experiences.
      const hostExperiences = await ctx.db
        .select({
          id: experiences.id,
          slug: experiences.slug,
          title: experiences.title,
          titleVi: experiences.titleVi,
          titleEn: experiences.titleEn,
          subtitle: experiences.subtitle,
          subtitleVi: experiences.subtitleVi,
          subtitleEn: experiences.subtitleEn,
          category: experiences.category,
          durationMinutes: experiences.durationMinutes,
          priceAmount: experiences.priceAmount,
          photos: experiences.photos,
          avgRating: experiences.avgRating,
          totalBookings: experiences.totalBookings,
        })
        .from(experiences)
        .where(and(
          eq(experiences.authorId, host.userId),
          eq(experiences.status, "published"),
          eq(experiences.kind, "host_custom"),
        ))
        .orderBy(desc(experiences.totalBookings));

      // Host-authored, published activities.
      const hostActivities = await ctx.db
        .select({
          id: activities.id,
          slug: activities.slug,
          title: activities.title,
          subtitle: activities.subtitle,
          category: activities.category,
          durationMinutes: activities.durationMinutes,
          priceAmount: activities.priceAmount,
          photos: activities.photos,
          avgRating: activities.avgRating,
          totalBookings: activities.totalBookings,
        })
        .from(activities)
        .where(and(
          eq(activities.authorId, host.userId),
          eq(activities.status, "published"),
        ))
        .orderBy(desc(activities.totalBookings));

      return {
        host: {
          id: host.id,
          slug: host.slug,
          displayName: host.displayName,
          avatarUrl: host.avatarUrl,
          bio: host.bio,
          languages: host.languages,
          specialties: host.specialties,
          verificationStatus: host.verificationStatus,
          verifiedAt: host.verifiedAt,
          avgRating: host.avgRating,
          totalReviews: host.totalReviews,
          totalTours: host.totalTours,
          isAvailable: host.isAvailable,
          memberSince: host.createdAt,
          // Exposed so the client can pass it to chat.startWithHost.
          userId: host.userId,
        },
        experiences: hostExperiences,
        activities: hostActivities,
      };
    }),

  updateProfile: hostProcedure
    .input(z.object({
      bio: z.string().max(300).optional(),
      languages: z.array(z.string()).optional(),
      specialties: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(hostProfiles.userId, ctx.user.id))
        .returning();
      return updated;
    }),

  /**
   * One-shot host onboarding write for the /host-setup wizard. Replaces the
   * old client-side stub that discarded everything. Idempotent and safe to
   * call again as "Update profile":
   *
   *  - Ensures a `host_profiles` row exists (register-as-host creates the user
   *    with role=host but NO host_profiles row — only `becomeHost` did — so a
   *    directly-registered host had no row to update and was stuck at draft).
   *  - Persists bio / languages / specialties.
   *  - Replaces the weekly availability schedule when provided.
   *  - Backfills a `publicSlug` for legacy rows missing one.
   *  - Never touches `verificationStatus`: a brand-new row starts 'pending'
   *    (admin approves via adminVerifyHost); an already-approved host editing
   *    their profile stays approved.
   */
  completeSetup: hostProcedure
    .input(
      z.object({
        bio: z.string().max(300).optional(),
        languages: z.array(z.string()).max(12).optional(),
        specialties: z.array(z.string()).max(12).optional(),
        availability: z
          .array(
            z.object({
              dayOfWeek: z.number().int().min(0).max(6),
              startTime: z.string(),
              endTime: z.string(),
              isActive: z.boolean(),
            }),
          )
          .max(7)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });

      if (!existing) {
        await ctx.db.insert(hostProfiles).values({
          userId: ctx.user.id,
          bio: input.bio ?? null,
          languages: input.languages ?? [],
          specialties: input.specialties ?? [],
          verificationStatus: "pending",
          publicSlug: hostPublicSlug(ctx.user.displayName, ctx.user.id),
        });
      } else {
        await ctx.db
          .update(hostProfiles)
          .set({
            // Drizzle skips `undefined` keys, so omitted fields are untouched.
            bio: input.bio,
            languages: input.languages,
            specialties: input.specialties,
            ...(existing.publicSlug
              ? {}
              : { publicSlug: hostPublicSlug(ctx.user.displayName, ctx.user.id) }),
            updatedAt: new Date(),
          })
          .where(eq(hostProfiles.userId, ctx.user.id));
      }

      // Replace the weekly availability (mirrors host.setAvailability).
      if (input.availability) {
        const host = await ctx.db.query.hostProfiles.findFirst({
          where: eq(hostProfiles.userId, ctx.user.id),
        });
        if (host) {
          await ctx.db
            .delete(hostAvailability)
            .where(eq(hostAvailability.hostId, host.id));
          for (const slot of input.availability) {
            await ctx.db
              .insert(hostAvailability)
              .values({ hostId: host.id, ...slot });
          }
        }
      }

      return { success: true };
    }),

  // ---------------------------------------------------------------------
  // Admin host verification. Without an approval path, a host can never reach
  // verificationStatus='approved', and hostExperience.publish hard-requires
  // it — so no host could ever publish bookable inventory.
  // ---------------------------------------------------------------------

  /** Hosts awaiting (or returned from) review. Admin verification queue. */
  adminListPendingHosts: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        hostId: hostProfiles.id,
        userId: hostProfiles.userId,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        bio: hostProfiles.bio,
        languages: hostProfiles.languages,
        specialties: hostProfiles.specialties,
        verificationStatus: hostProfiles.verificationStatus,
        createdAt: hostProfiles.createdAt,
      })
      .from(hostProfiles)
      .innerJoin(users, eq(hostProfiles.userId, users.id))
      .where(inArray(hostProfiles.verificationStatus, ["pending", "rejected"]))
      .orderBy(desc(hostProfiles.createdAt));
  }),

  adminVerifyHost: adminProcedure
    .input(z.object({ hostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.id, input.hostId),
      });
      if (!host) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
      }
      // Guarantee a slug so the approved host is immediately listable.
      let slugPatch: { publicSlug?: string } = {};
      if (!host.publicSlug) {
        const u = await ctx.db.query.users.findFirst({
          where: eq(users.id, host.userId),
        });
        slugPatch = { publicSlug: hostPublicSlug(u?.displayName ?? null, host.userId) };
      }
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({
          verificationStatus: "approved",
          verifiedAt: new Date(),
          ...slugPatch,
          updatedAt: new Date(),
        })
        .where(eq(hostProfiles.id, input.hostId))
        .returning();
      return updated;
    }),

  adminRejectHost: adminProcedure
    .input(z.object({ hostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({ verificationStatus: "rejected", updatedAt: new Date() })
        .where(eq(hostProfiles.id, input.hostId))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
      }
      return updated;
    }),
} satisfies TRPCRouterRecord;
