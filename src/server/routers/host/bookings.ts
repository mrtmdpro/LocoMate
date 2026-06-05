import { z } from "zod";
import { eq, and, inArray, sql, gte, lte, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure, hostProcedure } from "../../trpc";
import { hostProfiles, tours, users, userProfiles, payments, experiences } from "../../db/schema";
import { vietnamDayBoundsUtc } from "@/lib/time";

export const hostBookingsProcedures = {
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
} satisfies TRPCRouterRecord;
