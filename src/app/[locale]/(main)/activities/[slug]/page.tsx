"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { AiExplainer } from "@/components/ai-explainer";
import { pickLocaleField } from "@/lib/pick-locale-field";
import { formatVndPrice } from "@/lib/format";
import { activityImage } from "@/lib/activity-image";
import type { Locale } from "@/i18n/routing";

/** Map our two-letter app locale to a BCP-47 tag for Intl formatters. */
function intlLocale(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : "en-US";
}

function formatSlotLabel(startsAt: Date, endsAt: Date, locale: Locale): { date: string; time: string } {
  const tag = intlLocale(locale);
  const date = startsAt.toLocaleDateString(tag, { weekday: "short", month: "short", day: "numeric" });
  const startTime = startsAt.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit", hour12: false });
  const endTime = endsAt.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit", hour12: false });
  return { date, time: `${startTime}–${endTime}` };
}

// Closed-set of category keys we ship translations for. Keep in sync with
// `activities.category.*` in messages/{en,vi}.json. Unknown categories
// (e.g. a future host-added value) fall back to the raw db value rather
// than throwing a missing-translation in dev.
const KNOWN_CATEGORIES = new Set([
  "workshop",
  "food",
  "culinary",
  "cultural",
  "adventure",
  "nightlife",
  "art",
  "tour_lite",
  "ticket",
  "performance",
  "class",
]);

