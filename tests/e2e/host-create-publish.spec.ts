import { test, expect } from "@playwright/test";

/**
 * E2E: host creates + publishes a marketplace listing.
 *
 * Prerequisites:
 *   - App is reachable at PLAYWRIGHT_BASE_URL (default http://localhost:3000).
 *   - Seed data includes Nam (nam@test.com) as a verified host with
 *     verificationStatus='approved' (see src/server/db/seed.ts).
 *
 * Assertions:
 *   1. Sign in as Nam, land on /host.
 *   2. Navigate to /host/experiences/new.
 *   3. Complete all 5 wizard steps with valid data.
 *   4. Click Publish.
 *   5. Expect toast + redirect to /host/experiences.
 *   6. Verify the new listing appears in the /experiences Local Tours section.
 */

const TITLE_UNIQUE = `E2E Sunrise Walk ${Date.now()}`;

async function signInAsHost(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("nam@test.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(host|home|onboarding)/);
}

test.describe("host create + publish flow", () => {
  test("Nam creates a host_custom experience and publishes it", async ({ page }) => {
    await signInAsHost(page);

    await page.goto("/host/experiences/new");
    await expect(page.getByText("The basics")).toBeVisible();

    // Step 1 -- Basics
    await page.getByLabel(/^title$/i).fill(TITLE_UNIQUE);
    await page.getByLabel(/subtitle/i).fill("Dawn over West Lake");
    await page.getByRole("button", { name: /save & continue/i }).click();

    // Step 2 -- Story
    await expect(page.getByText("Your story")).toBeVisible();
    await page
      .getByLabel(/description/i)
      .fill(
        "A quiet dawn walk around West Lake with freshly-pressed coconut coffee at a local stall and a stop at Tran Quoc Pagoda for sunrise reflections. Good pace, no rush, and a pocketful of stories from growing up here.",
      );
    // Add a highlight
    const highlightInput = page.getByPlaceholder(/add highlights/i);
    await highlightInput.fill("Sunrise at Tran Quoc Pagoda");
    await highlightInput.press("Enter");
    await page.getByRole("button", { name: /save & continue/i }).click();

    // Step 3 -- Schedule
    await expect(page.getByText(/^Schedule$/)).toBeVisible();
    await page.getByPlaceholder(/coffee tasting/i).fill("Meet at West Lake");
    await page.getByRole("button", { name: /^add$/i }).click();
    await page.getByRole("button", { name: /save & continue/i }).click();

    // Step 4 -- Photos (three https URLs)
    await expect(page.getByText(/^Photos$/)).toBeVisible();
    const photoInput = page.getByPlaceholder(/^https:\/\//i);
    for (const url of [
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800",
      "https://images.unsplash.com/photo-1534050359320-02900022671e?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
    ]) {
      await photoInput.fill(url);
      await page.getByRole("button", { name: /^add$/i }).click();
    }
    await page.getByRole("button", { name: /save & continue/i }).click();

    // Step 5 -- Pricing + publish
    await expect(page.getByText(/^Pricing$/)).toBeVisible();
    const publishButton = page.getByTestId("publish-button");
    await expect(publishButton).toBeEnabled();
    await publishButton.click();

    // Redirects back to /host/experiences after success.
    await page.waitForURL(/\/host\/experiences(\?|$)/);
    await expect(page.getByText(TITLE_UNIQUE)).toBeVisible({ timeout: 5_000 });

    // Verify the listing is live on /experiences in the Local Tours section.
    await page.goto("/experiences");
    await page.getByRole("link", { name: /local tours/i }).click();
    await expect(page.locator("#local-tours")).toContainText(TITLE_UNIQUE, { timeout: 5_000 });
  });
});
