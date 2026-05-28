# LOCOMATE - Technical Requirements Document (TRD)

**Version:** 2.0
**Date:** May 26, 2026
**Scope:** Hanoi Pilot (Fixed Tour Matrix + Customized Tours + Activities + Merch + eSIM)
**Platform:** Progressive Web App (PWA), bilingual VI/EN

This TRD pairs with [PRD v2.0](PRD.md) and reflects the May 2026 meeting
output. The Fixed Tour Matrix spec from
[docs/sửa .md](../../docs/s%E1%BB%ADa%20.md) is authoritative for the curated
catalog schema, taxonomy, and matching engine.

## Related docs

- [PRD.md](PRD.md) -- product requirements (the "what").
- [BOOKING.md](BOOKING.md) -- booking lifecycle, state machines, anti-collision rules, refund semantics, concurrency invariants.
- [CHAT.md](CHAT.md) -- chat architecture (SSE + polling), retention, attachments, moderation, rate limits, real-time event shapes.
- [HOST_MARKETPLACE_PLAN.md](HOST_MARKETPLACE_PLAN.md) -- the two-track supply model that the Fixed Tour Matrix extends.
- [TYPOGRAPHY.md](TYPOGRAPHY.md) -- type scale, contrast pairs, tap targets, accessibility guard.

---

## 1. System Overview

### 1.1 Architecture Style
**Monolithic with modular boundaries** for MVP, designed for future extraction into microservices. The system uses a single backend service with clearly separated domain modules.

### 1.2 High-Level Architecture

```
                        ┌──────────────────┐
                        │   CDN (Vercel)    │
                        │   Static Assets   │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Next.js PWA     │
                        │   (Frontend)      │
                        │   React + TS      │
                        └────────┬─────────┘
                                 │ HTTPS
                        ┌────────▼─────────┐
                        │   API Gateway     │
                        │   (Next.js API    │
                        │    Routes / tRPC) │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼───────┐ ┌───────▼────────┐ ┌───────▼────────┐
     │  Auth Module   │ │  Core Module   │ │ Payment Module │
     │  (Clerk/Auth)  │ │  (Tour, Rec,   │ │ (Stripe/VNPay) │
     │                │ │   Match, User) │ │                │
     └────────┬───────┘ └───────┬────────┘ └───────┬────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │   PostgreSQL     │
                        │   (Primary DB)   │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼───────┐ ┌───────▼────────┐ ┌───────▼────────┐
     │   Redis        │ │  Object Store  │ │  External APIs │
     │   (Cache +     │ │  (S3/Supabase  │ │  (Maps, AI,    │
     │    Sessions)   │ │   Storage)     │ │   Payment)     │
     └────────────────┘ └────────────────┘ └────────────────┘
```

### 1.3 Design Principles
- **Mobile-first PWA**: Installable on mobile without app store distribution
- **Offline-capable**: Core tour data cached via Service Worker
- **API-first**: All frontend-backend communication via typed REST/tRPC endpoints
- **Domain-driven modules**: Auth, User, Place, Match, Tour, Payment as isolated modules
- **Progressive enhancement**: Basic functionality works on slow connections

---

## 2. Technology Stack

### 2.1 Frontend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Next.js 15** (App Router) | SSR + PWA support, excellent DX, Vercel deployment |
| Language | **TypeScript 5.x** | Type safety across full stack |
| UI Library | **React 19** | Component-based, large ecosystem |
| Styling | **Tailwind CSS 4** | Rapid mobile-first responsive design |
| Component Library | **shadcn/ui** | Accessible, customizable base components |
| State Management | **Zustand** | Lightweight, minimal boilerplate |
| Data Fetching | **TanStack Query v5** | Caching, background refetch, optimistic updates |
| API Client | **tRPC** | End-to-end type safety with backend |
| Maps | **Leaflet 1.9 + react-leaflet 5.0** (OSM tiles) | Interactive maps, no API key |
| Forms | **React Hook Form + Zod** | Validation, performance |
| Animations | **Framer Motion** | Page transitions, hover states |
| PWA | `manifest.json` + Service Worker (Phase 2) | Offline splash, Add to Home Screen, push |
| Real-time | Native SSE for chat, polling for tour status | Vercel-friendly; see [CHAT.md](CHAT.md) |

### 2.2 Backend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | **Node.js 22 LTS** | JavaScript ecosystem, async I/O |
| Framework | **Next.js 15 App Router** + **tRPC** | Unified deployment, type-safe API |
| Language | **TypeScript 5.x** | Shared types with frontend |
| ORM | **Drizzle ORM** | Type-safe SQL, lightweight, PostgreSQL native |
| Database | **Neon PostgreSQL 16** | Managed Postgres, JSONB for flexible schemas |
| Cache | **Upstash Redis 7** (serverless) | SSE pub/sub for chat, rate limiting, location TTL |
| File Storage | **Vercel Blob** | Wrap-up renders, tour photos, identity docs |
| Real-time | Native SSE + tRPC polling | See [CHAT.md](CHAT.md) |
| Job Queue | Vercel Cron + fire-and-forget API routes | Daily message purge, abandoned-cart reaper, Wrap-up generator |
| AI/ML | **Local cosine matcher** + rule-based explainers | No external LLM; matcher in `app/src/server/lib/cosine.ts` |
| Email | **Resend** | Receipts, Thư Tri ân, host confirmations |
| Push Notifications | Phase 2 — Web Push + FCM | Tour reminders, Wrap-up ready, reroute accepted |
| Payment | **Stripe** (live + test) + **VNPay/MoMo** (Phase 2) | Cards + VND QR |

### 2.3 Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Hosting | **Vercel** (frontend + API) | Zero-config Next.js deployment |
| Database Hosting | **Supabase** (PostgreSQL + Auth) or **Neon** | Managed PostgreSQL with free tier |
| Redis | **Upstash** | Serverless Redis, pay-per-request |
| Object Storage | **Supabase Storage** | Integrated with DB, simple API |
| DNS/CDN | **Vercel Edge Network** | Global CDN, automatic SSL |
| Monitoring | **Vercel Analytics** + **Sentry** | Error tracking, performance monitoring |
| CI/CD | **GitHub Actions** | Automated testing and deployment |
| Secrets | **Vercel Environment Variables** | Encrypted at rest |

### 2.4 Development Tools

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (fast, disk-efficient) |
| **Turborepo** | Monorepo management (if needed) |
| **ESLint + Prettier** | Code quality and formatting |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |
| **Docker Compose** | Local development environment (PostgreSQL, Redis) |
| **Drizzle Kit** | Database migrations |

---

## 3. Database Design

### 3.1 Entity Relationship Overview

```
users ──────────┐
  │              │
  ├── user_profiles (1:1)
  │     ├── explicit_data (JSONB) -- onboarding chat answers
  │     ├── derived_data (JSONB)  -- personalityVector + legacy 18-D
  │     └── implicit_data (JSONB) -- theme, share events, etc.
  │
  ├── host_profiles (1:1, optional)         -- guides ("Bạn Lối")
  │     ├── host_availability (1:N)
  │     └── host_payouts (1:N)
  │
  ├── matches → messages → message_reactions / message_reports / blocks
  │     (1:1 chat threads between travelers and hosts; the deprecated
  │      LocoMatch swipe UI is gone but the schema is preserved so that
  │      chat threads survive)
  │
  ├── tours (1:N)
  │     ├── tour_stops (1:N)
  │     ├── reviews (1:1)
  │     └── payments (1:1)
  │
  ├── orders (1:N)                          -- multi-line cart orders
  │     └── order_items (1:N)
  │
  ├── cart_items (1:N)                      -- persistent cart
  ├── saved_places (M:N with places)
  └── emergency_contacts (1:N)

places ─────────┐ -- 996 real OSM-sourced Hanoi places
  ├── slug, experience_tags (8-D), emotional_tags (6-D)
  └── tour_stops (1:N)

experiences ────────┐ -- host marketplace + curated 6
  ├── authorId, kind (curated|host_custom), status, slug
  └── tours.experienceId (1:N)

fixed_tours ────────┐ -- 15-tour curated catalog (NEW, May 2026)
  ├── tour_id, chapter (MORNING|AFTERNOON|EVENING)
  ├── title_vi / title_en / story_script_vi / story_script_en
  ├── base_price_vnd, max_participants, duration_minutes
  ├── vector (JSONB 4-float array)
  ├── fixed_tour_steps (1:N) -- ordered itinerary with lat/long
  ├── fixed_tour_tags  (1:N) -- MATERIAL / PERSONA / KEYWORD
  └── tours.fixed_tour_id (1:N)

activities ─────────┐ -- à-la-carte workshops + food crawls
  └── activity_slots (1:N) -- time slots with capacity

products ───────────┐ -- merch CMS
  └── product_variants (1:N) -- size/color/stock

host_payouts ────── -- weekly cashflow ledger

Total: 25+ tables. The canonical Drizzle schema lives at
`app/src/server/db/schema.ts`; this overview lists only what's relevant to
the booking / matching / catalog domains.
```

### 3.2 Core Tables

