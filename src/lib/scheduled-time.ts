export const DEFAULT_SCHEDULED_SALE_CUTOFF_MS = 15 * 60 * 1000;

export type ScheduledTimeStatus = "ok" | "expired" | "too_close";

export function getScheduledTimeStatus(
  startsAt: Date | string | null | undefined,
  now: Date = new Date(),
  cutoffMs: number = DEFAULT_SCHEDULED_SALE_CUTOFF_MS,
): ScheduledTimeStatus {
  if (!startsAt) return "ok";

  const startMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startMs)) return "ok";

  const nowMs = now.getTime();
  if (startMs <= nowMs) return "expired";
  if (startMs - nowMs <= cutoffMs) return "too_close";
  return "ok";
}

export function scheduledTimeMessage(status: Exclude<ScheduledTimeStatus, "ok">): string {
  if (status === "expired") {
    return "This scheduled time has already passed. Remove it and choose another time.";
  }
  return "This scheduled time starts too soon to checkout. Remove it and choose another time.";
}

export function assertScheduledTimeBookable(
  startsAt: Date | string | null | undefined,
  now: Date = new Date(),
) {
  const status = getScheduledTimeStatus(startsAt, now);
  if (status === "ok") return null;
  return {
    code: status,
    message: scheduledTimeMessage(status),
  };
}
