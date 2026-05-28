"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";

/**
 * Leaflet needs the window object, so the map is dynamically imported with
 * ssr: false. The skeleton covers the render gap on first paint.
 */
const HostRoutesMap = dynamic(
  () => import("@/components/host/host-routes-map"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted rounded-xl animate-pulse flex items-center justify-center text-xs text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

function formatVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Host routes page. Three stacked sections:
 *   1. Stop heatmap map (radius = booking count through each stop)
 *   2. Drill-down panel for the currently selected marker
 *   3. Per-experience route accordion (mini-maps + perf summary)
 *
 * The heatmap answers "where do my tours actually happen?"; the drill-down
 * answers "who went to this specific place and was it worth the time?";
 * the accordion answers "which route is earning me the most?".
 */
export default function HostRoutesPage() {
  const { user } = useAuthStore();
  const enabled = !!user && (user.role === "host" || user.role === "admin");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const { data: heatmap, isLoading: loadingHeat } = trpc.host.getStopHeatmap.useQuery(undefined, { enabled });
  const { data: detail, isLoading: loadingDetail } = trpc.host.getStopDetail.useQuery(
    { placeId: selectedPlaceId ?? "" },
    { enabled: enabled && !!selectedPlaceId },
  );
  const { data: byExperience } = trpc.host.getRevenueByExperience.useQuery(undefined, { enabled });

  if (!enabled) {
    return (
      <div className="p-6 pb-24 text-center text-sm text-muted-foreground">
        You need to be signed in as a host to view routes.
      </div>
    );
  }

  const points = heatmap ?? [];
  const topStops = [...points]
    .sort((a, b) => Number(b.visitCount) - Number(a.visitCount))
    .slice(0, 5);

  return (
    <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-secondary">Routes</h1>
          <p className="text-xs text-muted-foreground">
            Where your tours actually happen. Click a marker to see which tours went through it.
          </p>
        </div>
        <Link href="/host" className="text-sm text-primary font-semibold">
          Back
        </Link>
      </div>

      {/* 1. Heatmap map */}
      <div className="w-full h-72 lg:h-[500px] relative">
        {loadingHeat ? (
          <div className="w-full h-full bg-muted rounded-xl animate-pulse" />
        ) : points.length === 0 ? (
          <div className="w-full h-full bg-card rounded-xl flex flex-col items-center justify-center text-center px-6 space-y-2">
            <div className="text-3xl">🗺️</div>
            <p className="text-sm font-medium text-secondary">No route data yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Once travelers book and complete your tours, the stops you visited will appear here as a heatmap.
            </p>
          </div>
        ) : (
          <HostRoutesMap
            points={points}
            onSelect={setSelectedPlaceId}
            selectedPlaceId={selectedPlaceId}
          />
        )}
      </div>

      {/* 2. Top stops list + drill-down for selected marker */}
      {points.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-secondary">
                {selectedPlaceId ? "Stop details" : "Top stops"}
              </h2>
              {selectedPlaceId && (
                <button
                  type="button"
                  onClick={() => setSelectedPlaceId(null)}
                  className="text-sm text-primary font-semibold"
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Top-5 summary when nothing selected */}
            {!selectedPlaceId && (
              <div className="space-y-1">
                {topStops.map((p) => (
                  <button
                    type="button"
                    key={p.placeId}
                    onClick={() => setSelectedPlaceId(p.placeId)}
                    className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-card transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary truncate">{p.placeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.visitCount} {Number(p.visitCount) === 1 ? "visit" : "visits"} · {p.experienceCount}{" "}
                        {Number(p.experienceCount) === 1 ? "experience" : "experiences"}
                      </p>
                    </div>
                    {p.category && (
                      <Badge className="bg-card text-foreground border-0 text-xs shrink-0">
                        {p.category}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Drill-down when a marker is selected */}
            {selectedPlaceId && loadingDetail && (
              <div className="space-y-2">
                <div className="h-5 bg-muted rounded animate-pulse w-1/3" />
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="h-10 bg-muted rounded animate-pulse" />
              </div>
            )}
            {selectedPlaceId && !loadingDetail && detail && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-secondary">{detail.place.name}</p>
                  {detail.place.category && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {detail.place.category}
                    </p>
                  )}
                </div>

                {detail.tours.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No recent tours through this stop.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-secondary/70 font-semibold">
                      Recent tours ({detail.tours.length})
                    </p>
                    {detail.tours.map((t) => (
                      <div
                        key={t.tourId}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-card transition-colors"
                      >
                        <Avatar className="w-8 h-8">
                          {t.travelerAvatar && (
                            <AvatarImage src={t.travelerAvatar} alt={t.travelerName || ""} />
                          )}
                          <AvatarFallback className="bg-primary text-white text-xs font-bold">
                            {(t.travelerName || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {t.experienceTitle || "Custom tour"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.travelerName || "Traveler"} · {formatDateShort(t.scheduledDate)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-secondary">
                            {formatVnd(t.grossVnd ?? 0)}
                          </p>
                          <Badge
                            className={
                              t.status === "completed"
                                ? "bg-muted/80 text-foreground/80 border-0 text-xs"
                                : t.status === "active"
                                  ? "bg-primary text-primary-foreground border-0 text-xs"
                                  : "bg-sage text-earth border-0 text-xs"
                            }
                          >
                            {t.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Per-experience route accordion-lite (each experience lists its
          perf summary; click-through opens the detail page). Full schedule
          / stop order is already visible on /experiences/[slug] so we don't
          duplicate it here. */}
      {byExperience && byExperience.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm text-secondary">By experience</h2>
            <div className="space-y-1">
              {byExperience.map((row) => (
                <Link
                  key={row.experienceId}
                  href={`/experiences/${row.slug}`}
                  className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-card transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.bookingCount} {row.bookingCount === 1 ? "booking" : "bookings"}
                      {row.avgRating ? ` · ${Number(row.avgRating).toFixed(1)}★` : ""}
                      {row.status !== "published" ? ` · ${row.status}` : ""}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground/40 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
