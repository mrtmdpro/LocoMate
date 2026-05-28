# LOCOMATE — Product Requirements Document (PRD)

**Version:** 2.0
**Date:** May 26, 2026
**Scope:** Hanoi Pilot (Fixed Tour Matrix + Customized Tours + à-la-carte Activities + Merch + eSIM)
**Platform:** Progressive Web App (PWA), bilingual VI/EN

This PRD supersedes v1.0 (April 2026). The team meeting on May 25–26 locked in the
Fixed Tour Matrix as the core inventory and reframed Locomate as a **heritage-tourism
experience platform** for Hanoi rather than a generic AI-planner. Source documents:

- [docs/dav startup .md](../../docs/dav%20startup%20.md) — brand identity & feature
  taxonomy (April pitch).
- [docs/sửa .md](../../docs/sửa%20.md) — production-ready spec for the 15-tour
  catalog, taxonomy, DDL, REST API, and 4-D matching engine (May 26).

The technical contract for the catalog is described in [TRD §3.x Fixed Tour
Catalog](TRD.md) and implemented by
[`app/src/server/routers/fixedTour.router.ts`](../src/server/routers/fixedTour.router.ts).

---

## 1. Product Overview

### 1.1 Product Name
**LOCOMATE** — A heritage-tourism platform that pairs travelers with curated
Hanoi experiences through cultural personality matching.

### 1.2 Slogan
*Go a place, know its grace* — Đi cho đúng, gặp cho trúng.

### 1.3 Positioning (revised)
LOCOMATE is not "ChatGPT + Google Maps for travelers". LOCOMATE is a **bilingual
curated experience marketplace** that:

1. Profiles each traveler against a 4-axis cultural personality vector
   (`Art_Aesthetic`, `Deep_History_Heritage`, `Culinary_Enthusiast`,
   `Slow_Living`) through a conversational onboarding quiz.
