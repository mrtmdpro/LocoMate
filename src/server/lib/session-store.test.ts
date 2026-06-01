import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb } from "@/test/setup";
import { createUser } from "@/test/fixtures";
import { sessions } from "@/server/db/schema";
import {
  createSession,
  rotateSession,
  revokeSessionByToken,
  revokeFamily,
  hashRefreshToken,
} from "@/server/lib/session-store";

// session-store functions accept the driver-agnostic AnyDb; the PGlite test
// driver implements the same query surface.
function db() {
  return getTestDb() as unknown as Parameters<typeof createSession>[0];
}

describe("session-store", () => {
  test("createSession stores the token hashed, never the raw value", async () => {
    const user = await createUser();
    const { refreshToken, familyId } = await createSession(db(), user.id);

    const rows = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].refreshTokenHash).toBe(hashRefreshToken(refreshToken));
    expect(rows[0].refreshTokenHash).not.toBe(refreshToken);
    expect(rows[0].familyId).toBe(familyId);
    expect(rows[0].revokedAt).toBeNull();
  });

  test("rotateSession issues a new token and revokes the presented one", async () => {
    const user = await createUser();
    const first = await createSession(db(), user.id);

    const result = await rotateSession(db(), first.refreshToken);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // New token differs and shares the family.
    expect(result.session.refreshToken).not.toBe(first.refreshToken);
    expect(result.session.familyId).toBe(first.familyId);
    expect(result.userId).toBe(user.id);

    const all = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    const original = all.find(
      (r) => r.refreshTokenHash === hashRefreshToken(first.refreshToken),
    );
    const successor = all.find(
      (r) => r.refreshTokenHash === hashRefreshToken(result.session.refreshToken),
    );
    expect(original?.revokedAt).not.toBeNull();
    expect(successor?.revokedAt).toBeNull();
  });

  test("reuse detection: presenting a revoked token revokes the whole family", async () => {
    const user = await createUser();
    const first = await createSession(db(), user.id);

    // Rotate once: `first` is now revoked, `second` is live.
    const rotated = await rotateSession(db(), first.refreshToken);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    // Replay the original (revoked) token -> theft response.
    const replay = await rotateSession(db(), first.refreshToken);
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reason).toBe("reused");

    // Every session in the family is now revoked, including the live successor.
    const all = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.familyId, first.familyId));
    expect(all.every((r) => r.revokedAt !== null)).toBe(true);
  });

  test("rotateSession rejects an unknown token", async () => {
    const result = await rotateSession(db(), "not-a-real-token");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_found");
  });

  test("revokeSessionByToken revokes the matching live session (logout)", async () => {
    const user = await createUser();
    const { refreshToken } = await createSession(db(), user.id);

    await revokeSessionByToken(db(), refreshToken);

    const [row] = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hashRefreshToken(refreshToken)));
    expect(row.revokedAt).not.toBeNull();

    // A revoked session can no longer be rotated.
    const result = await rotateSession(db(), refreshToken);
    expect(result.ok).toBe(false);
  });

  test("revokeFamily revokes only live sessions in the family", async () => {
    const user = await createUser();
    const s = await createSession(db(), user.id);
    await revokeFamily(db(), s.familyId);
    const [row] = await getTestDb()
      .select()
      .from(sessions)
      .where(eq(sessions.familyId, s.familyId));
    expect(row.revokedAt).not.toBeNull();
  });
});
