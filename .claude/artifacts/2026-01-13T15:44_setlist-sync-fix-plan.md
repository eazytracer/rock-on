# Implementation Plan: Setlist Sync Bypass Bug Fix

**Date:** 2026-01-13
**Bug Report:** `.claude/artifacts/2026-01-13T15:44_bug-report-setlist-sync-bypass.md`
**Branch:** `bugfix/setlist-sync-bypass`

## Executive Summary

This plan addresses a **critical data integrity issue** where setlists and shows created or modified through certain pages bypass the SyncRepository and write directly to IndexedDB, causing:

1. **Data loss risk** - Data only exists locally
2. **Multi-user sync broken** - Band members cannot see each other's changes
3. **False sync status** - Green sync icon is misleading
4. **Offline sync broken** - Data will never sync even when back online

## Affected Files Summary

| File                  | Direct DB Bypasses | Priority     |
| --------------------- | ------------------ | ------------ |
| `SetlistViewPage.tsx` | 6 occurrences      | **Critical** |
| `ShowViewPage.tsx`    | 6 occurrences      | **High**     |
| `SetlistsPage.tsx`    | 2 occurrences      | Low          |

---

## Detailed Analysis

### 1. SetlistViewPage.tsx (PRIMARY ISSUE - 6 occurrences)

| Line | Operation | Code                                         | Impact                                  |
| ---- | --------- | -------------------------------------------- | --------------------------------------- |
| ~244 | Update    | `await db.setlists.update(setlistId, {...})` | Field changes don't sync                |
| ~280 | Create    | `await db.setlists.add({...})`               | New setlists don't sync                 |
| ~344 | Update    | `await db.setlists.update(setlistId, {...})` | Reordering doesn't sync                 |
| ~450 | Update    | `await db.setlists.update(setlistId, {...})` | Adding breaks doesn't sync              |
| ~492 | Update    | `await db.setlists.update(setlistId, {...})` | Adding sections doesn't sync            |
| ~799 | Update    | `await db.songs.update(...)`                 | Song edits from setlist view don't sync |

### 2. ShowViewPage.tsx (SECONDARY ISSUE - 6 occurrences)

| Line | Operation | Code                                   | Impact                            |
| ---- | --------- | -------------------------------------- | --------------------------------- |
| ~309 | Update    | `await db.shows.update(showId, {...})` | Show field changes don't sync     |
| ~342 | Update    | `await db.shows.update(showId, {...})` | DateTime changes don't sync       |
| ~373 | Update    | `await db.shows.update(showId, {...})` | Contact changes don't sync        |
| ~413 | Create    | `await db.setlists.add(forkedSetlist)` | Forked setlists don't sync        |
| ~456 | Create    | `await db.setlists.add(newSetlist)`    | New setlists from show don't sync |
| ~474 | Create    | `await db.shows.add({...})`            | New shows don't sync              |

### 3. SetlistsPage.tsx (MINOR ISSUE - 2 occurrences)

| Line  | Operation | Code                                    | Impact                          |
| ----- | --------- | --------------------------------------- | ------------------------------- |
| ~1666 | Update    | `await db.practiceSessions.update(...)` | setlistId clearing doesn't sync |
| ~1728 | Update    | `await db.practiceSessions.update(...)` | Show association doesn't sync   |

---

## Root Cause

The application follows a **local-first architecture** where:

```
CORRECT FLOW:
  Component -> SyncRepository -> LocalRepository (IndexedDB)
                              -> SyncEngine.queueCreate() -> Sync Queue
                              -> SyncEngine.syncNow() -> RemoteRepository (Supabase)

BROKEN FLOW (Current):
  Component -> db.setlists.add() (Dexie directly)
  Result: Data goes to IndexedDB but sync queue is NEVER populated
```

---

## Fix Pattern

For each direct database call, replace with the SyncRepository equivalent:

### Create Operations

```typescript
// BEFORE (broken)
await db.setlists.add({ id, name, bandId, ... })

// AFTER (correct)
import { getSyncRepository } from '../services/data/SyncRepository'
const repo = getSyncRepository()
await repo.addSetlist({ id, name, bandId, ... })
```

### Update Operations

