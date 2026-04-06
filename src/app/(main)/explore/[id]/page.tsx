"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: place, isLoading } = trpc.place.getById.useQuery({ id });

  if (isLoading) return <div className="p-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (!place) return <div className="p-4 text-center">Place not found</div>;

  const experienceTags = (place.experienceTags || {}) as Record<string, number>;
  const emotionalTags = (place.emotionalTags || {}) as Record<string, number>;
  const topEmotions = Object.entries(emotionalTags).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="pb-24">
      <div className="h-64 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative">
        <button onClick={() => router.back()} className="absolute top-4 left-4 bg-white/90 rounded-full p-2 shadow-md">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <Badge className="absolute top-4 right-4 bg-[#ff8c30] border-0 text-white">{place.category}</Badge>
      </div>

      <div className="p-4 -mt-8 relative space-y-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h1 className="text-xl font-bold font-[family-name:var(--font-sora)] text-[#3f6f60]">{place.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{place.address}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-lg font-bold text-[#ff8c30]">{place.priceRange}</span>
              <span className="text-sm text-muted-foreground">★ {Number(place.avgRating).toFixed(1)} ({place.totalReviews} reviews)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topEmotions.map(([tag, score]) => (
                <Badge key={tag} variant="outline" className="text-xs capitalize">{tag} {Math.round(score * 100)}%</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#3f6f60] mb-2">About this place</h3>
            <p className="text-sm text-muted-foreground">{place.description}</p>
          </CardContent>
        </Card>

        <Card className="border-[#ff8c30]/20 bg-[#ff8c30]/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#ff8c30] mb-2">Why it fits you</h3>
            <p className="text-sm text-muted-foreground">
              This place scores highly on {topEmotions[0]?.[0]} and {topEmotions[1]?.[0]}, matching your travel personality profile. It&apos;s a {experienceTags.authenticity > 0.7 ? "highly authentic" : "popular"} spot with {experienceTags.uniqueness > 0.7 ? "high uniqueness" : "great accessibility"}.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 h-12 rounded-xl">Save</Button>
          <Button className="flex-1 h-12 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold" onClick={() => router.push("/plan")}>
            Add to Tour
          </Button>
        </div>
      </div>
    </div>
  );
}
