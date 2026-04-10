import type { OSMPlace } from "./overpass";

// Category-specific Pexels search terms for Hanoi
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  cafe: ["hanoi cafe", "vietnamese coffee", "egg coffee hanoi", "cafe interior vietnam"],
  restaurant: ["hanoi street food", "vietnamese food", "pho hanoi", "bun cha vietnam", "banh mi"],
  cultural: ["hanoi temple", "vietnam pagoda", "hanoi old quarter", "vietnam culture", "hoan kiem lake"],
  nature: ["hanoi lake", "west lake hanoi", "vietnam nature", "hanoi park", "vietnam garden"],
  nightlife: ["hanoi nightlife", "bia hoi hanoi", "vietnam bar", "hanoi night market", "vietnam street night"],
  workshop: ["vietnam cooking class", "hanoi craft", "pottery vietnam", "vietnam workshop"],
  art: ["hanoi art gallery", "vietnam art", "street art hanoi", "vietnam museum"],
};

// Wikimedia Commons API - free, no key needed
async function searchWikimediaPhotos(query: string): Promise<string[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=3&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    const results = data.query?.search || [];
    const photos: string[] = [];
    for (const r of results) {
      const title = r.title;
      if (!title) continue;
      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
      try {
        const infoResp = await fetch(infoUrl);
        const infoData = await infoResp.json();
        const pages = infoData.query?.pages || {};
        for (const page of Object.values(pages) as { imageinfo?: { thumburl?: string; url?: string }[] }[]) {
          const img = page.imageinfo?.[0];
          if (img?.thumburl) photos.push(img.thumburl);
          else if (img?.url) photos.push(img.url);
        }
      } catch { /* skip */ }
    }
    return photos.slice(0, 2);
  } catch { return []; }
}

// Pexels-style category photo pool (pre-curated free Pexels URLs)
// These are permanent Pexels photo URLs that don't require an API key
const PEXELS_POOL: Record<string, string[]> = {
  cafe: [
    "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1813466/pexels-photo-1813466.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2074130/pexels-photo-2074130.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1024359/pexels-photo-1024359.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/894695/pexels-photo-894695.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  restaurant: [
    "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  cultural: [
    "https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2070485/pexels-photo-2070485.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2161467/pexels-photo-2161467.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2846034/pexels-photo-2846034.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3889855/pexels-photo-3889855.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  nature: [
    "https://images.pexels.com/photos/2108845/pexels-photo-2108845.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  nightlife: [
    "https://images.pexels.com/photos/2114365/pexels-photo-2114365.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1267696/pexels-photo-1267696.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1304473/pexels-photo-1304473.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  workshop: [
    "https://images.pexels.com/photos/3094218/pexels-photo-3094218.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3817497/pexels-photo-3817497.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/6267516/pexels-photo-6267516.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3094208/pexels-photo-3094208.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  art: [
    "https://images.pexels.com/photos/1509534/pexels-photo-1509534.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1266808/pexels-photo-1266808.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3004909/pexels-photo-3004909.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2372978/pexels-photo-2372978.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1674049/pexels-photo-1674049.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
};

export async function getPhotosForPlace(place: OSMPlace, index: number): Promise<string[]> {
  // Try Wikimedia first for cultural/notable places with wikidata IDs
  if (place.wikidata && (place.category === "cultural" || place.category === "nature")) {
    const wikiPhotos = await searchWikimediaPhotos(place.name + " Hanoi Vietnam");
    if (wikiPhotos.length >= 1) {
      return wikiPhotos.slice(0, 2);
    }
  }

  // Fall back to Pexels pool (category-based rotation)
  const pool = PEXELS_POOL[place.category] || PEXELS_POOL.cultural;
  const photo1 = pool[index % pool.length];
  const photo2 = pool[(index + 2) % pool.length];
  return [photo1, photo2];
}
