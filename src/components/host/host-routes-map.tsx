"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Heatmap-style map for a host's tour stops. Each marker is a CircleMarker
 * whose radius scales with booking volume through that stop. Using
 * CircleMarker (SVG) instead of a DivIcon keeps the radius purely vector,
 * so zoom in / zoom out scales cleanly without bitmap sharpening artifacts.
 *
 * `bookingCount` is used both for the radius and the opacity -- more visits
 * make the marker bigger AND darker, amplifying the visual contrast between
 * a stop that was visited once and one that was visited a dozen times.
 */
export interface StopHeatmapPoint {
  placeId: string;
  placeName: string;
  category: string | null;
  latitude: number | string;
  longitude: number | string;
  visitCount: string;
  experienceCount: string;
}

function FitBounds({ points }: { points: StopHeatmapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(
      points.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

const CATEGORY_COLORS: Record<string, string> = {
  cafe: "#d94a26",
  restaurant: "#d94a26",
  cultural: "#23402b",
  nature: "#A8C589",
  nightlife: "#7c3aed",
  workshop: "#f59e0b",
  art: "#ec4899",
};

export default function HostRoutesMap({
  points,
  onSelect,
  selectedPlaceId,
}: {
  points: StopHeatmapPoint[];
  onSelect: (placeId: string) => void;
  selectedPlaceId: string | null;
}) {
  const maxVisits = useMemo(
    () => Math.max(1, ...points.map((p) => Number(p.visitCount))),
    [points],
  );

  return (
    <MapContainer
      center={[21.033, 105.85]}
      zoom={13}
      className="w-full h-full rounded-xl z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((p) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (!lat || !lng) return null;
        const visits = Number(p.visitCount);
        // Radius scales from 8 (1 visit) up to ~24 (max visits). Opacity
        // similarly tiers so sparse stops don't disappear but popular
        // stops feel heavier on the map.
        const radius = 8 + (visits / maxVisits) * 16;
        const fillOpacity = 0.35 + (visits / maxVisits) * 0.55;
        const color = CATEGORY_COLORS[p.category || ""] || "#23402b";
        const isSelected = p.placeId === selectedPlaceId;
        return (
          <CircleMarker
            key={p.placeId}
            center={[lat, lng]}
            radius={radius}
            pathOptions={{
              color: isSelected ? "#d94a26" : color,
              weight: isSelected ? 3 : 1.5,
              fillColor: color,
              fillOpacity,
            }}
            eventHandlers={{ click: () => onSelect(p.placeId) }}
          >
            <Popup closeButton={false}>
              <div className="flex flex-col gap-0.5 -m-1 text-xs">
                <span className="font-semibold text-secondary">{p.placeName}</span>
                <span className="text-xs text-muted-foreground">
                  {visits} {visits === 1 ? "visit" : "visits"} across{" "}
                  {p.experienceCount} {Number(p.experienceCount) === 1 ? "experience" : "experiences"}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
