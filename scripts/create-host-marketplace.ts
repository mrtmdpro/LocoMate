import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent migration for the host marketplace.
 *
 * Adds five columns to `experiences`, one column to `tours`, and three
 * indexes. Backfills the six seeded curated experiences to `kind='curated'`,
 * `status='published'`. Safe to re-run.
 *
 * Pattern mirrors scripts/create-accounts-table.ts so devs can rely on the
 * same shell: set DATABASE_URL, run `npx tsx scripts/create-host-marketplace.ts`.
 */

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
  max: 1,
});

async function main() {
  console.log("Adding marketplace columns to `experiences`...");
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'curated'`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`;
  await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS review_notes TEXT`;

  console.log("Linking `tours.experience_id` to `experiences.id`...");
  await sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL`;

  console.log("Creating indexes...");
  await sql`CREATE INDEX IF NOT EXISTS idx_experiences_author ON experiences(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_experiences_public ON experiences(status, kind)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tours_experience ON tours(experience_id)`;

  // Backfill: existing experiences are LOCOMATE-curated. publishedAt = created_at
  // so sort-by-newest preserves history. Only runs on rows that predate the
  // migration (status column was added with DEFAULT 'published' so rows pass
  // the filter; we key on published_at being NULL instead).
  console.log("Backfilling curated experiences...");
  const backfill = await sql`
    UPDATE experiences
    SET kind = 'curated',
        status = 'published',
        published_at = COALESCE(published_at, created_at, NOW())
    WHERE published_at IS NULL
  `;
  console.log(`  Backfilled ${backfill.count} existing experiences.`);

  // Sanity stats so operators see the shape post-migration.
  const [counts] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'curated') AS curated,
      COUNT(*) FILTER (WHERE kind = 'host_custom') AS host_custom,
      COUNT(*) FILTER (WHERE status = 'published') AS published,
      COUNT(*) FILTER (WHERE status = 'draft') AS draft,
      COUNT(*) FILTER (WHERE status = 'archived') AS archived
    FROM experiences
  `;
  console.log("Post-migration counts:", counts);

  await sql.end();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
