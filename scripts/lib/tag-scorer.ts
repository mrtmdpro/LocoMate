import type { OSMPlace } from "./overpass";

interface ScoredTags {
  experienceTags: Record<string, number>;
  emotionalTags: Record<string, number>;
}

const CATEGORY_EXPERIENCE_DEFAULTS: Record<string, Record<string, number>> = {
  cafe:       { duration: 0.3, indoor_outdoor: 0.85, noise_level: 0.35 },
  restaurant: { duration: 0.4, indoor_outdoor: 0.8,  noise_level: 0.5 },
  cultural:   { duration: 0.6, indoor_outdoor: 0.5,  noise_level: 0.15 },
  nature:     { duration: 0.5, indoor_outdoor: 0.1,  noise_level: 0.15 },
  nightlife:  { duration: 0.5, indoor_outdoor: 0.8,  noise_level: 0.85 },
  workshop:   { duration: 0.6, indoor_outdoor: 0.85, noise_level: 0.3 },
  art:        { duration: 0.4, indoor_outdoor: 0.85, noise_level: 0.15 },
};

const CATEGORY_EMOTIONAL_DEFAULTS: Record<string, Record<string, number>> = {
  cafe:       { relaxing: 0.7, exciting: 0.3, social: 0.5, inspiring: 0.4, immersive: 0.5, nostalgic: 0.4 },
  restaurant: { relaxing: 0.4, exciting: 0.5, social: 0.6, inspiring: 0.3, immersive: 0.6, nostalgic: 0.4 },
  cultural:   { relaxing: 0.5, exciting: 0.3, social: 0.3, inspiring: 0.85, immersive: 0.8, nostalgic: 0.8 },
  nature:     { relaxing: 0.9, exciting: 0.3, social: 0.3, inspiring: 0.7, immersive: 0.6, nostalgic: 0.5 },
  nightlife:  { relaxing: 0.2, exciting: 0.85, social: 0.9, inspiring: 0.2, immersive: 0.5, nostalgic: 0.2 },
  workshop:   { relaxing: 0.5, exciting: 0.5, social: 0.6, inspiring: 0.8, immersive: 0.85, nostalgic: 0.5 },
  art:        { relaxing: 0.6, exciting: 0.3, social: 0.3, inspiring: 0.9, immersive: 0.7, nostalgic: 0.5 },
};

const AUTHENTICITY_BASE: Record<string, number> = {
  cafe: 0.6, restaurant: 0.65, cultural: 0.85, nature: 0.75,
  nightlife: 0.5, workshop: 0.8, art: 0.7,
};

export function scorePlaceTags(place: OSMPlace, allPlaces: OSMPlace[]): ScoredTags {
  const cat = place.category;

  // Experience tags
  const authenticity = clamp((AUTHENTICITY_BASE[cat] || 0.5) + (place.wikidata ? -0.1 : 0.1) + jitter());
  const popularity = place.wikidata || place.wikipedia ? clamp(0.6 + jitter() * 2) : clamp(0.3 + jitter() * 2);

  const nearbyCount = allPlaces.filter(
    (p) => p.osmId !== place.osmId && p.category === cat && haversineKm(place.latitude, place.longitude, p.latitude, p.longitude) < 0.2
  ).length;
  const uniqueness = clamp(nearbyCount === 0 ? 0.85 : nearbyCount < 3 ? 0.6 : 0.35 + jitter());

  const priceLevel = cat === "nightlife" ? 0.5 : cat === "restaurant" ? 0.35 : cat === "cafe" ? 0.25 : 0.3;
  const accessibility = place.address ? 0.75 : 0.5;

  const defaults = CATEGORY_EXPERIENCE_DEFAULTS[cat] || CATEGORY_EXPERIENCE_DEFAULTS.cafe;

  const experienceTags = {
    authenticity: round(authenticity),
    popularity: round(popularity),
    uniqueness: round(uniqueness),
    price_level: round(clamp(priceLevel + jitter())),
    accessibility: round(clamp(accessibility + jitter())),
    duration: round(clamp(defaults.duration + jitter())),
    indoor_outdoor: round(clamp(defaults.indoor_outdoor + jitter() * 0.5)),
    noise_level: round(clamp(defaults.noise_level + jitter())),
  };

  // Emotional tags -- use description/name keywords if available, else category defaults
  const text = [place.name, place.nameEn, place.description, place.cuisine, place.operator].filter(Boolean).join(" ").toLowerCase();

  const emotionalDefaults = CATEGORY_EMOTIONAL_DEFAULTS[cat] || CATEGORY_EMOTIONAL_DEFAULTS.cafe;

  const KEYWORD_CLUSTERS: Record<string, string[]> = {
    relaxing: ["peaceful", "quiet", "chill", "calm", "serene", "relax", "tranquil", "garden", "lake", "spa"],
    exciting: ["amazing", "incredible", "fun", "lively", "energy", "adventure", "bustling", "vibrant", "popular"],
    social: ["friends", "group", "crowd", "vibe", "atmosphere", "meet", "community", "gathering", "street"],
    inspiring: ["beautiful", "stunning", "artistic", "creative", "culture", "history", "architecture", "design"],
    immersive: ["authentic", "local", "real", "experience", "hidden", "gem", "unique", "genuine", "tradition"],
    nostalgic: ["old", "traditional", "ancient", "heritage", "classic", "vintage", "historic", "colonial", "century"],
  };

  const emotionalTags: Record<string, number> = {};
  for (const [tag, keywords] of Object.entries(KEYWORD_CLUSTERS)) {
    const hits = keywords.filter((k) => text.includes(k)).length;
    const keywordScore = Math.min(1, hits / 2.5);
    const base = emotionalDefaults[tag] || 0.4;
    emotionalTags[tag] = round(clamp(base * 0.7 + keywordScore * 0.3 + jitter() * 0.5));
  }

  return { experienceTags, emotionalTags };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jitter(): number { return (Math.random() - 0.5) * 0.15; }
function clamp(v: number): number { return Math.max(0, Math.min(1, v)); }
function round(v: number): number { return Number(v.toFixed(2)); }
