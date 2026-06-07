# LOCOMATE -- TODO & Improvement Tracker

**Audit Date:** May 27, 2026 (verification sweep against actual codebase state)
**Last gate check:** April 7, 2026 (hardcoded/stub UI sweep after OAuth + Account Deletion landed)
**Last release:** April 7, 2026 -- role-aware navigation + expanded host home
**Latest release:** April 7, 2026 -- host operator console (cashflow + routes + 9 seeded experiences)
**NEW FEATURE (May 2026):** Fixed Tour Capacity Rescue & Crossover Matching -- T-48h/-36h/-28h/-24h pre-departure lifecycle, anonymous discovery, Smart Proposal Hub, Escrow Δ-payment, Priority Matching Voucher. See `CROSS-01..CROSS-15` below + PRD §5.11 + TRD §3 (Crossover Matching tables) + BOOKING.md (Pre-departure timeline). Source: `docs/fixed-tour-feature.md`.
**MAJOR PIVOT (May 2026):** Fixed Tour Matrix (15 tours / 3 chapters) + 4-D personality vector becomes the headline; PRD/TRD/REVIEW rewritten. See `docs/PRD.md` v2.0 + `docs/REVIEW_AND_BUSINESS_PLAN.md` v2.0.
**MAJOR PIVOT (Apr 2026):** Fixed Tours + Flexible Activities + Merch + eSIM bundles (FOLLOW-18)
**Live URL:** https://loco-mate.vercel.app
**Repo:** https://github.com/mrtmdpro/LocoMate

> **NOTE on file references:** Page paths are now under `src/app/[locale]/(main)/…` (i18n routing). The older `src/app/(main)/…` references below survive for historical context but the line numbers are stale. The verification notes below cite the **current** location when needed.

---

## 27 May 2026 AUDIT SUMMARY

Methodology: a per-item search of the actual codebase against every
checked-and-unchecked claim in this tracker. Items that searched
positive get a `✅ RESOLVED (verified 27 May 2026)` line; partials get
`*(Verified 27 May 2026: …)*` flagging exactly what's still missing.

### Items the tracker said were open, but actually shipped

| Item | Old status | New status | What landed |
|---|---|---|---|
| UI-03 | open | ✅ resolved | Voice-call chip removed from chat header |
| UI-07 | open | ✅ resolved | Hardcoded green dots / "Active now" replaced with real `streamConnected` indicator |
| UI-08 | open | ✅ resolved | `STATUS_BADGES` rotation removed |
| UI-19 | open | ✅ resolved | Home rewritten around Fixed Tour + Activities + Merch + eSIM carousels |
| UI-20 | open | ✅ resolved | Literal `$5.90` gone; eSIM banner reads from i18n |
| BIZ-04 | open | ✅ resolved | "5,000+ solo travelers" claim no longer in `app/src/` |
| FEAT-03 | open | ✅ resolved | Full `next-intl` setup (en.json + vi.json, `[locale]` routing, `useTranslations` everywhere) |
| MAY-01 | open | ✅ resolved | Theme toggle ships with "Nắng Sớm Tràng An" / "Đêm Sâu Phố Cổ" labels |
| MAY-02 | open | ✅ resolved | Nickname collected in onboarding + editable in settings; `useDisplayName()` hook reads it app-wide |
| MAY-11 | open | ✅ resolved | `thank_you_letters` table + schedule/render services + daily cron at `/api/cron/send-thank-you` + `/letters` UI |
| MAY-16 | open | ✅ resolved | Duplicate of BIZ-04; closed by the same sweep |
| MAY-17 | open | ✅ resolved | 5-axis → 4-axis projection documented inline in `quiz-questions.ts:187-199` |
| CROSS-01 | open | ✅ done | Migration script written |
| CROSS-02 | open | ✅ done | Drizzle schema for 5 tables |
| CROSS-03 | open | ✅ done | `crossover.router.ts` mounted at `crossover:` in `_app.ts` |
| CROSS-04 | open | ✅ done | PII-stripped Zod DTO with `.strict()` |
| CROSS-06 | open | ✅ done | `lockItinerary` + `confirmEscrowDelta` + `refundPartial` |
| CROSS-07 | open | ✅ done | Voucher decrement-on-feed-render in transaction |
| CROSS-14 | open | ✅ done | 35 integration tests (vs target 25+) |
| CROSS-15 | open | ✅ done | Build-blocking PII contract test |

### Items where the tracker was inaccurate or out of date

| Item | Old claim | Verification |
|---|---|---|
| MAY-04 | "Add chips on `/plan`" | `/plan` is now a redirect-to-`/activities`. The legacy AI tour builder was retired in the Apr pivot. Re-scope this item to a new surface (e.g. `/plan/build` could grow into the custom-tour wizard) or close as obsolete. |
| MAY-05 | "Surface on `/plan`" | `<ProximitySuggest>` ships on `(public)/explore/[id]`. Either rename the item or expand it to also mount on `(main)/activities/[slug]` + `(main)/fixed-tours/[id]`. |
| FEAT-03 line refs | "All strings are hardcoded English" | False as of audit — i18n is wired end-to-end. |

### Big things the tracker doesn't mention but exist in code

These should probably get TODO entries so the team knows they're in
flight (status: shipped or partial):

1. **LLM gateway** (`app/src/server/services/llm.ts`) — single access
   point for chatbot quiz / dynamic re-routing / wrap-up / thank-you
   letter. Mock-mode is the default (`LLM_MOCK_MODE`); Phase C flips
   to real DeepSeek via `DEEPSEEK_API_KEY`. Includes prompts file,
   types file, deterministic mocks per `(feature, tone, sha1(prompt))`,
   and a test file.
2. **Crossover Matching backend** — backend complete (schema + router
   + cron sweeps + tests + PII contract) but **no UI consumer**.
   Tracked as CROSS-08/09/10/11/12/13 + the new
   CROSS-FOLLOW-01/02 below.
3. **Customized Tour Templates** (`customizedTourTemplates` table,
   schema.ts:375) — not mentioned in the tracker. Drives a templated
   seed cart for the activity detail page.
4. **Saved hosts** (`savedHosts` table, schema.ts:91) — bookmark-a-host
   feature.
5. **Active-tour incident sheet** (`components/brand/incident-sheet.tsx`
   + `tour.proposeAlternatives`) — partially closes MAY-09 (Dynamic
   Re-routing), see updated notes there.
6. **Wrap-up page** (`(main)/tour/[id]/wrap-up/page.tsx`) — partially
   closes MAY-12, see updated notes there.

### Items still actual (no change)

