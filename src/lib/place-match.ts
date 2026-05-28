/**
 * Best-effort fuzzy matching between a free-form schedule label (e.g.
 * "Meet at Hoan Kiem Lake") and a list of Hanoi places seeded in the DB
 * (e.g. "Hoan Kiem Lake & Ngoc Son Temple"). Used in two places:
 *
 *   1. `experience.book` when a tour is created from a host-authored
 *      experience. The experience's `schedule` is a narrative timeline with
 *      labels but no place references; we match each label against the
 *      places table to pin geo-coordinates onto the persisted tour stops.
 *   2. The backfill script that repairs legacy tours created before this
 *      matching existed.
 *
 * Strategy: token-set overlap, case-insensitive, stopwords removed. A
 * match requires >= 60% token overlap relative to the SMALLER token set,
 * so a 3-token label matching 3 of 5 place tokens counts as a match.
 *
 * Why not substring? A naive `label.includes(place.name)` fails for the
 * common case where labels are SHORTER than place names ("Long Bien Bridge"
 * vs "Long Bien Bridge Walk"), and vice versa fails when labels contain
 * conversational prefixes ("Meet at Hoan Kiem Lake" vs "Hoan Kiem Lake").
 */

const STOPWORDS = new Set([
  "the", "a", "an", "at", "in", "on", "of", "and", "or", "by", "to", "for",
  "meet", "start", "end", "drop", "pickup", "pick", "up", "off", "from",
  // Venue-type suffixes that add noise when the core name is what matters.
  "walk", "coffee", "cafe", "bar", "restaurant", "tea", "shop",
  "night", "day", "morning", "evening",
]);

/** Tokenise into lowercase words with punctuation + stopwords dropped. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[()&,.'"!?/\\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * 0..1 score of how well `label` aligns with `placeName`. Returns 0 when
 * either side has no significant tokens.
 */
export function scoreLabelPlace(label: string, placeName: string): number {
  const labelTokens = tokenize(label);
  const placeTokens = tokenize(placeName);
  if (labelTokens.length === 0 || placeTokens.length === 0) return 0;
  const labelSet = new Set(labelTokens);
  const overlap = placeTokens.filter((t) => labelSet.has(t)).length;
  return overlap / Math.min(labelTokens.length, placeTokens.length);
}

export interface PlaceCandidate {
  id: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  category: string;
}

/**
 * Match the label against the best-scoring place. Returns `null` when no
 * candidate clears the threshold; caller should fall back to `placeId: null`
 * so the tour stop still renders without coordinates.
 *
 * `threshold` defaults to 0.6 (60% token overlap on the smaller side) --
 * high enough to rule out accidental overlap (e.g. "Street" alone) but low
 * enough to catch real matches with extra venue-type words on either side.
 */
export function matchLabelToPlace<T extends PlaceCandidate>(
  label: string,
  places: T[],
  threshold = 0.6,
): T | null {
  if (!label || places.length === 0) return null;
  let best: T | null = null;
  let bestScore = threshold;
  for (const place of places) {
    const score = scoreLabelPlace(label, place.name);
    if (score > bestScore) {
      best = place;
      bestScore = score;
    }
  }
  return best;
}
