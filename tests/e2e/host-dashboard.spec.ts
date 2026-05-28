import { test, expect } from "@playwright/test";

/**
 * E2E: host sees the "My experiences" card on /host and can land on
 * /host/experiences.
 *
 * Prerequisites:
 *   - Nam (nam@test.com) is a verified host with at least one experience
 *     (created by host-create-publish.spec.ts or by seed).
 *
 * The "today's bookings" appearance is NOT asserted here because it requires
 * the traveler-book spec to succeed on a date that matches Vietnam "today",
 * which is fragile across timezones. That path is covered by the host
 * dashboard integration test in src/server/routers/host.router.test.ts.
 */

async function signInAsHost(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("nam@test.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(home|onboarding)/);
}

test.describe("host dashboard", () => {
  test("My experiences card renders live counts and deep-links to the list", async ({ page }) => {
    await signInAsHost(page);
    await page.goto("/host");

    const card = page.getByText(/my experiences/i).first();
    await expect(card).toBeVisible();
    // Counts render in the card footer text.
    await expect(page.locator("body")).toContainText(/\d+ published/);

    // Click deep-links to /host/experiences.
    await card.click();
    await page.waitForURL(/\/host\/experiences/);
    await expect(page.getByRole("heading", { name: /my experiences/i })).toBeVisible();
  });
});
