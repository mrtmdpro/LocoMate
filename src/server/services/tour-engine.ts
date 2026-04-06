import { db } from "../db";
import { places } from "../db/schema";
import { eq, and } from "drizzle-orm";

interface TourRequest {
  userId: string;
  date: string;
  startTime: string;
  durationHours: number;
  budgetLevel: string;
  interests: string[];
  withHost: boolean;
  groupSize: number;
}

interface TourStop {
  placeId: string;
  name: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  scheduledTime: string;
  localTip: string;
  estimatedSpend: string;
  travelToNext: string;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function generateTour(request: TourRequest, userProfile: Record<string, unknown>) {
  const allPlaces = await db
    .select()
    .from(places)
    .where(and(eq(places.isActive, true), eq(places.isVerified, true)));

  const emotionalVector = (userProfile as { emotional?: Record<string, number> }).emotional || {
    relaxation_weight: 0.5, social_weight: 0.5, exploration_weight: 0.6,
    inspiration_weight: 0.5, escapism_weight: 0.4, novelty_seeking: 0.6,
  };

  const scored = allPlaces.map((place) => {
    const expScore = cosineSimilarity(
      place.experienceTags as Record<string, number>,
      emotionalVector
    );
    const emoScore = cosineSimilarity(
      place.emotionalTags as Record<string, number>,
      emotionalVector
    );
    const interestBonus = request.interests.some((i) =>
      place.category.toLowerCase().includes(i.toLowerCase()) ||
      place.name.toLowerCase().includes(i.toLowerCase())
    ) ? 0.2 : 0;

    return { ...place, score: 0.6 * expScore + 0.4 * emoScore + interestBonus };
  });

  scored.sort((a, b) => b.score - a.score);

  const numStops = Math.ceil(request.durationHours * 1.5);
  const selected: typeof scored = [];
  const usedCategories = new Set<string>();

  for (const p of scored) {
    if (selected.length >= numStops) break;
    if (usedCategories.size < numStops - 1 && usedCategories.has(p.category)) continue;
    selected.push(p);
    usedCategories.add(p.category);
  }

  // Nearest-neighbor route optimization
  const route: typeof selected = [];
  const remaining = [...selected];
  let current = remaining.splice(0, 1)[0];
  route.push(current);

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    current = remaining.splice(nearestIdx, 1)[0];
    route.push(current);
  }

  const [hours, minutes] = request.startTime.split(":").map(Number);
  let currentMinutes = hours * 60 + minutes;
  const durationPerStop = Math.floor((request.durationHours * 60) / route.length);

  const stops: TourStop[] = route.map((place, i) => {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const scheduledTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const travelToNext = i < route.length - 1
      ? `${Math.ceil(haversineKm(place.latitude, place.longitude, route[i + 1].latitude, route[i + 1].longitude) * 4)} min walk`
      : "End of tour";

    currentMinutes += durationPerStop;

    return {
      placeId: place.id,
      name: place.name,
      category: place.category,
      description: place.description,
      latitude: place.latitude,
      longitude: place.longitude,
      durationMinutes: durationPerStop,
      scheduledTime,
      localTip: `A local favorite in ${place.category} category. Rated ${Number(place.avgRating).toFixed(1)} stars.`,
      estimatedSpend: place.priceRange || "$",
      travelToNext,
    };
  });

  const basePrice = request.withHost ? 750000 : 250000;
  const priceBySize = request.groupSize > 1 ? 1000000 : basePrice;

  return {
    title: `Your ${request.durationHours}h Hanoi Discovery`,
    description: `A personalized ${stops.length}-stop itinerary designed for your interests in ${request.interests.join(", ")}. ${request.withHost ? "Includes a local host guide." : ""}`,
    stops,
    totalDurationMinutes: request.durationHours * 60,
    estimatedCost: { min: priceBySize * 0.8, max: priceBySize * 1.2, currency: "VND" },
    personalizationRationale: `Based on your interest in ${request.interests.join(" and ")}, we optimized this route for the best ${request.interests[0] || "local"} experiences while avoiding tourist traps.`,
    priceAmount: priceBySize,
    packageType: request.withHost ? (request.groupSize > 1 ? "social_tour" : "solo_mate") : "loco_route",
  };
}
