"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fixedTourImage } from "@/lib/fixed-tour-images";
import { formatVndPrice } from "@/lib/format";
import { AXIS_KEYS, topContributingAxes } from "@/lib/match-explain";
import { useAuthStore } from "@/stores/auth";

/**
 * The shape this card cares about. Mirrors the per-tour rows returned
 * by `trpc.fixedTour.list` — kept loose with `Pick`-style optionality
 * so the experiences page can pass `fixedData.tours[0]` straight
 * through without re-mapping.
 */
export interface TopMatchTour {
  tourId: string;
  titleVi: string;
  titleEn: string;
  storyScriptVi: string;
  storyScriptEn: string;
  durationMinutes: number;
  maxParticipants: number;
  basePriceVnd: number;
  matchPercent: number | null;
  vector: readonly number[];
}

export interface TopMatchCardProps {
  /** The single highest-ranked Fixed Tour for the signed-in user, or
   *  null when the catalog is empty / not yet loaded. */
  topTour: TopMatchTour | null;
  /** Did the server compute personalised rankings? When false, the user
   *  is signed in but hasn't completed the personality quiz yet. */
  userHasVector: boolean;
  /** The user's 4-D personality vector — used to compute the per-axis
   *  "why it fits" line. May be null when `userHasVector` is false or
   *  when the API hasn't loaded yet. */
  userVector: readonly number[] | null;
  /** True while the tours query is still in flight. */
  isLoading: boolean;
}

/**
 * Recommendation hero card pinned to the top of `/experiences`.
 *
 * Renders one of four states, in priority order:
 *
 *   1. Anonymous visitor                           → null (hidden)
 *   2. Loading                                     → skeleton
 *   3. Signed-in user without a personality vector → `QuizPromptBanner`
 *   4. Signed-in user with a vector + a top tour   → hero card with
 *      bilingual title, per-axis "why it fits", price, and CTAs
 *
 * State 4 mirrors the bilingual-tour-card pattern used elsewhere on the
 * experiences page (primary title in locale + muted italic secondary in
 * the other language), and the per-axis line is driven by
 * `topContributingAxes(userVector, topTour.vector, 2)` — a pure
 * client-side computation against the 4-D vectors the server already
 * returns.
 */
export function TopMatchCard({
  topTour,
  userHasVector,
  userVector,
  isLoading,
}: TopMatchCardProps) {
  const { user } = useAuthStore();

  // Anonymous: hide entirely. The hero CTA above ("Sign up free")
  // already drives registration; duplicating that signal here would
  // crowd the surface.
  if (!user) return null;

  if (isLoading) return <TopMatchSkeleton />;

  if (!userHasVector) return <QuizPromptBanner />;

  if (!topTour) return null;

  return <RankedHeroCard topTour={topTour} userVector={userVector} />;
}

/* ───────────────────────────────────────────────────────────────────── */
/*  State 4 — the actual recommendation                                  */
/* ───────────────────────────────────────────────────────────────────── */

