import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatVndLong,
  formatVndAxis,
  formatVndCompact,
  formatDateShort,
  formatDateLong,
} from "@/lib/format";
import { palette, type Period, type ChartRow, type TooltipPayload } from "./shared";

export function RevenueChartCard({
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
