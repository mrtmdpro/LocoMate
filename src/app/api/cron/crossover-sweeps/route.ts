import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  CROSSOVER_PARKED_MESSAGE,
  isCrossoverMatchingEnabled,
} from "@/lib/crossover-feature";
import {
  runT48hSweep,
  runT36hSweep,
  runT28hSweep,
  runT24hSweep,
} from "@/server/services/crossover-cron";

/**
 * Parked Crossover Matching cron endpoint.
 *
 * Wiring:
 *   - `vercel.json` intentionally does not schedule this URL.
 *   - `CROSSOVER_MATCHING_ENABLED=true` is required before it can run.
 *   - Vercel sends `Authorization: Bearer $CRON_SECRET` when invoking
 *     scheduled routes; we verify it so the endpoint can't be poked by
 *     unauthenticated callers. Locally / in preview (no CRON_SECRET) the
 *     route rejects everything — we don't want stray pokes mutating data.
 *
 * Each sweep is independently idempotent (time-windowed + dedupe index),
 * so a re-run is safe once the product surface is explicitly enabled.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isCrossoverMatchingEnabled()) {
    return NextResponse.json(
      { ok: false, error: CROSSOVER_PARKED_MESSAGE },
      { status: 503 },
    );
  }

  try {
    const now = new Date();
    // Sequential on purpose: the sweeps share the under-capacity scan and
    // mutate overlapping rows, so we keep them ordered to avoid races.
    const t48 = await runT48hSweep(db, now);
    const t36 = await runT36hSweep(db, now);
    const t28 = await runT28hSweep(db, now);
    const t24 = await runT24hSweep(db, now);

    return NextResponse.json({ ok: true, t48, t36, t28, t24 });
  } catch (err) {
    console.error("crossover-sweeps cron failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
