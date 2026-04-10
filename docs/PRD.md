# LOCOMATE - Product Requirements Document (PRD)

**Version:** 1.0
**Date:** April 7, 2026
**Scope:** Local Development (Hanoi Pilot)
**Platform:** Progressive Web App (PWA)

---

## 1. Product Overview

### 1.1 Product Name
**LOCOMATE** - AI-Powered Personalized Travel Experience Platform

### 1.2 Slogan
*Go a place, know its grace* - Di cho dung, gap cho trung

### 1.3 Vision
LOCOMATE is a web application that provides AI-driven personalized travel experiences for solo travelers in Hanoi, combining place discovery, social matching, and customized tour design into a single integrated platform.

### 1.4 Scope of Implementation
This PRD covers the **local MVP** deployment targeting Hanoi, Vietnam as the pilot city. The system will run entirely on local/cloud infrastructure without third-party tour operator integrations.

---

## 2. Problem Statement

Solo travelers visiting Hanoi face three structural problems:

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Information overload** | Fragmented planning across multiple apps; unable to filter for personal preferences |
| 2 | **Lack of social connection** | 55%+ solo travelers report difficulty finding trustworthy companions |
| 3 | **No true personalization** | Existing platforms offer generic place lists, not behavior-driven itineraries |

---

## 3. Target Users

### 3.1 Traveler (Primary User)
- **Demographics:** 20-35 years old, Gen Z / Millennials / Digital Nomads
- **Income:** $5,000-$10,000/month
- **Behavior:** Tech-savvy, uses mobile apps for planning, prefers authentic local experiences over mass tourism
- **Willingness to pay:** $3-$10 USD for personalized services

### 3.2 Local Host (Service Provider)
- **Demographics:** 18-30 years old, students / freelancers in Hanoi
- **Skills:** Conversational English, deep knowledge of local culture and hidden gems
- **Motivation:** Earn flexible income, practice English, share culture

---

## 4. Product Architecture

LOCOMATE consists of three integrated subsystems:

```
+-------------------+     +-------------------+     +-------------------+
|    LocoRec         |     |    LocoMatch       |     |  Customized Tour   |
|   (Discovery)      |     |   (Social)         |     |   (Core Revenue)   |
|   FREE             | --> |   FREE             | --> |   PAID             |
+-------------------+     +-------------------+     +-------------------+
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                    +---------------------------+
                    |   User Profile Engine     |
                    |   (Explicit + Derived +   |
                    |    Implicit Data)         |
                    +---------------------------+
```

---

## 5. Functional Requirements

### 5.1 Authentication & Onboarding

#### FR-AUTH-01: User Registration
- Email/password registration
- Google OAuth and Apple Sign-In
- Phone number verification via OTP

#### FR-AUTH-02: Role Selection
- User selects role: **Traveler** or **Host**
- Host registration requires additional identity verification (CCCD/Passport upload)

#### FR-AUTH-03: Onboarding Questionnaire (Traveler)
Maximum 8 questions collecting >= 3 data variables each:

| # | Question | Type | Data Collected |
|---|----------|------|----------------|
| 1 | Travel intent | Multi-select (max 3) | `intent[]` |
| 2 | Scenario: "3 hours in a new city" | Single choice | `scenario_choice`, `energy_level`, `social_preference` |
| 3 | Trade-off: comfort vs variety | Binary slider | `flexibility_score`, `planning_score` |
| 4 | Travel style | Dual slider | `chill_explore_scale`, `plan_spontaneous_scale` |
| 5 | Interests | Multi-select | `interest[]` |
| 6 | Budget level | Single choice | `budget_level` |
| 7 | Social preference | Binary | `social_preference` |
| 8 | Available time | Multi-select | `time_preference[]` |

**Output:** Creates `ExplicitProfile` object with fields: `intent`, `interest`, `budget`, `style`, `scenario_choice`, `social_preference`

#### FR-AUTH-04: Host Profile Setup
- Full name, photo, bio (max 300 chars)
- Languages spoken with proficiency level
- Areas of expertise (food, culture, nightlife, photography, etc.)
- Available time slots (recurring weekly schedule)
- Identity document upload (manual review queue)

---

### 5.2 LocoRec - Place Discovery (FREE)

#### FR-REC-01: Place Feed
- Scrollable feed of places categorized as: `hidden_gem` | `popular`
- Each place card shows: name, photo, category, distance, experience tags, emotional tags
- Pull-to-refresh and infinite scroll pagination

#### FR-REC-02: Place Data Model

