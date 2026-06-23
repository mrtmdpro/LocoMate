import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crossover dark-launch posture", () => {
  it("keeps crossover out of scheduled cron until product UI is enabled", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons?: Array<{ path: string }>;
    };

    const crossoverCrons = (vercel.crons ?? []).filter((cron) =>
      cron.path.includes("crossover"),
    );

    expect(crossoverCrons).toEqual([]);
  });

  it("documents that public crossover paths are parked", () => {
    const status = readFileSync("docs/CROSSOVER_MATCHING_STATUS.md", "utf8");

    expect(status).toContain("Status: Parked");
    expect(status).toContain("CROSSOVER_MATCHING_ENABLED");
    expect(status).toContain("/api/cron/crossover-sweeps");
  });
});
