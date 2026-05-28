# LOCOMATE — Comprehensive Feature Review & Business Plan

**Version:** 2.0 (full rewrite around the May 26, 2026 team meeting)
**Date:** May 26, 2026
**Live URL:** https://loco-mate.vercel.app
**Repo:** https://github.com/mrtmdpro/LocoMate
**Source for the new positioning:**
[docs/dav startup .md](../../docs/dav%20startup%20.md) (brand identity)
+ [docs/sửa .md](../../docs/s%E1%BB%ADa%20.md) (Fixed Tour Matrix production spec).

---

## PART 0: WHAT CHANGED ON MAY 25–26

The April 14 review treated Locomate as "AI-personalized itinerary design
for solo travelers visiting Hanoi" and projected revenue from three SKUs
(Loco Route / Solo Mate / Social Tour). After the team meeting the
positioning is sharper and the inventory is narrower:

| Shift | From (April) | To (May) |
|---|---|---|
| **Headline product** | Algorithmic Customized Tours ($10–$30) | **Fixed Tour Matrix** — 15 storyline-driven half-day tours organised into Morning / Afternoon / Evening "chapters" ($40–$60) |
| **Matcher** | Generic 18-D personality vector | **4-D cultural personality vector** — `Art_Aesthetic`, `Deep_History_Heritage`, `Culinary_Enthusiast`, `Slow_Living` — cosine-ranked against a static per-tour vector |
| **Brand voice** | "AI-Powered Discovery" | **Heritage-tourism** — "Nắng Sớm Tràng An" / "Đêm Sâu Phố Cổ" themes, bilingual VI/EN, guides called "Bạn Lối" |
| **On-trip features** | None | **Merchant QR sỉ pricing**, **Real-time Meal Balancing**, **Dynamic Re-routing AI** |
| **Loyalty + viral loop** | None | **Locomate Wrap-up** post-tour shareable + **Digital Thank-you Letter** + **Merchandise Handover** |
| **Customized Tours** | Headline | **Budget tier** alongside the Fixed Tour Matrix |

The technical reasoning behind the pivot:

1. **Defensibility.** ChatGPT + Google Maps will eat any generic "AI
   itinerary planner". Curated bilingual storylines tied to specific
   merchants and stops are a defensible content moat.
2. **Pricing power.** A vetted half-day with a Bạn Lối guide, a
   B2B-priced food crawl, and a physical handover gift commands
   VND 1M–1.5M ($40–$60). A pure text itinerary commands $10 at best.
3. **Inventory clarity.** 15 tours × 3 chapters fits in a head. A user
   can browse the entire catalog in one screen.

This document supersedes the April 14 review. The Fixed Tour Matrix
implementation status is current as of May 26, 2026.

---

## PART 1: FEATURE AUDIT

### 1.1 What's built and working

**Surface area: 30+ pages, 15 tRPC routers, 90+ procedures, 25+ DB tables, 996 real Hanoi places.**

| # | Feature | PRD ref | Status | Notes |
|---|---|---|---|---|
| 1 | Splash + Welcome + Login/Register (Google OAuth live) | FR-AUTH-01..03, BRAND | **Shipped** | Apple OAuth still disabled with honest "Coming soon". |
| 2 | Bilingual chatbot onboarding → 4-D personality vector | FR-BRAND-04 | **Shipped** | `/onboarding/chat`, deterministic mapping from quiz to vector |
| 3 | Home dashboard with two-path CTA (Fixed Tours / Activities) | — | **Shipped** | Role-aware; hosts get the host dashboard instead |
| 4 | LocoRec — 996-place feed with List/Map (Leaflet + OSM) | FR-REC-01..05 | **Shipped** | Slug URLs, save/bookmark, "Why It Fits You" rationale |
| 5 | **Fixed Tour Matrix** — 15 tours, 3 chapters, browse + filter | FR-FT-01..03 | **Shipped** | Seeded from `docs/sửa .md`, chapter hub at `/fixed-tours` |
| 6 | **Fixed Tour AI Matching** — cosine over 4-D vector | FR-FT-04 | **Shipped** | `fixedTour.list` / `rank` / `previewRank` in `app/src/server/routers/fixedTour.router.ts`. < 5 ms p95. |
| 7 | **Fixed Tour Booking** — date/time/group → existing checkout | FR-FT-03 | **Shipped** | `fixedTour.book` writes a `tours` row with `packageType='fixed_tour'` |
| 8 | Customized Tour (legacy algorithmic) | FR-TOUR-01..03 | **Shipped (legacy)** | Engine moved to `_legacy/`; still works as the budget tier |
| 9 | Host Marketplace (host-authored experiences + 5-step wizard) | — | **Shipped (Apr 7)** | 20% commission, verification-gated publish |
| 10 | Activities + Cart + Orders + Merch + eSIM bundles | — | **Shipped (Apr 7)** | Persistent cart, conflict detection, atomic confirmPayment |
| 11 | Booking checkout (Stripe **test mode**) → Active Tour → Review | FR-PAY-01..03 | **Shipped, payments simulated** | Stripe SDK wired; live keys pending (BIZ-01) |
| 12 | Host Operator Console (Earnings + Routes heatmap + Payouts) | — | **Shipped (Apr 7)** | 8 new tRPC procedures, 18 integration tests |
| 13 | Profile (tier badge, preferences edit + recompute, emergency contacts, saved places, history) | FR-PROF-01..02 | **Shipped** | |
| 14 | Bilingual content scaffolding (VI + EN) for Fixed Tours | 6.4 Localization | **Shipped** | Source-of-truth VN with EN translations in same row |
| 15 | Brand identity (logo, favicon, themes from token system) | FR-BRAND-01 | **Shipped (tokens)** | Tokens shipped; "Nắng Sớm Tràng An" / "Đêm Sâu Phố Cổ" naming + UI selector pending |
| 16 | Chat (SSE + polling, reactions, edit/delete, moderation, reports) | — | **Shipped** | Full architecture in `CHAT.md` |
| 17 | Account deletion with tombstoning + transactional cleanup | — | **Shipped** | Host-aware (archives experiences, nulls `tours.hostId`) |

