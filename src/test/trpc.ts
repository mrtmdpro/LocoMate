import { eq } from "drizzle-orm";
import { appRouter } from "../server/routers/_app";
import type { Context } from "../server/trpc";
import { users } from "../server/db/schema";
import { getTestDb } from "./setup";

/**
 * Build a tRPC caller bound to the PGlite test database.
 *
 * Usage:
 *   const caller = await callerAs(user);       // authenticated as `user`
 *   const caller = await callerAs(null);       // anonymous (public procedures only)
 *   const caller = await callerAs({ id: ..., role: "host" });  // shorthand
 *
 * Bypasses the HTTP layer entirely. Routes that read `ctx.user` / `ctx.db`
 * exercise the full procedure logic including middleware gates
 * (`protectedProcedure`, `hostProcedure`). Routes that import the prod `db`
 * singleton directly (currently only `tour-engine.ts`) are NOT hit by this
 * caller -- tests that need them should stub or avoid them.
 */
type UserInput =
  | null
  | { id: string; role?: string }
  | { id: string; role: string; email?: string };

async function loadUserFromDb(id: string) {
  const db = getTestDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!row) throw new Error(`Test user ${id} not found in PGlite`);
  return row;
}

// Extra context fields the HTTP layer would normally populate (Cluster C auth
// lifecycle). Tests that exercise cookie-setting / refresh / rate limiting pass
// these explicitly since the in-process caller bypasses createContext.
type CtxExtra = Pick<
  Context,
  "resHeaders" | "clientIp" | "userAgent" | "cookieHeader" | "authSource"
>;

export async function callerAs(user: UserInput, extra: CtxExtra = {}) {
  const db = getTestDb();
  let ctxUser: Context["user"] = null;
  if (user) {
    // Always re-fetch from the test DB so the caller sees the exact row shape
    // prod's `createContext` would produce (including all columns, defaults
    // applied, etc.). Avoids drift when schema gains new columns.
    ctxUser = await loadUserFromDb(user.id);
  }
  // Cast `db` through unknown because the Context type is pinned to the prod
  // postgres-js driver but our test db is the pglite driver -- both implement
  // the same Drizzle query interface. Runtime behaviour is identical for the
  // procedures we exercise.
  return appRouter.createCaller({
    user: ctxUser,
    db: db as unknown as Context["db"],
    ...extra,
  });
}

export type AppCaller = Awaited<ReturnType<typeof callerAs>>;
