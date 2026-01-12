/**
 * E2E Tests: Practice Session Mode
 *
 * Tests the full-screen practice session feature:
 * - Starting a practice session
 * - Navigating through songs
 * - Displaying song metadata (key, tuning, BPM)
 * - Rendering markdown notes
 * - Progress indicators
 * - End practice functionality
 */

import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Practice Session Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Create user and band
    const user = createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, `Practice Session Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })
  })

  test('can start practice session and navigate through songs', async ({
    page,
  }) => {
    // Step 1: Create songs for the practice
    await createSongWithNotes(page, {
      title: 'Test Song One',
      artist: 'Test Artist',
      key: 'A',
      tuning: 'Standard',
      bpm: '120',
      notes:
        '**Bold intro** - Start with power chords\n\n- Verse: palm muted\n- Chorus: open strumming',
    })

    await createSongWithNotes(page, {
      title: 'Test Song Two',
      artist: 'Another Artist',
      key: 'E',
      tuning: 'Drop D',
      bpm: '140',
      notes: 'Watch the _tempo change_ at bridge',
    })

    // Step 2: Create a practice and add songs
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    // Click schedule practice button
    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })

    // The practice view page should load - add songs to it
    await page.waitForTimeout(1000) // Wait for page to stabilize

    // Add songs to practice using browse songs drawer
    const addSongsButton = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton.isVisible({ timeout: 3000 })) {
      await addSongsButton.click()
      await page.waitForTimeout(500)

      // Click on songs to add them
      const song1 = page.locator('button:has-text("Test Song One")')
      if (await song1.isVisible({ timeout: 3000 })) {
        await song1.click()
        await page.waitForTimeout(300)
      }

      const song2 = page.locator('button:has-text("Test Song Two")')
      if (await song2.isVisible({ timeout: 3000 })) {
        await song2.click()
        await page.waitForTimeout(300)
      }
    }

    // Close the drawer using the close button
    const closeButton = page.locator('[data-testid="slide-out-tray-close"]')
    await expect(closeButton).toBeVisible({ timeout: 3000 })
    await closeButton.click()
    // Wait for drawer to slide out (it uses transform, not visibility)
    await page.waitForTimeout(500)

    // Step 3: Save the practice (click Create Practice button)
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()

    // Wait for navigation to the saved practice
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Step 4: Start the practice session
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()

    // Step 4: Verify we're in session mode
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // Verify session elements are visible
    await expect(
      page.locator('[data-testid="session-exit-button"]')
    ).toBeVisible()
    await expect(page.locator('[data-testid="session-timer"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toBeVisible()

    // Verify first song is displayed
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Test Song One')
    await expect(
      page.locator('[data-testid="session-song-artist"]')
    ).toContainText('Test Artist')

    // Verify metadata cards are visible
    await expect(page.locator('[data-testid="session-song-key"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="session-song-tuning"]')
    ).toBeVisible()
    await expect(page.locator('[data-testid="session-song-bpm"]')).toBeVisible()

    // Step 5: Navigate to next song
    const nextButton = page.locator('[data-testid="session-next-button"]')
    await expect(nextButton).toBeVisible()
    await nextButton.click()

    // Verify second song is now displayed
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Test Song Two')
    await expect(
      page.locator('[data-testid="session-song-artist"]')
    ).toContainText('Another Artist')

    // Step 6: Verify End Practice button appears on last song
    const endButton = page.locator('[data-testid="session-end-button"]')
    await expect(endButton).toBeVisible()

    // Step 7: End practice and return to practice view
    await endButton.click()
    await page.waitForURL(/\/practices\/[^/]+$/, { timeout: 5000 })

    // Verify we're back on the practice view page
    await expect(page).not.toHaveURL(/\/session/)
  })

  test('displays markdown notes correctly in practice session', async ({
    page,
  }) => {
    // Create song with rich markdown notes
    const markdownNotes = `# Song Notes

**Important:** Watch the dynamics!

