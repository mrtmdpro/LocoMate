/**
 * Crossover Matching tRPC router (CROSS-03).
 *
 * Implements the four flows from docs/fixed-tour-feature.md:
 *
 *   Luồng 1 — Đặt lịch và Cảnh báo sớm (T-48h)
 *     `getCapacityStatus`, `migrateToCustom`
 *
 *   Luồng 2 — Kích hoạt Ghép đôi Diện rộng (T-36h)
 *     `getDiscoveryFeed`, `sendCrossoverRequest`, `respondToRequest`
 *
 *   Luồng 3 — Phòng chat Thương thảo (T-36h → T-28h)
 *     `getActiveRequest`, `getCountdown`,
 *     `proposeEdit`, `respondToProposal`, `lockItinerary`
 *
 *   Luồng 4 — Chuyển đổi Tài chính (Δ-payment)
 *     `confirmEscrowDelta`, `refundEscrowDelta`
 *
 *   Plus the safety valve: `reportPartner`.
 *
 * T-24h auto-cancellation is handled by `services/crossover-cron.ts`
 * outside the tRPC surface — users can't trigger it directly.
 *
 * All cosine matching reuses `rankByCosine` from `server/lib/cosine.ts`.
 * Anti-Overlap enforcement reuses `crossover-overlap.ts`.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import {
  tours,
  tourStops,
  fixedTours,
  fixedTourSteps,
  fixedTourTags,
  tourCrossoverRequests,
  tourProposalEdits,
  escrowAdjustments,
  priorityMatchingVouchers,
  userProfiles,
} from "../db/schema";
import { rankByCosine } from "../lib/cosine";
import { expireOverlappingPending, type TimeWindow } from "../lib/crossover-overlap";
import { tourTimeWindow } from "@/lib/tour-time";
import { readExplicitData, readDerivedData } from "../lib/profile-shape";
import { readRequestParams } from "../lib/tour-request-shape";
import {
  AgeBracketSchema,
  ChapterSchema,
  DiscoveryCandidateSchema,
  type DiscoveryCandidate,
} from "../lib/crossover-dto";

/* ────────────────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────────────── */

const TOUR_ID = z.string().uuid();
const REQUEST_ID = z.string().uuid();
const PROPOSAL_ID = z.string().uuid();
const ESCROW_ID = z.string().uuid();

/** Count tours sharing a fixed_tour_id + date + start_time that aren't
 *  cancelled/refunded. The Fixed Tour minimum-capacity rule is "≥ 2"; we
 *  return the raw count so the UI can show "1/2", "0/2", etc. */
async function countCapacityForFixedTour(
  db: typeof import("../db").db,
  fixedTourId: string,
  date: string,
  startTime: string,
): Promise<number> {
  const rows = await db
    .select({ id: tours.id })
    .from(tours)
    .where(
      and(
        eq(tours.fixedTourId, fixedTourId),
        sql`${tours.requestParams}->>'date' = ${date}`,
        sql`${tours.requestParams}->>'startTime' = ${startTime}`,
        // Tours that are draft / refunded / system-cancelled don't count.
        inArray(tours.status, ["preview", "paid", "active", "completed", "customized_pending"]),
      ),
    );
  return rows.length;
}

/** Resolve the booking's time window from `requestParams` for overlap
 *  checks. Returns null when the tour's params don't carry enough info
 *  (e.g. algorithmic tours with no date). */
async function timeWindowForTour(
  db: typeof import("../db").db,
  tourId: string,
): Promise<TimeWindow | null> {
  const tour = await db.query.tours.findFirst({ where: eq(tours.id, tourId) });
  if (!tour) return null;
  const win = tourTimeWindow(readRequestParams(tour.requestParams));
  if (!win) return null;
  return { startsAt: win.startsAt, endsAt: win.endsAt };
}

/** Asserts the caller owns the tour. Used at the entry of every
 *  caller-initiated mutation. */
