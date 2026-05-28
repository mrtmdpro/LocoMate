/**
 * URL helper for the cinematic preview image of a curated atom (an
 * activity backfilled from a Fixed Tour step by
 * `lib/backfill-fixed-tour-atoms`). Files live under
 * `app/public/brand/activities/<slug>.jpg` and are served by Next's
 * static-files handler, so the filename is deterministic from the
 * activity's `slug` and shipping a new image is "drop the file in
 * place".
 *
 * Mirrors the `fixedTourImage` / `merchImage` / `hostExperienceImage`
 * pattern so a future move to a CDN (Vercel Blob, R2, etc.) is a
 * one-line change here.
 *
 * Returns `null` for activities that don't have a deterministic
 * cinematic — currently anything outside the curator's atom catalog
 * (host-authored activities, custom listings) — so callers can fall
 * back to the emoji placeholder instead of pointing an `<img>` at a
 * 404.
 */
export function activityImage(slug: string | null | undefined): string | null {
  if (!slug) return null;
  // Only atoms have curated cinematics shipped as static files. Real
  // host-authored activities use whatever photos the host uploaded
  // (rendered from `activity.photos[]` directly).
  if (!slug.startsWith("atom-")) return null;
  return `/brand/activities/${slug}.jpg`;
}
