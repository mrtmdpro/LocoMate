# LOCOMATE - Place Data Pipeline Plan

**Goal:** Populate the database with real Hanoi venues including actual photos, verified descriptions, accurate coordinates, opening hours, and locally-scored experience/emotional tags.

**Status:** IMPLEMENTED. 996 real Hanoi places ingested as of April 14, 2026.

---

## Implemented Pipeline Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │           DATA SOURCES (ACTUAL)              │
                    ├──────────────┬──────────────┬────────────────┤
                    │ OpenStreetMap│ Pexels /     │ Manual Seed    │
                    │ Overpass API │ Wikimedia    │ (56 curated)   │
                    │ (FREE)       │ Commons      │                │
                    └──────┬───────┴──────┬───────┴───────┬────────┘
                           │              │               │
                           ▼              ▼               ▼
                    ┌──────────────────────────────────────────────┐
                    │   PIPELINE 1: RAW INGESTION (Overpass API)   │
                    │   39 category queries → deduplicate by name  │
                    │   + coordinates → append to production DB    │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │   PIPELINE 2: PHOTO ENRICHMENT               │
                    │   Wikimedia Commons for cultural/notable     │
                    │   Pexels pool (category-based) as fallback   │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │   PIPELINE 3: LOCAL TAG SCORING              │
                    │   Deterministic engine (no AI API calls)     │
                    │   Category + metadata → 8 experience tags    │
                    │   + 6 emotional tags (0.0-1.0)              │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │   PIPELINE 4: SLUG + PUBLISH                 │
                    │   Vietnamese diacritic stripping → slugify   │
                    │   DB-aware collision handling → direct insert │
                    └──────────────────────────────────────────────┘
```

---

## Pipeline 1: Raw Place Ingestion

### Option A: Google Places API (Recommended -- most complete)

**What it provides:** name, address, lat/lng, category, rating, review count, opening hours, photos (up to 10), price level, website, phone

**Cost:** $17 per 1,000 Place Details requests (first $200/month free = ~11,700 free calls)

**How it works:**
1. **Nearby Search** -- query by category within Hanoi bounding box (21.00-21.08 lat, 105.78-105.88 lng)
2. **Place Details** -- for each result, fetch full details + photos
3. **Categories to search:** `cafe`, `restaurant`, `bar`, `museum`, `temple`, `park`, `art_gallery`, `tourist_attraction`, `night_club`, `bakery`, `book_store`

**Script:** `scripts/pipeline-google-places.ts`
```typescript
// Pseudocode
for each category in CATEGORIES:
  results = googlePlaces.nearbySearch({
    location: { lat: 21.028, lng: 105.852 },
    radius: 5000,
    type: category
  })
  for each result:
    details = googlePlaces.getDetails(result.place_id, [
      'name', 'formatted_address', 'geometry', 'photos',
      'opening_hours', 'price_level', 'rating', 'reviews',
      'types', 'editorial_summary'
    ])
    insert into staging_places
