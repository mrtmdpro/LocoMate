// Single source of truth for tour pricing shared by the tour engine,
// the plan form summary, the preview page, and the host picker. Keep this
// file pure (no server/db imports) so it imports cleanly from client pages.

export interface TourPricingInput {
  withHost: boolean;
  groupSize: number;
}

export const TOUR_PRICING = {
  /** Solo self-guided tour (no host) */
  baseSolo: 250_000,
  /** Solo tour with a local host */
  withHostSolo: 750_000,
  /** Group tour (any size > 1), host included in this tier */
  group: 1_000_000,
  /** Premium for adding a host to a solo tour; derived: withHostSolo - baseSolo */
  hostAddon: 500_000,
  currency: "VND" as const,
} as const;

/**
 * Returns the tour price in VND. Server persists this as `tours.priceAmount`
 * and the checkout uses the persisted value; client pages call this for live
 * summary UI so the numbers always agree.
 */
export function computeTourPrice(input: TourPricingInput): number {
  if (input.groupSize > 1) return TOUR_PRICING.group;
  return input.withHost ? TOUR_PRICING.withHostSolo : TOUR_PRICING.baseSolo;
}

/** Formatted variant convenient for UI bindings. */
export function formatTourPrice(input: TourPricingInput): string {
  return computeTourPrice(input).toLocaleString();
}

// -----------------------------------------------------------------------------
// Host-authored marketplace pricing.
// Separate tier from algorithmic tours. The host picks a price within the
// bounds below; LOCOMATE keeps a fixed commission. Both bounds and commission
// are referenced server-side in `hostExperience.publish` for validation and
// client-side in the pricing wizard for the live breakdown.
// -----------------------------------------------------------------------------

export const HOST_TOUR_PRICING = {
  minPrice: 400_000,
  maxPrice: 5_000_000,
  commissionRate: 0.2,
  currency: "VND" as const,
} as const;

/**
 * Returns `true` iff `price` is finite, an integer in VND, and within the
 * published bounds. Fractional VND is rejected because Vietnamese currency
 * has no subunit and partial prices would misalign with payment rounding.
 */
export function isValidHostTourPrice(price: number): boolean {
  if (!Number.isFinite(price)) return false;
  if (!Number.isInteger(price)) return false;
  return (
    price >= HOST_TOUR_PRICING.minPrice &&
    price <= HOST_TOUR_PRICING.maxPrice
  );
}

/**
 * Splits a host-tour price into the host's take-home and the LOCOMATE fee.
 * platformFee is rounded half-up to the nearest VND so the two parts always
 * sum exactly to `price` (invariant asserted in pricing.test.ts).
 */
export function computeHostPayout(price: number): {
  hostPayout: number;
  platformFee: number;
} {
  const platformFee = Math.round(price * HOST_TOUR_PRICING.commissionRate);
  return { platformFee, hostPayout: price - platformFee };
}
