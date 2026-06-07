/**
 * Crossover Matching cron sweep functions (CROSS-05 — logic only).
 *
 * Four pure functions, each idempotent and time-injected for tests. They are
 * wired to Vercel Cron by `/api/cron/crossover-t48`, `-t36`, `-t28`, and `-t24`
 * route handlers, with `/api/cron/crossover-sweeps` retained for manual
 * operator checks that run the full sequence.
 *
 * Lifecycle (per docs/fixed-tour-feature.md):
 *
 *   T-48h  — flag Fixed Tour bookings with currentCapacity < 2 and set
 *            User.ConsentMatching = TRUE (implicit consent).
 *   T-36h  — emit Discovery Mode pushes to candidate matchers; dedupe
 *            via `crossover_discovery_pushes` so a re-run doesn't
 *            re-push the same recipient.
 *   T-28h  — terminate matched requests whose 8h negotiation window
 *            expired without a `lockItinerary` confirmation.
 *   T-24h  — auto-cancel unrescued bookings + issue 100% refund.
 *
 * Each function returns a short numeric report so the calling cron
 * route can emit structured logs without inspecting DB state.
 *
 * Time injection: every function accepts `now` as a parameter, default
 * `new Date()`. Tests pass synthetic clocks to walk every transition
 * deterministically. The `now` arg is also useful in prod for back-
 * filling stuck rows by simulating a past clock.
 */

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  tours,
  tourCrossoverRequests,
  crossoverDiscoveryPushes,
  userProfiles,
  payments,
} from "../db/schema";
import type * as schema from "../db/schema";
import { readExplicitData } from "../lib/profile-shape";
import { readRequestParams } from "../lib/tour-request-shape";

/**
 * Driver-agnostic Drizzle Postgres database type.
 *
 * `PgDatabase` is parameterised on the driver-specific query-result HKT,
 * so we widen to `PgQueryResultHKT` (the base interface) to accept both
 * the production `postgres-js` driver (`PostgresJsDatabase`) and the
 * in-process PGlite driver used by the Vitest integration suite
 * (`PgliteDatabase`). The schema generic stays exact so all `db.select()`
 * / `db.insert()` queries inside this module remain fully typed against
 * the LOCOMATE schema.
 *
 * Was: `typeof PrimaryDb` (postgres-js-only). That worked at runtime
 * because both drivers expose the same query-builder surface, but tsc
 * surfaced the variance mismatch the moment any new table was added to
 * `schema.ts` — see the related `customized_tour_templates` migration
 * for the trigger. This alias removes that variance trap permanently.
 */
type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface SweepResult {
  errors: string[];
}

export interface T48Result extends SweepResult {
  flagged: number;
  consentSet: number;
}

export interface T36Result extends SweepResult {
  pushed: number;
  deduped: number;
}

export interface T28Result extends SweepResult {
  terminated: number;
}

export interface T24Result extends SweepResult {
  cancelled: number;
  refunded: number;
}

/* ────────────────────────────────────────────────────────────────────
 *  Shared helpers
 * ────────────────────────────────────────────────────────────────── */

/** Returns Fixed Tour bookings whose start time is within `windowMs`
 *  of `now` and whose `(fixed_tour_id, date, start_time)` slot has
 *  fewer than 2 participants. */
async function findUnderCapacityFixedTours(
  db: AnyDb,
  now: Date,
  windowMs: { minMs: number; maxMs: number },
): Promise<
  Array<{
    tourId: string;
    userId: string;
    fixedTourId: string;
    date: string;
    startTime: string;
    departureAt: Date;
    currentCapacity: number;
  }>
