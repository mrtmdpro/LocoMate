/**
 * Anti-Overlap helper for crossover matching.
 *
 * Per docs/fixed-tour-feature.md Luồng 2: "A traveler may send match
 * requests to multiple peers across different time slots. As soon as
 * one request is accepted for a slot, every other PENDING request on
 * that traveler at the same slot is auto-expired."
 *
 * Built on top of `overlapsAny` from [app/src/lib/cart-conflicts.ts]
 * so the same primitive that powers cart conflict detection also
 * powers crossover slot conflict detection — one definition of "two
 * time windows overlap" across the codebase.
 */

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { tourCrossoverRequests, tours } from "../db/schema";
import { overlapsAny } from "@/lib/cart-conflicts";
import { tourTimeWindow } from "@/lib/tour-time";
import { readRequestParams } from "./tour-request-shape";
import type { db as PrimaryDb } from "../db";

type AnyDb = typeof PrimaryDb;

/**
 * Time-window shape used internally. Mirrors `cart-conflicts.ConflictInput`
 * without the cosmetic `label`/`id` fields.
 */
export interface TimeWindow {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Returns the request IDs whose tour time-window overlaps `proposed`.
 * Limited to rows owned by `userId` (as either requester or target)
 * and whose status is in `statuses` (default `["pending"]`).
 *
 * Used by `respondToRequest` to identify peers to expire when a user
 * accepts one match, and by `sendCrossoverRequest` to block sending
 * a new request for a slot the user is already matched on.
 */
export async function findOverlappingRequests(
  db: AnyDb,
  userId: string,
  proposed: TimeWindow,
  options: {
    statuses?: ("pending" | "matched")[];
    exceptRequestId?: string;
  } = {},
): Promise<string[]> {
  const statuses = options.statuses ?? ["pending"];

  // Pull every candidate request owned by this user in the target
  // states, then join to its `tour` to derive a time window. Filtering
  // by time at the SQL level would require parsing requestParams JSON,
  // which Drizzle can't express portably; the JS overlap check below
  // is fast enough for a single user's open requests (rarely > 20).
  const candidates = await db
    .select({
      id: tourCrossoverRequests.id,
      tourId: tourCrossoverRequests.tourId,
      requestParams: tours.requestParams,
    })
    .from(tourCrossoverRequests)
    .leftJoin(tours, eq(tourCrossoverRequests.tourId, tours.id))
    .where(
      and(
        sql`(${tourCrossoverRequests.requesterUserId} = ${userId} OR ${tourCrossoverRequests.targetUserId} = ${userId})`,
        inArray(tourCrossoverRequests.status, statuses),
        options.exceptRequestId
          ? ne(tourCrossoverRequests.id, options.exceptRequestId)
          : sql`true`,
      ),
    );

  const out: string[] = [];
  for (const row of candidates) {
    const win = tourTimeWindow(readRequestParams(row.requestParams));
    if (!win) continue;
    if (
      overlapsAny(
        { startsAt: proposed.startsAt, endsAt: proposed.endsAt },
        [{ startsAt: win.startsAt, endsAt: win.endsAt }],
      )
    ) {
      out.push(row.id);
    }
  }
  return out;
}

/**
 * Expire every pending crossover request owned by `userId` that
 * overlaps the proposed time window. Returns the count of rows
 * touched. Called inside the `respondToRequest` transaction when a
 * user accepts a match — see Luồng 2's "Anti-Overlap Rule".
 *
 * `exceptRequestId` is the request being accepted itself; we don't
 * want to expire the very request we just transitioned to matched.
 */
export async function expireOverlappingPending(
  db: AnyDb,
  userId: string,
  proposed: TimeWindow,
  exceptRequestId: string,
): Promise<number> {
  const ids = await findOverlappingRequests(db, userId, proposed, {
    statuses: ["pending"],
    exceptRequestId,
  });
  if (ids.length === 0) return 0;
  await db
    .update(tourCrossoverRequests)
    .set({
      status: "expired",
      terminatedAt: new Date(),
      terminatedReason: "anti_overlap",
      updatedAt: new Date(),
    })
    .where(inArray(tourCrossoverRequests.id, ids));
  return ids.length;
}
