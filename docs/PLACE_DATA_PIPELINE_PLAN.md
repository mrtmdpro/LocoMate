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

## Pipeline 3: AI Tag Scoring

Currently, experience and emotional tags are manually assigned (or random for generated places). This pipeline automates scoring using GPT-4o-mini.

**Input per place:**
- Name, category, description
- Google reviews (top 5)
- Price level, rating, location context

**Prompt:**
```
Given this place in Hanoi, Vietnam, score each tag from 0.0 to 1.0:

Place: {name}
Category: {category}
Description: {description}
Reviews: {reviews_summary}
Price level: {price_level}
Rating: {rating}/5

Experience tags to score:
- authenticity (how local/non-touristy)
- popularity (how well-known)
- uniqueness (how rare/special)
- price_level (0=cheap, 1=expensive)
- accessibility (ease of finding/entering)
- duration (0=quick stop, 1=hours-long)
- indoor_outdoor (0=outdoor, 1=indoor)
- noise_level (0=quiet, 1=loud)

Emotional tags to score:
- relaxing, exciting, social, inspiring, immersive, nostalgic

Return JSON only.
```

**Cost:** ~$0.01 per place (GPT-4o-mini) = $4 for 400 places

**Script:** `scripts/pipeline-ai-tags.ts`

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
├── pipeline-photos.ts           # Download and upload photos
├── pipeline-ai-tags.ts          # Score experience/emotional tags
├── pipeline-publish.ts          # Move from staging to production
└── lib/
    ├── google-places.ts         # Google Places API wrapper
    ├── photo-storage.ts         # Upload to Supabase Storage
    └── ai-scorer.ts             # GPT tag scoring
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

### Phase 3: AI Enrichment (0.5 days)

Batch process all staging places through GPT-4o-mini for tag scoring and description enhancement.

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
| OpenAI API | Pay-as-you-go (~$4 for 400 places) | Tag scoring, description gen | platform.openai.com |
| Supabase Storage | 1GB free | Photo hosting | supabase.com (already have) |

**Total cost to populate 400 real places: ~$10-20 one-time** (within free tiers)

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
4. **Day 2:** Build + run Pipeline 3 (AI tag scoring) → all places have tags
5. **Day 2:** Build Pipeline 4 (publish script) → move to production, replacing mock data
6. **Day 3:** Add Foursquare for additional ~100 places
7. **Day 3-4:** Manual curation of top 50 hero hidden gems
8. **Day 4:** Admin review UI for ongoing place management

**Result: 400+ real Hanoi places with actual photos, verified data, and AI-scored tags.**
