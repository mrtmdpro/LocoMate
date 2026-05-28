/**
 * Shared currency + delta formatters. Keep this file pure (no React / client
 * hooks) so it imports cleanly from both client and server code.
 *
 * Convention:
 *   - `formatVndPrice`  -> "1.500.000 VNĐ"  // customer-facing product/service prices
 *   - `formatVndLong`   -> "₫10.040.000"    // host dashboards / earnings / totals
 *   - `formatVndCompact`-> "10.0M"          // sparkline KPIs, axis labels
 *   - `formatDeltaPct`  -> { label, sign }  // +12.4% / -3.1% chevrons
 *   - `formatDateShort` -> "Apr 14"         // axis + row labels
 *
 * Price vs. balance — split deliberately:
 *   - `formatVndPrice` is the canonical CUSTOMER-facing form. Suffix
 *     `VNĐ` (the Vietnamese spelling, not the ISO code `VND` and not the
 *     `₫` symbol) reads as the explicit "đồng" unit a Vietnamese
 *     customer expects on a price tag. International travelers in the EN
 *     locale see the same string — Vietnam-centric product, single source
 *     of truth at point-of-sale.
 *   - `formatVndLong` is for the host/operator surfaces where the `₫`
 *     prefix mirrors the existing dashboard ledger conventions.
 *
 * Date helpers default to Asia/Ho_Chi_Minh for display -- this is a Vietnam-
 * centric product and hosts expect "Today" to mean their local Today, not
 * whatever Today is in the browser's locale.
 */

import { VN_TIMEZONE, vnLocalDate } from "./time";

/**
 * Customer-facing product / service price. Vietnamese thousands separator
 * (period) + explicit `VNĐ` suffix. Examples:
 *   - 1_000_000 -> "1.000.000 VNĐ"
 *   - 145_000   -> "145.000 VNĐ"
 *   - 0         -> "0 VNĐ"
 *
 * Used on every customer-facing price tag: experiences hub, fixed-tour
 * detail + checkout, host profile, shop, store, cart, order receipts,
 * activities, eSIM. Single source of truth so a future redesign (e.g.
 * `₫` symbol, or a comma-thousands variant for English locale) is a
 * one-file change.
 */
export function formatVndPrice(n: number): string {
  if (!Number.isFinite(n)) return "0 VNĐ";
  return `${Math.round(n).toLocaleString("vi-VN")} VNĐ`;
}

/** Full precision with Vietnamese thousands separator + ₫ prefix. Used
 *  on host/operator dashboard surfaces (earnings, payouts, KPI tiles)
 *  where the prefix `₫` mirrors the existing ledger conventions. For
 *  customer-facing product prices use `formatVndPrice` instead. */
export function formatVndLong(n: number): string {
  if (!Number.isFinite(n)) return "₫0";
  return `₫${Math.round(n).toLocaleString("vi-VN")}`;
}

/** Compact form for tiles + chart axes. "10.0M" / "650k" / "12" */
export function formatVndCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "₫0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}₫${v.toFixed(v >= 10 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₫${Math.round(abs / 1_000)}k`;
  }
  return `${sign}₫${Math.round(abs)}`;
}

/** Compact for axis labels -- no leading ₫ (kept tidy). */
export function formatVndAxis(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${v.toFixed(v >= 10 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) return `${Math.round(abs / 1_000)}k`;
  return `${Math.round(abs)}`;
}

export type DeltaInfo = {
  /** Formatted label, e.g. "+12.4%" or "—" when no comparison possible. */
  label: string;
  /** "up" | "down" | "flat". Drives color + icon. */
  sign: "up" | "down" | "flat";
  /** Raw decimal delta (0.124 for +12.4%). */
  value: number;
};

/**
 * Compute a period-over-period delta. `current` / `previous` are same-unit
 * totals. If previous is zero, we return "—" rather than an Infinity sign --
 * division by zero trend claims are misleading.
 */
export function formatDeltaPct(current: number, previous: number): DeltaInfo {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return { label: "—", sign: "flat", value: 0 };
  }
  const value = (current - previous) / previous;
  const pct = value * 100;
  const rounded = Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  const sign = value > 0.001 ? "up" : value < -0.001 ? "down" : "flat";
  const prefix = sign === "up" ? "+" : sign === "down" ? "" : "";
  return {
    label: `${prefix}${rounded}%`,
    sign,
    value,
  };
}