```
Place {
  place_id: string (UUID)
  name: string
  geo_location: { lat: float, lng: float }
  category: enum [cafe, restaurant, bar, cultural, nature, workshop, nightlife, other]
  photos: string[] (max 5 URLs)
  description: string (max 500 chars)

  // Experience Tags (>= 8 dimensions, 0.0 - 1.0 scale)
  experience_tags: {
    authenticity: float
    popularity: float
    uniqueness: float
    price_level: float
    accessibility: float
    avg_duration_minutes: int
    indoor_outdoor: enum [indoor, outdoor, mixed]
    noise_level: float
  }

  // Emotional Tags (>= 6 dimensions, 0.0 - 1.0 scale)
  emotional_tags: {
    relaxing: float
    exciting: float
    social: float
    inspiring: float
    immersive: float
    nostalgic: float
  }

  source: enum [host_contributed, user_contributed, system_seeded]
  verified: boolean
  created_at: timestamp
}
```

#### FR-REC-03: Place Filtering
- Filter by: category, distance (radius), price level, time of day, indoor/outdoor
- Sort by: relevance (personalized), distance, popularity, newest

#### FR-REC-04: Place Detail View
- Full photo gallery
- Description and practical info (hours, price range, address)
- Map with directions link (Google Maps deeplink)
- Reviews from verified visitors
- "Add to Tour" action button

#### FR-REC-05: Place Contribution
- Verified users (completed >= 1 experience) can submit new places
- Host users can submit places directly
- Submissions enter a moderation queue before publishing

---

### 5.3 LocoMatch - Social Matching (FREE)

#### FR-MATCH-01: User Discovery
- Swipe-based interface (left = skip, right = interested)
- Display: avatar, bio, travel plan summary, compatibility score

#### FR-MATCH-02: Matching Algorithm

```
MatchScore = w1 * interest_overlap
           + w2 * intent_similarity
           + w3 * travel_timing_overlap
           + w4 * language_compatibility
           + w5 * social_preference_alignment

where w1=0.25, w2=0.25, w3=0.20, w4=0.15, w5=0.15
```

- Only show users within same city and overlapping travel dates
- Minimum threshold score: 0.40 to appear in feed

#### FR-MATCH-03: Match Confirmation
- Mutual swipe-right creates a "Match"
- Push notification to both users
- Chat is unlocked upon match

#### FR-MATCH-04: Chat System
- 1:1 text messaging between matched users
- Support for text, emoji, and image sharing
- Chat persists for 30 days after last message (auto-archive)
- Report/block functionality per user

#### FR-MATCH-05: Profile Display
- Traveler profile shows: name, age, nationality, bio, interests, travel dates, compatibility score
- No sensitive information (email, phone) exposed until mutual opt-in

---

### 5.4 Customized Tour - Personalized Itinerary (PAID)

#### FR-TOUR-01: Tour Request Input
User provides:
- Destination city (Hanoi - default for MVP)
- Available date and time window
- Duration preference (2-4 hours)
- Budget level (low / medium / high)
- Interest focus (multi-select from interest tags)
- With/without Host (boolean)
- Group preference (solo / small group 2-4)

#### FR-TOUR-02: Tour Generation Engine
System processes:
1. Combine `ExplicitProfile` + `DerivedProfile` + `RequestContext`
2. Filter compatible places from LocoRec database
3. Score each place against user profile (experience + emotional tag matching)
4. Select top-N places (3-6 depending on duration)
5. Optimize route for walking/transport efficiency
6. Allocate time per stop based on place avg_duration and user energy_level
7. Generate tour object with timeline

#### FR-TOUR-03: Tour Preview (FREE)
Before payment, user sees:
- 3-4 place names with brief descriptions
- Suggested time slots and duration overview
- Estimated total cost range
- Compatibility explanation ("Why this tour fits you")

#### FR-TOUR-04: Full Tour (PAID - unlocked after payment)
Complete itinerary includes:
- Detailed stop-by-stop guide (6+ places)
- Precise timeline with recommended arrival/departure times
- Walking/transport directions between stops
- Insider tips per stop
- Budget breakdown
- Personalization rationale per stop

#### FR-TOUR-05: Tour Editing
- User can swap individual stops (system suggests alternatives)
- User can adjust time allocation per stop
- User can reorder stops (system recalculates route)
- Changes trigger re-optimization of remaining itinerary

#### FR-TOUR-06: Host Add-On
When user selects "with Host":
- System shows compatible hosts based on:
  - Availability at requested time
  - Expertise matching tour theme
  - Personality compatibility (from derived vectors)
- Host profile card with: photo, bio, rating, reviews, specialties
- Chat with Host before confirming (pre-booking conversation)
- Host assignment is confirmed once both parties agree

#### FR-TOUR-07: Active Tour Mode
During the tour:
- Step-by-step navigation view
- Current stop highlighted with countdown timer
- "Mark as visited" action per stop
- Emergency contacts accessible (local police, ambulance)
- Optional real-time location sharing with emergency contact

