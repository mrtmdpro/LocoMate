import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent DDL for the host public profile feature:
 *   - hostProfiles.public_slug -- nullable unique varchar(80)
 *   - saved_hosts table + unique (user_id, host_id) index
 *
 * Run once per environment:
 *   npx tsx scripts/create-host-profile-slugs.ts
 *
 * Slug backfill for existing hosts happens via the seed script + a
 * separate one-shot `scripts/backfill-host-slugs.ts` for production data.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  console.log("Creating host public-slug column + saved_hosts table (idempotent)...");

  await sql`
    ALTER TABLE host_profiles
    ADD COLUMN IF NOT EXISTS public_slug varchar(80)
  `;
  // Unique constraint on public_slug. Partial unique index so NULLs (pre-
  // backfill) don't collide; after backfill we can promote to a full
  // UNIQUE constraint if desired.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS host_profiles_public_slug_key
      ON host_profiles(public_slug)
      WHERE public_slug IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS saved_hosts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      host_id uuid NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_hosts_user_host
      ON saved_hosts(user_id, host_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_saved_hosts_user
      ON saved_hosts(user_id)
  `;

  console.log("Host public-slug + saved_hosts ready.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
