"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { useAuthStore } from "@/stores/auth";

/**
 * Public layout covers routes that logged-out users are allowed to see
 * (`/explore`, `/experiences`, `/esim`, `/welcome`, etc.) Two render modes:
 *
 *   1. Signed-in (traveler or host) — full authenticated shell with the
 *      horizontal `TopNav`. Identical chrome to `(main)` so a host who
 *      lands on `/explore` still has the nav back to `/host`.
 *
 *   2. Signed-out visitor — marketing column with a "Sign up free" CTA
 *      pinned to the bottom. The new TopNav isn't appropriate here
 *      because the visitor has no avatar / no role, and the marketing
 *      hero needs the full vertical breathing room.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (user) {
    return <AuthenticatedPublicShell>{children}</AuthenticatedPublicShell>;
  }

  return <AnonymousPublicShell>{children}</AnonymousPublicShell>;
}

function AuthenticatedPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className="flex-1">
        {/* Mobile caps at 448px (single-column reading); desktop lets
            each page self-declare via `lg:max-w-6xl lg:mx-auto`. Bottom
            padding on mobile clears the fixed BottomNav. */}
        <div className="max-w-md mx-auto pb-16 lg:max-w-none lg:mx-0 lg:pb-0">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function AnonymousPublicShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("publicShell");
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <div className="max-w-md mx-auto lg:max-w-4xl lg:px-8 pb-20">
        {children}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-foreground/10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto lg:max-w-4xl flex items-center justify-between px-4 lg:px-8 py-3">
          <div>
            <p className="font-serif italic text-base text-brick">{t("ctaTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("ctaSubtitle")}</p>
          </div>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary/85 text-primary-foreground text-sm font-semibold transition-colors"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
