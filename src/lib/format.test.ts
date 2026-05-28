import { describe, test, expect } from "vitest";
import {
  formatDeltaPct,
  formatVndPrice,
  formatVndLong,
  formatVndCompact,
  formatVndAxis,
  formatDateShort,
  formatDateLong,
  formatRelativeDate,
} from "./format";

describe("formatDeltaPct", () => {
  test("returns — when previous is zero (avoids Infinity labels)", () => {
    expect(formatDeltaPct(100, 0).label).toBe("—");
    expect(formatDeltaPct(100, 0).sign).toBe("flat");
    expect(formatDeltaPct(0, 0).sign).toBe("flat");
  });

  test("uses 1-decimal precision for deltas below 10%", () => {
    expect(formatDeltaPct(105, 100).label).toBe("+5.0%");
    expect(formatDeltaPct(93, 100).label).toBe("-7.0%");
  });

  test("rounds to integer for deltas >= 10%", () => {
    expect(formatDeltaPct(125, 100).label).toBe("+25%");
    expect(formatDeltaPct(50, 100).label).toBe("-50%");
  });

  test("negative delta omits explicit + prefix but keeps minus", () => {
    const result = formatDeltaPct(80, 100);
    expect(result.sign).toBe("down");
    expect(result.label).toBe("-20%");
  });

  test("non-finite inputs return flat —", () => {
    expect(formatDeltaPct(NaN, 100).label).toBe("—");
    expect(formatDeltaPct(100, NaN).label).toBe("—");
    expect(formatDeltaPct(Infinity, 100).label).toBe("—");
  });

  test("sign discriminates up/down with a small deadband", () => {
    expect(formatDeltaPct(100, 100).sign).toBe("flat");
    expect(formatDeltaPct(200, 100).sign).toBe("up");
    expect(formatDeltaPct(50, 100).sign).toBe("down");
  });
});

describe("formatVndPrice", () => {
  test("Vietnamese thousands separator + explicit VNĐ suffix (the customer-facing form)", () => {
    expect(formatVndPrice(1_000_000)).toBe("1.000.000 VNĐ");
    expect(formatVndPrice(145_000)).toBe("145.000 VNĐ");
    expect(formatVndPrice(2_000_000)).toBe("2.000.000 VNĐ");
  });

  test("zero / falsy values return a clean 0 VNĐ rather than empty or NaN", () => {
    expect(formatVndPrice(0)).toBe("0 VNĐ");
    expect(formatVndPrice(NaN)).toBe("0 VNĐ");
    expect(formatVndPrice(Infinity)).toBe("0 VNĐ");
  });

  test("rounds fractional VND to whole đồng (VND has no subunit)", () => {
    expect(formatVndPrice(1999.5)).toBe("2.000 VNĐ");
    expect(formatVndPrice(999.4)).toBe("999 VNĐ");
  });
});

describe("formatVndLong", () => {
  test("uses Vietnamese thousands separator (period) and ₫ prefix", () => {
    expect(formatVndLong(10_040_000)).toBe("₫10.040.000");
    expect(formatVndLong(0)).toBe("₫0");
  });

  test("rounds non-integer amounts to nearest VND (VND has no subunit)", () => {
    expect(formatVndLong(1999.5)).toBe("₫2.000");
  });

  test("returns ₫0 for non-finite inputs rather than NaN text", () => {
    expect(formatVndLong(NaN)).toBe("₫0");
    expect(formatVndLong(Infinity)).toBe("₫0");
  });
});

describe("formatVndCompact", () => {
  test("compacts millions with 1-decimal under 10M, 0-decimal at or above", () => {
    expect(formatVndCompact(1_500_000)).toBe("₫1.5M");
    expect(formatVndCompact(10_000_000)).toBe("₫10M");
    expect(formatVndCompact(12_500_000)).toBe("₫13M"); // rounds to nearest
  });

  test("compacts thousands without decimals", () => {
    expect(formatVndCompact(650_000)).toBe("₫650k");
    expect(formatVndCompact(1_000)).toBe("₫1k");
  });

  test("handles negative amounts (e.g. refunds)", () => {
    expect(formatVndCompact(-1_500_000)).toBe("-₫1.5M");
    expect(formatVndCompact(-150_000)).toBe("-₫150k");
  });

  test("zero is pre-cased", () => {
    expect(formatVndCompact(0)).toBe("₫0");
  });
});

describe("formatVndAxis", () => {
  test("drops the ₫ prefix since axis tick labels are compact", () => {
    expect(formatVndAxis(1_500_000)).toBe("1.5M");
    expect(formatVndAxis(650_000)).toBe("650k");
    expect(formatVndAxis(0)).toBe("0");
  });
});

describe("formatDateShort / formatDateLong", () => {
  test("accepts Date and renders month + day in VN time", () => {
    // Apr 20 VN = Apr 19 17:00 UTC. A 10 AM UTC instant on Apr 20 is Apr 20 in VN.
    const d = new Date("2026-04-20T10:00:00Z");
    expect(formatDateShort(d)).toBe("Apr 20");
    expect(formatDateLong(d)).toBe("Apr 20, 2026");
  });

  test("treats 10-char date-only strings as a calendar date, not a local instant", () => {
    // Without the dedicated branch, a 10-char input like "2026-04-20" parsed
    // as local midnight would shift to Apr 19 in any timezone east of UTC.
    expect(formatDateShort("2026-04-20")).toBe("Apr 20");
  });

  test("returns em-dash for null / undefined", () => {
    expect(formatDateShort(null)).toBe("—");
    expect(formatDateLong(null)).toBe("—");
  });
});

describe("formatRelativeDate", () => {
  // Stand-in for the next-intl translator the helper now expects. Returns
  // the canonical English labels so the existing assertions still read
  // naturally; production callers pass `useTranslations("common.relativeDate")`.
  const t = (k: "today" | "tomorrow" | "yesterday") =>
    k === "today" ? "Today" : k === "tomorrow" ? "Tomorrow" : "Yesterday";

  test("anchors to Vietnam-local 'today', not browser-local today", () => {
    const todayVn = new Date();
    const result = formatRelativeDate(todayVn, t);
    expect(result).toBe("Today");
  });

  test("tomorrow returns 'Tomorrow' when includeTomorrow defaults true", () => {
    const tmr = new Date(Date.now() + 86400_000);
    expect(formatRelativeDate(tmr, t)).toBe("Tomorrow");
  });

  test("yesterday returns 'Yesterday'", () => {
    const yday = new Date(Date.now() - 86400_000);
    expect(formatRelativeDate(yday, t)).toBe("Yesterday");
  });

  test("older dates render weekday + date", () => {
    const old = new Date(Date.now() - 10 * 86400_000);
    const label = formatRelativeDate(old, t);
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    expect(label.length).toBeGreaterThan(4);
  });

  test("includeTomorrow=false falls through to the dated weekday label", () => {
    const tmr = new Date(Date.now() + 86400_000);
    const label = formatRelativeDate(tmr, t, { includeTomorrow: false });
    expect(label).not.toBe("Tomorrow");
    expect(label).not.toBe("Today");
  });
});