function assertOwnsTour(tour: { userId: string }, callerId: string): void {
  if (tour.userId !== callerId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your tour" });
  }
}

/** Builds a short bilingual route summary for the Discovery card. Keeps
 *  the PII surface tight — chapter name + first stop only. */
function buildRouteSummary(
  chapter: "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "EVENING_SHIFT",
  firstStopVi: string | null,
  firstStopEn: string | null,
): { summaryVi: string; summaryEn: string } {
  const fallbackVi = firstStopVi ?? "Hành trình Hà Nội";
  const fallbackEn = firstStopEn ?? "Hanoi route";
  return {
    summaryVi: `${chapterShortVi(chapter)} · ${fallbackVi}`,
    summaryEn: `${chapterShortEn(chapter)} · ${fallbackEn}`,
  };
}
function chapterShortVi(c: string): string {
  if (c === "MORNING_SHIFT") return "Sáng";
  if (c === "AFTERNOON_SHIFT") return "Trưa";
  return "Tối";
}
function chapterShortEn(c: string): string {
  if (c === "MORNING_SHIFT") return "Morning";
  if (c === "AFTERNOON_SHIFT") return "Afternoon";
  return "Evening";
}

/** Compute an age bracket from a year-of-birth field on the profile
 *  (when available). Falls back to "25_34" when unknown so we never
 *  leak the absence of data as a separate bucket. */
function ageBracketFromProfile(profile: { explicitData?: unknown } | null | undefined): z.infer<typeof AgeBracketSchema> {
  const explicit = readExplicitData(profile?.explicitData);
  const yob = typeof explicit.birthYear === "number" ? explicit.birthYear : undefined;
  if (!yob) return "25_34";
  const age = new Date().getFullYear() - yob;
  if (age < 25) return "under_25";
  if (age < 35) return "25_34";
  if (age < 45) return "35_44";
  return "45_plus";
}

/** Pull the 4-D personality vector from a user_profiles row. Returns
 *  null if the user hasn't completed the quiz. */
function readVector(
  profile: { derivedData?: unknown } | null | undefined,
): [number, number, number, number] | null {
  return readDerivedData(profile?.derivedData).personalityVector ?? null;
}

/* ────────────────────────────────────────────────────────────────────
 *  Router
 * ────────────────────────────────────────────────────────────────── */

