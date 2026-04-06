"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

interface TourStop {
  placeId: string;
  name: string;
  category: string;
  scheduledTime: string;
  durationMinutes: number;
  localTip: string;
  travelToNext: string;
}

export default function ActiveTourPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visitedStops, setVisitedStops] = useState<Set<number>>(new Set());
  const [locationSharing, setLocationSharing] = useState(false);

  const { data: tour } = trpc.tour.getFullTour.useQuery({ tourId: id }, { retry: false });
  const completeMutation = trpc.tour.completeTour.useMutation({
    onSuccess: () => router.push("/profile"),
  });

  if (!tour) return <div className="p-4 text-center text-muted-foreground pt-20">Loading tour...</div>;

  const tourData = tour.tourData as {
    title: string;
    stops: TourStop[];
    totalDurationMinutes: number;
  };
  const stops = tourData.stops || [];
  const currentStopIdx = visitedStops.size;
  const currentStop = stops[currentStopIdx];
  const nextStop = stops[currentStopIdx + 1];
  const progress = stops.length > 0 ? (visitedStops.size / stops.length) * 100 : 0;

  function markVisited() {
    setVisitedStops((prev) => new Set([...prev, currentStopIdx]));
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Location sharing banner */}
      {locationSharing && (
        <div className="bg-[#90D26D] text-white text-xs text-center py-2 font-medium">
          📍 Live location sharing is ON
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-[#3f6f60] px-4 py-3">
        <div className="flex items-center justify-between text-white mb-2">
          <button onClick={() => router.push(`/tour/${id}`)} className="text-white/80">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="text-sm font-medium">Active Tour</span>
          <Badge className="bg-white/20 text-white border-0 text-xs">{visitedStops.size}/{stops.length}</Badge>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div className="bg-[#ff8c30] h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Stop */}
        {currentStop ? (
          <Card className="border-2 border-[#ff8c30] shadow-lg">
            <CardContent className="p-4">
              <Badge className="bg-[#ff8c30] text-white border-0 mb-2">Current Stop</Badge>
              <h2 className="text-xl font-bold text-[#3f6f60] font-[family-name:var(--font-sora)]">{currentStop.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{currentStop.scheduledTime} &middot; {currentStop.durationMinutes} min</p>
              <div className="bg-[#D9EDBF]/40 rounded-lg p-3 mt-3">
                <p className="text-sm text-[#3f6f60]">💡 {currentStop.localTip}</p>
              </div>
              <Button onClick={markVisited} className="w-full mt-4 h-12 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold">
                ✓ Mark as Visited
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-[#90D26D]">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-[#3f6f60]">Tour Complete!</h2>
              <p className="text-sm text-muted-foreground mt-2">You visited all {stops.length} stops. Amazing exploration!</p>
              <Button
                onClick={() => completeMutation.mutate({ tourId: id })}
                className="mt-4 bg-[#90D26D] hover:bg-[#7bc25a] text-white rounded-xl"
              >
                Finish & Review
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Next Stop */}
        {nextStop && (
          <Card className="border-0 shadow-sm opacity-70">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                {currentStopIdx + 2}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Next up</p>
                <p className="font-medium text-sm">{nextStop.name}</p>
              </div>
              <span className="text-xs text-muted-foreground">{currentStop?.travelToNext}</span>
            </CardContent>
          </Card>
        )}

        {/* All stops */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#3f6f60] mb-3 text-sm">All stops</h3>
            {stops.map((stop, i) => (
              <div key={i} className={`flex items-center gap-2 py-2 ${i < stops.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  visitedStops.has(i) ? "bg-[#90D26D] text-white" : i === currentStopIdx ? "bg-[#ff8c30] text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {visitedStops.has(i) ? "✓" : i + 1}
                </div>
                <span className={`text-sm flex-1 ${visitedStops.has(i) ? "line-through text-muted-foreground" : ""}`}>{stop.name}</span>
                <span className="text-[10px] text-muted-foreground">{stop.scheduledTime}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => setLocationSharing(!locationSharing)}
          >
            {locationSharing ? "📍 Stop Sharing" : "📍 Share Location"}
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl text-red-500 border-red-200 hover:bg-red-50">
            🆘 Emergency
          </Button>
        </div>
      </div>
    </div>
  );
}
