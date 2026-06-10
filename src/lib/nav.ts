/**
 * Shared navigation definitions. Two tiers:
 *
 *   PRIMARY  — the 4 always-visible feature tabs in the horizontal top
 *              bar. Travelers see commerce verbs (Fixed Tour, Customized
 *              Tour, Store, Cart); hosts see operator verbs (Dashboard,
 *              Listings, Earnings, Routes). 4 slots, no overflow.
 *
 *   OVERFLOW — items behind the right-side hamburger pill. Grouped into
 *              `account` (identity / my-stuff), `marketing` (catalog
 *              surfaces + reads), and `settings` (config). Sign-out is
 *              handled as an action in the hamburger UI, NOT a NavItem.
 *
 * Both tiers stay role-aware. Adding a new tab to either tier keeps
 * desktop and mobile in sync automatically since the new top bar is the
 * single nav surface for every viewport.
 */

import type { ComponentType } from "react";
import { Basket, Cyclo, Pagoda } from "@/components/brand";

export interface NavItem {
  href: string;
  /** Translation key under the `nav.tabs.*` namespace. Components consume
   *  it via `useTranslations("nav.tabs")(item.labelKey)` — kept as a key
   *  rather than the rendered string so the locale toggle can flip every
   *  tab in a single round-trip. */
  labelKey: string;
  /** Heroicons-outline SVG `d` attribute. Used by overflow items + host
   *  primary items. Either this OR `iconComponent` is required. */
  icon?: string;
  /** Brand-icon React component (Pagoda / Cyclo / Basket). Used for the
   *  traveler primary tabs so each feature wears its mascot. */
  iconComponent?: ComponentType<{ size?: number; className?: string }>;
  /** Pathname prefixes that count as "active" for this item. A trailing
   *  `$` flips to exact-match. Defaults to `[href]`. */
  activeWhen?: string[];
}

/* ───────────────────────────────────────────────────────────────────── */
/*  TRAVELER NAV                                                          */
/* ───────────────────────────────────────────────────────────────────── */

/** Primary 5 — Fixed Tour, Customized Tour, Store, Chat, Cart.
 *
 *  Store -> /store is a hub page that fans out to /shop (merch) and
 *  /esim (data plans). Cart wears the standard heroicons cart wireframe
 *  rather than the brand basket so Store and Cart read as distinct at a
 *  glance even though they share commerce semantics. Chat sits between
 *  Store and Cart so Cart keeps its conventional "last commerce action"
 *  slot and the messages bubble sits adjacent to the other commerce
 *  surfaces. Chat uses the standard Heroicons chat-bubble outline
 *  (matching the host overflow's prior Messages link) rather than a
 *  brand mascot — at 20 px the universal bubble glyph reads "chat"
 *  unambiguously to inbound travelers. */
export const TRAVELER_PRIMARY: NavItem[] = [
  {
    href: "/experiences",
    labelKey: "fixedTour",
    iconComponent: Pagoda,
    activeWhen: ["/experiences"],
  },
  {
    href: "/plan/build",
    labelKey: "customizedTour",
    iconComponent: Cyclo,
    activeWhen: ["/plan"],
  },
  {
    href: "/store",
    labelKey: "store",
    iconComponent: Basket,
    activeWhen: ["/store", "/shop", "/esim"],
  },
  {
    href: "/chat",
    labelKey: "messages",
    icon: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
    activeWhen: ["/chat"],
  },
  {
    href: "/cart",
    labelKey: "cart",
    icon: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z",
  },
];

