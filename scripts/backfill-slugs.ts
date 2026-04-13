import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/slugify";

const dbUrl = process.env.DATABASE_URL!;
const client = postgres(dbUrl, { ssl: dbUrl.includes("neon.tech") ? "require" : undefined });
const db = drizzle(client, { schema });

async function backfill() {
  console.log("Backfilling slugs for places without them...");

  const placesWithoutSlug = await db
    .select({ id: schema.places.id, name: schema.places.name })
    .from(schema.places)
    .where(isNull(schema.places.slug));

  console.log(`Found ${placesWithoutSlug.length} places without slugs.`);

  let updated = 0;
  for (const p of placesWithoutSlug) {
    let slug = slugify(p.name);
    let suffix = 2;

    // Handle collisions
    while (true) {
      const existing = await db.query.places.findFirst({
        where: eq(schema.places.slug, slug),
      });
      if (!existing) break;
      slug = slugify(p.name) + "-" + suffix++;
    }

    await db
      .update(schema.places)
      .set({ slug })
      .where(eq(schema.places.id, p.id));
    updated++;

    if (updated % 50 === 0) console.log(`  ${updated}/${placesWithoutSlug.length}...`);
  }

  console.log(`Done! Backfilled ${updated} slugs.`);

  // Verify
  const remaining = await db
    .select({ id: schema.places.id })
    .from(schema.places)
    .where(isNull(schema.places.slug));
  console.log(`Remaining without slug: ${remaining.length}`);

  await client.end();
  process.exit(0);
}

backfill().catch((e) => { console.error(e); process.exit(1); });
