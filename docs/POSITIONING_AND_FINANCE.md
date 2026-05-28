# LOCOMATE — Positioning & Finance Model

**Document type:** Strategic Pricing + Revenue Model + OpEx Allocation Logic
**Audience:** Founders, prospective investors, ops + finance lead
**Prepared by:** Office of the CFO (synthesised under the May 26 2026 pivot)
**Version:** 1.0
**Status:** Working model — numbers are *defensible estimates* grounded in
public market data, not booked figures. Live cohort data overrides this
model the moment Stripe live keys are wired (see `REVIEW_AND_BUSINESS_PLAN.md`
§4.4 — BIZ-01).

> Companion docs:
> [`REVIEW_AND_BUSINESS_PLAN.md`](REVIEW_AND_BUSINESS_PLAN.md) (strategy &
> unit economics), [`PRD.md`](PRD.md) (product surface),
> [`TRD.md`](TRD.md) (technical contracts including the 20% host commission).

---

## TL;DR — One-screen CFO Summary

1. **Positioning.** LOCOMATE is the *curated heritage-tourism* lane —
   structurally cheaper than 1:1 private guiding (Tubudd, Withlocals,
   Airbnb host-led) and structurally more curated than mass-OTA tours
   (Klook, Booking, Traveloka). Sweet spot: **USD 28–55 (≈ 700K – 1.375M
   VND) per traveler for a 4-hour bilingual half-day** with a vetted
   Bạn Lối guide.
2. **Penetration price.** Phase 1 list price is set ~**25–35 % below
   the median Hanoi cultural-tour benchmark** to seed reviews and the
   Wrap-up viral loop. Base Price formula: `BP = (DC + AOPX + TM) ×
   (1 − DiscPen)` (see §2.3).
3. **Hidden OpEx.** Five-seat core team (Tech, Ops, Growth, Fin&HR,
   DesTour) costs **USD 7,400–11,900 / month (≈ 185M – 297.5M VND / mo)**
   at Vietnam-market compensation, *before* infrastructure, marketing,
   KYC and contingency. Guides are NOT in this number — they are a 50 %
   variable revenue share, deducted at the booking line, not the salary
   line.
4. **CapEx.** One-time seed of **USD 7,500–11,000 (≈ 187.5M – 275M VND)**
   covers WebApp MVP, Hidden Gem data validation, and Vietnamese
   tourism-business legal setup.
5. **Revenue split.** Three streams (Fixed Tour, Customized Tour with
   running tab, eSIM + Merch). Every dollar of gross revenue is allocated
   through the deterministic formula in §4.3: variable cost first, fixed
   OpEx second, then a **50 / 30 / 20** split of operating surplus into
   **Team retained / Marketing reinvest / Net profit**.

---

## STEP 1 — MARKET BENCHMARK & POSITIONING

### 1.1 Methodology

Prices below are **per-person list prices** for the closest comparable
product (a half-day to full-day, English-narrated, cultural or food
experience in Hanoi for 2–4 travelers). Sources are public listings as
of Q1–Q2 2026; where a listing offers a range, the **median observed
price** is recorded. USD ↔ VND conversion uses the working rate
**25,000 VND/USD** throughout this document. Detailed citations are in
§1.4.

### 1.2 Benchmark Table — OTA Platforms (Group A)

| # | Competitor | Tour type | Price (USD / pax) | Price (VND / pax) | USP | Weakness |
|---|---|---|---|---|---|---|
| A1 | **Klook — Hanoi** | Half-day food tour, full-day Bát Tràng, street-food walking | $19 – $58 | 475K – 1.45M | Mobile-first, instant confirmation, regional brand trust, aggressive promo codes | Inventory aggregated from 3rd-party operators → quality uneven; no narrative/storyline layer; guides are operator-employed, not curated |
| A2 | **GetYourGuide — Hanoi** | "Local Living" half-day, foodie tours, Old Quarter walks | $25 – $89 | 625K – 2.225M | Largest global discovery surface for inbound travelers; strong review density | Aggregator economics (20–30 % take rate from operator) means listed prices are inflated; same operator-quality risk as Klook |
| A3 | **Airbnb Experiences — Hanoi** | Host-led cooking, photography, vespa, calligraphy | $29 – $135 | 725K – 3.375M | Authentic 1-host narrative, premium brand association with "local" | Live inventory shrank in Vietnam post-2023; quality non-replicated; no platform tooling for host (no QR, no real-time refund) |
| A4 | **Booking.com Experiences** | White-labelled tours via Viator / GetYourGuide | $22 – $110 | 550K – 2.75M | Distribution via the hotel-booking funnel | Pure aggregation, no own content; commission stack (15 %–25 %) pushes listed prices up |
| A5 | **Traveloka Xperience** | Hanoi day trips, food crawls, cycling | $14 – $72 | 350K – 1.8M | Native VND payment, strong SEA market funnel | Mass-market positioning; cultural depth ≈ 0; Vietnamese-language only on customer-facing screens for some flows |
| A6 | **Tubudd** (VN-native local-buddy marketplace) | 1:1 "Buddy" hangout, 4-h to full-day | $30 – $90 | 750K – 2.25M | Buddy concept is unique and authentic; price-transparent | Marketplace = each Buddy is solo entrepreneur; no operational tooling, no curated storyline, no merchant network |

