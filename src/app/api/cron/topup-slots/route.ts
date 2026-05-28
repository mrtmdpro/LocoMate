import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { topupActivitySlots } from "@/lib/topup-activity-slots";

/**
 * Vercel cron endpoint that keeps published activities bookable by
 * topping up rolling time slots.
 *
 * Wiring:
 *   - `vercel.json` schedules this URL daily at 02:00 UTC.
 *   - Vercel sends `Authorization: Bearer $CRON_SECRET` when invoking
 *     scheduled routes -- we verify that token so the endpoint is not
 *     reachable by unauthenticated callers in production.
 *   - Locally / in preview (no CRON_SECRET set) the endpoint rejects ALL
 *     traffic; that's intentional -- we don't want stray pokes mutating
 *     the DB. The same logic is exposed as `pnpm slots:topup` for manual
 *     bootstrap runs.
 *
 * Returns `{ scanned, skipped, toppedUp, slotsInserted }` so the Vercel
 * cron UI shows a meaningful per-run result.
 */
export const runtime = "nodejs";

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
    const result = await topupActivitySlots(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("topup-slots cron failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
