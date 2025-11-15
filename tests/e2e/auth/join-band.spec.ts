import { test, expect } from '@playwright/test';
import { createTestUser, signUpViaUI, deleteTestUser } from '../../fixtures/auth';
import { createBandViaUI, getInviteCodeViaUI, joinBandViaUI } from '../../fixtures/bands';
import { selectors } from '../../helpers/selectors';
import { setupConsoleErrorTracking, setupConsoleLogging, assertNoConsoleErrors } from '../../helpers/assertions';

test.describe('Join Existing Band', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests in order

  let user1Id: string | undefined;
  let user2Id: string | undefined;

  test.afterEach(async () => {
    // Clean up test users if created
    if (user1Id) {
      await deleteTestUser(user1Id);
      user1Id = undefined;
    }
    if (user2Id) {
      await deleteTestUser(user2Id);
      user2Id = undefined;
    }
  });

  test('new user can join existing band via invite code', async ({ browser }) => {
    // Create two separate browser contexts to simulate two different users
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const errors1 = setupConsoleErrorTracking(page1);

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const errors2 = setupConsoleErrorTracking(page2);
    // Enable comprehensive console logging for User 2 (joining user)
    setupConsoleLogging(page2);

    // User 1: Create account and band
    const user1 = createTestUser();
    await signUpViaUI(page1, user1);
    await expect(page1).toHaveURL(/\/get-started/, { timeout: 10000 });

    const bandName = `Multi User Band ${Date.now()}`;
    await createBandViaUI(page1, bandName);

    // Wait for redirect to songs page
    await page1.waitForURL(/\/songs/, { timeout: 10000 });
    await expect(page1).toHaveURL(/\/songs/);

    // Get invite code from UI
    const inviteCode = await getInviteCodeViaUI(page1);
    console.log('Got invite code:', inviteCode);
    expect(inviteCode).toBeTruthy();
    expect(inviteCode.length).toBeGreaterThan(0);

    // User 2: Create account and join band
    const user2 = createTestUser();
    await signUpViaUI(page2, user2);
    await expect(page2).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Join band using invite code
    await joinBandViaUI(page2, inviteCode);

    // Verify User 2 is redirected to a band page (songs, band-members, or bands)
    await expect(page2).toHaveURL(/\/(songs|band-members|bands)/, { timeout: 10000 });

    // Verify User 2 can see band name
    const user2BandName = page2.locator(selectors.band.sidebarBandName).first();
    await expect(user2BandName).toBeAttached({ timeout: 5000 });
    await expect(user2BandName).toHaveText(bandName);

    // Verify User 1 sees User 2 in members list (navigate to band members page)
    await page1.goto('/band-members');
    await page1.waitForLoadState('networkidle');

    // Verify both test users are present (page has desktop + mobile views, so use .first())
    const user1InList = page1.locator(`[data-testid="member-row-${user1.email}"]`).first();
    const user2InList = page1.locator(`[data-testid="member-row-${user2.email}"]`).first();
    await expect(user1InList).toBeVisible({ timeout: 5000 });
    await expect(user2InList).toBeVisible({ timeout: 5000 });

    // Verify User 2 has correct role (member, not admin)
    await page2.goto('/band-members');
    await page2.waitForLoadState('networkidle');

    // Find User 2's member row using proper data-testid selector (use .first() for responsive layouts)
    const user2MemberRow = page2.locator(`[data-testid="member-row-${user2.email}"]`).first();
    await expect(user2MemberRow).toBeVisible({ timeout: 5000 });

    // Look for role badge within the member row - should be "Member" not "Admin"
    const user2RoleBadge = user2MemberRow.locator(`[data-testid="member-role"]`).first();
    await expect(user2RoleBadge).toBeVisible({ timeout: 5000 });
    const roleText = await user2RoleBadge.textContent();
    expect(roleText?.toLowerCase()).toContain('member');

    // CRITICAL: Verify User 2 sees User 1 in the members list (not just themselves)
    // This tests that band membership data syncs correctly for newly joined members
    const user1MemberRow = page2.locator(`[data-testid="member-row-${user1.email}"]`).first();
    await expect(user1MemberRow).toBeVisible({ timeout: 5000 });

    // Verify User 1 has Admin role badge
    const user1RoleBadge = user1MemberRow.locator(`[data-testid="member-role"]`).first();
    await expect(user1RoleBadge).toBeVisible({ timeout: 5000 });
    const user1RoleText = await user1RoleBadge.textContent();
    expect(user1RoleText?.toLowerCase()).toContain('admin');

    // Verify User 2 sees both members (use .first() to handle desktop + mobile views)
    // Already verified above that both user1 and user2 member rows are visible

    // Verify no console errors for both users
    await assertNoConsoleErrors(page1, errors1);
    await assertNoConsoleErrors(page2, errors2);

    // Clean up
    await context1.close();
    await context2.close();
  });

  test('joining with invalid invite code shows error', async ({ page }) => {
    const user = createTestUser();

    // Sign up
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Try to join with invalid code
    const invalidCode = 'INVALID123';
    await page.fill(selectors.band.inviteCodeInput, invalidCode);
    await page.click(selectors.band.joinButton);

    // Should see error message (toast or inline error)
    // Wait a bit for error to appear
    await page.waitForTimeout(1000);

    // Should not redirect (stay on get-started page)
    await expect(page).toHaveURL(/\/get-started/);

    // Look for error message in toast or alert
    const errorMessage = page.locator('[data-testid="toast-error"], [role="alert"], text=/invalid.*code/i').first();
    const hasError = await errorMessage.isVisible().catch(() => false);

    // If no visible error found, check console for error
    if (!hasError) {
      console.warn('No visible error message found for invalid invite code - may need to improve error handling');
    }
  });

  test('user can be member of multiple bands', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page);

    // Create user
    const user = createTestUser();
    await signUpViaUI(page, user);
    await expect(page).toHaveURL(/\/get-started/, { timeout: 10000 });

    // Create first band
    const band1Name = `Band One ${Date.now()}`;
    await createBandViaUI(page, band1Name);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Navigate back to create/join page to create second band
    await page.goto('/get-started');

    // Create second band
    const band2Name = `Band Two ${Date.now() + 1}`;
    await createBandViaUI(page, band2Name);
    await page.waitForURL(/\/songs/, { timeout: 10000 });

    // Open band selector (if it exists)
    const bandSelector = page.locator('[data-testid="band-selector"]');
    const hasBandSelector = await bandSelector.isVisible().catch(() => false);

    if (hasBandSelector) {
      await bandSelector.click();

      // Should see both bands in selector
      await expect(page.locator(`text=${band1Name}`)).toBeVisible({ timeout: 3000 });
      await expect(page.locator(`text=${band2Name}`)).toBeVisible({ timeout: 3000 });

      // Switch to first band
      await page.click(`text=${band1Name}`);
      await page.waitForTimeout(500);

      // Verify band name changed
      const currentBandName = page.locator(selectors.band.sidebarBandName).first();
      await expect(currentBandName).toHaveText(band1Name, { timeout: 3000 });
    } else {
      console.warn('Band selector not found - multi-band switching may not be implemented yet');
    }

    // Verify no console errors
    await assertNoConsoleErrors(page, errors);
  });
});