```

**Volume estimate:** ~300-500 real places across all categories

### Option B: Foursquare Places API (Free tier -- good backup)

**What it provides:** name, address, lat/lng, category, photos, tips, rating, hours

**Cost:** Free up to 500 calls/day (Personal tier)

**How it works:**
1. **Search** by category + location
2. **Get Details** for photos and tips
3. Photos are direct URLs (no additional API call)

### Option C: Web Scraping (TripAdvisor / Google Maps)

**What it provides:** Same data as APIs but extracted from web pages

**Cost:** Free but legally gray; requires Puppeteer/Playwright

**Risk:** Terms of service violations; IP blocking; maintenance burden

**Recommendation:** Use only as fallback for places not found via APIs

### Option D: Manual Curation (Highest quality, lowest scale)

**What it provides:** Hand-picked hidden gems with original descriptions

**How it works:**
1. Team visits places in Hanoi
2. Takes original photos
3. Writes authentic descriptions
4. Scores tags manually

**Best for:** The top 50 "hero" hidden gems that define the brand. API-sourced places fill the long tail.

### Recommended Hybrid Strategy

| Tier | Count | Source | Quality |
|------|-------|--------|---------|
| Hero Hidden Gems | 50 | Manual curation | Highest |
| Verified Popular | 150 | Google Places API | High |
| Extended Discovery | 200 | Foursquare + Google | Medium |
| **Total** | **400** | | |

---

## Pipeline 2: Photo Enrichment

### For API-sourced places

**Google Places Photos API:**
- Each place returns up to 10 `photo_reference` tokens
- Call `getPhoto(photo_reference, maxwidth=800)` to get the actual image
- Cost: $7 per 1,000 photo requests
- Photos are high quality, user-submitted, and rights-cleared for display

**Storage:**
- Download and upload to **Supabase Storage** (or S3)
- Store as `places/{place_id}/photo-{index}.webp`
- Generate responsive sizes (400w, 800w, 1200w)
- Store public URLs in the `photos[]` array

### For manual curated places

- Original photos taken on-site
- Edited for consistent style (crop, color grade)
- Uploaded directly to storage

### For places without good photos

**Unsplash API fallback:**
- Search by `{place_name} hanoi` or `{category} vietnam`
- Use the top result as a placeholder
- Mark as `photo_source: "unsplash"` for future replacement

---

## Pipeline 3: Local Tag Scoring Engine (No External AI)

Instead of paying for GPT API calls, a **local deterministic scoring engine** computes all 14 tags from the structured data already fetched from Google/Foursquare. Zero API cost, runs instantly, fully reproducible.

**Input per place:**
- `category` (cafe, restaurant, temple, bar, etc.)
- `price_level` (0-4 from Google)
- `rating` (1.0-5.0)
- `review_count` (integer)
- `opening_hours` (structured)
- `reviews_sample` (text array -- top 5 reviews)
- `types[]` (Google place types array)
- `lat/lng` (distance from Old Quarter center)

**How each tag is scored (0.0-1.0):**

### Experience Tags

| Tag | Scoring Logic |
|-----|---------------|
| `authenticity` | Base by category (temple=0.9, cafe=0.6) + bonus if review_count < 200 (less touristy) + bonus if not in `tourist_attraction` types |
| `popularity` | Normalized `review_count` (log scale, capped at 1.0 for 1000+ reviews) |
| `uniqueness` | Inverse of count of places in same category within 200m radius. Singleton = 1.0, dense cluster = 0.3 |
| `price_level` | Direct map: Google 0→0.1, 1→0.3, 2→0.5, 3→0.7, 4→0.9 |
| `accessibility` | 1.0 if on main road (types includes `establishment`), penalty if far from transit, bonus if wheelchair-accessible |
| `duration` | Category-based: restaurant=0.4, museum=0.7, cafe=0.3, park=0.6, temple=0.5 |
| `indoor_outdoor` | Category-based: cafe/restaurant/museum=0.9 (indoor), park/garden=0.1, temple=0.5 |
| `noise_level` | Category-based: bar/nightclub=0.9, temple/museum=0.1, cafe=0.4, restaurant=0.5 |

### Emotional Tags -- Keyword Analysis on Reviews

Scan `reviews_sample` text for keyword clusters and compute frequency scores:

| Tag | Keyword Clusters |
|-----|-----------------|
| `relaxing` | "peaceful", "quiet", "chill", "calm", "serene", "relax", "escape", "tranquil" |
| `exciting` | "amazing", "wow", "incredible", "thrilling", "adventure", "fun", "energetic", "lively" |
| `social` | "friends", "group", "crowd", "people", "vibe", "atmosphere", "bustling", "meet" |
| `inspiring` | "beautiful", "stunning", "breathtaking", "artistic", "creative", "culture", "history" |
| `immersive` | "authentic", "local", "real", "experience", "hidden", "gem", "unique", "genuine" |
| `nostalgic` | "old", "traditional", "ancient", "heritage", "classic", "vintage", "historic", "colonial" |

**Algorithm:**
1. Concatenate all review texts into one string (lowercase)
2. For each emotional tag, count how many keywords from its cluster appear
3. Score = `min(1.0, matches / threshold)` where threshold = 3 for balanced scoring
4. Apply category-based floor (e.g., temples always get `nostalgic >= 0.5`)

**Fallback:** If no reviews available, use category-based defaults:

```
CATEGORY_DEFAULTS = {
  cafe:       { relaxing: 0.7, exciting: 0.3, social: 0.5, inspiring: 0.4, immersive: 0.5, nostalgic: 0.3 },
  restaurant: { relaxing: 0.4, exciting: 0.5, social: 0.6, inspiring: 0.3, immersive: 0.6, nostalgic: 0.4 },
  cultural:   { relaxing: 0.6, exciting: 0.3, social: 0.3, inspiring: 0.8, immersive: 0.8, nostalgic: 0.8 },
  nature:     { relaxing: 0.9, exciting: 0.3, social: 0.3, inspiring: 0.7, immersive: 0.6, nostalgic: 0.5 },
  nightlife:  { relaxing: 0.2, exciting: 0.8, social: 0.9, inspiring: 0.2, immersive: 0.5, nostalgic: 0.2 },
  workshop:   { relaxing: 0.5, exciting: 0.5, social: 0.6, inspiring: 0.8, immersive: 0.9, nostalgic: 0.5 },
  art:        { relaxing: 0.6, exciting: 0.3, social: 0.3, inspiring: 0.9, immersive: 0.7, nostalgic: 0.5 },
}
```

**Cost:** $0. Runs locally in ~1 second for 400 places.

**Script:** `scripts/pipeline-local-tags.ts`

---

## Pipeline 4: Validation & Publish

### Staging → Production flow

1. All pipeline outputs land in a `staging_places` table (not the live `places` table)
2. Admin review page shows places pending approval with:
   - Map pin location
   - Photos gallery
   - AI-generated tags (adjustable)
   - Description (editable)
   - Category (selectable)
3. Admin clicks "Approve" → copies to production `places` table with `is_verified = true`
4. Admin clicks "Reject" → marks as rejected with reason

### Deduplication

Places from multiple sources may overlap. Dedup by:
1. **Exact name match** (case-insensitive, after normalizing Vietnamese diacritics)
2. **Proximity match** (< 50m between coordinates + similar name)
3. **Google Place ID** as canonical identifier when available

---

## Implementation Plan

### Phase 1: Google Places Pipeline (1-2 days)

Files to create:
```
scripts/
├── pipeline-google-places.ts    # Fetch + store raw place data
├── pipeline-foursquare.ts       # Backup source for additional places
├── pipeline-photos.ts           # Download and upload photos
├── pipeline-local-tags.ts       # Local deterministic tag scoring engine
├── pipeline-publish.ts          # Move from staging to production
└── lib/
    ├── google-places.ts         # Google Places API wrapper
    ├── foursquare.ts            # Foursquare API wrapper
    ├── photo-storage.ts         # Upload to Supabase Storage
    └── tag-scorer.ts            # Deterministic tag scoring (no AI)
