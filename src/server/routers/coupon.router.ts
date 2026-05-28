import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { router, protectedProcedure } from "../trpc";
import { coupons, tours } from "../db/schema";
import { COUPON_CODE_REGEX } from "@/lib/coupon-format";

/**
 * Wrap-up coupon surface. Two read-only procedures on the public side;
 * the actual `redeem` step is internal to `payment.confirm` so a
 * discount can never apply without a successful charge.
 *
 * Code format is `WRAP-XXXXXX` — 6 chars from the base-32 alphabet
 * (A-Z + 2-9, no 0/O/1/I). The regex lives in `@/lib/coupon-format`
 * so both client (checkout input) and server (Zod validation, this
 * file's `validate` procedure, payment.router's `createIntent`) share
 * a single source of truth.
 */
export { COUPON_CODE_REGEX };

const validateInput = z.object({
  code: z.string().regex(COUPON_CODE_REGEX, "Invalid coupon code format"),
  tourId: z.string().uuid(),
});

/**
 * Eligibility error mapped to a TRPCError. Kept as a typed enum so the
 * `/checkout` UI can switch on a code and surface a localised message
 * rather than the raw English `message` blob.
 */
export type CouponRejection =
  | "EXPIRED"
  | "ALREADY_REDEEMED"
  | "NOT_YOURS"
  | "TOUR_NOT_FOUND"
  | "TOUR_NOT_YOURS"
  | "TOUR_ALREADY_PAID"
  | "TOUR_PRICE_ZERO";

function rejectionError(reason: CouponRejection): TRPCError {
  switch (reason) {
    case "EXPIRED":
      return new TRPCError({ code: "BAD_REQUEST", message: `coupon:${reason}` });
    case "ALREADY_REDEEMED":
    case "TOUR_ALREADY_PAID":
    case "TOUR_PRICE_ZERO":
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `coupon:${reason}`,
      });
    case "NOT_YOURS":
    case "TOUR_NOT_YOURS":
      return new TRPCError({ code: "FORBIDDEN", message: `coupon:${reason}` });
    case "TOUR_NOT_FOUND":
      return new TRPCError({ code: "NOT_FOUND", message: `coupon:${reason}` });
  }
}

export const couponRouter = router({
  /**
   * List the caller's coupons that are still usable (not redeemed, not
   * expired). Newest first. Drives the coupon card on the /letters
   * surface and (later) a /profile "wallet" view.
   */
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.recipientUserId, ctx.user.id),
          isNull(coupons.redeemedAt),
          gt(coupons.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(coupons.createdAt));
    return rows;
  }),

  /**
   * Validate a coupon code against a specific in-checkout tour and
   * return the discounted price. Pure read — no DB writes. Failures
   * map to typed `coupon:*` error messages the UI switches on.
   *
   * The actual redemption happens inside the `payment.confirm`
   * transaction so a discount can never apply without a successful
   * charge, AND two concurrent confirms for the same code can't both
   * win (race-loser is rejected via a conditional UPDATE).
   */
  validate: protectedProcedure
    .input(validateInput)
    .query(async ({ ctx, input }) => {
      // Tour first — cheaper miss path. If the tour doesn't belong to
      // the caller or is already paid, we never look up the coupon.
      const tour = await ctx.db.query.tours.findFirst({
        where: eq(tours.id, input.tourId),
      });
      if (!tour) throw rejectionError("TOUR_NOT_FOUND");
      if (tour.userId !== ctx.user.id) throw rejectionError("TOUR_NOT_YOURS");
      if (tour.status !== "preview" && tour.status !== "customized_pending") {
        throw rejectionError("TOUR_ALREADY_PAID");
      }
      if (!tour.priceAmount || tour.priceAmount <= 0) {
        throw rejectionError("TOUR_PRICE_ZERO");
      }

      const coupon = await ctx.db.query.coupons.findFirst({
        where: eq(coupons.code, input.code),
      });
      if (!coupon) throw rejectionError("ALREADY_REDEEMED");
      if (coupon.recipientUserId !== ctx.user.id)
        throw rejectionError("NOT_YOURS");
      if (coupon.redeemedAt) throw rejectionError("ALREADY_REDEEMED");
      if (coupon.expiresAt.getTime() <= Date.now())
        throw rejectionError("EXPIRED");

      // Server-authoritative discounted price. Floor the result so we
      // never charge a fractional VND (currency has no minor unit).
      const discountedPriceVnd = Math.floor(
        (tour.priceAmount * (100 - coupon.discountPct)) / 100,
      );

      return {
        couponId: coupon.id,
        code: coupon.code,
        discountPct: coupon.discountPct,
        originalPriceVnd: tour.priceAmount,
        discountedPriceVnd,
        savingsVnd: tour.priceAmount - discountedPriceVnd,
        expiresAt: coupon.expiresAt,
      };
    }),
});
