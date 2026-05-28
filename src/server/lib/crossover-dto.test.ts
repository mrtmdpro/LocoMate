import { describe, expect, it } from "vitest";
import {
  DiscoveryCandidateSchema,
  DiscoveryFeedSchema,
  PII_FIELD_REGEX,
  type DiscoveryCandidate,
} from "./crossover-dto";

/**
 * Contract tests for the Crossover Matching Discovery DTO.
 *
 * The Discovery Mode (T-36h, see docs/fixed-tour-feature.md Luồng 2)
 * exposes a feed of candidate matches to the requester WITHOUT
 * disclosing identity. The tests below enforce that invariant in two
 * ways: (1) the Zod schema parses valid candidates; (2) the wire JSON
 * never contains any field name matching `PII_FIELD_REGEX`.
 *
 * If you find yourself trying to "just add displayName for the
 * preview card", these tests will catch it. Don't shim around them.
 * Identity disclosure only happens AFTER both sides accept the match
 * (Luồng 3), via a separate chat-context API.
 */

const validCandidate: DiscoveryCandidate = {
  candidateUserId: "00000000-0000-0000-0000-000000000001",
  personalityVector: [0.25, 0.25, 0.25, 0.25],
  matchPercent: 87,
  ageBracket: "25_34",
  nationality: "VN",
  tourId: "00000000-0000-0000-0000-000000000002",
  tourRoute: {
    chapter: "MORNING_SHIFT",
    fixedTourId: "LOCO_FT_M1",
    summaryVi: "Bình minh phố cổ",
    summaryEn: "Old Quarter sunrise",
  },
};

describe("DiscoveryCandidateSchema", () => {
  it("parses a well-formed candidate", () => {
    const result = DiscoveryCandidateSchema.safeParse(validCandidate);
    expect(result.success).toBe(true);
  });

  it("rejects a candidate with an injected displayName (.strict)", () => {
    const leaked = { ...validCandidate, displayName: "Alex Nguyen" };
    const result = DiscoveryCandidateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/unrecognized_keys/i);
    }
  });

  it("rejects a candidate with an injected avatarUrl (.strict)", () => {
    const leaked = {
      ...validCandidate,
      avatarUrl: "https://example.com/avatar.png",
    };
    const result = DiscoveryCandidateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
  });

  it("rejects a candidate with an injected email (.strict)", () => {
    const leaked = { ...validCandidate, email: "alex@example.com" };
    const result = DiscoveryCandidateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
  });

  it("rejects a candidate with an injected phone (.strict)", () => {
    const leaked = { ...validCandidate, phone: "+84-90-1234567" };
    const result = DiscoveryCandidateSchema.safeParse(leaked);
    expect(result.success).toBe(false);
  });

  it("enforces ISO-3166-1 alpha-2 length on nationality", () => {
    const tooLong = { ...validCandidate, nationality: "Vietnam" };
    const result = DiscoveryCandidateSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
  });

  it("enforces matchPercent in 0..100", () => {
    const oob = { ...validCandidate, matchPercent: 187 };
    const result = DiscoveryCandidateSchema.safeParse(oob);
    expect(result.success).toBe(false);
  });

  it("enforces personality vector is 4-tuple", () => {
    const shortVec = { ...validCandidate, personalityVector: [0.5, 0.5] };
    const result = DiscoveryCandidateSchema.safeParse(shortVec);
    expect(result.success).toBe(false);
  });
});

describe("PII_FIELD_REGEX (defence-in-depth)", () => {
  it("matches displayName, firstName, lastName, fullName, name", () => {
    expect('{"displayName":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"firstName":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"lastName":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"fullName":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"name":"x"}').toMatch(PII_FIELD_REGEX);
  });

  it("matches avatar, avatarUrl, email, phone", () => {
    expect('{"avatar":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"avatarUrl":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"email":"x"}').toMatch(PII_FIELD_REGEX);
    expect('{"phone":"x"}').toMatch(PII_FIELD_REGEX);
  });

  it("does NOT match candidate-safe field names", () => {
    // These look adjacent to PII but are explicitly safe in our schema.
    expect('{"candidateUserId":"x"}').not.toMatch(PII_FIELD_REGEX);
    expect('{"nationality":"VN"}').not.toMatch(PII_FIELD_REGEX);
    expect('{"ageBracket":"25_34"}').not.toMatch(PII_FIELD_REGEX);
    expect('{"matchPercent":80}').not.toMatch(PII_FIELD_REGEX);
    expect('{"tourId":"x"}').not.toMatch(PII_FIELD_REGEX);
  });
});

describe("Wire-shape PII scan on a sample feed", () => {
  /**
   * The strongest invariant in the whole feature. Whatever we send
   * across the wire must NOT contain any PII field name. This test
   * walks a sample feed JSON and asserts the regex finds nothing.
   */
  it("a fully populated feed contains no PII fields when stringified", () => {
    const sampleFeed = {
      candidates: [
        validCandidate,
        {
          ...validCandidate,
          candidateUserId: "00000000-0000-0000-0000-000000000099",
          matchPercent: 64,
          ageBracket: "35_44" as const,
          nationality: "US",
          tourRoute: {
            chapter: "EVENING_SHIFT" as const,
            fixedTourId: null,
            summaryVi: "Đêm phố cổ",
            summaryEn: "Old Quarter night",
          },
        },
      ],
      voucherBurned: true,
      feedGeneratedAt: new Date().toISOString(),
    };
    const result = DiscoveryFeedSchema.safeParse(sampleFeed);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const json = JSON.stringify(result.data);
    expect(json).not.toMatch(PII_FIELD_REGEX);
  });
});
