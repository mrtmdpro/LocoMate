"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { isNavItemActive, pickPrimaryForRole } from "@/lib/nav";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom tab bar (PWA thumb-reach ergonomics). Renders the same
 * role-aware primary nav items as the top bar's PrimaryTabs, but as a fixed
 * bottom bar with icon + label and 44px+ tap targets. Hidden on lg+, where the
 * top bar's inline tabs take over. The top bar suppresses its inline tabs on
 * mobile so the two never duplicate.
 *
 * Which 5 tabs ship is still a product decision (PRD set vs the shipped set in
 * nav.ts) — this component is deliberately tab-set-agnostic: it mirrors
 * whatever pickPrimaryForRole returns, so reconciling the set is a one-line
 * change in lib/nav.ts that flows to both surfaces.
 */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user } = useAuthStore();
  const items = pickPrimaryForRole(user?.role);
  const isHost = user?.role === "host" || user?.role === "admin";

  const { data: cartCount } = trpc.cart.getCount.useQuery(undefined, {
    enabled: !!user && !isHost,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return (
    <nav
      aria-label={t("menu.primaryNav")}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const isCart = item.href === "/cart";
          const badge = isCart && cartCount && cartCount > 0 ? cartCount : 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={t(`tabs.${item.labelKey}`)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-brick" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative inline-flex">
                  {item.iconComponent ? (
                    <item.iconComponent size={22} className="h-[22px] w-[22px]" />
                  ) : item.icon ? (
                    <svg
                      className="h-[22px] w-[22px]"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={active ? 2 : 1.8}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  ) : null}
                  {badge > 0 && (
                    <span
                      aria-label={t("menu.cartBadge", { count: badge })}
                      className="absolute -right-2 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white ring-2 ring-card"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{t(`tabs.${item.labelKey}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