- **Infrastructure / config:** CLEAN-03, CONFIG-01, CONFIG-03, FEAT-01, FEAT-02, FEAT-04, FEAT-05, FEAT-06.
- **Revenue blockers:** BIZ-01 (the big one), BIZ-05 (payout + email gaps remaining), BIZ-06 (analytics).
- **UI stubs:** UI-02, UI-05, UI-10, UI-15, UI-16, UI-17, UI-21, UI-22. (UI-11 downgraded but still UI debt.)
- **May follow-ups not yet shipped:** MAY-03, MAY-06, MAY-07, MAY-08, MAY-13, MAY-15.
- **Partial / re-scope needed:** MAY-04, MAY-05, MAY-09, MAY-12, MAY-14.
- **Crossover UI / observability:** CROSS-08, CROSS-09, CROSS-10, CROSS-11, CROSS-12, CROSS-13, plus the two new CROSS-FOLLOW items. (CROSS-05 cron wiring is closed.)
- **Follow-ups:** FOLLOW-02, -03, -04, -06, -07, -08, -09, -10, -11, -12, -13, -14, -15. (FOLLOW-01, -05, -16, -17, -18 remain closed.)
- **Trust + safety:** UI-14 stays closed (Verification card replaced the fake sessions list).

---

## SECURITY (fix before public launch)

- [x] **SEC-01: Payment ownership + status check** -- FIXED. `payment.confirm` now verifies `userId` ownership and `status === 'pending'`. `createIntent` also verifies tour ownership. Uses optimistic locking to prevent race conditions.

- [x] **SEC-02: Chat authorization** -- FIXED. Added `verifyMatchParticipant()` to `getMessages`, `sendMessage`, `markRead`. Checks user is a participant AND match status is 'matched'. Also fixed `getConversations` to not leak `passwordHash` (now selects only id/displayName/avatarUrl/role).

- [x] **SEC-03: Tour lifecycle ownership + status gates** -- FIXED. `startTour` requires ownership + status 'paid'. `completeTour` requires ownership + status 'active'. `markStopVisited` loads stop, then verifies parent tour ownership. Prevents bypassing payment flow.

- [x] **SEC-04: Payment audit retention on account deletion** -- FIXED (verified 8 Jun 2026). `payments.tour_id` and `payments.user_id` now use `ON DELETE SET NULL`, `user.deleteAccount` preserves tour-linked payment rows, and `db:check` fails important FK/unique-index reverse drift instead of leaving it as a notice.

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

- [ ] **CLEAN-03: Reports table unused** -- *(Verified 27 May 2026: still actual.)* `reports` (schema.ts:1206) is referenced only by `user.deleteAccount` (nulls `resolvedBy` for ON DELETE SET NULL behaviour). No `report.router.ts`. The chat-side `message_reports` table is fully wired in `chat.router.ts` — that's a separate concern.

---

## CONFIGURATION (infrastructure)

- [ ] **CONFIG-01: No PWA manifest** -- *(Verified 27 May 2026: still actual.)* `app/public/` contains only `favicon.svg` + a `brand/` folder. No `manifest.json`, no service worker, no `<link rel="manifest">` in the root layout. Needed for "Add to Home Screen" + offline splash + (later) push notifications.

- [x] **CONFIG-02: Missing image remote patterns** -- FIXED. Added `images.pexels.com`, `upload.wikimedia.org`, `lh3.googleusercontent.com` to next.config.ts remotePatterns.

- [ ] **CONFIG-03: Stripe SDK not wired** -- *(Verified 27 May 2026: still actual.)* `stripe@^22.0.0` still in `package.json` but `payment.router.ts` does not import it. `createIntent` returns a mock string `` `pi_test_${payment.id.slice(0, 8)}_secret` `` (line 44) and `paymentGateway` is the literal `"stripe_test"`. Locked together with BIZ-01.

---

## HARDCODED / STUB UI (from gate check -- Apr 7)

Grouped by honesty-risk. Each points at the exact file where the fake data lives.

### Stub buttons that only show a "coming soon" toast

- [x] **UI-01: Apple sign-in button** -- `src/app/(auth)/login/page.tsx` and `register/page.tsx`. Intentionally disabled with "Coming soon" copy until Apple OAuth ships. Acceptable placeholder; revisit once Apple Developer account is provisioned.

- [ ] **UI-02: Change password** -- *(Verified 27 May 2026: still actual.)* `security/page.tsx` line 107 still toasts `"Password change coming soon"`. `settings/page.tsx` line 145 still toasts `t("account.changePasswordSoon")` (i18n key now, but still a toast). No `auth.changePassword` tRPC mutation exists. OAuth-only users still see the same prompt as password users.

- [x] **UI-03: Voice call chip in chat** -- ✅ **RESOLVED (verified 27 May 2026)**. Searched `chat/[matchId]/page.tsx` for `Voice call` / `webrtc` / `coming soon` — no matches. Chip was removed cleanly.

- [x] **UI-04: Experience "Book Now"** -- FIXED (Apr 7). Real booking dialog wired via `experience.book` tRPC mutation. Traveler picks date/time/groupSize, lands on `/tour/[id]/checkout`. Closes together with BIZ-02.

- [ ] **UI-05: Settings page stubs** -- *(Verified 27 May 2026: still actual, current locations.)* `settings/page.tsx` line 181 toasts `t("privacy.dataUsageSoon")` (Data Usage); lines 199-210 toast `t("about.{terms,privacy,licenses}Soon")` for the three doc rows. The strings are now i18n keys but still stubs. ToS / Privacy / Licenses pages do not exist under `app/src/app/`.

### Misleading UI (looks like it works but does not)

- [x] **UI-06: Duplicate "Delete Account" in Settings** -- FIXED (Apr 7). Button replaced with `<Link href="/security#danger-zone">` that scrolls the Danger Zone into view. `logout()` side effect removed. Danger Zone section has `id="danger-zone"` + `scroll-mt-20`.

- [x] **UI-07: Fake online/presence indicators** -- ✅ **RESOLVED (verified 27 May 2026)**. The four sub-bullets all gone or made real:
  - `chat/page.tsx` — searched for `idx < 2`, `Online`, `Exploring`, `Available`, `Free Today`, `bg-green-`, `bg-emerald` — no matches. Hardcoded green dots + verified checks removed.
  - `chat/[matchId]/page.tsx` line 381 — green dot is now `streamConnected`-gated and tied to a real SSE connection (`aria-label="Live connection active"`). Real signal, not fake.
  - `profile/page.tsx` — searched for `bg-green-`, `bg-emerald`, `online`, `presence`, `Active now` — no matches. Always-on user avatar dot removed.

- [x] **UI-08: Chat status badges cycle by index** -- ✅ **RESOLVED (verified 27 May 2026)**. Searched `chat/page.tsx` for `STATUS_BADGES`, `Online`, `Exploring`, `Available`, `Free Today`, `verified` — no matches. The rotating badge array is gone.

- [x] **UI-09: Payment status always "Succeeded"** -- FIXED (Apr 7). Added `payment.getHistory` protected procedure that queries real `payments` rows (user-scoped, joined with tours for title). Payments page rewritten: badge derived from status + refundAmount, totals exclude failed/pending/fully-refunded, unknown statuses render neutrally (not green), partial refunds surface as amber "Partial refund". Fallback "Hanoi Tour" string replaced with "Untitled tour".

