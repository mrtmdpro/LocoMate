import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * Auth-gate tests for the consolidated crossover-sweeps cron route. We
 * only exercise the auth branches (which return before touching the DB),
 * mirroring the Bearer-`CRON_SECRET` contract of the other cron routes.
 */
describe("/api/cron/crossover-sweeps auth gate", () => {
  const original = process.env.CRON_SECRET;
  const originalCrossoverFlag = process.env.CROSSOVER_MATCHING_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
    if (originalCrossoverFlag === undefined) delete process.env.CROSSOVER_MATCHING_ENABLED;
    else process.env.CROSSOVER_MATCHING_ENABLED = originalCrossoverFlag;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("http://localhost/api/cron/crossover-sweeps"));
    expect(res.status).toBe(503);
  });

  it("returns 401 without an Authorization header", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await GET(new Request("http://localhost/api/cron/crossover-sweeps"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong Bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await GET(
      new Request("http://localhost/api/cron/crossover-sweeps", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 with valid cron auth while Crossover Matching is parked", async () => {
    process.env.CRON_SECRET = "test-secret";
    delete process.env.CROSSOVER_MATCHING_ENABLED;

    const res = await GET(
      new Request("http://localhost/api/cron/crossover-sweeps", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: "Crossover Matching is parked",
    });
  });
});
