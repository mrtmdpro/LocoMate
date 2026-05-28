import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { router, publicProcedure, adminProcedure } from "../trpc";
import { products, productVariants } from "../db/schema";
import { slugify } from "@/lib/slugify";

/**
 * Merch / products router.
 * Public: list, getBySlug (with variants).
 * Admin CMS: createProduct, updateProduct, archiveProduct + per-variant CRUD.
 *
 * Travelers cannot create/edit products -- merch is a platform-owned revenue
 * line, not a hosted marketplace. Hosts (as of MVP) also cannot sell merch;
 * that stays admin-only until there's a supply strategy for host-branded
 * goods.
 */

// Bilingual columns: every customer-visible text field has both `_vi` and
// `_en` siblings. The UI calls `pickLocaleField(row, "title", locale)`.
const productListColumns = {
  id: products.id,
  sku: products.sku,
  title: products.title,
  titleVi: products.titleVi,
  titleEn: products.titleEn,
  slug: products.slug,
  subtitle: products.subtitle,
  subtitleVi: products.subtitleVi,
  subtitleEn: products.subtitleEn,
  category: products.category,
  basePriceVnd: products.basePriceVnd,
  currency: products.currency,
  photos: products.photos,
  bundleDiscountPct: products.bundleDiscountPct,
  isActive: products.isActive,
} as const;

export const merchRouter = router({
  /**
   * Public storefront list. Active-only by default.
   */
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        includeInactive: z.boolean().default(false),
        limit: z.number().int().min(1).max(50).default(24),
      }).default({ includeInactive: false, limit: 24 }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (!input.includeInactive) conditions.push(eq(products.isActive, true));
      if (input.category) conditions.push(eq(products.category, input.category));
      return ctx.db
        .select(productListColumns)
        .from(products)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(products.createdAt))
        .limit(input.limit);
    }),

  /**
   * Public product detail with variants. Inactive variants are filtered so
   * the picker doesn't render dead options; inactive products 404.
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: and(eq(products.slug, input.slug), eq(products.isActive, true)),
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const variants = await ctx.db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, product.id), eq(productVariants.isActive, true)))
        .orderBy(productVariants.label);

      return { product, variants };
    }),

  /**
   * Variants for a given set of ids. Used by the order/history page to
   * label order lines after the fact.
   */
  getVariantsByIds: publicProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).max(50) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      return ctx.db
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(inArray(productVariants.id, input.ids));
    }),

  // ---------- Admin CMS ----------

  adminListAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
  }),

  createProduct: adminProcedure
    .input(
      z.object({
        sku: z.string().min(3).max(40),
        title: z.string().min(2).max(200),
        subtitle: z.string().max(300).optional(),
        description: z.string().max(5000).optional(),
        category: z.string().min(2).max(40),
        basePriceVnd: z.number().int().positive(),
        photos: z.array(z.string().url()).max(8).default([]),
        bundleDiscountPct: z.number().int().min(0).max(50).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-slug from title; collisions append -N.
      let slug = slugify(input.title);
      let n = 2;
      while (await ctx.db.query.products.findFirst({ where: eq(products.slug, slug) })) {
        slug = `${slugify(input.title)}-${n++}`;
        if (n > 100) throw new Error("Slug collision");
      }

      const [created] = await ctx.db
        .insert(products)
        .values({
          ...input,
          slug,
          isActive: true,
          currency: "VND",
        })
        .returning();
      return created;
    }),

  updateProduct: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().min(2).max(200).optional(),
          subtitle: z.string().max(300).optional(),
          description: z.string().max(5000).optional(),
          category: z.string().min(2).max(40).optional(),
          basePriceVnd: z.number().int().positive().optional(),
          photos: z.array(z.string().url()).max(8).optional(),
          bundleDiscountPct: z.number().int().min(0).max(50).optional(),
          isActive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(products)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  archiveProduct: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  addVariant: adminProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        sku: z.string().min(3).max(40),
        label: z.string().min(1).max(100),
        attributes: z.record(z.string(), z.string()).default({}),
        priceOverrideVnd: z.number().int().positive().nullable().optional(),
        stockQuantity: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(productVariants)
        .values({
          productId: input.productId,
          sku: input.sku,
          label: input.label,
          attributes: input.attributes,
          priceOverrideVnd: input.priceOverrideVnd ?? null,
          stockQuantity: input.stockQuantity,
          isActive: true,
        })
        .returning();
      return created;
    }),

  updateVariant: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().min(1).max(100).optional(),
          attributes: z.record(z.string(), z.string()).optional(),
          priceOverrideVnd: z.number().int().positive().nullable().optional(),
          stockQuantity: z.number().int().min(0).optional(),
          isActive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(productVariants)
        .set(input.patch)
        .where(eq(productVariants.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  removeVariant: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(productVariants).where(eq(productVariants.id, input.id));
      return { ok: true };
    }),
});
