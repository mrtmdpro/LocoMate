import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runT24hSweep,
  runT28hSweep,
  runT36hSweep,
  runT48hSweep,
} from "@/server/services/crossover-cron";
import { GET } from "./route";

vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/services/crossover-cron", () => ({
  runT24hSweep: vi.fn(async () => ({ cancelled: 4, errors: [], refunded: 4 })),
  runT28hSweep: vi.fn(async () => ({ errors: [], terminated: 3 })),
  runT36hSweep: vi.fn(async () => ({ deduped: 0, errors: [], pushed: 2 })),
  runT48hSweep: vi.fn(async () => ({ consentSet: 1, errors: [], flagged: 1 })),
}));

/**
 * Auth-gate tests for the consolidated crossover-sweeps cron route. We
 * also verify successful dispatch order without touching the DB by mocking
 * the sweep service.
 */
describe("/api/cron/crossover-sweeps auth gate", () => {
  const original = process.env.CRON_SECRET;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
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

  it("runs all sweeps in lifecycle order with a correct Bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";
    const order: string[] = [];
    vi.mocked(runT48hSweep).mockImplementation(async () => {
      order.push("t48");
      return { consentSet: 1, errors: [], flagged: 1 };
    });
    vi.mocked(runT36hSweep).mockImplementation(async () => {
      order.push("t36");
      return { deduped: 0, errors: [], pushed: 2 };
    });
    vi.mocked(runT28hSweep).mockImplementation(async () => {
      order.push("t28");
      return { errors: [], terminated: 3 };
    });
    vi.mocked(runT24hSweep).mockImplementation(async () => {
      order.push("t24");
      return { cancelled: 4, errors: [], refunded: 4 };
    });

    const res = await GET(
      new Request("http://localhost/api/cron/crossover-sweeps", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: {
        t24: { cancelled: 4, refunded: 4 },
        t28: { terminated: 3 },
        t36: { pushed: 2 },
        t48: { flagged: 1 },
      },
      sweep: "crossover-sweeps",
    });
    expect(order).toEqual(["t48", "t36", "t28", "t24"]);
  });
});
