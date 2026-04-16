"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const utils = trpc.useUtils();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: placeById, isLoading: loadingById } = trpc.place.getById.useQuery({ id }, { enabled: isUuid });
  const { data: placeBySlug, isLoading: loadingBySlug } = trpc.place.getBySlug.useQuery({ slug: id }, { enabled: !isUuid });
  const place = isUuid ? placeById : placeBySlug;
  const isLoading = isUuid ? loadingById : loadingBySlug;

  const placeId = place?.id;
  const { data: savedStatus } = trpc.place.isSaved.useQuery(
    { placeId: placeId! },
    { enabled: !!placeId && !!user }
  );
  const isSaved = savedStatus?.saved ?? false;

  const saveMutation = trpc.place.savePlace.useMutation({
    onSuccess: () => {
      utils.place.isSaved.invalidate({ placeId: placeId! });
      toast.success("Place saved to favorites!");
    },
  });
  const unsaveMutation = trpc.place.unsavePlace.useMutation({
    onSuccess: () => {
      utils.place.isSaved.invalidate({ placeId: placeId! });
      toast.success("Place removed from favorites");
    },
  });

  const handleSave = () => {
    if (!user) { router.push("/register"); return; }
    if (!placeId) return;
    if (isSaved) unsaveMutation.mutate({ placeId });
    else saveMutation.mutate({ placeId });
  };

  const handleAddToTour = () => {
    if (!user) { router.push("/register"); return; }
    router.push("/plan");
  };

  if (isLoading) return <div className="p-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /><div className="h-32 bg-gray-100 rounded-2xl animate-pulse mt-4" /><div className="h-48 bg-gray-100 rounded-2xl animate-pulse mt-4" /></div>;
  if (!place) return <div className="p-4 text-center">Place not found</div>;

  const experienceTags = (place.experienceTags || {}) as Record<string, number>;
  const emotionalTags = (place.emotionalTags || {}) as Record<string, number>;
  const topEmotions = Object.entries(emotionalTags).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const auth = Number(experienceTags.authenticity ?? 0);
  const access = Number(experienceTags.accessibility ?? 0);
  const noise = Number(experienceTags.noise_level ?? 0.5);
  const uniq = Number(experienceTags.uniqueness ?? 0);

  const personalityReasons = [
    { icon: "👤", title: "Perfect for Solo Travelers", desc: auth > 0.6 ? "Minimal chatter and communal tables make it comfortable to sit alone with a book or journal." : "A welcoming environment that's easy to enjoy at your own pace." },
    { icon: "📍", title: "Easy Accessibility", desc: `Located ${access > 0.7 ? "just minutes from the Old Quarter" : "in a convenient area"}, ${noise < 0.4 ? "yet feels miles away from the noise" : "with a lively local atmosphere"}.` },
    ...(uniq > 0.7 ? [{ icon: "💎", title: "Unique Experience", desc: "This is a rare find that most tourists miss. Our data shows high uniqueness scores from local curators." }] : []),
  ];

  const lat = Number((place as { latitude: number | string | null }).latitude) || 0;
  const lng = Number((place as { longitude: number | string | null }).longitude) || 0;
  const hasCoords = lat !== 0 && lng !== 0;
  const mapUrl = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}` : "";
  const gmapsUrl = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : "";

  return (
    <div className="pb-24">
      <div className="h-64 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative overflow-hidden">
        {(place.photos as string[] | null)?.[0] && (
          <img src={(place.photos as string[])[0]} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button onClick={() => router.back()} className="absolute top-4 left-4 bg-white/90 rounded-full p-2 shadow-md z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="absolute bottom-3 left-4 right-4 z-10">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-white/20 backdrop-blur-sm text-white text-[10px] border-0 uppercase">{place.category}</Badge>
            <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-0.5">
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-white text-xs font-bold">{Number(place.avgRating).toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 -mt-6 relative space-y-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h1 className="text-xl font-bold font-heading text-[#3f6f60]">{place.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{place.address}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-lg font-bold text-[#ff8c30]">{place.priceRange}</span>
              <span className="text-sm text-muted-foreground">★ {Number(place.avgRating).toFixed(1)} ({place.totalReviews} reviews)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topEmotions.map(([tag]) => (
                <Badge key={tag} className="bg-[#D9EDBF] text-[#3f6f60] text-xs capitalize border-0">{tag}</Badge>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <Button className="flex-1 h-11 rounded-xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-semibold text-sm" onClick={handleAddToTour}>
                {user ? "Add to Tour" : "Sign up to plan your tour"}
              </Button>
              <Button
                variant="outline"
                className={`h-11 w-11 rounded-xl p-0 transition-colors ${isSaved ? "bg-yellow-400 border-yellow-400 hover:bg-yellow-500" : ""}`}
                onClick={handleSave}
              >
                <svg className="w-5 h-5" fill={isSaved ? "white" : "none"} viewBox="0 0 24 24" stroke={isSaved ? "white" : "currentColor"} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-[#3f6f60] text-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-[#ff8c30]" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 0115 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346L10 6.395 6.214 8.011l1.738 4.346a1 1 0 01-.025.846A3.955 3.955 0 015 14.5a3.955 3.955 0 01-2.927-1.297 1 1 0 01-.025-.846l1.738-4.346-1.233-.617a1 1 0 11.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z" /></svg>
              <h3 className="font-bold">The Locomate Story</h3>
            </div>
            <p className="text-sm text-white/85 leading-relaxed">{place.description}</p>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
              <div className="w-6 h-6 rounded-full bg-[#ff8c30] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-xs text-white/70">Curated by Locomate &middot; Verified Hidden Gem</span>
            </div>
          </CardContent>
        </Card>

        <div>
          <h3 className="font-bold text-[#3f6f60] mb-3">Why it fits you</h3>
          <div className="space-y-2">
            {personalityReasons.map((r, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D9EDBF] flex items-center justify-center text-lg shrink-0">{r.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#3f6f60]">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {hasCoords && (
          <div>
            <h3 className="font-bold text-[#3f6f60] mb-3">Location</h3>
            <Card className="border-0 shadow-sm overflow-hidden">
              <iframe src={mapUrl} className="w-full h-40 border-0" loading="lazy" title="Location map" />
              <CardContent className="p-3">
                <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-sm text-[#ff8c30] font-semibold">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                  Open in Google Maps
                </a>
              </CardContent>
            </Card>
          </div>
        )}

        {!user && (
          <Card className="border-[#ff8c30]/20 bg-[#ff8c30]/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm font-semibold text-[#3f6f60]">Want a personalized Hanoi itinerary?</p>
              <p className="text-xs text-muted-foreground mt-1">Create a free account and our AI builds a tour around your personality.</p>
              <Link href="/register">
                <Button className="mt-3 bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold rounded-xl px-6">
                  Create Free Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
