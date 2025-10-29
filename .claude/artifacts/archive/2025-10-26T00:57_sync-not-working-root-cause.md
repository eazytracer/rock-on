---
timestamp: 2025-10-26T00:57
topic: Root Cause - Why Sync Is Not Working
prompt: Investigate why no items appear in sync queue and no data syncs to Supabase
---

# ROOT CAUSE FOUND: Hooks Bypass SyncRepository

## The Problem

User reported:
- ❌ No items in sync queue
- ❌ No data being written to Supabase
- ✅ Data appears in IndexedDB (local only)
- ✅ RLS policies are correct (verified via SQL query)

## Root Cause

**The UI hooks are bypassing the entire sync infrastructure!**

### Evidence

**File:** `src/hooks/useSongs.ts:75`

```typescript
export function useCreateSong() {
  // ...
  const createSong = async (songData: Partial<Song>) => {
    // ...

    await db.songs.add(newSong)  // ❌ DIRECT WRITE TO INDEXEDDB

    return songId
  }

  return { createSong, loading, error }
}
```

### What SHOULD Happen

**File:** `src/services/data/SyncRepository.ts:69-82`

```typescript
async addSong(song: Song): Promise<Song> {
  // 1. Write to local immediately (optimistic UI)
  const localSong = await this.local.addSong(song)

  // 2. Queue for remote sync
  await this.syncEngine.queueCreate('songs', localSong)  // ✅ ADDS TO QUEUE

  // 3. Try to sync immediately if online
  if (this.isOnline) {
    this.syncEngine.syncNow()  // ✅ TRIGGERS SYNC
  }

  return localSong
}
```

## Why This Happened

The `useSongs` hook was created to provide a simple interface for the UI, but it was implemented using **direct database access** instead of going through the **SyncRepository layer**.

### Current (Broken) Flow:

```
User Creates Song
  ↓
SongsPage.tsx calls createSong()
  ↓
useCreateSong hook
  ↓
db.songs.add(newSong)  ← WRITES DIRECTLY TO INDEXEDDB
  ↓
❌ No sync queue
❌ No Supabase sync
```

### Expected (Correct) Flow:

```
User Creates Song
  ↓
SongsPage.tsx calls createSong()
  ↓
useCreateSong hook
  ↓
SyncRepository.addSong()
  ├─ db.songs.add() → IndexedDB
  ├─ syncEngine.queueCreate() → Sync Queue
  └─ syncEngine.syncNow() → Supabase
```

## Impact Analysis

**All write operations in `useSongs.ts` bypass sync:**

1. **useCreateSong** (line 75):
   - Calls: `db.songs.add()`
   - Should call: `syncRepository.addSong()`

2. **useUpdateSong** (line 102):
   - Calls: `db.songs.update()`
   - Should call: `syncRepository.updateSong()`

3. **useDeleteSong** (line 149):
   - Calls: `db.songs.delete()`
   - Should call: `syncRepository.deleteSong()`

**Result:** All song operations are local-only. Nothing syncs to Supabase.

## The Fix

### Option 1: Update Hooks to Use SyncRepository (Recommended)

Modify `src/hooks/useSongs.ts` to use SyncRepository instead of direct database access:

```typescript
import { syncRepository } from '../services/data'

export function useCreateSong() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSong = async (songData: Partial<Song>) => {
    try {
      setLoading(true)
      setError(null)

      const songId = crypto.randomUUID()
      const newSong: Song = {
        id: songId,
        // ... rest of song data
      } as Song

      await syncRepository.addSong(newSong)  // ✅ USES SYNCREPOSITORY

      return songId
    } catch (err) {
      console.error('Error creating song:', err)
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createSong, loading, error }
}
```

### Option 2: Create Repository Hooks

Create new hooks that wrap SyncRepository methods:

```typescript
// src/hooks/useSyncRepository.ts
import { useState } from 'react'
import { syncRepository } from '../services/data'

export function useSyncRepository() {
  return {
    songs: {
      add: async (song: Song) => {
        return await syncRepository.addSong(song)
      },
      update: async (id: string, updates: Partial<Song>) => {
        return await syncRepository.updateSong(id, updates)
      },
      delete: async (id: string) => {
        return await syncRepository.deleteSong(id)
      }
    },
    // ... other entities
  }
}
```

## Next Steps

1. **Immediate Fix**: Update `useCreateSong`, `useUpdateSong`, `useDeleteSong` to use SyncRepository
2. **Verify Fix**: Create a song and check:
   - ✅ Item appears in sync queue
   - ✅ Data syncs to Supabase
   - ✅ debugSync() shows queue activity
3. **Check Other Entities**: Verify that bands, setlists, etc. are also using SyncRepository
4. **Testing**: Run existing sync tests to ensure no regressions

## Why We Didn't See This Earlier

- Tests for SyncRepository are passing (73 tests)
- Tests verify that SyncRepository works correctly
- BUT: The UI never calls SyncRepository!
- The hooks layer bypassed the sync infrastructure entirely

This is a **integration gap** between the UI layer (hooks) and the data layer (SyncRepository).

## Verification Commands

After fixing, verify sync is working:

```typescript
// In browser console:
window.debugSync()

// Should show:
// - Pending items in queue
// - Sync operations happening
// - Items being marked as synced
```

## Files to Modify

1. `src/hooks/useSongs.ts` - Update to use SyncRepository
2. Potentially: Other hooks files if they exist for bands, setlists, etc.

## Testing Checklist

- [ ] Create a song → appears in sync queue
- [ ] Check Supabase → song appears in database
- [ ] Update a song → queue shows update operation
- [ ] Delete a song → queue shows delete operation
- [ ] Offline: create song → queue holds it
- [ ] Come online → queue syncs automatically
