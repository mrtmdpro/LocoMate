import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashSync } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";
import { slugify } from "../../lib/slugify";
import { merchImage } from "../../lib/merch-images";
import { seedFixedTours } from "./seed-fixed-tours";
import { seedCustomizedTourTemplates } from "./seed-customized-tour-templates";
import { CURATED_EXPERIENCE_TRANSLATIONS } from "./translations/curated-experiences";
import { HOST_EXPERIENCE_TRANSLATIONS } from "./translations/host-experiences";
import { PLACE_TRANSLATIONS } from "./translations/places";
import { ACTIVITY_TRANSLATIONS } from "./translations/activities";
import { PRODUCT_TRANSLATIONS } from "./translations/products";
import { HOST_BIO_TRANSLATIONS } from "./translations/host-bios";

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

// All photos are verified Hanoi, Vietnam specific
const PHOTOS_BY_CATEGORY: Record<string, string[]> = {
  cafe: [
    "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=800&h=500&fit=crop", // Vietnamese egg coffee
    "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=800&h=500&fit=crop", // Vietnamese ca phe sua da
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefda?w=800&h=500&fit=crop", // Vietnamese drip coffee
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop", // Coffee and pastry
    "https://images.unsplash.com/photo-1521302200778-33500795e128?w=800&h=500&fit=crop", // Vietnamese iced coffee
    "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi Old Quarter alley cafe
    "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi bustling street
  ],
  restaurant: [
    "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&h=500&fit=crop", // Vietnamese pho bowl
    "https://images.unsplash.com/photo-1576577445504-6af96477db52?w=800&h=500&fit=crop", // Vietnamese spring rolls
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&h=500&fit=crop", // Banh mi sandwich
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=500&fit=crop", // Vietnamese noodle soup
    "https://images.unsplash.com/photo-1562565651-7d4948f339eb?w=800&h=500&fit=crop", // Asian street food spread
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=500&fit=crop", // Vietnamese bun cha
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop", // Vietnamese restaurant interior
  ],
  cultural: [
    "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi Old Quarter
    "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi old quarter vendors
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=500&fit=crop", // Vietnam temple
    "https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=800&h=500&fit=crop", // Hanoi Hoan Kiem area
    "https://images.unsplash.com/photo-1555921015-5532091f6026?w=800&h=500&fit=crop", // Vietnam pagoda
    "https://images.unsplash.com/photo-1592364395653-83e648b20cc2?w=800&h=500&fit=crop", // Vietnam cultural site
    "https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop", // Vietnam traditional architecture
  ],
  nature: [
    "https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=800&h=500&fit=crop", // Hoan Kiem Lake area
    "https://images.unsplash.com/photo-1555921015-5532091f6026?w=800&h=500&fit=crop", // Vietnam lake/garden
    "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi tree-lined streets
    "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi street scene
    "https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop", // Vietnam tropical garden
  ],
  nightlife: [
    "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi Old Quarter evening
    "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi traffic at dusk
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&h=500&fit=crop", // Bar interior
    "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&h=500&fit=crop", // Night street
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=500&fit=crop", // Vietnam lanterns at night
  ],
  workshop: [
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=500&fit=crop", // Cooking class
    "https://images.unsplash.com/photo-1576577445504-6af96477db52?w=800&h=500&fit=crop", // Vietnamese spring roll making
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=500&fit=crop", // Vietnamese food prep
    "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&h=500&fit=crop", // Vietnamese cuisine workshop
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=500&fit=crop", // Vietnam craft/cultural activity
  ],
  art: [
    "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi old street architecture
    "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800", // Hanoi Old Quarter murals
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=500&fit=crop", // Vietnam traditional art
    "https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop", // Vietnam architecture/art
    "https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=800&h=500&fit=crop", // Hanoi artistic street scene
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
  await db.delete(schema.hostPayouts);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.cartItems);
  await db.delete(schema.activitySlots);
  await db.delete(schema.activities);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.payments);
  await db.delete(schema.tourStops);
  await db.delete(schema.tours);
  await db.delete(schema.messages);
  await db.delete(schema.swipeActions);
  await db.delete(schema.matches);
  await db.delete(schema.hostAvailability);
  await db.delete(schema.hostProfiles);
  await db.delete(schema.userProfiles);
  await db.delete(schema.savedPlaces);
  await db.delete(schema.experiences);
  await db.delete(schema.places);
  await db.delete(schema.users);

  console.log("Cleared existing data.");

  // Seed users
  const passwordHash = hashSync("password123", 12);

  const travelers = await db
    .insert(schema.users)
    .values([
      { email: "alex@test.com", passwordHash, role: "traveler", displayName: "Alex Johnson", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg", emailVerified: true },
      { email: "sam@test.com", passwordHash, role: "traveler", displayName: "Sam Smith", avatarUrl: "https://randomuser.me/api/portraits/men/44.jpg", emailVerified: true },
      { email: "elena@test.com", passwordHash, role: "traveler", displayName: "Elena Rodriguez", avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg", emailVerified: true },
      { email: "yuki@test.com", passwordHash, role: "traveler", displayName: "Yuki Tanaka", avatarUrl: "https://randomuser.me/api/portraits/women/79.jpg", emailVerified: true },
      { email: "marco@test.com", passwordHash, role: "traveler", displayName: "Marco Weber", avatarUrl: "https://randomuser.me/api/portraits/men/75.jpg", emailVerified: true },
    ])
    .returning();

  const hosts = await db
    .insert(schema.users)
    .values([
      { email: "nam@test.com", passwordHash, role: "host", displayName: "Nguyen Hoang Nam", avatarUrl: "https://randomuser.me/api/portraits/men/91.jpg", emailVerified: true },
      { email: "linh@test.com", passwordHash, role: "host", displayName: "Tran Linh", avatarUrl: "https://randomuser.me/api/portraits/women/52.jpg", emailVerified: true },
      { email: "chau@test.com", passwordHash, role: "host", displayName: "Le Minh Chau", avatarUrl: "https://randomuser.me/api/portraits/men/85.jpg", emailVerified: true },
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

  // Hosts still get a user_profiles row with onboardingCompleted=true so the
  // login handler doesn't bounce them to the traveler-only /onboarding page.
  // Their real onboarding is host-setup + ID verification, not intent/
  // interests/budget.
  for (const host of hosts) {
    await db.insert(schema.userProfiles).values({
      userId: host.id,
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

  // Collect hostProfiles IDs so later blocks can attach experiences, tours,
  // and payouts to each host without re-querying. Slugs are generated from
  // the user's display name so the URL reads like `/hosts/nguyen-hoang-nam`
  // rather than an opaque UUID.
  const hostProfileIds: string[] = [];
  for (let i = 0; i < hostData.length; i++) {
    const h = hostData[i];
    const hostUser = hosts[i];
    const slug = slugify(hostUser.displayName);
    const bioTrans = HOST_BIO_TRANSLATIONS[slug];
    const hp = await db
      .insert(schema.hostProfiles)
      .values({
        ...h,
        publicSlug: slug,
        bioVi: bioTrans?.bio.vi,
        bioEn: bioTrans?.bio.en ?? h.bio,
        verificationStatus: "approved",
        verifiedAt: new Date(),
        avgRating: "4.80",
        totalReviews: 15,
        totalTours: 25,
        isAvailable: true,
      })
      .returning();
    hostProfileIds.push(hp[0].id);

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
    // PLACE_TRANSLATIONS keys off the slug derived from the *original*
    // place name (no suffix). Curated entries get full bilingual coverage;
    // procedurally generated entries fall through to legacy `name` via
    // `pickLocaleField` at render time.
    const placeTrans = PLACE_TRANSLATIONS[slugify(place.name)];
    await db.insert(schema.places).values({
      name: place.name,
      nameVi: placeTrans?.name.vi,
      nameEn: placeTrans?.name.en ?? place.name,
      slug,
      description: place.description,
      descriptionVi: placeTrans?.description.vi,
      descriptionEn: placeTrans?.description.en ?? place.description,
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

    // Create messages with realistic, strictly-increasing timestamps.
    // Each message's timestamp is derived by ACCUMULATING the previous
    // one plus a fresh random gap (5-25 minutes). The previous version
    // computed each timestamp independently as `baseTime + i * (8 + rand * 20)
    // * 60k`, which let a high-rand entry at i=1 land AFTER a low-rand entry
    // at i=2, making the rendered chat order jump (Sam, Sam, Marco, Marco
    // instead of the intended Sam, Marco, Sam, Marco).
    let cursor = Date.now() - chat.msgs.length * 15 * 60 * 1000;
    for (let i = 0; i < chat.msgs.length; i++) {
      const senderId = i % 2 === 0 ? userA.id : userB.id;
      await db.insert(schema.messages).values({
        matchId: match.id,
        senderId,
        content: chat.msgs[i],
        messageType: "text",
        isRead: i < chat.msgs.length - 1,
        createdAt: new Date(cursor),
      });
      // Advance cursor by 5-25 minutes so next message is strictly later.
      cursor += (5 + Math.random() * 20) * 60 * 1000;
    }
  }

  console.log(`Seeded ${chatMessages.length} conversations with messages.`);

  // Seed experiences. The first three slots are brand-canonical exemplars
  // for each Fixed Tour category (Phase A.3) — Thanh Tao Xứ Bắc,
  // Hồn Đất Nghệ Nhân, Hương Men Nồng Say. The /experiences matrix UI keys
  // off these `category` strings.
  const experiencesData = [
    { title: "Thanh Tao Xứ Bắc — Đình đài Hà Nội", slug: "thanh-tao-xu-bac-walk", subtitle: "Tường rêu phong, đình cổ, nhà số 87", description: "Một sáng đi qua các bức tường rêu phong, đình đài, nhà cổ phố Mã Mây — đọc Hà Nội như một quyển sách. Local guide kể chuyện về kiến trúc Pháp, mái đình Lý-Trần, và một căn nhà 87 Mã Mây mở cửa cho khách bước vào.", category: "thanh-tao-xu-bac", durationMinutes: 180, priceAmount: 480000, maxGroupSize: 8, photos: ["https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Tường rêu phong phố cổ", "Nhà cổ 87 Mã Mây", "Đình Bạch Mã", "Lịch sử kiến trúc Pháp-Hà Nội"], included: ["Local guide", "Vé vào nhà cổ", "Trà nóng nghỉ chân"], schedule: [{ time: "08:00", label: "Tập trung Hoàn Kiếm" }, { time: "08:30", label: "Đình Bạch Mã" }, { time: "09:30", label: "Nhà 87 Mã Mây" }, { time: "10:30", label: "Trà nghỉ chân" }], avgRating: "4.92", totalBookings: 34 },
    { title: "Hồn Đất Nghệ Nhân — Gốm Bát Tràng", slug: "hon-dat-nghe-nhan-bat-trang", subtitle: "Chạm tay vào đất, đi cùng người nghệ nhân", description: "Đến làng gốm Bát Tràng cùng một nghệ nhân thế hệ thứ tư. Tự tay nặn, vẽ men, và mang về một tác phẩm gốm thật của chính mình. Câu chuyện kể về 700 năm lò Bát Tràng, qua khói đất nung.", category: "hon-dat-nghe-nhan", durationMinutes: 240, priceAmount: 720000, maxGroupSize: 6, photos: ["https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Tự nặn gốm với nghệ nhân", "Đi giữa các lò nung 700 năm", "Mang gốm của mình về", "Bữa trưa gia đình nghệ nhân"], included: ["Xe đưa đón", "Vật liệu gốm", "Bữa trưa", "Đóng gói gốm mang về"], schedule: [{ time: "09:00", label: "Đón ở Hoàn Kiếm" }, { time: "10:00", label: "Đến Bát Tràng" }, { time: "10:30", label: "Nặn gốm" }, { time: "12:30", label: "Bữa trưa" }, { time: "13:30", label: "Về Hà Nội" }], avgRating: "4.95", totalBookings: 28 },
    { title: "Hương Men Nồng Say — Bún Đậu & Phở Đêm", slug: "huong-men-nong-say-bun-dau", subtitle: "Ẩm thực ngách Hà Nội — chỉ người sành ăn biết", description: "Một food tour ngách: bún đậu mắm tôm lề đường, phở gánh đêm trên Lý Quốc Sư, chè cốm Tràng Tiền. Không quán du lịch, không Google review — chỉ những địa chỉ người Hà Nội thật sự đến.", category: "huong-men-nong-say", durationMinutes: 180, priceAmount: 580000, maxGroupSize: 8, photos: ["https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Bún đậu mắm tôm trong ngõ", "Phở gánh đêm Lý Quốc Sư", "Chè cốm Tràng Tiền", "5 món ăn nghìn năm tuổi"], included: ["Local guide sành ăn", "5 món ăn", "Trà đá vỉa hè", "Đi bộ + xích lô"], schedule: [{ time: "18:00", label: "Tập trung Đồng Xuân" }, { time: "18:30", label: "Bún đậu ngõ" }, { time: "19:30", label: "Phở gánh đêm" }, { time: "20:30", label: "Chè cốm" }], avgRating: "4.89", totalBookings: 41 },
    { title: "Breakfast Like a Hanoian", slug: "breakfast-like-a-hanoian", subtitle: "Morning Market Run with a Local Grandma", description: "Wake up at 5:30 AM and accompany a retired Hanoian grandmother to her neighborhood wet market. Learn how she picks the freshest herbs, negotiates prices, and judges a good fish. End with cooking and eating pho together at her home.", category: "culinary", durationMinutes: 180, priceAmount: 750000, maxGroupSize: 3, photos: ["https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800", "https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Visit a local wet market at dawn", "Learn to pick fresh ingredients", "Cook pho from scratch", "Eat breakfast with a real Hanoi family"], included: ["Local guide/grandma host", "All ingredients", "Breakfast meal", "Recipe card"], schedule: [{ time: "05:30", label: "Meet at Old Quarter" }, { time: "06:00", label: "Wet market tour" }, { time: "07:00", label: "Cooking session" }, { time: "08:00", label: "Breakfast together" }], avgRating: "4.90", totalBookings: 47 },
    { title: "The Family Table", slug: "the-family-table", subtitle: "Lunch with a Hanoi Family", description: "Join a real Hanoian family for a home-cooked lunch in their Old Quarter townhouse. No cooking class setup, no staged kitchen — just their actual Sunday meal with 3 generations at the table.", category: "culinary", durationMinutes: 150, priceAmount: 625000, maxGroupSize: 4, photos: ["https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Dine with 3 generations", "Home-cooked authentic lunch", "Hear real stories from elders", "Take home a handwritten recipe"], included: ["Full home-cooked lunch", "Family host + guide", "Recipe card", "Tea and dessert"], schedule: [{ time: "11:30", label: "Meet at family home" }, { time: "12:00", label: "Lunch" }, { time: "13:30", label: "Tea and farewell" }], avgRating: "4.95", totalBookings: 32 },
    { title: "Rice Paddy Morning", slug: "rice-paddy-morning", subtitle: "Farm Work in Suburban Hanoi", description: "Drive 30 minutes outside the city to a family rice farm in Dong Anh. Spend 3 hours planting or harvesting rice, learn about the lunar agricultural calendar, and eat a farmhouse lunch.", category: "adventure", durationMinutes: 240, priceAmount: 1000000, maxGroupSize: 6, photos: ["https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Real rice farming", "Learn the lunar calendar", "Farmhouse lunch", "Scenic countryside drive"], included: ["Round-trip transport", "Farming equipment", "Farmhouse lunch", "Local guide"], schedule: [{ time: "07:00", label: "Pickup" }, { time: "07:30", label: "Drive to farm" }, { time: "08:00", label: "Farm work" }, { time: "10:30", label: "Lunch" }], avgRating: "4.85", totalBookings: 18 },
    { title: "The Wedding Crasher", slug: "the-wedding-crasher", subtitle: "Attend a Real Vietnamese Wedding", description: "Vietnamese weddings are massive open-door banquets where extra guests are welcomed. Experience the tea ceremony, the 10-course banquet, the karaoke, and the chaos.", category: "cultural", durationMinutes: 240, priceAmount: 1250000, maxGroupSize: 2, photos: ["https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Real Vietnamese wedding", "10-course banquet", "Karaoke with family", "Cultural briefing"], included: ["Outfit advice", "Cultural guide", "Banquet dinner", "Gift for couple"], schedule: [{ time: "17:00", label: "Cultural briefing" }, { time: "17:30", label: "Travel to venue" }, { time: "18:00", label: "Tea ceremony" }, { time: "19:00", label: "Banquet" }], avgRating: "4.98", totalBookings: 8 },
    { title: "Dawn on the Red River", slug: "dawn-on-the-red-river", subtitle: "Fisherman's Boat at Sunrise", description: "Board a small wooden fishing boat on the Red River at 5 AM with a third-generation fisherman. Help cast nets, watch the sun rise over Long Bien Bridge, and eat riverside pho.", category: "adventure", durationMinutes: 180, priceAmount: 875000, maxGroupSize: 3, photos: ["https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Sunrise fishing on Red River", "Learn net-casting", "Sunrise over Long Bien Bridge", "Fishermen-only pho stall"], included: ["Fishing boat", "Fisherman guide", "Riverside pho", "Life jacket"], schedule: [{ time: "05:00", label: "Meet at dock" }, { time: "05:15", label: "Board boat" }, { time: "06:00", label: "Sunrise + fishing" }, { time: "07:30", label: "Pho breakfast" }], avgRating: "4.92", totalBookings: 23 },
    { title: "The Night Shift", slug: "the-night-shift", subtitle: "Behind-the-Scenes at Hanoi's 2AM Economy", description: "Hanoi never sleeps. Visit the wholesale flower market at 2 AM, watch bread bakers fire ovens at 3 AM, meet the street sweepers who own the empty streets, and end with the first coffee at 5:30 AM.", category: "nightlife", durationMinutes: 300, priceAmount: 1000000, maxGroupSize: 4, photos: ["https://images.pexels.com/photos/30739567/pexels-photo-30739567.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Quang Ba flower market at 2 AM", "Banh mi bakers at 3 AM", "Meet xe om night drivers", "First coffee at 5:30 AM"], included: ["Midnight motorbike transport", "Night-shift guide", "Flower market access", "Banh mi + coffee"], schedule: [{ time: "00:00", label: "Midnight pickup" }, { time: "00:30", label: "Empty Old Quarter" }, { time: "02:00", label: "Flower market" }, { time: "03:30", label: "Bakery visit" }, { time: "05:00", label: "First cafe" }], avgRating: "4.88", totalBookings: 15 },
  ];
  for (const exp of experiencesData) {
    const trans = CURATED_EXPERIENCE_TRANSLATIONS[exp.slug];
    await db.insert(schema.experiences).values({
      ...exp,
      titleVi: trans?.title.vi,
      titleEn: trans?.title.en ?? exp.title,
      subtitleVi: trans?.subtitle.vi,
      subtitleEn: trans?.subtitle.en ?? exp.subtitle,
      descriptionVi: trans?.description.vi,
      descriptionEn: trans?.description.en ?? exp.description,
      highlightsVi: trans?.highlights.vi,
      highlightsEn: trans?.highlights.en ?? exp.highlights,
      includedVi: trans?.included.vi,
      includedEn: trans?.included.en ?? exp.included,
      scheduleVi: trans?.schedule.vi,
      scheduleEn: trans?.schedule.en ?? exp.schedule,
    });
  }
  console.log(`Seeded ${experiencesData.length} experiences.`);

  // -----------------------------------------------------------------------
  // Fixed Tour curated catalog (Phase B — see docs/sửa .md). 15 bilingual
  // tours organized by chapter, with per-stop itinerary + multi-class tags
  // + a 4-D personality vector for cosine matching against the quiz result.
  // -----------------------------------------------------------------------
  const { tourCount } = await seedFixedTours(db);
  console.log(`Seeded ${tourCount} curated Fixed Tours (chapters + tags + vectors).`);

  const { templateCount } = await seedCustomizedTourTemplates(db);
  console.log(`Seeded ${templateCount} customized tour templates (themes + vectors).`);

  // -----------------------------------------------------------------------
  // Host-authored marketplace content (experiences + bookings + payments +
  // payouts). Populates each host's "My Experiences" tab, drives the cashflow
  // dashboard, and gives the routes heatmap real points to render.
  //
  // Each host gets 3 experiences matched to their profile specialties. Each
  // experience has 3-4 linked tours spread across statuses (completed / paid
  // future / preview) and a payment in the appropriate status. Payments are
  // distributed across the last 60 days so the revenue-by-day chart has real
  // bar heights rather than a flat line.
  // -----------------------------------------------------------------------

  interface HostExperienceSeed {
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    category: string;
    durationMinutes: number;
    priceAmount: number;
    maxGroupSize: number;
    photos: string[];
    highlights: string[];
    included: string[];
    schedule: { time: string; label: string }[];
    // Approximate place name prefixes in HANOI_PLACES that this tour visits.
    // The seed picks real place rows matching these names so tour_stops point
    // at geographically real locations, which makes the /host/routes map
    // meaningful rather than a blob over Hoan Kiem.
    stopPlaceNames: string[];
  }

  const nam = hosts[0];
  const linh = hosts[1];
  const chau = hosts[2];

  const hostExperiences: { authorId: string; exp: HostExperienceSeed }[] = [
    // --------------------------- NAM ---------------------------
    {
      authorId: nam.id,
      exp: {
        title: "Hidden Alley Food Crawl",
        slug: "hidden-alley-food-crawl",
        subtitle: "Eat your way through the Old Quarter's back lanes",
        description: "Six stops, zero tourist traps. I'll take you through the alleys only locals know for the best bun cha, pho, banh mi, egg coffee, and che sweet soup. Come hungry -- you'll eat like a Hanoian for four generations.",
        category: "culinary",
        durationMinutes: 180,
        priceAmount: 650_000,
        maxGroupSize: 4,
        photos: [
          "https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800",
          "https://images.pexels.com/photos/5639500/pexels-photo-5639500.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["6 food stops locals keep to themselves", "Hidden alley navigation", "Best egg coffee in Hanoi", "Real-time local tips on every bite"],
        included: ["All 6 tastings", "Bottled water", "Photography tips", "Recipe card"],
        schedule: [
          { time: "10:00", label: "Meet at Hang Bong corner" },
          { time: "10:15", label: "Stop 1: Bun Cha Huong Lien" },
          { time: "11:00", label: "Stop 2: Pho Gia Truyen Bat Dan" },
          { time: "11:45", label: "Stop 3: Banh Mi 25" },
          { time: "12:15", label: "Stop 4: Giang Egg Coffee" },
          { time: "12:45", label: "Stop 5: Che stand" },
          { time: "13:00", label: "Farewell" },
        ],
        stopPlaceNames: ["Bun Cha Huong Lien", "Pho Gia Truyen Bat Dan", "Banh Mi 25", "Cafe Giang", "Xoi Yen"],
      },
    },
    {
      authorId: nam.id,
      exp: {
        title: "Motorbike Night Photo Tour",
        slug: "motorbike-night-photo-tour",
        subtitle: "Ride pillion through Hanoi's after-dark colors",
        description: "Ride on the back of my motorbike as we hit four neon-lit spots across the city -- Train Street, Long Bien Bridge at night, the Old Quarter alleys, and Quang Ba flower market. Perfect for content creators and night photographers who want to skip the Grab queues.",
        category: "adventure",
        durationMinutes: 240,
        priceAmount: 1_200_000,
        maxGroupSize: 2,
        photos: [
          "https://images.pexels.com/photos/9811048/pexels-photo-9811048.jpeg?auto=compress&cs=tinysrgb&w=800",
          "https://images.pexels.com/photos/9811039/pexels-photo-9811039.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["Motorbike ride with gear", "4 photo spots in 1 night", "Train Street access timing", "Flower market 2 AM access"],
        included: ["Motorbike + helmet", "Rain poncho if needed", "Photography coaching", "Hot tea mid-ride"],
        schedule: [
          { time: "21:00", label: "Meet at Hoan Kiem Lake" },
          { time: "21:30", label: "Train Street" },
          { time: "22:30", label: "Long Bien Bridge" },
          { time: "23:30", label: "Old Quarter alleys" },
          { time: "01:00", label: "Quang Ba flower market" },
        ],
        stopPlaceNames: ["Hoan Kiem Lake", "Long Bien Bridge Walk", "Bia Hoi Corner", "Quang Ba Flower Market (Night)"],
      },
    },
    {
      authorId: nam.id,
      exp: {
        title: "Breakfast Pho Pilgrimage",
        slug: "breakfast-pho-pilgrimage",
        subtitle: "Three bowls, three families, one morning",
        description: "Hanoi has no single best pho -- it has hundreds of perfect bowls, each defended to the death by its neighborhood. We'll try three at 6 AM when the broth is freshest, and I'll explain why they disagree about absolutely everything.",
        category: "culinary",
        durationMinutes: 120,
        priceAmount: 480_000,
        maxGroupSize: 4,
        photos: [
          "https://images.pexels.com/photos/5848470/pexels-photo-5848470.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["3 pho bowls in 2 hours", "Dawn in the Old Quarter", "Meet the cooks", "You vote the winner"],
        included: ["All 3 pho bowls", "Ca phe sua da coffee", "Local tipping etiquette"],
        schedule: [
          { time: "06:00", label: "Meet at Hang Gai" },
          { time: "06:10", label: "Pho #1: Gia Truyen Bat Dan" },
          { time: "06:50", label: "Pho #2: family street stall" },
          { time: "07:30", label: "Pho #3: modern favorite" },
          { time: "08:00", label: "Coffee + debrief" },
        ],
        stopPlaceNames: ["Pho Gia Truyen Bat Dan", "Xoi Yen", "Cafe Giang"],
      },
    },

    // --------------------------- LINH ---------------------------
    {
      authorId: linh.id,
      exp: {
        title: "Colonial Hanoi Walking Tour",
        slug: "colonial-hanoi-walking-tour",
        subtitle: "The French Quarter through a historian's lens",
        description: "Hanoi's French Quarter is a living archive: the Opera House, the old press buildings, St. Joseph's Cathedral, Hoa Lo Prison. I'll walk you through the colonial layer that everyone sees but nobody explains.",
        category: "cultural",
        durationMinutes: 180,
        priceAmount: 750_000,
        maxGroupSize: 6,
        photos: [
          "https://images.pexels.com/photos/10181717/pexels-photo-10181717.jpeg?auto=compress&cs=tinysrgb&w=800",
          "https://images.pexels.com/photos/6794720/pexels-photo-6794720.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["5 colonial-era buildings", "Historian-guided narrative", "Hoa Lo Prison entry", "French-era cafe stop"],
        included: ["Hoa Lo Prison ticket", "Cafe stop", "Printed timeline handout"],
        schedule: [
          { time: "09:00", label: "Meet at Opera House" },
          { time: "09:20", label: "Press Quarter walk" },
          { time: "10:10", label: "St. Joseph's Cathedral" },
          { time: "11:00", label: "Hoa Lo Prison" },
          { time: "12:00", label: "Cafe debrief" },
        ],
        stopPlaceNames: ["St. Joseph's Cathedral", "Hoan Kiem Lake", "Cafe Giang"],
      },
    },
    {
      authorId: linh.id,
      exp: {
        title: "1000-Year Stories of the Old Quarter",
        slug: "thousand-year-stories-old-quarter",
        subtitle: "The 36 streets, each named for what it sold",
        description: "Every street in the Old Quarter used to be a guild -- silver, cotton, fish sauce, paper. The names stuck even when the goods didn't. I'll walk you through 8 of them and show you which trades still survive a thousand years later.",
        category: "cultural",
        durationMinutes: 180,
        priceAmount: 700_000,
        maxGroupSize: 6,
        photos: [
          "https://images.pexels.com/photos/6794720/pexels-photo-6794720.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["8 guild streets", "Surviving craft workshops", "Temple of the 36 guilds", "Street-name etymology"],
        included: ["Craft workshop visit", "Temple entry fees", "Traditional tea break"],
        schedule: [
          { time: "09:00", label: "Meet at Dong Xuan Market" },
          { time: "09:20", label: "Hang Bac (silver street)" },
          { time: "10:00", label: "Hang Ma (paper street)" },
          { time: "10:40", label: "Hang Gai (silk street)" },
          { time: "11:30", label: "Bach Ma Temple" },
          { time: "12:00", label: "Farewell tea" },
        ],
        stopPlaceNames: ["Dong Xuan Market", "Hoan Kiem Lake", "St. Joseph's Cathedral"],
      },
    },
    {
      authorId: linh.id,
      exp: {
        title: "French Quarter + Train Street",
        slug: "french-quarter-train-street",
        subtitle: "Colonial architecture meets the chaos of Train Street",
        description: "Two contrasting Hanoi moments in one afternoon: the quiet elegance of the French Quarter, then the controlled chaos of Train Street where the twice-daily train clears cafes by inches. Best done by people who like their history in contrasts.",
        category: "cultural",
        durationMinutes: 150,
        priceAmount: 550_000,
        maxGroupSize: 4,
        photos: [
          "https://images.pexels.com/photos/10181717/pexels-photo-10181717.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["French Quarter walk", "Train Street access", "Safe train-timing coaching", "Trackside coffee"],
        included: ["Train Street cafe fee", "Timing / safety briefing"],
        schedule: [
          { time: "15:00", label: "Opera House" },
          { time: "15:30", label: "French Quarter walk" },
          { time: "16:15", label: "Train Street cafe" },
          { time: "17:00", label: "Train passes (if scheduled)" },
          { time: "17:30", label: "Farewell" },
        ],
        stopPlaceNames: ["St. Joseph's Cathedral", "Hoan Kiem Lake"],
      },
    },

    // --------------------------- CHAU ---------------------------
    {
      authorId: chau.id,
      exp: {
        title: "Specialty Coffee Crawl",
        slug: "specialty-coffee-crawl",
        subtitle: "Four roasters, four vibes, two and a half hours",
        description: "Vietnam is the world's #2 coffee producer but Hanoi's specialty scene only caught up recently. Four roasters on the rise: a Japanese-trained pour-over bar, an egg-coffee original, a Saigon transplant, and a hidden rooftop. I know the baristas.",
        category: "culinary",
        durationMinutes: 150,
        priceAmount: 600_000,
        maxGroupSize: 3,
        photos: [
          "https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=800",
          "https://images.pexels.com/photos/2611817/pexels-photo-2611817.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["4 roasters", "Meet the baristas", "Vietnamese coffee history", "Take-home beans"],
        included: ["All 4 drinks", "100g of specialty beans", "Written guide"],
        schedule: [
          { time: "10:00", label: "Hidden Gem Coffee" },
          { time: "10:45", label: "Giang Cafe (egg coffee original)" },
          { time: "11:30", label: "The Workshop" },
          { time: "12:15", label: "Rooftop Roastery" },
          { time: "12:30", label: "Bean tasting + farewell" },
        ],
        stopPlaceNames: ["Cafe Giang", "The Hidden Gem Coffee", "Tranquil Books & Coffee"],
      },
    },
    {
      authorId: chau.id,
      exp: {
        title: "Art Gallery Hop",
        slug: "art-gallery-hop",
        subtitle: "Four galleries, contemporary Vietnamese art, one printed zine",
        description: "Hanoi's contemporary art scene is quietly one of the most alive in Southeast Asia. We'll visit four galleries showing painting, sculpture, and new media, and I'll introduce you to the artists I know personally. You'll leave with a printed zine of Vietnamese art commentary.",
        category: "art",
        durationMinutes: 180,
        priceAmount: 700_000,
        maxGroupSize: 5,
        photos: [
          "https://images.pexels.com/photos/1183992/pexels-photo-1183992.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["4 galleries", "Artist introductions when in town", "Zine included", "Meet a curator"],
        included: ["Gallery entries", "Printed zine", "Tea break at artist cafe"],
        schedule: [
          { time: "14:00", label: "Manzi Art Space" },
          { time: "14:45", label: "Nha San Collective" },
          { time: "15:30", label: "Work Room Four" },
          { time: "16:15", label: "VCCA Hanoi" },
          { time: "17:00", label: "Farewell tea" },
        ],
        stopPlaceNames: ["Cafe Giang", "St. Joseph's Cathedral"],
      },
    },
    {
      authorId: chau.id,
      exp: {
        title: "Bat Trang Ceramic Village Day Trip",
        slug: "bat-trang-ceramic-village",
        subtitle: "Throw a pot, fire it, take it home",
        description: "13 km outside the city, Bat Trang has been making ceramics for 700 years. Spend a day with a fourth-generation ceramicist: throw your own pot on the wheel, fire it, glaze it, and take it home. Includes transport, lunch, and shipping help if it doesn't fit in your carry-on.",
        category: "art",
        durationMinutes: 300,
        priceAmount: 1_400_000,
        maxGroupSize: 4,
        photos: [
          "https://images.pexels.com/photos/4207783/pexels-photo-4207783.jpeg?auto=compress&cs=tinysrgb&w=800",
        ],
        highlights: ["Throw your own pot", "Fire and glaze it", "Take it home", "Lunch with ceramicist family"],
        included: ["Round-trip transport", "All ceramic supplies", "Lunch", "Shipping coordination"],
        schedule: [
          { time: "09:00", label: "Pickup Old Quarter" },
          { time: "09:30", label: "Arrive Bat Trang" },
          { time: "10:00", label: "Wheel session" },
          { time: "12:00", label: "Lunch" },
          { time: "13:00", label: "Glazing" },
          { time: "14:00", label: "Return to city" },
        ],
        stopPlaceNames: ["Hoan Kiem Lake"],
      },
    },
  ];

  // Pre-query places for stop mapping so we don't re-query per tour.
  const allSeededPlaces = await db.select().from(schema.places);
  const placeByNamePrefix = (prefix: string) => {
    const p = allSeededPlaces.find((pl) => pl.name.toLowerCase().includes(prefix.toLowerCase()));
    return p ?? allSeededPlaces[Math.floor(Math.random() * Math.min(allSeededPlaces.length, 20))];
  };

  const insertedHostExps: { id: string; authorId: string; hostProfileId: string; priceAmount: number; title: string; stopPlaceNames: string[] }[] = [];

  for (let i = 0; i < hostExperiences.length; i++) {
    const { authorId, exp } = hostExperiences[i];
    // 1 published, days-ago between 30 and 90 so the "publishedAt" column
    // shows a realistic distribution.
    const publishedAt = new Date(Date.now() - (30 + (i * 7)) * 86400_000);
    const hostProfileIdx = hosts.findIndex((h) => h.id === authorId);
    const hostProfileId = hostProfileIds[hostProfileIdx];

    const trans = HOST_EXPERIENCE_TRANSLATIONS[exp.slug];
    const [row] = await db.insert(schema.experiences).values({
      title: exp.title,
      titleVi: trans?.title.vi,
      titleEn: trans?.title.en ?? exp.title,
      slug: exp.slug,
      subtitle: exp.subtitle,
      subtitleVi: trans?.subtitle.vi,
      subtitleEn: trans?.subtitle.en ?? exp.subtitle,
      description: exp.description,
      descriptionVi: trans?.description.vi,
      descriptionEn: trans?.description.en ?? exp.description,
      category: exp.category,
      durationMinutes: exp.durationMinutes,
      priceAmount: exp.priceAmount,
      maxGroupSize: exp.maxGroupSize,
      photos: exp.photos,
      highlights: exp.highlights,
      highlightsVi: trans?.highlights.vi,
      highlightsEn: trans?.highlights.en ?? exp.highlights,
      included: exp.included,
      includedVi: trans?.included.vi,
      includedEn: trans?.included.en ?? exp.included,
      schedule: exp.schedule,
      scheduleVi: trans?.schedule.vi,
      scheduleEn: trans?.schedule.en ?? exp.schedule,
      authorId,
      kind: "host_custom",
      status: "published",
      publishedAt,
      avgRating: (4.7 + Math.random() * 0.29).toFixed(2),
      totalBookings: 0, // will be incremented by the tour inserts below
    }).returning();

    insertedHostExps.push({
      id: row.id,
      authorId,
      hostProfileId,
      priceAmount: exp.priceAmount,
      title: exp.title,
      stopPlaceNames: exp.stopPlaceNames,
    });
  }
  console.log(`Seeded ${insertedHostExps.length} host-authored experiences.`);

  // Build host-authored bookings. For each host experience, emit:
  //   - 2 completed tours (historical, spread across the last 60 days)
  //   - 1 paid future tour (next 2 weeks)
  //   - 0 or 1 preview tour (undecided traveler)
  // Each tour books against a random traveler so the dashboard's "bookings
  // by traveler" would have variety if we ever add that view.
  let completedTourCount = 0;
  let paidFutureTourCount = 0;
  let previewTourCount = 0;
  let paymentCount = 0;
  let succeededPaymentSum = 0;

  for (let i = 0; i < insertedHostExps.length; i++) {
    const exp = insertedHostExps[i];
    const stops = exp.stopPlaceNames.map(placeByNamePrefix);

    // 2 completed tours per experience, staggered across the last 60 days.
    const completedOffsets = [5 + i * 7, 20 + i * 5];
    for (const daysAgo of completedOffsets) {
      const traveler = travelers[(i + daysAgo) % travelers.length];
      const scheduledDate = new Date(Date.now() - daysAgo * 86400_000);
      const scheduledIso = scheduledDate.toISOString().slice(0, 10);
      const startedAt = new Date(scheduledDate.getTime() + 10 * 3600_000);
      const completedAt = new Date(startedAt.getTime() + 3 * 3600_000);
      const groupSize = 1 + (daysAgo % 3);
      const totalPrice = exp.priceAmount * groupSize;

      const [tour] = await db.insert(schema.tours).values({
        userId: traveler.id,
        hostId: exp.hostProfileId,
        experienceId: exp.id,
        status: "completed",
        requestParams: { date: scheduledIso, startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize },
        tourData: { title: exp.title, description: `${exp.title} booking`, stops: stops.map((p, si) => ({ placeId: p.id, name: p.name, category: p.category, scheduledTime: `${10 + si}:00`, durationMinutes: 30, localTip: "", estimatedSpend: "$", travelToNext: "5 min walk" })), totalDurationMinutes: 180, estimatedCost: { min: totalPrice, max: totalPrice, currency: "VND" }, personalizationRationale: "Host-authored experience." },
        packageType: "host_custom",
        priceAmount: totalPrice,
        startedAt,
        completedAt,
      }).returning();

      for (let si = 0; si < stops.length; si++) {
        await db.insert(schema.tourStops).values({
          tourId: tour.id,
          placeId: stops[si].id,
          stopOrder: si,
          durationMinutes: 30,
          notes: `Visited ${stops[si].name}`,
          visitedAt: new Date(startedAt.getTime() + si * 30 * 60 * 1000),
        });
      }

      // Matching succeeded payment. `paidAt` lands just before tour start so
      // the revenue-by-day chart groups the money on the right bar.
      const paidAt = new Date(startedAt.getTime() - 2 * 86400_000);
      await db.insert(schema.payments).values({
        tourId: tour.id,
        userId: traveler.id,
        amount: totalPrice,
        currency: "VND",
        paymentMethod: "card",
        paymentGateway: "stripe",
        gatewayTxnId: `seed_ch_${tour.id.slice(0, 8)}`,
        status: "succeeded",
        paidAt,
      });
      paymentCount++;
      succeededPaymentSum += totalPrice;
      completedTourCount++;
    }

    // 1 paid future tour per experience (next 2 weeks). Covers "upcoming"
    // dashboard widgets and the /host/bookings Upcoming tab.
    {
      const daysAhead = 2 + (i % 12);
      const traveler = travelers[(i + 1) % travelers.length];
      const scheduledDate = new Date(Date.now() + daysAhead * 86400_000);
      const scheduledIso = scheduledDate.toISOString().slice(0, 10);
      const groupSize = 1 + (i % 2);
      const totalPrice = exp.priceAmount * groupSize;

      const [tour] = await db.insert(schema.tours).values({
        userId: traveler.id,
        hostId: exp.hostProfileId,
        experienceId: exp.id,
        status: "paid",
        requestParams: { date: scheduledIso, startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize },
        tourData: { title: exp.title, description: `${exp.title} booking`, stops: stops.map((p, si) => ({ placeId: p.id, name: p.name, category: p.category, scheduledTime: `${10 + si}:00`, durationMinutes: 30, localTip: "", estimatedSpend: "$", travelToNext: "5 min walk" })), totalDurationMinutes: 180, estimatedCost: { min: totalPrice, max: totalPrice, currency: "VND" }, personalizationRationale: "Host-authored experience." },
        packageType: "host_custom",
        priceAmount: totalPrice,
      }).returning();

      for (let si = 0; si < stops.length; si++) {
        await db.insert(schema.tourStops).values({
          tourId: tour.id,
          placeId: stops[si].id,
          stopOrder: si,
          durationMinutes: 30,
          notes: null,
        });
      }

      // One of the future payments goes in as 'pending' to demonstrate the
      // pending bucket on the balance card; the rest are 'succeeded' because
      // the traveler paid in full at booking time (current flow).
      const status = i === 3 ? "pending" : "succeeded";
      const paidAt = status === "succeeded" ? new Date(Date.now() - (i + 1) * 86400_000) : null;
      await db.insert(schema.payments).values({
        tourId: tour.id,
        userId: traveler.id,
        amount: totalPrice,
        currency: "VND",
        paymentMethod: "card",
        paymentGateway: "stripe",
        gatewayTxnId: `seed_ch_${tour.id.slice(0, 8)}`,
        status,
        paidAt,
      });
      paymentCount++;
      if (status === "succeeded") succeededPaymentSum += totalPrice;
      paidFutureTourCount++;
    }

    // Every third experience gets a preview-stage tour (traveler drafted but
    // hasn't paid). These never show up in revenue but exercise the status
    // filter on the upcoming-bookings query.
    if (i % 3 === 0) {
      const traveler = travelers[(i + 2) % travelers.length];
      const daysAhead = 7 + i;
      const scheduledIso = new Date(Date.now() + daysAhead * 86400_000).toISOString().slice(0, 10);
      await db.insert(schema.tours).values({
        userId: traveler.id,
        hostId: exp.hostProfileId,
        experienceId: exp.id,
        status: "preview",
        requestParams: { date: scheduledIso, startTime: "10:00", durationHours: 3, budgetLevel: "medium", interests: [], withHost: true, groupSize: 1 },
        tourData: { title: exp.title, description: "Preview -- not yet paid.", stops: [], totalDurationMinutes: 180, estimatedCost: { min: exp.priceAmount, max: exp.priceAmount, currency: "VND" }, personalizationRationale: "Host-authored experience." },
        packageType: "host_custom",
        priceAmount: exp.priceAmount,
      });
      previewTourCount++;
    }

    // Backfill totalBookings on the experience (completed + paid).
    await db
      .update(schema.experiences)
      .set({ totalBookings: 3 })
      .where(sql`id = ${exp.id}`);
  }

  // One refunded payment as the exception case. Pick Nam's first experience;
  // its second completed tour gets flipped to refunded so the payments
  // timeline shows a red status chip and the balance math subtracts the
  // refund amount.
  const refundTarget = await db.query.tours.findFirst({
    where: (t, { eq, and }) => and(eq(t.hostId, hostProfileIds[0]), eq(t.status, "completed")),
  });
  if (refundTarget) {
    await db.update(schema.payments)
      .set({ status: "refunded", refundAmount: refundTarget.priceAmount, refundReason: "Traveler cancelled due to illness" })
      .where(sql`tour_id = ${refundTarget.id}`);
    succeededPaymentSum -= refundTarget.priceAmount;
  }

  console.log(
    `Seeded ${completedTourCount} completed + ${paidFutureTourCount} paid-future + ${previewTourCount} preview host tours, ${paymentCount} payments (gross succeeded ~= ${succeededPaymentSum.toLocaleString()} VND).`,
  );

  // Host payouts. One paid row per host so the payout history isn't empty,
  // plus one pending forecast row for Nam to exercise the "Next payout"
  // balance-card math. Period boundaries use Monday-Sunday weekly windows.
  const mondayOf = (daysAgo: number): Date => {
    const d = new Date(Date.now() - daysAgo * 86400_000);
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); // back to Monday
    return d;
  };
  const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400_000);

  // Nam: paid payout for the week 21-14 days ago.
  const namWeekStart = mondayOf(21);
  await db.insert(schema.hostPayouts).values({
    hostId: hostProfileIds[0],
    amount: 3_120_000,
    currency: "VND",
    status: "paid",
    periodStart: namWeekStart,
    periodEnd: plusDays(namWeekStart, 6),
    paidAt: plusDays(namWeekStart, 8),
    bankReference: "VCB-240331-001",
  });

  // Linh: paid payout for the week 14-7 days ago.
  const linhWeekStart = mondayOf(14);
  await db.insert(schema.hostPayouts).values({
    hostId: hostProfileIds[1],
    amount: 2_250_000,
    currency: "VND",
    status: "paid",
    periodStart: linhWeekStart,
    periodEnd: plusDays(linhWeekStart, 6),
    paidAt: plusDays(linhWeekStart, 8),
    bankReference: "VCB-240407-002",
  });

  // Chau: paid payout for the week 28-21 days ago.
  const chauWeekStart = mondayOf(28);
  await db.insert(schema.hostPayouts).values({
    hostId: hostProfileIds[2],
    amount: 2_800_000,
    currency: "VND",
    status: "paid",
    periodStart: chauWeekStart,
    periodEnd: plusDays(chauWeekStart, 6),
    paidAt: plusDays(chauWeekStart, 8),
    bankReference: "VCB-240324-003",
  });

  console.log("Seeded 3 host payouts.");

  // -----------------------------------------------------------------------
  // Product-pivot seeds: activities (a-la-carte) + activity_slots +
  // merch products/variants. Anchors the new /activities browse, /cart,
  // /shop flows with enough breadth to test filters, time-conflict
  // detection, variant selection, and bundle discounts.
  // -----------------------------------------------------------------------

  interface ActivitySeed {
    authorIdx: 0 | 1 | 2; // nam, linh, chau
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    category: string; // workshop | ticket | class | food | performance | tour_lite
    priceVnd: number;
    durationMinutes: number;
    maxCapacityPerSlot: number;
    placeNamePrefix: string;
    photos: string[];
    highlights: string[];
    included: string[];
    requirements: string[];
    guideAddonVnd: number;
  }

  const activitySeeds: ActivitySeed[] = [
    // Nam (food + photography + nightlife)
    { authorIdx: 0, title: "Pho Making Class", slug: "pho-making-class", subtitle: "Build the broth, roll the noodles, eat the bowl", description: "A hands-on 2.5-hour class in a real Hanoi kitchen. You'll learn the 6-hour broth shortcut, the three-meat beef rule, and why fish sauce goes in last. End with a bowl you made yourself.", category: "workshop", priceVnd: 550_000, durationMinutes: 150, maxCapacityPerSlot: 6, placeNamePrefix: "Bun Cha Huong Lien", photos: ["https://images.pexels.com/photos/5848470/pexels-photo-5848470.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Real family kitchen", "Take home recipe card", "Your own bowl at the end"], included: ["All ingredients", "Apron", "Printed recipe"], requirements: ["Wear clothes you can get dirty"], guideAddonVnd: 150_000 },
    { authorIdx: 0, title: "Street Food Night Crawl", slug: "street-food-night-crawl", subtitle: "5 stops, 2 hours, zero fancy restaurants", description: "The actual dinner route a Hanoian would walk on a Friday night. Five plastic-stool stalls, one glass of bia hoi per stop, zero menus in English. Nam narrates. You eat.", category: "food", priceVnd: 380_000, durationMinutes: 120, maxCapacityPerSlot: 6, placeNamePrefix: "Bia Hoi Corner", photos: ["https://images.pexels.com/photos/28117159/pexels-photo-28117159.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["5 food stops", "Bia hoi included", "No tourist stops"], included: ["All tastings", "Bia hoi at each stop", "Water"], requirements: ["Empty stomach"], guideAddonVnd: 200_000 },
    { authorIdx: 0, title: "Train Street Photo Session", slug: "train-street-photo-session", subtitle: "The famous train passes -- safely -- and we catch it", description: "Access-gated since 2023. Nam has a contact at the cafe that lets us in. Timing-checked train passage, chef-quality egg coffee, and Nam's 10-minute crash course on exposure compensation for golden-hour selfies.", category: "ticket", priceVnd: 450_000, durationMinutes: 90, maxCapacityPerSlot: 4, placeNamePrefix: "Bia Hoi Corner", photos: ["https://images.pexels.com/photos/9811048/pexels-photo-9811048.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Train Street entry", "Egg coffee", "Photo coaching"], included: ["Cafe entry", "Egg coffee"], requirements: ["Smartphone or camera", "Closed shoes"], guideAddonVnd: 200_000 },
    { authorIdx: 0, title: "Bun Cha & Craft Beer Pairing", slug: "bun-cha-craft-beer", subtitle: "Hanoi's signature dish, five local-brew flights", description: "Bun cha is usually eaten with pickle water. Nam pairs it with five Vietnamese craft beers to show how smoke, fat, and hop acid dance. Ends with a take-home bottle.", category: "food", priceVnd: 620_000, durationMinutes: 120, maxCapacityPerSlot: 5, placeNamePrefix: "Bun Cha Huong Lien", photos: ["https://images.pexels.com/photos/5848470/pexels-photo-5848470.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Bun cha set", "5-flight beer pairing", "Take-home bottle"], included: ["Full meal", "5 beers", "Take-home bottle"], requirements: ["Age 18+"], guideAddonVnd: 150_000 },

    // Linh (culture + history + walking)
    { authorIdx: 1, title: "Old Quarter History Walk", slug: "old-quarter-history-walk", subtitle: "1000 years in 3 hours -- through 36 streets", description: "Linh walks you through the guild streets -- silver, silk, paper -- and shows which trades survived a millennium. Ends at the Temple of the 36 Guilds with a printed history zine.", category: "tour_lite", priceVnd: 500_000, durationMinutes: 180, maxCapacityPerSlot: 8, placeNamePrefix: "Dong Xuan Market", photos: ["https://images.pexels.com/photos/6794720/pexels-photo-6794720.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["8 guild streets", "Surviving craft workshops", "Printed zine"], included: ["Zine", "Water", "Temple entry"], requirements: ["Walking ~3 km"], guideAddonVnd: 0 },
    { authorIdx: 1, title: "Hoa Lo Prison Deep Tour", slug: "hoa-lo-prison-deep-tour", subtitle: "Beyond the audio guide -- the stories tourists miss", description: "The regular audio guide stays polite. Linh doesn't. 90 minutes inside Hoa Lo with the actual history of French colonial interrogation, the American 'Hanoi Hilton' narrative, and the escape that almost worked.", category: "ticket", priceVnd: 420_000, durationMinutes: 90, maxCapacityPerSlot: 6, placeNamePrefix: "St. Joseph", photos: ["https://images.pexels.com/photos/10181717/pexels-photo-10181717.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Prison entry included", "Historian-led", "Timeline handout"], included: ["Admission", "Handout"], requirements: ["Minimum age 14"], guideAddonVnd: 0 },
    { authorIdx: 1, title: "Vietnamese Calligraphy Class", slug: "calligraphy-class", subtitle: "Brush, ink, rice paper, your name in Han script", description: "A master calligrapher teaches you to write your name in traditional Han characters on rice paper. Take home your scroll. Linh translates and contextualises.", category: "workshop", priceVnd: 350_000, durationMinutes: 120, maxCapacityPerSlot: 5, placeNamePrefix: "Hoan Kiem", photos: ["https://images.pexels.com/photos/6794720/pexels-photo-6794720.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Master calligrapher", "Your name scroll", "Take home"], included: ["Ink", "Paper", "Brush", "Framing"], requirements: [], guideAddonVnd: 100_000 },
    { authorIdx: 1, title: "Water Puppet Theatre Tickets", slug: "water-puppet-theatre", subtitle: "The 1000-year-old art form, with a storyline briefing", description: "Premium seats at Thang Long Water Puppet Theatre. Linh briefs you on the storyline in advance (nobody else does this), so you actually follow the plot. Post-show cultural chat optional.", category: "performance", priceVnd: 280_000, durationMinutes: 60, maxCapacityPerSlot: 10, placeNamePrefix: "Hoan Kiem", photos: ["https://images.pexels.com/photos/10181717/pexels-photo-10181717.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Premium seats", "Pre-show briefing", "Story handout"], included: ["Ticket", "Briefing"], requirements: [], guideAddonVnd: 100_000 },

    // Chau (cafe + art + nature)
    { authorIdx: 2, title: "Egg Coffee Workshop", slug: "egg-coffee-workshop", subtitle: "Whip your own, learn the Giang family secret", description: "Cafe Giang invented egg coffee in 1946. Chau has a standing invitation to the back kitchen. Whip, pour, drink -- and learn why the egg white to yolk ratio is everything.", category: "workshop", priceVnd: 320_000, durationMinutes: 75, maxCapacityPerSlot: 4, placeNamePrefix: "Cafe Giang", photos: ["https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Giang family method", "Two drinks", "Recipe card"], included: ["2 drinks", "Recipe card"], requirements: [], guideAddonVnd: 100_000 },
    { authorIdx: 2, title: "Contemporary Art Gallery Tour", slug: "contemporary-art-tour", subtitle: "3 galleries, introductions to artists when in town", description: "Chau personally knows half the artists in Hanoi's contemporary scene. Three galleries in 2.5 hours, with a cafe debrief where she translates what you just saw.", category: "tour_lite", priceVnd: 480_000, durationMinutes: 150, maxCapacityPerSlot: 6, placeNamePrefix: "Hoan Kiem", photos: ["https://images.pexels.com/photos/1183992/pexels-photo-1183992.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["3 galleries", "Artist introductions", "Cafe debrief"], included: ["Gallery entries", "Cafe drink"], requirements: ["Walking ~2 km"], guideAddonVnd: 150_000 },
    { authorIdx: 2, title: "Tay Ho Lake Sunset Paddle", slug: "tay-ho-lake-paddle", subtitle: "Kayak West Lake at golden hour", description: "A 90-minute sunset kayak session on Tay Ho. Chau packs the snack box (banh mi + tra da). Bring your camera -- the Tran Quoc Pagoda reflection at 6:30 PM is the shot.", category: "ticket", priceVnd: 550_000, durationMinutes: 90, maxCapacityPerSlot: 4, placeNamePrefix: "Hoan Kiem", photos: ["https://images.pexels.com/photos/1183992/pexels-photo-1183992.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Sunset timing", "Snack box", "Banh mi + tra da"], included: ["Kayak", "Life vest", "Snack box"], requirements: ["Able to swim"], guideAddonVnd: 200_000 },
    { authorIdx: 2, title: "Bat Trang Pottery Throwing", slug: "bat-trang-pottery", subtitle: "Make, fire, glaze, take home", description: "700-year-old ceramic village 30 minutes out of town. Throw your own pot on a traditional wheel, fire it, glaze it, take it home. Transport + lunch included.", category: "workshop", priceVnd: 780_000, durationMinutes: 240, maxCapacityPerSlot: 4, placeNamePrefix: "Hoan Kiem", photos: ["https://images.pexels.com/photos/4207783/pexels-photo-4207783.jpeg?auto=compress&cs=tinysrgb&w=800"], highlights: ["Traditional wheel", "Take-home pot", "Lunch"], included: ["Transport", "Lunch", "Shipping help"], requirements: ["Closed shoes"], guideAddonVnd: 250_000 },
  ];

  const insertedActivities: { id: string; authorIdx: number; priceVnd: number; durationMinutes: number; maxCapacity: number; title: string; guideAddonVnd: number }[] = [];

  for (const a of activitySeeds) {
    const author = hosts[a.authorIdx];
    const place = allSeededPlaces.find((p) => p.name.toLowerCase().includes(a.placeNamePrefix.toLowerCase()));
    const trans = ACTIVITY_TRANSLATIONS[a.slug];
    const [row] = await db.insert(schema.activities).values({
      authorId: author.id,
      title: a.title,
      titleVi: trans?.title.vi,
      titleEn: trans?.title.en ?? a.title,
      slug: a.slug,
      subtitle: a.subtitle,
      subtitleVi: trans?.subtitle.vi,
      subtitleEn: trans?.subtitle.en ?? a.subtitle,
      description: a.description,
      descriptionVi: trans?.description.vi,
      descriptionEn: trans?.description.en ?? a.description,
      category: a.category,
      priceAmount: a.priceVnd,
      currency: "VND",
      durationMinutes: a.durationMinutes,
      maxCapacityPerSlot: a.maxCapacityPerSlot,
      placeId: place?.id ?? null,
      photos: a.photos,
      highlights: a.highlights,
      highlightsVi: trans?.highlights.vi,
      highlightsEn: trans?.highlights.en ?? a.highlights,
      included: a.included,
      includedVi: trans?.included.vi,
      includedEn: trans?.included.en ?? a.included,
      requirements: a.requirements,
      requirementsVi: trans?.requirements.vi,
      requirementsEn: trans?.requirements.en ?? a.requirements,
      guideOptional: true,
      guideAddonVnd: a.guideAddonVnd,
      status: "published",
      publishedAt: new Date(Date.now() - 15 * 86400_000),
      avgRating: (4.6 + Math.random() * 0.39).toFixed(2),
      totalBookings: 0,
    }).returning();
    insertedActivities.push({
      id: row.id,
      authorIdx: a.authorIdx,
      priceVnd: a.priceVnd,
      durationMinutes: a.durationMinutes,
      maxCapacity: a.maxCapacityPerSlot,
      title: a.title,
      guideAddonVnd: a.guideAddonVnd,
    });
  }
  console.log(`Seeded ${insertedActivities.length} activities.`);

  // Seed time slots: each activity gets 5-6 slots spread across the next
  // 14 days. Start times rotate across the day so the timeline-builder
  // conflict detection sees overlap candidates.
  const startHourPool = [9, 11, 14, 16, 18, 20];
  let totalSlots = 0;
  for (const act of insertedActivities) {
    const slotCount = 5 + (totalSlots % 2); // 5 or 6
    for (let s = 0; s < slotCount; s++) {
      const daysAhead = 1 + ((totalSlots + s) % 12);
      const hour = startHourPool[(s + act.authorIdx) % startHourPool.length];
      const startsAt = new Date();
      startsAt.setUTCDate(startsAt.getUTCDate() + daysAhead);
      startsAt.setUTCHours(hour - 7, 0, 0, 0); // convert VN hour -> UTC
      const endsAt = new Date(startsAt.getTime() + act.durationMinutes * 60 * 1000);
      // Some slots are partially booked to make the picker look realistic.
      const bookedCount = (totalSlots + s) % 3 === 0 ? Math.max(0, act.maxCapacity - 2) : 0;
      await db.insert(schema.activitySlots).values({
        activityId: act.id,
        startsAt,
        endsAt,
        capacity: act.maxCapacity,
        bookedCount,
        status: bookedCount >= act.maxCapacity ? "sold_out" : "open",
      });
      totalSlots++;
    }
  }
  console.log(`Seeded ${totalSlots} activity slots.`);

  // Merch catalogue. Six products across apparel / accessory / souvenir /
  // print categories, each with a handful of variants.
  interface ProductSeed {
    sku: string;
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    category: string;
    basePriceVnd: number;
    photos: string[];
    bundleDiscountPct: number;
    variants: { sku: string; label: string; attributes: Record<string, string>; priceOverride?: number; stock: number }[];
  }

  const productSeeds: ProductSeed[] = [
    {
      sku: "LCM-TEE-OQ",
      title: "Old Quarter Tee",
      slug: "old-quarter-tee",
      subtitle: "Street art print, pre-shrunk cotton",
      description: "A minimal line drawing of Ta Hien at 9 PM on a 100% cotton tee. Printed in a small Bac Ninh workshop. Sizes run Asian-fit -- we size up by default.",
      category: "apparel",
      basePriceVnd: 320_000,
      photos: [merchImage("old-quarter-tee")],
      bundleDiscountPct: 15,
      variants: [
        { sku: "LCM-TEE-OQ-S-BLK", label: "S / Black", attributes: { size: "S", color: "black" }, stock: 12 },
        { sku: "LCM-TEE-OQ-M-BLK", label: "M / Black", attributes: { size: "M", color: "black" }, stock: 18 },
        { sku: "LCM-TEE-OQ-L-BLK", label: "L / Black", attributes: { size: "L", color: "black" }, stock: 14 },
        { sku: "LCM-TEE-OQ-M-WHT", label: "M / White", attributes: { size: "M", color: "white" }, stock: 10 },
      ],
    },
    {
      sku: "LCM-HAT-PHO",
      title: "Pho Queue Cap",
      slug: "pho-queue-cap",
      subtitle: "Sun-bleached navy with embroidered pho bowl",
      description: "The cap every Hanoian grandpa wears queueing for pho at 6 AM, minus the sweat stains. Adjustable back, embroidered front.",
      category: "apparel",
      basePriceVnd: 220_000,
      photos: [merchImage("pho-queue-cap")],
      bundleDiscountPct: 10,
      variants: [
        { sku: "LCM-HAT-PHO-NVY", label: "Navy", attributes: { color: "navy" }, stock: 30 },
        { sku: "LCM-HAT-PHO-KHK", label: "Khaki", attributes: { color: "khaki" }, stock: 22 },
      ],
    },
    {
      sku: "LCM-TOTE-ALLEY",
      title: "Alley Map Tote",
      slug: "alley-map-tote",
      subtitle: "A hand-drawn map of the 36 streets",
      description: "Canvas tote with a hand-drawn map of the Old Quarter's 36 streets silkscreened on the back. Fits a laptop + lunch + souvenirs.",
      category: "accessory",
      basePriceVnd: 180_000,
      photos: [merchImage("alley-map-tote")],
      bundleDiscountPct: 20,
      variants: [
        { sku: "LCM-TOTE-ALLEY-NAT", label: "Natural", attributes: { color: "natural" }, stock: 40 },
      ],
    },
    {
      sku: "LCM-KEYC-MOTO",
      title: "Motorbike Keychain",
      slug: "motorbike-keychain",
      subtitle: "Enamel pin of a Honda Dream",
      description: "Hand-finished enamel keychain of the Honda Dream -- the motorbike that built Hanoi. Packaged in a recycled kraft envelope.",
      category: "souvenir",
      basePriceVnd: 95_000,
      photos: [merchImage("motorbike-keychain")],
      bundleDiscountPct: 25,
      variants: [
        { sku: "LCM-KEYC-MOTO-RED", label: "Red", attributes: { color: "red" }, stock: 50 },
        { sku: "LCM-KEYC-MOTO-BLU", label: "Blue", attributes: { color: "blue" }, stock: 50 },
      ],
    },
    {
      sku: "LCM-NBK-JRN",
      title: "Traveler's Journal",
      slug: "travelers-journal",
      subtitle: "Dotted pages, elastic band, cafe-tested",
      description: "A6 dotted-page journal, leather elastic band, 180 GSM recycled paper. Room for 120 stops' worth of notes.",
      category: "accessory",
      basePriceVnd: 280_000,
      photos: [merchImage("travelers-journal")],
      bundleDiscountPct: 15,
      variants: [
        { sku: "LCM-NBK-JRN-OCH", label: "Ochre", attributes: { color: "ochre" }, stock: 20 },
        { sku: "LCM-NBK-JRN-GRN", label: "Forest green", attributes: { color: "green" }, stock: 20 },
      ],
    },
    {
      sku: "LCM-PRNT-POSTER",
      title: "Hanoi Poster Print",
      slug: "hanoi-poster-print",
      subtitle: "A2 giclee print, numbered edition of 200",
      description: "Giclee art print on 310 GSM Hahnemuhle paper, A2 size, signed and numbered. Subject: Long Bien Bridge at dawn. Ships flat.",
      category: "print",
      basePriceVnd: 450_000,
      photos: [merchImage("hanoi-poster-print")],
      bundleDiscountPct: 10,
      variants: [
        { sku: "LCM-PRNT-POSTER-A2", label: "A2 / Unframed", attributes: { size: "A2", framed: "no" }, stock: 15 },
        { sku: "LCM-PRNT-POSTER-A2-FR", label: "A2 / Framed", attributes: { size: "A2", framed: "yes" }, priceOverride: 680_000, stock: 10 },
      ],
    },
  ];

  let totalVariants = 0;
  for (const p of productSeeds) {
    const trans = PRODUCT_TRANSLATIONS[p.slug];
    const [product] = await db.insert(schema.products).values({
      sku: p.sku,
      title: p.title,
      titleVi: trans?.title.vi,
      titleEn: trans?.title.en ?? p.title,
      slug: p.slug,
      subtitle: p.subtitle,
      subtitleVi: trans?.subtitle.vi,
      subtitleEn: trans?.subtitle.en ?? p.subtitle,
      description: p.description,
      descriptionVi: trans?.description.vi,
      descriptionEn: trans?.description.en ?? p.description,
      category: p.category,
      basePriceVnd: p.basePriceVnd,
      currency: "VND",
      photos: p.photos,
      isActive: true,
      bundleDiscountPct: p.bundleDiscountPct,
    }).returning();

    for (const v of p.variants) {
      await db.insert(schema.productVariants).values({
        productId: product.id,
        sku: v.sku,
        label: v.label,
        attributes: v.attributes,
        priceOverrideVnd: v.priceOverride ?? null,
        stockQuantity: v.stock,
        isActive: true,
      });
      totalVariants++;
    }
  }
  console.log(`Seeded ${productSeeds.length} products with ${totalVariants} variants.`);

  console.log("Seed complete!");

  await client.end();
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
