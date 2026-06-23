# Locomate Technical TODO - 2026-06-23

Scope: `C:\Dev\locomate\app`

This is a current technical audit TODO, separate from the older historical tracker in `docs/TODO.md` and the May audit in `docs/CODEBASE_AUDIT_2026-05-29.md`.

## Verification Snapshot

- `pnpm lint`: passes with 0 errors and 48 warnings.
- `pnpm typecheck`: passes.
- `pnpm test`: passes, 47 test files / 541 tests.
- `pnpm test:coverage`: passes, scoped coverage at 73.15% lines overall for included files; `src/server/routers/tour.router.ts` is still the weakest included file at 13.82% lines.
- `pnpm build`: passes on Next 16.2.9, but Next still warns that the `middleware` file convention is deprecated and should move to `proxy`.
- `pnpm audit --prod`: passes with no known vulnerabilities.
- `pnpm db:check`: blocked locally because no Postgres server is listening on `localhost:5432`; CI or a local Postgres service should still run it.

## P0 - Fix Before Public Launch

- [x] **TECH-01: Clear production dependency advisories.**
  - Completed 2026-06-23: upgraded `next`, `react`, `react-dom`, `eslint-config-next`, and `@vercel/blob`; moved `shadcn` to `devDependencies`; added targeted pnpm overrides for patched `@babel/core`, `postcss`, `undici`, and `ws`; refreshed `pnpm-lock.yaml`.
  - Original evidence: `pnpm audit --prod` reported 50 production advisories. The direct `next@16.2.2` dependency was below patched ranges for multiple high-severity Next advisories. `shadcn` was in `dependencies`, so its CLI/transitive `@modelcontextprotocol/sdk` stack was pulled into the production audit path.
  - Proposed work:
    - Upgrade `next` and `eslint-config-next` together to the latest compatible 16.2.x patch release.
    - Move `shadcn` from `dependencies` to `devDependencies`, or remove it from the installed runtime dependency graph if the CLI is only used manually.
    - Refresh the lockfile and re-run `pnpm audit --prod`.
  - Acceptance checks:
    - `pnpm audit --prod` has no high-severity production advisories.
    - `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` still pass.

- [x] **TECH-02: Preserve financial audit records when a traveler deletes their account.**
  - Completed 2026-06-23: changed `payments.tourId` to `ON DELETE SET NULL`, added migration/DDL coverage, updated setup scripts, and added a delete-account regression test proving a paid tour-linked payment survives with `userId` and `tourId` nulled.
  - Original evidence: `src/server/routers/user.router.ts` nulled `payments.userId`, but `src/server/db/schema.ts` still had `tours.userId` as `ON DELETE CASCADE` and `payments.tourId` as `ON DELETE CASCADE`. Deleting a traveler could delete their tour-linked payment rows through the tour cascade.
  - Proposed work:
    - Change the financial-retention model so payment rows survive user deletion.
    - Prefer `payments.tourId ON DELETE SET NULL` and explicit anonymization fields for user/tour identity, or make historical `tours.userId` nullable with `ON DELETE SET NULL`.
    - Add a migration and update `scripts/apply-all-ddl.ts` so schema drift CI covers the change.
    - Add a `user.deleteAccount` regression test that creates a paid tour-linked payment, deletes the user, and asserts the payment row remains with no PII-bearing user link.
  - Acceptance checks:
    - Account deletion still erases user PII.
    - Tour-linked and order-linked payment rows survive deletion.
    - `pnpm db:check`, `pnpm test`, and `pnpm test:coverage` pass in CI.

- [x] **TECH-03: Replace mock checkout with a real payment provider path.**
  - Completed 2026-06-23: added a Stripe-backed payment provider abstraction, provider-created PaymentIntent client secrets for tour and order checkout, provider-status verification before fulfillment, a Stripe webhook route, shared idempotent fulfillment logic, and mocked-provider tests for success, unpaid, failed, and replay paths.
  - Original evidence: `src/server/routers/payment.router.ts` returned `pi_test_${payment.id.slice(0, 8)}_secret`, wrote `paymentGateway: "stripe_test"`, and confirmed payments by setting `gatewayTxnId: txn_test_*`. `src/server/routers/order.router.ts` did the same for cart/order checkout. `stripe` was installed but not imported by the payment routers.
  - Proposed work:
    - Implement real Stripe Payment Intent creation for card payments.
    - Add webhook-backed confirmation and idempotency for both tour payments and order payments.
    - Decide whether VND QR flows use Stripe, VNPay, MoMo, or a separate provider abstraction.
    - Keep the existing server-authoritative pricing and inventory transaction patterns.
  - Acceptance checks:
    - Checkout no longer has a server route that can mark an unpaid payment as `succeeded`.
    - Webhook replay is idempotent.
    - Existing payment/order tests are extended with provider-mocked success, failure, and replay cases.

## P1 - Stability, Security, And Mobile Performance

