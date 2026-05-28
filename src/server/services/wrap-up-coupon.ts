/**
 * Issuance of the 10%-off wrap-up coupon awarded at the end of every
 * completed tour. Mirrors the brief in `docs/...` —
 *
 *   "Đính kèm một mã Coupon giảm giá 10% cho hành trình tiếp theo như
 *    một món quà tri ân."
 *
 * Issuance is best-effort and idempotent:
 *   - Best-effort because the wrap-up + thank-you-letter flow must NEVER
 *     block on a coupon write. The completeTour mutation wraps the call
 *     in try/catch, same shape as the existing `scheduleThankYouLetter`
 *     hook.
 *   - Idempotent because of the partial unique index
 *     `idx_coupons_source_tour_unique` — a re-run of completeTour for
 *     the same tour eats a 23505, we ignore it and return the existing
 *     row.
 *
 * The code format is `WRAP-` + 6 base-32 chars (RFC 4648 alphabet,
 * uppercase, lookalikes 0/O 1/I removed) so the human eye can copy it
 * off the thank-you letter without confusion. The keyspace is 32^6 ≈
 * 1.07 billion, well above collision risk at our scale; we still wrap
 * the insert in a small retry loop in case two simultaneous issuances
 * collide on `code` (the partial unique on `source_tour_id` covers the
 * happy path; this loop handles the genuinely-collide-on-code edge).
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { coupons } from "../db/schema";
import type { db as PrimaryDb } from "../db";

type AnyDb = typeof PrimaryDb;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no 0/O/1/I
const CODE_LENGTH = 6;
const WRAP_UP_DISCOUNT_PCT = 10;
const WRAP_UP_EXPIRY_DAYS = 90;
const MAX_CODE_COLLISION_RETRIES = 8;

/** Build a `WRAP-XXXXXX` code, unbiased over the 32-char alphabet. */
function generateCode(): string {
  // 6 bytes of randomness, modulo 32 each. Bias is negligible at 32 |
  // 256 and we don't reach for the constant-time guard the
  // crypto-grade utilities use because this isn't a secret.
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "WRAP-";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export interface IssuedCoupon {
  id: string;
  code: string;
  discountPct: number;
  expiresAt: Date;
}

/**
 * Issue a wrap-up coupon for a freshly-completed tour. Returns:
 *   - the issued coupon when a new row was written
 *   - the existing coupon when this tour was already wrapped up
 *   - null on an unexpected error (logged; caller logs too)
 *
 * Idempotency contract: at most one `kind='wrap_up'` coupon per
 * `source_tour_id`, enforced by `idx_coupons_source_tour_unique`.
 */
export async function issueWrapUpCoupon(
  db: AnyDb,
  tourId: string,
  recipientUserId: string,
): Promise<IssuedCoupon | null> {
  // Fast-path: is there already a wrap-up coupon for this tour? If yes,
  // return it without attempting an insert (saves a 23505 + log line in
  // the common idempotent re-run case). The partial unique index
  // guarantees there can be at most one such row.
  const existing = await db.query.coupons.findFirst({
    where: and(eq(coupons.kind, "wrap_up"), eq(coupons.sourceTourId, tourId)),
  });
  if (existing) {
    return {
      id: existing.id,
      code: existing.code,
      discountPct: existing.discountPct,
      expiresAt: existing.expiresAt,
    };
  }

  const expiresAt = new Date(Date.now() + WRAP_UP_EXPIRY_DAYS * 86_400_000);

  // Retry only on the `code` UNIQUE collision (extremely rare). The
  // `source_tour_id` partial-unique collision is handled by the
  // existing-row read above — if it ever still fires here it means a
  // concurrent issuance landed in the gap; we re-read and return that
  // row.
  for (let attempt = 0; attempt < MAX_CODE_COLLISION_RETRIES; attempt++) {
    const code = generateCode();
    try {
      const [inserted] = await db
        .insert(coupons)
        .values({
          code,
          kind: "wrap_up",
          recipientUserId,
          sourceTourId: tourId,
          discountPct: WRAP_UP_DISCOUNT_PCT,
          expiresAt,
        })
        .returning({
          id: coupons.id,
          code: coupons.code,
          discountPct: coupons.discountPct,
          expiresAt: coupons.expiresAt,
        });
      return inserted;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 23505 unique_violation. The two unique constraints we can hit
      // here are `coupons_code_unique` (retry) and
      // `idx_coupons_source_tour_unique` (re-read + return). The DB
      // driver wraps the SQLSTATE in the message string — we match on
      // the constraint name for clarity.
      if (message.includes("idx_coupons_source_tour_unique")) {
        const row = await db.query.coupons.findFirst({
          where: eq(coupons.sourceTourId, tourId),
        });
        if (row) {
          return {
            id: row.id,
            code: row.code,
            discountPct: row.discountPct,
            expiresAt: row.expiresAt,
          };
        }
        return null;
      }
      if (message.includes("coupons_code") || message.includes("23505")) {
        // Code collision — try again with a fresh random code.
        continue;
      }
      // Unknown error — bubble up so the caller's try/catch logs it.
      throw err;
    }
  }

  // Exhausted code-collision retries. Either the alphabet is hash-
  // exhausted (we'd need ~10^9 codes for any meaningful collision rate),
  // or the DB is misbehaving. Return null and let the caller log.
  return null;
}

/**
 * Fetch the wrap-up coupon for a given source tour, if one exists.
 * Used by the thank-you-letter renderer to stamp the code + expiry
 * into the letter body.
 */
export async function getWrapUpCouponForTour(
  db: AnyDb,
  tourId: string,
): Promise<IssuedCoupon | null> {
  const row = await db.query.coupons.findFirst({
    where: and(eq(coupons.kind, "wrap_up"), eq(coupons.sourceTourId, tourId)),
  });
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discountPct: row.discountPct,
    expiresAt: row.expiresAt,
  };
}
