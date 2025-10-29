---
title: Initial Sync Implementation Guide
created: 2025-10-26T17:30
status: Ready to Implement
phase: Phase 1 - Critical
priority: Highest
estimated_time: 2-3 hours
---

# Initial Sync Implementation Guide

## Overview

This guide provides step-by-step instructions to implement **Phase 1: Initial Sync**, the critical feature that downloads existing data when users log in on a new device.

**Problem:** Currently, when a user logs in on a new device, their IndexedDB is empty even though data exists in Supabase.

**Solution:** Download all user data from Supabase to IndexedDB on first login.

**Reference:** See `.claude/specifications/2025-10-26T17:30_bidirectional-sync-specification.md` for full architecture.

---

## Prerequisites

✅ RLS policies deployed and working
✅ RemoteRepository methods implemented for all entities
✅ User can create/edit data and it syncs to Supabase
✅ SupabaseAuthService handles login

---

## Implementation Steps

### Step 1: Add SyncMetadata Table to Database

**File:** `src/services/database/index.ts`

**What to do:**

1. Add the SyncMetadata interface before the RockOnDatabase class:

```typescript
export interface SyncMetadata {
  key: string           // Primary key: 'songs', 'setlists', 'practices', 'bands', 'memberships'
  lastSyncTime: Date    // Last successful incremental sync
  lastFullSync: Date    // Last complete download (initial sync)
  syncInProgress: boolean
}
```

2. Add the table to the Dexie class:

```typescript
export class RockOnDatabase extends Dexie {
  // ... existing tables
  syncMetadata!: Table<SyncMetadata, string>
```

3. Add to the schema version (increment version number):

```typescript
this.version(3).stores({  // Increment from current version
  // ... all existing tables
  syncMetadata: 'key, lastSyncTime, lastFullSync, syncInProgress'
})
```

**Test:**
- Clear IndexedDB in DevTools
- Reload app
- Check that `syncMetadata` table exists in IndexedDB

---

### Step 2: Implement performInitialSync() in SyncEngine

**File:** `src/services/data/SyncEngine.ts`

**What to do:**

1. Add the method after the `syncNow()` method:

```typescript
/**
 * Perform initial sync - download all data from Supabase to IndexedDB
 * Called once on first login or when local database is empty
 */
async performInitialSync(userId: string): Promise<void> {
  console.log('🔄 Starting initial sync for user:', userId)

  try {
    // Get user's band IDs from band_memberships
    const memberships = await this.remote.getUserMemberships(userId)
    const bandIds = memberships.map(m => m.bandId)

    console.log(`📥 Syncing data for ${bandIds.length} bands`)

    if (bandIds.length === 0) {
      console.log('ℹ️ No bands found, skipping entity sync')
      await this.markInitialSyncComplete()
      return
    }

    // Download all entities for user's bands
    let totalRecords = 0

    // 1. Songs (already downloaded via band sync, but get band songs too)
    for (const bandId of bandIds) {
      const songs = await this.remote.getSongs({ contextType: 'band', contextId: bandId })
      for (const song of songs) {
        await this.local.addSong(song).catch(() => {
          // Ignore duplicate errors, just update instead
          return this.local.updateSong(song.id, song)
        })
      }
      totalRecords += songs.length
      console.log(`  ✓ Songs for band ${bandId}: ${songs.length}`)
    }

    // 2. Setlists
    for (const bandId of bandIds) {
      const setlists = await this.remote.getSetlists(bandId)
      for (const setlist of setlists) {
        await this.local.addSetlist(setlist).catch(() => {
          return this.local.updateSetlist(setlist.id, setlist)
        })
      }
      totalRecords += setlists.length
      console.log(`  ✓ Setlists for band ${bandId}: ${setlists.length}`)
    }

    // 3. Practice Sessions (includes shows)
    for (const bandId of bandIds) {
      const practices = await this.remote.getPracticeSessions(bandId)
      for (const practice of practices) {
        await this.local.addPracticeSession(practice).catch(() => {
          return this.local.updatePracticeSession(practice.id, practice)
        })
      }
      totalRecords += practices.length
      console.log(`  ✓ Practices for band ${bandId}: ${practices.length}`)
    }

    // Mark initial sync as complete
    await this.markInitialSyncComplete()

    console.log(`✅ Initial sync complete: ${totalRecords} total records synced`)
    this.notifyListeners()

  } catch (error) {
    console.error('❌ Initial sync failed:', error)
    throw error
  }
}

/**
 * Mark initial sync as complete in metadata
 */
private async markInitialSyncComplete(): Promise<void> {
  if (!db.syncMetadata) return

  const now = new Date()
  const entities = ['songs', 'setlists', 'practices', 'bands', 'memberships']

  for (const entity of entities) {
    await db.syncMetadata.put({
      key: entity,
      lastSyncTime: now,
      lastFullSync: now,
      syncInProgress: false
    })
  }

  // Also set in localStorage for quick check
  localStorage.setItem('last_full_sync', now.toISOString())
}

/**
 * Check if initial sync is needed
 */
async isInitialSyncNeeded(): Promise<boolean> {
  // Check localStorage first (fastest)
  const lastFullSync = localStorage.getItem('last_full_sync')
  if (!lastFullSync) return true

  // Check if it's been more than 30 days (force re-sync)
  const lastSyncDate = new Date(lastFullSync)
  const daysSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceSync > 30) return true

  // Check if any local tables are empty (data was cleared)
  const songsCount = await this.local.getSongs().then(s => s.length)
  const bandsCount = await this.local.getBands().then(b => b.length)

  // If we have bands but no songs/setlists, probably need sync
  if (bandsCount > 0 && songsCount === 0) return true

  return false
}
```