2. Matches them against a **chapter-organized catalog of 15 storyline-driven
   Fixed Tours** ("Bình minh lên phố" / "Nắng trưa thong dong" / "Lên đèn
   chớm đêm"), all run by local guides ("Bạn Lối"), with bilingual scripts
   and culturally significant stops.
3. Layers on **Customized Tours**, **à-la-carte Activities**, **merch**, and
   **eSIM bundles** for travelers who want to compose their own itinerary or
   take a piece of Hanoi home.
4. Closes the loop with a **post-tour Wrap-up letter** that travelers
   voluntarily share to Instagram/TikTok, driving organic acquisition.

### 1.4 Scope of Implementation
This PRD describes the **MVP through Phase 2** of the Hanoi pilot. Algorithmic
tour generation from `/plan` is preserved as a budget alternative but no longer
the headline product.

---

## 2. Problem Statement

Solo and small-group travelers visiting Hanoi face three structural problems:

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Generic itineraries** | Free AI itineraries from ChatGPT pull from the same global travel-blog corpus; everyone ends up at the same Hồ Gươm photo spot |
| 2 | **No cultural framing** | Standard listicles describe what a place is, not why it matters culturally; travelers feel like spectators |
| 3 | **Pricing opacity & "chặt chém" anxiety** | Street-food prices vary by who's asking; budget can spiral on a whim |

LOCOMATE targets the segment willing to pay **VND 1M–1.5M (≈ $40–$60) per
half-day** to be guided by a vetted local through a curated cultural storyline,
with prices fixed in advance and paid by card.

---

## 3. Target Users

### 3.1 Traveler (primary)
- **Demographics:** 20–35, Gen Z / Millennials / digital nomads, mostly inbound
  international (English-speaking) plus domestic VN travelers visiting from HCMC
  / Da Nang.
- **Income:** $5,000–$10,000/month.
- **Behavior:** Tech-savvy, plans through TikTok / Instagram screenshots,
  prefers "authentic local" over mass tourism, captures content to share.
- **Willingness to pay:** $40–$60 USD for a half-day curated experience;
  $80–$120 for a guided full day.

### 3.2 Local Guide ("Bạn Lối") — secondary supply side
- **Demographics:** 18–30, students or freelancers in Hanoi.
- **Skills:** Conversational English, a personality archetype the system tracks
  (*Nhà nghiên cứu thâm trầm* / *Người bạn lém lỉnh*), deep neighborhood
  knowledge.
- **Motivation:** Flexible income, language practice, sharing culture, building
  a reputation through verified ratings.

### 3.3 Local Merchant (food + workshop partners)
Cafés, eateries, artisan workshops in the Old Quarter / Tây Hồ / Bát Tràng that
opt in to the B2B sỉ price list and accept Locomate's QR-verified group
arrivals.

---

## 4. Product Architecture

LOCOMATE is one Web/PWA app composed of four user-visible subsystems plus the
shared profile engine:

```
+-----------------+   +-----------------+   +-----------------+   +-----------------+
|  Fixed Tour     |   |  Customized     |   |   Activities    |   |   Merch + eSIM  |
|   Matrix        |   |   Tour          |   |   (à-la-carte)  |   |   bundles       |
| (15 stories /   |   | (build-your-    |   | (workshops,     |   | (handover +     |
|  3 chapters)    |   |  own + guide)   |   |  food crawls)   |   |  digital wrap)  |
| PAID 1M–1.5M    |   | PAID 1M–3M      |   | PAID 200k–800k  |   | 50k–500k        |
+-------+---------+   +-------+---------+   +-------+---------+   +-------+---------+
        |                     |                     |                     |
        +---------+-----------+---------------------+---------------------+
                  |
        +-------------------+
        |  Cultural         |
        |  Personality      |   <— 4-D vector + behavioural signals
        |  Engine           |
        +-------------------+
```

The **LocoRec** discovery feed (996 OSM-sourced places, free) remains as a
funnel layer feeding both the Customized Tour builder and the Activities
catalog.

---

## 5. Functional Requirements

### 5.1 Brand Identity & Onboarding (NEW — May 2026 spec)

Locomate is "experienced" as soon as the user opens the app, not after they
buy. The following identity surfaces are part of the product, not skinning.

#### FR-BRAND-01: Theme & Mode Customization
- Light mode: **"Nắng Sớm Tràng An"** — porcelain, terracotta, ink-wash motif.
- Dark mode: **"Đêm Sâu Phố Cổ"** — slate, low-amber, lantern motif.
- Tokens already live in [`TYPOGRAPHY.md`](TYPOGRAPHY.md); the named themes
  are the marketing wrapper around the existing tokens.
- Toggle persists per-user (`user_profiles.implicitData.themeName`).

#### FR-BRAND-02: Personalized Greeting ("Gọi tên thân mật")
- Onboarding step asks: *"Hôm nay, Locomate xin phép được gọi bạn là gì để
  thêm phần thân mật? (Ví dụ: Kẻ lữ hành, Cậu cả, Nàng thơ…)"*
- Stored as `users.displayName` (already exists). The greeting copy on
  `/home`, post-tour letters, and the Wrap-up uses this name verbatim instead
  of `email_local_part`.

#### FR-BRAND-03: Profile Icon Store ("Cửa hàng Biểu tượng Hồ sơ")
- Loyalty points earned from completed bookings can be redeemed for
  Vietnam-themed avatar accessories (Khuyên tai, Nón ba tầm, Quạt giấy,
  Guốc mộc).
- Phase 2 feature; schema parked under `user_profiles.implicitData.icons[]`
  to avoid a separate table for the MVP.

#### FR-BRAND-04: Bilingual AI Chatbot Onboarding
- Replaces the legacy 4-step form. A chat-style quiz at `/onboarding/chat`
  collects answers across 5–8 turns.
- Languages selectable: Tiếng Việt, English, Français (Phase 2: more).
- Three personality "tones" of the bot copy: *Thủ thỉ tâm tình* (intimate),
  *Hóm hỉnh lém lỉnh* (playful), *Trực diện nhanh gọn* (direct).
- Output: a **4-D personality vector** stored at
  `user_profiles.derivedData.personalityVector` =
  `[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`.
- The mapping from quiz answers to the 4-axis vector lives in
  [`app/src/lib/quiz-questions.ts`](../src/lib/quiz-questions.ts). The math is
  deterministic and runs client-side; the server only validates the bounds.

#### FR-AUTH-01..03: Account creation
- Email/password + Google OAuth (Arctic + jose). Apple deferred.
- Phone OTP is **cut for MVP** (international travelers can't easily receive
  VN SMS; adds Twilio cost; not blocking growth).
- Identity verification (CCCD/Passport) is required only for the **Guide**
  role, not travelers.

---

### 5.2 LocoRec — Place Discovery (FREE)

#### FR-REC-01..05: Unchanged from v1.0
- 996 real Hanoi places sourced from OpenStreetMap with Pexels/Wikimedia
  photos.
- 8-dimension `experience_tags` + 6-dimension `emotional_tags`, locally
  scored by `scripts/lib/tag-scorer.ts`.
- Slug-based human-readable URLs (`/explore/egg-coffee-at-giang-cafe`).
- Map view via Leaflet + OSM tiles ($0).
- Save/bookmark, place detail with "Why It Fits You" rationale.

LocoRec is the **top of the funnel** for travelers who want to browse before
committing. Sales convert from LocoRec → Customized Tour or → Activities.

---

### 5.3 Fixed Tour Matrix (CORE — replaces v1 "Premium Experiences")

#### FR-FT-01: Catalog Structure
A **15-tour curated catalog** organized into three time-of-day chapters. The
authoritative content (titles VI+EN, storyScript VI+EN, itinerary, tags, base
prices, 4-D vectors) is seeded from [docs/sửa .md §3](../../docs/s%E1%BB%ADa%20.md)
into tables `fixed_tours`, `fixed_tour_steps`, `fixed_tour_tags`.

| Chapter | Time | Tours | Tour IDs |
|---|---|---|---|
| **Bình minh lên phố** (Morning) | 06:00 – 11:30 | 5 | `LOCO_FT_M1` … `LOCO_FT_M5` |
| **Nắng trưa thong dong** (Afternoon) | 13:30 – 17:30 | 5 | `LOCO_FT_A1` … `LOCO_FT_A5` |
| **Lên đèn chớm đêm** (Evening) | 18:00 – 22:30 | 5 | `LOCO_FT_E1` … `LOCO_FT_E5` |

Each tour has:
- **Storyline (cốt truyện)** — short bilingual prose framing the cultural
  thread of the experience.
- **Field itinerary (hành trình thực địa)** — 3–4 ordered stops with lat/lng
  and minute offsets from start.
- **Material tags** (`#ThanhTao`, `#HonDat`, `#HuongMen`) — the 3
  heritage / craft / food themes.
- **Persona tags** — the 4 personality axes the tour rewards.
- **Keyword tags** — free-form SEO bait (`Sunrise`, `Phở_Culture`,
  `Bún_Chả`, `Indochine_Architecture`, …).
- **4-D vector** — the canonical configuration in
  [docs/sửa .md §5.2](../../docs/s%E1%BB%ADa%20.md) used by the cosine matcher.

#### FR-FT-02: Catalog Browse + Filter
- `/fixed-tours` chapter hub — three vertical sections, ranked by the user's
  personality vector when signed in (otherwise canonical `tour_id` order).
- Material filter (one or more of `#ThanhTao`/`#HonDat`/`#HuongMen`)
  narrows results.
- Match pill (`92%`) renders on each card when the user has completed the
  quiz. Anonymous users see no pill (no fake number).

#### FR-FT-03: Tour Detail
- `/fixed-tours/[tourId]` shows: bilingual title + story, ordered itinerary
  with map pins, the "Why It Fits You" rationale (chapter + matched persona
  axes), price, max group size (default 6), duration (default 4h).
- A **Book** dialog collects `{ date, startTime, groupSize }`. Server
  computes price = `basePriceVnd × groupSize` and writes a `tours` row with
  `packageType='fixed_tour'`, `fixedTourId` set, `status='preview'`.
- Booking flows through the existing `/tour/[id]/checkout` page — no parallel
  checkout to maintain.

#### FR-FT-04: AI Matching Engine (cosine similarity)
The matcher implements [docs/sửa .md §5](../../docs/s%E1%BB%ADa%20.md) in pure
TypeScript:

```
matchScore(user, tour) = cosine(user.personalityVector, tour.vector)
                       * 100  (expressed as percent, rounded 2 d.p.)
```

- `lib/cosine.rankByCosine` is the single source of truth, exercised by
  `app/src/server/lib/cosine.test.ts`.
- Ranking is computed at request time against the in-memory 15-row catalog
  (we do not need Pinecone for 15 rows). The Pinecone/Milvus story in
  [docs/sửa .md §1](../../docs/s%E1%BB%ADa%20.md) is preserved in the TRD as a
  Phase 3 upgrade path for multi-city or 100+ tours.
- The chat onboarding can call `fixedTour.previewRank({ userVector, topN: 3 })`
  to show "Your top matches" before the vector is saved.

#### FR-FT-05: Pricing
Default base prices in seed data:

| Chapter | Base price (VND) |
|---|---|
| Morning | 1,000,000 |
| Afternoon | 1,000,000 – 1,200,000 (Bát Tràng + workshop premium) |
| Evening | 1,000,000 – 1,500,000 (Hoàng Thành after-hours premium) |

Group size multiplies linearly; no group discount in v1 (revisit when supply
exists). 20% platform commission applies — same split as host marketplace
(see [HOST_MARKETPLACE_PLAN.md](HOST_MARKETPLACE_PLAN.md)).

---

### 5.4 Customized Tour — Personalized Itinerary (PAID, with Guide)

#### FR-TOUR-01: Tour Request Input
User selects:
- Destination neighborhood (Old Quarter, Tây Hồ, Bát Tràng, …)
- Date, start time, duration (3–8h)
- Budget band (low / medium / high)
- Interest focus (multi-select on material tags)
- **Guide archetype** (NEW) — *Nhà nghiên cứu thâm trầm* or *Người bạn lém lỉnh*
- **Group size** — *Độc hành* (1) / *Song hành* (2) / *Hội ngộ* (3–6)

> The previous "without guide" option is **deprecated**. All Customized Tours
> include a guide; the cheap self-guided alternative is now the à-la-carte
> Activities flow.

#### FR-TOUR-02: Customized Tour Options (NEW)
- **Meal options ("Thiết lập Khẩu vị"):** Vegetarian, no-spice, allergy notes
  collected at booking; relayed to merchant partners via the booking record.
- **Route options ("Bản đồ Định tuyến"):** Walking-only / cyclo / classic
  motorbike. Each affects the suggested stop ordering and ETAs.
- **Proximity Smart Suggestion ("Gợi ý Vùng lân cận") — NEW:** When the
  traveler adds a place from LocoRec to the customized basket, the system
  reveals a ring of 3–5 "hidden gem" satellites within walking radius (places
  with `is_verified=true` and `popularity ≤ 0.4`).

#### FR-TOUR-03: Tour Generation Engine
1. Combine `explicit_data + derived_data + requestParams`.
2. Filter `places` table within the chosen neighborhood + budget.
3. Score each place via cosine on the 14-D experience+emotional tags.
4. Greedy-select top N respecting category diversity and duration budget.
5. Solve TSP with nearest-neighbor heuristic.
6. Allocate dwell time per stop based on `energy_score`.
7. **No LLM call.** The "AI" copy is a deterministic explainer driven by the
   user's profile signals — see
   [`components/ai-explainer.tsx`](../src/components/ai-explainer.tsx).

The implementation is in
[`src/server/services/_legacy/tour-engine.ts`](../src/server/services/_legacy/tour-engine.ts);
the move to `_legacy/` reflects that the engine is now a budget alternative,
not the headline.

#### FR-TOUR-04: Food Tour Budget Estimator (NEW)
- For places with a published menu: precise price quoted at booking.
- For street-food / market stops: a **"Mức giá áng chừng"** is computed as
  the median spend per traveler from the merchant's last 30 days of Locomate
  bookings (or, for new merchants, a manually curated `expected_spend_vnd`
  field on the place row).
- Traveler pays the estimate at booking; the **Real-time Meal Balancing**
  reconciliation (§5.5) settles the delta after the tour.

---

### 5.5 On-trip Field Experience (NEW)

These features fire while the user is mid-tour and depend on the Guide's
mobile dashboard.

#### FR-FIELD-01: Merchant QR Verification
- Each partner merchant displays a printed QR encoding a `merchant_id` + HMAC.
- Guide scans the QR via `/host/qr-scan`. Server validates the signature,
  resolves the merchant's contracted B2B sỉ price list, and applies it to the
  active tour's bill in real time.
- Travelers don't haggle. The savings (retail − sỉ) sit transparently in
  their booking detail.
- Phase 1 implementation: a `merchants` table + `merchant_pricelist` JSON; the
  full schema is sketched in [TRD §3.x](TRD.md).

#### FR-FIELD-02: Real-time Meal Balancing
- Only fires for tours that opted into the Food Budget Estimator.
- The Guide's dashboard exposes a checkbox list of menu items at each food
  stop. Each tap appends to the active tour's `meal_log` (a JSON array of
  `{merchantId, itemId, qty, sỉPriceVnd}`).
