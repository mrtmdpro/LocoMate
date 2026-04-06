"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const INTERESTS = ["Street Food", "Hidden Cafes", "Temples", "Markets", "Photography", "Rooftops", "Art", "Nightlife"];

export default function PlanPage() {
  const router = useRouter();
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

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Badge className="bg-[#ff8c30]/10 text-[#ff8c30] border-[#ff8c30]/20 mb-2">Premium AI</Badge>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-[#3f6f60]">Design Your Tour</h1>
          <p className="text-sm text-muted-foreground mt-1">AI crafts a personalized Hanoi itinerary just for you</p>
        </div>
        <img src="/images/logo.png" alt="LOCOMATE" className="h-9 shrink-0" />
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

      <Button
        onClick={() => createMutation.mutate({ date, startTime, durationHours: duration[0], budgetLevel: budget, interests, withHost, groupSize })}
        disabled={interests.length === 0 || createMutation.isPending}
        className="w-full h-14 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg"
      >
        {createMutation.isPending ? "AI is designing your tour..." : "✨ Generate My Tour"}
      </Button>
    </div>
  );
}
