import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { formatVndCompact } from "@/lib/format";
import { palette, type BalanceShape } from "./shared";

export function KpiGrid({
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
