"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { TOUR_PRICING } from "@/lib/pricing";
import { formatVndPrice } from "@/lib/format";

const KNOWN_PACKAGE_TYPES = new Set(["solo_mate", "social_tour", "fixed_tour"]);

export default function TourPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("tour.preview");
  const { data: tour, isLoading } = trpc.tour.getPreview.useQuery({ tourId: id });

  if (isLoading) return <div className="p-4"><div className="h-64 bg-muted rounded-2xl animate-pulse" /></div>;
  if (!tour) return <div className="p-4 text-center text-muted-foreground">{t("notFound")}</div>;

  const tourData = tour.tourData as {
    title: string;
    description: string;
    stops: { name: string; category: string; scheduledTime: string; estimatedSpend: string }[];
    lockedStops: number;
    isPreview: boolean;
    estimatedCost: { min: number; max: number; currency: string };
    personalizationRationale: string;
    totalDurationMinutes: number;
  };

  const packageType = tour.packageType;
  const packageLabel = packageType
    ? KNOWN_PACKAGE_TYPES.has(packageType)
      ? t(`packageType.${packageType}` as "packageType.solo_mate")
      : packageType.replace("_", " ")
    : "";

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-secondary to-[#A8C589] p-6 pb-12 relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=1200&h=600&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 z-0" />
        <button onClick={() => router.back()} className="text-white/80 mb-4 relative z-10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <Badge className="bg-card/20 text-white border-0 mb-2 relative z-10">{t("badge")}</Badge>
        <h1 className="text-2xl font-bold text-white font-heading relative z-10">{tourData.title}</h1>
        <p className="text-white/80 text-sm mt-2 relative z-10">{tourData.description}</p>
        <div className="flex gap-4 mt-4 text-white/90 text-sm relative z-10">
          <span>{t("hoursDuration", { hours: Math.round(tourData.totalDurationMinutes / 60) })}</span>
          <span>{t("stopsCount", { count: tourData.stops.length + tourData.lockedStops })}</span>
        </div>
      </div>

      <div className="p-4 -mt-6 space-y-4">
        {/* Timeline Preview */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-secondary mb-4">{t("previewTitle")}</h3>
            <div className="space-y-4">
              {tourData.stops.map((stop, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    {i < tourData.stops.length - 1 && <div className="w-0.5 h-8 bg-primary/20 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-xs text-muted-foreground">{stop.scheduledTime}</p>
                    <p className="font-semibold text-sm text-secondary">{stop.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{stop.category}</Badge>
                      <span className="text-xs text-muted-foreground">{stop.estimatedSpend}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tourData.lockedStops > 0 && (
                <div className="flex gap-3 opacity-50">
                  <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <p className="text-sm text-muted-foreground pt-1">{t("moreStopsHidden", { count: tourData.lockedStops })}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Why it fits */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-primary mb-2">{t("whyFits")}</h3>
            <p className="text-sm text-muted-foreground">{tourData.personalizationRationale}</p>
          </CardContent>
        </Card>

        {/* Cost */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("costLabel")}</p>
              <p className="font-bold text-secondary">
                {t("costRange", {
                  min: Math.round(tourData.estimatedCost.min / 1000),
                  max: Math.round(tourData.estimatedCost.max / 1000),
                  currency: tourData.estimatedCost.currency,
                })}
              </p>
            </div>
            {packageLabel && <Badge className="bg-sage text-earth border-0">{packageLabel}</Badge>}
          </CardContent>
        </Card>

        {/* Host Upsell */}
        <Card className="border-secondary/10 bg-secondary/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-secondary mb-1">{t("addHostTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t("addHostBody")}</p>
            <Button variant="outline" className="rounded-xl border-secondary text-secondary" onClick={() => router.push(`/tour/${id}/hosts`)}>
              {t("browseHostsCta", { price: formatVndPrice(TOUR_PRICING.hostAddon) })}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={() => router.push(`/tour/${id}/checkout`)}
          disabled={!tour.priceAmount || tour.priceAmount <= 0}
          className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/85 text-primary-foreground font-bold text-base shadow-lg disabled:opacity-60"
        >
          {tour.priceAmount && tour.priceAmount > 0
            ? t("unlockCta", { price: formatVndPrice(tour.priceAmount) })
            : t("priceUnavailable")}
        </Button>

        <Link href="/esim" className="block mt-3 p-3 rounded-xl bg-card/40 border border-[#A8C589]/20 text-center">
          <p className="text-xs font-semibold text-secondary">{t("esimTitle")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("esimBody")}</p>
        </Link>
      </div>
    </div>
  );
}
