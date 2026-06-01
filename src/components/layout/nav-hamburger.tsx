"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  isNavItemActive,
  pickOverflowForRole,
  type NavItem,
  type OverflowGroups,
} from "@/lib/nav";
import { useAuthStore } from "@/stores/auth";
import { serverLogout } from "@/lib/trpc-auth-link";
import { cn } from "@/lib/utils";

/**
 * The Airbnb-signature pill on the right of the top bar: a hamburger
 * icon + the user's avatar, both inside a single rounded-full button.
 * Clicking opens a popover menu containing every nav destination that
 * isn't one of the four primary feature tabs, plus a destructive
 * Sign-out action at the bottom.
 *
 * Implementation notes:
 *   - Popover is hand-rolled (no `Popover` primitive in the codebase).
 *     A wrapping div is the click-outside boundary; Escape and route
 *     changes also close it.
 *   - Same popover used at every viewport — it's anchored to the pill's
 *     right edge and capped at w-72 so it stays inside the bar's px-4
 *     gutter on small phones. Airbnb's mobile uses a full sheet; we keep
 *     the popover for parity with desktop because LOCOMATE's overflow
 *     is small enough to fit comfortably.
 *   - Sign-out is an action, not a NavItem — handled inline with the
 *     auth-store `logout` + a hard `/login` redirect.
 */
export function NavHamburger() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const groups = pickOverflowForRole(user?.role);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Pathname is stable per route — when it changes we know the user
  // navigated and the menu should go away. eslint complains that this is
  // a state-set in effect (true) but the trigger IS the pathname, so it
  // only fires on real navigation rather than every render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSignOut = async () => {
    setOpen(false);
    await serverLogout();
    logout();
    router.replace("/login");
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={t("menu.openMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 px-1.5 py-1 rounded-full border border-border bg-card transition-shadow",
          "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <span className="pl-1.5 inline-flex items-center text-foreground">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
            />
          </svg>
        </span>
        <Avatar className="w-7 h-7">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.displayName ?? ""} />
          ) : null}
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
            {(user?.displayName ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("menu.accountNav")}
          className={cn(
            "absolute right-0 top-full mt-2 w-72",
            "rounded-2xl bg-popover text-popover-foreground",
            "border border-border shadow-xl ring-1 ring-foreground/5",
            "overflow-hidden py-2 z-50",
          )}
        >
          {user ? (
            <div className="px-4 py-2 mb-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {user.displayName ?? t("menu.signedIn")}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {user.role ?? ""}
              </p>
            </div>
          ) : null}

          <NavGroup items={groups.account} pathname={pathname} />

          {groups.marketing.length > 0 ? (
            <>
              <Divider />
              <NavGroup items={groups.marketing} pathname={pathname} />
            </>
          ) : null}

          {groups.settings.length > 0 ? (
            <>
              <Divider />
              <NavGroup items={groups.settings} pathname={pathname} />
            </>
          ) : null}

          <Divider />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            {t("menu.signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── */
/*  NavGroup / Divider                                                    */
/* ───────────────────────────────────────────────────────────────────── */

function NavGroup({
  items,
  pathname,
}: {
  items: OverflowGroups["account"];
  pathname: string;
}) {
  return (
    <ul role="none" className="px-1">
      {items.map((item) => (
        <NavMenuItem key={item.href} item={item} pathname={pathname} />
      ))}
    </ul>
  );
}

function NavMenuItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const t = useTranslations("nav.tabs");
  const active = isNavItemActive(pathname, item);
  return (
    <li>
      <Link
        href={item.href}
        role="menuitem"
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          active
            ? "bg-muted text-foreground font-semibold"
            : "text-foreground hover:bg-muted/60",
        )}
      >
        {item.icon ? (
          <svg
            className={cn(
              "w-4 h-4 shrink-0",
              active ? "text-brick" : "text-muted-foreground",
            )}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
        ) : null}
        <span>{t(item.labelKey)}</span>
      </Link>
    </li>
  );
}

function Divider() {
  return <hr className="my-1 border-border" />;
}
