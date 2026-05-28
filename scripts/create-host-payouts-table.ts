import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent creation of the host_payouts table + indexes.
 *
 * Drizzle's `db:push` wants an interactive TTY, so we ship manual DDL
 * scripts for production-safe schema changes. Run once per environment:
 *
 *   npx tsx scripts/create-host-payouts-table.ts
 *
 * Safe to re-run -- every statement uses IF NOT EXISTS.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating host_payouts table (idempotent)...");

  await sql`
    CREATE TABLE IF NOT EXISTS host_payouts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      host_id uuid NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
      amount integer NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'VND',
      status varchar(20) NOT NULL DEFAULT 'pending',
      period_start timestamptz NOT NULL,
      period_end timestamptz NOT NULL,
      paid_at timestamptz,
      bank_reference varchar(100),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_host_payouts_host ON host_payouts(host_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_host_payouts_period ON host_payouts(host_id, period_end)
  `;

  console.log("host_payouts table ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