### 1.2 Technical stats

| Metric | Value |
|---|---|
| Pages (Next.js routes) | 30+ |
| API routers | 15 |
| tRPC procedures | 90+ |
| DB tables | 25+ |
| **Fixed Tours seeded** | **15 (5 Morning + 5 Afternoon + 5 Evening)** |
| Real Hanoi places | 996 (OSM Overpass) |
| Curated experiences | 6 |
| Host-authored experiences (seed) | 9 (3 per seed host) |
| Host-authored activities (seed) | 12 across 71 time-slots |
| Merch products / variants | 6 / 13 |
| eSIM bundles | 4 (GoHub Vietnam) |
| Demo users | 5 travelers + 3 hosts |
| Tests (Vitest + PGlite + RTL) | 194 passing across 14+ files |

### 1.3 What the May 26 meeting added to the PRD that's NOT YET built

| Feature | PRD ref | Priority | Notes |
|---|---|---|---|
| **Fixed Tour Capacity Rescue & Crossover Matching** (T-48h/T-36h/T-28h/T-24h pre-departure lifecycle, anonymous discovery, Smart Proposal Hub, in-chat Escrow Δ-payment, Priority Matching Voucher) | FR-CROSS-01..09 | **P0 Phase 2** | Source: `docs/fixed-tour-feature.md`. Spec'd in PRD §5.11 + TRD §3 Crossover Matching tables + §5.7 Crossover Engine + BOOKING.md Pre-departure timeline. Tracker: `CROSS-01..CROSS-15`. Lifts Fixed Tour fill rate from ~55% baseline to ≥75% target — the single largest revenue-defence lever in Phase 2. Depends on Vercel Pro (15-min cron cadence). |
| **Locomate Wrap-up** (shareable post-tour recap) | FR-POST-03 | **P0 Phase 2** | The viral loop. Designed; `/tour/[id]/wrap-up` + OG-image + Vercel Blob persistence pending. |
| **Merchant QR Verification** (HMAC-signed QR + sỉ pricing) | FR-FIELD-01 | **P0 Phase 2** | Schema sketch in TRD §16. Needs `merchants` + `merchant_pricelists` tables and the partner-merchant pilot. |
| **Real-time Meal Balancing** (auto refund/charge against estimate) | FR-FIELD-02 | **P0 Phase 2** | Depends on Merchant QR. State machine extends BOOKING.md refund path. |
| **Dynamic Re-routing AI** ("Báo cáo sự cố" → 3 alt stops) | FR-FIELD-03 | **P1 Phase 2** | Rule-based, < 2s response. No LLM. |
| **Digital Thank-you Letter** (~60 min post-tour push + email) | FR-POST-02 | **P1 Phase 2** | Templated copy (Handlebars-style). Resend + scheduled job. |
| **Merchandise Handover** | FR-POST-01 | **P1 Phase 2** | $0 merch line attached to each Fixed Tour booking. Inventory decrement on `host.markHandoverComplete`. |
| **Customized Tour options** (guide archetype, meal options, route options, proximity smart suggestion) | FR-TOUR-01..04 | **P1 Phase 1** | Engine exists; the new option chips on `/plan` are pending UI work. |
| **Theme toggle UI** (named themes from Nắng Sớm Tràng An / Đêm Sâu Phố Cổ) | FR-BRAND-01 | **P2 Phase 1** | Token system shipped; the named-theme picker is one-day work. |
| **Profile Icon Store** (loyalty redemption for VN-themed avatar accessories) | FR-BRAND-03 | **P2 Phase 2** | Parked under `user_profiles.implicitData.icons[]` to avoid a separate table for MVP. |
| **Vietnamese-first content sweep + French translations** | 6.4 | **P1 Phase 2** | VI is source-of-truth; current strings still EN-first. |
| **Real OAuth: Apple** | FR-AUTH | **P3** | Needs Apple Developer account. Button is honestly disabled. |
| **PWA: manifest.json + service worker** | CONFIG-01 | **P1 Phase 2** | Required for Add-to-Home-Screen + push. |
| **Custom domain (locomate.app / locomate.vn)** | FEAT-05 | **P1 Phase 2** | Move off `loco-mate.vercel.app`. |
| **Live Stripe + VNPay/MoMo keys** | BIZ-01 | **P0 Phase 1** | Without this, revenue is zero. |
| **Analytics pipeline** | BIZ-06 | **P0 Phase 1** | Vercel Analytics or PostHog. |

