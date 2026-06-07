import { db } from "@/server/db";
import {
  runT48hSweep,
  runT36hSweep,
  runT28hSweep,
  runT24hSweep,
} from "@/server/services/crossover-cron";
import { logCronResult, runCronSweep } from "../_cron";

/**
 * Vercel cron endpoint that runs the four Crossover Matching lifecycle
 * sweeps in order (T-48h → T-36h → T-28h → T-24h).
 *
 * Wiring:
 *   - `vercel.json` schedules the split `/api/cron/crossover-t*` routes
 *     every 15 minutes with offsets. This aggregate route remains useful for
 *     manual operator checks because it runs the full sequence in one call.
 *   - Vercel sends `Authorization: Bearer $CRON_SECRET` when invoking
 *     scheduled routes; we verify it so the endpoint can't be poked by
 *     unauthenticated callers. Locally / in preview (no CRON_SECRET) the
 *     route rejects everything — we don't want stray pokes mutating data.
 *
 * Each sweep is independently idempotent (time-windowed + dedupe index),
 * so a re-run within the same hour is safe. Returns the per-sweep counts
 * so the Vercel cron UI shows a meaningful per-run result.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronSweep({
    request,
    run: async (now) => {
      // Sequential on purpose: the sweeps share the under-capacity scan and
      // mutate overlapping rows, so we keep them ordered to avoid races.
      const t48 = await runT48hSweep(db, now);
      logCronResult("crossover-t48", t48, now.toISOString());
      const t36 = await runT36hSweep(db, now);
      logCronResult("crossover-t36", t36, now.toISOString());
      const t28 = await runT28hSweep(db, now);
      logCronResult("crossover-t28", t28, now.toISOString());
      const t24 = await runT24hSweep(db, now);
      logCronResult("crossover-t24", t24, now.toISOString());

      return {
        errors: [...t48.errors, ...t36.errors, ...t28.errors, ...t24.errors],
        t24,
        t28,
        t36,
        t48,
      };
    },
    sweep: "crossover-sweeps",
  });
}
