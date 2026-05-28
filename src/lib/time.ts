/**
 * Vietnam has no DST and sits at UTC+7. Compute the UTC instant range and the
 * local YYYY-MM-DD that a Hanoi clock would currently show -- used for
 * filtering today's bookings and revenue on the host dashboard.
 *
 * Pure function, no imports -- safe to share between server code (host
 * dashboard query), test helpers (seeding "today" fixtures), and client UI
 * code that groups transactions by calendar day.
 */

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const VN_TIMEZONE = "Asia/Ho_Chi_Minh" as const;

export function vietnamDayBoundsUtc(now: Date = new Date()): {
  start: Date;
  end: Date;
  isoDate: string;
} {
  const nowVn = new Date(now.getTime() + VN_OFFSET_MS);
  const y = nowVn.getUTCFullYear();
  const m = nowVn.getUTCMonth();
  const d = nowVn.getUTCDate();
  const isoDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const start = new Date(Date.UTC(y, m, d) - VN_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, isoDate };
}

/**
 * Return the Vietnam-local YYYY-MM-DD for the given instant. Shared between
 * the server's revenue-by-day bucketing and any client code that needs to
 * group a list of payments/events by "what day a Hanoi host would call it".
 *
 * Accepts Date or ISO string. Returns "" for null/undefined so callers can
 * choose to substitute "unknown" / "—" as they see fit.
 */
export function vnLocalDate(input: Date | string | null | undefined): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