### 1.4 Demo-killing issues (MUST fix before investor sessions)

1. **No live payments.** Stripe is in test mode. Wire BIZ-01 first or the
   business is theoretical.
2. **"5,000+ solo travelers" claim** still appears on the landing copy.
   No evidence. Replace with verifiable metrics like "996 real Hanoi
   places" or "15 curated cultural storylines".
3. **Apple OAuth button** is honestly disabled now (Apr 7 fix). Keep an eye
   on this — easy to regress.
4. **Decorative header on landing** — hamburger menu has no function;
   avatar is a stock photo. Remove or wire up.
5. **Theme names** — UI still says "Light / Dark" instead of "Nắng Sớm
   Tràng An / Đêm Sâu Phố Cổ". Investors who read the deck will look for
   the brand language and see generic copy.

---

## PART 2: BUSINESS PLAN (revised)

### 2.1 Executive Summary

LOCOMATE is a bilingual heritage-tourism platform for Hanoi. Travelers
take a 5–8 turn chatbot quiz that maps them onto a 4-axis cultural
personality vector, then receive a ranked list of **15 storyline-driven
Fixed Tours**. Each tour is a 4-hour half-day led by a vetted local guide
("Bạn Lối"), costing VND 1M–1.5M ($40–$60), with B2B-priced food/workshop
partners visited en route. A post-tour **Locomate Wrap-up** card is
designed to be shared on Instagram/TikTok, fuelling organic acquisition.

Revenue comes from per-tour fees with a 20% platform commission, plus
à-la-carte Activities (workshops, food crawls), Merch, and eSIM bundles.
No commission on hotels or flights — Locomate competes in the experience
lane, not against Booking.com.

The business is digital-first; marginal cost per Fixed Tour booking is
~5% of revenue (Stripe + email + matching compute). Variable cost is the
guide payout (50% revenue share). Customer acquisition runs through
hostel QR partnerships and the Wrap-up viral loop, not paid ads at
scale.

### 2.2 Market Sizing

| Metric | Value | Source |
|---|---|---|
| International tourists to Hanoi (2026 est.) | 8.6 M | Hanoi Tourism Department |
| Solo / small-group share | ~25 % | Global travel survey averages |
| Solo travelers to Hanoi annually | ~2.15 M | Calculated |
| Digitally active, English-capable, 20–35 yo | ~30 % | Estimated |
| Addressable market | ~645,000 travelers / year | Calculated |
| Willing to pay $40–$60 for a half-day curated experience | ≥ 50 % | Klook / GetYourGuide Vietnam category benchmark |
| Realistic Year-1 capture | 0.5 – 1 % | Conservative |
| Target paying users (Year 1) | 1,600 – 3,200 | Calculated |
| Average bookings per paying user (Year 1) | 1.2 | Solo Hanoi visitors typically book one half-day |

The earlier "3,000 – 6,500 paying users in Year 1" assumed a $3–$10 price
point. At $40–$60 the conversion rate is lower per visitor but the
revenue per visitor is 6–10× higher. Year-1 GMV target stays in the
USD 64k–192k range — see §2.5.

### 2.3 Revenue Model

#### Primary: Fixed Tour Matrix + Customized Tours + Activities

