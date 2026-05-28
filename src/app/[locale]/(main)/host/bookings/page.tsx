"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { statusBadge, type StatusTone } from "@/lib/format";

// Host dashboard tones: primary green for live "in progress", sage for
// confirmed, soft amber for needs-wrap-up, muted slate for completed.
const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-sage text-earth",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-primary text-primary-foreground",
  neutral: "bg-muted/80 text-foreground/80",
};

// Accept the common intersection between `host.getUpcomingBookings` (has
// `experienceId`) and `host.getPastBookings` (has `completedAt`). We only
// read the shared fields inside the card, so typing it to the intersection
// avoids leaking procedure-specific schema into the UI.
type BookingRow = {
  id: string;
  status: string | null;
  scheduledDate: string | null;
  scheduledStart: string | null;
  groupSize: string | null;
  tourTitle: string | null;
  priceAmount: number | null;
  travelerName: string | null;
  travelerAvatar: string | null;
  travelerLanguages?: string[] | null;
};

function formatDateHeader(isoDate: string | null, locale: string, fallback: string): string {
  if (!isoDate) return fallback;
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupByDate<T extends { scheduledDate: string | null }>(rows: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const row of rows) {
    const key = row.scheduledDate || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return groups;
}

function BookingCard({ booking, variant }: { booking: BookingRow; variant: "upcoming" | "past" }) {
  const t = useTranslations("host.bookings");
  const tStatus = useTranslations("common.status");
  const badge = statusBadge(booking.status, {
    context: variant === "past" ? "host_booking_past" : "host_booking_upcoming",
  });
  const badgeLabel = badge.rawFallback ?? tStatus(badge.labelKey);

  // Spoken-languages chip — shown when the traveler filled in the
  // Profile → Spoken languages picker. Hosts use this to greet in the
  // right tongue. We cap at two to keep the row tidy on mobile and surface
  // the rest as "+N" tooltip hint.
  const languages = (booking.travelerLanguages || []).filter(Boolean);
  const visibleLangs = languages.slice(0, 2);
  const overflowLangs = languages.length - visibleLangs.length;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar className="w-10 h-10">
          {booking.travelerAvatar && <AvatarImage src={booking.travelerAvatar} alt={booking.travelerName || ""} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
            {(booking.travelerName || "?")[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{booking.tourTitle || t("untitledTour")}</p>
          <p className="text-xs text-muted-foreground truncate">
            {booking.travelerName || t("travelerFallback")}
            {booking.scheduledStart ? ` · ${booking.scheduledStart}` : ""}
            {booking.groupSize
              ? ` · ${t("guests", { n: Number(booking.groupSize) })}`
              : ""}
          </p>
          {visibleLangs.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/70">{t("speaks")}</span>
              {visibleLangs.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center px-1.5 py-px rounded-full bg-sage/25 text-foreground text-xs font-medium"
                >
                  {l}
                </span>
              ))}
              {overflowLangs > 0 && (
                <span
                  title={languages.slice(2).join(", ")}
                  className="inline-flex items-center px-1.5 py-px rounded-full bg-muted text-muted-foreground text-xs font-medium"
                >
                  +{overflowLangs}
                </span>
              )}
            </div>
          )}
        </div>
        <Badge className={`${TONE_CLASSES[badge.tone]} border-0 text-xs`}>{badgeLabel}</Badge>
      </CardContent>
    </Card>
  );
}

/**
 * Host bookings page. Splits bookings into Upcoming (today-or-later paid/active)
 * and Past (completed OR past-dated paid/active). Within each tab, rows are
 * grouped by calendar date so the host can scan their day at a glance.
 *
 * Uses the same two procedures the dashboard already invokes, so visiting
 * /host/bookings after the dashboard hits no extra queries (both are cached
 * by tRPC).
 */
export default function HostBookingsPage() {
  const { user } = useAuthStore();
  const t = useTranslations("host.bookings");
  const locale = useLocale();
  const enabled = !!user && (user.role === "host" || user.role === "admin");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: upcoming, isLoading: loadingUpcoming } = trpc.host.getUpcomingBookings.useQuery(undefined, { enabled });
  const { data: past, isLoading: loadingPast } = trpc.host.getPastBookings.useQuery(undefined, { enabled });

  const isLoading = tab === "upcoming" ? loadingUpcoming : loadingPast;
  const rows: BookingRow[] = (tab === "upcoming" ? upcoming : past) ?? [];
  const grouped = groupByDate(rows);
  const orderedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return tab === "upcoming" ? a.localeCompare(b) : b.localeCompare(a);
  });

  if (!enabled) {
    return (
      <div className="p-6 pb-24 text-center text-sm text-muted-foreground">
        {t("hostOnly")}
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-secondary">{t("title")}</h1>
        <Link href="/host" className="text-sm text-primary font-semibold">
          {t("backToDashboard")}
        </Link>
      </div>

      {/* Tab switcher. Matches the visual weight of Base UI tabs without
          pulling in a new dependency -- this surface only has two tabs. */}
      <div className="inline-flex rounded-full bg-card p-1 w-full">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
            tab === "upcoming" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {t("tabs.upcoming")} {upcoming ? `(${upcoming.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("past")}
          className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
            tab === "past" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          {t("tabs.past")} {past ? `(${past.length})` : ""}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-2 border-border shadow-none bg-transparent">
          <CardContent className="p-8 text-center space-y-2">
            <div className="text-4xl">
              {tab === "upcoming" ? "🗓️" : "📘"}
            </div>
            <p className="text-sm font-medium text-secondary">
              {tab === "upcoming" ? t("empty.upcomingTitle") : t("empty.pastTitle")}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {tab === "upcoming" ? t("empty.upcomingBody") : t("empty.pastBody")}
            </p>
            {tab === "upcoming" && (
              <Link href="/host/experiences" className="inline-block pt-2 text-sm text-primary font-semibold">
                {t("empty.manageListings")}
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orderedKeys.map((dateKey) => (
            <div key={dateKey} className="space-y-2">
              <p className="text-xs uppercase tracking-widest font-semibold text-secondary/70">
                {dateKey === "unknown" ? t("dateTbd") : formatDateHeader(dateKey, locale, t("dateTbd"))}
              </p>
              {grouped[dateKey].map((booking) => (
                <BookingCard key={booking.id} booking={booking} variant={tab} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
