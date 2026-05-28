# Host Tour Marketplace -- Proposal (Phases 1+2)

**Proposed:** April 7, 2026
**Status:** Shipped Apr 7, 2026 (138 tests passing, 3 adversarial/testing reviewer passes, prod deploy verified at https://loco-mate.vercel.app)
**Scope:** Transform LOCOMATE into a two-sided marketplace where verified hosts author their own premium tours alongside LOCOMATE-curated ones.

---

## Product shape

Two supply tracks, one demand surface. Curated experiences (the 6 we made: "Breakfast Like a Hanoian", etc.) coexist with host-authored experiences in a unified `/experiences` listing. Algorithmic tours (`/plan` wizard, flat VND 250k-1M tiers) stay as the cheaper self-service alternative -- untouched.

```
Supply
   Curated (LOCOMATE)  ----+
                            +--> /experiences listing --> /experiences/[slug] --> Book --> /tour/[id]/checkout --> /tour/[id] (active)
   Host custom (NEW)   ----+                                                           ^
                                                                                        |
                                                                                   tours.experienceId
                                                                                   tours.hostId
```

## Decisions locked in (from async Q&A)

| Decision | Chosen |
|---|---|
| Entity model | Extend `experiences` with `authorId`/`kind`/`status` columns. No parallel `host_tours` table. |
| Moderation | Auto-publish for hosts with `verificationStatus='approved'`. No admin queue in v1. |
| Pricing control | Host sets price within VND 400k-5M; flat 20% platform commission shown transparently. |
| Phasing | Phases 1 + 2 ship together -- full host CRUD plus real traveler booking. |

## Schema changes -- one migration

Extend `experiences`:

```ts
authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
kind: varchar("kind", { length: 20 }).notNull().default("curated"),
//   "curated" | "host_custom"
status: varchar("status", { length: 20 }).notNull().default("published"),
//   "draft" | "published" | "archived" | "rejected"
publishedAt: timestamp("published_at", { withTimezone: true }),
reviewNotes: text("review_notes"),
```

Link `tours` back to the template:

```ts
experienceId: uuid("experience_id").references(() => experiences.id, { onDelete: "set null" }),
```

Three new indexes:
- `idx_experiences_author` on `(author_id)`
- `idx_experiences_public` on `(status, kind)`
- `idx_tours_experience` on `(experience_id)`

Backfill: 6 existing curated rows get `kind='curated'`, `status='published'`, `publishedAt=createdAt`, `authorId=NULL`.

Migration runs as [app/scripts/create-host-marketplace.ts](app/scripts/create-host-marketplace.ts) with `IF NOT EXISTS` guards so it is idempotent against both Neon prod and local.

## Pricing helpers -- extend [app/src/lib/pricing.ts](app/src/lib/pricing.ts)

```ts
export const HOST_TOUR_PRICING = {
  minPrice: 400_000,
  maxPrice: 5_000_000,
  commissionRate: 0.20,
  currency: "VND" as const,
} as const;

export function isValidHostTourPrice(price: number): boolean;
export function computeHostPayout(price: number): { hostPayout: number; platformFee: number };
```

Server-side validation in `hostExperience.publish`. Client-side for the wizard's transparent breakdown ("You set VND 1,000,000 --> LOCOMATE keeps 200,000, you receive 800,000").

## API surface

### Traveler-facing (extend `experienceRouter`)

| Procedure | Type | Change |
|---|---|---|
| `list` | public | Add `kind?: "curated" \| "host_custom" \| "all"` + `authorId?` filters. Left-join author info (displayName, avatarUrl, host avgRating) when `authorId` is set. Always filters `status='published'`. |
| `getBySlug` | public | Same author join. |
| `book` | protected (NEW) | Input: `{ experienceId, date, startTime, groupSize }`. Creates a `tours` row with `status='preview'`, `packageType='host_experience'`, `experienceId` and `hostId` set, `priceAmount` pulled server-side from the experience. Returns `{ tourId }` so the UI can route to `/tour/[id]/checkout`. |

On successful `payment.confirm`, if `tour.experienceId IS NOT NULL`, increment `experiences.totalBookings` in the same transaction.

### Host-facing (new `hostExperienceRouter`)

Kept separate from `host.router.ts` so the dashboard router stays focused.

| Procedure | Notes |
|---|---|
| `listMine` | All statuses for the authenticated host, newest first. |
| `create` | Drafts only (`status='draft'`). Schema-shape input. |
| `update` | Ownership + status in (`draft`, `rejected`). |
| `publish` | Gates: ownership, status in (`draft`, `rejected`), `hostProfiles.verificationStatus === 'approved'`, content-rules (>=3 photos, >=1 highlight, >=1 schedule item, description >=100 chars, `isValidHostTourPrice`), slug uniqueness. Sets `status='published'`, `publishedAt=NOW()`. |
| `archive` | Published -> archived. Stops new bookings; history preserved. |
| `getById` | Ownership gate; used by edit + preview pages. |

### Host dashboard (extend existing)

`host.getDashboard` adds:
- `myListingsCount: { published, draft, archived }`
- Today's bookings rows include `experienceTitle` via left-join on `tours.experienceId -> experiences.title` so the host dashboard shows the real tour name instead of a generic "Custom Hanoi tour".

## UI surface

### Traveler-facing (extend)

- [app/src/app/(public)/experiences/page.tsx](app/src/app/(public)/experiences/page.tsx) -- segmented control "All / Curated / By Local Hosts" above the category filter. Cards gain a "Hosted by <name>" chip when `kind='host_custom'`.
- [app/src/app/(public)/experiences/[slug]/page.tsx](app/src/app/(public)/experiences/[slug]/page.tsx) -- new "Your host" card (avatar, bio, languages, avgRating) when host-authored. Book button opens a small date/time/groupSize dialog, calls `experience.book`, routes to `/tour/[id]/checkout`. **This retires the "Bookings opening soon" toast and closes UI-04.**

### Host-facing (new)

```
/host/experiences                  -- list (tabs: Published / Drafts / Archived)
/host/experiences/new              -- 5-step wizard
/host/experiences/[id]/edit        -- wizard pre-filled
/host/experiences/[id]/preview     -- read-only render of the traveler detail view
```

Five wizard steps:
1. Basics (title, subtitle, category chips, duration hours, maxGroupSize)
2. Story (description, highlights, included items)
3. Schedule (timeline of `{ time, label }` rows)
4. Photos (URL inputs, min 3 -- real upload is Phase 3)
5. Pricing (slider clamped 400k-5M, live 20% split breakdown)

Draft autosave on step transition. "Publish" button on the final step; disabled with tooltip when the host is not yet verified, linking to `/host-setup`.

### Home & profile tweaks

- Home's "Only-in-Hanoi" carousel already reads `experience.list`; host experiences surface automatically. Add a small "AUTHORED BY HOST" badge.
- Profile (traveler role): show "Experiences booked" count. Profile (host role): link to `/host/experiences`.

## Security / trust model

- Every `hostExperience.*` procedure double-checks `experience.authorId === ctx.user.id` after loading the row. `hostProcedure` only checks role; ownership is per-procedure.
- `experience.list` / `experience.getBySlug` always filter `status='published'` for public callers. Drafts, archived, and rejected never leak.
- Price is charged from the server-loaded `experience.priceAmount`, never from client input.
- Validation caps on the wizard (title length, price bounds, photo count) are server-authoritative; client-side limits are UX only.
- Slug generation reuses [app/src/lib/slugify.ts](app/src/lib/slugify.ts) with `-${n}` collision suffix. No user input hits URLs raw.

## Phasing

Single execution stream with two code-review gates. No per-group reviews because the schema change is a single transactional unit -- fragmenting reviews around it would chase ghosts.

```
1. Schema migration
2. Pricing helpers
3. Router: experience extensions + hostExperience router
   -- code review #1 --
4. Host wizard UI + list page
5. Traveler listing / detail updates
6. Booking mutation + checkout hookup
   -- code review #2 --
7. Host dashboard integration
8. Build + deploy + end-to-end smoke test
9. TODO.md updates (close UI-04 + BIZ-02, log follow-ups)
```

End-to-end smoke test for step 8: Alex (traveler) -> browse `/experiences` -> pick a host tour by Nam -> complete booking dialog -> pay in /checkout -> Nam signs in -> `/host` shows the booking in today's widget -> `totalBookings` on the listing incremented.

## Explicitly out of scope (for this plan)

| Deferred | Reason | Tracked |
|---|---|---|
| Photo upload (S3/blob) | Wizard takes URL strings -- same as curated experiences. | FOLLOW-10 |
| Admin moderation UI | Auto-publish for verified hosts covers v1. | future |
| Real payouts (money movement) | Commission is computed & displayed only. Manual off-platform weekly settlement for v1. | FOLLOW-08 |
| Per-experience reviews UI | `reviews` table already supports `targetType='experience'`. UI block later. | FOLLOW-09 |
| Geographic search / map discovery | Category + kind filter ships; full-text + map later. | future |
| Cancellation policy | Uses existing tour refund model (or lack thereof). | future |

## What this plan does NOT change

- `/plan` algorithmic tour flow stays exactly as-is. Fixed tours remain the cheaper track with the ₫250k/750k/1M tiers.
- `TOUR_PRICING` is untouched (host experience pricing is a parallel constant).
- Chat, saved places, profile, OAuth, account deletion -- all unaffected.
- The recent `tour.assignHost` mutation is still the right primitive for travelers who want to upgrade an algorithmic tour with a host without going through the marketplace.

## Risk register + mitigations

| Risk | Mitigation |
|---|---|
| Unverified hosts accumulate drafts they can never publish | Host-setup entry banner: "Get ID-verified to unlock publishing". Wizard's publish button is disabled with tooltip. |
| Curated vs. host experiences get mistaken for each other | `kind` column drives a badge on every card + detail page. Segmented filter on listing. |
| Hosts set wildly divergent prices for similar tours | 400k-5M bounds cap the blast radius. Marketplace dynamics sort the rest. |
| Slug squatting (host titles their tour "Breakfast Like a Hanoian") | Slug collision handling appends `-${n}`. Duplicate titles allowed but URLs stay unique. |
| Payment-vs-display divergence (the exact class of bug UI-18 closed) | `experience.book` persists `priceAmount` server-side from the experience row; `/checkout` reads the persisted value; same path as algorithmic tours. |
