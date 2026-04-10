# LOCOMATE - Technical Requirements Document (TRD)

**Version:** 1.0
**Date:** April 7, 2026
**Scope:** Local Development (Hanoi Pilot MVP)
**Platform:** Progressive Web App (PWA)

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
| Maps | **Mapbox GL JS** or **Google Maps JS API** | Interactive maps, directions, geolocation |
| Forms | **React Hook Form + Zod** | Validation, performance |
| Animations | **Framer Motion** | Swipe gestures for LocoMatch |
| PWA | **next-pwa** / Service Worker | Offline support, push notifications |
| Real-time | **Socket.io client** | Chat, location sharing |

### 2.2 Backend

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | **Node.js 22 LTS** | JavaScript ecosystem, async I/O |
| Framework | **Next.js API Routes** + **tRPC** | Unified deployment, type-safe API |
| Language | **TypeScript 5.x** | Shared types with frontend |
| ORM | **Drizzle ORM** | Type-safe SQL, lightweight, PostgreSQL native |
| Database | **PostgreSQL 16** | JSONB for flexible schemas, PostGIS for geospatial |
| Cache | **Redis 7** (Upstash for serverless) | Session management, rate limiting, feed caching |
| File Storage | **Supabase Storage** or **AWS S3** | User photos, place images, identity documents |
| Real-time | **Socket.io** | WebSocket for chat and location sharing |
| Job Queue | **BullMQ** (Redis-backed) | Tour generation, email sending, image processing |
| AI/ML | **OpenAI API (GPT-4o)** | Tour narrative generation, personality inference |
| Email | **Resend** | Transactional emails (confirmations, receipts) |
| Push Notifications | **Web Push API** + **Firebase Cloud Messaging** | Match notifications, tour reminders |

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
  │     │
  │     ├── explicit_data (JSONB)
  │     ├── derived_data (JSONB)
  │     └── implicit_data (JSONB)
  │
  ├── host_profiles (1:1, optional)
  │     ├── identity_documents
  │     ├── availability_slots
  │     └── specialties
  │
  ├── matches (M:N self-join)
  │     └── messages
  │
  ├── tours (1:N)
  │     ├── tour_stops (1:N)
  │     ├── tour_reviews (1:N)
  │     └── payments (1:1)
  │
  └── place_reviews (1:N)

places ─────────┐
  ├── experience_tags (JSONB)
  ├── emotional_tags (JSONB)
  └── place_reviews (1:N)
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

#### `matches`
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

#### `swipe_actions`
```sql
CREATE TABLE swipe_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('like', 'skip')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, target_id)
);

CREATE INDEX idx_swipes_swiper ON swipe_actions(swiper_id);
```

#### `messages`
```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'system')),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
```

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
    CHECK (package_type IN ('loco_route', 'solo_mate', 'social_tour')),
  price_amount    INT NOT NULL DEFAULT 0,
  price_currency  VARCHAR(3) DEFAULT 'VND',

  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tours_user ON tours(user_id, status);
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

### 4.2 Router Structure

