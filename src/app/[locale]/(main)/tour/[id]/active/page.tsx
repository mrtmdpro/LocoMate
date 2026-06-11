"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { IncidentSheet } from "@/components/brand";

// Leaflet needs window -- dynamic import with ssr:false matches the
// pattern used elsewhere (place-map, host-routes-map).
const ActiveTourMap = dynamic(() => import("@/components/active-tour-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted rounded-xl animate-pulse flex items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

/**
 * Raw stop shape as persisted in `tours.tour_data.stops`. Only `name` and
 * `scheduledTime` are strictly required for the main list render; the
 * remaining fields were added by the post-Apr-2026 experience.book fix
 * and may be absent on older tours. We read them defensively.
 */
interface RawTourStop {
  placeId?: string | null;
  name?: string;
  label?: string; // legacy shape from pre-fix experience.book
  time?: string; // legacy shape from pre-fix experience.book
  category?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  localTip?: string;
  travelToNext?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Normalised stop used by the UI. We merge the raw JSON snapshot with the
 * `stopLocations` array (live from `tour_stops` JOIN places) so coordinates
 * always come from the places table even when the JSON is stale.
 */
interface RenderStop {
  name: string;
  scheduledTime: string;
  durationMinutes: number;
  localTip: string;
  travelToNext: string;
  placeId: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export default function ActiveTourPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visitedStops, setVisitedStops] = useState<Set<number>>(new Set());
  const [incidentOpen, setIncidentOpen] = useState(false);

  const { data: tour, isLoading } = trpc.tour.getFullTour.useQuery({ tourId: id }, { retry: false });
  // Persist "visited" to the tour_stops row so the state survives a refresh
  // and feeds the wrap-up / re-route locus (which key off visitedAt).
  const markStopVisited = trpc.tour.markStopVisited.useMutation();
  const completeMutation = trpc.tour.completeTour.useMutation({
    // Phase A.10 — after a tour completes, route the traveller to their
    // wrap-up "Cuốn sổ ký ức số" before the review screen. The Thank-you
    // Letter cron will fire ~1h later regardless.
    onSuccess: () => router.push(`/tour/${id}/wrap-up`),
  });

  // Normalise stops into a single array the UI can trust. Handles three
  // shapes observed in production tour_data:
  //   1. Post-fix: { placeId, name, scheduledTime, latitude, longitude, ... }
  //   2. Pre-fix experience.book: { time, label } only
  //   3. Legacy tour-engine: { placeId, name, scheduledTime, ... } with no lat/lng
  // Live coordinates from tour_stops JOIN places (stopLocations) always win.
  const renderStops = useMemo<RenderStop[]>(() => {
    if (!tour) return [];
    const rawStops: RawTourStop[] = Array.isArray((tour.tourData as { stops?: unknown[] })?.stops)
      ? ((tour.tourData as { stops: RawTourStop[] }).stops)
      : [];
    const liveLocs = (tour.stopLocations ?? []) as Array<{
      stopOrder: number;
      placeName: string | null;
      category: string | null;
      latitude: number | null;
      longitude: number | null;
      address: string | null;
      placeId: string | null;
    }>;
    return rawStops.map((raw, idx) => {
      const live = liveLocs.find((l) => l.stopOrder === idx);
      return {
        name: raw.name ?? raw.label ?? live?.placeName ?? "Stop",
        scheduledTime: raw.scheduledTime ?? raw.time ?? "",
        durationMinutes: raw.durationMinutes ?? 30,
        localTip: raw.localTip ?? "",
        travelToNext: raw.travelToNext ?? "",
        placeId: live?.placeId ?? raw.placeId ?? null,
        category: live?.category ?? raw.category ?? null,
        latitude: live?.latitude ?? raw.latitude ?? null,
        longitude: live?.longitude ?? raw.longitude ?? null,
        address: live?.address ?? null,
      };
    });
  }, [tour]);

  // Map render index (== stop_order) -> tour_stops row id, so markVisited can
  // persist the right row. Older tours with no tour_stops rows simply have no
  // id here and fall back to local-only marking. (Declared before the early
  // return so hook order stays stable across renders.)
  const stopIdByIdx = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of tour?.stopLocations ?? []) m.set(l.stopOrder, l.id);
    return m;
  }, [tour]);

  // Seed visited state once from the server's persisted visitedAt timestamps
  // so a refresh mid-tour doesn't lose progress.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!tour || seededRef.current) return;
    seededRef.current = true;
    const visited = new Set<number>();
    for (const l of tour.stopLocations ?? []) {
      if (l.visitedAt) visited.add(l.stopOrder);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot seed guarded by seededRef
    if (visited.size > 0) setVisitedStops(visited);
  }, [tour]);

  if (isLoading || !tour) {
    return (
      <div className="min-h-screen bg-card">
        <div className="bg-secondary px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="h-5 w-5 bg-card/20 rounded animate-pulse" />
            <div className="h-4 w-20 bg-card/20 rounded animate-pulse" />
            <div className="h-5 w-10 bg-card/20 rounded animate-pulse" />
          </div>
          <div className="w-full bg-card/20 rounded-full h-2" />
        </div>
        <div className="p-4 space-y-4">
          <div className="h-52 bg-muted rounded-xl animate-pulse" />
          <div className="h-16 bg-muted rounded-xl animate-pulse" />
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const stops = renderStops;
  const currentStopIdx = visitedStops.size;
  const currentStop = stops[currentStopIdx];
  const nextStop = stops[currentStopIdx + 1];
  const progress = stops.length > 0 ? (visitedStops.size / stops.length) * 100 : 0;
  const stopsWithCoords = stops
    .map((s, idx) => ({ ...s, idx }))
    .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number");
  const hasMap = stopsWithCoords.length > 0;

  function markVisited() {
    const stopId = stopIdByIdx.get(currentStopIdx);
    if (stopId) markStopVisited.mutate({ stopId });
    setVisitedStops((prev) => new Set([...prev, currentStopIdx]));
  }

  return (
    <div className="min-h-screen bg-card lg:max-w-5xl lg:mx-auto">
      {/* Progress bar */}
      <div className="bg-secondary px-4 py-3 lg:rounded-none">
        <div className="flex items-center justify-between text-white mb-2">
          <button onClick={() => router.push(`/tour/${id}`)} className="text-white/80" aria-label="Back to tour preview">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="text-sm font-medium">Active Tour</span>
          <Badge className="bg-card/20 text-white border-0 text-xs">{visitedStops.size}/{stops.length}</Badge>
        </div>
        <div className="w-full bg-card/20 rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Map (only when we have at least one stop with coordinates). Positioned
          at the top of content so travelers orient themselves geographically
          before reading the stop list. */}
      {hasMap && (
        <div className="px-4 pt-4 lg:px-6 lg:pt-6">
          <div className="h-56 lg:h-72 rounded-xl overflow-hidden shadow-sm">
            <ActiveTourMap
              stops={stopsWithCoords.map((s) => ({
                idx: s.idx,
                name: s.name,
                latitude: s.latitude!,
                longitude: s.longitude!,
                category: s.category ?? "cultural",
                visited: visitedStops.has(s.idx),
                isCurrent: s.idx === currentStopIdx,
              }))}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {stopsWithCoords.length} of {stops.length} stops mapped
            {stopsWithCoords.length < stops.length && (
              <span className="ml-1">· remaining stops don&apos;t have coordinates yet</span>
            )}
          </p>
        </div>
      )}

      <div className="p-4 lg:p-6 space-y-4">
        {/* Current Stop */}
        {currentStop ? (
          <Card className="border-2 border-primary shadow-lg">
            <CardContent className="p-4">
              <Badge className="bg-primary text-primary-foreground border-0 mb-2">Current Stop</Badge>
              <h2 className="text-xl font-bold text-secondary font-heading">{currentStop.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentStop.scheduledTime || "—"}
                {currentStop.durationMinutes ? ` · ${currentStop.durationMinutes} min` : ""}
                {currentStop.address ? ` · ${currentStop.address}` : ""}
              </p>
              {currentStop.localTip && (
                <div className="bg-card/40 rounded-lg p-3 mt-3">
                  <p className="text-sm text-secondary">💡 {currentStop.localTip}</p>
                </div>
              )}
              {/* External-navigation links for the current stop, when we have
                  coordinates. Travelers on their phone can tap through to
                  Google Maps / Apple Maps for turn-by-turn directions. */}
              {currentStop.latitude != null && currentStop.longitude != null && (
                <div className="flex gap-2 mt-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${currentStop.latitude},${currentStop.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-xs font-semibold text-secondary border border-secondary/30 rounded-lg py-2 hover:bg-card transition-colors"
                  >
                    Open in Google Maps →
                  </a>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mt-4">
                <Button
                  onClick={markVisited}
                  variant="default"
                  size="brand"
                  className="w-full h-12"
                >
                  Đã ghé qua chỗ này
                </Button>
                <Button
                  variant="secondary"
                  size="brand"
                  className="h-12"
                  onClick={() => setIncidentOpen(true)}
                >
                  Báo cáo sự cố
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-[#A8C589]">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-secondary">Tour Complete!</h2>
              <p className="text-sm text-muted-foreground mt-2">You visited all {stops.length} stops. Amazing exploration!</p>
              <Button
                onClick={() => completeMutation.mutate({ tourId: id })}
                className="mt-4 bg-sage hover:bg-[#7bc25a] text-white rounded-xl"
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
              <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center text-xs font-bold text-muted-foreground">
                {currentStopIdx + 2}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Next up</p>
                <p className="font-medium text-sm">{nextStop.name}</p>
              </div>
              {currentStop?.travelToNext && (
                <span className="text-xs text-muted-foreground">{currentStop.travelToNext}</span>
              )}
            </CardContent>
          </Card>
        )}

        {/* All stops */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-secondary mb-3 text-sm">All stops</h3>
            {stops.map((stop, i) => (
              <div key={i} className={`flex items-center gap-2 py-2 ${i < stops.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  visitedStops.has(i) ? "bg-sage text-earth" : i === currentStopIdx ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {visitedStops.has(i) ? "✓" : i + 1}
                </div>
                <span className={`text-sm flex-1 ${visitedStops.has(i) ? "line-through text-muted-foreground" : ""}`}>{stop.name}</span>
                <span className="text-xs text-muted-foreground">{stop.scheduledTime}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl text-red-500 border-red-200 hover:bg-red-50" onClick={() => toast.info("Emergency: Police 113 | Ambulance 115 | Fire 114", { duration: 10000 })}>
            🆘 Emergency
          </Button>
        </div>
      </div>

      {/* Phase A.9 — Dynamic Re-routing AI mockup. Mounts here because
         the active-tour page is the canonical "I'm on the ground" surface;
         the IncidentSheet itself owns the reason picker + alternatives. */}
      <IncidentSheet
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        tourId={id}
        onPicked={(pick) => {
          // Honest framing: these are nearby backup spots the traveler can
          // walk to themselves — we surface the suggestion (no claim that the
          // itinerary was edited, which it isn't). Applying a swap to
          // tours.tourData is a later field-ops feature.
          toast(
            `${pick.place.name} · ${pick.place.walkMinutes} phút đi bộ — một gợi ý gần đây.`,
          );
        }}
      />
    </div>
  );
}
