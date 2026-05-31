import { eq } from "drizzle-orm";
import { userProfiles } from "../db/schema";
import { readDerivedData } from "./profile-shape";
import type { db as PrimaryDb } from "../db";

/**
 * Reads the signed-in user's 4-D personality vector from
 * `user_profiles.derived_data`. Returns null when the user is anonymous
 * or has not completed the quiz yet (no valid 4-number vector) — the
 * consumer should fall back to a default order in that case.
 *
 * Consolidated from the previously duplicated copies in
 * `fixedTour.router.ts` and `customizedTourTemplate.router.ts`.
 */
export async function getUserVector(ctx: {
  db: typeof PrimaryDb;
  user: { id: string } | null;
}): Promise<number[] | null> {
  if (!ctx.user) return null;
  const profile = await ctx.db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, ctx.user.id),
  });
  return readDerivedData(profile?.derivedData).personalityVector ?? null;
}
