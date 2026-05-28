import "dotenv/config";
import postgres from "postgres";

import { CURATED_EXPERIENCE_TRANSLATIONS } from "../src/server/db/translations/curated-experiences";
import { HOST_EXPERIENCE_TRANSLATIONS } from "../src/server/db/translations/host-experiences";
import { PLACE_TRANSLATIONS } from "../src/server/db/translations/places";
import { ACTIVITY_TRANSLATIONS } from "../src/server/db/translations/activities";
import { PRODUCT_TRANSLATIONS } from "../src/server/db/translations/products";
import { HOST_BIO_TRANSLATIONS } from "../src/server/db/translations/host-bios";

/**
 * One-off bilingual backfill against the live database. For every row in the
 * five content tables that matches a key in the translation files (slug or
 * public_slug), populate `_vi` and `_en` columns from the typed translations.
 *
 * Idempotent: re-running just rewrites the same values. Rows that don't
 * match a translation key are left alone -- the UI falls back to the
 * legacy non-suffixed column via `pickLocaleField`.
 *
 * Run AFTER `create-bilingual-columns.ts` has added the columns:
 *   npx tsx scripts/backfill-bilingual-content.ts
 *
 * Counts per table are printed at the end so the deploy summary can quote
 * concrete numbers ("backfilled 9 experiences, 56 places, ...").
 */

interface BackfillCounts {
  experiencesCurated: number;
  experiencesHost: number;
  places: number;
  activities: number;
  products: number;
  hostBios: number;
  experiencesSkipped: number;
  placesSkipped: number;
  activitiesSkipped: number;
  productsSkipped: number;
  hostBiosSkipped: number;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  const counts: BackfillCounts = {
    experiencesCurated: 0,
    experiencesHost: 0,
    places: 0,
    activities: 0,
    products: 0,
    hostBios: 0,
    experiencesSkipped: 0,
    placesSkipped: 0,
    activitiesSkipped: 0,
    productsSkipped: 0,
    hostBiosSkipped: 0,
  };

  console.log("Backfilling bilingual content...");

  // ── experiences (curated) ─────────────────────────────────────────────
  for (const [slug, t] of Object.entries(CURATED_EXPERIENCE_TRANSLATIONS)) {
    const result = await sql`
      UPDATE experiences
         SET title_vi       = ${t.title.vi},
             title_en       = ${t.title.en},
             subtitle_vi    = ${t.subtitle.vi},
             subtitle_en    = ${t.subtitle.en},
             description_vi = ${t.description.vi},
             description_en = ${t.description.en},
             highlights_vi  = ${sql.json(t.highlights.vi)},
             highlights_en  = ${sql.json(t.highlights.en)},
             included_vi    = ${sql.json(t.included.vi)},
             included_en    = ${sql.json(t.included.en)},
             schedule_vi    = ${sql.json(t.schedule.vi)},
             schedule_en    = ${sql.json(t.schedule.en)}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) counts.experiencesCurated += result.count;
    else counts.experiencesSkipped++;
  }

  // ── experiences (host-authored) ───────────────────────────────────────
  for (const [slug, t] of Object.entries(HOST_EXPERIENCE_TRANSLATIONS)) {
    const result = await sql`
      UPDATE experiences
         SET title_vi       = ${t.title.vi},
             title_en       = ${t.title.en},
             subtitle_vi    = ${t.subtitle.vi},
             subtitle_en    = ${t.subtitle.en},
             description_vi = ${t.description.vi},
             description_en = ${t.description.en},
             highlights_vi  = ${sql.json(t.highlights.vi)},
             highlights_en  = ${sql.json(t.highlights.en)},
             included_vi    = ${sql.json(t.included.vi)},
             included_en    = ${sql.json(t.included.en)},
             schedule_vi    = ${sql.json(t.schedule.vi)},
             schedule_en    = ${sql.json(t.schedule.en)}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) counts.experiencesHost += result.count;
    else counts.experiencesSkipped++;
  }

  // ── places ────────────────────────────────────────────────────────────
  for (const [slug, t] of Object.entries(PLACE_TRANSLATIONS)) {
    const result = await sql`
      UPDATE places
         SET name_vi        = ${t.name.vi},
             name_en        = ${t.name.en},
             description_vi = ${t.description.vi},
             description_en = ${t.description.en}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) counts.places += result.count;
    else counts.placesSkipped++;
  }

  // ── activities ────────────────────────────────────────────────────────
  for (const [slug, t] of Object.entries(ACTIVITY_TRANSLATIONS)) {
    const result = await sql`
      UPDATE activities
         SET title_vi        = ${t.title.vi},
             title_en        = ${t.title.en},
             subtitle_vi     = ${t.subtitle.vi},
             subtitle_en     = ${t.subtitle.en},
             description_vi  = ${t.description.vi},
             description_en  = ${t.description.en},
             highlights_vi   = ${sql.json(t.highlights.vi)},
             highlights_en   = ${sql.json(t.highlights.en)},
             included_vi     = ${sql.json(t.included.vi)},
             included_en     = ${sql.json(t.included.en)},
             requirements_vi = ${sql.json(t.requirements.vi)},
             requirements_en = ${sql.json(t.requirements.en)}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) counts.activities += result.count;
    else counts.activitiesSkipped++;
  }

  // ── products ──────────────────────────────────────────────────────────
  for (const [slug, t] of Object.entries(PRODUCT_TRANSLATIONS)) {
    const result = await sql`
      UPDATE products
         SET title_vi       = ${t.title.vi},
             title_en       = ${t.title.en},
             subtitle_vi    = ${t.subtitle.vi},
             subtitle_en    = ${t.subtitle.en},
             description_vi = ${t.description.vi},
             description_en = ${t.description.en}
       WHERE slug = ${slug}
    `;
    if (result.count > 0) counts.products += result.count;
    else counts.productsSkipped++;
  }

  // ── host_profiles ─────────────────────────────────────────────────────
  for (const [slug, t] of Object.entries(HOST_BIO_TRANSLATIONS)) {
    const result = await sql`
      UPDATE host_profiles
         SET bio_vi = ${t.bio.vi},
             bio_en = ${t.bio.en}
       WHERE public_slug = ${slug}
    `;
    if (result.count > 0) counts.hostBios += result.count;
    else counts.hostBiosSkipped++;
  }

  console.log("\nBackfill complete:");
  console.log(`  experiences (curated)     : ${counts.experiencesCurated} updated`);
  console.log(`  experiences (host-authored): ${counts.experiencesHost} updated`);
  console.log(`  places                     : ${counts.places} updated`);
  console.log(`  activities                 : ${counts.activities} updated`);
  console.log(`  products                   : ${counts.products} updated`);
  console.log(`  host bios                  : ${counts.hostBios} updated`);
  console.log("");
  console.log(`  skipped (no match): experiences=${counts.experiencesSkipped} places=${counts.placesSkipped} activities=${counts.activitiesSkipped} products=${counts.productsSkipped} hostBios=${counts.hostBiosSkipped}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
