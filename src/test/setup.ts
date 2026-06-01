// Set deterministic test env BEFORE any module imports below (which transitively
// pull in src/server/db/index.ts that reads DATABASE_URL at module load time).
// Using `beforeAll` here would be too late — vitest's `setupFiles` body still
// runs before each test file's top-level imports, so any env vars needed at
// module-load time must be set at the top of this file, not inside a hook.
process.env.JWT_SECRET ??= "test-jwt-secret-minimum-thirty-two-characters!!";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.OAUTH_REDIRECT_BASE ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgres://test/test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import { beforeAll, afterAll, afterEach } from "vitest";
import * as schema from "../server/db/schema";

/**
 * One PGlite instance per Vitest worker, lazily booted. Tests share it via the
 * exported `testDb` getter and reset their state via `resetDb` between cases.
 *
 * PGlite is a real Postgres running in WASM in-process. It produces the same
 * SQL planner + constraint errors as Neon, so integration tests catch foreign
 * key / unique violations the same way production would.
 */

type Schema = typeof schema;
type TestDb = ReturnType<typeof drizzle<Schema>>;

let pglite: PGlite | undefined;
let _db: TestDb | undefined;

export function getTestDb(): TestDb {
  if (!_db) {
    throw new Error("Test DB not initialised; ensure setup.ts runs in beforeAll.");
  }
  return _db;
}