---

### 5.5 Payment

#### FR-PAY-01: Payment Plans

| Product | Price (USD) | Price (VND) | Description |
|---------|-------------|-------------|-------------|
| **Loco Route** | ~$10 | 250,000 | AI-generated itinerary only |
| **Solo Mate** | ~$30 | 750,000 | Itinerary + dedicated 1:1 Host |
| **Social Tour** | ~$40/group | 1,000,000 | Itinerary + Host for group of 3-4 |

#### FR-PAY-02: Payment Methods
- International credit/debit cards (Visa, Mastercard)
- QR code payment (VNPay, MoMo) for local convenience
- Payment processed via a single payment gateway (Stripe or VNPay)

#### FR-PAY-03: Payment Flow
1. User selects tour package
2. System shows price breakdown
3. User selects payment method
4. Redirect to payment gateway
5. On success: unlock full tour, send confirmation email
6. On failure: show retry option, no tour unlock

#### FR-PAY-04: Refund Policy
- Full refund if tour not started and cancellation > 24h before
- 50% refund if cancellation 2-24h before
- No refund within 2h of tour start time
- Host cancellation triggers automatic full refund

---

### 5.6 User Profile & Data System

#### FR-PROF-01: Three-Layer Data Model

**Layer 1 - Explicit Data** (user-provided during onboarding):
- `intent`, `interest`, `budget`, `style`, `scenario_choice`, `social_preference`

**Layer 2 - Derived Data** (AI-inferred from explicit data):

| Vector | Dimensions |
|--------|------------|
| Personality | `extroversion_score`, `planning_score`, `curiosity_score`, `flexibility_score`, `depth_score`, `energy_score` |
| Behavior | `spending_pattern`, `decision_speed`, `edit_frequency`, `exploration_pattern`, `risk_behavior`, `mobility_preference` |
| Emotional | `relaxation_weight`, `social_weight`, `exploration_weight`, `inspiration_weight`, `escapism_weight`, `novelty_seeking` |

**Layer 3 - Implicit Data** (tracked from in-app behavior):
- `click_history`, `dwell_time`, `scroll_depth`, `interaction_frequency`, `edit_actions`, `match_behavior`

#### FR-PROF-02: Profile Management
- Users can view and edit explicit data at any time
- Derived data is recalculated on profile update and periodically from implicit data
- Users can view a simplified version of their "travel personality" (gamified display)

---

### 5.7 Reviews & Quality Control

#### FR-REV-01: Post-Experience Reviews
- Rating: 1-5 stars
- Text review (max 500 chars)
- Photo upload (max 3)
- Only users who completed a tour/visited a place can review

#### FR-REV-02: Host Rating
- Travelers rate Hosts after tour completion
- Dimensions: friendliness, knowledge, punctuality, overall
- Hosts with average < 3.5 stars after 5 reviews are flagged for review

#### FR-REV-03: Report System
- Report user (harassment, inappropriate behavior)
- Report place (inaccurate info, unsafe)
- Report Host (no-show, unprofessional)
- Reports enter moderation queue with 24h SLA

---

### 5.8 Safety Features

#### FR-SAFE-01: Identity Verification
- Hosts: mandatory CCCD/Passport upload + manual verification
- Travelers: optional identity verification (badge on profile)

#### FR-SAFE-02: Emergency Contacts
- Every user must set at least 1 emergency contact
- Quick-access emergency numbers: police (113), ambulance (115), fire (114)

#### FR-SAFE-03: Location Sharing
- During active tour: optional real-time GPS sharing with emergency contact
- Location data retained for 48h post-tour, then deleted

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Page load time: < 2 seconds on 4G connection
- Tour generation: < 30 seconds
- Match algorithm response: < 500ms
- API response time (p95): < 1 second

### 6.2 Scalability (MVP Targets)
- Support 500 concurrent users (Phase 1)
- Support 3,000 monthly active users (Phase 2)
- Support 10,000 monthly active users (Phase 3)

### 6.3 Availability
- 99.5% uptime target
- Scheduled maintenance window: 2:00-4:00 AM ICT (Tuesday)

### 6.4 Security
- All data in transit encrypted via TLS 1.3
- User passwords hashed with bcrypt (cost factor 12)
- PII (identity documents) encrypted at rest (AES-256)
- OWASP Top 10 compliance
- Vietnamese Personal Data Protection Decree (Decree 13/2023) compliance

### 6.5 Localization
- Primary language: English
- Secondary language: Vietnamese
- All user-facing strings externalized for i18n

### 6.6 Accessibility
- WCAG 2.1 Level AA compliance
- Responsive design: mobile-first (375px-428px), tablet (768px), desktop (1440px)

---

## 7. MVP Feature Prioritization

