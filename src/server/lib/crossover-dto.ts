/**
 * Wire schemas for the Crossover Matching API. The Discovery Feed DTO
 * is the SINGLE BIGGEST trust failure mode of the whole feature — it
 * must never serialize `displayName`, `avatarUrl`, `email`, `phone`,
 * or any other PII.
 *
 * The invariant is encoded in TWO places:
 *
 *   1. The Zod schema below uses `.strict()` so any extra key in the
 *      object at parse time throws. Adding a `displayName` here trips
 *      the contract test in crossover-dto.test.ts.
 *
 *   2. The contract test runs a regex sweep over the serialized JSON
 *      to catch any field that even SMELLS like PII before the build
 *      can pass.
 *
 * If you find yourself reaching for `displayName` on the Discovery
 * Mode card: STOP. Identity disclosure only happens AFTER both sides
 * accept the match (per `docs/fixed-tour-feature.md` Luồng 3). The
 * post-match chat reads identity via `chat.getConversation`, which
 * has its own auth gating.
 */
import { z } from "zod";

/** Pre-computed bucket — the actual birth year stays on the user row. */
export const AgeBracketSchema = z.enum(["under_25", "25_34", "35_44", "45_plus"]);
export type AgeBracket = z.infer<typeof AgeBracketSchema>;

export const ChapterSchema = z.enum([
  "MORNING_SHIFT",
  "AFTERNOON_SHIFT",
  "EVENING_SHIFT",
]);

/**
 * Tour-route summary shown on the discovery card. Includes the chapter
 * name + bilingual one-line summary; no place names, no addresses (the
 * exact venue could re-identify a tour with very few participants).
 */
export const TourRouteSummarySchema = z
  .object({
    chapter: ChapterSchema,
    fixedTourId: z.string().nullable(),
    summaryVi: z.string(),
    summaryEn: z.string(),
  })
  .strict();
export type TourRouteSummary = z.infer<typeof TourRouteSummarySchema>;

/**
 * The single source of truth for what the anonymous Discovery feed
 * may return per candidate. `.strict()` ensures the runtime parser
 * rejects unknown keys — a future PR that accidentally adds
 * `displayName` to the SELECT will fail this parse before reaching
 * the wire.
 */
export const DiscoveryCandidateSchema = z
  .object({
    /** Opaque id used as the target of `sendCrossoverRequest`. */
    candidateUserId: z.string().uuid(),
    /** 4-D personality vector projected from the quiz. Same shape as
     *  `user_profiles.derivedData.personalityVector`. */
    personalityVector: z.tuple([
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
    /** Cosine similarity, rounded to a percentage 0..100. */
    matchPercent: z.number().int().min(0).max(100),
    /** Pre-computed bucket — no raw birth year. */
    ageBracket: AgeBracketSchema,
    /** ISO-3166-1 alpha-2 country code. Two letters only — never a
     *  full nationality string that could pair with avatar absence to
     *  re-identify a rare combination. */
    nationality: z.string().length(2),
    /** The peer's tour we'd be joining. */
    tourId: z.string().uuid(),
    tourRoute: TourRouteSummarySchema,
  })
  .strict();
export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;

export const DiscoveryFeedSchema = z
  .object({
    candidates: z.array(DiscoveryCandidateSchema),
    voucherBurned: z.boolean(),
    feedGeneratedAt: z.string().datetime(),
  })
  .strict();
export type DiscoveryFeed = z.infer<typeof DiscoveryFeedSchema>;

/**
 * Regex used by the contract test. ANY substring matching this in the
 * serialized JSON output fails the build. Case-insensitive, deliberately
 * over-broad — catches `displayName`, `firstName`, `lastName`, `fullName`,
 * `name` on its own, `avatar`, `avatarUrl`, `email`, `phone`, etc.
 */
export const PII_FIELD_REGEX =
  /"(display|first|last|full)?name"|"avatar(url)?"|"email"|"phone"/i;
