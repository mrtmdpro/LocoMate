"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { LogoFull } from "@/components/logo";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";

const INTERESTS = ["Street Food", "Hidden Cafes", "Temples", "Markets", "Photography", "Rooftops", "Art", "Nightlife"];

export default function PlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const withMatchId = searchParams.get("with");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState([3]);
  const [budget, setBudget] = useState<"low" | "medium" | "high">("medium");
  const [interests, setInterests] = useState<string[]>(["Street Food", "Temples"]);
  const [withHost, setWithHost] = useState(false);
  const [groupSize, setGroupSize] = useState(1);

  const createMutation = trpc.tour.create.useMutation({
    onSuccess: (tour) => {
      router.push(`/tour/${tour.id}/preview`);
    },
  });

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Fetch match companion info if planning together
  const { data: matchData } = trpc.match.getMatches.useQuery(undefined, { enabled: !!withMatchId });
  const companion = withMatchId ? matchData?.find((m) => m.id === withMatchId)?.otherUser : null;

  return (
    <div className="p-4 space-y-6">
      {companion && (
        <Card className="border-[#90D26D]/30 bg-[#D9EDBF]/20">
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="w-10 h-10">
              {companion.avatarUrl && <AvatarImage src={companion.avatarUrl} alt={companion.displayName} />}
              <AvatarFallback className="bg-[#3f6f60] text-white text-sm font-bold">{(companion.displayName || "?")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#3f6f60]">Planning with {companion.displayName}</p>
              <p className="text-[10px] text-muted-foreground">Tour will be designed for both of your preferences</p>
            </div>
            <Badge className="bg-[#90D26D] text-white border-0 text-[10px]">Duo</Badge>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start justify-between">
        <div>
          <Badge className="bg-[#ff8c30]/10 text-[#ff8c30] border-[#ff8c30]/20 mb-2">Premium AI</Badge>
          <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">Design Your Tour</h1>
          <p className="text-sm text-muted-foreground mt-1">{companion ? `AI crafts a tour for you and ${companion.displayName.split(" ")[0]}` : "AI crafts a personalized Hanoi itinerary just for you"}</p>
        </div>
        <LogoFull size="sm" />
      </div>

      {/* Date & Time */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold text-[#3f6f60]">When</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Start time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duration */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-[#3f6f60]">Duration</h3>
            <span className="text-lg font-bold text-[#ff8c30]">{duration[0]}h</span>
          </div>
          <Slider value={duration} onValueChange={(v) => setDuration(Array.isArray(v) ? v : [v])} min={2} max={6} step={0.5} className="[&_[role=slider]]:bg-[#ff8c30]" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2 hours</span><span>6 hours</span>
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-[#3f6f60]">Budget</h3>
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

      {/* Interests */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-[#3f6f60]">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <Badge
                key={item}
                variant={interests.includes(item) ? "default" : "outline"}
                className={`cursor-pointer px-3.5 py-2 text-xs rounded-full transition-all ${
                  interests.includes(item) ? "bg-[#3f6f60] text-white border-[#3f6f60]" : "hover:border-[#3f6f60]"
                }`}
                onClick={() => toggleInterest(item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Group & Host */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#3f6f60]">Group size</h3>
              <p className="text-xs text-muted-foreground">Solo or small group</p>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setGroupSize(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${
                    groupSize === n ? "bg-[#ff8c30] text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <h3 className="font-semibold text-[#3f6f60]">Add a local host</h3>
              <p className="text-xs text-muted-foreground">A verified Hanoi insider guides you</p>
            </div>
            <Switch checked={withHost} onCheckedChange={setWithHost} />
          </div>
        </CardContent>
      </Card>

      {/* Summary & CTA */}
      <Card className="border-[#ff8c30]/20 bg-gradient-to-r from-[#ff8c30]/5 to-[#D9EDBF]/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{duration[0]}h &middot; {groupSize === 1 ? "Solo" : `${groupSize} people`} &middot; {withHost ? "With Host" : "Self-guided"}</span>
            <span className="font-bold text-[#3f6f60]">
              from {withHost ? (groupSize > 1 ? "1,000,000" : "750,000") : "250,000"} VND
            </span>
          </div>
        </CardContent>
      </Card>

      <motion.div whileTap={{ scale: 0.97 }}>
        <Button
          onClick={() => createMutation.mutate({ date, startTime, durationHours: duration[0], budgetLevel: budget, interests, withHost, groupSize })}
          disabled={interests.length === 0 || createMutation.isPending}
          className="w-full h-14 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg"
        >
          {createMutation.isPending ? "AI is designing your tour..." : "Generate My Tour"}
        </Button>
      </motion.div>

      <AnimatePresence>
        {createMutation.isPending && <TourGeneratingOverlay />}
      </AnimatePresence>
    </div>
  );
}

function TourGeneratingOverlay() {
  const phrases = ["Analyzing your preferences...", "Finding hidden gems...", "Optimizing your route...", "Crafting insider tips...", "Almost ready..."];
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center"
    >
      <motion.div
        className="mb-6"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <LogoFull size="lg" />
      </motion.div>
      <div className="flex gap-1.5 mb-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 bg-[#ff8c30] rounded-full"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={phraseIdx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-sm text-[#3f6f60] font-medium"
        >
          {phrases[phraseIdx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
