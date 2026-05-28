"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { Pagoda, HoiVanDivider, TopMatchCard } from "@/components/brand";
import { fixedTourImage } from "@/lib/fixed-tour-images";
import { hostExperienceImage } from "@/lib/host-experience-images";
import { pickLocaleField } from "@/lib/pick-locale-field";
import { formatVndPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

type ChapterId = "MORNING_SHIFT" | "AFTERNOON_SHIFT" | "EVENING_SHIFT";

interface ChapterMeta {
  id: ChapterId;
  /** DOM id used by the anchor-strip jump links. */
  anchorId: string;
  /** Short label for the anchor strip. Locale-aware. */
  shortLabel: string;
  /** Section heading (italic-serif). Reads from the message catalogue so
   *  each locale renders its own poetic; we no longer surface the
   *  other-language form on screen (strict-mono rule). */
  title: string;
  /** Eyebrow tagline above the heading. Locale-aware. */
  tagline: string;
  /** Accent line colour token; visually anchors each section. */
  accent: string;
}

/** i18n key + accent metadata that doesn't flip with locale. The actual
 *  user-visible strings (shortLabel / title / tagline) are pulled from
 *  the `experiences.chapters.*` message namespace inside
 *  `ExperiencesPage` and assembled into the rendered `CHAPTERS` array. */
const CHAPTER_KEYS = [
  { id: "MORNING_SHIFT", anchorId: "chapter-morning", key: "morning", accent: "border-brick" },
  { id: "AFTERNOON_SHIFT", anchorId: "chapter-afternoon", key: "afternoon", accent: "border-primary" },
  { id: "EVENING_SHIFT", anchorId: "chapter-evening", key: "evening", accent: "border-mustard" },
] as const satisfies ReadonlyArray<{
  id: ChapterId;
  anchorId: string;
  key: "morning" | "afternoon" | "evening";
  accent: string;
}>;

/**
 * /experiences hub.
 *
 * Two stacked surfaces:
 *   1. Curated Fixed Tour catalog — 15 tours grouped into three chapter
 *      `<section>`s. Each section is a content heading + accent rule,
 *      NOT a clickable card, so chapters never get mistaken for tours
 *      themselves. A thin anchor strip at the top scrolls to a chapter.
 *      When the user has a saved quiz vector, tours are ranked by match%
 *      across the whole catalog and then re-grouped per chapter — so the
 *      top of every section is still the user's best fit for that time
 *      of day.
 *
 *   2. By Local Hosts — host-authored experiences live below the curated
 *      catalog as a separate listing surface. Unchanged shape.
 */
export default function ExperiencesPage() {
  const t = useTranslations("experiences");
  const locale = useLocale();
  // Always fetches all 15 tours; we group + slice client-side.
  const { data: fixedData, isLoading: fixedLoading } = trpc.fixedTour.list.useQuery();

  // Host-authored listings.
  const { data: hostExperiences } = trpc.experience.list.useQuery({
    kind: "host_custom",
  });

  type FixedTour = NonNullable<typeof fixedData>["tours"][number];
  const userHasVector = fixedData?.userHasVector ?? false;

  // Build locale-aware chapter metadata. Strict-mono: a chapter shows
  // only the active locale's poetic; we no longer surface the other
  // language as a muted secondary line. The old `titleAlt` field is
  // gone so the JSX hierarchy stays clean.
  const CHAPTERS: ChapterMeta[] = useMemo(
    () =>
      CHAPTER_KEYS.map((c) => ({
        id: c.id,
        anchorId: c.anchorId,
        accent: c.accent,
        shortLabel: t(`chapters.${c.key}.shortLabel`),
        title: t(`chapters.${c.key}.title`),
        tagline: t(`chapters.${c.key}.tagline`),
      })),
    [t],
  );

  const byChapter = useMemo(() => {
    const buckets: Record<ChapterId, FixedTour[]> = {
      MORNING_SHIFT: [],
      AFTERNOON_SHIFT: [],
      EVENING_SHIFT: [],
    };
    for (const t of fixedData?.tours ?? []) {
      const id = t.chapter as ChapterId;
      if (buckets[id]) buckets[id].push(t);
    }
    return buckets;
  }, [fixedData]);

  return (
    <PageTransition>
      <div className="pb-24 lg:pb-8">
        <div className="p-4 lg:p-8 lg:max-w-6xl lg:mx-auto space-y-8">
          {/* Hero */}
          <div className="relative">
            <div className="absolute -right-2 -top-2 opacity-[0.16] pointer-events-none hidden sm:block text-brick">
              <Pagoda size={140} />
            </div>
            <div className="relative flex flex-col gap-2 max-w-2xl">
              <span className="text-eyebrow">{t("hero.eyebrow")}</span>
              {/* Strict-mono: the hero slogan is the active locale's
                 brand voice. The cross-language couplet is gone -- in
                 vi the user only sees Vietnamese, in en only English. */}
              <h1 className="text-display font-voice text-brick">{t("hero.slogan")}</h1>
              <p className="font-serif italic text-base lg:text-lg text-muted-foreground mt-1">
                {t("hero.subtitle")}
              </p>
              {userHasVector && (
                <p className="text-sm text-foreground/80">
                  {t("hero.personalised")}
                </p>
              )}
              {userHasVector && (
                <Link
                  href="/onboarding/chat"
                  className="self-start text-sm font-serif italic text-brick/85 hover:text-brick underline decoration-brick/30 underline-offset-4 hover:decoration-brick transition-colors"
                >
                  {t("hero.retakeQuiz")} →
                </Link>
              )}
            </div>
          </div>

          {/* Top-match recommendation card. Renders one of:
                · null (anonymous visitor — hero CTA already drives signup),
                · a quiz-prompt banner (signed in but no personality vector),
                · the personalised hero card with per-axis "why it fits"
                  reasoning (signed in + quiz completed),
                · a skeleton while the tour list is loading.
             Defined in `components/brand/top-match-card.tsx`. */}
          <TopMatchCard
            topTour={fixedData?.tours?.[0] ?? null}
            userHasVector={userHasVector}
            userVector={fixedData?.userVector ?? null}
            isLoading={fixedLoading}
          />

          {/* Anchor strip — pill links that smooth-scroll to the matching
             section. Three time-of-day chapters anchor into the curated
             Fixed Tour matrix; a fourth "Local Tours" pill anchors into
             the host-authored experiences section further down (rendered
             only when there are host experiences to jump to). Visually
             nothing like a card; sits on a horizontally scrollable row
             on small viewports. */}
          <nav
            aria-label={t("anchorAria")}
            className="-mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto scrollbar-none"
          >
            {CHAPTERS.map((c) => {
              const count = byChapter[c.id].length;
              return (
                <a
                  key={c.id}
                  href={`#${c.anchorId}`}
                  className="shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-card hover:border-foreground/30 hover:shadow-sm transition-all text-sm font-medium text-foreground"
                >
                  <span>{c.shortLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    {count > 0 ? `${count}` : "—"}
                  </span>
                </a>
              );
            })}
            {(hostExperiences?.length ?? 0) > 0 && (
              <a
                href="#local-tours"
                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-secondary/30 bg-card hover:border-secondary hover:shadow-sm transition-all text-sm font-medium text-foreground"
              >
                <span>{t("hosts.shortLabel")}</span>
                <span className="text-xs text-muted-foreground">
                  {hostExperiences?.length ?? 0}
                </span>
              </a>
            )}
          </nav>

          {/* Curated Fixed Tours — three sections, each grouped under
             a chapter heading. */}
          {fixedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-10">
              {CHAPTERS.map((c) => {
                const tours = byChapter[c.id];
                if (tours.length === 0) return null;
                return (
                  <section
                    key={c.id}
                    id={c.anchorId}
                    aria-labelledby={`${c.anchorId}-heading`}
                    className="scroll-mt-20 lg:scroll-mt-24"
                  >
                    {/* Section heading: clearly a TYPE divider, not a
                       card. Italic-serif h2 above a thin accent rule.
                       Strict-mono: only the active-locale poetic is
                       rendered; the other-language form is gone. */}
                    <header className="mb-5 lg:mb-6">
                      <span className="text-eyebrow">{c.tagline}</span>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
                        <h2
                          id={`${c.anchorId}-heading`}
                          className="text-h1 font-voice text-brick text-foreground leading-tight"
                        >
                          {c.title}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {t("tourCount", { count: tours.length })}
                        </span>
                      </div>
                      <div className={`mt-3 border-t-2 ${c.accent}/40`} aria-hidden />
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                      {tours.map((tour, idx) => {
                        // Strict-mono: the card shows only the active
                        // locale's title and story. The DB stores both
                        // languages on every Fixed Tour, so the heading
                        // and body flip together with the App Language
                        // toggle -- no cross-language muted line.
                        const primaryTitle = locale === "vi" ? tour.titleVi : tour.titleEn;
                        const story = locale === "vi" ? tour.storyScriptVi : tour.storyScriptEn;
                        return (
                        <motion.div
                          key={tour.tourId}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.04 }}
                        >
                          <Link href={`/fixed-tours/${tour.tourId}`}>
                            <Card className="overflow-hidden h-full hover:ring-2 hover:ring-primary/30 transition-all">
                              <div className="h-44 relative overflow-hidden bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fixedTourImage(tour.tourId)}
                                  alt={primaryTitle}
                                  loading="lazy"
                                  decoding="async"
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                                {tour.matchPercent !== null && tour.matchPercent !== undefined && (
                                  <div className="absolute top-3 right-3">
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-xs font-bold"
                                      aria-label={t("matchAria", { pct: tour.matchPercent })}
                                    >
                                      {t("matchBadge", { pct: tour.matchPercent })}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <CardContent className="p-4 flex flex-col gap-2 h-full">
                                <h3 className="text-h3 font-voice text-foreground leading-tight">
                                  {primaryTitle}
                                </h3>
                                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
                                  {story}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {(tour.tags.material ?? []).slice(0, 2).map((m) => (
                                    <span
                                      key={m}
                                      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                                    >
                                      {m}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
                                  <div className="text-xs text-muted-foreground">
                                    {t("durationMax", {
                                      hours: Math.round(tour.durationMinutes / 60),
                                      max: tour.maxParticipants,
                                    })}
                                  </div>
                                  <p className="font-serif text-xl text-brick leading-none whitespace-nowrap">
                                    {formatVndPrice(tour.basePriceVnd)}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </motion.div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Host-authored listings — separate surface, divided by a
             hội văn band so the boundary reads as "a different kind of
             thing". Also serves as the anchor target for the fourth
             pill in the strip above (`Local Tours` / `Tour địa phương`),
             hence the explicit `id` + scroll-mt class. */}
          {(hostExperiences?.length ?? 0) > 0 && (
            <>
              <HoiVanDivider />

              <section
                id="local-tours"
                aria-labelledby="local-tours-heading"
                className="space-y-3 scroll-mt-20 lg:scroll-mt-24"
              >
                <header className="space-y-1">
                  <span className="text-eyebrow">{t("hosts.eyebrow")}</span>
                  {/* Strict-mono: only the active-locale slogan
                     renders. No cross-language muted line. */}
                  <h2
                    id="local-tours-heading"
                    className="text-h1 font-voice text-brick text-foreground"
                  >
                    {t("hosts.slogan")}
                  </h2>
                  <p className="text-sm text-foreground/80 max-w-xl mt-1">
                    {t("hosts.subtitle")}
                  </p>
                  <div className="mt-2 border-t-2 border-secondary/30" aria-hidden />
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {hostExperiences?.map((exp, idx) => {
                    // Brand override for the 9 seeded host experiences;
                    // host-created listings fall back to their uploaded
                    // `photos[0]` (or no image at all).
                    const primaryPhoto =
                      hostExperienceImage(exp.slug) ??
                      (exp.photos as string[] | null)?.[0] ??
                      null;
                    const expTitle = pickLocaleField<string>(exp, "title", locale as Locale) ?? exp.title;
                    const expSubtitle = pickLocaleField<string>(exp, "subtitle", locale as Locale) ?? exp.subtitle;
                    return (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.04 }}
                    >
                      <Link href={`/experiences/${exp.slug || exp.id}`}>
                        <Card className="overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all">
                          <div className="h-44 relative overflow-hidden bg-muted">
                            {primaryPhoto && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={primaryPhoto}
                                alt={expTitle ?? ""}
                                loading="lazy"
                                decoding="async"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[calc(100%-5rem)]">
                              {/* `variant="guide"` is the token-paired
                                  bg-card / text-foreground pill -- reads
                                  on photo overlays in both themes. The
                                  earlier `variant="ai"` + bg-card/95
                                  override collided foreground colours
                                  (text-card on bg-card) and rendered
                                  invisible. */}
                              <Badge variant="guide" className="bg-card/95 backdrop-blur-sm">
                                {t("hosts.hostBadge")}
                              </Badge>
                            </div>
                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                              <span className="text-mustard text-xs">★</span>
                              <span className="text-white text-xs font-bold">
                                {Number(exp.avgRating || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3">
                              <h3 className="font-serif italic text-white text-lg leading-tight font-normal">
                                {expTitle}
                              </h3>
                              <p className="text-white/75 text-xs mt-0.5">{expSubtitle}</p>
                            </div>
                          </div>
                          <CardContent className="p-4 space-y-2">
                            {exp.authorDisplayName && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Avatar className="w-5 h-5">
                                  {exp.authorAvatarUrl && (
                                    <AvatarImage src={exp.authorAvatarUrl} alt={exp.authorDisplayName} />
                                  )}
                                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                                    {exp.authorDisplayName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span>
                                  {t.rich("hosts.hostedBy", {
                                    name: () => (
                                      <span className="font-medium text-foreground">
                                        {exp.authorDisplayName}
                                      </span>
                                    ),
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{t("hosts.durationMinutes", { m: exp.durationMinutes })}</span>
                                <span>{t("hosts.maxGroupSize", { max: exp.maxGroupSize ?? 4 })}</span>
                              </div>
                              <p className="font-serif text-xl text-brick leading-none whitespace-nowrap">
                                {formatVndPrice(exp.priceAmount)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
