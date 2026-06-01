import { cookies } from "next/headers";
import { OAuth2RequestError, ArcticFetchError } from "arctic";
import { googleClient, verifyGoogleIdToken } from "@/lib/oauth";
import { db } from "@/server/db";
import { createSession } from "@/server/lib/session-store";
import { signToken } from "@/server/middleware/auth";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from "@/server/lib/auth-cookies";
import { resolveGoogleAccount } from "@/server/services/oauth-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EPHEMERAL_COOKIES = ["g_state", "g_verifier", "g_return_to"];
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

type Jar = Awaited<ReturnType<typeof cookies>>;

function clearOauthInitCookies(jar: Jar) {
  for (const name of EPHEMERAL_COOKIES) {
    jar.set(name, "", { path: "/", maxAge: 0 });
  }
}

function appBase(): string {
  return (process.env.OAUTH_REDIRECT_BASE || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function redirect(path: string): Response {
  return Response.redirect(`${appBase()}${path}`, 302);
}

function isSafeReturnTo(raw: string | null | undefined): raw is string {
  return !!raw && raw.startsWith("/") && !raw.startsWith("//");
}

// Set the same httpOnly auth cookies the tRPC auth mutations issue, but via the
// next/headers jar (this is a plain route handler, not the tRPC adapter).
function setAuthCookiesOnJar(
  jar: Jar,
  tokens: { accessToken: string; refreshToken: string },
) {
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  const jar = await cookies();
  const cookieState = jar.get("g_state")?.value;
  const codeVerifier = jar.get("g_verifier")?.value;
  const returnTo = jar.get("g_return_to")?.value || "/home";

  if (providerError) {
    clearOauthInitCookies(jar);
    return redirect(`/login?error=access_denied`);
  }

  if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
    clearOauthInitCookies(jar);
    return redirect(`/login?error=state`);
  }

  // Exchange code for tokens (Arctic handles PKCE under the hood).
  let tokens;
  try {
    tokens = await googleClient().validateAuthorizationCode(code, codeVerifier);
  } catch (e) {
    clearOauthInitCookies(jar);
    if (e instanceof OAuth2RequestError || e instanceof ArcticFetchError) {
      return redirect(`/login?error=exchange`);
    }
    throw e;
  }

  // Verify id_token signature + iss + aud + exp.
  let claims;
  try {
    claims = await verifyGoogleIdToken(tokens.idToken());
  } catch (e) {
    clearOauthInitCookies(jar);
    console.warn("[oauth] id_token verification failed", e);
    return redirect(`/login?error=token`);
  }

  let resolution;
  try {
    resolution = await resolveGoogleAccount(db, {
      googleSub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name,
      givenName: claims.given_name,
      picture: claims.picture ?? null,
      accessTokenExpiresAtSec: Math.floor(
        tokens.accessTokenExpiresAt().getTime() / 1000,
      ),
    });
  } catch (e) {
    clearOauthInitCookies(jar);
    console.warn("[oauth] account resolution failed", e);
    return redirect(`/login?error=server`);
  }

  clearOauthInitCookies(jar);

  if (resolution.kind === "error") {
    if (resolution.code === "email_exists" && resolution.prefillEmail) {
      // Stash the email in a short-lived httpOnly cookie instead of the URL
      // so it does not leak to Referer / access logs / browser history.
      jar.set("oauth_prefill_email", resolution.prefillEmail, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60,
      });
    }
    return redirect(`/login?error=${resolution.code}`);
  }

  // Mint the session + access JWT and set httpOnly cookies directly — no more
  // /auth/complete handoff (the SPA hydrates the user store via auth.me).
  const accessToken = signToken({
    userId: resolution.userId,
    role: resolution.role,
  });
  const { refreshToken } = await createSession(db, resolution.userId, {
    userAgent: req.headers.get("user-agent"),
  });
  setAuthCookiesOnJar(jar, { accessToken, refreshToken });

  const isHostOrAdmin =
    resolution.role === "host" || resolution.role === "admin";
  let target = isHostOrAdmin ? "/host" : "/home";
  if (resolution.isNew && !isHostOrAdmin && !resolution.onboardingCompleted) {
    target = "/onboarding";
  } else if (isSafeReturnTo(returnTo)) {
    target = returnTo;
  }
  return redirect(target);
}
