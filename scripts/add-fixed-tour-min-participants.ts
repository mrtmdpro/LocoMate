import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration: add `min_participants` to `fixed_tours`.
 *
 * Default = 2 so existing rows pick it up without manual backfill. This
 * column powers the "Fixed Tour needs at least 2 people" rule that gives
 * the Customized Tour its honest positioning as the solo-traveler path.
 *
 * Run once per environment:
 *
 *   npx tsx scripts/add-fixed-tour-min-participants.ts
 *
 * Safe to re-run — uses `ADD COLUMN IF NOT EXISTS`.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, {
    ssl: databaseUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });

  console.log("Adding fixed_tours.min_participants (idempotent)...");

  await sql`
    ALTER TABLE fixed_tours
      ADD COLUMN IF NOT EXISTS min_participants integer NOT NULL DEFAULT 2
  `;

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
