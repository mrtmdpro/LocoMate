import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatVndLong, formatVndCompact } from "@/lib/format";
import type { Period } from "./shared";
import { PeriodPicker } from "./period-picker";

export function HeroSection({
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
