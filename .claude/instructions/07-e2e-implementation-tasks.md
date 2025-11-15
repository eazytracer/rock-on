---
created: 2025-11-10T17:23
type: implementation-plan
status: active
priority: critical
parent: 2025-11-10T17:17_e2e-testing-implementation-plan.md
---

# E2E Testing Framework Implementation - Detailed Task Breakdown

## Overview

This document breaks down the e2e testing implementation into discrete, actionable tasks that can be executed by individual agents or developers. Each phase includes clear objectives, deliverables, and acceptance criteria.

**Related Documents:**
- Testing Strategy: `.claude/specifications/testing-overview-and-strategy.md`
- Original Plan: `.claude/artifacts/2025-11-10T17:17_e2e-testing-implementation-plan.md`
- **Realtime Multi-Session Testing Plan:** `.claude/artifacts/2025-11-10T20:45_realtime-testing-plan.md` ⚠️ CRITICAL
- Realtime Architecture Analysis: `.claude/artifacts/2025-11-10T20:30_realtime-architecture-analysis.md`

---

## Phase 1: Foundation & Infrastructure Setup

**Timeline:** Days 1-3
**Goal:** Get Playwright installed, configured, and operational with first passing test

### Task 1.1: Install Playwright and Dependencies

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 15 minutes

**Steps:**
1. Install Playwright as dev dependency
   ```bash
   npm install -D @playwright/test
   ```

2. Install Playwright browsers
   ```bash
   npx playwright install
   ```

3. Verify installation
   ```bash
   npx playwright --version
   ```

**Deliverables:**
- ✅ `@playwright/test` in `package.json` devDependencies
- ✅ Playwright browsers installed
- ✅ `npx playwright --version` returns version number

**Acceptance Criteria:**
- [x] `package.json` contains `@playwright/test` as devDependency
- [x] Command `npx playwright --version` succeeds
- [x] All browsers installed (Chromium, Firefox, WebKit)

**Status:** ✅ COMPLETED (2025-11-10)

---

### Task 1.2: Create Playwright Configuration

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 20 minutes

**Steps:**
1. Create `playwright.config.ts` in project root

2. Configure basic settings:
   - Test directory: `./tests/e2e`
   - Timeout: 30 seconds per test
   - Parallel execution: enabled
   - Base URL: `http://localhost:5173`
   - Retry: 2x on CI, 0x locally
   - Screenshot on failure
   - Video on failure
   - Trace on first retry

3. Configure 5 projects:
   - Desktop Chrome
   - Desktop Firefox
   - Desktop Safari (WebKit)
   - Mobile Chrome (Pixel 5)
   - Mobile Safari (iPhone 12)

4. Configure web server:
   - Command: `npm run dev`
   - URL: `http://localhost:5173`
   - Reuse existing server locally
   - Timeout: 120 seconds

5. Add npm script to `package.json`:
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui",
       "test:e2e:debug": "playwright test --debug",
       "test:e2e:report": "playwright show-report"
     }
   }
   ```

**Reference:**
See configuration template in `.claude/artifacts/2025-11-10T17:17_e2e-testing-implementation-plan.md` (lines 476-559)

**Deliverables:**
- ✅ `playwright.config.ts` created
- ✅ npm scripts added to `package.json`

**Acceptance Criteria:**
- [ ] `playwright.config.ts` exists in project root
- [ ] Config includes 5 browser projects
- [ ] Web server configured to start dev server
- [ ] npm script `test:e2e` runs Playwright
- [ ] Command `npm run test:e2e -- --help` succeeds

---

### Task 1.3: Create E2E Directory Structure

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 10 minutes

**Steps:**
1. Create directory structure:
   ```
   tests/e2e/
   ├── auth/
   ├── bands/
   ├── songs/
   ├── setlists/
   ├── shows/
   ├── practices/
   ├── realtime/
   ├── permissions/
   └── errors/
   ```

2. Create fixtures directory:
   ```
   tests/fixtures/
   ├── auth.ts
   ├── bands.ts
   ├── users.ts
   ├── songs.ts
   ├── database.ts
   └── supabase.ts
   ```

3. Create helpers directory:
   ```
   tests/helpers/
   ├── assertions.ts
   └── selectors.ts
   ```

4. Create `.gitignore` entries:
   ```
   playwright-report/
   test-results/
   playwright/.cache/
   ```

**Deliverables:**
- ✅ Full directory structure created
- ✅ `.gitignore` updated

**Acceptance Criteria:**
- [ ] All directories exist
- [ ] `.gitignore` includes Playwright artifacts
- [ ] Directory structure matches plan

---

### Task 1.4: Implement Supabase Test Fixture

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 20 minutes

**Steps:**
1. Create `tests/fixtures/supabase.ts`

2. Implement Supabase admin client:
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '<local-service-key>'

   export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
     auth: {
       autoRefreshToken: false,
       persistSession: false
     }
   })
   ```