// Deterministic env the tested code reads (auth middleware, oauth helpers).
// The env-var assignments live above the imports — see the comment at the top
// of this file. Anything that doesn't need to be ready at module-load time
// stays in beforeAll.
beforeAll(async () => {
  pglite = await PGlite.create();
  _db = drizzle(pglite, { schema });

  // Drizzle committed migrations 0000-0003 create users/places/tours/etc.
  await migrate(_db, {
    migrationsFolder: path.resolve(__dirname, "../server/db/migrations"),
  });

  // PGlite uses the extended query protocol which rejects multi-statement
  // strings. Every DDL statement must go through `execute` individually.
  // `accounts` is created by an out-of-band idempotent script (see
  // scripts/create-accounts-table.ts). Mirror that DDL here so tests observe
  // the same schema production uses.
  const statements: string[] = [
    `CREATE TABLE IF NOT EXISTS accounts (
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       type VARCHAR(20) NOT NULL,
       provider VARCHAR(40) NOT NULL,
       provider_account_id VARCHAR(255) NOT NULL,
       access_token TEXT,
       refresh_token TEXT,
       id_token TEXT,
       expires_at INTEGER,
       token_type VARCHAR(20),
       scope VARCHAR(255),
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW(),
       PRIMARY KEY (provider, provider_account_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)`,

    // Marketplace additions (see scripts/create-host-marketplace.ts). Order
    // matters: experience columns first, then the tour FK referencing them.
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'curated'`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS review_notes TEXT`,
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_experiences_author ON experiences(author_id)`,
    `CREATE INDEX IF NOT EXISTS idx_experiences_public ON experiences(status, kind)`,
    `CREATE INDEX IF NOT EXISTS idx_tours_experience ON tours(experience_id)`,

    // host_payouts (see scripts/create-host-payouts-table.ts). Mirrors prod DDL.
    `CREATE TABLE IF NOT EXISTS host_payouts (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       host_id UUID NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
       amount INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       status VARCHAR(20) NOT NULL DEFAULT 'pending',
       period_start TIMESTAMPTZ NOT NULL,
       period_end TIMESTAMPTZ NOT NULL,
       paid_at TIMESTAMPTZ,
       bank_reference VARCHAR(100),
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_host_payouts_host ON host_payouts(host_id)`,
    `CREATE INDEX IF NOT EXISTS idx_host_payouts_period ON host_payouts(host_id, period_end)`,

    // Product pivot (see scripts/create-product-pivot-tables.ts). Mirrors prod DDL.
    `CREATE TABLE IF NOT EXISTS activities (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       author_id UUID REFERENCES users(id) ON DELETE SET NULL,
       title VARCHAR(200) NOT NULL,
       slug VARCHAR(250) UNIQUE,
       subtitle VARCHAR(300),
       description TEXT,
       category VARCHAR(40) NOT NULL,
       price_amount INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       duration_minutes INTEGER NOT NULL,
       max_capacity_per_slot INTEGER NOT NULL DEFAULT 8,
       place_id UUID REFERENCES places(id) ON DELETE SET NULL,
       photos TEXT[] DEFAULT '{}',
       highlights JSONB DEFAULT '[]',
       included JSONB DEFAULT '[]',
       requirements JSONB DEFAULT '[]',
       guide_optional BOOLEAN DEFAULT true,
       guide_addon_vnd INTEGER DEFAULT 200000,
       status VARCHAR(20) NOT NULL DEFAULT 'draft',
       published_at TIMESTAMPTZ,
       review_notes TEXT,
       avg_rating NUMERIC(3,2) DEFAULT 0.00,
       total_bookings INTEGER DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_activities_author ON activities(author_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_public ON activities(status, category)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_place ON activities(place_id)`,

    // activity_slots. CHECK constraints mirror scripts/create-booking-integrity.ts
    // so tests catch any code path that accidentally violates the invariants.
    `CREATE TABLE IF NOT EXISTS activity_slots (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
       starts_at TIMESTAMPTZ NOT NULL,
       ends_at TIMESTAMPTZ NOT NULL,
       capacity INTEGER NOT NULL,
       booked_count INTEGER NOT NULL DEFAULT 0 CONSTRAINT activity_slots_booked_count_nonneg CHECK (booked_count >= 0),
       status VARCHAR(20) NOT NULL DEFAULT 'open',
       created_at TIMESTAMPTZ DEFAULT NOW(),
       CONSTRAINT activity_slots_booked_le_capacity CHECK (booked_count <= capacity)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_activity_slots_activity ON activity_slots(activity_id, starts_at)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_slots_window ON activity_slots(starts_at, ends_at)`,

    `CREATE TABLE IF NOT EXISTS orders (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID REFERENCES users(id) ON DELETE SET NULL,
       status VARCHAR(20) NOT NULL DEFAULT 'pending',
       subtotal_vnd INTEGER NOT NULL,
       discount_vnd INTEGER NOT NULL DEFAULT 0,
       total_vnd INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       bundle_codes JSONB DEFAULT '[]',
       paid_at TIMESTAMPTZ,
       cancelled_at TIMESTAMPTZ,
       cancel_reason VARCHAR(255),
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,

    `CREATE TABLE IF NOT EXISTS products (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       sku VARCHAR(40) UNIQUE NOT NULL,
       title VARCHAR(200) NOT NULL,
       slug VARCHAR(250) UNIQUE,
       subtitle VARCHAR(300),
       description TEXT,
       category VARCHAR(40) NOT NULL,
       base_price_vnd INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       photos TEXT[] DEFAULT '{}',
       is_active BOOLEAN DEFAULT true,
       bundle_discount_pct INTEGER DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,

    `CREATE TABLE IF NOT EXISTS product_variants (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
       sku VARCHAR(40) UNIQUE NOT NULL,
       label VARCHAR(100) NOT NULL,
       attributes JSONB DEFAULT '{}',
       price_override_vnd INTEGER,
       stock_quantity INTEGER NOT NULL DEFAULT 0 CONSTRAINT product_variants_stock_nonneg CHECK (stock_quantity >= 0),
       is_active BOOLEAN DEFAULT true,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)`,

    `CREATE TABLE IF NOT EXISTS cart_items (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       kind VARCHAR(20) NOT NULL,
       experience_id UUID REFERENCES experiences(id) ON DELETE CASCADE,
       activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
       activity_slot_id UUID REFERENCES activity_slots(id) ON DELETE CASCADE,
       product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
       parent_activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
       quantity INTEGER NOT NULL DEFAULT 1,
       price_snapshot_vnd INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       metadata JSONB DEFAULT '{}',
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cart_items_slot ON cart_items(activity_slot_id)`,

    // order_items.product_variant_id HAS a FK here (matches the FK added by
    // scripts/create-booking-integrity.ts on prod); prevents orphan
    // references that would make refund / analytics joins silently wrong.
    `CREATE TABLE IF NOT EXISTS order_items (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
       kind VARCHAR(20) NOT NULL,
       experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
       activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
       activity_slot_id UUID REFERENCES activity_slots(id) ON DELETE SET NULL,
       product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
       quantity INTEGER NOT NULL,
       unit_price_vnd INTEGER NOT NULL,
       line_total_vnd INTEGER NOT NULL,
       currency VARCHAR(3) NOT NULL DEFAULT 'VND',
       metadata JSONB DEFAULT '{}',
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_activity_slot ON order_items(activity_slot_id)`,

    // payments gains order_id + relaxes tour_id NOT NULL.
    `ALTER TABLE payments ALTER COLUMN tour_id DROP NOT NULL`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE`,

    // Chat overhaul (see scripts/create-chat-features.ts). Mirrors the
    // production DDL so tests catch any missing column / constraint.
    `ALTER TABLE messages
       ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS deleted_reason VARCHAR(30),
       ADD COLUMN IF NOT EXISTS attachment_url TEXT,
       ADD COLUMN IF NOT EXISTS attachment_kind VARCHAR(20),
       ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE,
       ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(40)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,

    // matches: relax NOT NULL + swap FK from CASCADE to SET NULL so the
    // survivor's conversation survives an account deletion. Idempotent:
    // we drop the legacy FK by its conventional Drizzle name and add a
    // replacement. PGlite rejects the ADD if the constraint already
    // exists, so we guard with DROP IF EXISTS first.
    `ALTER TABLE matches ALTER COLUMN user_a_id DROP NOT NULL`,
    `ALTER TABLE matches ALTER COLUMN user_b_id DROP NOT NULL`,
    `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_a_id_users_id_fk`,
    `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_b_id_users_id_fk`,
    `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_a_id_fkey`,
    `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_b_id_fkey`,
    `ALTER TABLE matches ADD CONSTRAINT matches_user_a_id_fk
       FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE matches ADD CONSTRAINT matches_user_b_id_fk
       FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE SET NULL`,

    `CREATE TABLE IF NOT EXISTS message_reactions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       emoji VARCHAR(16) NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_uniq
       ON message_reactions(message_id, user_id, emoji)`,
    `CREATE INDEX IF NOT EXISTS idx_message_reactions_message
       ON message_reactions(message_id)`,

    `CREATE TABLE IF NOT EXISTS message_reports (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
       reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       reason VARCHAR(40) NOT NULL,
       notes TEXT,
       status VARCHAR(20) NOT NULL DEFAULT 'open',
       resolved_at TIMESTAMPTZ,
       resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_message_reports_status
       ON message_reports(status, created_at)`,

    `CREATE TABLE IF NOT EXISTS user_blocks (
       blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       PRIMARY KEY (blocker_id, blocked_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
       ON user_blocks(blocked_id)`,

    // Phase A.6 — Digital Thank-you Letter. Inserted by the tour-complete
    // hook with `scheduled_at = completed_at + 1h`; the cron at
    // /api/cron/send-thank-you renders + sends the letter. Mirror the
    // schema.ts definition.
    `CREATE TABLE IF NOT EXISTS thank_you_letters (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id UUID NOT NULL UNIQUE REFERENCES tours(id) ON DELETE CASCADE,
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       scheduled_at TIMESTAMPTZ NOT NULL,
       sent_at TIMESTAMPTZ,
       read_at TIMESTAMPTZ,
       body JSONB NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_thank_you_user ON thank_you_letters(user_id, sent_at)`,
    `CREATE INDEX IF NOT EXISTS idx_thank_you_scheduled ON thank_you_letters(sent_at, scheduled_at)`,

    // Wrap-up coupons (see scripts/create-coupons-table.ts). Mirror the
    // prod DDL — same CHECK constraints, same partial unique index for
    // issuance idempotency, same payments.applied_coupon_id FK.
    `CREATE TABLE IF NOT EXISTS coupons (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       code VARCHAR(32) NOT NULL UNIQUE,
       kind VARCHAR(24) NOT NULL DEFAULT 'wrap_up',
       recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       source_tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
       discount_pct INTEGER NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
       expires_at TIMESTAMPTZ NOT NULL,
       redeemed_at TIMESTAMPTZ,
       redeemed_tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       CONSTRAINT coupons_redeemed_pair CHECK (
         (redeemed_at IS NULL AND redeemed_tour_id IS NULL)
         OR (redeemed_at IS NOT NULL AND redeemed_tour_id IS NOT NULL)
       )
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`,
    `CREATE INDEX IF NOT EXISTS idx_coupons_recipient ON coupons(recipient_user_id, redeemed_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_source_tour_unique
       ON coupons(source_tour_id)
       WHERE kind = 'wrap_up' AND source_tour_id IS NOT NULL`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS applied_coupon_id UUID
       REFERENCES coupons(id) ON DELETE SET NULL`,

    // Host public profile (see scripts/create-host-profile-slugs.ts).
    `ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS public_slug VARCHAR(80)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS host_profiles_public_slug_key ON host_profiles(public_slug) WHERE public_slug IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS saved_hosts (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       host_id UUID NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_hosts_user_host ON saved_hosts(user_id, host_id)`,
    `CREATE INDEX IF NOT EXISTS idx_saved_hosts_user ON saved_hosts(user_id)`,

    // Fixed Tour catalog (see scripts/create-fixed-tour-tables.ts). Mirror
    // the prod DDL so integration tests see the same constraints.
    `CREATE TABLE IF NOT EXISTS fixed_tours (
       tour_id VARCHAR(30) PRIMARY KEY,
       title_vi VARCHAR(255) NOT NULL,
       title_en VARCHAR(255) NOT NULL,
       chapter VARCHAR(20) NOT NULL CHECK (chapter IN ('MORNING_SHIFT', 'AFTERNOON_SHIFT', 'EVENING_SHIFT')),
       story_script_vi TEXT NOT NULL,
       story_script_en TEXT NOT NULL,
       duration_minutes INTEGER NOT NULL DEFAULT 240,
       max_participants INTEGER NOT NULL DEFAULT 6,
       base_price_vnd INTEGER NOT NULL,
       vector JSONB NOT NULL,
       is_active BOOLEAN NOT NULL DEFAULT true,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tours_chapter ON fixed_tours(chapter)`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tours_active ON fixed_tours(is_active)`,
    `CREATE TABLE IF NOT EXISTS fixed_tour_steps (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id VARCHAR(30) NOT NULL REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
       step_order INTEGER NOT NULL,
       target_time_offset INTEGER NOT NULL,
       location_name_vi VARCHAR(255) NOT NULL,
       location_name_en VARCHAR(255) NOT NULL,
       latitude DOUBLE PRECISION,
       longitude DOUBLE PRECISION,
       action_log_vi TEXT NOT NULL,
       action_log_en TEXT NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_tour_steps_unique ON fixed_tour_steps(tour_id, step_order)`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tour_steps_tour ON fixed_tour_steps(tour_id)`,
    `CREATE TABLE IF NOT EXISTS fixed_tour_tags (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id VARCHAR(30) NOT NULL REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
       tag_class VARCHAR(20) NOT NULL CHECK (tag_class IN ('MATERIAL', 'PERSONA', 'KEYWORD')),
       tag_key VARCHAR(50) NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tour_tags_lookup ON fixed_tour_tags(tag_class, tag_key)`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tour_tags_tour ON fixed_tour_tags(tour_id)`,
    // tours.fixed_tour_id + at-most-one CHECK
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS fixed_tour_id VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_tours_fixed_tour ON tours(fixed_tour_id)`,
    `ALTER TABLE tours DROP CONSTRAINT IF EXISTS tours_template_xor_check`,
    `ALTER TABLE tours ADD CONSTRAINT tours_template_xor_check CHECK (NOT (fixed_tour_id IS NOT NULL AND experience_id IS NOT NULL))`,

    // Bilingual `_vi` / `_en` columns (see scripts/create-bilingual-columns.ts).
    // All NULLABLE — partial coverage is allowed.
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS title_vi VARCHAR(200)`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS title_en VARCHAR(200)`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS subtitle_vi VARCHAR(300)`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS subtitle_en VARCHAR(300)`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS description_vi TEXT`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS description_en TEXT`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS highlights_vi JSONB`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS highlights_en JSONB`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS included_vi JSONB`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS included_en JSONB`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS schedule_vi JSONB`,
    `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS schedule_en JSONB`,

    `ALTER TABLE places ADD COLUMN IF NOT EXISTS name_vi VARCHAR(200)`,
    `ALTER TABLE places ADD COLUMN IF NOT EXISTS name_en VARCHAR(200)`,
    `ALTER TABLE places ADD COLUMN IF NOT EXISTS description_vi VARCHAR(500)`,
    `ALTER TABLE places ADD COLUMN IF NOT EXISTS description_en VARCHAR(500)`,

    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS title_vi VARCHAR(200)`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS title_en VARCHAR(200)`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS subtitle_vi VARCHAR(300)`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS subtitle_en VARCHAR(300)`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS description_vi TEXT`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS description_en TEXT`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS highlights_vi JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS highlights_en JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS included_vi JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS included_en JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS requirements_vi JSONB`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS requirements_en JSONB`,

    `ALTER TABLE products ADD COLUMN IF NOT EXISTS title_vi VARCHAR(200)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS title_en VARCHAR(200)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS subtitle_vi VARCHAR(300)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS subtitle_en VARCHAR(300)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS description_vi TEXT`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en TEXT`,

    `ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS bio_vi VARCHAR(300)`,
    `ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS bio_en VARCHAR(300)`,

    // Crossover Matching catalog (see scripts/create-crossover-matching-tables.ts).
    // T-48h/-36h/-28h/-24h capacity rescue + AI matchmaking lifecycle.
    // Mirrors prod DDL so integration tests run the real CHECKs + partial
    // unique index that enforces "one pending proposal per request".
    `CREATE TABLE IF NOT EXISTS tour_crossover_requests (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
       requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       target_tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
       target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'expired', 'terminated')),
       matched_at TIMESTAMPTZ,
       terminated_at TIMESTAMPTZ,
       terminated_reason VARCHAR(40),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_crossover_requests_tour ON tour_crossover_requests(tour_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_crossover_requests_requester ON tour_crossover_requests(requester_user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_crossover_requests_target ON tour_crossover_requests(target_user_id, status)`,
    // Cluster B: no duplicate pending request per (requester, target tour).
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_crossover_requests_pending ON tour_crossover_requests(requester_user_id, target_tour_id) WHERE status = 'pending'`,
    `CREATE TABLE IF NOT EXISTS tour_proposal_edits (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       crossover_request_id UUID NOT NULL REFERENCES tour_crossover_requests(id) ON DELETE CASCADE,
       proposer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       edit_order INTEGER NOT NULL CHECK (edit_order BETWEEN 1 AND 3),
       edit_kind VARCHAR(10) NOT NULL CHECK (edit_kind IN ('add', 'remove')),
       target_activity_id UUID,
       status VARCHAR(20) NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
       responded_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_edits_one_pending ON tour_proposal_edits(crossover_request_id) WHERE status = 'pending_approval'`,
    `CREATE INDEX IF NOT EXISTS idx_proposal_edits_request ON tour_proposal_edits(crossover_request_id, edit_order)`,
    `CREATE TABLE IF NOT EXISTS escrow_adjustments (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
       crossover_request_id UUID NOT NULL REFERENCES tour_crossover_requests(id) ON DELETE CASCADE,
       cost_old INTEGER NOT NULL,
       cost_new INTEGER NOT NULL,
       delta INTEGER GENERATED ALWAYS AS (cost_new - cost_old) STORED,
       status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'refunded', 'failed')),
       payment_intent_ref VARCHAR(120),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       resolved_at TIMESTAMPTZ
     )`,
    `CREATE INDEX IF NOT EXISTS idx_escrow_adjustments_tour ON escrow_adjustments(tour_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_escrow_adjustments_request ON escrow_adjustments(crossover_request_id)`,
    // Cluster B: one escrow row per crossover request (lockItinerary guard).
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_escrow_adjustments_request ON escrow_adjustments(crossover_request_id)`,
    `CREATE TABLE IF NOT EXISTS priority_matching_vouchers (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       issued_for_request_id UUID REFERENCES tour_crossover_requests(id) ON DELETE SET NULL,
       uses_remaining INTEGER NOT NULL DEFAULT 1 CHECK (uses_remaining >= 0),
       expires_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_priority_vouchers_user ON priority_matching_vouchers(user_id, uses_remaining)`,
    `CREATE TABLE IF NOT EXISTS crossover_discovery_pushes (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tour_id UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
       recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       t_minus_hour INTEGER NOT NULL,
       pushed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       dedupe_key VARCHAR(120) NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_pushes_dedupe ON crossover_discovery_pushes(dedupe_key)`,
    `CREATE INDEX IF NOT EXISTS idx_discovery_pushes_tour ON crossover_discovery_pushes(tour_id)`,
    // tours extensions for crossover lifecycle
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS original_fixed_tour_id VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE SET NULL`,
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS crossover_pair_id UUID REFERENCES tours(id) ON DELETE SET NULL`,
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
    `ALTER TABLE tours ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(40)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tours_crossover_pair ON tours(crossover_pair_id) WHERE crossover_pair_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_tours_original_fixed_tour ON tours(original_fixed_tour_id)`,
    // Customized Tour atom backfill (see scripts/add-*.ts). Mirrors the
    // prod DDL added by the atom-backfill migration. ON DELETE SET NULL
    // both ways so test integrity matches the bidirectional FK behavior.
    `ALTER TABLE fixed_tours ADD COLUMN IF NOT EXISTS min_participants INTEGER NOT NULL DEFAULT 2`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS source_fixed_tour_step_id UUID REFERENCES fixed_tour_steps(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_activities_source_step ON activities(source_fixed_tour_step_id)`,
    `ALTER TABLE fixed_tour_steps ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES activities(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_fixed_tour_steps_activity ON fixed_tour_steps(activity_id)`,

    // Sessions table (see scripts/create-sessions-table.ts). Server-side
    // refresh-token store for the Cluster C auth lifecycle. Mirror prod DDL.
    `CREATE TABLE IF NOT EXISTS sessions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       refresh_token_hash VARCHAR(64) NOT NULL,
       family_id UUID NOT NULL,
       user_agent VARCHAR(400),
       expires_at TIMESTAMPTZ NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       revoked_at TIMESTAMPTZ
     )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash)`,
  ];
  for (const stmt of statements) {
    await _db.execute(sql.raw(stmt));
  }
});

afterAll(async () => {
  await pglite?.close();
  pglite = undefined;
  _db = undefined;
});

/**
 * Truncate all app tables between tests. Faster than re-running migrations.
 * Order matters for some FKs but `CASCADE` handles the tree.
 */
async function resetDb() {
  if (!_db) return;
  // Single TRUNCATE with a comma-separated list IS a single SQL statement per
  // Postgres grammar, so PGlite's extended protocol accepts it.
  await _db.execute(sql.raw(
    "TRUNCATE TABLE sessions, accounts, reports, emergency_contacts, reviews, host_payouts, " +
    "thank_you_letters, " +
    "priority_matching_vouchers, crossover_discovery_pushes, escrow_adjustments, " +
    "tour_proposal_edits, tour_crossover_requests, " +
    "order_items, orders, cart_items, activity_slots, activities, " +
    "product_variants, products, payments, tour_stops, tours, " +
    "fixed_tour_tags, fixed_tour_steps, fixed_tours, " +
    "message_reactions, message_reports, user_blocks, messages, " +
    "swipe_actions, matches, saved_hosts, saved_places, experiences, places, " +
    "host_availability, host_profiles, user_profiles, users " +
    "RESTART IDENTITY CASCADE",
  ));
}

afterEach(resetDb);

export { resetDb };
