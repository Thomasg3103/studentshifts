import { test, expect } from "@playwright/test";

test.describe("Auth flows", () => {
  test("login with wrong credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email'], input[placeholder*='email' i]").first().fill("notareal@example.com");
    await page.locator("input[type='password']").first().fill("wrongpassword123");
    await page.locator("button[type='submit'], button:has-text('Log'), button:has-text('Sign in')").first().click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|wrong|not found|error/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("protected /account redirects when not logged in", async ({ page }) => {
    await page.goto("/account");
    // Should redirect away from /account
    await page.waitForURL((url) => !url.pathname.startsWith("/account"), { timeout: 8_000 });
    await expect(page).not.toHaveURL(/\/account/);
  });

  test("protected /company redirects when not logged in", async ({ page }) => {
    await page.goto("/company");
    await page.waitForURL((url) => !url.pathname.startsWith("/company"), { timeout: 8_000 });
    await expect(page).not.toHaveURL(/\/company/);
  });

  test("protected /applied redirects when not logged in", async ({ page }) => {
    await page.goto("/applied");
    await page.waitForURL((url) => !url.pathname.startsWith("/applied"), { timeout: 8_000 });
    await expect(page).not.toHaveURL(/\/applied/);
  });

  test("signup form validates — submit with empty fields stays on page", async ({ page }) => {
    await page.goto("/signup");
    const submitBtn = page.locator("button[type='submit']").first();
    if (await submitBtn.count() > 0 && !(await submitBtn.isDisabled())) {
      await submitBtn.click();
      await expect(page).toHaveURL(/\/signup/);
    }
  });

  test("email-verified page renders without crash", async ({ page }) => {
    await page.goto("/email-verified");
    await expect(page.locator("body")).toBeVisible();
  });
});
