import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { purgeStaleMessages } from "@/server/services/purge-messages";

/**
 * Vercel Cron: hard-delete chat messages older than 30 days.
 *
 * Schedule: daily at 04:00 UTC (11:00 Vietnam local), defined in
 * vercel.json. Vercel Hobby plans are limited to daily crons; the
 * retention window is "at most 30 days + 1 day grace", which is
 * acceptable for a privacy promise of "30 days".
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Secret is shared with the
 * other cron at /api/cron/reap-orders -- both run server-to-server only,
 * so a single rotation covers both endpoints.
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
    const result = await purgeStaleMessages(db, 30);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("purge-messages cron failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