### Phase 1 - Beta & Seed (Months 1-4)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | User registration & onboarding | Must have |
| P0 | LocoRec basic place feed with 200+ Hanoi places | Must have |
| P0 | Customized Tour generation (Loco Route) | Must have |
| P0 | Payment integration (single gateway) | Must have |
| P1 | LocoMatch basic swipe + chat | Must have |
| P1 | Host registration & verification workflow | Must have |
| P1 | Tour Preview (free) + Full Tour (paid) | Must have |
| P2 | Host add-on for tours | Should have |
| P2 | Post-experience reviews | Should have |

### Phase 2 - Viral Growth (Months 5-9)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | Social Tour (group matching) | Must have |
| P1 | Active Tour Mode with navigation | Should have |
| P1 | Advanced matching algorithm (behavior vectors) | Should have |
| P2 | Location sharing for safety | Nice to have |
| P2 | Place contribution by users | Nice to have |

### Phase 3 - Steady State (Months 10-15)

| Priority | Feature | Status |
|----------|---------|--------|
| P1 | Full implicit data tracking & profile refinement | Should have |
| P1 | Tour module library (100+ modules) | Should have |
| P2 | Advanced AI personalization (emotional matching) | Nice to have |
| P2 | Multi-city expansion preparation | Nice to have |

---

## 8. Screen Flow

```
Splash --> Onboarding (8 questions)
       --> Home Dashboard (tabs: Home | Explore | Match | Plan | Profile)

Home Tab:
  Personality Badge --> Nearby Travelers --> Hidden Gems --> Recent Tours
  Active Tour Banner --> Resume Tour

Explore Tab:
  Place Feed --> Place Detail --> Add to Tour / Save

Match Tab:
  Swipe Cards --> Match Notification --> Chat
  Chat --> "Plan Together" CTA --> Tour Builder (with companion)

Plan Tab:
  New Tour Request --> Tour Preview (FREE)
                  --> Payment --> Full Tour (PAID)
                             --> Active Tour Mode
                             --> Post-Tour Review (1-5 stars + comment)

Profile Tab:
  User Info --> My Preferences (view/edit) --> Personality Recompute
           --> Tour History (expandable, with dates)
           --> Emergency Contacts (expandable, from DB)
           --> Settings

Auth:
  Login (email + Google OAuth + Apple)
  Register (email + Google + Apple, role toggle)
```

---

## 9. Success Metrics (KPIs)

### North Star Metric
**Total Successful Experiences** = Completed booking + Duration >= 45 min/stop + Rating >= 4.5/5

### Input Metrics

| Metric | Target (Phase 1) | Target (Phase 3) |
|--------|-------------------|-------------------|
| App downloads (organic from target segment) | 500 | 10,000+ |
| Onboarding completion rate | >= 70% | >= 80% |
| Tour conversion rate (preview -> purchase) | >= 15% | >= 25% |
| Match success rate (match -> chat) | >= 40% | >= 60% |
| Host active rate (weekly) | >= 80% | >= 85% |
| Average host rating | >= 4.5/5 | >= 4.5/5 |
| Experience return rate (2nd purchase) | >= 20% | >= 35% |
| Paying customers per day | 2-3 | 13-14 |

---

## 10. Revenue Projections (Phase 3 Target)

| Revenue Stream | Daily Volume | Unit Profit (VND) | Monthly Revenue (VND) |
|----------------|-------------|-------------------|----------------------|
| Loco Route | 10 orders | 240,000 | 72,000,000 |
| Solo Mate | 2 orders | 375,000 | 22,500,000 |
| Social Tour | 1.5 orders | 500,000 | 22,500,000 |
| **Total** | | | **~117,000,000** |

Monthly OpEx: ~115,000,000 VND --> **Break-even at Phase 3**

---

## 11. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Payment failure mid-transaction | Retry prompt; no tour unlock; log for support |
| Host cancels last minute | Auto-refund; offer rebooking with alternative host |
| User abandons mid-tour | Tour remains accessible for 72h; no additional charge |
| No compatible hosts available | Offer Loco Route (without host) at reduced price |
| Match with inappropriate user | Report/block; auto-unmatch; moderation review |
| Low place availability in area | Expand search radius; show "popular" fallback |

---

## 12. Dependencies & Assumptions

### Dependencies
- Google Maps API (or equivalent) for geolocation and directions
- Payment gateway (Stripe / VNPay) operational
- Initial seeding of 200+ verified places in Hanoi database
- Minimum 15 verified Hosts before public launch

### Assumptions
- Target users have stable 4G internet access in Hanoi
- Users are comfortable with English-language interfaces
- QR code payment is widely adopted by target demographic
- Solo travel to Hanoi continues to grow year-over-year
