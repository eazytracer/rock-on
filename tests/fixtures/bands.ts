import { Page, expect } from '@playwright/test'
import { getSupabaseAdmin } from './supabase'

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
 * Create a band directly in the database (bypassing UI)
 */
export async function createBandInDB(
  band: Omit<TestBand, 'id'> & { ownerId: string }
): Promise<TestBand & { id: string }> {
  const supabase = await getSupabaseAdmin()

  const bandId = crypto.randomUUID()

  // Create band
  const { error: bandError } = await supabase.from('bands').insert({
    id: bandId,
    name: band.name,
    description: band.description || null,
    owner_id: band.ownerId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    version: 1,
  })

  if (bandError) {
    throw new Error(`Failed to create band: ${bandError.message}`)
  }

  // Create admin membership for owner
  const { error: membershipError } = await supabase
    .from('band_memberships')
    .insert({
      id: crypto.randomUUID(),
      user_id: band.ownerId,
      band_id: bandId,
      role: 'admin',
      joined_date: new Date().toISOString(),
      status: 'active',
    })

  if (membershipError) {
    throw new Error(
      `Failed to create band membership: ${membershipError.message}`
    )
  }

  // Generate invite code
  const inviteCode = `BAND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  const { error: inviteError } = await supabase.from('invite_codes').insert({
    id: crypto.randomUUID(),
    code: inviteCode,
    band_id: bandId,
    created_by: band.ownerId,
    created_date: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 10,
    current_uses: 0,
    is_active: true,
  })

  if (inviteError) {
    console.warn(`Failed to create invite code: ${inviteError.message}`)
  }

  return {
    id: bandId,
    name: band.name,
    description: band.description,
    ownerId: band.ownerId,
    inviteCode: inviteError ? undefined : inviteCode,
  }
}

/**
 * Delete a band from the database
 */
export async function deleteBandFromDB(bandId: string): Promise<void> {
  const supabase = await getSupabaseAdmin()

  try {
    // Delete band memberships first
    await supabase.from('band_memberships').delete().eq('band_id', bandId)

    // Delete invite codes
    await supabase.from('invite_codes').delete().eq('band_id', bandId)

    // Delete songs
    await supabase.from('songs').delete().eq('context_id', bandId)

    // Delete setlists
    await supabase.from('setlists').delete().eq('band_id', bandId)

    // Delete shows
    await supabase.from('shows').delete().eq('band_id', bandId)

    // Delete practice sessions
    await supabase.from('practice_sessions').delete().eq('band_id', bandId)

    // Finally delete the band
    const { error } = await supabase.from('bands').delete().eq('id', bandId)

    if (error) {
      console.warn(`Failed to delete band ${bandId}: ${error.message}`)
    }
  } catch (error) {
    console.warn(`Error deleting band ${bandId}:`, error)
  }
}

/**
 * Get band members count from database
 */
export async function getBandMemberCount(bandId: string): Promise<number> {
  const supabase = await getSupabaseAdmin()

  const { data, error } = await supabase
    .from('band_memberships')
    .select('id', { count: 'exact' })
    .eq('band_id', bandId)
    .eq('status', 'active')

  if (error) {
    throw new Error(`Failed to get band member count: ${error.message}`)
  }

  return data?.length || 0
}

/**
 * Check if user is a member of a band
 */
export async function isUserBandMember(
  userId: string,
  bandId: string
): Promise<boolean> {
  const supabase = await getSupabaseAdmin()

  const { data, error } = await supabase
    .from('band_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('band_id', bandId)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found, which is okay
    throw new Error(`Failed to check band membership: ${error.message}`)
  }

  return !!data
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