#### `users`
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),
  auth_provider   VARCHAR(50) DEFAULT 'email',
  auth_provider_id VARCHAR(255),
  role            VARCHAR(20) NOT NULL CHECK (role IN ('traveler', 'host', 'admin')),
  display_name    VARCHAR(100) NOT NULL,
  avatar_url      VARCHAR(500),
  phone           VARCHAR(20),
  phone_verified  BOOLEAN DEFAULT FALSE,
  email_verified  BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### `user_profiles`
```sql
CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Explicit Data (from onboarding)
  explicit_data   JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "intent": ["culture", "food"],
  --   "interests": ["cuisine", "nature", "art"],
  --   "budget": "medium",
  --   "style": { "chill_explore": 0.7, "plan_spontaneous": 0.4 },
  --   "scenario_choice": "B",
  --   "social_preference": "meet_new",
  --   "time_preference": ["morning", "evening"]
  -- }

  -- Derived Data (AI-computed)
  derived_data    JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "personality": { "extroversion": 0.7, "planning": 0.3, ... },
  --   "behavior": { "spending_pattern": 0.5, ... },
  --   "emotional": { "relaxation_weight": 0.4, ... }
  -- }

  -- Implicit Data (behavior tracking)
  implicit_data   JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "click_history": [...],
  --   "dwell_times": {...},
  --   "interaction_count": 42
  -- }

  onboarding_completed BOOLEAN DEFAULT FALSE,
  derived_updated_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
```

#### `host_profiles`
```sql
CREATE TABLE host_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio               VARCHAR(300),
  languages         JSONB NOT NULL DEFAULT '[]',
  specialties       VARCHAR(50)[] NOT NULL DEFAULT '{}',
  identity_doc_url  VARCHAR(500),
  verification_status VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verified_at       TIMESTAMPTZ,
  avg_rating        DECIMAL(3,2) DEFAULT 0.00,
  total_reviews     INT DEFAULT 0,
  total_tours       INT DEFAULT 0,
  is_available      BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_host_verification ON host_profiles(verification_status);
CREATE INDEX idx_host_available ON host_profiles(is_available);
```

#### `host_availability`
```sql
CREATE TABLE host_availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID REFERENCES host_profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  UNIQUE(host_id, day_of_week, start_time)
);
```

#### `places`
```sql
CREATE TABLE places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  description     VARCHAR(500),
  category        VARCHAR(50) NOT NULL,
  geo_location    GEOGRAPHY(POINT, 4326) NOT NULL,
  address         VARCHAR(300),
  photos          VARCHAR(500)[] DEFAULT '{}',
  opening_hours   JSONB,
  price_range     VARCHAR(20),

  experience_tags JSONB NOT NULL DEFAULT '{}',
  emotional_tags  JSONB NOT NULL DEFAULT '{}',

  source          VARCHAR(30) DEFAULT 'system_seeded'
    CHECK (source IN ('host_contributed', 'user_contributed', 'system_seeded')),
  is_verified     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,

  contributed_by  UUID REFERENCES users(id),
  avg_rating      DECIMAL(3,2) DEFAULT 0.00,
  total_reviews   INT DEFAULT 0,
  visit_count     INT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_places_geo ON places USING GIST(geo_location);
CREATE INDEX idx_places_category ON places(category);
CREATE INDEX idx_places_active ON places(is_active, is_verified);
```

#### `fixed_tours` / `fixed_tour_steps` / `fixed_tour_tags` (NEW — May 2026)

The 15-tour curated catalog from
[docs/sửa .md](../../docs/s%E1%BB%ADa%20.md). The authoritative TypeScript
definition is in [`app/src/server/db/schema.ts`](../src/server/db/schema.ts);
the SQL below mirrors the Drizzle schema and matches the idempotent migration
at [`app/scripts/create-fixed-tour-tables.ts`](../scripts/create-fixed-tour-tables.ts).

Two design notes:

1. **`tour_id` is a varchar like `LOCO_FT_M1`, not a UUID.** Human-readable
   IDs keep logs and URLs (`/fixed-tours/LOCO_FT_M1`) legible, and the catalog
   is tiny enough that collision risk is zero.
2. **`vector` is a `jsonb` 4-float array, not a `vector(4)` column.** With 15
   rows we don't need pgvector — the cosine matcher runs in-process from
   `app/src/server/lib/cosine.ts`. The Pinecone / pgvector route stays on the
   shelf for Phase 3 (multi-city, > 1,000 tours).

```sql
CREATE TABLE fixed_tours (
  tour_id          VARCHAR(30) PRIMARY KEY,
  title_vi         VARCHAR(255) NOT NULL,
  title_en         VARCHAR(255) NOT NULL,
  chapter          VARCHAR(20)  NOT NULL
                     CHECK (chapter IN ('MORNING_SHIFT','AFTERNOON_SHIFT','EVENING_SHIFT')),
  story_script_vi  TEXT NOT NULL,
  story_script_en  TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 240,
  max_participants INT NOT NULL DEFAULT 6,
  base_price_vnd   INT NOT NULL,
  vector           JSONB NOT NULL, -- [Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fixed_tours_chapter ON fixed_tours(chapter);
CREATE INDEX idx_fixed_tours_active  ON fixed_tours(is_active);

CREATE TABLE fixed_tour_steps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id             VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
  step_order          INT  NOT NULL,
  target_time_offset  INT  NOT NULL, -- minutes from start_time
  location_name_vi    VARCHAR(255) NOT NULL,
  location_name_en    VARCHAR(255) NOT NULL,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  action_log_vi       TEXT NOT NULL,
  action_log_en       TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_fixed_tour_steps_unique ON fixed_tour_steps(tour_id, step_order);
CREATE INDEX        idx_fixed_tour_steps_tour   ON fixed_tour_steps(tour_id);

CREATE TABLE fixed_tour_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id     VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE CASCADE,
  tag_class   VARCHAR(20) NOT NULL CHECK (tag_class IN ('MATERIAL','PERSONA','KEYWORD')),
  tag_key     VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fixed_tour_tags_lookup ON fixed_tour_tags(tag_class, tag_key);
CREATE INDEX idx_fixed_tour_tags_tour   ON fixed_tour_tags(tour_id);
```

Three tag classes and their vocabulary:

| Class | Vocabulary | Purpose |
|---|---|---|
| `MATERIAL` | `#ThanhTao`, `#HonDat`, `#HuongMen` | The 3 heritage / craft / food themes that drive the listing-page filter chips. |
| `PERSONA` | `Art_Aesthetic`, `Deep_History_Heritage`, `Culinary_Enthusiast`, `Slow_Living` | The 4 personality axes. Redundant with `fixed_tours.vector` but kept as discrete rows for SQL-level filtering before cosine ranking. |
| `KEYWORD` | Free-form (`Sunrise`, `Phở_Culture`, `Bún_Chả`, `Indochine_Architecture`, …) | SEO bait + future full-text search. |

Linkage to bookings: `tours.fixed_tour_id VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE SET NULL`.
At most one of `tours.experience_id` / `tours.fixed_tour_id` is set per row;
algorithmic tours from `/plan/build` leave both null. The CHECK constraint
lives in
[`app/scripts/create-fixed-tour-tables.ts`](../scripts/create-fixed-tour-tables.ts).

#### Crossover Matching tables (NEW — May 2026, capacity rescue)

Backs the Fixed Tour Capacity Rescue & Crossover Matching feature
(PRD §5.11). Source spec:
[docs/fixed-tour-feature.md](../../docs/fixed-tour-feature.md).

Five new tables. `tour_crossover_requests` is the join table between two
under-capacity bookings; `tour_proposal_edits` enforces the
3-edit-max + sequential-approval invariants for the Smart Proposal Hub;
`escrow_adjustments` is the audit log for in-chat Δ-payments;
`priority_matching_vouchers` is the wallet entry awarded after a Report;
`crossover_discovery_pushes` is the dedupe ledger so we don't blast the
same traveler twice per T−36h cycle.