export const crossoverRouter = router({
  // ──────────────────── Luồng 1 ────────────────────

  /**
   * Returns the rescue state of a Fixed Tour booking. Used by the
   * /fixed-tours/[id] detail page to render the T-48h warning tag +
   * the "Chuyển sang Custom Tour" CTA.
   */
  getCapacityStatus: protectedProcedure
    .input(z.object({ tourId: TOUR_ID }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      assertOwnsTour(tour, ctx.user.id);

      if (!tour.fixedTourId) {
        // Non-fixed-tour bookings don't participate in capacity rescue.
        return { isFixedTour: false, current: 1, minimum: 2, underCapacity: false };
      }

      const params = (tour.requestParams ?? {}) as { date?: string; startTime?: string };
      if (!params.date || !params.startTime) {
        return { isFixedTour: true, current: 1, minimum: 2, underCapacity: true };
      }

      const count = await countCapacityForFixedTour(
        ctx.db,
        tour.fixedTourId,
        params.date,
        params.startTime,
      );
      return {
        isFixedTour: true,
        current: count,
        minimum: 2,
        underCapacity: count < 2,
      };
    }),

  /**
   * "Chuyển sang Custom Tour" one-click migration. The tour stays the
   * SAME row — we just flip its status to `customized_pending`, copy
   * `fixedTourId` to `originalFixedTourId`, and null out `fixedTourId`.
   * The user's payment + tour_stops remain attached to the row. The
   * /plan/build flow can then surface this tour as a draft customised
   * route ready to edit.
   */
  migrateToCustom: protectedProcedure
    .input(z.object({ tourId: TOUR_ID }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      assertOwnsTour(tour, ctx.user.id);

      // Idempotency check FIRST — a successful migration nulls out
      // `fixedTourId` (it gets shifted to `originalFixedTourId`), so
      // checking `fixedTourId` first would mis-fire on a re-call.
      if (tour.originalFixedTourId) {
        return { tourId: tour.id, status: tour.status, alreadyMigrated: true };
      }

      if (!tour.fixedTourId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only Fixed Tour bookings can migrate to Custom.",
        });
      }
      if (tour.status === "completed" || tour.status === "refunded" || tour.status === "system_cancelled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This tour is no longer eligible for migration.",
        });
      }

      await ctx.db
        .update(tours)
        .set({
          originalFixedTourId: tour.fixedTourId,
          fixedTourId: null,
          status: "customized_pending",
          packageType: "custom_migrated",
          updatedAt: new Date(),
        })
        .where(eq(tours.id, tour.id));

      return { tourId: tour.id, status: "customized_pending" as const, alreadyMigrated: false };
    }),

  // ──────────────────── Luồng 2 ────────────────────

  /**
   * Anonymous Discovery Mode feed. Returns up to `limit` ranked
   * candidates for the requested tour. Burns one use of the caller's
   * priority voucher (if present) in the same transaction.
   *
   * Output is parsed through `DiscoveryCandidateSchema.strict()` — any
   * accidental PII field in the SELECT throws at parse time before the
   * data crosses the wire. See `crossover-dto.ts` for the contract.
   */
  getDiscoveryFeed: protectedProcedure
    .input(z.object({ tourId: TOUR_ID, limit: z.number().int().min(1).max(20).default(10) }))
    .mutation(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      assertOwnsTour(tour, ctx.user.id);

      // Caller must have a personality vector to rank against.
      const callerProfile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const callerVector = readVector(callerProfile);
      if (!callerVector) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Complete the personality quiz before opening Discovery Mode.",
        });
      }

      // Pull other tours at the same (or adjacent) chapter that are
      // also under capacity and not the caller's own row. The shape
      // mirrors `countCapacityForFixedTour`: same date, same start_time
      // hour-bucket OR same fixedTourId chapter (foundation simplifies
      // to same date for matchmaking).
      const params = (tour.requestParams ?? {}) as { date?: string };
      if (!params.date) {
        return { candidates: [], voucherBurned: false, feedGeneratedAt: new Date().toISOString() };
      }

      const otherTours = await ctx.db
        .select({
          id: tours.id,
          userId: tours.userId,
          fixedTourId: tours.fixedTourId,
          requestParams: tours.requestParams,
        })
        .from(tours)
        .where(
          and(
            ne(tours.userId, ctx.user.id),
            ne(tours.id, tour.id),
            sql`${tours.requestParams}->>'date' = ${params.date}`,
            inArray(tours.status, ["preview", "paid"]),
          ),
        );

      if (otherTours.length === 0) {
        return { candidates: [], voucherBurned: false, feedGeneratedAt: new Date().toISOString() };
      }

      // Resolve each peer's vector + bracket + chapter summary in
      // parallel. Skip peers without a vector.
      const peerCandidates = await Promise.all(
        otherTours.map(async (peer) => {
          const peerProfile = await ctx.db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, peer.userId),
          });
          const vector = readVector(peerProfile);
          if (!vector) return null;

          // Resolve a chapter + bilingual first-stop label.
          let chapter: z.infer<typeof ChapterSchema> = "MORNING_SHIFT";
          let firstStopVi: string | null = null;
          let firstStopEn: string | null = null;
          if (peer.fixedTourId) {
            const ft = await ctx.db.query.fixedTours.findFirst({
              where: eq(fixedTours.tourId, peer.fixedTourId),
            });
            if (ft) chapter = ft.chapter as z.infer<typeof ChapterSchema>;
            const firstStep = await ctx.db
              .select()
              .from(fixedTourSteps)
              .where(eq(fixedTourSteps.tourId, peer.fixedTourId))
              .orderBy(asc(fixedTourSteps.stepOrder))
              .limit(1);
            firstStopVi = firstStep[0]?.locationNameVi ?? null;
            firstStopEn = firstStep[0]?.locationNameEn ?? null;
          }
          const summary = buildRouteSummary(chapter, firstStopVi, firstStopEn);

          // Build country code from profile.nationality if set; else
          // fall back to "VN". Limit to 2 chars to match the Zod schema.
          const explicit = readExplicitData(peerProfile?.explicitData);
          const nationality =
            typeof explicit.nationality === "string" && explicit.nationality.length === 2
              ? explicit.nationality.toUpperCase()
              : "VN";

          return {
            userId: peer.userId,
            tourId: peer.id,
            vector,
            ageBracket: ageBracketFromProfile(peerProfile),
            nationality,
            chapter,
            fixedTourId: peer.fixedTourId,
            ...summary,
          };
        }),
      );

      const validPeers = peerCandidates.filter(
        (p): p is NonNullable<typeof p> => p !== null,
      );

      const ranked = rankByCosine(
        callerVector,
        validPeers.map((p) => ({ id: p.tourId, vector: p.vector })),
      );

      const byId = new Map(validPeers.map((p) => [p.tourId, p]));
      const rawCandidates = ranked
        .slice(0, input.limit)
        .map((r) => {
          const peer = byId.get(r.id);
          if (!peer) return null;
          const candidate: DiscoveryCandidate = {
            candidateUserId: peer.userId,
            personalityVector: peer.vector,
            matchPercent: r.matchPercent,
            ageBracket: peer.ageBracket,
            nationality: peer.nationality,
            tourId: peer.tourId,
            tourRoute: {
              chapter: peer.chapter,
              fixedTourId: peer.fixedTourId,
              summaryVi: peer.summaryVi,
              summaryEn: peer.summaryEn,
            },
          };
          // Defence in depth: pass through Zod parser so any peer
          // shape that drifts from the contract is caught here, not
          // at the wire.
          return DiscoveryCandidateSchema.parse(candidate);
        })
        .filter((c): c is DiscoveryCandidate => c !== null);

      // Burn one voucher use, if any.
      const voucher = await ctx.db
        .select()
        .from(priorityMatchingVouchers)
        .where(
          and(
            eq(priorityMatchingVouchers.userId, ctx.user.id),
            sql`${priorityMatchingVouchers.usesRemaining} > 0`,
          ),
        )
        .orderBy(asc(priorityMatchingVouchers.createdAt))
        .limit(1);
      let voucherBurned = false;
      if (voucher.length > 0) {
        await ctx.db
          .update(priorityMatchingVouchers)
          .set({ usesRemaining: sql`${priorityMatchingVouchers.usesRemaining} - 1` })
          .where(eq(priorityMatchingVouchers.id, voucher[0].id));
        voucherBurned = true;
      }

      return {
        candidates: rawCandidates,
        voucherBurned,
        feedGeneratedAt: new Date().toISOString(),
      };
    }),

  /**
   * Send a crossover request to a peer's tour. Enforces Anti-Overlap
   * on the requester side: if the requester is already MATCHED on a
   * tour at this time slot, the call throws.
   */
  sendCrossoverRequest: protectedProcedure
    .input(
      z.object({
        tourId: TOUR_ID,
        targetTourId: TOUR_ID,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.tourId === input.targetTourId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot send a crossover request to your own tour.",
        });
      }
      const [tour, target] = await Promise.all([
        ctx.db.query.tours.findFirst({ where: eq(tours.id, input.tourId) }),
        ctx.db.query.tours.findFirst({ where: eq(tours.id, input.targetTourId) }),
      ]);
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      assertOwnsTour(tour, ctx.user.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Target tour not found" });
      if (target.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both tours are owned by the same user.",
        });
      }

      // Anti-Overlap: caller cannot already be MATCHED on an overlapping slot.
      const window = await timeWindowForTour(ctx.db, input.tourId);
      if (window) {
        const conflicts = await ctx.db
          .select({
            requestId: tourCrossoverRequests.id,
            requesterTourId: tourCrossoverRequests.tourId,
            targetTourId: tourCrossoverRequests.targetTourId,
            requesterUserId: tourCrossoverRequests.requesterUserId,
          })
          .from(tourCrossoverRequests)
          .where(
            and(
              or(
                eq(tourCrossoverRequests.requesterUserId, ctx.user.id),
                eq(tourCrossoverRequests.targetUserId, ctx.user.id),
              ),
              eq(tourCrossoverRequests.status, "matched"),
            ),
          );
        for (const c of conflicts) {
          // Look up the time window of the caller's SIDE of the matched
          // pair (whichever of the two tours they own).
          const callerTourId =
            c.requesterUserId === ctx.user.id ? c.requesterTourId : c.targetTourId;
          const win = await timeWindowForTour(ctx.db, callerTourId);
          if (win && window.startsAt < win.endsAt && win.startsAt < window.endsAt) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "You already have a matched crossover at this time.",
            });
          }
        }
      }

      const [row] = await ctx.db
        .insert(tourCrossoverRequests)
        .values({
          tourId: input.tourId,
          requesterUserId: ctx.user.id,
          targetTourId: input.targetTourId,
          targetUserId: target.userId,
          status: "pending",
        })
        .returning({ id: tourCrossoverRequests.id });

      return { requestId: row.id, status: "pending" as const };
    }),

  /**
   * Accept or reject a crossover request. On accept, fires
   * `expireOverlappingPending` to auto-expire competing pending
   * requests at the same slot (Anti-Overlap Rule).
   */
  respondToRequest: protectedProcedure
    .input(
      z.object({
        requestId: REQUEST_ID,
        decision: z.enum(["approve", "reject"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, input.requestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });

      // Only the target can approve / reject.
      if (req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the recipient can respond" });
      }
      if (req.status !== "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Request is already ${req.status}.`,
        });
      }

      if (input.decision === "reject") {
        await ctx.db
          .update(tourCrossoverRequests)
          .set({
            status: "expired",
            terminatedAt: new Date(),
            terminatedReason: "user_rejected",
            updatedAt: new Date(),
          })
          .where(eq(tourCrossoverRequests.id, req.id));
        return { status: "expired" as const, expiredPeers: 0 };
      }

      // Accept path: mark matched + expire overlapping pendings on
      // BOTH sides of the now-matched pair.
      const requesterWindow = await timeWindowForTour(ctx.db, req.tourId);
      const targetWindow = await timeWindowForTour(ctx.db, req.targetTourId);

      await ctx.db
        .update(tourCrossoverRequests)
        .set({ status: "matched", matchedAt: new Date(), updatedAt: new Date() })
        .where(eq(tourCrossoverRequests.id, req.id));

      let expiredPeers = 0;
      if (requesterWindow) {
        expiredPeers += await expireOverlappingPending(
          ctx.db,
          req.requesterUserId,
          requesterWindow,
          req.id,
        );
      }
      if (targetWindow) {
        expiredPeers += await expireOverlappingPending(
          ctx.db,
          req.targetUserId,
          targetWindow,
          req.id,
        );
      }

      return { status: "matched" as const, expiredPeers };
    }),

  // ──────────────────── Luồng 3 ────────────────────

  /**
   * Returns the most recent active (pending OR matched) request for a
   * tour, so the negotiation chat surface knows whose proposals to render.
   */
  getActiveRequest: protectedProcedure
    .input(z.object({ tourId: TOUR_ID }))
    .query(async ({ ctx, input }) => {
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      assertOwnsTour(tour, ctx.user.id);

      const rows = await ctx.db
        .select()
        .from(tourCrossoverRequests)
        .where(
          and(
            or(
              eq(tourCrossoverRequests.tourId, tour.id),
              eq(tourCrossoverRequests.targetTourId, tour.id),
            ),
            inArray(tourCrossoverRequests.status, ["pending", "matched"]),
          ),
        )
        .orderBy(desc(tourCrossoverRequests.createdAt))
        .limit(1);

      return rows[0] ?? null;
    }),

  /**
   * Returns seconds remaining on the 8-hour chat negotiation window.
   * Spec: T-36h → T-28h, 8h window. Computed as `matched_at + 8h - now()`.
   */
  getCountdown: protectedProcedure
    .input(z.object({ requestId: REQUEST_ID }))
    .query(async ({ ctx, input }) => {
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, input.requestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (req.requesterUserId !== ctx.user.id && req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a party to this request" });
      }
      if (req.status !== "matched" || !req.matchedAt) {
        return { secondsRemaining: 0, expiresAt: null, started: false };
      }
      const expiresAt = new Date(req.matchedAt.getTime() + 8 * 3600 * 1000);
      const secondsRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      return { secondsRemaining, expiresAt: expiresAt.toISOString(), started: true };
    }),

  /**
   * Smart Proposal Hub: add or remove a stop. Caps at 3 edits per
   * request (DB CHECK), and the partial unique index enforces that
   * only one proposal can be in `pending_approval` at a time.
   */
  proposeEdit: protectedProcedure
    .input(
      z.object({
        requestId: REQUEST_ID,
        editKind: z.enum(["add", "remove"]),
        targetActivityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, input.requestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (req.requesterUserId !== ctx.user.id && req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a party to this request" });
      }
      if (req.status !== "matched") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Proposals only allowed on matched requests.",
        });
      }

      // Determine the next edit_order. CHECK enforces 1..3 at the DB;
      // we compute it here so the error message is friendly.
      const existing = await ctx.db
        .select({ editOrder: tourProposalEdits.editOrder })
        .from(tourProposalEdits)
        .where(eq(tourProposalEdits.crossoverRequestId, req.id))
        .orderBy(desc(tourProposalEdits.editOrder))
        .limit(1);
      const nextOrder = (existing[0]?.editOrder ?? 0) + 1;
      if (nextOrder > 3) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You've used your 3 proposal edits.",
        });
      }

      // Sequential approval: refuse if any prior edit is still pending.
      // The partial unique index also catches this race, but a clean
      // error message is friendlier.
      const pending = await ctx.db
        .select({ id: tourProposalEdits.id })
        .from(tourProposalEdits)
        .where(
          and(
            eq(tourProposalEdits.crossoverRequestId, req.id),
            eq(tourProposalEdits.status, "pending_approval"),
          ),
        )
        .limit(1);
      if (pending.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wait for your previous proposal to be approved or rejected.",
        });
      }

      const [row] = await ctx.db
        .insert(tourProposalEdits)
        .values({
          crossoverRequestId: req.id,
          proposerUserId: ctx.user.id,
          editOrder: nextOrder,
          editKind: input.editKind,
          targetActivityId: input.targetActivityId,
          status: "pending_approval",
        })
        .returning({ id: tourProposalEdits.id, editOrder: tourProposalEdits.editOrder });

      return { proposalEditId: row.id, editOrder: row.editOrder };
    }),

  /**
   * Approve or reject a pending proposal. Only the OTHER party (not
   * the proposer) may respond — that's the bilateral half of
   * sequential approval.
   */
  respondToProposal: protectedProcedure
    .input(
      z.object({
        proposalEditId: PROPOSAL_ID,
        decision: z.enum(["approve", "reject"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const edit = await ctx.db.query.tourProposalEdits.findFirst({
        where: eq(tourProposalEdits.id, input.proposalEditId),
      });
      if (!edit) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      if (edit.proposerUserId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can't approve your own proposal.",
        });
      }
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, edit.crossoverRequestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (req.requesterUserId !== ctx.user.id && req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a party to this request" });
      }
      if (edit.status !== "pending_approval") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Proposal is already ${edit.status}.`,
        });
      }

      await ctx.db
        .update(tourProposalEdits)
        .set({
          status: input.decision === "approve" ? "approved" : "rejected",
          respondedAt: new Date(),
        })
        .where(eq(tourProposalEdits.id, edit.id));

      return { status: input.decision === "approve" ? ("approved" as const) : ("rejected" as const) };
    }),

  /**
   * "Chốt hành trình chung" — Lock the merged itinerary and compute Δ.
   *
   * Either party can call. Idempotent: if an `escrow_adjustments` row
   * already exists for this request, returns it unchanged. Otherwise
   * inserts a new pending escrow row and sets `tours.crossover_pair_id`
   * on both sides.
   *
   * Cost computation: for the foundation we treat Cost_New as the sum
   * of both tours' `priceAmount` (the merge fee is whatever the two
   * sides agreed to bring) and Cost_Old as the larger of the two
   * individual prices (the user keeping the more-expensive plan
   * effectively absorbed the merge). A future Phase B will recompute
   * from the actual activity catalog after the proposals are applied.
   */
  lockItinerary: protectedProcedure
    .input(z.object({ requestId: REQUEST_ID }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, input.requestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (req.requesterUserId !== ctx.user.id && req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a party to this request" });
      }
      if (req.status !== "matched") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only matched requests can be locked.",
        });
      }

      // Idempotency check.
      const existing = await ctx.db
        .select()
        .from(escrowAdjustments)
        .where(eq(escrowAdjustments.crossoverRequestId, req.id))
        .limit(1);
      if (existing.length > 0) {
        return { escrowAdjustmentId: existing[0].id, delta: existing[0].delta ?? 0, alreadyLocked: true };
      }

      const [tourA, tourB] = await Promise.all([
        ctx.db.query.tours.findFirst({ where: eq(tours.id, req.tourId) }),
        ctx.db.query.tours.findFirst({ where: eq(tours.id, req.targetTourId) }),
      ]);
      if (!tourA || !tourB) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paired tour missing" });
      }

      // Foundation cost model: see the doc block above. Real Phase B
      // recomputes from approved proposal edits + activity catalog.
      const costOld = Math.max(tourA.priceAmount, tourB.priceAmount);
      const costNew = tourA.priceAmount + tourB.priceAmount;
      // Anchor the escrow row to the caller's tour so the Δ-payment UI
      // can find it via `getActiveRequest(tourId)`.
      const anchorTourId = ctx.user.id === tourA.userId ? tourA.id : tourB.id;

      const [escrowRow] = await ctx.db
        .insert(escrowAdjustments)
        .values({
          tourId: anchorTourId,
          crossoverRequestId: req.id,
          costOld,
          costNew,
          status: "pending",
        })
        .returning({ id: escrowAdjustments.id, delta: escrowAdjustments.delta });

      // Pair the two tours.
      await ctx.db
        .update(tours)
        .set({ crossoverPairId: tourB.id, updatedAt: new Date() })
        .where(eq(tours.id, tourA.id));
      await ctx.db
        .update(tours)
        .set({ crossoverPairId: tourA.id, updatedAt: new Date() })
        .where(eq(tours.id, tourB.id));

      return {
        escrowAdjustmentId: escrowRow.id,
        delta: escrowRow.delta ?? 0,
        alreadyLocked: false,
      };
    }),

  // ──────────────────── Luồng 4 (mocked) ────────────────────

  /**
   * Δ > 0 confirmation. MOCK MODE — flips
   * `escrow_adjustments.status = confirmed` without calling Stripe.
   *
   * Phase C will swap the body for a real Stripe Payment Intent
   * confirmation. The router shape stays identical so the UI doesn't
   * change.
   */
  confirmEscrowDelta: protectedProcedure
    .input(z.object({ escrowAdjustmentId: ESCROW_ID }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.escrowAdjustments.findFirst({
        where: eq(escrowAdjustments.id, input.escrowAdjustmentId),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Escrow row not found" });

      // Auth: caller must own one of the two paired tours.
      const tour = await ctx.db.query.tours.findFirst({ where: eq(tours.id, row.tourId) });
      const paired = tour?.crossoverPairId
        ? await ctx.db.query.tours.findFirst({ where: eq(tours.id, tour.crossoverPairId) })
        : null;
      if (tour?.userId !== ctx.user.id && paired?.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your escrow" });
      }

      // Idempotent: if already resolved, return the existing row.
      if (row.status !== "pending") {
        return { status: row.status, alreadyResolved: true };
      }

      await ctx.db
        .update(escrowAdjustments)
        .set({ status: "confirmed", resolvedAt: new Date() })
        .where(eq(escrowAdjustments.id, row.id));

      return { status: "confirmed" as const, alreadyResolved: false };
    }),

  /**
   * Δ < 0 partial refund. MOCK MODE — flips
   * `escrow_adjustments.status = refunded` and stamps `resolved_at`.
   *
   * Real Stripe partial-refund call lives in Phase C; the router shape
   * stays identical so the UI doesn't change.
   */
  refundEscrowDelta: protectedProcedure
    .input(z.object({ escrowAdjustmentId: ESCROW_ID }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.escrowAdjustments.findFirst({
        where: eq(escrowAdjustments.id, input.escrowAdjustmentId),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Escrow row not found" });

      const tour = await ctx.db.query.tours.findFirst({ where: eq(tours.id, row.tourId) });
      const paired = tour?.crossoverPairId
        ? await ctx.db.query.tours.findFirst({ where: eq(tours.id, tour.crossoverPairId) })
        : null;
      if (tour?.userId !== ctx.user.id && paired?.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your escrow" });
      }

      if (row.status !== "pending") {
        return { status: row.status, alreadyResolved: true };
      }

      await ctx.db
        .update(escrowAdjustments)
        .set({ status: "refunded", resolvedAt: new Date() })
        .where(eq(escrowAdjustments.id, row.id));

      return { status: "refunded" as const, alreadyResolved: false };
    }),

  // ──────────────────── Safety valve ────────────────────

  /**
   * "Báo cáo" — Anti-Insult instant eviction. Terminates the chat,
   * issues a Priority Matching Voucher to the reporter, and marks the
   * reported user banned within this request only. Idempotent on retry.
   */
  reportPartner: protectedProcedure
    .input(
      z.object({
        requestId: REQUEST_ID,
        reason: z.string().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.tourCrossoverRequests.findFirst({
        where: eq(tourCrossoverRequests.id, input.requestId),
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (req.requesterUserId !== ctx.user.id && req.targetUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a party to this request" });
      }

      // Idempotent retry: if the request is already terminated, return
      // without re-issuing another voucher.
      if (req.status === "terminated") {
        return { status: "terminated" as const, voucherIssued: false };
      }

      await ctx.db
        .update(tourCrossoverRequests)
        .set({
          status: "terminated",
          terminatedAt: new Date(),
          terminatedReason: input.reason?.slice(0, 40) ?? "user_report",
          updatedAt: new Date(),
        })
        .where(eq(tourCrossoverRequests.id, req.id));

      // Voucher gets 60-day TTL by default; the Phase B UI can surface
      // expiry. uses_remaining defaults to 1 per the schema.
      const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
      await ctx.db.insert(priorityMatchingVouchers).values({
        userId: ctx.user.id,
        issuedForRequestId: req.id,
        usesRemaining: 1,
        expiresAt,
      });

      return { status: "terminated" as const, voucherIssued: true };
    }),
});