- On `tour.finish`, the server computes
  `actualSpend = Σ meal_log.priceVnd`.
- If `actualSpend < estimate`: difference auto-refunded to the booking's
  payment method via `payment.refund` (partial refund path).
- If `actualSpend > estimate + tolerance(5%)`: the server creates a
  follow-up charge using the saved Stripe / VNPay payment method; the
  Guide shows the traveler the breakdown before charging.
- All deltas are visible on `/profile/payment-history` with a "Meal
  reconciliation" badge.

#### FR-FIELD-03: Dynamic Re-routing AI
- "Báo cáo sự cố" button on the Guide's dashboard triggers
  `tour.reportIncident({ kind: 'weather' | 'closed' | 'safety' })`.
- The server picks 3 alternative stops within 1.5 km that share at least one
  of the original stop's MATERIAL tags and have non-zero supply at the current
  time. Suggestions return in <2s.
- The Guide accepts a suggestion; the tour's `tour_stops` and `tourData.stops`
  are mutated in a transaction; the traveler gets a push (Phase 2 — for now,
  the change is reflected on next polling tick).
- Replacement criteria: pure rules over the existing place tags + opening
  hours, no LLM.

---

### 5.6 Activities, Merch & eSIM (à-la-carte, persistent cart)

This subsystem was added in the April pivot and is unchanged by the May spec.
The relevant flows are:

