"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export default function MatchPage() {
  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState<string>("");
  const { data, refetch } = trpc.match.getCandidates.useQuery({ limit: 10 });
  const [currentIdx, setCurrentIdx] = useState(0);

  const swipeMutation = trpc.match.swipe.useMutation({
    onSuccess: (result) => {
      if (result.matched) {
        setMatchedUser(candidates[currentIdx]?.displayName || "");
        setShowMatch(true);
      }
      setCurrentIdx((i) => i + 1);
    },
  });

  const candidates = data || [];
  const current = candidates[currentIdx];

  function handleSwipe(action: "like" | "skip") {
    if (!current) return;
    swipeMutation.mutate({ targetId: current.id, action });
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">LocoMatch</h1>
          <p className="text-sm text-muted-foreground">Find your travel companion in Hanoi</p>
        </div>
        <Image src="/images/logo.png" alt="LOCOMATE" width={36} height={36} />
      </div>

      <div className="relative h-[480px]">
        <AnimatePresence>
          {current ? (
            <SwipeCard
              key={current.id}
              user={current}
              onSwipe={handleSwipe}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-center">No more travelers nearby.<br />Check back later!</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {current && (
        <div className="flex gap-4 justify-center mt-6">
          <Button variant="outline" size="lg" className="rounded-full w-16 h-16 p-0 border-2" onClick={() => handleSwipe("skip")}>
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </Button>
          <Button size="lg" className="rounded-full w-16 h-16 p-0 bg-[#ff8c30] hover:bg-[#e67a20]" onClick={() => handleSwipe("like")}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
          </Button>
        </div>
      )}

      <Dialog open={showMatch} onOpenChange={setShowMatch}>
        <DialogContent className="text-center">
          <div className="py-6 space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl font-bold font-heading text-[#ff8c30]">It&apos;s a Match!</h2>
            <p className="text-muted-foreground">You and {matchedUser} both want to explore Hanoi!</p>
            <div className="flex gap-3 pt-4">
              <Button className="flex-1 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl" onClick={() => { setShowMatch(false); }}>
                Start Chatting
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowMatch(false)}>
                Keep Swiping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwipeCard({ user, onSwipe }: { user: Record<string, unknown>; onSwipe: (action: "like" | "skip") => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const u = user as { displayName: string; avatarUrl?: string; compatibilityScore: number; profile: Record<string, unknown> };
  const profile = (u.profile || {}) as { interests?: string[]; social_preference?: string };

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onSwipe("like");
        else if (info.offset.x < -100) onSwipe("skip");
      }}
    >
      <Card className="h-full border-0 shadow-xl overflow-hidden">
        <div className="h-56 bg-gradient-to-br from-[#3f6f60] to-[#90D26D] relative flex items-center justify-center overflow-hidden">
          {u.avatarUrl ? (
            <img src={u.avatarUrl} alt={u.displayName} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl text-white font-bold">
              {(u.displayName || "?")[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-[#3f6f60]">{u.displayName}</h3>
            <Badge className="bg-[#90D26D] text-white border-0">{u.compatibilityScore}% match</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(profile.interests || []).slice(0, 5).map((i: string) => (
              <Badge key={i} variant="outline" className="text-xs">{i}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.social_preference === "meet_new" ? "Open to meeting people" : "Solo explorer"} in Hanoi
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