```typescript
// BEFORE (broken)
await db.setlists.update(setlistId, { name: newName, lastModified: new Date() })

// AFTER (correct)
const repo = getSyncRepository()
await repo.updateSetlist(setlistId, { name: newName, lastModified: new Date() })
```

---

## Implementation Details

### Fix 1: SetlistViewPage.tsx - createSetlist function

**Location:** Around line 263-299

**Current (broken):**

```typescript
const createSetlist = async () => {
  try {
    setSaving(true)

    const dbItems = items.map((item, index) => ({
      id: item.id,
      type: item.type,
      position: index + 1,
      songId: item.songId,
      breakDuration: item.breakDuration,
      breakNotes: item.breakNotes,
      sectionTitle: item.sectionTitle,
      notes: item.notes,
    }))

    const newId = crypto.randomUUID()
    await db.setlists.add({
      id: newId,
      bandId: currentBandId,
      name: formName,
      status: formStatus as 'draft' | 'active' | 'archived',
      notes: formNotes,
      items: dbItems,
      totalDuration: calculateSetlistDuration(items),
      createdDate: new Date(),
      lastModified: new Date(),
    })

    showToast('Setlist created', 'success')
    navigate(`/setlists/${newId}`, { replace: true })
  } catch (err) {
    console.error('Error creating setlist:', err)
    showToast('Failed to create setlist', 'error')
  } finally {
    setSaving(false)
  }
}
```

**Replace with:**

```typescript
const createSetlist = async () => {
  try {
    setSaving(true)
    const repo = getSyncRepository()

    const dbItems = items.map((item, index) => ({
      id: item.id,
      type: item.type,
      position: index + 1,
      songId: item.songId,
      breakDuration: item.breakDuration,
      breakNotes: item.breakNotes,
      sectionTitle: item.sectionTitle,
      notes: item.notes,
    }))

    const newId = crypto.randomUUID()
    await repo.addSetlist({
      id: newId,
      bandId: currentBandId,
      name: formName,
      status: formStatus as 'draft' | 'active' | 'archived',
      notes: formNotes,
      items: dbItems,
      totalDuration: calculateSetlistDuration(items),
      createdDate: new Date(),
      lastModified: new Date(),
    })

    showToast('Setlist created', 'success')
    navigate(`/setlists/${newId}`, { replace: true })
  } catch (err) {
    console.error('Error creating setlist:', err)
    showToast('Failed to create setlist', 'error')
  } finally {
    setSaving(false)
  }
}
```

### Fix 2: SetlistViewPage.tsx - saveField function

**Location:** Around line 233-260

Replace `db.setlists.update(setlistId, {...})` with `repo.updateSetlist(setlistId, {...})`

### Fix 3: SetlistViewPage.tsx - saveItems function

**Location:** Around line 329-351

Replace `db.setlists.update(setlistId, {...})` with `repo.updateSetlist(setlistId, {...})`

### Fix 4: SetlistViewPage.tsx - addBreak function

**Location:** Around line 424-460

Replace `db.setlists.update(setlistId, {...})` with `repo.updateSetlist(setlistId, {...})`

### Fix 5: SetlistViewPage.tsx - addSection function

**Location:** Around line 463-502

Replace `db.setlists.update(setlistId, {...})` with `repo.updateSetlist(setlistId, {...})`

### Fix 6: SetlistViewPage.tsx - EditSongModal onSave

**Location:** Around line 797-826

Replace `db.songs.update(updatedSong.id!, updatedSong)` with `repo.updateSong(updatedSong.id!, updatedSong)`

### Fix 7-12: ShowViewPage.tsx

Apply same pattern to all 6 occurrences in ShowViewPage.tsx

### Fix 13-14: SetlistsPage.tsx

Apply same pattern to practice session updates

---

## E2E Testing Strategy

### Infrastructure Already Available

The codebase already has working database verification patterns:

| Component            | Location                                   | Purpose                                           |
| -------------------- | ------------------------------------------ | ------------------------------------------------- |
| `getSupabaseAdmin()` | `tests/fixtures/supabase.ts`               | Admin client with service role key (bypasses RLS) |
| Existing sync tests  | `tests/e2e/sync/setlist-show-sync.spec.ts` | Reference implementation                          |
| Database helpers     | `tests/helpers/testSupabase.ts`            | Table counts, schema verification                 |
| Environment          | `.env.test`                                | Service role key (auto-generated)                 |

