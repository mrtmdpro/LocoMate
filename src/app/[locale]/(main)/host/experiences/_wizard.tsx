"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  HOST_TOUR_PRICING,
  computeHostPayout,
  isValidHostTourPrice,
} from "@/lib/pricing";

/**
 * 5-step host experience wizard reused by /new and /[id]/edit.
 *
 * Scope:
 *   - Client-side validation per step (UX only). The server re-validates at
 *     publish time; see host-experience.router.ts `validateForPublish`.
 *   - Autosave on "Next"/"Back": the wizard owns the draft id after step 1
 *     (or receives it from the parent for edit).
 *   - Pricing step shows the live 80/20 split via computeHostPayout so hosts
 *     see exactly what LOCOMATE keeps and what they receive.
 */

export interface WizardInitialValues {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  durationMinutes?: number;
  priceAmount?: number;
  maxGroupSize?: number;
  photos?: string[];
  highlights?: string[];
  included?: string[];
  schedule?: { time: string; label: string }[];
}

// Stable canonical lowercase `value` is what we persist as
// `hostExperience.category`. `labelKey` resolves the i18n label via
// `host.experiences.wizard.category.*`.
const CATEGORIES: { value: string; labelKey: string }[] = [
  { value: "cultural", labelKey: "cultural" },
  { value: "food", labelKey: "food" },
  { value: "nightlife", labelKey: "nightlife" },
  { value: "nature", labelKey: "nature" },
  { value: "workshop", labelKey: "workshop" },
  { value: "art", labelKey: "art" },
  { value: "photography", labelKey: "photography" },
];

interface HostExperienceWizardProps {
  initial?: WizardInitialValues;
  hostIsVerified: boolean;
  onPublished?: (id: string) => void;
  /**
   * Test-only seam: start the wizard on a specific step so component tests
   * can assert step-5 behavior without scripting all the intermediate
   * form-fill clicks. Production code always omits this.
   */
  initialStep?: 1 | 2 | 3 | 4 | 5;
}

