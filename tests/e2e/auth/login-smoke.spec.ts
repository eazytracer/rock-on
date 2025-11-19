import { test, expect } from '@playwright/test';
import { setupConsoleErrorTracking, assertNoConsoleErrors } from '../../helpers/assertions';

test.describe('Auth Page Smoke Test', () => {
  test('auth page loads without errors', async ({ page }) => {
    // Track console errors
    const errors = setupConsoleErrorTracking(page);

    // Navigate to auth page
    await page.goto('/auth');

    // Check page loads
    await expect(page).toHaveTitle(/Rock On/i);

    // Check for basic auth UI elements (email and some button)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Check there's at least one button (submit or social auth)
    const buttons = page.locator('button');
    await expect(buttons.first()).toBeVisible();

    // No console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('page contains authentication form', async ({ page }) => {
    await page.goto('/auth');

    // Should have email field
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Should have at least one button
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('page title and branding are correct', async ({ page }) => {
    // Page should load successfully (200 status)
    const response = await page.goto('/auth');
    expect(response?.status()).toBe(200);

    // Check title
    await expect(page).toHaveTitle(/Rock On/i);
  });
});