```sql
-- A pair-candidate join row. Both sides start as 'pending' from one
-- direction; flips to 'matched' when reciprocated. After lock-in
-- becomes 'locked'; on a Report or T-24h auto-cancel becomes
-- 'terminated' (with a reason).
CREATE TABLE tour_crossover_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_tour_id   UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  target_tour_id      UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending',     -- one-way request
                          'matched',     -- reciprocated; chat window open
                          'locked',      -- merged route locked + Δ settled
                          'expired',     -- anti-overlap kicked in
                          'terminated'   -- report / T-24h cancel
                        )),
  match_score         DECIMAL(5,4),     -- cosine score at the time of pairing
  chat_thread_id      UUID REFERENCES matches(id) ON DELETE SET NULL,
  merged_route_id     UUID,             -- new tours row built by FR-CROSS-05
  lock_deadline_at    TIMESTAMPTZ NOT NULL,  -- = T-28h
  terminated_reason   VARCHAR(40),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (initiator_tour_id, target_tour_id)
);
CREATE INDEX idx_xover_status     ON tour_crossover_requests(status, lock_deadline_at);
CREATE INDEX idx_xover_initiator  ON tour_crossover_requests(initiator_tour_id);
CREATE INDEX idx_xover_target     ON tour_crossover_requests(target_tour_id);

-- Smart Proposal Hub edits. Up to 3 per crossover_request, sequential.
-- The "only one pending at a time" invariant is enforced by the
-- application + a partial unique index (below).
CREATE TABLE tour_proposal_edits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crossover_request_id  UUID NOT NULL REFERENCES tour_crossover_requests(id)
                          ON DELETE CASCADE,
  edit_order            INT NOT NULL CHECK (edit_order BETWEEN 1 AND 3),
  proposer_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  operation             VARCHAR(10) NOT NULL
                          CHECK (operation IN ('add', 'remove')),
  -- Target of the op. Exactly one of these is non-null. Application
  -- enforces; we don't add a CHECK because PG doesn't do XOR cleanly.
  target_place_id       UUID REFERENCES places(id) ON DELETE SET NULL,
  target_activity_id    UUID REFERENCES activities(id) ON DELETE SET NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending_approval'
                          CHECK (status IN (
                            'pending_approval',
                            'approved',
                            'rejected'
                          )),
  decided_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (crossover_request_id, edit_order)
);
-- Only one pending edit per pair at a time.
CREATE UNIQUE INDEX idx_proposal_one_pending
  ON tour_proposal_edits (crossover_request_id)
  WHERE status = 'pending_approval';

-- Audit log for the Δ-payment in FR-CROSS-06. One row per side of
-- the pair (so two rows per locked crossover_request).
CREATE TABLE escrow_adjustments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crossover_request_id  UUID NOT NULL REFERENCES tour_crossover_requests(id)
                          ON DELETE CASCADE,
  tour_id               UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  cost_old_vnd          INT NOT NULL,
  cost_new_vnd          INT NOT NULL,
  delta_vnd             INT NOT NULL,    -- positive = charge, negative = refund
  payment_id            UUID REFERENCES payments(id) ON DELETE SET NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending',
                            'no_change',   -- Δ = 0
                            'succeeded',
                            'failed',
                            'reverted'     -- rollback after a failed Δ-charge
                          )),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  settled_at            TIMESTAMPTZ
);
CREATE INDEX idx_escrow_request ON escrow_adjustments(crossover_request_id);
CREATE INDEX idx_escrow_user    ON escrow_adjustments(user_id, status);

-- Wallet credit awarded after a successful Report. Bumps the holder's
-- match score floor in the next N crossover sessions.
CREATE TABLE priority_matching_vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason          VARCHAR(40) NOT NULL,   -- e.g. 'partner_report'
  uses_remaining  INT NOT NULL DEFAULT 3,
  score_boost     DECIMAL(4,3) NOT NULL DEFAULT 0.100,
  expires_at      TIMESTAMPTZ NOT NULL,   -- e.g. NOW() + interval '90 days'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_voucher_user_active
  ON priority_matching_vouchers(user_id, expires_at)
  WHERE uses_remaining > 0;

-- Dedupe ledger for the T-36h push notification + discovery surface.
-- One row per (recipient_user_id, crossover_target_tour_id) so we never
-- spam the same traveler twice for the same departure.
CREATE TABLE crossover_discovery_pushes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_tour_id        UUID NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  pushed_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recipient_user_id, target_tour_id)
);
```

Linkages added to existing tables:

- `tours.original_fixed_tour_id VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE SET NULL`
  — audit pointer for the Fixed → Custom migration path (FR-CROSS-02).
- `tours.crossover_pair_id UUID REFERENCES tour_crossover_requests(id) ON DELETE SET NULL`
  — both legs of a locked pair point at the same row so reads stay cheap.
- `tours.status` gains two new values: `customized_pending` (post-migration
  from a Fixed Tour) and `system_cancelled` (T−24h auto-cancel).
- `user_profiles.implicit_data` gains the keys `consentMatching` (boolean,
  set by FR-CROSS-02 implicit consent) and `crossoverAbandonCount` (int,
  bumped by FR-CROSS-04 abandonment).

The migration is idempotent and lives at
`app/scripts/create-crossover-matching-tables.ts` (to be authored).

#### `matches` (chat thread anchor, not swipe matches)
```sql
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  score       DECIMAL(5,4) NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'unmatched', 'blocked')),
  matched_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_matches_users ON matches(user_a_id, user_b_id);
CREATE INDEX idx_matches_status ON matches(status);
```

> `swipe_actions` is preserved as a vestigial table — the swipe UI is gone
> but a hard schema drop is out of scope for the May 2026 doc refresh.
> Definition in [`app/src/server/db/schema.ts`](../src/server/db/schema.ts).

#### `messages` and related tables

The chat domain has grown beyond v1.0's text-only table. The full set —
`messages`, `message_reactions`, `message_reports`, `blocks` — is documented
in [CHAT.md](CHAT.md) (transport, retention, attachments, moderation, the
SSE + polling architecture). The schema lives in
[`app/src/server/db/schema.ts`](../src/server/db/schema.ts); listing the SQL
twice would drift.

#### `tours`
```sql
CREATE TABLE tours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  host_id         UUID REFERENCES host_profiles(id),

  status          VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'preview', 'paid', 'active', 'completed', 'cancelled')),

  -- Request parameters
  request_params  JSONB NOT NULL,
  -- {
  --   "date": "2026-05-15",
  --   "start_time": "09:00",
  --   "duration_hours": 3,
  --   "budget_level": "medium",
  --   "interests": ["food", "culture"],
  --   "with_host": true,
  --   "group_size": 1
  -- }

  -- Generated tour data
  tour_data       JSONB,
  -- {
  --   "title": "Morning in Old Quarter",
  --   "description": "...",
  --   "total_duration_minutes": 180,
  --   "estimated_cost": { "min": 200000, "max": 400000, "currency": "VND" },
  --   "personalization_rationale": "..."
  -- }

  package_type    VARCHAR(20) NOT NULL
    CHECK (package_type IN ('loco_route', 'solo_mate', 'social_tour',
                            'fixed_tour', 'host_experience')),
  price_amount    INT NOT NULL DEFAULT 0,
  price_currency  VARCHAR(3) DEFAULT 'VND',

  -- Links a booking back to its source. At most one of these is non-null:
  --   experience_id   → host marketplace or curated experience
  --   fixed_tour_id   → curated Fixed Tour Matrix (NEW, May 2026)
  -- Algorithmic tours (legacy /plan engine) leave both null.
  experience_id   UUID REFERENCES experiences(id) ON DELETE SET NULL,
  fixed_tour_id   VARCHAR(30) REFERENCES fixed_tours(tour_id) ON DELETE SET NULL,

  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tours_user        ON tours(user_id, status);
CREATE INDEX idx_tours_experience  ON tours(experience_id);
CREATE INDEX idx_tours_fixed_tour  ON tours(fixed_tour_id);
CREATE INDEX idx_tours_host ON tours(host_id);
CREATE INDEX idx_tours_status ON tours(status);
```

#### `tour_stops`
```sql
CREATE TABLE tour_stops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id         UUID REFERENCES tours(id) ON DELETE CASCADE,
  place_id        UUID REFERENCES places(id),
  stop_order      INT NOT NULL,
  scheduled_start TIMESTAMPTZ,
  duration_minutes INT NOT NULL,
  notes           VARCHAR(500),
  visited_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tour_stops_tour ON tour_stops(tour_id, stop_order);
```

#### `payments`
```sql
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id           UUID UNIQUE REFERENCES tours(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id),
  amount            INT NOT NULL,
  currency          VARCHAR(3) DEFAULT 'VND',
  payment_method    VARCHAR(30) NOT NULL,
  payment_gateway   VARCHAR(30) NOT NULL,
  gateway_txn_id    VARCHAR(255),
  status            VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  refund_amount     INT DEFAULT 0,
  refund_reason     VARCHAR(255),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_tour ON payments(tour_id);
CREATE INDEX idx_payments_status ON payments(status);
```

#### `reviews`
```sql
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type     VARCHAR(20) NOT NULL CHECK (target_type IN ('place', 'host', 'tour')),
  target_id       UUID NOT NULL,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         VARCHAR(500),
  photos          VARCHAR(500)[] DEFAULT '{}',
  is_visible      BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
```

#### `emergency_contacts`
```sql
CREATE TABLE emergency_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  relationship VARCHAR(50),
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `reports`
```sql
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type     VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'place', 'host')),
  target_id       UUID NOT NULL,
  reason          VARCHAR(50) NOT NULL,
  description     VARCHAR(500),
  status          VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Design

### 4.1 API Architecture
tRPC routers organized by domain module. All endpoints require authentication unless marked `[public]`.

### 4.2 Router Structure (15 routers, 90+ procedures)

The full surface, as merged in
[`app/src/server/routers/_app.ts`](../src/server/routers/_app.ts):

