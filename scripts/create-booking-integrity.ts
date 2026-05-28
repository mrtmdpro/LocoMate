import "dotenv/config";
import postgres from "postgres";

/**
 * Idempotent DDL that tightens booking invariants at the database layer:
 *
 *   - activity_slots.booked_count >= 0 (and <= capacity)
 *   - product_variants.stock_quantity >= 0
 *   - order_items.product_variant_id has a real FK to product_variants.id
 *
 * Intentionally safe to re-run: each ALTER uses a catalog check before
 * adding the constraint. Idempotency is per-constraint, not per-statement.
 *
 * Run before enforcing refund flow (Phase 4) so any accidental negative
 * decrement from a future bug is rejected at the DB layer instead of
 * silently corrupting inventory.
 */

async function addCheckIfMissing(
  sql: ReturnType<typeof postgres>,
  table: string,
  constraint: string,
  expression: string,
) {
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = ${constraint}
    ) AS exists
  `;
  if (exists) {
    console.log(`  ${table}.${constraint} already exists, skipping.`);
    return;
  }
  // Note: CHECK expression must be interpolated; it's a literal from this
  // script, never from user input, so there's no injection risk.
  await sql.unsafe(
    `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (${expression})`,
  );
  console.log(`  added ${table}.${constraint}`);
}

async function addFkIfMissing(
  sql: ReturnType<typeof postgres>,
  table: string,
  constraint: string,
  ddl: string,
) {
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = ${constraint}
    ) AS exists
  `;
  if (exists) {
    console.log(`  ${table}.${constraint} already exists, skipping.`);
    return;
  }
  await sql.unsafe(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${ddl}`);
  console.log(`  added ${table}.${constraint}`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const sql = postgres(dbUrl, {
    ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });

  console.log("Applying booking-integrity constraints...");

  await addCheckIfMissing(
    sql,
    "activity_slots",
    "activity_slots_booked_count_nonneg",
    "booked_count >= 0",
  );
  await addCheckIfMissing(
    sql,
    "activity_slots",
    "activity_slots_booked_le_capacity",
    "booked_count <= capacity",
  );
  await addCheckIfMissing(
    sql,
    "product_variants",
    "product_variants_stock_nonneg",
    "stock_quantity >= 0",
  );

  // order_items.product_variant_id has no FK today; add one. ON DELETE
  // SET NULL matches how other references on this table behave (the row
  // stays readable after a product deletion, just with a dangling label).
  await addFkIfMissing(
    sql,
    "order_items",
    "order_items_product_variant_fk",
    "FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL",
  );

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
