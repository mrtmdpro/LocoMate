"use client";

import { useId, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import {
  formatVndLong,
  formatVndAxis,
  formatVndCompact,
  formatDeltaPct,
  formatDateShort,
  formatDateLong,
  formatRelativeDate,
  statusBadge,
  type StatusTone,
} from "@/lib/format";
import { vnLocalDate } from "@/lib/time";
import { buildCsv, downloadCsv } from "@/lib/csv";

// Tone palette for transaction-row status pills. Heavier emerald/red
// bordered pills match the dashboard's financial-table density.
const TRANSACTION_TONE_CLASSES: Record<StatusTone, string> = {
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
const palette = {
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

type Period = { days: number; labelKey: "last7" | "last30" | "last90" | "lastYear"; short: string };
const PERIODS: Period[] = [
  { days: 7, labelKey: "last7", short: "7d" },
  { days: 30, labelKey: "last30", short: "30d" },
  { days: 90, labelKey: "last90", short: "90d" },
  { days: 365, labelKey: "lastYear", short: "1Y" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HostEarningsPage() {
  const { user } = useAuthStore();
  const t = useTranslations("host.earnings");
  const enabled = !!user && (user.role === "host" || user.role === "admin");
  const [period, setPeriod] = useState<Period>(PERIODS[1]); // 30d default

  const { data: hero, isLoading: loadingHero } = trpc.host.getEarningsHero.useQuery(
    { days: period.days },
    { enabled },
  );
  const { data: balance, isLoading: loadingBalance } = trpc.host.getBalance.useQuery(undefined, { enabled });
  const { data: revenueByDay, isLoading: loadingRev } = trpc.host.getRevenueByDay.useQuery(
    { days: period.days, offsetDays: 0 },
    { enabled },
  );
  const { data: byExperience, isLoading: loadingExp } = trpc.host.getRevenueByExperience.useQuery(undefined, { enabled });
  const { data: timeline, isLoading: loadingTl } = trpc.host.getPaymentsTimeline.useQuery({ limit: 50 }, { enabled });
  const { data: commission } = trpc.host.getCommissionSummary.useQuery(undefined, { enabled });
  const { data: payouts, isLoading: loadingPayouts } = trpc.host.getPayoutHistory.useQuery({ limit: 10 }, { enabled });

  const delta = hero
    ? formatDeltaPct(hero.currentVnd, hero.previousVnd)
    : { label: "—", sign: "flat" as const, value: 0 };

  if (!enabled) {
    return (
      <div className="p-6 pb-24 text-center text-sm text-muted-foreground">
        {t("hostOnly")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4 lg:space-y-6">
        {/* Breadcrumb + page title */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <Link href="/host" className="text-xs text-muted-foreground hover:text-foreground font-medium uppercase tracking-widest">
              {t("backToDashboard")}
            </Link>
            <h1 className="text-2xl lg:text-3xl font-bold font-heading text-foreground mt-0.5">
              {t("title")}
            </h1>
          </div>
        </header>

        {/* Hero + period picker */}
        <HeroSection
          hero={hero ?? null}
          loading={loadingHero}
          delta={delta}
          period={period}
          periods={PERIODS}
          onPeriod={setPeriod}
        />

        {/* KPI tiles. Sparkline only on "Available" -- the other tiles don't
            have a meaningful over-time series to draw (S2: removed fake
            sparklines that showed gross revenue under the "Pending" label). */}
        <KpiGrid
          balance={balance ?? null}
          loading={loadingBalance}
          sparkData={revenueByDay ?? []}
        />

        {/* Main revenue chart */}
        <RevenueChartCard
          data={revenueByDay ?? []}
          loading={loadingRev}
          period={period}
          totalVnd={hero?.currentVnd ?? 0}
          commissionRate={hero?.commissionRate ?? commission?.commissionRate ?? 0.2}
        />

        {/* Desktop: two columns for by-experience + transactions. Mobile: stacked. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <ByExperienceCard rows={byExperience ?? []} loading={loadingExp} />
          <TransactionsCard rows={timeline ?? []} loading={loadingTl} />
        </div>

        {/* Commission summary (full-width) */}
        {commission && <CommissionCard commission={commission} />}

        {/* Payout history (full-width) */}
        <PayoutHistoryCard rows={payouts ?? []} loading={loadingPayouts} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero section: headline number, delta chevron, period picker
// ---------------------------------------------------------------------------

function HeroSection({
  hero,
  loading,
  delta,
  period,
  periods,
  onPeriod,
}: {
  hero: { currentVnd: number; previousVnd: number; currentBookings: number; previousBookings: number; days: number } | null;
  loading: boolean;
  delta: { label: string; sign: "up" | "down" | "flat"; value: number };
  period: Period;
  periods: Period[];
  onPeriod: (p: Period) => void;
}) {
  const t = useTranslations("host.earnings");
  const tPeriod = useTranslations("host.earnings.period");
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              {t("hero.eyebrow", { period: tPeriod(`${period.labelKey}Lower`) })}
            </p>
            {loading ? (
              <div className="h-10 w-48 bg-muted rounded mt-2 animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <p className="text-3xl lg:text-4xl font-bold tabular-nums text-foreground">
                  {formatVndLong(hero?.currentVnd ?? 0)}
                </p>
                {delta.sign !== "flat" && (
                  <DeltaChevron delta={delta} />
                )}
              </div>
            )}
            {hero && (
              <p className="text-sm text-muted-foreground mt-1">
                {t("hero.bookings", { n: hero.currentBookings })}
                {hero.previousBookings > 0 && (
                  <>
                    {" · "}
                    {t("hero.previously", {
                      amount: formatVndCompact(hero.previousVnd),
                      n: hero.previousBookings,
                    })}
                  </>
                )}
              </p>
            )}
          </div>
          <PeriodPicker period={period} periods={periods} onChange={onPeriod} />
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaChevron({ delta }: { delta: { label: string; sign: "up" | "down" | "flat" } }) {
  const color =
    delta.sign === "up" ? "text-emerald-600 bg-emerald-50" : delta.sign === "down" ? "text-red-600 bg-red-50" : "text-muted-foreground bg-muted";
  const icon = delta.sign === "up" ? "↑" : delta.sign === "down" ? "↓" : "→";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${color}`}>
      <span aria-hidden>{icon}</span>
      {delta.label}
    </span>
  );
}

function PeriodPicker({
  period,
  periods,
  onChange,
}: {
  period: Period;
  periods: Period[];
  onChange: (p: Period) => void;
}) {
  const t = useTranslations("host.earnings");
  const tPeriod = useTranslations("host.earnings.period");
  // Toggle-button group pattern (aria-pressed) rather than the tablist/tab
  // pattern, which would require tab-panel IDs + arrow-key navigation we
  // don't implement. Screen readers correctly announce
  // "30d toggle button pressed" for the current selection.
  return (
    <div
      role="group"
      aria-label={t("periodAria")}
      className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 shrink-0 self-start"
    >
      {periods.map((p) => {
        const active = p.days === period.days;
        return (
          <button
            key={p.short}
            type="button"
            aria-pressed={active}
            aria-label={tPeriod(p.labelKey)}
            onClick={() => onChange(p)}
            className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

type BalanceShape = {
  availableVnd: number;
  pendingVnd: number;
  inReviewVnd: number;
  refundedVnd: number;
  lifetimePayoutsVnd: number;
  nextPayoutVnd: number;
  nextPayoutDate: string;
  currency: string;
};

function KpiGrid({
  balance,
  loading,
  sparkData,
}: {
  balance: BalanceShape | null;
  loading: boolean;
  sparkData: { date: string; grossVnd: number }[];
}) {
  const t = useTranslations("host.earnings");
  const locale = useLocale();
  if (loading || !balance) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[96px] bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const nextPayoutDate = balance.nextPayoutDate
    ? new Date(balance.nextPayoutDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  // Align tooltip of the rightmost tile to the right so it doesn't overflow
  // the viewport on mobile. Column index tracked by `tooltipSide`.
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        label={t("kpi.available.label")}
        helpText={t("kpi.available.help")}
        value={balance.availableVnd}
        sparkData={sparkData}
        positive
        tooltipSide="left"
      />
      <KpiTile
        label={t("kpi.pending.label")}
        helpText={t("kpi.pending.help")}
        value={balance.pendingVnd}
        tooltipSide="right"
      />
      <KpiTile
        label={t("kpi.lifetime.label")}
        helpText={t("kpi.lifetime.help")}
        value={balance.lifetimePayoutsVnd}
        tooltipSide="left"
      />
      <KpiTile
        label={t("kpi.next.label")}
        helpText={t("kpi.next.help", { date: nextPayoutDate ?? t("kpi.next.pending") })}
        value={balance.nextPayoutVnd}
        caption={balance.nextPayoutVnd > 0 ? nextPayoutDate ?? t("kpi.next.pending") : t("kpi.next.empty")}
        tooltipSide="right"
      />
    </div>
  );
}

function KpiTile({
  label,
  helpText,
  value,
  caption,
  sparkData,
  positive,
  tooltipSide = "left",
}: {
  label: string;
  helpText: string;
  value: number;
  caption?: string | null;
  sparkData?: { date: string; grossVnd: number }[];
  positive?: boolean;
  tooltipSide?: "left" | "right";
}) {
  const sparkSeries = useMemo(() => {
    if (!sparkData || sparkData.length === 0) return [];
    return sparkData.map((d) => ({ date: d.date, v: d.grossVnd }));
  }, [sparkData]);

  // useId avoids SVG gradient ID collisions between tiles (an earlier
  // version used the label string, which contained spaces -- invalid in
  // SVG IDs and would collide if two tiles ever shared a label).
  const reactId = useId();
  const gradientId = `spark-${reactId.replace(/:/g, "_")}`;

  return (
    <div className="relative bg-card border border-border rounded-xl p-3 lg:p-4 min-h-[96px] flex flex-col justify-between">
      <div className="flex items-center gap-1.5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </p>
        <InfoDot text={helpText} side={tooltipSide} />
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="min-w-0">
          <p className={`text-xl lg:text-2xl font-bold tabular-nums truncate ${positive ? "text-secondary" : "text-foreground"}`}>
            {formatVndCompact(value)}
          </p>
          {caption && <p className="text-xs text-muted-foreground mt-0.5 truncate">{caption}</p>}
        </div>
        {sparkSeries.length > 0 && (
          <div className="w-20 h-8 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.brand} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={palette.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={palette.brand}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Small (?) info tooltip. `side` controls whether the popover opens to the
 * right or the left of the trigger -- needed so the rightmost tile in a 2-
 * or 4-column grid doesn't clip the tooltip off the viewport edge.
 */
function InfoDot({ text, side = "left" }: { text: string; side?: "left" | "right" }) {
  const sideClass = side === "right" ? "right-0" : "left-0";
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="w-3.5 h-3.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-bold flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`absolute ${sideClass} top-5 z-10 w-52 p-2.5 bg-foreground text-background text-sm leading-snug rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity pointer-events-none`}
      >
        {text}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main revenue chart
// ---------------------------------------------------------------------------

type ChartRow = {
  date: string;
  label: string;
  net: number;
  fee: number;
  gross: number;
};

function RevenueChartCard({
  data,
  loading,
  period,
  totalVnd,
  commissionRate,
}: {
  data: { date: string; grossVnd: number; commissionVnd: number; netVnd: number }[];
  loading: boolean;
  period: Period;
  totalVnd: number;
  commissionRate: number;
}) {
  const t = useTranslations("host.earnings");
  const tPeriod = useTranslations("host.earnings.period");
  // Recharts needs a flat series. Our data is already daily; we just
  // decorate it with a label key for the x-axis.
  const series = useMemo<ChartRow[]>(
    () =>
      data.map((d) => ({
        date: d.date,
        label: formatDateShort(d.date),
        net: d.netVnd,
        fee: d.commissionVnd,
        gross: d.grossVnd,
      })),
    [data],
  );
  const allZero = series.every((s) => s.gross === 0);

  // Sample the x-axis so we don't overcrowd: show first + last + ~3 in between.
  const xTickInterval = useMemo(() => {
    if (series.length <= 8) return 0;
    return Math.max(1, Math.floor(series.length / 5));
  }, [series.length]);

  const feePct = Math.round(commissionRate * 100);
  const netPct = 100 - feePct;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-foreground">
              {t("revenue.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("revenue.subtitle", { pct: feePct })}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{t("revenue.total")}</p>
            <p className="text-base font-bold tabular-nums text-foreground">{formatVndCompact(totalVnd)}</p>
          </div>
        </div>

        <div className="relative h-56 lg:h-64">
          {loading ? (
            <div className="w-full h-full bg-muted rounded-lg animate-pulse" />
          ) : series.length === 0 || allZero ? (
            // Surface the empty state for both "no data rows" (brand-new host
            // without a profile) AND "rows but all zero" (the normal first
            // period). The old chart-with-invisible-bars looked broken.
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground bg-muted/40 rounded-lg">
              <span className="text-lg" aria-hidden>📊</span>
              <span>{t("revenue.empty", { period: tPeriod(`${period.labelKey}Lower`) })}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={palette.grid} vertical={false} strokeDasharray="2 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: palette.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: palette.grid }}
                  interval={xTickInterval}
                  minTickGap={8}
                />
                <YAxis
                  tick={{ fill: palette.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatVndAxis(Number(v))}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: palette.feeLight }}
                  content={<RevenueTooltip />}
                />
                <Bar
                  dataKey="net"
                  stackId="s"
                  fill={palette.brand}
                  radius={[0, 0, 0, 0]}
                  animationDuration={400}
                  // minPointSize paints a floor pixel so zero-revenue days
                  // still read as a present-but-quiet day rather than a gap.
                  // Needed because our bars are in the millions-of-VND range
                  // and sub-pixel bar heights otherwise disappear.
                  minPointSize={3}
                />
                <Bar
                  dataKey="fee"
                  stackId="s"
                  fill={palette.fee}
                  radius={[2, 2, 0, 0]}
                  animationDuration={400}
                  minPointSize={0}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.brand }} />
            {t("revenue.legend.net", { pct: netPct })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.fee }} />
            {t("revenue.legend.fee", { pct: feePct })}
          </span>
          <span className="ml-auto text-muted-foreground tabular-nums">
            {series[0]?.label ?? ""} — {series[series.length - 1]?.label ?? ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Recharts tooltip content. Recharts' own `TooltipProps<number, string>`
 * generics work but are awkward to import across versions; a narrow local
 * type tied to our ChartRow keeps the surface small and typed.
 */
type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
};

function RevenueTooltip(props: TooltipPayload) {
  const t = useTranslations("host.earnings");
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  const row = props.payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-sm min-w-[200px]">
      <p className="font-semibold text-foreground">{formatDateLong(row.date)}</p>
      <div className="space-y-0.5 mt-1.5 tabular-nums">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("tooltip.gross")}</span>
          <span className="font-semibold text-foreground">{formatVndLong(row.gross)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("tooltip.net")}</span>
          <span className="font-semibold text-secondary">{formatVndLong(row.net)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("tooltip.fee")}</span>
          <span className="font-semibold text-muted-foreground">{formatVndLong(row.fee)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// By-experience table (sortable)
// ---------------------------------------------------------------------------

type ExperienceRow = {
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

type SortKey = "net" | "bookings" | "rating" | "lastBooked";

function ByExperienceCard({ rows, loading }: { rows: ExperienceRow[]; loading: boolean }) {
  const t = useTranslations("host.earnings");
  const [sortKey, setSortKey] = useState<SortKey>("net");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "net":
          return b.netVnd - a.netVnd;
        case "bookings":
          return b.bookingCount - a.bookingCount;
        case "rating":
          return Number(b.avgRating ?? 0) - Number(a.avgRating ?? 0);
        case "lastBooked":
          return (new Date(b.lastBookedAt ?? 0).getTime() || 0) - (new Date(a.lastBookedAt ?? 0).getTime() || 0);
        default: {
          // Exhaustiveness guard: if a new SortKey is added without a case,
          // TS errors here at compile time.
          const _never: never = sortKey;
          void _never;
          return 0;
        }
      }
    });
    return copy;
  }, [rows, sortKey]);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-foreground">{t("byExperience.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("byExperience.subtitle")}</p>
          </div>
          <SortDropdown value={sortKey} onChange={setSortKey} />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={t("empty.noListings.title")}
            body={t("empty.noListings.body")}
            href="/host/experiences/new"
            cta={t("empty.noListings.cta")}
          />
        ) : (
          <div className="divide-y divide-border -mx-1">
            {sorted.map((row) => (
              // Link to the public listing when the row has a slug (the
              // traveler-facing page); fall back to the host's preview page
              // for slug-less drafts/archived (which would 404 on the public
              // route). Keeps clicks useful for every row state.
              <Link
                key={row.experienceId}
                href={row.slug ? `/experiences/${row.slug}` : `/host/experiences/${row.experienceId}/preview`}
                className="flex items-center justify-between gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm lg:text-base font-semibold text-foreground truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("byExperience.bookings", { n: row.bookingCount })}
                    {row.avgRating && Number(row.avgRating) > 0 && (
                      <>
                        {" · "}
                        <span aria-label={t("byExperience.ratingAria", { rating: Number(row.avgRating).toFixed(1) })}>
                          {Number(row.avgRating).toFixed(1)}★
                        </span>
                      </>
                    )}
                    {row.lastBookedAt && (
                      <>
                        {" · "}
                        {t("byExperience.last", { date: formatDateShort(row.lastBookedAt) })}
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <p className="text-base font-bold text-secondary">{formatVndCompact(row.netVnd)}</p>
                  <p className="text-xs text-muted-foreground">{t("byExperience.netLabel")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const t = useTranslations("host.earnings");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      className="text-sm font-medium text-muted-foreground border border-border rounded-md px-2.5 py-1.5 bg-card hover:border-foreground/25 focus:outline-none focus:ring-2 focus:ring-[#23402b]/20"
    >
      <option value="net">{t("sort.net")}</option>
      <option value="bookings">{t("sort.bookings")}</option>
      <option value="rating">{t("sort.rating")}</option>
      <option value="lastBooked">{t("sort.lastBooked")}</option>
    </select>
  );
}

// ---------------------------------------------------------------------------
// Transactions -- grouped by date, status pills, CSV export
// ---------------------------------------------------------------------------

type TimelineRow = {
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

function TransactionsCard({ rows, loading }: { rows: TimelineRow[]; loading: boolean }) {
  const t = useTranslations("host.earnings");
  const tRel = useTranslations("common.relativeDate");
  const locale = useLocale();
  // Group by Vietnam-local date so rows cluster under headers that match
  // the host's own calendar. Using `slice(0,10)` on the UTC ISO string
  // was off by one day for payments between 17:00 and 23:59 UTC (= the
  // first 7 hours of the next VN day).
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    for (const row of rows) {
      const anchor = row.paidAt ?? row.createdAt;
      const key = anchor ? vnLocalDate(anchor) || "unknown" : "unknown";
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }
    // Dated groups sort newest-first; the "unknown" bucket (rows missing a
    // paidAt + createdAt, which should never happen but might in legacy
    // data) goes to the bottom instead of alphabetically pinning to the top.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return b.localeCompare(a);
    });
  }, [rows]);

  const handleExport = () => {
    const csv = transactionsToCsv(rows);
    // Date-stamped filename so repeat exports don't overwrite each other
    // in the user's Downloads folder.
    const datePart = vnLocalDate(new Date()) || new Date().toISOString().slice(0, 10);
    downloadCsv(`locomate-transactions-${datePart}.csv`, csv);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold text-foreground">{t("transactions.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("transactions.subtitle", { n: rows.length })}</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0 || loading}
            className="text-sm font-semibold text-secondary hover:text-[#1a3322] disabled:text-muted-foreground disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {t("transactions.exportCsv")}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState icon="💸" title={t("empty.transactions.title")} body={t("empty.transactions.body")} />
        ) : (
          <div className="space-y-4">
            {grouped.map(([dateKey, group]) => (
              <div key={dateKey} className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold pt-1">
                  {formatRelativeDate(dateKey, tRel, { locale: locale === "vi" ? "vi-VN" : "en-US", includeTomorrow: false })}
                </p>
                {group.map((row) => (
                  <TransactionRow key={row.id} row={row} />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionRow({ row }: { row: TimelineRow }) {
  const t = useTranslations("host.earnings");
  const tStatus = useTranslations("common.status");
  const locale = useLocale();
  const isRefund = row.status === "refunded";
  // Surface-specific override: on the host transactions table `succeeded`
  // reads more naturally as "Paid" — match the legacy chip vocabulary.
  const badge = statusBadge(
    row.status === "succeeded" ? "paid" : row.status,
    { context: "payment" },
  );
  const badgeLabel = badge.rawFallback ?? tStatus(badge.labelKey);

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/60 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm lg:text-base font-semibold text-foreground truncate">
          {row.experienceTitle ?? t("transactions.customTour")}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {row.travelerName ?? t("transactions.travelerFallback")}
          {row.paidAt && ` · ${new Date(row.paidAt).toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "numeric", minute: "2-digit" })}`}
        </p>
      </div>
      <div className="flex flex-col items-end tabular-nums shrink-0">
        <p className={`text-base font-bold ${isRefund ? "text-red-600" : "text-secondary"}`}>
          {isRefund ? `-${formatVndCompact(row.grossVnd)}` : `+${formatVndCompact(row.netVnd)}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {!isRefund && (
            <p className="text-xs text-muted-foreground">
              {t("transactions.feeLabel", { amount: formatVndCompact(row.commissionVnd) })}
            </p>
          )}
          <Badge className={`text-xs font-semibold ${TRANSACTION_TONE_CLASSES[badge.tone]}`}>
            {badgeLabel}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commission summary + payout history
// ---------------------------------------------------------------------------

function CommissionCard({
  commission,
}: {
  commission: {
    lifetimeGrossVnd: number;
    lifetimeCommissionVnd: number;
    lifetimeNetVnd: number;
    lifetimeRefundedVnd: number;
    bookingCount: number;
    commissionRate: number;
    currency: string;
  };
}) {
  const t = useTranslations("host.earnings");
  const pct = (commission.commissionRate * 100).toFixed(0);
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-5 lg:p-6 bg-gradient-to-br from-secondary to-[#1a3322] text-white space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">{t("commission.title")}</h2>
          <p className="text-sm text-white/80 mt-0.5">
            {t("commission.subtitle", { pct })}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CommissionTile label={t("commission.gross")} value={commission.lifetimeGrossVnd} />
          <CommissionTile label={t("commission.fee")} value={commission.lifetimeCommissionVnd} muted />
          <CommissionTile label={t("commission.net")} value={commission.lifetimeNetVnd} highlight />
        </div>
        <p className="text-xs text-white/70 tabular-nums">
          {t("commission.bookings", { n: commission.bookingCount })}
          {commission.lifetimeRefundedVnd > 0 && (
            <> · {t("commission.refunded", { amount: formatVndCompact(commission.lifetimeRefundedVnd) })}</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function CommissionTile({ label, value, muted, highlight }: { label: string; value: number; muted?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest font-semibold text-white/70">{label}</p>
      <p className={`text-xl lg:text-2xl font-bold tabular-nums mt-0.5 ${highlight ? "text-[#A8C589]" : muted ? "text-white/80" : "text-white"}`}>
        {formatVndCompact(value)}
      </p>
    </div>
  );
}

type PayoutRow = {
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

function PayoutHistoryCard({ rows, loading }: { rows: PayoutRow[]; loading: boolean }) {
  const t = useTranslations("host.earnings");
  const tStatus = useTranslations("common.status");
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 lg:p-6 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold text-foreground">{t("payouts.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("payouts.subtitle")}</p>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🧾" title={t("empty.payouts.title")} body={t("empty.payouts.body")} />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((p) => {
              const badge = statusBadge(p.status);
              const statusLabel = badge.rawFallback ?? tStatus(badge.labelKey);
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm lg:text-base font-semibold text-foreground">
                      {formatDateShort(p.periodStart)} – {formatDateShort(p.periodEnd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.status === "paid" && p.paidAt
                        ? t("payouts.paidOn", { date: formatDateLong(p.paidAt) })
                        : statusLabel}
                      {p.bankReference && ` · ${p.bankReference}`}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <p className="text-base font-bold text-secondary">{formatVndLong(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{p.currency ?? "VND"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  body,
  href,
  cta,
}: {
  icon: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">{body}</p>
      {href && cta && (
        <Link href={href} className="inline-block text-sm font-semibold text-primary hover:text-brick pt-1">
          {cta} →
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV export: build the transactions CSV from the timeline rows.
// Escape / BOM / CRLF handling lives in lib/csv.ts and is unit-tested.
// ---------------------------------------------------------------------------

function transactionsToCsv(rows: TimelineRow[]): string {
  // CSV headers stay in English on purpose -- exports feed downstream
  // spreadsheets / accounting tools that the host's team may share with
  // English-only finance partners. Localised headers would silently
  // break any saved Excel formulas referencing column names.
  return buildCsv(
    ["Date", "Experience", "Traveler", "Status", "Gross (VND)", "Platform fee (VND)", "Net (VND)", "Refund (VND)"],
    rows.map((r) => [
      r.paidAt ?? r.createdAt ?? "",
      r.experienceTitle ?? "Custom tour",
      r.travelerName ?? "",
      r.status ?? "",
      r.grossVnd,
      r.commissionVnd,
      r.netVnd,
      r.refundVnd,
    ]),
  );
}
