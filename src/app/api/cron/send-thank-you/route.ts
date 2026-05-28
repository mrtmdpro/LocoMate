import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { renderAndSendDue } from "@/server/services/thank-you-letter";

/**
 * Phase A.6 — Digital Thank-you Letter cron.
 *
 * Wakes up hourly (see vercel.json), picks all `thank_you_letters` rows
 * whose `scheduled_at < now()` and `sent_at IS NULL`, renders the letter
 * body via `renderAndSendDue`, and marks `sent_at`.
 *
 * Mirrors the auth pattern in `reap-orders/route.ts` — only Vercel cron
 * (which sends `Authorization: Bearer $CRON_SECRET`) can invoke this.
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
    const result = await renderAndSendDue(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("send-thank-you cron failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
