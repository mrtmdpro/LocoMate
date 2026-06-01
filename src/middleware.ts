import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { isProtectedPath, verifyAccessCookie } from "@/lib/auth-gate";

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
 *
 * Cluster C adds an auth gate IN FRONT of locale negotiation: unauthenticated
 * requests to a protected (main)/(admin) route are redirected to /login before
 * next-intl runs. The access cookie is verified with `jose` (see
 * `@/lib/auth-gate`) because the Node-only `jsonwebtoken` library can't run on
 * the Edge runtime middleware uses. The same `JWT_SECRET` signs and verifies it.
 */

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isProtectedPath(pathname, routing.locales)) {
    const token = req.cookies.get("lm_access")?.value;
    if (!(await verifyAccessCookie(token))) {
      const { locale } = stripLocalePrefix(pathname);
      const url = req.nextUrl.clone();
      url.pathname = locale ? `/${locale}/login` : "/login";
      url.search = "";
      url.searchParams.set("returnTo", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(req);
}

function stripLocalePrefix(pathname: string): { locale: string | null } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && (routing.locales as readonly string[]).includes(segments[0])) {
    return { locale: segments[0] };
  }
  return { locale: null };
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|uploads|brand|.*\\..*).*)",
  ],
};