- **Activities** (`/activities`) — workshops, food crawls, half-day micro-tours
  authored by hosts. Browsed by category, booked via the cart.
- **Merch** (`/shop`) — tees, totes, journals, ceramics; 10–25% bundle discount
  with any tour/activity in the same cart.
- **eSIM** (`/esim`) — GoHub Vietnam plans, now added to the cart instead of
  affiliate-out. `ESIM_BUNDLE_10` auto-applies a 10% discount when an eSIM is
  bought alongside a tour or activity.
- **Cart** (`/cart`) — multi-line, conflict detection against existing booked
  tours, blocked checkout on time overlap.
- **Orders** (`/orders/[id]/checkout`) — atomic confirmPayment that
  decrements slot capacity and product variant stock.

Booking-lifecycle semantics, including refund rules, live in
[BOOKING.md](BOOKING.md).

---

### 5.7 Post-tour Memory (NEW)

Three offline + digital touchpoints that close the trust loop and seed
viral acquisition. Together these replace the v1 "Post-experience review"
single-screen.

#### FR-POST-01: Merchandise Handover ("Nghi thức Trao tay Quà")
- Every Fixed Tour booking includes a small physical gift (woven bracelet,
  ceramic keychain, …) handed over by the Guide at the end of the tour.
- Inventory tracked through the same `product_variants` table; the gift line
  is a $0 `merch` order_item attached to the tour, decremented at handover via
  `host.markHandoverComplete({ tourId, variantId })`.

#### FR-POST-02: Digital Thank-you Letter ("Thư số Tri ân")
- 60 minutes after `tour.finish`, a templated push + email is sent.
- Copy is rendered server-side from a Handlebars-style template that
  interpolates: `displayName` (the personalized greeting), `chapterName`,
  `topMaterialTag`, `guideName`, and a single field-photo if the Guide
  uploaded one.
- Visual: a "lá thư tay kỹ thuật số" with a paper-grain background; this is
  one component, not a full templating engine.

#### FR-POST-03: Locomate Wrap-up ("Cuốn sổ ký ức số")
- An Instagram/TikTok-friendly recap page generated at
  `/tour/[id]/wrap-up`, accessible 1h after the tour ends.
- Layout: hero photo from the field, the cultural storyline excerpt, a
  vertical strip of all stops with timestamps, the traveler's personality
  label ("Slow-Living Aesthete"), and a "Share" button that surfaces a
  pre-built caption.
- The recap is the **viral loop**. We measure share-rate as a North Star
  input metric.

#### FR-POST-04: Reviews
- 1–5 stars + free-text comment, optional photo (max 3).
- The review can target the tour, the guide, or both.
- Hosts with `avgRating < 3.5` after 5 reviews are flagged for `host.review`.

---

### 5.8 Payment

Same plumbing as v1, with new product mix.

#### FR-PAY-01: Payment Plans

| Product | Price (USD) | Price (VND) | Description |
|---|---|---|---|
| **Fixed Tour (Morning/Eve std)** | ~$40 | 1,000,000 | Half-day curated, with guide + handover |
| **Fixed Tour (Premium)** | ~$60 | 1,500,000 | Hoàng Thành / Bát Tràng tier |
| **Customized Tour** | $40–$120 | 1M–3M | Built from neighborhood + guide archetype |
| **Activity (à-la-carte)** | $8–$32 | 200k–800k | Single workshop or food crawl |
| **Loco Route** (algorithmic, no guide) | ~$10 | 250,000 | Self-guided; preserved as low-end tier |

#### FR-PAY-02: Methods
- Stripe live + VNPay/MoMo for VND payments.
- Apple Pay / Google Pay supported via Stripe Payment Element on iOS/Android
  browsers (required for the in-chat **Escrow Adjustment** quick-charge in
  §5.11).

