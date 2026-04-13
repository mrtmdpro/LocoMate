"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";

const INTENTS = ["Relax & Recharge", "Explore Culture", "Meet New People", "Food & Drink", "Adventure"];
const INTERESTS = ["Street Food", "Hidden Cafes", "Temples", "Markets", "Photography", "Rooftops", "Art", "Nightlife"];
const SCENARIOS = [
  { id: "A", label: "Sit at a quiet lakeside cafe", icon: "☕" },
  { id: "B", label: "Visit a hidden temple", icon: "🏛️" },
  { id: "C", label: "Try 3 different street foods", icon: "🍜" },
  { id: "D", label: "Find a rooftop bar and meet people", icon: "🍻" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [step, setStep] = useState(0);

  const [direction, setDirection] = useState(1);

  const [intent, setIntent] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [chillExplore, setChillExplore] = useState([0.5]);
  const [planSpontaneous, setPlanSpontaneous] = useState([0.5]);
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState<"low" | "medium" | "high">("medium");
  const [socialPref, setSocialPref] = useState<"solo" | "meet_new" | "group">("meet_new");
  const [timePref, setTimePref] = useState<string[]>(["morning"]);

  const submitMutation = trpc.user.submitOnboarding.useMutation({
    onSuccess: () => {
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, onboardingCompleted: true }, accessToken, refreshToken);
      }
      router.push("/home");
    },
  });

  const totalSteps = 4;
  const canNext = step === 0 ? intent.length > 0 && scenario
    : step === 1 ? true
    : step === 2 ? interests.length > 0
    : timePref.length > 0;

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
    <div className="min-h-screen bg-gradient-to-b from-[#D9EDBF]/20 to-white p-4">
      <div className="max-w-md mx-auto pt-6">
        <img src="/images/logo.png" alt="LOCOMATE" className="h-10 mx-auto mb-6" />
        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-[#ff8c30]" : "bg-gray-200"}`} />
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
        {/* Step 1: Intent + Scenario */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">What brings you to Hanoi?</h2>
              <p className="text-sm text-muted-foreground mt-1">Pick up to 3</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((item) => (
                <Badge
                  key={item}
                  variant={intent.includes(item) ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 text-sm rounded-full transition-all ${
                    intent.includes(item) ? "bg-[#ff8c30] hover:bg-[#e67a20] text-white border-[#ff8c30]" : "hover:border-[#ff8c30] hover:text-[#ff8c30]"
                  }`}
                  onClick={() => toggle(intent, item, setIntent, 3)}
                >
                  {item}
                </Badge>
              ))}
            </div>
            <Card className="border-[#3f6f60]/10">
              <CardContent className="p-4">
                <p className="font-semibold text-[#3f6f60] mb-3">You have 3 hours in Hanoi. What do you do?</p>
                <div className="space-y-2">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setScenario(s.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        scenario === s.id ? "border-[#ff8c30] bg-[#ff8c30]/5" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-sm">{s.label}</span>
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
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Your travel style</h2>
              <p className="text-sm text-muted-foreground mt-1">Slide to match your vibe</p>
            </div>
            <Card className="border-[#3f6f60]/10">
              <CardContent className="p-6 space-y-8">
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-[#3f6f60] font-medium">Chill & Relaxed</span>
                    <span className="text-[#ff8c30] font-medium">Explore & Discover</span>
                  </div>
                  <Slider value={chillExplore} onValueChange={(v) => setChillExplore(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-[#ff8c30]" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-[#3f6f60] font-medium">Plan Everything</span>
                    <span className="text-[#ff8c30] font-medium">Go Spontaneous</span>
                  </div>
                  <Slider value={planSpontaneous} onValueChange={(v) => setPlanSpontaneous(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-[#ff8c30]" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Interests + Budget */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">What excites you?</h2>
              <p className="text-sm text-muted-foreground mt-1">Select your interests</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((item) => (
                <Badge
                  key={item}
                  variant={interests.includes(item) ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2.5 text-sm rounded-full transition-all ${
                    interests.includes(item) ? "bg-[#3f6f60] hover:bg-[#2d5a4d] text-white border-[#3f6f60]" : "hover:border-[#3f6f60]"
                  }`}
                  onClick={() => toggle(interests, item, setInterests)}
                >
                  {item}
                </Badge>
              ))}
            </div>
            <div>
              <p className="font-semibold text-[#3f6f60] mb-3">Daily budget</p>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudget(b)}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                      budget === b ? "bg-[#90D26D] text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Social & timing</h2>
              <p className="text-sm text-muted-foreground mt-1">Almost done!</p>
            </div>
            <div>
              <p className="font-semibold text-[#3f6f60] mb-3">Travel company</p>
              <div className="space-y-2">
                {([
                  { id: "solo", label: "Solo & Quiet", icon: "🧘" },
                  { id: "meet_new", label: "Open to Meeting People", icon: "👋" },
                  { id: "group", label: "Looking for a Group", icon: "👥" },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSocialPref(s.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all ${
                      socialPref === s.id ? "border-[#ff8c30] bg-[#ff8c30]/5" : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-sm font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-[#3f6f60] mb-3">Best time to explore</p>
              <div className="flex flex-wrap gap-2">
                {(["morning", "afternoon", "evening", "late_night"] as const).map((t) => (
                  <Badge
                    key={t}
                    variant={timePref.includes(t) ? "default" : "outline"}
                    className={`cursor-pointer px-4 py-2.5 text-sm rounded-full transition-all capitalize ${
                      timePref.includes(t) ? "bg-[#3f6f60] text-white border-[#3f6f60]" : ""
                    }`}
                    onClick={() => toggle(timePref, t, setTimePref)}
                  >
                    {t.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        </motion.div>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setDirection(-1); setStep(step - 1); }} className="flex-1 h-12 rounded-xl">
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              onClick={() => { setDirection(1); setStep(step + 1); }}
              disabled={!canNext}
              className="flex-1 h-12 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!canNext || submitMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold"
            >
              {submitMutation.isPending ? "Setting up..." : "Start Exploring"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