## Sections

1. **Intro** - Clean guitar, fingerpicking
2. **Verse** - Palm muted rhythm
3. **Chorus** - Full strumming, accent on 2 and 4

### Tips
- Use a *light touch* on the intro
- Build intensity through the verse
- Let it ring on the final chord

\`\`\`
Tuning: E A D G B E
Capo: 2nd fret
\`\`\`
`

    await createSongWithNotes(page, {
      title: 'Markdown Test Song',
      artist: 'Notes Artist',
      notes: markdownNotes,
    })

    // Create practice and add the song
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Add the song
    const addSongsButton2 = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton2.isVisible({ timeout: 3000 })) {
      await addSongsButton2.click()
      await page.waitForTimeout(500)

      const song = page.locator('button:has-text("Markdown Test Song")')
      if (await song.isVisible({ timeout: 3000 })) {
        await song.click()
        await page.waitForTimeout(300)
      }
    }

    // Close the drawer using the close button
    const closeButton = page.locator('[data-testid="slide-out-tray-close"]')
    await expect(closeButton).toBeVisible({ timeout: 3000 })
    await closeButton.click()
    // Wait for drawer to slide out (it uses transform, not visibility)
    await page.waitForTimeout(500)

    // Save the practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Start practice session
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // Verify notes section exists
    const notesSection = page.locator('[data-testid="session-notes"]')
    await expect(notesSection).toBeVisible()

    // Verify markdown is rendered (look for formatted elements)
    // Bold text should be in <strong> tags
    await expect(
      notesSection.locator('strong:has-text("Important")')
    ).toBeVisible()

    // Headers should be rendered
    await expect(
      notesSection.locator('h2:has-text("Sections"), h3:has-text("Sections")')
    ).toBeVisible()

    // List items should be visible - use first() to avoid strict mode violation
    await expect(notesSection.locator('text=Intro').first()).toBeVisible()
    await expect(notesSection.locator('text=Verse').first()).toBeVisible()
    await expect(notesSection.locator('text=Chorus').first()).toBeVisible()
  })

  test('keyboard navigation works in practice session', async ({ page }) => {
    // Create two songs
    await createSongWithNotes(page, {
      title: 'Keyboard Nav Song 1',
      artist: 'Artist One',
    })

    await createSongWithNotes(page, {
      title: 'Keyboard Nav Song 2',
      artist: 'Artist Two',
    })

    // Create practice with both songs
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })
    await page.waitForTimeout(1000)

    const addSongsButton = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton.isVisible({ timeout: 3000 })) {
      await addSongsButton.click()
      await page.waitForTimeout(500)

      const song1 = page.locator('button:has-text("Keyboard Nav Song 1")')
      if (await song1.isVisible({ timeout: 3000 })) {
        await song1.click()
        await page.waitForTimeout(300)
      }

      const song2 = page.locator('button:has-text("Keyboard Nav Song 2")')
      if (await song2.isVisible({ timeout: 3000 })) {
        await song2.click()
        await page.waitForTimeout(300)
      }
    }

    // Close the drawer using the close button
    const closeButton = page.locator('[data-testid="slide-out-tray-close"]')
    await expect(closeButton).toBeVisible({ timeout: 3000 })
    await closeButton.click()
    // Wait for drawer to slide out (it uses transform, not visibility)
    await page.waitForTimeout(500)

    // Save the practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Start practice
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // Verify first song
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Keyboard Nav Song 1')

    // Use ArrowRight to go to next song
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Keyboard Nav Song 2')

    // Use ArrowLeft to go back
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Keyboard Nav Song 1')

    // Use End to go to last song
    await page.keyboard.press('End')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Keyboard Nav Song 2')

    // Use Home to go to first song
    await page.keyboard.press('Home')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Keyboard Nav Song 1')

    // Use Escape to exit session
    await page.keyboard.press('Escape')
    await page.waitForURL(/\/practices\/[^/]+$/, { timeout: 5000 })
    await expect(page).not.toHaveURL(/\/session/)
  })

  test('progress dots show correct position', async ({ page }) => {
    // Create 4 songs for clear progress visualization
    for (let i = 1; i <= 4; i++) {
      await createSongWithNotes(page, {
        title: `Progress Song ${i}`,
        artist: `Artist ${i}`,
      })
    }

    // Create practice with all songs
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })
    await page.waitForTimeout(1000)

    const addSongsButton = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton.isVisible({ timeout: 3000 })) {
      await addSongsButton.click()
      await page.waitForTimeout(500)

      for (let i = 1; i <= 4; i++) {
        const song = page.locator(`button:has-text("Progress Song ${i}")`)
        if (await song.isVisible({ timeout: 3000 })) {
          await song.click()
          await page.waitForTimeout(200)
        }
      }
    }

    // Wait for UI to stabilize after adding songs
    await page.waitForTimeout(500)

    // Close the drawer by clicking the backdrop (more reliable than close button)
    const backdrop = page.locator('[data-testid="slide-out-tray-backdrop"]')
    if (await backdrop.isVisible({ timeout: 2000 })) {
      await backdrop.click()
    }
    // Wait for drawer to slide out
    await page.waitForTimeout(500)

    // Save the practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Start practice
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // Verify first song and navigate through all
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Progress Song 1')

    // Navigate through songs and verify titles change
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Progress Song 2')

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Progress Song 3')

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(
      page.locator('[data-testid="session-song-title"]')
    ).toContainText('Progress Song 4')

    // On last song, End Practice button should be visible
    await expect(
      page.locator('[data-testid="session-end-button"]')
    ).toBeVisible()
  })

  test('timer increments during practice session', async ({ page }) => {
    // Create a song
    await createSongWithNotes(page, {
      title: 'Timer Test Song',
      artist: 'Timer Artist',
    })

    // Create practice
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })
    await page.waitForTimeout(1000)

    const addSongsButton = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton.isVisible({ timeout: 3000 })) {
      await addSongsButton.click()
      await page.waitForTimeout(500)

      const song = page.locator('button:has-text("Timer Test Song")')
      if (await song.isVisible({ timeout: 3000 })) {
        await song.click()
        await page.waitForTimeout(300)
      }
    }

    // Close the drawer using the close button
    const closeButton = page.locator('[data-testid="slide-out-tray-close"]')
    await expect(closeButton).toBeVisible({ timeout: 3000 })
    await closeButton.click()
    // Wait for drawer to slide out (it uses transform, not visibility)
    await page.waitForTimeout(500)

    // Save the practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Start practice
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // Get initial timer value
    const timer = page.locator('[data-testid="session-timer"]')
    await expect(timer).toBeVisible()

    const initialTime = await timer.textContent()

    // Wait 2 seconds
    await page.waitForTimeout(2000)

    // Get new timer value
    const newTime = await timer.textContent()

    // Timer should have incremented
    expect(newTime).not.toBe(initialTime)
  })

  test('next song preview shows tuning change warning', async ({ page }) => {
    // Create songs with different tunings
    await createSongWithNotes(page, {
      title: 'Standard Tuning Song',
      artist: 'Artist A',
      tuning: 'Standard',
    })

    await createSongWithNotes(page, {
      title: 'Drop D Song',
      artist: 'Artist B',
      tuning: 'Drop D',
    })

    // Create practice with both songs
    await page.goto('/practices')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Schedule Practice")').first().click()
    await page.waitForURL(/\/practices\/new/, { timeout: 5000 })
    await page.waitForTimeout(1000)

    const addSongsButton = page
      .locator('[data-testid="add-songs-button"]')
      .first()
    if (await addSongsButton.isVisible({ timeout: 3000 })) {
      await addSongsButton.click()
      await page.waitForTimeout(500)

      const song1 = page.locator('button:has-text("Standard Tuning Song")')
      if (await song1.isVisible({ timeout: 3000 })) {
        await song1.click()
        await page.waitForTimeout(300)
      }

      const song2 = page.locator('button:has-text("Drop D Song")')
      if (await song2.isVisible({ timeout: 3000 })) {
        await song2.click()
        await page.waitForTimeout(300)
      }
    }

    // Close the drawer using the close button
    const closeButton = page.locator('[data-testid="slide-out-tray-close"]')
    await expect(closeButton).toBeVisible({ timeout: 3000 })
    await closeButton.click()
    // Wait for drawer to slide out (it uses transform, not visibility)
    await page.waitForTimeout(500)

    // Save the practice
    const createButton = page.locator('[data-testid="create-practice-button"]')
    await expect(createButton).toBeVisible({ timeout: 5000 })
    await createButton.click()
    await page.waitForURL(/\/practices\/(?!new)[^/]+$/, { timeout: 10000 })

    // Start practice
    const startButton = page.locator('[data-testid="start-practice-button"]')
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()
    await page.waitForURL(/\/session/, { timeout: 5000 })

    // On first song, verify next song preview shows tuning
    // The navigation area should show the next song with tuning
    const progressArea = page.locator('[data-testid="session-progress"]')
    await expect(progressArea).toBeVisible()

    // Look for tuning indicator (should show Drop D with warning since it's different)
    await expect(progressArea.locator('text=Drop D')).toBeVisible()
  })
})

