import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  buildLoginRedirectTarget,
  isProtectedPath,
  verifyAccessCookie,
} from "@/lib/auth-gate";

/**
 * Locale negotiation runs on every page request. The matcher excludes:
 *
 *   - `/api/*`   - tRPC + REST endpoints; locale lives in cookies, not paths.
 *   - `/_next/*` - Next.js framework assets.
 *   - `/_vercel` - Vercel infrastructure pings.
 *   - Static files with a literal extension (`.svg`, `.png`, `.woff2`, ...).
 *   - `/uploads/*`, `/brand/*` - public asset folders, never localized.
 *
 * Anything else (`/`, `/home`, `/host`, `/explore`, ...) goes through
 * next-intl which negotiates the locale and rewrites the URL for App Router.
 *
 * The auth gate runs before locale negotiation: unauthenticated requests to a
 * protected `(main)` or admin route redirect to the locale-aware login page.
 * Route handlers and tRPC procedures still enforce authorization themselves;
 * proxy is a traffic gate, not the only auth boundary.
 */

const intlProxy = createMiddleware(routing);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isProtectedPath(pathname, routing.locales)) {
    const token = req.cookies.get("lm_access")?.value;
    if (!(await verifyAccessCookie(token))) {
      const target = buildLoginRedirectTarget(pathname, search, routing.locales);
      const url = req.nextUrl.clone();
      url.pathname = target.pathname;
      url.search = "";
      url.searchParams.set("returnTo", target.returnTo);
      return NextResponse.redirect(url);
    }
  }

  return intlProxy(req);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|uploads|brand|.*\\..*).*)",
  ],
};
