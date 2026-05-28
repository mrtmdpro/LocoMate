/**
 * Sanity-check script: counts customized_tour_templates rows in the DB
 * pointed at by DATABASE_URL and prints a one-line summary of each.
 *
 *   npx tsx scripts/verify-customized-tour-templates.ts
 *
 * Useful right after running the migration + seed scripts to confirm
 * the catalog is populated before the deploy.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const sql = postgres(databaseUrl, {
    ssl:
      databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")
        ? "require"
        : undefined,
    max: 1,
  });
  const rows = await sql<
    {
      template_id: string;
      title_en: string;
      theme: string;
      vector: number[];
    }[]
  >`SELECT template_id, title_en, theme, vector FROM customized_tour_templates ORDER BY template_id`;
  console.log(`Row count: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `${row.template_id.padEnd(13)} | ${row.theme.padEnd(10)} | ${JSON.stringify(row.vector).padEnd(22)} | ${row.title_en}`,
    );
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