3. Add helper functions:
   - `getLocalServiceKey()` - Extract from `supabase status`
   - `ensureSupabaseRunning()` - Check if local Supabase is running

**Deliverables:**
- ✅ `tests/fixtures/supabase.ts` created
- ✅ Supabase admin client configured

**Acceptance Criteria:**
- [ ] File exports `supabaseAdmin` client
- [ ] Client uses correct URL and service key
- [ ] Helper functions work with local Supabase

---

### Task 1.5: Implement Database Fixture

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 30 minutes

**Steps:**
1. Create `tests/fixtures/database.ts`

2. Implement database reset function:
   ```typescript
   import { exec } from 'child_process'
   import { promisify } from 'util'

   const execAsync = promisify(exec)

   export async function resetLocalDatabase() {
     if (process.env.NODE_ENV === 'production') {
       throw new Error('Cannot reset production database!')
     }
     await execAsync('supabase db reset --local')
   }
   ```

3. Implement seed function:
   ```typescript
   export async function seedTestData() {
     await execAsync('supabase db seed --local')
   }
   ```

4. Implement cleanup function:
   ```typescript
   export async function clearTestData() {
     // Delete test data for specific tables
     // Only delete records with emails matching @rockontesting.com
   }
   ```

**Reference:**
See template in plan (lines 755-819)

**Deliverables:**
- ✅ `tests/fixtures/database.ts` created
- ✅ Reset, seed, and cleanup functions implemented

**Acceptance Criteria:**
- [ ] `resetLocalDatabase()` works
- [ ] `seedTestData()` works
- [ ] `clearTestData()` only removes test data
- [ ] Functions throw error if NODE_ENV=production

---

### Task 1.6: Implement Auth Fixtures

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 40 minutes

**Steps:**
1. Create `tests/fixtures/auth.ts`

2. Define `TestUser` interface:
   ```typescript
   export interface TestUser {
     email: string
     password: string
     name: string
     id?: string
   }
   ```

3. Implement `createTestUser()`:
   - Generate unique email: `test.user.${timestamp}@rockontesting.com`
   - Use Supabase admin client to create user
   - Return user object with ID

4. Implement `signUpViaUI()`:
   - Navigate to `/auth`
   - Fill signup form
   - Submit form
   - Wait for redirect to `/get-started`

5. Implement `loginViaUI()`:
   - Navigate to `/auth`
   - Fill login form
   - Submit form
   - Wait for redirect

6. Implement `deleteTestUser()`:
   - Use admin client to delete user
   - Handle errors gracefully

**Reference:**
See template in plan (lines 565-647)

**Deliverables:**
- ✅ `tests/fixtures/auth.ts` created
- ✅ All auth helper functions implemented

**Acceptance Criteria:**
- [ ] `createTestUser()` creates user in Supabase
- [ ] `signUpViaUI()` completes signup flow
- [ ] `loginViaUI()` completes login flow
- [ ] `deleteTestUser()` removes user from Supabase
- [ ] All functions have TypeScript types

---

### Task 1.7: Implement Band Fixtures

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 40 minutes

**Steps:**
1. Create `tests/fixtures/bands.ts`

2. Define `TestBand` interface:
   ```typescript
   export interface TestBand {
     id?: string
     name: string
     description?: string
     inviteCode?: string
     ownerId?: string
   }
   ```

3. Implement UI helper functions:
   - `createBandViaUI(page, bandName)` - Create band through UI
   - `getInviteCodeViaUI(page)` - Get invite code from UI
   - `joinBandViaUI(page, inviteCode)` - Join band through UI

4. Implement database helper functions:
   - `createBandInDB(band, ownerId)` - Create band directly in DB
   - `deleteBandFromDB(bandId)` - Clean up band

**Reference:**
See template in plan (lines 649-751)

**Deliverables:**
- ✅ `tests/fixtures/bands.ts` created
- ✅ All band helper functions implemented

**Acceptance Criteria:**
- [ ] `createBandViaUI()` creates band through UI
- [ ] `getInviteCodeViaUI()` extracts invite code
- [ ] `joinBandViaUI()` joins band through UI
- [ ] Database functions work with Supabase
- [ ] All functions have TypeScript types

---

### Task 1.8: Implement Helper Utilities

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 30 minutes

**Steps:**
1. Create `tests/helpers/selectors.ts`:
   - Export object with reusable selectors
   - Organize by feature (auth, band, songs, etc.)
   - Use semantic selectors (data-testid, role, text)