> {
  // Push a coarse date window into SQL so we scan only the few days that
  // could possibly contain a departure in [minMs, maxMs]. The exact
  // per-booking `msUntil` check still runs in JS below; this is just a
  // superset pre-filter (±1 day of slack absorbs startTime + VN-offset
  // edge cases). `request_params->>'date'` is YYYY-MM-DD so lexical
  // comparison is chronological. Rows without a date compare as null and
  // drop out — matching the `if (!date) continue` skip below.
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const minDate = new Date(
    now.getTime() + windowMs.minMs + VN_OFFSET_MS - 24 * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const maxDate = new Date(
    now.getTime() + windowMs.maxMs + VN_OFFSET_MS + 24 * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select({
      id: tours.id,
      userId: tours.userId,
      fixedTourId: tours.fixedTourId,
      requestParams: tours.requestParams,
      status: tours.status,
    })
    .from(tours)
    .where(
      and(
        // Only Fixed-Tour bookings participate in capacity rescue.
        sql`${tours.fixedTourId} IS NOT NULL`,
        // Don't sweep already-cancelled or migrated tours.
        inArray(tours.status, ["preview", "paid"]),
        // Coarse departure-date window (superset of the JS time filter).
        sql`${tours.requestParams}->>'date' >= ${minDate}`,
        sql`${tours.requestParams}->>'date' <= ${maxDate}`,
      ),
    );

  // Group by (fixed_tour_id, date, start_time) to compute capacity.
  const slotCounts = new Map<string, number>();
  type Booking = {
    tourId: string;
    userId: string;
    fixedTourId: string;
    date: string;
    startTime: string;
    departureAt: Date;
  };
  const bookings: Booking[] = [];

  for (const r of rows) {
    if (!r.fixedTourId) continue;
    const params = readRequestParams(r.requestParams);
    const date = params.date ?? null;
    const startTime = params.startTime ?? null;
    if (!date || !startTime) continue;

    const departureAt = parseVietnamDepartureToUtc(date, startTime);
    if (!departureAt) continue;

    const key = `${r.fixedTourId}|${date}|${startTime}`;
    slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
    bookings.push({
      tourId: r.id,
      userId: r.userId,
      fixedTourId: r.fixedTourId,
      date,
      startTime,
      departureAt,
    });
  }

  // Filter to bookings within the time window AND under capacity.
  const out: Array<{
    tourId: string;
    userId: string;
    fixedTourId: string;
    date: string;
    startTime: string;
    departureAt: Date;
    currentCapacity: number;
  }> = [];
  for (const b of bookings) {
    const msUntil = b.departureAt.getTime() - now.getTime();
    if (msUntil < windowMs.minMs || msUntil > windowMs.maxMs) continue;
    const key = `${b.fixedTourId}|${b.date}|${b.startTime}`;
    const count = slotCounts.get(key) ?? 0;
    if (count >= 2) continue;
    out.push({ ...b, currentCapacity: count });
  }
  return out;
}

/**
 * Detects a unique-constraint violation across both raw Postgres errors
 * and Drizzle's wrapped envelopes. SQLSTATE 23505 is the canonical
 * unique-violation code; we also keyword-match in case a future driver
 * changes the wrapper format.
 */
function isUniqueViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur; depth++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    if (e.code === "23505") return true;
    if (typeof e.message === "string" && /duplicate key|unique constraint/i.test(e.message)) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

/** Parses a Vietnam-local YYYY-MM-DD + HH:mm into a UTC Date. Vietnam
 *  doesn't observe DST so a static UTC+7 offset is safe. */
function parseVietnamDepartureToUtc(date: string, startTime: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTime)) return null;
  const [hh, mm] = startTime.split(":").map(Number);
  const wallUtcMs = Date.parse(
    `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`,
  );
  if (!Number.isFinite(wallUtcMs)) return null;
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(wallUtcMs - VN_OFFSET_MS);
}

/* ────────────────────────────────────────────────────────────────────
 *  T-48h — flag + implicit consent
 * ────────────────────────────────────────────────────────────────── */

/**
 * Sweep for Fixed Tour bookings that are 48..49 hours from departure
 * AND under-capacity. For each, set
 * `user_profiles.explicit_data.consentMatching = true` so the user is
 * eligible for Discovery Mode at T-36h. This is the "Implicit Consent"
 * rule from Luồng 1.
 *
 * Idempotent: re-running over the same window doesn't double-write —
 * the JSON merge uses a `||` operator pattern that keeps the existing
 * value untouched if it's already set.
 */