- [ ] **UI-10: Profile EXPERIENCES stat hardcoded to 0** -- *(Verified 27 May 2026: still actual.)* `profile/page.tsx` line 163 still reads `value: 0`. BIZ-02 (experience booking backend) shipped — host-marketplace bookings now exist as `tours` rows — so this can finally be wired. Suggested fix: count `tours` rows where `userId = ctx.user.id AND experienceId IS NOT NULL AND status IN ('paid','active','completed')`.

- [ ] **UI-11: Non-functional home search bar** -- *(Verified 27 May 2026: technically still actual, but downgraded.)* `home/page.tsx` line 143 still has `<Input readOnly>` wrapped in a Link to `/explore`. **However**, the surrounding code now adds `role="search"` + an `aria-label` so screen readers don't announce an empty link, and a comment explains the choice. No longer trust-breaking but still UI debt — a real magnifier-icon button would be more honest.

- [x] **UI-12: "AI" branding with no AI** -- FIXED (Apr 7). Six total strings swept. **Note for 27 May audit:** a real LLM gateway now exists (`app/src/server/services/llm.ts`, mock-vs-DeepSeek mode via `LLM_MOCK_MODE`, used by the chatbot quiz / dynamic re-routing / wrap-up / thank-you letter). So Phase A "AI" rephrasing is still accurate, and Phase C can flip the mock flag without a copy change.

### Hardcoded data pretending to be dynamic

- [x] **UI-13: Fake host dashboard** -- FIXED (Apr 7). Added `host.getDashboard` returning `{ host, todaysBookings, todaysRevenueVnd, todayIsoDate }` with real data: Vietnam (UTC+7) day-bounded filtering on both today's bookings (status in paid/active) and today's revenue (sum of succeeded payments in the VN day). Page rewritten to hydrate from it; mock arrays + New Requests section + hardcoded stats all removed. Availability toggle now calls new `host.setAvailable({ isAvailable })` mutation. `null` data (host role, no hostProfiles row) shows a "Finish host setup" recovery card. Ratings render "--" when totalReviews === 0 (no fake 0.00). Also fixed the upstream plumbing gap: added `tour.assignHost` mutation and wired it to the host-selection page so `tours.hostId` actually gets populated when a user picks a host.

- [ ] **UI-14: Fake login sessions card** -- `src/app/(main)/security/page.tsx` previously had a hardcoded "Current Browser / Mobile Safari" list. Removed in the recent Verification-card rewrite. **This TODO is already resolved**; noting here only so the history is clear. Real session tracking is deferred (needs a `sessions` table + JWT session IDs + revoke endpoint).

- [ ] **UI-15: 2FA switch is cosmetic** -- *(Verified 27 May 2026: still actual.)* `security/page.tsx` line 125: `<Switch checked={twoFA} onCheckedChange={(v) => { setTwoFA(v); toast.success(v ? "2FA enabled" : "2FA disabled"); }}>` — pure local state, no TOTP/SMS/WebAuthn backend. Toast still says it's enabled even though nothing happened.

- [ ] **UI-16: Settings toggles do not persist** -- *(Verified 27 May 2026: still actual.)* `settings/page.tsx` lines 34-36: `pushNotifs`, `emailDigest`, `locationSharing` are still local `useState`. No `user.updateNotificationPrefs` tRPC mutation, no `user_preferences` column. Toggles reset on refresh.

- [ ] **UI-17: Hardcoded version string** -- *(Verified 27 May 2026: still actual.)* `settings/page.tsx` line 196 still reads `"1.0.0"` literal. Pipe `process.env.npm_package_version` (or the Vercel `VERCEL_GIT_COMMIT_SHA` short hash) through a public-safe env var and render that instead.

- [x] **UI-18: Hardcoded tour pricing** -- FIXED (Apr 7). New `src/lib/pricing.ts` module with `TOUR_PRICING` constants (`baseSolo`/`withHostSolo`/`group`/`hostAddon`/`currency`) and `computeTourPrice({ withHost, groupSize })`. Rewired tour-engine (authoritative server write), plan page summary, tour preview CTA + host-upsell card, host-picker chip, and checkout. Dropped the `|| 250000` silent fallback in both preview and checkout -- now disables the button with "Price unavailable" rather than lying with a default. Also fixed a latent revenue hole: `tour.assignHost` now recomputes `priceAmount` + `packageType` when a host is added post-creation, preventing the "shown +500k, charged +0" mismatch.

- [x] **UI-19: Static promo card on home** -- ✅ **RESOLVED (verified 27 May 2026)**. The `/home` page has been completely rewritten around the Fixed Tour Matrix + Activities + Merch + eSIM bundle. The "Host-led Photography Tour" hardcoded card is gone; the page now hydrates `fixedTour.rank`, `activity.list`, `merch.list`, `host.listPublic`. All copy comes from `messages/en.json` and `messages/vi.json`.

- [x] **UI-20: eSIM "from $5.90"** -- ✅ **RESOLVED (verified 27 May 2026)**. The literal `$5.90` is gone. The home eSIM banner now reads from i18n strings `home.esim.title` ("Bundle an eSIM with any tour.") and `home.esim.subtitle` ("Activates on landing. Save 10% at checkout."). No hardcoded USD anywhere on `/home`.

### Low-stakes copy polish

- [ ] **UI-21: "Budget Friendly" suffix on every place** -- *(Verified 27 May 2026: still actual.)* `(public)/explore/page.tsx` line 230 still reads `` `${p.priceRange} Budget Friendly` `` — the suffix is appended regardless of whether the place is `$`, `$$`, or `$$$`. Easy fix: drop the suffix; the `$/$$/$$$` glyphs already convey relative price.

- [ ] **UI-22: MemberBadge tier thresholds hardcoded** -- *(Verified 27 May 2026: still actual.)* `profile/page.tsx` lines 433-441 still have the inline tier ladder (`>=5 VIP`, `>=3 Premium`, `>=1 Member`, else `Explorer`). Harmless but should move to `lib/tiers.ts` so the thresholds can be tuned without a UI edit and a server-side check can mirror them later.

---

## CRITICAL FOR REVENUE (must do before launch)

- [ ] **BIZ-01: Wire real payments** -- *(Verified 27 May 2026: still actual, **single biggest revenue blocker**.)* `payment.router.ts` returns a mock `clientSecret` string. `stripe@^22.0.0` is installed but never imported. No live keys, no VNPay/MoMo integration. Without this, revenue is zero.

- [x] **BIZ-02: Experience booking backend** -- FIXED (Apr 7). Reused the existing tours table rather than a new experienceBookings table: `experience.book` creates a tours row with `status='preview'`, `packageType='host_experience'`, `experienceId` + resolved `hostId` set, price = `experience.priceAmount * groupSize`. Traveler flows through the existing `/tour/[id]/checkout` pipeline. On payment.confirm, the same tx flips tour status to paid and bumps `experiences.totalBookings` (closes FOLLOW-01 transactional wrap).

