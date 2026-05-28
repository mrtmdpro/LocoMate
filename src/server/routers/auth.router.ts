import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashSync, compareSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { users, userProfiles } from "../db/schema";
import { signToken, signRefreshToken, verifyToken } from "../middleware/auth";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
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

    const accessToken = signToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      accessToken,
      refreshToken,
    };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
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

    const accessToken = signToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

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
      accessToken,
      refreshToken,
    };
  }),

  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const payload = verifyToken(input.refreshToken);
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, payload.userId),
        });
        if (!user || !user.isActive) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const accessToken = signToken({ userId: user.id, role: user.role });
        return { accessToken };
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh token" });
      }
    }),
});