### New Test File: `tests/e2e/sync/database-sync-verification.spec.ts`

This file will contain comprehensive sync verification tests.

---

## E2E Test Cases - Category 1: Positive Sync Tests

### Test 1.1: New Setlist Syncs to Supabase

```typescript
import { test, expect } from '@playwright/test'
import { getSupabaseAdmin } from '../../fixtures/supabase'
import { signUpViaUI, createBandViaUI } from '../../fixtures/auth'
import { createTestUser } from '../../fixtures/users'

test('newly created setlist via SetlistViewPage syncs to Supabase', async ({
  page,
}) => {
  const user = createTestUser()
  await signUpViaUI(page, user)
  await createBandViaUI(page, `Test Band ${Date.now()}`)

  const setlistName = `E2E Sync Test ${Date.now()}`

  // Navigate to /setlists/new
  await page.goto('/setlists/new')

  // Fill setlist name (inline editable field)
  await page.locator('[data-testid="setlist-header"]').click()
  await page.keyboard.type(setlistName)
  await page.keyboard.press('Tab')

  // Click create button
  await page.click('[data-testid="create-setlist-button"]')

  // Wait for redirect (indicates local save)
  await page.waitForURL(/\/setlists\/[a-z0-9-]+/)

  // Allow time for sync (max 5 seconds)
  await page.waitForTimeout(3000)

  // Verify in Supabase
  const supabase = await getSupabaseAdmin()
  const { data: setlists, error } = await supabase
    .from('setlists')
    .select('*')
    .ilike('name', `%${setlistName}%`)

  expect(error).toBeNull()
  expect(setlists).not.toBeNull()
  expect(setlists!.length).toBeGreaterThan(0)
  console.log(`✅ Setlist verified in Supabase: ${setlists![0].id}`)
})
```

### Test 1.2: Setlist Field Updates Sync

```typescript
test('editing setlist name syncs to Supabase', async ({ page }) => {
  // ... setup user/band ...
  // Create setlist first
  const originalName = `Original ${Date.now()}`
  const updatedName = `Updated ${Date.now()}`

  // Create via UI, then edit inline
  // ... create setlist ...

  // Edit name inline
  await page.locator('[data-testid="setlist-header"] [contenteditable]').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(updatedName)
  await page.keyboard.press('Tab')

  // Wait for sync
  await page.waitForTimeout(3000)

  // Verify in Supabase
  const supabase = await getSupabaseAdmin()
  const { data } = await supabase
    .from('setlists')
    .select('name')
    .ilike('name', `%${updatedName}%`)

  expect(data!.length).toBe(1)
  expect(data![0].name).toContain(updatedName)
})
```

### Test 1.3: Adding Break/Section Syncs

```typescript
test('adding break to setlist syncs items to Supabase', async ({ page }) => {
  // ... setup and create setlist ...

  // Add break via UI
  await page.click('[data-testid="add-item-dropdown"]')
  await page.click('text=Add Break')

  // Wait for sync
  await page.waitForTimeout(3000)

  // Verify in Supabase
  const supabase = await getSupabaseAdmin()
  const { data } = await supabase
    .from('setlists')
    .select('items')
    .eq('id', setlistId)
    .single()

  const items = data.items as any[]
  expect(items.some(i => i.type === 'break')).toBe(true)
})
```

### Test 1.4: Show Creation Syncs

```typescript
test('newly created show via ShowViewPage syncs to Supabase', async ({
  page,
}) => {
  // ... setup ...
  const showName = `E2E Show ${Date.now()}`

  await page.goto('/shows/new')
  // Fill show details
  await page.fill('[data-testid="show-name-input"]', showName)
  await page.click('[data-testid="create-show-button"]')

  await page.waitForURL(/\/shows\/[a-z0-9-]+/)
  await page.waitForTimeout(3000)

  // Verify in Supabase
  const supabase = await getSupabaseAdmin()
  const { data: shows } = await supabase
    .from('shows')
    .select('*')
    .ilike('name', `%${showName}%`)

  expect(shows!.length).toBeGreaterThan(0)
})
```

---

## E2E Test Cases - Category 2: Offline/Online Sync Tests

### Test 2.1: Offline Edits Show Pending Status

