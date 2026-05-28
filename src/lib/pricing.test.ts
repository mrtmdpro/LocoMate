import { describe, test, expect } from "vitest";
import {
  HOST_TOUR_PRICING,
  TOUR_PRICING,
  computeHostPayout,
  computeTourPrice,
  formatTourPrice,
  isValidHostTourPrice,
} from "./pricing";

// Pure-function tests: no DB, no setup needed. Aim for 100% line + branch
// coverage on pricing.ts so a later refactor cannot drift without tripping.

describe("computeTourPrice (algorithmic tours)", () => {
  const matrix: Array<{ withHost: boolean; groupSize: number; expected: number }> = [
    { withHost: false, groupSize: 1, expected: TOUR_PRICING.baseSolo },
    { withHost: false, groupSize: 2, expected: TOUR_PRICING.group },
    { withHost: false, groupSize: 3, expected: TOUR_PRICING.group },
    { withHost: false, groupSize: 4, expected: TOUR_PRICING.group },
    { withHost: true, groupSize: 1, expected: TOUR_PRICING.withHostSolo },
    { withHost: true, groupSize: 2, expected: TOUR_PRICING.group },
    { withHost: true, groupSize: 3, expected: TOUR_PRICING.group },
    { withHost: true, groupSize: 4, expected: TOUR_PRICING.group },
  ];

  for (const { withHost, groupSize, expected } of matrix) {
    test(`{withHost: ${withHost}, groupSize: ${groupSize}} -> ${expected.toLocaleString()}`, () => {
      expect(computeTourPrice({ withHost, groupSize })).toBe(expected);
    });
  }

  test("hostAddon equals withHostSolo - baseSolo (constants stay in sync)", () => {
    expect(TOUR_PRICING.hostAddon).toBe(
      TOUR_PRICING.withHostSolo - TOUR_PRICING.baseSolo,
    );
  });
});

describe("formatTourPrice", () => {
  test("solo formatted with thousands separators", () => {
    const out = formatTourPrice({ withHost: false, groupSize: 1 });
    // Locale-agnostic: 250_000 stringified has exactly one separator char.
    expect(out.replace(/\D/g, "")).toBe("250000");
  });

  test("group formatted with thousands separators", () => {
    const out = formatTourPrice({ withHost: true, groupSize: 3 });
    expect(out.replace(/\D/g, "")).toBe("1000000");
  });
});

describe("isValidHostTourPrice", () => {
  test("accepts prices at the lower bound", () => {
    expect(isValidHostTourPrice(HOST_TOUR_PRICING.minPrice)).toBe(true);
  });

  test("accepts prices at the upper bound", () => {
    expect(isValidHostTourPrice(HOST_TOUR_PRICING.maxPrice)).toBe(true);
  });

  test("rejects one below the lower bound", () => {
    expect(isValidHostTourPrice(HOST_TOUR_PRICING.minPrice - 1)).toBe(false);
  });

  test("rejects one above the upper bound", () => {
    expect(isValidHostTourPrice(HOST_TOUR_PRICING.maxPrice + 1)).toBe(false);
  });

  test("rejects non-integer price (no VND subunit)", () => {
    expect(isValidHostTourPrice(500_000.5)).toBe(false);
  });

  test("rejects NaN", () => {
    expect(isValidHostTourPrice(Number.NaN)).toBe(false);
  });

  test("rejects Infinity", () => {
    expect(isValidHostTourPrice(Number.POSITIVE_INFINITY)).toBe(false);
  });

  test("rejects negative", () => {
    expect(isValidHostTourPrice(-500_000)).toBe(false);
  });

  test("rejects zero", () => {
    expect(isValidHostTourPrice(0)).toBe(false);
  });
});

describe("computeHostPayout", () => {
  test("splits cleanly when price is divisible by 5", () => {
    const { platformFee, hostPayout } = computeHostPayout(1_000_000);
    expect(platformFee).toBe(200_000);
    expect(hostPayout).toBe(800_000);
  });

  test("splits cleanly at lower bound", () => {
    const { platformFee, hostPayout } = computeHostPayout(HOST_TOUR_PRICING.minPrice);
    expect(platformFee).toBe(80_000);
    expect(hostPayout).toBe(320_000);
  });

  test("splits cleanly at upper bound", () => {
    const { platformFee, hostPayout } = computeHostPayout(HOST_TOUR_PRICING.maxPrice);
    expect(platformFee).toBe(1_000_000);
    expect(hostPayout).toBe(4_000_000);
  });

  test("rounds platform fee when the fraction is .5 or greater", () => {
    // 499_999 * 0.2 = 99_999.8 -> rounds to 100_000. hostPayout takes the
    // leftover 399_999 so the two parts sum to price.
    const { platformFee, hostPayout } = computeHostPayout(499_999);
    expect(platformFee).toBe(100_000);
    expect(hostPayout).toBe(399_999);
    expect(platformFee + hostPayout).toBe(499_999);
  });

  test("invariant: platformFee + hostPayout === price for 50 random valid prices", () => {
    for (let i = 0; i < 50; i++) {
      const price =
        HOST_TOUR_PRICING.minPrice +
        Math.floor(
          Math.random() *
            (HOST_TOUR_PRICING.maxPrice - HOST_TOUR_PRICING.minPrice + 1),
        );
      const { platformFee, hostPayout } = computeHostPayout(price);
      expect(platformFee + hostPayout).toBe(price);
    }
  });
});

describe("HOST_TOUR_PRICING shape invariants", () => {
  test("minPrice is less than maxPrice", () => {
    expect(HOST_TOUR_PRICING.minPrice).toBeLessThan(HOST_TOUR_PRICING.maxPrice);
  });

  test("commissionRate is between 0 and 1", () => {
    expect(HOST_TOUR_PRICING.commissionRate).toBeGreaterThan(0);
    expect(HOST_TOUR_PRICING.commissionRate).toBeLessThan(1);
  });

  test("currency matches TOUR_PRICING.currency (single currency app)", () => {
    expect(HOST_TOUR_PRICING.currency).toBe(TOUR_PRICING.currency);
  });
});
