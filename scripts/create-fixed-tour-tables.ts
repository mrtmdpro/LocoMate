import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent creation of the Fixed Tour catalog tables + indexes + the
 * `tours.fixed_tour_id` polymorphic FK with its at-most-one CHECK.
 *
 * The team's spec at `docs/sửa .md` introduces:
 *   - fixed_tours        : curated catalog (chapter, bilingual story, vector)
 *   - fixed_tour_steps   : per-stop itinerary (lat/long, minute offsets)
 *   - fixed_tour_tags    : multi-class taxonomy (MATERIAL / PERSONA / KEYWORD)
 *   - tours.fixed_tour_id: nullable FK so the booking flow handles both
 *                          curated and host-authored templates polymorphically
 *
 * Drizzle's `db:push` wants an interactive TTY, so this ships as a manual
 * DDL script (same pattern as create-host-marketplace.ts etc.). Run once
 * per environment:
 *
 *   npx tsx scripts/create-fixed-tour-tables.ts
 *
 * Safe to re-run -- every statement is idempotent.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating Fixed Tour catalog tables (idempotent)...");

  // fixed_tours
  await sql`
    CREATE TABLE IF NOT EXISTS fixed_tours (
      tour_id varchar(30) PRIMARY KEY,
      title_vi varchar(255) NOT NULL,
      title_en varchar(255) NOT NULL,
      chapter varchar(20) NOT NULL,
      story_script_vi text NOT NULL,
      story_script_en text NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 240,
      max_participants integer NOT NULL DEFAULT 6,
      base_price_vnd integer NOT NULL,
      vector jsonb NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;

  // chapter CHECK — keep enforcement at the DB even though the API uses
  // a Zod enum, so a hand-run UPDATE can't slip in a bogus value.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fixed_tours_chapter_check'
      ) THEN
        ALTER TABLE fixed_tours
          ADD CONSTRAINT fixed_tours_chapter_check
          CHECK (chapter IN ('MORNING_SHIFT', 'AFTERNOON_SHIFT', 'EVENING_SHIFT'));
      END IF;
    END$$
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tours_chapter ON fixed_tours(chapter)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tours_active ON fixed_tours(is_active)
  `;

  // fixed_tour_steps
  await sql`
    CREATE TABLE IF NOT EXISTS fixed_tour_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id varchar(30) NOT NULL REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
      step_order integer NOT NULL,
      target_time_offset integer NOT NULL,
      location_name_vi varchar(255) NOT NULL,
      location_name_en varchar(255) NOT NULL,
      latitude double precision,
      longitude double precision,
      action_log_vi text NOT NULL,
      action_log_en text NOT NULL
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_tour_steps_unique
      ON fixed_tour_steps(tour_id, step_order)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tour_steps_tour
      ON fixed_tour_steps(tour_id)
  `;

  // fixed_tour_tags
  await sql`
    CREATE TABLE IF NOT EXISTS fixed_tour_tags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id varchar(30) NOT NULL REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
      tag_class varchar(20) NOT NULL,
      tag_key varchar(50) NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fixed_tour_tags_class_check'
      ) THEN
        ALTER TABLE fixed_tour_tags
          ADD CONSTRAINT fixed_tour_tags_class_check
          CHECK (tag_class IN ('MATERIAL', 'PERSONA', 'KEYWORD'));
      END IF;
    END$$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tour_tags_lookup
      ON fixed_tour_tags(tag_class, tag_key)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_fixed_tour_tags_tour
      ON fixed_tour_tags(tour_id)
  `;

  // tours.fixed_tour_id + index + at-most-one CHECK.
  //
  // The CHECK is "at-most-one set", not "exactly-one set" — algorithmic
  // tours from /plan/build legitimately have neither template, and we
  // don't want this migration to break those existing rows.
  await sql`
    ALTER TABLE tours
      ADD COLUMN IF NOT EXISTS fixed_tour_id varchar(30)
        REFERENCES fixed_tours(tour_id) ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tours_fixed_tour ON tours(fixed_tour_id)
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tours_template_xor_check'
      ) THEN
        ALTER TABLE tours
          ADD CONSTRAINT tours_template_xor_check
          CHECK (NOT (fixed_tour_id IS NOT NULL AND experience_id IS NOT NULL));
      END IF;
    END$$
  `;

  console.log("Fixed Tour catalog ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
