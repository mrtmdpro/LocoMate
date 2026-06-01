import { TRPCError } from "@trpc/server";
import { hashSync, compareSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { users, userProfiles } from "../db/schema";
import { signToken } from "../middleware/auth";
import {
  createSession,
  rotateSession,
  revokeSessionByToken,
} from "../lib/session-store";
import {
  setAuthCookies,
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
} from "../lib/auth-cookies";
import { rateLimit } from "../services/chat-ratelimit";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

// Unauthenticated auth endpoints are keyed by client IP. `anon` is the
// fallback when no x-forwarded-for is present (e.g. the in-process test
// caller), which is acceptable — those paths aren't internet-exposed.
function ipKey(ctx: { clientIp?: string | null }, scope: string): string {
  return `auth:${scope}:${ctx.clientIp ?? "anon"}`;
}

/**
 * Mint a fresh access JWT + a rotating refresh session and write both as
 * httpOnly cookies onto `ctx.resHeaders`. Tokens are NO LONGER returned in the
 * response body — the browser only ever sees them as httpOnly cookies.
 */
async function issueAuthCookies(
  ctx: {
    db: Parameters<typeof createSession>[0];
    resHeaders?: Headers;
    userAgent?: string | null;
  },
  user: { id: string; role: string },
): Promise<void> {
  const accessToken = signToken({ userId: user.id, role: user.role });
  const { refreshToken } = await createSession(ctx.db, user.id, {
    userAgent: ctx.userAgent,
  });
  if (ctx.resHeaders) {
    setAuthCookies(ctx.resHeaders, { accessToken, refreshToken });
  }
}

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
    await rateLimit({ key: ipKey(ctx, "register"), limit: 10, windowSec: 60 });
    // Lowercase email so that Google OAuth's lowercased email always collides
    // with the password-registered email in the conditional-linking check.
    // Otherwise `Victim@gmail.com` (password) and `victim@gmail.com` (OAuth)
    // coexist and the squatting mitigation can be bypassed via case-folding.
    const email = input.email.toLowerCase();
    const existing = await ctx.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
    }

    const passwordHash = hashSync(input.password, 12);
    const [user] = await ctx.db
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
      })
      .returning();

    // Hosts don't go through the traveler intent/interests onboarding --
    // their "onboarding" is the host-setup wizard + ID verification. Mark
    // the user_profiles row complete up front so login routes them straight
    // to /home instead of the traveler-only /onboarding page.
    const onboardingCompleted = user.role === "host" || user.role === "admin";
    await ctx.db.insert(userProfiles).values({ userId: user.id, onboardingCompleted });

    await issueAuthCookies(ctx, user);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    await rateLimit({ key: ipKey(ctx, "login"), limit: 10, windowSec: 60 });
    const email = input.email.toLowerCase();
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user || !user.passwordHash || !compareSync(input.password, user.passwordHash)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }
    if (!user.isActive) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account is deactivated" });
    }

    await issueAuthCookies(ctx, user);

    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, user.id),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: profile?.onboardingCompleted ?? false,
      },
    };
  }),

  /**
   * Rotate the refresh session. The opaque refresh token rides in the
   * `lm_refresh` httpOnly cookie (no body arg). On success a new access cookie
   * + rotated refresh cookie are set; on reuse/expiry the cookies are cleared
   * and the call 401s so the client bounces to /login.
   */
  refreshToken: publicProcedure.mutation(async ({ ctx }) => {
    await rateLimit({ key: ipKey(ctx, "refresh"), limit: 60, windowSec: 60 });
    const presented = readCookie(ctx.cookieHeader, REFRESH_COOKIE);
    if (!presented) {
      if (ctx.resHeaders) clearAuthCookies(ctx.resHeaders);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "No refresh session" });
    }

    const result = await rotateSession(ctx.db, presented, {
      userAgent: ctx.userAgent,
    });
    if (!result.ok) {
      if (ctx.resHeaders) clearAuthCookies(ctx.resHeaders);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh session" });
    }

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, result.userId),
    });
    if (!user || !user.isActive) {
      if (ctx.resHeaders) clearAuthCookies(ctx.resHeaders);
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const accessToken = signToken({ userId: user.id, role: user.role });
    if (ctx.resHeaders) {
      setAuthCookies(ctx.resHeaders, {
        accessToken,
        refreshToken: result.session.refreshToken,
      });
    }

    return { success: true };
  }),

  /** Revoke the current refresh session and clear both cookies. */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const presented = readCookie(ctx.cookieHeader, REFRESH_COOKIE);
    if (presented) {
      await revokeSessionByToken(ctx.db, presented);
    }
    if (ctx.resHeaders) clearAuthCookies(ctx.resHeaders);
    return { success: true };
  }),

  /**
   * Lightweight session probe used by the client to hydrate the user store.
   * Returns the authenticated user (or null). When the caller authenticated
   * via a legacy Bearer token (the localStorage upgrade shim) we silently mint
   * httpOnly cookies so the next request rides on cookies and the localStorage
   * token can be discarded.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { user: null };

    if (ctx.authSource === "bearer" && ctx.resHeaders) {
      await issueAuthCookies(ctx, ctx.user);
    }

    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.user.id),
    });

    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        displayName: ctx.user.displayName,
        role: ctx.user.role,
        avatarUrl: ctx.user.avatarUrl,
        onboardingCompleted: profile?.onboardingCompleted ?? false,
      },
    };
  }),
});
