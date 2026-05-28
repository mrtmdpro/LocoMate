import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Targets the running app via PLAYWRIGHT_BASE_URL:
 *   - Local dev: start `pnpm dev`, then `pnpm test:e2e`
 *   - CI: PLAYWRIGHT_BASE_URL is set to the Vercel preview URL by the GH Action
 *   - Manual prod check: PLAYWRIGHT_BASE_URL=https://loco-mate.vercel.app pnpm test:e2e
 *
 * We deliberately do NOT spawn the Next dev server from inside Playwright so
 * CI can target a real deploy (faster, more prod-like).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // tests share state (Alex books a tour Nam published)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,            // serialize so the booking chain is deterministic
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
