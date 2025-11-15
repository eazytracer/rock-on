import { test, expect } from '@playwright/test';

test.describe('Signup Debug Test', () => {
  test('can manually sign up step by step', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth');
    await expect(page).toHaveURL('/auth');

    // Take screenshot
    await page.screenshot({ path: '/tmp/step1-auth-page.png' });

    // Switch to signup
    const switchButton = page.locator('button:has-text("Don\'t have an account")');
    await switchButton.click();

    await page.screenshot({ path: '/tmp/step2-signup-form.png' });

    // Fill form
    const timestamp = Date.now();
    const email = `test${timestamp}@rockontesting.com`;
    const password = 'TestPassword123!';
    const name = `Test User ${timestamp}`;

    await page.fill('[data-testid="signup-name-input"]', name);
    await page.fill('[data-testid="signup-email-input"]', email);
    await page.fill('[data-testid="signup-password-input"]', password);
    await page.fill('[data-testid="signup-confirm-password-input"]', password);

    await page.screenshot({ path: '/tmp/step3-form-filled.png' });

    // Listen for console messages and network requests
    page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
    page.on('response', response => {
      if (response.url().includes('auth') || response.url().includes('signup')) {
        console.log('AUTH RESPONSE:', response.status(), response.url());
      }
    });

    // Submit form
    console.log('Clicking submit button...');
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Wait a moment to see what happens
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/step4-after-submit.png' });

    const currentURL = page.url();
    console.log('Current URL after submit:', currentURL);

    // Check what's on the page
    const bodyText = await page.textContent('body');
    console.log('Page body text:', bodyText?.substring(0, 500));
  });
});
