"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MessagesBell } from "@/components/host/messages-bell";
import { formatRelativeDate } from "@/lib/format";

function formatVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function HostDashboardPage() {
  const { user } = useAuthStore();
  const utils = trpc.useUtils();
  const t = useTranslations("host.dashboard");
  const tRel = useTranslations("common.relativeDate");
  const locale = useLocale();
  const enabled = !!user && (user.role === "host" || user.role === "admin");
  const { data, isLoading } = trpc.host.getDashboard.useQuery(undefined, { enabled });
  const { data: balance } = trpc.host.getBalance.useQuery(undefined, { enabled });
  const { data: upcoming } = trpc.host.getUpcomingBookings.useQuery(undefined, { enabled });

  const setAvailable = trpc.host.setAvailable.useMutation({
    onSuccess: (res) => {
      toast.success(res.isAvailable ? t("toast.acceptingOn") : t("toast.acceptingOff"));
      utils.host.getDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message || t("toast.acceptingFailed")),
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
        <div className="h-14 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
        <div className="h-20 bg-muted rounded-xl animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 pb-24 min-h-screen bg-card flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-5xl">🏡</div>
        <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">{t("setup.title")}</h1>
        <p className="text-sm text-muted-foreground max-w-xs">{t("setup.body")}</p>
        <Link href="/host-setup">
          <Button className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl px-6">
            {t("setup.cta")}
          </Button>
        </Link>
      </div>
    );
  }

  const { host, todaysBookings, todaysRevenueVnd } = data;
  const avgRating = Number(host.avgRating ?? 0);
  const ratingLabel = (host.totalReviews ?? 0) > 0 ? avgRating.toFixed(1) : "--";
  // Hosts don't use the traveler `useDisplayName()` ladder — they have a
  // separate professional/displayName persona. Plain split is fine here.
  const firstName = user?.displayName?.split(" ")[0] || t("hostFallback");
  const draftCount = data.myListingsCount.draft;
  const publishedCount = data.myListingsCount.published;
  // Next-up bookings (skip today's -- already shown below) for the "This week" strip.
  const todayIso = new Date().toISOString().slice(0, 10);
  const futureBookings = (upcoming ?? []).filter((b) => b.scheduledDate && b.scheduledDate > todayIso).slice(0, 3);

  const nextPayoutDate = balance?.nextPayoutDate
    ? new Date(balance.nextPayoutDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

  return (
    <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      {/* Header -- Messages bell replaces the Messages tab in the nav */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm lg:text-base text-muted-foreground">{t("welcomeBack")}</p>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-secondary">{firstName}!</h1>
        </div>
        <div className="flex items-center gap-3">
          <MessagesBell />
          <Link href="/profile">
            <Avatar className="w-12 h-12">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName || ""} />}
              <AvatarFallback className="bg-secondary text-white font-bold">{(user?.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Headline stats: today / rating / total tours */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{formatVnd(todaysRevenueVnd)}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t("stats.todayVnd")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{ratingLabel}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              {t("stats.rating")} {(host.totalReviews ?? 0) > 0 ? "★" : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{host.totalTours ?? 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t("stats.totalTours")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance card. Stripe-dashboard-style: Available (ready to pay out),
          Pending (earned but not settleable until tour completes), and the
          next payout forecast. The "View earnings" link opens the full
          /host/earnings page where the math, per-experience breakdown,
          and payout history live. */}
      {balance && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-[#faf6ec]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base lg:text-lg text-secondary">{t("balance.title")}</h3>
              <Link href="/host/earnings" className="text-sm text-primary font-semibold">
                {t("balance.viewEarnings")}
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-card border border-secondary/10 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("balance.available")}</p>
                <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{formatVnd(balance.availableVnd)}</p>
                <p className="text-xs text-muted-foreground">{t("balance.readyToPayout")}</p>
              </div>
              <div className="rounded-lg bg-card border border-secondary/10 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("balance.pending")}</p>
                <p className="text-xl lg:text-2xl font-bold text-secondary tabular-nums">{formatVnd(balance.pendingVnd)}</p>
                <p className="text-xs text-muted-foreground">{t("balance.awaitingCompletion")}</p>
              </div>
            </div>

            {balance.inReviewVnd > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-800 uppercase tracking-wider">{t("balance.inReview")}</p>
                  <p className="text-sm font-semibold text-amber-900">{formatVnd(balance.inReviewVnd)}</p>
                </div>
                <p className="text-xs text-amber-700 max-w-[60%] text-right">
                  {t("balance.processing")}
                </p>
              </div>
            )}

            {/* Next-payout forecast. When there's nothing to pay out the
                copy flips to a gentle prompt rather than showing "Next
                payout ₫0", which reads as a bug. */}
            <div className="flex items-center justify-between pt-2 border-t border-secondary/10">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("balance.nextPayout")}</p>
                {balance.availableVnd > 0 ? (
                  <p className="text-sm font-semibold text-secondary">
                    {formatVnd(balance.availableVnd)}{nextPayoutDate ? ` · ${nextPayoutDate}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("balance.firstPayoutHint")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Availability toggle */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-secondary">{t("availability.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {host.isAvailable ? t("availability.openBody") : t("availability.pausedBody")}
            </p>
          </div>
          <Switch
            checked={host.isAvailable ?? false}
            disabled={setAvailable.isPending}
            onCheckedChange={(v) => setAvailable.mutate({ isAvailable: v })}
          />
        </CardContent>
      </Card>

      {/* Drafts-needing-attention CTA. Only surfaces when there's at least one
          draft but zero publishes -- a brand-new host. Once they have a live
          listing the prompt is more about quality than existence, so we let
          them discover drafts through the Marketplace card instead. */}
      {draftCount > 0 && publishedCount === 0 && (
        <Link href="/host/experiences" className="block">
          <Card className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-400">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="text-2xl">✏️</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm lg:text-base font-semibold text-amber-900">
                  {t("draftPrompt.title", { count: draftCount })}
                </p>
                <p className="text-sm text-amber-800 mt-0.5">
                  {t("draftPrompt.body")}
                </p>
              </div>
              <svg className="w-5 h-5 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* My experiences marketplace card */}
      <Link href="/host/experiences" className="block">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-secondary to-sage text-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/70 font-semibold">{t("marketplace.eyebrow")}</p>
              <p className="text-base lg:text-lg font-semibold mt-0.5">{t("marketplace.title")}</p>
              <p className="text-sm text-white/85 mt-0.5">
                {t("marketplace.published", { count: publishedCount })}
                {" \u00B7 "}
                {t("marketplace.draft", { count: draftCount })}
                {data.myListingsCount.archived > 0 && (
                  <>
                    {" \u00B7 "}
                    {t("marketplace.archived", { count: data.myListingsCount.archived })}
                  </>
                )}
              </p>
            </div>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </CardContent>
        </Card>
      </Link>

      {/* Today's Bookings */}
      <div>
        <h2 className="text-lg lg:text-xl font-semibold text-secondary mb-3">{t("today.title")}</h2>
        {todaysBookings.length === 0 ? (
          <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
            <CardContent className="p-6 text-center space-y-2">
              <div className="text-3xl">🌿</div>
              <p className="text-base font-medium text-secondary">{t("today.empty.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("today.empty.body")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todaysBookings.map((booking) => (
              <Card key={booking.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    {booking.travelerAvatar && <AvatarImage src={booking.travelerAvatar} alt={booking.travelerName || ""} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {(booking.travelerName || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm lg:text-base truncate">{booking.tourTitle || t("today.untitledTour")}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {t("today.withTraveler", { name: booking.travelerName || t("today.travelerFallback") })}
                      {booking.scheduledStart ? t("today.atTime", { time: booking.scheduledStart }) : ""}
                    </p>
                  </div>
                  <Badge
                    className={
                      booking.status === "active"
                        ? "bg-primary text-primary-foreground border-0 text-xs"
                        : "bg-sage text-earth border-0 text-xs"
                    }
                  >
                    {booking.status === "active" ? t("today.statusInProgress") : t("today.statusConfirmed")}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming (this week) preview. Separate from Today to keep the mental
          model clear: Today is actionable now, Upcoming is prep. Links out
          to /host/bookings for the full calendar. */}
      {futureBookings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg lg:text-xl font-semibold text-secondary">{t("upcoming.title")}</h2>
            <Link href="/host/bookings" className="text-sm text-primary font-semibold">
              {t("upcoming.seeAll")}
            </Link>
          </div>
          <div className="space-y-2">
            {futureBookings.map((booking) => (
              <Card key={booking.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-card flex flex-col items-center justify-center shrink-0">
                    <p className="text-xs text-secondary font-semibold uppercase">
                      {formatRelativeDate(booking.scheduledDate, tRel, {
                        locale: locale === "vi" ? "vi-VN" : "en-US",
                      }).split(" ")[0]}
                    </p>
                    <p className="text-sm font-bold text-secondary leading-tight">
                      {booking.scheduledDate?.slice(8, 10)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm lg:text-base truncate">{booking.tourTitle || t("today.untitledTour")}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {booking.travelerName || t("today.travelerFallback")}
                      {booking.scheduledStart ? ` · ${booking.scheduledStart}` : ""}
                      {booking.groupSize
                        ? ` · ${t("upcoming.guests", { n: Number(booking.groupSize) })}`
                        : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Browse-marketplace shortcut. Hosts are also curious travelers; this
          lets them see how their listings stack up against other experiences
          without having to remember traveler URLs. */}
      <Link href="/experiences" className="block">
        <Card className="border-0 shadow-sm border-dashed border-2 border-secondary/20 bg-transparent">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm lg:text-base font-semibold text-secondary">{t("browseMarketplace.title")}</p>
              <p className="text-sm text-muted-foreground">{t("browseMarketplace.body")}</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </CardContent>
        </Card>
      </Link>

      {/* Account actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/host-setup">
          <Button variant="outline" className="w-full h-12 rounded-xl text-sm">{t("actions.updateProfile")}</Button>
        </Link>
        <Link href="/security">
          <Button variant="outline" className="w-full h-12 rounded-xl text-sm">{t("actions.accountSecurity")}</Button>
        </Link>
      </div>
    </div>
  );
}