**Notes:**
- Uses `.catch()` to handle duplicate records (race condition if record was just created)
- Logs progress for debugging
- Marks sync complete in both IndexedDB and localStorage
- `isInitialSyncNeeded()` has multiple checks for robustness

---

### Step 3: Call Initial Sync on Login

**File:** `src/services/auth/SupabaseAuthService.ts`

**What to do:**

1. Import SyncRepository at the top:

```typescript
import { getSyncRepository } from '../data/SyncRepository'
```

2. Modify the `syncUserToLocalDB` method to call initial sync:

```typescript
private async syncUserToLocalDB(user: any): Promise<void> {
  try {
    // ... existing user/profile sync code ...

    // CRITICAL: Sync user's bands and memberships from Supabase to IndexedDB
    await this.syncUserBandsFromSupabase(user.id)

    // NEW: Check if initial sync is needed and perform it
    const syncRepo = getSyncRepository()
    const needsInitialSync = await (syncRepo as any).syncEngine.isInitialSyncNeeded()

    if (needsInitialSync) {
      console.log('🔄 Initial sync needed, downloading all data...')
      await (syncRepo as any).syncEngine.performInitialSync(user.id)
      console.log('✅ Initial sync complete')
    } else {
      console.log('ℹ️ Initial sync not needed, data already synced')
    }

  } catch (error) {
    console.error('Failed to sync user to local DB:', error)
  }
}
```

**Note:** We access `syncEngine` via `(syncRepo as any)` because it's a private property. In the future, you could add a public `performInitialSync()` method to SyncRepository.

---

### Step 4: Add Loading Indicator During Initial Sync

**File:** `src/contexts/AuthContext.tsx` (or wherever auth state is managed)

**What to do:**

1. Add `syncInProgress` state:

```typescript
const [syncInProgress, setSyncInProgress] = useState(false)
```

2. Listen for sync status changes:

```typescript
useEffect(() => {
  if (user) {
    const syncRepo = getSyncRepository()

    // Subscribe to sync status
    const unsubscribe = syncRepo.onSyncStatusChange((status) => {
      setSyncInProgress(status.syncing)
    })

    return unsubscribe
  }
}, [user])
```

3. Show loading UI when `syncInProgress`:

```typescript
if (syncInProgress) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">Syncing your data...</p>
        <p className="text-sm text-gray-500">This may take a few seconds</p>
      </div>
    </div>
  )
}
```

**Alternative:** Use the existing SyncStatusIndicator component to show progress.

---

### Step 5: Expose SyncEngine in SyncRepository

**File:** `src/services/data/SyncRepository.ts`

**What to do:**

Currently, `syncEngine` is private. For easier access from auth service, make it accessible:

**Option A:** Make property public:
```typescript
public syncEngine: SyncEngine  // Change from private
```

**Option B:** Add public method (better encapsulation):
```typescript
/**
 * Perform initial sync - download all data from cloud
 */
async performInitialSync(userId: string): Promise<void> {
  await this.syncEngine.performInitialSync(userId)
}

/**
 * Check if initial sync is needed
 */
async isInitialSyncNeeded(): Promise<boolean> {
  return await this.syncEngine.isInitialSyncNeeded()
}
```

Then use in SupabaseAuthService:
```typescript
const syncRepo = getSyncRepository()
if (await syncRepo.isInitialSyncNeeded()) {
  await syncRepo.performInitialSync(user.id)
}
```

**Recommended:** Option B (better encapsulation)

---

## Testing

### Test 1: Fresh Login

**Steps:**
1. Open DevTools → Application → IndexedDB
2. Delete the RockOn database
3. Reload the page
4. Log in with existing account (that has data in Supabase)
5. Wait for initial sync to complete

**Expected Results:**
✅ Loading indicator appears
✅ Console shows "Starting initial sync for user: [id]"
✅ Console shows progress for each entity type
✅ Console shows "Initial sync complete: N total records synced"
✅ IndexedDB shows all synced data (songs, setlists, practices)
✅ UI shows all data immediately after sync

---

### Test 2: Second Login (No Re-sync)

**Steps:**
1. With data already synced, log out
2. Log back in

