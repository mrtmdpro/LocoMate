import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import {
  activities,
  fixedTours,
  fixedTourSteps,
  hostProfiles,
  users,
} from "@/server/db/schema";
import { slugify } from "@/lib/slugify";

/**
 * Backfill every `fixed_tour_steps` row into a first-class bookable
 * `activities` row, so the Customized Tour pool literally contains every
 * Fixed Tour atom. The recipe-guide widget on `/plan/build` then renders
 * each Fixed Tour as a sequence of clickable atoms with one-tap "Add to
 * my day" CTAs.
 *
 * Idempotent: a step that already has an `activity_id` is skipped, and
 * activities are uniquely identified by their `source_fixed_tour_step_id`
 * so a re-run is safe even if the FK column on `fixed_tour_steps` somehow
 * drifted (e.g. partial run, network drop mid-loop).
 *
 * Slots are NOT created here. The existing `topup-activity-slots` cron
 * picks up published activities with fewer than 3 future open slots and
 * inserts a rolling batch -- so the atoms become bookable on the next
 * cron run (or immediately via `pnpm slots:topup`).
 */

const CURATOR_EMAIL = "curator@locomate.app";
const CURATOR_DISPLAY_NAME = "LocoMate Curator";
const ATOM_CATEGORY = "cultural";
const ATOM_CAPACITY = 4;
const ATOM_MIN_DURATION_MINUTES = 30;

export interface BackfillResult {
  scannedTours: number;
  scannedSteps: number;
  createdAtoms: number;
  skippedExisting: number;
  curatorUserId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleClient = any;

/**
 * Find or create the system curator user. Atoms must have an `authorId`,
 * but they aren't owned by any real host -- they're brand-curated content
 * derived from the Fixed Tour catalog. Using a dedicated curator user
 * keeps host dashboards clean (real hosts don't see atom rows mixed into
 * their listings).
 */
async function ensureCuratorUser(db: DrizzleClient): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, CURATOR_EMAIL))
    .limit(1);
  if (existing[0]) return existing[0].id as string;

  // The curator has no login flow but we still need a non-null
  // passwordHash and a `host_profiles` row (atoms route through host
  // permission gates in some downstream queries). The password is set to
  // a long random string so it can never be guessed; rotating credentials
  // here later is fine since no human will ever log in as this account.
  const stubPassword = hashSync(`curator-${Date.now()}-${Math.random()}`, 4);
  const [created] = await db
    .insert(users)
    .values({
      email: CURATOR_EMAIL,
      passwordHash: stubPassword,
      role: "host",
      displayName: CURATOR_DISPLAY_NAME,
      emailVerified: true,
      isActive: true,
    })
    .returning({ id: users.id });

  await db
    .insert(hostProfiles)
    .values({
      userId: created.id as string,
      bio: "LocoMate curated atoms — derived from the Fixed Tour catalog so solo travelers can build the same itinerary on the Customized Tour.",
      languages: ["vi", "en"],
      specialties: ["curated"],
      verificationStatus: "approved",
      verifiedAt: new Date(),
      isAvailable: true,
    })
    .onConflictDoNothing();

  return created.id as string;
}

/**
 * Build the slug for an atom in a way that's stable across re-runs and
 * unique even when two tours share a step location ("Phở Cồ" exists in
 * three tours). Format: `atom-<tourId-lower>-<stepOrder>-<slugified loc>`
 * — short enough for the 250-char varchar limit, includes both axes
 * (tour + step) so it can't collide.
 */
function buildAtomSlug(tourId: string, stepOrder: number, locationEn: string): string {
  const locSlug = slugify(locationEn).slice(0, 80);
  return `atom-${tourId.toLowerCase()}-${stepOrder}-${locSlug}`;
}

/** First sentence (or first ~120 chars) of an action log as a subtitle. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const stopMatch = trimmed.match(/^[^.!?]+[.!?]/);
  const candidate = stopMatch ? stopMatch[0] : trimmed;
  return candidate.length > 280 ? candidate.slice(0, 277) + "…" : candidate;
}

/** Round to nearest 1,000 VND for clean display. */
function roundVnd(n: number): number {
  return Math.max(0, Math.round(n / 1000) * 1000);
}

