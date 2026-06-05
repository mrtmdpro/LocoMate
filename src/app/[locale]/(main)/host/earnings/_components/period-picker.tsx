import { useTranslations } from "next-intl";
import type { Period } from "./shared";

export function PeriodPicker({
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
