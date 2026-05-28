import "dotenv/config";
import postgres from "postgres";

/**
 * Sanity-check that no existing row violates the invariants we're about to
 * enforce with CHECK constraints. Run BEFORE `create-booking-integrity.ts`.
 * Prints row counts; any non-zero means we need a data migration first.
 */
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const overBooked = await sql`
    SELECT count(*)::int AS n FROM activity_slots WHERE booked_count > capacity
  `;
  const negBooked = await sql`
    SELECT count(*)::int AS n FROM activity_slots WHERE booked_count < 0
  `;
  const negStock = await sql`
    SELECT count(*)::int AS n FROM product_variants WHERE stock_quantity < 0
  `;
  // Any order_items referencing a non-existent product_variant (would
  // violate the FK we're about to add).
  const orphanVariants = await sql`
    SELECT count(*)::int AS n
    FROM order_items oi
    WHERE oi.product_variant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_variants pv WHERE pv.id = oi.product_variant_id
      )
  `;
  // Historical fixed_tour rows in cart or orders (Phase 3 deprecation).
  const fixedTourCart = await sql`
    SELECT count(*)::int AS n FROM cart_items WHERE kind = 'fixed_tour'
  `;
  const fixedTourOrders = await sql`
    SELECT count(*)::int AS n FROM order_items WHERE kind = 'fixed_tour'
  `;

  console.log("Pre-flight checks:");
  console.log(`  activity_slots with booked_count > capacity   : ${overBooked[0].n}`);
  console.log(`  activity_slots with booked_count < 0          : ${negBooked[0].n}`);
  console.log(`  product_variants with stock_quantity < 0      : ${negStock[0].n}`);
  console.log(`  order_items with orphan product_variant_id    : ${orphanVariants[0].n}`);
  console.log(`  cart_items with kind='fixed_tour' (deprecated): ${fixedTourCart[0].n}`);
  console.log(`  order_items with kind='fixed_tour' (deprecated): ${fixedTourOrders[0].n}`);

  const blocking = overBooked[0].n + negBooked[0].n + negStock[0].n + orphanVariants[0].n;
  if (blocking > 0) {
    console.error(`\n${blocking} violations would block the CHECK / FK constraints. Fix first.`);
    process.exit(1);
  }
  console.log("\nOK to proceed with create-booking-integrity.ts.");
  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