```typescript
test('offline edits show pending sync status', async ({ page, context }) => {
  // ... setup user/band/setlist ...

  // Go offline
  await context.setOffline(true)

  // Make an edit
  await page.locator('[data-testid="setlist-header"]').click()
  await page.keyboard.type(' - Offline Edit')
  await page.keyboard.press('Tab')

  // Verify sync icon shows pending/error state
  const syncIcon = page.locator('[data-testid="sync-status-icon"]')
  await expect(syncIcon).toHaveAttribute('data-status', /(pending|error)/)

  // Verify NOT in Supabase yet
  const supabase = await getSupabaseAdmin()
  const { data } = await supabase
    .from('setlists')
    .select('name')
    .eq('id', setlistId)
    .single()

  expect(data.name).not.toContain('Offline Edit')
})
```

### Test 2.2: Offline Edits Sync When Online

```typescript
test('offline edits sync when connection restored', async ({
  page,
  context,
}) => {
  // ... setup user/band/setlist ...
  const editSuffix = ` - Synced ${Date.now()}`

  // Go offline
  await context.setOffline(true)

  // Make edit while offline
  await page.locator('[data-testid="setlist-header"]').click()
  await page.keyboard.type(editSuffix)
  await page.keyboard.press('Tab')

  // Verify pending status
  await expect(
    page.locator('[data-testid="sync-status-icon"]')
  ).toHaveAttribute('data-status', 'pending')

  // Go back online
  await context.setOffline(false)

  // Wait for sync to complete (poll for up to 10 seconds)
  let synced = false
  const supabase = await getSupabaseAdmin()
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase
      .from('setlists')
      .select('name')
      .eq('id', setlistId)
      .single()

    if (data.name.includes(editSuffix)) {
      synced = true
      break
    }
    await page.waitForTimeout(500)
  }

  expect(synced).toBe(true)

  // Verify sync icon shows synced
  await expect(
    page.locator('[data-testid="sync-status-icon"]')
  ).toHaveAttribute('data-status', 'synced')
})
```

### Test 2.3: Multiple Offline Edits Queue and Sync

```typescript
test('multiple offline edits all sync when online', async ({
  page,
  context,
}) => {
  // ... setup ...

  // Go offline
  await context.setOffline(true)

  // Make 3 different edits
  // 1. Edit setlist name
  // 2. Add a break
  // 3. Add a section

  // Go online
  await context.setOffline(false)

  // Wait for sync
  await page.waitForTimeout(5000)

  // Verify all 3 changes in Supabase
  const supabase = await getSupabaseAdmin()
  const { data } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', setlistId)
    .single()

  expect(data.name).toContain(editedName)
  expect(data.items.some(i => i.type === 'break')).toBe(true)
  expect(data.items.some(i => i.type === 'section')).toBe(true)
})
```

---

## E2E Test Cases - Category 3: Negative/Error Cases

### Test 3.1: Sync Icon Shows Error on Persistent Failure

```typescript
test('sync icon shows error after repeated failures', async ({
  page,
  context,
}) => {
  // This test requires mocking Supabase to return errors
  // ... setup ...

  // Mock Supabase to reject writes
  await page.route('**/rest/v1/setlists**', route => {
    route.fulfill({ status: 500, body: 'Server Error' })
  })

  // Make an edit
  await page.locator('[data-testid="setlist-header"]').click()
  await page.keyboard.type(' - Will Fail')
  await page.keyboard.press('Tab')

  // Wait for retries to exhaust
  await page.waitForTimeout(10000)

  // Verify sync icon shows error
  await expect(
    page.locator('[data-testid="sync-status-icon"]')
  ).toHaveAttribute('data-status', 'error')
})
```

### Test 3.2: Console Errors on Sync Failure

```typescript
test('logs console errors on sync failure', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // ... trigger sync failure ...

  expect(errors.some(e => e.includes('sync') || e.includes('Supabase'))).toBe(
    true
  )
})
```

---

## E2E Test Cases - Category 4: Cross-Device Sync (Future)

### Test 4.1: Changes Appear on Second Device

