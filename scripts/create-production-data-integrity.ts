import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent production data-integrity repair.
 *
 * Fixes the remaining audit-class FK gaps that protect financial history:
 * - payments.tour_id and payments.user_id detach with ON DELETE SET NULL
 *   instead of blocking/deleting the payment audit row.
 * - tour_proposal_edits.target_activity_id references activities.id so
 *   crossover proposal rows cannot point at non-existent activities.
 *
 * Safe to re-run. Existing orphaned target_activity_id rows are nulled before
 * adding the FK; payment constraints are dropped/recreated with the same names
 * used by the canonical DDL path.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseUrl.includes("neon.tech") ? "require" : undefined,
  });

  try {
    console.log("Applying production data-integrity constraints...");

    await sql`ALTER TABLE payments ALTER COLUMN tour_id DROP NOT NULL`;
    await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tour_id_tours_id_fk`;
    await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tour_id_fkey`;
    await sql`
      ALTER TABLE payments
        ADD CONSTRAINT payments_tour_id_tours_id_fk
        FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL
    `;

    await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_users_id_fk`;
    await sql`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey`;
    await sql`
      ALTER TABLE payments
        ADD CONSTRAINT payments_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `;

    await sql`
      UPDATE tour_proposal_edits edit
         SET target_activity_id = NULL
       WHERE target_activity_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM activities activity WHERE activity.id = edit.target_activity_id
         )
    `;
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'tour_proposal_edits_target_activity_id_fkey'
        ) THEN
          ALTER TABLE tour_proposal_edits
            ADD CONSTRAINT tour_proposal_edits_target_activity_id_fkey
            FOREIGN KEY (target_activity_id) REFERENCES activities(id) ON DELETE SET NULL;
        END IF;
      END$$
    `;

    console.log("Production data-integrity constraints ready.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
