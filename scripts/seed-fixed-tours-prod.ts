/**
 * Standalone prod seeder for the Fixed Tour catalog. Calls the same
 * `seedFixedTours` function used by the main seed runner, but without
 * touching `experiences` / `users` / anything else.
 *
 *   npx tsx scripts/seed-fixed-tours-prod.ts
 *
 * Safe to re-run: `seedFixedTours` deletes the existing 15 rows first
 * (cascading to steps + tags) and re-inserts the canonical set.
 */
import "dotenv/config";
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

  console.log("Seeding curated Fixed Tour catalog (15 tours)...");
  const { tourCount } = await seedFixedTours(db);
  console.log(`Seeded ${tourCount} curated Fixed Tours.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
