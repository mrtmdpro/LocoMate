"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-md mx-auto pb-20">
        {children}
      </div>

      {user ? (
        <BottomNav />
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#3f6f60]">Discover your Hanoi</p>
              <p className="text-[10px] text-muted-foreground">Create a free account for personalized tours</p>
            </div>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl bg-[#ff8c30] hover:bg-[#e67a20] text-white text-sm font-bold shadow-sm"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
