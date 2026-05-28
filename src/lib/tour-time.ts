import { VN_OFFSET_MS } from "@/lib/time";

/**
 * Compute a tour's wall-clock time window.
 *
 * Tours store scheduling as JSON on `tours.requestParams`:
 *   { date: "YYYY-MM-DD", startTime: "HH:MM", durationHours: number }
 *
 * Those are Vietnam-local values (the only timezone LOCOMATE operates in
 * today). Returns [startsAt, endsAt] as JS Date instants anchored in
 * Vietnam time for consistent overlap math with activity_slots which are
 * stored as TIMESTAMPTZ.
 *
 * Returns null if any required field is missing or malformed -- callers
 * treat that as "not time-comparable" and skip.
 */
export type RequestParamsWindow = {
  date?: unknown;
  startTime?: unknown;
  durationHours?: unknown;
};

export function tourTimeWindow(
  requestParams: RequestParamsWindow | null | undefined,
): { startsAt: Date; endsAt: Date } | null {
  if (!requestParams) return null;
  const { date, startTime, durationHours } = requestParams;
  if (typeof date !== "string") return null;
  if (typeof startTime !== "string") return null;
  if (typeof durationHours !== "number" || !Number.isFinite(durationHours)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTime)) return null;

  // Build the Vietnam-local instant by constructing a UTC date at the
  // same wall-clock time, then subtracting the VN offset. This avoids any
  // reliance on the server's local timezone.
  const [hh, mm] = startTime.split(":").map(Number);
  const wallUtcMs = Date.parse(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  if (!Number.isFinite(wallUtcMs)) return null;
  const startMs = wallUtcMs - VN_OFFSET_MS;
  const endMs = startMs + Math.max(0, durationHours) * 3600_000;
  return { startsAt: new Date(startMs), endsAt: new Date(endMs) };
}
