"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVndPrice } from "@/lib/format";
import { AXIS_KEYS, topContributingAxes } from "@/lib/match-explain";
import { useAuthStore } from "@/stores/auth";
import {
  ConicalHat,
  DongSonSun,
  FolkStar,
  Lotus,
  MamCom,
  Waves,
} from "./illustrations";

/**
 * Shape the card cares about. Mirrors the per-template rows returned by
 * `trpc.customizedTourTemplate.list`. The mandatory bilingual fields are
 * `title{Vi,En}`, `subtitle{Vi,En}`, and `story{Vi,En}` — all three are
 * required by the i18n contract since the customized templates show
 * primary + secondary language inline.
 */
export interface CustomizedTopMatchTemplate {
  templateId: string;
  titleVi: string;
  titleEn: string;
  subtitleVi: string | null;
  subtitleEn: string | null;
  storyVi: string;
  storyEn: string;
  theme: string;
  durationMinutes: number;
  maxParticipants: number;
  basePriceVnd: number;
  matchPercent: number | null;
  vector: readonly number[];
}

export interface CustomizedTopMatchCardProps {
  topTemplate: CustomizedTopMatchTemplate | null;
  userHasVector: boolean;
  userVector: readonly number[] | null;
  isLoading: boolean;
}

/**
 * Recommendation hero card pinned to the top of `/plan/build` — the
 * Customized Tour counterpart to the Fixed Tour `TopMatchCard`.
 *
 * Four state variants in priority order:
 *
 *   1. Anonymous visitor                           → null (hidden)
 *   2. Loading                                     → skeleton
 *   3. Signed-in user without a personality vector → `QuizPromptBanner`
 *   4. Signed-in user with a vector + top template → recommendation card
 *      with bilingual title + subtitle, per-axis "why it fits", price
 *      range, theme tag, and routing to the template detail page.
 *
 * State 4 mirrors the Fixed Tour pattern (bilingual primary heading +
 * muted italic secondary line). Per-axis line uses the same shared
 * `topContributingAxes` helper as the experiences hub.
 *
 * Visual signature differs from the Fixed Tour card: no photo (templates
 * don't book end-to-end so they don't carry a hero image yet), instead a
 * theme-driven brand illustration provides the visual motif. Keeps the
 * card identifiable as the customized-product surface rather than a
 * carbon copy of the fixed-tour hero.
 */
export function CustomizedTopMatchCard({
  topTemplate,
  userHasVector,
  userVector,
  isLoading,
}: CustomizedTopMatchCardProps) {
  const { user } = useAuthStore();

  if (!user) return null;
  if (isLoading) return <CustomizedTopMatchSkeleton />;
  if (!userHasVector) return <QuizPromptBanner />;
  if (!topTemplate) return null;

  return <RankedHeroCard topTemplate={topTemplate} userVector={userVector} />;
}

/* ───────────────────────────────────────────────────────────────────── */
/*  State 4 — the actual recommendation                                  */
/* ───────────────────────────────────────────────────────────────────── */

