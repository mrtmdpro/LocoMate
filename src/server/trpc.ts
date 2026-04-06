import { initTRPC, TRPCError } from "@trpc/server";
import { verifyToken } from "./middleware/auth";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export type Context = {
  user: typeof users.$inferSelect | null;
  db: typeof db;
};

export async function createContext(opts: { headers: Headers }): Promise<Context> {
  const authHeader = opts.headers.get("authorization");
  let user: typeof users.$inferSelect | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      const found = await db.query.users.findFirst({
        where: eq(users.id, payload.userId),
      });
      if (found?.isActive) {
        user = found;
      }
    } catch {
      // Invalid token, user stays null
    }
  }

  return { user, db };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const hostProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "host" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Host access required" });
  }
  return next({ ctx });
});
