# Create E2E Tests for Setlists, Shows, and Practices

**Agent:** Any agent with E2E testing capability
**Status:** Blocked (waiting for 01-add-testability-attributes.md)
**Dependencies:** 01-add-testability-attributes.md (MUST be completed first)
**Priority:** Critical (MVP Blocker)
**Estimated Time:** 4-6 hours

---

## Objective

Create comprehensive Playwright E2E tests for Setlists (Flows 11-12), Shows (Flows 15-16), and Practices (Flow 14) to ensure MVP readiness and production confidence.

---

## Prerequisites

**CRITICAL:** Do not start until testability attributes are in place!

**Verify before starting:**
```bash
# Check that testid attributes exist
grep -r "data-testid.*setlist" src/pages/NewLayout/SetlistsPage.tsx
grep -r "data-testid.*show" src/pages/NewLayout/ShowsPage.tsx
grep -r "data-testid.*practice" src/pages/NewLayout/PracticesPage.tsx
```

If no results, **STOP** and wait for 01-add-testability-attributes.md completion.

---

## Reference Documents

- **E2E Implementation Plan:** `.claude/artifacts/2025-11-10T17:17_e2e-testing-implementation-plan.md`
- **Testing Strategy:** `.claude/specifications/testing-overview-and-strategy.md`
- **Existing E2E Tests:** `tests/e2e/` (for patterns and fixtures)

---

## Task 1: Create Setlists E2E Tests

**File:** `tests/e2e/setlists/crud.spec.ts`
**Estimated:** 2-3 hours
**Covers:** Flows 11-12

### Test Suite Structure

```typescript
import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Setlists CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    // Create user and band
    const user = await createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, 'E2E Test Band')

    // Navigate to setlists page
    await page.goto('/setlists')
  })

  // Tests here...
})
```

### 1.1 Flow 11: Create Setlist

**Test: member can create a new setlist with songs**

```typescript
test('member can create a new setlist with songs', async ({ page }) => {
  // ARRANGE: Navigate to setlists and ensure empty
  await expect(page.locator('[data-testid="setlist-empty-state"]')).toBeVisible()

  // First, create some songs to add to setlist
  await page.goto('/songs')
  await page.click('[data-testid="add-song-button"]')
  // Add 3 test songs (reuse song creation logic from songs/crud.spec.ts)
  // ... song creation code ...

  await page.goto('/setlists')

  // ACT: Create setlist
  await page.click('[data-testid="create-setlist-button"]')
  await expect(page.locator('[data-testid="setlist-modal"]')).toBeVisible()

  // Fill setlist name
  await page.fill('[data-testid="setlist-name-input"]', 'Summer Festival Set')

  // Set status
  await page.selectOption('[data-testid="setlist-status-select"]', 'active')

  // Add songs from available list
  await page.click('[data-testid="add-song-0"]')  // First song
  await page.click('[data-testid="add-song-1"]')  // Second song
  await page.click('[data-testid="add-song-2"]')  // Third song

  // Verify songs appear in setlist items
  await expect(page.locator('[data-testid="setlist-item-0"]')).toBeVisible()
  await expect(page.locator('[data-testid="setlist-item-1"]')).toBeVisible()
  await expect(page.locator('[data-testid="setlist-item-2"]')).toBeVisible()

  // Save setlist
  await page.click('[data-testid="save-setlist-button"]')

  // ASSERT: Setlist appears in list
  await expect(page.locator('[data-testid="setlist-list"]')).toBeVisible()

  const setlistItems = page.locator('[data-testid^="setlist-item-"]')
  await expect(setlistItems).toHaveCount(1)

  const setlistName = setlistItems.first().locator('[data-testid^="setlist-name-"]')
  await expect(setlistName).toHaveText('Summer Festival Set')

  const songCount = setlistItems.first().locator('[data-testid^="setlist-song-count-"]')
  await expect(songCount).toContainText('3 songs')
})
```

