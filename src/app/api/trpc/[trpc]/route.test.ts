import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("/api/trpc crossover public feature flag", () => {
  const originalCrossoverFlag = process.env.CROSSOVER_MATCHING_ENABLED;

  afterEach(() => {
    if (originalCrossoverFlag === undefined) delete process.env.CROSSOVER_MATCHING_ENABLED;
    else process.env.CROSSOVER_MATCHING_ENABLED = originalCrossoverFlag;
  });

  it("blocks public crossover procedures while the product surface is parked", async () => {
    delete process.env.CROSSOVER_MATCHING_ENABLED;

    const res = await GET(
      new Request(
        "http://localhost/api/trpc/crossover.getCapacityStatus?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22tourId%22%3A%2200000000-0000-0000-0000-000000000000%22%7D%7D%7D",
      ),
    );

    expect(res.status).toBe(503);
    await expect(res.text()).resolves.toBe("Crossover Matching is parked");
  });
});