- [x] **BIZ-03: Fix or remove fake OAuth** -- DONE (Apr 7). Real Google OAuth shipped via Arctic + jose with conditional account linking (`docs/OAUTH_SETUP.md`). Apple button disabled with honest "Coming soon" copy until Apple Developer account is provisioned. *(Verified 27 May 2026: `app/src/lib/oauth.ts`, `/api/auth/google/route.ts`, `/api/auth/google/callback/route.ts` all present.)*

- [x] **BIZ-04: Remove unverifiable claims** -- ✅ **RESOLVED (verified 27 May 2026)**. Searched the whole `app/src/` tree for `5,000+`, `5000+`, `5,000 solo`, `Trusted by` — no matches in code. Landing page (`[locale]/page.tsx`) and home page now use brand-pure copy from i18n files. The string only survives as a historical mention in `docs/REVIEW_AND_BUSINESS_PLAN.md`. Effectively closes MAY-16 as well.

- [ ] **BIZ-05: Real host operations** -- *(Verified 27 May 2026: **substantially shipped**, narrow gap remains.)* Host dashboard, earnings + routes + payout history, verification workflow, host.assignHost mutation, host availability — all real. `host.router.ts` has 12+ procedures over real data. **What's still missing:** automated **payout execution** (`HOST_TOUR_PRICING.commissionRate` computes the split but settlement is off-platform — see FOLLOW-08) and **booking confirmation emails** (Resend wired for thank-you letters, not for booking confirmations).

- [ ] **BIZ-06: Analytics pipeline** -- *(Verified 27 May 2026: still actual.)* Searched `app/src/` for `@vercel/analytics`, `posthog`, `PostHog` — no matches. `package.json` has neither dep. No funnel tracking, no conversion measurement. KPIs in `REVIEW_AND_BUSINESS_PLAN.md` cannot be proven from current instrumentation.

---

## FUTURE FEATURES (Phase 2 roadmap)

- [ ] **FEAT-01: GoHub eSIM API integration** -- *(Verified 27 May 2026: still actual.)* `(public)/esim/page.tsx` still uses affiliate links (`https://gohub.com/esim/vietnam?ref=locomate`). The home/cart flow has eSIMs as cart items but `gohub.com` is just the outbound destination — no API integration. Contact partnership@gohub.com for API credentials.

- [ ] **FEAT-02: Push notifications** -- *(Verified 27 May 2026: still actual.)* No `web-push`, `firebase-admin`, or FCM code in `app/src/`. Tied to FEAT-06 (PWA service worker is a prerequisite for Web Push).

- [x] **FEAT-03: Vietnamese language (i18n)** -- ✅ **RESOLVED (verified 27 May 2026)**. `next-intl` is wired end-to-end:
  - All app routes live under `app/src/app/[locale]/…`.
  - `app/messages/en.json` (13.2KB) and `app/messages/vi.json` (14.9KB) both fully populated.
  - `useTranslations()` used across home, profile, settings, security, onboarding, theme toggle.
  - `setLocale` mutation on user.router + the AppLanguageRow in `settings/page.tsx` lets users switch UI language and persists the choice.
  - Brand-canonical names ("Nắng Sớm Tràng An" / "Đêm Sâu Phố Cổ") are i18n keys under `brand.themeLight` / `brand.themeDark`. French is **not** included (Phase 2 work).

- [ ] **FEAT-04: Tour editing** -- *(Verified 27 May 2026: still actual.)* No `tour.editStops`, `swapStop`, `reorderStops` in the codebase. The legacy `proposeAlternatives` exists for incident-driven swaps but is not a user-initiated edit surface.

- [ ] **FEAT-05: Custom domain** -- *(Verified 27 May 2026: still actual.)* `loco-mate.vercel.app` still the live URL. No `locomate.app` / `locomate.vn` configuration in `next.config.ts` or `vercel.json`.

- [ ] **FEAT-06: PWA setup** -- *(Verified 27 May 2026: still actual; same as CONFIG-01.)* No `manifest.json`, no service worker, no `next-pwa` import. Required for Add-to-Home-Screen + offline splash + Web Push (FEAT-02).

---

## MAY 2026 MEETING FOLLOW-UPS (from `docs/sửa .md` + `docs/dav startup .md`)

These items were originally surfaced by the PRD v2.0 + TRD v2.0 rewrite
(May 26, 2026). The May 27 verification sweep found that **many of these
shipped silently** in Phase A work without TODO updates. Status flags
below reflect actual code, not the original tracker.

### Brand / UX

- [x] **MAY-01: Theme naming sweep** -- ✅ **RESOLVED (verified 27 May 2026)**. `app/messages/en.json` has `brand.themeLight = "Nắng Sớm Tràng An"` and `brand.themeDark = "Đêm Sâu Phố Cổ"`. `app/src/components/brand/theme-toggle.tsx` reads these via `useTranslations` and ships an italic-serif pill toggle. The component is mounted in `settings/page.tsx` (the Appearance section). UI selector card present, brand names live.

- [x] **MAY-02: Personalized greeting flow** -- ✅ **RESOLVED (verified 27 May 2026)**. Onboarding chat (`(auth)/onboarding/page.tsx` line 53–64) collects `nickname` and writes via `trpc.user.setNickname.mutateAsync`. Settings page has a full nickname editor with the four canonical suggestions (Kẻ lữ hành / Cậu cả / Nàng thơ / Người mê dịch chuyển). `useDisplayName()` hook + `home/page.tsx`'s `firstName` greeting read the value across the app.

- [ ] **MAY-03: Profile Icon Store (Phase 2)** -- *(Verified 27 May 2026: still actual.)* Searched for `Khuyên tai`, `Nón ba tầm`, `Quạt giấy`, `Guốc mộc`, `loyalty`, `iconStore`, `icon-store` — no matches in code. Still parked for Phase 2.

- [ ] **MAY-04: Customized Tour option chips** -- *(Verified 27 May 2026: scope changed.)* `/plan` is now a redirect-to-`/activities` page (see `(main)/plan/page.tsx`); the legacy AI tour builder was retired in the Apr pivot. The Customized Tour engine code still lives in `_legacy/tour-engine.ts` but has no UI surface. **Re-scope decision needed:** either (a) build the option chips on a new surface (`/plan/build` already exists for activity timelining; could grow into the full custom-tour wizard), or (b) close this as obsolete because the Activities + Cart flow covers the same use case in pieces.

- [ ] **MAY-05: Proximity Smart Suggestion** -- *(Verified 27 May 2026: **partially shipped** at a different surface.)* `<ProximitySuggest>` component exists at `components/brand/proximity-suggest.tsx` and is mounted on `(public)/explore/[id]/page.tsx` line 150. **The original MAY-05 wanted it on `/plan`** — which no longer exists. Suggestion: rename this item to "Mount ProximitySuggest on `/activities/[slug]` and `/fixed-tours/[id]` as well" so the feature shows up on the surfaces that actually drive bookings.