```
src/server/routers/
├── _app.ts                       # Root router
├── auth.router.ts                # register, login, oauth, refreshToken, deleteAccount
├── user.router.ts                # getProfile, updateProfile, submitOnboarding,
│                                 # recomputePersonality, recordSignal,
│                                 # getEmergencyContacts (+ set/update/delete)
├── place.router.ts               # getFeed, getById, getBySlug, getByIds, search,
│                                 # nearby, savePlace, unsavePlace, isSaved, getSavedPlaces
├── match.router.ts               # vestigial — chat thread anchors only (swipe UI dropped)
├── chat.router.ts                # getConversations, getMessages, sendMessage, markRead,
│                                 # editMessage, deleteMessage, addReaction, reportMessage,
│                                 # block/unblock — see CHAT.md
├── tour.router.ts                # create, getPreview, getFullTour, assignHost, startTour,
│                                 # markStopVisited, completeTour, getHistory,
│                                 # reportIncident (NEW — dynamic re-routing trigger)
├── fixedTour.router.ts           # NEW (May 2026) — list, getById, book, rank, previewRank
├── experience.router.ts          # list, getBySlug, getById, book (host marketplace + curated)
├── host-experience.router.ts     # host-authored experience CRUD (listMine, create, update,
│                                 # publish, archive, getById)
├── activity.router.ts            # à-la-carte browse + host CMS (list, getBySlug, getSlots,
│                                 # listMine, create, update, publish, archive,
│                                 # addSlot, removeSlot)
├── cart.router.ts                # persistent multi-line cart (get, add, updateQuantity,
│                                 # remove, clear, getCount)
├── order.router.ts               # createFromCart, confirmPayment, getHistory, get
├── merch.router.ts               # list, getBySlug, getVariantsByIds + admin CRUD
├── payment.router.ts             # createIntent, confirm, getHistory, refund (admin)
├── host.router.ts                # getDashboard, setAvailable, getBalance, getRevenueByDay,
│                                 # getRevenueByExperience, getPaymentsTimeline,
│                                 # getCommissionSummary, getPayoutHistory,
│                                 # getStopHeatmap, getStopDetail,
│                                 # getEarningsSummary, getUpcomingBookings, getPastBookings
└── review.router.ts              # submitTourReview, getTourReview
```

### 4.3 Key Endpoints

