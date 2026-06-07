# Locomate Codebase Audit — 2026-05-29

Multi-lens audit. Six independent reviewers (security, data integrity, architecture, performance, maintainability, test coverage) ran in parallel against the working tree at commit `04afaa2`. Each produced a ~250-line lens report; the full lens reports are archived in agent transcripts. This document is the synthesis.

## TL;DR — overall posture

**Healthier than the AI-generated-codebase framing predicts.** Five things consistently impressed every reviewer:

- Drizzle + PGlite real-DB integration tests (no mocked-DB cheats)
- Service layer is real business logic, not thin wrappers
- Payment safety (server-authoritative pricing, atomic coupon redemption, idempotency)
- tRPC is the single mutation channel (no server-action overlap, no escaped business logic)
- Type hygiene: zero `@ts-ignore`, zero `TODO`/`FIXME` markers, ~6 non-null assertions across ~455 files

**But five systemic fault-lines surfaced across multiple lenses** — these are where to spend the next month:

| # | Theme | Flagged by | Why systemic |
|---|---|---|---|
| 1 | **Schema drift** | Data×4C, Perf×1C, Test×1H | `schema.ts` ↔ production DB has diverged silently. Already burned us once (`activity_id` FK). |
| 2 | **JSONB un-typed boundary** | Maint×1C, Arch×1H, Data×1H, Sec×1H | `as Record<string, unknown>` cast 30+ times across 15 files. Highest-leverage single fix. |
| 3 | **Crossover surface** | Perf×1C, Sec×1H, Data×2H, Test (helper untested) | Most fragile feature; compounding N+1, PII leak, missing tx + uniques, unscheduled cron. |
| 4 | **Auth lifecycle** | Sec×2 (C+H), Test×2C, Arch×1H | Zero rate limits on auth surface, refresh tokens in `localStorage`, OAuth callback bypasses tRPC, no tests. |
| 5 | **Image pipeline** | Perf×1C | 100 atom JPEGs × ~2.5 MB = 245 MB raw-`<img>` served to mobile thumbnails. |

---

## The Critical 10 (ship-blockers — fix before next deploy)

> **Jun 8 2026 update:** Critical #3 and the FK portions of #4 have now been
> addressed in code: `payments.tour_id` / `payments.user_id` detach with
> `ON DELETE SET NULL`, known FK drift surfaces are mirrored in `schema.ts`,
> and `db:check` fails important DDL-only FK / unique-index drift instead of
> treating it as informational.

| # | Issue | Source lens(es) | Effort | One-line fix |
|---|---|---|---|---|
| 1 | `match.unmatch` accepts any matchId — global IDOR | Sec C1 | tiny | Add participant ownership check in resolver |
| 2 | Zero rate-limiting on `auth.login` / `register` / `refreshToken` / OAuth callback | Sec C2 | small | Extend `chat-ratelimit.ts` shape; wrap auth procedures |
| 3 | `user.deleteAccount` cascade-deletes payment audit trail (financial records lost) | Data C1 | small | Switch payments FK to `ON DELETE SET NULL`; anonymise user row instead |
| 4 | 4 schema-vs-DDL FK drifts: `tours.crossover_pair_id`, `cart_items.product_variant_id`, `tour_proposal_edits.target_activity_id`, plus the indexed-but-unconstrained variants | Data C2-C4 + L4 | small | One schema-only PR + companion migrations + CI drift check |
| 5 | Playwright CI job is gated by `if: false` — **E2E never runs** in CI | Test C1 | tiny | Delete the `if: false` flag in `.github/workflows/ci.yml:127` |
| 6 | `crossover.getDiscoveryFeed` is an N+1 inside an N+1: ~150 sequential DB round-trips per call | Perf C1 | medium | Pre-collect peer IDs; 3 batched `inArray` queries |
| 7 | 100 atom JPEGs at 2-3 MB each (245 MB total) served via raw `<img>` on `/activities`, `/home`, `/experiences` | Perf C2 | medium | `next/image` + re-encode masters to ≤400 KB max-1600px |
| 8 | OAuth callback handler (`/api/auth/google/callback`) and `auth.refreshToken` are **completely untested** | Test C3, C4 | medium | New `oauth/__tests__/callback.test.ts` mocking arctic; refresh-token block in `auth.router.test.ts` |
| 9 | `_legacy/tour-engine.ts` is live code imported by `tour.router.ts` (misleading quarantine marker) | Maint C2, Arch H3 | small | Rename out of `_legacy/`, or finish the retirement and delete |
| 10 | `match.getCandidates` returns raw `userProfiles.explicitData` + `derivedData` of every onboarded traveler (PII leak: nickname, birthYear, nationality, personality) | Sec H1 | small | Pass through a strict Zod DTO; whitelist fields |

