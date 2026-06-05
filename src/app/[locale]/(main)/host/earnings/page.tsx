"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { formatDeltaPct } from "@/lib/format";
import { PERIODS, type Period } from "./_components/shared";
import { HeroSection } from "./_components/hero";
import { KpiGrid } from "./_components/kpi";
import { RevenueChartCard } from "./_components/revenue-chart";
import { ByExperienceCard } from "./_components/by-experience";
import { TransactionsCard } from "./_components/transactions";
import { CommissionCard } from "./_components/commission";
import { PayoutHistoryCard } from "./_components/payouts";

// ---------------------------------------------------------------------------
// Page — data orchestrator. Fetches the 7 `trpc.host.*` earnings queries and
// lays out the section cards. The cards themselves live in ./_components/*
// (Cluster F decomposition); shared constants + row types in
// ./_components/shared.ts.
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
