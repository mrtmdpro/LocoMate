"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LogoLockup } from "@/components/brand";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

// Stable canonical English `value` is what we persist to
// `userProfiles.explicitData` (do not change — schema-stable). `labelKey`
// drives the i18n lookup at render time only.
const INTENTS = [
  { value: "Relax & Recharge", labelKey: "Relax & Recharge" },
  { value: "Explore Culture", labelKey: "Explore Culture" },
  { value: "Meet New People", labelKey: "Meet New People" },
  { value: "Food & Drink", labelKey: "Food & Drink" },
  { value: "Adventure", labelKey: "Adventure" },
] as const;

const INTERESTS = [
  { value: "Street Food", labelKey: "Street Food" },
  { value: "Hidden Cafes", labelKey: "Hidden Cafes" },
  { value: "Temples", labelKey: "Temples" },
  { value: "Markets", labelKey: "Markets" },
  { value: "Photography", labelKey: "Photography" },
  { value: "Rooftops", labelKey: "Rooftops" },
  { value: "Art", labelKey: "Art" },
  { value: "Nightlife", labelKey: "Nightlife" },
] as const;

const SCENARIOS = [
  { id: "A", labelKey: "A", icon: "☕" },
  { id: "B", labelKey: "B", icon: "🏛️" },
  { id: "C", labelKey: "C", icon: "🍜" },
  { id: "D", labelKey: "D", icon: "🍻" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboardingLegacy");
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [step, setStep] = useState(0);

  // Traveler onboarding isn't for hosts/admins. If a host lands here by a
  // stale link or a role upgrade that raced the router push, bounce them to
  // their real home so the flow feels deliberate.
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user && (user.role === "host" || user.role === "admin")) {
      router.replace("/home");
    }
  }, [user, router]);

  const [direction, setDirection] = useState(1);

  const [intent, setIntent] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [chillExplore, setChillExplore] = useState([0.5]);
  const [planSpontaneous, setPlanSpontaneous] = useState([0.5]);
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState<"low" | "medium" | "high">("medium");
  const [socialPref, setSocialPref] = useState<"solo" | "meet_new" | "group">("meet_new");
  const [timePref, setTimePref] = useState<string[]>(["morning"]);
  // Phase A.2 — danh xưng. Skippable; an empty string keeps the default
  // displayName-based fallback. Suggestions are the brand-canonical four.
  const [nickname, setNickname] = useState("");

  const setNicknameMutation = trpc.user.setNickname.useMutation();
  const submitMutation = trpc.user.submitOnboarding.useMutation({
    onSuccess: async () => {
      // Persist the chosen danh xưng after the main onboarding payload
      // lands. Failure here doesn't block the user from reaching home —
      // they can always set it later on /settings.
      const trimmed = nickname.trim();
      if (trimmed) {
        try {
          await setNicknameMutation.mutateAsync({ nickname: trimmed });
        } catch {
          // non-blocking; user can retry from /settings
        }
      }
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, onboardingCompleted: true }, accessToken, refreshToken);
      }
      router.push("/home");
    },
  });

  // Promotes a traveler to host and routes them to host setup. Used by the
  // "I'm a host" option so OAuth signups (forced to role='traveler' by the
  // OAuth callback) + anyone who picked "Traveler" at register can switch
  // paths without needing a separate "change role" flow later.
  const becomeHostMutation = trpc.user.becomeHost.useMutation({
    onSuccess: () => {
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, role: "host" }, accessToken, refreshToken);
      }
      toast.success(t("host.toastSuccess"));
      router.push("/host-setup");
    },
    onError: (err) =>
      toast.error(err.message || t("host.toastError")),
  });

  const totalSteps = 5;
  const canNext = step === 0 ? intent.length > 0 && scenario
    : step === 1 ? true
    : step === 2 ? interests.length > 0
    : step === 3 ? timePref.length > 0
    : true; // step 4 (nickname) is always skippable

  function handleFinish() {
    submitMutation.mutate({
      intent,
      scenario_choice: scenario,
      style: { chill_explore: chillExplore[0], plan_spontaneous: planSpontaneous[0] },
      interests,
      budget,
      social_preference: socialPref,
      time_preference: timePref as ("morning" | "afternoon" | "evening" | "late_night")[],
    });
  }

  const toggle = (arr: string[], val: string, set: (v: string[]) => void, max?: number) => {
    if (arr.includes(val)) set(arr.filter((v) => v !== val));
    else if (!max || arr.length < max) set([...arr, val]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF6EC]/20 to-white p-4">
      <div className="max-w-md mx-auto pt-6">
        <div className="flex justify-center mb-6">
          <LogoLockup size="md" />
        </div>
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-muted/80"}`} />
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        {/* Step 1: Intent + Scenario */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Phase A.8 — alternative: chat with Locomate. Italic-serif
                framing, terracotta accent, sits above the host fast-track
                so travelers see the brand-led path first. Card copy stays
                Vietnamese in both locales — brand-voice exception. */}
            <Card className="border border-secondary/40 bg-secondary/10 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif italic text-base text-secondary leading-tight">
                    {t("chat.card.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("chat.card.body")}
                  </p>
                </div>
                <Link href="/onboarding/chat">
                  <Button
                    size="sm"
                    variant="forest"
                    className="h-9 text-xs"
                  >
                    {t("chat.card.cta")}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Host fast-track: skips traveler onboarding and jumps straight
                to /host-setup. Rendered before the intent picker so hosts
                are not forced to fabricate traveler answers just to proceed. */}
            <Card className="border border-primary/30 bg-primary/5 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-xl shrink-0">
                  <span role="img" aria-label={t("host.title")}>🏡</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary">
                    {t("host.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("host.body")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs rounded-xl border-primary text-primary hover:bg-primary hover:text-white"
                  disabled={becomeHostMutation.isPending}
                  onClick={() => becomeHostMutation.mutate()}
                  data-testid="become-host-button"
                >
                  {becomeHostMutation.isPending ? t("host.loading") : t("host.cta")}
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-2xl font-bold font-heading text-secondary">{t("step1.heading")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("step1.subtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((item) => (
                <Badge
                  key={item.value}
                  variant={intent.includes(item.value) ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 text-sm rounded-full transition-all ${
                    intent.includes(item.value) ? "bg-primary hover:bg-primary/85 text-primary-foreground border-primary" : "hover:border-primary hover:text-primary"
                  }`}
                  onClick={() => toggle(intent, item.value, setIntent, 3)}
                >
                  {t(`intents.${item.labelKey}`)}
                </Badge>
              ))}
            </div>
            <Card className="border-secondary/10">
              <CardContent className="p-4">
                <p className="font-semibold text-secondary mb-3">{t("step1.scenarioPrompt")}</p>
                <div className="space-y-2">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setScenario(s.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        scenario === s.id ? "border-primary bg-primary/5" : "border-border hover:border-border"
                      }`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-sm">{t(`step1.scenarios.${s.labelKey}`)}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Style Sliders */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold font-heading text-secondary">{t("step2.heading")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("step2.subtitle")}</p>
            </div>
            <Card className="border-secondary/10">
              <CardContent className="p-6 space-y-8">
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-secondary font-medium">{t("step2.chill")}</span>
                    <span className="text-primary font-medium">{t("step2.explore")}</span>
                  </div>
                  <Slider value={chillExplore} onValueChange={(v) => setChillExplore(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-primary" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-secondary font-medium">{t("step2.plan")}</span>
                    <span className="text-primary font-medium">{t("step2.spontaneous")}</span>
                  </div>
                  <Slider value={planSpontaneous} onValueChange={(v) => setPlanSpontaneous(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Interests + Budget */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-secondary">{t("step3.heading")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("step3.subtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((item) => (
                <Badge
                  key={item.value}
                  variant={interests.includes(item.value) ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2.5 text-sm rounded-full transition-all ${
                    interests.includes(item.value) ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground border-secondary" : "hover:border-secondary"
                  }`}
                  onClick={() => toggle(interests, item.value, setInterests)}
                >
                  {t(`interests.${item.labelKey}`)}
                </Badge>
              ))}
            </div>
            <div>
              <p className="font-semibold text-secondary mb-3">{t("step3.budget")}</p>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudget(b)}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                      budget === b ? "bg-sage text-earth shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {b === "low" ? "$" : b === "medium" ? "$$" : "$$$"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Social + Timing */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-secondary">{t("step4.heading")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("step4.subtitle")}</p>
            </div>
            <div>
              <p className="font-semibold text-secondary mb-3">{t("step4.company")}</p>
              <div className="space-y-2">
                {([
                  { id: "solo", icon: "🧘" },
                  { id: "meet_new", icon: "👋" },
                  { id: "group", icon: "👥" },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSocialPref(s.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all ${
                      socialPref === s.id ? "border-primary bg-primary/5" : "border-border hover:border-border"
                    }`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-sm font-medium">{t(`step4.companyOptions.${s.id}`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-secondary mb-3">{t("step4.bestTime")}</p>
              <div className="flex flex-wrap gap-2">
                {(["morning", "afternoon", "evening", "late_night"] as const).map((slot) => (
                  <Badge
                    key={slot}
                    variant={timePref.includes(slot) ? "default" : "outline"}
                    className={`cursor-pointer px-4 py-2.5 text-sm rounded-full transition-all ${
                      timePref.includes(slot) ? "bg-secondary text-secondary-foreground border-secondary" : ""
                    }`}
                    onClick={() => toggle(timePref, slot, setTimePref)}
                  >
                    {t(`step4.time.${slot}`)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Danh xưng — the brand's intimate-greeting moment. Skippable.
            Danh xưng + placeholder copy stays Vietnamese in both locales —
            it is a brand-voice ritual word, not a translatable label. */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <span className="text-eyebrow">{t("step5.eyebrow")}</span>
              <h2 className="text-h1 font-voice text-brick font-normal leading-tight">
                {t("step5.heading")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("step5.subtitle")}
              </p>
            </div>

            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("step5.placeholder")}
              maxLength={40}
              className="bg-paper"
            />

            <div className="flex flex-wrap gap-2">
              {["Kẻ lữ hành", "Cậu cả", "Nàng thơ", "Người mê dịch chuyển"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNickname(s)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    nickname === s
                      ? "bg-brick border-brick text-[#faf6ec]"
                      : "border-foreground/15 text-foreground hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        </motion.div>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setDirection(-1); setStep(step - 1); }} className="flex-1 h-12 rounded-xl">
              {t("nav.back")}
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              onClick={() => { setDirection(1); setStep(step + 1); }}
              disabled={!canNext}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold"
            >
              {t("nav.continue")}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!canNext || submitMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold"
            >
              {submitMutation.isPending
                ? t("nav.submitting")
                : nickname.trim()
                  ? t("nav.finishWithName", { name: nickname.trim().split(/\s+/)[0] })
                  : t("nav.finish")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
