"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatVndPrice, statusBadge, type StatusTone } from "@/lib/format";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-sage text-earth",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-foreground/80",
};

/**
 * À-la-carte order history. Wired to `order.getHistory` (previously dead
 * code) so a traveler can find an activity/merch/eSIM purchase again after
 * the post-checkout receipt — closing the "buy something, never see it
 * again" dead-end.
 */
export default function OrdersListPage() {
  const router = useRouter();
  const t = useTranslations("orders.list");
  const tStatus = useTranslations("common.status");
  const { data: orders, isLoading } = trpc.order.getHistory.useQuery();

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-3xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-secondary">
            {t("heading")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="pt-12 text-center">
            <div className="text-5xl mb-4">🛍</div>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
            <Button
              onClick={() => router.push("/activities")}
              className="mt-6 rounded-xl bg-secondary px-8 text-secondary-foreground hover:bg-secondary/90"
            >
              {t("emptyCta")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const badge = statusBadge(order.status, { context: "order" });
              const badgeLabel = badge.rawFallback ?? tStatus(badge.labelKey);
              return (
                <Link key={order.id} href={`/orders/${order.id}`} className="block">
                  <Card className="border-0 shadow-sm transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                        🛍
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-secondary">
                          {order.summaryLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(order.itemCount === 1 ? "itemsOne" : "itemsOther", {
                            count: order.itemCount,
                          })}
                          {" · "}
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="whitespace-nowrap text-sm font-bold text-secondary">
                          {formatVndPrice(order.totalVnd)}
                        </p>
                        <Badge
                          className={`mt-1 border-0 text-xs ${TONE_CLASSES[badge.tone]}`}
                        >
                          {badgeLabel}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
