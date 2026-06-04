"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Basket } from "@/components/brand";
import { formatVndPrice as formatVnd } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

function formatShortDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const tag = locale === "vi" ? "vi-VN" : "en-US";
  const d = new Date(iso);
  return d.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false });
}

/**
 * Persistent cart page. Shows every line (fixed tours, activities, merch,
 * eSIM, guide add-ons) with quantity controls + remove, plus a conflict
 * alert section when two time-bound lines overlap.
 *
 * Empty-state nudges the traveler to browse Fixed Tours or Activities.
 */
export default function CartPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("cart.page");
  const { user } = useAuthStore();
  const utils = trpc.useUtils();
  const enabled = !!user;

  // Pass locale to the server query so `displayLabel` / `lineSubtitle`
  // come back in the user's language (pickLocaleField for activity +
  // merch, CART_LINE_STRINGS table for synthesized rows).
  const { data, isLoading } = trpc.cart.get.useQuery({ locale }, { enabled });

  const updateQty = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
    onError: (e) => toast.error(e.message ?? t("toast.updateFailed")),
  });

  const remove = trpc.cart.remove.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
  });

  const createOrder = trpc.order.createFromCart.useMutation({
    onSuccess: ({ orderId }) => {
      router.push(`/orders/${orderId}/checkout`);
    },
    onError: (e) => toast.error(e.message ?? t("toast.orderFailed")),
  });

  if (!enabled) {
    return (
      <div className="p-6 text-center space-y-3 pb-24">
        <div className="text-4xl">🛒</div>
        <p className="text-base lg:text-lg text-secondary font-semibold">{t("signedOut.title")}</p>
        <Link href="/login?returnTo=/cart">
          <Button className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-6 h-11">{t("signedOut.cta")}</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const items = data?.items ?? [];
  const conflicts = data?.conflicts ?? [];
  const subtotal = data?.subtotalVnd ?? 0;
  const hasConflicts = conflicts.length > 0;

  if (items.length === 0) {
    return (
      <PageTransition>
        <div className="p-6 pb-24 min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-brick">
            <Basket size={96} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-eyebrow">{t("empty.eyebrow")}</span>
            <p className="text-h2 font-voice text-foreground font-normal">
              {t("empty.headline")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t("empty.body")}
          </p>
          <div className="flex gap-2 pt-2 flex-wrap justify-center">
            <Link href="/experiences">
              <Button variant="secondary" size="brand">{t("empty.browseTours")}</Button>
            </Link>
            <Link href="/activities">
              <Button variant="default" size="brand">{t("empty.seeActivities")}</Button>
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-4 pb-32 lg:pb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-primary/15 text-brick flex items-center justify-center shrink-0">
              <Basket size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-eyebrow">{t("header.eyebrow")}</span>
              <h1 className="text-h1 font-voice text-foreground font-normal leading-tight">
                {t("header.title")}
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t("header.itemCount", { count: items.length })}</p>
        </div>

        {/* Desktop: 2-column -- items left, summary pinned right.
            Mobile keeps the existing single-column + sticky checkout. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8 lg:items-start">
          <div className="space-y-3">

        {/* Conflict banner */}
        {hasConflicts && (
          <Card className="border-0 shadow-sm bg-red-50 border-l-4 border-l-red-400">
            <CardContent className="p-4 space-y-1.5">
              <p className="text-sm font-semibold text-red-800">
                {t("conflicts.title", { count: conflicts.length })}
              </p>
              <ul className="text-sm text-red-700 space-y-0.5">
                {conflicts.slice(0, 3).map((c, idx) => (
                  <li key={idx}>
                    {t.rich("conflicts.overlap", {
                      labelA: c.labelA,
                      labelB: c.labelB,
                      b: (chunks) => <span className="font-semibold">{chunks}</span>,
                    })}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-red-700">{t("conflicts.hint")}</p>
            </CardContent>
          </Card>
        )}

        {/* Line items */}
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex gap-3">
                <div className="w-16 h-16 bg-card rounded-lg shrink-0 relative overflow-hidden">
                  {item.thumbnail ? (
                    <Image src={item.thumbnail} alt={item.displayLabel} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {item.kind === "fixed_tour" ? "🗺️" : item.kind === "activity" ? "🎫" : item.kind === "merch" ? "🛍️" : item.kind === "esim" ? "📶" : "👤"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm lg:text-base font-semibold text-secondary line-clamp-1">{item.displayLabel}</p>
                      {item.lineSubtitle && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.lineSubtitle}</p>
                      )}
                      {item.slotStartsAt && (
                        <Badge className="mt-1 bg-muted text-foreground border-0 text-xs">
                          {formatShortDate(item.slotStartsAt, locale)}
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove.mutate({ cartItemId: item.id })}
                      className="text-sm font-semibold text-red-700 hover:text-red-800 shrink-0"
                    >
                      {t("line.remove")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {(item.kind === "fixed_tour" || item.kind === "activity" || item.kind === "merch") ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={item.quantity <= 1 || updateQty.isPending}
                          onClick={() => updateQty.mutate({ cartItemId: item.id, quantity: item.quantity - 1 })}
                          className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-base disabled:opacity-40"
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={updateQty.isPending}
                          onClick={() => updateQty.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                          className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-base"
                        >+</button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("line.qtyOne")}</span>
                    )}
                    <p className="text-base font-bold text-secondary tabular-nums">{formatVnd(item.lineTotalVnd)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>

        {/* Desktop-only sticky summary sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <h2 className="text-base lg:text-lg font-semibold text-foreground">{t("summary.title")}</h2>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("summary.subtotalLabel", { count: items.length })}</span>
                    <span className="text-foreground tabular-nums">{formatVnd(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span className="text-foreground">{t("summary.estimatedTotal")}</span>
                    <span className="text-secondary tabular-nums">{formatVnd(subtotal)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => createOrder.mutate()}
                  disabled={hasConflicts || createOrder.isPending}
                  className="w-full bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl h-12 text-base font-bold disabled:opacity-60"
                >
                  {hasConflicts
                    ? t("summary.resolveConflicts")
                    : createOrder.isPending
                      ? t("summary.processing")
                      : t("summary.checkout")}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  {t("summary.bundleNote")}
                </p>
              </CardContent>
            </Card>
          </div>
        </aside>
        </div>
      </div>

      {/* Mobile-only sticky checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("summary.subtotalShort")}</p>
            <p className="text-xl font-bold text-secondary tabular-nums">{formatVnd(subtotal)}</p>
          </div>
          <Button
            onClick={() => createOrder.mutate()}
            disabled={hasConflicts || createOrder.isPending}
            className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-6 h-12 font-bold disabled:opacity-60"
          >
            {hasConflicts
              ? t("summary.resolveConflicts")
              : createOrder.isPending
                ? t("summary.processing")
                : t("summary.checkout")}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
