/**
 * One-time prod importer for the Fixed Tour catalog. Calls the same
 * `seedFixedTours` function used by the main seed runner, but refuses to
 * overwrite rows by default now that `/admin/catalog` is the source of truth.
 *
 *   npx tsx scripts/seed-fixed-tours-prod.ts
 *
 * To intentionally replace DB-authored rows from the seed file:
 *   FORCE_IMPORT=1 npx tsx scripts/seed-fixed-tours-prod.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { seedFixedTours } from "../src/server/db/seed-fixed-tours";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(databaseUrl, {
    ssl: databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")
      ? "require"
      : undefined,
    max: 1,
  });
  const db = drizzle(client, { schema });

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fixedTours);
    if (Number(count) > 0 && process.env.FORCE_IMPORT !== "1") {
      console.log(
        `Skipped Fixed Tour import: ${count} rows already exist. ` +
          "Use FORCE_IMPORT=1 to overwrite from seed files.",
      );
      return;
    }

    console.log("Importing curated Fixed Tour catalog (15 tours)...");
    const { tourCount } = await seedFixedTours(db);
    console.log(`Imported ${tourCount} curated Fixed Tours.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
