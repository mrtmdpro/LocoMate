import { describe, test, expect } from "vitest";
import { sql } from "drizzle-orm";
import { getTestDb } from "./setup";
import { createExperience } from "./fixtures";

/**
 * The PGlite test setup (setup.ts) applies the same ALTER / CREATE INDEX
 * statements the production migration (scripts/create-host-marketplace.ts)
 * runs. This suite asserts the shape those statements produced so schema
 * drift between the migration script and setup.ts gets caught immediately.
 *
 * We cannot execute the production script as-is inside a Vitest process
 * because it connects to DATABASE_URL via postgres-js; instead we re-run its
 * ALTER statements against PGlite and confirm IF NOT EXISTS keeps them
 * idempotent.
 */

type ColumnRow = { column_name: string; data_type: string; is_nullable: "YES" | "NO"; column_default: string | null };
type IndexRow = { indexname: string };
type ForeignKeyRow = {
  column_name: string;
  delete_rule: string;
  foreign_column: string;
  foreign_table: string;
  table_name: string;
};

async function experienceColumns() {
  const rows = await getTestDb().execute(sql.raw(
    "SELECT column_name, data_type, is_nullable, column_default " +
    "FROM information_schema.columns WHERE table_name = 'experiences'",
  ));
  return rows.rows as ColumnRow[];
}

async function tourColumns() {
  const rows = await getTestDb().execute(sql.raw(
    "SELECT column_name, data_type, is_nullable, column_default " +
    "FROM information_schema.columns WHERE table_name = 'tours'",
  ));
  return rows.rows as ColumnRow[];
}

async function indexes(table: string) {
  const rows = await getTestDb().execute(sql.raw(
    `SELECT indexname FROM pg_indexes WHERE tablename = '${table}'`,
  ));
  return (rows.rows as IndexRow[]).map((r) => r.indexname);
}

async function foreignKeys(table: string) {
  const rows = await getTestDb().execute(sql.raw(
    `SELECT
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table,
       ccu.column_name AS foreign_column,
       rc.delete_rule
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
       AND tc.table_name = '${table}'`,
  ));
  return rows.rows as ForeignKeyRow[];
}

describe("marketplace migration", () => {
  test("experiences has all five marketplace columns with correct nullability", async () => {
    const cols = await experienceColumns();
    const byName = Object.fromEntries(cols.map((c) => [c.column_name, c]));

    expect(byName.author_id).toBeDefined();
    expect(byName.author_id.is_nullable).toBe("YES");

    expect(byName.kind).toBeDefined();
    expect(byName.kind.is_nullable).toBe("NO");
    expect(byName.kind.column_default).toContain("curated");

    expect(byName.status).toBeDefined();
    expect(byName.status.is_nullable).toBe("NO");
    expect(byName.status.column_default).toContain("published");

    expect(byName.published_at).toBeDefined();
    expect(byName.published_at.is_nullable).toBe("YES");

    expect(byName.review_notes).toBeDefined();
    expect(byName.review_notes.is_nullable).toBe("YES");
  });

  test("tours gained experience_id FK column", async () => {
    const cols = await tourColumns();
    const experienceId = cols.find((c) => c.column_name === "experience_id");
    expect(experienceId).toBeDefined();
    expect(experienceId?.is_nullable).toBe("YES");
  });

  test("all three marketplace indexes exist", async () => {
    const expIdx = await indexes("experiences");
    expect(expIdx).toEqual(expect.arrayContaining([
      "idx_experiences_author",
      "idx_experiences_public",
    ]));

    const tourIdx = await indexes("tours");
    expect(tourIdx).toContain("idx_tours_experience");
  });

  test("re-applying the same DDL is a no-op (idempotent guard)", async () => {
    // Mirrors the production ALTER IF NOT EXISTS statements. Should not
    // throw when the columns already exist.
    const stmts = [
      `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE experiences ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'curated'`,
      `CREATE INDEX IF NOT EXISTS idx_experiences_author ON experiences(author_id)`,
    ];
    for (const s of stmts) {
      await getTestDb().execute(sql.raw(s));
    }
    // Assert no new columns / indexes appeared (count is stable).
    const cols = await experienceColumns();
    const authorIdColumns = cols.filter((c) => c.column_name === "author_id");
    expect(authorIdColumns).toHaveLength(1);
  });

  test("FK from tours.experience_id to experiences.id enforces existence", async () => {
    const exp = await createExperience({ kind: "curated", status: "published" });
    const db = getTestDb();
    // Valid link: succeeds.
    await expect(db.execute(sql.raw(
      `INSERT INTO users (id, email, display_name) VALUES ('11111111-1111-1111-1111-111111111111', 't@t.com', 'T')`,
    ))).resolves.toBeDefined();
    await expect(db.execute(sql.raw(
      `INSERT INTO tours (user_id, experience_id, request_params, package_type, price_amount, status)
       VALUES ('11111111-1111-1111-1111-111111111111', '${exp.id}', '{}'::jsonb, 'host_experience', 500000, 'preview')`,
    ))).resolves.toBeDefined();

    // Dangling FK: must be rejected by Postgres.
    await expect(db.execute(sql.raw(
      `INSERT INTO tours (user_id, experience_id, request_params, package_type, price_amount, status)
       VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '{}'::jsonb, 'host_experience', 500000, 'preview')`,
    ))).rejects.toThrow();
  });

  test("payment audit FKs detach instead of cascading on user/tour delete", async () => {
    const fks = await foreignKeys("payments");

    expect(fks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: "tour_id",
          delete_rule: "SET NULL",
          foreign_table: "tours",
        }),
        expect.objectContaining({
          column_name: "user_id",
          delete_rule: "SET NULL",
          foreign_table: "users",
        }),
      ]),
    );
  });

  test("product and crossover FKs are modelled in the canonical schema", async () => {
    await expect(foreignKeys("cart_items")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: "product_variant_id",
          delete_rule: "CASCADE",
          foreign_table: "product_variants",
        }),
      ]),
    );
    await expect(foreignKeys("order_items")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: "product_variant_id",
          delete_rule: "SET NULL",
          foreign_table: "product_variants",
        }),
      ]),
    );
    await expect(foreignKeys("tour_proposal_edits")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: "target_activity_id",
          delete_rule: "SET NULL",
          foreign_table: "activities",
        }),
      ]),
    );
    await expect(foreignKeys("tours")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: "crossover_pair_id",
          delete_rule: "SET NULL",
          foreign_table: "tours",
        }),
      ]),
    );
  });
});