export default function ActivityDetailPage() {
  const params = useParams<{ slug: string }>();
  const locale = useLocale() as Locale;
  const t = useTranslations("activities");
  const tButton = useTranslations("cart.addButton");
  const utils = trpc.useUtils();

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addGuide, setAddGuide] = useState(false);

  const { data: activity, isLoading: loadingActivity } = trpc.activity.getBySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug },
  );

  const { data: slots, isLoading: loadingSlots } = trpc.activity.getSlots.useQuery(
    { activityId: activity?.id ?? "", includeSoldOut: false },
    { enabled: !!activity?.id },
  );

  // Previously `onSuccess` did `router.push("/cart")`, which fired after
  // the FIRST mutateAsync resolved and unmounted the page before the
  // optional guide_addon add could finish. With both mutations now
  // sequenced inside `handleAddToCart` (and the success toast / fly
  // animation centralized in `AddToCartButton`), this hook is just an
  // invalidation hook. Anonymous users are bounced via the authLink.
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      utils.cart.getCount.invalidate();
    },
  });

  // Group slots by calendar day so the picker reads as a calendar, not a
  // vertical list of 40+ rows.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const s of slots ?? []) {
      const dayKey = new Date(s.startsAt).toISOString().slice(0, 10);
      const existing = map.get(dayKey) ?? [];
      map.set(dayKey, [...existing, s]);
    }
    return map;
  }, [slots]);

  if (loadingActivity) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-56 bg-muted rounded-xl animate-pulse" />
        <div className="h-6 w-1/2 bg-muted rounded animate-pulse" />
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (!activity) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-sm font-medium text-secondary">{t("detail.notFound")}</p>
        <Link href="/activities" className="text-primary text-xs font-medium">
          {t("detail.backToList")}
        </Link>
      </div>
    );
  }

  const unitPrice = activity.priceAmount;
  const guideAddon = addGuide ? activity.guideAddonVnd ?? 0 : 0;
  const totalPrice = unitPrice * quantity + guideAddon;

  // Bilingual locale-aware content. Falls back to other locale, then to
  // the legacy single-language column via pickLocaleField.
  const activityTitle = pickLocaleField<string>(activity, "title", locale) ?? activity.title;
  const activitySubtitle = pickLocaleField<string>(activity, "subtitle", locale) ?? activity.subtitle;
  const activityDescription = pickLocaleField<string>(activity, "description", locale) ?? activity.description;
  const activityHighlights = (pickLocaleField<unknown>(activity, "highlights", locale) ?? activity.highlights) as string[] | null;

  const handleAddToCart = async () => {
    if (!selectedSlotId) return;
    await addToCart.mutateAsync({
      kind: "activity",
      activityId: activity.id,
      activitySlotId: selectedSlotId,
      quantity,
    });
    // Sequenced: the guide_addon add only runs after the activity line is
    // safely persisted, and the AddToCartButton only resolves to its
    // success state after BOTH mutations complete. This is the fix for
    // the original race where `router.push("/cart")` fired in onSuccess
    // after the first mutation and the guide_addon was dropped.
    if (addGuide && activity.guideAddonVnd && activity.guideAddonVnd > 0) {
      await addToCart.mutateAsync({
        kind: "guide_addon",
        parentActivityId: activity.id,
      });
    }
  };

  // Empty-slot UX: when there are zero upcoming slots the picker shows a
  // soft "no upcoming slots" banner and the button below mustn't tell the
  // user to "pick a time above" -- there is nothing above to pick. Swap
  // to a clearer label so the button copy matches reality.
  const slotsAvailable = !!slots && slots.length > 0;
  const buttonLabel = !slotsAvailable
    ? t("detail.noSlotsButton")
    : !selectedSlotId
      ? tButton("pickSlot")
      : undefined;

  // Translated category label with raw-value fallback for unknown values
  // (a host could publish a category we haven't shipped a string for yet).
  const categoryLabel = KNOWN_CATEGORIES.has(activity.category)
    ? t(`category.${activity.category}` as `category.${string}`)
    : activity.category;

  // Locale-aware duration formatting. Splits into two keys instead of an
  // ICU plural so the Vietnamese form ("4 tiếng" / "4 tiếng 15 phút") and
  // the English ("4h" / "4h 15m") can diverge in word order without
  // wrestling with plural categories.
  const durationHours = Math.floor(activity.durationMinutes / 60);
  const durationMinutes = activity.durationMinutes % 60;
  const durationLabel = durationMinutes > 0
    ? t("detail.durationHoursMinutes", { h: durationHours, m: durationMinutes })
    : t("detail.durationHours", { h: durationHours });

  // Same precedence as the activities list: real host upload first,
  // then the curator's deterministic atom cinematic, then nothing.
  const heroSrc = activity.photos?.[0] ?? activityImage(activity.slug ?? null);

  return (
    <PageTransition>
      <div className="pb-32 lg:pb-12">
        {/* Hero (taller + wider overlays on desktop) */}
        <div className="relative h-60 lg:h-96">
          {heroSrc && (
            <Image src={heroSrc} alt={activityTitle ?? ""} fill sizes="100vw" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/60" />
          <Link href="/activities" className="absolute top-4 left-4 w-11 h-11 rounded-full bg-card/90 flex items-center justify-center hover:bg-card transition-colors">
            <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </Link>
          <div className="absolute bottom-4 left-4 right-4 lg:bottom-10 lg:left-0 lg:right-0">
            <div className="lg:max-w-6xl lg:mx-auto lg:px-8">
              <Badge className="bg-card/90 text-foreground border-0 text-xs uppercase tracking-wider">{categoryLabel}</Badge>
              <h1 className="text-white font-bold font-heading text-2xl lg:text-4xl mt-2 leading-tight max-w-3xl">{activityTitle}</h1>
              {activitySubtitle && <p className="text-white/85 text-sm lg:text-base mt-1 lg:mt-2 max-w-2xl">{activitySubtitle}</p>}
            </div>
          </div>
        </div>

        {/* Main content area: single column on mobile, 2/3 + 1/3 split on desktop
            with a sticky booking panel pinned to the right column. */}
        <div className="p-4 lg:p-8 space-y-4 lg:max-w-6xl lg:mx-auto lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:gap-8 lg:space-y-0">

          <div className="space-y-4">
          {/* Author + stats. Links to the host's public profile at
              /hosts/[authorSlug] when the slug is known. Falls back to a
              plain row for curated / slugless activities so travelers don't
              land on a 404. */}
          {(() => {
            const row = (
              <>
                <Avatar className="w-10 h-10">
                  {activity.authorAvatar && <AvatarImage src={activity.authorAvatar} alt={activity.authorDisplayName ?? ""} />}
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-bold">
                    {(activity.authorDisplayName ?? "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm lg:text-base font-semibold text-secondary">
                    {t("detail.hostedBy", { name: activity.authorDisplayName ?? t("detail.aLocal") })}
                    {activity.authorSlug && (
                      <span className="text-xs text-muted-foreground ml-1">{t("detail.viewProfile")}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {durationLabel} · {t("detail.upToGuests", { n: activity.maxCapacityPerSlot })}
                    {activity.avgRating ? ` · ${t("detail.rating", { rating: Number(activity.avgRating).toFixed(1) })}` : ""}
                  </p>
                </div>
              </>
            );
            return (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {activity.authorSlug ? (
                    <Link
                      href={`/hosts/${activity.authorSlug}`}
                      className="p-3 flex items-center gap-3 hover:bg-muted/60 rounded-lg transition-colors"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="p-3 flex items-center gap-3">{row}</div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Description */}
          {activityDescription && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 lg:p-5">
                <p className="text-body text-secondary whitespace-pre-line max-w-prose">{activityDescription}</p>
              </CardContent>
            </Card>
          )}

          {/* AI explainer -- post-pivot, AI explains fit rather than generates
              itineraries. Renders only if we have real signals to show. */}
          <AiExplainer
            itemKind="activity"
            itemTitle={activityTitle ?? ""}
            itemCategory={activity.category}
            itemHighlights={activityHighlights}
            authorLanguages={activity.authorLanguages as string[] | null}
          />

          {/* Highlights + included */}
          {Array.isArray(activityHighlights) && activityHighlights.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 lg:p-5 space-y-2">
                <h2 className="text-base lg:text-lg font-semibold text-secondary">{t("detail.highlights")}</h2>
                <ul className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
                  {activityHighlights.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Slot picker. Time slots grouped by day. */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 lg:p-5 space-y-3">
              <h2 className="text-base lg:text-lg font-semibold text-secondary">{t("detail.pickTime")}</h2>
              {loadingSlots ? (
                <div className="h-12 bg-muted rounded animate-pulse" />
              ) : !slots || slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("detail.noSlots")}</p>
              ) : (
                <div className="space-y-3">
                  {Array.from(slotsByDay.entries()).slice(0, 7).map(([day, daySlots]) => (
                    <div key={day}>
                      <p className="text-xs uppercase tracking-widest text-secondary/70 font-semibold mb-1.5">
                        {new Date(day + "T00:00:00").toLocaleDateString(intlLocale(locale), { weekday: "long", month: "short", day: "numeric" })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(daySlots ?? []).map((s) => {
                          const label = formatSlotLabel(new Date(s.startsAt), new Date(s.endsAt), locale);
                          const seatsLeft = s.capacity - s.bookedCount;
                          const selected = s.id === selectedSlotId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedSlotId(s.id)}
                              disabled={seatsLeft <= 0}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                selected
                                  ? "bg-secondary text-secondary-foreground border-secondary"
                                  : seatsLeft <= 0
                                    ? "bg-muted/40 text-muted-foreground border-border cursor-not-allowed"
                                    : "bg-card text-foreground border-border hover:border-secondary/40"
                              }`}
                            >
                              {label.time}
                              {seatsLeft > 0 && seatsLeft <= 2 && (
                                <span className="ml-1 text-xs opacity-70">{t("detail.seatsLeft", { n: seatsLeft })}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quantity + guide add-on (main column on mobile; on desktop
              these move into the booking panel on the right). */}
          <Card className="border-0 shadow-sm lg:hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-secondary">{t("detail.guests")}</p>
                  <p className="text-sm text-muted-foreground">{t("detail.upToPerSlot", { n: activity.maxCapacityPerSlot })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-lg"
                  >−</button>
                  <span className="w-6 text-center text-base font-semibold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(activity.maxCapacityPerSlot, quantity + 1))}
                    className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-lg"
                  >+</button>
                </div>
              </div>
              {activity.guideOptional && activity.guideAddonVnd && activity.guideAddonVnd > 0 && (
                <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-lg bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-secondary">{t("detail.addLocalGuide")}</p>
                    <p className="text-sm text-muted-foreground">{t("detail.guideLanguages")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">+{formatVndPrice(activity.guideAddonVnd)}</span>
                    <input
                      type="checkbox"
                      checked={addGuide}
                      onChange={(e) => setAddGuide(e.target.checked)}
                      className="w-4 h-4 accent-[#23402b]"
                    />
                  </div>
                </label>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Desktop-only sticky booking panel. Hidden on mobile (the
              sticky bottom bar handles that case). */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-5 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                      {t("detail.from")}
                    </p>
                    <p className="text-3xl font-bold tabular-nums text-foreground">
                      {formatVndPrice(activity.priceAmount)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("detail.perGuest")}</p>
                  </div>

                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">{t("detail.guests")}</p>
                        <p className="text-sm text-muted-foreground">{t("detail.upToN", { n: activity.maxCapacityPerSlot })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-lg hover:border-secondary/60"
                        >−</button>
                        <span className="w-6 text-center text-base font-semibold tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.min(activity.maxCapacityPerSlot, quantity + 1))}
                          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-secondary font-bold text-lg hover:border-secondary/60"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {activity.guideOptional && activity.guideAddonVnd && activity.guideAddonVnd > 0 && (
                    <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-lg bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-secondary">{t("detail.addLocalGuide")}</p>
                        <p className="text-sm text-muted-foreground">{t("detail.guideLanguages")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary whitespace-nowrap tabular-nums">+{formatVndPrice(activity.guideAddonVnd)}</span>
                        <input
                          type="checkbox"
                          checked={addGuide}
                          onChange={(e) => setAddGuide(e.target.checked)}
                          className="w-4 h-4 accent-[#23402b]"
                        />
                      </div>
                    </label>
                  )}

                  <div className="border-t border-border pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatVndPrice(activity.priceAmount)} × {quantity}
                      </span>
                      <span className="text-foreground tabular-nums">{formatVndPrice(activity.priceAmount * quantity)}</span>
                    </div>
                    {addGuide && activity.guideAddonVnd ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("detail.localGuide")}</span>
                        <span className="text-foreground tabular-nums">+{formatVndPrice(activity.guideAddonVnd)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                      <span className="text-foreground">{t("detail.total")}</span>
                      <span className="text-secondary tabular-nums">{formatVndPrice(totalPrice)}</span>
                    </div>
                  </div>

                  <AddToCartButton
                    onAdd={handleAddToCart}
                    label={buttonLabel}
                    flyImage={heroSrc ?? null}
                    disabled={!selectedSlotId}
                    className="w-full rounded-xl h-12 font-bold"
                  />
                  <p className="text-sm text-center text-muted-foreground">
                    {t("detail.noChargeYet")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>

        {/* Sticky checkout bar (mobile only; desktop uses the right-rail panel above) */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t("detail.total")}</p>
              <p className="text-xl font-bold text-secondary tabular-nums">{formatVndPrice(totalPrice)}</p>
            </div>
            <AddToCartButton
              onAdd={handleAddToCart}
              label={buttonLabel}
              flyImage={heroSrc ?? null}
              disabled={!selectedSlotId}
              className="rounded-xl px-6 h-12 font-bold"
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
