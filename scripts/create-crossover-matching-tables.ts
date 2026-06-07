import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent creation of the Crossover Matching tables + indexes + the
 * four new `tours` columns (CROSS-01).
 *
 * The team's spec at `docs/fixed-tour-feature.md` introduces a
 * capacity-rescue lifecycle for Fixed Tours that don't hit the
 * 2-traveler minimum: a T-48h warning, T-36h AI matchmaking discovery,
 * T-28h chat negotiation window, T-24h auto-cancel. This script lands
 * the underlying schema; the router + cron logic that drive it live in
 * subsequent PRs.
 *
 * Five new tables:
 *   - tour_crossover_requests       : pending/matched/expired match requests
 *   - tour_proposal_edits           : Smart Proposal Hub edit log (max 3, sequential)
 *   - escrow_adjustments            : Δ = Cost_New − Cost_Old payment records
 *   - priority_matching_vouchers    : awarded after Report; burned on feed render
 *   - crossover_discovery_pushes    : T-36h push notification dedupe table
 *
 * Four new `tours` columns:
 *   - original_fixed_tour_id        : set when migrating Fixed → Custom
 *   - crossover_pair_id             : the paired tour after a crossover lock
 *   - cancelled_at                  : set by T-24h auto-cancel or user action
 *   - cancel_reason                 : `system_t24h` | `user_cancel` | `escrow_failed`
 *
 * Run once per environment:
 *
 *   npx tsx scripts/create-crossover-matching-tables.ts
 *
 * Safe to re-run -- every statement is idempotent.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating Crossover Matching tables (idempotent)...");

  // ────────────────────────────────────────────────────────────────────
  // tour_crossover_requests
  // ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS tour_crossover_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status varchar(20) NOT NULL DEFAULT 'pending',
      matched_at timestamptz,
      terminated_at timestamptz,
      terminated_reason varchar(40),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_crossover_requests_status_check'
      ) THEN
        ALTER TABLE tour_crossover_requests
          ADD CONSTRAINT tour_crossover_requests_status_check
          CHECK (status IN ('pending', 'matched', 'expired', 'terminated'));
      END IF;
    END$$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_crossover_requests_tour
      ON tour_crossover_requests(tour_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_crossover_requests_requester
      ON tour_crossover_requests(requester_user_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_crossover_requests_target
      ON tour_crossover_requests(target_user_id, status)
  `;

  // ────────────────────────────────────────────────────────────────────
  // tour_proposal_edits — Smart Proposal Hub
  //
  // The partial unique index enforces the "sequential approval" rule:
  // at most one proposal can be in `pending_approval` per request. The
  // app cannot send a second proposal until the first is approved or
  // rejected.
  // ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS tour_proposal_edits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      crossover_request_id uuid NOT NULL REFERENCES tour_crossover_requests(id) ON DELETE CASCADE,
      proposer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      edit_order integer NOT NULL,
      edit_kind varchar(10) NOT NULL,
      target_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
      status varchar(20) NOT NULL DEFAULT 'pending_approval',
      responded_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_proposal_edits_kind_check'
      ) THEN
        ALTER TABLE tour_proposal_edits
          ADD CONSTRAINT tour_proposal_edits_kind_check
          CHECK (edit_kind IN ('add', 'remove'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_proposal_edits_status_check'
      ) THEN
        ALTER TABLE tour_proposal_edits
          ADD CONSTRAINT tour_proposal_edits_status_check
          CHECK (status IN ('pending_approval', 'approved', 'rejected'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tour_proposal_edits_order_check'
      ) THEN
        ALTER TABLE tour_proposal_edits
          ADD CONSTRAINT tour_proposal_edits_order_check
          CHECK (edit_order BETWEEN 1 AND 3);
      END IF;
    END$$
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_edits_one_pending
      ON tour_proposal_edits(crossover_request_id)
      WHERE status = 'pending_approval'
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_proposal_edits_request
      ON tour_proposal_edits(crossover_request_id, edit_order)
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

  // ────────────────────────────────────────────────────────────────────
  // escrow_adjustments — Δ-payment records
  //
  // `delta` is a generated column so `cost_new` / `cost_old` and `delta`
  // can never drift out of sync. Δ > 0 means the user owes more; Δ < 0
  // means the user is owed a partial refund.
  // ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS escrow_adjustments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      crossover_request_id uuid NOT NULL REFERENCES tour_crossover_requests(id) ON DELETE CASCADE,
      cost_old integer NOT NULL,
      cost_new integer NOT NULL,
      delta integer GENERATED ALWAYS AS (cost_new - cost_old) STORED,
      status varchar(20) NOT NULL DEFAULT 'pending',
      payment_intent_ref varchar(120),
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'escrow_adjustments_status_check'
      ) THEN
        ALTER TABLE escrow_adjustments
          ADD CONSTRAINT escrow_adjustments_status_check
          CHECK (status IN ('pending', 'confirmed', 'refunded', 'failed'));
      END IF;
    END$$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_escrow_adjustments_tour
      ON escrow_adjustments(tour_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_escrow_adjustments_request
      ON escrow_adjustments(crossover_request_id)
  `;

  // ────────────────────────────────────────────────────────────────────
  // priority_matching_vouchers
  // ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS priority_matching_vouchers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      issued_for_request_id uuid REFERENCES tour_crossover_requests(id) ON DELETE SET NULL,
      uses_remaining integer NOT NULL DEFAULT 1,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'priority_vouchers_uses_check'
      ) THEN
        ALTER TABLE priority_matching_vouchers
          ADD CONSTRAINT priority_vouchers_uses_check
          CHECK (uses_remaining >= 0);
      END IF;
    END$$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_priority_vouchers_user
      ON priority_matching_vouchers(user_id, uses_remaining)
  `;

  // ────────────────────────────────────────────────────────────────────
  // crossover_discovery_pushes — dedupe table for T-36h pushes
  //
  // dedupe_key = "<tour_id>-<recipient_user_id>-<t_minus_hour>" lets
  // the T-36h sweep be safely re-run without re-pushing the same user.
  // ────────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS crossover_discovery_pushes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      t_minus_hour integer NOT NULL,
      pushed_at timestamptz NOT NULL DEFAULT now(),
      dedupe_key varchar(120) NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_pushes_dedupe
      ON crossover_discovery_pushes(dedupe_key)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_discovery_pushes_tour
      ON crossover_discovery_pushes(tour_id)
  `;

  // ────────────────────────────────────────────────────────────────────
  // tours extensions
  //
  // No CHECK on tours.status (the codebase convention is varchar +
  // Zod enum at the API boundary). The status values 'customized_pending'
  // and 'system_cancelled' are enforced at the router layer.
  // ────────────────────────────────────────────────────────────────────
  await sql`
    ALTER TABLE tours
      ADD COLUMN IF NOT EXISTS original_fixed_tour_id varchar(30)
        REFERENCES fixed_tours(tour_id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE tours
      ADD COLUMN IF NOT EXISTS crossover_pair_id uuid
        REFERENCES tours(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE tours
      ADD COLUMN IF NOT EXISTS cancelled_at timestamptz
  `;
  await sql`
    ALTER TABLE tours
      ADD COLUMN IF NOT EXISTS cancel_reason varchar(40)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tours_crossover_pair
      ON tours(crossover_pair_id)
      WHERE crossover_pair_id IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tours_original_fixed_tour
      ON tours(original_fixed_tour_id)
  `;

  console.log("Crossover Matching tables ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
