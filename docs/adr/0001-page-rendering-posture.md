# ADR 0001 — Page-rendering posture (CSR vs RSC)

- **Status:** Accepted
- **Date:** 2026-06-04
- **Context source:** Codebase audit 2026-05-29, Cluster E (Arch H1 / Perf C2)
- **Deciders:** Engineering

## Context

The audit flagged that **all 56 page routes (and ~91 `.tsx` modules) declare `"use client"`**. Every page-level component — including read-only public marketing/catalog surfaces — ships to the browser as JS and renders client-side. Combined with raw `<img>` serving multi-MB brand JPEGs (Perf C2), this hurts LCP and bundle size on mobile, and forfeits SEO/streaming benefits on the public surfaces.

Relevant facts about the current architecture:

- **Auth** is now an httpOnly session cookie gated in `src/middleware.ts` (Cluster C). Server Components *can* read auth state — the historical blocker (auth lived only in a client-side Zustand/localStorage store) is gone.
- **Data** flows through tRPC client + TanStack Query in the browser. A server-side tRPC caller exists and could feed Server Components directly.
- **Interactivity** is genuine and pervasive on the authenticated app: match swiping, chat, the plan builder, cart, framer-motion page transitions, Zustand stores.
- **i18n** (`next-intl`) supports both Server and Client Components.

A wholesale CSR→RSC migration would be large and regression-prone for little gain on the interactive surfaces, while the public read-only surfaces are exactly where RSC pays off.

## Decision

Adopt a **client-first shell, RSC-by-default for new public read-only routes** posture:

1. **Do not** undertake a blanket RSC migration of the existing authenticated app shell (`(main)`, `(auth)` interactive flows). These are legitimately client-heavy; leave them CSR.
2. **Default new pages to Server Components.** A route may only add `"use client"` when it actually uses client-only features (hooks, browser APIs, event handlers, framer-motion, Zustand, tRPC client). "Reaches for a hook somewhere in the subtree" is not sufficient — push the `"use client"` boundary down to the smallest interactive leaf.
3. **Migrate the public, read-mostly surfaces opportunistically** (not in this change), in priority order: `/[locale]` (landing), `/explore`, `/experiences`, `/activities`, `/fixed-tours/[id]`, `/hosts/[slug]`. These are SEO- and LCP-sensitive and read their data server-side via the tRPC server caller, keeping only interactive islands (filters, save buttons) as client leaves.
4. **Treat `next/image` as the immediate, posture-independent perf lever.** Shipped in this change: brand masters re-encoded (245 MB → 41 MB) and every content-photo `<img>` swapped to `next/image`. This stands whether or not a route later moves to RSC.

### Guardrail to prevent drift

- New `"use client"` at the top of a *page* file should be justified in review. Prefer a server page that renders client islands.
- `next/image` is the default for content/photo imagery. Raw `<img>` is reserved for: Leaflet map popups, brand logo/icon lockups with bespoke CSS composition (`official-icons`, `wax-seal`), and `blob:`/object-URL upload previews — each annotated with `// eslint-disable-next-line @next/next/no-img-element`.

## Consequences

- **Positive:** Immediate mobile-bandwidth and LCP win from the image pipeline; a clear, low-friction rule that stops the all-`"use client"` sprawl from growing; public surfaces have a defined migration path that the Cluster C auth refactor already unblocked.
- **Negative / deferred:** The existing public pages stay CSR until migrated individually; this ADR intentionally does not schedule that work. Mixing RSC and CSR pages requires reviewers to understand the boundary rule.
- **Revisit when:** public-surface Core Web Vitals (post-image-fix) still miss targets, or SEO requirements force server-rendered HTML for the catalog routes sooner.
