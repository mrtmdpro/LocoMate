import { describe, expect, it } from "vitest";
import {
  readExplicitData,
  readDerivedData,
  mergeExplicitData,
  mergeDerivedData,
  type ExplicitData,
  type DerivedData,
} from "./profile-shape";

describe("readExplicitData", () => {
  it("parses a valid explicit-data row and preserves unknown legacy keys", () => {
    const row = {
      nickname: "Mai",
      themePref: "dark",
      consentMatching: true,
      aiTone: "hom-hinh",
      tourPreferences: { guideStyle: "buddy" },
      legacyFlag: "kept",
    };
    const parsed = readExplicitData(row);
    expect(parsed.nickname).toBe("Mai");
    expect(parsed.themePref).toBe("dark");
    expect(parsed.consentMatching).toBe(true);
    expect(parsed.aiTone).toBe("hom-hinh");
    expect(parsed.tourPreferences?.guideStyle).toBe("buddy");
    // `.passthrough()` keeps keys the schema does not model.
    expect(parsed.legacyFlag).toBe("kept");
  });

  it("falls back to {} for a drifted/garbage row instead of throwing", () => {
    // themePref must be a "light"|"dark" enum; a number is drift.
    expect(readExplicitData({ themePref: 123 })).toEqual({});
    expect(readExplicitData(null)).toEqual({});
    expect(readExplicitData(undefined)).toEqual({});
    expect(readExplicitData("not-an-object")).toEqual({});
  });
});

describe("readDerivedData", () => {
  it("parses a valid derived-data row", () => {
    const parsed = readDerivedData({
      personalityVector: [0.1, 0.2, 0.3, 0.4],
      personalityLabel: "The Deep Explorer",
      personality: { curiosity: 0.7 },
    });
    expect(parsed.personalityVector).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(parsed.personalityLabel).toBe("The Deep Explorer");
    expect(parsed.personality?.curiosity).toBe(0.7);
  });

  it("falls back to {} when the personality vector is the wrong length", () => {
    // A 3-element vector is drift -> whole parse fails -> safe default.
    expect(readDerivedData({ personalityVector: [1, 2, 3] })).toEqual({});
    expect(readDerivedData({ personalityVector: "nope" })).toEqual({});
    expect(readDerivedData(null)).toEqual({});
  });
});

describe("mergeExplicitData", () => {
  it("shallow-merges a patch onto the existing row", () => {
    const merged = mergeExplicitData(
      { nickname: "Mai", themePref: "light" },
      { themePref: "dark" },
    );
    expect(merged.nickname).toBe("Mai");
    expect(merged.themePref).toBe("dark");
  });

  it("reads a drifted existing row leniently before merging", () => {
    // Existing row has a bad themePref; it is dropped, the patch applies.
    const merged = mergeExplicitData({ themePref: 999 }, { nickname: "Lan" });
    expect(merged.nickname).toBe("Lan");
    expect(merged.themePref).toBeUndefined();
  });

  it("throws when a known field is written with the wrong type", () => {
    expect(() =>
      mergeExplicitData({}, { birthYear: "1990" } as unknown as Partial<ExplicitData>),
    ).toThrow();
  });
});

describe("mergeDerivedData", () => {
  it("throws when the personality vector is malformed on write", () => {
    expect(() =>
      mergeDerivedData(
        {},
        { personalityVector: [1, 2, 3] } as unknown as Partial<DerivedData>,
      ),
    ).toThrow();
  });
});
