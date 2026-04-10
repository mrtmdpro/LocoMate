# LOCOMATE - Place Data Pipeline Plan

**Goal:** Replace all 216 mock places with real Hanoi venues including actual photos, verified descriptions, accurate coordinates, opening hours, and AI-scored experience/emotional tags.

---

## Pipeline Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │           DATA SOURCES                       │
                    ├──────────┬──────────┬──────────┬─────────────┤
                    │ Google   │ Foursquare│ TripAdvisor│ Manual    │
                    │ Places   │ Places   │ Scrape   │ Curation   │
                    │ API      │ API      │          │            │
                    └────┬─────┴────┬─────┴────┬─────┴─────┬──────┘
                         │          │          │           │
                         ▼          ▼          ▼           ▼
                    ┌──────────────────────────────────────────────┐
                    │         PIPELINE 1: RAW INGESTION            │
                    │  Normalize → Deduplicate → Store in staging  │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │         PIPELINE 2: PHOTO ENRICHMENT         │
                    │  Google Place Photos → Upload to Supabase    │
                    │  OR Unsplash search → Match by place name    │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │         PIPELINE 3: AI TAG SCORING           │
                    │  GPT-4o-mini scores experience + emotional   │
                    │  tags (0.0-1.0) from description + reviews   │
                    └─────────────────────┬────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │         PIPELINE 4: VALIDATION & PUBLISH     │
                    │  Human review queue → Publish to production  │
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

## Execution Order

1. **Now:** Get Google Cloud API key, enable Places API
2. **Day 1:** Build + run Pipeline 1 (Google Places ingestion) → ~300 raw places in staging
3. **Day 1:** Build + run Pipeline 2 (Photo download) → photos stored
4. **Day 2:** Run Pipeline 3 (local tag scorer) → all places scored deterministically from metadata + reviews
5. **Day 2:** Build Pipeline 4 (publish script) → move to production, replacing mock data
6. **Day 3:** Add Foursquare for additional ~100 places
7. **Day 3-4:** Manual curation of top 50 hero hidden gems
8. **Day 4:** Admin review UI for ongoing place management

**Result: 400+ real Hanoi places with actual photos, verified data, and AI-scored tags.**
