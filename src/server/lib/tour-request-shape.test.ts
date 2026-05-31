import { describe, expect, it } from "vitest";
import { RequestParamsSchema, readRequestParams } from "./tour-request-shape";
import type { RequestParams } from "./tour-request-shape";

describe("readRequestParams", () => {
  it("parses a valid booking row and preserves unknown keys", () => {
    const parsed = readRequestParams({
      date: "2099-01-01",
      startTime: "09:00",
      durationHours: 3,
      groupSize: 2,
      fixedTourId: "LOCO_FT_M1",
      chapter: "MORNING_SHIFT",
      budgetLevel: "medium",
      withHost: true,
      interests: ["food"],
      legacyKey: "kept",
    });
    expect(parsed.date).toBe("2099-01-01");
    expect(parsed.startTime).toBe("09:00");
    expect(parsed.durationHours).toBe(3);
    expect(parsed.groupSize).toBe(2);
    expect(parsed.legacyKey).toBe("kept");
  });

  it("falls back to {} for a drifted/garbage row instead of throwing", () => {
    // durationHours must be a number.
    expect(readRequestParams({ durationHours: "three" })).toEqual({});
    expect(readRequestParams(null)).toEqual({});
    expect(readRequestParams(undefined)).toEqual({});
  });
});

describe("RequestParamsSchema (write validation)", () => {
  it("throws when a known field is written with the wrong type", () => {
    expect(() => RequestParamsSchema.parse({ durationHours: "three" })).toThrow();
    expect(() =>
      RequestParamsSchema.parse({ interests: "food" } as unknown as RequestParams),
    ).toThrow();
  });
});
