"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandTag } from "./brand-tag";
import {
  COMMON_ALLERGIES,
  GROUP_OPTIONS,
  GUIDE_OPTIONS,
  ROUTE_OPTIONS,
  type GroupSize,
  type GuideStyle,
  type MealPreferences,
  type RouteStyle,
  type TourPreferences,
} from "@/lib/tour-preferences";
import { cn } from "@/lib/utils";

/* The Checkbox primitive isn't yet exported from ui — provide a tiny
 * fallback inline so this form doesn't require a separate UI addition. */
function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary cursor-pointer"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}
/**
 * Locomate's tour-preference editor (Phase A.4). Four axes — guide style,
 * meal, route, group size — each rendered as a row of brand-tag selections.
 * The component is uncontrolled: it owns local state until the user hits
 * `Save`, at which point the parent's `onSave` is called with the final
 * `TourPreferences` object. Pass `initial` to pre-fill from the server.
 *
 * Designed for /profile/preferences (canonical edit) and /plan/build
 * (one-time-per-trip override). Both surfaces share the same component
 * so the UX is identical.
 */
export function PreferenceForm({
  initial,
  onSave,
  saving,
  compact,
}: {
  initial?: TourPreferences | null;
  onSave: (prefs: TourPreferences) => void;
  saving?: boolean;
  /** When true, hides the section eyebrows for embedded use in a wizard. */
  compact?: boolean;
}) {
  const t = useTranslations("profile.preferences.tourForm");
  const [guideStyle, setGuideStyle] = useState<GuideStyle | undefined>(initial?.guideStyle);
  const [route, setRoute] = useState<RouteStyle | undefined>(initial?.route);
  const [groupSize, setGroupSize] = useState<GroupSize | undefined>(initial?.groupSize);
  const [meal, setMeal] = useState<MealPreferences>({
    vegetarian: initial?.meal?.vegetarian ?? false,
    noSpice: initial?.meal?.noSpice ?? false,
    allergies: initial?.meal?.allergies ?? [],
  });
  const [allergyDraft, setAllergyDraft] = useState("");

  // Re-sync local state when `initial` lands asynchronously (the tRPC
  // profile query resolves AFTER the component first mounts). The
  // setState calls are gated on a meaningful change in `initial`, so
  // there's no cascade — same shape as the existing pattern in
  // /profile/preferences/page.tsx.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!initial) return;
    setGuideStyle(initial.guideStyle);
    setRoute(initial.route);
    setGroupSize(initial.groupSize);
    setMeal({
      vegetarian: initial.meal?.vegetarian ?? false,
      noSpice: initial.meal?.noSpice ?? false,
      allergies: initial.meal?.allergies ?? [],
    });
  }, [initial]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addAllergy = (text: string) => {
    const t = text.trim();
    if (!t || meal.allergies.includes(t) || meal.allergies.length >= 10) return;
    setMeal((m) => ({ ...m, allergies: [...m.allergies, t] }));
    setAllergyDraft("");
  };

  const removeAllergy = (text: string) => {
    setMeal((m) => ({ ...m, allergies: m.allergies.filter((a) => a !== text) }));
  };

  const handleSave = () => {
    onSave({
      guideStyle,
      route,
      groupSize,
      meal:
        meal.vegetarian || meal.noSpice || meal.allergies.length > 0
          ? meal
          : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PrefSection
        eyebrow={t("guideStyle.eyebrow")}
        title={t("guideStyle.title")}
        sub={t("guideStyle.sub")}
        compact={compact}
      >
        <div className="flex flex-wrap gap-2">
          {GUIDE_OPTIONS.map((opt) => (
            <SelectChip
              key={opt.value}
              active={guideStyle === opt.value}
              onClick={() =>
                setGuideStyle(guideStyle === opt.value ? undefined : opt.value)
              }
              label={opt.label}
              sub={opt.sub}
            />
          ))}
        </div>
      </PrefSection>

      <PrefSection
        eyebrow={t("meal.eyebrow")}
        title={t("meal.title")}
        sub={t("meal.sub")}
        compact={compact}
      >
        <div className="flex flex-wrap gap-4">
          <CheckboxRow
            checked={meal.vegetarian}
            onChange={(v) => setMeal((m) => ({ ...m, vegetarian: v }))}
            label={t("meal.vegetarian")}
          />
          <CheckboxRow
            checked={meal.noSpice}
            onChange={(v) => setMeal((m) => ({ ...m, noSpice: v }))}
            label={t("meal.noSpice")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{t("meal.allergiesLabel")}</span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_ALLERGIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => (meal.allergies.includes(a) ? removeAllergy(a) : addAllergy(a))}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  meal.allergies.includes(a)
                    ? "bg-destructive/15 border-destructive/40 text-destructive"
                    : "border-foreground/15 text-foreground hover:bg-muted",
                )}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={allergyDraft}
              onChange={(e) => setAllergyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAllergy(allergyDraft);
                }
              }}
              placeholder={t("meal.allergyPlaceholder")}
              maxLength={40}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addAllergy(allergyDraft)}
              disabled={!allergyDraft.trim()}
            >
              {t("meal.addAllergy")}
            </Button>
          </div>
          {meal.allergies.filter((a) => !COMMON_ALLERGIES.includes(a as (typeof COMMON_ALLERGIES)[number])).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meal.allergies
                .filter((a) => !COMMON_ALLERGIES.includes(a as (typeof COMMON_ALLERGIES)[number]))
                .map((a) => (
                  <BrandTag key={a} tone="merch">
                    {a}
                    <button
                      type="button"
                      onClick={() => removeAllergy(a)}
                      className="ml-1.5 opacity-60 hover:opacity-100"
                      aria-label={t("meal.removeAllergyAria", { item: a })}
                    >
                      ×
                    </button>
                  </BrandTag>
                ))}
            </div>
          )}
        </div>
      </PrefSection>

      <PrefSection
        eyebrow={t("route.eyebrow")}
        title={t("route.title")}
        sub={t("route.sub")}
        compact={compact}
      >
        <div className="flex flex-wrap gap-2">
          {ROUTE_OPTIONS.map((opt) => (
            <SelectChip
              key={opt.value}
              active={route === opt.value}
              onClick={() => setRoute(route === opt.value ? undefined : opt.value)}
              label={opt.label}
              sub={opt.sub}
            />
          ))}
        </div>
      </PrefSection>

      <PrefSection
        eyebrow={t("groupSize.eyebrow")}
        title={t("groupSize.title")}
        sub={t("groupSize.sub")}
        compact={compact}
      >
        <div className="flex flex-wrap gap-2">
          {GROUP_OPTIONS.map((opt) => (
            <SelectChip
              key={opt.value}
              active={groupSize === opt.value}
              onClick={() =>
                setGroupSize(groupSize === opt.value ? undefined : opt.value)
              }
              label={opt.label}
              sub={opt.sub}
            />
          ))}
        </div>
      </PrefSection>

      <div className="pt-2">
        <Button
          variant="default"
          size="brand"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("save.pending") : t("save.idle")}
        </Button>
      </div>
    </div>
  );
}

function PrefSection({
  eyebrow,
  title,
  sub,
  children,
  compact,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        {!compact && <span className="text-eyebrow">{eyebrow}</span>}
        <h3 className="text-h3 font-voice text-foreground font-normal">{title}</h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function SelectChip({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-md border px-4 py-2.5 transition-colors text-left",
        active
          ? "bg-primary/15 border-primary/45 text-brick"
          : "bg-card border-foreground/15 text-foreground hover:bg-muted",
      )}
    >
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}