**Test: setlist calculates total duration correctly**

```typescript
test('setlist calculates total duration correctly', async ({ page }) => {
  // Create songs with known durations
  // Create setlist
  // Verify duration calculation
})
```

**Test: setlist can be set to different statuses**

```typescript
test('setlist can be set to different statuses (draft, active, archived)', async ({ page }) => {
  // Create setlist as draft
  // Verify status
  // Edit to active
  // Verify status change
})
```

### 1.2 Flow 12: Edit Setlist

**Test: member can edit existing setlist**

```typescript
test('member can edit existing setlist', async ({ page }) => {
  // ARRANGE: Create setlist first
  // ... create setlist code ...

  // ACT: Edit setlist
  const setlistItem = page.locator('[data-testid^="setlist-item-"]').first()
  await setlistItem.click()

  await page.click('[data-testid^="edit-setlist-"]')
  await expect(page.locator('[data-testid="setlist-modal"]')).toBeVisible()

  // Change name
  await page.fill('[data-testid="setlist-name-input"]', 'Updated Setlist Name')

  // Remove middle song
  await page.click('[data-testid="remove-item-1"]')

  // Verify only 2 songs remain
  await expect(page.locator('[data-testid^="setlist-item-"]')).toHaveCount(2)

  // Save changes
  await page.click('[data-testid="save-setlist-button"]')

  // ASSERT: Changes persist
  const updatedName = page.locator('[data-testid^="setlist-name-"]').first()
  await expect(updatedName).toHaveText('Updated Setlist Name')

  const updatedCount = page.locator('[data-testid^="setlist-song-count-"]').first()
  await expect(updatedCount).toContainText('2 songs')
})
```

**Test: member can reorder songs in setlist (drag and drop)**

```typescript
test('member can reorder songs in setlist', async ({ page }) => {
  // Create setlist with 3 songs
  // Verify initial order
  // Drag song from position 2 to position 0
  // Verify new order
  // Save and reload
  // Verify order persisted
})
```

**Test: member can delete setlist**

```typescript
test('member can delete setlist', async ({ page }) => {
  // Create setlist
  // Click delete button
  // Confirm deletion
  // Verify setlist removed from list
})
```

### 1.3 Additional Tests

```typescript
test('setlist changes sync to all band members', async ({ page, context }) => {
  // Multi-user test
})

test('empty setlist list shows appropriate message', async ({ page }) => {
  // Verify empty state
})

test('setlist can be associated with a show', async ({ page }) => {
  // Create show first
  // Create setlist
  // Associate with show
  // Verify link
})
```

---

## Task 2: Create Shows E2E Tests

**File:** `tests/e2e/shows/crud.spec.ts`
**Estimated:** 1.5-2 hours
**Covers:** Flows 15-16

### Test Suite Structure

```typescript
import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Shows CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    const user = await createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, 'E2E Test Band')
    await page.goto('/shows')
  })

  // Tests here...
})
```

### 2.1 Flow 15: Schedule Show

**Test: member can schedule a new show**

```typescript
test('member can schedule a new show with all details', async ({ page }) => {
  // ARRANGE: Verify empty state
  await expect(page.locator('[data-testid="show-empty-state"]')).toBeVisible()

  // ACT: Create show
  await page.click('[data-testid="create-show-button"]')
  await expect(page.locator('[data-testid="show-modal"]')).toBeVisible()

  // Fill show details
  await page.fill('[data-testid="show-name-input"]', 'Summer Music Festival')
  await page.fill('[data-testid="show-date-input"]', '2025-06-15')
  await page.fill('[data-testid="show-time-input"]', '20:00')
  await page.fill('[data-testid="show-venue-input"]', 'Red Rocks Amphitheatre')
  await page.fill('[data-testid="show-location-input"]', 'Morrison, CO')

  // Save show
  await page.click('[data-testid="save-show-button"]')

  // ASSERT: Show appears in list
  await expect(page.locator('[data-testid="show-list"]')).toBeVisible()

  const showItems = page.locator('[data-testid^="show-item-"]')
  await expect(showItems).toHaveCount(1)

  const showName = showItems.first().locator('[data-testid^="show-name-"]')
  await expect(showName).toHaveText('Summer Music Festival')

  const showVenue = showItems.first().locator('[data-testid^="show-venue-"]')
  await expect(showVenue).toHaveText('Red Rocks Amphitheatre')
})
```

