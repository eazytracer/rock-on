# Bug Report: Setlists Not Syncing to Supabase

**Date:** 2026-01-13
**Severity:** Critical
**Component:** Setlist sync / SetlistViewPage

## Summary

When creating or editing setlists via the `/setlists/new` page or editing existing setlists, changes are saved to IndexedDB but **never sync to Supabase**. The sync icon incorrectly shows green (synced) because the records were never added to the sync queue.

## User-Reported Symptoms

1. Created a new setlist (playlist) via the UI
2. Setlist appears in IndexedDB and displays correctly
3. No errors or warnings in console about sync failures
4. Sync icon shows green (synced) status
5. **Setlist does NOT exist in Supabase**
6. Other band members cannot see the setlist

## Root Cause Analysis

### The Problem

`SetlistViewPage.tsx` directly accesses the Dexie database (`db.setlists.add()`, `db.setlists.update()`) instead of going through the `SyncRepository`.

### Why This Is Wrong

The application uses a local-first architecture with the following data flow:

```
Correct Flow:
  Component -> SyncRepository -> LocalRepository (IndexedDB)
                              -> SyncEngine.queueCreate() -> Sync Queue
                              -> SyncEngine.syncNow() -> RemoteRepository (Supabase)

Current (Broken) Flow in SetlistViewPage:
  Component -> db.setlists.add() (Dexie directly)

  Result: Data goes to IndexedDB but sync queue is NEVER populated
```

### Affected Code Locations

**File:** `src/pages/SetlistViewPage.tsx`

1. **Line 279:** `await db.setlists.add({...})` - Creating new setlists
2. **Line 243:** `await db.setlists.update(setlistId, {...})` - Saving field changes
3. **Line 343:** `await db.setlists.update(setlistId, {...})` - Saving items after reorder
4. **Line 449:** `await db.setlists.update(setlistId, {...})` - Adding breaks
5. **Line 489:** `await db.setlists.update(setlistId, {...})` - Adding sections

### Why The Sync Icon Shows Green

The `SyncIcon` component shows sync status based on the sync queue. Since records are never added to the queue, the queue is empty, so the icon shows "synced" status - which is technically correct (nothing pending) but misleading (data was never queued).

## Impact

- **Data Loss Risk:** Setlists only exist locally; clearing browser data loses them permanently
- **Multi-user Broken:** Band members cannot collaborate on setlists
- **False Confidence:** Green sync icon misleads users into thinking data is backed up
- **Offline Sync Broken:** If user goes offline, setlists will never sync even when back online

## Comparison with Working Code

**Working pattern (from `useSetlists.ts` hook):**

```typescript
// Correct - uses SyncRepository
const repo = getSyncRepository()
await repo.addSetlist(newSetlist) // Queues for sync automatically
```

**Broken pattern (from `SetlistViewPage.tsx`):**

```typescript
// Wrong - bypasses sync entirely
await db.setlists.add({...})  // Goes directly to IndexedDB
```

## Additional Findings

The `SetlistsPage.tsx` also has direct `db.setlists` access in some places, though it does use the hooks (`useCreateSetlist`, `useUpdateSetlist`) for most operations. There may be edge cases there as well.

## Recommended Fix

1. Replace all direct `db.setlists.add()` calls with `getSyncRepository().addSetlist()`
2. Replace all direct `db.setlists.update()` calls with `getSyncRepository().updateSetlist()`
3. Add E2E tests that verify setlist operations appear in Supabase
4. Consider adding a lint rule or code review checklist item to catch direct db access

## Test Cases Needed

1. Create new setlist -> verify appears in Supabase
2. Edit setlist name -> verify change syncs
3. Add songs to setlist -> verify items sync
4. Reorder songs -> verify order syncs
5. Delete setlist -> verify removal from Supabase
6. Create setlist while offline -> verify syncs when back online

## Related Files

- `src/pages/SetlistViewPage.tsx` - **Primary issue**
- `src/pages/SetlistsPage.tsx` - May have similar issues
- `src/hooks/useSetlists.ts` - Has correct implementation (uses SyncRepository)
- `src/services/data/SyncRepository.ts` - The correct sync abstraction
- `src/services/database.ts` - Direct Dexie access (should only be used by LocalRepository)
