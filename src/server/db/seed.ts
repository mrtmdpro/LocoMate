import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { slugify } from "../../lib/slugify";

const dbUrl = process.env.DATABASE_URL!;
const client = postgres(dbUrl, {
  ssl: dbUrl.includes("neon.tech") ? "require" : undefined,
});
const db = drizzle(client, { schema });

interface PlaceSeed {
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  priceRange: string;
  photos?: string[];
  experienceTags: Record<string, number>;
  emotionalTags: Record<string, number>;
}

const PHOTOS_BY_CATEGORY: Record<string, string[]> = {
  cafe: [
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&h=500&fit=crop",
  ],
  restaurant: [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1562565651-7d4948f339eb?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop",
  ],
  cultural: [
    "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1555921015-5532091f6026?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1592364395653-83e648b20cc2?w=800&h=500&fit=crop",
  ],
  nature: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=500&fit=crop",
  ],
  nightlife: [
    "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&h=500&fit=crop",
  ],
  workshop: [
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1504387432042-8aca549e4729?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=500&fit=crop",
  ],
  art: [
    "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1541367777708-7905fe3296c0?w=800&h=500&fit=crop",
  ],
};

function getPhotosForCategory(category: string, index: number): string[] {
  const pool = PHOTOS_BY_CATEGORY[category] || PHOTOS_BY_CATEGORY.cultural;
  const photo1 = pool[index % pool.length];
  const photo2 = pool[(index + 3) % pool.length];
  return [photo1, photo2];
}