2. Create `tests/helpers/assertions.ts`:
   - `assertNoConsoleErrors(page)` - Check for console errors
   - `assertToastMessage(page, message, type)` - Verify toast appears
   - `assertRedirectedTo(page, url)` - Verify URL redirect
   - `assertElementCount(page, selector, count)` - Count elements

**Reference:**
See template in plan (lines 823-915)

**Deliverables:**
- ✅ `tests/helpers/selectors.ts` created
- ✅ `tests/helpers/assertions.ts` created
- ✅ Reusable helper functions implemented

**Acceptance Criteria:**
- [ ] Selectors cover auth, band, songs, common elements
- [ ] Assertions handle common test scenarios
- [ ] Functions use Playwright best practices
- [ ] All functions have TypeScript types

---

### Task 1.9: Write First E2E Test (Smoke Test)

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 30 minutes

**Steps:**
1. Create `tests/e2e/auth/login-smoke.spec.ts`

2. Write simple smoke test:
   ```typescript
   import { test, expect } from '@playwright/test'

   test.describe('Auth Page Smoke Test', () => {
     test('auth page loads without errors', async ({ page }) => {
       // Track console errors
       const errors: string[] = []
       page.on('console', msg => {
         if (msg.type() === 'error') errors.push(msg.text())
       })

       // Navigate to auth page
       await page.goto('/auth')

       // Check page loads
       await expect(page).toHaveTitle(/Rock-On/)

       // Check form exists
       await expect(page.locator('input[name="email"]')).toBeVisible()
       await expect(page.locator('input[name="password"]')).toBeVisible()

       // No console errors
       expect(errors).toHaveLength(0)
     })
   })
   ```

3. Run test:
   ```bash
   npm run test:e2e
   ```

**Deliverables:**
- ✅ First E2E test file created
- ✅ Test passes successfully

**Acceptance Criteria:**
- [ ] Test file exists at `tests/e2e/auth/login-smoke.spec.ts`
- [ ] Test runs and passes: `npm run test:e2e`
- [ ] Playwright report generated
- [ ] No errors in test output

---

### Task 1.10: Document Phase 1 Completion

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 15 minutes

**Steps:**
1. Create artifact: `.claude/artifacts/2025-11-10T{time}_phase1-completion-report.md`

2. Document what was implemented:
   - List all fixtures created
   - List all helpers created
   - Confirm first test passing
   - Note any issues encountered

3. Update CLAUDE.md with E2E test commands:
   ```markdown
   ### E2E Testing Commands
   npm run test:e2e        # Run all E2E tests
   npm run test:e2e:ui     # Run with UI mode
   npm run test:e2e:debug  # Debug mode
   ```

**Deliverables:**
- ✅ Phase 1 completion report
- ✅ CLAUDE.md updated

**Acceptance Criteria:**
- [ ] Report documents all deliverables
- [ ] CLAUDE.md has E2E commands section
- [ ] Team can run tests successfully

---

## Phase 2: Critical Path Tests

**Timeline:** Days 4-7
**Goal:** Implement 5 critical user flows that catch production-blocking bugs

### Task 2.1: Flow 1 - Sign Up → Create First Band (CRITICAL)

**Agent Type:** General-purpose
**Priority:** P0 (Blocking - Production Bug)
**Estimated Time:** 1 hour

**Steps:**
1. Create `tests/e2e/auth/signup.spec.ts`

2. Implement test flow:
   ```typescript
   import { test, expect } from '@playwright/test'
   import { createTestUser, signUpViaUI } from '../../fixtures/auth'
   import { createBandViaUI } from '../../fixtures/bands'
   import { resetLocalDatabase } from '../../fixtures/database'

   test.describe('User Signup and Band Creation', () => {
     test.beforeEach(async () => {
       await resetLocalDatabase()
     })

     test('new user can sign up and create first band', async ({ page }) => {
       const user = createTestUser()

       // Step 1: Sign up
       await signUpViaUI(page, user)
       await expect(page).toHaveURL('/get-started')

       // Step 2: Create band
       const bandName = `Test Band ${Date.now()}`
       await page.fill('input[name="bandName"]', bandName)
       await page.click('button:has-text("Create Band")')

       // Step 3: Verify redirect to songs page
       await page.waitForURL('/songs', { timeout: 10000 })

       // Step 4: Verify band name displayed
       await expect(page.locator('[data-testid="band-name"]')).toHaveText(bandName)

       // Step 5: Verify user is owner
       await page.goto('/band-members')
       const userRole = page.locator('[data-testid="user-role"]').first()
       await expect(userRole).toHaveText('Owner')

       // Step 6: Verify invite code exists
       const inviteCode = page.locator('[data-testid="invite-code"]')
       await expect(inviteCode).toBeVisible()
       await expect(inviteCode).not.toHaveText('')

       // Step 7: Verify no console errors
       // (tracked via page.on('console') listener)
     })

     test('band creation handles RLS policies correctly', async ({ page }) => {
       // This test specifically validates the production bug fix
       const user = createTestUser()

       await signUpViaUI(page, user)
       await expect(page).toHaveURL('/get-started')

       const bandName = `RLS Test Band ${Date.now()}`
       await page.fill('input[name="bandName"]', bandName)

       // Track console for RLS errors
       const rlsErrors: string[] = []
       page.on('console', msg => {
         if (msg.text().includes('RLS') || msg.text().includes('policy')) {
           rlsErrors.push(msg.text())
         }
       })

       await page.click('button:has-text("Create Band")')
       await page.waitForURL('/songs', { timeout: 10000 })

       // Verify no RLS errors
       expect(rlsErrors).toHaveLength(0)
     })
   })
   ```