```
src/server/routers/
├── auth.router.ts          # Registration, login, OAuth
├── user.router.ts          # Profile CRUD, onboarding
├── place.router.ts         # Place CRUD, feed, search
├── match.router.ts         # Swipe, match, unmatch
├── chat.router.ts          # Messages, conversations
├── tour.router.ts          # Tour CRUD, generation, stops
├── payment.router.ts       # Payment intents, webhooks
├── review.router.ts        # Reviews CRUD
├── host.router.ts          # Host profile, availability
├── admin.router.ts         # Moderation, verification
└── _app.ts                 # Root router merge
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

#### Match
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `match.getCandidates` | query | authed | Get swipe candidates (paginated) |
| `match.swipe` | mutation | authed | Record like/skip action |
| `match.getMatches` | query | authed | List current matches |
| `match.unmatch` | mutation | authed | Remove match |
| `match.block` | mutation | authed | Block user |

#### Chat
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `chat.getConversations` | query | authed | List active conversations |
| `chat.getMessages` | query | authed | Paginated messages for a match |
| `chat.sendMessage` | mutation | authed | Send text/image message |
| `chat.markRead` | mutation | authed | Mark messages as read |

#### Tour
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `tour.create` | mutation | authed | Submit tour request, trigger generation |
| `tour.getPreview` | query | authed | Get free preview of generated tour |
| `tour.getFullTour` | query | authed | Get full tour (requires payment) |
| `tour.updateStop` | mutation | authed | Swap/reorder stops |
| `tour.startTour` | mutation | authed | Begin active tour mode |
| `tour.markStopVisited` | mutation | authed | Mark a stop as visited |
| `tour.completeTour` | mutation | authed | End tour |
| `tour.getHistory` | query | authed | List past tours |

#### Payment
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `payment.createIntent` | mutation | authed | Create payment intent for tour |
| `payment.confirm` | mutation | authed | Confirm payment after gateway redirect |
| `payment.webhook` | mutation | public | Gateway webhook handler (Stripe/VNPay) |
| `payment.requestRefund` | mutation | authed | Request refund |

#### Host
| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `host.getProfile` | query | authed | Get host profile |
| `host.updateProfile` | mutation | host | Update bio, specialties |
| `host.setAvailability` | mutation | host | Set weekly time slots |
| `host.getBookings` | query | host | List assigned tours |
| `host.submitVerification` | mutation | host | Upload identity documents |

---

## 5. Core Algorithms

### 5.1 Tour Generation Algorithm

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

  8. narrative = callOpenAI(
       prompt: "Generate a personalized tour description",
       context: { places: selectedPlaces, userProfile: CONTEXT }
     )

  9. RETURN TourObject {
       stops: optimizedRoute,
       timeline: timeline,
       narrative: narrative,
       estimatedCost: SUM(place.price_range for place in selectedPlaces),
       personalizationRationale: explain(CONTEXT, selectedPlaces)
     }
```

### 5.2 Match Scoring Algorithm

```
FUNCTION calculateMatchScore(userA, userB):
  interestOverlap = |intersect(A.interests, B.interests)| /
                    |union(A.interests, B.interests)|

  intentSimilarity = cosineSimilarity(A.intent_vector, B.intent_vector)

  travelTimingOverlap = overlapDays(A.travel_dates, B.travel_dates) /
                        max(A.trip_length, B.trip_length)

  languageCompat = IF shareCommonLanguage(A, B) THEN 1.0 ELSE 0.3

  socialAlign = 1.0 - |A.social_preference - B.social_preference|

  score = 0.25 * interestOverlap
        + 0.25 * intentSimilarity
        + 0.20 * travelTimingOverlap
        + 0.15 * languageCompat
        + 0.15 * socialAlign

  RETURN score  // threshold: >= 0.40 to show in feed
```

### 5.3 Derived Profile Computation

```
FUNCTION computeDerivedProfile(explicitData):
  prompt = buildPrompt(
    "Given these onboarding answers, compute personality, behavior,
     and emotional vectors as JSON with float values 0.0-1.0",
    explicitData
  )

  result = callOpenAI(prompt, model="gpt-4o-mini", response_format="json")

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
Client <--WebSocket--> Socket.io Server
                          |
                     Redis Pub/Sub (adapter)
                          |
                    Event Handlers:
                    ├── chat:message     (new message)
                    ├── chat:typing      (typing indicator)
                    ├── match:new        (new match notification)
                    ├── tour:update      (tour status change)
                    └── location:share   (GPS coordinates)
```

### 6.2 Chat Protocol
- Messages sent via WebSocket, persisted to PostgreSQL
- Delivery confirmation via `message:delivered` event
- Read receipts via `message:read` event
- Reconnection with message gap-fill from DB

### 6.3 Location Sharing (During Active Tour)
- Client sends GPS coordinates every 30 seconds
- Stored in Redis with 48h TTL (not persisted to main DB)
- Shared only with user's designated emergency contact
- User can toggle on/off at any time

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
|------|------------|
| `traveler` | Browse places, swipe/match, create tours, make payments, review |
| `host` | All traveler permissions + manage host profile, view assigned tours, set availability |
| `admin` | All permissions + verify hosts, moderate content, manage reports, view analytics |

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

## 8. Third-Party Integrations

### 8.1 Maps (Google Maps Platform or Mapbox)

