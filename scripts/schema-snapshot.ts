import "dotenv/config";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Produce a deterministic, normalized snapshot of a Postgres `public` schema.
 * Payload CMS owns editorial tables in the separate `payload` schema; those
 * are intentionally excluded from Cluster D drift checks so CMS-managed
 * migrations do not fight the app's Drizzle/DDL safety gate.
 *
 * Why a catalog snapshot instead of a raw `pg_dump --schema-only` text diff:
 * the two databases the `schema-drift` job compares are built by independent
 * paths -- DB-A from the hand-written DDL scripts (`apply-all-ddl.ts`), DB-B
 * from `drizzle-kit export` of `schema.ts`. They produce the SAME logical
 * schema but with DIFFERENT auto-generated constraint/index NAMES (e.g.
 * `activities_slug_key` vs `activities_slug_unique`) and different statement
 * ordering, which makes a raw text diff hopelessly noisy. Reading the live
 * catalog instead lets Postgres canonicalize every type and default
 * (`'0.00'` vs `0.00`, `'{}'::text[]`, ...), and we deliberately strip object
 * names + sort everything. What remains is the structural truth the gate
 * cares about: which columns/types/nullability/defaults/generation, which FK
 * targets + ON DELETE rules, and which (unique) indexes + predicates exist. A
 * column/FK/index present in `schema.ts` but absent from the DDL scripts (or
 * vice versa) shows up as a diff; cosmetic naming does not.
 *
 * CHECK constraints are deliberately NOT compared: the Drizzle model in this
 * repo does not declare `check()` constraints, while the DDL scripts apply many
 * (status enums, non-negative counters, the tours template-XOR). Those CHECKs
 * are real in production and are exercised by the PGlite integration suite, but
 * including them here would make every run a guaranteed mismatch with no signal.
 */
export async function snapshotSchema(sql: postgres.Sql): Promise<string> {
  const sections: string[] = [];

  const columns = await sql<
    {
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_generated: string;
      generation_expression: string | null;
    }[]
  >`
    SELECT table_name, column_name, data_type, udt_name, is_nullable,
           column_default, character_maximum_length, numeric_precision,
           numeric_scale, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name
  `;
  sections.push("# COLUMNS");
  sections.push(
    ...columns
      .map((c) => {
        const len =
          c.character_maximum_length != null
            ? `(${c.character_maximum_length})`
            : c.numeric_precision != null
              ? `(${c.numeric_precision},${c.numeric_scale ?? 0})`
              : "";
        const parts = [
          `${c.table_name}.${c.column_name}`,
          `${c.data_type}${len}`,
          `udt=${c.udt_name}`,
          `nullable=${c.is_nullable}`,
          `default=${c.column_default ?? ""}`,
        ];
        if (c.is_generated && c.is_generated !== "NEVER") {
          parts.push(`generated=${c.is_generated}:${c.generation_expression ?? ""}`);
        }
        return parts.join(" | ");
      })
      .sort(),
  );

  const fks = await sql<
    {
      table_name: string;
      column_name: string;
      foreign_table: string;
      foreign_column: string;
      delete_rule: string;
      update_rule: string;
    }[]
  >`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `;
  sections.push("", "# FOREIGN KEYS");
  sections.push(
    ...fks
      .map(
        (f) =>
          `${f.table_name}.${f.column_name} -> ${f.foreign_table}.${f.foreign_column} ` +
          `on_delete=${f.delete_rule} on_update=${f.update_rule}`,
      )
      .sort(),
  );

  // Indexes (covers PKs + unique constraints, which Postgres backs with a
  // unique index). Strip the index NAME so independently-named-but-identical
  // indexes match; keep table, uniqueness, columns and any partial predicate.
  const indexes = await sql<{ indexdef: string }[]>`
    SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'
  `;
  sections.push("", "# INDEXES");
  sections.push(
    ...indexes
      .map((i) =>
        i.indexdef
          // CREATE [UNIQUE] INDEX <name> ON ...  ->  CREATE [UNIQUE] INDEX ON ...
          .replace(/^(CREATE (?:UNIQUE )?INDEX )\S+ (ON )/, "$1$2")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .sort(),
  );

  return sections.join("\n") + "\n";
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = postgres(dbUrl, {
    ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });
  snapshotSchema(sql)
    .then(async (snap) => {
      process.stdout.write(snap);
      await sql.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await sql.end();
      process.exit(1);
    });
}