**Reference:**
Flow specification in plan (lines 87-99)

**Deliverables:**
- ✅ `tests/e2e/auth/signup.spec.ts` created
- ✅ Both tests pass
- ✅ RLS validation included

**Acceptance Criteria:**
- [ ] Test creates new user via UI
- [ ] Test creates band successfully
- [ ] Test verifies user is owner with admin role
- [ ] Test verifies invite code generated
- [ ] Test catches RLS policy violations
- [ ] Both tests pass consistently (3/3 runs)

---

### Task 2.2: Flow 2 - Join Existing Band via Invite Code

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 1 hour

**Steps:**
1. Create `tests/e2e/auth/join-band.spec.ts`

2. Implement multi-user test flow:
   ```typescript
   test('new user can join existing band via invite code', async ({ browser }) => {
     const context1 = await browser.newContext()
     const page1 = await context1.newPage()

     const context2 = await browser.newContext()
     const page2 = await context2.newPage()

     // User 1: Create band
     const user1 = createTestUser()
     await signUpViaUI(page1, user1)
     const bandName = `Multi User Band ${Date.now()}`
     await createBandViaUI(page1, bandName)

     // Get invite code
     const inviteCode = await getInviteCodeViaUI(page1)

     // User 2: Join band
     const user2 = createTestUser()
     await signUpViaUI(page2, user2)
     await joinBandViaUI(page2, inviteCode)

     // Verify User 2 redirected to songs page
     await expect(page2).toHaveURL('/songs')

     // Verify User 2 can see band name
     await expect(page2.locator('[data-testid="band-name"]')).toHaveText(bandName)

     // Verify User 1 sees User 2 in members list
     await page1.goto('/band-members')
     const memberCount = await page1.locator('[data-testid="member-row"]').count()
     expect(memberCount).toBe(2)

     // Verify User 2 is member (not admin)
     await page2.goto('/band-members')
     const user2Role = page2.locator(`[data-testid="member-role"][data-email="${user2.email}"]`)
     await expect(user2Role).toHaveText('Member')

     // Clean up
     await context1.close()
     await context2.close()
   })
   ```

**Reference:**
Flow specification in plan (lines 101-114)

**Deliverables:**
- ✅ `tests/e2e/auth/join-band.spec.ts` created
- ✅ Multi-user scenario works
- ✅ Test passes

**Acceptance Criteria:**
- [x] Test uses multiple browser contexts (2 users)
- [x] User 2 successfully joins User 1's band
- [x] User 2 has correct role (member)
- [x] Both users can see each other in members list
- [x] Test passes consistently

**Status:** ✅ COMPLETED (2025-11-12)

**Implementation Notes:**
- Fixed RLS policy to allow all band members to see each other (not just owners)
- Created migration: `20251112041613_fix_members_visibility_for_all_users.sql`
- Fixed race condition in `LocalRepository.addBandMembership()` using atomic `.put()`
- Test now passing consistently
- Related docs:
  - `.claude/artifacts/2025-11-12T04:12_join-band-workflow-status.md`
  - `.claude/plans/join-band-direct-sync-implementation.md` (archived)

---

### Task 2.3: Flow 3 - Login → Band Selection

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 45 minutes

**Steps:**
1. Create `tests/e2e/auth/login.spec.ts`

2. Implement test flow:
   ```typescript
   test('existing user logs in and sees band selector', async ({ page }) => {
     // Setup: Create user with 2 bands
     const user = await createTestUser()
     await signUpViaUI(page, user)

     const band1 = await createBandViaUI(page, 'Band One')
     const band2 = await createBandViaUI(page, 'Band Two')

     // Log out
     await page.click('[data-testid="user-menu"]')
     await page.click('button:has-text("Log Out")')
     await expect(page).toHaveURL('/auth')

     // Log back in
     await loginViaUI(page, user)

     // Should redirect to last-used band's songs page
     await expect(page).toHaveURL('/songs')

     // Open band selector
     await page.click('[data-testid="band-selector"]')

     // Should see both bands
     await expect(page.locator('[data-testid="band-option"]')).toHaveCount(2)

     // Switch to other band
     await page.click('[data-testid="band-option"]:has-text("Band One")')

     // Content should update
     await expect(page.locator('[data-testid="band-name"]')).toHaveText('Band One')
   })
   ```

