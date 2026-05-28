"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatVndPrice } from "@/lib/format";
import { AXIS_KEYS, topContributingAxes } from "@/lib/match-explain";
import {
  ConicalHat,
  DongSonSun,
  FolkStar,
  HoiVanDivider,
  Lotus,
  MamCom,
  Waves,
} from "@/components/brand";

type ThemeKey = "heritage" | "food" | "craft" | "quiet" | "social" | "balanced";

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

function ThemeMotif({ theme, size = 280 }: { theme: string; size?: number }) {
  const t = themeKey(theme);
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
      // `Waves` is a horizontal band illustration (BandProps width/height,
      // not IllusProps size), so we size it explicitly here. Reads as
      // "river-broad, even rhythm" which fits the balanced theme well.
      return <Waves width={size} height={Math.round(size / 5)} />;
  }
}

/**
 * Customized Tour Template detail page.
 *
 * Renders the full story behind a customized template (the curated
 * inspiration day plans seeded in `seed-customized-tour-templates.ts`),
 * plus the personality match if the signed-in user has completed the
 * quiz. The primary CTA "Build my day from this" routes the traveler to
 * `/activities` where they assemble the actual day from the activity
 * catalog — the customized product is cart-based, so the template is a
 * starting frame rather than a fixed bundle the user books outright.
 *
 * Every string flows through `useTranslations("plan.template")` /
 * `plan.topMatch.axis` so the page flips locale cleanly. Bilingual
 * title and subtitle render via the primary/secondary pattern used
 * across the rest of the experiences hub.
 */
export default function CustomizedTourTemplatePage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("plan.template");
  const tTopMatch = useTranslations("plan.topMatch");
  const locale = useLocale();

  const { data, isLoading, error } = trpc.customizedTourTemplate.getById.useQuery(
    { templateId: params.id },
    { enabled: !!params.id, retry: false },
  );

  if (isLoading) return <TemplateSkeleton />;

  if (error || !data) {
    return (
      <PageTransition>
        <div className="p-6 pb-24 min-h-[60vh] flex flex-col items-center justify-center text-center space-y-3">
          <div className="text-5xl">🧭</div>
          <p className="text-sm text-secondary font-semibold">{t("notFound")}</p>
          <Link href="/plan/build">
            <Button variant="outline" className="rounded-full">
              {t("backCta")}
            </Button>
          </Link>
        </div>
      </PageTransition>
    );
  }

  const primaryTitle = locale === "vi" ? data.titleVi : data.titleEn;
  const secondaryTitle = locale === "vi" ? data.titleEn : data.titleVi;
  const subtitle = locale === "vi" ? data.subtitleVi : data.subtitleEn;
  const story = locale === "vi" ? data.storyVi : data.storyEn;
  const hours = Math.round(data.durationMinutes / 60);
  const tk = themeKey(data.theme);

  // Per-axis "why it fits" when the user has a saved personality vector.
  // Same shared helper as the experiences hub + the /plan/build hero.
  const axisIndices =
    data.userVector && data.userVector.length === data.vector.length
      ? topContributingAxes(data.userVector, data.vector, 2)
      : [];

  return (
    <PageTransition>
      <div className="pb-24 lg:pb-12">
        {/* Hero — theme motif on a soft gradient. No photo dependency
           because customized templates feed the cart instead of booking
           end-to-end with a fixed image. */}
        <div className="relative h-56 sm:h-72 lg:h-80 bg-gradient-to-br from-brick/10 via-mustard/14 to-secondary/10 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-brick/25 pointer-events-none">
            <ThemeMotif theme={data.theme} size={320} />
          </div>
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <Link href="/plan/build" className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-foreground/15 hover:bg-card">
              ← {t("backCta")}
            </Link>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {data.matchPercent !== null && data.userHasVector && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary text-white text-xs font-bold shadow-md">
                {t("matchBadge", { pct: data.matchPercent })}
              </span>
            )}
            <Badge className="bg-card/95 border border-foreground/15 text-foreground">
              {t(`themeValue.${tk}`)}
            </Badge>
          </div>
        </div>

        <div className="p-4 lg:p-8 lg:max-w-4xl lg:mx-auto space-y-6 -mt-6 lg:-mt-10 relative">
          {/* Title card — bilingual primary/secondary + subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-5 lg:p-8 space-y-3">
                <span className="text-eyebrow">{t("eyebrow")}</span>
                <div className="flex flex-col gap-1">
                  <h1 className="text-display font-voice text-brick text-foreground leading-tight">
                    {primaryTitle}
                  </h1>
                  <p className="font-serif italic text-sm text-muted-foreground/85">
                    {secondaryTitle}
                  </p>
                </div>
                {subtitle && (
                  <p className="font-serif italic text-lg text-foreground/85 leading-snug">
                    {subtitle}
                  </p>
                )}
                <WhyItFits axisIndices={axisIndices} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Meta card — duration, group, price, theme */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 lg:p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetaPair label={t("durationLabel")} value={t("durationValue", { hours })} />
              <MetaPair
                label={t("groupLabel")}
                value={t("groupValue", { max: data.maxParticipants })}
              />
              <MetaPair
                label={t("priceLabel")}
                value={t("priceValueFrom", { price: formatVndPrice(data.basePriceVnd) })}
              />
              <MetaPair label={t("themeLabel")} value={t(`themeValue.${tk}`)} />
            </CardContent>
          </Card>

          {/* Story */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 lg:p-8 space-y-4">
              <p className="text-base text-foreground/90 leading-relaxed whitespace-pre-line">
                {story}
              </p>
            </CardContent>
          </Card>

          <HoiVanDivider />

          {/* CTA pair */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link href="/activities" className="flex-1">
                <Button size="brand" className="w-full">
                  {t("primaryCta")} →
                </Button>
              </Link>
              <Link href="/activities" className="sm:w-auto">
                <Button variant="outline" size="brand" className="w-full">
                  {t("secondaryCta")}
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground max-w-prose">
              {t("primaryCtaHint")}
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Helpers                                                              */
/* ───────────────────────────────────────────────────────────────────── */

function MetaPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-eyebrow">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
        {value}
      </span>
    </div>
  );
}

function WhyItFits({ axisIndices }: { axisIndices: number[] }) {
  const t = useTranslations("plan.topMatch");
  if (axisIndices.length === 0) return null;

  const axisOneKey = AXIS_KEYS[axisIndices[0]!];
  if (!axisOneKey) return null;
  const axisOneLabel = t(`axis.${axisOneKey}`);

  // `em` is the tag handler matching `<em>...</em>` in the JSON
  // template; axis labels go through as plain string variables. See
  // the matching comment in `customized-top-match-card.tsx`.
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

function TemplateSkeleton() {
  const t = useTranslations("plan.template");
  return (
    <PageTransition>
      <div className="pb-24" aria-busy="true" aria-label={t("loading")}>
        <Skeleton className="h-56 sm:h-72 lg:h-80 rounded-none" />
        <div className="p-4 lg:p-8 lg:max-w-4xl lg:mx-auto space-y-6 -mt-6 lg:-mt-10 relative">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </PageTransition>
  );
}
