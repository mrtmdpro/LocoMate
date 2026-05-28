"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { BrandTag, CustomizedTopMatchCard } from "@/components/brand";
import { RecipeGuide } from "@/components/plan/recipe-guide";
import {
  GROUP_OPTIONS,
  GUIDE_OPTIONS,
  ROUTE_OPTIONS,
  hasAnyPreference,
  type TourPreferences,
} from "@/lib/tour-preferences";

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

type TimelineItem = {
  id: string;
  displayLabel: string;
  thumbnail: string | null;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  kind: string;
  quantity: number;
  priceSnapshotVnd: number;
  lineTotalVnd: number;
  conflictsWith: string[];
};

/**
 * Day-builder timeline for the new flexible-tour product. Reads the cart,
 * groups activity lines by day, renders a time ruler (6 AM - 10 PM), and
 * highlights conflicting overlaps.
 *
 * Separate from /cart because /cart is the universal "shopping basket" that
 * includes merch + eSIM + tours. /plan/build is specifically for laying out
 * the timed activities on a visual day axis.
 */

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const HOUR_HEIGHT = 48; // px

export default function PlanBuildPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: cart, isLoading } = trpc.cart.get.useQuery(undefined, { enabled: !!user });
  const { data: profileData } = trpc.user.getProfile.useQuery(undefined, { enabled: !!user });
  // Personalised template recommendations — feeds the <CustomizedTopMatchCard>
  // pinned at the top of the page. Loaded for everyone (the card handles the
  // anonymous / no-vector branches internally) so the API gets a single
  // call regardless of state.
  const { data: templatesData, isLoading: templatesLoading } =
    trpc.customizedTourTemplate.list.useQuery();
  // Phase A.4 — pull the user's customised-tour preferences so the day
  // builder can echo them back as a "what we're carrying into this day"
  // banner. If nothing's been set, the banner hides entirely and the
  // user gets a one-line nudge toward /profile/preferences.
  const tourPrefs = (profileData?.profile?.explicitData as { tourPreferences?: TourPreferences } | undefined)?.tourPreferences;

  // Partition cart items into timed (activities with slots) and untimed.
  const { itemsByDay, availableDays, untimed } = useMemo(() => {
    const byDay = new Map<string, TimelineItem[]>();
    const untimedList: TimelineItem[] = [];
    const conflictSet = new Set<string>();

    // Build the conflict lookup: each id -> set of ids it conflicts with.
    const conflictMap = new Map<string, string[]>();
    for (const c of cart?.conflicts ?? []) {
      conflictSet.add(c.idA);
      conflictSet.add(c.idB);
      const a = conflictMap.get(c.idA) ?? [];
      a.push(c.idB);
      conflictMap.set(c.idA, a);
      const b = conflictMap.get(c.idB) ?? [];
      b.push(c.idA);
      conflictMap.set(c.idB, b);
    }

    for (const item of cart?.items ?? []) {
      const timelineItem: TimelineItem = {
        id: item.id,
        displayLabel: item.displayLabel,
        thumbnail: item.thumbnail,
        slotStartsAt: item.slotStartsAt,
        slotEndsAt: item.slotEndsAt,
        kind: item.kind,
        quantity: item.quantity,
        priceSnapshotVnd: item.priceSnapshotVnd,
        lineTotalVnd: item.lineTotalVnd,
        conflictsWith: conflictMap.get(item.id) ?? [],
      };
      if (item.slotStartsAt) {
        const day = new Date(item.slotStartsAt).toISOString().slice(0, 10);
        const arr = byDay.get(day) ?? [];
        arr.push(timelineItem);
        byDay.set(day, arr);
      } else {
        untimedList.push(timelineItem);
      }
    }

    const days = Array.from(byDay.keys()).sort();
    return { itemsByDay: byDay, availableDays: days, untimed: untimedList };
  }, [cart]);

  // Default the selected day to the first day in the timeline.
  const effectiveDay = selectedDay ?? availableDays[0] ?? null;
  const effectiveDayItems = effectiveDay ? itemsByDay.get(effectiveDay) ?? [] : [];

  if (!user) {
    return (
      <div className="p-6 text-center space-y-3 pb-24">
        <div className="text-4xl">🗓️</div>
        <p className="text-sm text-secondary font-semibold">Sign in to build your day</p>
        <Link href="/login?returnTo=/plan/build">
          <Button className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl">Sign in</Button>
        </Link>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="p-4 space-y-3 pb-24">
        <div className="h-10 bg-muted rounded-xl animate-pulse" />
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (availableDays.length === 0) {
    return (
      <PageTransition>
        <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-6 pb-24 lg:pb-8">
          <CustomizedTopMatchCard
            topTemplate={templatesData?.templates?.[0] ?? null}
            userHasVector={templatesData?.userHasVector ?? false}
            userVector={templatesData?.userVector ?? null}
            isLoading={templatesLoading}
          />
          {/* Cẩm nang Hướng dẫn — the solo-traveler escape hatch + recipe
              book. Pinned above the empty-state so anonymous / no-cart
              users see the recipe affordance immediately. Collapsed by
              default; the persistent banner copy is the payoff. */}
          <RecipeGuide />
          <div className="min-h-[40vh] flex flex-col items-center justify-center text-center space-y-3 px-6 py-8">
            <div className="text-5xl">🗓️</div>
            <p className="text-sm text-secondary font-semibold">Nothing scheduled yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add activities to your cart to lay out your day here. The builder highlights time conflicts before you check out.
            </p>
            <Link href="/activities">
              <Button className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl">Browse activities</Button>
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  const guideLabel = tourPrefs?.guideStyle
    ? GUIDE_OPTIONS.find((g) => g.value === tourPrefs.guideStyle)?.label
    : null;
  const routeLabel = tourPrefs?.route
    ? ROUTE_OPTIONS.find((r) => r.value === tourPrefs.route)?.label
    : null;
  const groupLabel = tourPrefs?.groupSize
    ? GROUP_OPTIONS.find((g) => g.value === tourPrefs.groupSize)?.label
    : null;
  const hasPrefs = hasAnyPreference(tourPrefs);

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 lg:max-w-5xl lg:mx-auto space-y-5 pb-24 lg:pb-8">
        <CustomizedTopMatchCard
          topTemplate={templatesData?.templates?.[0] ?? null}
          userHasVector={templatesData?.userHasVector ?? false}
          userVector={templatesData?.userVector ?? null}
          isLoading={templatesLoading}
        />

        {/* Cẩm nang Hướng dẫn — recipe book above the timeline so a
            traveler who already has items can still discover new atoms
            from Fixed Tour recipes. Collapsed; the solo nudge banner
            stays visible. */}
        <RecipeGuide />

        <div className="flex flex-col gap-1">
          <span className="text-eyebrow">Day builder</span>
          <h1 className="text-h1 font-voice text-foreground font-normal leading-tight">Your day in Hà Nội.</h1>
          <p className="text-sm text-muted-foreground">
            {availableDays.length} {availableDays.length === 1 ? "day" : "days"} scheduled · logic catches schedule clashes.
          </p>
        </div>

        {/* Phase A.4 — preferences banner. Echoes the user's saved sở thích
           so they don't have to re-tell us. Hides if empty + nudges. */}
        {hasPrefs ? (
          <Card className="bg-mustard/12 border-mustard/30">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-2 min-w-0">
                <span className="text-eyebrow">Sở thích đang áp dụng</span>
                <div className="flex flex-wrap gap-1.5">
                  {guideLabel && <BrandTag tone="flexible">{guideLabel}</BrandTag>}
                  {tourPrefs?.meal?.vegetarian && <BrandTag tone="workshop">Ăn chay</BrandTag>}
                  {tourPrefs?.meal?.noSpice && <BrandTag tone="workshop">Không cay</BrandTag>}
                  {(tourPrefs?.meal?.allergies ?? []).slice(0, 3).map((a) => (
                    <BrandTag key={a} tone="merch">
                      {a}
                    </BrandTag>
                  ))}
                  {routeLabel && <BrandTag tone="esim">{routeLabel}</BrandTag>}
                  {groupLabel && <BrandTag tone="fixed">{groupLabel}</BrandTag>}
                </div>
              </div>
              <Link href="/profile/preferences">
                <Button variant="link" size="sm">
                  Đổi sở thích
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-dashed border-foreground/20">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Chưa có sở thích nào. Đặt một lần — Locomate sẽ ghi nhớ cho mọi chuyến.
              </p>
              <Link href="/profile/preferences">
                <Button variant="forest" size="sm">
                  Đặt sở thích
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Day switcher */}
        {availableDays.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableDays.map((day) => {
              const active = day === effectiveDay;
              const d = new Date(day + "T00:00:00");
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  <div className="text-xs opacity-70 uppercase tracking-wider">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Timeline canvas */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="relative" style={{ height: (DAY_END_HOUR - DAY_START_HOUR + 1) * HOUR_HEIGHT }}>
              {/* Hour grid */}
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => i + DAY_START_HOUR).map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border"
                  style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2 left-2 text-xs text-muted-foreground font-semibold bg-card px-1">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {/* Event blocks */}
              {effectiveDayItems.map((item) => {
                if (!item.slotStartsAt || !item.slotEndsAt) return null;
                const start = new Date(item.slotStartsAt);
                const end = new Date(item.slotEndsAt);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;
                const top = (startHour - DAY_START_HOUR) * HOUR_HEIGHT;
                const height = Math.max(28, (endHour - startHour) * HOUR_HEIGHT - 2);
                const hasConflict = item.conflictsWith.length > 0;
                return (
                  <div
                    key={item.id}
                    className={`absolute left-16 right-2 rounded-lg p-2 shadow-sm overflow-hidden ${
                      hasConflict
                        ? "bg-red-100 border-2 border-red-400"
                        : "bg-card border border-secondary/20"
                    }`}
                    style={{ top, height }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold line-clamp-1 ${hasConflict ? "text-red-800" : "text-secondary"}`}>
                          {item.displayLabel}
                        </p>
                        <p className={`text-xs ${hasConflict ? "text-red-700" : "text-muted-foreground"}`}>
                          {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                          {"–"}
                          {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                          {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                        </p>
                        {hasConflict && (
                          <Badge className="mt-1 bg-red-500 text-white border-0 text-xs">Time conflict</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Untimed items (fixed tours, merch, eSIM, guide add-ons) */}
        {untimed.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <h2 className="font-semibold text-sm text-secondary">Also in your cart</h2>
              {untimed.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-xs">
                  <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-lg">
                    {item.kind === "fixed_tour" ? "🗺️" : item.kind === "merch" ? "🛍️" : item.kind === "esim" ? "📶" : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-secondary line-clamp-1">{item.displayLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.kind}
                      {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-secondary">{formatVnd(item.lineTotalVnd)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/activities">
            <Button variant="outline" className="w-full rounded-xl">Add more</Button>
          </Link>
          <Link href="/cart">
            <Button className="w-full bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl">Go to cart</Button>
          </Link>
        </div>

      </div>
    </PageTransition>
  );
}
