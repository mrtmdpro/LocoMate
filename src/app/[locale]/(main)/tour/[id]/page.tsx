"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { HoiVanDivider } from "@/components/brand";
import { formatVndPrice } from "@/lib/format";

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

  const utils = trpc.useUtils();
  const [cancelOpen, setCancelOpen] = useState(false);
  // Fetch the refund quote only while the dialog is open so the traveler
  // sees the exact amount they'll get back before confirming.
  const { data: quote } = trpc.tour.getCancellationQuote.useQuery(
    { tourId: id },
    { enabled: cancelOpen, retry: false },
  );
  const cancelMutation = trpc.tour.cancelByTraveler.useMutation({
    onSuccess: (res) => {
      setCancelOpen(false);
      toast.success(
        res.refundVnd > 0
          ? `Booking cancelled · ${formatVndPrice(res.refundVnd)} refunded (${res.refundPct}%)`
          : "Booking cancelled. No refund applies this close to departure.",
      );
      void utils.tour.getFullTour.invalidate({ tourId: id });
      void utils.tour.getHistory.invalidate();
      router.push("/tours");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <div className="p-4"><div className="h-64 bg-muted rounded-lg animate-pulse" /></div>;

  if (!tour) {
    return (
      <div className="p-4 text-center space-y-4 pt-20">
        <p className="text-muted-foreground">Tour not accessible. You may need to complete payment first.</p>
        <Button onClick={() => router.push(`/tour/${id}/preview`)} variant="default" size="brand">
          View preview
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
      {/* Header — Locomate brand band on top, italic title, hero meta. */}
      <div className="relative overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="bg-card p-6 pb-10 relative border-b border-foreground/10">
          <button onClick={() => router.push("/tours")} className="text-muted-foreground hover:text-foreground transition-colors mb-4 relative z-10">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div className="flex flex-col gap-2 max-w-2xl">
            <Badge variant="fixed">Co-designed itinerary</Badge>
            <h1 className="text-h1 font-voice text-foreground font-normal leading-tight">{tourData.title}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span><span className="font-semibold text-foreground">{Math.round(tourData.totalDurationMinutes / 60)}h</span> total</span>
              <span><span className="font-semibold text-foreground">{tourData.stops.length}</span> stops</span>
              <span className="whitespace-nowrap"><span className="font-semibold text-brick">{formatVndPrice(tourData.estimatedCost.min).replace(" VNĐ", "")}–{formatVndPrice(tourData.estimatedCost.max)}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5 lg:max-w-3xl lg:mx-auto">
        {/* Full Timeline */}
        <Card>
          <CardContent className="p-5">
            <span className="text-eyebrow">Itinerary</span>
            <h3 className="text-h2 font-voice text-foreground font-normal mb-4 mt-1">Your complete day.</h3>
            <div className="space-y-1">
              {tourData.stops.map((stop, i) => (
                <div key={i} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    {i < tourData.stops.length - 1 && (
                      <div className="w-0.5 flex-1 bg-primary/30 mt-1 min-h-[2rem]" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-semibold text-brick">{stop.scheduledTime} · {stop.durationMinutes} min</p>
                    <h4 className="font-semibold text-foreground mt-0.5">{stop.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{stop.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{stop.category}</Badge>
                      <span className="text-xs text-muted-foreground">{stop.estimatedSpend}</span>
                    </div>
                    <div className="mt-2 bg-mustard/15 border border-mustard/30 rounded-md p-2.5">
                      <p className="text-xs text-earth"><span className="font-semibold uppercase tracking-[0.14em] text-xs mr-1.5">Local tip ·</span>{stop.localTip}</p>
                    </div>
                    {i < tourData.stops.length - 1 && (
                      <p className="text-xs text-muted-foreground mt-2">→ {stop.travelToNext}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <HoiVanDivider className="py-1" />

        {/* Why this works — the AI-as-persuasion-layer moment. */}
        <Card className="bg-primary/8 border-primary/30">
          <CardContent className="p-5">
            <span className="text-eyebrow">AI Match · explained</span>
            <h3 className="text-h3 font-voice text-brick font-normal mt-1 mb-2">Why this trip is for you.</h3>
            <p className="text-sm leading-relaxed text-foreground/85">{tourData.personalizationRationale}</p>
          </CardContent>
        </Card>
      </div>

      {/* Start Tour CTA — fixed footer with brand pill. */}
      {tour.status === "paid" && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-foreground/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2">
          <Button
            onClick={() => startMutation.mutate({ tourId: id })}
            disabled={startMutation.isPending}
            variant="default"
            size="brand"
            className="w-full h-12"
          >
            {startMutation.isPending ? "Starting…" : "Start tour"}
          </Button>
          <Button
            onClick={() => setCancelOpen(true)}
            variant="ghost"
            className="w-full h-10 text-sm text-muted-foreground hover:text-destructive"
          >
            Cancel booking
          </Button>
        </div>
      )}

      {/* Cancel confirmation — shows the computed refund BEFORE confirming. */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>
              {quote
                ? quote.refundVnd > 0
                  ? `You'll be refunded ${formatVndPrice(quote.refundVnd)} (${quote.refundPct}% of ${formatVndPrice(quote.paidVnd)}). Cancellation is final.`
                  : "This booking is within 2 hours of departure, so no refund applies. Cancellation is final."
                : "Calculating your refund…"}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Refunds: 100% more than 24h before departure · 50% within 2–24h · 0%
            under 2h.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep booking
            </Button>
            <Button
              variant="default"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ tourId: id })}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
