"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

export default function SplashPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        router.push("/explore");
      } else {
        router.push("/login");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 flex flex-col items-center justify-center text-white">
      <div className="text-center space-y-4">
        <img src="/images/logo.png" alt="LOCOMATE" className="h-24 mx-auto drop-shadow-lg" />
        <p className="text-lg opacity-90 font-medium">Go a place, know its grace</p>
        <div className="mt-8">
          <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    </div>
  );
}
