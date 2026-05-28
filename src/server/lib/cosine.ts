/**
 * Cosine-similarity matcher for the Fixed Tour catalog.
 *
 * The spec at `docs/sửa .md` section 5.3 proposes a Python microservice;
 * we keep the math in-process because 15 tours × 4 floats is trivially
 * cheap to compute on each request. Same algorithm, fewer moving parts.
 *
 * Convention: caller-provided vectors are RAW (not unit-normalized).
 * `cosineSimilarity` does the normalization internally. A zero-norm
 * vector (user has not completed the quiz, or all weights are 0) yields
 * a score of 0 — the consumer is expected to fall back to a default
 * ordering when this happens.
 */

/**
 * Cosine similarity in [0, 1] for non-negative vectors, returning 0
 * if either operand has zero magnitude. Dimensions must match; mismatched
 * lengths throw a `RangeError` so a quiz-vector schema change can't
 * silently corrupt rankings.
 */
export function cosineSimilarity(u: readonly number[], v: readonly number[]): number {
  if (u.length !== v.length) {
    throw new RangeError(
      `cosineSimilarity: dimension mismatch (${u.length} vs ${v.length})`,
    );
  }
  let dot = 0;
  let normU = 0;
  let normV = 0;
  for (let i = 0; i < u.length; i++) {
    const ui = u[i];
    const vi = v[i];
    dot += ui * vi;
    normU += ui * ui;
    normV += vi * vi;
  }
  if (normU === 0 || normV === 0) return 0;
  return dot / (Math.sqrt(normU) * Math.sqrt(normV));
}

export interface RankableItem<TId extends string> {
  id: TId;
  vector: readonly number[];
}

export interface RankedItem<TId extends string> {
  id: TId;
  /** Cosine similarity in [0, 1]. */
  score: number;
  /** Rounded percentage in [0, 100], suitable for UI display ("92% match"). */
  matchPercent: number;
}

/**
 * Rank a list of items against a user vector by cosine similarity.
 * Items are returned in descending order of score (best match first).
 *
 * Behaviour when the user vector is zero-norm: every item gets a score
 * of 0; the original `items` order is preserved (since `Array.sort` is
 * stable in modern V8). UI consumers typically check for `score === 0`
 * and fall back to a catalog-natural ordering in that case.
 */
export function rankByCosine<TId extends string>(
  userVector: readonly number[],
  items: ReadonlyArray<RankableItem<TId>>,
): RankedItem<TId>[] {
  const scored = items.map<RankedItem<TId>>((item) => {
    const score = cosineSimilarity(userVector, item.vector);
    return {
      id: item.id,
      score,
      matchPercent: Math.round(score * 100),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