| Product | Price (VND) | Price (USD) | Margin | Phase 2 daily volume | Monthly revenue (VND) |
|---|---|---|---|---|---|
| **Fixed Tour (Morning / Evening std)** | 1,000,000 | ~$40 | 50% (guide split + 5% platform cost) | 6/day = 180/mo | 180,000,000 |
| **Fixed Tour (Premium — Bát Tràng / Hoàng Thành)** | 1,200,000–1,500,000 | ~$50–$60 | 50% | 2/day = 60/mo | 75,000,000 |
| **Customized Tour (with guide)** | 1,500,000–3,000,000 | ~$60–$120 | 45% | 1/day = 30/mo | 60,000,000 |
| **Loco Route (algorithmic, no guide)** | 250,000 | ~$10 | 95% | 3/day = 90/mo | 22,500,000 |
| **à-la-carte Activities** (workshop / food crawl) | 200,000–800,000 | ~$8–$32 | 40% | 2/day = 60/mo | 27,000,000 |
| **Merch** (handover gift + bundle upsell) | 50,000–500,000 | ~$2–$20 | 60% | bundle-attached | 8,000,000 |
| **eSIM bundles (GoHub, in-cart)** | 150,000–600,000 | ~$6–$24 | 12% commission | 5/day = 150/mo | 4,500,000 |
| **Total Phase 2 (Month 6) monthly revenue** | | | | | **~377,000,000** (≈ $15,000) |

**Key insights:**

- **Fixed Tour Matrix is the cash cow now.** At ~50% gross margin it
  beats the old Loco Route on absolute contribution despite the lower
  margin percentage. A single Fixed Tour booking contributes ~500k VND;
  a Loco Route contributes ~240k.
- **Premium tier (Hoàng Thành after-hours, Bát Tràng workshop) commands
  a 25–50% price premium** with no proportional cost increase — same
  guide, same hour count, higher willingness-to-pay anchoring.
- **Merchandise + eSIM are tied to tours via the cart bundle logic**
  (10–25% bundle discount); attach-rate of one or both at checkout is
  the lever that lifts ARPU.

#### Secondary: B2B + data

| Stream | Model | Est. monthly | Timeline |
|---|---|---|---|
| Featured Places (B2B) | Cafés / artisans pay for promoted placement in LocoRec | 15M VND | Month 6+ |
| Premium Subscription | Unlimited Customized Tour regenerations, priority guide matching | 8M VND | Month 9+ |
| Merchant pricelist commission | Locomate keeps 5% of the savings delta on sỉ-priced bookings | 5M VND | Month 4+ (Phase 2) |
| Tourism data (B2B anonymized) | Aggregate flow / dwell data sold to Hanoi Tourism Department | Exploratory | Month 12+ |

#### Revenue NOT to pursue (still avoiding)

- **Hotel / flight bookings** — Booking.com lane; never compete.
- **Display advertising** — Degrades the "curated, hidden gem" brand.
- **Subscription-only** — Tourists visit once; per-transaction is
  structurally correct.
- **Social matching / dating** — Officially dropped in April. Tinder is
  Tinder.

### 2.4 Cost Structure

#### One-time (CapEx, already incurred)

| Item | Cost (VND) | Cost (USD) |
|---|---|---|
| MVP development | 80,000,000 | ~$3,200 |
| Brand identity & 27 Stitch designs | 10,000,000 | ~$400 |
| Fixed Tour content creation (15 storylines × VI/EN) | 22,500,000 | ~$900 |
| Legal (business registration, tourism license, trademark) | 25,000,000 | ~$1,000 |
| Place database curation + photo licensing | 15,000,000 | ~$600 |
| **Total CapEx** | **152,500,000** | **~$6,100** |

#### Monthly Operations (OpEx)

| Item | Cost (VND/mo) | Cost (USD/mo) | Notes |
|---|---|---|---|
| Cloud (Vercel + Neon + Upstash + Blob + Stripe fees) | 4,500,000 | ~$180 | Phase 2 scale |
| Email (Resend) | 0 | $0 | Free tier covers Phase 2 volume |
| Core team (3 people) | 36,000,000 | ~$1,450 | 1 dev, 1 marketing/content, 1 ops/guide-mgmt |
| Marketing — hostel partnership + Wrap-up viral seed budget | 40,000,000 | ~$1,600 | TikTok content fund + KOL fee |
| Guide payouts (50% rev share on tours w/ guide) | 130,000,000 | ~$5,200 | Variable; ≈ 50% of Fixed + Customized rev |
| Guide recruitment & quarterly training | 8,000,000 | ~$320 | |
| Merch handover gift COGS | 5,000,000 | ~$200 | ~25k VND per Fixed Tour booking × ~200 bookings |
| Contingency (5%) | 15,000,000 | ~$600 | |
| **Total OpEx (Phase 2)** | **~238,500,000** | **~$9,550** | |

### 2.5 Unit Economics

