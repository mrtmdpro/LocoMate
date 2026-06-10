# LOCOMATE — Business-Logic & UX Audit — 2026-06-10

**Lens:** This is **not** a code-quality audit (security / perf / data integrity were
covered by [`CODEBASE_AUDIT_2026-05-29.md`](CODEBASE_AUDIT_2026-05-29.md)). This audit
verifies the **user stories** in [PRD.md](PRD.md) end-to-end against the actual
implementation, hunts for **illogical actions, dead-ends, and bad UX patterns**, and
proposes a **launch-readiness overhaul plan**. Seven domain auditors traced the real
flows through the code (first-run/auth/home, fixed-tours/matching, commerce, crossover,
on-trip/post-tour, host marketplace, profile/shell). Every finding below is cited to
`file:line`.

---

## TL;DR — launch-readiness verdict

**The product is a polished veneer over well-built infrastructure, but the
end-to-end user journeys are broken at their critical seams.** Many flagship flows are
either unreachable, dead-end mid-way, or silently discard the work the user just did.

The code-quality audit was right that the *foundations* are healthy (real-DB tests,
server-authoritative pricing, atomic inventory, clean i18n). That makes this audit's
conclusion more frustrating, not less: **the plumbing is sound, but the journeys built on
top of it don't connect.**

> **Cannot launch the current PRD scope in a month.** The PRD describes a Phase-1 + Phase-2
> product (Crossover Matching, Merchant QR, Meal Balancing, Wrap-up viral loop, field ops).
> The Phase-2 surface is ~0% on the frontend and the **Phase-1 core loops are themselves
> broken** in ways that block a real user from completing the headline journey. The
> realistic path is a **ruthless scope cut to a working Phase-1**, then fix the five broken
> core loops below.

### The five broken core loops (each blocks the headline journey)

| # | Broken loop | Net effect on the user | Severity |
|---|---|---|---|
| 1 | **Onboarding personalization is self-erasing** | Every chat-quiz user lands on an *un-personalized* home — the entire "cultural matching" promise is destroyed at step one | **P0** |
| 2 | **Host marketplace cannot publish inventory** | No host can ever reach `verified='approved'`; onboarding saves nothing → zero bookable supply exists outside test seeds | **P0** |
| 3 | **Traveler cannot cancel / no refund lifecycle** | The entire documented FR-PAY-04 refund flow doesn't exist; no T−48h cutoff | **P0** |
| 4 | **Commerce: promised discount never applies, orders unrecoverable** | Merch bundle discount is shown but never computed; no order history; payments mislabel orders as "Untitled Tour" | **P0/P1** |
| 5 | **Crossover Matching is a backend skeleton with 0% UI** | Entire Phase-2 flagship is unreachable; even wired, every match dead-ends with "nowhere to chat" | **P0 (descope)** |

---

## 1. User-story verification matrix

Status legend: ✅ works end-to-end · ⚠️ partial / wrong-shape · ❌ broken/dead-end · 🚫 not built (frontend or whole feature)

