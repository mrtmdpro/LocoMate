/**
 * Phase A.7 — Locomate's single LLM access point.
 *
 * Every AI surface (chatbot quiz, dynamic re-routing, wrap-up storytelling,
 * thank-you letter) goes through `llmGenerate` or `llmStream`. The service
 * decides between mocked output and real DeepSeek calls via the
 * `LLM_MOCK_MODE` env flag (default ON). Feature code never imports the
 * AI SDK directly, so the swap point is exactly one file.
 *
 * Mock-mode design choices:
 *   - The Vercel AI SDK is loaded via dynamic `await import(...)` so a
 *     mock-only deploy never pays the bundle cost or trips the zod peer-
 *     dep warning during pnpm install.
 *   - Mocked output mimics the real shape: `llmGenerate` returns a string,
 *     `llmStream` yields chunks. Token-level streaming is faked with
 *     small setTimeout delays so the chatbot UI feels live.
 *   - Mocked output is deterministic per `(feature, tone, sha1(prompt))`.
 *
 * Phase C will set `LLM_MOCK_MODE=false` and provision `DEEPSEEK_API_KEY`.
 * Nothing else needs to change.
 */

import { mockResponse } from "./llm-mocks";
import { systemPromptFor } from "./llm-prompts";
import type { LlmCall } from "./llm-types";

export { aiToneSchema, llmFeatureSchema, DEFAULT_TONE } from "./llm-types";
export type { AiTone, LlmCall, LlmFeature } from "./llm-types";

/** Returns true if the service is currently mocking responses. Exposed
 *  for the `/api/health/llm` route and for tests. */
export function isMockMode(): boolean {
  return process.env.LLM_MOCK_MODE !== "false";
}

/**
 * One-shot text generation. Returns the full response string. Use for
 * thank-you letters, re-routing rationales, wrap-up pages — anywhere a
 * single block of text is needed and streaming UX isn't required.
 */
export async function llmGenerate(args: LlmCall): Promise<string> {
  if (isMockMode()) {
    return mockResponse(args);
  }
  // Real DeepSeek path. Dynamic import so the SDK is excluded from any
  // build that runs in mock mode (and to silence the zod peer-dep
  // warning for projects that don't have the newer zod available).
  const [{ createOpenAI }, { generateText }] = await Promise.all([
    import("@ai-sdk/openai"),
    import("ai"),
  ]);
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseURL: "https://api.deepseek.com/v1",
  });
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: systemPromptFor(args.feature, args.user?.tone),
    prompt: args.prompt,
    maxOutputTokens: 400,
  });
  return text;
}

/**
 * Streaming generation. Yields chunks (words / tokens) as they arrive.
 * Use for the chatbot quiz so the AI line types in rather than appearing
 * whole.
 *
 * In mock mode the canned response is split on whitespace and yielded
 * with a small per-chunk delay so the UI feels alive. Consumers should
 * accumulate chunks; the final string equals what `llmGenerate` would
 * have returned.
 */
export async function* llmStream(args: LlmCall): AsyncGenerator<string> {
  if (isMockMode()) {
    const full = mockResponse(args);
    // Split keeping whitespace so the assembled string is identical.
    for (const chunk of full.split(/(\s+)/)) {
      // 35 ms per chunk ≈ a brisk but believable typing rhythm.
      await new Promise((r) => setTimeout(r, 35));
      yield chunk;
    }
    return;
  }
  const [{ createOpenAI }, { streamText }] = await Promise.all([
    import("@ai-sdk/openai"),
    import("ai"),
  ]);
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseURL: "https://api.deepseek.com/v1",
  });
  const { textStream } = streamText({
    model: deepseek("deepseek-chat"),
    system: systemPromptFor(args.feature, args.user?.tone),
    prompt: args.prompt,
  });
  for await (const chunk of textStream) yield chunk;
}
