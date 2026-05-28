"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/layout/page-transition";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { trpc } from "@/lib/trpc";
import { Basket, HoiVanDivider, Waves } from "@/components/brand";
import { formatVndPrice } from "@/lib/format";

// VND price snapshots approximate the USD affiliate price at ~24,500 VND/USD.
// When a real gateway wires up, these become live Gohub API rates.
//
// `id` keys into `esim.plans.name.*` for the localised display label.
// `canonicalName` is the English string we persist in cart metadata so
// support / analytics / receipts stay locale-independent.
type EsimPlan = {
  id: "quickTrip" | "explorer" | "extendedStay" | "unlimited";
  canonicalName: string;
  dataPackageGb: number;
  dataGb: number;
  unlimited: boolean;
  days: number;
  priceUsd: string;
  priceVnd: number;
  popular: boolean;
};

const ESIM_PLANS: EsimPlan[] = [
  { id: "quickTrip", canonicalName: "Quick Trip", dataPackageGb: 6, dataGb: 6, unlimited: false, days: 7, priceUsd: "$5.90", priceVnd: 145_000, popular: false },
  { id: "explorer", canonicalName: "Explorer", dataPackageGb: 15, dataGb: 15, unlimited: false, days: 15, priceUsd: "$10.90", priceVnd: 267_000, popular: true },
  { id: "extendedStay", canonicalName: "Extended Stay", dataPackageGb: 30, dataGb: 30, unlimited: false, days: 30, priceUsd: "$17.90", priceVnd: 438_000, popular: false },
  { id: "unlimited", canonicalName: "Unlimited", dataPackageGb: 50, dataGb: 0, unlimited: true, days: 30, priceUsd: "$24.90", priceVnd: 610_000, popular: false },
];

const FAQ_IDS = [1, 2, 3, 4] as const;
const HOW_STEP_IDS = [1, 2, 3] as const;

export default function EsimPage() {
  const t = useTranslations("esim");
  const utils = trpc.useUtils();

  // The success toast / "Đã thêm" state / fly animation are owned by
  // AddToCartButton, and anonymous users are bounced via the authLink.
  // This hook now exists solely to refresh the cart count + cart page.
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
  });

  const buildAdd = (plan: EsimPlan) => async () => {
    await addToCart.mutateAsync({
      kind: "esim",
      dataPackageGb: plan.dataPackageGb,
      priceSnapshotVnd: plan.priceVnd,
      metadata: { planName: plan.canonicalName, days: plan.days },
    });
  };

  const dataLabel = (plan: EsimPlan) =>
    plan.unlimited ? t("plans.dataUnlimited") : t("plans.dataGb", { gb: plan.dataGb });

  return (
    <PageTransition>
    <div className="pb-24 lg:pb-8 lg:max-w-5xl lg:mx-auto">
      {/* Hero — forest wash + Waves watermark + Basket icon (eSIM is one of
         the three Cart-family product surfaces, so the Basket appears with
         a wave undertone to keep the "carry-the-trip" association).
         Strict-mono: the hero shows only the active-locale title; the
         cross-language secondary line is gone (was titleAlt). */}
      <div className="bg-secondary text-secondary-foreground px-6 pt-10 pb-12 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-30 pointer-events-none">
          <Waves width={420} height={120} color="var(--parchment)" opacity={0.85} />
        </div>
        <div className="absolute right-6 top-6 opacity-25 pointer-events-none hidden sm:block text-secondary-foreground">
          <Basket size={140} />
        </div>
        <div className="relative max-w-2xl">
          <span className="inline-block font-mono text-xs uppercase tracking-[0.18em] text-secondary-foreground/70 mb-3">
            {t("hero.eyebrow")}
          </span>
          <h1 className="font-serif italic text-4xl lg:text-5xl leading-tight text-secondary-foreground font-normal">
            {t("hero.title")}
          </h1>
          <p className="text-sm lg:text-base text-secondary-foreground/85 mt-4 max-w-md">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5">
            {(["instant", "noSim", "onLanding"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-secondary-foreground/60" />
                <span className="text-xs text-secondary-foreground/85 font-medium">
                  {t(`hero.badges.${k}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Plans. Each plan adds to cart; checkout applies the 10% tour
            bundle discount automatically if a tour/activity is also in the
            cart. */}
        <div className="flex flex-col gap-2">
          <span className="text-eyebrow">{t("plans.eyebrow")}</span>
          <h2 className="text-h1 font-voice text-foreground font-normal">
            {t("plans.title")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ESIM_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-lg overflow-hidden bg-card border border-foreground/12 transition-shadow hover:ring-1 hover:ring-secondary/30 ${plan.popular ? "ring-1 ring-primary/40" : ""}`}
            >
              <div className={`h-1.5 ${plan.popular ? "bg-primary" : "bg-secondary"}`} />
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-eyebrow">{t(`plans.name.${plan.id}`)}</span>
                      {plan.popular && <Badge variant="fixed">{t("plans.popularBadge")}</Badge>}
                    </div>
                    <h3 className="text-h2 font-voice text-foreground font-normal mt-1">
                      {t("plans.durationLabel", { data: dataLabel(plan), days: plan.days })}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <span className="font-serif text-2xl lg:text-3xl text-brick leading-none whitespace-nowrap">
                    {formatVndPrice(plan.priceVnd)}
                  </span>
                  <span className="text-xs text-muted-foreground pb-1">≈ {plan.priceUsd}</span>
                </div>
                <p className="text-sm text-secondary font-semibold">
                  {t("plans.saveBadge")}
                </p>
                <AddToCartButton
                  onAdd={buildAdd(plan)}
                  flyImage={null}
                  variant={plan.popular ? "default" : "forest"}
                  size="brand"
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>

        <HoiVanDivider />

        <Card className="bg-mustard/15 border-mustard/40">
          <CardContent className="p-5">
            <span className="text-eyebrow">{t("howItWorks.eyebrow")}</span>
            <h3 className="text-h2 font-voice text-foreground font-normal mt-1 mb-4">
              {t("howItWorks.title")}
            </h3>
            <div className="space-y-3">
              {HOW_STEP_IDS.map((n) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brick text-card text-xs font-bold flex items-center justify-center shrink-0">{n}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(`howItWorks.step${n}Title`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`howItWorks.step${n}Desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div>
          <span className="text-eyebrow">{t("faq.eyebrow")}</span>
          <h3 className="text-h2 font-voice text-foreground font-normal mt-1 mb-3">
            {t("faq.title")}
          </h3>
          <div className="space-y-2">
            {FAQ_IDS.map((n) => (
              <Card key={n}>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">{t(`faq.q${n}`)}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(`faq.a${n}`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <a href="https://gohub.com/esim/vietnam?ref=locomate" target="_blank" rel="noopener noreferrer">
          <Button variant="forest" size="brand" className="w-full h-12">
            {t("browseAll")}
          </Button>
        </a>

        <p className="text-center text-xs text-muted-foreground">
          {t("affiliateDisclosure")}
        </p>
      </div>
    </div>
    </PageTransition>
  );
}