#### Auth
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.register` | mutation | public | Create account (email + password) |
| `auth.login` | mutation | public | Email/password login, returns JWT |
| `auth.oauthCallback` | mutation | public | Handle Google/Apple OAuth |
| `auth.verifyPhone` | mutation | authed | Send + verify OTP |
| `auth.refreshToken` | mutation | authed | Refresh JWT |

#### User
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `user.getProfile` | query | authed | Get own profile |
| `user.updateProfile` | mutation | authed | Update display info |
| `user.submitOnboarding` | mutation | authed | Submit 8-question answers, create explicit profile |
| `user.getPersonality` | query | authed | Get derived personality summary |
| `user.setEmergencyContact` | mutation | authed | Add/update emergency contact |

#### Places
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `place.getFeed` | query | authed | Paginated, personalized place feed |
| `place.getById` | query | authed | Single place detail |
| `place.search` | query | authed | Filter + sort places |
| `place.nearby` | query | authed | Geospatial query within radius |
| `place.contribute` | mutation | authed | Submit new place (moderation queue) |

#### Fixed Tour Matrix (NEW — May 2026)

Implements [docs/sửa .md §4](../../docs/s%E1%BB%ADa%20.md). The router is
[`app/src/server/routers/fixedTour.router.ts`](../src/server/routers/fixedTour.router.ts).

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `fixedTour.list` | query | public | List active tours filtered by `chapter` and/or `materials[]`. When the caller is signed in AND has `derivedData.personalityVector`, results are cosine-ranked with a `matchPercent`; otherwise canonical `tour_id` order. |
| `fixedTour.getById` | query | public | Single tour with ordered `fixed_tour_steps`, grouped tags (MATERIAL / PERSONA / KEYWORD), and `matchPercent` when the caller has a vector. |
| `fixedTour.book` | mutation | authed | `{ tourId, date, startTime, groupSize }` → writes a `tours` row with `packageType='fixed_tour'`, `fixedTourId` set, price = `basePriceVnd * groupSize`, status `preview`. Materializes `tour_stops` from `fixed_tour_steps`. Returns the new tour UUID for the existing `/tour/[id]/checkout`. |
| `fixedTour.rank` | query | public | Rank-only result: `[{ tourId, matchPercent }]`. Accepts an optional `userVector` so the chat onboarding can preview the ranking before saving. |
| `fixedTour.previewRank` | query | public | Same as `rank` but with `topN` and an explicit `userVector` required — used inline in the chat quiz. |

The 4-D vector axis order is fixed and documented in
[`app/src/lib/quiz-questions.ts`](../src/lib/quiz-questions.ts):
`[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`.

#### Crossover Matching (NEW — May 2026, capacity rescue)

Implements PRD §5.11. Lives in a new router
`app/src/server/routers/crossover.router.ts` (to be authored). Schema in
§3 above.

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `crossover.getEligibleTours` | query | authed | Lists the caller's own `fixed_tour` bookings currently under capacity, with their pre-departure timestamp markers (T−48h, T−36h, T−28h, T−24h). |
| `crossover.migrateToCustom` | mutation | authed | One-click Fixed → Custom migration (FR-CROSS-02). Preserves `priceAmount`, sets `tours.status = 'customized_pending'`, writes `tours.original_fixed_tour_id`. |
| `crossover.getDiscoveryFeed` | query | authed | T−36h anonymous discovery surface. Returns ranked `[{ requestCandidateId, personalityVector, route, ageGroup, nationality, matchScore }]`. **PII-stripped DTO** — the server never returns `displayName`, `avatarUrl`, `email`, `phone`. |
| `crossover.sendRequest` | mutation | authed | `{ targetTourId }` — fires a `tour_crossover_requests` row with `status='pending'`. Anti-Overlap check runs server-side; conflicting slots throw `PRECONDITION_FAILED`. |
| `crossover.acceptRequest` | mutation | authed | Reciprocate a pending request. On reciprocation, flips `status='matched'`, opens a chat thread, expires conflicting requests on the same calendar slot. |
| `crossover.declineRequest` | mutation | authed | One-sided decline; the requester sees a soft "not this time" toast (no reason exposed). |
| `crossover.proposeEdit` | mutation | authed | Smart Proposal Hub — `{ requestId, operation: 'add'\|'remove', targetPlaceId?, targetActivityId? }`. Server enforces ≤ 3 edits per request and the "one pending at a time" invariant via the partial unique index. |
| `crossover.decideEdit` | mutation | authed | The other party `{ editId, decision: 'approved'\|'rejected' }`. Approving an `add` / `remove` mutates the merged route draft in-place. |
| `crossover.coCreateRoute` | mutation | authed | FR-CROSS-05 fallback for Fixed + Fixed conflicts — combines the two 4-D vectors (weighted average) and runs the Customized Tour engine to produce a brand-new merged route. |
| `crossover.lockRoute` | mutation | authed | **[Chốt hành trình chung]** — both parties must call this within the 8-hour window. On the second call, the server computes Δ per side, opens an `escrow_adjustments` row per leg, and either flips to `no_change` (Δ = 0), opens a Stripe Payment Element (Δ > 0), or auto-refunds (Δ < 0). |
| `crossover.confirmEscrowPayment` | mutation | authed | Front-end calls this after Stripe Payment Element returns `succeeded`. Idempotent. On success the linked tour's `status` flips to `paid` and the SSE `tour:routeUpdated` event fires to the assigned guide. |
| `crossover.reportPartner` | mutation | authed | FR-CROSS-08. Pair-scoped ban + chat termination + cache-wipe + Priority Matching Voucher issuance, all in one transaction. |
| `crossover.redeemVoucher` | query | authed | Reads + decrements `uses_remaining`. Used internally by `crossover.getDiscoveryFeed` to apply the `score_boost`. |

#### Crossover scheduled jobs (Vercel cron)

| Cron path | Cadence | Action |
|---|---|---|
| `/api/cron/crossover-t48` | every 15 min | For every `fixed_tour` booking departing in 47.5–48.5h with `currentCapacity < 2`: emit the in-app warning, surface the migration CTA, and flag `Tour.lowFillNotifiedAt`. |
| `/api/cron/crossover-t36` | every 15 min | For every under-capacity booking past T−36h: build the discovery candidate set, send pushes (deduped via `crossover_discovery_pushes`), open the `/match/crossover` surface for participants. |
| `/api/cron/crossover-t28` | every 15 min | Close the 8-hour chat window. Unlocked pairs flip back to `expired`; their underlying bookings re-enter the under-capacity pool. |
| `/api/cron/crossover-t24` | every 15 min | Auto-cancel any `fixed_tour` booking still under capacity OR with `tour_crossover_requests.status != 'locked'`. Refund 100%, push to traveler + guide, free `host_availability`. |

All four endpoints require `Authorization: Bearer $CRON_SECRET` (same
pattern as the existing reaper) and emit Sentry breadcrumbs on every
transition so a stuck booking shows up in observability instead of
silently rotting.

#### SSE / real-time event types (Crossover-specific additions)

Multiplexed on the existing chat SSE channel (`/api/chat/stream/[matchId]`):

| Event | Direction | Payload |
|---|---|---|
| `crossover:proposalPending` | → both parties | `{ editId, proposerUserId, operation, targetName }` |
| `crossover:proposalDecided` | → both parties | `{ editId, decision, by }` |
| `crossover:escrowReady` | → both parties | `{ deltaVnd, requiresAction: boolean }` — Δ > 0 forces the Payment Element on the requesting side |
| `crossover:locked` | → both parties + guide | `{ mergedTourId, finalPriceVnd }` |
| `tour:routeUpdated` | → guide only | New stop list (FR-CROSS-07). Fires after `escrow_adjustments.status='succeeded'` or `Δ = 0`. |
| `crossover:terminated` | → reporter / non-reported partner | `{ reason }` — `'partner_report'` triggers the apology banner + voucher grant on the reporter's side. |

#### Chat — see [CHAT.md](CHAT.md) for the full procedure list

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `chat.getConversations` | query | authed | List active conversations |
| `chat.getMessages` | query | authed | Paginated messages for a match |
| `chat.sendMessage` | mutation | authed | Send text/image message |
| `chat.markRead` | mutation | authed | Mark messages as read |
| `chat.editMessage`, `chat.deleteMessage`, `chat.addReaction`, `chat.reportMessage`, `chat.block`, `chat.unblock` | mutations | authed | See CHAT.md |

#### Tour (algorithmic flow + active-tour lifecycle)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `tour.create` | mutation | authed | Submit tour request → generation (legacy algorithmic engine) |
| `tour.getPreview` | query | authed | Free preview of generated tour |
| `tour.getFullTour` | query | authed | Full tour (requires payment) |
| `tour.assignHost` | mutation | authed | Attach a guide post-creation; recomputes price + packageType |
| `tour.startTour` | mutation | authed | Begin active tour mode (status: paid → active) |
| `tour.markStopVisited` | mutation | authed | Mark a stop as visited |
| `tour.completeTour` | mutation | authed | End tour (status: active → completed); kicks off Wrap-up job |
| `tour.reportIncident` | mutation | host | **NEW** — Guide-only. Triggers Dynamic Re-routing AI; returns 3 candidate substitute stops. |
| `tour.getHistory` | query | authed | List past tours (paid + completed + cancelled) |

#### Payment
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `payment.createIntent` | mutation | authed | Create payment intent for tour |
| `payment.confirm` | mutation | authed | Confirm payment after gateway redirect |
| `payment.webhook` | mutation | public | Gateway webhook handler (Stripe/VNPay) |
| `payment.requestRefund` | mutation | authed | Request refund |

#### Host (operator console — `app/src/server/routers/host.router.ts`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `host.getDashboard` | query | host | Today's bookings + revenue (VN-local-day bounds) |
| `host.setAvailable` | mutation | host | Toggle `isAvailable` |
| `host.getBalance` | query | host | Available / Pending / In-review / refunded / lifetime payouts / next-payout forecast |
| `host.getRevenueByDay` | query | host | Contiguous VN-local-day series for a chart |
| `host.getRevenueByExperience` | query | host | Per-listing perf (ORDER BY gross DESC) |
| `host.getPaymentsTimeline` | query | host | Gross / commission / net per transaction |
| `host.getCommissionSummary` | query | host | Lifetime split, transparent rate |
| `host.getPayoutHistory` | query | host | Newest-first payouts |
| `host.getStopHeatmap` | query | host | Aggregate stop visit counts (for the Routes map) |
| `host.getStopDetail` | query | host | Drill-down per place |
| `host.getEarningsSummary`, `host.getUpcomingBookings`, `host.getPastBookings` | query | host | Earnings 7d/30d/lifetime, upcoming-week, paged history |
| `host.scanMerchantQR` | mutation | host | **NEW** — verify HMAC + apply sỉ pricing to the active tour |
| `host.recordMealItem` | mutation | host | **NEW** — append a `meal_log` row during a food tour |
| `host.markHandoverComplete` | mutation | host | **NEW** — record the merch handover at end-of-tour |

#### Activities / Cart / Orders / Merch — see [BOOKING.md](BOOKING.md) for the lifecycle

| Router | Notable procedures |
|---|---|
| `activity.*`  | `list`, `getBySlug`, `getSlots`, `listMine`, `create`/`update`/`publish`/`archive`, `addSlot`/`removeSlot`, `getManyByIds` |
| `cart.*`      | `get`, `add` (discriminated union), `updateQuantity` (capacity re-check), `remove`, `clear`, `getCount` |
| `order.*`     | `createFromCart` (server-side price re-validation + `ESIM_BUNDLE_10` auto-apply + `detectConflicts`), `confirmPayment` (transactional slot+stock decrement), `getHistory`, `get` |
| `merch.*`     | `list`, `getBySlug`, `getVariantsByIds`, admin: `createProduct`, `updateProduct`, `archiveProduct`, `addVariant`, `updateVariant`, `removeVariant` |

---

## 5. Core Algorithms

### 5.1 Fixed Tour Matching (cosine over 4-D vectors) — NEW

The headline matcher. Implements [docs/sửa .md §5](../../docs/s%E1%BB%ADa%20.md)
in TypeScript at [`app/src/server/lib/cosine.ts`](../src/server/lib/cosine.ts).

```
FUNCTION rankByCosine(userVec[4], tours[]):
  FOR each tour:
    dot   = Σ userVec[i] * tour.vector[i]
    normU = sqrt(Σ userVec[i]²)
    normT = sqrt(Σ tour.vector[i]²)
    cosine = dot / (normU * normT)   -- guarded against /0
    matchPercent = round(cosine * 100, 2)
  RETURN SORT tours BY matchPercent DESC
```

Vector axis order is canonical and shared end-to-end:
`[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`.

Derivation from the chat-quiz answers (`craft / heritage / food / quiet`, plus
a `social` axis softly redistributed 50/50 into `Art_Aesthetic` +
`Slow_Living`) is documented in
[`app/src/lib/quiz-questions.ts`](../src/lib/quiz-questions.ts).

Performance: the catalog is 15 rows; the full ranking runs in **< 5 ms** in
local Node.js. We deliberately did not reach for Pinecone / pgvector — the
in-process matcher stays correct for catalogs up to ~1,000 rows. Phase 3
cut-over criteria + the embedding path are described in §17 below.

### 5.2 Customized Tour Generation (legacy, preserved as low-end tier)

```
FUNCTION generateTour(userProfile, requestParams):
  1. CONTEXT = merge(
       userProfile.explicit_data,
       userProfile.derived_data,
       requestParams
     )

  2. candidatePlaces = query places WHERE:
       - geo_location within 5km of Hanoi center
       - category IN CONTEXT.interests
       - price_level <= CONTEXT.budget_level
       - is_verified = TRUE AND is_active = TRUE

  3. FOR each place IN candidatePlaces:
       experienceScore = cosineSimilarity(
         place.experience_tags,
         CONTEXT.personality_vector
       )
       emotionalScore = cosineSimilarity(
         place.emotional_tags,
         CONTEXT.emotional_vector
       )
       place.relevanceScore = 0.6 * experienceScore + 0.4 * emotionalScore

  4. rankedPlaces = SORT candidatePlaces BY relevanceScore DESC

  5. selectedPlaces = SELECT top N FROM rankedPlaces WHERE:
       - N = CEIL(requestParams.duration_hours * 1.5)
       - no two places in same category (diversity constraint)
       - total estimated_duration <= requestParams.duration_hours * 60

  6. optimizedRoute = solveTSP(selectedPlaces, startPoint=userLocation)
     // Nearest-neighbor heuristic for MVP; upgrade to OR-Tools later

  7. timeline = allocateTime(optimizedRoute, CONTEXT.energy_score)
     // Higher energy = more stops, shorter dwell; Lower = fewer stops, longer dwell

  8. narrative = ruleBasedExplainer(CONTEXT, selectedPlaces)
     // components/ai-explainer.tsx — emits 2–3 fit reasons from
     // userProfile.derivedData + explicitData. No LLM call.

  9. RETURN TourObject {
       stops: optimizedRoute,
       timeline: timeline,
       narrative: narrative,
       estimatedCost: SUM(place.price_range for place in selectedPlaces),
       personalizationRationale: explain(CONTEXT, selectedPlaces)
     }
```

The engine lives at
[`app/src/server/services/_legacy/tour-engine.ts`](../src/server/services/_legacy/tour-engine.ts).
The `_legacy/` move reflects its repositioning as the budget alternative to
the Fixed Tour Matrix.

### 5.3 Merchant QR Verification (NEW)

The `host.scanMerchantQR` mutation accepts a payload of
`{ merchantId, signedNonce, tourId }`. The server:

1. Recomputes `HMAC-SHA256(secret, merchantId || nonce)` and compares it to
   `signedNonce`. Reject on mismatch.
2. Loads the merchant's contracted sỉ price list (`merchant_pricelists`
   table — see schema notes in §16).
3. Stamps the active tour's `tour_data.merchantContext` with the merchant
   + applicable price list, so subsequent `host.recordMealItem` calls
   know which price to record.

The HMAC secret rotates via `MERCHANT_QR_SIGNING_KEY` env var. Verified
merchants are issued a printed QR encoding only `merchantId` + `nonce`; no
PII is on the printout.

### 5.4 Real-time Meal Balancing (NEW)

```
FUNCTION reconcileMealSpend(tourId):
  tour      = SELECT * FROM tours WHERE id = tourId
  mealLog   = tour.tourData.mealLog ?? []
  estimate  = tour.priceAmount.foodBudgetEstimate
  actual    = SUM(item.priceVnd FOR item IN mealLog)
  delta     = actual - estimate

  IF |delta| <= estimate * 0.05:
    -- within tolerance, no reconciliation
    RETURN { adjustment: 0 }
  ELIF delta < 0:
    -- refund excess to original payment method
    payment.refund(tourId, amount=|delta|, reason='meal_underspend')
  ELSE:
    -- charge the additional spend using the saved Stripe / VNPay method
    payment.createIntent(tourId, amount=delta, reason='meal_overspend')
```

Fires from `tour.completeTour` for any tour whose
`tourData.foodBudgetEstimate` is non-null. The recorded items are persisted
to `tours.tour_data.mealLog`; the reconciliation result lands on
`payments.refund_amount` or a new `payments` row, both visible on
`/profile/payment-history` with a "Meal reconciliation" badge.

### 5.5 Dynamic Re-routing AI (NEW)

`tour.reportIncident({ kind, currentStopId })` is a host-only mutation that:

1. Loads the original stop's MATERIAL + KEYWORD tags.
2. Queries `places` within a 1.5 km haversine radius that share ≥ 1 MATERIAL
   tag, are `is_verified=true`, currently open (using `opening_hours` JSONB),
   and not already on the tour.
3. Ranks by `(tag_overlap_count, distance_asc)`.
4. Returns the top 3. The Guide accepts one; the server mutates
   `tour_stops` + `tour_data.stops` in a single transaction so the traveler's
   view stays consistent.

Pure rules. No LLM. Returns in < 2 s p95.

### 5.6 Wrap-up Generator (NEW)

`POST /api/tour/[id]/wrap-up` (Node.js, runs as a fire-and-forget job
triggered by `tour.completeTour`). The job:

1. Loads the tour, its `tour_stops`, the linked Fixed Tour metadata, and
   the user's `personalityVector`.
2. Picks a hero photo from the field upload pool (Guide uploads via
   `/api/host/upload-tour-photo`).
3. Renders a templated component server-side
   (`components/wrap-up/wrap-up-page.tsx`) into HTML; persists the rendered
   doc to a static `/tour-wraps/[id].html` slot on Vercel Blob so the share
   URL stays cacheable.
4. Generates an OG image via `@vercel/og` for IG/TikTok share previews.

No LLM in the loop. Phase 3 could swap the templated copy for a GPT
narrative; the contract stays the same.

### 5.7 Crossover Matching Engine (NEW — capacity rescue)

Implements PRD §5.11. Three sub-algorithms:

**a) Candidate ranking (T−36h discovery).**

```
FUNCTION rankCrossoverCandidates(viewerTourId, allEligibleTours):
  viewer        = load(viewerTourId)
  viewerVector  = viewer.user.personalityVector
  candidates    = filter(allEligibleTours, t => t.id != viewerTourId
                       AND t.userId != viewer.userId
                       AND sameDepartureWindow(t, viewer, tolerance=4h))

  FOR each c IN candidates:
    raw      = cosine(viewerVector, c.user.personalityVector)
    boost    = activeVoucherBoost(c.userId)   -- 0.0 or 0.1
    c.score  = clamp(raw + boost, 0, 1)
    c.matchPercent = round(c.score * 100, 2)

  RETURN SORT candidates BY matchPercent DESC LIMIT 20
```

Reuses the in-process `lib/cosine.rankByCosine`. The Priority Matching
Voucher boost is a flat additive +0.1 on the raw cosine score (capped at
1.0); `uses_remaining` is decremented inside
`crossover.getDiscoveryFeed`, not at boost-application time, so a
voucher only "burns" when the holder actually views a feed.

**b) Anti-Overlap enforcement.**

`crossover.sendRequest` and `crossover.acceptRequest` both run this in a
single transaction before flipping state:

```
FUNCTION enforceAntiOverlap(userId, targetSlot):
  conflicting = SELECT * FROM tour_crossover_requests x
                  JOIN tours t ON t.id IN (x.initiator_tour_id, x.target_tour_id)
                  WHERE (x.initiator_user_id = userId OR x.target_user_id = userId)
                    AND x.status IN ('pending', 'matched')
                    AND overlaps(t.start_at, targetSlot, tolerance=4h)

  IF any conflicting.status = 'matched':
    THROW PRECONDITION_FAILED('You already have an accepted crossover for this slot')

  -- Otherwise auto-expire all the pending ones on the same calendar slot:
  UPDATE tour_crossover_requests
     SET status = 'expired'
   WHERE id IN (conflicting.ids WHERE status = 'pending')
```

**c) Merged-route resolution.**

```
FUNCTION resolveMergedRoute(crossoverRequestId):
  req     = load(crossoverRequestId)
  a, b    = req.initiator_tour, req.target_tour

  CASE pair_kind(a, b):
    WHEN ('fixed', 'fixed') AND user_picked_coCreate:
      mergedVector = weighted_avg(a.user.vector, b.user.vector)
      route        = customizedTourEngine(mergedVector,
                                          duration  = max(a.duration, b.duration),
                                          materials = union(a.material_tags,
                                                            b.material_tags))
    WHEN ('fixed', 'fixed'):
      route = pickOne(a.fixed_tour, b.fixed_tour)   -- user choice from chat
    WHEN ('fixed', 'custom') OR ('custom', 'custom'):
      route = pickOne(a.route, b.route)             -- user choice from chat

  -- Apply up to 3 approved edits.
  FOR each edit IN approvedEdits(crossoverRequestId) ORDER BY edit_order:
    IF edit.operation = 'add':    route.stops.push(loadStop(edit.target_*))
    IF edit.operation = 'remove': route.stops = remove(route.stops, edit.target_*)

  newPrice = pricePerPerson(route) * 2   -- group of 2 minimum
  RETURN { route, newPrice }
```

**d) Escrow Δ settlement.**

Runs inside `crossover.lockRoute` as the second-half of a 2-phase commit
(the first half is the user-side Stripe Payment Element confirmation):

```
FOR each leg IN [initiator, target]:
  oldPrice = leg.tour.priceAmount
  newPrice = mergedRoute.newPrice / 2
  delta    = newPrice - oldPrice

  INSERT INTO escrow_adjustments(
    crossover_request_id, tour_id, user_id,
    cost_old_vnd, cost_new_vnd, delta_vnd, status
  ) VALUES (req.id, leg.tour.id, leg.userId,
            oldPrice, newPrice, delta,
            CASE WHEN delta = 0 THEN 'no_change' ELSE 'pending' END);

IF any leg has delta > 0:
  emit SSE crossover:escrowReady to the requiring side(s)
  WAIT (chat re-opens with 30-min grace)
  ON timeout OR decline: revert -> set status='reverted', release lock
ELSE:
  emit SSE crossover:locked + tour:routeUpdated
  flip tours.status = 'paid' for both legs
  bump experiences.totalBookings if linked
```

### 5.8 Derived Profile Computation

```
FUNCTION computeDerivedProfile(explicitData):
  result = ruleBasedCompute(explicitData)
  -- Deterministic mapping: see app/src/server/services/profile-engine.ts

  VALIDATE result against DerivedProfileSchema

  RETURN {
    personality: result.personality,
    behavior: result.behavior,
    emotional: result.emotional
  }
```

---

## 6. Real-Time Features

### 6.1 WebSocket Architecture

```
Browser ──5s tRPC polling──▶ chat.* procedures ──▶ PostgreSQL
        ──SSE────────────▶ /api/chat/stream/[matchId] ──▶ Upstash Redis ring buffer

No custom WebSocket server — Vercel serverless can't hold persistent
connections cheaply, and marketplace chat doesn't need Slack-grade
concurrency. Polling is the truth-floor; SSE is enhancement. Full transport
+ retention + moderation contract: [CHAT.md](CHAT.md).
```

### 6.2 Chat Protocol — see [CHAT.md](CHAT.md)

### 6.3 Tour Status Polling (Active Tour mode)

Travelers on `/tour/[id]/active` poll `tour.getActive` every 10s. Any
Dynamic Re-routing acceptance (§5.5) shows up on the next tick. Server-sent
push for instant updates is Phase 2 (depends on FCM).

### 6.4 Location Sharing (During Active Tour)
- Client sends GPS coordinates every 30 seconds.
- Stored in Redis with 48h TTL (not persisted to main DB).
- Shared only with user's designated emergency contact.
- User can toggle on/off at any time.

---

## 7. Authentication & Authorization

### 7.1 Auth Flow
```
Registration/Login
       │
       ▼
JWT Access Token (15 min) + Refresh Token (7 days)
       │
       ▼
Access Token in Authorization header
Refresh Token in httpOnly cookie
```

### 7.2 Role-Based Access Control

| Role | Permissions |
|---|---|
| `traveler` | Browse places + experiences + Fixed Tours, book, chat with assigned guides, pay, review, redeem loyalty (Phase 2). |
| `host` (Guide) | All traveler permissions + manage host profile, set availability, view assigned tours, scan merchant QRs, record meal items, trigger Dynamic Re-routing, mark handover. |
| `admin` | All permissions + verify hosts, moderate content/messages, manage payouts (Phase 2), issue refunds, view platform analytics. |

### 7.3 Auth Middleware
```typescript
// Simplified middleware pseudocode
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const token = ctx.headers.authorization?.split(' ')[1];
  if (!token) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const payload = verifyJWT(token);
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId)
  });

  if (!user || !user.is_active) throw new TRPCError({ code: 'UNAUTHORIZED' });

  return next({ ctx: { ...ctx, user } });
});
```

---

## 8. Third-Party Integrations (Actual)

### 8.1 Maps -- Leaflet + OpenStreetMap (FREE)

| Component | Usage | Cost |
|-----------|-------|------|
| Leaflet 1.9.4 + react-leaflet 5.0.0 | Interactive map in Explore page | $0 |
| OpenStreetMap tiles | Map rendering (no API key) | $0 |
| OSM Overpass API | Place data ingestion pipeline | $0 |
| OpenStreetMap embeds | Map on Place Detail page | $0 |

### 8.2 AI / Tag Scoring -- Local Deterministic Engine (NO EXTERNAL AI)

| Component | Usage | Cost |
|-----------|-------|------|
| `scripts/lib/tag-scorer.ts` | Scores 8 experience + 6 emotional tags locally | $0 |
| `src/server/services/profile-engine.ts` | Computes derived profile from explicit data | $0 |
| Tour generation (cosine similarity + TSP) | AI tour creation in `tour.router.ts` | $0 |

No OpenAI API is used. All personalization runs on local algorithms.

### 8.3 Photos -- Pexels + Wikimedia Commons (FREE)

| Source | Usage | Cost |
|--------|-------|------|
| Pexels (pre-curated pool) | Category-based photo fallback | $0 |
| Wikimedia Commons API | Photos for cultural/notable places with Wikidata IDs | $0 |
| Unsplash (seed data) | Background images for seed places | $0 |

### 8.4 Payment Gateway -- Stripe (Test Mode)

- Stripe SDK installed (`stripe` ^22.0.0)
- `payment.router.ts` has `createIntent` and `confirm` endpoints
- Currently in test mode (simulated checkout)
- Ready for live keys when configured

### 8.5 Database -- Neon (Managed PostgreSQL)

| Component | Usage | Cost |
|-----------|-------|------|
| Neon PostgreSQL | Production database (15 tables, 996 places) | Free tier |
| Drizzle ORM | Type-safe queries, migrations | $0 |
| `postgres.js` driver | Connection with SSL | $0 |

### 8.6 Hosting -- Vercel

| Component | Usage | Cost |
|-----------|-------|------|
| Vercel (Hobby plan) | Next.js hosting, API routes, CDN | Free tier |
| Automatic deployments | Git push triggers build + deploy | $0 |

### 8.4 Email (Resend)
- Transactional emails: registration confirmation, payment receipt, tour details
- Free tier: 3,000 emails/month (sufficient for MVP)

---

## 9. Project Structure

```
locomate/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + test on PR
│       └── deploy.yml          # Deploy to Vercel on merge
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── icons/                  # App icons
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── onboarding/
│   │   ├── (main)/
│   │   │   ├── explore/        # LocoRec feed
│   │   │   ├── match/          # LocoMatch swipe
│   │   │   ├── chat/           # Conversations
│   │   │   ├── plan/           # Tour creation
│   │   │   ├── tour/[id]/      # Active tour view
│   │   │   └── profile/        # User profile
│   │   ├── admin/              # Admin dashboard
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing/splash
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── auth/               # Auth-related components
│   │   ├── explore/            # Place cards, filters
│   │   ├── match/              # Swipe cards, match display
│   │   ├── chat/               # Message bubbles, input
│   │   ├── tour/               # Tour timeline, stop cards
│   │   ├── payment/            # Payment forms
│   │   └── layout/             # Nav, tabs, header
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema definitions
│   │   │   ├── migrations/     # SQL migration files
│   │   │   └── seed.ts         # Seed data (200+ places)
│   │   ├── routers/            # tRPC routers (see §4.2)
│   │   ├── services/
│   │   │   ├── tour-engine.ts  # Tour generation logic
│   │   │   ├── match-engine.ts # Match scoring logic
│   │   │   ├── profile-engine.ts # Derived profile computation
│   │   │   ├── payment.ts      # Payment gateway abstraction
│   │   │   └── ai.ts           # OpenAI API wrapper
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verification
│   │   │   └── rate-limit.ts   # Rate limiting
│   │   ├── jobs/               # BullMQ job handlers
│   │   │   ├── generate-tour.ts
│   │   │   ├── compute-profile.ts
│   │   │   └── send-email.ts
│   │   ├── trpc.ts             # tRPC init + context
│   │   └── socket.ts           # Socket.io server setup
│   ├── lib/
│   │   ├── utils.ts            # Shared utilities
│   │   ├── constants.ts        # App constants
│   │   ├── validations/        # Zod schemas
│   │   └── hooks/              # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # Shared TypeScript types
├── drizzle.config.ts           # Drizzle ORM config
├── docker-compose.yml          # Local dev (PostgreSQL + Redis)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 10. Local Development Setup

