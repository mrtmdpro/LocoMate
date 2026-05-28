import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware re-exports of next/navigation primitives. The rest of the
 * app should `import { Link, useRouter, usePathname, redirect } from
 * "@/i18n/navigation"` for *internal* navigation so URLs auto-prefix the
 * active locale (or strip it for the default locale per `localePrefix:
 * "as-needed"`).
 *
 * External links (mailto, tel, third-party hrefs) keep using `next/link`
 * directly because next-intl's wrapper only routes known internal paths.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
