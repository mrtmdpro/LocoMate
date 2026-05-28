"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { useAuthStore } from "@/stores/auth";
import { LogoLockup } from "@/components/brand";

/**
 * Authenticated shell. One persistent horizontal `TopNav` at the very top
 * of the viewport on every breakpoint — sidebars and bottom-nav are
 * retired. Each page under `(main)` is responsible for its own content
 * container (padding + max-w). The shell's job is just to mount the bar
 * and gate access on auth.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [user, router, hydrated]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-pulse"><LogoLockup size="lg" /></div>
        <div className="mt-4 flex gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className="flex-1">
        {/* Mobile centers narrow content in a 448px column; desktop lets
            each page declare its own width via `lg:max-w-*`. */}
        <div className="max-w-md mx-auto lg:max-w-none lg:mx-0">
          {children}
        </div>
      </main>
    </div>
  );
}
