"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=900&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

      <div className="relative z-10 min-h-screen flex flex-col justify-end p-6 pb-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <img src="/images/logo.png" alt="LOCOMATE" className="h-16 mb-3" />
          <p className="text-white/80 text-sm font-medium mb-8">Go a place, know its grace</p>

          <div className="space-y-4 mb-8">
            {[
              { icon: "✨", title: "AI Personalized Tours", desc: "Itineraries designed around your personality" },
              { icon: "👥", title: "Social Traveler Matching", desc: "Find companions who share your vibe" },
              { icon: "💎", title: "Hidden Gem Discovery", desc: "Places only locals know about" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-lg shrink-0">{item.icon}</div>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-white/60 text-xs">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="space-y-3">
            <Button onClick={() => router.push("/register")} className="w-full h-13 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg">
              Get Started
            </Button>
            <Button onClick={() => router.push("/login")} variant="outline" className="w-full h-13 rounded-2xl border-white/30 text-white hover:bg-white/10 font-medium">
              I have an account
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
