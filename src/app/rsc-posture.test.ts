import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("RSC posture", () => {
  test("public experiences route is a server entry with a client island", () => {
    const page = source("src/app/[locale]/(public)/experiences/page.tsx");

    expect(page.trimStart().startsWith('"use client"')).toBe(false);
    expect(page).toContain("ExperiencesClient");
    const client = source("src/app/[locale]/(public)/experiences/experiences-client.tsx");
    expect(client.trimStart().startsWith('"use client"')).toBe(true);
  });
});
