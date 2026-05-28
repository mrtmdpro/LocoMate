import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { reapStaleOrders } from "@/server/services/reap-orders";

/**
 * Vercel cron endpoint that cancels pending orders older than 30 minutes.
 *
 * Wiring:
 *   - `vercel.json` schedules this URL every 15 minutes.
 *   - Vercel sends an `Authorization: Bearer $CRON_SECRET` header when
 *     invoking scheduled routes. We verify that token so the endpoint is
 *     not reachable by unauthenticated callers in production.
 *   - Locally / in preview (no CRON_SECRET set) the endpoint rejects ALL
 *     traffic; that's intentional -- we don't want stray pokes mutating
 *     the DB.
 *
 * Returns `{ cancelled: n }` so the Vercel cron UI shows a meaningful
 * per-run result.
 */
export const runtime = "nodejs";

const DEFAULT_GRACE_MINUTES = 30;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reapStaleOrders(db, DEFAULT_GRACE_MINUTES);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("reap-orders cron failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
