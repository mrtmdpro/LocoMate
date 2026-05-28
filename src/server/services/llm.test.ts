import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { llmGenerate, llmStream, isMockMode } from "./llm";
import { aiToneSchema } from "./llm-types";

/**
 * Phase A.7 verification — proves that:
 *   1. Mock mode is on by default in tests.
 *   2. Mock responses are deterministic (same prompt -> same answer).
 *   3. Different prompts produce different mock answers (no global lock).
 *   4. Streaming yields chunks whose concatenation equals generate().
 *   5. The tone enum rejects unknown values.
 *
 * No DeepSeek key is provisioned in CI; if anything in here ever tried
 * to make a real network call, the test would hang. The `isMockMode()`
 * assertion catches that early.
 */

describe("llm service (mock-mode)", () => {
  beforeAll(() => {
    // Force mock mode regardless of inherited env.
    delete process.env.LLM_MOCK_MODE;
  });

  afterAll(() => {
    // No-op: not setting anything new.
  });

  it("is in mock mode by default", () => {
    expect(isMockMode()).toBe(true);
  });

  it("returns deterministic answers for the same prompt + tone", async () => {
    const a = await llmGenerate({
      feature: "thank-you-letter",
      prompt: "tour-abc123",
      user: { nickname: "Kẻ lữ hành", tone: "thu-thi" },
    });
    const b = await llmGenerate({
      feature: "thank-you-letter",
      prompt: "tour-abc123",
      user: { nickname: "Kẻ lữ hành", tone: "thu-thi" },
    });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(a).toContain("Kẻ lữ hành"); // nickname interpolation
  });

  it("varies output by prompt seed", async () => {
    // Try several seeds; at least one pair must differ (mock pool has 2+
    // entries per (feature, tone)).
    const results = await Promise.all(
      ["seed-a", "seed-b", "seed-c"].map((p) =>
        llmGenerate({
          feature: "wrap-up-page",
          prompt: p,
          user: { tone: "hom-hinh" },
        }),
      ),
    );
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("falls back to a default nickname when none is provided", async () => {
    const out = await llmGenerate({
      feature: "thank-you-letter",
      prompt: "tour-no-nick",
      user: { tone: "truc-dien" },
    });
    expect(out.length).toBeGreaterThan(10);
    expect(out).not.toContain("{nickname}");
  });

  it("streams chunks that concatenate to the full mock response", async () => {
    const fullGenerate = await llmGenerate({
      feature: "rerouting-rationale",
      prompt: "near-hoankiem-rain",
      user: { tone: "thu-thi", nickname: "Cậu cả" },
    });
    let assembled = "";
    for await (const chunk of llmStream({
      feature: "rerouting-rationale",
      prompt: "near-hoankiem-rain",
      user: { tone: "thu-thi", nickname: "Cậu cả" },
    })) {
      assembled += chunk;
    }
    expect(assembled).toBe(fullGenerate);
  });

  it("rejects unknown AI tones via Zod", () => {
    const result = aiToneSchema.safeParse("operatic");
    expect(result.success).toBe(false);
  });

  it("accepts all three brand-canonical tones", () => {
    for (const t of ["thu-thi", "hom-hinh", "truc-dien"] as const) {
      expect(aiToneSchema.safeParse(t).success).toBe(true);
    }
  });
});
