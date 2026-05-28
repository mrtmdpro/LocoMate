import "dotenv/config";
import postgres from "postgres";

import { merchImage } from "../src/lib/merch-images";

/**
 * One-off photo backfill for the six curated merch products. Switches
 * each row's `photos` column from the legacy Pexels stock URLs (seeded
 * pre-May 2026) to the bilingual brand-rooted Locomate mockups now
 * served from `app/public/brand/merch/<slug>.jpg`.
 *
 * Idempotent: re-running just rewrites the same `/brand/merch/<slug>.jpg`
 * values. Non-curated rows (kind would be host-authored if/when FOLLOW-10
 * ships) are not in this list and are left alone.
 *
 * Pairs with:
 *   - `app/src/lib/merch-images.ts`              — single source of truth for the URL
 *   - `app/src/server/db/seed.ts` (productSeeds) — fresh installs pick the same URL up
 *
 * Run once per environment after the new JPGs have been deployed:
 *
 *   npx tsx scripts/backfill-merch-photos.ts
 *
 * The script prints a per-slug update count + a skipped count so the
 * deploy summary can quote concrete numbers.
 */

const SLUGS = [
  "old-quarter-tee",
  "pho-queue-cap",
  "alley-map-tote",
  "motorbike-keychain",
  "travelers-journal",
  "hanoi-poster-print",
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  let updated = 0;
  let skipped = 0;

  console.log("Backfilling merch product photos...");

  for (const slug of SLUGS) {
    // Single-element array keeps the existing `photos text[]` shape. The
    // URL is sourced from the same helper the seed and the UI use, so
    // the DB column and the on-disk filename can never drift.
    const url = merchImage(slug);
    const result = await sql`
      UPDATE products
         SET photos = ${[url]}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) {
      updated += result.count;
      console.log(`  ${slug.padEnd(20)} -> ${url}`);
    } else {
      skipped++;
      console.log(`  ${slug.padEnd(20)} -- not present in DB, skipped`);
    }
  }

  console.log("");
  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped (of ${SLUGS.length}).`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
