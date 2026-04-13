"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const FILTERS = ["All", "Cafe", "Restaurant", "Cultural", "Nature", "Nightlife"];

export default function SavedPlacesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const { data, isLoading } = trpc.place.getFeed.useQuery({ limit: 30 });

  const places = (data?.places || []).filter((p) => {
    if (filter === "All") return true;
    return (p as { category: string }).category === filter.toLowerCase();
  });

  return (
    <div className="pb-24 min-h-screen bg-[#f8faf8]">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-lg font-bold font-heading text-[#3f6f60]">Saved Places</h1>
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
        <div className="px-4 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : places.length === 0 ? (
        <div className="px-4 pt-16 text-center">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold font-heading text-[#3f6f60]">No saved places yet</h2>
          <p className="text-sm text-muted-foreground mt-2">Explore Hanoi and save your favorites!</p>
          <Button onClick={() => router.push("/explore")} className="mt-6 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl px-8">
            Explore Hanoi
          </Button>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {places.map((place) => {
            const p = place as { id: string; name: string; category: string; photos: string[] | null; avgRating: string | null };
            return (
              <Link key={p.id} href={`/explore/${p.id}`}>
                <Card className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-28 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
                    {p.photos?.[0] && <img src={p.photos[0]} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <Badge className="absolute top-2 right-2 bg-[#ff8c30] border-0 text-white text-[8px]">{p.category}</Badge>
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-semibold text-[#3f6f60] line-clamp-1">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">★ {Number(p.avgRating || 0).toFixed(1)}</p>
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
