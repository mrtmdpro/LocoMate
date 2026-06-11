import { test, expect } from "@playwright/test";

/**
 * E2E (Week 4): a logged-out visitor can move between public surfaces via the
 * marketing header. Before the header existed, public pages had no inter-page
 * nav and the acquisition funnel leaked (visitors were stranded with only a
 * "sign up" CTA).
 *
 * No auth / no seed state required — the most robust spec in the suite.
 */
test.describe("public marketing nav", () => {
  test("the marketing header links between public surfaces", async ({ page }) => {
    await page.goto("/explore");

    // Header CTA is present for signed-out visitors.
    await expect(
      page.getByRole("link", { name: /sign up free/i }).first(),
    ).toBeVisible();

    // Jump to the Fixed Tours hub via the header link.
    await page.getByRole("link", { name: /fixed tours/i }).first().click();
    await expect(page).toHaveURL(/\/experiences(\?|$)/);

    // And to the hosts directory.
    await page.getByRole("link", { name: /^hosts$/i }).first().click();
    await expect(page).toHaveURL(/\/hosts(\?|$)/);

    // Log in is reachable from the header.
    await page.getByRole("link", { name: /^log in$/i }).first().click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
