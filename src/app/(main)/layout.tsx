"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAuthStore } from "@/stores/auth";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-20">
      <div className="max-w-md mx-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