#### FR-PAY-03: Booking Cutoff (T−48h)
- Both Fixed Tour and Customized Tour bookings close **48 hours before
  departure** (T−48h). The `/checkout` page disables payment and surfaces a
  "Booking closed" banner; the catalog hides the affected start time from
  date pickers.
- This cutoff is the system-wide trigger for the Crossover Matching flow in
  §5.11.

#### FR-PAY-04: Refund Policy

| Trigger | Refund | Notes |
|---|---|---|
| Traveler cancels > 24h before departure | **100%** | Customer-initiated, pre-cutoff. |
| Traveler cancels 2–24h before departure | **50%** | Penalty covers guide time-block. |
| Traveler cancels < 2h before departure | **0%** | |
| **System auto-cancel at T−24h** (under-capacity + no crossover match) | **100%** | See §5.11 + BOOKING.md. |
| Guide cancels at any point | **100%** | Plus auto-rebook offer if possible. |
| Traveler unilateral cancel **after** a Crossover merged-route is locked | **50%** | Penalty splits between operating cost and the matched partner's guide hold. |

- **Meal Reconciliation** (§5.5) introduces an additional partial-refund or
  follow-up charge path that's distinct from customer-initiated refund.
- **Escrow Adjustment** (§5.11) introduces an in-chat top-up / refund path
  for the Δ between merged itinerary and the originally paid amount.
- All branches and state transitions live in [BOOKING.md](BOOKING.md).

---

### 5.9 User Profile & Data System

#### FR-PROF-01: Three-Layer Model (extended)

**Layer 1 — Explicit (onboarding chat answers)**:
`intent`, `interest`, `budget`, `style`, `scenarioChoice`, `socialPreference`,
`themeName` (Nắng Sớm Tràng An / Đêm Sâu Phố Cổ), `botTone` (intimate / playful
/ direct), `language` (vi / en / fr).

**Layer 2 — Derived (computed from Layer 1)**:
- `personalityVector` = `[Art_Aesthetic, Deep_History_Heritage,
  Culinary_Enthusiast, Slow_Living]` (the canonical 4-D space).
- Legacy 18-vector personality/behavior/emotional fields are still computed
  for the Customized Tour ranker; they coexist with the 4-D vector.

**Layer 3 — Implicit (in-app behavior)**:
`click_history`, `dwell_time`, `theme_toggles`, `wrap_up_shares`,
`reroute_acceptance`.

#### FR-PROF-02: Personality Recompute
- Recomputed on every `/preferences` save and on every 25 implicit signals
  ingested (whichever first).
- `user.recomputePersonality` is the explicit mutation; the implicit path runs
  inside `user.recordSignal`.

---

### 5.10 Safety & Trust

Unchanged from v1: identity verification (guides only), emergency contacts,
optional location sharing during active tour, OWASP / Decree 13/2023 baseline.

---

### 5.11 Fixed Tour Capacity Rescue & Crossover Matching (NEW — May 2026)

Source: [docs/fixed-tour-feature.md](../../docs/fixed-tour-feature.md).

The Fixed Tour Matrix needs ≥ 2 paying travelers per departure to be
operationally viable. The Crossover Matching engine is the safety net that
saves under-capacity departures: when a Fixed Tour still has only 1
traveler at T−48h, the system warns them, offers a one-click downgrade
path, and at T−36h opens an anonymous discovery surface that tries to pair
them with another under-capacity Fixed Tour or a same-day Customized Tour
traveler. The two parties negotiate a merged itinerary in an 8-hour chat
window with a constrained edit widget and an in-chat Stripe top-up for any
price delta. If they don't lock in by T−24h, the system auto-cancels both
bookings with a 100% refund.

This is **not** the deprecated LocoMatch swipe/dating UI. The matching
surface is anonymous, scoped to a single departure slot, and exists only
to rescue the fill-rate of paid bookings.

#### FR-CROSS-01: Booking lifecycle anchor points

The pre-departure timeline has four scheduled cron triggers, all
in Vietnam local time (UTC+7). Their handlers and the state-machine
transitions are in BOOKING.md.

| Anchor | Trigger | Action |
|---|---|---|
| **T−48h** | Booking cutoff | Catalog hides departure; under-capacity bookings get the "low fill" warning and the one-click migration CTA. |
| **T−36h** | Anonymous Discovery opens | Push to opted-in travelers; matched pair enters the 8-hour chat window. |
| **T−28h** | Chat window closes | If the pair locked in by this point, the merged route is finalized and the Δ has been settled. Otherwise the booking is flagged for auto-cancel at T−24h. |
| **T−24h** | Auto-cancel | Under-capacity / unlocked bookings flip to `system_cancelled`; 100% refund; guides notified. |

#### FR-CROSS-02: T−48h Warning + One-click Migration

- Before booking confirmation, a **Warning Tag** renders on any Fixed Tour
  detail page where `currentCapacity < 2`:
  > "Tour này hiện chưa đủ số lượng khởi hành tối thiểu. Bạn có thể phải
  > chờ đợi hoặc tour bị huỷ."
- **One-click Migration** — a **[Chuyển sang Custom Tour]** /
  **[Switch to Custom Tour]** button. Server-side `fixedTour.migrateToCustom`
  copies the Fixed Tour's stops + activities into a new `tours` row with
  `packageType='loco_route'` or `'solo_mate'` depending on guide preference,
  preserves `priceAmount` paid, and writes status `customized_pending`.
- **Implicit Consent** — if the traveler proceeds with the Fixed Tour
  booking despite the warning, the system sets
  `user_profiles.implicitData.consentMatching = true`. This is the gate
  for receiving Crossover discovery pushes in FR-CROSS-03.

#### FR-CROSS-03: T−36h Anonymous Discovery