| API | Usage | Estimated Monthly Cost (MVP) |
|-----|-------|------------------------------|
| Maps JavaScript API | Interactive map display | $0 (free tier: 28,000 loads) |
| Geocoding API | Address to coordinates | ~$5 (1,000 requests) |
| Directions API | Route optimization | ~$10 (2,000 requests) |
| Places API | Place details enrichment | ~$15 (optional) |

### 8.2 OpenAI API

| Model | Usage | Estimated Monthly Cost (MVP) |
|-------|-------|------------------------------|
| GPT-4o-mini | Derived profile computation | ~$10 (1,000 profiles) |
| GPT-4o-mini | Tour narrative generation | ~$20 (500 tours) |
| GPT-4o-mini | Personalization rationale | included above |

### 8.3 Payment Gateway

**Option A: Stripe** (International focus)
- 2.9% + $0.30 per transaction
- Supports Visa, Mastercard, Apple Pay
- Webhook-based status updates

**Option B: VNPay** (Vietnam focus)
- 1.5-2.0% per transaction
- QR code, domestic bank transfer, e-wallets
- Redirect-based flow

**Recommendation:** Integrate **both** - Stripe for international cards, VNPay for local payments. Payment router selects gateway based on user's chosen method.

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
# Database
DATABASE_URL=postgresql://locomate:locomate@localhost:5432/locomate

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<random-256-bit-key>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...

# Payment - Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Payment - VNPay
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...

# Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Email
RESEND_API_KEY=re_...

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
|---------|------|-------------|
| Vercel | Pro | $20 |
| Supabase (PostgreSQL + Storage) | Pro | $25 |
| Upstash (Redis) | Pay-as-you-go | $5 |
| Google Maps APIs | Pay-as-you-go | ~$30 |
| OpenAI API | Pay-as-you-go | ~$30 |
| Stripe | Transaction fees | ~$15 |
| Resend | Free tier | $0 |
| Domain + SSL | Annual | ~$2/mo |
| Sentry | Free tier | $0 |
| **Total** | | **~$127/mo (~3.2M VND)** |

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

### 13.1 Test Pyramid

| Level | Tool | Coverage Target | Focus |
|-------|------|----------------|-------|
| Unit | Vitest | >= 80% | Services, algorithms, utilities |
| Integration | Vitest + test DB | Key flows | API routes, DB queries |
| E2E | Playwright | Critical paths | Registration, onboarding, tour purchase |
| Performance | k6 | API endpoints | Response time under load |

### 13.2 Critical Test Scenarios

1. **User registers, completes onboarding, receives derived profile**
2. **User browses place feed, filters work correctly**
3. **Two users swipe right, match is created, chat opens**
4. **User creates tour, sees preview, pays, receives full tour**
5. **Payment succeeds/fails appropriately**
6. **Host cancels: user receives auto-refund**
7. **Tour generation handles edge case: no matching places**

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

### 15.1 Initial Data Requirements

| Data | Volume | Source |
|------|--------|--------|
| Hanoi places | 200+ records | Manual curation + Google Places API enrichment |
| Experience/emotional tags per place | 14 dimensions per place | Manual scoring + AI-assisted batch tagging |
| Tour module templates | 30 modules | Content team / AI-generated |
| Test host profiles | 15 profiles | Recruited university students |

### 15.2 Seed Script Structure
```
seeds/
├── 01-places.ts          # 200+ verified Hanoi places
├── 02-experience-tags.ts # Tag scoring for all places
├── 03-tour-modules.ts    # 30 initial tour templates
└── 04-test-users.ts      # Dev/staging test accounts
```

---

## 16. Future Technical Considerations (Post-MVP)

| Feature | Technical Approach | Phase |
|---------|-------------------|-------|
| Advanced AI matching | Fine-tuned embeddings model for user-place similarity | Phase 2 |
| Social Tour group formation | Graph-based clustering algorithm | Phase 2 |
| Real-time social map | WebSocket + Redis geospatial for live traveler positions | Phase 2 |
| Multi-city expansion | Multi-tenant DB schema, city-scoped queries | Phase 3 |
| Native mobile apps | React Native (shared business logic) or Capacitor | Phase 3 |
| Recommendation engine | Collaborative filtering on review/behavior data | Phase 3 |
| Content moderation AI | Image/text moderation via OpenAI Moderation API | Phase 2 |