### 1.1 First-run · Auth · Home
| Story (PRD) | Status | Evidence |
|---|---|---|
| Email/pw + Google OAuth register/login, returnTo gate | ✅ | `auth.router.ts:51-119`, `api/auth/google/callback/route.ts:159`, `middleware.ts:37-47` |
| Chat quiz → 4-D vector → **personalized** home | ❌ **P0** | vector saved (`onboarding/chat/page.tsx:218`) then **wiped** by `submitOnboarding`'s empty merge (`user/profile.ts:273-292`, `profile-engine.ts:10-56`) → home reads null vector → no pills, canonical order |
| FR-BRAND-02 nickname ("gọi tên thân mật") in chat | ⚠️ | only the *legacy* form collects it (`onboarding/page.tsx:374`); chat flow never prompts (`chat/page.tsx:87`) |
| FR-BRAND-04 language picker vi/en/**fr** | 🚫 | only en/vi routes (`i18n/routing.ts:20`); no fr bundle; chat has tone buttons, no language selector |
| Home greeting/timeline/carousels/match% | ✅ | `home/page.tsx` — all surfaces present |
| §10 skip-quiz → "take the quiz" CTA everywhere | ⚠️ | home shows canonical order but **no quiz CTA** when vector absent (`home/page.tsx:317`) |

### 1.2 Fixed Tours · Matching · Customized Tour
| Story | Status | Evidence |
|---|---|---|
| Chapter hub, vector-ranked, match-pill gating | ✅ | (lives at `/experiences`, not `/fixed-tours`) `experiences/page.tsx:200`, `fixedTour.router.ts:150` |
| Cosine matchScore = cosine×100 | ✅ | `cosine.ts:72` |
| Tour detail → Book dialog → checkout | ✅ | `fixed-tours/[id]/page.tsx:160`, `fixedTour.router.ts:312`, `tour/[id]/checkout` |
| FR-FT-02 material filter chips on hub | 🚫 | API supports `materials` (`fixedTour.router.ts:98`) but no chips wired |
| FR-FT-03 "Why It Fits You" on detail | 🚫 | only on `/experiences` card, never on detail |
| FR-CROSS-02 under-capacity Warning Tag + Switch-to-Custom | 🚫 **P0** | detail page never reads capacity; concept lives only in cron (`crossover-cron.ts:103`) |
| FR-TOUR Customized Tour builder (`/plan`) | 🚫 **P0** | `/plan` hard-redirects to `/activities` (`plan/page.tsx:16`); builder controls gone, yet CTAs still point here |
| §8 race for last seat (fixed tours) | 🚫 | `fixedTour.book` has no shared inventory — each booking is independent (`fixedTour.router.ts:312`) |
| Routes named in PRD (`/fixed-tours`, `/tours`) | ❌ | `/fixed-tours` index 404s (linked from `tours/page.tsx:68`); `/tours` is *history*, not the matrix |

### 1.3 Commerce (Activities · Merch · eSIM · Cart · Orders)
| Story | Status | Evidence |
|---|---|---|
| Browse/detail/slot-pick/add-to-cart (activities, merch, eSIM) | ✅ | `activities/`, `shop/`, `(public)/esim/` |
| Cart conflict detection + atomic last-seat/unit race | ✅ | `lib/cart-conflicts.ts`, `order.router.ts:387-427` (refund reverses inventory too) |
| **Merch bundle discount 10–25%** | ❌ **P0** | promised in UI badge + cart note, but `createFromCart` computes **only eSIM 10%**, never reads `bundleDiscountPct` (`order.router.ts:266-277`) |
| Order history / re-find a purchase | ❌ **P1** | `order.getHistory` is **dead code** (0 callers); no `/orders` index; no nav entry |
| Payment history labels orders correctly | ❌ **P1** | every order shows "Untitled Tour", non-clickable (`payment.router.ts:362`, `payments/page.tsx:103`) |
| Coupons apply to cart/orders | ⚠️ | WRAP coupons only apply to tours, never commerce (`coupon.router.ts:96`) |

### 1.4 Crossover Matching (PRD §5.11 — Phase-2 flagship)
| Story | Status | Evidence |
|---|---|---|
| T−48/36/28/24 cron sweeps, anti-overlap, DTO privacy, idempotency | ✅ (backend) | `crossover-cron.ts`, `crossover-overlap.ts:108`, `crossover-dto.ts:57` |
| **Any frontend at all** (`/match/crossover`, discovery, hub) | 🚫 **P0** | **0 `.tsx` files reference any crossover procedure**; router reachable only by tests |
| Accept → chat thread created | 🚫 **P0** | `respondToRequest` only flips status; no chat row (`crossover.router.ts:617`) → matched = dead-end |
| Smart Proposal Hub widget, countdown, pinned Report | 🚫 | none rendered; generic chat shows full displayName/avatar (`chat/[matchId]/page.tsx:312`) — *violates anonymity spec* |
| Escrow Δ-branching + Stripe | ⚠️ | "MOCK MODE" status-flip only (`crossover.router.ts:974`); no payment UI |
| Merged route resolution / coCreateRoute | ⚠️ | placeholder cost formula; approved edits never applied (`crossover.router.ts:903`) |
| Report → pair-ban + apology + voucher power | ⚠️ | voucher issued but confers no matcher benefit; no ban, no re-queue choice |

### 1.5 On-trip · Post-tour · Reviews · Refunds
| Story | Status | Evidence |
|---|---|---|
| Wrap-up recap page + Thank-you letter + wrap-up coupon | ✅ | `tour/[id]/wrap-up`, `thank-you-letter.ts`, `wrap-up-coupon.ts` — **genuinely good** |
| **Traveler cancel + FR-PAY-04 refund tiers** | 🚫 **P0** | `tour.cancelByTraveler` documented in `BOOKING.md:232` but **does not exist**; refunds are admin-only |
| **`markStopVisited` persistence** | ❌ | mutation exists (`tour.router.ts:151`) but **never called**; visited state is local React only (`active/page.tsx:66`) |
| T−48h booking cutoff in checkout | 🚫 | no cutoff logic in `checkout/page.tsx` |
| Reviews target guide/both + photos; host avgRating flagging | ⚠️ | only `targetType:'tour'`, no photos (`review.router.ts:29`); host rating never updated |
| Field ops: merchant QR, meal balancing, handover, applied re-routing | 🚫 | none exist; incident pick only fires a toast (`active/page.tsx:329`) |
| Live-location / emergency safety affordances | ⚠️ | location toggle shares nothing; emergency = 10s toast, not `tel:` links |

### 1.6 Host Marketplace
| Story | Status | Evidence |
|---|---|---|
| Experience 5-step wizard, listing mgmt, earnings, bookings-read, routes analytics | ✅ | `host/experiences/_wizard.tsx`, `host/earnings/`, `host/bookings.ts` — **well-built, real math** |
| **Host onboarding `/host-setup` persists data** | 🚫 **P0** | `handleSubmit` is a `setTimeout→push` stub; bio/availability/ID all discarded (`host-setup/page.tsx:58`) |
| **Path to `verified='approved'` → publish** | 🚫 **P0** | zero code writes `'approved'`; publish hard-requires it (`host-experience.router.ts:278`) → **no host can ever publish** |
| `publicSlug` set → appears in `/hosts` directory | 🚫 | never written in any prod path → host invisible publicly |
| Host-cancel → 100% refund + rebook | 🚫 | no cancellation procedure exists |
| Host archetype (Nhà nghiên cứu / lém lỉnh) | 🚫 | no column, no UI |
| Guide active-tour console (QR, meal-log, applied re-route, SSE) | 🚫 | `/tour/[id]/active` is the *traveler's* view; no guide console |

### 1.7 Profile · Settings · Shell · i18n · A11y
| Story | Status | Evidence |
|---|---|---|
| Theme toggle (FR-BRAND-01), greeting, preferences recompute, emergency contacts, security, payment history, saved places, i18n parity | ✅ | `theme-toggle.tsx`, `user/profile.ts:255`, `security/page.tsx`, 1394/1394 key parity |
| Loyalty Points + Icon Store | 🚫 | absent (Phase 2) — no teaser either |
| Meal-reconciliation badges | 🚫 | not implemented |
| Change password / 2FA / notif toggles | ⚠️ | stubs or non-persistent local state; 2FA toasts "enabled" doing nothing (`settings/page.tsx:42`, `security/page.tsx:30`) |
| **Primary nav matches PRD (Home/Fixed/Activities/Cart/Profile)** | ❌ **P0** | actual tabs are Fixed/Customized/Store/Chat/Cart (`nav.ts:56`); Home/Activities/Profile demoted to hamburger |
| **Bottom nav on a PWA** | 🚫 **P1** | none; single sticky top bar, icon-only scrolling tabs on mobile |
| Anonymous public pages have inter-page nav | 🚫 **P1** | `(public)/layout.tsx:46` renders page + "Sign up" only; logged-out visitor is stranded |

---

## 2. Illogical flows & dead-ends (the things that make a user stuck or confused)

1. **P0 — The quiz lies to you.** Chat onboarding shows your personality label on the "done"
   card, you tap "go home," and land on a feed with **no match pills and canonical order** —
   because the vector was wiped (`profile.ts:273`). The single most confidence-breaking moment
   in the product is its first one.
2. **P0 — A host's entire setup vanishes.** `/host-setup` is reached both as onboarding *and*
   as "Update profile" (`host/page.tsx:360`); both render a form, spin, and silently discard
   everything (`host-setup/page.tsx:58`).
3. **P0 — Matched, then trapped.** A crossover match starts an 8h countdown with no chat and no
   proposal UI; the *only* outcomes are reporting your partner (nuclear) or silent T−28h
   termination. There is no benign "change my mind / un-match."
4. **P1 — Buy something, never see it again.** After the post-checkout receipt, à-la-carte
   orders are unreachable — no `/orders` list, no nav entry, payments page calls them "Untitled
   Tour" and won't link to them.
5. **P1 — Promised a discount that never arrives.** Shop badges and the cart note promise a
   merch bundle discount; the order total never reflects it — a visible contradiction at checkout.
6. **P1 — Migration to nowhere.** `migrateToCustom` flips a tour to `customized_pending`, but no
   page recognizes that status (`/plan` is gone) — the "one-click migration" lands on an
   un-editable void.
7. **P1 — Dead links in the nav.** `/fixed-tours` index 404s but is the empty-state CTA on
   `tours/page.tsx:68`; `/tours` is history, not the catalog the name implies.
8. **P1 — Letters you can't find.** `/letters` is reachable only via the wrap-up finish button;
   dismiss it once and the Thank-you letter is unreachable forever (no nav/profile link).
9. **P2 — Orphaned cart lines.** Removing an activity leaves its billable `guide_addon` line in
   the cart (`cart.router.ts:501`) — it sails through checkout as a standalone charge.
10. **P2 — Actions that do nothing.** "Mark visited," incident re-route pick, "Share Location,"
    2FA toggle, Change Password — all present as affordances, all no-ops.

---

## 3. UX / usability / UI problems (cross-cutting)

- **No bottom navigation on a PWA** (`top-nav.tsx`). Primary tabs are an icon-only horizontally
  scrolling row on mobile — a thumb-reach + discoverability regression. The PRD's tab set isn't
  even the one shipped.
- **Logged-out visitors are stranded.** Public marketing pages (`/explore`, `/experiences`,
  `/hosts`, `/guides`, `/blog`, `/esim`) have no shared header or inter-page links
  (`(public)/layout.tsx:46`) — the funnel leaks.
- **Theme toggle hidden on mobile** (`top-nav.tsx:80` `hidden sm:inline-flex`) — FR-BRAND-01's
  signature toggle is desktop-only on a mobile-first PWA.
- **Accessibility gaps vs the stated WCAG 2.1 AA goal:** back buttons are 24px and unlabeled
  (`profile:100`, `security:92`, `payments:44`, `saved:69`); saved-page filter chips aren't
  keyboard-operable (`saved/page.tsx:80`); inline edit is hover-only (invisible on touch).
- **Theming holes:** hardcoded hex (`saved/page.tsx:67`) and literal amber/red tones
  (`payments/page.tsx:16`) won't adapt in dark mode; MemberBadge tier labels are hardcoded
  English, bypassing i18n (`profile/page.tsx:438`).
- **Divergent page chrome:** every sub-page re-implements its own header/back-button/width
  instead of a shared `PageHeader` — inconsistent and drift-prone.
- **Untranslated error toasts** surface raw English server messages (`fixed-tours/[id]/page.tsx:165`).
- **No empty/error states in places:** tour detail shows an infinite skeleton on NOT_FOUND
  (`fixed-tours/[id]/page.tsx:169`).
- **Dead controls occupy prime real estate:** permanently-disabled Apple sign-in on login/register.
- **Flash-of-wrong-content:** hosts hitting `/home` see the traveler feed paint before the
  client-side bounce (`home/page.tsx:49`).

---

## 4. The full overhaul plan

The organizing principle: **stop building outward, start connecting inward.** Cut the
unbuildable Phase-2 surface, fix the five broken core loops so a real user can complete the
headline journey, then polish the shell. Everything below is scoped against your one-month
launch window.

### Strategic decision (resolve first)

**Recommended: launch a tight, working Phase-1 — descope all of Phase-2.** Specifically,
*formally cut from the launch*: Crossover Matching (§5.11 in full), Merchant QR, Real-time Meal
Balancing, Merchandise Handover, Dynamic Re-routing (applied), Loyalty/Icon Store, French.
These are either 0% on the frontend or whole features unbuilt; none can be made trustworthy in
four weeks. Keep their tested backends parked behind a feature flag for a post-launch Phase-2.

This is a genuine business decision (it changes the marketing story from "AI capacity-rescue
matching" to "curated heritage tours + à-la-carte"), so confirm it before Week 1 work starts.

### Week 1 — Unbreak the two journeys that gate everything

| # | Fix | Files |
|---|---|---|
| 1 | **Stop wiping the personality vector.** `submitOnboarding` must merge onto the existing row, not `{}`; verify home reads a non-null vector after the chat quiz | `user/profile.ts:273`, `profile-engine.ts:10` |
| 2 | **Make host verification reachable.** Wire `/host-setup` submit to `host.updateProfile` + `host.setAvailability`; add an admin `verifyHost` mutation (or auto-approve on ID submit) + a minimal admin verification surface; generate `publicSlug` in `becomeHost` | `host-setup/page.tsx:58`, `user/roles.ts:47`, `host-experience.router.ts:278` |
| 3 | **Add the "take the quiz" CTA on home** when vector is absent (closes the skip-quiz loop) | `home/page.tsx:317` |
| 4 | **Collect the nickname in the chat flow** (FR-BRAND-02 in the primary path) | `chat/page.tsx` |

**Outcome:** a traveler can onboard and *see* personalization; a host can go zero→published.

### Week 2 — Close the commerce & cancellation loops

| # | Fix | Files |
|---|---|---|
| 5 | **Apply the merch bundle discount** the UI already promises (read `bundleDiscountPct` when cart has a tour/activity; emit a `MERCH_BUNDLE` code) | `order.router.ts:266` |
| 6 | **Build `/orders` history** wired to the dead `order.getHistory`; add nav + profile entry | new page + `nav.ts` |
| 7 | **Fix payment-history labeling** — join orders, label by line, link rows to `/orders/[id]` | `payment.router.ts:362`, `payments/page.tsx:103` |
| 8 | **Implement `tour.cancelByTraveler`** with the FR-PAY-04 refund tiers + a cancel button that **shows the computed refund before confirming**; add the T−48h checkout cutoff banner | new procedure (`BOOKING.md:232` is the spec), `checkout/page.tsx` |
| 9 | **Cascade `guide_addon` on activity removal** | `cart.router.ts:501` |

**Outcome:** money flows are honest end-to-end; users can recover orders and cancel safely.

### Week 3 — Reconnect tours & navigation

| # | Fix | Files |
|---|---|---|
| 10 | **Persist `markStopVisited`** (call the existing mutation) so on-trip state survives refresh and feeds wrap-up/re-route locus | `active/page.tsx:66`, `tour.router.ts:151` |
| 11 | **Reviews → host ratings:** link review to host, recompute `avgRating`, flag <3.5 after ≥5; add guide-target + optional photos | `review.router.ts:29` |
| 12 | **Resolve the `/plan` deprecation cleanly:** either restore a minimal Customized Tour builder *or* rewrite every "Switch to Custom" / "solo escape" CTA + `migrateToCustom` landing to match the activities pivot (no dead-end statuses) | `plan/page.tsx:16`, `crossover.router.ts:267` |
| 13 | **Fix the named routes:** add a `/fixed-tours` index (or redirect to `/experiences`); disambiguate `/tours` (history) vs the catalog | `tours/page.tsx:68` |
| 14 | **Surface capacity honestly:** either implement a real seats ledger for fixed tours *or* drop the "minimum departure" framing — don't show a Warning Tag a user can't act on | `fixedTour.router.ts:312` |

**Outcome:** the tour lifecycle and the information architecture stop contradicting themselves.

### Week 4 — Shell, usability & launch hardening

| # | Fix | Files |
|---|---|---|
| 15 | **Ship a bottom nav** (PWA-correct) with the real, agreed tab set; reconcile `nav.ts` with the PRD | `top-nav.tsx`, `nav.ts:56`, new `bottom-nav` |
| 16 | **Add a marketing header to `(public)`** so logged-out visitors can move between explore/experiences/hosts/blog without dead-ending | `(public)/layout.tsx:46` |
| 17 | **Honesty pass on no-op controls:** remove or hide disabled Apple sign-in, fake 2FA, non-persistent toggles, fake "Share Location," and the incident-pick toast — *a launched product should not present actions that do nothing* | settings/security/active pages |
| 18 | **A11y + theming sweep:** 44px labeled back buttons via a shared `PageHeader`; keyboard-operable chips; replace hardcoded hex/amber with tokens; route MemberBadge + error toasts through i18n; expose theme toggle on mobile | `saved/`, `payments/`, `profile/`, `top-nav.tsx:80` |
| 19 | **Empty/error/loading states:** fix the infinite-skeleton-on-404 and add empty states where missing | `fixed-tours/[id]/page.tsx:169` |
| 20 | **E2E smoke the four launch journeys** (onboard→personalized home, host zero→published, buy→find order→cancel→refund, book fixed tour→complete→wrap-up) — the prior audit noted Playwright was dark in CI |

### Post-launch backlog (the descoped ambition, in priority order)

1. **Crossover Matching frontend** — build on the tested backend: create the chat thread + firstName/avatar reveal on accept (unblocks the dead-end), the negotiation hub (countdown + proposal widget + pinned Report wired to `reportPartner`), real Δ-branched Stripe escrow, real route-merge/coCreateRoute, and gate the discovery feed on capacity+consent. **This is the largest single chunk and is correctly a Phase-2.**
2. **Field ops** — merchant QR + sỉ pricing, meal balancing reconciliation, handover, applied dynamic re-routing, guide active-tour console + SSE.
3. **Strengthen the viral loop** — per-tour pre-built share captions (currently generic), 1h gating + "letter being written" pending state.
4. **Loyalty Points + Icon Store**, meal-reconciliation badges, French.
5. **Host marketplace depth** — archetype, accept/decline/no-show booking actions, availability actually constraining bookings.

---

## 5. What's genuinely good (don't regress these)

- **Post-tour storytelling** (wrap-up recap + Thank-you letter + idempotent wrap-up coupon) is
  well-built and on-brand — the best-realized part of the product.
- **Host authoring + earnings** — the 5-step experience wizard, autosave, server-authoritative
  validation, and the decomposed earnings dashboard with real VN-timezone math are solid.
- **Commerce safety primitives** — atomic last-seat/last-unit conditional UPDATEs, conflict
  detection shared between UI and server, refund-reverses-inventory.
- **Crossover *backend*** — sweeps, anti-overlap, the `.strict()` PII DTO, and idempotency are
  real and tested; the investment isn't wasted, it just has no UI yet.
- **i18n discipline** — 1394/1394 key parity, clean locale routing, documented brand-voice
  exceptions.

---

## Appendix — severity counts

Across the seven domains: **~14 P0**, **~22 P1**, **~25 P2**. The P0s cluster into the five
broken core loops in the TL;DR. Fixing those five (Weeks 1–2) is what converts the product from
"demo that breaks when you use it" to "launchable Phase-1."
