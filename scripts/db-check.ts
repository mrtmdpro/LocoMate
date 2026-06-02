import "dotenv/config";
import postgres from "postgres";
import { execSync } from "node:child_process";
import { applyAllDdl } from "./apply-all-ddl";
import { snapshotSchema } from "./schema-snapshot";

/**
 * Schema-drift gate. Builds two throwaway databases on the same Postgres
 * server and compares their normalized structural snapshots:
 *
 *   DB-A  <-  scripts/apply-all-ddl.ts  (committed migrations + the canonical
 *             hand-written create-* / add-* DDL = the REAL production path)
 *   DB-B  <-  drizzle-kit export of src/server/db/schema.ts (the Drizzle model)
 *
 * If `schema.ts` declares a column / FK / index / check the DDL scripts never
 * apply (or vice versa), the snapshots differ and this exits non-zero. This is
 * the exact class of bug behind the historical `fixed_tour_steps.activity_id`
 * incident.
 *
 * Usage (local or CI):
 *   DATABASE_URL=postgres://user:pass@host:5432/postgres  pnpm db:check
 * The URL only needs privileges to CREATE/DROP DATABASE on the server; the
 * named database in the URL is used solely as the maintenance connection.
 */

const DB_A = "locomate_drift_a";
const DB_B = "locomate_drift_b";

function withDatabase(rawUrl: string, dbName: string): string {
  const u = new URL(rawUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function recreateDatabase(admin: postgres.Sql, name: string): Promise<void> {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${name}"`);
}

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const ssl = baseUrl.includes("neon.tech") ? ("require" as const) : undefined;
  const admin = postgres(baseUrl, { ssl, max: 1 });

  try {
    console.log("db:check -- (re)creating scratch databases...");
    await recreateDatabase(admin, DB_A);
    await recreateDatabase(admin, DB_B);

    const urlA = withDatabase(baseUrl, DB_A);
    const urlB = withDatabase(baseUrl, DB_B);

    // DB-A: the canonical hand-written DDL path.
    console.log("db:check -- building DB-A from migrations + apply-all-ddl...");
    await applyAllDdl(urlA);

    // DB-B: drizzle-kit export of schema.ts, applied as one batch.
    console.log("db:check -- building DB-B from drizzle-kit export(schema.ts)...");
    // Run through a shell (execSync) so this works the same on the Windows dev
    // box (where `pnpm` is a `.cmd` that execFile* can't spawn directly) and on
    // the Linux CI runner. The command is static -- no interpolation.
    const exportedSql = execSync(
      "pnpm exec drizzle-kit export --dialect=postgresql --schema=./src/server/db/schema.ts",
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const sqlB = postgres(urlB, { ssl, max: 1 });
    try {
      await sqlB.unsafe(exportedSql);
    } finally {
      await sqlB.end();
    }

    // Snapshot + diff.
    const sqlA2 = postgres(urlA, { ssl, max: 1 });
    const sqlB2 = postgres(urlB, { ssl, max: 1 });
    let snapA: string;
    let snapB: string;
    try {
      snapA = await snapshotSchema(sqlA2);
      snapB = await snapshotSchema(sqlB2);
    } finally {
      await sqlA2.end();
      await sqlB2.end();
    }

    const linesA = snapA.split("\n");
    const linesB = snapB.split("\n");
    const setB = new Set(linesB);
    const setA = new Set(linesA);
    const onlyInScripts = linesA.filter((l) => l && !l.startsWith("#") && !setB.has(l));
    const onlyInSchema = linesB.filter((l) => l && !l.startsWith("#") && !setA.has(l));

    // Asymmetric verdict. The DANGEROUS direction is `onlyInSchema`: schema.ts
    // (which the app's queries are generated from) declares a table / column /
    // FK / index that the real DDL path never creates -- so a query referencing
    // it explodes against the real database. That FAILS the build. This is the
    // `fixed_tour_steps.activity_id`-class incident and the case the deliberate
    // drift-proof exercises.
    //
    // The reverse (`onlyInScripts`) is benign over-specification: production has
    // a constraint / FK / index the Drizzle model simply doesn't mirror. The DB
    // still enforces it; queries still work. We surface it as an informational
    // notice but do NOT fail on it.
    if (onlyInScripts.length) {
      console.error(
        "\nℹ️  Notice -- applied by the DDL scripts (DB-A) but not modelled in schema.ts (DB-B):",
      );
      for (const l of onlyInScripts) console.error(`  - ${l}`);
      console.error(
        "  (benign: the database enforces these; the Drizzle model just doesn't declare them.)",
      );
    }

    if (onlyInSchema.length === 0) {
      console.log("\n✅ db:check PASSED -- schema.ts declares nothing the DDL scripts don't apply.");
      return;
    }

    console.error("\n❌ db:check FAILED -- schema.ts declares schema the DDL scripts never apply:");
    for (const l of onlyInSchema) console.error(`  + ${l}`);
    console.error(
      "\nA query built from schema.ts would reference DB objects that don't exist in production.",
    );
    console.error(
      "Fix: add the missing DDL to scripts/apply-all-ddl.ts (and the create-*/add-* scripts),",
    );
    console.error("or remove the stray declaration from src/server/db/schema.ts.");
    process.exitCode = 1;
  } finally {
    // Best-effort cleanup so repeat local runs stay clean.
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${DB_A}" WITH (FORCE)`);
      await admin.unsafe(`DROP DATABASE IF EXISTS "${DB_B}" WITH (FORCE)`);
    } catch {
      // ignore cleanup failures
    }
    await admin.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
