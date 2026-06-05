import { describe, test, expect } from "vitest";
import { eq } from "drizzle-orm";
import { callerAs } from "@/test/trpc";
import { createUser, createHost, createExperience } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { experiences } from "@/server/db/schema";
import { HOST_TOUR_PRICING } from "@/lib/pricing";

/**
 * Required fields to satisfy the publish cascade. Individual publish-negative
 * tests below perturb one field at a time so each content rule has its own
 * failing assertion.
 */
function validDraftBody() {
  return {
    title: "My 8-char+ title",
    subtitle: "A lovely subtitle",
    description: "This is a sufficiently long description with more than one hundred characters so the publish cascade does not reject it on length grounds.",
    category: "cultural",
    durationMinutes: 180,
    priceAmount: 500_000,
    maxGroupSize: 4,
    photos: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    highlights: ["Hidden temple"],
    included: ["Bottled water"],
    schedule: [{ time: "09:00", label: "Meet at Hoan Kiem Lake" }],
  };
}

describe("hostExperience.create", () => {
  test("rejects callers without host role (hostProcedure gate)", async () => {
    const traveler = await createUser({ role: "traveler" });
    const caller = await callerAs(traveler);
    await expect(
      caller.hostExperience.create({ title: "Nope" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("host can create a draft with defaults when body is empty", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    const result = await caller.hostExperience.create({});
    expect(result.authorId).toBe(user.id);
    expect(result.kind).toBe("host_custom");
    expect(result.status).toBe("draft");
    expect(result.title).toBe("Untitled experience");
  });

  test("kind is forced to host_custom regardless of storage state", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    const result = await caller.hostExperience.create({ title: "Real title" });
    expect(result.kind).toBe("host_custom");
  });
});

describe("hostExperience.update", () => {
  test("rejects non-owner (other host) with NOT_FOUND", async () => {
    const a = await createHost();
    const b = await createHost();
    const draft = await createExperience({
      authorId: a.user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(b.user);
    await expect(
      caller.hostExperience.update({ id: draft.id, title: "Malicious rename" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects edit on published experience (must archive first)", async () => {
    const { user } = await createHost();
    const published = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(user);
    await expect(
      caller.hostExperience.update({ id: published.id, title: "Rewrite" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("allows edit on draft", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);
    const result = await caller.hostExperience.update({
      id: draft.id,
      title: "Updated title that is long enough",
    });
    expect(result.title).toBe("Updated title that is long enough");
  });

  test("persists bilingual draft fields for host-authored experiences", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);

    await caller.hostExperience.update({
      id: draft.id,
      titleEn: "Old Quarter coffee walk",
      titleVi: "Dạo cà phê phố cổ",
      descriptionEn:
        "A slow English description for travelers who want to understand the morning rhythm.",
      descriptionVi:
        "Một mô tả tiếng Việt chậm rãi cho lữ khách muốn hiểu nhịp buổi sáng.",
      highlightsEn: ["Egg coffee", "Market lane"],
      highlightsVi: ["Cà phê trứng", "Ngõ chợ"],
    });

    const [row] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, draft.id));
    expect(row.titleEn).toBe("Old Quarter coffee walk");
    expect(row.titleVi).toBe("Dạo cà phê phố cổ");
    expect(row.descriptionEn).toContain("English description");
    expect(row.descriptionVi).toContain("mô tả tiếng Việt");
    expect(row.highlightsEn).toEqual(["Egg coffee", "Market lane"]);
    expect(row.highlightsVi).toEqual(["Cà phê trứng", "Ngõ chợ"]);
  });

  test("allows edit on rejected experience so host can fix and resubmit", async () => {
    const { user } = await createHost();
    const rejected = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "rejected",
    });
    const caller = await callerAs(user);
    await caller.hostExperience.update({
      id: rejected.id,
      description: "A brand-new, totally compliant description that meets the required length.",
    });
    const [row] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, rejected.id));
    expect(row.description).toContain("brand-new");
  });
});

describe("hostExperience.publish", () => {
  test("happy path: verified host publishes a valid draft", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      ...validDraftBody(),
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);

    const result = await caller.hostExperience.publish({ id: draft.id });
    expect(result.status).toBe("published");
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect(result.slug).toBe("my-8-char-title");
  });

  test("rejects unverified host with PRECONDITION_FAILED", async () => {
    const { user } = await createHost({ host: { verificationStatus: "pending" } });
    const draft = await createExperience({
      ...validDraftBody(),
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);
    await expect(
      caller.hostExperience.publish({ id: draft.id }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/verification/i),
    });
  });

  test("rejects already-published experience", async () => {
    const { user } = await createHost();
    const published = await createExperience({
      ...validDraftBody(),
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(user);
    await expect(
      caller.hostExperience.publish({ id: published.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects non-owner with NOT_FOUND", async () => {
    const a = await createHost();
    const b = await createHost();
    const draft = await createExperience({
      ...validDraftBody(),
      authorId: a.user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(b.user);
    await expect(
      caller.hostExperience.publish({ id: draft.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  describe("content rules", () => {
    test("rejects title shorter than 8 chars", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        title: "Short",
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/title/i),
      });
    });

    test("rejects description shorter than 100 chars", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        description: "Too short",
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/description/i),
      });
    });

    test("rejects fewer than 3 photos", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        photos: ["https://example.com/a.jpg"],
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/photos/i),
      });
    });

    test("rejects empty highlights", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        highlights: [],
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/highlight/i),
      });
    });

    test("rejects empty schedule", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        schedule: [],
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/stop|itinerary|schedule/i),
      });
    });

    test("rejects price below HOST_TOUR_PRICING.minPrice", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        priceAmount: HOST_TOUR_PRICING.minPrice - 1,
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/price/i),
      });
    });

    test("rejects price above HOST_TOUR_PRICING.maxPrice", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        priceAmount: HOST_TOUR_PRICING.maxPrice + 1,
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/price/i),
      });
    });

    test("rejects duration shorter than 30 minutes", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        durationMinutes: 29,
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/duration/i),
      });
    });

    test("rejects missing category", async () => {
      const { user } = await createHost();
      // Bypass Zod validation by writing directly: the server-side
      // `validateForPublish` must still reject empty category even if a prior
      // create-step slipped through.
      const draft = await createExperience({
        ...validDraftBody(),
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      await getTestDb()
        .update(experiences)
        .set({ category: "" })
        .where(eq(experiences.id, draft.id));
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/category/i),
      });
    });

    test("content-rule failures leave status at 'draft' (no partial write)", async () => {
      const { user } = await createHost();
      const draft = await createExperience({
        ...validDraftBody(),
        photos: ["https://example.com/only-one.jpg"],
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
      });
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const [row] = await getTestDb()
        .select()
        .from(experiences)
        .where(eq(experiences.id, draft.id));
      expect(row.status).toBe("draft");
      expect(row.publishedAt).toBeNull();
    });
  });

  describe("photo URL scheme refinement (security-adjacent)", () => {
    test("accepts https photo URLs", async () => {
      const { user } = await createHost();
      const caller = await callerAs(user);
      const draft = await caller.hostExperience.create({
        photos: ["https://example.com/a.jpg"],
      });
      expect(draft.photos).toEqual(["https://example.com/a.jpg"]);
    });

    test.each([
      ["javascript:alert(1)"],
      ["data:image/png;base64,xxx"],
      ["ftp://host/x.jpg"],
    ])("rejects non-http(s) URL scheme %s", async (badUrl) => {
      const { user } = await createHost();
      const caller = await callerAs(user);
      await expect(
        caller.hostExperience.create({ photos: [badUrl] }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("slug collision retry (adv-05 regression guard)", () => {
    test("publish survives pre-seeded collision by picking the next suffix", async () => {
      // Simulate the winning-race case of two concurrent publishes: one row
      // already occupies `authentic-old-quarter-walk`, so when this host's
      // publish hits the UPDATE with that slug, Postgres raises 23505, the
      // catch-block loops, findUniqueSlug returns `-2`, and publish succeeds.
      // Validates the adv-05 retry is behaviorally exercised.
      const { user } = await createHost();
      await createExperience({
        title: "Authentic Old Quarter Walk",
        slug: "authentic-old-quarter-walk",
        kind: "curated",
        status: "published",
      });
      const draft = await createExperience({
        ...validDraftBody(),
        title: "Authentic Old Quarter Walk",
        authorId: user.id,
        kind: "host_custom",
        status: "draft",
        slug: null,
      });
      const caller = await callerAs(user);
      const result = await caller.hostExperience.publish({ id: draft.id });
      expect(result.slug).toBe("authentic-old-quarter-walk-2");
    });

    test("two hosts with identical titles get distinct slugs", async () => {
      const a = await createHost();
      const b = await createHost();
      const draftA = await createExperience({
        ...validDraftBody(),
        title: "Street Food Tour Hanoi",
        authorId: a.user.id,
        kind: "host_custom",
        status: "draft",
        slug: null,
      });
      const draftB = await createExperience({
        ...validDraftBody(),
        title: "Street Food Tour Hanoi",
        authorId: b.user.id,
        kind: "host_custom",
        status: "draft",
        slug: null,
      });
      const callerA = await callerAs(a.user);
      const callerB = await callerAs(b.user);
      const pubA = await callerA.hostExperience.publish({ id: draftA.id });
      const pubB = await callerB.hostExperience.publish({ id: draftB.id });
      expect(pubA.slug).not.toBe(pubB.slug);
    });
  });

  describe("admin role (hostProcedure accepts role='admin')", () => {
    test("admin who also has an approved host profile can create + publish", async () => {
      const { user } = await createHost({ user: { role: "admin" } });
      const caller = await callerAs(user);
      const draft = await caller.hostExperience.create({
        ...validDraftBody(),
        title: "Admin operated experience",
      });
      const published = await caller.hostExperience.publish({ id: draft.id });
      expect(published.status).toBe("published");
      expect(published.authorId).toBe(user.id);
    });

    test("admin without a hostProfiles row cannot publish", async () => {
      // This mirrors the same precondition as a regular host: verification
      // is required regardless of role.
      const admin = await createUser({ role: "admin" });
      const caller = await callerAs(admin);
      const draft = await caller.hostExperience.create({
        ...validDraftBody(),
        title: "Admin without host profile",
      });
      await expect(
        caller.hostExperience.publish({ id: draft.id }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  });

  test("slug collision: two experiences with identical title get -2 suffix", async () => {
    const { user } = await createHost();
    const body = validDraftBody();
    const first = await createExperience({
      ...body,
      title: "Authentic Old Quarter Walk",
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
      slug: null,
    });
    const second = await createExperience({
      ...body,
      title: "Authentic Old Quarter Walk",
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
      slug: null,
    });

    const caller = await callerAs(user);
    const firstPub = await caller.hostExperience.publish({ id: first.id });
    const secondPub = await caller.hostExperience.publish({ id: second.id });

    expect(firstPub.slug).toBe("authentic-old-quarter-walk");
    expect(secondPub.slug).toBe("authentic-old-quarter-walk-2");
  });

  test("republish of a rejected experience clears reviewNotes", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      ...validDraftBody(),
      authorId: user.id,
      kind: "host_custom",
      status: "rejected",
      reviewNotes: "Please add more photos.",
    });
    const caller = await callerAs(user);
    const result = await caller.hostExperience.publish({ id: draft.id });
    expect(result.reviewNotes).toBeNull();
    expect(result.status).toBe("published");
  });
});

describe("hostExperience admin moderation", () => {
  test("admin can reject a host-authored listing with review notes", async () => {
    const admin = await createUser({ role: "admin" });
    const host = await createHost();
    const listing = await createExperience({
      ...validDraftBody(),
      authorId: host.user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(admin);

    const result = await caller.hostExperience.adminReject({
      id: listing.id,
      reviewNotes: "Please replace the stock photos with original images.",
    });

    expect(result.status).toBe("rejected");
    expect(result.reviewNotes).toContain("stock photos");
    const [row] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, listing.id));
    expect(row.status).toBe("rejected");
    expect(row.reviewNotes).toContain("stock photos");
  });

  test("non-admin cannot list the moderation queue", async () => {
    const { user } = await createHost();
    const caller = await callerAs(user);
    await expect(caller.hostExperience.adminListModeration()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("hostExperience.archive", () => {
  test("flips published to archived", async () => {
    const { user } = await createHost();
    const published = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(user);
    const result = await caller.hostExperience.archive({ id: published.id });
    expect(result.status).toBe("archived");
  });

  test("rejects archive on draft (nothing to take down)", async () => {
    const { user } = await createHost();
    const draft = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);
    await expect(
      caller.hostExperience.archive({ id: draft.id }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  test("rejects non-owner", async () => {
    const a = await createHost();
    const b = await createHost();
    const published = await createExperience({
      authorId: a.user.id,
      kind: "host_custom",
      status: "published",
    });
    const caller = await callerAs(b.user);
    await expect(
      caller.hostExperience.archive({ id: published.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("hostExperience.listMine", () => {
  test("returns only the caller's rows, across all statuses", async () => {
    const a = await createHost();
    const b = await createHost();
    await createExperience({ authorId: a.user.id, kind: "host_custom", status: "draft", title: "A-draft" });
    await createExperience({ authorId: a.user.id, kind: "host_custom", status: "published", title: "A-pub" });
    await createExperience({ authorId: a.user.id, kind: "host_custom", status: "archived", title: "A-arch" });
    await createExperience({ authorId: b.user.id, kind: "host_custom", status: "published", title: "B-pub" });

    const caller = await callerAs(a.user);
    const rows = await caller.hostExperience.listMine();
    const titles = rows.map((r) => r.title).sort();
    expect(titles).toEqual(["A-arch", "A-draft", "A-pub"]);
  });
});

describe("hostExperience.getById", () => {
  test("rejects non-owner", async () => {
    const a = await createHost();
    const b = await createHost();
    const row = await createExperience({
      authorId: a.user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(b.user);
    await expect(
      caller.hostExperience.getById({ id: row.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("returns own row in any status", async () => {
    const { user } = await createHost();
    const row = await createExperience({
      authorId: user.id,
      kind: "host_custom",
      status: "draft",
    });
    const caller = await callerAs(user);
    const result = await caller.hostExperience.getById({ id: row.id });
    expect(result.id).toBe(row.id);
  });
});