/**
 * "Apr 14" rendered in the given timezone (default Asia/Ho_Chi_Minh). If
 * input is a 10-char date-only string we treat it as a calendar day in VN,
 * which matches how the backend's revenue bucketing keys its buckets.
 *
 * Without an explicit `timeZone`, a viewer in UTC and a viewer in VN would
 * see a different "today" on the chart axis -- breaking the invariant that
 * chart bars align with transaction date headers below them.
 */
export function formatDateShort(
  iso: string | null | Date,
  opts: { timeZone?: string } = {},
): string {
  if (!iso) return "—";
  const tz = opts.timeZone ?? VN_TIMEZONE;
  // YYYY-MM-DD input -> treat as a calendar date in VN, not as a local
  // instant. Parse as UTC midnight of that day then render with tz.
  const d =
    typeof iso === "string"
      ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
      : iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
}

/** "Apr 14, 2026" rendered in VN by default. */
export function formatDateLong(
  iso: string | null | Date,
  opts: { timeZone?: string } = {},
): string {
  if (!iso) return "—";
  const tz = opts.timeZone ?? VN_TIMEZONE;
  const d =
    typeof iso === "string"
      ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
      : iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });
}

/**
 * "Today" / "Tomorrow" / "Yesterday" / weekday. Comparisons are done on the
 * Vietnam-local date string so "Today" actually means "today in Hanoi", not
 * "today in UTC". Non-VN viewers still see the VN-local "today", which is
 * what we want for a Vietnam-centric product.
 *
 * Pure / framework-agnostic: callers pass a translator `t` (typically
 * `useTranslations("common.relativeDate")`). The fallback weekday-formatted
 * string is rendered with the caller-supplied `locale` (defaults to `en-US`
 * to preserve legacy output for sites that haven't wired i18n yet).
 *
 * `includeTomorrow` defaults to true; pass `false` on surfaces that want
 * past-relative semantics only (e.g. transaction history groupings).
 */
export function formatRelativeDate(
  iso: string | null | Date,
  t: (key: "today" | "tomorrow" | "yesterday") => string,
  opts: { timeZone?: string; locale?: string; includeTomorrow?: boolean } = {},
): string {
  if (!iso) return "—";
  const tz = opts.timeZone ?? VN_TIMEZONE;
  const locale = opts.locale ?? "en-US";
  const includeTomorrow = opts.includeTomorrow ?? true;
  const d =
    typeof iso === "string"
      ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
      : iso;
  const todayKey = vnLocalDate(new Date());
  const ydayKey = vnLocalDate(new Date(Date.now() - 86400_000));
  const tomorrowKey = vnLocalDate(new Date(Date.now() + 86400_000));
  const dKey = vnLocalDate(d);
  if (dKey === todayKey) return t("today");
  if (includeTomorrow && dKey === tomorrowKey) return t("tomorrow");
  if (dKey === ydayKey) return t("yesterday");
  return d.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", timeZone: tz });
}

/**
 * Visual tone of a status badge. Drives the caller's bg/text colour palette
 * — each call site keeps its own concrete Tailwind mapping since the
 * dashboards (sage/earth) and traveller surfaces (amber/red) read with
 * different visual weights.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusBadgeInfo = {
  tone: StatusTone;
  /** Stable lower-snake-case key. Resolved by callers via
   *  `t(`common.status.${labelKey}`)`. Always present; never localised here. */
  labelKey: string;
  /** Optional single-glyph icon hint (emoji or text). Reserved for future
   *  consumer adoption — current callers ignore it. */
  icon?: string;
  /** For unknown statuses (labelKey === "unknown"), the raw input is
   *  surfaced so callers that prefer "raw" over "Unknown" can render it. */
  rawFallback?: string;
};

