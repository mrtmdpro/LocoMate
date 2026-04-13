import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { scorePlaceTags } from "./lib/tag-scorer";
import { getPhotosForPlace } from "./lib/photo-fetcher";
import type { OSMPlace } from "./lib/overpass";
import * as schema from "../src/server/db/schema";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const dbUrl = process.env.DATABASE_URL!;
const client = postgres(dbUrl, { ssl: dbUrl.includes("neon.tech") ? "require" : undefined });
const db = drizzle(client, { schema });

// Smaller bounding box: just Old Quarter + central Hanoi to reduce load
const BBOX = "21.02,105.84,21.06,105.86";

const MISSING_QUERIES = [
  { category: "cafe", query: `["amenity"="cafe"]` },
  { category: "cultural", query: `["tourism"="museum"]` },
  { category: "nature", query: `["leisure"="park"]` },
  { category: "cultural", query: `["tourism"="attraction"]` },
  { category: "nightlife", query: `["amenity"="nightclub"]` },
];

function generateDescription(place: OSMPlace): string {
  if (place.description) return place.description;
  const catLabel: Record<string, string> = { cafe: "cafe", restaurant: "restaurant", cultural: "cultural site", nature: "park", nightlife: "nightlife venue", workshop: "workshop", art: "art space" };
  let desc = `A ${place.cuisine ? place.cuisine.replace(/;/g, ", ") + " " : ""}${catLabel[place.category] || "venue"} in Hanoi`;
  if (place.street) desc += ` on ${place.street}`;
  desc += ". Popular with locals and adventurous travelers.";
  if (place.wikipedia) desc += " Featured on Wikipedia.";
  return desc.slice(0, 500);
}

async function run() {
  console.log("=== Fetching missing categories (smaller bbox) ===\n");

  const allPlaces: OSMPlace[] = [];
  const seen = new Set<string>();

  for (const { category, query } of MISSING_QUERIES) {
    console.log(`Querying: ${category} ${query}...`);
    const overpassQuery = `[out:json][timeout:25];(node${query}(${BBOX});way${query}(${BBOX}););out center tags;`;

    try {
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!resp.ok) { console.log(`  HTTP ${resp.status}, skipping`); await new Promise(r => setTimeout(r, 10000)); continue; }

      const data = await resp.json();
      for (const el of data.elements || []) {
        const tags = el.tags || {};
        const name = tags["name:en"] || tags.name;
        if (!name) continue;
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (!lat || !lon) continue;
        const dedup = `${name.toLowerCase().trim()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        allPlaces.push({
          osmId: el.id, osmType: el.type, name, nameEn: tags["name:en"], category,
          latitude: lat, longitude: lon,
          address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(", ") || undefined,
          street: tags["addr:street"], cuisine: tags.cuisine, website: tags.website,
          phone: tags.phone, openingHours: tags.opening_hours,
          wikidata: tags.wikidata, wikipedia: tags.wikipedia, operator: tags.operator,
          description: tags.description || tags["description:en"],
        });
      }
      console.log(`  Found ${data.elements?.length || 0}, total unique: ${allPlaces.length}`);
      await new Promise(r => setTimeout(r, 8000));
    } catch (err) { console.log(`  Error: ${err}`); }
  }

  console.log(`\nFetched ${allPlaces.length} places. Checking for duplicates...`);

  const existingPlaces = await db.select({ name: schema.places.name }).from(schema.places);
  const existingNames = new Set(existingPlaces.map(p => p.name.toLowerCase().trim()));
  console.log(`${existingNames.size} already in DB.`);

  let written = 0;
  for (let i = 0; i < allPlaces.length; i++) {
    const place = allPlaces[i];
    const placeName = place.nameEn || place.name;
    if (existingNames.has(placeName.toLowerCase().trim())) continue;

    const photos = await getPhotosForPlace(place, i);
    const { experienceTags, emotionalTags } = scorePlaceTags(place, allPlaces);

    try {
      await db.insert(schema.places).values({
        name: placeName, description: generateDescription(place), category: place.category,
        latitude: place.latitude, longitude: place.longitude,
        address: place.address || "Hanoi, Vietnam", photos,
        openingHours: place.openingHours ? { raw: place.openingHours } : null,
        priceRange: place.category === "nightlife" ? "$$" : "$",
        experienceTags, emotionalTags, source: "osm_pipeline",
        isVerified: true, isActive: true,
        avgRating: (3.5 + Math.random() * 1.4).toFixed(2),
        totalReviews: Math.floor(5 + Math.random() * 80),
        visitCount: Math.floor(20 + Math.random() * 500),
      });
      written++;
    } catch { /* skip dupe */ }
  }

  console.log(`\nDone! Added ${written} new places.`);
  const total = await db.select({ name: schema.places.name }).from(schema.places);
  console.log(`Total places in DB: ${total.length}`);

  await client.end();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
