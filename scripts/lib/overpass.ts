const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export interface OSMPlace {
  osmId: number;
  osmType: string;
  name: string;
  nameEn?: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
  street?: string;
  cuisine?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  wikidata?: string;
  wikipedia?: string;
  operator?: string;
  description?: string;
}

const CATEGORY_QUERIES: { category: string; query: string }[] = [
  // Cafes - expanded
  { category: "cafe", query: `["amenity"="cafe"]` },
  { category: "cafe", query: `["cuisine"~"coffee"]["amenity"="restaurant"]` },
  { category: "cafe", query: `["shop"="coffee"]` },
  { category: "cafe", query: `["amenity"="ice_cream"]` },
  // Restaurants - expanded
  { category: "restaurant", query: `["amenity"="restaurant"]` },
  { category: "restaurant", query: `["amenity"="fast_food"]` },
  { category: "restaurant", query: `["amenity"="food_court"]` },
  { category: "restaurant", query: `["shop"="bakery"]` },
  { category: "restaurant", query: `["cuisine"]["amenity"="cafe"]~"noodle|pho|bun|banh"` },
  // Nightlife
  { category: "nightlife", query: `["amenity"="bar"]` },
  { category: "nightlife", query: `["amenity"="pub"]` },
  { category: "nightlife", query: `["amenity"="nightclub"]` },
  { category: "nightlife", query: `["amenity"="biergarten"]` },
  // Cultural - expanded
  { category: "cultural", query: `["tourism"="museum"]` },
  { category: "cultural", query: `["amenity"="place_of_worship"]["religion"="buddhist"]` },
  { category: "cultural", query: `["amenity"="place_of_worship"]["religion"~"taoist|confucian"]` },
  { category: "cultural", query: `["historic"="monument"]` },
  { category: "cultural", query: `["historic"="memorial"]` },
  { category: "cultural", query: `["historic"="ruins"]` },
  { category: "cultural", query: `["historic"="castle"]` },
  { category: "cultural", query: `["tourism"="attraction"]` },
  { category: "cultural", query: `["amenity"="theatre"]` },
  { category: "cultural", query: `["amenity"="library"]` },
  { category: "cultural", query: `["tourism"="viewpoint"]` },
  // Nature - expanded
  { category: "nature", query: `["leisure"="park"]` },
  { category: "nature", query: `["leisure"="garden"]` },
  { category: "nature", query: `["natural"="water"]["name"]` },
  { category: "nature", query: `["leisure"="nature_reserve"]` },
  { category: "nature", query: `["leisure"="playground"]` },
  // Art - expanded
  { category: "art", query: `["tourism"="gallery"]` },
  { category: "art", query: `["shop"="art"]` },
  { category: "art", query: `["amenity"="arts_centre"]` },
  { category: "art", query: `["shop"="photo"]` },
  // Workshop / Experience
  { category: "workshop", query: `["craft"]` },
  { category: "workshop", query: `["tourism"="information"]["information"="office"]` },
  { category: "workshop", query: `["shop"="handicraft"]` },
  { category: "workshop", query: `["amenity"="cooking_school"]` },
  { category: "workshop", query: `["leisure"="dance"]` },
];

// Hanoi bounding box (expanded: Old Quarter + West Lake + Ba Dinh + Dong Da + Hai Ba Trung)
const HANOI_BBOX = "20.96,105.76,21.10,105.92";

export async function fetchHanoiPlaces(): Promise<OSMPlace[]> {
  const allPlaces: OSMPlace[] = [];
  const seen = new Set<string>();

  for (const { category, query } of CATEGORY_QUERIES) {
    console.log(`  Querying OSM: ${category} ${query}...`);

    const overpassQuery = `
      [out:json][timeout:30];
      (
        node${query}(${HANOI_BBOX});
        way${query}(${HANOI_BBOX});
      );
      out center tags;
    `;

    try {
      const resp = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!resp.ok) {
        console.log(`    HTTP ${resp.status}, skipping`);
        continue;
      }

      const data = await resp.json();
      const elements = data.elements || [];

      for (const el of elements) {
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
          osmId: el.id,
          osmType: el.type,
          name,
          nameEn: tags["name:en"],
          category,
          latitude: lat,
          longitude: lon,
          address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:district"]].filter(Boolean).join(", ") || undefined,
          street: tags["addr:street"],
          cuisine: tags.cuisine,
          website: tags.website,
          phone: tags.phone || tags["contact:phone"],
          openingHours: tags.opening_hours,
          wikidata: tags.wikidata,
          wikipedia: tags.wikipedia,
          operator: tags.operator,
          description: tags.description || tags["description:en"],
        });
      }

      console.log(`    Found ${elements.length} raw, ${allPlaces.length} total unique`);

      // Rate limit: 5 seconds between queries to avoid 429/504
      await new Promise((r) => setTimeout(r, 5000));
    } catch (err) {
      console.log(`    Error: ${err}`);
    }
  }

  return allPlaces;
}
