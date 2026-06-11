import { z } from "zod";
import { aiToneSchema } from "../services/llm-types";

/**
 * Typed boundary for the two profile JSONB columns
 * (`user_profiles.explicit_data` / `derived_data`). These columns were
 * historically read by casting to `Record<string, unknown>` with no
 * validation, so shape drift silently became `undefined`. The schemas
 * here centralise that boundary:
 *
 *  - Read accessors (`readExplicitData` / `readDerivedData`) are LENIENT:
 *    they `safeParse` and fall back to a typed default, never throwing.
 *    This preserves the graceful degradation the call sites already had.
 *  - Write mergers (`mergeExplicitData` / `mergeDerivedData`) are
 *    STRICT-on-known-keys: they shallow-merge a patch onto the existing
 *    (leniently read) row, then `.parse` so a malformed known field fails
 *    loudly. `.passthrough()` keeps unknown/legacy keys alive across a
 *    partial update.
 *
 * No column migration — the underlying type stays `jsonb`.
 */

const TourPreferencesSchema = z
  .object({
    guideStyle: z.enum(["researcher", "buddy"]).optional(),
    meal: z
      .object({
        vegetarian: z.boolean().optional(),
        noSpice: z.boolean().optional(),
        allergies: z.array(z.string()).optional(),
      })
      .optional(),
    route: z.enum(["walking", "cyclo", "vintage-bike"]).optional(),
    groupSize: z.enum(["solo", "couple", "group6"]).optional(),
  })
  .passthrough();

export const ExplicitDataSchema = z
  .object({
    // User-chosen settings.
    nickname: z.string().optional(),
    consentMatching: z.boolean().optional(),
    birthYear: z.number().optional(),
    nationality: z.string().optional(),
    locale: z.enum(["en", "vi"]).optional(),
    themePref: z.enum(["light", "dark"]).optional(),
    // Settings → Notifications / Privacy toggles. Persisted (were previously
    // local-only useState that reset on reload).
    notifPush: z.boolean().optional(),
    notifEmailDigest: z.boolean().optional(),
    locationSharing: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
    aiTone: aiToneSchema.optional(),
    tourPreferences: TourPreferencesSchema.optional(),
    // Onboarding answers (written wholesale by submit/updatePreferences).
    intent: z.array(z.string()).optional(),
    scenario_choice: z.string().optional(),
    style: z
      .object({
        chill_explore: z.number(),
        plan_spontaneous: z.number(),
      })
      .optional(),
    interests: z.array(z.string()).optional(),
    budget: z.enum(["low", "medium", "high"]).optional(),
    social_preference: z.enum(["solo", "meet_new", "group"]).optional(),
    time_preference: z
      .array(z.enum(["morning", "afternoon", "evening", "late_night"]))
      .optional(),
  })
  .passthrough();

export type ExplicitData = z.infer<typeof ExplicitDataSchema>;

export const DerivedDataSchema = z
  .object({
    // 4-D personality vector fed into the Fixed Tour cosine matcher. Order is
    // [Art_Aesthetic, Deep_History_Heritage, Culinary_Enthusiast, Slow_Living].
    personalityVector: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .optional(),
    personalityLabel: z.string().optional(),
    // Profile-engine output (see services/profile-engine.ts).
    personality: z.record(z.string(), z.number()).optional(),
    behavior: z.record(z.string(), z.number()).optional(),
    emotional: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export type DerivedData = z.infer<typeof DerivedDataSchema>;

export function readExplicitData(value: unknown): ExplicitData {
  const parsed = ExplicitDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function readDerivedData(value: unknown): DerivedData {
  const parsed = DerivedDataSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function mergeExplicitData(
  existing: unknown,
  patch: Partial<ExplicitData>,
): ExplicitData {
  return ExplicitDataSchema.parse({ ...readExplicitData(existing), ...patch });
}

export function mergeDerivedData(
  existing: unknown,
  patch: Partial<DerivedData>,
): DerivedData {
  return DerivedDataSchema.parse({ ...readDerivedData(existing), ...patch });
}
