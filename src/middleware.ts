import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale negotiation runs on every page request. The matcher excludes:
 *
 *   - `/api/*`   — tRPC + REST endpoints; locale lives in cookies, not paths.
 *   - `/_next/*` — Next.js framework assets.
 *   - `/_vercel` — Vercel infrastructure pings.
 *   - Static files with a literal extension (`.svg`, `.png`, `.woff2`, ...).
 *   - `/uploads/*`, `/brand/*` — public asset folders, never localised.
 *
 * Anything else (`/`, `/home`, `/host`, `/explore`, ...) goes through
 * next-intl which:
 *   1. Reads the existing locale prefix or cookie / Accept-Language.
 *   2. Rewrites the URL so React Server Components see the locale param.
 *   3. Updates the `NEXT_LOCALE` cookie if the user crossed a locale.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|uploads|brand|.*\\..*).*)",
  ],
};