```

New DB table:
```sql
CREATE TABLE staging_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id VARCHAR(255) UNIQUE,
  foursquare_id VARCHAR(255),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address VARCHAR(300),
  photos_raw JSONB DEFAULT '[]',
  photos_processed TEXT[] DEFAULT '{}',
  opening_hours JSONB,
  price_level INT,
  google_rating DECIMAL(2,1),
  google_review_count INT,
  reviews_sample JSONB DEFAULT '[]',
  experience_tags JSONB DEFAULT '{}',
  emotional_tags JSONB DEFAULT '{}',
  source VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2: Foursquare Pipeline (1 day)

Same structure as Google, different API wrapper. Merges into same staging table.

### Phase 3: Local Tag Scoring (0.5 days)

Run the local deterministic scoring engine on all staging places. Keyword-analyzes reviews for emotional tags, uses category + metadata for experience tags. No external API calls.

### Phase 4: Admin Review UI (1-2 days)

Simple admin page at `/admin/places` showing staging places with approve/reject actions.

### Phase 5: Manual Curation Tool (1 day)

Form at `/admin/places/new` for manually adding hero hidden gems with photo upload.

---

## API Keys Required

| Service | Free Tier | Needed For | Sign Up |
|---------|-----------|-----------|---------|
| Google Places API | $200/mo credit (~11,700 calls) | Place search, details, photos | console.cloud.google.com |
| Foursquare Places | 500 calls/day | Backup source, extra photos | developer.foursquare.com |
| Supabase Storage | 1GB free | Photo hosting | supabase.com (already have) |

**No OpenAI API needed** -- tag scoring is done by the local deterministic engine.

**Total cost to populate 400 real places: ~$5-10 one-time** (Google Photos API calls only, within free tier)

