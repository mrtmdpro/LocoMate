import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { topupActivitySlots } from "../src/lib/topup-activity-slots";

/**
 * One-shot CLI wrapper around `topupActivitySlots`. Safe to re-run -- it
 * only inserts rolling slots for published activities that have fewer
 * than 3 open future slots, and never deletes anything.
 *
 *   pnpm slots:topup
 *
 * The same logic runs nightly via /api/cron/topup-slots, so a manual
 * invocation is only needed to immediately resurrect an environment
 * whose slots have all expired (e.g. right after this change ships).
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

  const result = await topupActivitySlots(db);
  console.log(
    `Topup complete: scanned=${result.scannedActivities} skipped=${result.skippedActivities} topped_up=${result.toppedUpActivities} slots_inserted=${result.insertedSlots}`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