export function HostExperienceWizard({
  initial,
  hostIsVerified,
  onPublished,
  initialStep = 1,
}: HostExperienceWizardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const t = useTranslations("host.experiences.wizard");
  const [step, setStep] = useState<number>(initialStep);
  const [id, setId] = useState<string | undefined>(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "cultural");
  const [durationHours, setDurationHours] = useState<number[]>([
    (initial?.durationMinutes ?? 180) / 60,
  ]);
  const [maxGroupSize, setMaxGroupSize] = useState<number[]>([
    initial?.maxGroupSize ?? 4,
  ]);
  const [highlights, setHighlights] = useState<string[]>(
    initial?.highlights ?? [],
  );
  const [newHighlight, setNewHighlight] = useState("");
  const [included, setIncluded] = useState<string[]>(initial?.included ?? []);
  const [newIncluded, setNewIncluded] = useState("");
  const [schedule, setSchedule] = useState<{ time: string; label: string }[]>(
    initial?.schedule ?? [],
  );
  const [newStopTime, setNewStopTime] = useState("09:00");
  const [newStopLabel, setNewStopLabel] = useState("");
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [newPhoto, setNewPhoto] = useState("");
  const [priceAmount, setPriceAmount] = useState<number[]>([
    initial?.priceAmount ?? HOST_TOUR_PRICING.minPrice,
  ]);

  const createMutation = trpc.hostExperience.create.useMutation({
    onSuccess: (row) => {
      setId(row.id);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.hostExperience.update.useMutation({
    onError: (err) => toast.error(err.message),
  });
  const publishMutation = trpc.hostExperience.publish.useMutation({
    onSuccess: (row) => {
      toast.success(t("toast.published"));
      utils.hostExperience.listMine.invalidate();
      if (onPublished && row.id) onPublished(row.id);
      else router.push("/host/experiences");
    },
    onError: (err) => toast.error(err.message),
  });

  function currentPatch() {
    return {
      title: title.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      description: description.trim() || undefined,
      category,
      durationMinutes: Math.round(durationHours[0] * 60),
      maxGroupSize: maxGroupSize[0],
      highlights,
      included,
      schedule,
      photos,
      priceAmount: priceAmount[0],
    };
  }

  async function saveStep() {
    const patch = currentPatch();
    if (!id) {
      const created = await createMutation.mutateAsync(patch);
      setId(created.id);
      return created.id;
    }
    await updateMutation.mutateAsync({ id, ...patch });
    return id;
  }

  async function handleNext() {
    const stepError = validateStep(step, currentPatch(), t);
    if (stepError) {
      toast.error(stepError);
      return;
    }
    try {
      await saveStep();
      setStep(step + 1);
    } catch {
      // already toasted
    }
  }

  async function handlePublish() {
    const patch = currentPatch();
    for (let s = 1; s <= 5; s++) {
      const err = validateStep(s, patch, t);
      if (err) {
        toast.error(err);
        setStep(s);
        return;
      }
    }
    const finalId = await saveStep();
    if (!finalId) return;
    publishMutation.mutate({ id: finalId });
  }

  // Keep host-verification feedback synchronized when the prop changes.
  useEffect(() => {
    if (step === 5 && !hostIsVerified) {
      toast.info(t("toast.verifyHint"));
    }
  }, [step, hostIsVerified, t]);

  const canPublishClientSide =
    title.trim().length >= 8 &&
    description.trim().length >= 100 &&
    photos.length >= 3 &&
    highlights.length >= 1 &&
    schedule.length >= 1 &&
    isValidHostTourPrice(priceAmount[0]);

  return (
    <div className="p-4 lg:p-8 lg:max-w-4xl lg:mx-auto space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold font-heading text-secondary">
            {id ? t("title.edit") : t("title.new")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("stepCounter", { current: step })}</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-6 rounded-full ${n <= step ? "bg-primary" : "bg-muted/80"}`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-secondary">{t("step1.heading")}</h2>
            <div className="space-y-2">
              <Label htmlFor="title">{t("step1.title")}</Label>
              <Input
                id="title"
                maxLength={200}
                placeholder={t("step1.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("step1.titleHelper")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">{t("step1.subtitle")}</Label>
              <Input
                id="subtitle"
                maxLength={300}
                placeholder={t("step1.subtitlePlaceholder")}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("step1.category")}</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Badge
                    key={c.value}
                    variant={category === c.value ? "default" : "outline"}
                    className={`cursor-pointer text-xs px-3 py-1.5 rounded-full ${category === c.value ? "bg-secondary text-secondary-foreground border-secondary" : ""}`}
                    onClick={() => setCategory(c.value)}
                  >
                    {t(`category.${c.labelKey}`)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>{t("step1.duration")}</Label>
                <span className="text-sm font-bold text-primary">
                  {durationHours[0].toFixed(1)}h
                </span>
              </div>
              <Slider
                value={durationHours}
                onValueChange={(v) =>
                  setDurationHours(Array.isArray(v) ? v : [v])
                }
                min={0.5}
                max={8}
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>{t("step1.maxGroup")}</Label>
                <span className="text-sm font-bold text-primary">
                  {maxGroupSize[0]}
                </span>
              </div>
              <Slider
                value={maxGroupSize}
                onValueChange={(v) =>
                  setMaxGroupSize(Array.isArray(v) ? v : [v])
                }
                min={1}
                max={12}
                step={1}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-secondary">{t("step2.heading")}</h2>
            <div className="space-y-2">
              <Label htmlFor="description">{t("step2.description")}</Label>
              <Textarea
                id="description"
                rows={6}
                maxLength={5000}
                placeholder={t("step2.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("step2.descriptionHelper", { count: description.length })}
              </p>
            </div>
            <TagList
              label={t("step2.highlights")}
              hint={t("step2.highlightsHint")}
              tags={highlights}
              onAdd={(tag) => setHighlights([...highlights, tag])}
              onRemove={(i) =>
                setHighlights(highlights.filter((_, idx) => idx !== i))
              }
              newValue={newHighlight}
              onNewChange={setNewHighlight}
            />
            <TagList
              label={t("step2.included")}
              hint={t("step2.includedHint")}
              tags={included}
              onAdd={(tag) => setIncluded([...included, tag])}
              onRemove={(i) =>
                setIncluded(included.filter((_, idx) => idx !== i))
              }
              newValue={newIncluded}
              onNewChange={setNewIncluded}
            />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-secondary">{t("step3.heading")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("step3.subtitle")}
            </p>
            <div className="space-y-2">
              {schedule.map((stop, i) => (
                <div
                  key={`${stop.time}-${i}`}
                  className="flex items-center gap-2 bg-muted/40 rounded-lg p-2"
                >
                  <span className="text-xs font-mono text-primary">
                    {stop.time}
                  </span>
                  <span className="flex-1 text-xs truncate">{stop.label}</span>
                  <button
                    className="text-xs text-red-600"
                    onClick={() =>
                      setSchedule(schedule.filter((_, idx) => idx !== i))
                    }
                  >
                    {t("step3.remove")}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="time"
                value={newStopTime}
                onChange={(e) => setNewStopTime(e.target.value)}
                className="w-28"
              />
              <Input
                placeholder={t("step3.stopPlaceholder")}
                value={newStopLabel}
                onChange={(e) => setNewStopLabel(e.target.value)}
                maxLength={300}
              />
              <Button
                size="sm"
                onClick={() => {
                  const label = newStopLabel.trim();
                  if (!label) return;
                  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newStopTime)) {
                    toast.error(t("toast.timeFormat"));
                    return;
                  }
                  setSchedule([...schedule, { time: newStopTime, label }]);
                  setNewStopLabel("");
                }}
                className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg"
              >
                {t("step3.addStop")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-secondary">{t("step4.heading")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("step4.subtitle")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={`${p}-${i}`} className="relative">
                  <img
                    src={p}
                    alt=""
                    className="w-full h-20 object-cover rounded-lg bg-muted"
                  />
                  <button
                    className="absolute top-1 right-1 bg-card/90 rounded-full w-5 h-5 text-xs font-bold text-red-600"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-1 left-1 bg-primary text-white text-xs rounded px-1 py-0.5 font-semibold">
                      {t("step4.cover")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("step4.urlPlaceholder")}
                value={newPhoto}
                onChange={(e) => setNewPhoto(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  const url = newPhoto.trim();
                  if (!/^https?:\/\//i.test(url)) {
                    toast.error(t("toast.photoUrlScheme"));
                    return;
                  }
                  if (photos.length >= 10) {
                    toast.error(t("toast.photoLimit"));
                    return;
                  }
                  setPhotos([...photos, url]);
                  setNewPhoto("");
                }}
                className="bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg"
              >
                {t("step4.addPhoto")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-secondary">{t("step5.heading")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("step5.subtitle", { pct: (HOST_TOUR_PRICING.commissionRate * 100).toFixed(0) })}
            </p>
            <div>
              <div className="flex justify-between mb-2">
                <Label>{t("step5.price")}</Label>
                <span className="text-sm font-bold text-primary">
                  {priceAmount[0].toLocaleString()} {HOST_TOUR_PRICING.currency}
                </span>
              </div>
              <Slider
                value={priceAmount}
                onValueChange={(v) => setPriceAmount(Array.isArray(v) ? v : [v])}
                min={HOST_TOUR_PRICING.minPrice}
                max={HOST_TOUR_PRICING.maxPrice}
                step={50_000}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{HOST_TOUR_PRICING.minPrice.toLocaleString()}</span>
                <span>{HOST_TOUR_PRICING.maxPrice.toLocaleString()}</span>
              </div>
            </div>
            <PayoutBreakdown price={priceAmount[0]} />
            {!hostIsVerified && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                {t("step5.verifyHint")} {" "}
                <a href="/host-setup" className="underline font-medium">
                  {t("step5.openSetup")}
                </a>
                .
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 max-w-md mx-auto flex gap-2">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
        >
          {t("actions.back")}
        </Button>
        {step < 5 ? (
          <Button
            className="flex-1 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground"
            onClick={handleNext}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {t("actions.saveContinue")}
          </Button>
        ) : (
          <Button
            className="flex-1 rounded-xl bg-sage hover:bg-[#7bc25a] text-white"
            onClick={handlePublish}
            disabled={
              !hostIsVerified ||
              !canPublishClientSide ||
              publishMutation.isPending
            }
            data-testid="publish-button"
          >
            {publishMutation.isPending ? t("actions.publishing") : t("actions.publish")}
          </Button>
        )}
      </div>
    </div>
  );
}

interface StepValidationInput {
  title?: string;
  description?: string;
  photos?: string[];
  highlights?: string[];
  schedule?: { time: string; label: string }[];
  priceAmount?: number;
}

// Translator threaded in from the wizard component. Keeps this file
// framework-agnostic at the function boundary (no `useTranslations` import
// here) while still surfacing localised validation feedback.
type ValidationTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function validateStep(
  step: number,
  v: StepValidationInput,
  t: ValidationTranslator,
): string | null {
  const title = v.title?.trim() ?? "";
  const description = v.description?.trim() ?? "";
  const photos = v.photos ?? [];
  const highlights = v.highlights ?? [];
  const schedule = v.schedule ?? [];
  const priceAmount = v.priceAmount ?? 0;

  if (step === 1 && title.length < 8) return t("validation.titleLength");
  if (step === 2 && description.length < 100)
    return t("validation.descriptionLength");
  if (step === 2 && highlights.length < 1)
    return t("validation.highlightRequired");
  if (step === 3 && schedule.length < 1)
    return t("validation.scheduleRequired");
  if (step === 4 && photos.length < 3)
    return t("validation.photosRequired");
  if (step === 5 && !isValidHostTourPrice(priceAmount))
    return t("validation.priceRange", {
      min: HOST_TOUR_PRICING.minPrice.toLocaleString(),
      max: HOST_TOUR_PRICING.maxPrice.toLocaleString(),
    });
  return null;
}

function TagList({
  label,
  hint,
  tags,
  onAdd,
  onRemove,
  newValue,
  onNewChange,
}: {
  label: string;
  hint: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  newValue: string;
  onNewChange: (v: string) => void;
}) {
  const t = useTranslations("host.experiences.wizard.tagList");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <Badge
            key={`${tag}-${i}`}
            className="bg-secondary/10 text-foreground border-0 text-xs cursor-pointer"
            onClick={() => onRemove(i)}
          >
            {tag} ×
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={t("addPlaceholder", { label: label.toLowerCase() })}
          value={newValue}
          onChange={(e) => onNewChange(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newValue.trim()) {
              e.preventDefault();
              onAdd(newValue.trim());
              onNewChange("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!newValue.trim()) return;
            onAdd(newValue.trim());
            onNewChange("");
          }}
        >
          {t("add")}
        </Button>
      </div>
    </div>
  );
}

function PayoutBreakdown({ price }: { price: number }) {
  const t = useTranslations("host.experiences.wizard.step5.payout");
  const { hostPayout, platformFee } = computeHostPayout(price);
  const pct = (HOST_TOUR_PRICING.commissionRate * 100).toFixed(0);
  return (
    <div className="bg-secondary/5 rounded-lg p-3 space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("set")}</span>
        <span className="font-medium">
          {price.toLocaleString()} {HOST_TOUR_PRICING.currency}
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("platform", { pct })}</span>
        <span className="font-medium">
          {platformFee.toLocaleString()} {HOST_TOUR_PRICING.currency}
        </span>
      </div>
      <div className="flex justify-between text-sm border-t pt-1.5 border-secondary/10">
        <span className="font-semibold text-secondary">{t("receive")}</span>
        <span className="font-bold text-secondary" data-testid="host-payout">
          {hostPayout.toLocaleString()} {HOST_TOUR_PRICING.currency}
        </span>
      </div>
    </div>
  );
}
