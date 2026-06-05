import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { formatVndCompact, formatDateShort } from "@/lib/format";
import { type ExperienceRow, type SortKey } from "./shared";
import { EmptyState } from "./empty-state";

export function ByExperienceCard({ rows, loading }: { rows: ExperienceRow[]; loading: boolean }) {
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