- [ ] **TECH-04: Upgrade `middleware.ts` to Next 16 `proxy` convention.**
  - Evidence: `pnpm build` passes but emits: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
  - Proposed work:
    - Read the local Next 16 docs under `node_modules/next/dist/docs/` before editing.
    - Rename/adapt `src/middleware.ts` to the required proxy convention while preserving locale negotiation and auth gating.
    - Keep the existing `src/middleware.test.ts` behavior tests and add a regression case for protected localized paths.
  - Acceptance checks:
    - `pnpm build` has no middleware/proxy deprecation warning.
    - Protected routes still redirect unauthenticated users to localized login URLs.

- [ ] **TECH-05: Add baseline security headers.**
  - Evidence: `next.config.ts` configures image remote patterns only. No `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or `X-Content-Type-Options` headers are configured.
  - Proposed work:
    - Add a conservative `headers()` config in `next.config.ts`.
    - Start with report-only CSP if inline scripts/styles from Next/Tailwind make enforcement noisy.
    - Include separate handling for image domains already present in `images.remotePatterns`.
  - Acceptance checks:
    - `pnpm build` passes.
    - A smoke request to `/` returns the configured headers.
    - OAuth and Vercel Blob upload flows still work.

- [ ] **TECH-06: Optimize the image pipeline.**
  - Evidence: `public/brand` contains 130 jpg/png files totaling about 251 MB. Several activity images are about 2.7-3.1 MB each. `pnpm lint` reports many `@next/next/no-img-element` warnings, and `rg "<img"` finds raw `<img>` usage across public, home, cart, activities, shop, host, and chat surfaces.
  - Proposed work:
    - Re-encode local brand images to responsive web assets. Target a practical max size per rendered image, not full-resolution masters in `public`.
    - Replace high-traffic raw `<img>` instances with `next/image`, starting with `home`, `activities`, `experiences`, `explore`, `shop`, and `cart`.
    - Add width/height or `fill` plus `sizes` so mobile thumbnails do not pull full-size assets.
  - Acceptance checks:
    - `pnpm lint` no longer emits `no-img-element` warnings for high-traffic pages.
    - Largest local rendered assets are materially smaller.
    - `pnpm build` still passes.

- [ ] **TECH-07: Decide and improve the RSC/client rendering posture.**
  - Evidence: all 56 `src/app/**/page.tsx` files start with `"use client"`, including read-heavy public pages. This blocks server component benefits and increases client JS pressure.
  - Proposed work:
    - Write a short ADR: stay fully client-rendered intentionally, or migrate read-only pages to server components.
    - If migrating, begin with public catalogue/detail pages that mostly render query data and images.
    - Keep interactive widgets as nested client components instead of making the full page client-only.
  - Acceptance checks:
    - At least one public read-heavy route ships as a server component with isolated client islands.
    - Build and existing page tests pass.

- [ ] **TECH-08: Harden Playwright from soft signal to release gate.**
  - Evidence: `.github/workflows/ci.yml` now runs Playwright, but `continue-on-error: true` means E2E failures do not block merges.
  - Proposed work:
    - Stabilize the three existing specs under `tests/e2e`.
    - Keep trace/video artifact upload.
    - Flip `continue-on-error` to `false` once the specs are stable.
  - Acceptance checks:
    - CI fails on a broken booking or host flow.
    - Playwright report artifacts remain available on failure.

- [ ] **TECH-09: Finish or explicitly park Crossover Matching product integration.**
  - Evidence: `src/server/routers/crossover.router.ts` is mounted and `/api/cron/crossover-sweeps` exists, but `rg "trpc.crossover"` finds no app/UI consumers. No crossover SSE event types are emitted. `vercel.json` schedules the consolidated sweep once daily (`0 1 * * *`), while docs still describe 15-minute `crossover-t48/t36/t28/t24` endpoints.
  - Proposed work:
    - Pick one path: dark-launch intentionally with docs updated, or ship the UI surfaces.
    - If shipping, add the T-48 warning/migration CTA, discovery feed, proposal hub, escrow UI, and chat/SSE event types.
    - Align cron cadence with the actual business requirement. If 15-minute cadence is required, use Vercel Pro cron or an external scheduler.
  - Acceptance checks:
    - Docs, `vercel.json`, route comments, and UI behavior agree.
    - There is at least one user-facing consumer for each enabled crossover backend path.
    - Cron behavior is covered beyond the auth-gate tests.

- [ ] **TECH-10: Add rate limiting to OAuth route handlers.**
  - Evidence: tRPC auth procedures use `rateLimit`, but `src/app/api/auth/google/route.ts` and `src/app/api/auth/google/callback/route.ts` are plain route handlers with no rate-limit call.
  - Proposed work:
    - Reuse the existing `rateLimit` helper with an IP key for OAuth start and callback routes.
    - Preserve state/PKCE validation and safe `returnTo` handling.
  - Acceptance checks:
    - Excess OAuth start/callback attempts return a controlled 429 or safe redirect.
    - Existing OAuth setup flow remains unchanged for normal users.

## P2 - Maintainability And Product Readiness

- [ ] **TECH-11: Expand coverage where the current scoped report is weakest.**
  - Evidence: `pnpm test:coverage` includes `tour.router.ts`, but it has only 13.82% line coverage and 4.76% function coverage. The overall report is scoped to selected files rather than the full app.
  - Proposed work:
    - Add integration tests for the live `tour.router.ts` procedures that still matter after the product pivot.
    - Retire or move truly legacy procedures so coverage is not chasing dead paths.
    - Gradually add threshold entries for routers that are currently critical to revenue.
  - Acceptance checks:
    - `tour.router.ts` has meaningful coverage for start/complete/review/host flows that remain live.
    - Coverage thresholds ratchet upward without blocking unrelated work.

- [ ] **TECH-12: Decompose the largest routers and pages.**
  - Evidence: current line counts: `chat.router.ts` 1062 lines, `host.router.ts` 1047 lines, `crossover.router.ts` 1001 lines, `host/earnings/page.tsx` 1024 lines, `chat/[matchId]/page.tsx` 757 lines.
  - Proposed work:
    - Split by product domain, not technical layer. For example, host profile/availability, host earnings, host routes, and saved-hosts can become separate routers.
    - Keep existing tests green while moving procedures.
    - Move large page sections into focused components only where it reduces cognitive load.
  - Acceptance checks:
    - No single active router remains over roughly 700 lines without an explicit reason.
    - Procedure names and tRPC client calls remain stable or are migrated in one PR.

- [ ] **TECH-13: Convert settings/security stubs into persisted features or honest disabled states.**
  - Evidence: `settings/page.tsx` has local-only `pushNotifs`, `emailDigest`, and `locationSharing` state; change password and data usage rows toast "coming soon"; ToS/Privacy/Licenses rows toast "coming soon"; version is hardcoded to `1.0.0`. `security/page.tsx` has local-only `twoFA` that toasts success without enabling a backend factor.
  - Proposed work:
    - Persist notification/privacy preferences through a user preferences mutation and schema column/table.
    - Implement password change for password accounts.
    - Replace cosmetic 2FA with a real TOTP/WebAuthn flow, or render it disabled with honest copy.
    - Add real legal/license pages and pipe the app version from package/build metadata.
  - Acceptance checks:
    - No security setting claims success unless server state changed.
    - Preferences survive refresh.
    - Legal/document rows navigate to real pages.

- [ ] **TECH-14: Add PWA/mobile install basics.**
  - Evidence: no `public/manifest.json`, no service worker, and no manifest link were found. The product is mobile-first, so install metadata and icons matter even before offline support.
  - Proposed work:
    - Add a web app manifest using the existing brand icons.
    - Add `theme-color`, Apple touch icon metadata, and install-safe names.
    - Decide whether offline caching is in scope now or later.
  - Acceptance checks:
    - Mobile browsers can identify Locomate as installable.
    - Metadata works for both `en` and `vi` routes.

- [ ] **TECH-15: Tighten TypeScript compiler options incrementally.**
  - Evidence: `tsconfig.json` has `strict: true`, but also `allowJs: true` and `skipLibCheck: true`; it does not enable stricter options such as `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`.
  - Proposed work:
    - Turn off `allowJs` if there are no JS source files that need compilation.
    - Trial `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in a branch.
    - Keep `skipLibCheck` only if dependency type noise makes it necessary after dependency patches.
  - Acceptance checks:
    - Stricter flags are either enabled or documented with concrete blockers.
    - `pnpm typecheck` remains green.

