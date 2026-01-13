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

## E2E Test Cases to Add

### Test 1: New Setlist Syncs to Supabase

```typescript
test('newly created setlist via SetlistViewPage syncs to Supabase', async ({
  page,
}) => {
  // Navigate to /setlists/new
  await page.goto('/setlists/new')

  // Fill setlist name
  await page.fill('[data-testid="setlist-name-input"]', 'E2E Sync Test Setlist')

  // Click create button
  await page.click('[data-testid="create-setlist-button"]')

  // Wait for redirect (indicates local save)
  await page.waitForURL(/\/setlists\/[a-z0-9-]+/)

  // Allow time for sync
  await page.waitForTimeout(3000)

  // Verify in Supabase
  const { data } = await supabase
    .from('setlists')
    .select('*')
    .eq('name', 'E2E Sync Test Setlist')

  expect(data).not.toBeNull()
  expect(data!.length).toBe(1)
})
```

### Test 2: Setlist Updates Sync

Test inline editing of setlist name syncs to Supabase.

### Test 3: Adding Breaks/Sections Sync

Test that structural changes sync properly.

### Test 4: Show Creation Syncs

Test new shows via ShowViewPage sync to Supabase.

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

### Phase 4: E2E Tests

- [ ] T4.1: Add test for setlist creation sync
- [ ] T4.2: Add test for setlist update sync
- [ ] T4.3: Add test for show creation sync
- [ ] T4.4: Run full E2E suite

### Phase 5: Verification

- [ ] T5.1: Manual test: Create setlist, verify in Supabase Studio
- [ ] T5.2: Manual test: Edit setlist, verify changes sync
- [ ] T5.3: Manual test: Create show, verify in Supabase Studio