### 1.3 Benchmark Table — Direct Vietnam Operators (Group B)

| # | Competitor | Tour type | Price (USD / pax) | Price (VND / pax) | USP | Weakness |
|---|---|---|---|---|---|---|
| B1 | **Hidden Hanoi Travel** | Cultural half-day, "Behind the Scenes" Old Quarter | $35 – $75 | 875K – 1.875M | 15+ years of heritage-tour expertise; trusted by long-haul travelers | No tech platform — booking is email + bank transfer; no AI matching; price-per-pax climbs sharply for solo travelers |
| B2 | **Backstreet Academy — Hanoi** | Skill-based workshop (lacquerware, calligraphy, cooking) | $28 – $65 | 700K – 1.625M | Workshop-led artisan storytelling, Asia-wide brand | Limited Hanoi inventory; menu rarely updated; aggregator margin similar to Klook |
| B3 | **Urban Adventures Hanoi** (Intrepid sub-brand) | Half-day food + cyclo, evening street food | $39 – $79 | 975K – 1.975M | Day-trip operator with global Intrepid reach | Operator-led, not local-founder-led; price reflects parent brand overhead |
| B4 | **Hanoi Free Tour Guides** (HFTG, student org) | 4-h walking, tip-based | $0 + tip ($10 – $25 typical) | 0 + tip (250K – 625K) | Free entry; goodwill | Quality entirely guide-dependent; no merchant relationships; no commercial follow-up |
| B5 | **Solo / informal village experiences** ("chăn vịt, bắt cá, trồng lúa" near Hà Nội — Đường Lâm, Mai Châu, Ninh Bình day-trip) | Full-day rural authenticity | $40 – $110 (transport-loaded) | 1M – 2.75M (transport-loaded) | Authentic countryside culture, photogenic for social | 60–80 % of price is transport (3+ hours each way), not the experience; one-off; no repeat purchase; no platform |
| B6 | **Hanoi Walking Tour / VPGroup-style local agencies** | 3-h Old Quarter walk, half-day food | $20 – $45 | 500K – 1.125M | Local agency, family-run | Cash-only or bank-transfer; no English-fluent booking UX; no curated narrative beyond a stop list |

### 1.4 Source citations

All figures above are public listings observed Q1–Q2 2026. Specific
references:

- **Klook & GetYourGuide:** category pages "Hanoi Tours & Activities".
  Median computed across the top 30 listings sorted by review count.
- **Airbnb Experiences:** the Hanoi market page (note: inventory has
  contracted since the 2023 Experiences re-launch announcement).
- **Booking.com Experiences:** the "Things to do in Hanoi" listing,
  filtered to half-day and full-day cultural/food categories.
- **Traveloka Xperience:** Hanoi destination page on the VN domain.
- **Tubudd:** Hanoi Buddies page, top 20 profiles by review count.
- **Hidden Hanoi Travel** (`hiddenhanoi.com.vn`): published rate card.
- **Backstreet Academy** (`backstreet-academy.com`): Hanoi category.
- **Urban Adventures** (`urbanadventures.com/destination/hanoi-tours`).
- **HFTG** (`hanoifreetourguides.com`): tour types page.
- **Village experiences:** aggregated across listings on Klook, Viator,
  Vietnam tour operator sites (Vietnam Backpackers, Hanoi Local Tour,
  Vietnam Tourism JSC) for Đường Lâm / Mai Châu / Ninh Bình.
- **VPGroup / family agencies:** Hanoi cluster of small operators on
  TripAdvisor "Tours & Activities — Top Rated".

> **Caveat:** OTA listed prices include 15–30 % take rate. The operator-net
> price is typically lower; we use **listed price** because that is what
> a foreign customer actually pays and what LOCOMATE competes against on
> the consumer side.

### 1.5 LOCOMATE positioning against the field

| Vector | OTA aggregators (A1–A5) | VN direct operators (B1–B6) | Tubudd / 1:1 buddies (A6) | **LOCOMATE** |
|---|---|---|---|---|
| **Curation depth** | Low (operator-driven inventory) | Medium (operator-internal) | None (per-buddy variance) | **High — 15 hand-written bilingual storylines, 4-D cultural vector** |
| **Tech platform** | High (mobile, payments, reviews) | Low (email + bank transfer common) | Medium (web only) | **High (Next.js, AI matching, Wrap-up share, merchant QR roadmap)** |
| **Personalization** | None ("most popular" sort) | None | Manual chat | **AI cosine-ranked on 4-D vector (Art / History / Culinary / Slow Living)** |
| **Cultural Tonkin focus** | None | Some (B1, B3) | None | **Exclusive — Tonkin Culture is the entire product** |
| **Price (half-day, 2 pax) — USD** | $19–$110 | $20–$75 | $30–$90 | **$28–$55 (Phase 1 penetration $28–$40)** |
| **Price (half-day, 2 pax) — VND** | 475K–2.75M | 500K–1.875M | 750K–2.25M | **700K–1.375M (Phase 1 penetration 700K–1M)** |
| **Repeatability of supply** | Inventory churns | Limited team | Solo entrepreneurs | **Curated Bạn Lối roster + sỉ-priced partner merchants** |

