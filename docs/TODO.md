# LOCOMATE -- TODO & Improvement Tracker

**Audit Date:** April 14, 2026
**Live URL:** https://loco-mate.vercel.app
**Repo:** https://github.com/mrtmdpro/LocoMate

---

## SECURITY (fix before public launch)

- [x] **SEC-01: Payment ownership + status check** -- FIXED. `payment.confirm` now verifies `userId` ownership and `status === 'pending'`. `createIntent` also verifies tour ownership. Uses optimistic locking to prevent race conditions.

- [x] **SEC-02: Chat authorization** -- FIXED. Added `verifyMatchParticipant()` to `getMessages`, `sendMessage`, `markRead`. Checks user is a participant AND match status is 'matched'. Also fixed `getConversations` to not leak `passwordHash` (now selects only id/displayName/avatarUrl/role).

- [x] **SEC-03: Tour lifecycle ownership + status gates** -- FIXED. `startTour` requires ownership + status 'paid'. `completeTour` requires ownership + status 'active'. `markStopVisited` loads stop, then verifies parent tour ownership. Prevents bypassing payment flow.

---

## CODE QUALITY (should fix)

- [x] **CODE-01: Incorrect feed total** -- FIXED. `place.getFeed` now runs a separate `SELECT count(*)` with the same WHERE conditions and returns the real total.

- [x] **CODE-02: Nearby radius not applied** -- FIXED. `place.nearby` now filters with `WHERE distance <= radiusKm` using parameterized Haversine expression.

- [x] **CODE-03: Unused import** -- FIXED. Removed unused `AnimatePresence` from onboarding page.

- [x] **CODE-04: Seed doesn't handle experiences** -- FIXED. Added `savedPlaces` and `experiences` to clear block (respecting FK order). Added 6 curated experience inserts at end of seed.

---

## CLEANUP (nice to have)

- [x] **CLEAN-01: Remove unused npm packages** -- FIXED. Removed socket.io, socket.io-client, @hookform/resolvers, @neondatabase/serverless (-18 packages).

- [x] **CLEAN-02: Update "match" wording in UI** -- FIXED. All user-facing "match" strings replaced with "fit"/"connect"/"tailored" across profile, onboarding, host-setup, and tour hosts pages.

- [ ] **CLEAN-03: Reports table unused** -- `reports` table defined in `src/server/db/schema.ts` has no API router. Either build a report router or remove the table if not needed for MVP.

---

## CONFIGURATION (infrastructure)

- [ ] **CONFIG-01: No PWA manifest** -- No `manifest.json` or service worker configured. Needed for mobile "Add to Home Screen" and offline splash. Create `public/manifest.json` with app name, icons, theme color, and add `<link rel="manifest">` to root layout.

- [x] **CONFIG-02: Missing image remote patterns** -- FIXED. Added `images.pexels.com`, `upload.wikimedia.org`, `lh3.googleusercontent.com` to next.config.ts remotePatterns.

- [ ] **CONFIG-03: Stripe SDK not wired** -- `stripe` package is installed but `payment.router.ts` uses hardcoded test values, not the Stripe SDK. Either wire up real Stripe integration or remove the package to reduce bundle size.

---

## CRITICAL FOR REVENUE (must do before launch)

- [ ] **BIZ-01: Wire real payments** -- Stripe SDK installed but not connected. Configure live keys or VNPay/MoMo. Without this, revenue is zero.

- [ ] **BIZ-02: Experience booking backend** -- "Book Now" shows a toast. Build `experienceBookings` table + `experience.book` mutation + payment flow + host notification.

- [ ] **BIZ-03: Fix or remove fake OAuth** -- "Continue with Google/Apple" silently logs in as demo user. Actively misleading. Either implement real OAuth or remove buttons.

- [ ] **BIZ-04: Remove unverifiable claims** -- "Trusted by 5,000+ solo travelers" has no evidence. Replace with verifiable metrics.

- [ ] **BIZ-05: Real host operations** -- Dynamic host dashboard (not mock data), verification workflow, payout system, booking confirmations.

- [ ] **BIZ-06: Analytics pipeline** -- No conversion tracking. Add Vercel Analytics or PostHog to measure funnel and prove KPIs.

---

## FUTURE FEATURES (Phase 2 roadmap)

- [ ] **FEAT-01: GoHub eSIM API integration** -- Currently affiliate links only. Contact partnership@gohub.com for API credentials.

- [ ] **FEAT-02: Push notifications** -- No PWA service worker or FCM setup. Needed for tour reminders and booking confirmations.

- [ ] **FEAT-03: Vietnamese language (i18n)** -- All strings are hardcoded English. Required for host adoption and local partnerships.

- [ ] **FEAT-04: Tour editing** -- Users can't swap/reorder stops after generation. Add `tour.editStops` mutation.

- [ ] **FEAT-05: Custom domain** -- Move from `loco-mate.vercel.app` to `locomate.app` or `locomate.vn`.

- [ ] **FEAT-06: PWA setup** -- manifest.json, service worker, offline splash, Add to Home Screen.

---

## COMPLETED (for reference)

- [x] Slug-based place URLs with Vietnamese diacritic support
- [x] Brand identity system (SVG logo, favicon, brand sheet)
- [x] 996 real Hanoi places via OSM pipeline
- [x] Interactive Leaflet map view in Explore
- [x] Persistent saved places with toggle button
- [x] Dynamic profile stats (saved places + tour count verified against DB)
- [x] All 8 priority screens aligned with Stitch designs (P0-P2)
- [x] Premium Experiences system (6 curated Hanoi experiences)
- [x] eSIM affiliate page (GoHub Vietnam plans)
- [x] Pivot: Dropped LocoMatch, replaced with Experiences tab
- [x] Post-tour review flow
- [x] Tiered membership badge
- [x] Editable emergency contacts
- [x] Welcome page redesign
- [x] Security settings + Payment history pages
- [x] Chat inbox with status badges
- [x] Tour builder with hero banner + time-of-day pills
