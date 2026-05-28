"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoiVanDivider } from "@/components/brand";
import { fixedTourImage } from "@/lib/fixed-tour-images";
import { formatVndPrice } from "@/lib/format";

const DEFAULT_START_TIMES: Record<string, string> = {
  MORNING_SHIFT: "07:00",
  AFTERNOON_SHIFT: "14:00",
  EVENING_SHIFT: "19:00",
};

// Floor for the final step's range when seed data carries a stale
// `tour.durationMinutes` shorter than the last step's offset. Keeps the
// sticky bar's `lastClock` strictly after the last step's `startClock`.
const LAST_STEP_TAIL_MIN = 30;

/**
 * Convert a `"HH:MM"` start time + an offset in minutes to a wall-clock
 * `"HH:MM"` string, wrapping at 24h. Mirrors the server-side math in
 * `app/src/server/routers/fixedTour.router.ts` so the two surfaces never
 * drift.
 */
function clockFromOffset(startTimeHHmm: string, offsetMinutes: number): string {
  const [h, m] = startTimeHHmm.split(":").map((n) => parseInt(n, 10));
  const total = h * 60 + m + offsetMinutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

type TimelineStep = {
  id: string;
  targetTimeOffset: number;
  locationNameVi: string;
  locationNameEn: string;
  actionLogVi: string;
  actionLogEn: string;
};

type TimelineTour = {
  durationMinutes: number;
  steps: TimelineStep[];
};

/**
 * Derive the canonical per-step clock ranges + total duration for the
 * Fixed Tour timeline. Consecutive steps are treated as contiguous:
 * each step's range covers from its `targetTimeOffset` up to the next
 * step's offset, so bundled travel time is folded into each step's
 * range (no separate "transit" segment).
 *
 * `totalMinutes` floors at `lastStep.targetTimeOffset + LAST_STEP_TAIL_MIN`
 * to guarantee `firstClock → lastClock` strictly covers every step row,
 * even when the seed-default `tour.durationMinutes` is stale. The last
 * row's `endClock` therefore equals the sticky bar's `lastClock` by
 * construction.
 */
function deriveTimeline(tour: TimelineTour, effectiveStartTime: string) {
  const steps = tour.steps;
  const lastStep = steps[steps.length - 1];
  const lastOffset = lastStep?.targetTimeOffset ?? 0;
  const totalMinutes = Math.max(
    tour.durationMinutes,
    lastOffset + LAST_STEP_TAIL_MIN,
  );
  const totalHours = Math.floor(totalMinutes / 60);
  const totalRemMin = totalMinutes % 60;
  const firstOffset = steps[0]?.targetTimeOffset ?? 0;
  const firstClock = clockFromOffset(effectiveStartTime, firstOffset);
  const lastClock = clockFromOffset(effectiveStartTime, totalMinutes);
  const rows = steps.map((step, i) => {
    const isLast = i === steps.length - 1;
    const nextOffset = isLast
      ? step.targetTimeOffset + (totalMinutes - lastOffset)
      : steps[i + 1].targetTimeOffset;
    return {
      id: step.id,
      startClock: clockFromOffset(effectiveStartTime, step.targetTimeOffset),
      endClock: clockFromOffset(effectiveStartTime, nextOffset),
      locationNameVi: step.locationNameVi,
      locationNameEn: step.locationNameEn,
      actionLogVi: step.actionLogVi,
      actionLogEn: step.actionLogEn,
    };
  });
  return {
    totalMinutes,
    totalHours,
    totalRemMin,
    firstClock,
    lastClock,
    rows,
  };
}

/**
 * Fixed Tour detail. Bilingual story (Vietnamese primary, English
 * collapsible), itinerary timeline from `fixed_tour_steps`, MATERIAL +
 * PERSONA + KEYWORD tag chips, and a "Đặt tour" CTA that calls the
 * `fixedTour.book` mutation and bounces to `/tour/[id]/checkout`.
 */
export default function FixedTourDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tourId = params?.id ?? "";
  const { user } = useAuthStore();
  const locale = useLocale();
  const t = useTranslations("fixedTour");
  // Strict-mono: default the story toggle to the active locale rather
  // than always showing Vietnamese first. The toggle still lets the
  // user pivot to the other language if they want.
  const [showEnglish, setShowEnglish] = useState(locale === "en");

  const { data: tour, isLoading } = trpc.fixedTour.getById.useQuery(
    { tourId },
    { enabled: !!tourId },
  );

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState<string>("");
  // Default to 2 (matches the new `fixed_tours.min_participants` default).
  // A `useEffect` below bumps this up if a specific tour ships a higher
  // minimum (e.g. private-only tours that require 4+). Solo bookings are
  // intentionally rejected -- the Customized Tour is the solo path.
  const [groupSize, setGroupSize] = useState(2);

  const minParticipants = tour?.minParticipants ?? 2;

  // Sync groupSize when the tour loads (or when a higher-min tour is
  // navigated to). Only bumps UP, never down -- a user who just lowered
  // their picker shouldn't have it overridden by an async refetch.
  useEffect(() => {
    if (minParticipants > groupSize) {
      setGroupSize(minParticipants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minParticipants]);

  // Default the start time as soon as we know the chapter — saves the
  // user from picking a time outside the spec's chapter window.
  const effectiveStartTime =
    startTime ||
    (tour ? DEFAULT_START_TIMES[tour.chapter as string] ?? "08:00" : "08:00");

  const bookMutation = trpc.fixedTour.book.useMutation({
    onSuccess: (res) => {
      router.push(`/tour/${res.tourId}/checkout`);
    },
    onError: (err) => {
      toast.error(err.message ?? t("book.errorFallback"));
    },
  });

  if (isLoading || !tour) {
    return (
      <PageTransition>
        <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-4">
          <div className="h-10 bg-muted rounded animate-pulse w-1/2" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-48 bg-muted rounded animate-pulse" />
        </div>
      </PageTransition>
    );
  }

  const handleBook = () => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/fixed-tours/${tourId}`)}`);
      return;
    }
    bookMutation.mutate({
      tourId,
      date,
      startTime: effectiveStartTime,
      groupSize,
    });
  };

  const chapterLabel = t(`chapter.${tour.chapter as string}`);

  // Strict-mono hero/itinerary titles: render the active locale's text
  // only. The DB carries both languages on every Fixed Tour and every
  // step so we just pick the right field.
  const heroTitle = locale === "vi" ? tour.titleVi : tour.titleEn;

  // Single source of truth for every clock surface on the page. Threading
  // `effectiveStartTime` here makes the sticky bar, quick-facts, and
  // every step row roll in lockstep when the booking form's start time
  // changes — no extra state needed.
  const timeline = deriveTimeline(tour, effectiveStartTime);

  return (
    <PageTransition>
      <div className="pb-32 lg:pb-12">
        {/* Hero image, full-bleed within the page padding. Title +
            subtitle overlaid in white over a gradient for legibility on
            both dark and bright shots. Match% pill sits top-right when
            the user has a quiz vector. */}
        <div className="relative h-64 lg:h-80 overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fixedTourImage(tour.tourId)}
            alt={heroTitle}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-4 lg:p-8">
            <div className="lg:max-w-5xl lg:mx-auto w-full">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="guide" className="bg-card/95 backdrop-blur-sm">
                  {chapterLabel}
                </Badge>
              </div>
              <h1 className="text-display font-voice text-white leading-tight">
                {heroTitle}
              </h1>
            </div>
          </div>
          {tour.matchPercent !== null && tour.matchPercent !== undefined && (
            <div className="absolute top-4 right-4 lg:top-6 lg:right-8">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md">
                {t("matchPill", { pct: tour.matchPercent })}
              </span>
            </div>
          )}
        </div>

        {/* Sticky duration bar — pins below TopNav (h-14 / lg:h-16, z-40)
            and is the canonical source of total time for the page. The
            clocks here equal the first/last step's start/end exactly
            because both surfaces call `clockFromOffset` with the same
            `effectiveStartTime`. */}
        <div className="sticky top-14 lg:top-16 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="lg:max-w-5xl lg:mx-auto px-4 lg:px-8 py-2.5 flex items-center gap-3 lg:gap-5 text-sm">
            <span className="font-serif italic text-base text-foreground tabular-nums">
              {timeline.firstClock} <span className="text-muted-foreground">→</span>{" "}
              {timeline.lastClock}
            </span>
            <span className="text-eyebrow text-muted-foreground">·</span>
            <span className="text-eyebrow text-foreground tabular-nums">
              {timeline.totalHours}h{timeline.totalRemMin ? ` ${timeline.totalRemMin}m` : ""}
            </span>
            <span className="text-eyebrow text-muted-foreground">·</span>
            <span className="text-eyebrow text-muted-foreground">
              {t("itinerary.stepCount", { n: tour.steps.length })}
            </span>
          </div>
        </div>

        <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-8">
          {/* Story copy + locale toggle. The button still lets the
             reader pivot to the other-language version (the story script
             is editorial brand copy; both languages live in the DB), but
             the default tracks the active App Language. */}
          <div className="space-y-3 max-w-3xl">
            <p className="text-sm lg:text-base text-foreground/85 leading-relaxed">
              {showEnglish ? tour.storyScriptEn : tour.storyScriptVi}
            </p>
            <button
              type="button"
              onClick={() => setShowEnglish((v) => !v)}
              className="text-xs font-semibold text-brick hover:underline"
            >
              {showEnglish ? t("story.readVietnamese") : t("story.readEnglish")}
            </button>
          </div>

          {/* Quick facts */}
          <Card className="p-0 overflow-hidden">
            <CardContent className="grid grid-cols-3 divide-x divide-border p-0">
              <div className="px-5 py-4">
                <p className="text-eyebrow">{t("facts.duration")}</p>
                <p className="font-serif italic text-lg text-foreground tabular-nums">
                  {timeline.totalHours}h{timeline.totalRemMin ? ` ${timeline.totalRemMin}m` : ""}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-eyebrow">{t("facts.groupSize")}</p>
                <p className="font-serif italic text-lg text-foreground">
                  {t("facts.groupSizeValue", { n: tour.maxParticipants })}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-eyebrow">{t("facts.pricePerPerson")}</p>
                <p className="font-serif text-lg text-brick whitespace-nowrap">
                  {formatVndPrice(tour.basePriceVnd)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Itinerary timeline. Two-column grid so absolute clock
              times anchor the left edge and visually align with the
              sticky bar's firstClock / lastClock. Each row's
              start/end clocks come from `deriveTimeline` so the math
              is identical to the sticky bar. Strict-mono: each row
              renders just one language (active locale) for the place
              name, and the action log follows the user's story-toggle
              preference (defaults to active locale). */}
          <section className="space-y-3">
            <h2 className="text-h1 font-voice text-brick text-foreground">{t("itinerary.title")}</h2>
            <ol className="space-y-6">
              {timeline.rows.map((row) => {
                const rowName = locale === "vi" ? row.locationNameVi : row.locationNameEn;
                return (
                <li key={row.id} className="grid grid-cols-[5rem_1fr] sm:grid-cols-[6rem_1fr] gap-4">
                  <div className="text-right tabular-nums">
                    <p className="font-serif text-base text-brick">{row.startClock}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{row.endClock}</p>
                  </div>
                  <div className="relative pl-4 border-l border-border">
                    <span className="absolute -left-[7px] top-1.5 inline-block w-3.5 h-3.5 rounded-full bg-brick ring-4 ring-background" />
                    <h3 className="font-serif italic text-base text-foreground">
                      {rowName}
                    </h3>
                    <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                      {showEnglish ? row.actionLogEn : row.actionLogVi}
                    </p>
                  </div>
                </li>
                );
              })}
            </ol>
          </section>

          {/* Tags */}
          {(tour.tags.material.length > 0 ||
            tour.tags.persona.length > 0 ||
            tour.tags.keyword.length > 0) && (
            <section className="space-y-3">
              <HoiVanDivider />
              <h2 className="text-h1 font-voice text-brick text-foreground">{t("tags.title")}</h2>
              <div className="flex flex-wrap gap-1.5">
                {tour.tags.material.map((t) => (
                  <Badge key={t} variant="fixed">
                    {t}
                  </Badge>
                ))}
                {tour.tags.persona.map((t) => (
                  <Badge key={t} variant="workshop">
                    {t.replace(/_/g, " ")}
                  </Badge>
                ))}
                {tour.tags.keyword.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Booking form. Sticky-on-mobile would be nice; for v1 it sits
              at the bottom of the page like the existing experience flow. */}
          <section className="space-y-4">
            <HoiVanDivider />
            <h2 className="text-h1 font-voice text-brick text-foreground">{t("book.title")}</h2>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-eyebrow">{t("book.dateLabel")}</label>
                    <Input
                      type="date"
                      value={date}
                      min={today}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-eyebrow">{t("book.startTimeLabel")}</label>
                    <Input
                      type="time"
                      value={effectiveStartTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-eyebrow">{t("book.groupSizeLabel")}</label>
                    <Input
                      type="number"
                      min={minParticipants}
                      max={tour.maxParticipants}
                      value={groupSize}
                      onChange={(e) =>
                        setGroupSize(
                          Math.max(
                            minParticipants,
                            Math.min(tour.maxParticipants, parseInt(e.target.value, 10) || minParticipants),
                          ),
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("book.minParticipantsHint", { n: minParticipants })}
                      {" · "}
                      <Link href="/plan/build" className="text-brick font-semibold hover:underline">
                        {t("book.soloEscape")}
                      </Link>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-eyebrow">{t("book.totalLabel")}</p>
                    <p className="font-serif text-2xl text-brick leading-none whitespace-nowrap">
                      {formatVndPrice(tour.basePriceVnd * groupSize)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("book.pricePerCount", {
                        price: formatVndPrice(tour.basePriceVnd),
                        n: groupSize,
                      })}
                    </p>
                  </div>
                  <Button
                    size="brand"
                    onClick={handleBook}
                    disabled={bookMutation.isPending}
                  >
                    {bookMutation.isPending ? t("book.ctaPending") : t("book.cta")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