- Cron `/api/cron/crossover-discovery` fires at T−36h for any
  `fixed_tour` booking still under capacity (`currentCapacity < 2`).
- **Push notification** to all opted-in travelers
  (`consentMatching = true`) and to "casual" users with no active
  Booking (`User.Status = IDLE`):
  > "Có chuyến đi cực hợp gu với bạn đang cần đồng đội. Tham gia ngay!"
- **Anonymous Discovery surface** (new route: `/match/crossover`) renders
  **only**:
  - `userProfile.derivedData.personalityVector` (cultural personality)
  - `tour.route` (chapter + ordered stop names)
  - `userProfile.demographics.ageGroup` (5-year bracket)
  - `userProfile.demographics.nationality`

  **Strictly hidden** until match success: `displayName`, `avatarUrl`,
  `email`, `phone`. The DTO returned by the server omits these fields
  entirely — the UI cannot accidentally render what it doesn't have.
- **AI Matching Score** — the existing 4-D cosine matcher (§5.3) is
  reused. The candidate ordering is `cosine(viewer.vector,
  candidate.vector)` so the most personality-compatible companions
  surface first.
- **Anti-Overlap Rule** — a traveler can send a crossover request to
  multiple candidates across non-overlapping departure slots. The first
  reciprocated `accept` for a given slot transitions the others on the
  **same calendar slot** to `expired` automatically.

#### FR-CROSS-04: T−36h → T−28h Negotiation Chat (8-hour window)

When both parties tap **[Đồng ý ghép]** / **[Accept match]**, the system:

1. Creates a chat thread tied to the merged-tour candidate
   (`tour_crossover_requests.status = matched`).
2. **Identity Disclosure** — only `firstName` (truncated `displayName`)
   and `avatarUrl` are revealed. Last names, contact info, and the
   personality vector raw values remain hidden.
3. Renders an **08:00:00 countdown timer** at the top of the chat.
4. Pins a **Smart Proposal Hub** widget inline. The widget enforces:
   - **Constrained Editing** — max **3** `Add` / `Remove` operations
     against the activity catalog. **No free-text inputs.** Each
     operation must select from the `places` / `activities` master
     catalog.
   - **Sequential Approval** — only one proposal can be in
     `pending_approval` at a time. The other party must `Approve`
     (commit) or `Reject` before a new proposal can be drafted.

#### FR-CROSS-05: Merged Route Resolution

| Input pair | Resolution |
|---|---|
| Fixed + Custom | Keep the Custom shell; offer toggle between the two parties' Custom routes. `UPDATE booking.routeId = selected.routeId`. |
| Custom + Custom | Same as above — pick one of the two as the base. |
| Fixed + Fixed | Pick one of the two Fixed Tours. If neither side will yield, **[Tạo hành trình chung]** / **[Build a shared route]** triggers `fixedTour.coCreateRoute` which combines the two 4-D vectors (weighted average) and runs the Customized Tour engine to produce a brand-new route. |

The resolved route writes back to the merged `tours` row, both legs of the
pair now point at it (`tours.crossoverPairId`), and the original
`fixed_tour_id` is preserved on a `tours.originalFixedTourId` audit column.

#### FR-CROSS-06: Escrow Adjustment Engine

The instant both parties tap **[Chốt hành trình chung]** /
**[Lock shared route]**:

1. Server recomputes the price: `costNew = pricePerPerson(newRoute) ×
   groupSize`.
2. Δ = `costNew − costOld` for each side.
3. **Δ > 0** (price up) — surface an in-chat **Stripe Payment Element**
   pop-up:
   > "Hành trình mới phát sinh thêm chi phí. Vui lòng thanh toán thêm
   > [Δ] để xác nhận chuyến đi."
   - Charges the saved payment method (Apple Pay / saved card) without
     leaving the chat.
   - On failure, the lock-in is rolled back and the chat re-opens.
4. **Δ < 0** (price down) — auto-refund Δ to the original payment method
   inside `payment.refundPartial`:
   > "Hành trình mới có chi phí tối ưu hơn. Số tiền [Δ] sẽ được hoàn trả
   > vào ví của bạn."
5. **Δ = 0** — straight lock-in, no popup.

Both branches write an `escrow_adjustments` row keyed on
`tour_crossover_requests.id` for audit.

#### FR-CROSS-07: Guide Real-time Update

When `payment.status = succeeded` on the escrow adjustment (or `Δ = 0`):

- Server emits a `tour:routeUpdated` SSE event to the assigned guide's
  client with the new stop list + estimated meal budget delta.
- Guide's `/host/tour/[id]/active` re-renders the prep checklist with
  the new stops. Old stop entries are visually struck-through so the
  guide can verify the change before departure.

#### FR-CROSS-08: Trust & Safety — Anti-Insult & Instant Eviction

- A **[Report]** button is always pinned to the top-right of the
  crossover chat header (UI guarantee, not optional).
- `chat.reportCrossoverPartner` performs in one transaction:
  1. `chat.status = terminated`
  2. `userMatchStatus` for the reported user = `banned` for this
     pair only (full-account moderation is a separate, slower path).
  3. Client-side cache wipe of the chat history for the reporter.
- The reporter is then surfaced an **Apology Banner** plus a
  **Priority Matching Voucher** added to their wallet:
  > "Chúng tôi vô cùng xin lỗi vì trải nghiệm không thoải mái này."
  - The voucher boosts the holder's `matchPercent` floor by 10 points
    in their next 3 crossover sessions, so they re-pair faster.
- The reporter chooses between **[Quay lại danh sách chờ ghép đôi]**
  (re-enter the discovery queue) or **[Huỷ tour & Hoàn tiền 100%]**
  (full refund).

