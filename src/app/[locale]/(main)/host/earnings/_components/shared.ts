import type { StatusTone } from "@/lib/format";

// Tone palette for transaction-row status pills. Heavier emerald/red
// bordered pills match the dashboard's financial-table density.
export const TRANSACTION_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border border-amber-100",
  danger: "bg-red-50 text-red-700 border border-red-100",
  info: "bg-primary/10 text-primary border border-primary/20",
  neutral: "bg-muted text-foreground/80 border border-border",
};

// ---------------------------------------------------------------------------
// Palette: hybrid (brand greens for positive amounts, slate neutrals for
// chrome). `brand.net` is the signature LOCOMATE green -- used for hero
// numbers, stacked bar primary segments, KPI highlights. `slate.*` is
// everything else (gridlines, borders, axis labels, inactive text).
// ---------------------------------------------------------------------------
export const palette = {
  brand: "#23402b",
  brandSoft: "#A8C589",
  orange: "#d94a26",
  fee: "#cbd5e1", // slate-300
  feeLight: "#e2e8f0", // slate-200
  grid: "#f1f5f9", // slate-100
  axis: "#64748b", // slate-500
  up: "#059669", // emerald-600
  down: "#dc2626", // red-600
} as const;

export type Period = { days: number; labelKey: "last7" | "last30" | "last90" | "lastYear"; short: string };
export const PERIODS: Period[] = [
  { days: 7, labelKey: "last7", short: "7d" },
  { days: 30, labelKey: "last30", short: "30d" },
  { days: 90, labelKey: "last90", short: "90d" },
  { days: 365, labelKey: "lastYear", short: "1Y" },
];

export type BalanceShape = {
  availableVnd: number;
  pendingVnd: number;
  inReviewVnd: number;
  refundedVnd: number;
  lifetimePayoutsVnd: number;
  nextPayoutVnd: number;
  nextPayoutDate: string;
  currency: string;
};

export type ChartRow = {
  date: string;
  label: string;
  net: number;
  fee: number;
  gross: number;
};

/**
 * Recharts tooltip content. Recharts' own `TooltipProps<number, string>`
 * generics work but are awkward to import across versions; a narrow local
 * type tied to our ChartRow keeps the surface small and typed.
 */
export type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
};

export type ExperienceRow = {
  experienceId: string;
  title: string;
  slug: string | null;
  avgRating: string | null;
  bookingCount: number;
  grossVnd: number;
  commissionVnd: number;
  netVnd: number;
  lastBookedAt: string | null;
};

export type SortKey = "net" | "bookings" | "rating" | "lastBooked";

export type TimelineRow = {
  id: string;
  tourId: string;
  travelerName: string | null;
  experienceTitle: string | null;
  status: string | null;
  grossVnd: number;
  commissionVnd: number;
  netVnd: number;
  refundVnd: number;
  paidAt: string | null;
  createdAt: string | null;
  commissionRate: number;
};

export type PayoutRow = {
  id: string;
  amount: number;
  currency: string | null;
  status: string;
  // Dates come across the tRPC boundary as ISO strings. Keep them as strings
  // here and let `formatDateShort` / `formatDateLong` handle the parse.
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  bankReference: string | null;
};