| Metric | Fixed Tour (std) | Fixed Tour (premium) | Customized | Loco Route |
|---|---|---|---|---|
| Revenue per booking | 1,000,000 VND | 1,400,000 VND | 2,000,000 VND | 250,000 VND |
| Guide payout (50%) | 500,000 | 700,000 | 1,000,000 | 0 |
| Merch handover gift COGS | 25,000 | 25,000 | 25,000 | 0 |
| Payment fees (~3%) | 30,000 | 42,000 | 60,000 | 7,500 |
| Other variable (matching, email) | 5,000 | 5,000 | 5,000 | 5,000 |
| **Contribution per booking** | **440,000** | **628,000** | **910,000** | **237,500** |
| **Contribution margin** | **44 %** | **45 %** | **46 %** | **95 %** |

| LTV / CAC | Target |
|---|---|
| Blended target CAC (hostel + Wrap-up viral + organic) | ≤ 80,000 VND (~$3.20) |
| Average bookings per traveler (incl. repeat) | 1.2 |
| Blended LTV | ~500,000 VND (~$20) |
| **Blended LTV / CAC** | **~6.3 ×** |

The 6.3 × ratio is healthier than 3 × the industry rule-of-thumb but
**lower than the April plan's 10 ×** — because the new CAC reflects
real channel costs (TikTok production + hostel commission) rather than
the prior assumption that the Wrap-up loop would do all the work for
free. Lower-but-real beats higher-but-aspirational.

### 2.6 Break-even

| Phase | Months | Monthly revenue (VND) | Monthly OpEx (VND) | Net |
|---|---|---|---|---|
| Phase 1 — Beta (15 tours seeded, hostel pilot) | 1–2 | 60M | 110M | **–50M** |
| Phase 2 — Wrap-up + merchant QR + meal balancing rollout | 3–6 | 150M → 380M (run-rate by M6) | 180M → 240M | **–30M → +140M** |
| Phase 3 — Steady, catalog expansion, multi-city scaffolding | 7–12 | 450M+ | 280M | **+170M+** |

**Total funding to break-even:** ~500M–700M VND (~$20,000–$28,000) over
months 1–4. The increase over the April plan (~$12,000–$16,000) reflects
the higher fixed cost of an actual guide network and partner merchants
versus a pure-software product.

### 2.7 Go-To-Market

#### Phase 1 — Seed (Months 1–2)

- **Channel:** QR partnerships with 8–10 Hanoi hostels (`The Hanoian`,
  `Old Quarter View`, `Little Charm`, etc.). QR at reception goes to a
  branded `/from/[hostelSlug]` landing with a one-time-use 20% discount
  code.
- **Inventory:** All 15 Fixed Tours bookable. 3 verified Bạn Lối guides
  to start. 5 partner merchants signed onto the Phase 2 sỉ price list
  (the QR scan ships in Phase 2, but the contracts can be signed now).
- **Goal:** 50 paid bookings, 30 reviews ≥ 4.5/5, 20 Wrap-up shares.
- **KPI:** preview → booking conversion ≥ 12 %.

#### Phase 2 — Viral Growth (Months 3–6)

- **Channel A — Wrap-up viral loop:** every completed tour produces a
  shareable card with a pre-built caption. Target share-rate: 15 %
  → 30 %.
- **Channel B — TikTok content engine:** 15 "Hidden Hanoi" videos/month
  with end-card CTA to a specific Fixed Tour. Partner with 3–5 KOLs.
- **Inventory growth:** scale to 10 verified guides + 15 partner
  merchants. Ship Merchant QR + Meal Balancing in M4. Ship Dynamic
  Re-routing in M5.
- **Goal:** 300–500 paid bookings/month, 50 % return-or-share rate.
- **KPI:** Wrap-up share-rate ≥ 25 %, repeat-purchase rate ≥ 20 %.

#### Phase 3 — Steady State (Months 7–12)

- **Channel:** organic + referral + B2B. Locomate becomes the default
  recommendation in hostel onboarding decks.
- **Inventory:** catalog grows to 30+ Fixed Tours (Hà Đông silk, Đường
  Lâm ancient village, …). 20 guides, 30 merchants.
- **Goal:** 700+ bookings/month, USD ~15k/mo revenue, break-even.
- **KPI:** NPS ≥ 55, return-purchase ≥ 25 %.

### 2.8 Competitive Moat

| Competitor | What they do | What LOCOMATE does differently |
|---|---|---|
| Google Maps / TikTok | Information discovery | **Personalized, ranked curated catalog with cultural framing** |
| ChatGPT + Google Maps | Free AI itineraries | **15 hand-written bilingual storylines with vetted guides and B2B-priced merchants** |
| Klook / GetYourGuide | Pre-packaged tours from inventory partners | **Locomate-authored content, not inventory aggregation; emotional/cultural matching, not category browse** |
| Airbnb Experiences | Host-led one-off experiences | **Catalog of 15 curated themes with strong brand voice; price ceiling lower than Airbnb's premium tier** |
| Withlocals | 1:1 private guides | **AI-matched group format keeps prices at half of Withlocals'** |

