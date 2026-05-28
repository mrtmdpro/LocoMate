/**
 * Pure type definitions for the LLM service. Kept in a separate file (with
 * no runtime imports) so that:
 *   1. The mock bank and the prompt bank can import these without pulling
 *      in the AI SDK (which loads zod at import time and triggers peer-dep
 *      warnings in dev).
 *   2. Tests can import the types without booting the full LLM service.
 */

import { z } from "zod";

/**
 * The three brand-canonical voices the AI takes on. Stored on
 * `userProfiles.explicitData.aiTone`; user picks at the start of the
 * chatbot quiz (Phase A.8).
 *
 *   thu-thi    — thủ thỉ tâm tình   — intimate, confiding
 *   hom-hinh   — hóm hỉnh lém lỉnh  — witty, playful
 *   truc-dien  — trực diện nhanh gọn — direct, crisp
 */
export const aiToneSchema = z.enum(["thu-thi", "hom-hinh", "truc-dien"]);
export type AiTone = z.infer<typeof aiToneSchema>;

export const DEFAULT_TONE: AiTone = "thu-thi";

/**
 * Every AI surface picks one of these feature buckets. The mock bank,
 * the prompt bank, and the future cost-telemetry table all key off this
 * enum, so adding a new AI feature is a single-line addition here.
 */
export const llmFeatureSchema = z.enum([
  "personality-quiz",
  "rerouting-rationale",
  "wrap-up-page",
  "thank-you-letter",
]);
export type LlmFeature = z.infer<typeof llmFeatureSchema>;

/** What a feature surface passes to the LLM service. */
export interface LlmCall {
  feature: LlmFeature;
  /** The user-shaped prompt that will be sent to the model. In mock
   *  mode, the prompt is also used as the seed for deterministic
   *  variation in the response bank. */
  prompt: string;
  /** Optional context — nickname is interpolated into mocks; tone
   *  drives the prompt voice. */
  user?: {
    nickname?: string;
    tone?: AiTone;
  };
}
