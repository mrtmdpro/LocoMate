"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatVndPrice, statusBadge, type StatusTone } from "@/lib/format";

// Surface-specific tone palette. Kept inline so the visual identity of the
// traveller-facing payment history (sage-on-cream successes, soft amber
// warnings) is not bled into the host-dashboard chips, which use harder
// emerald/red bordered pills. See @/lib/format#statusBadge.
const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-sage/10 text-secondary dark:text-foreground",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-500",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

export default function PaymentHistoryPage() {
  const router = useRouter();
  const t = useTranslations("payments");
  const tStatus = useTranslations("common.status");
  const { data: history, isLoading } = trpc.payment.getHistory.useQuery();

  const rows = history || [];
  // A row counts as a real, paid transaction only when status is 'succeeded'
  // AND the net (amount - refund) is still positive. Excluding fully-refunded
  // rows keeps "Transactions" consistent regardless of whether a future refund
  // flow flips status to 'refunded' or just increments refundAmount.
  const netPaid = rows
    .filter((r) => r.status === "succeeded")
    .map((r) => (r.amount ?? 0) - (r.refundAmount ?? 0))
    .filter((n) => n > 0);
  const totalSpent = netPaid.reduce((sum, n) => sum + n, 0);
  const succeededCount = netPaid.length;

  return (
    <div className="pb-24 lg:pb-8 min-h-screen bg-card lg:max-w-4xl lg:mx-auto lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-secondary">{t("heading")}</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Summary Card */}
        <Card className="border-0 bg-secondary text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/70">{t("totalSpent")}</p>
                <p className="text-xl lg:text-2xl font-bold font-heading whitespace-nowrap">{formatVndPrice(totalSpent)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/70">{t("transactions")}</p>
                <p className="text-2xl font-bold font-heading">{succeededCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className="pt-12 text-center">
            <div className="text-5xl mb-4">💳</div>
            <h2 className="text-xl lg:text-2xl font-bold font-heading text-secondary">{t("empty.title")}</h2>
            <p className="text-sm text-muted-foreground mt-2">{t("empty.body")}</p>
            <Button onClick={() => router.push("/plan")} className="mt-6 bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-8">
              {t("empty.cta")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const amount = row.amount ?? 0;
              const refundAmount = row.refundAmount ?? 0;
              const badge = statusBadge(row.status, { amount, refundAmount, context: "payment" });
              const badgeLabel = badge.rawFallback ?? tStatus(badge.labelKey);
              const date = row.paidAt || row.createdAt;
              const currency = row.currency || "VND";
              // If the status was flipped to 'refunded' without touching
              // refundAmount, treat the whole amount as refunded so the row
              // doesn't display a gross value with a red "Refunded" chip.
              const effectiveRefund = row.status === "refunded"
                ? Math.max(refundAmount, amount)
                : refundAmount;
              const netAmount = amount - effectiveRefund;

              return (
                <Card key={row.id} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {row.packageType === "solo_mate" ? "👤" : row.packageType === "social_tour" ? "👥" : "🗺"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.tourTitle || t("untitledTour")}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{date ? new Date(date).toLocaleDateString() : t("emptyDate")}</p>
                        <span className="text-xs text-muted-foreground">&middot;</span>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                          <span className="text-xs text-muted-foreground capitalize">{(row.paymentMethod || "card").replaceAll("_", " ")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-secondary whitespace-nowrap">{currency === "VND" ? formatVndPrice(netAmount) : `${netAmount.toLocaleString("vi-VN")} ${currency}`}</p>
                      <Badge className={`mt-1 border-0 text-xs ${TONE_CLASSES[badge.tone]}`}>
                        {badgeLabel}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
