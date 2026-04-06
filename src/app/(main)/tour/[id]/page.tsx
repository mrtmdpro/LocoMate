"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface TourStop {
  placeId: string;
  name: string;
  category: string;
  description: string | null;
  scheduledTime: string;
  durationMinutes: number;
  localTip: string;
  estimatedSpend: string;
  travelToNext: string;
}

export default function FullTourPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: tour, isLoading } = trpc.tour.getFullTour.useQuery(
    { tourId: id },
    { retry: false }
  );

  const startMutation = trpc.tour.startTour.useMutation({
    onSuccess: () => router.push(`/tour/${id}/active`),
  });

  if (isLoading) return <div className="p-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  if (!tour) {
    return (
      <div className="p-4 text-center space-y-4 pt-20">
        <p className="text-muted-foreground">Tour not accessible. You may need to complete payment first.</p>
        <Button onClick={() => router.push(`/tour/${id}/preview`)} className="bg-[#ff8c30] text-white rounded-xl">
          View Preview
        </Button>
      </div>
    );
  }

  const tourData = tour.tourData as {
    title: string;
    description: string;
    stops: TourStop[];
    personalizationRationale: string;
    estimatedCost: { min: number; max: number; currency: string };
    totalDurationMinutes: number;
  };

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#ff8c30] to-[#e67a20] p-6 pb-12">
        <button onClick={() => router.push("/plan")} className="text-white/80 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <Badge className="bg-white/20 text-white border-0 mb-2">Premium Itinerary</Badge>
        <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-sora)]">{tourData.title}</h1>
        <div className="flex gap-4 mt-3 text-white/90 text-sm">
          <span>{Math.round(tourData.totalDurationMinutes / 60)}h</span>
          <span>{tourData.stops.length} stops</span>
          <span>{Math.round(tourData.estimatedCost.min / 1000)}k-{Math.round(tourData.estimatedCost.max / 1000)}k VND</span>
        </div>
      </div>

      <div className="p-4 -mt-6 space-y-4">
        {/* Full Timeline */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#3f6f60] mb-4">Your complete itinerary</h3>
            <div className="space-y-1">
              {tourData.stops.map((stop, i) => (
                <div key={i} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-[#ff8c30] text-white flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    {i < tourData.stops.length - 1 && (
                      <div className="w-0.5 flex-1 bg-[#ff8c30]/20 mt-1 min-h-[2rem]" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-xs font-medium text-[#ff8c30]">{stop.scheduledTime} &middot; {stop.durationMinutes} min</p>
                    <h4 className="font-semibold text-[#3f6f60] mt-0.5">{stop.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stop.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{stop.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{stop.estimatedSpend}</span>
                    </div>
                    <div className="mt-2 bg-[#D9EDBF]/40 rounded-lg p-2">
                      <p className="text-[11px] text-[#3f6f60]">💡 {stop.localTip}</p>
                    </div>
                    {i < tourData.stops.length - 1 && (
                      <p className="text-[10px] text-muted-foreground mt-2">→ {stop.travelToNext}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Why this works */}
        <Card className="border-[#ff8c30]/20 bg-[#ff8c30]/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#ff8c30] mb-2">Why this works for you</h3>
            <p className="text-sm text-muted-foreground">{tourData.personalizationRationale}</p>
          </CardContent>
        </Card>
      </div>

      {/* Start Tour CTA */}
      {tour.status === "paid" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            onClick={() => startMutation.mutate({ tourId: id })}
            disabled={startMutation.isPending}
            className="w-full h-14 rounded-2xl bg-[#90D26D] hover:bg-[#7bc25a] text-white font-bold text-base shadow-lg"
          >
            {startMutation.isPending ? "Starting..." : "🚀 Start Tour Now"}
          </Button>
        </div>
      )}
    </div>
  );
}
