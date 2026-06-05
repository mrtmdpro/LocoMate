import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatVndLong, formatDateShort, formatDateLong, statusBadge } from "@/lib/format";
import { type PayoutRow } from "./shared";
import { EmptyState } from "./empty-state";

export function PayoutHistoryCard({ rows, loading }: { rows: PayoutRow[]; loading: boolean }) {
  const t = useTranslations("host.earnings");
  const tStatus = useTranslations("common.status");
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold text-foreground">{t("payouts.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("payouts.subtitle")}</p>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🧾" title={t("empty.payouts.title")} body={t("empty.payouts.body")} />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((p) => {
              const badge = statusBadge(p.status);
              const statusLabel = badge.rawFallback ?? tStatus(badge.labelKey);
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm lg:text-base font-semibold text-foreground">
                      {formatDateShort(p.periodStart)} – {formatDateShort(p.periodEnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.status === "paid" && p.paidAt
                        ? t("payouts.paidOn", { date: formatDateLong(p.paidAt) })
                        : statusLabel}
                      {p.bankReference && ` · ${p.bankReference}`}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <p className="text-base font-bold text-secondary">{formatVndLong(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{p.currency ?? "VND"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