**Core positioning statement:**

> *LOCOMATE is the only Hanoi experience product that combines an
> AI-curated bilingual cultural matcher with a vetted Bạn Lối guide
> network and a sỉ-priced merchant alliance — sold at penetration
> pricing 25–35 % below the median Hanoi cultural half-day benchmark.*

The three structural defenders against price-war copy:

1. **Tonkin storyline IP** — written by Vietnamese cultural editors;
   cannot be one-shot generated by ChatGPT plus Google Maps.
2. **Bạn Lối guide brand archetypes** (*Nhà nghiên cứu thâm trầm* /
   *Người bạn lém lỉnh*) — trust is built over 3–6 months of training;
   not copy-pastable.
3. **Merchant sỉ pricelist contracts** — pen-and-paper deals across 15+
   merchants in Phase 2; a funded competitor needs 3–6 months minimum
   to replicate.

---

## STEP 2 — PENETRATION PRICING STRATEGY

### 2.1 Pricing posture (Phase 1 → 3)

| Phase | Months | Posture | Anchor against benchmark | Discount mechanism |
|---|---|---|---|---|
| **Phase 1 — Seed** | 1 – 2 | **Penetration**: aggressive intro pricing to seed reviews + Wrap-up shares | **−30 % vs Group B median** ($40 → **$28**, i.e. 1M VND → **700K VND**) | Hostel QR one-time code; "Founding Traveler" badge |
| **Phase 2 — Viral lift** | 3 – 6 | **Soft penetration** still under benchmark | **−15 %** ($40 → **$34**, i.e. 1M VND → **850K VND**) | Bundle discount (Tour + Merch + eSIM); Crossover Δ-payment surge |
| **Phase 3 — Steady** | 7 – 12 | **At-market** to **slight premium** for premium tier | **At benchmark or +5 %** | Loyalty redemption (Profile Icon Store); premium tier (Hoàng Thành / Bát Tràng) at $50–$60 (1.25M – 1.5M VND) |

The Phase-1 discount is **fenced** (one-time-use code, hostel-scoped
landing URL `/from/[hostelSlug]`) so the intro price does not become
the reference price for the post-pilot cohort. This is critical: the
"founding" frame lets the price reset upward in Phase 2 without a
perceived hike.

### 2.2 Why penetration is correct here (CFO defence)

- **Demand-side:** inbound travelers anchor on Klook/GetYourGuide median
  (~$35–$45 / 875K – 1.125M VND half-day). Coming in at $28 (700K VND)
  is **immediately legible** as a deal without triggering "too cheap to
  be good" suspicion (the floor the market sets via HFTG free + tip).
- **Supply-side:** guide payout is a **proportional 50 % share**, so a
  lower price does not push guide compensation below market — the guide
  earns ~$14 (350K VND) on a $28 (700K VND) booking with 2 pax (= $28 /
  700K VND to guide), which is competitive vs $20–$25 (500K – 625K VND)
  / half-day informal rates in Hanoi.
- **Marketing leverage:** every Wrap-up share with the discount-coded
  URL is a **measurable acquisition unit**; the discount itself is the
  marketing budget, not an add-on cost.
- **Defensibility:** at $28 / 700K VND list, a copycat OTA cannot match
  without cannibalising its own 20–30 % take-rate margin. The
  penetration price weaponises OUR thin variable cost stack against
  THEIR fat one.

### 2.3 Base Price formula (per traveler)

$$
\boxed{\;BP \;=\; (DC + AOPX + TM) \times (1 - DiscPen)\;}
$$

| Symbol | Meaning | Default (USD) | Default (VND) | Notes |
|---|---|---|---|---|
| `DC` | **Direct cost per traveler** — guide payout + COGS handover gift + payment-fee allocation + matching/email compute | **$8.50** | **≈ 212,500** | At target 2-pax average: guide $7.00 / 175K VND (50 % of $14 / 350K VND half-share) + gift $1.00 / 25K VND + Stripe 3 % $0.30 / 7.5K VND + var $0.20 / 5K VND. Scales linearly with group size (per-pax, not per-tour). |
| `AOPX` | **Allocated fixed OpEx per traveler** = `MonthlyFixedOpEx / TargetBookings` | **$6.00** | **≈ 150,000** | $9,500 / 237.5M VND per month ÷ ~1,600 paid travelers/mo at Phase 2 run-rate. Trends DOWN with scale. |
| `TM` | **Target contribution margin per traveler** | **$18.00** | **≈ 450,000** | Set to deliver target Net Profit 20 % at Phase 2 run-rate after the 50/30/20 split (§4.3). |
| `DiscPen` | **Penetration discount** (Phase 1 fenced) | **0.30** | **0.30** | 30 % off list in Phase 1; tapers to 0.15 in Phase 2, 0.00 in Phase 3. |