---

## High-leverage clusters

A cluster is a set of findings that share a fix or a domain. Fixing them together compounds.

### Cluster A — JSONB Zod parsing (single highest-leverage fix)

**Symptom:** 30+ sites cast `userProfiles.explicitData`, `derivedData`, `tours.requestParams`, `tours.tourData` to `Record<string, unknown>` then access by string key. No runtime validation. Silent `undefined` cascades on shape drift.

**Files touched:** ~15 across routers + services + 2 API routes.

**Fix:** Define Zod schemas in `src/server/lib/{profile-shape,tour-request-shape,tour-data-shape}.ts`. Parse on read at ONE chokepoint per column. Export inferred TS types for everything downstream. Removes the codebase's most-duplicated idiom AND closes the only material type-system hole.

**Sources:** Maint H, Arch H6, Data H8 (JSONB un-validated at write), Sec H1 (PII leak via untyped passthrough).

### Cluster B — Crossover hardening

**Symptom:** Six findings concentrated in `crossover.router.ts` + `crossover-cron.ts`:
- Perf C1: discovery feed N+1
- Perf C6: cron loads all bookings + all profiles into memory each tick
- Sec H1: PII leak in candidates
- Data H1: `lockItinerary` + `respondToRequest` missing transactions
- Data H6: missing unique constraints (`escrow_adjustments.crossover_request_id`, `(requester, target)` pair)
- Arch L6: crossover sweeps not actually wired to Vercel cron despite 504 lines of tested service code

**Fix:** Single multi-PR feature sprint. (a) Batched discovery query + DTO; (b) two `db.transaction` wraps; (c) two unique constraints + matching `Promise.all` in tests; (d) wire `/api/cron/crossover-{t48,t36,t28,t24}/route.ts` + `vercel.json` entries.

### Cluster C — Auth lifecycle

**Symptom:** Five findings in the auth/session layer:
- Sec C2: no rate limiting on login/register/refresh/OAuth
- Sec H3: refresh tokens in `localStorage` (Zustand), 7-day lifetime, no rotation, no revocation
- Sec H4: SSE route regex-parses a `locomate-auth` cookie as JSON (loaded gun for future dev)
- Test C3, C4: `auth.refreshToken` + OAuth callback untested
- Arch H7: OAuth callback (242 lines) bypasses tRPC; business logic in HTTP layer
- Arch H2: auth gate is `useEffect` redirect in layout — unauth users see shell flash

**Fix:** Combined PR:
1. Extend `chat-ratelimit.ts` shape to a generic `rateLimit({ key, burst, daily })` helper; wrap auth/quiz/upload/payment.confirm/deleteAccount.
2. Move refresh tokens to httpOnly cookie + server-side `sessions` table with rotation.
3. Extract OAuth account-resolution into `src/server/services/oauth-account.ts`; thin the route handler.
4. Add `protectedOwnedProcedure(table, idField)` middleware helper.
5. Move auth check into `src/middleware.ts` (read JWT cookie; gate `(main)`/`(admin)`).
6. Add the missing tests.

### Cluster D — Schema drift CI

**Symptom:** No automated check that `schema.ts` matches the live DB. We've been bitten once already (`fixed_tour_steps.activity_id` FK missing in prod for weeks). Data audit found 4 more drifts of the same class. Testing audit confirmed `migrations.test.ts` only verifies the marketplace ALTERs.

**Fix:** A CI script that runs `drizzle-kit introspect` (or pulls `information_schema` from a fresh DB and compares to a serialized snapshot of `schema.ts`). Block merges on drift. One-time setup; prevents the entire class of incident going forward.

### Cluster E — Image pipeline + RSC posture

**Symptom:** Perf C2 (the JPEGs) is symptomatic of a deeper issue: 57/57 pages declare `"use client"`, so every page-level image is shipped to JS bundles. Arch H1 + Perf overlapping finding.

**Fix:** Two sub-decisions:
1. **Short-term:** Re-encode the 100 atom JPEGs to ≤400 KB / max-1600px masters, swap `<img>` → `next/image` everywhere, whitelist `/brand/**` in `next.config.ts:images`. This alone resolves Perf C2.
2. **Medium-term:** Decide the page-rendering posture (stay CSR vs migrate read-only public surfaces to RSC). Write a one-page ADR either way to prevent drift. Arch H1.