**Test: show date displays correctly**

```typescript
test('show date is prominent and correctly formatted', async ({ page }) => {
  // Create show with specific date
  // Verify date formatting
})
```

### 2.2 Flow 16: Assign Setlist to Show

**Test: member can assign setlist to show during creation**

```typescript
test('member can assign setlist to show during creation', async ({ page }) => {
  // ARRANGE: Create setlist first
  await page.goto('/setlists')
  // ... create setlist ...

  await page.goto('/shows')

  // ACT: Create show with setlist
  await page.click('[data-testid="create-show-button"]')
  // ... fill show details ...

  // Select setlist
  await page.selectOption('[data-testid="show-setlist-select"]', 'Summer Festival Set')

  await page.click('[data-testid="save-show-button"]')

  // ASSERT: Show linked to setlist
  // Verify setlist displayed on show
})
```

**Test: member can assign setlist to existing show**

```typescript
test('member can assign setlist to existing show', async ({ page }) => {
  // Create show without setlist
  // Create setlist
  // Edit show to add setlist
  // Verify link
})
```

### 2.3 Additional Tests

```typescript
test('member can edit existing show', async ({ page }) => {
  // Create show
  // Edit details
  // Verify changes
})

test('member can delete show', async ({ page }) => {
  // Create show
  // Delete show
  // Verify removed
})

test('show changes sync to all band members', async ({ page, context }) => {
  // Multi-user test
})

test('empty show list shows appropriate message', async ({ page }) => {
  // Verify empty state
})
```

---

## Task 3: Create Practices E2E Tests

**File:** `tests/e2e/practices/crud.spec.ts`
**Estimated:** 1.5-2 hours
**Covers:** Flow 14

### Test Suite Structure

```typescript
import { test, expect } from '@playwright/test'
import { signUpViaUI, createTestUser } from '../../fixtures/auth'
import { createBandViaUI } from '../../fixtures/bands'

test.describe('Practice Sessions CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    const user = await createTestUser()
    await signUpViaUI(page, user)
    await createBandViaUI(page, 'E2E Test Band')
    await page.goto('/practices')
  })

  // Tests here...
})
```

### 3.1 Flow 14: Schedule Practice

**Test: member can schedule a practice session**

```typescript
test('member can schedule a practice session with all details', async ({ page }) => {
  // ARRANGE: Verify empty state
  await expect(page.locator('[data-testid="practice-empty-state"]')).toBeVisible()

  // ACT: Create practice
  await page.click('[data-testid="create-practice-button"]')
  await expect(page.locator('[data-testid="practice-modal"]')).toBeVisible()

  // Fill practice details
  await page.fill('[data-testid="practice-date-input"]', '2025-05-20')
  await page.fill('[data-testid="practice-time-input"]', '19:00')
  await page.fill('[data-testid="practice-duration-input"]', '2')
  await page.fill('[data-testid="practice-location-input"]', 'Studio B')

  // Save practice
  await page.click('[data-testid="save-practice-button"]')

  // ASSERT: Practice appears in list
  await expect(page.locator('[data-testid="practice-list"]')).toBeVisible()

  const practiceItems = page.locator('[data-testid^="practice-item-"]')
  await expect(practiceItems).toHaveCount(1)

  const practiceLocation = practiceItems.first().locator('[data-testid^="practice-location-"]')
  await expect(practiceLocation).toHaveText('Studio B')
})
```