**Honest moat assessment:** the defensive layers, in order of strength:

1. **Curated bilingual content with cultural depth.** A competitor needs
   a Vietnamese cultural writer + an English translator + on-the-ground
   research per storyline. Cannot be one-shot generated.
2. **Bạn Lối guide network with personality archetypes.** Trust is
   built in months, not weeks; the persona-typed roster
   (*Nhà nghiên cứu thâm trầm* / *Người bạn lém lỉnh*) is harder to
   replicate than a generic guide list.
3. **B2B merchant sỉ pricelist contracts.** These are pen-and-paper
   relationships; a funded competitor would need 3–6 months to match
   the network.
4. **Product integration** (LocoRec → Fixed Tour → Cart → Wrap-up) is
   product differentiation, not a structural barrier. Replicable by a
   funded team in 6–9 months.

A funded OTA can copy the *concept* but will struggle to match the
content + supply network in less than 12 months — which is the window
Locomate needs to lock in hostel + merchant exclusivity.

### 2.9 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **No live payments yet** | High | Critical | BIZ-01 is the gating action item — wire Stripe live before Phase 1 launch. |
| Guide supply quality / dropout | High | High | Build the 10 Bạn Lối roster slowly, with quarterly training; rating < 3.5 after 5 reviews flags for review. |
| Merchant QR pilot fails to onboard | Medium | High | Phase 2 can ship without QR — meal estimate becomes the price quoted at booking with manual reconciliation. Less elegant but un-blocking. |
| Wrap-up viral loop underperforms (< 10 % share) | Medium | High | Layer paid TikTok production on top; ↑ marketing spend. |
| **Fixed Tour fill rate stuck < 55%** | High | **Critical** | The Crossover Matching engine (PRD §5.11) is the dedicated mitigation. If Phase 2 still misses 75% target fill, fall back to **mandatory pairing pre-T-48h** (no solo Fixed Tour bookings; show only the Customized Tour path until a second traveler joins). |
| **Crossover Δ-payment failure rate > 20%** | Medium | High | Δ-payments use the saved card / Apple Pay. Failure means the lock-in rolls back and both travelers risk the T-24h auto-cancel. Mitigations: 30-min grace window, fallback "decline the change → keep old route" path, and a UI nudge to add a backup payment method before T-48h. |
| **Crossover Anti-Insult abuse (false reports as a free voucher mill)** | Medium | Medium | Voucher value (10-point cosine boost, 3 uses, 90-day expiry) is bounded so a mill-attack cap is low. Rate-limit `crossover.reportPartner` to 1/week/user. Repeat reporters trigger ops review. |
| **PII leak from the anonymous-discovery surface** | Low | **Critical** | Type-level contract (TRD CROSS-04): the wire DTO physically does NOT include `displayName`/`avatarUrl`/`email`/`phone`. Contract test fails the build if any of those keys appear in `crossover.getDiscoveryFeed`'s response shape. The matching-surface design is the single highest trust risk of the whole feature. |
| Solo travelers visit once, no repeat | High | Medium | Mitigate at LTV-not-acquisition layer: maximise contribution-per-booking via merch + premium tier upsell. |
| ChatGPT writes a "good enough" Hanoi itinerary | Medium | High | Differentiate on **bookable** experiences with vetted guides — something ChatGPT cannot deliver. Don't compete on the planning layer. |
| Thin Phase 2 break-even (+140M on 380M revenue) | Medium | High | A 10% miss erases half the profit; need a 20% cushion in marketing budget. |
| Competitor copies the model | Medium | Medium | First-mover relationships with hostels + merchants are the real defence. Lock in 1-year exclusivity where possible. |
| Vietnamese regulatory issues (tourism license) | Low | High | Already factored into CapEx; assume 30-day cycle. |
| Stripe declines on foreign cards | Medium | Medium | VNPay/MoMo as the fallback for Phase 2 launch. |
| AI matching surfaces wrong tour for the user → low rating | Medium | High | Catalog is small (15 tours); a manual content review pass catches false positives. The 4-D vector is conservative — when in doubt, falls back to canonical chapter order. |
| Translation drift between VI and EN | Medium | Medium | Make VI source-of-truth; EN regenerated whenever VI changes. Sentry breadcrumb when fallback fires. |

### 2.10 Key Metrics to Track