**Reference:**
Flow specification in plan (lines 116-125)

**Deliverables:**
- ✅ `tests/e2e/auth/login.spec.ts` created
- ✅ Band switching works
- ✅ Test passes

**Acceptance Criteria:**
- [ ] User with multiple bands can log in
- [ ] Band selector shows all bands
- [ ] User can switch between bands
- [ ] Content updates when switching bands
- [ ] Test passes consistently

---

### Task 2.4: Flow 7 - Add Band Song

**Agent Type:** General-purpose
**Priority:** P0 (Blocking)
**Estimated Time:** 45 minutes

**Steps:**
1. Create `tests/e2e/songs/crud.spec.ts`

2. Implement add song test:
   ```typescript
   test('member can add song to band', async ({ page }) => {
     // Setup: Create user and band
     const user = await createTestUser()
     await signUpViaUI(page, user)
     await createBandViaUI(page, 'Test Band')

     // Navigate to songs page
     await page.goto('/songs')

     // Click Add Song
     await page.click('button:has-text("Add Song")')

     // Fill form
     await page.fill('input[name="title"]', 'Stairway to Heaven')
     await page.fill('input[name="artist"]', 'Led Zeppelin')
     await page.selectOption('select[name="key"]', 'Am')
     await page.fill('input[name="duration"]', '8:02')
     await page.fill('input[name="bpm"]', '82')
     await page.fill('input[name="tuning"]', 'Standard')

     // Submit
     await page.click('button:has-text("Save Song")')

     // Verify toast
     await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
     await expect(page.locator('[data-testid="toast-success"]')).toContainText('Song added')

     // Verify song appears in list
     const songRow = page.locator('[data-testid^="song-row-"]').filter({ hasText: 'Stairway to Heaven' })
     await expect(songRow).toBeVisible()

     // Verify song details
     await expect(songRow).toContainText('Led Zeppelin')
     await expect(songRow).toContainText('Am')
     await expect(songRow).toContainText('82 bpm')
   })
   ```

**Reference:**
Flow specification in plan (lines 169-186)

**Deliverables:**
- ✅ `tests/e2e/songs/crud.spec.ts` created
- ✅ Add song test passes
- ✅ Validation included

**Acceptance Criteria:**
- [ ] Test creates song through UI
- [ ] Song appears in song list
- [ ] All fields saved correctly
- [ ] Success toast shown
- [ ] Test passes consistently

---

### Task 2.5: Flow 20 - Band Isolation (RLS Validation)

**Agent Type:** General-purpose
**Priority:** P0 (Critical - Security)
**Estimated Time:** 1 hour

**Steps:**
1. Create `tests/e2e/permissions/band-isolation.spec.ts`

2. Implement isolation test:
   ```typescript
   test('users can only see their own band data', async ({ browser }) => {
     const context1 = await browser.newContext()
     const page1 = await context1.newPage()

     const context2 = await browser.newContext()
     const page2 = await context2.newPage()

     // User 1: Create Band A with song
     const user1 = await createTestUser()
     await signUpViaUI(page1, user1)
     await createBandViaUI(page1, 'Band A')

     await page1.goto('/songs')
     await page1.click('button:has-text("Add Song")')
     await page1.fill('input[name="title"]', 'Band A Song')
     await page1.fill('input[name="artist"]', 'Artist A')
     await page1.click('button:has-text("Save")')

     // User 2: Create Band B
     const user2 = await createTestUser()
     await signUpViaUI(page2, user2)
     await createBandViaUI(page2, 'Band B')

     // User 2: Navigate to songs page
     await page2.goto('/songs')

     // User 2 should NOT see Band A's song
     const bandASong = page2.locator('[data-testid^="song-row-"]').filter({ hasText: 'Band A Song' })
     await expect(bandASong).not.toBeVisible()

     // Verify User 2 only sees empty state or their own songs
     const songCount = await page2.locator('[data-testid^="song-row-"]').count()
     expect(songCount).toBe(0)

     // Clean up
     await context1.close()
     await context2.close()
   })
   ```

**Reference:**
Flow specification in plan (lines 352-361)

**Deliverables:**
- ✅ `tests/e2e/permissions/band-isolation.spec.ts` created
- ✅ RLS isolation validated
- ✅ Test passes

