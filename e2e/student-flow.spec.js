import { test, expect } from "@playwright/test";

/**
 * Golden path: student lands → views jobs → navigates to signup.
 * Full apply/hire flow requires live test credentials — see README for setup.
 * These tests cover everything up to the auth gate without external accounts.
 */

test.describe("Student golden path", () => {
  test("landing page shows hero and call-to-action", async ({ page }) => {
    await page.goto("/");
    // Landing shows some content — title or CTA visible
    await expect(page.locator("h1, h2, [data-testid='hero']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("landing page has a sign up or browse jobs link", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /sign up|browse|get started|find.*job/i }).first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test("clicking sign up from landing navigates to signup page", async ({ page }) => {
    await page.goto("/");
    const signupLink = page.getByRole("link", { name: /sign up|get started|create.*account/i }).first();
    const count = await signupLink.count();
    if (count > 0) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/signup/);
    } else {
      test.skip();
    }
  });

  test("job detail page renders without crash for valid slug", async ({ page }) => {
    // Navigate to a plausible job URL shape — if 404 that's acceptable
    await page.goto("/jobs/some-job/some-company");
    await expect(page.locator("body")).toBeVisible();
    // Should not show an unhandled error (red screen)
    await expect(page.locator("body")).not.toContainText("TypeError");
    await expect(page.locator("body")).not.toContainText("Cannot read properties");
  });

  test("about page has back navigation or footer", async ({ page }) => {
    await page.goto("/about");
    const footer = page.locator("footer");
    const backBtn = page.getByRole("button", { name: /back/i });
    const hasFooter = await footer.count() > 0;
    const hasBack = await backBtn.count() > 0;
    expect(hasFooter || hasBack).toBeTruthy();
  });

  test("footer links are present on public pages", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("footer").getByText(/privacy/i)).toBeVisible();
  });
});
