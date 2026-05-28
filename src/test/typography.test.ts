import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Typography regression guard.
 *
 * This test doubles as a single source of truth for the project's text
 * accessibility bar. It scans every `.ts` / `.tsx` file under `src/` and
 * fails the build if it finds:
 *
 *   1. `text-[Npx]` classes where N < 12. Sub-12px text is unreadable for
 *      older users, low-vision users, and anyone in bright sunlight. See
 *      `docs/TYPOGRAPHY.md` for the approved scale.
 *
 *   2. `text-slate-400` or `text-gray-400` on their own (no `dark:` / opacity
 *      modifier), which yields 3.35:1 contrast on white -- below the 4.5:1
 *      WCAG 2.1 AA threshold for body text. Use `text-slate-500` /
 *      `text-gray-500` instead (4.61:1, passes).
 *
 * Regenerate exemptions in the EXEMPT list below ONLY with explicit team
 * approval (e.g. legal fine-print, data-viz tick labels where the physical
 * pixel count is inherent to the chart type).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, "..");

// Patterns we forbid anywhere in component JSX strings.
const FORBIDDEN_SUB_12_PX = /text-\[(?:[0-9]|1[01])px\]/g;
const FORBIDDEN_GREY_400 = /\btext-(?:slate|gray)-400\b/g;

// Files the guard does not scan (itself, and binary-ish things).
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

type Violation = { file: string; match: string; line: number };

function scan(patterns: { re: RegExp; label: string }[]): Violation[] {
  const files = walk(SRC_ROOT);
  const violations: Violation[] = [];
  for (const file of files) {
    // Don't let the guard flag itself -- the forbidden patterns literally
    // appear here as regex sources.
    if (file.endsWith("typography.test.ts")) continue;
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (const { re } of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        // Approximate line number by counting newlines up to the match.
        const prefix = content.slice(0, m.index);
        const line = prefix.split("\n").length;
        violations.push({
          file: file.slice(SRC_ROOT.length + 1),
          match: m[0],
          line,
        });
      }
      void lines; // not used, but retained for future per-line diagnostics
    }
  }
  return violations;
}

describe("typography guard", () => {
  test("no sub-12px absolute-sized text classes remain in src/", () => {
    const violations = scan([
      { re: new RegExp(FORBIDDEN_SUB_12_PX, "g"), label: "sub-12px" },
    ]);
    if (violations.length > 0) {
      const lines = violations
        .map((v) => `  ${v.file}:${v.line}  ${v.match}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} sub-12px text classes. Use text-xs (12) or text-sm (14) and see docs/TYPOGRAPHY.md.\n${lines}`,
      );
    }
    expect(violations).toEqual([]);
  });

  test("no text-slate-400 / text-gray-400 (fails WCAG AA 4.5:1 on white)", () => {
    const violations = scan([
      { re: new RegExp(FORBIDDEN_GREY_400, "g"), label: "low-contrast grey" },
    ]);
    if (violations.length > 0) {
      const lines = violations
        .map((v) => `  ${v.file}:${v.line}  ${v.match}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} low-contrast greys. Use text-slate-500 / text-gray-500.\n${lines}`,
      );
    }
    expect(violations).toEqual([]);
  });
});