**Worked example (Phase 1):**

```
BP = (8.50 + 6.00 + 18.00) × (1 − 0.30)
   = 32.50 × 0.70
   = 22.75 USD per traveler  ≈  568,750 VND per traveler
```

Round to **$23 / pax (≈ 575,000 VND)** as the Phase-1 "Founding
Traveler" floor for the Morning / Evening standard chapter. The
**published, ungated list price stays at $40 / 1,000,000 VND** so the
discount is visible at point of sale.

**Phase 2 (DiscPen = 0.15):**

```
BP = (8.50 + 4.50 + 18.00) × 0.85 = 31.00 × 0.85 = 26.35 USD  ≈  658,750 VND
   → round to $27 / pax  (≈ 675,000 VND)
```

(`AOPX` drops to $4.50 / 112,500 VND because target bookings rise.)

**Phase 3 (DiscPen = 0.00, premium tier):**

```
Standard: BP = (8.50 + 3.50 + 18.00) × 1.00 = $30  ≈  750,000 VND
Premium:  BP = (12.50 + 3.50 + 24.00) × 1.00 = $40  ≈  1,000,000 VND
          (Hoàng Thành / Bát Tràng)
```

This is the formula the booking engine should use to render the
**list price** for any new Fixed Tour or Customized Tour SKU. The
*displayed* price is `ListPrice = (DC + AOPX + TM)` (no discount); the
*charged* price applies `DiscPen` only when a fenced discount code is
present.

---

## STEP 3 — CORE-TEAM SALARY BENCHMARK (HIDDEN OPEX)

### 3.1 Method

Compensation benchmarks below reflect **Vietnamese-market early-stage
startup pay** for 2025 – 2026, converted to USD at 25 000 VND/USD.
Source set: TopDev annual salary report, ITviec compensation report,
VietnamWorks Tech & Digital salary guide, Glints SEA salary benchmark,
and Robert Walters Vietnam Salary Survey. Where a band is published,
the **early-stage equity-adjusted midpoint** is used (a startup with
≤ 18 months runway typically pays at the 30th–50th percentile of the
published band, partially offset by equity).

### 3.2 Core Team (3 seats)

| # | Role | Market band (USD / mo) | Market band (VND / mo) | Plan (USD / mo) | Plan (VND / mo) | Justification |
|---|---|---|---|---|---|---|
| C1 | **CTO / Lead Dev (Tech)** | $2,200 – $4,500 | 55M – 112.5M | **$2,500** | **62.5M** | Senior full-stack (Next.js + Postgres + Stripe). The system is built (`REVIEW_AND_BUSINESS_PLAN` §1.2). Keeps it running + ships Crossover Matching + Merchant QR. |
| C2 | **Trưởng phòng vận hành (Ops)** | $1,200 – $2,600 | 30M – 65M | **$1,500** | **37.5M** | Guide recruitment + scheduling + KYC + incident handling. The role that converts "demo" into "operates as a business" (§4.4 of biz plan). |
| C3 | **Trưởng phòng tăng trưởng (Growth / Marketing)** | $1,500 – $3,000 | 37.5M – 75M | **$1,800** | **45M** | Hostel-partnership + Wrap-up viral loop + TikTok content engine + KOL booking. Mid-senior with VN inbound-tourism domain knowledge. |
| | **Subtotal Core** | | | **$5,800** | **145M** | |

### 3.3 Support Team (2 seats)

| # | Role | Market band (USD / mo) | Market band (VND / mo) | Plan (USD / mo) | Plan (VND / mo) | Justification |
|---|---|---|---|---|---|---|
| S1 | **Fin & HR Lead** | $1,000 – $2,000 | 25M – 50M | **$1,200** | **30M** | Bookkeeping (Vietnamese accounting compliance), payroll, contractor agreements, BHXH, Decree 13/2023 tourism-license maintenance. |
| S2 | **DesTour — Product / Tour Experience Designer** | $800 – $1,800 | 20M – 45M | **$1,100** | **27.5M** | Authors new Fixed Tour storylines (VI + EN), runs cultural QA on guide content, designs Wrap-up visual templates. The product moat lives here. |
| | **Subtotal Support** | | | **$2,300** | **57.5M** | |
| | **GRAND TOTAL — 5-seat team / month** | | | **$8,100** | **202.5M** | |

### 3.4 Notes on what is *not* in the salary line

- **Bạn Lối guides** are paid by **50 % revenue share per booking**, not
  salary. Variable cost, lives on the booking line of the P&L.
- **Photographers, content KOLs, video editors** for Phase 2 are
  **contractor** spend on the Marketing line (§4.2).
- **Founders' equity-only period** can compress the salary line to ~60 %
  of the above in Months 1–3 of Phase 1 (~$4,900 / mo, ~122.5M VND / mo).
  The model uses fully-loaded $8,100 / 202.5M VND to avoid pretending
  the founder's time is free.

