"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const INTENTS = ["Relax & Recharge", "Explore Culture", "Meet New People", "Food & Drink", "Adventure"];
const INTERESTS = ["Street Food", "Hidden Cafes", "Temples", "Markets", "Photography", "Rooftops", "Art", "Nightlife"];

export default function PreferencesPage() {
  const router = useRouter();
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

  const updateMutation = trpc.user.updatePreferences.useMutation({
    onSuccess: (result) => {
      const label = (result.derived as { personalityLabel?: string })?.personalityLabel || "Updated";
      toast.success(`Preferences saved! You are: ${label}`);
      utils.user.getProfile.invalidate();
      router.push("/profile");
    },
    onError: () => toast.error("Failed to save preferences"),
  });

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

  if (!loaded) return <div className="p-4"><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  return (
    <div className="p-4 space-y-5 pb-32">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-xl font-bold font-heading text-[#3f6f60]">Edit Preferences</h1>
      </div>

      {/* Travel Intent */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#3f6f60] mb-3">What brings you to Hanoi?</h3>
          <div className="flex flex-wrap gap-2">
            {INTENTS.map((item) => (
              <Badge
                key={item}
                variant={intent.includes(item) ? "default" : "outline"}
                className={`cursor-pointer px-3.5 py-2 text-xs rounded-full transition-all ${
                  intent.includes(item) ? "bg-[#ff8c30] hover:bg-[#e67a20] text-white border-[#ff8c30]" : "hover:border-[#ff8c30]"
                }`}
                onClick={() => toggle(intent, item, setIntent, 3)}
              >
                {item}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Pick up to 3</p>
        </CardContent>
      </Card>

      {/* Style Sliders */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-6">
          <h3 className="font-semibold text-[#3f6f60]">Your travel style</h3>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#3f6f60]">Chill & Relaxed</span>
              <span className="text-[#ff8c30]">Explore & Discover</span>
            </div>
            <Slider value={chillExplore} onValueChange={(v) => setChillExplore(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-[#ff8c30]" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#3f6f60]">Plan Everything</span>
              <span className="text-[#ff8c30]">Go Spontaneous</span>
            </div>
            <Slider value={planSpontaneous} onValueChange={(v) => setPlanSpontaneous(Array.isArray(v) ? v : [v])} max={1} step={0.05} className="[&_[role=slider]]:bg-[#ff8c30]" />
          </div>
        </CardContent>
      </Card>

      {/* Interests */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#3f6f60] mb-3">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <Badge
                key={item}
                variant={interests.includes(item) ? "default" : "outline"}
                className={`cursor-pointer px-3.5 py-2 text-xs rounded-full transition-all ${
                  interests.includes(item) ? "bg-[#3f6f60] text-white border-[#3f6f60]" : "hover:border-[#3f6f60]"
                }`}
                onClick={() => toggle(interests, item, setInterests)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#3f6f60] mb-3">Daily budget</h3>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  budget === b ? "bg-[#90D26D] text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {b === "low" ? "$ Budget" : b === "medium" ? "$$ Moderate" : "$$$ Premium"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Social & Timing */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-[#3f6f60] mb-3">Travel company</h3>
            <div className="flex gap-2">
              {(["solo", "meet_new", "group"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSocialPref(s)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    socialPref === s ? "bg-[#ff8c30] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s === "solo" ? "Solo" : s === "meet_new" ? "Open" : "Group"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-[#3f6f60] mb-3">Best time to explore</h3>
            <div className="flex flex-wrap gap-2">
              {(["morning", "afternoon", "evening", "late_night"] as const).map((t) => (
                <Badge
                  key={t}
                  variant={timePref.includes(t) ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 text-xs rounded-full capitalize transition-all ${
                    timePref.includes(t) ? "bg-[#3f6f60] text-white border-[#3f6f60]" : ""
                  }`}
                  onClick={() => toggle(timePref, t, setTimePref)}
                >
                  {t.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSave}
            disabled={intent.length === 0 || interests.length === 0 || timePref.length === 0 || updateMutation.isPending}
            className="w-full h-12 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-semibold"
          >
            {updateMutation.isPending ? "Saving..." : "Save & Update Personality"}
          </Button>
        </div>
      </div>
    </div>
  );
}
