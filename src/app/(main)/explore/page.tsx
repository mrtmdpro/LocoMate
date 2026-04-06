"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";

const CATEGORIES = ["All", "Cafe", "Restaurant", "Cultural", "Nature", "Nightlife", "Workshop", "Art"];

export default function ExplorePage() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.place.getFeed.useQuery(
    { category: category === "All" ? undefined : category.toLowerCase(), search: search || undefined, limit: 20 },
    { enabled: !!user }
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Xin Chao, {user?.displayName?.split(" ")[0]}!</p>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-[#3f6f60]">Explore Hanoi</h1>
        </div>
        <img src="/images/logo.png" alt="LOCOMATE" className="h-9" />
      </div>

      {/* Search */}
      <Input
        placeholder="Search hidden gems..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-xl h-11 bg-white"
      />

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? "default" : "outline"}
            className={`cursor-pointer px-3.5 py-1.5 text-xs rounded-full whitespace-nowrap transition-all ${
              category === cat ? "bg-[#ff8c30] text-white border-[#ff8c30]" : "bg-white hover:border-[#ff8c30]"
            }`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Places Grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.places?.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
          {data?.places?.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No places found. Try different filters!</p>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place }: { place: Record<string, unknown> }) {
  const p = place as {
    id: string;
    name: string;
    description: string | null;
    category: string;
    priceRange: string | null;
    avgRating: string | null;
    emotionalTags: Record<string, number>;
  };
  const topTags = Object.entries(p.emotionalTags || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="h-40 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative">
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          {topTags.map((tag) => (
            <Badge key={tag} className="bg-white/90 text-[#3f6f60] text-[10px] capitalize border-0">{tag}</Badge>
          ))}
        </div>
        <Badge className="absolute top-3 right-3 bg-[#ff8c30] border-0 text-white text-xs">{p.category}</Badge>
      </div>
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-[#3f6f60] line-clamp-1">{p.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-sm font-semibold text-[#ff8c30]">{p.priceRange}</div>
            <div className="text-xs text-muted-foreground">★ {Number(p.avgRating || 0).toFixed(1)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
