import { slugify } from "@/lib/slugify";

/**
 * Deterministic, unique-by-construction public slug for a host profile.
 * Pairs the slugified display name with an 8-char fragment of the (UUID)
 * userId, so `/hosts/:slug` stays human-readable AND collision-free without a
 * uniqueness lookup. Falls back to "guide" when the display name slugifies to
 * empty. Capped well under the `host_profiles.public_slug` varchar(80) limit.
 *
 * Used at host creation (`becomeHost`, `host.completeSetup`) and as a backfill
 * for legacy rows. Without a slug, `host.listPublic` / `getPublicProfile`
 * exclude the host entirely (they require `public_slug IS NOT NULL`), so a
 * real host would never appear in the `/hosts` directory.
 */
export function hostPublicSlug(
  displayName: string | null,
  userId: string,
): string {
  const base = slugify(displayName ?? "").slice(0, 60) || "guide";
  return `${base}-${userId.slice(0, 8)}`;
}
