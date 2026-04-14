"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { LogoIcon, LogoWordmark } from "@/components/logo";

const AVATARS = [
  "https://randomuser.me/api/portraits/women/68.jpg",
  "https://randomuser.me/api/portraits/men/44.jpg",
  "https://randomuser.me/api/portraits/women/79.jpg",
];

export default function SplashPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) router.replace("/home");
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=900&fit=crop"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/70 z-0" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <LogoIcon className="w-16 h-16 drop-shadow-lg" />
          <LogoWordmark variant="white" className="h-9 mt-3" />
        </motion.div>

        <motion.div
          className="mt-4 px-5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-sm font-medium">Go a place, know its grace</span>
        </motion.div>
      </div>

      <div className="relative z-10 px-6 pb-10 space-y-4">
        <motion.div
          className="bg-white/15 backdrop-blur-xl rounded-2xl p-5 border border-white/20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h2 className="text-xl font-bold">Solo, not alone.</h2>
          <p className="text-sm text-white/80 mt-1">
            Discover Hanoi through local eyes.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex -space-x-2.5">
              {AVATARS.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-9 h-9 rounded-full border-2 border-white/80 object-cover"
                />
              ))}
              <div className="w-9 h-9 rounded-full bg-[#90D26D] border-2 border-white/80 flex items-center justify-center text-[10px] font-bold text-white">
                +4k
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Explorers active in Hanoi now
            </span>
          </div>
        </motion.div>

        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Button
            onClick={() => router.push("/register")}
            className="w-full py-6 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
          >
            Start Exploring
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Button>
          <Button
            onClick={() => router.push("/login")}
            variant="outline"
            className="w-full py-6 rounded-2xl border-white/30 text-white hover:bg-white/10 font-semibold text-base"
          >
            I have an account
          </Button>
          <p className="text-[10px] text-center text-white/50 pt-1">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