- [ ] **TECH-16: Refresh docs that now conflict with code.**
  - Evidence:
    - `README.md` and `docs/TRD.md` still say Next.js 15, while `package.json` uses Next 16.2.2.
    - `docs/BOOKING.md` and `docs/TRD.md` describe four `/api/cron/crossover-t*` endpoints and 15-minute cadence, while code has one `/api/cron/crossover-sweeps` route scheduled daily.
    - `docs/TODO.md` still says Playwright has `if: false`, but CI now runs it as a non-blocking job.
  - Proposed work:
    - Update framework/version docs after TECH-01 and TECH-04 land.
    - Rewrite the crossover cron docs to match the chosen implementation.
    - Mark stale historical TODO entries as superseded by this file or update their status.
  - Acceptance checks:
    - Setup docs match `package.json`, `vercel.json`, and current CI.
    - New contributors do not get sent toward removed cron routes or obsolete CI assumptions.

## Good Technical Assets To Preserve

- Real DB integration tests with PGlite are working well.
- Auth has moved toward httpOnly access/refresh cookies with rotating sessions.
- `protectedOwnedProcedure` closes the reusable IDOR pattern and is already used by `match.unmatch`.
- Schema drift CI exists via `pnpm db:check`.
- JSONB profile/tour shape readers exist in `src/server/lib/*-shape.ts`; continue moving remaining casts behind typed boundaries.
- Server-authoritative pricing and atomic inventory updates are the right shape; keep those invariants while replacing mock payments.