| Metric | Definition | Phase 1 | Phase 2 | Phase 3 | North Star? |
|---|---|---|---|---|---|
| **Successful Experiences** | Completed booking + rating ≥ 4.5 + (Wrap-up share OR repeat within 30 d) | 50/mo | 250/mo | 500/mo | **Yes** |
| Quiz completion rate | % who finish onboarding chat | ≥ 65 % | ≥ 75 % | ≥ 80 % | |
| Match-pill → tour-detail CTR | clicks / impressions | ≥ 30 % | ≥ 40 % | ≥ 45 % | |
| Tour-detail → booking conversion | bookings / detail views | ≥ 12 % | ≥ 18 % | ≥ 22 % | |
| **Wrap-up share-rate** | shares / completed tours | ≥ 15 % | ≥ 30 % | ≥ 35 % | candidate |
| Bundle-attach rate | bookings with merch OR eSIM in cart | ≥ 20 % | ≥ 35 % | ≥ 45 % | |
| Guide active rate | % accepting requests in trailing 7 d | ≥ 80 % | ≥ 85 % | ≥ 85 % | |
| Average tour rating | mean of 1–5 stars | ≥ 4.5 | ≥ 4.6 | ≥ 4.7 | |
| Repeat purchase within 30 d | (returning bookers) / (total bookers) | ≥ 10 % | ≥ 20 % | ≥ 25 % | |
| Refund rate | refunded amount / GMV | ≤ 4 % | ≤ 3 % | ≤ 2 % | |
| **Fixed Tour effective fill rate** (paid travelers / scheduled departures × min-capacity) | n/a | ≥ 75 % | ≥ 85 % | — | The headline metric for the Crossover Matching engine. Baseline ~55 % without rescue. |
| Crossover match-acceptance rate | accepted / matched-eligible | n/a | ≥ 30 % | ≥ 35 % | — |
| Crossover Δ-payment completion | succeeded / requested | n/a | ≥ 85 % | ≥ 90 % | — |
| Crossover T-24h auto-cancel rate | system-cancelled / total under-capacity departures | n/a | ≤ 25 % | ≤ 15 % | — |
| Crossover report rate | reports / matched chat sessions | n/a | ≤ 1 % | ≤ 1 % | Trust-and-safety canary. |

---

## PART 3: STRATEGIC PRIORITIES (next 3 months)

### CRITICAL — before any revenue or investor pitch

1. **BIZ-01: Wire real payments.** Stripe live keys or VNPay/MoMo. Until
   then, revenue is zero.
