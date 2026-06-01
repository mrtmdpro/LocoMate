/**
 * Google OAuth account resolution (Cluster C — extracted from the route
 * handler so the handler stays thin: resolve -> set cookies -> redirect).
 *
 * Pure account logic: given verified Google id_token claims, decide whether to
 * sign the user in (linked / auto-linked / freshly created) or reject with an
 * error code. Performs the necessary `accounts` / `users` / `user_profiles`
 * writes but NEVER touches cookies — the caller owns the session + redirect.
 */
import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { accounts, userProfiles, users } from "../db/schema";
import type * as schema from "../db/schema";

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface GoogleAccountInput {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  picture?: string | null;
  accessTokenExpiresAtSec: number;
}

export type OAuthResolution =
  | {
      kind: "signin";
      userId: string;
      role: string;
      isNew: boolean;
      onboardingCompleted: boolean;
    }
  | { kind: "error"; code: string; prefillEmail?: string };

export async function resolveGoogleAccount(
  db: AnyDb,
  input: GoogleAccountInput,
): Promise<OAuthResolution> {
  const googleSub = input.googleSub;
  const email = input.email.toLowerCase();
  const emailVerified = input.emailVerified === true;

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
      return { kind: "error", code: "inactive" };
    }
    // Refresh only the timestamps. We intentionally do NOT persist Google's
    // access/refresh/id tokens at rest since we never use them. Reduces the
    // blast radius of a DB leak.
    await db
      .update(accounts)
      .set({
        expiresAt: input.accessTokenExpiresAtSec,
        tokenType: "Bearer",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accounts.provider, "google"),
          eq(accounts.providerAccountId, googleSub),
        ),
      );
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, existing.id),
    });
    return {
      kind: "signin",
      userId: existing.id,
      role: existing.role,
      isNew: false,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
    };
  }

  // 2. User exists with this email — apply the conditional-linking rule.
  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existingByEmail) {
    if (!existingByEmail.isActive) {
      return { kind: "error", code: "inactive" };
    }
    const bothVerified = emailVerified && existingByEmail.emailVerified === true;
    if (!bothVerified) {
      // Block: password account pre-registered, refuse to auto-merge.
      // Prevents the 2025 OAuth account-squatting attack.
      return { kind: "error", code: "email_exists", prefillEmail: email };
    }
    // Safe to auto-link. Intentionally store no Google tokens at rest.
    await db.insert(accounts).values({
      userId: existingByEmail.id,
      type: "oauth",
      provider: "google",
      providerAccountId: googleSub,
      expiresAt: input.accessTokenExpiresAtSec,
      tokenType: "Bearer",
      scope: "openid profile email",
    });
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, existingByEmail.id),
    });
    return {
      kind: "signin",
      userId: existingByEmail.id,
      role: existingByEmail.role,
      isNew: false,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
    };
  }

  // 3. Brand new user. Trust Google's email_verified claim.
  if (!emailVerified) {
    return { kind: "error", code: "unverified_google" };
  }

  const displayName =
    input.name?.trim() ||
    input.givenName?.trim() ||
    email.split("@")[0] ||
    "Traveler";

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash: null,
      role: "traveler",
      displayName,
      avatarUrl: input.picture ?? null,
      emailVerified: true,
    })
    .returning();

  await db.insert(userProfiles).values({ userId: newUser.id });

  await db.insert(accounts).values({
    userId: newUser.id,
    type: "oauth",
    provider: "google",
    providerAccountId: googleSub,
    expiresAt: input.accessTokenExpiresAtSec,
    tokenType: "Bearer",
    scope: "openid profile email",
  });

  return {
    kind: "signin",
    userId: newUser.id,
    role: newUser.role,
    isNew: true,
    onboardingCompleted: false,
  };
}