```typescript
test.skip('changes on device A appear on device B', async ({ browser }) => {
  // This requires two browser contexts
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()

  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // Login same user on both
  // ... login on pageA and pageB ...

  // Create setlist on Device A
  const setlistName = `Multi-Device Test ${Date.now()}`
  // ... create on pageA ...

  // Wait and check Device B
  await pageB.reload()
  await pageB.waitForTimeout(5000)

  // Verify setlist appears on Device B
  await expect(pageB.locator(`text=${setlistName}`)).toBeVisible()
})
```

---

## Database Verification Helper Functions

Create `tests/helpers/databaseVerification.ts`:

```typescript
import { getSupabaseAdmin } from '../fixtures/supabase'
import { expect } from '@playwright/test'

/**
 * Verify a setlist exists in Supabase with expected values
 */
export async function verifySetlistInDatabase(
  setlistId: string,
  expectations: {
    name?: string
    status?: string
    itemCount?: number
    hasBreak?: boolean
    hasSection?: boolean
  }
) {
  const supabase = await getSupabaseAdmin()
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', setlistId)
    .single()

  expect(error).toBeNull()
  expect(data).not.toBeNull()

  if (expectations.name) {
    expect(data.name).toContain(expectations.name)
  }
  if (expectations.status) {
    expect(data.status).toBe(expectations.status)
  }
  if (expectations.itemCount !== undefined) {
    expect(data.items?.length || 0).toBe(expectations.itemCount)
  }
  if (expectations.hasBreak) {
    expect(data.items?.some((i: any) => i.type === 'break')).toBe(true)
  }
  if (expectations.hasSection) {
    expect(data.items?.some((i: any) => i.type === 'section')).toBe(true)
  }

  return data
}

/**
 * Verify a show exists in Supabase
 */
export async function verifyShowInDatabase(
  showId: string,
  expectations: {
    name?: string
    location?: string
    hasSetlist?: boolean
  }
) {
  const supabase = await getSupabaseAdmin()
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .eq('id', showId)
    .single()

  expect(error).toBeNull()
  expect(data).not.toBeNull()

  if (expectations.name) {
    expect(data.name).toContain(expectations.name)
  }
  if (expectations.location) {
    expect(data.location).toBe(expectations.location)
  }
  if (expectations.hasSetlist) {
    expect(data.setlist_id).not.toBeNull()
  }

  return data
}

/**
 * Wait for a record to sync to Supabase
 */
export async function waitForSync(
  table: string,
  id: string,
  field: string,
  expectedValue: any,
  maxWaitMs = 10000
): Promise<boolean> {
  const supabase = await getSupabaseAdmin()
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const { data } = await supabase
      .from(table)
      .select(field)
      .eq('id', id)
      .single()

    if (data && data[field] === expectedValue) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return false
}

/**
 * Verify record does NOT exist in Supabase (for testing pre-sync state)
 */
export async function verifyNotInDatabase(
  table: string,
  field: string,
  value: string
): Promise<boolean> {
  const supabase = await getSupabaseAdmin()
  const { data } = await supabase.from(table).select('id').eq(field, value)

  return !data || data.length === 0
}
```

---

## Related Bug: Multi-Device Sync Not Working

**Symptom:** Songs added on PC don't appear on mobile until site data is cleared.

**Root Cause:** The `pullFromRemote()` method exists but is only called:

1. During `syncNow()` (before pushing changes)
2. NOT on app load for returning users

**Current Architecture Gap:**

- Initial sync: Only runs ONCE on first login
- Periodic pull: DEPRECATED/removed
- WebSocket realtime: Only 30% implemented

**Recommended Fix (separate ticket):**

1. Call `pullFromRemote()` on app load for authenticated users
2. Or: Complete WebSocket real-time sync implementation
3. Or: Add "Refresh" button to manually trigger pull

This is tracked as a separate issue from the setlist sync bypass bug.

---

## Risk Assessment

| Fix                   | Risk   | Mitigation               |
| --------------------- | ------ | ------------------------ |
| createSetlist         | Medium | Thorough E2E testing     |
| saveField             | Low    | Unit test coverage       |
| saveItems             | Medium | Test drag-drop scenarios |
| Show fixes            | Medium | Same test patterns       |
| PracticeSession fixes | Low    | Existing tests           |

---

## Rollback Strategy

1. All changes are isolated to specific functions
2. Keep `db` import available for emergency rollback
3. Monitor sync queue and Supabase for data consistency

---

