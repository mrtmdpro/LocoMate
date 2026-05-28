import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { OAuth2RequestError, ArcticFetchError } from "arctic";
import { googleClient, verifyGoogleIdToken } from "@/lib/oauth";
import { db } from "@/server/db";
import { accounts, userProfiles, users } from "@/server/db/schema";
import { signRefreshToken, signToken } from "@/server/middleware/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDOFF_MAX_AGE = 60;
const EPHEMERAL_COOKIES = ["g_state", "g_verifier", "g_return_to"];

function clearOauthInitCookies(jar: Awaited<ReturnType<typeof cookies>>) {
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

async function signInAs(
  userId: string,
  role: string,
  opts: { isNew: boolean; returnTo: string },
): Promise<Response> {
  const accessToken = signToken({ userId, role });
  const refreshToken = signRefreshToken({ userId, role });

  const jar = await cookies();
  clearOauthInitCookies(jar);

  const isProd = process.env.NODE_ENV === "production";
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: HANDOFF_MAX_AGE,
  };
  jar.set("oauth_at", accessToken, base);
  jar.set("oauth_rt", refreshToken, base);
  jar.set("oauth_new", opts.isNew ? "1" : "0", base);
  jar.set("oauth_return_to", opts.returnTo, base);

  return redirect("/auth/complete");
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

  try {
    return await resolveAccount({
      jar,
      tokens,
      claims,
      returnTo,
    });
  } catch (e) {
    clearOauthInitCookies(jar);
    console.warn("[oauth] account resolution failed", e);
    return redirect(`/login?error=server`);
  }
}

async function resolveAccount(args: {
  jar: Awaited<ReturnType<typeof cookies>>;
  tokens: Awaited<
    ReturnType<ReturnType<typeof googleClient>["validateAuthorizationCode"]>
  >;
  claims: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
  returnTo: string;
}): Promise<Response> {
  const { jar, tokens, claims, returnTo } = args;
  const googleSub = claims.sub;
  const email = claims.email.toLowerCase();
  const emailVerified = claims.email_verified === true;

  // 1. Already linked via (provider, providerAccountId)?
  const link = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.provider, "google"),
      eq(accounts.providerAccountId, googleSub),
    ),
  });
  if (link) {
    const existing = await db.query.users.findFirst({
      where: eq(users.id, link.userId),
    });
    if (!existing || !existing.isActive) {
      clearOauthInitCookies(jar);
      return redirect(`/login?error=inactive`);
    }
    // Refresh only the timestamps. We intentionally do NOT persist Google's
    // access/refresh/id tokens at rest since we never use them (all session
    // state comes from our own JWTs). Reduces blast radius of a DB leak.
    await db
      .update(accounts)
      .set({
        expiresAt: Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000),
        tokenType: "Bearer",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.provider, "google"),
          eq(accounts.providerAccountId, googleSub),
        ),
      );
    return signInAs(existing.id, existing.role, { isNew: false, returnTo });
  }

  // 2. User exists with this email - apply conditional linking rule.
  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existingByEmail) {
    if (!existingByEmail.isActive) {
      clearOauthInitCookies(jar);
      return redirect(`/login?error=inactive`);
    }
    const bothVerified = emailVerified && existingByEmail.emailVerified === true;
    if (!bothVerified) {
      // Block: password account pre-registered, refuse to auto-merge.
      // Prevents the 2025 OAuth account-squatting attack.
      clearOauthInitCookies(jar);
      // Stash the email in a short-lived httpOnly cookie instead of the URL
      // so it does not leak to Referer / access logs / browser history.
      const isProd = process.env.NODE_ENV === "production";
      jar.set("oauth_prefill_email", email, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 60,
      });
      return redirect(`/login?error=email_exists`);
    }
    // Safe to auto-link. Intentionally store no Google tokens at rest.
    await db.insert(accounts).values({
      userId: existingByEmail.id,
      type: "oauth",
      provider: "google",
      providerAccountId: googleSub,
      expiresAt: Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000),
      tokenType: "Bearer",
      scope: "openid profile email",
    });
    return signInAs(existingByEmail.id, existingByEmail.role, {
      isNew: false,
      returnTo,
    });
  }

  // 3. Brand new user. Trust Google's email_verified claim.
  if (!emailVerified) {
    clearOauthInitCookies(jar);
    return redirect(`/login?error=unverified_google`);
  }

  const displayName =
    claims.name?.trim() ||
    claims.given_name?.trim() ||
    email.split("@")[0] ||
    "Traveler";

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash: null,
      role: "traveler",
      displayName,
      avatarUrl: claims.picture ?? null,
      emailVerified: true,
    })
    .returning();

  await db.insert(userProfiles).values({ userId: newUser.id });

  await db.insert(accounts).values({
    userId: newUser.id,
    type: "oauth",
    provider: "google",
    providerAccountId: googleSub,
    expiresAt: Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000),
    tokenType: "Bearer",
    scope: "openid profile email",
  });

  return signInAs(newUser.id, newUser.role, { isNew: true, returnTo });
}
