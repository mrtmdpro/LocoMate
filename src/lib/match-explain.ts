/**
 * Match-explanation helpers for the 4-D cultural personality vector.
 *
 * Source-of-truth for the axis order is `userProfiles.derivedData.personalityVector`
 * and matches the order documented in `app/src/lib/quiz-questions.ts`:
 *
 *   index 0 → craft       → Art_Aesthetic
 *   index 1 → heritage    → Deep_History_Heritage
 *   index 2 → food        → Culinary_Enthusiast
 *   index 3 → quiet       → Slow_Living
 *
 * Keep this constant in lockstep with `quiz-questions.ts`. Tests in
 * `match-explain.test.ts` enforce the contract.
 */

/** Stable axis index → i18n key. The string keys map to
 *  `experiences.topMatch.axis.*` in the message catalogues. */
export const AXIS_KEYS = ["art", "history", "culinary", "slowLiving"] as const;

export type AxisKey = (typeof AXIS_KEYS)[number];

/**
 * Returns the indices of the top `n` axes that contribute most to the
 * dot product between `userVec` and `tourVec`. Indices are sorted by
 * contribution descending.
 *
 * The cosine similarity that drives `matchPercent` is the normalised
 * dot product `(u · v) / (|u| · |v|)`. Each axis i contributes
 * `u[i] * v[i]` to the unnormalised dot product. The normalisation is a
 * constant across axes, so the per-axis ordering is unchanged whether
 * we compare raw products or normalised contributions — and the raw
 * form is what callers want when explaining "why this tour fits you":
 * an axis with `u[i]=0.6, v[i]=0.8` (contribution 0.48) outranks one
 * with `u[i]=0.2, v[i]=0.9` (contribution 0.18) regardless of
 * normalisation.
 *
 * Returns an empty array on dimension mismatch or non-positive `n` —
 * callers should treat that as "no explanation available" and hide the
 * why-it-fits line rather than fall through to a wrong axis.
 */
export function topContributingAxes(
  userVec: readonly number[],
  tourVec: readonly number[],
  n: number,
): number[] {
  if (userVec.length === 0 || userVec.length !== tourVec.length) return [];
  if (n <= 0) return [];

  const contributions: Array<{ index: number; value: number }> = [];
  for (let i = 0; i < userVec.length; i++) {
    contributions.push({ index: i, value: userVec[i] * tourVec[i] });
  }
  contributions.sort((a, b) => b.value - a.value);

  // If the top contribution is 0, no axis explains the match (either the
  // user vector or the tour vector is all-zero on the overlapping
  // dimensions). Return empty so the UI hides the explanation rather
  // than asserting a meaningless "strongest" axis.
  if (contributions[0]!.value === 0) return [];

  return contributions.slice(0, Math.min(n, contributions.length)).map((c) => c.index);
}