export async function backfillFixedTourAtoms(db: DrizzleClient): Promise<BackfillResult> {
  const curatorUserId = await ensureCuratorUser(db);

  const tours = await db
    .select()
    .from(fixedTours)
    .where(eq(fixedTours.isActive, true));

  let scannedSteps = 0;
  let createdAtoms = 0;
  let skippedExisting = 0;

  for (const tour of tours as Array<typeof fixedTours.$inferSelect>) {
    const steps = await db
      .select()
      .from(fixedTourSteps)
      .where(eq(fixedTourSteps.tourId, tour.tourId))
      .orderBy(asc(fixedTourSteps.stepOrder));
    if (steps.length === 0) continue;

    // Cost split: each atom carries a flat share of the bundle price so
    // adding every atom in order recreates the bundle's total. Curators
    // can override individual atom prices later.
    const perStepPrice = roundVnd(tour.basePriceVnd / steps.length);

    for (let i = 0; i < steps.length; i += 1) {
      scannedSteps += 1;
      const step = steps[i] as typeof fixedTourSteps.$inferSelect;

      // Already linked → skip silently. Also skip if an activity exists
      // with this step as its source (covers a half-applied run where
      // `activities` was inserted but the step's `activity_id` update
      // was never committed).
      if (step.activityId) {
        skippedExisting += 1;
        continue;
      }
      const orphanAtom = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.sourceFixedTourStepId, step.id))
        .limit(1);
      if (orphanAtom[0]) {
        // Heal the link.
        await db
          .update(fixedTourSteps)
          .set({ activityId: orphanAtom[0].id as string })
          .where(eq(fixedTourSteps.id, step.id));
        skippedExisting += 1;
        continue;
      }

      // Duration: time until the next step's offset (or, for the last
      // step, the tour's residual duration). Floor so super-short atoms
      // still feel real to a traveler.
      const nextOffset =
        i < steps.length - 1
          ? (steps[i + 1] as typeof fixedTourSteps.$inferSelect).targetTimeOffset
          : Math.max(tour.durationMinutes, step.targetTimeOffset + 60);
      const durationMinutes = Math.max(
        ATOM_MIN_DURATION_MINUTES,
        nextOffset - step.targetTimeOffset,
      );

      const slug = buildAtomSlug(tour.tourId, step.stepOrder, step.locationNameEn);
      const subtitleVi = firstSentence(step.actionLogVi);
      const subtitleEn = firstSentence(step.actionLogEn);

      const [created] = await db
        .insert(activities)
        .values({
          authorId: curatorUserId,
          title: step.locationNameVi,
          titleVi: step.locationNameVi,
          titleEn: step.locationNameEn,
          slug,
          subtitle: subtitleVi,
          subtitleVi,
          subtitleEn,
          description: step.actionLogVi,
          descriptionVi: step.actionLogVi,
          descriptionEn: step.actionLogEn,
          category: ATOM_CATEGORY,
          priceAmount: perStepPrice,
          currency: "VND",
          durationMinutes,
          maxCapacityPerSlot: ATOM_CAPACITY,
          placeId: null,
          photos: [],
          highlights: [],
          included: [],
          requirements: [],
          guideOptional: true,
          guideAddonVnd: 100_000,
          status: "published",
          publishedAt: new Date(),
          sourceFixedTourStepId: step.id,
        })
        .returning({ id: activities.id });

      await db
        .update(fixedTourSteps)
        .set({ activityId: created.id as string })
        .where(eq(fixedTourSteps.id, step.id));

      createdAtoms += 1;
    }
  }

  // Hush the unused-imports linter: `and`, `isNull`, `sql` are reserved
  // for the orphan-healing query when we later add filter conditions.
  void and;
  void isNull;
  void sql;

  return {
    scannedTours: tours.length,
    scannedSteps,
    createdAtoms,
    skippedExisting,
    curatorUserId,
  };
}
