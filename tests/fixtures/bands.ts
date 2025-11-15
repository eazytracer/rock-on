import { Page, expect } from '@playwright/test';
import { getSupabaseAdmin } from './supabase';

export interface TestBand {
  id?: string;
  name: string;
  description?: string;
  inviteCode?: string;
  ownerId?: string;
}

/**
 * Create a band via the UI
 * Assumes user is already logged in and on /get-started or similar page
 */
export async function createBandViaUI(page: Page, bandName: string): Promise<void> {
  // Check if we're on get-started page, if not navigate there
  const currentUrl = page.url();
  if (!currentUrl.includes('/get-started') && !currentUrl.includes('/bands')) {
    await page.goto('/get-started');
    await page.waitForLoadState('networkidle');
  }

  // Small delay to simulate user focus
  await page.waitForTimeout(100);

  // Fill in band name
  await page.fill('input[name="bandName"], input[id="bandName"], input[placeholder*="band" i]', bandName);

  // Small delay to simulate user reviewing input
  await page.waitForTimeout(300);

  // Click create band button
  await page.click('button:has-text("Create Band"), button[type="submit"]');

  // Small delay after click
  await page.waitForTimeout(200);

  // Wait for success (either redirect to songs or success message)
  await page.waitForURL(/\/(songs|bands)/, { timeout: 10000 });
}

/**
 * Get the invite code from the UI after band creation
 * Should be called right after creating a band
 */
export async function getInviteCodeViaUI(page: Page): Promise<string> {
  // Navigate to band members page if needed
  const currentUrl = page.url();
  if (!currentUrl.includes('/band-members')) {
    await page.goto('/band-members');
    await page.waitForLoadState('networkidle');
  }

  // Use data-testid for reliable element location (per CLAUDE.md testability standards)
  const inviteCodeElement = page.locator('[data-testid="invite-code"]');

  // Wait for element to be visible
  await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });

  // Get the invite code text
  const inviteCode = await inviteCodeElement.textContent();

  if (!inviteCode || inviteCode.trim().length === 0) {
    throw new Error('Invite code element found but contains no text');
  }

  return inviteCode.trim();
}

/**
 * Join a band via invite code through the UI
 * Assumes user is already logged in
 */
export async function joinBandViaUI(page: Page, inviteCode: string): Promise<void> {
  console.log('[joinBandViaUI] Starting join band flow...');

  // Navigate to join band page
  await page.goto('/get-started');
  await page.waitForLoadState('networkidle');
  console.log('[joinBandViaUI] Navigated to /get-started');

  // Use data-testid for reliable element selection (per CLAUDE.md testability standards)
  const inviteCodeInput = page.locator('[data-testid="join-band-invite-code-input"]');
  const joinButton = page.locator('[data-testid="join-band-button"]');

  // Wait for elements to be visible
  await expect(inviteCodeInput).toBeVisible({ timeout: 5000 });
  await expect(joinButton).toBeVisible({ timeout: 5000 });
  console.log('[joinBandViaUI] Found invite code input and join button');

  // Small delay to simulate user focus
  await page.waitForTimeout(100);

  // Fill in invite code
  await inviteCodeInput.fill(inviteCode);
  console.log(`[joinBandViaUI] Filled invite code: ${inviteCode}`);

  // Small delay to simulate user reviewing input before clicking
  await page.waitForTimeout(300);

  // Check current URL before clicking
  const urlBeforeClick = page.url();
  console.log(`[joinBandViaUI] URL before click: ${urlBeforeClick}`);

  // Submit
  await joinButton.click();

  // Small delay after click to allow UI state to update
  await page.waitForTimeout(200);
  console.log('[joinBandViaUI] Clicked join button, waiting for navigation or error...');

  // Wait for EITHER successful navigation OR error message to appear
  const errorSelector = 'text=/Failed to join band|Invalid invite code|Invite code has expired|already a member/i';

  try {
    await Promise.race([
      // Wait for successful navigation
      page.waitForURL(/\/(songs|band-members|bands)/, { timeout: 15000 }).then(() => 'success'),
      // Wait for error message to appear
      page.locator(errorSelector).waitFor({ state: 'visible', timeout: 15000 }).then(() => 'error')
    ]).then(async (result) => {
      if (result === 'error') {
        // Error message appeared - capture it and fail fast
        const errorElement = page.locator(errorSelector);
        const errorText = await errorElement.textContent();
        throw new Error(`Join band failed with error: ${errorText}`);
      }
      // Otherwise, navigation succeeded
      console.log(`[joinBandViaUI] Successfully navigated to: ${page.url()}`);
    });
  } catch (error: any) {
    // If it's our error message, re-throw it
    if (error.message?.includes('Join band failed')) {
      throw error;
    }
    // Otherwise, it's a timeout or other error
    const currentUrl = page.url();
    console.log(`[joinBandViaUI] Timeout or error at URL: ${currentUrl}`);
    throw error;
  }
}

