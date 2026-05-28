import { test, expect } from "@playwright/test";

/**
 * E2E: traveler books a host_custom experience end-to-end.
 *
 * Prerequisites:
 *   - A published host-authored experience exists (created by
 *     host-create-publish.spec.ts or by seed data).
 *   - Alex (alex@test.com / password123) is in the seed as a traveler.
 *
 * This spec deliberately uses the first host_custom listing it finds on the
 * public feed so it works both after host-create-publish.spec.ts and against
 * a seeded database.
 */

async function signInAsTraveler(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("alex@test.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(home|onboarding)/);
}

test.describe("traveler booking flow", () => {
  test("Alex books a host-authored experience and lands on checkout", async ({ page }) => {
    await signInAsTraveler(page);

    // Open marketplace and filter to host-made listings.
    await page.goto("/experiences");
    await page.getByRole("button", { name: /by local hosts/i }).click();

    // Click the first visible experience card.
    const firstCard = page.locator('a[href*="/experiences/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    // Wait for detail page.
    await expect(page).toHaveURL(/\/experiences\/[^/]+$/);

    // Open booking dialog.
    await page.getByTestId("book-button").click();
    await expect(page.getByRole("heading", { name: /^book/i })).toBeVisible();

    // Pick a near-future date (tomorrow Vietnam time).
    const vn = new Date(Date.now() + 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
    const isoDate = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, "0")}-${String(vn.getUTCDate()).padStart(2, "0")}`;
    await page.getByLabel(/^date$/i).fill(isoDate);

    // Confirm booking.
    await page.getByTestId("confirm-book-button").click();

    // Should route to /tour/:id/checkout.
    await page.waitForURL(/\/tour\/[^/]+\/checkout$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();

    // Checkout shows a non-placeholder VND amount.
    await expect(page.locator("body")).toContainText(/\d{3,}[\s,]\d{3}\s*VND/i);
  });
});
