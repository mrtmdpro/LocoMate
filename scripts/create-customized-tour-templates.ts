import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent creation of the Customized Tour Template catalog.
 *
 * Parallel to `create-fixed-tour-tables.ts` but for the flexible-product
 * inspiration matrix. A customized tour template is a themed day plan
 * (story + suggested theme + a 4-D personality vector) that the
 * traveler uses as a starting point on `/plan/build` — same matching
 * machinery as Fixed Tours (`lib/cosine.rankByCosine`), different
 * downstream booking flow (feeds the activity cart instead of booking
 * end-to-end).
 *
 * Run once per environment:
 *
 *   npx tsx scripts/create-customized-tour-templates.ts
 *
 * Safe to re-run — every statement is idempotent.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating Customized Tour Template catalog (idempotent)...");

  await sql`
    CREATE TABLE IF NOT EXISTS customized_tour_templates (
      template_id varchar(30) PRIMARY KEY,
      title_vi varchar(255) NOT NULL,
      title_en varchar(255) NOT NULL,
      subtitle_vi varchar(500),
      subtitle_en varchar(500),
      theme varchar(30) NOT NULL,
      story_vi text NOT NULL,
      story_en text NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 360,
      max_participants integer NOT NULL DEFAULT 4,
      base_price_vnd integer NOT NULL,
      vector jsonb NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_customized_tour_templates_theme
      ON customized_tour_templates(theme)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_customized_tour_templates_active
      ON customized_tour_templates(is_active)
  `;

  console.log("Customized Tour Template catalog ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
