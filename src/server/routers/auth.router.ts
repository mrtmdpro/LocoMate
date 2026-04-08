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
    const existing = await ctx.db.query.users.findFirst({
      where: eq(users.email, input.email),
    });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
    }

    const passwordHash = hashSync(input.password, 12);
    const [user] = await ctx.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
      })
      .returning();

    await ctx.db.insert(userProfiles).values({ userId: user.id });

    const accessToken = signToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      accessToken,
      refreshToken,
    };
  }),

  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.email, input.email),
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
