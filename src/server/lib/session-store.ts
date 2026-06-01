/**
 * Server-side refresh-session store (Cluster C auth lifecycle).
 *
 * Refresh tokens are opaque random strings handed to the client in an
 * httpOnly cookie and stored HASHED (sha256) in the `sessions` table. On every
 * refresh the presented row is revoked and a replacement is issued in the same
 * `familyId` (rotation). Presenting an already-revoked token is treated as
 * theft and revokes the entire family (reuse detection).
 *
 * Framework-agnostic: only `node:crypto` + Drizzle. The caller passes the
 * request-scoped db (prod postgres-js or the PGlite test driver) so this module
 * never imports the db singleton.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { sessions } from "../db/schema";
import type * as schema from "../db/schema";

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days.

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  // 32 random bytes -> 43-char url-safe string. Opaque; never a JWT.
  return randomBytes(32).toString("base64url");
}

export interface IssuedSession {
  refreshToken: string;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
}

/**
 * Open a brand-new session family (called on login / register / OAuth). Returns
 * the raw refresh token the caller must place in the `lm_refresh` cookie — the
 * raw value is never persisted, only its hash.
 */
export async function createSession(
  db: AnyDb,
  userId: string,
  opts: { userAgent?: string | null } = {},
): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  const familyId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      familyId,
      userAgent: opts.userAgent?.slice(0, 400) ?? null,
      expiresAt,
    })
    .returning({ id: sessions.id });
  return { refreshToken, sessionId: row.id, familyId, expiresAt };
}

export type RotateResult =
  | { ok: true; userId: string; session: IssuedSession }
  | { ok: false; reason: "not_found" | "expired" | "reused" };

/**
 * Rotate a presented refresh token: revoke the presented row and issue a
 * replacement in the same family.
 *
 *  - Unknown hash            -> `not_found`.
 *  - Known but already revoked -> reuse/theft: revoke the whole family,
 *                                return `reused`.
 *  - Known, active, expired  -> revoke it, return `expired`.
 *  - Known, active, valid    -> revoke it, mint a successor, return `ok`.
 */
export async function rotateSession(
  db: AnyDb,
  presentedToken: string,
  opts: { userAgent?: string | null } = {},
): Promise<RotateResult> {
  const hash = hashRefreshToken(presentedToken);
  const existing = await db.query.sessions.findFirst({
    where: eq(sessions.refreshTokenHash, hash),
  });
  if (!existing) return { ok: false, reason: "not_found" };

  if (existing.revokedAt) {
    // Reuse of a revoked token: someone replayed an old cookie. Burn the
    // entire family so neither the attacker nor the victim can keep using it.
    await revokeFamily(db, existing.familyId);
    return { ok: false, reason: "reused" };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, existing.id));
    return { ok: false, reason: "expired" };
  }

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const [successor] = await db
    .insert(sessions)
    .values({
      userId: existing.userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      familyId: existing.familyId,
      userAgent: opts.userAgent?.slice(0, 400) ?? existing.userAgent,
      expiresAt,
    })
    .returning({ id: sessions.id });

  // Revoke the presented row only after the successor lands so a crash between
  // the two can never leave a family with no live session.
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, existing.id));

  return {
    ok: true,
    userId: existing.userId,
    session: {
      refreshToken,
      sessionId: successor.id,
      familyId: existing.familyId,
      expiresAt,
    },
  };
}

/** Revoke a single session by its presented refresh token (logout). */
export async function revokeSessionByToken(
  db: AnyDb,
  presentedToken: string,
): Promise<void> {
  const hash = hashRefreshToken(presentedToken);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.refreshTokenHash, hash), isNull(sessions.revokedAt)));
}

/** Revoke every still-live session in a family (theft response). */
export async function revokeFamily(db: AnyDb, familyId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
}
