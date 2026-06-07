import { NextResponse } from "next/server";

export type CronRunResult = {
  errors?: string[];
};

export function validateCronRequest(request: Request): NextResponse | null {
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

  return null;
}

export async function runCronSweep<T extends CronRunResult>({
  request,
  run,
  sweep,
}: {
  request: Request;
  run: (now: Date) => Promise<T>;
  sweep: string;
}) {
  const authFailure = validateCronRequest(request);
  if (authFailure) return authFailure;

  const now = new Date();
  const ranAt = now.toISOString();

  try {
    const result = await run(now);
    logCronResult(sweep, result, ranAt);
    return NextResponse.json({ ok: true, ranAt, result, sweep });
  } catch (err) {
    console.error("cron sweep failed", {
      error: err instanceof Error ? err.message : "Unknown",
      ranAt,
      sweep,
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown", ranAt, sweep },
      { status: 500 },
    );
  }
}

export function logCronResult(sweep: string, result: CronRunResult, ranAt: string) {
  const payload = { ranAt, result, sweep };
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    console.warn("cron sweep completed with errors", payload);
    return;
  }

  console.info("cron sweep completed", payload);
}
