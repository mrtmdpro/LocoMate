import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { router, hostProcedure } from "../trpc";
import { experiences, hostProfiles } from "../db/schema";
import { slugify } from "@/lib/slugify";
import { isValidHostTourPrice, HOST_TOUR_PRICING } from "@/lib/pricing";

// Shape of the editable experience fields. All optional on `update` so hosts
// can save partial drafts from any wizard step. `create` pins the bare
// minimum required to insert a valid row; everything else defaults.
const experienceDraftSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(50).optional(),
  durationMinutes: z.number().int().min(15).max(24 * 60).optional(),
  priceAmount: z.number().int().min(0).optional(),
  maxGroupSize: z.number().int().min(1).max(20).optional(),
  // http(s): only. z.string().url() accepts javascript:, data:, ftp: which
  // could be abused by any downstream code that renders photos as links or
  // fetches them server-side.
  photos: z
    .array(
      z
        .string()
        .url()
        .refine((u) => /^https?:\/\//i.test(u), "Photo URL must start with http(s)://"),
    )
    .max(10)
    .optional(),
  highlights: z.array(z.string().min(1).max(200)).max(10).optional(),
  included: z.array(z.string().min(1).max(200)).max(20).optional(),
  schedule: z
    .array(
      z.object({
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        label: z.string().min(1).max(300),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * Content rules enforced server-side at publish time. These are the real
 * source of truth; client-side rules in the wizard are UX sugar only.
 * Returns null if valid; otherwise the human-readable reason.
 */
function validateForPublish(exp: {
  title: string | null;
  description: string | null;
  category: string | null;
  photos: string[] | null;
  highlights: unknown;
  schedule: unknown;
  priceAmount: number | null;
  durationMinutes: number | null;
}): string | null {
  if (!exp.title || exp.title.trim().length < 8) {
    return "Title must be at least 8 characters.";
  }
  if (!exp.category) {
    return "Category is required.";
  }
  if (!exp.description || exp.description.trim().length < 100) {
    return "Description must be at least 100 characters.";
  }
  if (!exp.durationMinutes || exp.durationMinutes < 30) {
    return "Duration must be at least 30 minutes.";
  }
  const photos = exp.photos ?? [];
  if (photos.length < 3) {
    return "At least 3 photos are required.";
  }
  const highlights = Array.isArray(exp.highlights) ? exp.highlights : [];
  if (highlights.length < 1) {
    return "At least one highlight is required.";
  }
  const schedule = Array.isArray(exp.schedule) ? exp.schedule : [];
  if (schedule.length < 1) {
    return "Add at least one scheduled stop to the itinerary.";
  }
  if (!exp.priceAmount || !isValidHostTourPrice(exp.priceAmount)) {
    return `Price must be between ${HOST_TOUR_PRICING.minPrice.toLocaleString()} and ${HOST_TOUR_PRICING.maxPrice.toLocaleString()} VND.`;
  }
  return null;
}

/**
 * Finds a unique slug derived from `title` by appending -2, -3, ... until no
 * collision. Bounded loop so a pathological dataset (e.g. 1000 identical
 * titles) errors instead of hanging.
 */
async function findUniqueSlug(
  db: Parameters<Parameters<typeof hostProcedure.query>[0]>[0]["ctx"]["db"],
  base: string,
  excludeId?: string,
): Promise<string> {
  for (let suffix = 1; suffix <= 200; suffix++) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await db.query.experiences.findFirst({
      where: eq(experiences.slug, candidate),
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to generate a unique slug. Try a different title.",
  });
}

/**
 * Enforces `experience.authorId === ctx.user.id` after loading the row. Also
 * serves as a 404 for non-existent IDs so we never leak "exists but yours"
 * vs "does not exist" information.
 */
async function loadOwnExperience(
  db: Parameters<Parameters<typeof hostProcedure.query>[0]>[0]["ctx"]["db"],
  id: string,
  userId: string,
) {
  const row = await db.query.experiences.findFirst({
    where: eq(experiences.id, id),
  });
  if (!row || row.authorId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Experience not found",
    });
  }
  return row;
}

export const hostExperienceRouter = router({
  /** Host's own listings across every status. Newest first. */
  listMine: hostProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(experiences)
      .where(eq(experiences.authorId, ctx.user.id))
      .orderBy(desc(experiences.createdAt));
  }),

  /**
   * Creates a draft. `kind` is always forced to `host_custom` here so a host
   * cannot accidentally (or maliciously) claim authorship of a curated row.
   */
  create: hostProcedure
    .input(experienceDraftSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(experiences)
        .values({
          authorId: ctx.user.id,
          kind: "host_custom",
          status: "draft",
          title: input.title ?? "Untitled experience",
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          category: input.category ?? "cultural",
          durationMinutes: input.durationMinutes ?? 180,
          priceAmount: input.priceAmount ?? HOST_TOUR_PRICING.minPrice,
          maxGroupSize: input.maxGroupSize ?? 4,
          photos: input.photos ?? [],
          highlights: input.highlights ?? [],
          included: input.included ?? [],
          schedule: input.schedule ?? [],
          isActive: true,
        })
        .returning();
      return row;
    }),

  /**
   * Edits a draft or rejected experience. Published experiences must be
   * archived first (prevents in-flight listing mutation). Partial updates are
   * allowed so wizard autosave only sends what changed.
   */
  update: hostProcedure
    .input(z.object({ id: z.string().uuid() }).and(experienceDraftSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const current = await loadOwnExperience(ctx.db, id, ctx.user.id);
      if (current.status !== "draft" && current.status !== "rejected") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Archive the experience first to edit it.",
        });
      }
      // Guard against the race where a concurrent publish flips status to
      // 'published' between the read above and the UPDATE below -- the WHERE
      // includes the editable statuses so the update targets zero rows in
      // that case.
      const updated = await ctx.db
        .update(experiences)
        .set({ ...patch })
        .where(
          and(
            eq(experiences.id, id),
            inArray(experiences.status, ["draft", "rejected"]),
          ),
        )
        .returning();
      if (updated.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This experience has changed since you loaded it. Please refresh.",
        });
      }
      return updated[0];
    }),

  /**
   * Publish cascade:
   *   1. Ownership (loadOwnExperience).
   *   2. Status must be draft or rejected.
   *   3. Host's verificationStatus must be 'approved'.
   *   4. Content rules (validateForPublish).
   *   5. Slug resolution (unique).
   *   6. UPDATE status='published', publishedAt=now, slug.
   */
  publish: hostProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const exp = await loadOwnExperience(ctx.db, input.id, ctx.user.id);
      if (exp.status !== "draft" && exp.status !== "rejected") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only drafts or previously rejected experiences can be published.",
        });
      }
      const host = await ctx.db.query.hostProfiles.findFirst({
        where: eq(hostProfiles.userId, ctx.user.id),
      });
      if (!host || host.verificationStatus !== "approved") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Complete host ID verification before publishing experiences.",
        });
      }
      const reason = validateForPublish(exp);
      if (reason) {
        throw new TRPCError({ code: "BAD_REQUEST", message: reason });
      }

      const baseSlug = slugify(exp.title);
      // Two hosts publishing same-titled experiences at the same time could
      // both read "slug is free" before either commits. The UNIQUE constraint
      // on experiences.slug catches it but the loser sees a raw 23505; retry
      // the slug search with a fresh suffix before surfacing an error.
      for (let attempt = 0; attempt < 3; attempt++) {
        const slug = await findUniqueSlug(ctx.db, baseSlug, exp.id);
        try {
          const [row] = await ctx.db
            .update(experiences)
            .set({
              status: "published",
              publishedAt: new Date(),
              slug,
              reviewNotes: null,
            })
            .where(eq(experiences.id, exp.id))
            .returning();
          return row;
        } catch (err: unknown) {
          // Drizzle wraps pg errors; match on the code field when present.
          const code = (err as { code?: string; cause?: { code?: string } })?.code
            ?? (err as { cause?: { code?: string } })?.cause?.code;
          if (code !== "23505") throw err;
          // Loop and pick another suffix.
        }
      }
      throw new TRPCError({
        code: "CONFLICT",
        message: "That title is in high demand right now. Please try a slightly different title.",
      });
    }),

  /** Take a published experience offline. Ownership-checked. */
  archive: hostProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const exp = await loadOwnExperience(ctx.db, input.id, ctx.user.id);
      if (exp.status !== "published") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only published experiences can be archived.",
        });
      }
      const [row] = await ctx.db
        .update(experiences)
        .set({ status: "archived" })
        .where(eq(experiences.id, exp.id))
        .returning();
      return row;
    }),

  /** Host-side detail for the edit/preview pages. Ownership-checked. */
  getById: hostProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return loadOwnExperience(ctx.db, input.id, ctx.user.id);
    }),
});