/** Overflow groups for travelers. Sign-out is a UI action, not a route. */
export const TRAVELER_OVERFLOW = {
  account: [
    {
      href: "/home",
      labelKey: "home",
      icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
      activeWhen: ["/home"],
    },
    {
      href: "/tours",
      labelKey: "myTours",
      icon: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
      activeWhen: ["/tours", "/tour"],
    },
    {
      href: "/orders",
      labelKey: "orders",
      icon: "M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
      activeWhen: ["/orders"],
    },
    {
      href: "/profile",
      labelKey: "profile",
      icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
      activeWhen: ["/profile"],
    },
  ],
  marketing: [
    {
      href: "/explore",
      labelKey: "explore",
      icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
      activeWhen: ["/explore"],
    },
    {
      href: "/activities",
      labelKey: "activities",
      icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
      activeWhen: ["/activities"],
    },
    {
      href: "/letters",
      labelKey: "letters",
      icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
      activeWhen: ["/letters"],
    },
    {
      href: "/saved",
      labelKey: "saved",
      icon: "M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z",
      activeWhen: ["/saved"],
    },
  ],
  settings: [
    {
      href: "/settings",
      labelKey: "settings",
      icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      activeWhen: ["/settings", "/security", "/payments"],
    },
  ],
} satisfies Record<"account" | "marketing" | "settings", NavItem[]>;

/* ───────────────────────────────────────────────────────────────────── */
/*  HOST NAV                                                              */
/* ───────────────────────────────────────────────────────────────────── */

/** Primary 5 for hosts. Operator-first surfaces. Chat lands last so the
 *  workflow tabs (dashboard / listings / earnings / routes) keep their
 *  established left-to-right reading order; Chat sits next to the
 *  hamburger pill mirroring its position in the traveler bar. The
 *  /host dashboard's existing `MessagesBell` (with unread badge) stays
 *  as a contextual surface — this primary tab is its always-visible
 *  counterpart. */
export const HOST_PRIMARY: NavItem[] = [
  {
    href: "/host",
    labelKey: "dashboard",
    icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
    activeWhen: ["/host$", "/host/$", "/host/bookings"],
  },
  {
    href: "/host/experiences",
    labelKey: "listings",
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.5 21.75l-.398-1.178a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.179-.398a2.25 2.25 0 001.423-1.423l.398-1.178.398 1.178a2.25 2.25 0 001.423 1.423l1.178.398-1.178.398a2.25 2.25 0 00-1.423 1.423z",
    activeWhen: ["/host/experiences"],
  },
  {
    href: "/host/earnings",
    labelKey: "earnings",
    icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M6 20.25h12M6 3.75h12",
    activeWhen: ["/host/earnings"],
  },
  {
    href: "/host/routes",
    labelKey: "routes",
    icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z",
    activeWhen: ["/host/routes"],
  },
  {
    href: "/chat",
    labelKey: "messages",
    icon: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
    activeWhen: ["/chat"],
  },
];

/** Overflow groups for hosts. Messages used to live in `marketing` but
 *  was promoted to a primary tab (see HOST_PRIMARY above); the group is
 *  intentionally empty now and the hamburger menu skips empty groups
 *  via the `groups.marketing.length > 0` guard in nav-hamburger.tsx. */
export const HOST_OVERFLOW = {
  account: [
    {
      href: "/profile",
      labelKey: "profile",
      icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
      activeWhen: ["/profile"],
    },
  ],
  marketing: [],
  settings: [
    {
      href: "/settings",
      labelKey: "settings",
      icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      activeWhen: ["/settings"],
    },
  ],
} satisfies Record<"account" | "marketing" | "settings", NavItem[]>;

export type OverflowGroups = typeof TRAVELER_OVERFLOW;

/* ───────────────────────────────────────────────────────────────────── */
/*  Selectors + helpers                                                   */
/* ───────────────────────────────────────────────────────────────────── */

/**
 * Test whether an item is active for a given pathname. A trailing `$` on
 * an activeWhen pattern flips to exact-match semantics — keeps /host
 * (dashboard) from also lighting up the Listings tab.
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const patterns = item.activeWhen ?? [item.href];
  return patterns.some((p) => {
    if (p.endsWith("$")) return pathname === p.slice(0, -1);
    return pathname.startsWith(p);
  });
}

export function pickPrimaryForRole(role: string | null | undefined): NavItem[] {
  return role === "host" || role === "admin" ? HOST_PRIMARY : TRAVELER_PRIMARY;
}

export function pickOverflowForRole(
  role: string | null | undefined,
): OverflowGroups {
  return role === "host" || role === "admin" ? HOST_OVERFLOW : TRAVELER_OVERFLOW;
}
