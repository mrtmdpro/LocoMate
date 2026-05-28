/**
 * Shared coupon code format helpers. Lives in `lib/` (not under
 * `server/`) so client components can import the regex without
 * dragging in tRPC server-only modules.
 *
 * The same regex is the single source of truth on both sides:
 *   - server (`coupon.router.ts`, `payment.router.ts`) — Zod input
 *     validation rejects malformed codes before any DB lookup.
 *   - client (`checkout/page.tsx`) — pre-validates input so we don't
 *     fire a query for "12" or "wrap-abc" that would just fail at the
 *     boundary.
 */
export const COUPON_CODE_REGEX = /^WRAP-[A-Z2-9]{6}$/;
