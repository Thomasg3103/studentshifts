import { test, expect } from "@playwright/test";

test.describe("Public page smoke tests", () => {
  test("landing page loads with StudentShifts branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/StudentShifts/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveTitle(/About/i);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("privacy policy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/Privacy/i);
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/Terms/i);
  });

  test("help page loads", async ({ page }) => {
    await page.goto("/help");
    await expect(page).toHaveTitle(/Help/i);
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page).toHaveTitle(/Contact/i);
  });

  test("unknown route redirects to 404", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(/404|not found|page.*not.*found/i).first()).toBeVisible();
  });

  test("login page renders email and password inputs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email'], input[placeholder*='email' i]").first()).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
  });

  test("signup page renders role selection or name input", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("input, select, button").first()).toBeVisible();
  });
});
