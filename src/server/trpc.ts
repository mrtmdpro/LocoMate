import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { verifyToken } from "./middleware/auth";
import { db } from "./db";
import { users } from "./db/schema";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import { ACCESS_COOKIE, readCookie } from "./lib/auth-cookies";

// How the request authenticated. `bearer` flags a legacy localStorage token
// (or native fetch) so auth.me can silently upgrade the caller to httpOnly
// cookies during the Cluster C transition.
export type AuthSource = "cookie" | "bearer" | null;

export type Context = {
  user: typeof users.$inferSelect | null;
  db: typeof db;
  // The fetch adapter's response headers; auth mutations append Set-Cookie
  // here. Undefined for the in-process test caller (which bypasses HTTP).
  resHeaders?: Headers;
  // Client IP (from x-forwarded-for) for IP-keyed rate limiting.
  clientIp?: string | null;
  // User-Agent string recorded on new sessions (auth mutations).
  userAgent?: string | null;
  // Raw Cookie header so auth procedures can read the path-scoped lm_refresh
  // cookie (createContext only decodes the access cookie itself).
  cookieHeader?: string | null;
  authSource?: AuthSource;
};

function firstForwardedIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (!xff) return headers.get("x-real-ip");
  return xff.split(",")[0]?.trim() || null;
}

export async function createContext(opts: {
  headers: Headers;
  resHeaders?: Headers;
}): Promise<Context> {
  // Prefer the httpOnly access cookie; fall back to the Authorization header
  // so native fetch callers and the legacy-localStorage upgrade shim keep
  // working through the cutover.
  const cookieToken = readCookie(opts.headers.get("cookie"), ACCESS_COOKIE);
  const authHeader = opts.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = cookieToken ?? bearerToken;
  const authSource: AuthSource = cookieToken
    ? "cookie"
    : bearerToken
      ? "bearer"
      : null;

  let user: typeof users.$inferSelect | null = null;
  if (token) {
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

  return {
    user,
    db,
    resHeaders: opts.resHeaders,
    clientIp: firstForwardedIp(opts.headers),
    userAgent: opts.headers.get("user-agent"),
    cookieHeader: opts.headers.get("cookie"),
    authSource: user ? authSource : null,
  };
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

/**
 * Admin-only procedure. Used by the merch CMS and (future) moderation UI.
 * Mounted above `protectedProcedure` so the ctx.user narrowing from the
 * parent middleware still applies.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

/**
 * Builds a protected procedure that loads a row by an input id field, asserts
 * the caller owns it, and injects the row into `ctx.ownedRow`. Closes the
 * class of "operate on any id" IDORs (Critical #1).
 *
 *  - `table`    the Drizzle table to load from (by its `id` primary key).
 *  - `idField`  the input field carrying the row id (e.g. `"matchId"`).
 *  - `ownerColumns` the JS column names compared against `ctx.user.id`;
 *    ownership passes if ANY is equal (defaults to `["userId"]`; pass both
 *    sides for symmetric tables like `matches`).
 *
 * Missing row -> NOT_FOUND. Owned by someone else -> FORBIDDEN.
 */
export function protectedOwnedProcedure<TTable extends PgTable>(
  table: TTable,
  idField: string,
  opts: { ownerColumns?: string[] } = {},
) {
  const ownerColumns = opts.ownerColumns ?? ["userId"];
  return protectedProcedure
    .input(z.object({ [idField]: z.string().uuid() }))
    .use(async ({ ctx, input, next }) => {
      const columns = getTableColumns(table) as Record<string, AnyPgColumn>;
      const idColumn = columns.id;
      if (!idColumn) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "protectedOwnedProcedure requires a table with an `id` column",
        });
      }
      const rowId = (input as Record<string, unknown>)[idField];
      // `.from(table)` on a generic `PgTable` trips Drizzle's empty-selection
      // type guard, so we erase to a concrete table type for the query; the
      // real table is passed at runtime and the row is re-typed below.
      const found = await ctx.db
        .select()
        .from(table as unknown as typeof users)
        .where(eq(idColumn, rowId as string))
        .limit(1);
      const row = found[0] as unknown as TTable["$inferSelect"] | undefined;
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const owned = ownerColumns.some((col) => {
        const value = (row as Record<string, unknown>)[col];
        return value != null && value === ctx.user.id;
      });
      if (!owned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not yours" });
      }
      return next({ ctx: { ...ctx, ownedRow: row } });
    });
}
