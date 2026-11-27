import { test, expect } from '@playwright/test'

test.describe('Terms and Privacy', () => {
  test('both pages are public and link to each other', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByTestId('terms-page')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Your content' })
    ).toBeVisible()
    await page.getByTestId('terms-other-link').click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByTestId('privacy-page')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Who sees it' })
    ).toBeVisible()
  })

  test('sign up links to both', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByTestId('signup-terms-link').click()
    await expect(page.getByTestId('terms-page')).toBeVisible()
    await page.goto('/auth/signup')
    await page.getByTestId('signup-privacy-link').click()
    await expect(page.getByTestId('privacy-page')).toBeVisible()
  })
})