const HANOI_PLACES: PlaceSeed[] = [
  // ===== CAFE =====
  { name: "Egg Coffee at Giang Cafe", description: "The original egg coffee since 1946. A tiny alley cafe with the richest, creamiest ca phe trung in the city.", category: "cafe", latitude: 21.0340, longitude: 105.8520, address: "39 Nguyen Huu Huan, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.85, uniqueness: 0.9, price_level: 0.2, accessibility: 0.6, duration: 0.3, indoor_outdoor: 0.9, noise_level: 0.4 }, emotionalTags: { relaxing: 0.8, exciting: 0.3, social: 0.5, inspiring: 0.7, immersive: 0.8, nostalgic: 0.9 } },
  { name: "Loading T Cafe", description: "Trendy rooftop cafe overlooking Hoan Kiem Lake with Instagrammable interiors.", category: "cafe", latitude: 21.0285, longitude: 105.8522, address: "8 Chan Cam, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.5, popularity: 0.8, uniqueness: 0.6, price_level: 0.5, accessibility: 0.8, duration: 0.4, indoor_outdoor: 0.5, noise_level: 0.3 }, emotionalTags: { relaxing: 0.7, exciting: 0.4, social: 0.7, inspiring: 0.6, immersive: 0.5, nostalgic: 0.2 } },
  { name: "Cong Caphe", description: "Military-themed cafe chain with Vietnamese coconut coffee, hammocks, and vintage decor.", category: "cafe", latitude: 21.0333, longitude: 105.8510, address: "152 Trieu Viet Vuong, Hai Ba Trung", priceRange: "$", experienceTags: { authenticity: 0.7, popularity: 0.9, uniqueness: 0.7, price_level: 0.3, accessibility: 0.9, duration: 0.4, indoor_outdoor: 0.8, noise_level: 0.4 }, emotionalTags: { relaxing: 0.7, exciting: 0.3, social: 0.6, inspiring: 0.5, immersive: 0.7, nostalgic: 0.8 } },
  { name: "Train Street Coffee", description: "Sit inches from the railway tracks and sip coffee as the train passes. Pure adrenaline and atmosphere.", category: "cafe", latitude: 21.0237, longitude: 105.8440, address: "Train Street, Ngo 224 Le Duan", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.95, uniqueness: 0.99, price_level: 0.2, accessibility: 0.4, duration: 0.3, indoor_outdoor: 0.3, noise_level: 0.8 }, emotionalTags: { relaxing: 0.2, exciting: 0.99, social: 0.7, inspiring: 0.8, immersive: 0.95, nostalgic: 0.6 } },
  { name: "The Note Coffee", description: "Walls covered with sticky notes from travelers worldwide. Great views of the Old Quarter streets.", category: "cafe", latitude: 21.0328, longitude: 105.8498, address: "64 Luong Van Can, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.6, popularity: 0.85, uniqueness: 0.8, price_level: 0.3, accessibility: 0.7, duration: 0.3, indoor_outdoor: 0.8, noise_level: 0.5 }, emotionalTags: { relaxing: 0.5, exciting: 0.5, social: 0.9, inspiring: 0.7, immersive: 0.6, nostalgic: 0.5 } },
  { name: "Hidden Alley Cafe 56", description: "A secret cafe tucked behind a narrow alley door in the Old Quarter. Find it by the faded blue sign.", category: "cafe", latitude: 21.0345, longitude: 105.8508, address: "56 Hang Buom, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.3, uniqueness: 0.95, price_level: 0.2, accessibility: 0.3, duration: 0.4, indoor_outdoor: 0.8, noise_level: 0.2 }, emotionalTags: { relaxing: 0.9, exciting: 0.4, social: 0.3, inspiring: 0.8, immersive: 0.9, nostalgic: 0.85 } },
  { name: "Hanoi Social Club", description: "Creative co-working cafe with live music, art exhibitions, and healthy brunch options.", category: "cafe", latitude: 21.0268, longitude: 105.8532, address: "6 Hoi Vu, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.6, popularity: 0.7, uniqueness: 0.7, price_level: 0.5, accessibility: 0.7, duration: 0.5, indoor_outdoor: 0.9, noise_level: 0.5 }, emotionalTags: { relaxing: 0.6, exciting: 0.5, social: 0.9, inspiring: 0.8, immersive: 0.6, nostalgic: 0.3 } },
  { name: "Blackbird Coffee", description: "Third-wave specialty coffee with meticulous pour-overs and single-origin beans.", category: "cafe", latitude: 21.0290, longitude: 105.8480, address: "5 Chan Cam, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.5, popularity: 0.6, uniqueness: 0.6, price_level: 0.5, accessibility: 0.8, duration: 0.3, indoor_outdoor: 0.9, noise_level: 0.3 }, emotionalTags: { relaxing: 0.8, exciting: 0.2, social: 0.4, inspiring: 0.5, immersive: 0.4, nostalgic: 0.2 } },
  // ===== RESTAURANT / STREET FOOD =====
  { name: "Bun Cha Huong Lien (Obama Bun Cha)", description: "The exact spot where Anthony Bourdain and President Obama shared bun cha. Still $2 for the best in town.", category: "restaurant", latitude: 21.0180, longitude: 105.8490, address: "24 Le Van Huu, Hai Ba Trung", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.99, uniqueness: 0.85, price_level: 0.15, accessibility: 0.8, duration: 0.3, indoor_outdoor: 0.8, noise_level: 0.7 }, emotionalTags: { relaxing: 0.3, exciting: 0.7, social: 0.6, inspiring: 0.5, immersive: 0.8, nostalgic: 0.7 } },
  { name: "Pho Thin", description: "Legendary pho bo since 1979. The broth is seared with beef fat for an unforgettable depth of flavor.", category: "restaurant", latitude: 21.0218, longitude: 105.8498, address: "13 Lo Duc, Hai Ba Trung", priceRange: "$", experienceTags: { authenticity: 0.98, popularity: 0.9, uniqueness: 0.85, price_level: 0.15, accessibility: 0.7, duration: 0.2, indoor_outdoor: 0.8, noise_level: 0.6 }, emotionalTags: { relaxing: 0.4, exciting: 0.5, social: 0.5, inspiring: 0.4, immersive: 0.85, nostalgic: 0.9 } },
  { name: "Banh Mi 25", description: "Consistently ranked among the world's best banh mi. Crusty baguette, pate, herbs, and chili.", category: "restaurant", latitude: 21.0332, longitude: 105.8492, address: "25 Hang Ca, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.92, uniqueness: 0.7, price_level: 0.1, accessibility: 0.9, duration: 0.15, indoor_outdoor: 0.3, noise_level: 0.5 }, emotionalTags: { relaxing: 0.3, exciting: 0.5, social: 0.4, inspiring: 0.3, immersive: 0.6, nostalgic: 0.5 } },
  { name: "Cha Ca La Vong", description: "Hanoi's most famous single-dish restaurant since 1871. Turmeric fish sizzled tableside with dill and herbs.", category: "restaurant", latitude: 21.0350, longitude: 105.8485, address: "14 Cha Ca, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.99, popularity: 0.85, uniqueness: 0.95, price_level: 0.4, accessibility: 0.7, duration: 0.4, indoor_outdoor: 0.9, noise_level: 0.5 }, emotionalTags: { relaxing: 0.5, exciting: 0.6, social: 0.6, inspiring: 0.7, immersive: 0.9, nostalgic: 0.95 } },
  { name: "Bun Dau Mam Tom Alley", description: "Street-side tofu and shrimp paste stall in a narrow alley. The authentic Hanoi smell-and-taste experience.", category: "restaurant", latitude: 21.0318, longitude: 105.8525, address: "Hang Bac Alley, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.99, popularity: 0.5, uniqueness: 0.85, price_level: 0.1, accessibility: 0.4, duration: 0.3, indoor_outdoor: 0.3, noise_level: 0.6 }, emotionalTags: { relaxing: 0.2, exciting: 0.7, social: 0.5, inspiring: 0.4, immersive: 0.95, nostalgic: 0.7 } },
  { name: "Xoi Yen", description: "Sticky rice with toppings from pate to fried onion. A local breakfast institution in the Old Quarter.", category: "restaurant", latitude: 21.0344, longitude: 105.8502, address: "35B Nguyen Huu Huan, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.7, uniqueness: 0.6, price_level: 0.1, accessibility: 0.8, duration: 0.15, indoor_outdoor: 0.7, noise_level: 0.5 }, emotionalTags: { relaxing: 0.4, exciting: 0.3, social: 0.4, inspiring: 0.3, immersive: 0.7, nostalgic: 0.8 } },
  { name: "Nem Ran Hang Bo", description: "Deep-fried spring rolls served at a plastic-stool corner stall. Crispy, golden, and addictive.", category: "restaurant", latitude: 21.0338, longitude: 105.8515, address: "2 Hang Bo, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.6, uniqueness: 0.5, price_level: 0.1, accessibility: 0.7, duration: 0.15, indoor_outdoor: 0.2, noise_level: 0.6 }, emotionalTags: { relaxing: 0.3, exciting: 0.5, social: 0.5, inspiring: 0.2, immersive: 0.7, nostalgic: 0.5 } },
  { name: "Quan An Ngon", description: "Elegant courtyard restaurant recreating the best Hanoi street food under one roof. Great for nervous first-timers.", category: "restaurant", latitude: 21.0255, longitude: 105.8448, address: "18 Phan Boi Chau, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.6, popularity: 0.85, uniqueness: 0.5, price_level: 0.4, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.7, noise_level: 0.5 }, emotionalTags: { relaxing: 0.7, exciting: 0.3, social: 0.7, inspiring: 0.4, immersive: 0.5, nostalgic: 0.4 } },
  { name: "Pho Gia Truyen Bat Dan", description: "Queue up with the locals at 6AM for the most argued-about bowl of pho in Hanoi. Cash only.", category: "restaurant", latitude: 21.0339, longitude: 105.8465, address: "49 Bat Dan, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.99, popularity: 0.95, uniqueness: 0.8, price_level: 0.1, accessibility: 0.5, duration: 0.2, indoor_outdoor: 0.7, noise_level: 0.7 }, emotionalTags: { relaxing: 0.2, exciting: 0.6, social: 0.5, inspiring: 0.4, immersive: 0.9, nostalgic: 0.95 } },
  { name: "Com Suon Tong Duy Tan", description: "Best broken rice with pork chop in Hanoi. A perfect $1.50 lunch among office workers.", category: "restaurant", latitude: 21.0267, longitude: 105.8370, address: "56 Tong Duy Tan, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.5, uniqueness: 0.4, price_level: 0.1, accessibility: 0.7, duration: 0.2, indoor_outdoor: 0.7, noise_level: 0.5 }, emotionalTags: { relaxing: 0.4, exciting: 0.2, social: 0.3, inspiring: 0.2, immersive: 0.6, nostalgic: 0.5 } },
  // ===== CULTURAL =====
  { name: "Temple of Literature", description: "Vietnam's first university, founded in 1070. Serene courtyards, turtle steles, and 1000 years of scholarly history.", category: "cultural", latitude: 21.0285, longitude: 105.8357, address: "58 Quoc Tu Giam, Dong Da", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.9, uniqueness: 0.8, price_level: 0.2, accessibility: 0.9, duration: 0.6, indoor_outdoor: 0.3, noise_level: 0.2 }, emotionalTags: { relaxing: 0.8, exciting: 0.2, social: 0.3, inspiring: 0.95, immersive: 0.85, nostalgic: 0.9 } },
  { name: "Ho Chi Minh Mausoleum", description: "The preserved body of Ho Chi Minh in a grand marble mausoleum. A solemn pilgrimage site.", category: "cultural", latitude: 21.0369, longitude: 105.8344, address: "8 Hung Vuong, Ba Dinh", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.95, uniqueness: 0.85, price_level: 0.05, accessibility: 0.8, duration: 0.4, indoor_outdoor: 0.5, noise_level: 0.1 }, emotionalTags: { relaxing: 0.3, exciting: 0.3, social: 0.2, inspiring: 0.8, immersive: 0.7, nostalgic: 0.8 } },
  { name: "Hoan Kiem Lake & Ngoc Son Temple", description: "The heart of Hanoi. Walk the red Huc Bridge to the island temple, then circle the lake at sunset.", category: "cultural", latitude: 21.0288, longitude: 105.8525, address: "Dinh Tien Hoang, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.95, uniqueness: 0.75, price_level: 0.15, accessibility: 0.95, duration: 0.5, indoor_outdoor: 0.2, noise_level: 0.3 }, emotionalTags: { relaxing: 0.9, exciting: 0.3, social: 0.6, inspiring: 0.8, immersive: 0.7, nostalgic: 0.8 } },
  { name: "Old Quarter 36 Streets Walk", description: "Each street named after the goods once sold there. Silver, silk, paper, tin. Get lost on purpose.", category: "cultural", latitude: 21.0340, longitude: 105.8500, address: "Old Quarter, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.85, uniqueness: 0.8, price_level: 0.05, accessibility: 0.9, duration: 0.6, indoor_outdoor: 0.1, noise_level: 0.7 }, emotionalTags: { relaxing: 0.4, exciting: 0.7, social: 0.7, inspiring: 0.8, immersive: 0.95, nostalgic: 0.9 } },
  { name: "Hanoi Opera House", description: "A stunning French colonial opera house built in 1911. Attend a water puppet show or just admire the facade at night.", category: "cultural", latitude: 21.0241, longitude: 105.8580, address: "1 Trang Tien, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.85, popularity: 0.8, uniqueness: 0.75, price_level: 0.4, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.7, noise_level: 0.3 }, emotionalTags: { relaxing: 0.7, exciting: 0.5, social: 0.5, inspiring: 0.9, immersive: 0.7, nostalgic: 0.85 } },
  { name: "Thang Long Water Puppet Theatre", description: "Traditional Vietnamese water puppetry with live orchestra. A must-see unique art form dating back 1000 years.", category: "cultural", latitude: 21.0315, longitude: 105.8530, address: "57B Dinh Tien Hoang, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.9, uniqueness: 0.95, price_level: 0.25, accessibility: 0.9, duration: 0.4, indoor_outdoor: 0.9, noise_level: 0.5 }, emotionalTags: { relaxing: 0.6, exciting: 0.7, social: 0.5, inspiring: 0.9, immersive: 0.9, nostalgic: 0.85 } },
  { name: "Bach Ma Temple", description: "The oldest temple in the Old Quarter, guarding the eastern gate of ancient Thang Long citadel since 1010 AD.", category: "cultural", latitude: 21.0355, longitude: 105.8505, address: "76 Hang Buom, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.98, popularity: 0.5, uniqueness: 0.8, price_level: 0.05, accessibility: 0.7, duration: 0.3, indoor_outdoor: 0.7, noise_level: 0.2 }, emotionalTags: { relaxing: 0.7, exciting: 0.2, social: 0.2, inspiring: 0.8, immersive: 0.8, nostalgic: 0.95 } },
  { name: "Tran Quoc Pagoda", description: "The oldest Buddhist temple in Hanoi, built in the 6th century on an island in West Lake. Spectacular at sunset.", category: "cultural", latitude: 21.0480, longitude: 105.8360, address: "Thanh Nien Road, Tay Ho", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.75, uniqueness: 0.85, price_level: 0.05, accessibility: 0.7, duration: 0.3, indoor_outdoor: 0.3, noise_level: 0.1 }, emotionalTags: { relaxing: 0.95, exciting: 0.2, social: 0.2, inspiring: 0.95, immersive: 0.85, nostalgic: 0.9 } },
  { name: "Hoa Lo Prison Museum", description: "The infamous 'Hanoi Hilton' where American POWs were held. Haunting, educational, and surprisingly moving.", category: "cultural", latitude: 21.0254, longitude: 105.8468, address: "1 Hoa Lo, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.8, uniqueness: 0.85, price_level: 0.15, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.8, noise_level: 0.2 }, emotionalTags: { relaxing: 0.1, exciting: 0.3, social: 0.2, inspiring: 0.7, immersive: 0.9, nostalgic: 0.85 } },
  { name: "Imperial Citadel of Thang Long", description: "UNESCO World Heritage site. 1000 years of Vietnamese royal history excavated layer by layer.", category: "cultural", latitude: 21.0356, longitude: 105.8398, address: "18 Hoang Dieu, Ba Dinh", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.7, uniqueness: 0.85, price_level: 0.15, accessibility: 0.8, duration: 0.6, indoor_outdoor: 0.4, noise_level: 0.2 }, emotionalTags: { relaxing: 0.6, exciting: 0.3, social: 0.3, inspiring: 0.9, immersive: 0.85, nostalgic: 0.95 } },
  // ===== NATURE =====
  { name: "West Lake Sunset Cycle", description: "Rent a bicycle and circle Tay Ho at golden hour. 17km of lakeside paths with lotus fields and pagodas.", category: "nature", latitude: 21.0530, longitude: 105.8290, address: "West Lake, Tay Ho", priceRange: "$", experienceTags: { authenticity: 0.8, popularity: 0.7, uniqueness: 0.7, price_level: 0.15, accessibility: 0.8, duration: 0.6, indoor_outdoor: 0.05, noise_level: 0.2 }, emotionalTags: { relaxing: 0.95, exciting: 0.4, social: 0.3, inspiring: 0.8, immersive: 0.7, nostalgic: 0.6 } },
  { name: "Botanical Garden of Hanoi", description: "A peaceful green oasis near the mausoleum. Banyan trees, ponds, and families doing tai chi at dawn.", category: "nature", latitude: 21.0398, longitude: 105.8365, address: "3 Hoang Hoa Tham, Ba Dinh", priceRange: "$", experienceTags: { authenticity: 0.7, popularity: 0.5, uniqueness: 0.5, price_level: 0.05, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.05, noise_level: 0.1 }, emotionalTags: { relaxing: 0.95, exciting: 0.1, social: 0.3, inspiring: 0.6, immersive: 0.6, nostalgic: 0.5 } },
  { name: "Truc Bach Lake Morning Walk", description: "Smaller and more intimate than West Lake. Watch locals fish, swim, and exercise at 5:30 AM.", category: "nature", latitude: 21.0430, longitude: 105.8405, address: "Truc Bach Lake, Ba Dinh", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.4, uniqueness: 0.6, price_level: 0.05, accessibility: 0.8, duration: 0.3, indoor_outdoor: 0.05, noise_level: 0.2 }, emotionalTags: { relaxing: 0.9, exciting: 0.2, social: 0.4, inspiring: 0.6, immersive: 0.7, nostalgic: 0.7 } },
  // ===== NIGHTLIFE =====
  { name: "Bia Hoi Corner", description: "The cheapest fresh beer in the world at 25 cents a glass. Plastic stools, people-watching, and instant friends.", category: "nightlife", latitude: 21.0340, longitude: 105.8530, address: "Ta Hien & Luong Ngoc Quyen, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.95, uniqueness: 0.8, price_level: 0.05, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.1, noise_level: 0.9 }, emotionalTags: { relaxing: 0.5, exciting: 0.9, social: 0.99, inspiring: 0.3, immersive: 0.9, nostalgic: 0.6 } },
  { name: "Tadioto Cocktail Bar", description: "Intimate literary cocktail bar in a colonial building. Named after the word for 'taxi' in old Vietnamese.", category: "nightlife", latitude: 21.0265, longitude: 105.8522, address: "24 Tong Dan, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.7, popularity: 0.6, uniqueness: 0.8, price_level: 0.6, accessibility: 0.7, duration: 0.5, indoor_outdoor: 0.9, noise_level: 0.3 }, emotionalTags: { relaxing: 0.8, exciting: 0.4, social: 0.6, inspiring: 0.7, immersive: 0.7, nostalgic: 0.7 } },
  { name: "Polite Pub", description: "A beloved Old Quarter dive bar where travelers and locals mix over cheap drinks and loud music.", category: "nightlife", latitude: 21.0338, longitude: 105.8520, address: "5 Bao Khanh, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.7, popularity: 0.8, uniqueness: 0.5, price_level: 0.2, accessibility: 0.9, duration: 0.5, indoor_outdoor: 0.8, noise_level: 0.9 }, emotionalTags: { relaxing: 0.2, exciting: 0.85, social: 0.95, inspiring: 0.2, immersive: 0.6, nostalgic: 0.3 } },
  { name: "The Alchemist Cocktail Bar", description: "Craft cocktails using local Vietnamese ingredients — pho-infused gin, lemongrass bitters, kumquat sour.", category: "nightlife", latitude: 21.0282, longitude: 105.8505, address: "3 Ngo Bao Khanh, Hoan Kiem", priceRange: "$$$", experienceTags: { authenticity: 0.6, popularity: 0.5, uniqueness: 0.9, price_level: 0.7, accessibility: 0.7, duration: 0.5, indoor_outdoor: 0.9, noise_level: 0.3 }, emotionalTags: { relaxing: 0.7, exciting: 0.6, social: 0.6, inspiring: 0.7, immersive: 0.6, nostalgic: 0.2 } },
  { name: "Rooftop at Lotte Center", description: "65th-floor observation deck and sky bar with panoramic views of all Hanoi. Best at sunset.", category: "nightlife", latitude: 21.0152, longitude: 105.8015, address: "54 Lieu Giai, Ba Dinh", priceRange: "$$$", experienceTags: { authenticity: 0.3, popularity: 0.7, uniqueness: 0.7, price_level: 0.8, accessibility: 0.8, duration: 0.4, indoor_outdoor: 0.5, noise_level: 0.3 }, emotionalTags: { relaxing: 0.7, exciting: 0.7, social: 0.6, inspiring: 0.8, immersive: 0.5, nostalgic: 0.1 } },
  // ===== WORKSHOP / EXPERIENCE =====
  { name: "Vietnamese Cooking Class at KOTO", description: "Learn to make pho, spring rolls, and banh cuon with at-risk youth trained as chefs. Meaningful and delicious.", category: "workshop", latitude: 21.0310, longitude: 105.8470, address: "59 Van Mieu, Dong Da", priceRange: "$$", experienceTags: { authenticity: 0.85, popularity: 0.7, uniqueness: 0.8, price_level: 0.5, accessibility: 0.8, duration: 0.7, indoor_outdoor: 0.9, noise_level: 0.4 }, emotionalTags: { relaxing: 0.6, exciting: 0.6, social: 0.8, inspiring: 0.9, immersive: 0.9, nostalgic: 0.4 } },
  { name: "Dong Ho Woodblock Printing", description: "Try your hand at traditional folk art woodblock printing in a family workshop outside Hanoi.", category: "workshop", latitude: 21.0950, longitude: 106.0700, address: "Dong Ho Village, Bac Ninh", priceRange: "$$", experienceTags: { authenticity: 0.99, popularity: 0.3, uniqueness: 0.95, price_level: 0.4, accessibility: 0.3, duration: 0.7, indoor_outdoor: 0.7, noise_level: 0.2 }, emotionalTags: { relaxing: 0.7, exciting: 0.4, social: 0.5, inspiring: 0.95, immersive: 0.95, nostalgic: 0.9 } },
  { name: "Lacquerware Workshop", description: "Learn the centuries-old Vietnamese lacquer technique in a small Hoan Kiem studio.", category: "workshop", latitude: 21.0298, longitude: 105.8490, address: "12 Nha Chung, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.9, popularity: 0.4, uniqueness: 0.9, price_level: 0.5, accessibility: 0.7, duration: 0.6, indoor_outdoor: 0.9, noise_level: 0.2 }, emotionalTags: { relaxing: 0.8, exciting: 0.3, social: 0.4, inspiring: 0.9, immersive: 0.9, nostalgic: 0.7 } },
  { name: "Pottery Village Bat Trang", description: "800-year-old ceramic village where you can mold, glaze, and fire your own pottery.", category: "workshop", latitude: 21.0020, longitude: 105.9100, address: "Bat Trang, Gia Lam", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.7, uniqueness: 0.85, price_level: 0.25, accessibility: 0.5, duration: 0.7, indoor_outdoor: 0.5, noise_level: 0.3 }, emotionalTags: { relaxing: 0.7, exciting: 0.5, social: 0.5, inspiring: 0.85, immersive: 0.9, nostalgic: 0.85 } },
  // ===== ART / GALLERY =====
  { name: "Vietnam Fine Arts Museum", description: "Stunning colonial building housing centuries of Vietnamese art from lacquer to silk to oil.", category: "art", latitude: 21.0278, longitude: 105.8360, address: "66 Nguyen Thai Hoc, Ba Dinh", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.6, uniqueness: 0.7, price_level: 0.15, accessibility: 0.8, duration: 0.5, indoor_outdoor: 0.9, noise_level: 0.1 }, emotionalTags: { relaxing: 0.8, exciting: 0.3, social: 0.2, inspiring: 0.95, immersive: 0.8, nostalgic: 0.7 } },
  { name: "Manzi Art Space", description: "Contemporary art gallery and bar in a restored French villa. Rotating exhibitions and artist talks.", category: "art", latitude: 21.0270, longitude: 105.8408, address: "14 Phan Huy Ich, Ba Dinh", priceRange: "$$", experienceTags: { authenticity: 0.7, popularity: 0.4, uniqueness: 0.8, price_level: 0.4, accessibility: 0.7, duration: 0.4, indoor_outdoor: 0.8, noise_level: 0.2 }, emotionalTags: { relaxing: 0.7, exciting: 0.4, social: 0.5, inspiring: 0.9, immersive: 0.7, nostalgic: 0.4 } },
  { name: "Ceramic Road along Red River", description: "A 4km mosaic mural along the dyke made from ceramic tiles. The longest ceramic wall in the world.", category: "art", latitude: 21.0385, longitude: 105.8530, address: "Red River Dyke, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.5, uniqueness: 0.9, price_level: 0.05, accessibility: 0.7, duration: 0.4, indoor_outdoor: 0.05, noise_level: 0.3 }, emotionalTags: { relaxing: 0.6, exciting: 0.4, social: 0.3, inspiring: 0.85, immersive: 0.7, nostalgic: 0.6 } },
  // ===== MORE HIDDEN GEMS (to reach 200+) =====
  { name: "Secret Garden Rooftop", description: "Hidden rooftop garden above a nondescript building. Vietnamese home cooking with panoramic Old Quarter views.", category: "restaurant", latitude: 21.0328, longitude: 105.8515, address: "Top floor, 158 Hang Bong, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.85, popularity: 0.5, uniqueness: 0.85, price_level: 0.4, accessibility: 0.4, duration: 0.5, indoor_outdoor: 0.3, noise_level: 0.3 }, emotionalTags: { relaxing: 0.8, exciting: 0.4, social: 0.5, inspiring: 0.7, immersive: 0.8, nostalgic: 0.5 } },
  { name: "Long Bien Bridge Walk", description: "Walk the century-old French iron bridge at dawn. Motorbikes, trains, and the Red River delta below.", category: "cultural", latitude: 21.0430, longitude: 105.8570, address: "Long Bien Bridge, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.6, uniqueness: 0.8, price_level: 0.05, accessibility: 0.6, duration: 0.4, indoor_outdoor: 0.05, noise_level: 0.6 }, emotionalTags: { relaxing: 0.5, exciting: 0.7, social: 0.3, inspiring: 0.8, immersive: 0.85, nostalgic: 0.9 } },
  { name: "Bun Bo Nam Bo 67", description: "The definitive dry beef noodle bowl in Hanoi. Queue up on Hang Dieu for the sweet, tangy, nutty perfection.", category: "restaurant", latitude: 21.0360, longitude: 105.8540, address: "67 Hang Dieu, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.8, uniqueness: 0.7, price_level: 0.1, accessibility: 0.7, duration: 0.2, indoor_outdoor: 0.7, noise_level: 0.6 }, emotionalTags: { relaxing: 0.3, exciting: 0.5, social: 0.4, inspiring: 0.3, immersive: 0.7, nostalgic: 0.6 } },
  { name: "Quang Ba Flower Market (Night)", description: "Hanoi's wholesale flower market comes alive at 2AM. Mountains of lotus, roses, and chrysanthemums under harsh lights.", category: "nature", latitude: 21.0690, longitude: 105.8220, address: "Quang Ba, Tay Ho", priceRange: "$", experienceTags: { authenticity: 0.95, popularity: 0.4, uniqueness: 0.9, price_level: 0.1, accessibility: 0.4, duration: 0.4, indoor_outdoor: 0.2, noise_level: 0.6 }, emotionalTags: { relaxing: 0.3, exciting: 0.8, social: 0.5, inspiring: 0.85, immersive: 0.95, nostalgic: 0.6 } },
  { name: "St. Joseph's Cathedral", description: "Neo-Gothic cathedral built in 1886. The facade feels like Paris; step inside for stained glass quiet.", category: "cultural", latitude: 21.0287, longitude: 105.8482, address: "40 Nha Chung, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.75, uniqueness: 0.7, price_level: 0.05, accessibility: 0.9, duration: 0.3, indoor_outdoor: 0.7, noise_level: 0.1 }, emotionalTags: { relaxing: 0.8, exciting: 0.2, social: 0.3, inspiring: 0.8, immersive: 0.7, nostalgic: 0.8 } },
  { name: "Dong Xuan Night Market", description: "Friday-to-Sunday night market with food stalls, clothes, and live music. Peak Old Quarter chaos.", category: "nightlife", latitude: 21.0387, longitude: 105.8500, address: "Hang Khoai, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.8, popularity: 0.85, uniqueness: 0.6, price_level: 0.2, accessibility: 0.8, duration: 0.5, indoor_outdoor: 0.2, noise_level: 0.9 }, emotionalTags: { relaxing: 0.2, exciting: 0.9, social: 0.9, inspiring: 0.4, immersive: 0.85, nostalgic: 0.5 } },
  { name: "Hoan Kiem Walking Street Weekend", description: "Cars banned around the lake every weekend evening. Street performers, families, and the best people-watching in Asia.", category: "cultural", latitude: 21.0295, longitude: 105.8530, address: "Hoan Kiem Lake, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.85, popularity: 0.9, uniqueness: 0.7, price_level: 0.05, accessibility: 0.95, duration: 0.5, indoor_outdoor: 0.05, noise_level: 0.7 }, emotionalTags: { relaxing: 0.6, exciting: 0.8, social: 0.9, inspiring: 0.6, immersive: 0.8, nostalgic: 0.5 } },
  { name: "Museum of Ethnology", description: "The best museum in Vietnam. Stunning tribal architecture, interactive exhibits, and outdoor village replicas.", category: "cultural", latitude: 21.0400, longitude: 105.7980, address: "Nguyen Van Huyen, Cau Giay", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.7, uniqueness: 0.85, price_level: 0.15, accessibility: 0.7, duration: 0.7, indoor_outdoor: 0.4, noise_level: 0.2 }, emotionalTags: { relaxing: 0.6, exciting: 0.4, social: 0.3, inspiring: 0.9, immersive: 0.85, nostalgic: 0.7 } },
  { name: "West Lake Lotus Tea Ceremony", description: "Sip tea infused with lotus flowers harvested at dawn from West Lake. A meditative, uniquely Hanoian ritual.", category: "workshop", latitude: 21.0560, longitude: 105.8250, address: "West Lake, Tay Ho", priceRange: "$$", experienceTags: { authenticity: 0.95, popularity: 0.3, uniqueness: 0.95, price_level: 0.5, accessibility: 0.5, duration: 0.5, indoor_outdoor: 0.5, noise_level: 0.1 }, emotionalTags: { relaxing: 0.99, exciting: 0.1, social: 0.4, inspiring: 0.9, immersive: 0.95, nostalgic: 0.9 } },
  { name: "Phung Hung Street Murals", description: "Restored colonial archway street with giant murals depicting Old Quarter life. Great for photography.", category: "art", latitude: 21.0370, longitude: 105.8465, address: "Phung Hung, Hoan Kiem", priceRange: "$", experienceTags: { authenticity: 0.7, popularity: 0.6, uniqueness: 0.7, price_level: 0.05, accessibility: 0.9, duration: 0.3, indoor_outdoor: 0.1, noise_level: 0.4 }, emotionalTags: { relaxing: 0.6, exciting: 0.4, social: 0.5, inspiring: 0.7, immersive: 0.6, nostalgic: 0.7 } },
  { name: "Tay Ho Shrimp Cake Stalls", description: "Crispy fried shrimp cakes at lakeside stalls. Best eaten standing, dipped in sweet fish sauce.", category: "restaurant", latitude: 21.0650, longitude: 105.8260, address: "To Ngoc Van, Tay Ho", priceRange: "$", experienceTags: { authenticity: 0.9, popularity: 0.5, uniqueness: 0.7, price_level: 0.1, accessibility: 0.6, duration: 0.2, indoor_outdoor: 0.2, noise_level: 0.4 }, emotionalTags: { relaxing: 0.5, exciting: 0.4, social: 0.4, inspiring: 0.3, immersive: 0.7, nostalgic: 0.6 } },
  { name: "Hanoi Bike Tour Old Quarter", description: "Guided bicycle tour through narrow alleys that motorbikes can't even fit through. Morning is best.", category: "workshop", latitude: 21.0340, longitude: 105.8505, address: "Old Quarter, Hoan Kiem", priceRange: "$$", experienceTags: { authenticity: 0.8, popularity: 0.6, uniqueness: 0.75, price_level: 0.4, accessibility: 0.6, duration: 0.6, indoor_outdoor: 0.05, noise_level: 0.5 }, emotionalTags: { relaxing: 0.4, exciting: 0.7, social: 0.6, inspiring: 0.7, immersive: 0.85, nostalgic: 0.6 } },
  { name: "Lotte Observation Deck", description: "Highest viewing point in Hanoi at 272m. Glass-floor section for the brave. Stunning on clear days.", category: "cultural", latitude: 21.0152, longitude: 105.8015, address: "54 Lieu Giai, Ba Dinh", priceRange: "$$", experienceTags: { authenticity: 0.3, popularity: 0.65, uniqueness: 0.7, price_level: 0.5, accessibility: 0.8, duration: 0.3, indoor_outdoor: 0.8, noise_level: 0.2 }, emotionalTags: { relaxing: 0.5, exciting: 0.8, social: 0.4, inspiring: 0.7, immersive: 0.6, nostalgic: 0.1 } },
];

function generateMorePlaces(): PlaceSeed[] {
  const categories = ["cafe", "restaurant", "cultural", "nature", "nightlife", "workshop", "art"];
  const extra: PlaceSeed[] = [];
  const baseNames = [
    ["Cafe", "Coffee House", "Roastery", "Tea Room", "Brew Bar"],
    ["Pho Shop", "Noodle Stall", "Street Kitchen", "Com Binh Dan", "Banh Cuon Stand"],
    ["Pagoda", "Temple Gate", "Heritage House", "Ancient Well", "Communal House"],
    ["Garden Path", "Lake View", "Park Corner", "Riverside Walk", "Green Alley"],
    ["Speakeasy", "Beer Garden", "Wine Cellar", "Jazz Lounge", "Night Terrace"],
    ["Clay Studio", "Silk Workshop", "Calligraphy Class", "Cooking School", "Craft Lab"],
    ["Gallery", "Art Alley", "Mural Wall", "Design Studio", "Photo Space"],
  ];
  const streets = ["Hang Gai", "Hang Dao", "Hang Bac", "Hang Ngang", "Ma May", "Hang Tre", "Hang Chieu", "Hang Quat", "Hang Than", "Bat Su", "Lo Su", "Cau Go", "Hang Ga", "Luong Van Can", "Ngo Huyen", "Ly Quoc Su", "Au Trieu", "Tong Duy Tan", "Cam Chi", "Yen Thai"];

  for (let i = 0; i < 160; i++) {
    const catIdx = i % 7;
    const cat = categories[catIdx];
    const namePool = baseNames[catIdx];
    const street = streets[i % streets.length];
    const nameBase = namePool[i % namePool.length];
    const num = Math.floor(i / 7) + 1;

    extra.push({
      name: `${nameBase} ${street} #${num}`,
      description: `A local ${cat} spot on ${street} street in Hanoi's Old Quarter area. Popular with locals and adventurous travelers.`,
      category: cat,
      latitude: 21.028 + (Math.random() - 0.5) * 0.03,
      longitude: 105.845 + (Math.random() - 0.5) * 0.02,
      address: `${Math.floor(Math.random() * 200)} ${street}, Hoan Kiem`,
      priceRange: ["$", "$", "$$", "$$", "$$$"][i % 5],
      experienceTags: {
        authenticity: 0.4 + Math.random() * 0.5,
        popularity: 0.2 + Math.random() * 0.6,
        uniqueness: 0.3 + Math.random() * 0.5,
        price_level: 0.1 + Math.random() * 0.5,
        accessibility: 0.4 + Math.random() * 0.5,
        duration: 0.2 + Math.random() * 0.5,
        indoor_outdoor: Math.random(),
        noise_level: 0.1 + Math.random() * 0.6,
      },
      emotionalTags: {
        relaxing: 0.2 + Math.random() * 0.7,
        exciting: 0.1 + Math.random() * 0.7,
        social: 0.2 + Math.random() * 0.6,
        inspiring: 0.2 + Math.random() * 0.6,
        immersive: 0.3 + Math.random() * 0.6,
        nostalgic: 0.1 + Math.random() * 0.6,
      },
    });
  }
  return extra;
}

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.delete(schema.reports);
  await db.delete(schema.emergencyContacts);
  await db.delete(schema.reviews);
  await db.delete(schema.payments);
  await db.delete(schema.tourStops);
  await db.delete(schema.tours);
  await db.delete(schema.messages);
  await db.delete(schema.swipeActions);
  await db.delete(schema.matches);
  await db.delete(schema.hostAvailability);
  await db.delete(schema.hostProfiles);
  await db.delete(schema.userProfiles);
  await db.delete(schema.places);
  await db.delete(schema.users);

  console.log("Cleared existing data.");

  // Seed users
  const passwordHash = hashSync("password123", 12);

  const travelers = await db
    .insert(schema.users)
    .values([
      { email: "alex@test.com", passwordHash, role: "traveler", displayName: "Alex Johnson", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
      { email: "sam@test.com", passwordHash, role: "traveler", displayName: "Sam Smith", avatarUrl: "https://randomuser.me/api/portraits/men/44.jpg" },
      { email: "elena@test.com", passwordHash, role: "traveler", displayName: "Elena Rodriguez", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg" },
      { email: "yuki@test.com", passwordHash, role: "traveler", displayName: "Yuki Tanaka", avatarUrl: "https://randomuser.me/api/portraits/women/79.jpg" },
      { email: "marco@test.com", passwordHash, role: "traveler", displayName: "Marco Weber", avatarUrl: "https://randomuser.me/api/portraits/men/75.jpg" },
    ])
    .returning();

  const hosts = await db
    .insert(schema.users)
    .values([
      { email: "nam@test.com", passwordHash, role: "host", displayName: "Nguyen Hoang Nam", avatarUrl: "https://randomuser.me/api/portraits/men/91.jpg" },
      { email: "linh@test.com", passwordHash, role: "host", displayName: "Tran Linh", avatarUrl: "https://randomuser.me/api/portraits/women/52.jpg" },
      { email: "chau@test.com", passwordHash, role: "host", displayName: "Le Minh Chau", avatarUrl: "https://randomuser.me/api/portraits/men/85.jpg" },
    ])
    .returning();

  console.log(`Seeded ${travelers.length} travelers and ${hosts.length} hosts.`);

  // Seed traveler profiles with distinct preferences per user
  const travelerPrefs = [
    { // Alex: culture + food explorer
      explicit: { intent: ["Explore Culture", "Food & Drink", "Meet New People"], interests: ["Street Food", "Temples", "Hidden Cafes", "Markets"], budget: "medium" as const, style: { chill_explore: 0.7, plan_spontaneous: 0.4 }, scenario_choice: "C", social_preference: "meet_new" as const, time_preference: ["morning", "evening"] as ("morning" | "afternoon" | "evening" | "late_night")[] },
    },
    { // Sam: adventure + nightlife
      explicit: { intent: ["Adventure", "Meet New People", "Food & Drink"], interests: ["Nightlife", "Rooftops", "Street Food", "Markets", "Photography"], budget: "high" as const, style: { chill_explore: 0.9, plan_spontaneous: 0.8 }, scenario_choice: "D", social_preference: "group" as const, time_preference: ["afternoon", "evening", "late_night"] as ("morning" | "afternoon" | "evening" | "late_night")[] },
    },
    { // Elena: photography + art
      explicit: { intent: ["Explore Culture", "Adventure"], interests: ["Photography", "Art", "Temples", "Hidden Cafes"], budget: "medium" as const, style: { chill_explore: 0.6, plan_spontaneous: 0.3 }, scenario_choice: "B", social_preference: "solo" as const, time_preference: ["morning", "afternoon"] as ("morning" | "afternoon" | "evening" | "late_night")[] },
    },
    { // Yuki: food + culture, budget-conscious
      explicit: { intent: ["Food & Drink", "Explore Culture"], interests: ["Street Food", "Temples", "Markets", "Hidden Cafes", "Art"], budget: "low" as const, style: { chill_explore: 0.5, plan_spontaneous: 0.5 }, scenario_choice: "C", social_preference: "meet_new" as const, time_preference: ["morning", "afternoon", "evening"] as ("morning" | "afternoon" | "evening" | "late_night")[] },
    },
    { // Marco: nature + adventure, spontaneous
      explicit: { intent: ["Adventure", "Relax & Recharge"], interests: ["Rooftops", "Photography", "Markets", "Nightlife"], budget: "high" as const, style: { chill_explore: 0.85, plan_spontaneous: 0.9 }, scenario_choice: "A", social_preference: "meet_new" as const, time_preference: ["afternoon", "evening", "late_night"] as ("morning" | "afternoon" | "evening" | "late_night")[] },
    },
  ];

  const { computeDerivedProfile } = await import("../services/profile-engine");

  for (let i = 0; i < travelers.length; i++) {
    const prefs = travelerPrefs[i];
    const derived = computeDerivedProfile(prefs.explicit);
    await db.insert(schema.userProfiles).values({
      userId: travelers[i].id,
      explicitData: prefs.explicit,
      derivedData: derived,
      implicitData: {},
      onboardingCompleted: true,
    });
  }

  // Seed emergency contacts for each traveler
  const emergencyContactData = [
    { name: "Sarah Johnson", phone: "+1-555-0101", relationship: "Mother" },
    { name: "David Smith", phone: "+44-7700-900123", relationship: "Brother" },
    { name: "Carlos Rodriguez", phone: "+34-600-123456", relationship: "Partner" },
    { name: "Kenji Tanaka", phone: "+81-90-1234-5678", relationship: "Father" },
    { name: "Anna Weber", phone: "+49-170-1234567", relationship: "Sister" },
  ];
  for (let i = 0; i < travelers.length; i++) {
    await db.insert(schema.emergencyContacts).values({
      userId: travelers[i].id,
      ...emergencyContactData[i],
      isPrimary: true,
    });
  }

  // Seed host profiles
  const hostData = [
    { userId: hosts[0].id, bio: "Street food guru and photography lover. I know every hidden alley in the Old Quarter.", languages: ["Vietnamese", "English"], specialties: ["food", "photography", "nightlife"] },
    { userId: hosts[1].id, bio: "History student who loves sharing Hanoi's 1000-year story with travelers from around the world.", languages: ["Vietnamese", "English", "French"], specialties: ["culture", "history", "walking"] },
    { userId: hosts[2].id, bio: "Coffee addict and art lover. Let me show you the cafes and galleries tourists never find.", languages: ["Vietnamese", "English", "Japanese"], specialties: ["cafe", "art", "nature"] },
  ];

  for (const h of hostData) {
    const hp = await db
      .insert(schema.hostProfiles)
      .values({
        ...h,
        verificationStatus: "approved",
        verifiedAt: new Date(),
        avgRating: "4.80",
        totalReviews: 15,
        totalTours: 25,
        isAvailable: true,
      })
      .returning();

    for (let day = 0; day <= 6; day++) {
      await db.insert(schema.hostAvailability).values({
        hostId: hp[0].id,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "20:00",
        isActive: day < 6,
      });
    }
  }

  console.log("Seeded host profiles and availability.");

  // Seed places
  const allPlaces = [...HANOI_PLACES, ...generateMorePlaces()];

  const usedSlugs = new Set<string>();
  for (let i = 0; i < allPlaces.length; i++) {
    const place = allPlaces[i];
    const photos = place.photos || getPhotosForCategory(place.category, i);
    let slug = slugify(place.name);
    let suffix = 2;
    while (usedSlugs.has(slug)) { slug = slugify(place.name) + "-" + suffix++; }
    usedSlugs.add(slug);
    await db.insert(schema.places).values({
      name: place.name,
      slug,
      description: place.description,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      photos,
      priceRange: place.priceRange,
      experienceTags: place.experienceTags,
      emotionalTags: place.emotionalTags,
      isVerified: true,
      isActive: true,
      source: "system_seeded",
      avgRating: (3.5 + Math.random() * 1.5).toFixed(2),
      totalReviews: Math.floor(Math.random() * 50),
      visitCount: Math.floor(Math.random() * 500),
    });
  }

  console.log(`Seeded ${allPlaces.length} places.`);

  // Seed completed tours for each traveler
  const seededPlaces = await db.select().from(schema.places).limit(30);
  const tourTitles = [
    "Old Quarter Food Adventure", "Sunset Temple Walk", "Hidden Cafes Tour",
    "Street Photography Route", "Night Market Explorer", "Morning Pho Crawl",
    "Lakeside Cultural Walk", "Art Gallery Hop", "Bia Hoi Social Night",
    "West Lake Sunrise Ride",
  ];

  for (let t = 0; t < travelers.length; t++) {
    const numTours = 2 + (t % 2);
    for (let ti = 0; ti < numTours; ti++) {
      const daysAgo = 1 + ti * 3 + t;
      const tourPlaces = seededPlaces.slice(t * 4 + ti * 2, t * 4 + ti * 2 + 4);
      if (tourPlaces.length === 0) continue;

      const [tour] = await db.insert(schema.tours).values({
        userId: travelers[t].id,
        status: "completed",
        requestParams: { date: new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0], startTime: "09:00", durationHours: 3, budgetLevel: "medium", interests: ["food", "culture"], withHost: false, groupSize: 1 },
        tourData: {
          title: tourTitles[(t * 3 + ti) % tourTitles.length],
          description: `A personalized ${tourPlaces.length}-stop itinerary through Hanoi.`,
          stops: tourPlaces.map((p, si) => ({ placeId: p.id, name: p.name, category: p.category, scheduledTime: `${9 + si}:00`, durationMinutes: 45, localTip: `Local favorite in ${p.category}.`, estimatedSpend: p.priceRange || "$", travelToNext: "10 min walk" })),
          totalDurationMinutes: 180,
          estimatedCost: { min: 200000, max: 400000, currency: "VND" },
          personalizationRationale: "Based on your interests and travel style.",
        },
        packageType: "loco_route",
        priceAmount: 250000,
        startedAt: new Date(Date.now() - daysAgo * 86400000 + 9 * 3600000),
        completedAt: new Date(Date.now() - daysAgo * 86400000 + 12 * 3600000),
      }).returning();

      for (let si = 0; si < tourPlaces.length; si++) {
        await db.insert(schema.tourStops).values({
          tourId: tour.id,
          placeId: tourPlaces[si].id,
          stopOrder: si,
          durationMinutes: 45,
          notes: `Visited ${tourPlaces[si].name}`,
          visitedAt: new Date(Date.now() - daysAgo * 86400000 + (9 + si) * 3600000),
        });
      }
    }
  }

  console.log("Seeded completed tours for travelers.");

  // Seed matches, swipe actions, and chat messages
  const chatMessages: { from: number; to: number; msgs: string[] }[] = [
    { from: 0, to: 1, msgs: [
      "Hey Sam! I saw you're exploring the Old Quarter too. Found any good pho spots?",
      "Hey Alex! Yes! Pho Gia Truyen on Bat Dan is incredible. The queue is worth it.",
      "Nice, I'll check it out tomorrow morning. Want to go together?",
      "Sure! Let's meet at 7AM before the crowds. I'll send you the pin.",
      "Perfect. I heard there's also an amazing egg coffee place nearby.",
      "Giang Cafe! It's literally around the corner. We can go after pho.",
    ]},
    { from: 0, to: 2, msgs: [
      "Hola Elena! Your profile says you're into photography. Me too!",
      "Hi Alex! Yes I'm trying to capture the Old Quarter at golden hour.",
      "The light on Hang Ma street around 5pm is magical. Interested?",
      "Absolutely! I've been looking for someone who knows the good spots.",
      "Let's do a sunset photo walk tomorrow. Train Street is epic too.",
    ]},
    { from: 0, to: 3, msgs: [
      "Hi Yuki! Welcome to Hanoi. How's your trip so far?",
      "Konnichiwa! It's amazing. The street food is next level.",
      "Have you tried bun cha yet? It's Hanoi's signature dish.",
      "Not yet! Is it the one Obama had? I saw that episode.",
      "Yes! Bun Cha Huong Lien. I can show you, I'm going there Friday.",
      "That would be great! I've been wanting to try it with someone local-savvy.",
      "It's a date then. Also there's a hidden temple nearby worth seeing.",
    ]},
    { from: 1, to: 2, msgs: [
      "Elena! I love your travel photos on your profile.",
      "Thank you Sam! Hanoi has been so photogenic.",
      "Want to explore the Ceramic Road along the Red River? It's a 4km mural.",
      "I didn't even know that existed! When are you free?",
      "Tomorrow afternoon? We could grab bia hoi after.",
    ]},
    { from: 1, to: 4, msgs: [
      "Hey Marco! Another solo traveler in Hanoi. Where are you staying?",
      "Hi Sam! I'm near Hoan Kiem Lake. Great location for walking everywhere.",
      "Same area! Have you been to the night market on Hang Dao yet?",
      "Going tonight actually. Want to join?",
      "Count me in. I heard the street food stalls there are amazing.",
    ]},
    { from: 2, to: 3, msgs: [
      "Yuki! I noticed we both have photography as an interest.",
      "Yes! I've been shooting a lot of street scenes in the alleys.",
      "There's a beautiful pagoda on West Lake at sunset. Tran Quoc Pagoda.",
      "Oh I've seen photos of it. Is it far from the Old Quarter?",
      "About 15 min by Grab. Totally worth it. Want to go together this weekend?",
      "I'd love that! Sunday evening would work perfectly for golden hour.",
    ]},
    { from: 3, to: 4, msgs: [
      "Hi Marco! How are you finding Hanoi so far?",
      "Hey Yuki! It's incredible. The chaos is part of the charm.",
      "Haha so true. Have you managed to cross the street yet? 😄",
      "Barely! The motorbikes are wild. But the people are so friendly.",
      "I found this amazing hidden cafe in an alley off Hang Buom. No tourists.",
      "That sounds perfect. Send me the location?",
    ]},
  ];

  for (const chat of chatMessages) {
    const userA = travelers[chat.from];
    const userB = travelers[chat.to];
    const [sortedA, sortedB] = [userA.id, userB.id].sort();

    // Create mutual swipe actions
    await db.insert(schema.swipeActions).values({ swiperId: userA.id, targetId: userB.id, action: "like" });
    await db.insert(schema.swipeActions).values({ swiperId: userB.id, targetId: userA.id, action: "like" });

    // Create match
    const [match] = await db.insert(schema.matches).values({
      userAId: sortedA,
      userBId: sortedB,
      score: (0.65 + Math.random() * 0.3).toFixed(4),
      status: "matched",
      matchedAt: new Date(Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000)),
    }).returning();

    // Create messages with realistic timestamps
    const baseTime = Date.now() - (chat.msgs.length * 15 * 60 * 1000);
    for (let i = 0; i < chat.msgs.length; i++) {
      const senderId = i % 2 === 0 ? userA.id : userB.id;
      await db.insert(schema.messages).values({
        matchId: match.id,
        senderId,
        content: chat.msgs[i],
        messageType: "text",
        isRead: i < chat.msgs.length - 1,
        createdAt: new Date(baseTime + i * (8 + Math.random() * 20) * 60 * 1000),
      });
    }
  }

  console.log(`Seeded ${chatMessages.length} conversations with messages.`);
  console.log("Seed complete!");

  await client.end();
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
