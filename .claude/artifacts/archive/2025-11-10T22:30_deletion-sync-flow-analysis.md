---
title: Song Deletion & Sync Flow Analysis
created: 2025-11-10T22:30
status: Documentation
priority: HIGH
---

# Song Deletion & Sync Flow Analysis

## Critical Understanding: Why Deletion Works Now

The deletion flow currently works due to **timing introduced by console.log statements**. This is fragile and could break if logs are removed.

---

## Current Deletion Flow (Step by Step)

### 1. User Clicks Delete in UI

**File**: `src/pages/NewLayout/SongsPage.tsx:997-1003`

```typescript
await deleteSong(song.id)  // Step 1: Delete from local + queue
await refetch()            // Step 2: Refetch from IndexedDB
```

---

### 2. Delete Operation

**File**: `src/hooks/useSongs.ts:174-209` → `src/services/data/SyncRepository.ts:100-123`

```typescript
async deleteSong(id: string): Promise<void> {
  // 1. Delete from local IndexedDB
  await this.local.deleteSong(id)  // ✅ Song removed from IndexedDB

  // 2. Queue for sync
  await this.syncEngine.queueDelete('songs', id)  // Adds to sync queue

  // 3. Trigger sync if online
  if (this.isOnline) {
    this.syncEngine.syncNow()  // ⚠️ Async - doesn't wait!
  }
}
```

**Key Issue**: `syncNow()` is called but **NOT awaited**. The deletion continues before sync completes.

---

### 3. Sync Engine Executes

**File**: `src/services/data/SyncEngine.ts` (syncNow → processPendingOperations)

**Order of operations:**

```
1. PULL from Supabase   ← Downloads all remote data (including deleted song!)
2. PUSH to Supabase     ← Uploads pending deletes
```

**The Problem:**
- Pull happens BEFORE push
- If pull completes before push, deleted song gets re-added to IndexedDB
- Console logs introduce ~50-100ms delays that allow push to complete first

---

### 4. Refetch Operation

**File**: `src/hooks/useSongs.ts:92-109`

```typescript
const refetch = async () => {
  const response = await SongService.getBandSongs(bandId)
  setSongs(response.songs)  // Update UI state
}
```

Reads from **IndexedDB** (local), not Supabase.

---

## Race Condition Diagram

### Scenario A: Works (Current - With Logging Delays)

```
Timeline:
0ms   │ deleteSong() called
      │   ├─ Delete from IndexedDB ✅
      │   ├─ Queue delete operation
      │   └─ syncNow() triggered (async, doesn't wait)
50ms  │ refetch() called
      │   └─ Reads IndexedDB: Song missing ✅
      │   └─ UI updates: Song gone ✅
      │
      │ [Meanwhile, sync running in background...]
100ms │ Sync: PULL starts
150ms │ Sync: PULL completes (song re-added to IndexedDB) ⚠️
200ms │ Sync: PUSH starts (delete operation)
250ms │ Sync: PUSH completes (song deleted from Supabase) ✅
300ms │ Sync: PULL again (song now missing from Supabase)
350ms │ Sync: PULL completes (song removed from IndexedDB) ✅
```