## Tasks

### Phase 1: SetlistViewPage.tsx (Critical)

- [ ] T1.1: Add `getSyncRepository` import
- [ ] T1.2: Fix `createSetlist()` to use `repo.addSetlist()`
- [ ] T1.3: Fix `saveField()` to use `repo.updateSetlist()`
- [ ] T1.4: Fix `saveItems()` to use `repo.updateSetlist()`
- [ ] T1.5: Fix `addBreak()` to use `repo.updateSetlist()`
- [ ] T1.6: Fix `addSection()` to use `repo.updateSetlist()`
- [ ] T1.7: Fix `EditSongModal onSave` to use `repo.updateSong()`
- [ ] T1.8: Run existing tests to verify no regressions

### Phase 2: ShowViewPage.tsx (High Priority)

- [ ] T2.1: Add `getSyncRepository` import
- [ ] T2.2: Fix `saveField()` to use `repo.updateShow()`
- [ ] T2.3: Fix `saveDateTime()` to use `repo.updateShow()`
- [ ] T2.4: Fix `saveContacts()` to use `repo.updateShow()`
- [ ] T2.5: Fix setlist fork to use `repo.addSetlist()`
- [ ] T2.6: Fix `handleCreateNewSetlist()` to use `repo.addSetlist()`
- [ ] T2.7: Fix `createShow()` to use `repo.addShow()`

### Phase 3: SetlistsPage.tsx (Low Priority)

- [ ] T3.1: Fix `handleDelete()` practice session update
- [ ] T3.2: Fix `handleSave()` practice session update

### Phase 4: E2E Test Infrastructure

- [ ] T4.1: Create `tests/helpers/databaseVerification.ts` with helper functions
- [ ] T4.2: Create `tests/e2e/sync/database-sync-verification.spec.ts`
- [ ] T4.3: Add `data-testid` attributes to SetlistViewPage elements (if missing)
- [ ] T4.4: Add `data-testid` attributes to ShowViewPage elements (if missing)

### Phase 5: E2E Tests - Positive Cases

- [ ] T5.1: Test: New setlist syncs to Supabase
- [ ] T5.2: Test: Setlist field updates sync to Supabase
- [ ] T5.3: Test: Adding breaks/sections syncs to Supabase
- [ ] T5.4: Test: New show syncs to Supabase
- [ ] T5.5: Test: Forked setlist syncs to Supabase

### Phase 6: E2E Tests - Offline/Online

- [ ] T6.1: Test: Offline edits show pending sync status
- [ ] T6.2: Test: Offline edits sync when connection restored
- [ ] T6.3: Test: Multiple offline edits all sync when online
- [ ] T6.4: Test: Sync icon transitions through states correctly

### Phase 7: E2E Tests - Negative Cases

- [ ] T7.1: Test: Sync icon shows error after repeated failures
- [ ] T7.2: Test: Console logs errors on sync failure
- [ ] T7.3: Test: Data remains in IndexedDB on sync failure (no data loss)

### Phase 8: Verification & Documentation

- [ ] T8.1: Run full E2E test suite
- [ ] T8.2: Manual test: Create setlist, verify in Supabase Studio
- [ ] T8.3: Manual test: Edit setlist offline, go online, verify sync
- [ ] T8.4: Update bug report with resolution details
- [ ] T8.5: Create separate ticket for multi-device sync issue

---

## Separate Issue: Multi-Device Sync

**This is NOT fixed by this bug fix.** File a separate ticket for:

> **Title:** Changes on one device don't appear on other devices until re-login
>
> **Description:** After the setlist sync fix, data will correctly push to Supabase. However, existing devices that are already logged in won't receive those changes because:
>
> 1. Initial sync only runs ONCE on first login
> 2. Periodic pull was deprecated
> 3. WebSocket real-time sync is only 30% implemented
>
> **Acceptance Criteria:**
>
> - [ ] User A creates song on PC
> - [ ] User A's mobile (already logged in) sees song within 5 seconds
> - [ ] No need to clear site data or re-login
>
> **Recommended Fix Options:**
>
> 1. Call `pullFromRemote()` on app load/focus for authenticated users
> 2. Complete WebSocket real-time sync (Phase 4 of sync spec)
> 3. Add manual "Refresh" button as interim solution
