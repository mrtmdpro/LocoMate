import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc, type SQL } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { customizedTourTemplates, userProfiles } from "../db/schema";
import { rankByCosine } from "../lib/cosine";

/* ──────────────────────────────────────────────────────────────────────
 *  Customized Tour Template router.
 *
 *  Parallel surface to `fixedTour.router.ts` but for the curated
 *  inspiration catalog that feeds `/plan/build`. The matching engine
 *  (cosine against the user's 4-D personality vector) is identical; the
 *  downstream booking flow diverges (Fixed Tours book end-to-end with a
 *  Bạn Lối guide, Customized Templates feed the activity cart).
 * ────────────────────────────────────────────────────────────────────── */

const themeSchema = z
  .enum(["heritage", "food", "craft", "quiet", "social", "balanced"])
  .optional();

/**
 * Reads the user's 4-D personality vector from `user_profiles.derivedData`
 * if present. Returns null when the user has not completed the quiz yet
 * — the consumer should fall back to a default order in that case.
 *
 * Duplicated from `fixedTour.router.ts` rather than imported to keep the
 * router self-contained; if a third router ever needs it, lift it out
 * into `app/src/server/lib/user-vector.ts`.
 */
async function getUserVector(
  ctx: { db: typeof import("../db").db; user: { id: string } | null },
): Promise<number[] | null> {
  if (!ctx.user) return null;
  const profile = await ctx.db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, ctx.user.id),
  });
  const derived = (profile?.derivedData ?? {}) as Record<string, unknown>;
  const vec = derived.personalityVector;
  if (
    Array.isArray(vec) &&
    vec.length === 4 &&
    vec.every((v) => typeof v === "number")
  ) {
    return vec as number[];
  }
  return null;
}

export const customizedTourTemplateRouter = router({
  /**
   * Lists customized tour templates, optionally filtered by theme. When
   * the caller is signed in AND has a personality vector saved, the
   * result also carries `matchPercent` per template, sorted descending;
   * otherwise templates are returned in canonical (template_id) order so
   * the /plan/build hub renders deterministically for anonymous users.
   *
   * Mirrors `fixedTour.list`'s response shape so both surfaces can share
   * the same `<TopMatchCard>` component on the client.
   */
  list: publicProcedure
    .input(
      z
        .object({
          theme: themeSchema,
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [eq(customizedTourTemplates.isActive, true)];
      if (input?.theme) {
        conditions.push(eq(customizedTourTemplates.theme, input.theme));
      }

      const rows = await ctx.db
        .select({
          templateId: customizedTourTemplates.templateId,
          titleVi: customizedTourTemplates.titleVi,
          titleEn: customizedTourTemplates.titleEn,
          subtitleVi: customizedTourTemplates.subtitleVi,
          subtitleEn: customizedTourTemplates.subtitleEn,
          theme: customizedTourTemplates.theme,
          storyVi: customizedTourTemplates.storyVi,
          storyEn: customizedTourTemplates.storyEn,
          durationMinutes: customizedTourTemplates.durationMinutes,
          maxParticipants: customizedTourTemplates.maxParticipants,
          basePriceVnd: customizedTourTemplates.basePriceVnd,
          vector: customizedTourTemplates.vector,
        })
        .from(customizedTourTemplates)
        .where(and(...conditions))
        .orderBy(asc(customizedTourTemplates.templateId));

      // Rank by cosine if the user has a saved vector. Otherwise return
      // in canonical template_id order.
      const userVec = await getUserVector(ctx);
      const baseShape = rows.map((r) => ({
        ...r,
        vector: r.vector as [number, number, number, number],
      }));

      if (userVec) {
        const ranked = rankByCosine(
          userVec,
          baseShape.map((b) => ({ id: b.templateId, vector: b.vector })),
        );
        const byId = new Map(baseShape.map((b) => [b.templateId, b]));
        return {
          templates: ranked
            .map((r) => {
              const base = byId.get(r.id);
              if (!base) return null;
              return { ...base, matchPercent: r.matchPercent };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null),
          userHasVector: true,
          // Exposed so the `/plan/build` Top-Match card can compute
          // per-axis contribution. Same 4-tuple the user saw their quiz
          // produce — no new PII surfaced.
          userVector: userVec as [number, number, number, number],
        };
      }

      return {
        templates: baseShape.map((b) => ({
          ...b,
          matchPercent: null as number | null,
        })),
        userHasVector: false,
        userVector: null as [number, number, number, number] | null,
      };
    }),

  /**
   * Single-template detail. Powers `/plan/templates/[id]`. Throws
   * NOT_FOUND if the template_id is unknown or inactive.
   */
  getById: publicProcedure
    .input(z.object({ templateId: z.string().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.query.customizedTourTemplates.findFirst({
        where: and(
          eq(customizedTourTemplates.templateId, input.templateId),
          eq(customizedTourTemplates.isActive, true),
        ),
      });
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Customized tour template ${input.templateId} not found`,
        });
      }

      // Compute matchPercent for signed-in users with a saved vector.
      const userVec = await getUserVector(ctx);
      const matchPercent = userVec
        ? rankByCosine(userVec, [
            {
              id: template.templateId,
              vector: template.vector as [number, number, number, number],
            },
          ])[0]!.matchPercent
        : null;

      return {
        ...template,
        vector: template.vector as [number, number, number, number],
        matchPercent,
        userVector: userVec as [number, number, number, number] | null,
        userHasVector: !!userVec,
      };
    }),
});