**Acceptance Criteria:**
- [ ] User in Band A cannot see Band B's data
- [ ] Test verifies songs, setlists, practices isolation
- [ ] No data leakage between bands
- [ ] Test passes consistently
- [ ] Catches RLS policy violations

---

### Task 2.6: Document Phase 2 Completion

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 20 minutes

**Steps:**
1. Create artifact: `.claude/artifacts/2025-11-10T{time}_phase2-completion-report.md`

2. Document:
   - 5 critical flows implemented
   - Test pass rates
   - Issues found and fixed
   - Screenshots of test runs
   - Performance metrics (test duration)

3. Update CLAUDE.md with test count:
   ```markdown
   **Current Test Status:**
   - 336 passing database tests
   - 73 passing unit tests
   - 5 passing E2E critical flows
   ```

**Deliverables:**
- ✅ Phase 2 completion report
- ✅ CLAUDE.md updated

**Acceptance Criteria:**
- [ ] All 5 critical flows passing
- [ ] Documentation complete
- [ ] Team notified of completion

---

## Phase 3: Full MVP Coverage

**Timeline:** Days 8-14
**Goal:** Implement remaining 20 user flows for comprehensive MVP coverage

### Task Group 3.1: Band Member Management (Flows 4-6)

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 3 hours

**Files to Create:**
- `tests/e2e/bands/manage-members.spec.ts`

**Tests to Implement:**
1. Admin invites and manages members (Flow 4)
2. Member edits own profile (Flow 5)
3. Admin removes member (Flow 6)

**Reference:** Plan lines 128-165

---

### Task Group 3.2: Songs Management (Flows 8-10)

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 3 hours

**Files to Create:**
- `tests/e2e/songs/crud.spec.ts` (expand existing)
- `tests/e2e/songs/search-filter.spec.ts`

**Tests to Implement:**
1. Member edits song (Flow 8)
2. Member deletes song (Flow 9)
3. Song search and filtering (Flow 10)

**Reference:** Plan lines 188-224

---

### Task Group 3.3: Setlist Management (Flows 11-13)

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 3 hours

**Files to Create:**
- `tests/e2e/setlists/crud.spec.ts`
- `tests/e2e/setlists/show-linking.spec.ts`

**Tests to Implement:**
1. Member creates setlist (Flow 11)
2. Member edits setlist (Flow 12)
3. Associate setlist with show (Flow 13)

**Reference:** Plan lines 227-265

---

### Task Group 3.4: Shows & Practices (Flows 14-16)

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 3 hours

**Files to Create:**
- `tests/e2e/practices/crud.spec.ts`
- `tests/e2e/shows/crud.spec.ts`

**Tests to Implement:**
1. Schedule practice session (Flow 14)
2. Schedule show (Flow 15)
3. Assign setlist to show (Flow 16)

**Reference:** Plan lines 268-312

---

### Task Group 3.5: Multi-User Scenarios (Flows 17-19)

**Agent Type:** General-purpose
**Priority:** P0 (Critical - Real-time sync)
**Estimated Time:** 4 hours

**Files to Create:**
- `tests/e2e/realtime/collaboration.spec.ts`
- `tests/e2e/realtime/offline-sync.spec.ts`
- `tests/e2e/realtime/conflicts.spec.ts`
- `tests/e2e/realtime/multi-session.spec.ts` ⚠️ **NEW - CRITICAL**

**Tests to Implement:**
1. Real-time collaboration (Flow 17)
2. Offline-online sync (Flow 18)
3. Conflict resolution (Flow 19)
4. Multi-session/multi-browser testing (NEW - addresses production issue)

**Reference:** Plan lines 315-348

**⚠️ CRITICAL ADDITION:**
**Comprehensive Multi-Session Testing Plan:** See `.claude/artifacts/2025-11-10T20:45_realtime-testing-plan.md`

This plan includes:
- Enhanced logging for RealtimeManager (Phase 1)
- Manual testing procedures for multi-browser scenarios (Phase 2)
- Automated Playwright tests for concurrent sessions (Phase 3)
- Connection state tracking and diagnostics
- Investigation of Supabase connection limits

**Special Considerations:**
- Requires network interception (offline simulation)
- Requires multiple browser contexts
- Requires waiting for realtime updates
- **Must implement Phase 1 logging enhancements FIRST**
- **Test same user in multiple browsers/tabs**
- **Validate connection pooling and limits**

---

### Task Group 3.6: Permissions (Flows 21-22)

**Agent Type:** General-purpose
**Priority:** P0 (Critical - Security)
**Estimated Time:** 2 hours

**Files to Create:**
- `tests/e2e/permissions/rbac.spec.ts`

**Tests to Implement:**
1. Role-based permissions (Flow 21)
2. Owner-only actions (Flow 22)

**Reference:** Plan lines 363-383