/**
 * Create a band directly in the database (bypassing UI)
 */
export async function createBandInDB(
  band: Omit<TestBand, 'id'> & { ownerId: string }
): Promise<TestBand & { id: string }> {
  const supabase = await getSupabaseAdmin();

  const bandId = crypto.randomUUID();

  // Create band
  const { error: bandError } = await supabase.from('bands').insert({
    id: bandId,
    name: band.name,
    description: band.description || null,
    owner_id: band.ownerId,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    version: 1,
  });

  if (bandError) {
    throw new Error(`Failed to create band: ${bandError.message}`);
  }

  // Create admin membership for owner
  const { error: membershipError } = await supabase.from('band_memberships').insert({
    id: crypto.randomUUID(),
    user_id: band.ownerId,
    band_id: bandId,
    role: 'admin',
    joined_date: new Date().toISOString(),
    status: 'active',
  });

  if (membershipError) {
    throw new Error(`Failed to create band membership: ${membershipError.message}`);
  }

  // Generate invite code
  const inviteCode = `BAND-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
  });

  if (inviteError) {
    console.warn(`Failed to create invite code: ${inviteError.message}`);
  }

  return {
    id: bandId,
    name: band.name,
    description: band.description,
    ownerId: band.ownerId,
    inviteCode: inviteError ? undefined : inviteCode,
  };
}

/**
 * Delete a band from the database
 */
export async function deleteBandFromDB(bandId: string): Promise<void> {
  const supabase = await getSupabaseAdmin();

  try {
    // Delete band memberships first
    await supabase.from('band_memberships').delete().eq('band_id', bandId);

    // Delete invite codes
    await supabase.from('invite_codes').delete().eq('band_id', bandId);

    // Delete songs
    await supabase.from('songs').delete().eq('context_id', bandId);

    // Delete setlists
    await supabase.from('setlists').delete().eq('band_id', bandId);

    // Delete shows
    await supabase.from('shows').delete().eq('band_id', bandId);

    // Delete practice sessions
    await supabase.from('practice_sessions').delete().eq('band_id', bandId);

    // Finally delete the band
    const { error } = await supabase.from('bands').delete().eq('id', bandId);

    if (error) {
      console.warn(`Failed to delete band ${bandId}: ${error.message}`);
    }
  } catch (error) {
    console.warn(`Error deleting band ${bandId}:`, error);
  }
}

/**
 * Get band members count from database
 */
export async function getBandMemberCount(bandId: string): Promise<number> {
  const supabase = await getSupabaseAdmin();

  const { data, error } = await supabase
    .from('band_memberships')
    .select('id', { count: 'exact' })
    .eq('band_id', bandId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to get band member count: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Check if user is a member of a band
 */
export async function isUserBandMember(
  userId: string,
  bandId: string
): Promise<boolean> {
  const supabase = await getSupabaseAdmin();

  const { data, error } = await supabase
    .from('band_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('band_id', bandId)
    .eq('status', 'active')
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found, which is okay
    throw new Error(`Failed to check band membership: ${error.message}`);
  }

  return !!data;
}
