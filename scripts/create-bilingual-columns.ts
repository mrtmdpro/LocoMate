import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent bilingual content columns (Option A): add `_vi` and `_en` siblings
 * next to every customer-visible content field across five tables.
 *
 * Pattern (mirrors the curated Fixed Tour catalog at create-fixed-tour-tables.ts):
 *   - The original `<field>` column stays as legacy / last-resort fallback.
 *   - Two new NULLABLE columns `<field>_vi` and `<field>_en` carry the localized
 *     content. Partial coverage is intentional -- a host can fill only one
 *     language and the UI falls back via `pickLocaleField`.
 *   - No CHECK constraints: nullability + no enum keep the migration additive.
 *
 * Tables touched:
 *   experiences     -- title, subtitle, description, highlights, included, schedule
 *   places          -- name, description (address intentionally excluded)
 *   activities      -- title, subtitle, description, highlights, included, requirements
 *   products        -- title, subtitle, description
 *   host_profiles   -- bio
 *
 * Run once per environment:
 *   npx tsx scripts/create-bilingual-columns.ts
 *
 * Safe to re-run -- every statement is `ADD COLUMN IF NOT EXISTS`.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Adding bilingual `_vi` / `_en` columns (idempotent)...");

  // ── experiences ────────────────────────────────────────────────────────
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS title_vi varchar(200)`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS title_en varchar(200)`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS subtitle_vi varchar(300)`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS subtitle_en varchar(300)`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS description_vi text`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS description_en text`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS highlights_vi jsonb`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS highlights_en jsonb`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS included_vi jsonb`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS included_en jsonb`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS schedule_vi jsonb`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS schedule_en jsonb`;

  // ── places ─────────────────────────────────────────────────────────────
  // address intentionally excluded -- street addresses don't translate
  // cleanly, and the UI already shows them verbatim.
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS name_vi varchar(200)`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS name_en varchar(200)`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS description_vi varchar(500)`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS description_en varchar(500)`;

  // ── activities ─────────────────────────────────────────────────────────
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS title_vi varchar(200)`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS title_en varchar(200)`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS subtitle_vi varchar(300)`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS subtitle_en varchar(300)`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS description_vi text`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS description_en text`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS highlights_vi jsonb`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS highlights_en jsonb`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS included_vi jsonb`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS included_en jsonb`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS requirements_vi jsonb`;
  await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS requirements_en jsonb`;

  // ── products ───────────────────────────────────────────────────────────
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS title_vi varchar(200)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS title_en varchar(200)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS subtitle_vi varchar(300)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS subtitle_en varchar(300)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description_vi text`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en text`;

  // ── host_profiles ──────────────────────────────────────────────────────
  await sql`ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS bio_vi varchar(300)`;
  await sql`ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS bio_en varchar(300)`;

  console.log("Bilingual columns ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
