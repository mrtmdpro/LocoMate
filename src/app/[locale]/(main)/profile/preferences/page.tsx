"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { HoiVanDivider, PreferenceForm } from "@/components/brand";
import type { TourPreferences } from "@/lib/tour-preferences";

// Stable canonical English `value` is what we persist to
// `userProfiles.explicitData` (do not change — schema-stable). `labelKey`
// drives the i18n lookup at render time only.
const INTENTS = [
  { value: "Relax & Recharge", labelKey: "relax" },
  { value: "Explore Culture", labelKey: "culture" },
  { value: "Meet New People", labelKey: "meet" },
  { value: "Food & Drink", labelKey: "food" },
  { value: "Adventure", labelKey: "adventure" },
] as const;

const INTERESTS = [
  { value: "Street Food", labelKey: "streetFood" },
  { value: "Hidden Cafes", labelKey: "hiddenCafes" },
  { value: "Temples", labelKey: "temples" },
  { value: "Markets", labelKey: "markets" },
  { value: "Photography", labelKey: "photography" },
  { value: "Rooftops", labelKey: "rooftops" },
  { value: "Art", labelKey: "art" },
  { value: "Nightlife", labelKey: "nightlife" },
] as const;

export default function PreferencesPage() {
  const router = useRouter();
  const t = useTranslations("profile.preferences");
  const tCommon = useTranslations("common");
  const { data } = trpc.user.getProfile.useQuery();
  const utils = trpc.useUtils();

  const [intent, setIntent] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [chillExplore, setChillExplore] = useState([0.5]);
  const [planSpontaneous, setPlanSpontaneous] = useState([0.5]);
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState<"low" | "medium" | "high">("medium");
  const [socialPref, setSocialPref] = useState<"solo" | "meet_new" | "group">("meet_new");
  const [timePref, setTimePref] = useState<string[]>(["morning"]);
  const [loaded, setLoaded] = useState(false);

  // Hydrates form fields from the fetched profile once. Repeated renders are
  // guarded by the `loaded` flag so this isn't a cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (data?.profile?.explicitData && !loaded) {
      const ed = data.profile.explicitData as {
        intent?: string[]; scenario_choice?: string;
        style?: { chill_explore?: number; plan_spontaneous?: number };
        interests?: string[]; budget?: string;
        social_preference?: string; time_preference?: string[];
      };
      setIntent(ed.intent || []);
      setScenario(ed.scenario_choice || "");
      setChillExplore([ed.style?.chill_explore ?? 0.5]);
      setPlanSpontaneous([ed.style?.plan_spontaneous ?? 0.5]);
      setInterests(ed.interests || []);
      setBudget((ed.budget as "low" | "medium" | "high") || "medium");
      setSocialPref((ed.social_preference as "solo" | "meet_new" | "group") || "meet_new");
      setTimePref(ed.time_preference || ["morning"]);
      setLoaded(true);
    }
  }, [data, loaded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateMutation = trpc.user.updatePreferences.useMutation({
    onSuccess: (result) => {
      const label = (result.derived as { personalityLabel?: string })?.personalityLabel || "Updated";
      toast.success(t("toast.savedWithLabel", { label }));
      utils.user.getProfile.invalidate();
      router.push("/profile");
    },
    onError: () => toast.error(t("toast.saveFailed")),
  });

  // Phase A.4 — Customised Tour preferences (guide / meal / route / group).
  // Persisted to userProfiles.explicitData.tourPreferences via
  // user.savePersonality, which is the same RPC the chatbot quiz writes to.
  const savePersonality = trpc.user.savePersonality.useMutation({
    onSuccess: () => {
      toast.success(t("toast.tourPrefsSaved"));
      utils.user.getProfile.invalidate();
    },
    onError: (e) => toast.error(e.message ?? t("toast.tourPrefsSaveFailed")),
  });
  const tourPreferences = (data?.profile?.explicitData as { tourPreferences?: TourPreferences } | undefined)?.tourPreferences;

  const toggle = (arr: string[], val: string, set: (v: string[]) => void, max?: number) => {
    if (arr.includes(val)) set(arr.filter((v) => v !== val));
    else if (!max || arr.length < max) set([...arr, val]);
  };

  function handleSave() {
    updateMutation.mutate({
      intent,
      scenario_choice: scenario || "B",
      style: { chill_explore: chillExplore[0], plan_spontaneous: planSpontaneous[0] },
      interests,
      budget,
      social_preference: socialPref,
      time_preference: timePref as ("morning" | "afternoon" | "evening" | "late_night")[],
    });
  }

  if (!loaded) return <div className="p-4"><div className="h-64 bg-muted rounded-2xl animate-pulse" /></div>;

  return (
    <div className="p-4 space-y-6 pb-32 lg:max-w-3xl lg:mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} aria-label={tCommon("back")} className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="flex flex-col">
          <span className="text-eyebrow">{t("eyebrow")}</span>
          <h1 className="text-h2 font-voice text-foreground font-normal leading-7">
            Ăn tùy nơi, chơi tùy gu.
          </h1>
        </div>
      </div>

      {/* Phase A.4 — Customised Tour preferences. Sits at the top because
         the Locomate brand promise centres on this kind of "đo ni đóng giày"
         configuration. The legacy onboarding-style form below feeds the
         matching engine; this form feeds the Customised Tour builder. */}
      <Card>
        <CardContent className="p-5 lg:p-6">
          <div className="flex flex-col gap-1 mb-5">
            <span className="text-eyebrow">{t("customisedTour.eyebrow")}</span>
            <h2 className="text-h2 font-voice text-foreground font-normal">
              Đo ni đóng giày cho hành trình.
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("customisedTour.subtitle")}
            </p>
          </div>
          <PreferenceForm
            initial={tourPreferences ?? null}
            saving={savePersonality.isPending}
            onSave={(prefs) =>
              savePersonality.mutate({ tourPreferences: prefs })
            }
          />
        </CardContent>
      </Card>

      <HoiVanDivider />

      <div className="flex flex-col gap-1">
        <span className="text-eyebrow">{t("matching.eyebrow")}</span>
        <h2 className="text-h2 font-voice text-foreground font-normal">
          {t("matching.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("matching.subtitle")}
        </p>
      </div>

      {/* Travel Intent */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-secondary mb-3">{t("intent.title")}</h3>
          <div className="flex flex-wrap gap-2">
            {INTENTS.map((item) => (
              <Badge
                key={item.value}
                variant={intent.includes(item.value) ? "default" : "outline"}
                className={`cursor-pointer px-3.5 py-2 text-xs rounded-full transition-all ${
                  intent.includes(item.value) ? "bg-primary hover:bg-primary/85 text-primary-foreground border-primary" : "hover:border-primary"
                }`}
                onClick={() => toggle(intent, item.value, setIntent, 3)}
              >
                {t(`intent.options.${item.labelKey}`)}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("intent.helper")}</p>
        </CardContent>
      </Card>

      {/* Style Sliders */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-6">
          <h3 className="font-semibold text-secondary">{t("style.title")}</h3>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-secondary">{t("style.chill")}</span>
              <span className="text-primary">{t("style.explore")}</span>
            </div>
            <Slider value={chillExplore} onValueChange={(v) => setChillExplore(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-primary" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-secondary">{t("style.plan")}</span>
              <span className="text-primary">{t("style.spontaneous")}</span>
            </div>
            <Slider value={planSpontaneous} onValueChange={(v) => setPlanSpontaneous(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-primary" />
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-secondary mb-3">{t("interests.title")}</h3>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <Badge
                key={item.value}
                variant={interests.includes(item.value) ? "default" : "outline"}
                className={`cursor-pointer px-3.5 py-2 text-xs rounded-full transition-all ${
                  interests.includes(item.value) ? "bg-secondary text-secondary-foreground border-secondary" : "hover:border-secondary"
                }`}
                onClick={() => toggle(interests, item.value, setInterests)}
              >
                {t(`interests.options.${item.labelKey}`)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-secondary mb-3">{t("budget.title")}</h3>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  budget === b ? "bg-sage text-earth shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(`budget.options.${b}`)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Social & Timing */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-secondary mb-3">{t("company.title")}</h3>
            <div className="flex gap-2">
              {(["solo", "meet_new", "group"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSocialPref(s)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    socialPref === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t(`company.options.${s}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-secondary mb-3">{t("timePref.title")}</h3>
            <div className="flex flex-wrap gap-2">
              {(["morning", "afternoon", "evening", "late_night"] as const).map((slot) => (
                <Badge
                  key={slot}
                  variant={timePref.includes(slot) ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 text-xs rounded-full transition-all ${
                    timePref.includes(slot) ? "bg-secondary text-secondary-foreground border-secondary" : ""
                  }`}
                  onClick={() => toggle(timePref, slot, setTimePref)}
                >
                  {t(`timePref.options.${slot}`)}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSave}
            disabled={intent.length === 0 || interests.length === 0 || timePref.length === 0 || updateMutation.isPending}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold"
          >
            {updateMutation.isPending ? t("saveButton.pending") : t("saveButton.idle")}
          </Button>
        </div>
      </div>
    </div>
  );
}
