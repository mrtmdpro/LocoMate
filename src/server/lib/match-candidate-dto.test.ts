import { describe, expect, it } from "vitest";
import { MatchCandidateSchema, type MatchCandidate } from "./match-candidate-dto";
import { PII_FIELD_REGEX } from "./crossover-dto";

/**
 * Contract tests for the swipe-feed candidate DTO (`match.getCandidates`).
 *
 * Like the Crossover Discovery feed, the swipe feed exposes OTHER
 * travelers BEFORE any mutual match — so it must never disclose identity.
 * These tests enforce that invariant two ways: (1) the `.strict()` schema
 * rejects unknown keys; (2) the shared `PII_FIELD_REGEX` finds nothing in
 * the serialized output.
 */

const validCandidate: MatchCandidate = {
  candidateUserId: "00000000-0000-0000-0000-000000000001",
  interests: ["coffee", "history"],
  personalityLabel: "The Explorer",
  personalityVector: [0.25, 0.25, 0.25, 0.25],
  compatibilityScore: 72,
};

describe("MatchCandidateSchema", () => {
  it("parses a well-formed candidate", () => {
    expect(MatchCandidateSchema.safeParse(validCandidate).success).toBe(true);
  });

  it("allows null personality fields (quiz not yet scored)", () => {
    const result = MatchCandidateSchema.safeParse({
      ...validCandidate,
      personalityLabel: null,
      personalityVector: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an injected displayName (.strict)", () => {
    const leaked = { ...validCandidate, displayName: "Alex Nguyen" };
    const result = MatchCandidateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/unrecognized_keys/i);
    }
  });

  it("rejects an injected avatarUrl (.strict)", () => {
    const leaked = { ...validCandidate, avatarUrl: "https://example.com/a.png" };
    expect(MatchCandidateSchema.safeParse(leaked).success).toBe(false);
  });

  it("rejects raw explicitData / derivedData blobs (.strict)", () => {
    const leaked = {
      ...validCandidate,
      explicitData: { nickname: "alex", birthYear: 1990 },
      derivedData: { personalityVector: [1, 2, 3, 4] },
    };
    expect(MatchCandidateSchema.safeParse(leaked).success).toBe(false);
  });

  it("enforces compatibilityScore in 0..100", () => {
    expect(
      MatchCandidateSchema.safeParse({ ...validCandidate, compatibilityScore: 187 }).success,
    ).toBe(false);
  });
});

describe("Wire-shape PII scan on a sample swipe feed", () => {
  it("a fully populated feed contains no PII field names when stringified", () => {
    const feed = [
      validCandidate,
      {
        ...validCandidate,
        candidateUserId: "00000000-0000-0000-0000-000000000099",
        interests: [],
        personalityLabel: null,
        personalityVector: null,
        compatibilityScore: 41,
      },
    ].map((c) => MatchCandidateSchema.parse(c));

    expect(JSON.stringify(feed)).not.toMatch(PII_FIELD_REGEX);
  });
});