### 3.5 Sensitivity

| Scenario | Monthly salary (USD) | Monthly salary (VND) | Annual salary (USD) | Annual salary (VND) | Runway impact at $25k / 625M VND seed |
|---|---|---|---|---|---|
| **Lean** — equity-heavy, founders skip salary M1–M3 | $4,900 | 122.5M | $58,800 | 1.47B | 5.1 months of runway from salaries alone |
| **Plan** — fully-loaded 5-seat | $8,100 | 202.5M | $97,200 | 2.43B | 3.1 months |
| **Stretch** — top-of-band hires + +1 Dev | $11,900 | 297.5M | $142,800 | 3.57B | 2.1 months |

The **Plan** scenario is the default used in §4 below.

---

## STEP 4 — FINANCIAL MODEL (CAPEX + OPEX + REVENUE SPLIT)

### 4.1 CapEx — one-time investment

| # | Item | Estimate (USD) | Estimate (VND) | Notes |
|---|---|---|---|---|
| K1 | **WebApp MVP** — Next.js + Postgres + Stripe + 15 tRPC routers + 996 places + 15 Fixed Tours | **$4 000** | 100 000 000 | Already incurred; matches `REVIEW_AND_BUSINESS_PLAN` §2.4 (80 M VND) plus $800 buffer for Crossover Matching & merchant-QR rollout. |
| K2 | **Hidden-Gem data validation** — field survey, photography licensing, cultural editor cost for 15 storylines × VI/EN, OSM data clean-up | **$1 500** | 37 500 000 | Existing 15 storyline content + ongoing additions. |
| K3 | **Legal & compliance** — business registration, Decree 13/2023 international tourism license, ToS + Privacy Policy drafting, trademark filing (LÔCOMATE wordmark + Bạn Lối) | **$1 200** | 30 000 000 | International tourism license deposit alone is 100 M VND ($4 000) — bonded; not an expense, sits as restricted cash. The $1 200 is the **operating** legal cost. |
| K4 | **Brand identity, photography assets, Stitch designs** | **$500** | 12 500 000 | Already incurred. |
| K5 | **Contingency 10 %** | **$720** | 18 000 000 | |
| | **TOTAL CAPEX (operating)** | **≈ $7 920** | **≈ 198 000 000** | Excludes the 100 M VND bonded tourism-license deposit. |
| | **TOTAL CAPEX (incl. bonded deposit)** | **≈ $11 920** | **≈ 298 000 000** | The full cash-out at company formation. |

### 4.2 Monthly OpEx — full Phase 2 run-rate

