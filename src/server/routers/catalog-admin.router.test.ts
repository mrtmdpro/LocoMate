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

  test("rejects non-admin callers", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);

    await expect(caller.catalogAdmin.listPlaces()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
