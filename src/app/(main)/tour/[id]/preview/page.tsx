"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export default function TourPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: tour, isLoading } = trpc.tour.getPreview.useQuery({ tourId: id });

  if (isLoading) return <div className="p-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (!tour) return <div className="p-4 text-center text-muted-foreground">Tour not found</div>;

  const tourData = tour.tourData as {
    title: string;
    description: string;
    stops: { name: string; category: string; scheduledTime: string; estimatedSpend: string }[];
    lockedStops: number;
    isPreview: boolean;
    estimatedCost: { min: number; max: number; currency: string };
    personalizationRationale: string;
    totalDurationMinutes: number;
  };

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3f6f60] to-[#90D26D] p-6 pb-12 relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=600&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 z-0" />
        <button onClick={() => router.back()} className="text-white/80 mb-4 relative z-10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <Badge className="bg-white/20 text-white border-0 mb-2 relative z-10">AI Generated Preview</Badge>
        <h1 className="text-2xl font-bold text-white font-heading relative z-10">{tourData.title}</h1>
        <p className="text-white/80 text-sm mt-2 relative z-10">{tourData.description}</p>
        <div className="flex gap-4 mt-4 text-white/90 text-sm relative z-10">
          <span>{Math.round(tourData.totalDurationMinutes / 60)}h duration</span>
          <span>{tourData.stops.length + tourData.lockedStops} stops</span>
        </div>
      </div>

      <div className="p-4 -mt-6 space-y-4">
        {/* Timeline Preview */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#3f6f60] mb-4">Your morning preview</h3>
            <div className="space-y-4">
              {tourData.stops.map((stop, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#ff8c30] text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    {i < tourData.stops.length - 1 && <div className="w-0.5 h-8 bg-[#ff8c30]/20 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-xs text-muted-foreground">{stop.scheduledTime}</p>
                    <p className="font-semibold text-sm text-[#3f6f60]">{stop.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{stop.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{stop.estimatedSpend}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tourData.lockedStops > 0 && (
                <div className="flex gap-3 opacity-50">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <p className="text-sm text-muted-foreground pt-1">+{tourData.lockedStops} more stops hidden. Unlock the full itinerary!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Why it fits */}
        <Card className="border-[#ff8c30]/20 bg-[#ff8c30]/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#ff8c30] mb-2">Why this fits you</h3>
            <p className="text-sm text-muted-foreground">{tourData.personalizationRationale}</p>
          </CardContent>
        </Card>

        {/* Cost */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estimated cost range</p>
              <p className="font-bold text-[#3f6f60]">
                {Math.round(tourData.estimatedCost.min / 1000)}k - {Math.round(tourData.estimatedCost.max / 1000)}k {tourData.estimatedCost.currency}
              </p>
            </div>
            <Badge className="bg-[#90D26D] text-white border-0">{tour.packageType?.replace("_", " ")}</Badge>
          </CardContent>
        </Card>

        {/* Host Upsell */}
        <Card className="border-[#3f6f60]/10 bg-[#3f6f60]/5">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#3f6f60] mb-1">Add a Local Host</h3>
            <p className="text-sm text-muted-foreground mb-3">A verified Hanoi insider to guide you through every stop.</p>
            <Button variant="outline" className="rounded-xl border-[#3f6f60] text-[#3f6f60]" onClick={() => router.push(`/tour/${id}/hosts`)}>
              Browse Hosts +500,000 VND
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={() => router.push(`/tour/${id}/checkout`)}
          className="w-full h-14 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg"
        >
          Unlock Full Itinerary — {(tour.priceAmount || 250000).toLocaleString()} VND
        </Button>
      </div>
    </div>
  );
}
