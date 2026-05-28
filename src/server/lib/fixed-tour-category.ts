/**
 * Maps a Fixed Tour's MATERIAL tag set to the brand-canonical category
 * slug used by the legacy `experiences.category` schema. The mapping
 * lets downstream consumers (thank-you letter sign-offs, wrap-up
 * closer, analytics) keep one switch statement instead of two when a
 * booking can originate from either catalog.
 *
 * MATERIAL → category slug:
 *   #ThanhTao   → "thanh-tao-xu-bac"     (heritage / architecture)
 *   #HonDat     → "hon-dat-nghe-nhan"    (craft / workshops)
 *   #HuongMen   → "huong-men-nong-say"   (food / scent)
 *
 * Tours often carry multiple MATERIAL tags; we pick the first match
 * deterministically. Unmapped or empty input returns `null` so the
 * caller can fall back to its `__default__` bucket.
 */

const MATERIAL_TO_CATEGORY: Record<string, string> = {
  "#ThanhTao": "thanh-tao-xu-bac",
  "#HonDat": "hon-dat-nghe-nhan",
  "#HuongMen": "huong-men-nong-say",
};

export function materialToCategory(
  materialTags: readonly string[],
): string | null {
  for (const tag of materialTags) {
    const mapped = MATERIAL_TO_CATEGORY[tag];
    if (mapped) return mapped;
  }
  return null;
}

import { eq, and } from "drizzle-orm";
import { fixedTourTags } from "../db/schema";
import type { db as PrimaryDb } from "../db";

type AnyDb = typeof PrimaryDb;

/**
 * Database-backed convenience: returns the brand category slug for the
 * given fixed tour. Returns null when the tour has no MATERIAL tags or
 * the tour_id is unknown.
 */
export async function lookupFixedTourCategory(
  db: AnyDb,
  fixedTourId: string,
): Promise<string | null> {
  const rows = await db
    .select({ tagKey: fixedTourTags.tagKey })
    .from(fixedTourTags)
    .where(
      and(
        eq(fixedTourTags.tourId, fixedTourId),
        eq(fixedTourTags.tagClass, "MATERIAL"),
      ),
    );
  return materialToCategory(rows.map((r) => r.tagKey));
}
