# Bug Report: Sync-on-Load Missing Remote Changes

**Date:** 2026-01-19
**Severity:** High
**Status:** Diagnosed, fix pending review
**Branch:** feature/improved-auth-sync (merged to main)

## Summary

After initial sync completes, incremental sync fails to fetch changes made on other devices if this device hasn't been used for more than 24 hours. Users must clear IndexedDB to see remote changes.

## Reproduction Steps

1. Device A: Log in and complete initial sync
2. Device A: Close the app/browser
3. Device B: Add songs to a setlist
4. Wait more than 24 hours (or simulate by manipulating timestamps)
5. Device A: Open the app again
6. **Expected:** Device A should show songs added on Device B
7. **Actual:** Device A does NOT show the new songs until IndexedDB is cleared

## Root Cause Analysis

### Investigation Path

1. Reviewed `SyncEngine.ts` sync flow
2. Traced `performIncrementalSync()` → `pullIncrementalChanges()`
3. Found the timestamp logic in `getLastIncrementalSyncTime()`

### Root Cause

Two issues in `SyncEngine.ts`:

**Issue 1: `lastIncrementalSync` never initialized after initial sync**

When `markInitialSyncComplete()` runs after the first full sync, it:

- ✅ Sets `last_full_sync` in localStorage
- ✅ Sets `{entity}_lastFullSync` in IndexedDB for each entity
- ❌ Does NOT set `lastIncrementalSync` in IndexedDB

**Issue 2: Default fallback is only 24 hours**

In `getLastIncrementalSyncTime()`:

```typescript
// Current code - defaults to 24 hours ago
const defaultFallback = new Date(Date.now() - 24 * 60 * 60 * 1000)
```

### What Happens

1. User completes initial sync on Device A
2. `last_full_sync` set in localStorage, but `lastIncrementalSync` is NOT set
3. Device A is closed for >24 hours
4. Changes made on Device B during this time
5. User opens Device A
6. `pullIncrementalChanges()` calls `getLastIncrementalSyncTime()`
7. No `lastIncrementalSync` found, returns 24 hours ago
8. Query only fetches changes from last 24 hours
9. Changes made >24 hours ago on Device B are MISSED

## Code Locations

### File: `src/services/data/SyncEngine.ts`

**markInitialSyncComplete() - Line ~580**

```typescript
private async markInitialSyncComplete(): Promise<void> {
  if (!db.syncMetadata) return

  const now = new Date()
  const entities = ['songs', 'setlists', 'practices', 'shows']

  for (const entity of entities) {
    await db.syncMetadata.put({
      id: `${entity}_lastFullSync`,
      value: now,
      updatedAt: now,
    })
  }

  // Also set in localStorage for quick check
  localStorage.setItem('last_full_sync', now.toISOString())

  // BUG: lastIncrementalSync is NOT set here!
}
```

**getLastIncrementalSyncTime() - Line ~650**

```typescript
private async getLastIncrementalSyncTime(): Promise<Date> {
  // Default: 24 hours ago (this is too short!)
  const defaultFallback = new Date(Date.now() - 24 * 60 * 60 * 1000)

  if (!db.syncMetadata) {
    return defaultFallback
  }

  const metadata = await db.syncMetadata.get('lastIncrementalSync')
  if (metadata?.value) {
    return new Date(metadata.value)
  }

  // BUG: No fallback to last_full_sync timestamp!
  return defaultFallback
}
```

## Proposed Fix

### Fix 1: Set `lastIncrementalSync` after initial sync

In `markInitialSyncComplete()`, add:

```typescript
// Set lastIncrementalSync so subsequent incremental syncs have a valid baseline
await this.setLastIncrementalSyncTime(now)
```

### Fix 2: Improve fallback logic in `getLastIncrementalSyncTime()`

```typescript
private async getLastIncrementalSyncTime(): Promise<Date> {
  // Default: 30 days ago (longer fallback to catch changes made while offline)
  const defaultFallback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  if (!db.syncMetadata) {
    return defaultFallback
  }

  const metadata = await db.syncMetadata.get('lastIncrementalSync')
  if (metadata?.value) {
    return new Date(metadata.value)
  }

  // Fallback to last_full_sync if available (for existing users)
  const lastFullSync = localStorage.getItem('last_full_sync')
  if (lastFullSync) {
    return new Date(lastFullSync)
  }

  return defaultFallback
}
```

## Impact Assessment

- **Users Affected:** All users with multiple devices who don't use the app daily
- **Data Loss:** No data loss, but users don't see updates from other devices
- **Workaround:** Clear IndexedDB forces full re-sync

## Testing Plan

1. Unit tests for `getLastIncrementalSyncTime()` with various scenarios
2. Integration test: Initial sync → wait → incremental sync fetches all changes
3. Manual test: Two devices, verify cross-device sync after >24h gap
4. E2E test: Could add test to verify sync timing behavior

## Related Files

- `src/services/data/SyncEngine.ts` - Main fix location
- `src/services/data/db.ts` - IndexedDB schema (syncMetadata table)
- `tests/unit/services/data/SyncEngine.test.ts` - Existing tests to update

## Notes

- The fix is backward compatible for existing users because:
  - Fix 2 adds fallback to `last_full_sync` which all existing users have
  - Fix 1 ensures new syncs properly set `lastIncrementalSync`
