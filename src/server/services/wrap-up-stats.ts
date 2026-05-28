/**
 * Wrap-up dashboard stats — the infographic numbers on the new stats
 * page of `/tour/[id]/wrap-up`. Mirrors the business brief's
 * "Hành trình thu nhỏ" requirement.
 *
 * Three numbers + one persona title:
 *   - totalMinutes : tour.completedAt - tour.startedAt. Null when
 *                    either timestamp is missing (the active-tour
 *                    state didn't set them — rare on a normal flow).
 *   - totalStops   : tourData.stops.length. Same number the closer
 *                    page already shows; surfaced here for a unified
 *                    stats block.
 *   - totalKm      : Sum of haversine distances between consecutive
 *                    `fixed_tour_steps` (lat, lng) pairs when the
 *                    tour is Fixed-Tour-backed. Null when:
 *                      - the tour has no fixedTourId (host-experience
 *                        or legacy algorithmic), OR
 *                      - any step is missing lat/lng (defensive).
 *                    The UI hides the km row gracefully when null.
 *   - personaAxisKey : Dominant axis from the user's saved 4-D
 *                    personality vector. Falls back to "balanced" when
 *                    the spread is small enough to not name a winner.
 *
 * Step count is intentionally NOT computed — see the plan's "stats-set"
 * decision. Inventing steps from km is dishonest; the km figure already
 * communicates the same "you walked something" payoff.
 */

import { asc, eq } from "drizzle-orm";
import { fixedTourSteps } from "../db/schema";
import type { db as PrimaryDb } from "../db";

type AnyDb = typeof PrimaryDb;

export type PersonaAxisKey =
  | "art_aesthetic"
  | "deep_history"
  | "culinary"
  | "slow_living"
  | "balanced";

export interface WrapUpStats {
  totalMinutes: number | null;
  totalStops: number;
  totalKm: number | null;
  personaAxisKey: PersonaAxisKey;
}

/**
 * Earth-radius haversine. Input lat/lng in degrees, output kilometres.
 * Same shape used by `lib/proximity-suggest` and the legacy
 * tour-engine; kept inline here so this service has no extra import
 * graph.
 */
function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface TourLike {
  fixedTourId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  tourData: unknown;
}

/**
 * Score the user's 4-D personality vector and pick the dominant axis.
 * Returns `"balanced"` when there is no vector, or when the spread
 * above the mean is too small to confidently name a winner (the
 * 0.05 floor matches the brief's "rõ rệt" / "clearly dominant" intent).
 *
 * The canonical 4-D order is the same one the Fixed-Tour cosine
 * matcher uses:
 *   [Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]
 */
function pickPersonaAxis(
  derivedData: Record<string, unknown> | null | undefined,
): PersonaAxisKey {
  const vec = (derivedData as { personalityVector?: unknown })
    ?.personalityVector;
  if (!Array.isArray(vec) || vec.length !== 4) return "balanced";
  const nums = vec.map((v) => (typeof v === "number" ? v : NaN));
  if (nums.some((n) => !Number.isFinite(n))) return "balanced";

  const mean = (nums[0] + nums[1] + nums[2] + nums[3]) / 4;
  let maxIdx = 0;
  let maxVal = nums[0];
  for (let i = 1; i < 4; i++) {
    if (nums[i] > maxVal) {
      maxVal = nums[i];
      maxIdx = i;
    }
  }
  if (maxVal - mean < 0.05) return "balanced";

  switch (maxIdx) {
    case 0:
      return "art_aesthetic";
    case 1:
      return "deep_history";
    case 2:
      return "culinary";
    case 3:
      return "slow_living";
    default:
      return "balanced";
  }
}

export async function deriveWrapUpStats(
  db: AnyDb,
  tour: TourLike,
  derivedData: Record<string, unknown> | null | undefined,
): Promise<WrapUpStats> {
  // totalMinutes — defensive against either timestamp being missing.
  let totalMinutes: number | null = null;
  if (tour.startedAt && tour.completedAt) {
    const diff = tour.completedAt.getTime() - tour.startedAt.getTime();
    totalMinutes = diff > 0 ? Math.floor(diff / 60_000) : null;
  }

  // totalStops — straight off tourData.
  const td = tour.tourData as
    | { stops?: { name?: string }[] }
    | null
    | undefined;
  const totalStops = (td?.stops ?? []).filter((s) => s?.name).length;

  // totalKm — only for Fixed-Tour-backed bookings. Host-experience and
  // legacy algorithmic tours don't carry geo so the UI hides the row.
  let totalKm: number | null = null;
  if (tour.fixedTourId) {
    const steps = await db
      .select({
        latitude: fixedTourSteps.latitude,
        longitude: fixedTourSteps.longitude,
      })
      .from(fixedTourSteps)
      .where(eq(fixedTourSteps.tourId, tour.fixedTourId))
      .orderBy(asc(fixedTourSteps.stepOrder));

    const georef = steps.filter(
      (s): s is { latitude: number; longitude: number } =>
        typeof s.latitude === "number" && typeof s.longitude === "number",
    );
    if (georef.length >= 2) {
      let km = 0;
      for (let i = 1; i < georef.length; i++) {
        km += haversineKm(
          georef[i - 1].latitude,
          georef[i - 1].longitude,
          georef[i].latitude,
          georef[i].longitude,
        );
      }
      // One decimal — `0.74 km` reads better than `0.7401234 km`.
      totalKm = Math.round(km * 10) / 10;
    }
  }

  const personaAxisKey = pickPersonaAxis(derivedData);

  return { totalMinutes, totalStops, totalKm, personaAxisKey };
}
