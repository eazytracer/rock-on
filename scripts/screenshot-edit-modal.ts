#!/usr/bin/env npx ts-node
/**
 * Playwright Screenshot Script for Edit Song Modal
 *
 * Captures screenshots of the Edit Song Modal with various states
 * to verify UI changes without using MCP tools (saves context tokens).
 *
 * Usage:
 *   npx playwright test scripts/screenshot-edit-modal.ts --headed
 *
 * Or run directly:
 *   npx ts-node scripts/screenshot-edit-modal.ts
 *
 * Screenshots are saved to: .playwright-mcp/
 */

import { chromium, Browser, Page } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:5175'
const SCREENSHOT_DIR = path.join(__dirname, '..', '.playwright-mcp')

// Test user credentials (from e2e fixtures)
const TEST_EMAIL = `screenshot-test-${Date.now()}@example.com`
const TEST_PASSWORD = 'Test123!@#'

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function takeScreenshot(page: Page, name: string) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: false })
  console.log(`📸 Saved: ${filepath}`)
}

async function signUp(page: Page) {
  await page.goto(`${BASE_URL}/auth`)
  await page.waitForTimeout(1000)

  // Click "Sign Up" tab
  await page.click('button:has-text("Sign Up")')
  await page.waitForTimeout(500)

  // Fill form
  await page.fill('[data-testid="signup-email-input"]', TEST_EMAIL)
  await page.fill('[data-testid="signup-password-input"]', TEST_PASSWORD)
  await page.fill(
    '[data-testid="signup-confirm-password-input"]',
    TEST_PASSWORD
  )

  // Submit
  await page.click('[data-testid="signup-submit-button"]')
  await page.waitForTimeout(2000)
}

async function createBand(page: Page) {
  // Should be on get-started page
  await page.waitForSelector('[data-testid="create-band-button"]', {
    timeout: 10000,
  })
  await page.click('[data-testid="create-band-button"]')
  await page.waitForTimeout(500)

  // Fill band name
  await page.fill(
    '[data-testid="band-name-input"]',
    `Screenshot Test Band ${Date.now()}`
  )
  await page.click('[data-testid="create-band-submit-button"]')
  await page.waitForTimeout(2000)
}

async function captureEditModalStates(page: Page) {
  // Wait for Songs page
  await page.waitForURL(/\/songs/, { timeout: 15000 })
  await page.waitForTimeout(1000)

  // Click Add Song
  await page.click('[data-testid="add-song-button"]')
  await page.waitForTimeout(500)

  // Screenshot 1: Empty modal
  await takeScreenshot(page, 'edit-modal-empty')

  // Fill basic fields
  await page.fill('[data-testid="song-title-input"]', 'Test Song')
  await page.fill('[data-testid="song-artist-input"]', 'Test Artist')

  // Screenshot 2: With basic info
  await takeScreenshot(page, 'edit-modal-basic-info')

  // Enter a Spotify URL to test auto-detect
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://open.spotify.com/track/abc123'
  )
  await page.waitForTimeout(300)

  // Screenshot 3: Spotify URL detected
  await takeScreenshot(page, 'edit-modal-spotify-detected')

  // Clear and enter YouTube URL
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://www.youtube.com/watch?v=xyz'
  )
  await page.waitForTimeout(300)

  // Screenshot 4: YouTube URL detected
  await takeScreenshot(page, 'edit-modal-youtube-detected')

  // Clear and enter unrecognized URL
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://example.com/my-chord-chart'
  )
  await page.waitForTimeout(300)

  // Screenshot 5: Unrecognized URL (shows customize section)
  await takeScreenshot(page, 'edit-modal-unrecognized-url')

  // Test cloud storage URLs
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://drive.google.com/file/d/abc123'
  )
  await page.waitForTimeout(300)

  // Screenshot 6: Google Drive detected
  await takeScreenshot(page, 'edit-modal-gdrive-detected')

  await page.fill(
    '[data-testid="link-url-input"]',
    'https://www.dropbox.com/s/abc123/file.mp3'
  )
  await page.waitForTimeout(300)

  // Screenshot 7: Dropbox detected
  await takeScreenshot(page, 'edit-modal-dropbox-detected')

  await page.fill(
    '[data-testid="link-url-input"]',
    'https://soundcloud.com/artist/track'
  )
  await page.waitForTimeout(300)

  // Screenshot 8: SoundCloud detected
  await takeScreenshot(page, 'edit-modal-soundcloud-detected')

  // Add a link and show the list
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://ultimate-guitar.com/tabs/song'
  )
  await page.click('[data-testid="add-link-button"]')
  await page.waitForTimeout(300)

  await page.fill(
    '[data-testid="link-url-input"]',
    'https://open.spotify.com/track/def456'
  )
  await page.click('[data-testid="add-link-button"]')
  await page.waitForTimeout(300)

  // Screenshot 9: Links list
  await takeScreenshot(page, 'edit-modal-links-list')

  // Mobile viewport
  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForTimeout(300)

  // Screenshot 10: Mobile view
  await takeScreenshot(page, 'edit-modal-mobile')

  // Enter unrecognized URL on mobile to check dropdown
  await page.fill(
    '[data-testid="link-url-input"]',
    'https://example.com/custom'
  )
  await page.waitForTimeout(300)

  // Screenshot 11: Mobile with customize section
  await takeScreenshot(page, 'edit-modal-mobile-customize')

  console.log('\n✅ All screenshots captured!')
}

async function main() {
  await ensureDir(SCREENSHOT_DIR)

  console.log('🚀 Starting screenshot capture...\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  try {
    console.log('📝 Signing up test user...')
    await signUp(page)

    console.log('🎸 Creating test band...')
    await createBand(page)

    console.log('📷 Capturing Edit Modal screenshots...')
    await captureEditModalStates(page)
  } catch (error) {
    console.error('❌ Error:', error)
    await takeScreenshot(page, 'error-state')
  } finally {
    await browser.close()
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { main as captureScreenshots }
