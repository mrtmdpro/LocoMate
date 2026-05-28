"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Basket, Waves, HoiVanDivider } from "@/components/brand";
import { trpc } from "@/lib/trpc";
import { formatVndPrice } from "@/lib/format";
import { merchImage } from "@/lib/merch-images";
import { pickLocaleField } from "@/lib/pick-locale-field";
import type { Locale } from "@/i18n/routing";

/**
 * Store hub. Sits behind the new "Store" tab in the horizontal top bar.
 * Fans out to the two commerce surfaces:
 *
 *   /shop — Locomate merchandise (apparel, souvenirs, prints, etc.)
 *   /esim — Vietnam data plans via Gohub
 *
 * Pattern follows Airbnb's category landing pages: oversized tiles, a
 * single sentence of voice copy, a peek of featured products underneath
 * so the page doesn't feel empty before the user drills in.
 */
export default function StorePage() {
  const t = useTranslations("store");
  const locale = useLocale() as Locale;
  const { data: featuredMerch } = trpc.merch.list.useQuery(
    { limit: 4 },
    { staleTime: 60_000 },
  );

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 space-y-8 pb-24 lg:pb-12 lg:max-w-6xl lg:mx-auto">
        {/* Hero */}
        <div className="relative">
          <div className="absolute -right-2 -top-2 opacity-[0.16] pointer-events-none hidden sm:block text-brick">
            <Basket size={160} />
          </div>
          <div className="relative flex flex-col gap-2 max-w-2xl">
            <span className="text-eyebrow">{t("eyebrow")}</span>
            <h1 className="text-display font-voice text-brick">{t("hero")}</h1>
            <p className="text-sm text-foreground/80">{t("subtitle")}</p>
          </div>
        </div>

        {/* Two big tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          <StoreTile
            href="/shop"
            eyebrow={t("tiles.merch.eyebrow")}
            title={t("tiles.merch.title")}
            blurb={t("tiles.merch.blurb")}
            accent="brick"
          />
          <StoreTile
            href="/esim"
            eyebrow={t("tiles.esim.eyebrow")}
            title={t("tiles.esim.title")}
            blurb={t("tiles.esim.blurb")}
            accent="forest"
          />
        </div>

        {/* Featured merch peek — only renders once data lands so the
            section doesn't pop in empty. */}
        {featuredMerch && featuredMerch.length > 0 ? (
          <section className="space-y-3">
            <HoiVanDivider />
            <div className="flex items-baseline justify-between">
              <h2 className="text-h1 font-voice text-brick text-foreground">
                {t("trending.title")}
              </h2>
              <Link
                href="/shop"
                className="text-xs font-semibold text-brick hover:underline"
              >
                {t("trending.seeAll")}
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
              {featuredMerch.slice(0, 4).map((p) => {
                // Prefer the curated brand mockup at /brand/merch/<slug>.jpg.
                // Falls back to the DB column for non-slugged rows.
                const photoUrl = p.slug ? merchImage(p.slug) : p.photos?.[0];
                // Bilingual product title — falls back to the EN-only DB
                // column for any row missing a `titleVi` (host-uploaded
                // merch under FOLLOW-10).
                const pTitle = pickLocaleField<string>(p, "title", locale) ?? p.title;
                return (
                <Link key={p.id} href={`/shop/${p.slug || p.id}`} className="group">
                  <Card className="border-0 shadow-sm overflow-hidden h-full transition-shadow group-hover:shadow-md">
                    <div className="h-36 lg:h-44 bg-muted relative overflow-hidden">
                      {photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrl}
                          alt={pTitle ?? "Locomate merch"}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">
                        {pTitle}
                      </p>
                      <p className="text-sm font-bold text-primary mt-1 whitespace-nowrap">
                        {formatVndPrice(p.basePriceVnd)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </PageTransition>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  StoreTile                                                              */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Big Airbnb-category-card-style tile. Two accents — brick (warm earth)
 * and forest (deep green) — so the two destinations are visually distinct
 * even at a glance. Hover lifts the card slightly and bumps the
 * decorative waves so the surface feels alive.
 */
function StoreTile({
  href,
  eyebrow,
  title,
  blurb,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  accent: "brick" | "forest";
}) {
  // Only the Browse CTA is locale-driven inside this component; the rest
  // of the strings come in pre-translated from the parent so each tile's
  // copy stays inspectable at the call site.
  const t = useTranslations("store.tiles");
  const accentClass =
    accent === "brick"
      ? "from-brick/12 via-brick/6 to-transparent text-brick"
      : "from-secondary/15 via-secondary/6 to-transparent text-secondary";
  return (
    <Link
      href={href}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
    >
      <Card
        className={`relative overflow-hidden border-0 shadow-sm group-hover:shadow-md transition-shadow h-44 lg:h-56 bg-gradient-to-br ${accentClass} ring-1 ring-foreground/10`}
      >
        <div
          className={`absolute inset-x-0 bottom-0 opacity-[0.18] pointer-events-none transition-transform duration-500 group-hover:translate-y-1`}
        >
          <Waves height={70} />
        </div>
        <CardContent className="relative p-5 lg:p-6 h-full flex flex-col">
          <span className="text-eyebrow">{eyebrow}</span>
          <h3 className="text-display font-voice text-brick mt-1.5">{title}</h3>
          <p className="text-sm text-foreground/80 mt-2 max-w-sm">{blurb}</p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brick">
            {t("browse")}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