**Expected Results:**
✅ Console shows "Initial sync not needed, data already synced"
✅ No loading indicator
✅ UI shows data immediately (from IndexedDB)
✅ No network requests for initial sync

---

### Test 3: Multi-Device Scenario

**Steps:**
1. Device 1: Create 5 songs, 2 setlists, 1 practice
2. Wait for sync to complete (check Supabase to verify)
3. Device 2 (or incognito window): Log in with same account

**Expected Results:**
✅ Device 2 shows loading indicator
✅ Device 2 downloads all 5 songs, 2 setlists, 1 practice
✅ Data appears in UI immediately after sync
✅ Counts match between devices

---

### Test 4: Empty Account

**Steps:**
1. Create new account (no bands, no data)
2. Log in

**Expected Results:**
✅ Initial sync runs
✅ Console shows "No bands found, skipping entity sync"
✅ No errors
✅ Empty state UI shown (no data)

---

### Test 5: Large Dataset

**Steps:**
1. Create account with 100+ songs, 20+ setlists
2. Log in on fresh device

**Expected Results:**
✅ Initial sync completes within 5 seconds
✅ All records synced correctly
✅ No timeouts or errors
✅ UI responsive during sync

---

## Debugging

### Enable Debug Logging

Add to console:
```javascript
localStorage.setItem('debug_sync', 'true')
```

Reload page. You'll see detailed logs:
- Every record downloaded
- Timestamps and counts
- Error details

### Check Sync Metadata

In DevTools console:
```javascript
// Check if initial sync completed
const meta = await db.syncMetadata.toArray()
console.table(meta)

// Check localStorage
console.log(localStorage.getItem('last_full_sync'))
```

### Manually Trigger Sync

In DevTools console:
```javascript
// Force initial sync
const repo = getSyncRepository()
await repo.syncEngine.performInitialSync('<your-user-id>')
```

### Common Issues

**Issue:** "Cannot read property 'getSongs' of undefined"
**Solution:** RemoteRepository methods not implemented. Check that all entity methods exist.

**Issue:** "RLS policy error" during sync
**Solution:** RLS policies not applied. Run the RLS migration SQL.

**Issue:** Sync hangs/never completes
**Solution:** Check network tab for failed requests. Check Supabase logs for errors.

**Issue:** Duplicate records
**Solution:** The `.catch()` handlers should update instead of failing. Check that they're in place.

---

## Performance Optimization (Optional)

### Batch Inserts

Instead of one-by-one inserts, use `bulkPut`:

```typescript
// Instead of:
for (const song of songs) {
  await this.local.addSong(song)
}

// Use:
await db.songs.bulkPut(songs)
```

**Trade-off:** Faster but requires handling duplicates differently.

### Parallel Downloads

Download entities in parallel instead of sequentially:

```typescript
await Promise.all([
  this.syncSongsForBands(bandIds),
  this.syncSetlistsForBands(bandIds),
  this.syncPracticesForBands(bandIds)
])
```

**Trade-off:** Faster but harder to debug, more network pressure.

### Incremental UI Updates

Update UI as each entity finishes instead of waiting for all:

```typescript
// After syncing songs
this.notifyListeners()

// After syncing setlists
this.notifyListeners()

// etc.
```

**Trade-off:** Better UX but more re-renders.

---

## Next Steps

After Phase 1 is complete:

1. **Phase 2:** Implement `pullFromRemote()` for ongoing sync
2. **Phase 3:** Add conflict detection
3. **Phase 4:** Build conflict resolution UI
4. **Deploy:** Push to Vercel

See the full specification for details on later phases.

---

## Success Criteria

✅ **Must Have:**
- Initial sync downloads all data on first login
- Sync completes within 5 seconds for typical user (< 500 records)
- No data loss or duplicate records
- Works across all entity types (songs, setlists, practices, bands)
- Proper error handling (doesn't break app if sync fails)
- Loading indicator shows during sync

✅ **Nice to Have:**
- Batch operations for better performance
- Parallel downloads
- Incremental UI updates
- Detailed logging for debugging

---

## Code Review Checklist

Before marking complete, verify:

- [ ] SyncMetadata table added to database schema
- [ ] `performInitialSync()` implemented in SyncEngine
- [ ] `isInitialSyncNeeded()` implemented in SyncEngine
- [ ] `markInitialSyncComplete()` implemented in SyncEngine
- [ ] Initial sync called in SupabaseAuthService on login
- [ ] Loading indicator shown during sync
- [ ] Error handling in place (try/catch, .catch() for duplicates)
- [ ] Console logging for debugging
- [ ] All entity types synced (songs, setlists, practices)
- [ ] Tested on fresh browser (cleared IndexedDB)
- [ ] Tested with multiple bands
- [ ] Tested with empty account (no bands)
- [ ] No RLS policy errors during sync
- [ ] Performance acceptable (< 5 seconds for 500 records)

---

**Status:** Ready to Implement
**Priority:** Critical - Blocks multi-device usage
**Estimated Time:** 2-3 hours
**Created:** 2025-10-26T17:30