- [ ] **MAY-06: Food Tour Budget Estimator** -- *(Verified 27 May 2026: still actual.)* Searched for `expectedSpendVnd`, `expected_spend_vnd`, `Mức giá áng chừng`, `FoodBudget`, `mealEstimate` — only TODO + PRD references, no code.

### On-trip Field features

- [ ] **MAY-07: Merchant QR Verification** -- *(Verified 27 May 2026: still actual.)* No `merchants` or `merchant_pricelists` tables in `schema.ts`. No `scanMerchantQR` procedure. `MERCHANT_QR_SIGNING_KEY` env var not in `.env.example`. Schema sketch in TRD §16 is the entire contribution to date.

- [ ] **MAY-08: Real-time Meal Balancing** -- *(Verified 27 May 2026: still actual; blocked on MAY-07.)* No `recordMealItem`, `meal_log`, or "Meal reconciliation" code anywhere.

- [ ] **MAY-09: Dynamic Re-routing AI** -- *(Verified 27 May 2026: **partially shipped**.)* `tour.proposeAlternatives` mutation exists (`tour.router.ts:307`). `<IncidentSheet>` component is wired into `(main)/tour/[id]/active/page.tsx` with 4 brand-tag reason chips and the 3-alternatives picker. **Gap:** the component comment says *"Phase A: shows a toast; Phase B: actually swaps the stop"* — the chosen alternative is not yet persisted into `tour_stops` / `tour_data.stops`. Rationales are still canned mocks per `(tone, category)`. Close the gap by wiring an `applyAlternative` mutation that does the transactional swap.

### Post-tour memory loop

- [ ] **MAY-10: Merchandise Handover** -- *(Verified 27 May 2026: still actual.)* No `markHandoverComplete` mutation, no $0 merch line attachment logic. `product_variants` table exists from FOLLOW-18 so the inventory plumbing is ready — just need the handover write path + Guide-side UI.

- [x] **MAY-11: Digital Thank-you Letter** -- ✅ **RESOLVED (verified 27 May 2026)**. Substantially shipped:
  - `thank_you_letters` table in schema (line 1171).
  - `app/src/server/services/thank-you-letter.ts` with `scheduleThankYouLetter` (write a scheduled row on `tour.complete`) and `renderAndSendDue` (the worker the cron calls).
  - Cron route at `/api/cron/send-thank-you/route.ts`, wired in `vercel.json` (`0 14 * * *`).
  - `(main)/letters/page.tsx` UI to view letters.
  - Body rendered via the LLM gateway (`llm.ts`) with mock-mode default; deterministic per `(feature, tone, sha1(prompt))`. Phase C flips `LLM_MOCK_MODE` to false for real DeepSeek output.

- [ ] **MAY-12: Locomate Wrap-up generator** -- *(Verified 27 May 2026: **substantially shipped**, gaps in OG + Blob persistence.)* `(main)/tour/[id]/wrap-up/page.tsx` exists. `tour.getWrapUpPages` returns ordered pages (cover + per-stop + closer) with mock-AI rationales via the LLM gateway. `shareElementAsPng()` helper exports a page as PNG client-side. **Gaps:** (a) no `@vercel/og` route for IG/TikTok share previews; (b) no Vercel Blob persistence of the rendered wrap-up — every share-as-image is a fresh client-side render. Phase B work to lock down.

### Catalog & content

- [ ] **MAY-13: Catalog expansion to 30+ Fixed Tours (Phase 3)** -- *(Verified 27 May 2026: still actual.)* `seed-fixed-tours.ts` contains 15 `LOCO_FT_*` IDs. Roadmap intact.

- [ ] **MAY-14: VN-first content sweep** -- *(Verified 27 May 2026: still actual, partial.)* `messages/vi.json` is fully populated (14.9KB vs en.json 13.2KB — same key coverage). Brand-canonical strings ("Nắng Sớm Tràng An", "Đêm Sâu Phố Cổ", nickname suggestions) stay in Vietnamese in both locales. **But** the next-3-storylines authorship workflow is not formalised — no doc says "write VN first, then translate to EN" for new fixed tours.

- [ ] **MAY-15: Theme/icon assets** -- *(Verified 27 May 2026: partial.)* Brand illustrations + icons live in `components/brand/illustrations.tsx` (DongSonSun, Lotus, ConicalHat, MamCom, Pagoda, Waves, etc.). The named-mode tokens are in the Tailwind theme. **Gap:** the four loyalty avatar accessories for MAY-03 (Khuyên tai / Nón ba tầm / Quạt giấy / Guốc mộc) are not in the illustrations set.

### Validation & cleanup

- [x] **MAY-16: Replace unverifiable copy** -- ✅ **RESOLVED (verified 27 May 2026)**. See BIZ-04 above — "5,000+ solo travelers" no longer appears in `app/src/`.

- [x] **MAY-17: Vector-axis docs** -- ✅ **RESOLVED (verified 27 May 2026)**. `app/src/lib/quiz-questions.ts` lines 187–199 contain the architectural note explaining the `craft / heritage / food / quiet / social` → `Art_Aesthetic / Deep_History_Heritage / Culinary_Enthusiast / Slow_Living` projection (the `social` axis is redistributed 50/50 into `craft` + `quiet`).

- [ ] **MAY-18: pgvector readiness audit** -- *(Verified 27 May 2026: still actual.)* TRD §17 mentions the cut-over criterion in prose ("> 1,000 tours OR cross-city") but there's no runbook for the `fixed_tours.vector jsonb` → `vector(4)` migration. No code change needed yet — just the runbook.

---

## MAY 2026 — CROSSOVER MATCHING (Capacity Rescue, PRD §5.11)

New feature locked in by `docs/fixed-tour-feature.md`. Anchors the
T-48h → T-24h pre-departure lifecycle and rescues under-capacity Fixed
Tour bookings via AI-ranked anonymous discovery + 8-hour negotiation
chat + in-chat Δ-payment. See PRD §5.11, TRD §3 (Crossover Matching
tables), TRD §5.7, BOOKING.md (Pre-departure timeline + Refunds).

> **27 May 2026 status:** the backend half of this feature is **substantially shipped** (schema, router, sweep logic, two PII tests, 35 integration tests). The gaps are: (1) HTTP cron routes + Vercel cron config, (2) the SSE event types on the existing chat stream, (3) Sentry observability, and (4) the four UI surfaces. The router exists but **no page in the app actually calls it** today, so the feature is dark-launched code.

### Schema + migrations

- [x] **CROSS-01: Migration script** -- ✅ **DONE (verified 27 May 2026)**. `app/scripts/create-crossover-matching-tables.ts` exists, is idempotent, creates all 5 tables + indexes + adds the 4 `tours` columns (`original_fixed_tour_id`, `crossover_pair_id`, `cancelled_at`, `cancel_reason`) + extends `tours.status` with `customized_pending` and `system_cancelled`.

