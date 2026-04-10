# LOCOMATE

AI-powered personalized travel experience platform for solo travelers in Hanoi.

LOCOMATE combines place discovery (LocoRec), social matching (LocoMatch), and AI-designed customized tours into one integrated mobile-first web app.

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | >= 22 LTS | `node --version` |
| **pnpm** | >= 9 | `pnpm --version` |
| **Docker Desktop** | Latest | `docker --version` |

If you don't have pnpm, install it:

```bash
npm install -g pnpm
```

---

## Quick start

### 1. Install dependencies

```bash
cd app
pnpm install
```

### 2. Set up environment variables

Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

The defaults work out of the box for local development. The `.env` file ships with working database credentials that match the Docker Compose config.

Optional keys you can add for enhanced features:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `OPENAI_API_KEY` | AI tour narrative generation and profile derivation | No (falls back to deterministic logic) |
| `STRIPE_SECRET_KEY` | Stripe test-mode payments | No (uses simulated payment flow) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Maps (unused in localhost, uses Leaflet) | No |

### 3. Start database services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with PostGIS on port `5432`
- **Redis 7** on port `6379`

Verify they're running:

```bash
docker compose ps
```

### 4. Create database tables

Apply the migration SQL to PostgreSQL:

**macOS / Linux:**
```bash
cat src/server/db/migrations/0000_chief_xavin.sql | docker exec -i app-postgres-1 psql -U locomate -d locomate
```

**Windows (PowerShell):**
```powershell
Get-Content src/server/db/migrations/0000_chief_xavin.sql -Raw | docker exec -i app-postgres-1 psql -U locomate -d locomate
```

You should see output confirming 14 `CREATE TABLE`, multiple `ALTER TABLE`, and `CREATE INDEX` statements.

### 5. Seed the database

```bash
pnpm db:seed
```

This populates:
- **216 places** in Hanoi (56 hand-curated hidden gems + 160 generated)
- **5 test traveler accounts**
- **3 test host accounts** (with profiles, availability, and verification)
- **User profiles** with pre-computed personality vectors

### 6. Start the development server