function RankedHeroCard({
  topTour,
  userVector,
}: {
  topTour: TopMatchTour;
  userVector: readonly number[] | null;
}) {
  const t = useTranslations("experiences.topMatch");
  const locale = useLocale();
  const router = useRouter();

  const primaryTitle = locale === "vi" ? topTour.titleVi : topTour.titleEn;
  const secondaryTitle = locale === "vi" ? topTour.titleEn : topTour.titleVi;
  const story = locale === "vi" ? topTour.storyScriptVi : topTour.storyScriptEn;
  const hours = Math.round(topTour.durationMinutes / 60);

  // Per-axis explanation: top 2 axes that contribute most to the
  // dot product between user + tour vectors. Empty when either vector
  // is missing or all-zero on the overlap — in those cases the
  // why-it-fits line is suppressed rather than asserting a bogus axis.
  const axisIndices =
    userVector && userVector.length === topTour.vector.length
      ? topContributingAxes(userVector, topTour.vector, 2)
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden border-2 border-brick/35 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Image */}
          <div className="relative lg:col-span-5 h-56 sm:h-64 lg:h-auto lg:min-h-[320px] bg-muted">
            <Image
              src={fixedTourImage(topTour.tourId)}
              alt={primaryTitle}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-card/0" />
            {topTour.matchPercent !== null && (
              <div className="absolute top-3 left-3 lg:top-4 lg:left-4">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-md"
                  aria-label={t("matchSuffix", { pct: topTour.matchPercent })}
                >
                  {t("matchSuffix", { pct: topTour.matchPercent })}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <CardContent className="lg:col-span-7 p-5 lg:p-7 flex flex-col gap-3 lg:gap-4">
            <span className="text-eyebrow">{t("eyebrow")}</span>

            <div className="flex flex-col gap-1">
              <h2 className="text-h1 font-voice text-brick text-foreground leading-tight">
                {primaryTitle}
              </h2>
              <p className="font-serif italic text-sm text-muted-foreground/85">
                {secondaryTitle}
              </p>
            </div>

            <WhyItFits axisIndices={axisIndices} />

            <p className="text-sm text-foreground/85 leading-relaxed line-clamp-3">
              {story}
            </p>

            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap mt-1">
              {t("durationMaxPrice", {
                hours,
                max: topTour.maxParticipants,
                price: formatVndPrice(topTour.basePriceVnd),
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-auto pt-2">
              <Button
                size="brand"
                onClick={() => router.push(`/fixed-tours/${topTour.tourId}`)}
              >
                {t("viewCta")} →
              </Button>
              <a
                href="#chapter-morning"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-foreground/25 bg-card text-sm font-semibold tracking-[0.005em] text-foreground hover:bg-muted transition-colors"
              >
                {t("browseCta")} ↓
              </a>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Renders "Strong on your <Axis1> and <Axis2> axes." with italic-serif
 * axis names inline. Falls back to single-axis form when only one
 * contributing axis is meaningful, and hides itself entirely when
 * `axisIndices` is empty (degenerate vector overlap).
 *
 * next-intl `t.rich` pattern: the JSON template wraps interpolated
 * variables in `<em>...</em>` tags. That means we register ONE tag
 * handler keyed `em` (which receives the chunks the template puts
 * inside the tag), and pass the actual axis labels as plain string
 * variables — NOT as render functions named after the variables.
 * Passing a render function where a string is expected makes next-intl
 * fall back to rendering the raw message key.
 */
function WhyItFits({ axisIndices }: { axisIndices: number[] }) {
  const t = useTranslations("experiences.topMatch");
  if (axisIndices.length === 0) return null;

  const axisOneKey = AXIS_KEYS[axisIndices[0]!];
  if (!axisOneKey) return null;
  const axisOneLabel = t(`axis.${axisOneKey}`);

  const emTag = (chunks: ReactNode) => (
    <em className="font-serif italic text-brick">{chunks}</em>
  );

  if (axisIndices.length >= 2) {
    const axisTwoKey = AXIS_KEYS[axisIndices[1]!];
    if (!axisTwoKey) return null;
    const axisTwoLabel = t(`axis.${axisTwoKey}`);
    return (
      <p className="text-sm font-medium text-brick/90">
        {t.rich("whyItFitsTwo", {
          em: emTag,
          axisOne: axisOneLabel,
          axisTwo: axisTwoLabel,
        })}
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-brick/90">
      {t.rich("whyItFitsOne", {
        em: emTag,
        axisOne: axisOneLabel,
      })}
    </p>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  State 3 — signed in but no quiz vector                               */
/* ───────────────────────────────────────────────────────────────────── */

function QuizPromptBanner() {
  const t = useTranslations("experiences.topMatch.quizPrompt");
  return (
    <Card className="border-dashed border-2 border-secondary/40 bg-secondary/[0.05] overflow-hidden">
      <CardContent className="p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
        <div className="flex-1 space-y-1">
          <span className="text-eyebrow">{t("eyebrow")}</span>
          <h2 className="text-display font-voice text-brick text-foreground leading-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">{t("subtitle")}</p>
        </div>
        <Link
          href="/onboarding/chat"
          className="shrink-0 inline-flex items-center justify-center h-11 px-6 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold tracking-[0.005em] hover:bg-secondary/90 transition-colors whitespace-nowrap"
        >
          {t("cta")} →
        </Link>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  State 2 — loading                                                    */
/* ───────────────────────────────────────────────────────────────────── */

function TopMatchSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border-2 border-muted">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <Skeleton className="h-56 sm:h-64 lg:h-auto lg:min-h-[320px] lg:col-span-5 rounded-none" />
        <div className="lg:col-span-7 p-5 lg:p-7 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-2/3 mt-1" />
          <Skeleton className="h-4 w-full mt-1" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-3">
            <Skeleton className="h-11 w-40 rounded-full" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