export interface StatusBadgeOptions {
  /** Charged amount in minor units. Required for partial-refund detection
   *  on `succeeded` payments. */
  amount?: number;
  /** Refunded amount in minor units. Required for partial-refund detection. */
  refundAmount?: number;
  /** Surface-specific reinterpretation. `host_booking_past` flips a
   *  `paid` booking to `needs_wrapup` (the host hasn't closed the loop).
   *  `host_booking_upcoming` collapses `paid`/`confirmed` to a single
   *  `confirmed` chip. Defaults to no reinterpretation. */
  context?:
    | "payment"
    | "order"
    | "host_booking_upcoming"
    | "host_booking_past"
    | "host_experience";
}

/**
 * Pure status → display descriptor. Consolidates four previously-inline
 * implementations (payments / orders / host-bookings / host-earnings) so
 * the visual + i18n vocabulary stays in lockstep across the app.
 *
 * Pure: returns plain data, never imports React or next-intl. Callers
 * resolve `labelKey` via their own `useTranslations("common.status")`
 * scope and map `tone` to the Tailwind classes their surface uses.
 */
export function statusBadge(
  statusRaw: string | null,
  opts: StatusBadgeOptions = {},
): StatusBadgeInfo {
  const status = (statusRaw ?? "pending").toLowerCase();
  const amount = opts.amount ?? 0;
  const refundAmount = opts.refundAmount ?? 0;

  // Context-specific reinterpretations take precedence over the canonical
  // mapping so we don't show a vanilla "Paid" chip on a past-dated host
  // booking that the host still owes a wrap-up letter for.
  if (opts.context === "host_booking_past" && (status === "paid" || status === "active")) {
    return { tone: "warning", labelKey: "needs_wrapup" };
  }
  if (
    opts.context === "host_booking_upcoming" &&
    (status === "paid" || status === "confirmed")
  ) {
    return { tone: "success", labelKey: "confirmed" };
  }

  // `succeeded` with a non-zero refund needs to flip — otherwise the green
  // chip silently buries the reversal. Mirrors the legacy payments page
  // logic this helper replaced.
  if (status === "succeeded") {
    if (refundAmount > 0 && refundAmount < amount) {
      return { tone: "warning", labelKey: "partial_refund" };
    }
    if (refundAmount >= amount && amount > 0) {
      return { tone: "danger", labelKey: "refunded" };
    }
    return { tone: "success", labelKey: "succeeded" };
  }

  switch (status) {
    case "paid":
      return { tone: "success", labelKey: "paid" };
    case "pending":
      return { tone: "warning", labelKey: "pending" };
    case "failed":
      return { tone: "danger", labelKey: "failed" };
    case "refunded":
      return { tone: "danger", labelKey: "refunded" };
    case "cancelled":
    case "canceled":
      return { tone: "danger", labelKey: "cancelled" };
    case "active":
    case "in_progress":
      return { tone: "info", labelKey: "in_progress" };
    case "completed":
      return { tone: "neutral", labelKey: "completed" };
    case "confirmed":
      return { tone: "success", labelKey: "confirmed" };
    case "upcoming":
      return { tone: "info", labelKey: "upcoming" };
    case "published":
      return { tone: "success", labelKey: "published" };
    case "draft":
      return { tone: "warning", labelKey: "draft" };
    case "rejected":
      return { tone: "danger", labelKey: "rejected" };
    case "archived":
      return { tone: "neutral", labelKey: "archived" };
    default:
      return { tone: "neutral", labelKey: "unknown", rawFallback: statusRaw ?? undefined };
  }
}
