"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
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
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 flex flex-col items-center justify-center text-white relative overflow-hidden">
      <img src="https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&h=800&fit=crop" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="text-center space-y-4">
        <Image src="/images/logo.png" alt="LOCOMATE" width={96} height={96} className="mx-auto drop-shadow-lg" priority />
        <p className="text-lg opacity-90 font-medium">Go a place, know its grace</p>
        <div className="mt-8">
          <div className="w-8 h-8 border-3 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    </div>
  );
}
