import { test, expect } from "@playwright/test";

/**
 * E2E (Week 1): a new traveler completes the chatbot quiz and reaches /home
 * with onboarding marked complete.
 *
 * Regression guard for the flagship first-run bug: the quiz used to compute a
 * 4-D personality vector then immediately wipe it (and submitOnboarding threw
 * on empty answers, so onboardingCompleted never stuck). The fix routes the
 * chat flow through completeOnboarding without clobbering derivedData.
 *
 * Registers a fresh account each run (unique email) so it doesn't depend on
 * seed state. Smoke-level: tolerant selectors + a bounded answer loop over the
 * streamed questions.
 */
test.describe("onboarding personalization", () => {
  test("new traveler completes the chat quiz and lands on home", async ({ page }) => {
    const email = `e2e-onboard-${Date.now()}@test.com`;

    await page.goto("/register");
    await page.getByLabel(/display name|name/i).first().fill("E2E Traveler");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign up|create account|register/i }).click();

    // New travelers are routed to onboarding.
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });

    // Open the chatbot quiz and pick a brand tone to start it.
    await page.goto("/onboarding/chat");
    await page.getByRole("button", { name: /Thủ thỉ tâm tình/i }).click();

    // Answer each streamed question by tapping the first answer chip. The loop
    // is bounded; it stops once the done card replaces the chips.
    for (let i = 0; i < 8; i++) {
      const answer = page.getByTestId("quiz-answer").first();
      const ready = await answer
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (!ready) break;
      await answer.click();
      await page.waitForTimeout(600); // let the next question stream in
    }

    // Done card → enter the app.
    await page.getByRole("button", { name: /enter locomate/i }).click();
    await page.waitForURL(/\/home/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/home/);
  });
});