### 10.1 Prerequisites
- Node.js >= 22 LTS
- pnpm >= 9
- Docker Desktop (for PostgreSQL + Redis)

### 10.2 Environment Variables

```env
# Database (Neon in prod, local Docker Postgres in dev)
DATABASE_URL=postgresql://locomate:locomate@localhost:5432/locomate

# Redis (Upstash REST in prod; optional in dev — SSE degrades gracefully)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth (HS256, 32-char min — fail-fast on startup if missing)
JWT_SECRET=<random-32-char-or-longer>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Google OAuth (Arctic + jose)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Payment — Stripe (test mode by default; flip to live keys for launch)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Payment — VNPay (Phase 2)
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=

# Merchant QR signing key (HMAC-SHA256 for the QR-scan flow — Phase 2)
MERCHANT_QR_SIGNING_KEY=<random-32-char-or-longer>

# Vercel Blob (wrap-up renders, tour photos, identity docs)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Email (Resend; falls back to console transport when unset)
RESEND_API_KEY=re_...

# Cron secret (required in prod for /api/cron/*; 503s without)
CRON_SECRET=<random-32-char-or-longer>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 10.3 Docker Compose (Local Services)

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: locomate
      POSTGRES_USER: locomate
      POSTGRES_PASSWORD: locomate
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### 10.4 Quickstart Commands

```bash
# Install dependencies
pnpm install

