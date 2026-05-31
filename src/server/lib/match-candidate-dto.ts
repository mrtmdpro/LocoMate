/**
 * Wire schema for `match.getCandidates`. The swipe feed shows OTHER
 * onboarded travelers to the caller before any mutual like exists — so,
 * exactly like the Crossover Discovery feed (`crossover-dto.ts`), it must
 * never serialize identity. No `displayName`, no `avatarUrl`, no `email`,
 * no `phone`, and never the raw `explicit_data` / `derived_data` blobs
 * (which carry nickname, birthYear, nationality, etc.).
 *
 * The invariant is encoded in two places:
 *
 *   1. `MatchCandidateSchema` is `.strict()`, so any stray key at parse
 *      time throws before the data crosses the wire.
 *   2. The contract test (`match-candidate-dto.test.ts`) runs the shared
 *      `PII_FIELD_REGEX` over the serialized JSON.
 *
 * Identity disclosure only happens AFTER a mutual match, via the chat
 * surface which has its own auth gating. If you reach for `displayName`
 * here: STOP — add it to the post-match conversation API instead.
 */
import { z } from "zod";

/**
 * The single source of truth for what the swipe feed may expose per
 * candidate. Only non-PII signal: an opaque id, a whitelisted interest
 * list + personality projection, and the compatibility score.
 */
export const MatchCandidateSchema = z
  .object({
    /** Opaque id — the target of `match.swipe`. */
    candidateUserId: z.string().uuid(),
    /** Whitelisted interest tags drawn from the onboarding answers. */
    interests: z.array(z.string()),
    /** Human-readable personality archetype (e.g. "The Explorer"); null
     *  until the quiz is scored. Not PII. */
    personalityLabel: z.string().nullable(),
    /** 4-D personality vector, same shape as
     *  `user_profiles.derived_data.personalityVector`. Null until scored. */
    personalityVector: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .nullable(),
    /** Compatibility heuristic, 0..100. */
    compatibilityScore: z.number().int().min(0).max(100),
  })
  .strict();
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
