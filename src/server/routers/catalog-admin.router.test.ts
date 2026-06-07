import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createPlace, createUser } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { places } from "@/server/db/schema";

describe("catalogAdmin.upsertPlace", () => {
  test("preserves legacy description when localized description inputs are blank", async () => {
    const admin = await createUser({ role: "admin" });
    const place = await createPlace({
      description: "Legacy seeded description",
      descriptionEn: null,
      descriptionVi: null,
      photos: ["https://example.com/seeded.jpg"],
    });
    const caller = await callerAs(admin);

    await caller.catalogAdmin.upsertPlace({
      id: place.id,
      category: place.category,
      descriptionEn: "",
      descriptionVi: "",
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      nameEn: "",
      nameVi: "",
      photos: place.photos ?? [],
    });

    const [row] = await getTestDb()
      .select()
      .from(places)
      .where(eq(places.id, place.id));
    expect(row.description).toBe("Legacy seeded description");
    expect(row.photos).toEqual(["https://example.com/seeded.jpg"]);
  });

  test("preserves existing place photos when update omits photos", async () => {
    const admin = await createUser({ role: "admin" });
    const place = await createPlace({
      photos: ["https://example.com/kept.jpg"],
    });
    const caller = await callerAs(admin);

    await caller.catalogAdmin.upsertPlace({
      id: place.id,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
    });

    const [row] = await getTestDb()
      .select()
      .from(places)
      .where(eq(places.id, place.id));
    expect(row.photos).toEqual(["https://example.com/kept.jpg"]);
  });

  test("persists inactive fixed tour and customized template drafts", async () => {
    const admin = await createUser({ role: "admin" });
    const caller = await callerAs(admin);

    const fixedTour = await caller.catalogAdmin.upsertFixedTour({
      basePriceVnd: 900_000,
      chapter: "MORNING_SHIFT",
      durationMinutes: 180,
      isActive: false,
      maxParticipants: 8,
      minParticipants: 1,
      storyScriptEn: "A complete English story for editor draft testing.",
      storyScriptVi: "Một câu chuyện tiếng Việt đầy đủ để kiểm tra bản nháp.",
      titleEn: "Draft fixed tour",
      titleVi: "Tour cố định nháp",
      tourId: "draft-tour",
      vector: [0.5, 0.5, 0.5, 0.5],
    });
    const template = await caller.catalogAdmin.upsertCustomizedTemplate({
      basePriceVnd: 600_000,
      durationMinutes: 360,
      isActive: false,
      maxParticipants: 4,
      storyEn: "A complete English custom template story for editor draft testing.",
      storyVi: "Một câu chuyện mẫu tiếng Việt đầy đủ để kiểm tra bản nháp.",
      templateId: "draft-template",
      theme: "balanced",
      titleEn: "Draft template",
      titleVi: "Mẫu nháp",
      vector: [0.5, 0.5, 0.5, 0.5],
    });

    expect(fixedTour.isActive).toBe(false);
    expect(template.isActive).toBe(false);
  });

  test("rejects non-admin callers", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);

    await expect(caller.catalogAdmin.listPlaces()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
