---
feature: sync-status-icon-false-positive
created: 2026-01-20T04:35:00Z
status: diagnosis-complete
severity: high
---

# Diagnosis: Sync Status Icon Shows Synced When Sync Failed

## Summary

**Problem:** Per-song sync status icon shows green cloud (synced) even when the song failed to sync to Supabase. The navbar correctly shows "1 pending to sync" but individual song items show the wrong status.

**Root Cause:** The `useItemStatus` hook defaults to `'synced'` when no status is found in the `ItemSyncStatusContext`, but **nothing ever populates this context** with actual sync status from the SyncEngine.

**Severity:** High - Misleading UI causes user confusion about data safety

## Root Cause Analysis

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   useSongs.ts   │────▶│ SyncRepository  │────▶│   SyncEngine    │
│  createSong()   │     │    addSong()    │     │  queueCreate()  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  db.syncQueue   │
                                                │ (IndexedDB)     │
                                                └────────┬────────┘
                                                         │
         ┌───────────────────────────────────────────────┴───────────────┐
         │                                                               │
         ▼                                                               ▼
┌─────────────────┐                                          ┌─────────────────┐
│ useSyncStatus   │◀────── subscribes to SyncEngine ──────   │ useItemStatus   │
│  (navbar hook)  │                                          │  (per-item hook)│
│                 │                                          │                 │
│ ✅ Queries      │                                          │ ❌ Queries      │
│    syncQueue    │                                          │    empty context│
│    correctly    │                                          │    returns      │
│                 │                                          │    'synced'     │
└─────────────────┘                                          └─────────────────┘
```

### The Bug (src/hooks/useItemSyncStatus.tsx:126)

```tsx
export function useItemStatus(itemId: string): SyncStatus {
  const { getStatus } = useItemSyncStatus()
  // BUG: Returns 'synced' when status is not in context
  return getStatus(itemId) || 'synced' // ← This is wrong!
}
```

The context is **never populated** because:

1. No code calls `setStatus(itemId, 'pending')` when items are created
2. No code calls `setStatus(itemId, 'synced')` when sync succeeds
3. No code calls `setStatus(itemId, 'error')` when sync fails

### Why NavBar Works

The `useSyncStatus` hook (src/hooks/useSyncStatus.ts) subscribes to `SyncEngine.onStatusChange()` which calls:

```tsx
// SyncEngine.ts:460-475
async getStatus(): Promise<SyncStatus> {
  const pendingCount =
    (await db.syncQueue?.where('status').equals('pending').count()) || 0
  // ... counts items directly from syncQueue
}
```

This **correctly queries IndexedDB** for pending items.

### Why Per-Item Status Fails

The `useItemStatus` hook uses `ItemSyncStatusContext` which is a **separate React context** that holds a `Map<string, SyncStatus>`. This map is **always empty** because nothing populates it.

## Evidence

### Console Output Shows Sync Failed

```
[RemoteRepository.addSong] Insert failed: {error: {…}, mappedSong: {…}, authUser: undefined}
[SyncEngine] Failed to sync songs: {code: '22P02', message: 'invalid input syntax for type uuid: ""'}
```

### SyncQueue Still Has Pending Item

The SyncEngine marks the item as 'failed' after 3 retries (SyncEngine.ts:242-256), but this information never reaches the UI.

### Default Status is 'synced'

```tsx
// useItemSyncStatus.tsx:126
return getStatus(itemId) || 'synced' // Always returns 'synced' for new items
```

## Fix Options

### Option 1: Query syncQueue Directly (Recommended)

Change `useItemStatus` to query the actual syncQueue instead of the empty context:

**File:** `src/hooks/useItemSyncStatus.tsx`

```tsx
import { db } from '../services/database'

export function useItemStatus(itemId: string): SyncStatus {
  const [status, setStatusState] = useState<SyncStatus>('synced')

  useEffect(() => {
    const checkStatus = async () => {
      // Query syncQueue for this item's status
      const queueItem = await db.syncQueue
        ?.where('data.id')
        .equals(itemId)
        .first()

      if (!queueItem) {
        setStatusState('synced')
      } else if (queueItem.status === 'failed') {
        setStatusState('error')
      } else if (queueItem.status === 'syncing') {
        setStatusState('syncing')
      } else if (queueItem.status === 'pending') {
        setStatusState('pending')
      }
    }

    checkStatus()

    // Re-check periodically or on sync events
    const interval = setInterval(checkStatus, 2000)
    return () => clearInterval(interval)
  }, [itemId])

  return status
}
```

**Pros:**

- Single source of truth (syncQueue)
- No need to manually sync context
- Accurate reflection of actual sync state

**Cons:**

- Slightly more DB queries (mitigated by caching/intervals)

### Option 2: Populate Context from SyncEngine

Wire up SyncEngine to emit per-item status changes and update the context.

**Pros:**

- React-idiomatic approach
- Easy to add more status listeners

**Cons:**

- More complex wiring
- Need to maintain context state separately from syncQueue
- Risk of context and syncQueue getting out of sync

## Recommended Fix

**Option 1** is recommended because:

1. It uses the syncQueue as single source of truth
2. Avoids duplicate state management
3. Simpler implementation
4. Already proven pattern (useSyncStatus uses same approach for global count)

## Implementation Plan

1. **Modify `useItemStatus` hook** to query `db.syncQueue` directly
2. **Add subscription** to SyncEngine status changes for real-time updates
3. **Add integration test** for sync failure → error icon scenario
4. **Add E2E test** to verify error icon appears in UI

## Verification

After fix, test with:

```bash
# Start local Supabase with invalid auth to force sync failures
npm run dev

# Create a song
# Verify: Yellow clock icon appears (pending)
# Wait for sync attempt to fail
# Verify: Red cloud-off icon appears (error)
# Verify: NavBar shows "1 pending to sync"
```

## Files to Modify

| File                                          | Change                             |
| --------------------------------------------- | ---------------------------------- |
| `src/hooks/useItemSyncStatus.tsx`             | Query syncQueue instead of context |
| `tests/unit/hooks/useItemSyncStatus.test.tsx` | Update tests for new behavior      |
| `tests/e2e/sync-status.spec.ts`               | Add E2E test for error icon        |
