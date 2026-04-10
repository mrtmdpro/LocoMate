"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const { user } = useAuthStore();
  const { data: profileData } = trpc.user.getProfile.useQuery();
  const { data: tourHistory } = trpc.tour.getHistory.useQuery();
  const { data: matches } = trpc.match.getMatches.useQuery();
  const { data: places } = trpc.place.getFeed.useQuery({ limit: 5 });

  const derived = (profileData?.profile?.derivedData || {}) as { personalityLabel?: string };
  const activeTour = (tourHistory || []).find((t) => t.status === "active" || t.status === "paid");
  const recentTours = (tourHistory || []).filter((t) => t.status === "completed").slice(0, 2);
  const nearbyTravelers = matches?.slice(0, 4) || [];
  const topPlaces = places?.places?.slice(0, 4) || [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">
            {user?.displayName?.split(" ")[0]}!
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-[#D9EDBF] text-[#3f6f60] border-0 text-xs font-medium">Hanoi</Badge>
          <Link href="/profile">
            <Avatar className="w-10 h-10 border-2 border-[#ff8c30]/20">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
              <AvatarFallback className="bg-[#3f6f60] text-white font-bold text-sm">{(user?.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Personality Badge */}
      {derived.personalityLabel && (
        <Card className="border-0 bg-gradient-to-r from-[#ff8c30]/10 to-[#D9EDBF]/30">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff8c30] flex items-center justify-center text-white text-lg">✨</div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Your travel personality</p>
              <p className="font-semibold text-[#3f6f60] text-sm">{derived.personalityLabel}</p>
            </div>
            <Link href="/profile/preferences">
              <Badge variant="outline" className="text-[10px] cursor-pointer">Edit</Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Resume Active Tour */}
      {activeTour && (
        <Card className="border-2 border-[#ff8c30] shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-[#ff8c30] text-white border-0 text-[10px]">Active Tour</Badge>
            </div>
            <h3 className="font-semibold text-[#3f6f60]">
              {(activeTour.tourData as { title?: string })?.title || "Your Hanoi Tour"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {(activeTour.tourData as { stops?: unknown[] })?.stops?.length || 0} stops planned
            </p>
            <Link href={`/tour/${activeTour.id}/${activeTour.status === "active" ? "active" : ""}`}>
              <Button className="w-full mt-3 h-10 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white text-sm font-semibold">
                Resume Tour
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Plan a Tour CTA */}
      {!activeTour && (
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative">
            <img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&h=400&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
              <h3 className="text-white font-bold font-heading text-lg">Design Your Hanoi Tour</h3>
              <p className="text-white/80 text-xs mt-1">AI creates a personalized itinerary in seconds</p>
            </div>
          </div>
          <CardContent className="p-3">
            <Link href="/plan">
              <Button className="w-full h-10 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white text-sm font-semibold">
                Start Planning
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Nearby Travelers */}
      {nearbyTravelers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#3f6f60]">Your Travel Friends</h2>
            <Link href="/match" className="text-xs text-[#ff8c30] font-medium">Find more</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {nearbyTravelers.map((m) => (
              <Link key={m.id} href={`/chat/${m.id}`} className="shrink-0">
                <div className="flex flex-col items-center gap-1.5 w-16">
                  <Avatar className="w-14 h-14 border-2 border-[#90D26D]">
                    {m.otherUser?.avatarUrl && <AvatarImage src={m.otherUser.avatarUrl} alt={m.otherUser.displayName || ""} />}
                    <AvatarFallback className="bg-[#3f6f60] text-white text-sm font-bold">{(m.otherUser?.displayName || "?")[0]}</AvatarFallback>
                  </Avatar>
                  <p className="text-[10px] text-center truncate w-full">{m.otherUser?.displayName?.split(" ")[0]}</p>
                </div>
              </Link>
            ))}
            <Link href="/match" className="shrink-0">
              <div className="flex flex-col items-center gap-1.5 w-16">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#ff8c30]/30 flex items-center justify-center">
                  <span className="text-[#ff8c30] text-lg">+</span>
                </div>
                <p className="text-[10px] text-[#ff8c30]">More</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Hidden Gems */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#3f6f60]">Hidden Gems</h2>
          <Link href="/explore" className="text-xs text-[#ff8c30] font-medium">See all</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {topPlaces.map((place) => {
            const p = place as { id: string; name: string; category: string; photos: string[] | null; avgRating: string | null };
            return (
              <Link key={p.id} href={`/explore/${p.id}`} className="shrink-0 w-40">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
                    {p.photos?.[0] && <img src={p.photos[0]} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <Badge className="absolute top-2 right-2 bg-[#ff8c30] border-0 text-white text-[8px]">{p.category}</Badge>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-semibold text-[#3f6f60] line-clamp-1">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">★ {Number(p.avgRating || 0).toFixed(1)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Tours */}
      {recentTours.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#3f6f60]">Recent Tours</h2>
            <Link href="/profile" className="text-xs text-[#ff8c30] font-medium">All tours</Link>
          </div>
          {recentTours.map((tour) => {
            const td = tour.tourData as { title?: string; stops?: unknown[] } | null;
            return (
              <Card key={tour.id} className="border-0 shadow-sm mb-2">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#ff8c30]/10 flex items-center justify-center text-lg">🗺</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{td?.title || "Hanoi Tour"}</p>
                    <p className="text-[10px] text-muted-foreground">{td?.stops?.length || 0} stops &middot; {tour.completedAt ? new Date(tour.completedAt).toLocaleDateString() : ""}</p>
                  </div>
                  <Badge className="bg-[#90D26D]/10 text-[#3f6f60] border-0 text-[10px]">Done</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
