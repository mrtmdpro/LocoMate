import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import {
  fixedTours,
  fixedTourSteps,
} from "@/server/db/schema";
import { backfillFixedTourAtoms } from "@/lib/backfill-fixed-tour-atoms";

async function createFixedTour(
  tourId: string,
  opts: { minParticipants?: number; basePriceVnd?: number; steps?: Array<{ stepOrder: number; offset: number }> } = {},
) {
  const db = getTestDb();
  await db.insert(fixedTours).values({
    tourId,
    titleVi: `VI ${tourId}`,
    titleEn: `EN ${tourId}`,
    chapter: "MORNING_SHIFT",
    storyScriptVi: "Câu chuyện.",
    storyScriptEn: "Story.",
    durationMinutes: 240,
    basePriceVnd: opts.basePriceVnd ?? 1_000_000,
    vector: [0.3, 0.3, 0.2, 0.2],
    isActive: true,
    minParticipants: opts.minParticipants ?? 2,
  });
  for (const step of opts.steps ?? []) {
    await db.insert(fixedTourSteps).values({
      tourId,
      stepOrder: step.stepOrder,
      targetTimeOffset: step.offset,
      locationNameVi: `Bước ${step.stepOrder}`,
      locationNameEn: `Step ${step.stepOrder}`,
      actionLogVi: "Log VI.",
      actionLogEn: "Log EN.",
    });
  }
}

describe("fixedTour.book min-2 enforcement", () => {
  test("rejects groupSize=1 when min_participants=2 (default)", async () => {
    await createFixedTour("FT_MIN2", { steps: [{ stepOrder: 1, offset: 0 }] });
    const traveler = await createUser();
    const caller = await callerAs(traveler);

    await expect(
      caller.fixedTour.book({
        tourId: "FT_MIN2",
        date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
        startTime: "09:00",
        groupSize: 1,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("accepts groupSize=2 when min_participants=2", async () => {
    await createFixedTour("FT_MIN2_OK", { steps: [{ stepOrder: 1, offset: 0 }] });
    const traveler = await createUser();
    const caller = await callerAs(traveler);

    const res = await caller.fixedTour.book({
      tourId: "FT_MIN2_OK",
      date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
      startTime: "09:00",
      groupSize: 2,
    });
    expect(res.tourId).toBeTruthy();
  });

  test("rejects groupSize below a custom min_participants=4", async () => {
    await createFixedTour("FT_MIN4", { minParticipants: 4, steps: [{ stepOrder: 1, offset: 0 }] });
    const traveler = await createUser();
    const caller = await callerAs(traveler);

    await expect(
      caller.fixedTour.book({
        tourId: "FT_MIN4",
        date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
        startTime: "09:00",
        groupSize: 3,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("fixedTour.recipes", () => {
  test("returns one recipe per active tour with unmapped steps having activityId=null", async () => {
    await createFixedTour("FT_REC1", {
      steps: [
        { stepOrder: 1, offset: 0 },
        { stepOrder: 2, offset: 60 },
      ],
    });
    const caller = await callerAs(null);
    const result = await caller.fixedTour.recipes();
    expect(result.recipes.length).toBeGreaterThanOrEqual(1);
    const recipe = result.recipes.find((r) => r.tourId === "FT_REC1");
    expect(recipe).toBeDefined();
    expect(recipe!.steps).toHaveLength(2);
    // Without backfill, atoms are null.
    expect(recipe!.steps[0].activityId).toBeNull();
    expect(recipe!.steps[0].earliestOpenSlotId).toBeNull();
  });

  test("after backfill, steps come back with activityId + atom metadata", async () => {
    const db = getTestDb();
    await createFixedTour("FT_REC2", {
      steps: [
        { stepOrder: 1, offset: 0 },
        { stepOrder: 2, offset: 90 },
      ],
    });
    await backfillFixedTourAtoms(db);

    const caller = await callerAs(null);
    const result = await caller.fixedTour.recipes();
    const recipe = result.recipes.find((r) => r.tourId === "FT_REC2");
    expect(recipe).toBeDefined();
    for (const step of recipe!.steps) {
      expect(step.activityId).not.toBeNull();
      expect(step.atomPriceVnd).toBeGreaterThan(0);
    }
    // Slots aren't created by backfill; earliestOpenSlotId stays null
    // until `pnpm slots:topup` (or its cron) runs.
    for (const step of recipe!.steps) {
      expect(step.earliestOpenSlotId).toBeNull();
    }
  });

  test("inactive tours are excluded from recipes", async () => {
    const db = getTestDb();
    await createFixedTour("FT_REC_HIDDEN", { steps: [{ stepOrder: 1, offset: 0 }] });
    await db
      .update(fixedTours)
      .set({ isActive: false })
      .where(eq(fixedTours.tourId, "FT_REC_HIDDEN"));

    const caller = await callerAs(null);
    const result = await caller.fixedTour.recipes();
    expect(result.recipes.find((r) => r.tourId === "FT_REC_HIDDEN")).toBeUndefined();
  });

  test("recipes expose minParticipants so the UI can render the solo-escape hint", async () => {
    await createFixedTour("FT_REC_MIN", { minParticipants: 3, steps: [{ stepOrder: 1, offset: 0 }] });
    const caller = await callerAs(null);
    const result = await caller.fixedTour.recipes();
    const recipe = result.recipes.find((r) => r.tourId === "FT_REC_MIN");
    expect(recipe?.minParticipants).toBe(3);
  });
});
