/**
 * Helper functions for interacting with InlineEditableField components in E2E tests.
 *
 * InlineEditableField components have a click-to-edit pattern:
 * 1. Display mode: Shows a clickable div with data-testid="{name}-display"
 * 2. Edit mode: After clicking, shows an input with data-testid="{name}-input"
 *
 * Usage:
 *   await clickToEdit(page, 'practice-location')
 *   await page.locator('[data-testid="practice-location-input"]').fill('My Value')
 *   await page.keyboard.press('Enter')
 */

import { Page, expect } from '@playwright/test'

/**
 * Clicks on an InlineEditableField's display element to enter edit mode.
 * Uses JavaScript click for reliability as Playwright's click can have timing issues.
 *
 * @param page - Playwright Page object
 * @param testId - The base test ID (without -display or -input suffix)
 * @param timeout - Maximum time to wait for elements (default: 5000ms)
 * @returns The input locator for chaining
 */
export async function clickToEdit(
  page: Page,
  testId: string,
  timeout = 5000
): Promise<void> {
  const displaySelector = `[data-testid="${testId}-display"]`
  const inputSelector = `[data-testid="${testId}-input"]`

  // Wait for the display element to be visible
  await page.waitForSelector(displaySelector, {
    state: 'visible',
    timeout,
  })

  // Use JavaScript click for reliability (Playwright's click can have timing issues
  // with React state updates in InlineEditableField)
  await page.evaluate(selector => {
    const element = document.querySelector(selector)
    if (element) {
      ;(element as HTMLElement).click()
    }
  }, displaySelector)

  // Wait for the input to appear
  await page.waitForSelector(inputSelector, {
    state: 'visible',
    timeout,
  })
}

/**
 * Fills an InlineEditableField with a value, handling the click-to-edit flow.
 *
 * @param page - Playwright Page object
 * @param testId - The base test ID (without -display or -input suffix)
 * @param value - The value to fill
 * @param options - Additional options
 */
export async function fillInlineEditableField(
  page: Page,
  testId: string,
  value: string,
  options: {
    timeout?: number
    pressEnter?: boolean
    waitAfterSave?: number
  } = {}
): Promise<void> {
  const { timeout = 5000, pressEnter = true, waitAfterSave = 300 } = options
  const inputSelector = `[data-testid="${testId}-input"]`

  // Check if already in edit mode (input visible)
  const inputVisible = await page
    .locator(inputSelector)
    .isVisible()
    .catch(() => false)

  if (!inputVisible) {
    // Need to click to enter edit mode
    await clickToEdit(page, testId, timeout)
  }

  // Fill the input
  const input = page.locator(inputSelector)
  await input.clear()
  await input.fill(value)

  // Save by pressing Enter if requested
  if (pressEnter) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(waitAfterSave)
  }
}

/**
 * Verifies an InlineEditableField displays the expected value.
 *
 * @param page - Playwright Page object
 * @param testId - The base test ID (without -display or -input suffix)
 * @param expectedValue - The expected display value
 * @param timeout - Maximum time to wait (default: 5000ms)
 */
export async function expectInlineEditableValue(
  page: Page,
  testId: string,
  expectedValue: string,
  timeout = 5000
): Promise<void> {
  const displaySelector = `[data-testid="${testId}-display"]`

  await expect(page.locator(displaySelector)).toContainText(expectedValue, {
    timeout,
  })
}

/**
 * Checks if an InlineEditableField is currently in edit mode.
 *
 * @param page - Playwright Page object
 * @param testId - The base test ID (without -display or -input suffix)
 * @returns true if in edit mode (input visible), false otherwise
 */
export async function isInEditMode(
  page: Page,
  testId: string
): Promise<boolean> {
  const inputSelector = `[data-testid="${testId}-input"]`
  return page
    .locator(inputSelector)
    .isVisible()
    .catch(() => false)
}

/**
 * Clicks a button using JavaScript for reliability.
 * This is necessary when Playwright's click doesn't trigger React event handlers properly.
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector for the button
 * @param timeout - Maximum time to wait for button (default: 5000ms)
 */
export async function clickButtonReliably(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  // Wait for the button to be visible
  await page.waitForSelector(selector, {
    state: 'visible',
    timeout,
  })

  // Use JavaScript click for reliability
  await page.evaluate(sel => {
    const element = document.querySelector(sel)
    if (element) {
      ;(element as HTMLElement).click()
    }
  }, selector)
}

/**
 * Clicks an element in the Browse Songs drawer using JavaScript.
 * Handles elements that may be outside the viewport.
 * Supports Playwright locator strings like 'button:has-text("...")'.
 *
 * @param page - Playwright Page object
 * @param locatorString - Playwright locator string (e.g., 'button:has-text("Song Name")')
 * @param timeout - Maximum time to wait (default: 5000ms)
 */
export async function clickInDrawer(
  page: Page,
  locatorString: string,
  timeout = 5000
): Promise<void> {
  // Create a Playwright locator from the string
  const locator = page.locator(locatorString)

  // Wait for the element to be visible
  await locator.waitFor({ state: 'visible', timeout })

  // Get the element handle and use JavaScript to click it
  const elementHandle = await locator.elementHandle()
  if (elementHandle) {
    await elementHandle.evaluate(el => {
      // Scroll element into view first
      el.scrollIntoView({ behavior: 'instant', block: 'center' })
      ;(el as HTMLElement).click()
    })
  }
}

/**
 * Closes the Browse Songs drawer if it's open.
 * This drawer can interfere with button clicks on the practice page.
 * Uses JavaScript click to handle cases where the button may be outside viewport.
 *
 * @param page - Playwright Page object
 */
export async function closeBrowseSongsDrawer(page: Page): Promise<void> {
  const closeButtonSelector = '[data-testid="slide-out-tray-close"]'

  // Check if drawer is visible
  const isVisible = await page
    .locator(closeButtonSelector)
    .isVisible({ timeout: 1000 })
    .catch(() => false)

  if (isVisible) {
    // Use JavaScript click to handle elements outside viewport
    await page.evaluate(selector => {
      const element = document.querySelector(selector)
      if (element) {
        ;(element as HTMLElement).click()
      }
    }, closeButtonSelector)
    await page.waitForTimeout(500) // Wait for drawer animation
  }
}