2. **BIZ-04: Remove "5,000+ solo travelers" claim** and similar
   unverifiable copy. Replace with concrete inventory metrics
   ("15 curated cultural storylines", "996 real Hanoi places", "3
   personality-typed Bạn Lối guides").
3. **Theme + naming sweep.** UI selector for "Nắng Sớm Tràng An" /
   "Đêm Sâu Phố Cổ"; sweep "Light/Dark" copy. One day of work.
4. **Customized Tour option chips** (guide archetype, meal options,
   route options) — the engine accepts them but the UI doesn't yet.

### HIGH — needed for public launch

5. **PWA setup** — `manifest.json` + service worker for Add-to-Home and
   future push.
6. **Custom domain** — `locomate.app` or `locomate.vn`.
7. **Analytics** — Vercel Analytics or PostHog. Without instrumentation,
   the KPIs in §2.10 are vibes.
8. **Hostel pilot launch** — 8–10 hostels, branded QR-to-discount
   landing.
9. **Guide recruitment to N=5** before public Phase 1 launch.

### PHASE 2 LIFTS — Months 3–6

10. **Fixed Tour Capacity Rescue (Crossover Matching)** — the largest
    Phase-2 revenue-defence lever. Without it the Fixed Tour fill rate
    sits near 55% and the unit economics in §2.5 quietly collapse: a
    1,000,000 VND Fixed Tour with only one paying traveler still
    needs a guide (500k cost) and a sub-2-traveler-tour cannot be
    delivered, so the booking either gets refunded (lost revenue) or
    runs unprofitably. Crossover Matching:
    - **Effort:** Schema migration + cron jobs + tRPC router +
      anonymous-discovery UI + in-chat Stripe Payment Element ≈ 12–15
      engineer-days. The largest single feature in Phase 2.
    - **Dependencies:** Vercel Pro (Hobby's daily-cron limit doesn't
      allow the 15-min cadence the four pre-departure crons need).
      Wire BIZ-01 (Stripe live keys) first or the Δ-payment is dead
      on arrival.
    - **PII risk:** Build the contract test in `CROSS-15` first; the
      type-system gate is cheaper than learning at launch.
11. **Locomate Wrap-up generator** — the viral loop is the cheapest
    growth lever. Templated render + OG image + Vercel Blob persistence
    + share button. ~5 days of work.
11. **Merchant QR Verification** — HMAC signing, partner merchant
    onboarding (15 merchants), Guide-side scan flow.
12. **Real-time Meal Balancing** — depends on Merchant QR. Auto refund
    / charge against the booking's payment method.
13. **Dynamic Re-routing AI** — `tour.reportIncident` mutation + 1.5 km
    haversine + tag-overlap ranker. Pure rules; ~3 days of work.
14. **Vietnamese-first content sweep** — flip the source-of-truth from
    EN to VI; required for guide adoption and partnership credibility.
15. **Profile Icon Store** + loyalty points redemption (Phase 2.5).

### GROWTH — post-launch

16. **TikTok content engine** — 15 "Hidden Hanoi" videos/month with
    deep-link to a specific Fixed Tour.
17. **Featured Places (B2B)** — paid placement for cafés / workshops in
    LocoRec.
18. **French translations** for Phase 2 European audience.
19. **Stripe Connect payouts** to replace manual weekly export.

---

## PART 4: CRITICAL BUSINESS REVIEW (May 26, 2026)

### 4.1 Honest Stage Assessment

| Dimension | Rating | Notes |
|---|---|---|
| Technical MVP | **Strong** | 30+ pages, 996 places, 15 Fixed Tours seeded, cosine matcher live, 194 tests passing |
| UI/UX polish | **Good** | Stitch designs applied; theme tokens shipped but named themes pending |
| Content depth | **Good** | 15 bilingual storylines + 9 host experiences + 12 activities; small for a launch but coherent |
| Business readiness | **Weak** | Stripe still in test mode; no real bookings; theme/copy still mostly English-first |
| Operational readiness | **Weak** | Bạn Lối network is 3 seeded fixtures, not real guides; merchant sỉ pricelist is paper-only |
| Investor readiness | **Moderate** | Sharper positioning post–May 26; revenue projections still theoretical |
| Launch readiness | **Not ready** | Cannot process real payments; cannot fulfil guided experiences |

### 4.2 What's Real vs What's Theoretical

| Aspect | Status |
|---|---|
| Product UI | **Real** — 30+ pages deployed and functional |
| 996 Hanoi places | **Real** — OSM-sourced with verified coordinates |
| **15 Fixed Tours with bilingual storylines** | **Real** — seeded from `docs/sửa .md` |
| **4-D cosine matching engine** | **Real** — 194 passing tests, < 5 ms p95 |
| **Fixed Tour booking flow** | **Real** — `fixedTour.book` → existing checkout |
| Host Marketplace (5-step wizard + booking + commission split) | **Real** — shipped Apr 7 |
| Activities + Cart + Orders + Merch | **Real** — shipped Apr 7 |
| Brand identity (logo, tokens, designs) | **Real** — themes pending naming |
| Revenue projections (~380M VND/mo at Phase 2) | **Theoretical** — payments not live; no real cohort data |
| Unit economics (LTV / CAC = 6.3 ×) | **Theoretical** — CAC has no channel-level history |
| Wrap-up share-rate ≥ 15 % | **Untested** — generator not built |
| Bạn Lối network (3 verified guides) | **Demo fixtures**, not real recruited guides |
| Merchant sỉ pricelist contracts | **Not started** |
| Live payments | **Not started** — Stripe test mode only |

### 4.3 What Investors Will Ask That We Cannot Yet Answer

1. "Show 30 days of real bookings, cancellations, ratings, and Wrap-up
   shares."
2. "What's the per-guide capacity, and how do you onboard 10 of them in
   90 days?"
3. "Which 15 merchants have you signed onto the sỉ pricelist, and
   what's the average savings delta?"
4. "Is the 50/50 guide payout sustainable? What happens at $100 GMV /
   day vs $1,000 / day?"
5. "What's the Vietnamese tourism license status? Decree 13/2023
   compliance audit?"
6. "How do you defend pricing power when a competitor copies the
   storyline format with cheaper guides?"
7. "Stripe + VNPay foreign-card decline rate — what's the recovery
   flow?"

### 4.4 Path from Demo to Business

```
Current (Demo)
   ──▶ Wire Stripe live + VNPay → take first real payment
   ──▶ Recruit 5 Bạn Lối guides, train, schedule
   ──▶ Hostel pilot (8 sites) + 50 bookings
   ──▶ Sign 15 merchants onto the sỉ pricelist
   ──▶ Ship Merchant QR + Meal Balancing + Wrap-up
   ──▶ 90 days of cohort data
   ──▶ Investor pitch with proof
```

The gap between "looks like a product" and "operates as a business"
requires, in order:

- **Live payment processing** (Stripe live + VNPay).
- **Guide operations** (recruitment, training, scheduling, payouts).
- **Merchant partnerships** (15 sỉ pricelists).
- **The viral loop** (Wrap-up generator).
- **Analytics pipeline** (Vercel Analytics or PostHog).
- **Legal entity** (tourism business registration; Decree 13 compliance).

The May 26 meeting locked in the right product. The May 26 → August 26
window is about going from "right product on paper" to "right product
in market" — without diluting the heritage-tourism positioning that
makes the offer defensible in the first place.
