import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent creation of the wrap-up coupon scaffolding:
 *   - coupons          : human-readable code + recipient + 90-day expiry +
 *                        single-use marker. Issued by tour.completeTour
 *                        after every completed booking. Redeemed
 *                        atomically inside payment.confirm.
 *   - payments.applied_coupon_id (nullable) : which coupon, if any,
 *                        was applied at /checkout. Server-authoritative;
 *                        the discounted amount lives on payments.amount.
 *
 * Two CHECK constraints guard data integrity at the DB level:
 *   - discount_pct in (0, 100]
 *   - (redeemed_at, redeemed_tour_id) are both NULL or both NON-NULL,
 *     so a coupon can't end up "used but pointing at no tour" or vice
 *     versa.
 *
 * Issuance idempotency is enforced by a PARTIAL UNIQUE INDEX on
 * `(source_tour_id) WHERE kind='wrap_up' AND source_tour_id IS NOT NULL`.
 * A re-run of completeTour hits 23505 and the service layer ignores it,
 * keeping the existing coupon row.
 *
 * Drizzle's `db:push` wants an interactive TTY, so this ships as a
 * manual DDL script (same pattern as create-fixed-tour-tables.ts,
 * create-crossover-matching-tables.ts, etc.). Safe to re-run.
 *
 *   npx tsx scripts/create-coupons-table.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating coupons table (idempotent)...");

  // coupons
  await sql`
    CREATE TABLE IF NOT EXISTS coupons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(32) NOT NULL UNIQUE,
      kind varchar(24) NOT NULL DEFAULT 'wrap_up',
      recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_tour_id uuid REFERENCES tours(id) ON DELETE SET NULL,
      discount_pct integer NOT NULL,
      expires_at timestamptz NOT NULL,
      redeemed_at timestamptz,
      redeemed_tour_id uuid REFERENCES tours(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now()
    )
  `;

  // discount_pct bounded — protects against a future code path that
  // tries to issue 0% or > 100% off by mistake.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupons_discount_pct_bounded'
      ) THEN
        ALTER TABLE coupons
          ADD CONSTRAINT coupons_discount_pct_bounded
          CHECK (discount_pct > 0 AND discount_pct <= 100);
      END IF;
    END$$
  `;

  // redeemed_at + redeemed_tour_id are paired — partial state is
  // impossible. The atomic redemption in payment.confirm writes both
  // together inside the same UPDATE, so this constraint can never fail
  // on the happy path; it's a backstop for hand-run UPDATE accidents.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupons_redeemed_pair'
      ) THEN
        ALTER TABLE coupons
          ADD CONSTRAINT coupons_redeemed_pair
          CHECK (
            (redeemed_at IS NULL AND redeemed_tour_id IS NULL)
            OR (redeemed_at IS NOT NULL AND redeemed_tour_id IS NOT NULL)
          );
      END IF;
    END$$
  `;

  // Named index over the unique code (the column's UNIQUE constraint
  // already creates one anonymously; this gives EXPLAIN-friendly naming
  // and matches the Drizzle schema).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)
  `;

  // Per-recipient hot path: /letters and coupon.getMine both filter on
  // recipient + unredeemed.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_coupons_recipient
      ON coupons(recipient_user_id, redeemed_at)
  `;

  // Issuance idempotency. One wrap_up coupon per source tour. A re-run
  // of tour.completeTour raises 23505 and the service layer treats it
  // as a no-op (same row already exists). The WHERE predicate excludes
  // `kind='manual'` coupons so admin-issued codes don't tangle with
  // tour-completion ones in this index.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_source_tour_unique
      ON coupons(source_tour_id)
      WHERE kind = 'wrap_up' AND source_tour_id IS NOT NULL
  `;

  // payments.applied_coupon_id (added column, nullable, no default).
  // ON DELETE SET NULL — wiping a coupon row leaves the payment intact
  // for audit. The actual discount amount is captured on
  // payments.amount at createIntent time, not derived from the coupon
  // row, so a deleted coupon never changes a historic charge.
  await sql`
    ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS applied_coupon_id uuid
        REFERENCES coupons(id) ON DELETE SET NULL
  `;

  console.log("Coupons table + payments.applied_coupon_id ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