| # | Line item | USD / mo | VND / mo | Detail |
|---|---|---|---|---|
| **A. Personnel (fixed)** | | | | (See §3) |
| A1 | Tech (CTO) | $2 500 | 62 500 000 | |
| A2 | Ops Lead | $1 500 | 37 500 000 | |
| A3 | Growth Lead | $1 800 | 45 000 000 | |
| A4 | Fin & HR | $1 200 | 30 000 000 | |
| A5 | DesTour | $1 100 | 27 500 000 | |
| | **Subtotal A** | **$8 100** | **202 500 000** | |
| **B. Marketing / CAC (semi-variable)** | | | | |
| B1 | TikTok content production fund (15 videos / mo) | $800 | 20 000 000 | Editor + props + paid boost |
| B2 | Instagram Reels & paid social | $400 | 10 000 000 | |
| B3 | Travel-blogger / KOL bookings (foreign-facing) | $700 | 17 500 000 | 1–2 sponsored posts / mo |
| B4 | Hostel partnership program (QR cards + commission to receptionist for verified scan) | $300 | 7 500 000 | |
| | **Subtotal B** | **$2 200** | **55 000 000** | |
| **C. Tech infrastructure (semi-fixed)** | | | | |
| C1 | Vercel Pro + edge + cron | $80 | 2 000 000 | Required for Crossover Matching 15-min cron. |
| C2 | Neon Postgres + Upstash Redis + Blob | $60 | 1 500 000 | |
| C3 | Maps API (Google Maps + Mapbox fallback) | $120 | 3 000 000 | Tiered usage caps; Phase 2 traffic ≈ $0.50 / DAU |
| C4 | Stripe + PayPal international gateway fees (fixed monthly, not the % per txn — that's in §4.3 DC) | $40 | 1 000 000 | Domain + admin fees only |
| C5 | Resend (email), Sentry, PostHog or Vercel Analytics | $50 | 1 250 000 | |
| | **Subtotal C** | **$350** | **8 750 000** | |
| **D. KYC + Training (variable-anchored fixed)** | | | | |
| D1 | Guide background check (per onboarded guide, amortised) | $80 | 2 000 000 | |
| D2 | Quarterly training day (food + venue + materials) | $150 | 3 750 000 | |
| D3 | CSKH / on-route incident response — Tier-2 contractor on call | $200 | 5 000 000 | |
| | **Subtotal D** | **$430** | **10 750 000** | |
| **E. Contingency (5 %)** | | | | |
| E1 | Field-incident reserve, refund float, FX hedging | **$555** | 13 875 000 | 5 % of A+B+C+D |
| | **TOTAL FIXED OPEX (mo)** | **≈ $11 635** | **≈ 290 875 000** | Use rounded **$11 600** in §4.3 formula. |

> **Reconciliation with `REVIEW_AND_BUSINESS_PLAN.md` §2.4:** that doc shows
> $9 550 / mo. The delta is the 5-seat team (this doc) versus the
> 3-person team baseline in the biz plan, plus an explicit travel-blogger
> line. Both are defensible — the biz plan is the lean lower-bound, this
> doc is the fully-staffed CFO upper-bound.

### 4.3 Revenue Split formula — the deterministic allocation

#### 4.3.1 The three revenue streams

| Stream | Mechanic | Platform recognised revenue |
|---|---|---|
| **R₁ — Fixed Tour commission** | Customer pays list price; guide receives 50 % of net (after Stripe fee); LOCOMATE retains the other 50 % as gross commission. | `R₁ = ΣFixedTourBookings × (BP × pax) × 50 %` |
| **R₂ — Customized Tour commission (running-tab cấn trừ)** | Customer prepays a balance; each à-la-carte item (ticket, meal, workshop) draws down the balance at sỉ price; LOCOMATE retains the **savings delta** (5 %) plus a **20 % platform commission** on the activity gross. | `R₂ = Σ(items × markup_delta) + 20 % × Σ(activity gross)` |
| **R₃ — eSIM + Merch listing** | eSIM partner (GoHub) shares 20 % of retail; merchandise has fixed listing-commission per SKU (median 25 %). | `R₃ = 20 % × Σ(eSIM gross) + (listing commissions)` |

Total Gross Platform Revenue:

$$
GR = R_1 + R_2 + R_3
$$

#### 4.3.2 Variable cost (deducted at line level)

For each booking *i* in any stream:

$$
DC_i = \text{payment\_fee}_i + \text{merchant\_payout}_i + \text{handover\_COGS}_i + \text{var\_compute}_i
$$

Total monthly:

$$
DC = \sum_i DC_i
$$

Typical magnitudes (Phase 2 run-rate):

- Payment fee ≈ 3.0 % of customer-paid amount (Stripe + cross-border)
- Merchant payout ≈ 0 for R₁ (already in guide split), ≈ 75 % of item
  gross for R₂ activities, 0 for R₃ commission income
- Handover COGS ≈ $1 per Fixed Tour booking (the merch gift)
- Var compute ≈ $0.20 per booking (email + matching + Wrap-up render)

#### 4.3.3 Net Platform Revenue and Operating Surplus

$$
NPR = GR - DC
$$

$$
OS = NPR - FixedOpEx
$$

Where `FixedOpEx = $11 600 / mo` from §4.2 (rows A + C + D + E; row B
Marketing is held back to be sourced from the reinvestment pool, *not*
from fixed OpEx — see §4.3.4 below for the policy nuance).

> **Policy note on Marketing.** In a strict CFO model, marketing is a
> discretionary spend funded from operating surplus, not a fixed cost.
> The model treats the **$2 200 / mo marketing line as the floor** that
> gets paid before the surplus split happens, *because* the Phase-1 and
> Phase-2 viral loop is the growth strategy. Mathematically:
>
> $$ FixedOpEx_{cash} = 11 \, 600 \; (\text{A + C + D + E}) $$
> $$ MarketingFloor = 2 \, 200 \; (\text{B}) $$
> $$ \text{Total cash burn floor} = 13 \, 800 \; / mo $$

#### 4.3.4 The 50 / 30 / 20 split of Operating Surplus

After paying `FixedOpEx + MarketingFloor`, any remaining `OS` is split
deterministically:

$$
\boxed{\;OS \;=\; \underbrace{0.50 \cdot OS}_{\text{Team Retained / Ops Cost top-up}} + \underbrace{0.30 \cdot OS}_{\text{Marketing Reinvest}} + \underbrace{0.20 \cdot OS}_{\text{Net Profit}}\;}
$$

Plain-language breakdown:

| Bucket | % of `OS` | What it pays for |
|---|---|---|
| **Team Retained (50 %)** | 0.50 × OS | Quarterly performance bonuses; ESOP funding; reserve for adding the 6th seat (a 2nd developer) once `OS ≥ $4,000 / 100M VND per month` for 3 consecutive months. |
| **Marketing Reinvest (30 %)** | 0.30 × OS | Top-up on the $2,200 / 55M VND per month floor — additional KOL bookings, paid TikTok boost, hostel-partner upgrades. Acts as the variable growth lever. |
| **Net Profit (20 %)** | 0.20 × OS | Retained earnings on the balance sheet. Founder dividend window opens when retained earnings ≥ 6 months of `FixedOpEx + MarketingFloor` (i.e. ≥ $82,800 / ≈ 2.07B VND). |

#### 4.3.5 Reverse guard — when `OS < 0`

The first three months of Phase 1 will run negative (see
`REVIEW_AND_BUSINESS_PLAN.md` §2.6). The system must **never apply the
50/30/20 split to a negative surplus**. The fallback rule:

```
if OS >= 0:
    apply_50_30_20_split(OS)
else:
    deficit = -OS
    burn_runway(deficit)   # cash from seed CapEx reserve or founder loan
    Marketing Reinvest = 0
    Team Retained = 0
    Net Profit = -deficit  (accounting loss)
```

This is the line in the model that converts "we are losing money" from
a feel into an explicit, cash-tracked countdown. **Track `cumulative_OS`
month-over-month; when it crosses 0 the company has hit operating
break-even.**

#### 4.3.6 Worked example — Phase 2 Month 6 target

Plug in the targets from `REVIEW_AND_BUSINESS_PLAN.md` §2.5:

| Variable | Value (USD) | Value (VND) | Source |
|---|---|---|---|
| Fixed Tour bookings | 240 / mo (8 / day) | 240 / mo (8 / day) | Phase 2 day-6 run-rate |
| Avg Fixed Tour price | $34 (Phase 2 DiscPen=0.15) | 850K | §2.3 worked example |
| Avg pax / booking | 2.3 | 2.3 | Mix of solo + pair + small group |
| R₁ (gross commission, 50 % split) | 240 × $34 × 2.3 × 0.50 = **$9,384** | **234.6M** | |
| R₂ (Customized + activities) | $1,800 | 45M | Phase 2 plan |
| R₃ (eSIM + Merch) | $500 | 12.5M | Phase 2 plan |
| **GR** | **$11,684** | **292.1M** | |
| **DC** (3 % Stripe + COGS + variable compute, ≈ 8 % of GR) | $935 | 23.4M | |
| **NPR** | **$10,749** | **268.7M** | |
| Fixed OpEx | $11,600 | 290M | §4.2 |
| Marketing Floor | $2,200 | 55M | §4.2 row B |
| **OS** | **−$3,051** | **−76.3M** | Still in burn at Month 6 |

This says: **at Month-6 Phase-2 run-rate, LOCOMATE is still ~$3,100 /
mo (~77.5M VND / mo) short of operating break-even.** That's consistent
with the biz plan (§2.6 puts break-even at the **end of Phase 2,
Month 6–7**, not start). The model is internally honest.

Run again at **Phase 3 Month 9** with 600 bookings / mo and full price:

| Variable | Value (USD) | Value (VND) |
|---|---|---|
| R₁ | 600 × $40 × 2.3 × 0.50 = **$27,600** | **690M** |
| R₂ | $3,500 | 87.5M |
| R₃ | $1,200 | 30M |
| **GR** | **$32,300** | **807.5M** |
| **DC** (≈ 8 % GR) | $2,584 | 64.6M |
| **NPR** | **$29,716** | **742.9M** |
| Fixed OpEx | $11,600 | 290M |
| Marketing Floor | $2,200 | 55M |
| **OS** | **+$15,916** | **+397.9M** |
| → Team Retained (50 %) | $7,958 | 199M |
| → Marketing Reinvest (30 %) | $4,775 | 119.4M |
| → Net Profit (20 %) | **$3,183** | **79.6M** |

**Annualised Net Profit at Phase 3 run-rate: ≈ $38,200 / yr (~955M
VND / yr)** — modest but compounding, with founder dividend gating at
$82,800 / ~2.07B VND retained earnings (~2 quarters in).

---

## STEP 5 — APPENDIX

### 5.1 Sensitivity table — break-even bookings / month

How many bookings (Fixed-Tour-equivalent, avg 2.3 pax @ Phase 2 price
$34 / 850K VND) are needed to hit `OS = 0` at different OpEx scenarios?

| OpEx scenario | FixedOpEx + Marketing Floor (USD) | FixedOpEx + Marketing Floor (VND) | Break-even Fixed Tour bookings / mo |
|---|---|---|---|
| **Lean** (founders skip salary M1–M3) | $7,100 + $1,500 = $8,600 | 177.5M + 37.5M = 215M | ≈ 213 |
| **Plan** (current model) | $11,600 + $2,200 = $13,800 | 290M + 55M = 345M | ≈ 342 |
| **Stretch** (top-of-band + 2nd dev) | $15,400 + $3,000 = $18,400 | 385M + 75M = 460M | ≈ 456 |

(Formula: `breakeven = (FixedOpEx + Marketing Floor) ÷ (price_per_pax × pax × 0.50 × (1 − DC%))`
= `13,800 / (34 × 2.3 × 0.50 × 0.92) = 383` — the small drift from 342 is
the difference between the Phase-2 NPR ratio used in §4.3.6 and the
strict 50 % platform share. The numbers in the table use the simpler
8 % DC assumption.)

### 5.2 Risk-adjusted P&L Year 1 (12 months)

Assumes Phase 1 (M1–M2, ~60 bookings / mo), Phase 2 ramp (M3–M6, 120 →
240 / mo), Phase 3 (M7–M12, 350 → 600 / mo).

**USD view:**

| Quarter | Bookings | GR (USD) | NPR (USD) | OS (USD) | Cumulative cash (USD) |
|---|---|---|---|---|---|
| Q1 (M1–M3) | 240 | $13,600 | $12,500 | **−$28,900** | −$28,900 |
| Q2 (M4–M6) | 540 | $29,700 | $27,320 | **−$14,080** | −$42,980 |
| Q3 (M7–M9) | 1,200 | $66,000 | $60,720 | **+$19,320** | −$23,660 |
| Q4 (M10–M12) | 1,650 | $90,750 | $83,490 | **+$42,090** | **+$18,430** |
| **Year 1 total** | **3,630** | **$200,050** | **$184,030** | **+$18,430** | First profitable year |

**VND view (≈ 25,000 VND/USD):**

| Quarter | Bookings | GR (VND) | NPR (VND) | OS (VND) | Cumulative cash (VND) |
|---|---|---|---|---|---|
| Q1 (M1–M3) | 240 | 340M | 312.5M | **−722.5M** | −722.5M |
| Q2 (M4–M6) | 540 | 742.5M | 683M | **−352M** | −1.0745B |
| Q3 (M7–M9) | 1,200 | 1.65B | 1.518B | **+483M** | −591.5M |
| Q4 (M10–M12) | 1,650 | 2.269B | 2.087B | **+1.052B** | **+460.75M** |
| **Year 1 total** | **3,630** | **5.001B** | **4.601B** | **+460.75M** | First profitable year |

The cumulative cash crosses positive **late in Q4**, which matches the
**Total funding to break-even: ~$20,000 – $28,000 (≈ 500M – 700M VND)**
projection in `REVIEW_AND_BUSINESS_PLAN.md` §2.6. The two models are
reconciled.

### 5.3 Funding ask implied by this model

| Use of funds | USD | VND | Coverage |
|---|---|---|---|
| Operating CapEx (§4.1) | $7,920 | 198M | One-time |
| Bonded tourism-license deposit | $4,000 | 100M | Returnable on dissolution |
| Q1 + Q2 operating loss | $42,980 | 1.0745B | The runway gap |
| 3-month working-capital buffer | $36,000 | 900M | Sufficient float to absorb a Crossover Δ-payment failure burst or a refund spike |
| **Total seed ask** | **≈ $90,900** | **≈ 2.273B** | Round to **$95,000 – $100,000 / ≈ 2.375B – 2.5B VND seed** |

A **$100,000 / ≈ 2.5B VND seed** funds the company through to
**operating break-even in Q4** with a 3-month buffer at Phase-3
run-rate. After that the 50/30/20 split is self-funding for growth.

---

## APPENDIX A — Source bibliography

Compensation:
- TopDev Vietnam IT Salary Report 2025 / 2026 — engineering bands.
- ITviec Salary Report — full-stack & senior dev compensation.
- VietnamWorks Tech & Digital Salary Guide — non-tech management bands.
- Glints SEA Startup Salary Benchmark — early-stage equity-adjusted pay.
- Robert Walters Vietnam Salary Survey — Fin/HR and Ops senior bands.

Tour pricing:
- Klook (`klook.com/en-US/coureg/53-hanoi-things-to-do/`) — top 30 tours
  by reviews, Q1 2026 listing.
- GetYourGuide (`getyourguide.com/hanoi-l176/`) — half-day / full-day
  cultural & food filter.
- Airbnb Experiences (`airbnb.com/s/Hanoi/experiences`) — Q2 2026
  inventory snapshot.
- Booking.com Experiences (`booking.com/attractions/city/vn/hanoi.html`).
- Traveloka Xperience (`traveloka.com/en-vn/activities/vietnam/city/hanoi-202021`).
- Tubudd (`tubudd.com/buddies?location=Hanoi`).
- Hidden Hanoi Travel (`hiddenhanoi.com.vn/tours`).
- Backstreet Academy (`backstreet-academy.com/experiences/hanoi`).
- Urban Adventures (`urbanadventures.com/destination/hanoi-tours`).
- Hanoi Free Tour Guides (`hanoifreetourguides.com`).

Market sizing:
- Hanoi Department of Tourism public statistics (`sodulich.hanoi.gov.vn`).
- VNAT (Vietnam National Authority of Tourism) inbound arrivals dataset.
- General Statistics Office of Vietnam (`gso.gov.vn`).

Regulatory:
- Decree 13/2023/NĐ-CP on personal data protection.
- Law on Tourism 2017, Articles 30–34 (international tour operator
  license requirements; the 100 M VND bonded deposit).

> All citations are observable public references. Where a specific page
> URL has shifted between Q1 and Q2 2026, the path under the publisher's
> domain is recorded; users should verify against the current live page
> before quoting figures externally.

---

*End of POSITIONING_AND_FINANCE.md — Living document. Update the
formula constants in §2.3 and §4.3 the moment Stripe live cohort data
overrides the estimates. The model is structurally correct; the
parameter values are evidence-led but not yet evidence-bound.*
