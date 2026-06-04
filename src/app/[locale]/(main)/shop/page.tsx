"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Basket } from "@/components/brand";
import { pickLocaleField } from "@/lib/pick-locale-field";
import { formatVndPrice } from "@/lib/format";
import { merchImage } from "@/lib/merch-images";
import type { Locale } from "@/i18n/routing";

/**
 * The catalogue filter chips. The `value` is the merch.category enum
 * sent to the server; the `key` resolves to a translated label under
 * the `shop.filters.*` namespace.
 */
const CATEGORY_FILTERS = [
  { value: undefined, key: "all" },
  { value: "apparel", key: "apparel" },
  { value: "accessory", key: "accessories" },
  { value: "souvenir", key: "souvenirs" },
  { value: "print", key: "prints" },
] as const satisfies ReadonlyArray<{
  value: string | undefined;
  key: "all" | "apparel" | "accessories" | "souvenirs" | "prints";
}>;

export default function ShopPage() {
  const t = useTranslations("shop");
  const locale = useLocale() as Locale;
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data: products, isLoading } = trpc.merch.list.useQuery({ category, limit: 24 });

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 space-y-5 pb-24 lg:pb-8 lg:max-w-6xl lg:mx-auto">
        <div className="relative">
          <div className="absolute -right-2 -top-2 opacity-[0.16] pointer-events-none hidden sm:block text-brick">
            <Basket size={140} />
          </div>
          <div className="relative flex flex-col gap-2 max-w-2xl">
            <span className="text-eyebrow">{t("eyebrow")}</span>
            <h1 className="text-display font-voice text-brick">{t("hero")}</h1>
            <p className="text-sm text-foreground/80">{t("subtitle")}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((f) => {
            const active = f.value === category;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setCategory(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  active ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card text-foreground border-border"
                }`}
              >
                {t(`filters.${f.key}`)}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-44 lg:h-64 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : !products || products.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {products.map((p) => {
              const pTitle = pickLocaleField<string>(p, "title", locale) ?? p.title;
              const pSubtitle = pickLocaleField<string>(p, "subtitle", locale) ?? p.subtitle;
              // Prefer the curated brand mockup at /brand/merch/<slug>.jpg.
              // Falls back to the DB column for any non-slugged row (future
              // host-uploaded merch under FOLLOW-10).
              const photoUrl = p.slug ? merchImage(p.slug) : p.photos?.[0];
              return (
              <Link key={p.id} href={`/shop/${p.slug || p.id}`} className="group">
                <Card className="border-0 shadow-sm overflow-hidden h-full transition-shadow group-hover:shadow-md">
                  <div className="h-36 lg:h-48 bg-card relative overflow-hidden">
                    {photoUrl && (
                      <Image
                        src={photoUrl}
                        alt={pTitle ?? p.title ?? "Locomate merch"}
                        fill
                        sizes="(max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {p.bundleDiscountPct ? (
                      <Badge className="absolute top-2 left-2 bg-primary border-0 text-primary-foreground text-xs lg:text-xs">
                        {t("bundleBadge", { pct: p.bundleDiscountPct })}
                      </Badge>
                    ) : null}
                  </div>
                  <CardContent className="p-2 lg:p-3">
                    {/* `text-foreground` instead of `text-secondary` so the
                        product title reads on the lifted-forest CardContent
                        in dark mode (the same fix applied to the home feed). */}
                    <p className="text-xs lg:text-sm font-semibold text-foreground line-clamp-1">{pTitle}</p>
                    {pSubtitle && <p className="text-xs lg:text-xs text-muted-foreground line-clamp-1">{pSubtitle}</p>}
                    <p className="text-sm lg:text-base font-bold text-primary mt-1 lg:mt-2 whitespace-nowrap">{formatVndPrice(p.basePriceVnd)}</p>
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
