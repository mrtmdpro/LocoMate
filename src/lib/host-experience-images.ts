/**
 * URL helper for the brand's cinematic illustrations of the seeded
 * host-authored experiences.
 *
 * Unlike the Fixed Tour catalog (where every `tour_id` is deterministic),
 * host listings get arbitrary slugs at runtime via the host wizard. The
 * brand-illustration override is OPT-IN per slug: only the seeded set
 * gets a custom image, and host-created listings continue to use their
 * own uploaded photos. The allowlist below is the source of truth.
 *
 * Files live under `app/public/brand/host-experiences/<slug>.jpg` and
 * are served by Next's static-files handler.
 */

const KNOWN_HOST_EXPERIENCE_SLUGS: Record<string, true> = {
  "hidden-alley-food-crawl": true,
  "motorbike-night-photo-tour": true,
  "breakfast-pho-pilgrimage": true,
  "colonial-hanoi-walking-tour": true,
  "thousand-year-stories-old-quarter": true,
  "french-quarter-train-street": true,
  "specialty-coffee-crawl": true,
  "art-gallery-hop": true,
  "bat-trang-ceramic-village": true,
};

/**
 * Returns the brand-illustration URL for a seeded host experience slug,
 * or `null` for any other (or missing) slug. Callers should prefer this
 * over the host's uploaded `photos[0]`:
 *
 *   const photo = hostExperienceImage(exp.slug) ?? exp.photos?.[0];
 */
export function hostExperienceImage(
  slug: string | null | undefined,
): string | null {
  if (!slug || !KNOWN_HOST_EXPERIENCE_SLUGS[slug]) return null;
  return `/brand/host-experiences/${slug}.jpg`;
}
