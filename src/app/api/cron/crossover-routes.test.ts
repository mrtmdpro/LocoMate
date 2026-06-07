import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runT24hSweep,
  runT28hSweep,
  runT36hSweep,
  runT48hSweep,
} from "@/server/services/crossover-cron";
import { GET as getT24 } from "./crossover-t24/route";
import { GET as getT28 } from "./crossover-t28/route";
import { GET as getT36 } from "./crossover-t36/route";
import { GET as getT48 } from "./crossover-t48/route";

vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/services/crossover-cron", () => ({
  runT24hSweep: vi.fn(async () => ({ cancelled: 24, errors: [], refunded: 24 })),
  runT28hSweep: vi.fn(async () => ({ errors: [], terminated: 28 })),
  runT36hSweep: vi.fn(async () => ({ deduped: 0, errors: [], pushed: 36 })),
  runT48hSweep: vi.fn(async () => ({ consentSet: 48, errors: [], flagged: 48 })),
}));

const routes = [
  {
    get: getT48,
    path: "/api/cron/crossover-t48",
    run: runT48hSweep,
    sweep: "crossover-t48",
  },
  {
    get: getT36,
    path: "/api/cron/crossover-t36",
    run: runT36hSweep,
    sweep: "crossover-t36",
  },
  {
    get: getT28,
    path: "/api/cron/crossover-t28",
    run: runT28hSweep,
    sweep: "crossover-t28",
  },
  {
    get: getT24,
    path: "/api/cron/crossover-t24",
    run: runT24hSweep,
    sweep: "crossover-t24",
  },
];

describe("split crossover cron routes", () => {
  const original = process.env.CRON_SECRET;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    vi.clearAllMocks();
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  for (const route of routes) {
    it(`${route.sweep} rejects unauthorized callers`, async () => {
      const res = await route.get(new Request(`http://localhost${route.path}`));

      expect(res.status).toBe(401);
      expect(route.run).not.toHaveBeenCalled();
    });

    it(`${route.sweep} runs only its own sweep`, async () => {
      const res = await route.get(
        new Request(`http://localhost${route.path}`, {
          headers: { authorization: "Bearer test-secret" },
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ ok: true, sweep: route.sweep });
      expect(route.run).toHaveBeenCalledTimes(1);
      for (const other of routes.filter((candidate) => candidate.sweep !== route.sweep)) {
        expect(other.run).not.toHaveBeenCalled();
      }
    });
  }
});