---

### Task Group 3.7: Error Handling (Flows 23-25)

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 3 hours

**Files to Create:**
- `tests/e2e/errors/network.spec.ts`
- `tests/e2e/errors/session.spec.ts`
- `tests/e2e/errors/validation.spec.ts`

**Tests to Implement:**
1. Network error recovery (Flow 23)
2. Session expiration (Flow 24)
3. Validation errors (Flow 25)

**Reference:** Plan lines 385-421

---

### Task 3.8: Document Phase 3 Completion

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 30 minutes

**Steps:**
1. Create artifact: `.claude/artifacts/2025-11-10T{time}_phase3-completion-report.md`

2. Document:
   - All 25 flows implemented and passing
   - Test coverage summary
   - Performance metrics
   - Flaky test report
   - Issues found during implementation

3. Update CLAUDE.md with full test count

**Deliverables:**
- ✅ Phase 3 completion report
- ✅ All 25 flows documented
- ✅ CLAUDE.md updated

---

## Phase 4: Polish & CI/CD

**Timeline:** Days 15-20
**Goal:** Production-ready testing infrastructure with CI/CD integration

### Task 4.1: Create Test Data Factories

**Agent Type:** General-purpose
**Priority:** P2
**Estimated Time:** 2 hours

**Steps:**
1. Create `tests/factories/` directory

2. Implement factories:
   - `UserFactory.ts` - Generate test users with defaults
   - `BandFactory.ts` - Generate bands with realistic data
   - `SongFactory.ts` - Generate songs with metadata
   - `SetlistFactory.ts` - Generate setlists with songs

3. Use Faker.js or similar for realistic data

**Example:**
```typescript
export class SongFactory {
  static create(overrides?: Partial<Song>): Song {
    return {
      title: faker.music.songName(),
      artist: faker.music.artist(),
      key: faker.helpers.arrayElement(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
      bpm: faker.number.int({ min: 60, max: 180 }),
      duration: faker.number.int({ min: 120, max: 480 }),
      ...overrides
    }
  }
}
```

---

### Task 4.2: Add Visual Regression Testing

**Agent Type:** General-purpose
**Priority:** P2
**Estimated Time:** 3 hours

**Steps:**
1. Configure Playwright visual comparisons

2. Take screenshots of key pages:
   - Songs page (empty state)
   - Songs page (with content)
   - Setlists page
   - Band members page

3. Implement visual regression tests:
   ```typescript
   test('songs page visual regression', async ({ page }) => {
     await page.goto('/songs')
     await expect(page).toHaveScreenshot('songs-page.png')
   })
   ```

4. Update screenshots on intentional UI changes

---

### Task 4.3: Add Performance Testing (Lighthouse)

**Agent Type:** General-purpose
**Priority:** P2
**Estimated Time:** 2 hours

**Steps:**
1. Install Lighthouse:
   ```bash
   npm install -D @playwright/test lighthouse
   ```

2. Create `tests/performance/lighthouse.spec.ts`

3. Run Lighthouse audits:
   ```typescript
   test('songs page performance', async ({ page }) => {
     await page.goto('/songs')

     const result = await lighthouse(page.url(), {
       port: new URL(page.url()).port
     })

     expect(result.lhr.categories.performance.score).toBeGreaterThan(0.9)
     expect(result.lhr.categories.accessibility.score).toBeGreaterThan(0.9)
   })
   ```

---

### Task 4.4: Create GitHub Actions Workflow

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 2 hours

**Steps:**
1. Create `.github/workflows/test.yml`

2. Configure workflow:
   ```yaml
   name: Test Suite

   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main, develop]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3

         - name: Install dependencies
           run: npm ci

         - name: Start Supabase
           run: npx supabase start

         - name: Run database tests
           run: npm run test:db

         - name: Run unit tests
           run: npm test

         - name: Run E2E tests
           run: npx playwright test

         - name: Upload Playwright report
           if: always()
           uses: actions/upload-artifact@v3
           with:
             name: playwright-report
             path: playwright-report/
   ```

3. Test workflow on PR

---

### Task 4.5: Create Test Reporting Dashboard

**Agent Type:** General-purpose
**Priority:** P2
**Estimated Time:** 2 hours

**Steps:**
1. Configure Playwright HTML reporter

2. Add custom reporter for metrics:
   - Test duration
   - Pass/fail rates
   - Flaky test tracking

3. Publish reports to GitHub Pages or similar

---

### Task 4.6: Document Testing Best Practices

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 1 hour

**Steps:**
1. Create `.claude/specifications/e2e-testing-best-practices.md`

2. Document:
   - How to write new tests
   - Debugging failed tests
   - Handling flaky tests
   - Test data management
   - Common patterns and anti-patterns

