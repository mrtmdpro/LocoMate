import { test, expect } from "@playwright/test";

/**
 * E2E (Week 2): à-la-carte order history is reachable and rendered.
 *
 * Regression guard for the "buy something, never see it again" dead-end:
 * order.getHistory was dead code, there was no /orders index, and the profile
 * had no link to it. This verifies the new surface + its profile entry point.
 *
 * Uses the seeded traveler (alex@test.com). Smoke-level: it asserts the order
 * history surface and its profile link, which don't depend on the traveler
 * having any orders yet (the empty state is valid).
 */
async function signInAsTraveler(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("alex@test.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(home|onboarding)/);
}

test.describe("commerce — order history", () => {
  test("/orders renders for a signed-in traveler", async ({ page }) => {
    await signInAsTraveler(page);
    await page.goto("/orders");
    await expect(
      page.getByRole("heading", { name: /my orders/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("profile links to order history", async ({ page }) => {
    await signInAsTraveler(page);
    await page.goto("/profile");
    await page.getByRole("link", { name: /my orders/i }).click();
    await expect(page).toHaveURL(/\/orders(\?|$)/);
  });
});