- [x] **CROSS-02: Drizzle schema** -- ✅ **DONE (verified 27 May 2026)**. `schema.ts` lines 654–796 define `tourCrossoverRequests`, `tourProposalEdits`, `escrowAdjustments`, `priorityMatchingVouchers`, `crossoverDiscoveryPushes`. The `tours` Drizzle type now carries the four new columns.

### Backend (4 cron handlers + new router)

- [x] **CROSS-03: `crossover.router.ts`** -- ✅ **DONE (verified 27 May 2026)**. Router exists (`crossover.router.ts`), mounted under `crossover:` in `_app.ts:34`. Major procedures: `getCapacityStatus`, `migrateToCustom`, `getDiscoveryFeed`, `sendCrossoverRequest`, `respondToRequest`, `proposeEdit`, `respondToProposal`, `lockItinerary`, `confirmEscrowDelta`, `refundEscrowDelta`, `reportPartner`. Anti-overlap helper at `app/src/server/lib/crossover-overlap.ts`. Reuses `lib/cosine.rankByCosine`.

- [x] **CROSS-04: PII-stripped DTO contract** -- ✅ **DONE (verified 27 May 2026)**. `app/src/server/lib/crossover-dto.ts` defines `DiscoveryCandidateSchema` with `.strict()` Zod gating. Contract tests in `crossover-dto.test.ts` explicitly reject candidates with injected `displayName`, `avatarUrl`, `email`, `phone`. Defence-in-depth regex sweep (`PII_FIELD_REGEX`) also tested.

- [x] **CROSS-05: Cron jobs** -- ✅ **DONE (verified 7 Jun 2026)**. The sweep functions exist (`app/src/server/services/crossover-cron.ts`: `runT48hSweep`, `runT36hSweep`, `runT28hSweep`, `runT24hSweep`) and are wired through authenticated route handlers:
  - `/api/cron/crossover-t48`, `/api/cron/crossover-t36`, `/api/cron/crossover-t28`, `/api/cron/crossover-t24` each run one lifecycle sweep.
  - `vercel.json` registers each route every 15 minutes with offsets so the lifecycle does not fire all four mutations at once.
  - All handlers require `Authorization: Bearer $CRON_SECRET`.
  - `/api/cron/crossover-sweeps` remains as a manual authenticated aggregate endpoint that runs the full sequence in order.

- [x] **CROSS-06: Escrow Δ-payment plumbing** -- ✅ **DONE (verified 27 May 2026)**. `payment.router.ts:288` has `refundPartial` (admin-gated). `crossover.router.ts:786` has `lockItinerary` and `:867` has `confirmEscrowDelta`. Idempotent on the `escrow_adjustments` row — the test file's "double-confirm rejection" case (`crossover.router.test.ts:626`) exercises this.

- [x] **CROSS-07: Voucher application** -- ✅ **DONE (verified 27 May 2026)**. `crossover.router.ts:409–423` selects an active voucher (`usesRemaining > 0`), applies the score boost, and decrements `usesRemaining` in the same transaction. `reportPartner` (`:972`) issues a new voucher with `usesRemaining: 1`.

### Real-time + observability

- [ ] **CROSS-08: SSE event types** -- *(Verified 27 May 2026: still actual.)* Searched the whole `app/src/` tree for `crossover:proposalPending`, `crossover:proposalDecided`, `crossover:escrowReady`, `crossover:locked`, `crossover:terminated`, `tour:routeUpdated` — no matches. The existing SSE channel `/api/chat/stream/[matchId]` has not been extended.

- [ ] **CROSS-09: Observability** -- *(Verified 7 Jun 2026: partially actual.)* Crossover cron routes now return structured `{ ok, sweep, ranAt, result }` payloads and log warning-level output when a sweep reports row-level errors. Still missing: a real error-reporting backend such as Sentry and a stuck-booking alarm.

### UI

- [ ] **CROSS-10: T-48h warning + migration CTA** -- *(Verified 27 May 2026: still actual.)* Searched `(main)/fixed-tours/[id]/page.tsx` for `Chuyển sang Custom`, `migrateToCustom`, `currentCapacity < 2`, `Warning Tag` — no matches. The router's `getCapacityStatus` + `migrateToCustom` procedures exist but no UI calls them.

- [ ] **CROSS-11: `/match/crossover` discovery surface** -- *(Verified 27 May 2026: still actual.)* No page under `app/src/app/[locale]/(main)/match/` or `(main)/crossover/`. `getDiscoveryFeed` has no consumer in the app yet.

- [ ] **CROSS-12: Negotiation chat extensions** -- *(Verified 27 May 2026: still actual.)* No 8-hour countdown or Smart Proposal Hub widget rendered inside `chat/[matchId]/page.tsx`. The `proposeEdit` / `respondToProposal` procedures have no UI consumer.

- [ ] **CROSS-13: In-chat Stripe Payment Element** -- *(Verified 27 May 2026: still actual; blocked on BIZ-01.)* Stripe SDK not wired (CONFIG-03 / BIZ-01). `confirmEscrowDelta` procedure exists and is tested but no UI mounts the Stripe Payment Element.

### Tests

- [x] **CROSS-14: Integration tests** -- ✅ **DONE (verified 27 May 2026)**. `crossover.router.test.ts` has **35 `it(...)` cases** (vs target 25+) across multiple `describe` blocks covering: capacity status, migration to custom, discovery feed PII, send/respond, anti-overlap (matched + pending), proposal hub, lockItinerary, Δ-payment confirm + double-confirm rejection, reportPartner + voucher issuance.

- [x] **CROSS-15: PII-leak contract test** -- ✅ **DONE (verified 27 May 2026)**. `crossover-dto.test.ts` has 4 explicit reject-an-injected-PII-field tests plus a `PII_FIELD_REGEX` defence-in-depth test that catches `displayName`, `firstName`, `lastName`, `fullName`, `name`, `avatar`, `email`, `phone`. Build-blocking — i.e., a regression would fail CI.

### Crossover follow-ups discovered on 27 May audit

- [ ] **CROSS-FOLLOW-01: Connect router to UI** -- the biggest single gap: the entire crossover backend is dark-launched. Pick CROSS-10 first (T-48h warning) because it unlocks the migration path and renders on a page that already exists (`/fixed-tours/[id]`). CROSS-11 (discovery feed) and CROSS-12 (chat hub) follow.

