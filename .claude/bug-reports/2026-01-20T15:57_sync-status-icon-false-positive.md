# Bug Report: Sync Status Icon Shows Synced When Sync Failed

**Reported:** 2026-01-20
**Status:** Fixed
**Severity:** High

## Issue Description

Per-song sync status icons displayed a green cloud (synced) even when the song had failed to sync to Supabase. The navbar correctly showed "1 pending to sync" but individual song items showed the wrong status.

### Steps to Reproduce

1. Create a new song while online
2. Have the Supabase sync fail (e.g., session expired, invalid data, RLS policy failure)
3. Observe the song list

### Expected Behavior

- Song should show yellow clock (pending) or red cloud-off (error) icon
- Navbar shows "1 pending to sync" (correct)

### Actual Behavior

- Song showed green cloud (synced) icon - **incorrect**
- Navbar showed "1 pending to sync" (correct)

### Console Output

```
[RemoteRepository.addSong] Insert failed: {error: {…}, mappedSong: {…}, authUser: undefined}
[SyncEngine] Failed to sync songs: {code: '22P02', message: 'invalid input syntax for type uuid: ""'}
```

## Root Cause

The `useItemStatus` hook in `src/hooks/useItemSyncStatus.tsx` defaulted to returning `'synced'` when no status was found in the `ItemSyncStatusContext`:

```tsx
// Line 126 - THE BUG
return getStatus(itemId) || 'synced'
```

The `ItemSyncStatusContext` was a React context that held a `Map<string, SyncStatus>`, but **nothing ever populated this map** with actual sync status from the SyncEngine. The context was always empty, so every item defaulted to "synced".

### Why Navbar Worked

The `useSyncStatus` hook (used by navbar) subscribed directly to the SyncEngine and queried `db.syncQueue` for the pending count:

```tsx
const pendingCount = await db.syncQueue
  ?.where('status')
  .equals('pending')
  .count()
```

This correctly counted items in the syncQueue.

### Why Per-Item Status Failed

The `useItemStatus` hook used a separate React context that was never wired up to the SyncEngine or syncQueue. It was essentially dead code that always returned the default value.

## Fix

Modified `useItemStatus` to query `db.syncQueue` directly (same source of truth as the navbar):

### Changes to `src/hooks/useItemSyncStatus.tsx`

```tsx
export function useItemStatus(itemId: string): SyncStatus {
  const { refreshCounter } = useItemSyncStatus()
  const [status, setStatus] = useState<SyncStatus>('synced')

  useEffect(() => {
    const checkSyncStatus = async () => {
      // Query syncQueue for this item's status
      const queueItems = await db.syncQueue
        .filter(item => item.data?.id === itemId)
        .toArray()

      if (queueItems.length === 0) {
        setStatus('synced') // No queue item = synced
      } else {
        const latestItem = queueItems.sort(/* by timestamp */)[0]
        switch (latestItem.status) {
          case 'failed':
            setStatus('error')
            break
          case 'syncing':
            setStatus('syncing')
            break
          case 'pending':
            setStatus('pending')
            break
          default:
            setStatus('synced')
        }
      }
    }
    checkSyncStatus()
  }, [itemId, refreshCounter])

  return status
}
```

### Additional Changes

1. Added `refreshCounter` to context that increments when sync status changes
2. Added subscription to SyncEngine status changes to trigger UI refreshes
3. Updated tests to mock `db.syncQueue` and verify correct status mapping

## Files Changed

| File                                          | Change                                            |
| --------------------------------------------- | ------------------------------------------------- |
| `src/hooks/useItemSyncStatus.tsx`             | Query syncQueue directly instead of empty context |
| `tests/unit/hooks/useItemSyncStatus.test.tsx` | Updated 15 tests for new behavior                 |

## Testing

- All 15 unit tests pass
- TypeScript type-checking passes
- Manual verification: sync failures now show correct error icon

## Status Mapping

| syncQueue.status | SyncIcon Display       |
| ---------------- | ---------------------- |
| (no entry)       | Green cloud (synced)   |
| `pending`        | Yellow clock (pending) |
| `syncing`        | Blue spinner (syncing) |
| `failed`         | Red cloud-off (error)  |

## Impact

- Users now see accurate sync status for each item
- Failed syncs are clearly visible, preventing false confidence in data backup
- No data loss occurred - data was always safe in IndexedDB