# Start local databases
docker compose up -d

# Run database migrations
pnpm db:migrate

# Seed initial data (200+ Hanoi places)
pnpm db:seed

# Start development server
pnpm dev

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

---

## 11. Deployment

### 11.1 Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Development | localhost:3000 | `*` | Local development |
| Staging | staging.locomate.app | `develop` | QA and testing |
| Production | app.locomate.app | `main` | Live users |

### 11.2 CI/CD Pipeline

```
Push to branch
       │
       ▼
GitHub Actions: Lint + Type Check + Unit Tests
       │
       ▼ (on PR merge to develop)
Deploy to Staging (Vercel Preview)
       │
       ▼ (on PR merge to main)
Deploy to Production (Vercel Production)
       │
       ▼
Post-deploy: Run smoke tests
```

### 11.3 Infrastructure Costs (Monthly Estimate - MVP)

| Service | Tier | Monthly Cost |
|---|---|---|
| Vercel | Hobby → Pro at Phase 2 | $0 → $20 |
| Neon (PostgreSQL) | Free → Launch at Phase 2 | $0 → $19 |
| Vercel Blob (Wrap-up + photos) | Pay-as-you-go | ~$3 |
| Upstash (Redis) | Pay-as-you-go | ~$5 |
| Maps (Leaflet + OSM) | Self-hosted tiles via OSM | $0 |
| Stripe | Transaction fees only | ~$15 |
| VNPay / MoMo | Transaction fees only | ~$10 |
| Resend (Thư Tri ân + receipts) | Free tier (3k emails) | $0 |
| Domain + SSL | Annual | ~$2/mo |
| Sentry | Free tier | $0 |
| **Total Phase 1** | | **~$35/mo (≈ 875k VND)** |
| **Total Phase 2** | | **~$75/mo (≈ 1.9M VND)** |

No OpenAI / AI gateway line — both matching and explainers are local.

---

## 12. Security Considerations

