import { z } from "zod";
import { eq, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc";
import {
  customizedTourTemplates,
  fixedTourSteps,
  fixedTourTags,
  fixedTours,
  places,
} from "../db/schema";
import { slugify } from "@/lib/slugify";

const vectorSchema = z.array(z.number().min(0).max(1)).length(4);

export const catalogAdminRouter = router({
  listPlaces: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(places).orderBy(desc(places.updatedAt)).limit(250);
  }),

  upsertPlace: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        address: z.string().max(300).optional(),
        category: z.string().min(2).max(50),
        descriptionEn: z.string().max(500).optional(),
        descriptionVi: z.string().max(500).optional(),
        isActive: z.boolean().optional(),
        isVerified: z.boolean().optional(),
        latitude: z.number(),
        longitude: z.number(),
        name: z.string().min(2).max(200),
        nameEn: z.string().max(200).optional(),
        nameVi: z.string().max(200).optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        priceRange: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = input.id
        ? await ctx.db.query.places.findFirst({ where: eq(places.id, input.id) })
        : null;
      if (input.id && !existing) throw new TRPCError({ code: "NOT_FOUND" });
      const address = blankToUndefined(input.address);
      const descriptionEn = blankToUndefined(input.descriptionEn);
      const descriptionVi = blankToUndefined(input.descriptionVi);
      const nameEn = blankToUndefined(input.nameEn);
      const nameVi = blankToUndefined(input.nameVi);
      const priceRange = blankToUndefined(input.priceRange);

      const values = {
        address: address ?? existing?.address ?? null,
        category: input.category,
        description:
          descriptionEn ??
          descriptionVi ??
          existing?.description ??
          null,
        descriptionEn: descriptionEn ?? existing?.descriptionEn ?? null,
        descriptionVi: descriptionVi ?? existing?.descriptionVi ?? null,
        isActive: input.isActive ?? existing?.isActive ?? true,
        isVerified: input.isVerified ?? existing?.isVerified ?? true,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        nameEn: nameEn ?? existing?.nameEn ?? null,
        nameVi: nameVi ?? existing?.nameVi ?? null,
        photos: input.photos ?? existing?.photos ?? [],
        priceRange: priceRange ?? existing?.priceRange ?? null,
        slug: slugify(input.name),
        source: "admin",
        updatedAt: new Date(),
      };

      if (input.id) {
        const [updated] = await ctx.db
          .update(places)
          .set(values)
          .where(eq(places.id, input.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db.insert(places).values(values).returning();
      return created;
    }),

  listFixedTours: adminProcedure.query(async ({ ctx }) => {
    const tours = await ctx.db.select().from(fixedTours).orderBy(asc(fixedTours.tourId));
    const steps = await ctx.db.select().from(fixedTourSteps).orderBy(asc(fixedTourSteps.tourId), asc(fixedTourSteps.stepOrder));
    const tags = await ctx.db.select().from(fixedTourTags).orderBy(asc(fixedTourTags.tourId), asc(fixedTourTags.tagClass));
    return { steps, tags, tours };
  }),

  upsertFixedTour: adminProcedure
    .input(
      z.object({
        tourId: z.string().min(3).max(30),
        basePriceVnd: z.number().int().positive(),
        chapter: z.enum(["MORNING_SHIFT", "AFTERNOON_SHIFT", "EVENING_SHIFT"]),
        durationMinutes: z.number().int().min(30).max(720),
        isActive: z.boolean().default(true),
        maxParticipants: z.number().int().min(1).max(30),
        minParticipants: z.number().int().min(1).max(30).default(1),
        storyScriptEn: z.string().min(20),
        storyScriptVi: z.string().min(20),
        titleEn: z.string().min(2).max(255),
        titleVi: z.string().min(2).max(255),
        vector: vectorSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const values = { ...input, updatedAt: new Date() };
      const existing = await ctx.db.query.fixedTours.findFirst({
        where: eq(fixedTours.tourId, input.tourId),
      });
      if (existing) {
        const [updated] = await ctx.db
          .update(fixedTours)
          .set(values)
          .where(eq(fixedTours.tourId, input.tourId))
          .returning();
        return updated;
      }
      const [created] = await ctx.db.insert(fixedTours).values(input).returning();
      return created;
    }),

  upsertFixedTourStep: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        actionLogEn: z.string().min(10),
        actionLogVi: z.string().min(10),
        latitude: z.number().nullable().optional(),
        locationNameEn: z.string().min(2).max(255),
        locationNameVi: z.string().min(2).max(255),
        longitude: z.number().nullable().optional(),
        stepOrder: z.number().int().min(1).max(50),
        targetTimeOffset: z.number().int().min(0).max(1440),
        tourId: z.string().min(3).max(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      if (id) {
        const [updated] = await ctx.db
          .update(fixedTourSteps)
          .set(values)
          .where(eq(fixedTourSteps.id, id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }
      const [created] = await ctx.db.insert(fixedTourSteps).values(values).returning();
      return created;
    }),

  deleteFixedTourStep: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(fixedTourSteps).where(eq(fixedTourSteps.id, input.id));
      return { ok: true };
    }),

  upsertFixedTourTag: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        tagClass: z.enum(["MATERIAL", "PERSONA", "KEYWORD"]),
        tagKey: z.string().min(1).max(50),
        tourId: z.string().min(3).max(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      if (id) {
        const [updated] = await ctx.db
          .update(fixedTourTags)
          .set(values)
          .where(eq(fixedTourTags.id, id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }
      const [created] = await ctx.db.insert(fixedTourTags).values(values).returning();
      return created;
    }),

  deleteFixedTourTag: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(fixedTourTags).where(eq(fixedTourTags.id, input.id));
      return { ok: true };
    }),

  upsertCustomizedTemplate: adminProcedure
    .input(
      z.object({
        templateId: z.string().min(3).max(30),
        basePriceVnd: z.number().int().positive(),
        durationMinutes: z.number().int().min(30).max(720),
        isActive: z.boolean().default(true),
        maxParticipants: z.number().int().min(1).max(30),
        storyEn: z.string().min(20),
        storyVi: z.string().min(20),
        subtitleEn: z.string().max(500).optional(),
        subtitleVi: z.string().max(500).optional(),
        theme: z.string().min(2).max(30),
        titleEn: z.string().min(2).max(255),
        titleVi: z.string().min(2).max(255),
        vector: vectorSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const values = { ...input, updatedAt: new Date() };
      const existing = await ctx.db.query.customizedTourTemplates.findFirst({
        where: eq(customizedTourTemplates.templateId, input.templateId),
      });
      if (existing) {
        const [updated] = await ctx.db
          .update(customizedTourTemplates)
          .set(values)
          .where(eq(customizedTourTemplates.templateId, input.templateId))
          .returning();
        return updated;
      }
      const [created] = await ctx.db.insert(customizedTourTemplates).values(input).returning();
      return created;
    }),

  listCustomizedTemplates: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(customizedTourTemplates)
      .orderBy(asc(customizedTourTemplates.templateId));
  }),
});

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
