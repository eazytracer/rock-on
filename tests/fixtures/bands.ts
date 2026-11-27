import { Page, expect } from '@playwright/test'

export interface TestBand {
  id?: string
  name: string
  description?: string
  inviteCode?: string
  ownerId?: string
}

/**
 * Create a band via the UI: New band (`/band/new`, the Get started "Create a
 * band" row), then land on Songs so callers keep their old contract.
 */
export async function createBandViaUI(
  page: Page,
  bandName: string
): Promise<void> {
  if (!page.url().includes('/band/new')) {
    await page.goto('/band/new')
  }
  const name = page.locator('[data-testid="band-new-name-input"]').first()
  await expect(name).toBeVisible({ timeout: 10000 })
  await name.fill(bandName)
  await page.locator('[data-testid="band-new-create"]').first().click()
  // The new band opens with its invite card (a full reload into the band).
  await page.waitForURL(/\/band\?invite=new/, { timeout: 15000 })
  await page.goto('/songs')
  await expect(page.getByTestId('songs-page')).toBeVisible({ timeout: 15000 })
}

/**
 * Get the invite code from the UI after band creation
 * Should be called right after creating a band
 */
export async function getInviteCodeViaUI(page: Page): Promise<string> {
  // The invite card lives on the band page (/band)
  if (new URL(page.url()).pathname !== '/band') {
    await page.goto('/band')
    await page.waitForLoadState('networkidle')
  }

  // Use data-testid for reliable element location (per CLAUDE.md testability standards)
  const inviteCodeElement = page.locator('[data-testid="invite-code"]')

  // Wait for element to be visible
  await expect(inviteCodeElement).toBeVisible({ timeout: 10000 })

  // Get the invite code text
  const inviteCode = await inviteCodeElement.textContent()

  if (!inviteCode || inviteCode.trim().length === 0) {
    throw new Error('Invite code element found but contains no text')
  }

  return inviteCode.trim()
}

/**
 * Join a band via invite code through the UI: the join preview (`/j/:code`),
 * then Join. Ends on Songs, as the old Get started join did.
 */
export async function joinBandViaUI(
  page: Page,
  inviteCode: string
): Promise<void> {
  await page.goto(`/j/${inviteCode}`)
  const join = page.locator('[data-testid="join-band-button"]')
  const invalid = page.locator(
    '[data-testid="join-invalid"], [data-testid="jam-code-invalid"]'
  )
  await expect(join.or(invalid)).toBeVisible({ timeout: 15000 })
  if (await invalid.isVisible()) {
    throw new Error(
      `Join band failed with error: ${await invalid.textContent()}`
    )
  }
  await join.click()
  await page.waitForURL(url => !url.pathname.startsWith('/j'), {
    timeout: 15000,
  })
  await page.goto('/songs')
  await expect(page.getByTestId('songs-page')).toBeVisible({ timeout: 15000 })
}

/**
 * Switch context with the context switcher (sidebar on desktop, header chip on
 * phones). `'personal'` for Personal, otherwise the first band. The switcher
 * reloads the page; this waits for the songs page to settle.
 */
export async function switchContextViaUI(
  page: Page,
  target: 'personal' | 'band'
): Promise<void> {
  await page
    .locator('[data-testid="context-switcher-trigger"]:visible')
    .first()
    .click()
  const option =
    target === 'personal'
      ? page.locator('[data-testid="context-option-personal"]')
      : page.locator('[data-testid^="context-option-band-"]').first()
  await expect(option).toBeVisible({ timeout: 5000 })
  await Promise.all([page.waitForEvent('load'), option.click()])
  await page.waitForLoadState('networkidle').catch(() => {})
}