**Test: member can select songs for practice**

```typescript
test('member can select songs to practice', async ({ page }) => {
  // ARRANGE: Create 3 songs first
  await page.goto('/songs')
  // ... create songs ...

  await page.goto('/practices')

  // ACT: Create practice with songs
  await page.click('[data-testid="create-practice-button"]')
  // ... fill practice details ...

  // Select songs
  await page.check('[data-testid="practice-song-0-checkbox"]')
  await page.check('[data-testid="practice-song-2-checkbox"]')

  await page.click('[data-testid="save-practice-button"]')

  // ASSERT: Songs associated with practice
  // Verify song count or list
})
```

**Test: practice auto-populates songs from associated show**

```typescript
test('practice auto-populates songs from associated show', async ({ page }) => {
  // ARRANGE: Create show with setlist
  // ... create show with setlist ...

  await page.goto('/practices')

  // ACT: Create practice associated with show
  await page.click('[data-testid="create-practice-button"]')
  // ... fill practice details ...

  // Select show
  await page.selectOption('[data-testid="practice-show-select"]', 'Summer Music Festival')

  // ASSERT: Songs auto-populated from show's setlist
  // Verify checkboxes are pre-checked
})
```

### 3.2 Additional Tests

```typescript
test('member can edit existing practice', async ({ page }) => {
  // Create practice
  // Edit details
  // Verify changes
})

test('member can delete practice', async ({ page }) => {
  // Create practice
  // Delete practice
  // Verify removed
})

test('practice changes sync to all band members', async ({ page, context }) => {
  // Multi-user test
})

test('empty practice list shows appropriate message', async ({ page }) => {
  // Verify empty state
})
```

---

## Execution Instructions

### Run Tests Locally

```bash
# 1. Ensure local Supabase is running
npm run supabase:start

# 2. Reset database to clean state
supabase db reset

# 3. Run all new E2E tests
npx playwright test tests/e2e/setlists
npx playwright test tests/e2e/shows
npx playwright test tests/e2e/practices

# 4. Run full E2E suite
npm run test:e2e

# 5. View test report
npx playwright show-report
```

### Debug Failing Tests

```bash
# Run in UI mode
npx playwright test tests/e2e/setlists --ui

# Run in debug mode
npx playwright test tests/e2e/setlists --debug

# Generate trace
npx playwright test tests/e2e/setlists --trace on
npx playwright show-trace trace.zip
```

---

## Success Criteria

### Setlists Tests
- ✅ 6+ tests written
- ✅ All browsers passing (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari)
- ✅ Covers Flows 11-12
- ✅ No flaky tests
- ✅ Execution time < 3 minutes

### Shows Tests
- ✅ 5+ tests written
- ✅ All browsers passing
- ✅ Covers Flows 15-16
- ✅ No flaky tests
- ✅ Execution time < 2 minutes

### Practices Tests
- ✅ 5+ tests written
- ✅ All browsers passing
- ✅ Covers Flow 14
- ✅ No flaky tests
- ✅ Execution time < 2 minutes

### Overall
- ✅ Total 16+ new tests added
- ✅ Full E2E suite still passes (140+ tests)
- ✅ No console errors during test execution
- ✅ Screenshots/videos captured on failure
- ✅ Test report generated successfully

---

## Final Verification

Before marking complete:

1. **Run full E2E suite:**
   ```bash
   npm run test:e2e
   ```
   All tests must pass across all 5 browsers.

2. **Check test execution time:**
   Total suite time should remain < 10 minutes.

3. **Verify no console errors:**
   Review test output for unexpected errors.

4. **Update documentation:**
   Update E2E implementation plan with new test counts.

5. **Update task tracker:**
   Mark task as completed with final test counts.

---

**Ready to Start:** NO (blocked by 01-add-testability-attributes.md)
**Blocker:** Testability attributes must be added first
**Next Action:** Wait for Task 1 completion, then begin test creation
