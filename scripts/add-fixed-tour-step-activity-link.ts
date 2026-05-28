import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration: add `activity_id` to `fixed_tour_steps`.
 *
 * Bidirectional link with `activities.source_fixed_tour_step_id`. This
 * column lets the recipe-guide widget render every Fixed Tour as an
 * ordered list of atoms with a single join, instead of a per-row lookup:
 *
 *   SELECT step.*, atom.id AS atomId, atom.slug, atom.price_amount
 *   FROM fixed_tour_steps step
 *   LEFT JOIN activities atom ON step.activity_id = atom.id
 *   WHERE step.tour_id = ?
 *
 * ON DELETE SET NULL — if a curator removes an atom activity later, the
 * step keeps its narrative content but the "+ Add" CTA stops appearing.
 *
 * Run once per environment:
 *
 *   npx tsx scripts/add-fixed-tour-step-activity-link.ts
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

  console.log("Adding fixed_tour_steps.activity_id (idempotent)...");

  await sql`
    ALTER TABLE fixed_tour_steps
      ADD COLUMN IF NOT EXISTS activity_id uuid
        REFERENCES activities(id) ON DELETE SET NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tour_steps_activity
      ON fixed_tour_steps(activity_id)
  `;

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
