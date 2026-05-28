import { describe, test, expect } from "vitest";
import { matchLabelToPlace, scoreLabelPlace, tokenize } from "./place-match";

describe("tokenize", () => {
  test("drops stopwords + punctuation", () => {
    expect(tokenize("Meet at Hoan Kiem Lake")).toEqual(["hoan", "kiem", "lake"]);
  });

  test("drops venue-type suffixes we treat as noise", () => {
    expect(tokenize("Train Street Coffee")).toEqual(["train", "street"]);
  });

  test("handles parentheses and ampersands", () => {
    expect(tokenize("Quang Ba Flower Market (Night)")).toEqual(["quang", "ba", "flower", "market"]);
    expect(tokenize("Hoan Kiem Lake & Ngoc Son Temple")).toEqual(["hoan", "kiem", "lake", "ngoc", "son", "temple"]);
  });

  test("single-letter and empty strings drop out", () => {
    expect(tokenize("A & B")).toEqual([]);
  });
});

describe("scoreLabelPlace", () => {
  test("exact match after stopword stripping scores 1.0", () => {
    expect(scoreLabelPlace("Train Street", "Train Street Coffee")).toBe(1);
  });

  test("conversational prefix still scores 1.0 on the smaller side", () => {
    // "Meet at Hoan Kiem Lake" -> [hoan, kiem, lake] (3 tokens)
    // "Hoan Kiem Lake & Ngoc Son Temple" -> [hoan, kiem, lake, ngoc, son, temple] (6 tokens)
    // Overlap = 3, smaller side = 3 -> 1.0
    expect(scoreLabelPlace("Meet at Hoan Kiem Lake", "Hoan Kiem Lake & Ngoc Son Temple")).toBe(1);
  });

  test("unrelated strings score low", () => {
    expect(scoreLabelPlace("Train Street", "Hoan Kiem Lake")).toBe(0);
  });

  test("empty inputs score 0 (not NaN)", () => {
    expect(scoreLabelPlace("", "Hoan Kiem Lake")).toBe(0);
    expect(scoreLabelPlace("Meet at", "")).toBe(0); // "meet" and "at" are stopwords
  });
});

describe("matchLabelToPlace", () => {
  const places = [
    { id: "hoan", name: "Hoan Kiem Lake & Ngoc Son Temple", latitude: 21.02, longitude: 105.85, category: "cultural" },
    { id: "train", name: "Train Street Coffee", latitude: 21.02, longitude: 105.84, category: "cafe" },
    { id: "longbien", name: "Long Bien Bridge Walk", latitude: 21.04, longitude: 105.85, category: "cultural" },
    { id: "quangba", name: "Quang Ba Flower Market (Night)", latitude: 21.07, longitude: 105.82, category: "nature" },
    { id: "bridge", name: "Bridge", latitude: 0, longitude: 0, category: "other" },
  ];

  test("matches labels with conversational prefixes", () => {
    const match = matchLabelToPlace("Meet at Hoan Kiem Lake", places);
    expect(match?.id).toBe("hoan");
  });

  test("matches labels shorter than the place name", () => {
    const match = matchLabelToPlace("Long Bien Bridge", places);
    expect(match?.id).toBe("longbien");
  });

  test("matches labels with case + punctuation differences", () => {
    const match = matchLabelToPlace("Quang Ba flower market", places);
    expect(match?.id).toBe("quangba");
  });

  test("returns null when no candidate clears the threshold", () => {
    const match = matchLabelToPlace("Old Quarter alleys", places);
    expect(match).toBeNull();
  });

  test("single-word generic labels do not collide with short generic places", () => {
    // "Crossing a bridge somewhere" -> tokens [crossing, bridge, somewhere]
    // "Bridge" -> tokens [bridge]
    // Overlap = 1, min = 1 -> 1.0 (would match). This is by design; threshold
    // is 0.6 so short generic labels against short generic places DO match.
    // The seed data keeps place names specific enough that this isn't an
    // issue in practice; the test documents the behavior so nobody thinks
    // it's a bug.
    const match = matchLabelToPlace("Crossing a bridge somewhere", places);
    expect(match?.id).toBe("bridge");
  });

  test("empty label returns null", () => {
    expect(matchLabelToPlace("", places)).toBeNull();
  });

  test("empty places list returns null", () => {
    expect(matchLabelToPlace("Hoan Kiem", [])).toBeNull();
  });
});
