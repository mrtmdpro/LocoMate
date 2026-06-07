import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  crons?: Array<{
    path: string;
    schedule: string;
  }>;
};

describe("vercel cron schedules", () => {
  it("registers split crossover lifecycle routes at offset 15-minute cadence", () => {
    const config = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    ) as VercelConfig;
    const schedules = new Map(config.crons?.map((cron) => [cron.path, cron.schedule]));

    expect(schedules.get("/api/cron/crossover-t48")).toBe("0,15,30,45 * * * *");
    expect(schedules.get("/api/cron/crossover-t36")).toBe("3,18,33,48 * * * *");
    expect(schedules.get("/api/cron/crossover-t28")).toBe("6,21,36,51 * * * *");
    expect(schedules.get("/api/cron/crossover-t24")).toBe("9,24,39,54 * * * *");
    expect(schedules.has("/api/cron/crossover-sweeps")).toBe(false);
  });
});
