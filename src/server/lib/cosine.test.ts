import { describe, expect, it } from "vitest";
import { cosineSimilarity, rankByCosine } from "./cosine";
import { FIXED_TOUR_SEED } from "../db/seed-fixed-tours";

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit-direction vectors", () => {
    expect(cosineSimilarity([1, 0, 0, 0], [1, 0, 0, 0])).toBe(1);
    expect(cosineSimilarity([0.3, 0.4, 0, 0], [0.3, 0.4, 0, 0])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0, 0], [0, 1, 0, 0])).toBe(0);
  });

  it("ignores magnitude and only measures direction", () => {
    // Same direction, different magnitude — still cos = 1.
    expect(cosineSimilarity([0.5, 0.5, 0, 0], [1, 1, 0, 0])).toBeCloseTo(1, 10);
  });

  it("returns 0 when either operand has zero norm", () => {
    expect(cosineSimilarity([0, 0, 0, 0], [1, 1, 1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1, 1, 1], [0, 0, 0, 0])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 0, 0], [1, 0, 0, 0])).toThrow(RangeError);
  });
});

describe("rankByCosine", () => {
  it("orders items descending by similarity", () => {
    const userVec = [1, 0, 0, 0];
    const items = [
      { id: "a", vector: [0, 1, 0, 0] }, // orthogonal -> 0
      { id: "b", vector: [1, 0, 0, 0] }, // perfect    -> 1
      { id: "c", vector: [0.7, 0.7, 0, 0] }, // partial -> ~0.707
    ] as const;
    const ranked = rankByCosine(userVec, items);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(ranked[0].matchPercent).toBe(100);
    expect(ranked[1].matchPercent).toBe(71); // rounded from 70.71
    expect(ranked[2].matchPercent).toBe(0);
  });

  it("returns all zeros when the user vector is degenerate", () => {
    const ranked = rankByCosine([0, 0, 0, 0], [{ id: "x", vector: [1, 1, 1, 1] }]);
    expect(ranked).toEqual([{ id: "x", score: 0, matchPercent: 0 }]);
  });
});

describe("rankByCosine against the curated Fixed Tour catalog", () => {
  /**
   * The spec's section 5.3 mock test uses
   *   user_quiz_vector = [0.05, 0.05, 0.60, 0.30]
   *     (Art=0.05, History=0.05, Culinary=0.60, SlowLiving=0.30)
   * The prose describes the user as "Culinary Enthusiast + Slow Living"
   * and explicitly names Tour 1.5 (LOCO_FT_M5, Thức quà tinh khôi) as a
   * canonical match for that combination.
   *
   * Mathematically, M5's vector [0.00, 0.10, 0.80, 0.10] beats every
   * other tour for this user: its low-but-present Slow_Living component
   * tips the cosine over food-only tours like E1.
   */
  it("ranks LOCO_FT_M5 first for a culinary+slow-living user", () => {
    const userVec = [0.05, 0.05, 0.6, 0.3];
    const ranked = rankByCosine(
      userVec,
      FIXED_TOUR_SEED.map((t) => ({ id: t.tourId, vector: t.vector })),
    );
    expect(ranked[0].id).toBe("LOCO_FT_M5");
    expect(ranked[0].matchPercent).toBeGreaterThan(90);
    // E1 (pure food, no slow-living) trails M5 but should still be top-3.
    const e1Rank = ranked.findIndex((r) => r.id === "LOCO_FT_E1");
    expect(e1Rank).toBeGreaterThanOrEqual(0);
    expect(e1Rank).toBeLessThan(3);
  });

  it("ranks LOCO_FT_M2 (heritage-dominant) first for a history-only user", () => {
    const userVec = [0, 1, 0, 0];
    const ranked = rankByCosine(
      userVec,
      FIXED_TOUR_SEED.map((t) => ({ id: t.tourId, vector: t.vector })),
    );
    // M2 has the strongest heritage axis ([0.10, 0.80, 0.00, 0.10]).
    expect(ranked[0].id).toBe("LOCO_FT_M2");
  });

  it("returns ALL 15 tours in every ranking", () => {
    const ranked = rankByCosine(
      [0.25, 0.25, 0.25, 0.25],
      FIXED_TOUR_SEED.map((t) => ({ id: t.tourId, vector: t.vector })),
    );
    expect(ranked).toHaveLength(15);
    const ids = new Set(ranked.map((r) => r.id));
    expect(ids.size).toBe(15);
  });
});