### 12.1 Data Protection
- All PII encrypted at rest (Supabase handles this by default)
- Identity documents stored in private bucket, not publicly accessible
- Password hashing: bcrypt with cost factor 12
- JWT tokens with short expiry (15 min access, 7 day refresh)
- CSRF protection via SameSite cookies

### 12.2 API Security
- Rate limiting: 100 req/min per user (general), 10 req/min (auth endpoints)
- Input validation on all endpoints via Zod schemas
- SQL injection prevention via parameterized queries (Drizzle ORM)
- XSS prevention via React's default escaping + CSP headers
- File upload validation: type checking, size limits (5MB images, 10MB documents)

### 12.3 Compliance
- Vietnam Personal Data Protection Decree (Decree 13/2023/ND-CP)
- User consent for data collection during onboarding
- Data deletion API for user account removal (GDPR-aligned)
- Cookie consent banner for tracking cookies
- Privacy policy and Terms of Service pages

---

## 13. Testing Strategy

### 13.1 Test Pyramid (as shipped, Apr 7, 2026)

| Level | Tool | Coverage | Focus | Status |
|-------|------|----------|-------|--------|
| Unit | Vitest | 100% on `src/lib/pricing.ts`; 80%+ on other feature-new files | Pure fns: pricing helpers, time helpers | Active |
| Integration | Vitest + `@electric-sql/pglite` (in-process Postgres) | 80%+ on feature routers | tRPC procedures against a real schema (schema migration + data mutations + authz gates) | Active |
| Component | Vitest + `@testing-library/react` + `happy-dom` | Key UI primitives | Host wizard step gating, pricing breakdown, publish button state | Active |
| E2E | Playwright | Critical paths | host creates + publishes -> traveler books + pays -> host dashboard shows booking | Specs written, CI job gated behind preview URL deploy (FOLLOW-13) |
| Performance | k6 | API endpoints | Response time under load | Future |

**Coverage enforcement**: per-file thresholds in `vitest.config.ts` so the 80% bar applies only to code the marketplace feature authored; pre-marketplace routers (`auth`, `chat`, `match`, `place`, `user`, `review`) are not retro-covered in this pass.

**Database testing**: `src/test/setup.ts` boots one PGlite instance per test file, runs the drizzle migrations + the marketplace ALTERs, and truncates all tables between tests via `afterEach`. `fileParallelism: false` serializes test files on Windows where PGlite WASM workers cannot safely share state.

**CI**: `.github/workflows/ci.yml` runs lint + typecheck + vitest (with coverage upload) on every PR. The Playwright job is scaffolded but guarded by `if: false` pending FOLLOW-13.

### 13.2 Critical Test Scenarios

1. **Host wizard**: 5-step progression blocks on content rules (title, description, photos, highlights, schedule, price bounds, duration, category -- 8 negative tests total)
2. **Publish gating**: unverified host cannot publish regardless of content validity
3. **Slug uniqueness**: collision across hosts produces `-N` suffixed slug; the 23505 catch-retry path is covered (via router integration tests and a FOLLOW-12 gap for the actual-race simulation)
4. **Booking price integrity**: dialog-shown total = persisted `tours.priceAmount` = checkout charge = per-person * groupSize (regression guard for the Review Gate #2 BLOCKER)
5. **Payment transactional rollback**: forcing an overflow error mid-transaction leaves `payment.status = 'pending'` and `tours.status = 'preview'`
6. **Deleted-host-with-experiences**: user deletion archives all authored experiences AND nulls `tours.hostId` before the cascade, so previously paid bookings survive with a null host
7. **Authorization boundaries**: every protected procedure rejects `callerAs(null)` (UNAUTHORIZED); every host procedure rejects travelers (FORBIDDEN)
8. **Experience.book orphan guard**: a `kind='host_custom'` listing with `authorId=NULL` cannot be booked, even if its status is `published`

---

## 14. Monitoring & Observability

| Aspect | Tool | Metrics |
|--------|------|---------|
| Error tracking | Sentry | Error rate, stack traces, breadcrumbs |
| Performance | Vercel Analytics | Core Web Vitals, TTFB, FCP, LCP |
| API metrics | Custom logging | Response time (p50, p95, p99), error rate per endpoint |
| Business metrics | PostHog (free tier) | Funnel conversion, feature usage, retention |
| Uptime | UptimeRobot (free) | Endpoint availability, response time |
| Alerts | Sentry + Discord webhook | Error spike, downtime, payment failures |

---

## 15. Migration & Seeding

### 15.1 Initial Data Requirements (as shipped)

| Data | Volume | Source |
|---|---|---|
| Hanoi places | **996 records** | OpenStreetMap Overpass API + Pexels/Wikimedia photos |
| Experience/emotional tags per place | 14 dimensions per place | Local `scripts/lib/tag-scorer.ts` |
| **Fixed Tours** | **15 tours, 3 chapters** | Seeded from docs/sửa .md by `app/src/server/db/seed-fixed-tours.ts` |
| Curated host experiences | 9 (3 per seed host) | Manual content + seed |
| Host activities (à-la-carte) | 12 with 71 time-slots | Seed |
| Merch products | 6 with 13 variants | Seed |
| Test host profiles | 3 verified guides | Recruited fixtures |
| eSIM bundles | 4 (GoHub Vietnam plans) | Seed |

### 15.2 Seed Script Structure (actual)
```
app/src/server/db/
├── seed.ts                       # users + places + curated experiences
├── seed-fixed-tours.ts           # 15-tour catalog (NEW — May 2026)
├── seed-host-experiences.ts      # 9 host-authored experiences
├── seed-activities.ts            # 12 activities + 71 slots
├── seed-merch.ts                 # 6 products + 13 variants
└── seed-host-tours.ts            # ~30 demo bookings for host dashboards
```

### 15.3 Idempotent Migrations
Schema changes ship as standalone Node.js scripts under
[`app/scripts/`](../scripts/) with `IF NOT EXISTS` guards so they apply
cleanly to both Neon production and PGlite tests:

- `create-host-marketplace.ts`
- `create-fixed-tour-tables.ts`         (the May 2026 Fixed Tour Matrix schema)
- `create-product-pivot-tables.ts`      (activities / cart / orders / merch)
- `create-host-payouts-table.ts`
- `create-booking-integrity.ts`         (CHECK constraints documented in BOOKING.md)
- `create-crossover-matching-tables.ts` (planned — Crossover Matching: §3 above; pairs/edits/escrow/vouchers/discovery-pushes; adds `tours.original_fixed_tour_id` + `tours.crossover_pair_id` + the two new `tours.status` values)

---

## 16. Merchant QR + Sỉ Pricing (NEW — schema sketch)

The Phase 2 Merchant QR Verification (PRD §FR-FIELD-01) needs two new tables.
They are not yet in `schema.ts`; sketched here so the implementer can pick
them up.

```sql
CREATE TABLE merchants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) UNIQUE NOT NULL,
  place_id        UUID REFERENCES places(id) ON DELETE SET NULL,
  contact_email   VARCHAR(255),
  contact_phone   VARCHAR(20),
  contract_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (contract_status IN ('pending','active','suspended','terminated')),
  signing_nonce   VARCHAR(64) NOT NULL,  -- bumps on rotation
  signed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE merchant_pricelists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID REFERENCES merchants(id) ON DELETE CASCADE,
  item_name_vi VARCHAR(200) NOT NULL,
  item_name_en VARCHAR(200) NOT NULL,
  retail_vnd   INT NOT NULL,
  si_vnd       INT NOT NULL,   -- the B2B sỉ price Locomate has negotiated
  category     VARCHAR(50),    -- 'main', 'dessert', 'drink', 'workshop_seat', etc.
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_merchant_pricelists_merchant ON merchant_pricelists(merchant_id);
```

The Guide-side scan flow is described in §5.3. Phase 2 acceptance criteria
live in PRD §FR-FIELD-01.

---

## 17. Future Technical Considerations

| Feature | Technical Approach | Phase |
|---|---|---|
| pgvector / Pinecone for Fixed Tours | Cut over when catalog > 1,000 tours OR cross-city personalization is needed. Vector column on `fixed_tours` keeps the schema migration trivial. | Phase 3 |
| Tour-module library (100+ stops) | Catalog-driven; seeded via the existing `seed-fixed-tours.ts` pattern. | Phase 3 |
| Real-time push (Wrap-up + Re-routing) | Firebase Cloud Messaging once a PWA service worker is wired. | Phase 2 |
| Stripe Connect payouts | Replace the manual weekly export with real money movement. | Phase 2 |
| Photo upload | Vercel Blob direct upload for guides' tour photos + host wizard. | Phase 2 |
| Multi-city expansion (Hội An, HCMC) | Add a `city` column to `fixed_tours`, `places`, `host_profiles`; city-scoped queries everywhere. | Phase 3 |
| Native mobile (Capacitor wrapper) | Reuses the PWA shell; iOS/Android wrappers only. | Phase 3 |
| LLM-generated Wrap-up narrative | The current Wrap-up generator (§5.6) is templated. Swap-in is a single function. | Phase 3 |
