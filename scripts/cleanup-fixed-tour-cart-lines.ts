import "dotenv/config";
import postgres from "postgres";

/**
 * One-shot cleanup of dormant `fixed_tour` rows left over from the
 * short period when cart.add accepted that kind. No UI ever wrote to this
 * path, and order.confirmPayment was a silent no-op for fixed_tour lines
 * (no tours row created, no totalBookings bumped, no host earnings).
 *
 * Safe to run: for cart_items we just DELETE (the row represented no
 * commitment). For order_items we only DELETE where the owning order is
 * still `pending` -- a paid fixed_tour order_item would indicate a prior
 * money transfer with no corresponding tour, and deserves a manual audit.
 * Prints counts so we can confirm the cleanup was a no-op in practice.
 */
async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const sql = postgres(dbUrl, {
    ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
    max: 1,
  });

  const [{ count: cartCount }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM cart_items WHERE kind = 'fixed_tour'
  `;
  const [{ count: pendingOrderCount }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE oi.kind = 'fixed_tour' AND o.status = 'pending'
  `;
  const [{ count: paidOrderCount }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE oi.kind = 'fixed_tour' AND o.status <> 'pending'
  `;

  console.log(`Found ${cartCount} cart_items + ${pendingOrderCount} pending order_items + ${paidOrderCount} paid order_items with kind='fixed_tour'.`);

  if (paidOrderCount > 0) {
    console.error(
      `Refusing to auto-clean ${paidOrderCount} paid fixed_tour order_items. These represent money taken without a corresponding tour and need manual audit.`,
    );
    await sql.end();
    process.exit(2);
  }

  if (cartCount > 0) {
    await sql`DELETE FROM cart_items WHERE kind = 'fixed_tour'`;
    console.log(`  deleted ${cartCount} cart_items.`);
  }
  if (pendingOrderCount > 0) {
    // Also cancel the owning pending orders since they carried only the
    // deprecated line and have no path to payment now.
    await sql`
      UPDATE orders SET status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = 'fixed_tour_deprecated',
        updated_at = NOW()
      WHERE id IN (
        SELECT DISTINCT order_id FROM order_items WHERE kind = 'fixed_tour'
      ) AND status = 'pending'
    `;
    await sql`DELETE FROM order_items WHERE kind = 'fixed_tour'`;
    console.log(`  cancelled ${pendingOrderCount} pending orders + deleted their fixed_tour lines.`);
  }
  console.log("Done.");
  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
