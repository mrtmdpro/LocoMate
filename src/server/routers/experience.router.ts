import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { experiences } from "../db/schema";

export const experienceRouter = router({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(experiences.isActive, true)];
      if (input?.category) {
        conditions.push(eq(experiences.category, input.category));
      }
      return ctx.db
        .select()
        .from(experiences)
        .where(and(...conditions))
        .orderBy(desc(experiences.totalBookings));
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.experiences.findFirst({
        where: and(eq(experiences.slug, input.slug), eq(experiences.isActive, true)),
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.experiences.findFirst({
        where: and(eq(experiences.id, input.id), eq(experiences.isActive, true)),
      });
    }),
});