```bash
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## Test accounts

All test accounts use the password `password123`.

### Travelers

| Email | Name | Personality | Notes |
|-------|------|-------------|-------|
| `alex@test.com` | Alex Johnson | The Deep Explorer | Culture + food, medium budget |
| `sam@test.com` | Sam Smith | The Thrill Seeker | Adventure + nightlife, high budget |
| `elena@test.com` | Elena Rodriguez | The Culture Scholar | Photography + art, solo |
| `yuki@test.com` | Yuki Tanaka | The Curious Nomad | Food + culture, low budget |
| `marco@test.com` | Marco Weber | The Spontaneous Spirit | Nature + adventure, high budget |

### Hosts

| Email | Name | Specialty |
|-------|------|-----------|
| `nam@test.com` | Nguyen Hoang Nam | Street food, photography, nightlife |
| `linh@test.com` | Tran Linh | Culture, history, walking tours |
| `chau@test.com` | Le Minh Chau | Cafes, art, nature |

---

## App walkthrough

### Traveler flow

1. **Login** at `/login` with a test traveler account (or use Google/Apple OAuth buttons)
2. **Home dashboard** at `/home` -- personalized greeting, personality badge, nearby friends, hidden gems, tour resume
3. **Explore** places at `/explore` -- browse 216 Hanoi hidden gems with category filters
4. **View details** -- tap any place card for the full detail page with "Why it fits you"
5. **Match** at `/match` -- swipe on other travelers to find companions
6. **Chat** at `/chat` -- message your matches; tap "Plan together" to create a duo tour
7. **Plan a tour** at `/plan` -- configure date, duration, budget, interests, and host preference
8. **Preview** -- see 3 free stops, then unlock the full itinerary via payment
9. **Active tour** -- step-by-step navigation with mark-as-visited and emergency contacts
10. **Review** -- rate your tour 1-5 stars with optional comment after completing
11. **Profile** at `/profile` -- view personality, preferences (editable), tour history, emergency contacts

### Host flow

1. **Login** with a host account (e.g. `nam@test.com`)
2. **Host dashboard** at `/host` -- view bookings, earnings, and traveler requests
3. **Host setup** at `/host-setup` -- the onboarding wizard for new hosts

---

## Project structure

```
app/
├── docker-compose.yml          # PostgreSQL + Redis
├── drizzle.config.ts           # Drizzle ORM configuration
├── .env                        # Environment variables (gitignored)
├── .env.example                # Template for env vars
├── public/
│   └── images/
│       └── logo.png            # LOCOMATE brand logo
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login, register, onboarding, host-setup
│   │   ├── (main)/             # Authenticated app shell
│   │   │   ├── explore/        # LocoRec place feed + detail
│   │   │   ├── match/          # LocoMatch swipe interface
│   │   │   ├── chat/           # Conversations inbox + 1:1 chat
│   │   │   ├── plan/           # Tour builder
│   │   │   ├── tour/[id]/      # Preview, checkout, full itinerary, active mode, hosts
│   │   │   ├── profile/        # Traveler profile & settings
│   │   │   └── host/           # Host dashboard
│   │   └── api/trpc/           # tRPC API handler
│   ├── server/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema (14 tables)
│   │   │   ├── seed.ts         # Database seeding script
│   │   │   ├── index.ts        # DB connection
│   │   │   └── migrations/     # SQL migration files
│   │   ├── routers/            # tRPC routers (auth, user, place, match, chat, tour, payment, host)
│   │   ├── services/           # Business logic (tour-engine, profile-engine)
│   │   ├── middleware/         # JWT auth
│   │   └── trpc.ts             # tRPC initialization
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Bottom navigation
│   │   └── providers.tsx       # tRPC + React Query provider
│   ├── stores/                 # Zustand state (auth)
│   ├── lib/                    # Utilities, validations, tRPC client
│   └── types/                  # Shared TypeScript types
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server at localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:push` | Push schema directly to DB (interactive) |
| `pnpm db:seed` | Seed database with places and test users |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| API | tRPC v11 (end-to-end type safety) |
| Database | PostgreSQL 16 + PostGIS (via Docker) |
| ORM | Drizzle ORM |
| Cache | Redis 7 (via Docker) |
| Auth | JWT (local, bcrypt password hashing) |
| State | Zustand (persisted to localStorage) |
| Data fetching | TanStack Query v5 |
| Animations | Framer Motion |
| Maps | Leaflet + OpenStreetMap (free, no API key) |
| Payments | Stripe (test mode) |
| Forms | React Hook Form + Zod |

---

## Database

### Schema (14 tables)

`users`, `user_profiles`, `host_profiles`, `host_availability`, `places`, `matches`, `swipe_actions`, `messages`, `tours`, `tour_stops`, `payments`, `reviews`, `emergency_contacts`, `reports`

### Reset database

To wipe and re-seed:

```bash
docker compose down -v
docker compose up -d
# Wait a few seconds for PostgreSQL to start, then:
# macOS/Linux:
cat src/server/db/migrations/0000_chief_xavin.sql | docker exec -i app-postgres-1 psql -U locomate -d locomate
# Windows:
Get-Content src/server/db/migrations/0000_chief_xavin.sql -Raw | docker exec -i app-postgres-1 psql -U locomate -d locomate

pnpm db:seed
```

### Browse database

```bash
pnpm db:studio
```

Opens Drizzle Studio at https://local.drizzle.studio for visual database browsing.

---

## Stopping services

```bash
# Stop the Next.js dev server: Ctrl+C in the terminal

# Stop database containers (preserves data):
docker compose stop

# Stop and remove everything (including data):
docker compose down -v
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `pnpm: command not found` | Run `npm install -g pnpm` |
| `docker: command not found` | Install Docker Desktop and make sure it's running |
| Seed fails with auth error | Make sure `.env` has `DATABASE_URL=postgresql://locomate:locomate@localhost:5432/locomate` |
| Port 5432 already in use | Stop any existing PostgreSQL: `docker compose down` or stop the system service |
| Port 3000 already in use | Kill the process: `npx kill-port 3000` or use `pnpm dev -- -p 3001` |
| Pages show blank after login | Clear localStorage in browser DevTools (Application > Storage > Clear site data) |
| TypeScript errors | Run `npx tsc --noEmit` to see details; all should pass on clean checkout |