#### FR-CROSS-09: T−24h Auto-cancel

If at T−24h the booking is still under capacity OR the pair didn't lock
in OR Δ-payment didn't succeed:

- `booking.status = system_cancelled`.
- Push to traveler + guide.
- Refund **100%** to the original payment method (rule row 4 in
  FR-PAY-04).
- The freed guide slot returns to `host_availability` so the guide can
  rebook within the remaining 24 hours.

#### Success metrics

| KPI | Target |
|---|---|
| Fixed Tour effective fill rate (paid / scheduled) | ≥ 75% (vs. ~55% baseline w/o matching) |
| Crossover match acceptance rate (matched / matched-eligible) | ≥ 30% |
| Δ-payment completion rate (succeeded / requested) | ≥ 85% |
| T−24h auto-cancel rate (cancelled / departures) | ≤ 15% |
| Crossover Report rate | ≤ 1% of crossover sessions |

---

## 6. Non-Functional Requirements

### 6.1 Performance
- AI matching response (cosine over 15 rows): **< 50 ms p95**.
- Page load on 4G: **< 2 s p95**.
- Customized Tour generation: **< 5 s p95** (no LLM call).
- Wrap-up render: **< 3 s p95**.

### 6.2 Scalability
- Phase 1: 500 concurrent users.
- Phase 2: 3,000 MAU.
- Phase 3: 10,000 MAU. Vector matching stays in-process up to ~1,000 tours;
  cut over to Pinecone/pgvector when the catalog grows past that.

### 6.3 Availability
99.5% uptime target. Vercel + Neon free tiers are sufficient through Phase 2.

### 6.4 Localization
- **Primary: Vietnamese.** Source-of-truth content (storyline, place names,
  letter copy) is written in VN first; English is the translation.
- **Secondary: English.** Auto-toggled by `Accept-Language`, overridable.
- **Phase 2: French.** Falls back to English when copy is missing.

### 6.5 Accessibility
- WCAG 2.1 AA on all surfaces. Tap-target floor 44×44. Contrast pairs codified
  in [TYPOGRAPHY.md](TYPOGRAPHY.md).

### 6.6 Security
- TLS 1.3 in transit, AES-256 at rest for identity docs.
- HMAC-signed merchant QR codes; signing key in
  `MERCHANT_QR_SIGNING_KEY` env var.
- Stripe / VNPay webhook signature verification on every callback.

---

## 7. MVP Feature Prioritization

### Phase 1 — Beta & Seed (ship by Month 2)
**Goal:** Validate paid demand on Fixed Tours with the first 15 storylines.

| Priority | Feature | Status |
|---|---|---|
| P0 | Fixed Tour Matrix (15 tours seeded, browse, detail, book) | **Shipped** |
| P0 | 4-D personality vector + cosine matching | **Shipped** |
| P0 | Bilingual chatbot onboarding | **Shipped** |
| P0 | Booking → Stripe live → tour active → review loop | Booking ✅; Stripe live keys pending (BIZ-01) |
| P0 | 996-place LocoRec + map | **Shipped** |
| P1 | Customized Tour with guide archetype + meal/route options | Partially shipped (legacy engine, needs UI for new options) |
| P1 | Activities, Cart, Orders, Merch, eSIM bundles | **Shipped (Apr 2026)** |
| P1 | Themes (Nắng Sớm Tràng An / Đêm Sâu Phố Cổ) | Tokens shipped, naming + selector pending |
| P2 | Proximity Smart Suggestion in `/plan` | Pending |
| P2 | Digital Thank-you Letter (templated push + email) | Pending (resend template + cron) |

### Phase 2 — Viral Growth (Months 3–6)
**Goal:** Acquisition through the Wrap-up share loop + hostel pilot, and
defence of Fixed Tour fill rate through Crossover Matching.

| Priority | Feature | Status |
|---|---|---|
| P0 | **Crossover Matching capacity rescue** (§5.11 — T-48h/-36h/-28h/-24h pipeline, anonymous discovery, Smart Proposal Hub, Escrow Adjustment) | Pending |
| P0 | Locomate Wrap-up page + share-to-IG/TikTok | Pending |
| P0 | Merchant QR Verification (15 partner merchants) | Pending |
| P0 | Real-time Meal Balancing | Pending |
| P0 | Hostel pilot (QR codes at 10 hostels) | Pending |
| P1 | Dynamic Re-routing AI | Pending |
| P1 | Priority Matching Voucher wallet + redemption | Pending |
| P1 | Profile Icon Store (loyalty points redemption) | Pending |
| P1 | Vietnamese-first content sweep | In flight |
| P2 | French translations | Pending |

### Phase 3 — Steady State (Months 7–12)
| Priority | Feature | Status |
|---|---|---|
| P1 | Catalog expansion to 30+ Fixed Tours | Pending |
| P1 | pgvector / Pinecone backing for catalog | Pending |
| P1 | Tour-module library (100+ stops) for the Customized Tour engine | Pending |
| P2 | Multi-city scaffolding (Hội An / HCMC) | Pending |
| P2 | Native mobile (Capacitor wrapper) | Pending |

---

## 8. Screen Flow (current as of May 2026)

