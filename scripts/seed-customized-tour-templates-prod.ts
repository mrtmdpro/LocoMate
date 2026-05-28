/**
 * Standalone prod seeder for the Customized Tour Template catalog.
 * Calls `seedCustomizedTourTemplates` directly so prod can populate the
 * 9-template starter set without re-running the full main seed
 * (which wipes users/experiences/places/activities/etc.).
 *
 *   npx tsx scripts/seed-customized-tour-templates-prod.ts
 *
 * Prereq: the table must already exist. Run
 * `scripts/create-customized-tour-templates.ts` first (also idempotent).
 *
 * Safe to re-run: `seedCustomizedTourTemplates` deletes the existing
 * template rows first and re-inserts the canonical 9. Only touches
 * `customized_tour_templates`.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { seedCustomizedTourTemplates } from "../src/server/db/seed-customized-tour-templates";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(databaseUrl, {
    ssl:
      databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")
        ? "require"
        : undefined,
    max: 1,
  });
  const db = drizzle(client, { schema });

  console.log("Seeding Customized Tour Template catalog (9 templates)...");
  const { templateCount } = await seedCustomizedTourTemplates(db);
  console.log(`Seeded ${templateCount} customized tour templates.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