### Cluster F — Router decomposition

**Symptom:** Three god-files:
- `host.router.ts` — 1124 lines, 25 procedures, 5 distinct domains (profile / bookings / earnings / availability / saved-hosts / heatmap) — Maint C1, Arch H9
- `chat.router.ts` — 1157 lines, with 4 sequential `findFirst` calls per message edit/delete/report/react — Maint C1, Perf M4
- `user.router.ts` — 663 lines, 18 procedures — Maint, Arch M11
- `host/earnings/page.tsx` — 1088 lines — Maint C3

**Fix:** Decompose by domain. Mechanical refactor; tests already split along the natural lines. Best done as one careful PR per router so blame history stays useful.

---

## Phased roadmap

### Week 1 (this week) — critical safety net

Do these in this order. Each is small.

1. Critical #5 — remove `if: false` on Playwright CI. **5 min.**
2. Critical #1 — `match.unmatch` participant check. **20 min.**
3. Critical #4 — schema FK drift PR (4 ALTERs + matching `schema.ts` synced). **2-3 hours.**
4. Critical #2 — auth rate limits (wrap login/register/refresh in `rateLimit` helper). **3-4 hours.**
5. Critical #3 — payment soft-FK + anonymise on `deleteAccount`. **2-3 hours.**
6. Critical #9 — un-quarantine or finish-retire `_legacy/tour-engine.ts`. **30 min - 1 hour.**
7. Cluster D — schema drift CI script + GitHub Action. **3-4 hours.**

**Outcome:** No more silent schema drift; auth surface is no longer DoS-able; financial audit trail is preserved on deletion; the IDOR is closed; CI actually runs E2E.

### Week 2-4 — high-impact cleanup

8. Critical #6 — crossover discovery N+1 batching.
9. Critical #7 — image pipeline (re-encode JPEGs, `next/image` swap).
10. Critical #8 — OAuth + refreshToken tests.
11. Critical #10 — PII DTO on `match.getCandidates` + `protectedOwnedProcedure` helper.
12. Cluster A — JSONB Zod parsers at boundaries (the highest-leverage single refactor).
13. Cluster C — refresh tokens to httpOnly + sessions table; auth in middleware.
14. Cluster B — crossover transactions + uniques + wired crons.

### Month 2-3 — structural cleanup

15. Cluster F — split `host.router`, `user.router`, `chat.router`. Decompose `host/earnings/page.tsx`.
16. Cluster E — RSC posture ADR + migrate read-only public surfaces.
17. Test coverage backfill: 5 empty routers (`match`, `merch`, `place`, `review`, `customizedTourTemplate`) + 9 `tour.router` procedures + chat pub/sub.
18. Missing indexes (Perf C5, M14, H10): JSONB expression indexes, `idx_tour_stops_place`, `idx_payments_user`, `idx_payments_paid_at`.
19. Move `lib/topup-activity-slots.ts` + `lib/backfill-fixed-tour-atoms.ts` into `src/server/services/`.
20. Remove `lib/nav.ts` → `components/brand` import (lib must not depend on components).

### Backlog — Q3+

21. M-tier findings per lens (~60 items total).
22. Centralised logger + Sentry hook.
23. CSP / security headers in `next.config.ts`.
24. RSC migration if Cluster E decided to go that way.
25. Visual-regression / screenshot tests for the Vietnamese-first design.

---

## What's surprisingly good (don't break these)

- **Real-DB testing.** PGlite is correct. No mocked Drizzle anywhere. Real CHECK + FK + UNIQUE behaviour catches bugs in CI (e.g. `payment.confirm` int4 overflow rollback test). Keep doing this.
- **Negative-path test coverage.** Where tests exist, they're behavior-level (specific values, FK shape, error codes) — not snapshot-only or `.toBeTruthy()`. Stay disciplined.
- **Type hygiene.** Zero `@ts-ignore`, zero `TODO`/`FIXME`, minimal non-null assertions. Tighter `tsconfig` flags (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) would lock this in.
- **Payment safety.** Server-authoritative price computation, atomic coupon redemption, idempotency keys. Don't loosen.
- **Booking concurrency.** Real optimistic-locking tests exist (`booking-concurrency.test.ts`). Apply the same pattern to crossover.
- **Strict-mono i18n.** Just landed. The `locomate-tester-fix` skill codifies the conventions.
- **next-intl integration.** Locale routing, message bundles, brand-voice exceptions all clean.
- **No god modules in `lib/`.** Top fan-in files (`format.ts`, `utils.ts`, `i18n/navigation.ts`, `stores/auth.ts`, `lib/trpc.ts`) are pure, thin, one-concern.
- **`messages/README.md`** documents the brand-voice exception list.
- **Idempotent migrations** with `IF NOT EXISTS` everywhere.
- **Real services layer.** `purgeStaleMessages`, `reapStaleOrders`, `applyContactInfoMask`, `crossover-cron`, `llm`, `wrap-up-coupon`, `thank-you-letter` are proper services with multiple call sites or non-trivial logic.

