import { and, eq, inArray, sql } from "drizzle-orm";
import { orders, payments } from "@/server/db/schema";
import type { db as serverDb } from "@/server/db";

/**
 * Reap orders stuck in `pending` longer than `olderThanMinutes`. Safe to
 * run repeatedly; already-cancelled / paid orders are ignored.
 *
 * Shared by the admin-triggered tRPC procedure (`order.reapStale`) and
 * the Vercel cron route at `/api/cron/reap-orders`. Keeping the logic
 * in one place avoids drift between the two entry points (which tend
 * to diverge when one accepts per-row overrides and the other doesn't).
 *
 * Note: pending orders do NOT hold inventory; slot / variant counters
 * only move at confirmPayment. So reaping is purely janitorial.
 */
export async function reapStaleOrders(
  db: typeof serverDb,
  olderThanMinutes: number,
): Promise<{ cancelled: number }> {
  return db.transaction(async (tx) => {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stale = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          sql`${orders.createdAt} < ${cutoff.toISOString()}::timestamptz`,
        ),
      );
    if (stale.length === 0) return { cancelled: 0 };
    const ids = stale.map((s) => s.id);
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: "payment_abandoned",
        updatedAt: new Date(),
      })
      .where(inArray(orders.id, ids));
    await tx
      .update(payments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(inArray(payments.orderId, ids), eq(payments.status, "pending")));
    return { cancelled: ids.length };
  });
}
