import { describe, expect, test } from "vitest";
import { AXIS_KEYS, topContributingAxes } from "./match-explain";

describe("AXIS_KEYS", () => {
  test("the four 4-D vector axes are stable and ordered as documented", () => {
    // Order MUST match the personality vector layout in
    // app/src/lib/quiz-questions.ts. If quiz-questions ever reorders, this
    // test should fail so we update both in lockstep.
    expect(AXIS_KEYS).toEqual(["art", "history", "culinary", "slowLiving"]);
  });
});

describe("topContributingAxes", () => {
  test("returns the indices sorted descending by per-axis contribution", () => {
    // u·v contributions: [0.05, 0.30, 0.48, 0.06]
    //   → sorted desc: 2 (culinary), 1 (history), 3 (slow), 0 (art)
    const userVec = [0.1, 0.3, 0.6, 0.2];
    const tourVec = [0.5, 1.0, 0.8, 0.3];
    expect(topContributingAxes(userVec, tourVec, 2)).toEqual([2, 1]);
    expect(topContributingAxes(userVec, tourVec, 4)).toEqual([2, 1, 3, 0]);
  });

  test("matches the canonical 'culinary + slow living' user from the cosine spec", () => {
    // From cosine.test.ts §5.3: user vector [Art=0.05, History=0.05,
    // Culinary=0.60, SlowLiving=0.30] should be explained as
    // culinary-first, slow-living-second when matched against M5
    // [0.00, 0.10, 0.80, 0.10].
    const userVec = [0.05, 0.05, 0.6, 0.3];
    const m5Vec = [0.0, 0.1, 0.8, 0.1];
    const top2 = topContributingAxes(userVec, m5Vec, 2);
    expect(top2[0]).toBe(2); // culinary
    expect(top2[1]).toBe(3); // slow living
    expect(AXIS_KEYS[top2[0]!]).toBe("culinary");
    expect(AXIS_KEYS[top2[1]!]).toBe("slowLiving");
  });

  test("returns empty array when the vectors don't overlap (all zeros)", () => {
    // No axis explains a 0 dot product. Hide the why-it-fits line
    // rather than confidently pick an arbitrary axis.
    expect(topContributingAxes([1, 0, 0, 0], [0, 1, 1, 1], 2)).toEqual([]);
    expect(topContributingAxes([0, 0, 0, 0], [1, 1, 1, 1], 2)).toEqual([]);
  });

  test("returns empty array on dimension mismatch (defensive — never crash the UI)", () => {
    expect(topContributingAxes([1, 0, 0], [0, 1, 0, 0], 2)).toEqual([]);
    expect(topContributingAxes([], [], 2)).toEqual([]);
  });

  test("returns empty array when n <= 0", () => {
    expect(topContributingAxes([0.1, 0.2, 0.3, 0.4], [0.1, 0.2, 0.3, 0.4], 0)).toEqual([]);
    expect(topContributingAxes([0.1, 0.2, 0.3, 0.4], [0.1, 0.2, 0.3, 0.4], -1)).toEqual([]);
  });

  test("caps n at the vector length (no out-of-range indices)", () => {
    const indices = topContributingAxes([0.1, 0.2, 0.3, 0.4], [0.1, 0.2, 0.3, 0.4], 99);
    expect(indices).toHaveLength(4);
    for (const i of indices) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(4);
    }
  });
});