function RankedHeroCard({
  topTemplate,
  userVector,
}: {
  topTemplate: CustomizedTopMatchTemplate;
  userVector: readonly number[] | null;
}) {
  const t = useTranslations("plan.topMatch");
  const tTemplate = useTranslations("plan.template");
  const locale = useLocale();
  const router = useRouter();

  const primaryTitle = locale === "vi" ? topTemplate.titleVi : topTemplate.titleEn;
  const secondaryTitle = locale === "vi" ? topTemplate.titleEn : topTemplate.titleVi;
  const subtitle = locale === "vi" ? topTemplate.subtitleVi : topTemplate.subtitleEn;
  const story = locale === "vi" ? topTemplate.storyVi : topTemplate.storyEn;
  const hours = Math.round(topTemplate.durationMinutes / 60);

  const axisIndices =
    userVector && userVector.length === topTemplate.vector.length
      ? topContributingAxes(userVector, topTemplate.vector, 2)
      : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden border-2 border-brick/35 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Decorative motif panel. Themed brand illustration on a
             warm gradient — no photo dependency because templates feed
             the cart instead of booking end-to-end. */}
          <div className="relative lg:col-span-5 h-44 sm:h-56 lg:h-auto lg:min-h-[320px] bg-gradient-to-br from-brick/8 via-mustard/10 to-secondary/8 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-brick/25 pointer-events-none">
              <ThemeMotif theme={topTemplate.theme} />
            </div>
            {topTemplate.matchPercent !== null && (
              <div className="absolute top-3 left-3 lg:top-4 lg:left-4">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-md"
                  aria-label={t("matchSuffix", { pct: topTemplate.matchPercent })}
                >
                  {t("matchSuffix", { pct: topTemplate.matchPercent })}
                </span>
              </div>
            )}
            <div className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4">
              <ThemeBadge theme={topTemplate.theme} />
            </div>
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

            {subtitle && (
              <p className="font-serif italic text-base text-foreground/80 leading-snug">
                {subtitle}
              </p>
            )}

            <WhyItFits axisIndices={axisIndices} />

            <p className="text-sm text-foreground/85 leading-relaxed line-clamp-3">
              {story}
            </p>

            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap mt-1">
              {t("durationMaxPrice", {
                hours,
                max: topTemplate.maxParticipants,
                price: formatVndPrice(topTemplate.basePriceVnd),
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-auto pt-2">
              <Button
                size="brand"
                onClick={() => router.push(`/plan/templates/${topTemplate.templateId}`)}
              >
                {t("viewCta")} →
              </Button>
              <Link
                href="/activities"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-foreground/25 bg-card text-sm font-semibold tracking-[0.005em] text-foreground hover:bg-muted transition-colors"
              >
                {t("browseCta")} →
              </Link>
            </div>

            {/* Tiny tag-style identifier for the theme — matches the
               template detail page so the user can carry the theme name
               forward through the funnel. */}
            <span className="sr-only">{tTemplate(`themeValue.${themeKey(topTemplate.theme)}`)}</span>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  WhyItFits — per-axis explanation                                     */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Renders the "Strong on your <axis1> and <axis2> axes." line using the
 * `t.rich` tag-handler pattern. The JSON template wraps each variable
 * in `<em>...</em>`, so we register a single `em` tag handler that
 * receives the wrapped chunks; the axis label values themselves go
 * through as plain string variables. Passing render functions named
 * after the variables (axisOne / axisTwo) — the original implementation
 * — made next-intl silently fall through to the raw message key.
 */
function WhyItFits({ axisIndices }: { axisIndices: number[] }) {
  const t = useTranslations("plan.topMatch");
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
/*  Theme-driven brand motif + badge                                     */
/* ───────────────────────────────────────────────────────────────────── */

type ThemeKey = "heritage" | "food" | "craft" | "quiet" | "social" | "balanced";

/** Defensively narrow whatever string comes back from the DB to a known
 *  theme key. Unknown values fall through to "balanced" so the visual
 *  never breaks and the i18n key always resolves. */
function themeKey(theme: string): ThemeKey {
  switch (theme) {
    case "heritage":
    case "food":
    case "craft":
    case "quiet":
    case "social":
    case "balanced":
      return theme;
    default:
      return "balanced";
  }
}

function ThemeMotif({ theme }: { theme: string }) {
  const t = themeKey(theme);
  const size = 200;
  switch (t) {
    case "heritage":
      return <ConicalHat size={size} />;
    case "food":
      return <MamCom size={size} />;
    case "craft":
      return <DongSonSun size={size} />;
    case "quiet":
      return <Lotus size={size} />;
    case "social":
      return <FolkStar size={size} />;
    case "balanced":
    default:
      // Waves is a band illustration (BandProps shape), not a square
      // glyph — map the square `size` request to a width-led aspect.
      return <Waves width={size * 4} height={size} />;
  }
}

function ThemeBadge({ theme }: { theme: string }) {
  const tTemplate = useTranslations("plan.template");
  const t = themeKey(theme);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/95 backdrop-blur-sm border border-foreground/15 text-xs font-semibold text-foreground shadow-sm">
      {tTemplate(`themeValue.${t}`)}
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  State 3 — signed in but no quiz vector                               */
/* ───────────────────────────────────────────────────────────────────── */

function QuizPromptBanner() {
  const t = useTranslations("plan.topMatch.quizPrompt");
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

function CustomizedTopMatchSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border-2 border-muted">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <Skeleton className="h-44 sm:h-56 lg:h-auto lg:min-h-[320px] lg:col-span-5 rounded-none" />
        <div className="lg:col-span-7 p-5 lg:p-7 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-2/3 mt-1" />
          <Skeleton className="h-4 w-full mt-1" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-3">
            <Skeleton className="h-11 w-40 rounded-full" />
            <Skeleton className="h-11 w-40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
