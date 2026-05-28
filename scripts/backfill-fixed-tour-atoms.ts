import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { backfillFixedTourAtoms } from "../src/lib/backfill-fixed-tour-atoms";

/**
 * One-shot CLI wrapper around `backfillFixedTourAtoms`. Mints one
 * `activities` row per `fixed_tour_steps` row (idempotent) and links the
 * two via the bidirectional FK pair added in
 * `add-activities-source-step.ts` + `add-fixed-tour-step-activity-link.ts`.
 *
 *   pnpm tour-atoms:backfill
 *
 * Safe to re-run -- steps that already have an `activity_id` are skipped,
 * and orphan atoms (insert committed, FK update lost) are healed.
 *
 * After running, fire `pnpm slots:topup` so the new atoms get rolling
 * slots immediately. The nightly cron picks up the rest.
 */
async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const client = postgres(dbUrl, {
    ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });
  const db = drizzle(client, { schema });

  const result = await backfillFixedTourAtoms(db);
  console.log(
    `Backfill complete: tours=${result.scannedTours} steps_scanned=${result.scannedSteps} atoms_created=${result.createdAtoms} skipped_existing=${result.skippedExisting} curator_user_id=${result.curatorUserId}`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
