import { describe, expect, it } from "vitest";
import { TourDataSchema, readTourData } from "./tour-data-shape";
import type { TourData } from "./tour-data-shape";

describe("readTourData", () => {
  it("parses a valid itinerary and preserves unknown keys", () => {
    const parsed = readTourData({
      title: "Your 3h Hanoi Discovery",
      stops: [{ placeId: "p1" }, { placeId: "p2" }],
      totalDurationMinutes: 180,
      isFromFixedTour: true,
    });
    expect(parsed.title).toBe("Your 3h Hanoi Discovery");
    expect(parsed.stops).toHaveLength(2);
    expect(parsed.totalDurationMinutes).toBe(180);
    expect(parsed.isFromFixedTour).toBe(true);
  });

  it("falls back to {} for a drifted/garbage row instead of throwing", () => {
    // stops must be an array.
    expect(readTourData({ stops: "not-an-array" })).toEqual({});
    expect(readTourData(null)).toEqual({});
    expect(readTourData(undefined)).toEqual({});
  });
});

describe("TourDataSchema (write validation)", () => {
  it("throws when a known field is written with the wrong type", () => {
    expect(() => TourDataSchema.parse({ totalDurationMinutes: "lots" })).toThrow();
    expect(() =>
      TourDataSchema.parse({ stops: "nope" } as unknown as TourData),
    ).toThrow();
  });
});
