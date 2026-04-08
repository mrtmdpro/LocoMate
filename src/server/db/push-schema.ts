import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const url = process.env.DATABASE_URL!;
console.log("Connecting to:", url.replace(/:[^:@]+@/, ":***@"));

const sql = postgres(url, { ssl: "require" });

async function push() {
  const migrationPath = join(__dirname, "migrations", "0000_chief_xavin.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");

  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Running ${statements.length} statements...`);

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      const first30 = stmt.slice(0, 50).replace(/\n/g, " ");
      console.log(`  OK: ${first30}...`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        console.log(`  SKIP (exists): ${stmt.slice(0, 50)}...`);
      } else {
        console.error(`  FAIL: ${stmt.slice(0, 50)}...`);
        console.error(`  Error: ${msg}`);
      }
    }
  }

  console.log("Schema push complete.");
  await sql.end();
}

push().catch((e) => {
  console.error(e);
  process.exit(1);
});
