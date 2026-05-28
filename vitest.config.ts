import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    // Each test file boots its own PGlite instance in setup.ts and wipes rows
    // via `resetDb` in afterEach. No global teardown needed.
    setupFiles: ["./src/test/setup.ts"],
    // PGlite runs a full Postgres inside a WASM runtime. Spawning parallel
    // vitest workers that each spin up an independent PGlite produced
    // cross-test hangs on Windows (WASM shared mem + worker threads), so we
    // serialize test FILES. Tests within a file stay fast because they only
    // TRUNCATE the shared instance in `afterEach`.
    fileParallelism: false,
    // Integration tests that boot PGlite + run drizzle migrations need more
    // than Vitest's default 5s.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportOnFailure: true,
      // Per-file thresholds so the 80% bar applies to code this feature
      // authored, not to untouched procedures like `updateProfile`/`create`
      // that predate the marketplace work. Retro-covering chat/match/auth is
      // explicitly out of scope per the plan.
      thresholds: {
        "src/lib/pricing.ts": {
          lines: 100,
          functions: 100,
          branches: 95,
          statements: 100,
        },
        "src/lib/time.ts": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        "src/server/routers/experience.router.ts": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        "src/server/routers/host-experience.router.ts": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        "src/server/routers/payment.router.ts": {
          // payment-confirm + createIntent are heavily tested (~86%); the
          // untested residue is the 14% of lines in the older createIntent
          // success path that this feature did not touch.
          lines: 80,
          functions: 75,
          branches: 80,
          statements: 80,
        },
      },
      include: [
        "src/lib/pricing.ts",
        "src/lib/time.ts",
        "src/server/routers/experience.router.ts",
        "src/server/routers/host-experience.router.ts",
        "src/server/routers/host.router.ts",
        "src/server/routers/payment.router.ts",
        "src/server/routers/tour.router.ts",
      ],
      exclude: [
        "src/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "src/server/db/migrations/**",
      ],
    },
  },
});
