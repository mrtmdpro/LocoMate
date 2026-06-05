import { z } from "zod";
import { eq } from "drizzle-orm";
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { userProfiles, users, accounts, hostProfiles } from "../../db/schema";
import { onboardingSchema } from "@/lib/validations/auth";
import { computeDerivedProfile } from "../../services/profile-engine";
import {
  mergeExplicitData,
  mergeDerivedData,
  type ExplicitData,
  type DerivedData,
} from "../../lib/profile-shape";

export const userProfileProcedures = {
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.user.id),
    });

    // Which OAuth providers the user has linked. Currently only Google, but
    // the query shape generalises so adding Apple/GitHub later is a no-op
    // for the security page.
    const linkedAccounts = await ctx.db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, ctx.user.id));
    const linkedProviders = linkedAccounts.map((a) => a.provider);

    // Host verification is only meaningful when the user has a host profile.
    // Travelers get `null` here and the UI hides that row.
    const host =
      ctx.user.role === "host"
        ? await ctx.db.query.hostProfiles.findFirst({
            where: eq(hostProfiles.userId, ctx.user.id),
          })
        : null;

    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        displayName: ctx.user.displayName,
        role: ctx.user.role,
        avatarUrl: ctx.user.avatarUrl,
        hasPassword: !!ctx.user.passwordHash,
        emailVerified: ctx.user.emailVerified === true,
        phoneVerified: ctx.user.phoneVerified === true,
        linkedProviders,
      },
      host: host
        ? {
            verificationStatus: host.verificationStatus,
            verifiedAt: host.verifiedAt,
          }
        : null,
      profile,
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      displayName: z.string().min(2).max(100).optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  /**
   * Cross-device theme persistence for the "Nắng Sớm Tràng An" /
   * "Đêm Sâu Phố Cổ" toggle. Writes to userProfiles.explicitData.themePref
   * (jsonb — no migration). The client-side next-themes provider is still
   * the rendering source of truth via localStorage; this mutation is a
   * sync-on-change so that signing in on a new device picks up the user's
   * choice. Read on the home page (or layout) to seed next-themes from
   * the server when localStorage hasn't been populated yet.
   */
  setThemePref: protectedProcedure
    .input(z.object({ theme: z.enum(["light", "dark"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData(existing?.explicitData, {
            themePref: input.theme,
          }),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, theme: input.theme };
    }),

  /**
   * Personalised "danh xưng" the app uses to address the user. Written to
   * userProfiles.explicitData.nickname (jsonb). All home/profile/letters
   * surfaces read this via `useDisplayName()` with a fallback ladder of
   * nickname -> displayName -> "Lữ khách". An empty string clears the
   * nickname back to the default fallback.
   */
  setNickname: protectedProcedure
    .input(z.object({ nickname: z.string().trim().max(40) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      // Empty string clears the nickname: an undefined patch value drops
      // the key on serialization, matching the prior `delete` behaviour.
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData(existing?.explicitData, {
            nickname: input.nickname.length === 0 ? undefined : input.nickname,
          }),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, nickname: input.nickname || null };
    }),

  /**
   * Cross-device UI locale persistence. The Settings → App Language toggle
   * fires this whenever the user switches between English and Vietnamese.
   * Written to userProfiles.explicitData.locale; the matching `NEXT_LOCALE`
   * cookie is set on the client so next-intl middleware picks the same
   * locale on subsequent navigations. Login on a new device reads this
   * value and seeds the cookie before the first render.
   *
   * The set of accepted values mirrors `routing.locales` in
   * `src/i18n/routing.ts`. Adding a locale there means widening this enum
   * too.
   */
  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(["en", "vi"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData(existing?.explicitData, {
            locale: input.locale,
          }),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, locale: input.locale };
    }),

  /**
   * Traveler's spoken languages — passed to hosts at booking time so
   * they can greet the guest in the right tongue. This is the
   * traveler-side counterpart of `host_profiles.languages`. Written to
   * userProfiles.explicitData.languages as a string[]; values are limited
   * to the well-known label set the Profile picker offers so the host's
   * matching UI can render consistent chips.
   *
   * NOT the same as the Settings App Language toggle, which controls the
   * UI locale via `setLocale`.
   */
  setSpokenLanguages: protectedProcedure
    .input(
      z.object({
        languages: z
          .array(
            z.enum([
              "English",
              "Tiếng Việt",
              "日本語",
              "한국어",
              "Français",
              "Español",
              "中文",
            ]),
          )
          .max(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      // De-duplicate while preserving caller order so the host UI can
      // surface the user's primary language first.
      const dedup = Array.from(new Set(input.languages));
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData(existing?.explicitData, {
            languages: dedup,
          }),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true, languages: dedup };
    }),

  /**
   * Saves the user's chosen AI tone (Phase A.7) AND the computed personality
   * label from the chatbot quiz (Phase A.8). The tone lives in explicitData
   * (user-chosen), the label in derivedData (system-computed). Splitting
   * them across the two jsonb columns mirrors how onboarding already treats
   * "what the user told us" vs "what we inferred".
   *
   * Also saves a per-feature tourPreferences (Phase A.4) blob.
   */
  savePersonality: protectedProcedure
    .input(z.object({
      tone: z.enum(["thu-thi", "hom-hinh", "truc-dien"]).optional(),
      personalityLabel: z.string().min(1).max(60).optional(),
      /**
       * 4-D personality vector from `toVectorV4(scorePersonality(picks))`.
       * Fed into the Fixed Tour cosine matcher. Order is
       * `[Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living]`
       * — must align with the tour vectors seeded in seed-fixed-tours.ts.
       */
      personalityVector: z
        .tuple([
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
          z.number().min(0).max(1),
        ])
        .optional(),
      tourPreferences: z.object({
        guideStyle: z.enum(["researcher", "buddy"]).optional(),
        meal: z.object({
          vegetarian: z.boolean().optional(),
          noSpice: z.boolean().optional(),
          allergies: z.array(z.string().max(40)).max(10).optional(),
        }).optional(),
        route: z.enum(["walking", "cyclo", "vintage-bike"]).optional(),
        groupSize: z.enum(["solo", "couple", "group6"]).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.user.id),
      });
      const explicitPatch: Partial<ExplicitData> = {};
      const derivedPatch: Partial<DerivedData> = {};
      if (input.tone !== undefined) explicitPatch.aiTone = input.tone;
      if (input.tourPreferences !== undefined) {
        explicitPatch.tourPreferences = input.tourPreferences;
      }
      if (input.personalityLabel !== undefined) {
        derivedPatch.personalityLabel = input.personalityLabel;
      }
      if (input.personalityVector !== undefined) {
        derivedPatch.personalityVector = input.personalityVector;
      }
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData(existing?.explicitData, explicitPatch),
          derivedData: mergeDerivedData(existing?.derivedData, derivedPatch),
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  submitOnboarding: protectedProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const derived = computeDerivedProfile(input);

      // Onboarding replaces (not merges) the profile blobs, so validate
      // against an empty base to keep the prior overwrite semantics.
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData({}, input),
          derivedData: mergeDerivedData({}, { ...derived }),
          onboardingCompleted: true,
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true, derived };
    }),

  updatePreferences: protectedProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const derived = computeDerivedProfile(input);

      // updatePreferences replaces the profile blobs (same as onboarding);
      // validate against an empty base to preserve overwrite semantics.
      await ctx.db
        .update(userProfiles)
        .set({
          explicitData: mergeExplicitData({}, input),
          derivedData: mergeDerivedData({}, { ...derived }),
          derivedUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true, derived };
    }),
} satisfies TRPCRouterRecord;
