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
});
