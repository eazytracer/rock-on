import { Page, expect } from '@playwright/test';

/**
 * Custom assertions for E2E tests
 */

/**
 * Assert that there are no console errors on the page
 */
export async function assertNoConsoleErrors(
  page: Page,
  errors: string[]
): Promise<void> {
  if (errors.length > 0) {
    console.error('Console errors found:', errors);
    throw new Error(
      `Found ${errors.length} console error(s):\n${errors.join('\n')}`
    );
  }
}

/**
 * Assert that a toast message appears with specific text and type
 */
export async function assertToastMessage(
  page: Page,
  message: string,
  type: 'success' | 'error' | 'info' = 'success'
): Promise<void> {
  const toastSelector = `[data-testid="toast-${type}"]`;
  const toast = page.locator(toastSelector);

  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toContainText(message);
}

/**
 * Assert that the page redirected to a specific URL
 */
export async function assertRedirectedTo(page: Page, url: string): Promise<void> {
  await page.waitForURL(url, { timeout: 10000 });
  expect(page.url()).toContain(url);
}

/**
 * Assert that a specific number of elements match a selector
 */
export async function assertElementCount(
  page: Page,
  selector: string,
  count: number
): Promise<void> {
  const elements = page.locator(selector);
  await expect(elements).toHaveCount(count);
}

/**
 * Assert that an element contains specific text
 */
export async function assertElementText(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toContainText(text);
}

/**
 * Assert that an element is visible
 */
export async function assertVisible(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
}

/**
 * Assert that an element is not visible
 */
export async function assertNotVisible(
  page: Page,
  selector: string
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).not.toBeVisible();
}

/**
 * Assert that a form field has a specific value
 */
export async function assertFieldValue(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const field = page.locator(selector);
  await expect(field).toHaveValue(value);
}

/**
 * Assert that a field has an error message
 */
export async function assertFieldError(
  page: Page,
  fieldName: string
): Promise<void> {
  // Look for error message near the field
  const errorSelector = `[data-testid="${fieldName}-error"], .text-amp-red`;
  const error = page.locator(errorSelector);
  await expect(error).toBeVisible();
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  page: Page,
  url?: string | RegExp
): Promise<void> {
  if (url) {
    await page.waitForURL(url, { timeout: 10000 });
  } else {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  }
}

/**
 * Assert that the page has a specific title
 */
export async function assertPageTitle(
  page: Page,
  title: string | RegExp
): Promise<void> {
  await expect(page).toHaveTitle(title);
}

/**
 * Assert that a list is not empty
 */
export async function assertListNotEmpty(
  page: Page,
  listSelector: string
): Promise<void> {
  const items = page.locator(listSelector);
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
}

/**
 * Assert that a list is empty (shows empty state)
 */
export async function assertListEmpty(
  page: Page,
  emptyStateSelector: string
): Promise<void> {
  const emptyState = page.locator(emptyStateSelector);
  await expect(emptyState).toBeVisible();
}

/**
 * Setup console error tracking for a page
 * Returns an array that will be populated with console errors
 */
export function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Setup comprehensive console logging for a page
 * Captures ALL console messages (log, warn, error, info) and outputs them to test console
 */
export function setupConsoleLogging(page: Page): void {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    // Relay browser console logs to test console
    console.log(`[Browser ${type.toUpperCase()}]`, text);
  });

  page.on('pageerror', (error) => {
    console.error('[Browser PAGE ERROR]', error.message);
  });
}

/**
 * Wait for an element to appear and then disappear (e.g., loading spinner)
 */
export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  const element = page.locator(selector);

  // Wait for it to appear first (optional)
  try {
    await element.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // Element might not appear at all, which is fine
  }

  // Wait for it to disappear
  await element.waitFor({ state: 'hidden', timeout });
}

/**
 * Assert that a button is disabled
 */
export async function assertButtonDisabled(
  page: Page,
  selector: string
): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeDisabled();
}

/**
 * Assert that a button is enabled
 */
export async function assertButtonEnabled(
  page: Page,
  selector: string
): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeEnabled();
}