export async function runT48hSweep(
  db: AnyDb,
  now: Date = new Date(),
): Promise<T48Result> {
  const errors: string[] = [];
  let flagged = 0;
  let consentSet = 0;

  try {
    // Sweep a 1-hour band ending at T-48h. So tours with 48..49h until
    // departure are considered. The cron's job is to LAND consent BEFORE
    // T-36h discovery runs, so any T-48h..T-37h window works.
    const targets = await findUnderCapacityFixedTours(db, now, {
      minMs: 48 * 3600 * 1000,
      maxMs: 49 * 3600 * 1000,
    });
    flagged = targets.length;

    for (const t of targets) {
      try {
        const profile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, t.userId),
        });
        const explicit = readExplicitData(profile?.explicitData);
        if (explicit.consentMatching === true) continue;
        const nextExplicit = { ...explicit, consentMatching: true };
        if (profile) {
          await db
            .update(userProfiles)
            .set({ explicitData: nextExplicit, updatedAt: new Date() })
            .where(eq(userProfiles.userId, t.userId));
        } else {
          // Edge case: tour exists but profile row doesn't. Create one.
          await db.insert(userProfiles).values({
            userId: t.userId,
            explicitData: nextExplicit,
            derivedData: {},
          });
        }
        consentSet++;
      } catch (err) {
        errors.push(`tour ${t.tourId}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`sweep init: ${(err as Error).message}`);
  }

  return { flagged, consentSet, errors };
}

/* ────────────────────────────────────────────────────────────────────
 *  T-36h — Discovery Mode pushes
 * ────────────────────────────────────────────────────────────────── */

/**
 * Sweep for under-capacity tours at 35..37h from departure. For each,
 * find candidate recipients (other users on the system with a saved
 * personality vector AND `consentMatching = true`) and emit a push
 * notification record into `crossover_discovery_pushes`.
 *
 * The dedupe_key `<tour_id>-<recipient_user_id>-36` lets the sweep
 * re-run safely: the unique index throws on the second insert, which
 * we silently swallow.
 */
export async function runT36hSweep(
  db: AnyDb,
  now: Date = new Date(),
): Promise<T36Result> {
  const errors: string[] = [];
  let pushed = 0;
  let deduped = 0;

  try {
    const targets = await findUnderCapacityFixedTours(db, now, {
      minMs: 35 * 3600 * 1000,
      maxMs: 37 * 3600 * 1000,
    });

    if (targets.length === 0) {
      return { pushed: 0, deduped: 0, errors };
    }

    // Candidate recipients: any user who has consented to matching AND
    // has a saved personality vector. Both predicates are pushed into
    // SQL — `explicit_data->>'consentMatching' = 'true'` and the jsonb
    // key-existence test `derived_data ? 'personalityVector'` — so we no
    // longer pull every profile row into memory to filter in JS.
    const candidates = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(
        and(
          sql`${userProfiles.explicitData}->>'consentMatching' = 'true'`,
          sql`${userProfiles.derivedData} ? 'personalityVector'`,
        ),
      );

    const eligibleUserIds = candidates.map((c) => c.userId);

    for (const t of targets) {
      for (const recipientId of eligibleUserIds) {
        if (recipientId === t.userId) continue;
        const dedupeKey = `${t.tourId}-${recipientId}-36`;
        try {
          await db.insert(crossoverDiscoveryPushes).values({
            tourId: t.tourId,
            recipientUserId: recipientId,
            tMinusHour: 36,
            dedupeKey,
          });
          pushed++;
        } catch (err) {
          // Drizzle wraps the underlying Postgres error in `err.cause`.
          // PG's unique-violation SQLSTATE is 23505; we also fuzzy-match
          // the keyword in case the cause chain is different on a
          // future driver.
          if (isUniqueViolation(err)) {
            deduped++;
          } else {
            errors.push(`push ${dedupeKey}: ${(err as Error).message}`);
          }
        }
      }
    }
  } catch (err) {
    errors.push(`sweep init: ${(err as Error).message}`);
  }

  return { pushed, deduped, errors };
}

/* ────────────────────────────────────────────────────────────────────
 *  T-28h — chat window close
 * ────────────────────────────────────────────────────────────────── */

/**
 * Sweep for `matched` requests whose 8-hour chat negotiation window
 * has elapsed. Per spec, matched_at + 8h is the hard cutoff to
 * `lockItinerary`. Any matched request still without a paired
 * `crossover_pair_id` on the underlying tour is terminated.
 */
export async function runT28hSweep(
  db: AnyDb,
  now: Date = new Date(),
): Promise<T28Result> {
  const errors: string[] = [];
  let terminated = 0;

  try {
    const cutoff = new Date(now.getTime() - 8 * 3600 * 1000);

    // Matched requests older than 8h whose underlying tour is NOT yet
    // crossover-paired (i.e. lockItinerary was never called by either
    // side).
    const expired = await db
      .select({
        id: tourCrossoverRequests.id,
        tourId: tourCrossoverRequests.tourId,
      })
      .from(tourCrossoverRequests)
      .leftJoin(tours, eq(tourCrossoverRequests.tourId, tours.id))
      .where(
        and(
          eq(tourCrossoverRequests.status, "matched"),
          lt(tourCrossoverRequests.matchedAt, cutoff),
          isNull(tours.crossoverPairId),
        ),
      );

    if (expired.length === 0) {
      return { terminated: 0, errors };
    }

    await db
      .update(tourCrossoverRequests)
      .set({
        status: "terminated",
        terminatedAt: now,
        terminatedReason: "t28h_window_expired",
        updatedAt: now,
      })
      .where(
        inArray(
          tourCrossoverRequests.id,
          expired.map((r) => r.id),
        ),
      );
    terminated = expired.length;
  } catch (err) {
    errors.push(`sweep init: ${(err as Error).message}`);
  }

  return { terminated, errors };
}

/* ────────────────────────────────────────────────────────────────────
 *  T-24h — auto-cancel + 100% refund
 * ────────────────────────────────────────────────────────────────── */

/**
 * Sweep for Fixed Tour bookings that are 24..25h from departure AND
 * still under capacity AND have no successful crossover lock (i.e.
 * `crossover_pair_id` is null AND `original_fixed_tour_id` is null —
 * meaning the user neither migrated to Custom nor crossed over).
 *
 * For each: set `tours.status = 'system_cancelled'`, stamp
 * `cancelled_at`, set `cancel_reason = 'system_t24h'`, and bump
 * `payments.refund_amount` to the full charge (100% refund).
 *
 * The DDL doesn't constrain `tours.status`, so the value lands as a
 * varchar. The router validates the enum at the API boundary.
 */
export async function runT24hSweep(
  db: AnyDb,
  now: Date = new Date(),
): Promise<T24Result> {
  const errors: string[] = [];
  let cancelled = 0;
  let refunded = 0;

  try {
    const targets = await findUnderCapacityFixedTours(db, now, {
      minMs: 23 * 3600 * 1000,
      maxMs: 25 * 3600 * 1000,
    });
    if (targets.length === 0) {
      return { cancelled: 0, refunded: 0, errors };
    }

    // Batch the tour + payment reads via `inArray` instead of a
    // sequential `findFirst` per target.
    const targetTourIds = targets.map((t) => t.tourId);
    const tourRows = await db
      .select()
      .from(tours)
      .where(inArray(tours.id, targetTourIds));
    const tourById = new Map(tourRows.map((t) => [t.id, t]));

    // Filter to the tours that are actually still strandable (not paired,
    // not migrated, not already cancelled).
    const cancelTargets = targets
      .map((t) => tourById.get(t.tourId))
      .filter(
        (tour): tour is NonNullable<typeof tour> =>
          tour !== undefined &&
          !tour.crossoverPairId &&
          !tour.originalFixedTourId &&
          tour.status !== "system_cancelled",
      );

    const paymentRows = cancelTargets.length
      ? await db
          .select()
          .from(payments)
          .where(
            inArray(
              payments.tourId,
              cancelTargets.map((t) => t.id),
            ),
          )
      : [];
    const paymentByTour = new Map<string, (typeof paymentRows)[number]>();
    for (const p of paymentRows) {
      if (p.tourId && !paymentByTour.has(p.tourId)) paymentByTour.set(p.tourId, p);
    }

    for (const tour of cancelTargets) {
      try {
        await db
          .update(tours)
          .set({
            status: "system_cancelled",
            cancelledAt: now,
            cancelReason: "system_t24h",
            updatedAt: now,
          })
          .where(eq(tours.id, tour.id));
        cancelled++;

        // 100% refund — bump the payment row's refund_amount up to the
        // original charge. Real Stripe refund happens in Phase C; this
        // mock just records the intent.
        const payment = paymentByTour.get(tour.id);
        if (payment && (payment.refundAmount ?? 0) < payment.amount) {
          await db
            .update(payments)
            .set({
              refundAmount: payment.amount,
              refundReason: "system_t24h_full_refund",
              updatedAt: now,
            })
            .where(eq(payments.id, payment.id));
          refunded++;
        }
      } catch (err) {
        errors.push(`tour ${tour.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`sweep init: ${(err as Error).message}`);
  }

  return { cancelled, refunded, errors };
}
