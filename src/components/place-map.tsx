"use client";

import { useEffect } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";

const CATEGORY_COLORS: Record<string, string> = {
  cafe: "#ff8c30",
  restaurant: "#ff8c30",
  cultural: "#3f6f60",
  nature: "#90D26D",
  nightlife: "#7c3aed",
  workshop: "#f59e0b",
  art: "#ec4899",
};

function makeDivIcon(category: string) {
  const color = CATEGORY_COLORS[category] || "#3f6f60";
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  });
}

interface PlaceForMap {
  id: string;
  slug: string | null;
  name: string;
  category: string;
  latitude: number | string;
  longitude: number | string;
  photos: string[] | null;
  avgRating: string | null;
  priceRange: string | null;
}

function FitBounds({ places }: { places: PlaceForMap[] }) {
  const map = useMap();
  useEffect(() => {
    if (places.length === 0) return;
    const bounds = L.latLngBounds(
      places.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, places]);
  return null;
}

export default function PlaceMap({ places }: { places: PlaceForMap[] }) {
  return (
    <MapContainer
      center={[21.033, 105.85]}
      zoom={14}
      className="w-full h-full rounded-xl z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds places={places} />
      {places.map((place) => {
        const lat = Number(place.latitude);
        const lng = Number(place.longitude);
        if (!lat || !lng) return null;
        return (
          <Marker key={place.id} position={[lat, lng]} icon={makeDivIcon(place.category)}>
            <Popup minWidth={200} maxWidth={260} closeButton={false}>
              <div className="flex flex-col gap-1.5 -m-1">
                {place.photos?.[0] && (
                  <img
                    src={place.photos[0]}
                    alt={place.name}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#3f6f60] line-clamp-1 !m-0">{place.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge
                        className="text-[9px] px-1.5 py-0 border-0 text-white"
                        style={{ backgroundColor: CATEGORY_COLORS[place.category] || "#3f6f60" }}
                      >
                        {place.category}
                      </Badge>
                      <span className="text-[10px] text-gray-500">
                        {place.priceRange}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-yellow-500 text-xs">★</span>
                    <span className="text-xs font-bold text-[#3f6f60]">
                      {Number(place.avgRating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/explore/${place.slug || place.id}`}
                  className="block text-center text-xs font-semibold text-white bg-[#ff8c30] hover:bg-[#e67a20] rounded-lg py-1.5 mt-0.5 no-underline"
                >
                  View Place
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
