import "dotenv/config";
import postgres from "postgres";
import { slugify } from "../src/lib/slugify";

/**
 * One-shot backfill: generate `public_slug` values for any existing host
 * whose slug is still NULL after the DDL migration ran. Collisions are
 * handled by appending a numeric suffix (`-2`, `-3`, ...). Idempotent --
 * re-running after full backfill is a no-op.
 *
 *   npx tsx scripts/backfill-host-slugs.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(databaseUrl, { max: 1 });

  const rows = await sql<{ id: string; display_name: string }[]>`
    SELECT hp.id, u.display_name
    FROM host_profiles hp
    INNER JOIN users u ON hp.user_id = u.id
    WHERE hp.public_slug IS NULL
    ORDER BY hp.created_at
  `;

  if (rows.length === 0) {
    console.log("No hosts missing public_slug. Nothing to backfill.");
    await sql.end();
    return;
  }

  console.log(`Backfilling slugs for ${rows.length} host(s)...`);

  // Collect slugs already in use so we can detect collisions with the
  // freshly generated ones (e.g. two "Tran Linh"s).
  const usedRows = await sql<{ public_slug: string }[]>`
    SELECT public_slug FROM host_profiles WHERE public_slug IS NOT NULL
  `;
  const used = new Set<string>(usedRows.map((r) => r.public_slug));

  for (const row of rows) {
    const base = slugify(row.display_name) || "host";
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix++}`;
      if (suffix > 100) {
        throw new Error(`Could not allocate slug for host ${row.id}`);
      }
    }
    used.add(candidate);

    await sql`
      UPDATE host_profiles SET public_slug = ${candidate}, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    console.log(`  ${row.display_name} -> ${candidate}`);
  }

  console.log("Backfill complete.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
