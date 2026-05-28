"use client";

import { useState, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// Same canonical lowercase `value` shape as /explore so the chip
// vocabularies stay aligned. `undefined` value means "all".
const FILTERS: { value: string | undefined; labelKey: string }[] = [
  { value: undefined, labelKey: "all" },
  { value: "cafe", labelKey: "cafe" },
  { value: "restaurant", labelKey: "restaurant" },
  { value: "cultural", labelKey: "cultural" },
  { value: "nature", labelKey: "nature" },
  { value: "nightlife", labelKey: "nightlife" },
  { value: "art", labelKey: "art" },
  { value: "workshop", labelKey: "workshop" },
];

export default function SavedPlacesPage() {
  const router = useRouter();
  const t = useTranslations("saved");
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data: savedPlaces, isLoading: savedLoading } = trpc.place.getSavedPlaces.useQuery();
  const { data: tourHistory, isLoading: toursLoading } = trpc.tour.getHistory.useQuery();

  const tourPlaceIds = useMemo(() => {
    const completedTours = (tourHistory || []).filter((t) => t.status === "completed");
    const ids = new Set<string>();
    for (const tour of completedTours) {
      const td = tour.tourData as { stops?: { placeId?: string }[] } | null;
      for (const stop of td?.stops || []) {
        if (stop?.placeId) ids.add(stop.placeId);
      }
    }
    return Array.from(ids);
  }, [tourHistory]);

  const { data: tourPlaces, isLoading: tourPlacesLoading } = trpc.place.getByIds.useQuery(
    { ids: tourPlaceIds },
    { enabled: tourPlaceIds.length > 0 }
  );

  const allPlaces = useMemo(() => {
    const map = new Map<string, typeof savedPlaces extends (infer T)[] | undefined ? T : never>();
    for (const p of savedPlaces || []) map.set(p.id, p);
    for (const p of tourPlaces || []) if (!map.has(p.id)) map.set(p.id, p);
    return Array.from(map.values());
  }, [savedPlaces, tourPlaces]);

  const isLoading = savedLoading || toursLoading || tourPlacesLoading;
  const savedIds = new Set((savedPlaces || []).map((p) => p.id));

  const filtered = allPlaces.filter((p) => {
    if (filter === undefined) return true;
    return p.category.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="pb-24 lg:pb-8 min-h-screen bg-[#f8faf8] lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-6">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-secondary">{t("title")}</h1>
        <Badge variant="outline" className="text-xs ml-auto">{t("places", { n: allPlaces.length })}</Badge>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Badge
              key={f.labelKey}
              variant={active ? "default" : "outline"}
              className={`cursor-pointer px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
                active ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card hover:border-secondary"
              }`}
              onClick={() => setFilter(f.value)}
            >
              {t(`filters.${f.labelKey}`)}
            </Badge>
          );
        })}
      </div>

      {isLoading ? (
        <div className="px-4 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 pt-16 text-center">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
            {allPlaces.length === 0 ? t("emptyTitle") : t("emptyCategoryTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {allPlaces.length === 0 ? t("emptyBody") : t("emptyCategoryBody")}
          </p>
          {allPlaces.length === 0 && (
            <Button onClick={() => router.push("/explore")} className="mt-6 bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-8">
              {t("explorePlaces")}
            </Button>
          )}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filtered.map((place) => {
            const photos = place.photos as string[] | null;
            const isExplicitSave = savedIds.has(place.id);
            return (
              <Link key={place.id} href={`/explore/${place.slug || place.id}`}>
                <Card className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-28 bg-gradient-to-br from-secondary to-[#A8C589] relative overflow-hidden">
                    {photos?.[0] && <img src={photos[0]} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <Badge className="absolute top-2 right-2 bg-primary border-0 text-primary-foreground text-xs">{place.category}</Badge>
                    {isExplicitSave && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="white" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-semibold text-secondary line-clamp-2">{place.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">★ {Number(place.avgRating || 0).toFixed(1)} &middot; {place.priceRange}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