- [ ] **CROSS-FOLLOW-02: Vercel Pro upgrade or alternative cron** -- CROSS-05 needs 15-min cadence. Either upgrade plan or evaluate an external cron (GitHub Actions cron, Upstash QStash) that POSTs to the cron routes once they exist.

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
- [x] Real Google OAuth (Arctic + jose; conditional account linking; see `docs/OAUTH_SETUP.md`)
- [x] JWT hardening (HS256 pinned, 32-char secret required, no fallback)
- [x] Hard account deletion flow on `/security` Danger Zone (transactional cleanup, password + email confirm, OAuth-aware; Apr 7 host-aware: archives owned experiences + nulls tour.hostId before cascade)
- [x] Verification card replaces fake "Identity" stub (real email verified / password / Google / host status signals)
- [x] Tier 1 honesty sweep: fake delete button, fake payment status, "AI" branding, mock host dashboard, inconsistent pricing (all resolved Apr 7; four code-reviewer passes)
- [x] **Host Tour Marketplace** (Phases 1+2, Apr 7): extended `experiences` with author/kind/status/publishedAt/reviewNotes; new `host-experience.router` with 6 procedures + verification-gated publish + 8 content rules; extended `experience.router` with kind filter + author join + `book` mutation (per-person price * groupSize); 5-step host wizard UI at `/host/experiences/*`; traveler booking dialog on `/experiences/[slug]` (closes UI-04 + BIZ-02); segmented "By Local Hosts" filter on listing; host dashboard shows `myListingsCount`. See `docs/HOST_MARKETPLACE_PLAN.md`.
- [x] **Testing infrastructure** (Apr 7): Vitest + `@electric-sql/pglite` for in-process Postgres integration tests, `@testing-library/react` for component tests, Playwright for E2E, GitHub Actions CI. 138 tests passing across 9 test files; per-file coverage thresholds >=80% on all marketplace code.

---

## FOLLOW-UPS SURFACED BY TIER 1 REVIEWS (new)

- [x] **FOLLOW-01: Wrap `payment.confirm` in a DB transaction** -- FIXED (Apr 7). Confirm now runs all three writes (payment update, tour update, experiences.totalBookings increment) inside `ctx.db.transaction`. Rollback verified with an integration test that seeds `totalBookings = 2^31 - 1` and asserts an overflow-throw keeps payment.status pending + tour.status preview.

- [ ] **FOLLOW-02: Enforce `priceAmount > 0` invariant at write time** -- *(Verified 27 May 2026: still actual.)* No `CHECK price_amount > 0` constraint in `scripts/create-booking-integrity.ts` or anywhere else. Schema default still `0`.

- [ ] **FOLLOW-03: Per-host pricing** -- *(Verified 27 May 2026: still actual.)* No `hourlyRate` / `hostHourlyRate` column in `hostProfiles`. `TOUR_PRICING.hostAddon` is still flat.

