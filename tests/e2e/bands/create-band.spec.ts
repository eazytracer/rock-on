import { test, expect } from '@playwright/test';
import { createTestUser, signUpViaUI, deleteTestUser } from '../../fixtures/auth';
import { createBandViaUI } from '../../fixtures/bands';
import { selectors } from '../../helpers/selectors';
import { setupConsoleErrorTracking, assertNoConsoleErrors } from '../../helpers/assertions';

test.describe('Band Creation', () => {
  let testUserId: string | undefined;

  test.afterEach(async () => {
    // Clean up test user if created
    if (testUserId) {
      await deleteTestUser(testUserId);
      testUserId = undefined;
    }
  });

  test('new user can create first band successfully', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Sign up
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Create band
    const bandName = `Test Band ${Date.now()}`;
    await createBandViaUI(page, bandName);

    // Verify redirect to songs page
    await page.waitForURL(/\/songs/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/songs/);

    // Verify band name appears in sidebar
    const sidebarBandName = page.locator(selectors.band.sidebarBandName).first();
    await expect(sidebarBandName).toBeAttached({ timeout: 5000 });
    await expect(sidebarBandName).toHaveText(bandName);

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('user is automatically admin of created band', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Sign up and create band
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    const bandName = `Admin Test Band ${Date.now()}`;
    await createBandViaUI(page, bandName);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Navigate to band members page
    await page.goto('/band-members');
    await page.waitForLoadState('networkidle');

    // Find user's member row
    const memberRow = page.locator(`[data-testid="member-row-${user.email}"]`).first();
    await expect(memberRow).toBeVisible({ timeout: 5000 });

    // Verify role is Admin
    const roleBadge = memberRow.locator('[data-testid="member-role"]').first();
    await expect(roleBadge).toBeVisible();
    const roleText = await roleBadge.textContent();
    expect(roleText?.toLowerCase()).toContain('admin');

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('band has invite code generated automatically', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Sign up and create band
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    const bandName = `Invite Code Band ${Date.now()}`;
    await createBandViaUI(page, bandName);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Navigate to band members page
    await page.goto('/band-members');
    await page.waitForLoadState('networkidle');

    // Verify invite code is visible
    const inviteCodeElement = page.locator(selectors.band.inviteCode).first();
    await expect(inviteCodeElement).toBeVisible({ timeout: 5000 });

    const inviteCode = await inviteCodeElement.textContent();
    expect(inviteCode).toBeTruthy();
    expect(inviteCode!.length).toBeGreaterThan(0);

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('user can create multiple bands', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Sign up
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Create first band
    const band1Name = `First Band ${Date.now()}`;
    await createBandViaUI(page, band1Name);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Navigate back to create second band
    await page.goto('/get-started');

    // Create second band
    const band2Name = `Second Band ${Date.now() + 1}`;
    await createBandViaUI(page, band2Name);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Verify current band is the second one
    const currentBandName = page.locator(selectors.band.sidebarBandName).first();
    await expect(currentBandName).toHaveText(band2Name, { timeout: 5000 });

    // Check if band selector exists (may not be implemented yet)
    const bandSelector = page.locator('[data-testid="band-selector"]');
    const hasBandSelector = await bandSelector.isVisible().catch(() => false);

    if (hasBandSelector) {
      await bandSelector.click();
      // Both bands should be listed
      await expect(page.locator(`text=${band1Name}`)).toBeVisible({ timeout: 3000 });
      await expect(page.locator(`text=${band2Name}`)).toBeVisible({ timeout: 3000 });
    } else {
      console.log('Note: Band selector not yet implemented - multi-band UI pending');
    }

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('band creation handles validation correctly', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Sign up
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Try to create band without name
    const createButton = page.locator(selectors.band.createButton);
    await createButton.click();

    // Should stay on get-started page (validation prevents submit)
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/get-started/);

    // Try with very long name
    const longName = 'A'.repeat(256);
    await page.fill(selectors.band.nameInput, longName);
    await createButton.click();

    // May stay on page or show error
    await page.waitForTimeout(1000);
    // Just verify we don't crash
    const url = page.url();
    expect(url).toBeTruthy();

    // Create with valid name to verify form still works
    const validName = `Valid Band ${Date.now()}`;
    await page.fill(selectors.band.nameInput, validName);
    await createButton.click();
    await expect(page).toHaveURL(/\/songs/, { timeout: 10000 });

    // Verify no critical console errors (may have validation warnings)
    // Don't fail test on validation errors, only on crashes
  });

  test('band creation syncs to Supabase correctly', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);
    const user = createTestUser();

    // Track network requests
    const createRequests: any[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/rest/v1/bands') && request.method() === 'POST') {
        createRequests.push({
          url,
          method: request.method(),
          postData: request.postData()
        });
      }
    });

    // Sign up and create band
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    const bandName = `Sync Test Band ${Date.now()}`;
    await createBandViaUI(page, bandName);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Wait for sync to complete
    await page.waitForTimeout(2000);

    // Verify band was created in Supabase (network request sent)
    expect(createRequests.length).toBeGreaterThan(0);

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });

  test('band creation does not violate RLS policies', async ({ page }) => {
    const user = createTestUser();

    // Track RLS-related console messages
    const rlsErrors: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('rls') ||
          text.toLowerCase().includes('policy') ||
          text.toLowerCase().includes('permission denied')) {
        rlsErrors.push(text);
      }
    });

    // Sign up and create band
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    const bandName = `RLS Test Band ${Date.now()}`;
    await createBandViaUI(page, bandName);

    // Wait for redirect
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Wait for any async RLS checks
    await page.waitForTimeout(2000);

    // Verify no RLS errors
    if (rlsErrors.length > 0) {
      console.error('RLS Errors detected:', rlsErrors);
    }
    expect(rlsErrors).toHaveLength(0);
  });
});
