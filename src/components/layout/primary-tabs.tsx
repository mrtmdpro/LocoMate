"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import {
  isNavItemActive,
  pickPrimaryForRole,
  type NavItem,
} from "@/lib/nav";
import { useAuthStore } from "@/stores/auth";
import { useFlyToCart } from "@/components/cart/fly-to-cart-context";
import { cn } from "@/lib/utils";

/**
 * The four primary feature tabs that sit in the centre of the horizontal
 * top bar. Airbnb-flavored pill treatment: rounded-full, subtle muted
 * background when active, hover-only tint when inactive. No underlines,
 * no left rails — the bar is the single source of nav signal.
 *
 * Layout:
 *   - lg and up: icon + label per tab
 *   - <lg:       icon only (label visible as aria-label / tooltip)
 *
 * The Cart tab overlays a count badge sourced from `cart.getCount` so
 * users see at a glance whether their cart is empty. Hosts don't see
 * Cart in their primary tabs and skip this query entirely.
 *
 * Active detection uses each item's `activeWhen` patterns (defined in
 * lib/nav.ts) so detail routes like `/experiences/[slug]` still light
 * up the Fixed Tour tab.
 */
export function PrimaryTabs() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const t = useTranslations("nav");
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
      className="flex items-center gap-0.5 sm:gap-1 min-w-0 overflow-x-auto scrollbar-none"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item);
        const isCart = item.href === "/cart";
        const badge = isCart && cartCount && cartCount > 0 ? cartCount : 0;
        return (
          <PrimaryTab
            key={item.href}
            item={item}
            active={active}
            badge={badge}
            label={t(`tabs.${item.labelKey}`)}
            cartBadgeAria={t("menu.cartBadge", { count: badge })}
            isCart={isCart}
          />
        );
      })}
    </nav>
  );
}

function PrimaryTab({
  item,
  active,
  badge,
  label,
  cartBadgeAria,
  isCart,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  label: string;
  cartBadgeAria: string;
  isCart: boolean;
}) {
  // The cart tab registers its `<Link>` as the fly-to-cart target and
  // bumps its icon whenever a successful add is broadcast. Non-cart
  // tabs are render-only.
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const { registerBasketRef, bumpCounter } = useFlyToCart();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isCart) return;
    return registerBasketRef(linkRef);
  }, [isCart, registerBasketRef]);

  return (
    <Link
      ref={linkRef}
      href={item.href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative inline-flex items-center gap-2 h-10 px-2.5 sm:px-3 lg:px-3.5 rounded-full transition-colors whitespace-nowrap",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/55 hover:text-foreground",
      )}
    >
      <motion.span
        key={isCart ? `bump-${bumpCounter}` : "static"}
        animate={
          isCart && bumpCounter > 0 && !reduceMotion
            ? { scale: [1, 1.25, 0.95, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.45, ease: "easeOut", times: [0, 0.4, 0.7, 1] }}
        className={cn(
          "shrink-0 inline-flex items-center justify-center transition-colors",
          active ? "text-brick" : "text-muted-foreground group-hover:text-brick",
        )}
      >
        {item.iconComponent ? (
          <item.iconComponent size={22} className="w-5 h-5" />
        ) : item.icon ? (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={active ? 2 : 1.8}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
        ) : null}
      </motion.span>
      <span className="hidden lg:inline text-sm font-medium">{label}</span>
      {badge > 0 && (
        <span
          aria-label={cartBadgeAria}
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-xs font-bold inline-flex items-center justify-center ring-2 ring-card"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
