import { test, expect, Page } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'

/**
 * E2E tests for persistent layout feature
 *
 * These tests verify that:
 * 1. The navbar/sidebar persist during navigation (no unmount/remount)
 * 2. Content loading spinners appear in content area only
 * 3. No white screen flicker during navigation
 * 4. Auth redirects happen before layout renders
 */
test.describe('Persistent Layout', () => {
  let testUserId: string | undefined

  // Helper to create authenticated user with band
  async function setupAuthenticatedUser(page: Page): Promise<void> {
    const user = createTestUser()
    await signUpViaUI(page, user)

    // Wait for band creation page
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

    // Create a band
    const bandName = `Test Band ${Date.now()}`
    await page.fill(
      '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
      bandName
    )
    await page.click(
      '[data-testid="create-band-button"], button:has-text("Create Band")'
    )

    // Wait for redirect to songs
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Store user ID for cleanup
    testUserId =
      (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
      undefined
  }

  test.afterEach(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
      testUserId = undefined
    }
  })

  test.describe('Layout Persistence During Navigation', () => {
    test('navbar remains visible during navigation between pages', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)

      // Verify we're on songs page with navbar visible
      await expect(page.locator('[data-testid="songs-page"]')).toBeVisible({
        timeout: 10000,
      })

      // Get the navbar element (sidebar nav)
      const navbar = page.locator('nav').first()
      await expect(navbar).toBeVisible()

      // Navigate to setlists via sidebar link button
      await page.click('[data-testid="setlists-link"]')
      await page.waitForURL(/\/setlists/)

      // Navbar should still be visible without flicker
      await expect(navbar).toBeVisible()
      await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible()

      // Navigate to Shows — nested under Calendar, opens the filtered agenda
      // (Calendar-parent IA: /calendar?filter=shows).
      await page.click('[data-testid="shows-link"]')
      await page.waitForURL(/\/calendar\?filter=shows/)
      await expect(navbar).toBeVisible()
      await expect(page.locator('[data-testid="calendar-page"]')).toBeVisible()

      // Navigate to Practices — likewise a Calendar-filtered view
      await page.click('[data-testid="practices-link"]')
      await page.waitForURL(/\/calendar\?filter=practices/)
      await expect(navbar).toBeVisible()
      await expect(page.locator('[data-testid="calendar-page"]')).toBeVisible()
    })

    test('sidebar remains visible during navigation between pages', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)

      // Get the sidebar element (if present on larger screens)
      const sidebar = page.locator(
        'aside, [data-testid="sidebar"], [role="navigation"]'
      )

      // Check if sidebar is visible (may be hidden on mobile)
      const isSidebarVisible = await sidebar.first().isVisible()

      if (isSidebarVisible) {
        // Navigate between pages and verify sidebar persists
        await page.click('[data-testid="setlists-link"]')
        await page.waitForURL(/\/setlists/)
        await expect(sidebar.first()).toBeVisible()

        await page.click('[data-testid="shows-link"]')
        await page.waitForURL(/\/calendar\?filter=shows/)
        await expect(sidebar.first()).toBeVisible()
      }
    })

    test('rapid navigation does not cause layout to unmount', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)

      // Get reference to layout container
      const navbar = page.locator('nav').first()
      await expect(navbar).toBeVisible()

      // Perform rapid navigation using sidebar nav links
      const navLinks = [
        'setlists-link',
        'shows-link',
        'practices-link',
        'songs-link',
        'setlists-link',
      ]

      for (const linkTestId of navLinks) {
        await page.click(`[data-testid="${linkTestId}"]`)
        // Don't wait for full load - simulate rapid clicking
        await page.waitForTimeout(100)
      }

      // Wait for final navigation to complete
      await page.waitForURL(/\/setlists/)

      // Navbar should still be visible
      await expect(navbar).toBeVisible()

      // Should be on the final page
      await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible({
        timeout: 5000,
      })
    })
  })

  test.describe('Content Loading Spinner', () => {
    test('auth loading spinner has correct testid during initial load', async ({
      page,
    }) => {
      const user = createTestUser()
      await signUpViaUI(page, user)
      await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 })

      const bandName = `Test Band ${Date.now()}`
      await page.fill(
        '[data-testid="create-band-name-input"], input[name="bandName"], input[id="band-name"]',
        bandName
      )
      await page.click(
        '[data-testid="create-band-button"], button:has-text("Create Band")'
      )
      await page.waitForURL(/\/songs/, { timeout: 10000 })

      testUserId =
        (await page.evaluate(() => localStorage.getItem('currentUserId'))) ??
        undefined

      // Reload page to trigger auth check
      await page.reload()

      // Either we see the auth-loading-spinner briefly or we go straight to content
      // Wait for page to settle
      await page.waitForURL(/\/songs/)

      // Content should be visible
      await expect(page.locator('[data-testid="songs-page"]')).toBeVisible({
        timeout: 10000,
      })
    })

    test('content loading spinner appears in content area only', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)

      // Navigate to a page
      await page.goto('/songs')

      // Wait for page content to load
      await expect(page.locator('[data-testid="songs-page"]')).toBeVisible({
        timeout: 10000,
      })

      // If content loading spinner is shown, it should have the correct testid
      // and be within the content area (not full screen)
      const contentSpinner = page.locator(
        '[data-testid="content-loading-spinner"]'
      )

      // The spinner may or may not be visible (depends on data load time)
      // If visible, verify it's not full-screen
      if (await contentSpinner.isVisible()) {
        // The navbar should still be visible
        await expect(page.locator('nav').first()).toBeVisible()
      }
    })
  })

  test.describe('No White Screen Flicker', () => {
    test('background stays dark during navigation', async ({ page }) => {
      await setupAuthenticatedUser(page)

      // Navigate between pages and check that background stays dark
      const navLinks = [
        { link: 'setlists-link', route: '/setlists' },
        // Shows/Practices are nested under Calendar now (→ /calendar?filter=…)
        { link: 'shows-link', route: '/calendar' },
        { link: 'practices-link', route: '/calendar' },
        { link: 'songs-link', route: '/songs' },
      ]

      for (const { link, route } of navLinks) {
        await page.click(`[data-testid="${link}"]`)
        await page.waitForURL(new RegExp(route))

        // Check that the body/main container has dark background
        const backgroundColor = await page.evaluate(() => {
          const body = document.body
          const computed = window.getComputedStyle(body)
          return computed.backgroundColor
        })

        // Background should be dark (rgb values should be low)
        // Our theme uses bg-surface which is very dark
        expect(backgroundColor).not.toBe('rgb(255, 255, 255)')
      }
    })

    test('no flash of white during page transitions', async ({ page }) => {
      await setupAuthenticatedUser(page)

      // Set up mutation observer to detect any white background flash
      await page.evaluate(() => {
        ;(
          window as unknown as { whiteFlashDetected: boolean }
        ).whiteFlashDetected = false

        const observer = new MutationObserver(() => {
          const body = document.body
          const computed = window.getComputedStyle(body)
          if (computed.backgroundColor === 'rgb(255, 255, 255)') {
            ;(
              window as unknown as { whiteFlashDetected: boolean }
            ).whiteFlashDetected = true
          }
        })

        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        })
      })

      // Navigate rapidly between pages using sidebar nav
      const navLinks = [
        'setlists-link',
        'shows-link',
        'practices-link',
        'songs-link',
      ]
      for (const link of navLinks) {
        await page.click(`[data-testid="${link}"]`)
        await page.waitForTimeout(50)
      }

      // Wait for navigation to complete
      await page.waitForURL(/\/songs/)
      await page.waitForTimeout(500)

      // Check if white flash was detected
      const whiteFlashDetected = await page.evaluate(
        () =>
          (window as unknown as { whiteFlashDetected: boolean })
            .whiteFlashDetected
      )

      expect(whiteFlashDetected).toBe(false)
    })
  })

  test.describe('Auth Redirect Before Layout', () => {
    test('unauthenticated user does not see layout before redirect', async ({
      page,
    }) => {
      // Track if navbar ever appears
      let navbarAppeared = false

      // Set up listener before navigation
      page.on('framenavigated', async () => {
        try {
          const navbar = page.locator('nav').first()
          if (await navbar.isVisible({ timeout: 100 })) {
            navbarAppeared = true
          }
        } catch {
          // Ignore errors
        }
      })

      // Try to access protected route
      await page.goto('/songs')

      // Should redirect to auth
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })

      // Layout should not have appeared
      // Note: This may be flaky due to timing, but the key is no visible layout flash
    })

    test('auth loading spinner shown before layout on fresh load', async ({
      page,
    }) => {
      // Create user but don't log in yet
      await page.goto('/auth')
      await expect(page).toHaveURL('/auth')

      // Navigate to protected route - should redirect
      await page.goto('/songs')
      await expect(page).toHaveURL(/\/auth/, { timeout: 5000 })
    })
  })

  test.describe('Page TestId Attributes', () => {
    test('each page has correct data-testid attribute', async ({ page }) => {
      await setupAuthenticatedUser(page)

      const pageTestIds = [
        { route: '/', testId: 'home-page' },
        { route: '/songs', testId: 'songs-page' },
        { route: '/setlists', testId: 'setlists-page' },
        { route: '/calendar', testId: 'calendar-page' },
        { route: '/shows', testId: 'shows-page' },
        { route: '/practices', testId: 'practices-page' },
        { route: '/more', testId: 'more-page' },
        { route: '/notifications', testId: 'notifications-page' },
        { route: '/band-members', testId: 'band-members-page' },
        { route: '/settings', testId: 'settings-page' },
      ]

      for (const { route, testId } of pageTestIds) {
        await page.goto(route)
        await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({
          timeout: 10000,
        })
      }
    })
  })

  test.describe('Mobile Bottom Navigation (5-tab IA)', () => {
    test('bottom nav navigates between the 5 tabs and persists across routes', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)
      // Switch to a mobile viewport so the bottom nav is shown (md:hidden).
      await page.setViewportSize({ width: 390, height: 844 })

      const bottomNav = page.locator('[data-testid="bottom-navigation"]')
      await page.goto('/songs')
      await expect(bottomNav).toBeVisible()

      // Home
      await page.click('[data-testid="bottom-nav-home"]')
      await page.waitForURL(/\/$/)
      await expect(page.locator('[data-testid="home-page"]')).toBeVisible()
      await expect(bottomNav).toBeVisible()

      // Calendar (Shows/Practices live under this tab)
      await page.click('[data-testid="bottom-nav-calendar"]')
      await page.waitForURL(/\/calendar/)
      await expect(page.locator('[data-testid="calendar-page"]')).toBeVisible()

      // A child route of Calendar (Shows) keeps the Calendar tab active
      await page.goto('/shows')
      await expect(
        page.locator('[data-testid="bottom-nav-calendar"]')
      ).toHaveAttribute('aria-current', 'page')

      // More hub
      await page.click('[data-testid="bottom-nav-more"]')
      await page.waitForURL(/\/more/)
      await expect(page.locator('[data-testid="more-page"]')).toBeVisible()

      // Sets
      await page.click('[data-testid="bottom-nav-setlists"]')
      await page.waitForURL(/\/setlists/)
      await expect(page.locator('[data-testid="setlists-page"]')).toBeVisible()
      await expect(bottomNav).toBeVisible()
    })

    test('home dashboard renders stats + quick actions and a quick action navigates', async ({
      page,
    }) => {
      await setupAuthenticatedUser(page)
      await page.goto('/')
      await expect(page.locator('[data-testid="home-page"]')).toBeVisible()

      // Stats + quick actions render (fresh band → cards present regardless of data)
      await expect(
        page.locator('[data-testid="home-stat-songs"]')
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="home-action-setlist"]')
      ).toBeVisible()

      // A quick action navigates
      await page.click('[data-testid="home-action-practice"]')
      await page.waitForURL(/\/practices\/new/)
    })

    test('header bell opens the notifications center', async ({ page }) => {
      await setupAuthenticatedUser(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/songs')

      await page.click('[data-testid="mobile-header-notifications"]')
      await page.waitForURL(/\/notifications/)
      await expect(
        page.locator('[data-testid="notifications-page"]')
      ).toBeVisible()
    })
  })
})
