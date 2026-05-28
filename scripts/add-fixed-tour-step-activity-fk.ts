import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration: add the missing FK on `fixed_tour_steps.activity_id`.
 *
 * Companion to `add-fixed-tour-step-activity-link.ts`. That script uses
 * `ADD COLUMN IF NOT EXISTS activity_id ... REFERENCES ...`, which is a
 * no-op (and silently skips the REFERENCES clause) when the column has
 * already been created. In prod, the column was added by hand during the
 * tiered-price reseed without its FK, so this script closes that drift.
 *
 * Adds the FK only if it is not already present, with the Postgres-default
 * name `fixed_tour_steps_activity_id_fkey` to match the table's existing
 * `fixed_tour_steps_tour_id_fkey`. `ON DELETE SET NULL` mirrors schema.ts.
 *
 *   npx tsx scripts/add-fixed-tour-step-activity-fk.ts
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

  try {
    console.log("Checking for fixed_tour_steps_activity_id_fkey...");

    const existing = await sql`
      SELECT conname FROM pg_constraint
        WHERE conrelid = 'fixed_tour_steps'::regclass
          AND conname = 'fixed_tour_steps_activity_id_fkey'
    `;

    if (existing.length > 0) {
      console.log("FK already exists; nothing to do.");
      return;
    }

    console.log(
      "Adding FK fixed_tour_steps_activity_id_fkey -> activities(id) ON DELETE SET NULL..."
    );
    await sql`
      ALTER TABLE fixed_tour_steps
        ADD CONSTRAINT fixed_tour_steps_activity_id_fkey
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
    `;
    console.log("FK added.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});