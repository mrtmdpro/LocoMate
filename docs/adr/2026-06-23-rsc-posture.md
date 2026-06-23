# ADR: Incremental Server Component Posture

Date: 2026-06-23

## Status

Accepted

## Context

Most route entries in `src/app` were client components. That kept the app easy
to build while product surfaces were changing quickly, but it also meant
read-heavy public pages shipped more client JavaScript than necessary.

## Decision

Move toward server route entries with client islands instead of keeping every
page file client-only. Interactive widgets may remain client components, but
the route entry should stay server-rendered whenever it can.

The first migrated route is `/[locale]/experiences`:

- `page.tsx` is now a server component entry.
- `experiences-client.tsx` owns the interactive tRPC, locale, animation, and
  client-side island behavior.

## Consequences

- New public catalogue/detail routes should default to server page entries.
- Existing routes can migrate incrementally without changing user-facing URLs.
- Data fetching can move from client tRPC to server-side reads in later passes
  once the router/service boundaries are ready.
