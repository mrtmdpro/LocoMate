"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { formatVndPrice } from "@/lib/format";
import { COUPON_CODE_REGEX } from "@/lib/coupon-format";

// Tour checkout exposes the two cardinal payment shapes our tour gateway
// understands. Brand-name `qr` keeps its English/locomate-internal short
// label since it's a tech term (MoMo+VNPay both surface a QR flow).
const PAYMENT_METHODS: { id: "card" | "qr"; labelKey: string; subKey: string }[] = [
  { id: "card", labelKey: "card", subKey: "card_sub" },
  { id: "qr", labelKey: "qr", subKey: "qr_sub" },
];

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("checkoutPage.tour");
  const tCoupon = useTranslations("checkout.coupon");
  const tPay = useTranslations("common.paymentMethods");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "qr">("card");
  // The raw input text — uppercased on type so validation regexes
  // don't need a case-insensitive flag.
  const [couponInput, setCouponInput] = useState("");
  // The applied code — `null` until the user hits Apply. The applied
  // code is what's passed to createIntent; the input alone never
  // triggers a discount.
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  const { data: tour, isLoading } = trpc.tour.getPreview.useQuery({ tourId: id });
  const createIntentMutation = trpc.payment.createIntent.useMutation();
  const confirmMutation = trpc.payment.confirm.useMutation({
    onSuccess: (result) => {
      router.push(`/tour/${result.tourId}`);
    },
  });

  // Coupon validation runs server-side and returns the discounted price.
  // The query is `enabled` only after the user clicks Apply (avoids
  // accidentally probing every partial typed code). On error we surface
  // a localised inline message and clear the applied state.
  const couponValidate = trpc.coupon.validate.useQuery(
    { code: appliedCode ?? "", tourId: id },
    {
      enabled: !!appliedCode,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 pt-8">
        <div className="h-6 w-24 bg-muted/80 rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-16 bg-muted rounded-xl animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-10 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // Never fall back to a stubbed price. If the backend didn't return a real
  // amount, the pay button is disabled and the copy tells the user honestly.
  // Prevents the "show 250k, charge 0" mismatch the previous fallback allowed.
  const baseAmount = tour?.priceAmount ?? 0;
  const amountIsValid = baseAmount > 0;
  // Final amount the user pays — server-authoritative via
  // coupon.validate. Falls back to baseAmount when no coupon is
  // applied, or when validation is loading/erroring (Pay button gets
  // disabled in those cases so a stale price never charges).
  const couponData = couponValidate.data;
  const displayAmount =
    appliedCode && couponData ? couponData.discountedPriceVnd : baseAmount;
  const couponError = couponValidate.error?.message ?? null;
  const couponApplied = !!appliedCode && !!couponData && !couponError;
  const couponPending = !!appliedCode && couponValidate.isPending;

  const packageLabel = tour?.packageType === "solo_mate" ? "Solo Mate" : tour?.packageType === "social_tour" ? "Social Tour" : "Loco Route";
  const tourData = (tour?.tourData || {}) as { title?: string };

  function handleApplyCoupon() {
    const trimmed = couponInput.trim().toUpperCase();
    if (!COUPON_CODE_REGEX.test(trimmed)) {
      toast.error(tCoupon("invalidFormat"));
      return;
    }
    setAppliedCode(trimmed);
  }

  function handleRemoveCoupon() {
    setAppliedCode(null);
    setCouponInput("");
  }

  async function handlePay() {
    if (!amountIsValid) return;
    // Pass the applied code only when the server has validated it.
    // A pending validation blocks payment; an errored validation
    // clears `appliedCode` already.
    const codeForCheckout = couponApplied ? appliedCode! : undefined;
    const intent = await createIntentMutation.mutateAsync({
      tourId: id,
      paymentMethod,
      couponCode: codeForCheckout,
    });
    await confirmMutation.mutateAsync({ paymentId: intent.paymentId });
  }

  // Map the server's typed `coupon:*` error message to a localised
  // inline message. Unknown codes fall through to the raw message.
  function localisedCouponError(message: string): string {
    const tag = message.startsWith("coupon:") ? message.slice(7) : message;
    switch (tag) {
      case "EXPIRED":
        return tCoupon("invalidExpired");
      case "ALREADY_REDEEMED":
        return tCoupon("invalidUsed");
      case "NOT_YOURS":
        return tCoupon("invalidNotYours");
      case "TOUR_NOT_FOUND":
      case "TOUR_NOT_YOURS":
      case "TOUR_ALREADY_PAID":
      case "TOUR_PRICE_ZERO":
        return tCoupon("invalidTour");
      default:
        return tCoupon("invalidGeneric");
    }
  }

  return (
    <div className="p-4 space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">{t("title")}</h1>
      </div>

      {/* Order Summary */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-secondary mb-3">{t("orderSummary")}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{packageLabel}</span>
              <Badge className="bg-primary/10 text-primary border-primary/20">{packageLabel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("tourLabel")}</span>
              <span>{tourData.title || t("untitled")}</span>
            </div>
            {/* Subtotal / discount line — only renders when a valid
                coupon is applied. Shows the original price struck-
                through alongside the post-discount price below. */}
            {couponApplied && couponData && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>{tCoupon("subtotal")}</span>
                  <span className="line-through">{formatVndPrice(baseAmount)}</span>
                </div>
                <div className="flex justify-between text-brick">
                  <span>{tCoupon("discountLine", { pct: couponData.discountPct })}</span>
                  <span>−{formatVndPrice(couponData.savingsVnd)}</span>
                </div>
              </>
            )}
            <div className="border-t pt-2 mt-2 flex justify-between font-bold">
              <span>{t("totalLabel")}</span>
              <span className="text-secondary">
                {amountIsValid
                  ? formatVndPrice(displayAmount)
                  : t("priceUnavailable")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promo Code */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-secondary mb-2">{tCoupon("title")}</h3>
          {couponApplied && couponData ? (
            // Applied state — show the active code in a green pill with
            // a Remove action. Clicking Remove clears local state and
            // disables the query so the displayed total reverts.
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-sm font-semibold border border-emerald-200">
                  <span aria-hidden="true">✓</span>
                  {tCoupon("applied", { pct: couponData.discountPct })}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {appliedCode}
                </span>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={handleRemoveCoupon}
                type="button"
              >
                {tCoupon("remove")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={tCoupon("placeholder")}
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  className="rounded-xl font-mono tracking-wider"
                  spellCheck={false}
                  autoCapitalize="characters"
                />
                <Button
                  variant="outline"
                  className="rounded-xl shrink-0"
                  onClick={handleApplyCoupon}
                  disabled={couponInput.trim().length === 0 || couponPending}
                  type="button"
                >
                  {couponPending ? tCoupon("checking") : tCoupon("apply")}
                </Button>
              </div>
              {couponError && (
                <p className="text-xs text-red-600 font-medium">
                  {localisedCouponError(couponError)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-secondary">{t("paymentMethodTitle")}</h3>
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                paymentMethod === m.id ? "border-primary bg-primary/5" : "border-border hover:border-border"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.id === "card" ? "bg-blue-50" : "bg-purple-50"}`}>
                {m.id === "card" ? (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" /></svg>
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">{tPay(m.labelKey)}</p>
                <p className="text-xs text-muted-foreground">{tPay(m.subKey)}</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Refund Policy */}
      <div className="bg-card/30 rounded-xl p-3 text-center">
        <p className="text-xs text-secondary">{t("refundPolicy")}</p>
      </div>

      {/* Pay Button — disabled while the coupon validation is in
          flight so we never charge against a stale price. */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={handlePay}
          disabled={
            !amountIsValid ||
            couponPending ||
            createIntentMutation.isPending ||
            confirmMutation.isPending
          }
          className="w-full h-14 rounded-2xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-base shadow-lg disabled:opacity-60"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          {createIntentMutation.isPending || confirmMutation.isPending
            ? t("processing")
            : amountIsValid
              ? t("securePayment", { amount: formatVndPrice(displayAmount) })
              : t("priceUnavailableHint")}
        </Button>
      </div>
    </div>
  );
}
