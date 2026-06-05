/**
 * One-time prod importer for the Customized Tour Template catalog.
 * Calls `seedCustomizedTourTemplates` directly so prod can populate the
 * starter set without re-running the full main seed, but refuses to overwrite
 * rows by default now that `/admin/catalog` is the source of truth.
 *
 *   npx tsx scripts/seed-customized-tour-templates-prod.ts
 *
 * Prereq: the table must already exist. Run
 * `scripts/create-customized-tour-templates.ts` first (also idempotent).
 *
 * To intentionally replace DB-authored rows from the seed file:
 *   FORCE_IMPORT=1 npx tsx scripts/seed-customized-tour-templates-prod.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
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

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.customizedTourTemplates);
    if (Number(count) > 0 && process.env.FORCE_IMPORT !== "1") {
      console.log(
        `Skipped Customized Tour Template import: ${count} rows already exist. ` +
          "Use FORCE_IMPORT=1 to overwrite from seed files.",
      );
      return;
    }

    console.log("Importing Customized Tour Template catalog (9 templates)...");
    const { templateCount } = await seedCustomizedTourTemplates(db);
    console.log(`Imported ${templateCount} customized tour templates.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
