"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogoLockup, ThemeToggle } from "@/components/brand";

/**
 * Sticky header for the signed-out public marketing surface. Without this a
 * logged-out visitor who lands on /explore (or any public page) had no way to
 * reach /experiences, /hosts, /guides, /blog — the funnel leaked. The logo
 * returns to the landing page; the link row scrolls horizontally on mobile so
 * every public surface stays one tap away.
 */
const LINKS: { href: string; key: "explore" | "experiences" | "hosts" | "guides" | "blog" }[] = [
  { href: "/explore", key: "explore" },
  { href: "/experiences", key: "experiences" },
  { href: "/hosts", key: "hosts" },
  { href: "/guides", key: "guides" },
  { href: "/blog", key: "blog" },
];

export function MarketingHeader() {
  const t = useTranslations("publicShell");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 lg:px-10">
        <Link href="/" aria-label="Locomate" className="shrink-0">
          <LogoLockup size="sm" />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t(`nav.${l.key}`)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex"
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            {t("ctaButton")}
          </Link>
        </div>
      </div>
    </header>
  );
}