```
Splash → Welcome → Register / Login (Google OAuth)
   → /onboarding/chat (bilingual quiz → 4-D vector)
   → Home Dashboard

Home (tabs: Home | Fixed Tours | Activities | Cart | Profile):
  "Xin Chào, {displayName}" → "Today in Hanoi" timeline
  Two-path CTA: Fixed Tours / Activities
  Top-match Fixed Tour carousel (with match %)
  Activities carousel, Merch carousel, eSIM bundle banner
  Recent Tours

Fixed Tours (chapter hub):
  Three chapter sections (Morning / Afternoon / Evening)
  Material filter chips (#ThanhTao / #HonDat / #HuongMen)
  Cards show: title VI/EN, story preview, base price, match % pill
  → /fixed-tours/[tourId]
      Storyline, ordered itinerary with map pins, guide archetype,
      "Why It Fits You", Book dialog (date/time/groupSize)
  → /tour/[id]/checkout (existing pipeline)

Activities → /activities → /activities/[slug] → /cart → /orders/[id]/checkout

Plan (legacy Customized Tour builder):
  Date/time, neighborhood, guide archetype, meal options, route options,
  Smart Proximity ring → Tour Preview → Checkout → Active Tour

Active Tour Mode (per booking, traveler-facing):
  Step-by-step navigation, mark-as-visited, emergency contact,
  meal-log breakdown (food tours)

Active Tour Mode (Guide-facing /host/tour/[id]):
  Itinerary view, "Scan merchant QR" CTA, meal-log checkboxes,
  "Báo cáo sự cố" button (Dynamic Re-routing)

Post-tour:
  /tour/[id]/review (stars + comment + photo, targets tour or guide)
  Push: "Thư Tri ân" arrives ~60min after finish
  /tour/[id]/wrap-up (shareable recap)

Profile:
  Avatar + tiered badge + cultural personality label
  My Preferences (edit + recompute)
  Saved Places, Tour History, Activity History, Order History
  Loyalty Points + Icon Store (Phase 2)
  Emergency Contacts, Language selector, Theme selector
  Security, Payment History (with meal reconciliation badges)
```

---

## 9. Success Metrics (KPIs)

### North Star
**Total Successful Experiences** = Completed booking + ≥45 min average dwell
per stop + Rating ≥ 4.5 + **at least one Wrap-up share OR repeat purchase
within 30 days.**

### Input Metrics (revised for Fixed Tour catalog)

| Metric | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Active users (target segment, organic) | 500 | 3,000 | 10,000+ |
| Onboarding completion rate (chat quiz) | ≥ 65% | ≥ 75% | ≥ 80% |
| Match-pill → tour-detail CTR | ≥ 30% | ≥ 40% | ≥ 45% |
| Tour-detail → booking conversion | ≥ 12% | ≥ 18% | ≥ 22% |
| Wrap-up share rate (shares / completed tours) | ≥ 15% | ≥ 30% | ≥ 35% |
| Guide active rate (weekly) | ≥ 80% | ≥ 85% | ≥ 85% |
| Average tour rating | ≥ 4.5 | ≥ 4.6 | ≥ 4.7 |
| Repeat purchase within 30 days | ≥ 10% | ≥ 20% | ≥ 25% |
| Paying customers / day | 2–3 | 8–10 | 13–15 |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| User skips the onboarding chat | Catalog renders in canonical `tour_id` order; no match pill; "Take the quiz to see your top matches" CTA on every tour card. |
| User retakes the quiz | Old `personalityVector` is overwritten; previously-paid tours are untouched. |
| Merchant QR fails to scan / unreachable | Guide can apply sỉ pricing manually with a reason code; the booking is flagged for ops review. |
| Meal Reconciliation card declines the follow-up charge | Tour completes anyway; the delta is left as a "balance owed" line and surfaced on next login. |
| Re-routing AI finds no alternative within 1.5 km | Guide picks manually; the new stop is recorded with `source='guide_override'` for future supply gap analysis. |
| Wrap-up generation fails | Fallback: a static "Thank you for traveling with Locomate" card. Logged to Sentry. |
| Translation missing for a stop | Fall back chain: vi → en → "TBD" (with Sentry breadcrumb). |
| Two travelers race for the last seat on a Fixed Tour | `order.confirmPayment` style conditional UPDATE (see BOOKING.md §Concurrency); loser gets PRECONDITION_FAILED with "Sold out before you could confirm". |
| Crossover candidate accepts the match, then chat partner abandons before lock-in | At T−28h cron, unresolved pairs auto-reset to `discovery_open`; the abandoning party gets a soft trust-score decrement (`implicitData.crossoverAbandonCount`). |
| Crossover candidate accepts in two slots that overlap | Anti-Overlap Rule (FR-CROSS-03) auto-expires the later acceptances on the same calendar slot. Only the first reciprocated accept wins. |
| Δ-payment declines after lock-in | The lock-in is rolled back, chat re-opens with a 30-min grace period; if still unpaid at T−24h cron, both bookings auto-cancel with 100% refund. |
| User reports their crossover partner | Pair-scoped ban + Priority Matching Voucher to reporter; reported user is **not** account-banned automatically — that's a separate moderation queue. |
| User chains migration: Fixed → Custom → Custom merge with another traveler | Allowed. The audit trail keeps `tours.originalFixedTourId` and the activity log so finance can reconcile. |

---

## 11. Dependencies & Assumptions

### Dependencies (changed since v1)
- **No OpenAI dependency.** Matching is local cosine; "AI" copy is rule-based.
- **GoHub eSIM affiliate** → moving to API integration (FEAT-01).
- **Stripe + VNPay** for VND-denominated payments.
- **15 verified guides** before public Phase 1 launch (was: 15 hosts).
- **15 partner merchants** with signed B2B sỉ pricelists before Phase 2.

### Assumptions
- Target users have stable 4G/5G in Hanoi (assumed; PWA degrades gracefully).
- Bilingual VN/EN coverage is sufficient for international audience; French
  is a "nice to have" Phase 2.
- Solo + small-group travelers will pay $40–$60 for a half-day curated
  experience. **This is the central unvalidated assumption** of the business
  case; see the Business Plan for the validation plan.
