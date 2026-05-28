import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, sql, gte, lte, desc } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, hostProcedure } from "../trpc";
import { hostProfiles, hostAvailability, tours, users, userProfiles, payments, experiences, activities, hostPayouts, tourStops, places, savedHosts } from "../db/schema";
import { vietnamDayBoundsUtc, vnLocalDate } from "@/lib/time";
import { HOST_TOUR_PRICING, computeHostPayout } from "@/lib/pricing";

export const hostRouter = router({
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

  setAvailability: hostProcedure
    .input(z.object({
      slots: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        isActive: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return;

      await ctx.db.delete(hostAvailability).where(eq(hostAvailability.hostId, host.id));

      for (const slot of input.slots) {
        await ctx.db.insert(hostAvailability).values({ hostId: host.id, ...slot });
      }
      return { success: true };
    }),

  getBookings: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    return ctx.db
      .select()
      .from(tours)
      .where(and(eq(tours.hostId, host.id)));
  }),

  getAvailableHosts: protectedProcedure
    .input(z.object({ interests: z.array(z.string()).optional() }))
    .query(async ({ ctx }) => {
      const hosts = await ctx.db
        .select({
          id: hostProfiles.id,
          userId: hostProfiles.userId,
          bio: hostProfiles.bio,
          languages: hostProfiles.languages,
          specialties: hostProfiles.specialties,
          avgRating: hostProfiles.avgRating,
          totalReviews: hostProfiles.totalReviews,
          totalTours: hostProfiles.totalTours,
          verificationStatus: hostProfiles.verificationStatus,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(hostProfiles)
        .innerJoin(users, eq(hostProfiles.userId, users.id))
        .where(and(
          eq(hostProfiles.isAvailable, true),
          eq(hostProfiles.verificationStatus, "approved")
        ));

      return hosts;
    }),

  // Everything the /host dashboard renders in a single round-trip:
  //   - Host lifetime stats (from hostProfiles)
  //   - Today's bookings (tours assigned to this host, scheduled today,
  //     status paid or active)
  //   - Today's revenue (sum of succeeded payments for this host's tours)
  // `hostProcedure` already enforces the role gate; we additionally scope
  // every query by `host.id` so a host can only see their own rows.
  getDashboard: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return null;

    const today = vietnamDayBoundsUtc();

    // Three parallel queries: today's bookings, today's revenue, and the
    // host's marketplace listings grouped by status. All filter on host.id
    // (scoped to the authenticated host).
    const [todaysBookings, todaysRevenueRow, listingStatusRows] = await Promise.all([
      ctx.db
        .select({
          id: tours.id,
          status: tours.status,
          scheduledStart: sql<string | null>`${tours.requestParams}->>'startTime'`,
          // Prefer the experience title (canonical) over whatever tour.tourData
          // stored; the join is LEFT so algorithmic bookings with no
          // experienceId still return their stored title.
          tourTitle: sql<string | null>`COALESCE(${experiences.title}, ${tours.tourData}->>'title')`,
          experienceId: tours.experienceId,
          travelerName: users.displayName,
          travelerAvatar: users.avatarUrl,
        })
        .from(tours)
        .innerJoin(users, eq(tours.userId, users.id))
        .leftJoin(experiences, eq(tours.experienceId, experiences.id))
        .where(and(
          eq(tours.hostId, host.id),
          inArray(tours.status, ["paid", "active"]),
          eq(sql`${tours.requestParams}->>'date'`, today.isoDate),
        )),
      ctx.db
        .select({ sum: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
        .from(payments)
        .innerJoin(tours, eq(payments.tourId, tours.id))
        .where(and(
          eq(tours.hostId, host.id),
          eq(payments.status, "succeeded"),
          gte(payments.paidAt, today.start),
          lte(payments.paidAt, today.end),
        )),
      ctx.db
        .select({
          status: experiences.status,
          count: sql<string>`count(*)::text`,
        })
        .from(experiences)
        .where(eq(experiences.authorId, ctx.user.id))
        .groupBy(experiences.status),
    ]);
    // Aggregate always returns exactly one row with a non-null string.
    const todaysRevenueVnd = Number(todaysRevenueRow[0].sum);

    // Fold the grouped listing-status rows into a flat {published, draft,
    // archived} shape the UI can render without further processing. Unknown
    // statuses (e.g. future 'rejected') are intentionally dropped so a UI
    // regression can't lie about counts.
    const myListingsCount: { published: number; draft: number; archived: number } = {
      published: 0,
      draft: 0,
      archived: 0,
    };
    for (const row of listingStatusRows) {
      if (row.status === "published") myListingsCount.published = Number(row.count);
      else if (row.status === "draft") myListingsCount.draft = Number(row.count);
      else if (row.status === "archived") myListingsCount.archived = Number(row.count);
    }

    return {
      host: {
        isAvailable: host.isAvailable,
        avgRating: host.avgRating,
        totalReviews: host.totalReviews,
        totalTours: host.totalTours,
      },
      todaysBookings,
      todaysRevenueVnd,
      todayIsoDate: today.isoDate,
      myListingsCount,
    };
  }),

  // Rolling-window earnings summary for the host dashboard snapshot card.
  // Buckets are computed against Vietnam-local day boundaries so "today" /
  // "this week" align with how the host thinks about their calendar, not
  // whatever timezone the server happens to run in.
  //
  // Only `succeeded` payments count (pending/refunded/failed are excluded).
  getEarningsSummary: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return null;

    const today = vietnamDayBoundsUtc();
    const weekStart = new Date(today.start.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(today.start.getTime() - 29 * 24 * 60 * 60 * 1000);

    // Same Drizzle gotcha as getEarningsHero: Date interpolated directly into
    // a `sql\`\`` template crashes the postgres-js bind step with
    // ERR_INVALID_ARG_TYPE. Pass ISO strings + ::timestamptz casts instead.
    const todayStart = today.start.toISOString();
    const todayEnd = today.end.toISOString();
    const weekStartIso = weekStart.toISOString();
    const monthStartIso = monthStart.toISOString();

    // Aggregate in one round-trip with FILTER clauses so we don't pay for
    // 4 separate queries.
    const [row] = await ctx.db
      .select({
        today: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${todayStart}::timestamptz and ${payments.paidAt} <= ${todayEnd}::timestamptz), 0)::text`,
        week: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${weekStartIso}::timestamptz and ${payments.paidAt} <= ${todayEnd}::timestamptz), 0)::text`,
        month: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${monthStartIso}::timestamptz and ${payments.paidAt} <= ${todayEnd}::timestamptz), 0)::text`,
        allTime: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
        bookingCount: sql<string>`count(distinct ${tours.id})::text`,
      })
      .from(payments)
      .innerJoin(tours, eq(payments.tourId, tours.id))
      .where(and(
        eq(tours.hostId, host.id),
        eq(payments.status, "succeeded"),
      ));

    return {
      todayVnd: Number(row.today),
      weekVnd: Number(row.week),
      monthVnd: Number(row.month),
      allTimeVnd: Number(row.allTime),
      lifetimeBookings: Number(row.bookingCount),
    };
  }),

  // All upcoming (future-dated) bookings for this host, ordered by scheduled
  // date. Powers the dashboard "This week" preview and the /host/bookings
  // page's Upcoming tab. Status filter: paid + active (assigned + in progress).
  getUpcomingBookings: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    const today = vietnamDayBoundsUtc();

    return ctx.db
      .select({
        id: tours.id,
        status: tours.status,
        scheduledDate: sql<string | null>`${tours.requestParams}->>'date'`,
        scheduledStart: sql<string | null>`${tours.requestParams}->>'startTime'`,
        groupSize: sql<string | null>`${tours.requestParams}->>'groupSize'`,
        tourTitle: sql<string | null>`coalesce(${experiences.title}, ${tours.tourData}->>'title')`,
        priceAmount: tours.priceAmount,
        experienceId: tours.experienceId,
        travelerName: users.displayName,
        travelerAvatar: users.avatarUrl,
        // Surfaced on the host UI so the host can greet the guest in their
        // language. Comes from `user_profiles.explicit_data.languages`,
        // written by Profile → Spoken languages. Older accounts (before
        // the picker existed) may have no entry; the UI renders nothing
        // when this is empty/null.
        travelerLanguages: sql<string[] | null>`${userProfiles.explicitData}->'languages'`,
      })
      .from(tours)
      .innerJoin(users, eq(tours.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(experiences, eq(tours.experienceId, experiences.id))
      .where(and(
        eq(tours.hostId, host.id),
        inArray(tours.status, ["paid", "active"]),
        // Only bookings scheduled today or later. Past paid-but-uncompleted
        // tours are an edge case (host no-show / traveler ghosted) -- those
        // surface under the Past tab of /host/bookings.
        gte(sql`${tours.requestParams}->>'date'`, today.isoDate),
      ))
      .orderBy(sql`${tours.requestParams}->>'date'`, sql`${tours.requestParams}->>'startTime'`);
  }),

  // Past bookings (completed OR scheduled before today). Powers the Past tab
  // on /host/bookings and is useful for future review prompts.
  getPastBookings: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    const today = vietnamDayBoundsUtc();

    return ctx.db
      .select({
        id: tours.id,
        status: tours.status,
        scheduledDate: sql<string | null>`${tours.requestParams}->>'date'`,
        scheduledStart: sql<string | null>`${tours.requestParams}->>'startTime'`,
        groupSize: sql<string | null>`${tours.requestParams}->>'groupSize'`,
        tourTitle: sql<string | null>`coalesce(${experiences.title}, ${tours.tourData}->>'title')`,
        priceAmount: tours.priceAmount,
        travelerName: users.displayName,
        travelerAvatar: users.avatarUrl,
        completedAt: tours.completedAt,
        travelerLanguages: sql<string[] | null>`${userProfiles.explicitData}->'languages'`,
      })
      .from(tours)
      .innerJoin(users, eq(tours.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(experiences, eq(tours.experienceId, experiences.id))
      .where(and(
        eq(tours.hostId, host.id),
        // Either completed, OR scheduled in the past while still paid/active
        // (i.e. should have happened by now).
        sql`(
          ${tours.status} = 'completed'
          OR (${tours.status} IN ('paid', 'active') AND ${tours.requestParams}->>'date' < ${today.isoDate})
        )`,
      ))
      .orderBy(desc(sql`${tours.requestParams}->>'date'`));
  }),

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

  // ---------------------------------------------------------------------
  // Cashflow: balance / revenue / payments / commission / payouts.
  //
  // All procedures here are server-authoritative and host-scoped. A host
  // cannot see another host's numbers even if they hand-craft a request.
  // The math uses `succeeded` payments only; pending/refunded/failed are
  // reported separately so the dashboard can be transparent.
  //
  // KNOWN LIMITATION: these procedures join payments -> tours via
  // payments.tourId. The Apr 2026 product pivot added a second payment
  // shape where payments.orderId is set and tourId is null (multi-line
  // orders created via cart.createFromCart). Host earnings on
  // order-linked payments are NOT surfaced here yet; an order-aware
  // rollup will land as a separate procedure once the new cart flow has
  // real transaction volume to validate against. See the integration
  // test "KNOWN LIMITATION: order-linked payments do not appear in host
  // earnings yet" in host.router.test.ts -- failing it means someone
  // fixed the gap.
  // ---------------------------------------------------------------------

  /**
   * Current balance snapshot. "Available" = succeeded payments whose linked
   * tour is completed (money has been fully earned). "Pending" = succeeded
   * payments whose tour hasn't been completed yet (money is earmarked but
   * not earnable until the tour actually runs). "In review" is reserved for
   * disputed/refunded holds.
   *
   * "Next payout" is derived: for MVP, we simulate a weekly cadence paying
   * out every Monday. The forecast amount is `available - already-paid-for-
   * that-period`. Actual settlement is FOLLOW-08.
   */
  getBalance: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return null;

    // Gross + refunds in a single trip, faceted by tour completion status.
    const [row] = await ctx.db
      .select({
        availableGross: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded' and ${tours.status} = 'completed'), 0)::text`,
        pendingGross: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded' and ${tours.status} <> 'completed'), 0)::text`,
        refunded: sql<string>`coalesce(sum(${payments.refundAmount}) filter (where ${payments.status} = 'refunded'), 0)::text`,
        inFlight: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'pending'), 0)::text`,
      })
      .from(payments)
      .innerJoin(tours, eq(payments.tourId, tours.id))
      .where(eq(tours.hostId, host.id));

    const availableGross = Number(row.availableGross);
    const pendingGross = Number(row.pendingGross);
    const refunded = Number(row.refunded);
    const inFlight = Number(row.inFlight);

    // Net to host = gross minus 20% commission, minus refunds that occurred
    // inside "available" (pre-commission on the refunded row).
    const commissionRate = HOST_TOUR_PRICING.commissionRate;
    const availableNet = Math.round(availableGross * (1 - commissionRate)) - refunded;
    const pendingNet = Math.round(pendingGross * (1 - commissionRate));

    // Subtract payouts that have already been paid out against "available".
    const [paidOut] = await ctx.db
      .select({
        total: sql<string>`coalesce(sum(${hostPayouts.amount}) filter (where ${hostPayouts.status} = 'paid'), 0)::text`,
      })
      .from(hostPayouts)
      .where(eq(hostPayouts.hostId, host.id));
    const alreadyPaidOut = Number(paidOut.total);
    const availableToPayOut = Math.max(0, availableNet - alreadyPaidOut);

    // Forecast: next Monday's payout amount. If today IS Monday, show the
    // following Monday so the label is always future-tense.
    const now = new Date();
    const nextPayoutDate = new Date(now);
    const dow = now.getUTCDay();
    const daysUntilNextMonday = ((8 - dow) % 7) || 7;
    nextPayoutDate.setUTCDate(now.getUTCDate() + daysUntilNextMonday);
    nextPayoutDate.setUTCHours(9, 0, 0, 0); // 09:00 UTC = 16:00 VN

    return {
      availableVnd: availableToPayOut,
      pendingVnd: pendingNet,
      inReviewVnd: inFlight, // reusing 'in-flight' pending payments as "in review"
      refundedVnd: refunded,
      lifetimePayoutsVnd: alreadyPaidOut,
      nextPayoutVnd: availableToPayOut, // what would settle on nextPayoutDate
      nextPayoutDate: nextPayoutDate.toISOString(),
      currency: HOST_TOUR_PRICING.currency,
    };
  }),

  /**
   * Revenue buckets by day for the last N days. Returns an array with one
   * entry per calendar day in ascending order; days with zero bookings still
   * appear (value = 0) so the client chart can render a continuous x-axis
   * without gaps.
   *
   * `offsetDays` shifts the window into the past. `days=30, offsetDays=30`
   * gives the previous 30-day period relative to today, letting the client
   * compute period-over-period deltas without a dedicated endpoint.
   */
  getRevenueByDay: hostProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).default(30),
          offsetDays: z.number().int().min(0).max(365).default(0),
        })
        .default({ days: 30, offsetDays: 0 }),
    )
    .query(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return [];

      const today = vietnamDayBoundsUtc();
      // Anchor: the VN-local end of the current window shifted back by
      // `offsetDays`. For offset=0 this is literally today; for offset=30
      // it's the end of the "previous 30 days" window.
      const anchorEnd = new Date(today.end.getTime() - input.offsetDays * 86400_000);
      const anchorStart = new Date(today.start.getTime() - input.offsetDays * 86400_000);
      const startDate = new Date(anchorStart.getTime() - (input.days - 1) * 86400_000);

      // Query all succeeded payments in the window and bucket by calendar
      // day in application code. Doing the bucketing in SQL would require
      // CTE + generate_series which PGlite handles but is more complex to
      // read for marginal perf gain on 30-day windows.
      const rows = await ctx.db
        .select({
          amount: payments.amount,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .innerJoin(tours, eq(payments.tourId, tours.id))
        .where(and(
          eq(tours.hostId, host.id),
          eq(payments.status, "succeeded"),
          gte(payments.paidAt, startDate),
          lte(payments.paidAt, anchorEnd),
        ));

      // Bucket keys are Vietnam-local calendar days (see `vnLocalDate` in
      // lib/time.ts) so the chart aligns with how the host thinks about
      // their week, not whatever UTC offset the host's device happens to
      // render in.
      const buckets = new Map<string, number>();
      for (let d = 0; d < input.days; d++) {
        const day = new Date(startDate.getTime() + d * 86400_000);
        buckets.set(vnLocalDate(day), 0);
      }
      for (const r of rows) {
        if (!r.paidAt) continue;
        const key = vnLocalDate(r.paidAt);
        // Payments whose VN-local date falls outside the pre-populated
        // range are dropped rather than creating extra buckets. This can
        // only happen at the window edges due to clock drift / leap-second
        // quirks; dropping them is safe because the WHERE already filters
        // the coarse timestamp range.
        if (!buckets.has(key)) continue;
        const prev = buckets.get(key) ?? 0;
        buckets.set(key, prev + r.amount);
      }

      const commissionRate = HOST_TOUR_PRICING.commissionRate;
      return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, grossVnd]) => ({
          date,
          grossVnd,
          commissionVnd: Math.round(grossVnd * commissionRate),
          netVnd: grossVnd - Math.round(grossVnd * commissionRate),
        }));
    }),

  /**
   * Single-round-trip headline stats for the earnings page hero.
   * Returns current and previous-period totals so the client can render a
   * big number with a trend chevron (+12% vs previous) without a second
   * call. Booking count is denormalised for the "N bookings" subtitle.
   */
  getEarningsHero: hostProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 }))
    .query(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return null;

      const today = vietnamDayBoundsUtc();
      // Symmetric window math: current window spans `days` calendar days
      // ending at today.end; previous window spans the same number of days
      // ending at the instant immediately before currentStart. Using this
      // form (rather than `currentStart - 1ms - days*86400`) keeps the
      // sum of prev-period chart bars equal to hero.previousVnd, which is
      // useful for invariant tests and debugging.
      const currentStart = new Date(today.start.getTime() - (input.days - 1) * 86400_000);
      const previousStart = new Date(today.start.getTime() - (2 * input.days - 1) * 86400_000);
      const previousEnd = new Date(currentStart.getTime() - 1);

      // Pass timestamps as ISO strings + explicit ::timestamptz casts.
      // Drizzle's `sql\`\`` template hands Date params to postgres-js as raw
      // objects, which postgres-js cannot serialise directly -- it throws
      // "ERR_INVALID_ARG_TYPE: received an instance of Date" at bind time.
      // The ISO-string form is the documented Drizzle pattern and works
      // identically under PGlite (tests) and Neon (production).
      const curStart = currentStart.toISOString();
      const curEnd = today.end.toISOString();
      const prevStart = previousStart.toISOString();
      const prevEnd = previousEnd.toISOString();

      // Aggregate both windows in a single query using FILTER clauses.
      const [row] = await ctx.db
        .select({
          current: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${curStart}::timestamptz and ${payments.paidAt} <= ${curEnd}::timestamptz and ${payments.status} = 'succeeded'), 0)::text`,
          previous: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.paidAt} >= ${prevStart}::timestamptz and ${payments.paidAt} <= ${prevEnd}::timestamptz and ${payments.status} = 'succeeded'), 0)::text`,
          currentBookings: sql<string>`count(distinct ${tours.id}) filter (where ${payments.paidAt} >= ${curStart}::timestamptz and ${payments.paidAt} <= ${curEnd}::timestamptz and ${payments.status} = 'succeeded')::text`,
          previousBookings: sql<string>`count(distinct ${tours.id}) filter (where ${payments.paidAt} >= ${prevStart}::timestamptz and ${payments.paidAt} <= ${prevEnd}::timestamptz and ${payments.status} = 'succeeded')::text`,
        })
        .from(payments)
        .innerJoin(tours, eq(payments.tourId, tours.id))
        .where(eq(tours.hostId, host.id));

      const currentVnd = Number(row.current);
      const previousVnd = Number(row.previous);
      const commissionRate = HOST_TOUR_PRICING.commissionRate;

      return {
        currentVnd,
        previousVnd,
        currentNetVnd: currentVnd - Math.round(currentVnd * commissionRate),
        currentCommissionVnd: Math.round(currentVnd * commissionRate),
        currentBookings: Number(row.currentBookings),
        previousBookings: Number(row.previousBookings),
        days: input.days,
        commissionRate,
      };
    }),

  /**
   * Per-experience performance summary. Drives the "By experience" table on
   * the earnings page so the host can see which listing earns the most,
   * which has the best rating, and when it was last booked.
   */
  getRevenueByExperience: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return [];

    const rows = await ctx.db
      .select({
        experienceId: experiences.id,
        title: experiences.title,
        slug: experiences.slug,
        avgRating: experiences.avgRating,
        status: experiences.status,
        bookingCount: sql<string>`count(distinct ${tours.id}) filter (where ${tours.hostId} = ${host.id} and ${payments.status} = 'succeeded')::text`,
        grossVnd: sql<string>`coalesce(sum(${payments.amount}) filter (where ${tours.hostId} = ${host.id} and ${payments.status} = 'succeeded'), 0)::text`,
        // Return the raw timestamp (not ::text) -- the default driver
        // serialisation returns an ISO string which every JS engine parses
        // consistently. `::text` yielded Postgres's space-separated format
        // which JavaScriptCore occasionally rejects.
        lastBookedAt: sql<Date | null>`max(${payments.paidAt}) filter (where ${tours.hostId} = ${host.id} and ${payments.status} = 'succeeded')`,
      })
      .from(experiences)
      .leftJoin(tours, eq(tours.experienceId, experiences.id))
      .leftJoin(payments, eq(payments.tourId, tours.id))
      .where(eq(experiences.authorId, ctx.user.id))
      .groupBy(experiences.id, experiences.title, experiences.slug, experiences.avgRating, experiences.status)
      .orderBy(desc(sql`coalesce(sum(${payments.amount}) filter (where ${tours.hostId} = ${host.id} and ${payments.status} = 'succeeded'), 0)`));

    const commissionRate = HOST_TOUR_PRICING.commissionRate;
    return rows.map((r) => {
      const gross = Number(r.grossVnd);
      const commission = Math.round(gross * commissionRate);
      return {
        experienceId: r.experienceId,
        title: r.title,
        slug: r.slug,
        status: r.status,
        avgRating: r.avgRating,
        bookingCount: Number(r.bookingCount),
        grossVnd: gross,
        commissionVnd: commission,
        netVnd: gross - commission,
        lastBookedAt: r.lastBookedAt instanceof Date ? r.lastBookedAt.toISOString() : null,
      };
    });
  }),

  /**
   * Recent payment history from the host's perspective: gross / commission /
   * net for each transaction. Joins the traveler name and experience title
   * so the row can be rendered without further lookups.
   */
  getPaymentsTimeline: hostProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).default({ limit: 20 }))
    .query(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return [];

      const rows = await ctx.db
        .select({
          id: payments.id,
          amount: payments.amount,
          refundAmount: payments.refundAmount,
          status: payments.status,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          travelerName: users.displayName,
          experienceTitle: experiences.title,
          tourId: tours.id,
        })
        .from(payments)
        .innerJoin(tours, eq(payments.tourId, tours.id))
        .leftJoin(users, eq(payments.userId, users.id))
        .leftJoin(experiences, eq(tours.experienceId, experiences.id))
        .where(eq(tours.hostId, host.id))
        .orderBy(desc(sql`coalesce(${payments.paidAt}, ${payments.createdAt})`))
        .limit(input.limit);

      const commissionRate = HOST_TOUR_PRICING.commissionRate;
      return rows.map((r) => {
        const gross = r.amount;
        const { hostPayout, platformFee } = computeHostPayout(gross);
        return {
          id: r.id,
          tourId: r.tourId,
          travelerName: r.travelerName,
          experienceTitle: r.experienceTitle,
          status: r.status,
          grossVnd: gross,
          commissionVnd: platformFee,
          netVnd: hostPayout,
          refundVnd: r.refundAmount ?? 0,
          paidAt: r.paidAt?.toISOString() ?? null,
          createdAt: r.createdAt?.toISOString() ?? null,
          commissionRate,
        };
      });
    }),

  /**
   * Commission summary across the host's entire history: lifetime gross,
   * commission taken, net paid out, booking count, and the rate. Renders
   * as a transparent 3-number strip on the earnings page.
   */
  getCommissionSummary: hostProcedure.query(async ({ ctx }) => {
    const host = await ctx.db.query.hostProfiles.findFirst({
      where: eq(hostProfiles.userId, ctx.user.id),
    });
    if (!host) return null;

    const [row] = await ctx.db
      .select({
        gross: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded'), 0)::text`,
        refunded: sql<string>`coalesce(sum(${payments.refundAmount}) filter (where ${payments.status} = 'refunded'), 0)::text`,
        bookingCount: sql<string>`count(distinct ${tours.id}) filter (where ${payments.status} = 'succeeded')::text`,
      })
      .from(payments)
      .innerJoin(tours, eq(payments.tourId, tours.id))
      .where(eq(tours.hostId, host.id));

    const gross = Number(row.gross);
    const refunded = Number(row.refunded);
    const commissionRate = HOST_TOUR_PRICING.commissionRate;
    const commission = Math.round(gross * commissionRate);

    return {
      lifetimeGrossVnd: gross,
      lifetimeCommissionVnd: commission,
      lifetimeNetVnd: gross - commission - refunded,
      lifetimeRefundedVnd: refunded,
      bookingCount: Number(row.bookingCount),
      commissionRate,
      currency: HOST_TOUR_PRICING.currency,
    };
  }),

  /**
   * Paginated payout history. Most recent first. For the MVP this table is
   * populated by seed / manual admin action; FOLLOW-08 wires automation.
   */
  getPayoutHistory: hostProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).default({ limit: 10 }))
    .query(async ({ ctx, input }) => {
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host) return [];

      return ctx.db
        .select({
          id: hostPayouts.id,
          amount: hostPayouts.amount,
          currency: hostPayouts.currency,
          status: hostPayouts.status,
          periodStart: hostPayouts.periodStart,
          periodEnd: hostPayouts.periodEnd,
          paidAt: hostPayouts.paidAt,
          bankReference: hostPayouts.bankReference,
        })
        .from(hostPayouts)
        .where(eq(hostPayouts.hostId, host.id))
        .orderBy(desc(hostPayouts.periodEnd))
        .limit(input.limit);
    }),

  // ---------------------------------------------------------------------
  // Routes: stop heatmap + drill-down.
  //
  // "Stops" are rows in `tour_stops` that point to `places`. Each row says
  // "on tour X, we visited place Y". We aggregate across all tours hosted
  // by the caller to produce:
  //   - heatmap markers (one per unique place, size = visit count)
  //   - drill-down (list of tours + experiences that used a given place)
  // ---------------------------------------------------------------------

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

  // Narrow mutation for the "Accepting Requests" switch on the dashboard.
  // Distinct from `setAvailability(slots)` which replaces the day-of-week
  // schedule; this only flips the boolean.
  setAvailable: hostProcedure
    .input(z.object({ isAvailable: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(hostProfiles)
        .set({ isAvailable: input.isAvailable, updatedAt: new Date() })
        .where(eq(hostProfiles.userId, ctx.user.id))
        .returning({ isAvailable: hostProfiles.isAvailable });
      if (!updated) {
        // Role is host but no hostProfiles row yet -- onboarding not done.
        // PRECONDITION_FAILED keeps this out of INTERNAL_SERVER_ERROR buckets
        // in error-monitoring; it's a recoverable user-state issue.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Host profile not found. Complete host setup first.",
        });
      }
      return { isAvailable: updated.isAvailable };
    }),
});