---

## Data Quality Targets

| Field | Target Coverage | Source |
|-------|----------------|--------|
| Name | 100% | Google/Foursquare |
| Coordinates | 100% | Google/Foursquare |
| Address | 100% | Google/Foursquare |
| Category | 100% | Mapped from API types |
| Photos (>= 2) | >= 95% | Google Photos API + Unsplash fallback |
| Description | 100% | API editorial summary + GPT enhancement |
| Opening hours | >= 70% | Google Places |
| Price range | >= 80% | Google price_level + GPT inference |
| Experience tags (8) | 100% | GPT-4o-mini scoring |
| Emotional tags (6) | 100% | GPT-4o-mini scoring |
| Rating | >= 90% | Google rating |
| Review count | >= 90% | Google review count |

---

## Actual Implementation (April 2026)

### What was built

Instead of Google Places API (paid), we used **OpenStreetMap Overpass API** (free, open data) as the primary source.

**Scripts created:**

| Script | Purpose |
|--------|---------|
| `scripts/pipeline-run.ts` | Main pipeline: OSM fetch → photo enrichment → tag scoring → DB insert with slug |
| `scripts/lib/overpass.ts` | Overpass API wrapper with 39 category queries, 5s rate limiting, expanded Hanoi bbox |
| `scripts/lib/tag-scorer.ts` | Local deterministic tag scorer (no AI API calls) |
| `scripts/lib/photo-fetcher.ts` | Wikimedia Commons for cultural places, Pexels pool fallback |
| `scripts/backfill-slugs.ts` | Backfill slugs for existing places |
| `scripts/pipeline-missing.ts` | Targeted re-fetch for categories that hit rate limits |
| `scripts/cleanup-mock.ts` | Phase out mock data where real OSM data exists |

**OSM categories queried (39 total):**
- Cafe: `amenity=cafe`, `shop=coffee`, `amenity=ice_cream`, coffee-cuisine restaurants
- Restaurant: `amenity=restaurant`, `amenity=fast_food`, `amenity=food_court`, `shop=bakery`
- Cultural: `tourism=museum`, Buddhist/Taoist/Confucian temples, monuments, memorials, ruins, castles, attractions, theatres, libraries, viewpoints
- Nature: `leisure=park`, `leisure=garden`, named water bodies, nature reserves, playgrounds
- Nightlife: `amenity=bar`, `amenity=pub`, `amenity=nightclub`, `amenity=biergarten`
- Art: `tourism=gallery`, `shop=art`, `amenity=arts_centre`, `shop=photo`
- Workshop: `craft`, tourism info offices, `shop=handicraft`, cooking schools, dance venues

**Hanoi bounding box:** `20.96,105.76,21.10,105.92` (Old Quarter + West Lake + Ba Dinh + Dong Da + Hai Ba Trung)

### Results

| Metric | Value |
|--------|-------|
| Total places in DB | 996 |
| From OSM pipeline | 940 |
| From manual seed (curated) | 56 |
| All have photos | Yes (100%) |
| All have slugs | Yes (100%) |
| All have experience tags (8) | Yes (100%) |
| All have emotional tags (6) | Yes (100%) |
| API cost | $0 (all free APIs) |

**Category breakdown:**

| Category | Count | Source |
|----------|-------|--------|
| Restaurant | 284 | 248 OSM + 36 seed |
| Cultural | 244 | 244 OSM |
| Nightlife | 177 | 177 OSM |
| Nature | 155 | 155 OSM |
| Cafe | 85 | 54 OSM + 31 seed |
| Workshop | 29 | 29 seed |
| Art | 22 | 22 OSM |

### Key decisions

1. **OpenStreetMap over Google Places** -- Free, no API key, open data license. Trade-off: fewer photos and no reviews, compensated by Pexels/Wikimedia photo pools and category-based default tags.
2. **No staging table** -- Direct insert to production `places` table in append mode (skip duplicates by name). Simpler than the planned staging → review → publish flow.
3. **No AI API calls for tags** -- Local deterministic scoring engine based on category, coordinates, and OSM metadata. Zero external API cost.
4. **Slug generation at pipeline time** -- Vietnamese diacritic stripping + ASCII conversion + DB-aware collision handling. Every place gets a human-readable URL slug.
