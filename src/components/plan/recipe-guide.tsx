"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { trpc } from "@/lib/trpc";
import { formatVndPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Cẩm nang Hướng dẫn — the "recipe book" that turns every curated Fixed
 * Tour into a clickable atom-list on /plan/build. Solo travelers can
 * recreate the same itinerary one atom at a time (Fixed Tours require
 * min 2 people; this widget is the explicit escape hatch).
 *
 * Two layers of collapse keep the surface calm: the whole widget is
 * collapsed by default behind a single eyebrow + nudge banner, and each
 * recipe is its own native <details> accordion. That way the timeline
 * stays the page's main subject and the guide is opt-in.
 */
export function RecipeGuide() {
  const t = useTranslations("plan.build.recipes");
  const tChapter = useTranslations("fixedTour.chapter");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.fixedTour.recipes.useQuery(undefined, {
    // Recipes are catalog data — refreshing on tab focus would only
    // matter if a curator just shipped a new tour, which is rare. Skip
    // the refetch to keep the widget snappy.
    refetchOnWindowFocus: false,
  });

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
  });

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Header — always visible. The solo-nudge banner is the
            persistent payoff message even before the user opens the
            recipe list. */}
        <div className="p-4 lg:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-eyebrow">{t("eyebrow")}</span>
              <h2 className="text-h2 font-voice text-foreground font-normal mt-1 leading-tight">
                {t("title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-brick hover:underline"
            >
              {open ? t("collapse") : t("expand")}
              <svg
                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Solo-traveler nudge banner. The copy is the exact product
              spec text — Vietnamese is the primary, English is rendered
              under the EN locale via the i18n key. */}
          <div className="p-3 lg:p-4 rounded-lg bg-mustard/15 border border-mustard/40">
            <p className="text-sm lg:text-body text-foreground leading-relaxed">
              {t("soloNudge")}
            </p>
          </div>
        </div>

        {/* Collapsible recipe list */}
        {open && (
          <div className="border-t border-border bg-card/30">
            {isLoading && (
              <div className="p-4 space-y-2" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && (data?.recipes?.length ?? 0) === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
            )}

            {!isLoading && data?.recipes && data.recipes.length > 0 && (
              <ul className="divide-y divide-border">
                {data.recipes.map((recipe) => (
                  <RecipeRow
                    key={recipe.tourId}
                    recipe={recipe}
                    locale={locale}
                    tChapter={tChapter}
                    onAddStep={async (step) => {
                      if (!step.activityId || !step.earliestOpenSlotId) return;
                      await addToCart.mutateAsync({
                        kind: "activity",
                        activityId: step.activityId,
                        activitySlotId: step.earliestOpenSlotId,
                        quantity: 1,
                      });
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recipe + step shapes mirror what `fixedTour.recipes` returns on the
// server. Duplicating the shape here (instead of inferring from the
// router type) keeps the component tree-shake-friendly and avoids a
// fragile tRPC inference chain through `useQuery` generics. Add a field
// here when you add one in [fixedTour.router.ts](../../server/routers/fixedTour.router.ts).
type RecipeStep = {
  stepId: string;
  stepOrder: number;
  targetTimeOffset: number;
  locationNameVi: string;
  locationNameEn: string;
  actionLogVi: string;
  actionLogEn: string;
  activityId: string | null;
  activitySlug: string | null;
  atomPriceVnd: number | null;
  atomPhoto: string | null;
  earliestOpenSlotId: string | null;
  earliestSlotStartsAt: string | null;
};
type Recipe = {
  tourId: string;
  titleVi: string;
  titleEn: string;
  chapter: string;
  storyScriptVi: string;
  storyScriptEn: string;
  durationMinutes: number;
  minParticipants: number;
  maxParticipants: number;
  basePriceVnd: number;
  steps: RecipeStep[];
};

function RecipeRow({
  recipe,
  locale,
  tChapter,
  onAddStep,
}: {
  recipe: Recipe;
  locale: Locale;
  tChapter: (key: string) => string;
  onAddStep: (step: RecipeStep) => Promise<void>;
}) {
  const t = useTranslations("plan.build.recipes");
  const title = locale === "vi" ? recipe.titleVi : recipe.titleEn;
  const story = locale === "vi" ? recipe.storyScriptVi : recipe.storyScriptEn;
  const storySnippet = story.length > 160 ? story.slice(0, 157) + "…" : story;

  return (
    <li>
      <details className="group">
        <summary className="cursor-pointer p-4 hover:bg-muted/40 transition-colors list-none">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="fixed" className="text-xs">
                  {tChapter(recipe.chapter)}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("recipeMeta", {
                    minutes: recipe.durationMinutes,
                    price: formatVndPrice(recipe.basePriceVnd),
                  })}
                </span>
              </div>
              <p className="font-serif italic text-lg text-foreground leading-tight">
                {title}
              </p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 group-open:line-clamp-none">
                {storySnippet}
              </p>
            </div>
            <svg
              className="w-5 h-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </summary>

        {/* Step list — visible when the <details> is open */}
        <ol className="px-4 pb-4 space-y-3">
          {recipe.steps.map((step) => (
            <RecipeStepRow
              key={step.stepId}
              step={step}
              locale={locale}
              onAdd={() => onAddStep(step)}
            />
          ))}

          {recipe.steps.length === 0 && (
            <li className="text-sm text-muted-foreground">{t("noSteps")}</li>
          )}

          <li className="pt-2">
            <Link
              href={`/fixed-tours/${recipe.tourId}`}
              className="text-sm font-semibold text-brick hover:underline"
            >
              {t("viewFullTour")}
            </Link>
          </li>
        </ol>
      </details>
    </li>
  );
}

function RecipeStepRow({
  step,
  locale,
  onAdd,
}: {
  step: RecipeStep;
  locale: Locale;
  onAdd: () => Promise<void>;
}) {
  const t = useTranslations("plan.build.recipes");
  const locationName = locale === "vi" ? step.locationNameVi : step.locationNameEn;
  const offsetLabel = formatOffset(step.targetTimeOffset);
  const isAddable = !!step.activityId && !!step.earliestOpenSlotId;

  return (
    <li className="grid grid-cols-[4rem_1fr_auto] gap-3 items-start">
      <div className="text-right">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {t("stepOffset")}
        </p>
        <p className="font-serif text-base text-brick tabular-nums">{offsetLabel}</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm lg:text-base font-semibold text-foreground line-clamp-2">
          {locationName}
        </p>
        {step.atomPriceVnd !== null && (
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {formatVndPrice(step.atomPriceVnd)}
          </p>
        )}
      </div>
      <div className="self-center">
        {isAddable ? (
          <AddToCartButton
            onAdd={onAdd}
            flyImage={step.atomPhoto ?? null}
            variant="default"
            size="sm"
            label={t("addToDay")}
            className="rounded-full"
          />
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {t("comingSoon")}
          </Badge>
        )}
      </div>
    </li>
  );
}

/** "+0m" / "+1h 30m" — minute offset rendered as a compact stepper label. */
function formatOffset(minutes: number): string {
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `+${m}m`;
  if (m === 0) return `+${h}h`;
  return `+${h}h ${m}m`;
}
