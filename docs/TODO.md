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

- [ ] **CLEAN-01: Remove unused npm packages** -- `socket.io`, `socket.io-client` (no WebSocket features exist), `@hookform/resolvers` (never imported), `@neondatabase/serverless` (DB uses `postgres.js` driver, not Neon serverless). Run `pnpm remove socket.io socket.io-client @hookform/resolvers @neondatabase/serverless`.

- [ ] **CLEAN-02: Update "match" wording in UI** -- Several pages still use "match" language from the dropped LocoMatch feature:
  - `src/app/(main)/profile/page.tsx` -- "Local Match %" label
  - `src/app/(auth)/onboarding/page.tsx` -- "Slide to match your vibe"
  - `src/app/(auth)/host-setup/page.tsx` -- "Help us match you with the right travelers"
  - `src/app/(main)/tour/[id]/hosts/page.tsx` -- "matched to your style", "Great overall match"
  - Replace with "fit", "compatibility", or "personalization" language.

- [ ] **CLEAN-03: Reports table unused** -- `reports` table defined in `src/server/db/schema.ts` has no API router. Either build a report router or remove the table if not needed for MVP.

---

## CONFIGURATION (infrastructure)

- [ ] **CONFIG-01: No PWA manifest** -- No `manifest.json` or service worker configured. Needed for mobile "Add to Home Screen" and offline splash. Create `public/manifest.json` with app name, icons, theme color, and add `<link rel="manifest">` to root layout.

- [ ] **CONFIG-02: Missing image remote patterns** -- `next.config.ts` only allows `images.unsplash.com` and `randomuser.me` in `remotePatterns`. Missing domains used by pipeline-fetched photos:
  - `images.pexels.com`
  - `upload.wikimedia.org`
  - `lh3.googleusercontent.com` (Stitch-generated images)

- [ ] **CONFIG-03: Stripe SDK not wired** -- `stripe` package is installed but `payment.router.ts` uses hardcoded test values, not the Stripe SDK. Either wire up real Stripe integration or remove the package to reduce bundle size.

---

## FUTURE FEATURES (Phase 2 roadmap)

- [ ] **FEAT-01: Experience booking backend** -- "Book Now" button currently shows a toast placeholder. Build `experienceBookings` table + `experience.book` mutation + payment integration.

- [ ] **FEAT-02: GoHub eSIM API integration** -- Currently affiliate links only. Contact partnership@gohub.com for API credentials. Build `esim.router.ts` with `getPlans`, `createOrder`, `getOrderStatus` for in-app purchase.

- [ ] **FEAT-03: Real Google/Apple OAuth** -- Login/register have branded OAuth buttons but route through demo login. Configure NextAuth or Auth.js with real provider credentials.

- [ ] **FEAT-04: Push notifications** -- No PWA service worker or FCM setup. Needed for tour reminders, host messages, booking confirmations.

- [ ] **FEAT-05: Vietnamese language (i18n)** -- All strings are hardcoded English. Extract to i18n keys for `vi` locale support.

- [ ] **FEAT-06: Tour editing** -- Users can't swap/reorder stops after tour generation. Add `tour.editStops` mutation with re-optimization.

- [ ] **FEAT-07: Custom domain** -- Move from `loco-mate.vercel.app` to `locomate.app` or `locomate.vn` for brand credibility.

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
