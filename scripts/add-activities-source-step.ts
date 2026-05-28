import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration: add `source_fixed_tour_step_id` to `activities`.
 *
 * The atom-backfill script mints one `activities` row per
 * `fixed_tour_steps` row and stamps the source FK so we can:
 *   - flag atoms in `/activities` with a "From: <Tour Title>" badge
 *   - keep the backfill idempotent by skipping steps that already have
 *     an atom
 *
 * ON DELETE SET NULL — if a curator deletes a fixed_tour_step, the atom
 * activity should keep existing (a traveler may already have it in cart
 * / a paid order), it just loses its provenance.
 *
 * Run once per environment:
 *
 *   npx tsx scripts/add-activities-source-step.ts
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

  console.log("Adding activities.source_fixed_tour_step_id (idempotent)...");

  await sql`
    ALTER TABLE activities
      ADD COLUMN IF NOT EXISTS source_fixed_tour_step_id uuid
        REFERENCES fixed_tour_steps(id) ON DELETE SET NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_activities_source_step
      ON activities(source_fixed_tour_step_id)
  `;

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