3. Include code examples

---

### Task 4.7: Create Test Maintenance Runbook

**Agent Type:** General-purpose
**Priority:** P2
**Estimated Time:** 1 hour

**Steps:**
1. Create `.claude/artifacts/2025-11-10T{time}_test-maintenance-runbook.md`

2. Document:
   - How to update tests when features change
   - How to debug CI failures
   - How to update visual regression baselines
   - How to handle test data drift

---

### Task 4.8: Document Phase 4 Completion

**Agent Type:** General-purpose
**Priority:** P1
**Estimated Time:** 30 minutes

**Steps:**
1. Create artifact: `.claude/artifacts/2025-11-10T{time}_phase4-completion-report.md`

2. Document:
   - CI/CD pipeline operational
   - Visual regression tests implemented
   - Performance tests implemented
   - Documentation complete

3. Create final summary report

---

## Summary of Deliverables

### Phase 1: Foundation (10 tasks)
- ✅ Playwright installed and configured
- ✅ Directory structure created
- ✅ All fixtures implemented (auth, bands, database, supabase)
- ✅ Helper utilities created (selectors, assertions)
- ✅ First smoke test passing

### Phase 2: Critical Flows (6 tasks)
- ✅ 5 critical user flows tested
- ✅ Production RLS bug validated
- ✅ Security (band isolation) validated

### Phase 3: Full Coverage (8 task groups)
- ✅ All 25 user flows tested
- ✅ Multi-user scenarios tested
- ✅ Error handling tested
- ✅ Comprehensive MVP coverage

### Phase 4: Production Ready (8 tasks)
- ✅ Test data factories
- ✅ Visual regression testing
- ✅ Performance testing (Lighthouse)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Test reporting dashboard
- ✅ Documentation and best practices

---

## Acceptance Criteria for Complete Implementation

### Technical Requirements
- [ ] All 25 E2E flows passing (3/3 consecutive runs)
- [ ] Test suite completes in < 10 minutes
- [ ] < 2% flakiness rate
- [ ] CI/CD pipeline operational
- [ ] All browsers tested (Chrome, Firefox, Safari)
- [ ] Mobile viewports tested

### Coverage Requirements
- [ ] 100% of critical user workflows covered
- [ ] 100% of RLS policies validated via E2E
- [ ] 90%+ of MVP features covered
- [ ] Error states and edge cases tested

### Documentation Requirements
- [ ] Testing strategy document complete
- [ ] Implementation plan complete
- [ ] Best practices guide complete
- [ ] Maintenance runbook complete
- [ ] CLAUDE.md updated with test commands

### Team Enablement
- [ ] Any developer can run tests locally
- [ ] Clear debugging instructions available
- [ ] Test failures are actionable
- [ ] New tests can be added easily

---

## Recommended Execution Order

### Week 1: Foundation
1. Task 1.1 → 1.2 → 1.3 (Setup infrastructure)
2. Task 1.4 → 1.5 → 1.6 → 1.7 (Implement fixtures)
3. Task 1.8 → 1.9 → 1.10 (First test + docs)

### Week 2: Critical Path
1. Task 2.1 (HIGHEST PRIORITY - Production bug)
2. Task 2.5 (Security validation)
3. Task 2.2 → 2.3 → 2.4 (Other critical flows)
4. Task 2.6 (Documentation)

### Week 3-4: Full Coverage
1. Task Group 3.1 → 3.2 → 3.3 → 3.4 (Sequential features)
2. Task Group 3.5 (Parallel, requires more time)
3. Task Group 3.6 (Security tests)
4. Task Group 3.7 (Error handling)
5. Task 3.8 (Documentation)

### Week 5: Polish
1. Task 4.1 → 4.2 → 4.3 (Testing improvements)
2. Task 4.4 (CI/CD - can be parallel)
3. Task 4.5 → 4.6 → 4.7 (Docs and tooling)
4. Task 4.8 (Final documentation)

---

## Agent Instructions

When executing these tasks:

1. **Always run tests before and after changes**
   ```bash
   npm run test:all
   npx playwright test
   ```

2. **Document issues encountered**
   - Create timestamped artifacts for blockers
   - Include screenshots for failures
   - Note flaky tests

3. **Use TypeScript best practices**
   - Type all fixtures and helpers
   - Use strict mode
   - Export interfaces

4. **Follow testing conventions**
   - Use data-testid for test selectors
   - Implement wait conditions (no arbitrary timeouts)
   - Keep tests focused (one flow per test)

5. **Maintain test isolation**
   - Reset database between test suites
   - Use unique test data (timestamps)
   - Clean up after tests

---

**Status:** Active
**Version:** 1.0
**Last Updated:** 2025-11-10
**Next Review:** After Phase 1 completion
