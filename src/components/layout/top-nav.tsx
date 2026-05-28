"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogoLockup, ThemeToggle } from "@/components/brand";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { PrimaryTabs } from "./primary-tabs";
import { NavHamburger } from "./nav-hamburger";

/**
 * The single horizontal top bar that replaced LOCOMATE's previous
 * `DesktopSidebar` + `DesktopTopBar` + `BottomNav` triumvirate. Inspired
 * by Airbnb's persistent header — three zones in one sticky row:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ [LogoLockup]  [Primary 4 tabs]   [Theme] [Hamburger ◉]  │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Behaviour:
 *   - Sticky to the top of the viewport. `bg-card/95 backdrop-blur` so
 *     content scrolls underneath without losing contrast.
 *   - Gains a soft `shadow-sm` only after the user scrolls (>4 px). The
 *     bar starts flat and lifts into elevation when there's content
 *     above to separate from — Airbnb's exact treatment.
 *   - Lockup links to /home (traveler) or /host (host / admin).
 *   - The primary tabs and hamburger components are role-aware via
 *     `pickPrimaryForRole` / `pickOverflowForRole` from lib/nav.ts.
 *
 * Padding: `px-4` on mobile, growing to `px-10` on lg. Capped to
 * `max-w-screen-2xl` so the bar doesn't grow indefinitely on huge
 * monitors and the three zones stay close to each other.
 */
export function TopNav() {
  const { user } = useAuthStore();
  const t = useTranslations("nav.topNav");
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Single rAF guard so a busy scroll handler doesn't trigger a
      // setState storm. Comparing inside the rAF keeps the actual
      // setState call gated to real transitions across the threshold.
      const next = window.scrollY > 4;
      setElevated((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const homeHref =
    user?.role === "host" || user?.role === "admin" ? "/host" : "/home";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 lg:h-16",
        "bg-card/95 backdrop-blur",
        "border-b border-border",
        "transition-shadow duration-200",
        elevated && "shadow-sm",
      )}
    >
      <div className="h-full mx-auto max-w-screen-2xl px-4 lg:px-10 flex items-center justify-between gap-2 lg:gap-4">
        <Link
          href={homeHref}
          aria-label={t("locomateHome")}
          className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <LogoLockup size="sm" />
        </Link>

        <div className="flex-1 flex justify-center min-w-0">
          <PrimaryTabs />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:inline-flex">
            <ThemeToggle />
          </div>
          <NavHamburger />
        </div>
      </div>
    </header>
  );
}
