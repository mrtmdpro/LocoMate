import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatVndCompact, formatRelativeDate, statusBadge } from "@/lib/format";
import { vnLocalDate } from "@/lib/time";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { TRANSACTION_TONE_CLASSES, type TimelineRow } from "./shared";
import { EmptyState } from "./empty-state";

export function TransactionsCard({ rows, loading }: { rows: TimelineRow[]; loading: boolean }) {
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
