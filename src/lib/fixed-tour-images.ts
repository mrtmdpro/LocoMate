/**
 * URL helper for the curated Fixed Tour cinematic illustrations.
 *
 * Files live under `app/public/brand/fixed-tours/<tourId>.jpg` and are
 * served by Next's static-files handler. The filename is deterministic
 * from the tour's `tourId`, so there is no DB column and no schema
 * migration involved in shipping a new image — drop the file in place
 * and the surfaces pick it up automatically.
 *
 * Centralizing the URL pattern here means a future move to a CDN
 * (Vercel Blob, R2, etc.) is a one-line change.
 */
export function fixedTourImage(tourId: string): string {
  return `/brand/fixed-tours/${tourId}.jpg`;
}
