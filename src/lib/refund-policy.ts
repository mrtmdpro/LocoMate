/**
 * PRD §5.8 booking-lifecycle money policy, as pure functions so both the
 * server (tour.cancelByTraveler / payment confirm) and the UI (cancel dialog,
 * checkout cutoff banner) compute identical numbers.
 *
 *  - FR-PAY-03: bookings close 48h before departure.
 *  - FR-PAY-04: traveler-cancellation refund tiers.
 */

/** Bookings close this long before departure (FR-PAY-03, T−48h). */
export const BOOKING_CUTOFF_MS = 48 * 60 * 60 * 1000;

/**
 * True when departure is inside the 48h cutoff (checkout should be blocked).
 * A null/unparseable departure window returns false — we never block a
 * booking we can't time-compare (legacy/algorithmic tours without a date).
 */
export function isBookingClosed(
  departureAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!departureAt) return false;
  return departureAt.getTime() - now.getTime() < BOOKING_CUTOFF_MS;
}

export type RefundTier = "full" | "half" | "none";

export interface RefundComputation {
  tier: RefundTier;
  /** 100 | 50 | 0 */
  refundPct: number;
  /** Rounded VND amount the traveler gets back. */
  refundVnd: number;
  /** Hours from now to departure; null when the window is unknown. */
  hoursUntilDeparture: number | null;
}

const HALF_WINDOW_MS = 24 * 60 * 60 * 1000;
const NONE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * FR-PAY-04 traveler-initiated cancellation refund tiers:
 *   > 24h before departure -> 100% (full)
 *   2h–24h before          -> 50%  (half — covers the held guide hour)
 *   < 2h before            -> 0%   (none)
 *
 * Boundaries follow the spec table: exactly 24h falls in the 2–24h (half)
 * band; exactly 2h is still half; only strictly under 2h is zero. When the
 * departure window is unknown we default to a full refund (customer-safe — we
 * can't prove they're inside a penalty window).
 */
export function computeTravelerRefund(opts: {
  paidVnd: number;
  departureAt: Date | null;
  now?: Date;
}): RefundComputation {
  const now = opts.now ?? new Date();
  const paid = Math.max(0, Math.round(opts.paidVnd));

  if (!opts.departureAt) {
    return { tier: "full", refundPct: 100, refundVnd: paid, hoursUntilDeparture: null };
  }

  const msUntil = opts.departureAt.getTime() - now.getTime();
  const hoursUntilDeparture = msUntil / 3_600_000;

  let tier: RefundTier;
  let refundPct: number;
  if (msUntil > HALF_WINDOW_MS) {
    tier = "full";
    refundPct = 100;
  } else if (msUntil >= NONE_WINDOW_MS) {
    tier = "half";
    refundPct = 50;
  } else {
    tier = "none";
    refundPct = 0;
  }

  return {
    tier,
    refundPct,
    refundVnd: Math.round((paid * refundPct) / 100),
    hoursUntilDeparture,
  };
}