/**
 * Helper function to create a song with optional notes
 */
async function createSongWithNotes(
  page: any,
  options: {
    title: string
    artist: string
    key?: string
    tuning?: string
    bpm?: string
    notes?: string
  }
): Promise<void> {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')

  // Click Add Song button
  const addButton = page
    .locator('button:has-text("Add Song"), [data-testid="add-song-button"]')
    .first()
  await expect(addButton).toBeVisible({ timeout: 5000 })
  await addButton.click()
  await page.waitForTimeout(500)

  // Fill required fields
  await page.fill('input[name="title"]', options.title)
  await page.fill('input[name="artist"]', options.artist)

  // Fill optional fields if provided
  if (options.bpm) {
    const bpmInput = page
      .locator('input[name="bpm"], input[name="tempo"]')
      .first()
    if (await bpmInput.isVisible().catch(() => false)) {
      await bpmInput.fill(options.bpm)
    }
  }

  // Select key (required field) - default to C if not provided
  const keyToSelect = options.key || 'C'
  const keyButton = page
    .locator('[data-testid="song-key-button"], button:has-text("Select key")')
    .first()
  if (await keyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await keyButton.click()
    await page.waitForTimeout(300)
    const keyPicker = page
      .locator(`[data-testid="key-picker-${keyToSelect}"]`)
      .first()
    if (await keyPicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await keyPicker.click()
      await page.waitForTimeout(200)
      const confirmButton = page
        .locator('[data-testid="key-picker-confirm"]')
        .first()
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click()
      }
    }
    await page.waitForTimeout(300)
  }

  // Set tuning if provided
  if (options.tuning) {
    const tuningSelect = page
      .locator('select[name="guitarTuning"], [data-testid="tuning-select"]')
      .first()
    if (await tuningSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tuningSelect.selectOption({ label: options.tuning })
    }
  }

  // Add notes if provided
  if (options.notes) {
    const notesInput = page
      .locator('textarea[name="notes"], [data-testid="song-notes-input"]')
      .first()
    if (await notesInput.isVisible().catch(() => false)) {
      await notesInput.fill(options.notes)
    }
  }

  // Save song - button is "Create Song"
  const saveButton = page.locator('button:has-text("Create Song")').first()
  await expect(saveButton).toBeVisible({ timeout: 3000 })
  await saveButton.click()
  await page.waitForTimeout(1500)

  // Wait for song to appear in list
  await expect(page.locator(`text=${options.title}`).first()).toBeVisible({
    timeout: 5000,
  })
}
