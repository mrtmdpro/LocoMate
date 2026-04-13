"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const FILTERS = ["All", "Cafe", "Restaurant", "Cultural", "Nature", "Nightlife", "Art", "Workshop"];

export default function SavedPlacesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");

  const { data: tourHistory, isLoading: toursLoading } = trpc.tour.getHistory.useQuery();

  const placeIds = useMemo(() => {
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

  const { data: places, isLoading: placesLoading } = trpc.place.getByIds.useQuery(
    { ids: placeIds },
    { enabled: placeIds.length > 0 }
  );

  const allPlaces = places || [];
  const isLoading = toursLoading || placesLoading;

  const filtered = allPlaces.filter((p) => {
    if (filter === "All") return true;
    return p.category.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="pb-24 min-h-screen bg-[#f8faf8]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">Saved Places</h1>
        <Badge variant="outline" className="text-[10px] ml-auto">{allPlaces.length} places</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <Badge
            key={f}
            variant={filter === f ? "default" : "outline"}
            className={`cursor-pointer px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
              filter === f ? "bg-[#3f6f60] text-white border-[#3f6f60]" : "bg-white hover:border-[#3f6f60]"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="px-4 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 pt-16 text-center">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold font-heading text-[#3f6f60]">
            {placeIds.length === 0 ? "No saved places yet" : allPlaces.length === 0 ? "Places unavailable" : "No places in this category"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {placeIds.length === 0 ? "Complete a tour to save places you visit!" : allPlaces.length === 0 ? "The places from your tours may have been updated." : "Try a different filter"}
          </p>
          {placeIds.length === 0 && (
            <Button onClick={() => router.push("/plan")} className="mt-6 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl px-8">
              Plan a Tour
            </Button>
          )}
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filtered.map((place) => {
            const photos = place.photos as string[] | null;
            return (
              <Link key={place.id} href={`/explore/${place.id}`}>
                <Card className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-28 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
                    {photos?.[0] && <img src={photos[0]} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <Badge className="absolute top-2 right-2 bg-[#ff8c30] border-0 text-white text-[8px]">{place.category}</Badge>
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-semibold text-[#3f6f60] line-clamp-2">{place.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">★ {Number(place.avgRating || 0).toFixed(1)} &middot; {place.priceRange}</p>
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
