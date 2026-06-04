"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { pickLocaleField } from "@/lib/pick-locale-field";
import { formatVndPrice } from "@/lib/format";
import { activityImage } from "@/lib/activity-image";
import type { Locale } from "@/i18n/routing";

const CATEGORY_FILTERS: { value: string | undefined; labelKey: string }[] = [
  { value: undefined, labelKey: "all" },
  { value: "workshop", labelKey: "workshops" },
  { value: "ticket", labelKey: "tickets" },
  { value: "food", labelKey: "food" },
  { value: "tour_lite", labelKey: "walking" },
  { value: "performance", labelKey: "performance" },
  { value: "class", labelKey: "classes" },
];

// Closed set of categories we ship a localized label for. Anything outside
// this set (curator typo, host-added value before the next i18n update)
// falls back to the raw DB string instead of rendering the literal i18n
// key like "activities.list.category.foo". Keep in lockstep with the
// `activities.list.category.*` block in messages/{en,vi}.json.
const KNOWN_CATEGORIES = new Set([
  "workshop",
  "ticket",
  "food",
  "tour_lite",
  "performance",
  "class",
  "cultural",
  "culinary",
  "adventure",
  "nightlife",
  "art",
]);

/**
 * Activities browse page. Lists all published a-la-carte activities with a
 * category filter chip row. Each card links to the slug detail page with
 * slot picker + "add to cart".
 */
export default function ActivitiesPage() {
  const locale = useLocale() as Locale;
  const tAtoms = useTranslations("activities.atom");
  const tList = useTranslations("activities.list");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data: activities, isLoading } = trpc.activity.list.useQuery({
    category,
    limit: 30,
    offset: 0,
  });

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 space-y-4 pb-24 lg:pb-8 lg:max-w-6xl lg:mx-auto">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">{tList("heading")}</h1>
          <p className="text-sm text-muted-foreground">
            {tList("subtitle")}
          </p>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((f) => {
            const active = f.value === category;
            return (
              <button
                key={f.labelKey}
                type="button"
                onClick={() => setCategory(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  active
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-card text-foreground border-border hover:border-secondary/40"
                }`}
              >
                {tList(`filters.${f.labelKey}`)}
              </button>
            );
          })}
        </div>

        {/* Results grid */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
            <CardContent className="p-8 text-center space-y-2">
              <div className="text-4xl">🔍</div>
              <p className="text-sm font-medium text-secondary">{tList("empty.title")}</p>
              <p className="text-xs text-muted-foreground">{tList("empty.subtitle")}</p>
            </CardContent>
          </Card>
        ) : (
          // Mobile: horizontal card with left thumbnail (existing shape).
          // Desktop: grid of tall cards with a hero photo on top.
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
            {activities.map((a) => {
              const aTitle = pickLocaleField<string>(a, "title", locale) ?? a.title;
              const aSubtitle = pickLocaleField<string>(a, "subtitle", locale) ?? a.subtitle;
              // Photo precedence: real host-uploaded photo first, then
              // the curator's deterministic cinematic for atoms (file
              // shipped under `public/brand/activities/<slug>.jpg`),
              // and finally the emoji placeholder so non-atom activities
              // without uploads still render a card without a 404.
              const previewSrc = a.photos?.[0] ?? activityImage(a.slug ?? null);
              // Atoms (backfilled from Fixed Tour steps) carry a parent
              // tour title that we render as a small "From: X" badge, so
              // travelers know the atom is part of a curated tour they
              // could otherwise book as a bundle.
              const sourceTourTitle = a.sourceFixedTourStepId
                ? (locale === "vi" ? a.sourceTourTitleVi : a.sourceTourTitleEn)
                : null;
              // Category label with raw-value fallback so an unknown
              // category never renders the literal i18n key.
              const categoryLabel = KNOWN_CATEGORIES.has(a.category)
                ? tList(`category.${a.category}`)
                : a.category;
              return (
              <Link key={a.id} href={`/activities/${a.slug || a.id}`} className="block group">
                <Card className="border-0 shadow-sm overflow-hidden transition-shadow group-hover:shadow-md">
                  {/* Mobile horizontal */}
                  <div className="flex lg:hidden">
                    <div className="w-32 h-32 bg-card relative shrink-0">
                      {previewSrc ? (
                        <Image src={previewSrc} alt={aTitle ?? ""} fill sizes="128px" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-3xl text-muted-foreground/40">
                          {a.category === "workshop" ? "🛠️" : a.category === "food" ? "🍜" : a.category === "performance" ? "🎭" : "🎫"}
                        </div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-card/90 text-foreground border-0 text-xs uppercase tracking-wider">
                        {categoryLabel}
                      </Badge>
                    </div>
                    <CardContent className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                      <div>
                        <p className="font-semibold text-sm text-secondary line-clamp-1">{aTitle}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {aSubtitle}
                        </p>
                        {sourceTourTitle && (
                          <p className="text-xs text-brick mt-1 line-clamp-1">
                            {tAtoms("fromTour", { tour: sourceTourTitle })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                          {Math.floor(a.durationMinutes / 60)}h{a.durationMinutes % 60 ? ` ${a.durationMinutes % 60}m` : ""}
                          {a.avgRating ? ` · ★ ${Number(a.avgRating).toFixed(1)}` : ""}
                          {a.authorDisplayName ? ` · ${a.authorDisplayName}` : ""}
                        </p>
                        <p className="text-sm font-bold text-primary whitespace-nowrap">
                          {formatVndPrice(a.priceAmount)}
                        </p>
                      </div>
                    </CardContent>
                  </div>
                  {/* Desktop vertical */}
                  <div className="hidden lg:flex lg:flex-col">
                    <div className="aspect-[4/3] bg-card relative overflow-hidden">
                      {previewSrc ? (
                        <Image
                          src={previewSrc}
                          alt={aTitle ?? ""}
                          fill
                          sizes="(max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-6xl text-muted-foreground/30">
                          {a.category === "workshop" ? "🛠️" : a.category === "food" ? "🍜" : a.category === "performance" ? "🎭" : "🎫"}
                        </div>
                      )}
                      <Badge className="absolute top-3 left-3 bg-card/95 text-foreground border-0 text-xs uppercase tracking-wider">
                        {categoryLabel}
                      </Badge>
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <p className="font-semibold text-secondary line-clamp-1">{aTitle}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {aSubtitle}
                      </p>
                      {sourceTourTitle && (
                        <p className="text-xs text-brick mt-1 line-clamp-1">
                          {tAtoms("fromTour", { tour: sourceTourTitle })}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-3 mt-auto">
                        <p className="text-xs text-muted-foreground">
                          {Math.floor(a.durationMinutes / 60)}h{a.durationMinutes % 60 ? ` ${a.durationMinutes % 60}m` : ""}
                          {a.avgRating ? ` · ★ ${Number(a.avgRating).toFixed(1)}` : ""}
                        </p>
                        <p className="font-bold text-primary whitespace-nowrap">
                          {formatVndPrice(a.priceAmount)}
                        </p>
                      </div>
                    </CardContent>
                  </div>
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
