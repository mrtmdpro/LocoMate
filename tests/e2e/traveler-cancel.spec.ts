import { test, expect } from "@playwright/test";

/**
 * E2E (Week 2): book a Fixed Tour → pay (simulated) → cancel with the refund
 * dialog. Regression guard for the missing traveler cancel/refund lifecycle
 * (tour.cancelByTraveler + the refund-quote dialog).
 *
 * This is the most integration-heavy spec (book → checkout → pay → cancel), so
 * its selectors are the most likely to need a tune on first run against the
 * live seeded app. It books a date ~5 days out so the T−48h cutoff doesn't
 * disable Pay.
 */
async function signInAsTraveler(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("alex@test.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(home|onboarding)/);
}

function isoDaysAhead(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

test.describe("traveler cancel + refund", () => {
  test("Alex books a Fixed Tour, pays, then cancels for a full refund", async ({ page }) => {
    await signInAsTraveler(page);

    // Open the Fixed Tour hub and pick the first tour.
    await page.goto("/experiences");
    const firstTour = page.locator('a[href*="/fixed-tours/"]').first();
    await expect(firstTour).toBeVisible({ timeout: 10_000 });
    await firstTour.click();
    await expect(page).toHaveURL(/\/fixed-tours\/[^/]+$/);

    // Fill the inline booking form (groupSize defaults to the 2-person min).
    await page.locator('input[type="date"]').fill(isoDaysAhead(5));
    const timeInput = page.locator('input[type="time"]');
    if (await timeInput.isVisible().catch(() => false)) {
      await timeInput.fill("08:00");
    }
    await page.getByTestId("fixed-tour-book-button").click();

    // Lands on checkout; pay (simulated gateway).
    await page.waitForURL(/\/tour\/[^/]+\/checkout$/, { timeout: 10_000 });
    await page.getByRole("button", { name: /secure payment|pay\b/i }).click();

    // Payment confirm routes to the tour detail page.
    await page.waitForURL(/\/tour\/[^/]+$/, { timeout: 15_000 });

    // Cancel → refund dialog shows the computed refund → confirm.
    await page.getByTestId("cancel-booking-trigger").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/refund/i)).toBeVisible();
    await page.getByTestId("confirm-cancel-button").click();

    // Lands back on tour history with a cancellation confirmation toast.
    await page.waitForURL(/\/tours(\?|$)/, { timeout: 10_000 });
    await expect(page.getByText(/cancelled/i)).toBeVisible({ timeout: 10_000 });
  });
});
