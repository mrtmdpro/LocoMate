"use client";

import Link from "next/link";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { user } = useAuthStore();
  const { data: profileData, isLoading: profileLoading } = trpc.user.getProfile.useQuery();
  const { data: tourHistory, isLoading: toursLoading } = trpc.tour.getHistory.useQuery();
  const { data: places, isLoading: placesLoading } = trpc.place.getFeed.useQuery({ limit: 6 });
  const { data: experiencesList } = trpc.experience.list.useQuery();

  if (profileLoading || toursLoading || placesLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div><Skeleton className="h-5 w-32 mb-3" /><div className="flex gap-3"><Skeleton className="h-20 w-16 rounded-full" /><Skeleton className="h-20 w-16 rounded-full" /><Skeleton className="h-20 w-16 rounded-full" /></div></div>
        <div><Skeleton className="h-5 w-28 mb-3" /><div className="flex gap-3"><Skeleton className="h-36 w-40 rounded-xl" /><Skeleton className="h-36 w-40 rounded-xl" /><Skeleton className="h-36 w-40 rounded-xl" /></div></div>
      </div>
    );
  }

  const activeTour = (tourHistory || []).find((t) => t.status === "active" || t.status === "paid");
  const completedTours = (tourHistory || []).filter((t) => t.status === "completed");
  const latestTour = completedTours[0];
  const topPlaces = places?.places?.slice(0, 5) || [];
  const topExperiences = experiencesList?.slice(0, 3) || [];
  const firstName = user?.displayName?.split(" ")[0] || "Traveler";

  const subtitles = [
    `Ready for some Pho and hidden alleys?`,
    `What hidden gems will you find today?`,
    `The Old Quarter is calling, ${firstName}!`,
  ];
  const subtitle = subtitles[new Date().getDate() % subtitles.length];

  return (
    <PageTransition><div className="p-4 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#ff8c30]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
          <span className="font-semibold text-[#3f6f60]">Hanoi</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/explore">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </Link>
          <Link href="/profile">
            <Avatar className="w-10 h-10 border-2 border-[#ff8c30]/20">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
              <AvatarFallback className="bg-[#3f6f60] text-white font-bold text-sm">{(user?.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">
          Xin Chao, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      {/* Search */}
      <Link href="/explore">
        <Input
          readOnly
          placeholder="Search for coffee, tours, or people..."
          className="rounded-xl h-11 bg-white cursor-pointer"
        />
      </Link>

      {/* Your Day in Hanoi (Timeline) */}
      {(activeTour || latestTour) && (() => {
        const tour = activeTour || latestTour;
        const td = tour!.tourData as { title?: string; stops?: { name?: string; scheduledTime?: string; category?: string }[] } | null;
        const stops = td?.stops?.slice(0, 3) || [];
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#3f6f60]">Your Day in Hanoi</h2>
              <Link href={`/tour/${tour!.id}${activeTour ? "/active" : ""}`} className="text-xs text-[#ff8c30] font-medium">View Full Plan</Link>
            </div>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                {stops.map((stop, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-[#ff8c30]" : "bg-gray-300"}`} />
                      {i < stops.length - 1 && <div className="w-0.5 h-8 bg-gray-200" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-[10px] text-[#ff8c30] font-semibold">{stop.scheduledTime || `${9 + i}:00 AM`}</p>
                      <p className="text-sm font-medium text-[#3f6f60]">{stop.name || "Stop " + (i + 1)}</p>
                    </div>
                  </div>
                ))}
                <Link href="/plan">
                  <Button className="w-full mt-2 h-9 rounded-xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white text-xs font-semibold">
                    Optimize Route
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Plan a Tour CTA (when no tours) */}
      {!activeTour && !latestTour && (
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

      {/* Only-in-Hanoi Experiences */}
      {topExperiences.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#3f6f60]">Only-in-Hanoi</h2>
            <Link href="/experiences" className="text-xs text-[#ff8c30] font-medium">See all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {topExperiences.map((exp) => (
              <Link key={exp.id} href={`/experiences/${exp.slug}`} className="shrink-0 w-52">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="h-28 relative overflow-hidden">
                    {(exp.photos as string[] | null)?.[0] && <img src={(exp.photos as string[])[0]} alt={exp.title} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <Badge className="absolute top-2 left-2 bg-[#ff8c30] border-0 text-white text-[8px]">EXPERIENCE</Badge>
                    <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-bold line-clamp-1">&ldquo;{exp.title}&rdquo;</p>
                  </div>
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">{Math.round(exp.durationMinutes / 60)}h &middot; ★ {Number(exp.avgRating || 0).toFixed(1)}</p>
                      <p className="text-xs font-bold text-[#ff8c30]">{(exp.priceAmount / 1000).toFixed(0)}k</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
          {topPlaces.map((place, idx) => {
            const p = place as { id: string; slug: string | null; name: string; category: string; photos: string[] | null; avgRating: string | null; totalReviews?: number };
            return (
              <Link key={p.id} href={`/explore/${p.slug || p.id}`} className="shrink-0 w-40">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
                    {p.photos?.[0] && <img src={p.photos[0]} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {idx === 0 && <Badge className="absolute top-2 left-2 bg-[#90D26D] border-0 text-white text-[8px]">TOP CHOICE</Badge>}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      <span className="text-white text-xs font-bold">★ {Number(p.avgRating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-semibold text-[#3f6f60] line-clamp-1">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{p.category}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Premium Experience Host Promo */}
      <Card className="border-0 shadow-md overflow-hidden bg-[#3f6f60]">
        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=400&fit=crop"
            alt=""
            className="w-full h-40 object-cover opacity-30"
          />
          <div className="absolute inset-0 p-5 flex flex-col justify-end">
            <Badge className="bg-[#ff8c30] border-0 text-white text-[10px] w-fit mb-2">PREMIUM EXPERIENCE</Badge>
            <h3 className="text-white font-bold font-heading text-lg">Host-led Photography Tour</h3>
            <p className="text-white/70 text-xs mt-1">
              Let a local pro show you the best angles of Hanoi for your social media.
            </p>
            <Link href="/plan">
              <Button className="mt-3 h-9 rounded-xl bg-white text-[#3f6f60] hover:bg-white/90 text-xs font-semibold w-fit px-5">
                Explore Hosts
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* eSIM Banner */}
      <Link href="/esim">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-[#D9EDBF]/50 to-[#90D26D]/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3f6f60] flex items-center justify-center text-white text-lg shrink-0">📶</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#3f6f60]">Get Vietnam eSIM</p>
              <p className="text-[10px] text-muted-foreground">Instant data from $5.90. No SIM card needed.</p>
            </div>
            <svg className="w-4 h-4 text-[#3f6f60]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </CardContent>
        </Card>
      </Link>
    </div></PageTransition>
  );
}
