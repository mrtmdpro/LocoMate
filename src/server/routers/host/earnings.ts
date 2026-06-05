import { z } from "zod";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { hostProcedure } from "../../trpc";
import { hostProfiles, tours, users, payments, experiences, hostPayouts } from "../../db/schema";
import { vietnamDayBoundsUtc, vnLocalDate } from "@/lib/time";
import { HOST_TOUR_PRICING, computeHostPayout } from "@/lib/pricing";

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

export const hostEarningsProcedures = {
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
} satisfies TRPCRouterRecord;