- [ ] **FOLLOW-04: Host request workflow** -- *(Verified 27 May 2026: still actual.)* No `hostAcceptedAt` / `hostStatus` columns on `tours`. `tour.assignHost` is one-way (traveler writes, host can't decline).

- [x] **FOLLOW-05: Host dashboard integration test** -- FIXED (Apr 7). `src/server/routers/host.router.test.ts` covers 11 scenarios including today's-bookings filter (Vietnam day bounds), experience title join, revenue aggregation, myListingsCount grouping, and cross-host auth isolation.

- [ ] **FOLLOW-06: `packageType` vs. pricing inconsistency** -- *(Verified 27 May 2026: still actual.)* `_legacy/tour-engine.ts:157` still has `packageType: request.withHost ? (request.groupSize > 1 ? "social_tour" : "solo_mate") : "loco_route"`. The "no-host, groupSize > 1" branch keeps `loco_route` while charging the group tier — the same inconsistency described originally.

- [ ] **FOLLOW-07: `<Link><Button/>` a11y cleanup** -- *(Verified 27 May 2026: still actual, scope grew.)* Multi-line search across `(main)/` found the nested pattern in 10 files: `cart`, `home`, `host/experiences`, `host/experiences/[id]/edit`, `host/page.tsx`, `orders/[id]`, `plan/build`, `plan/templates/[id]`, `settings`, `tours`. The button-variants-on-Link pattern would close all 10 in one PR.

- [ ] **FOLLOW-08: Host payout automation** -- *(Verified 27 May 2026: still actual.)* `host_payouts` table exists from FOLLOW-17, but no `Stripe Connect`, `payoutPipeline`, or `exportPayouts` code. Manual off-platform settlement still.

- [ ] **FOLLOW-09: Per-experience reviews UI** -- *(Verified 27 May 2026: still actual.)* `review.router.ts` only has tour-target review procedures, no `submitExperienceReview` / `targetType='experience'` UI. `(public)/experiences/[slug]/page.tsx` displays the **host's** review count, not experience-level reviews.

- [ ] **FOLLOW-10: Photo upload** -- *(Verified 27 May 2026: still actual.)* `_wizard.tsx:410` says literally *"Real photo upload coming soon -- for now, paste links."* Vercel Blob IS wired for chat image upload (`/api/chat/upload/route.ts`) so the auth/storage primitives exist — just need to apply them to the host wizard.

- [ ] **FOLLOW-11: Admin moderation UI** -- *(Verified 27 May 2026: still actual.)* `/admin/flagged/page.tsx` exists but is for the chat-message reports surface, not the `experiences.status='rejected'` workflow. No admin experience-moderation queue.

- [ ] **FOLLOW-12: Real concurrent publish test for slug-retry** -- *(Verified 27 May 2026: still actual.)* `host-experience.router.test.ts:397–422` has a regression guard test but it pre-seeds the colliding row and exercises the `findUniqueSlug` pre-check, not the 23505 catch-block. A genuine "mock the UPDATE to throw 23505 once, then succeed" test is still missing.

- [ ] **FOLLOW-13: E2E pipeline activation** -- *(Verified 27 May 2026: still actual.)* `.github/workflows/ci.yml:127` still has `if: false` on the Playwright run step (lint/typecheck/vitest unaffected). Specs at `tests/e2e/` exist but never execute in CI.

- [ ] **FOLLOW-14: Exhaustive `hostProcedure` role negatives** -- *(Verified 27 May 2026: still actual, partial.)* `host.router.test.ts` has 3 traveler-caller-FORBIDDEN tests (lines 25, 483, 845). Spot-coverage on a 12+-procedure router. The `test.each` helper to enforce per-procedure parity is still missing.

- [ ] **FOLLOW-15: `tours.hostId` FK should be ON DELETE SET NULL at schema level** -- *(Verified 27 May 2026: still actual.)* `schema.ts:521` reads `hostId: uuid("host_id").references(() => hostProfiles.id),` — still no explicit `{ onDelete: "set null" }`. Compensation in `user.deleteAccount` still doing the work.

- [x] **FOLLOW-16: Role-aware home + navigation** -- FIXED (Apr 7). `/home` is traveler-shaped (Xin Chao, Hidden Gems, host-for-hire promo) and hosts were landing there after login. Fixed on five layers: (1) login + /auth/complete route hosts to /host; (2) /home guards `role in (host, admin)` and redirects to /host; (3) `BottomNav` reads `useAuthStore()` and swaps to a host nav (Dashboard / My Listings / Bookings / Messages / Profile); (4) Home page's "Host-led Photography Tour" promo guarded with `role === 'traveler'` so hosts don't see self-upsells even if they visit /home via direct URL; (5) host dashboard expanded with earnings snapshot (7d/30d/lifetime via new `host.getEarningsSummary`), upcoming-week preview (via new `host.getUpcomingBookings`), drafts-needing-attention CTA when publishedCount===0, and browse-marketplace shortcut. Also shipped `/host/bookings` (Upcoming | Past tabs grouped by date) using `host.getPastBookings`. Tests: 154 passing (+6 new integration tests covering bucketing, isolation, excluded statuses, past-date filter).

- [x] **FOLLOW-18: Product pivot -- Fixed Tours + Flexible Activities + Merch + eSIM bundles** -- DONE (Apr 7). BU announcement: retire AI-generated custom tours as core; pivot to standardised Fixed Tours (already = `experiences.kind='curated'`) + a-la-carte Activities (new). AI repositioned as explanation layer. New revenue lines: merch + eSIM bundles.
  - **Schema (7 new tables + payments relaxed)**: `activities`, `activity_slots`, `cart_items`, `orders`, `order_items`, `products`, `product_variants`. `payments.tourId` relaxed to nullable + new nullable `orderId` so legacy tour-based payments and new multi-line order-based payments cohabit. Idempotent migration at `scripts/create-product-pivot-tables.ts`, mirrored in PGlite setup.
  - **Seed**: 12 host-authored activities (4 per host matched to specialties: food/photography/nightlife/culture/history/coffee/art), 71 time-slots spread across the next 14 days with realistic capacity + partial-book states, 6 merch products (tee, cap, tote, keychain, journal, poster) with 13 variants (size/color/framed combinations) and 10-25% bundle discount configured per product.
  - **Backend (4 new routers, 30+ procedures)**: `activity` (list/getBySlug/getSlots/listMine/create/update/publish/archive/addSlot/removeSlot/getManyByIds), `cart` (get with hydrated metadata + conflict detection, add discriminated-union, updateQuantity with capacity re-check, remove, clear, getCount), `order` (createFromCart with price re-validation + ESIM_BUNDLE_10 auto-apply, confirmPayment in transaction decrementing slot + stock, getHistory, get), `merch` (list/getBySlug/getVariantsByIds/admin CRUD: createProduct/updateProduct/archiveProduct/addVariant/updateVariant/removeVariant). New `adminProcedure` gate for platform admin access.
  - **Nav N2 update**: traveler bottom nav swaps Plan -> Activities, Explore -> Cart; hosts unchanged. Landing + /home rewritten to foreground two-path CTA (Fixed Tours / Activities), with dedicated Activities + Merch carousels + eSIM bundle banner.
  - **New pages**: `/activities` (category-filtered browse), `/activities/[slug]` (slot picker grouped by calendar day + quantity + optional guide add-on + sticky checkout bar), `/cart` (full line hydration, time-conflict banner, quantity/remove controls, blocked checkout if conflicts), `/orders/[id]/checkout` (order summary + payment method picker), `/orders/[id]` (receipt with bundle-discount breakdown), `/shop` (category grid), `/shop/[slug]` (variant picker + stock guard), `/admin/products` (CMS CRUD for products + add-variant), `/plan/build` (timeline builder visualising activity slots on 6am-10pm day ruler with red overlay on conflicts).
  - **AI explainer**: new `components/ai-explainer.tsx` -- reads userProfile.derivedData + explicitData and emits 2-3 fit reasons (interest keyword hits, intent alignment, adventurousness score, host language). Hides silently if no concrete signal; no LLM calls, pure rules. Mounted on `/activities/[slug]` and `/experiences/[slug]`.
  - **eSIM integration**: `/esim` plans add to cart instead of affiliating out. Bundle logic (ESIM_BUNDLE_10 = 10% off eSIM when tour/activity also in cart) enforced server-side in `order.createFromCart`.
  - **Legacy**: `/plan` now redirects to `/activities` via client-side useEffect. `src/server/services/tour-engine.ts` moved to `src/server/services/_legacy/tour-engine.ts`, import in `tour.router.ts` updated. Existing tour routes (preview, hosts, checkout) untouched for backward compat.
  - **Tests**: 194 passing (+22 new integration tests): activity.list/getSlots/publish/addSlot/removeSlot (10 cases), cart.add (tour/activity/merch), conflict detection, quantity updates, remove/clear, auth gate (7 cases), order.createFromCart with bundle discount, confirmPayment with slot+stock decrement, double-confirm rejection, cross-user isolation (5 cases). Existing 172 tests still pass.

- [x] **FOLLOW-17: Host operator console -- cashflow + routes + seeded experiences** -- DONE (Apr 7).
  - **Schema**: new `host_payouts` table (id, hostId, amount, currency, status, periodStart, periodEnd, paidAt, bankReference) added to `src/server/db/schema.ts` + idempotent migration at `scripts/create-host-payouts-table.ts`. Mirrored in PGlite setup so tests see the same shape.
  - **Seed**: 9 host-authored experiences (3 per host, matched to Nam/Linh/Chau's profile specialties) + ~30 host-booked tours spread across completed/paid-future/preview + 27 payments (mix of succeeded/pending/refunded) + 3 `host_payouts` rows. Each tour has real `tour_stops` pointing at HANOI_PLACES so the routes heatmap renders at geographically real locations.
  - **Backend (8 new tRPC procedures)**: `host.getBalance` (Available / Pending / In-review / refunded / lifetime payouts / next-payout forecast) · `host.getRevenueByDay(days)` (contiguous VN-local-day series) · `host.getRevenueByExperience` (per-listing perf, ORDER BY gross DESC) · `host.getPaymentsTimeline(limit)` (gross/commission/net per transaction) · `host.getCommissionSummary` (lifetime split, transparent rate) · `host.getPayoutHistory(limit)` (newest-first payouts) · `host.getStopHeatmap` (aggregate stop visit counts) · `host.getStopDetail(placeId)` (drill-down: tours + travelers that passed through a stop). All host-scoped and auth-isolated.
  - **Nav N2**: `BottomNav` host tabs swapped to `Dashboard / Listings / Earnings / Routes / Profile`. Messages demoted to a bell icon with unread count in the `/host` header (new `components/host/messages-bell.tsx`).
  - **UI**: `/host` balance card (replaces 7d/30d/lifetime strip) · new `/host/earnings` (balance breakdown + 30-day stacked bar chart + per-experience table + payments timeline + commission summary + payout history) · new `/host/routes` (Leaflet CircleMarker heatmap scaled by booking count + drill-down panel for selected marker + per-experience accordion).
  - **Tests**: 172 passing (+18 new integration tests): 4 for `getBalance` (available/pending split, payout subtraction, refund impact, host isolation), 2 for `getRevenueByDay` (contiguous series, excluded statuses), 2 for `getRevenueByExperience` (author filter + zero-booking inclusion), 2 for `getPaymentsTimeline` (shape + limit/isolation), 1 for `getCommissionSummary`, 2 for `getPayoutHistory` (ordering + isolation), 2 for `getStopHeatmap` (aggregation + preview exclusion), 3 for `getStopDetail` (shape + null + cross-host isolation). Timezone alignment fix in `getRevenueByDay` (buckets now key on VN-local date, not UTC, to avoid the "8 buckets for days=7" regression).

