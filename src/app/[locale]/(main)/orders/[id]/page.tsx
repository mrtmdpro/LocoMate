"use client";

import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatVndPrice as formatVnd, statusBadge, type StatusTone } from "@/lib/format";

// Order receipts use the slightly heavier sage/earth + amber + red
// hundred-step palette to match the post-checkout confirmation feel.
const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-sage text-earth",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-foreground/80",
};

function formatDate(iso: string | null | Date): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false });
}

/**
 * Order receipt / confirmation page. Shown after payment completes.
 * Also accessible from `/orders` history for past orders.
 */
const KNOWN_LINE_KINDS = new Set(["activity", "esim", "merch", "tour"]);

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("orders.detail");
  const tStatus = useTranslations("common.status");
  const { data, isLoading } = trpc.order.get.useQuery(
    { orderId: params.id },
    { enabled: !!params.id },
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (!data) {
    return <div className="p-6 text-sm text-secondary text-center">{t("notFound")}</div>;
  }

  const { order, items } = data;
  const badge = statusBadge(order.status, { context: "order" });
  const badgeLabel = badge.rawFallback ?? tStatus(badge.labelKey);

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-3xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        {order.status === "paid" && (
          <div className="text-center space-y-2 py-4">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold font-heading text-secondary">{t("confirmedTitle")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("confirmedSubtitle", { shortId: order.id.slice(0, 8), date: formatDate(order.paidAt as unknown as string) })}
            </p>
          </div>
        )}

        {order.status !== "paid" && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-heading text-secondary">{t("heading")}</h1>
              <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
            </div>
            <Badge className={`${TONE_CLASSES[badge.tone]} border-0 text-xs`}>{badgeLabel}</Badge>
          </div>
        )}

        {/* Items */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm text-secondary">{t("whatYouBooked")}</h2>
            <div className="space-y-2">
              {items.map((line) => {
                const meta = line.metadata as { title?: string; startsAt?: string; label?: string } | null;
                const kindLabel = KNOWN_LINE_KINDS.has(line.kind)
                  ? t(`kind.${line.kind}` as "kind.activity")
                  : line.kind;
                const title = meta?.title ?? meta?.label ?? kindLabel;
                return (
                  <div key={line.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-secondary line-clamp-1">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.kind === "activity" && meta?.startsAt
                          ? formatDate(meta.startsAt)
                          : kindLabel}
                        {line.quantity > 1 ? ` · ×${line.quantity}` : ""}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-secondary">{formatVnd(line.lineTotalVnd)}</p>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border pt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{formatVnd(order.subtotalVnd)}</span>
              </div>
              {order.discountVnd > 0 && (
                <div className="flex justify-between text-sage">
                  <span>{t("bundleDiscount")}</span>
                  <span>−{formatVnd(order.discountVnd)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-secondary pt-1">
                <span>{t("total")}</span>
                <span>{formatVnd(order.totalVnd)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/home">
            <Button variant="outline" className="w-full rounded-xl">{t("actions.backHome")}</Button>
          </Link>
          <Link href="/activities">
            <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-xl">{t("actions.browseMore")}</Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
