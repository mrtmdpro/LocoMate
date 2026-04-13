import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";

const MIRROR = "https://overpass-api.de/api/interpreter";
const BBOX = "21.03,105.845,21.04,105.855";

const dbUrl = process.env.DATABASE_URL!;
const client = postgres(dbUrl, { ssl: dbUrl.includes("neon.tech") ? "require" : undefined });
const db = drizzle(client, { schema });

const CAFE_PHOTOS = [
  "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.pexels.com/photos/1813466/pexels-photo-1813466.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.pexels.com/photos/2074130/pexels-photo-2074130.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.pexels.com/photos/1024359/pexels-photo-1024359.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.pexels.com/photos/894695/pexels-photo-894695.jpeg?auto=compress&cs=tinysrgb&w=800",
];

async function run() {
  console.log("Fetching cafes from Overpass mirror (kumi.systems)...");

  const query = `[out:json][timeout:25];(node["amenity"="cafe"](${BBOX}););out tags;`;
  const resp = await fetch(MIRROR, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  console.log("Status:", resp.status);
  if (resp.status !== 200) {
    console.log("Mirror also failed. Try again later.");
    await client.end();
    return;
  }

  const data = await resp.json();
  const elements = data.elements || [];
  console.log("Raw cafes found:", elements.length);

  const existing = await db.select({ name: schema.places.name }).from(schema.places);
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase().trim()));
  console.log("Existing places:", existingNames.size);

  let added = 0;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const tags = el.tags || {};
    const name = tags["name:en"] || tags.name;
    if (!name || !el.lat || !el.lon) continue;
    if (existingNames.has(name.toLowerCase().trim())) continue;

    const street = tags["addr:street"];
    const desc = `A cafe in Hanoi${street ? ` on ${street}` : ""}. ${tags.cuisine ? `Serves ${tags.cuisine.replace(/;/g, ", ")}.` : ""} Popular with locals and travelers.`.trim();

    try {
      await db.insert(schema.places).values({
        name,
        description: desc.slice(0, 500),
        category: "cafe",
        latitude: el.lat,
        longitude: el.lon,
        address: [tags["addr:housenumber"], street].filter(Boolean).join(", ") || "Hanoi, Vietnam",
        photos: [CAFE_PHOTOS[i % CAFE_PHOTOS.length], CAFE_PHOTOS[(i + 2) % CAFE_PHOTOS.length]],
        priceRange: "$",
        experienceTags: {
          authenticity: Number((0.5 + Math.random() * 0.4).toFixed(2)),
          popularity: Number((0.3 + Math.random() * 0.5).toFixed(2)),
          uniqueness: Number((0.3 + Math.random() * 0.5).toFixed(2)),
          price_level: Number((0.15 + Math.random() * 0.25).toFixed(2)),
          accessibility: Number((0.6 + Math.random() * 0.3).toFixed(2)),
          duration: Number((0.2 + Math.random() * 0.2).toFixed(2)),
          indoor_outdoor: Number((0.75 + Math.random() * 0.2).toFixed(2)),
          noise_level: Number((0.25 + Math.random() * 0.25).toFixed(2)),
        },
        emotionalTags: {
          relaxing: Number((0.55 + Math.random() * 0.35).toFixed(2)),
          exciting: Number((0.15 + Math.random() * 0.25).toFixed(2)),
          social: Number((0.35 + Math.random() * 0.35).toFixed(2)),
          inspiring: Number((0.3 + Math.random() * 0.35).toFixed(2)),
          immersive: Number((0.35 + Math.random() * 0.35).toFixed(2)),
          nostalgic: Number((0.25 + Math.random() * 0.35).toFixed(2)),
        },
        source: "osm_pipeline",
        isVerified: true,
        isActive: true,
        avgRating: (3.5 + Math.random() * 1.4).toFixed(2),
        totalReviews: Math.floor(5 + Math.random() * 80),
        visitCount: Math.floor(20 + Math.random() * 500),
      });
      added++;
    } catch {
      // skip duplicate
    }
  }

  const total = await db.select({ name: schema.places.name }).from(schema.places);
  console.log(`Added ${added} cafes. Total places in DB: ${total.length}`);

  await client.end();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
