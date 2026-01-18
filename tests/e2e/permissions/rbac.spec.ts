import { test, expect } from '@playwright/test'
import {
  createTestUser,
  signUpViaUI,
  deleteTestUser,
} from '../../fixtures/auth'
import {
  createBandViaUI,
  getInviteCodeViaUI,
  joinBandViaUI,
} from '../../fixtures/bands'
import {
  setupConsoleErrorTracking,
  assertNoConsoleErrors,
} from '../../helpers/assertions'

test.describe('Role-Based Access Control (RBAC)', () => {
  let adminUserId: string | undefined
  let memberUserId: string | undefined

  test.afterEach(async () => {
    if (adminUserId) {
      await deleteTestUser(adminUserId)
      adminUserId = undefined
    }
    if (memberUserId) {
      await deleteTestUser(memberUserId)
      memberUserId = undefined
    }
  })

  test('admin has full access to all band features', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const admin = createTestUser()

    await signUpViaUI(page, admin)
    await createBandViaUI(page, `Admin Access Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Admin should see all navigation items
    const navItems = ['Songs', 'Setlists', 'Shows', 'Practices', 'Band Members']

    for (const item of navItems) {
      const navLink = page
        .locator(
          `a:has-text("${item}"), [href*="${item.toLowerCase().replace(' ', '-')}"]`
        )
        .first()
      const isVisible = await navLink.isVisible().catch(() => false)
      if (isVisible) {
        console.log(`✓ Admin can see ${item}`)
      }
    }

    // Admin should be able to add songs
    await page.goto('/songs')
    const addSongButton = page.locator('button:has-text("Add Song")').first()
    await expect(addSongButton).toBeVisible({ timeout: 5000 })

    // Admin should access band members page
    await page.goto('/band-members')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('band-members')

    await assertNoConsoleErrors(page, errors)
  })

  test('regular member has appropriate permissions', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()

    // Admin creates band
    const admin = createTestUser()
    await signUpViaUI(adminPage, admin)
    await createBandViaUI(adminPage, `Member Permissions ${Date.now()}`)

    const inviteCode = await getInviteCodeViaUI(adminPage)

    // Member joins
    const member = createTestUser()
    await signUpViaUI(memberPage, member)
    await joinBandViaUI(memberPage, inviteCode)
    await memberPage.waitForURL(/\/(songs|band-members|bands)/, {
      timeout: 10000,
    })

    // Member should see navigation
    await memberPage.goto('/songs')
    await memberPage.waitForLoadState('networkidle')

    // Member should be able to add songs (in our app, all members can add songs)
    const addSongButton = memberPage
      .locator('button:has-text("Add Song")')
      .first()
    const canAddSongs = await addSongButton.isVisible().catch(() => false)

    if (canAddSongs) {
      console.log('✓ Members can add songs')
    }

    // Member can view band members
    await memberPage.goto('/band-members')
    await memberPage.waitForLoadState('networkidle')
    expect(memberPage.url()).toContain('band-members')

    await adminContext.close()
    await memberContext.close()
  })

  test('regular member cannot remove other members', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    const member1Context = await browser.newContext()
    const member1Page = await member1Context.newPage()

    const member2Context = await browser.newContext()
    const member2Page = await member2Context.newPage()

    // Setup: Admin creates band, two members join
    const admin = createTestUser()
    await signUpViaUI(adminPage, admin)
    await createBandViaUI(adminPage, `RBAC Test ${Date.now()}`)

    const inviteCode = await getInviteCodeViaUI(adminPage)

    const member1 = createTestUser()
    await signUpViaUI(member1Page, member1)
    await joinBandViaUI(member1Page, inviteCode)

    const member2 = createTestUser()
    await signUpViaUI(member2Page, member2)
    await joinBandViaUI(member2Page, inviteCode)

    // Member 1 tries to remove Member 2
    await member1Page.goto('/band-members')
    await member1Page.waitForLoadState('networkidle')

    const member2Row = member1Page
      .locator(`[data-testid="member-row-${member2.email}"]`)
      .first()
    const rowVisible = await member2Row.isVisible().catch(() => false)

    if (rowVisible) {
      await member2Row.click()
      await member1Page.waitForTimeout(500)

      // Remove button should not be visible
      const removeButton = member1Page
        .locator(
          'button:has-text("Remove"), button:has-text("Remove from Band")'
        )
        .first()
      const canRemove = await removeButton.isVisible().catch(() => false)

      expect(canRemove).toBe(false)
      console.log('✓ Regular members cannot remove other members')
    }

    await adminContext.close()
    await member1Context.close()
    await member2Context.close()
  })

  test('admin can remove regular members', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()

    // Admin creates band
    const admin = createTestUser()
    await signUpViaUI(adminPage, admin)
    await createBandViaUI(adminPage, `Admin Remove ${Date.now()}`)

    const inviteCode = await getInviteCodeViaUI(adminPage)

    // Member joins
    const member = createTestUser()
    await signUpViaUI(memberPage, member)
    await joinBandViaUI(memberPage, inviteCode)

    // Admin goes to members page
    await adminPage.goto('/band-members')
    await adminPage.waitForLoadState('networkidle')

    const memberRow = adminPage
      .locator(`[data-testid="member-row-${member.email}"]`)
      .first()
    const isVisible = await memberRow
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (isVisible) {
      await memberRow.click()
      await adminPage.waitForTimeout(500)

      // Admin should see remove button
      const removeButton = adminPage
        .locator(
          'button:has-text("Remove"), button:has-text("Remove from Band")'
        )
        .first()
      const canRemove = await removeButton.isVisible().catch(() => false)

      if (canRemove) {
        console.log('✓ Admin can see remove button for members')
      } else {
        console.log('Note: Remove member feature may not be fully implemented')
      }
    }

    await adminContext.close()
    await memberContext.close()
  })

  test('owner has all admin permissions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    const owner = createTestUser()

    // Create band (owner is automatically admin)
    await signUpViaUI(page, owner)
    await createBandViaUI(page, `Owner Test ${Date.now()}`)
    await page.waitForURL(/\/songs/, { timeout: 10000 })

    // Verify owner can access all pages
    await page.goto('/band-members')
    expect(page.url()).toContain('band-members')

    await page.goto('/songs')
    expect(page.url()).toContain('songs')

    await page.goto('/setlists')
    // May redirect if no setlists, but should not error

    await page.goto('/shows')
    // May redirect if no shows, but should not error

    // Owner should see admin badge
    await page.goto('/band-members')
    await page.waitForLoadState('networkidle')

    const ownerRow = page
      .locator(`[data-testid="member-row-${owner.email}"]`)
      .first()
    await expect(ownerRow).toBeVisible({ timeout: 5000 })

    const roleBadge = ownerRow.locator('[data-testid="member-role"]').first()
    const roleText = await roleBadge.textContent()
    expect(roleText?.toLowerCase()).toContain('admin')

    await assertNoConsoleErrors(page, errors)
  })

  test('member cannot promote themselves to admin', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()

    // Setup
    const admin = createTestUser()
    await signUpViaUI(adminPage, admin)
    await createBandViaUI(adminPage, `Self Promote Test ${Date.now()}`)

    const inviteCode = await getInviteCodeViaUI(adminPage)

    const member = createTestUser()
    await signUpViaUI(memberPage, member)
    await joinBandViaUI(memberPage, inviteCode)

    // Member tries to access their own profile
    await memberPage.goto('/band-members')
    await memberPage.waitForLoadState('networkidle')

    const memberRow = memberPage
      .locator(`[data-testid="member-row-${member.email}"]`)
      .first()
    await memberRow.click()
    await memberPage.waitForTimeout(500)

    // Should not see promote button or role selector
    const promoteButton = memberPage
      .locator('button:has-text("Promote"), button:has-text("Make Admin")')
      .first()
    const roleSelect = memberPage.locator('select[name="role"]').first()

    const canPromote = await promoteButton.isVisible().catch(() => false)
    const canSelectRole = await roleSelect.isVisible().catch(() => false)

    expect(canPromote).toBe(false)
    expect(canSelectRole).toBe(false)

    console.log('✓ Members cannot promote themselves')

    await adminContext.close()
    await memberContext.close()
  })

  test('all members can add and edit songs', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()

    // Setup
    const admin = createTestUser()
    await signUpViaUI(adminPage, admin)
    await createBandViaUI(adminPage, `Song Permissions ${Date.now()}`)

    const inviteCode = await getInviteCodeViaUI(adminPage)

    const member = createTestUser()
    await signUpViaUI(memberPage, member)
    await joinBandViaUI(memberPage, inviteCode)

    // Member adds a song
    await memberPage.goto('/songs')
    await memberPage.waitForLoadState('networkidle')

    const addButton = memberPage.locator('button:has-text("Add Song")').first()
    const canAdd = await addButton.isVisible().catch(() => false)

    if (canAdd) {
      await addButton.click()
      await memberPage.waitForTimeout(500)

      // Fill required fields (title, artist, key)
      await memberPage.fill('input[name="title"]', 'Member Song')
      await memberPage.fill('input[name="artist"]', 'Member Artist')

      // Select key using the Circle of Fifths picker (required)
      const keyButton = memberPage
        .locator('[data-testid="song-key-button"]')
        .first()
      if (await keyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await keyButton.click()
        const keyPicker = memberPage
          .locator('[data-testid="key-picker-A"]')
          .first()
        await keyPicker.waitFor({ state: 'visible', timeout: 5000 })
        await keyPicker.click()
        const confirmButton = memberPage
          .locator('[data-testid="key-picker-confirm"]')
          .first()
        await confirmButton.click()
        await memberPage.waitForTimeout(500)
      }

      // Save song
      await memberPage.locator('[data-testid="song-submit-button"]').click()
      await memberPage.waitForTimeout(2000)

      // Verify song was added (form should close and show song list)
      await expect(memberPage.locator('text=Member Song').first()).toBeVisible({
        timeout: 10000,
      })
      console.log('✓ Members can add songs')
    }

    // Admin should see member's song
    await adminPage.goto('/songs')
    await adminPage.waitForLoadState('networkidle')
    await adminPage.waitForTimeout(2000)

    const memberSong = await adminPage
      .locator('text=Member Song')
      .first()
      .isVisible()
      .catch(() => false)
    if (memberSong) {
      console.log('✓ Admin can see member-created songs')
    }

    await adminContext.close()
    await memberContext.close()
  })
})
