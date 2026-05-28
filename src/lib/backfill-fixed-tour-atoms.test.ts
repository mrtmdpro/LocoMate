import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb } from "@/test/setup";
import {
  fixedTours,
  fixedTourSteps,
  activities,
  users,
} from "@/server/db/schema";
import { backfillFixedTourAtoms } from "./backfill-fixed-tour-atoms";

async function createFixedTour(
  tourId: string,
  steps: Array<{ stepOrder: number; offset: number; nameVi: string; nameEn: string; logVi: string; logEn: string }>,
  opts: { basePriceVnd?: number; durationMinutes?: number } = {},
) {
  const db = getTestDb();
  await db.insert(fixedTours).values({
    tourId,
    titleVi: `Test ${tourId}`,
    titleEn: `Test ${tourId}`,
    chapter: "MORNING_SHIFT",
    storyScriptVi: "Câu chuyện thử nghiệm.",
    storyScriptEn: "Test story.",
    durationMinutes: opts.durationMinutes ?? 240,
    basePriceVnd: opts.basePriceVnd ?? 900_000,
    vector: [0.3, 0.3, 0.2, 0.2],
    isActive: true,
  });
  for (const step of steps) {
    await db.insert(fixedTourSteps).values({
      tourId,
      stepOrder: step.stepOrder,
      targetTimeOffset: step.offset,
      locationNameVi: step.nameVi,
      locationNameEn: step.nameEn,
      actionLogVi: step.logVi,
      actionLogEn: step.logEn,
    });
  }
}

describe("backfillFixedTourAtoms", () => {
  test("mints one activity per step, links FK both ways, prices = base/steps", async () => {
    const db = getTestDb();
    await createFixedTour("TEST_M1", [
      { stepOrder: 1, offset: 0, nameVi: "Bước 1", nameEn: "Step 1", logVi: "Log VI 1. Câu hai.", logEn: "Log EN 1. Sentence two." },
      { stepOrder: 2, offset: 90, nameVi: "Bước 2", nameEn: "Step 2", logVi: "Log VI 2.", logEn: "Log EN 2." },
      { stepOrder: 3, offset: 180, nameVi: "Bước 3", nameEn: "Step 3", logVi: "Log VI 3.", logEn: "Log EN 3." },
    ], { basePriceVnd: 900_000, durationMinutes: 240 });

    const result = await backfillFixedTourAtoms(db);
    expect(result.scannedSteps).toBe(3);
    expect(result.createdAtoms).toBe(3);
    expect(result.skippedExisting).toBe(0);

    const atomRows = await db
      .select()
      .from(activities)
      .where(eq(activities.authorId, result.curatorUserId));
    expect(atomRows).toHaveLength(3);

    // Every atom carries the source FK.
    for (const atom of atomRows) {
      expect(atom.sourceFixedTourStepId).not.toBeNull();
      expect(atom.status).toBe("published");
      expect(atom.priceAmount).toBe(300_000); // 900_000 / 3 rounded to 1000s
    }

    // The reverse FK on the step has been updated.
    const stepRows = await db
      .select()
      .from(fixedTourSteps)
      .where(eq(fixedTourSteps.tourId, "TEST_M1"));
    for (const step of stepRows) {
      expect(step.activityId).not.toBeNull();
    }
  });

  test("second run is a no-op (idempotent)", async () => {
    const db = getTestDb();
    await createFixedTour("TEST_M2", [
      { stepOrder: 1, offset: 0, nameVi: "Bước A", nameEn: "Step A", logVi: "A.", logEn: "A." },
      { stepOrder: 2, offset: 60, nameVi: "Bước B", nameEn: "Step B", logVi: "B.", logEn: "B." },
    ]);

    const first = await backfillFixedTourAtoms(db);
    expect(first.createdAtoms).toBe(2);

    const second = await backfillFixedTourAtoms(db);
    expect(second.createdAtoms).toBe(0);
    expect(second.skippedExisting).toBe(2);

    const atomRows = await db.select().from(activities);
    expect(atomRows).toHaveLength(2);
  });

  test("heals orphan atoms (activity exists but step's FK was never written)", async () => {
    const db = getTestDb();
    await createFixedTour("TEST_M3", [
      { stepOrder: 1, offset: 0, nameVi: "Bước X", nameEn: "Step X", logVi: "X.", logEn: "X." },
    ]);

    // Simulate a half-applied run: insert the atom but skip the step
    // FK update (the real backfill always updates both, but a crash
    // mid-loop could leave an orphan).
    const [step] = await db
      .select()
      .from(fixedTourSteps)
      .where(eq(fixedTourSteps.tourId, "TEST_M3"));

    // Need a curator user first.
    const first = await backfillFixedTourAtoms(db);
    const curatorId = first.curatorUserId;

    // Reset the link so we can re-run and exercise the heal branch.
    await db
      .update(fixedTourSteps)
      .set({ activityId: null })
      .where(eq(fixedTourSteps.id, step.id));

    const healed = await backfillFixedTourAtoms(db);
    expect(healed.createdAtoms).toBe(0);
    expect(healed.skippedExisting).toBeGreaterThanOrEqual(1);

    const [refreshed] = await db
      .select()
      .from(fixedTourSteps)
      .where(eq(fixedTourSteps.id, step.id));
    expect(refreshed.activityId).not.toBeNull();

    // Curator user is the same on re-run.
    const curators = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "curator@locomate.app"));
    expect(curators).toHaveLength(1);
    expect(curators[0].id).toBe(curatorId);
  });

  test("inactive (is_active=false) tours are skipped", async () => {
    const db = getTestDb();
    await createFixedTour("TEST_INACTIVE", [
      { stepOrder: 1, offset: 0, nameVi: "Ẩn", nameEn: "Hidden", logVi: "h.", logEn: "h." },
    ]);
    await db
      .update(fixedTours)
      .set({ isActive: false })
      .where(eq(fixedTours.tourId, "TEST_INACTIVE"));

    const result = await backfillFixedTourAtoms(db);
    expect(result.scannedTours).toBe(0);
    expect(result.createdAtoms).toBe(0);
  });

  test("atom title/subtitle/description carry bilingual content from the step", async () => {
    const db = getTestDb();
    await createFixedTour("TEST_BILI", [
      {
        stepOrder: 1,
        offset: 0,
        nameVi: "Chợ hoa đêm",
        nameEn: "Night Flower Market",
        logVi: "Một câu mở đầu. Câu thứ hai dài hơn.",
        logEn: "An opening sentence. A longer second sentence.",
      },
    ]);

    await backfillFixedTourAtoms(db);
    const [atom] = await db.select().from(activities);

    expect(atom.titleVi).toBe("Chợ hoa đêm");
    expect(atom.titleEn).toBe("Night Flower Market");
    // First-sentence subtitles.
    expect(atom.subtitleVi).toBe("Một câu mở đầu.");
    expect(atom.subtitleEn).toBe("An opening sentence.");
    // Full description carries the entire action log.
    expect(atom.descriptionVi).toContain("Câu thứ hai");
    expect(atom.descriptionEn).toContain("longer second");
  });
});
