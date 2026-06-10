import { describe, test, expect } from "vitest";
import {
  computeTravelerRefund,
  isBookingClosed,
  BOOKING_CUTOFF_MS,
} from "./refund-policy";

const NOW = new Date("2026-06-10T00:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("computeTravelerRefund — FR-PAY-04 tiers", () => {
  test("> 24h before departure → 100%", () => {
    const r = computeTravelerRefund({ paidVnd: 1_000_000, departureAt: hoursFromNow(25), now: NOW });
    expect(r.tier).toBe("full");
    expect(r.refundPct).toBe(100);
    expect(r.refundVnd).toBe(1_000_000);
  });

  test("exactly 24h before → 50% (boundary lands in the half band)", () => {
    const r = computeTravelerRefund({ paidVnd: 1_000_000, departureAt: hoursFromNow(24), now: NOW });
    expect(r.tier).toBe("half");
    expect(r.refundPct).toBe(50);
    expect(r.refundVnd).toBe(500_000);
  });

  test("between 2h and 24h → 50%", () => {
    const r = computeTravelerRefund({ paidVnd: 800_000, departureAt: hoursFromNow(10), now: NOW });
    expect(r.refundPct).toBe(50);
    expect(r.refundVnd).toBe(400_000);
  });

  test("exactly 2h before → 50% (still half)", () => {
    const r = computeTravelerRefund({ paidVnd: 1_000_000, departureAt: hoursFromNow(2), now: NOW });
    expect(r.refundPct).toBe(50);
  });

  test("< 2h before → 0%", () => {
    const r = computeTravelerRefund({ paidVnd: 1_000_000, departureAt: hoursFromNow(1), now: NOW });
    expect(r.tier).toBe("none");
    expect(r.refundPct).toBe(0);
    expect(r.refundVnd).toBe(0);
  });

  test("unknown departure window → full refund (customer-safe)", () => {
    const r = computeTravelerRefund({ paidVnd: 1_000_000, departureAt: null, now: NOW });
    expect(r.tier).toBe("full");
    expect(r.refundPct).toBe(100);
    expect(r.hoursUntilDeparture).toBeNull();
  });
});

describe("isBookingClosed — FR-PAY-03 T−48h cutoff", () => {
  test("outside 48h is open", () => {
    expect(isBookingClosed(hoursFromNow(49), NOW)).toBe(false);
  });
  test("inside 48h is closed", () => {
    expect(isBookingClosed(hoursFromNow(47), NOW)).toBe(true);
  });
  test("null departure is never closed", () => {
    expect(isBookingClosed(null, NOW)).toBe(false);
  });
  test("cutoff constant is 48 hours", () => {
    expect(BOOKING_CUTOFF_MS).toBe(48 * 60 * 60 * 1000);
  });
});
