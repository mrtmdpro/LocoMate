import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("CI workflow", () => {
  test("Playwright is a blocking release gate with report artifacts", () => {
    const ci = readFileSync(path.resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const e2eJob = ci.slice(ci.indexOf("  e2e:"), ci.indexOf("      - name: Upload Playwright report"));

    expect(e2eJob).not.toContain("continue-on-error: true");
    expect(e2eJob).toContain("pnpm test:e2e");
    expect(ci).toContain("path: playwright-report");
  });
});
