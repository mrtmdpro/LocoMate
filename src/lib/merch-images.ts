/**
 * URL helper for Locomate-branded merch product photos.
 *
 * Files live under `app/public/brand/merch/<slug>.jpg` and are served by
 * Next's static-files handler. The filename is deterministic from the
 * product's `slug`, so there is no DB column to keep in sync — drop a
 * new file and every surface picks it up automatically.
 *
 * Mirrors the `fixedTourImage` / host-experience-image pattern so a
 * future move to a CDN (Vercel Blob, R2, etc.) is a one-line change
 * here. The seed and the `backfill-merch-photos` script also call this
 * helper, so the on-disk filename and the DB column stay aligned by
 * construction.
 *
 * The consumer pattern at every render site is:
 *
 *   const photoUrl = p.slug ? merchImage(p.slug) : p.photos?.[0];
 *
 * The `photos?.[0]` fallback keeps host-authored merch (FOLLOW-10) and
 * any non-curated row working without a slug round-trip.
 */
export function merchImage(slug: string): string {
  return `/brand/merch/${slug}.jpg`;
}
