"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Leaflet map for the active tour page. Renders a numbered pin for every
 * stop and a dashed polyline connecting them in tour order. Highlights:
 *   - "Current" stop pin is the brand orange, larger, with a pulse ring.
 *   - Visited pins are muted green with a check mark.
 *   - Upcoming pins are teal with the 1-based stop number.
 */

export interface ActiveTourStop {
  idx: number;
  name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  visited: boolean;
  isCurrent: boolean;
}

function makePinIcon(stop: ActiveTourStop): L.DivIcon {
  const label = stop.visited ? "✓" : String(stop.idx + 1);
  const bg = stop.isCurrent ? "#d94a26" : stop.visited ? "#A8C589" : "#23402b";
  const size = stop.isCurrent ? 36 : 28;
  // The outer ring on the current pin is drawn as a separate pseudo via an
  // extra div in the HTML. Kept lightweight -- no CSS keyframes needed.
  const ring = stop.isCurrent
    ? `<div style="position:absolute;inset:-6px;border-radius:9999px;border:3px solid rgba(255,140,48,0.35);"></div>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${ring}
        <div style="
          width:${size}px;height:${size}px;border-radius:9999px;background:${bg};
          color:white;font-weight:700;font-size:${stop.isCurrent ? 14 : 12}px;
          display:flex;align-items:center;justify-content:center;
          border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
        ">${label}</div>
      </div>`,
  });
}

function FitBounds({ stops }: { stops: ActiveTourStop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].latitude, stops[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(stops.map((s) => [s.latitude, s.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, stops]);
  return null;
}

export default function ActiveTourMap({ stops }: { stops: ActiveTourStop[] }) {
  const route = stops.map((s) => [s.latitude, s.longitude] as [number, number]);
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
      <FitBounds stops={stops} />

      {/* Dashed route line connecting stops in order. Zero-effort visual
          affordance that turns "a cluster of pins" into "a planned day". */}
      {route.length >= 2 && (
        <Polyline
          positions={route}
          pathOptions={{
            color: "#23402b",
            weight: 2.5,
            dashArray: "6 6",
            opacity: 0.7,
          }}
        />
      )}

      {stops.map((stop) => (
        <Marker
          key={stop.idx}
          position={[stop.latitude, stop.longitude]}
          icon={makePinIcon(stop)}
          zIndexOffset={stop.isCurrent ? 1000 : stop.visited ? 0 : 500}
        >
          <Popup closeButton={false} minWidth={160}>
            <div className="flex flex-col gap-0.5 -m-1 text-xs">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Stop {stop.idx + 1}
                {stop.isCurrent ? " · Now" : stop.visited ? " · Visited" : ""}
              </span>
              <span className="font-semibold text-secondary">{stop.name}</span>
              {stop.category && (
                <span className="text-xs text-muted-foreground capitalize">{stop.category}</span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
