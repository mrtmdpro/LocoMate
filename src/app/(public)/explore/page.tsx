"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";

const PlaceMap = dynamic(() => import("@/components/place-map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-sm text-muted-foreground">Loading map...</div>,
});

const CATEGORIES = ["All", "Cafe", "Restaurant", "Cultural", "Nature", "Nightlife", "Workshop", "Art"];

export default function ExplorePage() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const { data, isLoading } = trpc.place.getFeed.useQuery(
    { category: category === "All" ? undefined : category.toLowerCase(), search: search || undefined, limit: 20 }
  );

  const allPlaces = data?.places || [];
  const featuredPlace = allPlaces[0];
  const randomGem = allPlaces.length > 3 ? allPlaces[Math.floor(allPlaces.length / 2)] : allPlaces[1];
  const feedPlaces = allPlaces.slice(1);

  return (
    <PageTransition>
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {user ? (
            <Avatar className="w-9 h-9 border-2 border-[#ff8c30]/20">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="bg-[#3f6f60] text-white font-bold text-xs">{(user.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#ff8c30] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9" /></svg>
            </div>
          )}
          <h1 className="text-xl font-bold font-heading text-[#ff8c30]">Explore Hanoi</h1>
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "list" ? "bg-white shadow-sm text-[#3f6f60]" : "text-gray-400"}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "map" ? "bg-white shadow-sm text-[#3f6f60]" : "text-gray-400"}`}
          >
            Map
          </button>
        </div>
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

      {/* Map View */}
      {viewMode === "map" && (
        <div className="h-[calc(100vh-220px)] -mx-4 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-sm text-muted-foreground">Loading places...</div>
          ) : (
            <PlaceMap places={allPlaces as { id: string; slug: string | null; name: string; category: string; latitude: number | string; longitude: number | string; photos: string[] | null; avgRating: string | null; priceRange: string | null }[]} />
          )}
        </div>
      )}

      {/* Featured Gems Section */}
      {viewMode === "list" && !search && category === "All" && featuredPlace && !isLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#3f6f60]">Featured Gems</h2>
            <span className="text-xs text-[#ff8c30] font-medium">VIEW ALL</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Link href={`/explore/${(featuredPlace as { slug?: string }).slug || (featuredPlace as { id: string }).id}`} className="col-span-2 row-span-2">
              <Card className="border-0 shadow-md overflow-hidden h-full">
                <div className="h-full min-h-[200px] relative overflow-hidden">
                  {(featuredPlace as { photos: string[] | null }).photos?.[0] && (
                    <img src={(featuredPlace as { photos: string[] }).photos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-[#90D26D] border-0 text-white text-[10px]">TOP CHOICE</Badge>
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5">
                    <span className="text-yellow-400 text-xs">★</span>
                    <span className="text-white text-xs font-bold">{Number((featuredPlace as { avgRating: string | null }).avgRating || 0).toFixed(1)}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-sm line-clamp-2">{(featuredPlace as { name: string }).name}</h3>
                    <p className="text-white/70 text-[10px] line-clamp-1 mt-0.5">{(featuredPlace as { description: string | null }).description}</p>
                  </div>
                </div>
              </Card>
            </Link>
            {randomGem && (
              <Link href={`/explore/${(randomGem as { slug?: string }).slug || (randomGem as { id: string }).id}`}>
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="h-24 relative overflow-hidden bg-gradient-to-br from-[#3f6f60] to-[#90D26D]">
                    {(randomGem as { photos: string[] | null }).photos?.[0] && (
                      <img src={(randomGem as { photos: string[] }).photos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    <p className="absolute bottom-1.5 left-2 text-white text-[10px] font-semibold line-clamp-1">{(randomGem as { name: string }).name}</p>
                  </div>
                </Card>
              </Link>
            )}
            <Card className="border-0 shadow-sm overflow-hidden bg-[#D9EDBF] flex items-center justify-center cursor-pointer" onClick={() => { const rand = allPlaces[Math.floor(Math.random() * allPlaces.length)]; if (rand) window.location.href = `/explore/${(rand as { slug?: string }).slug || (rand as { id: string }).id}`; }}>
              <CardContent className="p-3 text-center">
                <p className="text-[#3f6f60] font-bold text-xs">Surprise Discovery</p>
                <p className="text-[10px] text-[#3f6f60]/60 mt-0.5">RANDOM GEM</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Section heading */}
      {viewMode === "list" && !search && category === "All" && (
        <h2 className="font-bold text-[#3f6f60] pt-1">Popular Near You</h2>
      )}

      {/* Places Feed */}
      {viewMode === "list" && isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-4">
          {(search || category !== "All" ? allPlaces : feedPlaces).map((place, idx) => (
            <motion.div
              key={(place as { id: string }).id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <PlaceCard place={place} />
            </motion.div>
          ))}
          {allPlaces.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No places found. Try different filters!</p>
          )}
        </div>
      ) : null}
    </div>
    </PageTransition>
  );
}

function PlaceCard({ place }: { place: Record<string, unknown> }) {
  const p = place as {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    category: string;
    priceRange: string | null;
    avgRating: string | null;
    totalReviews: number | null;
    photos: string[] | null;
    emotionalTags: Record<string, number>;
  };
  const topTags = Object.entries(p.emotionalTags || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const photo = p.photos?.[0];
  const reviewCount = p.totalReviews || 0;
  const reviewLabel = reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}k` : String(reviewCount);

  return (
    <Link href={`/explore/${p.slug || p.id}`}>
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="h-40 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
          {photo && <img src={photo} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <Badge className="absolute top-3 right-3 bg-[#ff8c30] border-0 text-white text-xs">{p.category}</Badge>
          {p.priceRange && (
            <Badge className="absolute top-3 left-3 bg-[#90D26D]/90 border-0 text-white text-[10px]">{p.priceRange} Budget Friendly</Badge>
          )}
        </div>
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#3f6f60] line-clamp-1">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">★ {Number(p.avgRating || 0).toFixed(1)} &middot; {reviewLabel} reviews</p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-sm font-bold text-[#ff8c30]">{Number(p.avgRating || 0).toFixed(1)}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{p.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] capitalize px-2 py-0.5 font-semibold">{tag}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
