"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatVndPrice as formatVnd } from "@/lib/format";

// Stable `id` is the gateway payment method that the server expects;
// `labelKey` and `subKey` resolve via `common.paymentMethods.*`.
// `vnpay` and `momo` are brand names — both locales render them as-is.
const PAYMENT_METHODS: { id: "card" | "vnpay" | "momo"; labelKey: string; subKey: string }[] = [
  { id: "card", labelKey: "card", subKey: "card_sub" },
  { id: "vnpay", labelKey: "vnpay", subKey: "vnpay_sub" },
  { id: "momo", labelKey: "momo", subKey: "momo_sub" },
];

/**
 * Order-scoped checkout page. Shows the order breakdown (all lines + bundle
 * discount + total), payment method picker, and a Pay button that calls
 * order.confirmPayment. On success: redirect to the receipt page.
 *
 * Payment processor is mocked for MVP (same pattern as legacy checkout);
 * the gateway field is captured for when we wire real Stripe/VNPay.
 */
export default function OrderCheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("checkoutPage");
  const tPay = useTranslations("common.paymentMethods");
  const [method, setMethod] = useState<"card" | "vnpay" | "momo">("card");

  const { data, isLoading } = trpc.order.get.useQuery(
    { orderId: params.id },
    { enabled: !!params.id },
  );

  const confirm = trpc.order.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success(t("paymentConfirmed"));
      router.replace(`/orders/${params.id}`);
    },
    onError: (e) => toast.error(e.message ?? t("paymentFailed")),
  });
  const paymentError = confirm.error?.message ?? null;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-base text-secondary">{t("orderNotFound")}</p>
        <Link href="/cart" className="text-sm text-primary font-semibold">{t("backToCartLink")}</Link>
      </div>
    );
  }

  const { order, items } = data;
  const alreadyPaid = order.status === "paid";

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-4 pb-32 lg:pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("orderId", { id: order.id.slice(0, 8) })}</p>
          </div>
          <Link href="/cart" className="text-sm text-primary font-semibold">
            {t("backToCart")}
          </Link>
        </div>

        {/* Desktop: summary left (scrolls), payment method right (sticky).
            Mobile: stacked as before. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8 lg:items-start">
          <div className="space-y-4">
        {paymentError && (
          <Card className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-400">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-900">{t("paymentNeedsCartFixTitle")}</p>
              <p className="text-sm text-amber-800">{t("paymentNeedsCartFixBody")}</p>
              <Link href="/cart" className="inline-flex text-sm font-semibold text-secondary hover:text-primary">
                {t("backToCartLink")}
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5 space-y-3">
            <h2 className="text-base lg:text-lg font-semibold text-secondary">{t("summary")}</h2>
            <div className="space-y-3">
              {items.map((line) => {
                const meta = line.metadata as { title?: string; startsAt?: string; label?: string } | null;
                const title = meta?.title ?? meta?.label ?? line.kind;
                return (
                  <div key={line.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary line-clamp-1">{title}</p>
                      <p className="text-sm text-muted-foreground">
                        {line.kind === "activity" && meta?.startsAt
                          ? new Date(meta.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false })
                          : `${line.kind}`}
                        {line.quantity > 1 ? ` · ×${line.quantity}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-secondary tabular-nums">{formatVnd(line.lineTotalVnd)}</p>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{formatVnd(order.subtotalVnd)}</span>
              </div>
              {order.discountVnd > 0 && (
                <div className="flex justify-between text-[#A8C589]">
                  <span>{t("bundleDiscount")}</span>
                  <span>−{formatVnd(order.discountVnd)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-secondary pt-2 border-t border-border tabular-nums">
                <span>{t("total")}</span>
                <span>{formatVnd(order.totalVnd)}</span>
              </div>
              {Array.isArray(order.bundleCodes) && order.bundleCodes.length > 0 && (
                <div className="flex gap-1 pt-1">
                  {(order.bundleCodes as string[]).map((code) => (
                    <Badge key={code} className="bg-sage/20 text-foreground border-0 text-xs">
                      {code}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

          </div>

          {/* Payment method + pay button. On mobile it sits below the
              summary (single column). On desktop it pins to the right. */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            <Card className="border-0 shadow-sm lg:shadow-md">
              <CardContent className="p-4 lg:p-5 space-y-3">
                <h2 className="text-base lg:text-lg font-semibold text-secondary">{t("paymentMethod")}</h2>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => {
                    const selected = m.id === method;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        disabled={alreadyPaid}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors text-left min-h-[44px] ${
                          selected ? "border-secondary bg-card" : "border-border bg-card"
                        }`}
                      >
                        <div>
                          <p className="text-sm lg:text-base font-semibold text-secondary">{tPay(m.labelKey)}</p>
                          <p className="text-sm text-muted-foreground">{tPay(m.subKey)}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 ${selected ? "border-secondary bg-secondary" : "border-foreground/25"}`}>
                          {selected && <div className="w-full h-full rounded-full bg-card scale-[0.4]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground pt-1">
                  {t("testModeNotice")}
                </p>

                {/* Desktop-inline pay button (hidden on mobile where the
                    sticky bar below handles it). */}
                <div className="hidden lg:block pt-2 border-t border-border">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t("total")}</p>
                    <p className="text-xl font-bold tabular-nums text-secondary">{formatVnd(order.totalVnd)}</p>
                  </div>
                  <Button
                    onClick={() => confirm.mutate({ orderId: order.id })}
                    disabled={alreadyPaid || confirm.isPending}
                    className="w-full bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl h-12 text-base font-bold"
                  >
                    {alreadyPaid ? t("paid") : confirm.isPending ? t("processing") : t("pay", { amount: formatVnd(order.totalVnd) })}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Mobile-only sticky pay bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("total")}</p>
            <p className="text-xl font-bold text-secondary tabular-nums">{formatVnd(order.totalVnd)}</p>
          </div>
          <Button
            onClick={() => confirm.mutate({ orderId: order.id })}
            disabled={alreadyPaid || confirm.isPending}
            className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-8 h-12 text-base font-bold"
          >
            {alreadyPaid ? t("paid") : confirm.isPending ? t("processing") : t("pay", { amount: formatVnd(order.totalVnd) })}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
