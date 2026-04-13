"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAuthStore } from "@/stores/auth";
import { LogoFull } from "@/components/logo";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [user, router, hydrated]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center">
        <div className="animate-pulse"><LogoFull size="lg" /></div>
        <div className="mt-4 flex gap-1">
          <div className="w-2 h-2 bg-[#ff8c30] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-[#ff8c30] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-[#ff8c30] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-20">
      <div className="max-w-md mx-auto">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