---

## Top 7 recommendations (impact ÷ effort)

In strict priority order:

1. **Schema drift CI** (Cluster D). One-time setup, prevents the entire class of incident. Highest impact per hour.
2. **JSONB Zod parsers at boundaries** (Cluster A). Single biggest type-safety improvement; removes ~30 duplicated cast lines; downstream code becomes easier to refactor.
3. **Re-enable Playwright in CI + add cart/payment/chat e2e** (Critical #5, Test C7). E2E coverage going from ~zero to material in days.
4. **Rate limiting on auth + protectedOwnedProcedure helper** (Critical #2, Cluster C). Closes two systemic security gaps.
5. **Image pipeline** (Critical #7). Mobile data drain is real; 5-15× LCP improvement on 3G.
6. **Crossover discovery N+1 batching** (Critical #6). Removes the load-killer before it hits prod traffic.
7. **Split host.router.ts into 5 routers** (Cluster F, Critical #10). Mechanical refactor, tests already split along these lines, massive readability gain.

---

## Lens reports (detail)

Each lens produced ~250 lines with file:line citations, fix sketches, and effort estimates. They're archived in the agent-transcripts directory:

- **Security** — 2 Critical, 5 High, 10 Medium, 7 Low. Cross-cutting: ad-hoc resolver-body authorization (no `protectedOwnedProcedure`), inconsistent URL validation, rate-limiting only on chat.
- **Data integrity** — 4 Critical, 9 High, 11 Medium, 7 Low. Cross-cutting: schema drift, missing transactions on multi-write ops, JSONB un-typed at write time, status-enum CHECKs only in DDL not schema.ts.
- **Architecture** — 0 Critical, 9 High, 17 Medium, 6 Low. Cross-cutting: all-`"use client"`, two `lib/*` files importing `server/db/schema`, six empty taxonomy directories, no centralised logger.
- **Performance** — 6 Critical, 12 High, 15 Medium, 8 Low. Cross-cutting: N+1 by `findFirst`-in-a-loop, unbounded selects on customer surfaces, JSONB filters without expression indexes, raw `<img>` for marketing imagery.
- **Maintainability** — 4 Critical, 6 High, ~15 Medium. Cross-cutting: type hygiene actually good; structural debt clusters in three 1000+-line files; "Top Match" card pattern duplicated 3×; shadow `EmptyState` reintroduced in earnings.
- **Test coverage** — 7 Critical, 13 High, 15 Medium, 6 Low. Cross-cutting: 5 routers completely untested, 9/10 `tour.router` procedures untested, Playwright dark in CI, `expect(...).toBeDefined()` brittleness starting to spread.

Total findings across all six: **~140**, of which **~25 Critical**, **~55 High**, **~50 Medium**, **~10 Low**. Many are cross-listed — the synthesis above is what to act on.

---

## What this audit did NOT cover

- Lighthouse / Core Web Vitals on production
- Drizzle query-plan inspection (no DB connection available; `EXPLAIN ANALYZE` runs are the natural next step)
- Bundle analyzer output (would need `next build --profile` + `@next/bundle-analyzer`)
- Cold-start measurement for Vercel functions
- Production observability (Sentry signals, log assertions)
- Load testing of cron sweeps under realistic fleet sizes
- The `tests/e2e/` Playwright specs themselves (test surface coverage only; not their assertion quality)
- Visual / design fidelity vs Figma — separate from code audit
- Localization correctness of recent translations (just landed; covered by tester reports)
- The `c:\Dev\locomate\.cursor\skills\locomate-tester-fix\SKILL.md` skill file (workspace-level, outside the repo)
- Vendor lock-in posture (Vercel, Neon, Upstash, Vercel Blob) — strategic concern, not code-level