**Result**: Works, but song briefly flickers back into IndexedDB (users don't notice).

---

### Scenario B: Breaks (Without Logging Delays)

```
Timeline:
0ms   │ deleteSong() called
      │   ├─ Delete from IndexedDB ✅
      │   ├─ Queue delete operation
      │   └─ syncNow() triggered (async)
5ms   │ refetch() called
      │   └─ Reads IndexedDB: Song missing ✅
      │
      │ [Sync starts immediately...]
10ms  │ Sync: PULL starts
30ms  │ Sync: PULL completes (song RE-ADDED to IndexedDB) ❌
40ms  │ UI updates: Song APPEARS AGAIN ❌
50ms  │ Sync: PUSH starts (delete operation)
60ms  │ Sync: PUSH completes (song deleted from Supabase) ✅
```

**Result**: Song reappears after deletion!

---

## Why Console Logs "Fix" It

Each `console.log()` introduces ~0.5-2ms of blocking time:
- `[SyncRepository] deleteSong called for: ...`
- `[LocalRepository] Deleting song from IndexedDB: ...`
- `[LocalRepository] Song exists before delete: true ...`
- `[LocalRepository] Song exists after delete: false`
- `[SyncRepository] Step 1: Complete`

**Total delay**: ~10-20ms across all logs

This gives the sync engine enough time to:
1. Start the PULL
2. Complete the PULL
3. Start the PUSH (delete)

By the time `refetch()` runs, the sync cycle has progressed far enough that the race condition is less likely.

---

## Proper Solutions (NOT Relying on Logging)

### Option 1: Wait for Sync to Complete (Recommended)

**File**: `src/services/data/SyncRepository.ts:100-123`

```typescript
async deleteSong(id: string): Promise<void> {
  // 1. Delete from local
  await this.local.deleteSong(id)

  // 2. Queue for sync
  await this.syncEngine.queueDelete('songs', id)

  // 3. Wait for sync to complete
  if (this.isOnline) {
    await this.syncEngine.syncNow()  // ✅ AWAIT the sync!
  }
}
```

**Pros:**
- Guarantees sync completes before refetch
- No race conditions
- Reliable

**Cons:**
- Deletion feels slower (user waits for network)
- Could timeout on slow networks

---

### Option 2: Push Before Pull in Sync Engine (Better)

**File**: `src/services/data/SyncEngine.ts`

```typescript
async syncNow(): Promise<void> {
  // PUSH pending operations FIRST
  await this.processPendingOperations()  // ✅ Upload deletes

  // THEN PULL from remote
  await this.pullFromRemote()  // ✅ Download changes
}
```

**Pros:**
- Local changes take priority
- No race condition
- Faster (no blocking in delete operation)

**Cons:**
- Changes sync engine architecture
- Need to ensure pending ops are processed first

---

### Option 3: Optimistic Locking (Most Robust)

Track pending operations and filter them from pull results:

```typescript
// When pulling from remote:
const remoteSongs = await pullSongs()

// Filter out songs that have pending DELETE operations
const pendingDeletes = this.pendingOps.filter(op =>
  op.operation === 'DELETE' && op.table === 'songs'
)

const filteredSongs = remoteSongs.filter(song =>
  !pendingDeletes.some(op => op.recordId === song.id)
)

await db.songs.bulkPut(filteredSongs)
```

**Pros:**
- Most robust
- Handles all edge cases
- No timing dependencies

**Cons:**
- More complex
- Requires tracking pending operations

---

## Recommendation

**Short-term (Before removing logs):**
Implement **Option 2** - Reorder sync to PUSH before PULL.

**Changes needed:**
1. Modify `SyncEngine.syncNow()` to push pending operations first
2. Ensure pull happens after push completes
3. Add tests for deletion + sync ordering

**Long-term:**
Consider **Option 3** for production robustness, especially for:
- Offline mode
- Slow networks
- High-latency scenarios

---

## Testing Strategy

### Manual Test Cases

**Test 1: Fast Network**
```
1. Delete song
2. Immediately check IndexedDB (should be gone)
3. Wait 1 second
4. Check IndexedDB again (should still be gone)
5. Check Supabase (should be deleted)
```

**Test 2: Slow Network**
```
1. Throttle network to "Slow 3G"
2. Delete song
3. Monitor IndexedDB during sync
4. Verify song doesn't reappear
```

**Test 3: Offline → Online**
```
1. Go offline
2. Delete song (queued)
3. Verify song gone from UI
4. Go online
5. Wait for sync
6. Verify song doesn't reappear
```

### Unit Test (Add to SyncEngine.test.ts)

```typescript
it('should push pending operations before pulling', async () => {
  // Queue a delete
  await syncEngine.queueDelete('songs', 'song-123')

  // Mock remote still has the song
  mockRemote.getSongs.mockResolvedValue([
    { id: 'song-123', title: 'Test' }
  ])

  // Sync
  await syncEngine.syncNow()

  // Verify song is NOT in local DB
  const song = await db.songs.get('song-123')
  expect(song).toBeUndefined()
})
```

---

## Critical Code Locations

### Files to Review Before Removing Logs

1. **`src/services/data/SyncRepository.ts:100-123`**
   - `deleteSong()` method
   - Check if `syncNow()` is awaited

2. **`src/services/data/SyncEngine.ts`**
   - `syncNow()` method
   - `processPendingOperations()` ordering
   - `pullFromRemote()` ordering

3. **`src/services/data/LocalRepository.ts:66-84`**
   - `deleteSong()` method
   - Verify deletion completes

4. **`src/hooks/useSongs.ts:92-109`**
   - `refetch()` method
   - Timing relative to delete

---

## Console Logs Safe to Remove

✅ **Safe to remove** (informational only):
```typescript
console.log('[LocalRepository.getSongs] Filter:', filter)
console.log('[LocalRepository.getSongs] Returning X songs')
console.log('[useSongs.refetch] Starting manual refetch')
console.log('[useSongs.refetch] Current songs in state: X')
```

⚠️ **Keep for now** (diagnostic value):
```typescript
console.log('[LocalRepository] Song exists before delete: true')
console.log('[LocalRepository] Song exists after delete: false')
console.error('[LocalRepository] ⚠️ WARNING: Song still exists after delete!')
```

❌ **DO NOT remove yet** (critical timing):
```typescript
console.log('[SyncRepository] deleteSong called for:', id)
console.log('[SyncRepository] Step 1: Deleting from local IndexedDB...')
console.log('[LocalRepository] Deleting song from IndexedDB:', id)
```

---

## Summary

**Current State**: Deletion works due to timing delays from logging.

**Risk**: Removing logs will likely break deletion.

**Solution**: Implement proper sync ordering (PUSH before PULL) before removing logs.

**Next Steps**:
1. ✅ Understand the flow (this document)
2. ⏸️ Run unit tests to check for breaks
3. ⏸️ Implement Option 2 (reorder sync engine)
4. ⏸️ Add tests for deletion + sync ordering
5. ⏸️ Remove logs safely after fix is in place
