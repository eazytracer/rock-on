---
title: Bidirectional Sync Specification
created: 2025-10-26T17:30
status: Authoritative
type: Architecture & Data Synchronization
original_prompt: "Create comprehensive specification on the full sync process, from cloud to local, local to cloud, simplest way to deal with merge conflicts (user just picks one like steam backups)"
---

# Bidirectional Sync Specification

## Executive Summary

This document defines the complete bidirectional synchronization architecture for RockOn, enabling seamless offline-first operation with automatic cloud backup and multi-device support.

**Status:** Ready for Implementation
**Priority:** Critical (blocks multi-device usage)

---

## Current State Analysis

### What Works ✅
- **Local-first writes**: All writes go to IndexedDB first (instant UI response)
- **Optimistic updates**: UI updates immediately, sync happens in background
- **Queue-based sync**: Write operations queued for remote sync
- **Push to cloud**: Local changes successfully push to Supabase
- **Partial initial sync**: Bands and band_memberships sync on login

### What's Missing ❌
- **Initial sync (cloud → local)**: New devices don't download existing data
- **Pull from remote**: Remote changes not downloaded to local
- **Songs sync**: No initial download of songs
- **Setlists sync**: No initial download of setlists
- **Practice sessions sync**: No initial download of practices/shows
- **Conflict resolution**: No strategy for handling conflicts

### Impact
- ✅ Device 1: Create song → Syncs to cloud ✅
- ❌ Device 2: Opens app → Empty songs list ❌
- ❌ Multi-device workflows broken

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                         │
│                  (User creates/edits data)                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                    SYNCREPOSITORY                             │
│         (Orchestrates local + sync operations)               │
└──────────────────────────────────────────────────────────────┘
          ↓                                         ↓
┌─────────────────────┐                 ┌──────────────────────┐
│  LOCALREPOSITORY    │                 │    SYNCENGINE        │
│   (IndexedDB)       │                 │  (Bidirectional)     │
│                     │                 │                      │
│  • Instant reads    │                 │  • Queue writes      │
│  • Instant writes   │                 │  • Push to cloud     │
│  • Offline capable  │                 │  • Pull from cloud   │
└─────────────────────┘                 └──────────────────────┘
                                                   ↓
                                        ┌──────────────────────┐
                                        │  REMOTEREPOSITORY    │
                                        │    (Supabase)        │
                                        │                      │
                                        │  • Cloud storage     │
                                        │  • Multi-device sync │
                                        │  • Backup & recovery │
                                        └──────────────────────┘
```

---

## Sync Strategy: Last-Write-Wins with Manual Conflict Resolution

### Design Decision
Use **Last-Write-Wins (LWW)** as the default strategy with **manual conflict resolution** when timestamps are very close.

### Why Last-Write-Wins?
1. **Simple**: No complex merge algorithms
2. **Fast**: Conflict resolution in O(1) time
3. **Predictable**: User understands "most recent edit wins"
4. **Works 99% of the time**: Simultaneous edits on different devices are rare

### Implementation
Every record has a `last_modified` timestamp (already in schema):
- **Cloud wins**: If `remote.last_modified > local.last_modified`
- **Local wins**: If `local.last_modified > remote.last_modified`
- **Manual**: If timestamps within 5 seconds, show conflict UI

---

## Sync Flows

### Flow 1: Initial Sync (First Login / New Device)

**Trigger:** User logs in for the first time OR clears browser data

**Steps:**
1. **Authenticate** user with Supabase
2. **Determine if initial sync needed**:
   - Check `localStorage.getItem('last_full_sync')`
   - If null OR > 30 days old → Initial sync required
3. **Download all data** from Supabase to IndexedDB:
   ```
   For each entity type (songs, setlists, practices, bands, memberships):
     1. Fetch all records from Supabase (filtered by user's bands)
     2. Store in IndexedDB (overwrite all)
     3. Update UI
   ```
4. **Set sync marker**: `localStorage.setItem('last_full_sync', Date.now())`
5. **Start periodic sync**: Every 60 seconds

**Expected Time:** 2-5 seconds for typical user (100-500 records)

---

### Flow 2: Create Operation (Local → Cloud)

**Trigger:** User creates a new record

**Steps:**
1. **Write to LocalRepository** (IndexedDB) → Returns immediately ✅
2. **Queue for sync** → Add to SyncEngine queue
3. **Update UI** → Instant feedback to user
4. **Background sync** (when online):
   ```
   1. Get record from IndexedDB
   2. POST to Supabase via RemoteRepository
   3. Receive created record with server timestamp
   4. Update IndexedDB with server version (has created_by, server timestamps)
   5. Remove from queue
   ```
5. **Handle errors**:
   - Retry 3 times with exponential backoff
   - Mark as failed if still errors
   - Show user notification

---

### Flow 3: Update Operation (Local → Cloud)

**Trigger:** User edits an existing record

**Steps:**
1. **Update LocalRepository** with new `last_modified = Date.now()`
2. **Queue for sync**
3. **Update UI** immediately
4. **Background sync**:
   ```
   1. Get current record from IndexedDB
   2. PATCH to Supabase
   3. Check for conflicts:
      - If remote.last_modified > local.last_modified:
        → Conflict detected!
      - Otherwise: Apply update
   4. Update IndexedDB with server response
   5. Remove from queue
   ```
5. **Conflict resolution** (if needed):
   - Show modal: "This record was edited on another device"
   - Options: "Keep mine" | "Use theirs" | "Cancel"
   - User chooses → Apply choice

---

### Flow 4: Delete Operation (Local → Cloud)

**Trigger:** User deletes a record

**Steps:**
1. **Delete from LocalRepository**
2. **Queue delete operation**
3. **Update UI** (remove from list)
4. **Background sync**:
   ```
   1. DELETE from Supabase
   2. If succeeds: Remove from queue
   3. If fails (already deleted): Ignore error, remove from queue
   4. If fails (other error): Retry
   ```

---

### Flow 5: Periodic Pull (Cloud → Local)

**Trigger:** Every 60 seconds (when online)

**Steps:**
1. **Check if online** → Skip if offline
2. **For each entity type** (songs, setlists, practices, bands, memberships):
   ```
   1. Get last_sync_time from localStorage (per entity)
   2. Fetch records from Supabase WHERE last_modified > last_sync_time
   3. For each remote record:
      a. Check if exists in IndexedDB
      b. If not exists: INSERT into IndexedDB
      c. If exists: Compare last_modified timestamps
         - If remote > local: UPDATE IndexedDB (remote wins)
         - If local > remote: SKIP (local wins, will push later)
         - If equal: SKIP (already in sync)
   4. Update last_sync_time for this entity
   ```
3. **Notify UI** of changes (via event listeners)

**Sync order:**
1. Users (rarely changes)
2. Bands (needed for filtering)
3. Band Memberships (needed for filtering)
4. Songs
5. Setlists
6. Practice Sessions

---

### Flow 6: Conflict Resolution UI

**Trigger:** Remote record newer than local during sync

**UI Design:**
```
┌────────────────────────────────────────────────┐
│  🔄 Sync Conflict                               │
│                                                │
│  This [Song/Setlist/Practice] was modified    │
│  on another device. Which version do you want  │
│  to keep?                                      │
│                                                │
│  📱 Your Changes (Device 1)                    │
│  ├─ Modified: 2 minutes ago                    │
│  └─ [Preview of local version]                 │
│                                                │
│  ☁️  Other Changes (Cloud)                     │
│  ├─ Modified: 1 minute ago                     │
│  └─ [Preview of remote version]                │
│                                                │
│  [Keep Mine]  [Use Cloud Version]  [Cancel]   │
└────────────────────────────────────────────────┘
```

**Implementation:**
- Store conflicts in `conflicts` table (IndexedDB)
- Show badge on sync indicator when conflicts exist
- Modal opens when user clicks badge
- User choice applied immediately
- Conflict removed from table

---

## Data Model Extensions

### SyncMetadata Table (IndexedDB)

```typescript
interface SyncMetadata {
  key: string           // Entity type (e.g., 'songs', 'setlists')
  lastSyncTime: Date    // Last successful sync time
  lastFullSync: Date    // Last complete download
  syncInProgress: boolean
}
```

**Purpose:** Track sync state per entity type

### Conflicts Table (IndexedDB)

```typescript
interface SyncConflict {
  id: string
  entityType: 'songs' | 'setlists' | 'practice_sessions'
  entityId: string
  localVersion: any      // Local record
  remoteVersion: any     // Remote record
  detectedAt: Date
  status: 'pending' | 'resolved'
}
```

**Purpose:** Store conflicts for user resolution

---

## API Design

### SyncEngine Methods

#### Initial Sync
```typescript
/**
 * Download all data from Supabase to IndexedDB
 * Call once on first login or after clearing data
 */
async performInitialSync(): Promise<void>
```

#### Pull from Remote
```typescript
/**
 * Download changes from Supabase since last sync
 * Called automatically every 60 seconds
 */
async pullFromRemote(): Promise<void>
```

#### Push to Remote
```typescript
/**
 * Upload queued changes to Supabase
 * Already implemented, no changes needed
 */
async pushQueuedChanges(): Promise<void>
```

#### Full Sync
```typescript
/**
 * Run both pull and push operations
 * This is the main sync method
 */
async syncNow(): Promise<void> {
  await this.pullFromRemote()  // Download first
  await this.pushQueuedChanges() // Then upload
}
```

#### Conflict Resolution
```typescript
/**
 * Resolve a conflict by choosing local or remote version
 */
async resolveConflict(
  conflictId: string,
  choice: 'local' | 'remote'
): Promise<void>
```

---

## Implementation Plan

### Phase 1: Initial Sync (Critical - Do First) 🔥

**Goal:** Download existing data on login

**Tasks:**
1. Add `SyncMetadata` table to database schema
2. Implement `SyncEngine.performInitialSync()`
   - Download songs, setlists, practices for user's bands
   - Store in IndexedDB
   - Set `lastFullSync` timestamp
3. Call `performInitialSync()` in `SupabaseAuthService.syncUserToLocalDB()`
4. Add loading indicator during initial sync
5. Test on fresh browser (cleared data)

**Files to Modify:**
- `src/services/database/index.ts` - Add SyncMetadata table
- `src/services/data/SyncEngine.ts` - Add performInitialSync()
- `src/services/auth/SupabaseAuthService.ts` - Call initial sync on login

**Success Criteria:**
- ✅ Login on Device 2 downloads all songs/setlists/practices from Device 1
- ✅ Data appears within 5 seconds of login
- ✅ No duplicate records

**Estimated Time:** 2-3 hours

---

### Phase 2: Pull from Remote (Important - Do Second) 📥

**Goal:** Download changes periodically

**Tasks:**
1. Implement `SyncEngine.pullFromRemote()`
   - Fetch changes since last sync for each entity
   - Compare timestamps (Last-Write-Wins)
   - Update IndexedDB with newer records
2. Call `pullFromRemote()` in `syncNow()` (uncomment line 104)
3. Add per-entity sync tracking to SyncMetadata
4. Test: Edit on Device 1 → See on Device 2 within 60s

**Files to Modify:**
- `src/services/data/SyncEngine.ts` - Implement pullFromRemote()

**Success Criteria:**
- ✅ Changes on Device 1 appear on Device 2 within 60 seconds
- ✅ No data loss
- ✅ Last-Write-Wins works correctly

**Estimated Time:** 3-4 hours

---

### Phase 3: Conflict Detection (Nice-to-Have - Do Third) ⚠️

**Goal:** Detect simultaneous edits

**Tasks:**
1. Add `Conflicts` table to database schema
2. Detect conflicts during pull (timestamps within 5 seconds)
3. Store conflict in Conflicts table
4. Add badge to sync indicator when conflicts exist
5. Test: Edit same record on both devices within seconds

**Files to Modify:**
- `src/services/database/index.ts` - Add Conflicts table
- `src/services/data/SyncEngine.ts` - Detect conflicts
- `src/components/sync/SyncStatusIndicator.tsx` - Show conflict badge

**Success Criteria:**
- ✅ Conflicts detected when timestamps are close
- ✅ Badge shows number of conflicts
- ✅ No auto-merge when conflict detected

**Estimated Time:** 2-3 hours

---

### Phase 4: Conflict Resolution UI (Nice-to-Have - Do Fourth) 🎨

**Goal:** Let user resolve conflicts

**Tasks:**
1. Create `ConflictResolutionModal` component
2. Show local vs remote version side-by-side
3. Implement "Keep Mine" / "Use Theirs" buttons
4. Apply choice and resume sync
5. Test full conflict flow

**Files to Create:**
- `src/components/sync/ConflictResolutionModal.tsx`

**Files to Modify:**
- `src/services/data/SyncEngine.ts` - Implement resolveConflict()
- `src/components/sync/SyncStatusIndicator.tsx` - Open modal on click

**Success Criteria:**
- ✅ Modal shows both versions
- ✅ User can choose which to keep
- ✅ Sync resumes after resolution

**Estimated Time:** 3-4 hours

---

## Sync Performance Considerations

### Optimization Strategies

**1. Incremental Sync**
- Only fetch records modified since last sync
- Use `WHERE last_modified > $lastSyncTime`
- Dramatically reduces data transfer

**2. Batch Operations**
- Fetch records in batches of 100
- Reduces number of API calls
- Prevents timeout on large datasets

**3. Selective Sync**
- Only sync data for user's active bands
- Skip archived/deleted bands
- Reduces unnecessary data

**4. Background Sync**
- Use Web Workers for sync operations (future)
- Prevents UI blocking
- Improves perceived performance

**5. Caching**
- Cache frequently accessed data in memory
- Reduce IndexedDB reads
- Faster UI rendering

---

## Error Handling

### Network Errors
**Scenario:** User is offline or network fails

**Handling:**
- Queue operations continue to accumulate
- Sync retries when online
- Show offline indicator in UI
- No data loss (all in IndexedDB)

### Auth Errors
**Scenario:** User's session expires

**Handling:**
- Pause sync operations
- Redirect to login
- Resume sync after re-authentication
- No data loss (all in IndexedDB)

### Conflict Errors
**Scenario:** Record modified on multiple devices

**Handling:**
- Detect via timestamp comparison
- Store in Conflicts table
- Show UI for resolution
- Last-Write-Wins as default

### Data Integrity Errors
**Scenario:** Corrupt data or schema mismatch

**Handling:**
- Log error to console
- Skip corrupt record
- Continue sync with other records
- Show notification to user

---

## Testing Strategy

### Unit Tests
1. **SyncEngine.performInitialSync()** - Downloads all data correctly
2. **SyncEngine.pullFromRemote()** - Fetches incremental changes
3. **SyncEngine.pushQueuedChanges()** - Uploads queued operations
4. **Conflict detection** - Detects timestamp conflicts
5. **Last-Write-Wins** - Chooses newer record correctly

### Integration Tests
1. **Full sync cycle** - Pull + Push works end-to-end
2. **Multi-device sync** - Changes propagate between devices
3. **Offline/online** - Queue builds offline, syncs when online
4. **Initial sync** - Fresh device downloads all data
5. **Conflict resolution** - User can resolve conflicts

### Manual Test Scenarios

**Scenario 1: New Device**
1. Login on Device 1 → Create 5 songs
2. Login on Device 2 → Should see all 5 songs
3. ✅ PASS: All songs visible on Device 2

**Scenario 2: Simultaneous Edits**
1. Edit song X on Device 1 (save at 10:00:00)
2. Edit song X on Device 2 (save at 10:00:02)
3. Wait for sync on both devices
4. ✅ PASS: Device 1 shows version from Device 2 (newer timestamp)

**Scenario 3: Offline Edit**
1. Go offline on Device 1
2. Create 3 setlists
3. Go back online
4. ✅ PASS: All 3 setlists sync to cloud and appear on Device 2

---

## Sync Indicator UI

### Status States

**Synced** 🟢
- All changes uploaded
- No conflicts
- Last sync < 5 min ago

**Syncing** 🔵
- Currently uploading/downloading
- Progress indicator animates

**Conflicts** 🟡
- N conflicts detected
- Badge shows count
- Click to resolve

**Offline** ⚫
- No network connection
- Queue building
- Will sync when online

**Error** 🔴
- Sync failed after 3 retries
- Click to retry

---

## Security Considerations

### Data Access
- **RLS policies** control what data can be synced
- **Band membership** determines data access
- **Personal songs** never sync to other users
- **No bypass** of RLS during sync

### Authentication
- **Session tokens** used for all API calls
- **Token refresh** handled automatically
- **Expired tokens** → Pause sync, re-auth required

### Data Privacy
- **No PII** stored in sync logs
- **Encryption** at rest (Supabase default)
- **HTTPS** for all API calls

---

## Monitoring & Debugging

### Sync Logs
```typescript
interface SyncLog {
  timestamp: Date
  operation: 'push' | 'pull' | 'initial'
  entityType: string
  recordCount: number
  duration: number  // milliseconds
  errors: string[]
}
```

**Storage:** IndexedDB table (last 100 entries)

**Purpose:** Debug sync issues without server logs

### Debug Mode
Enable via: `localStorage.setItem('debug_sync', 'true')`

**Features:**
- Verbose console logging
- Sync operation details
- Conflict detection details
- Network request/response logging

---

## Migration Strategy

### Existing Users
**Problem:** Users already have data in IndexedDB from mockup phase

**Solution:**
1. On first app load after update → Run initial sync
2. Compare existing local data with cloud data
3. Use Last-Write-Wins based on `last_modified` field
4. Most users have no cloud data yet → Local wins by default

### Data Validation
- Validate schema before sync
- Skip records with missing required fields
- Log validation errors
- Continue with valid records

---

## Future Enhancements (Out of Scope)

### Real-Time Sync (Supabase Realtime)
- Subscribe to table changes
- Instant updates across devices
- No 60-second delay

### Differential Sync
- Only send changed fields (not full records)
- Reduces bandwidth
- More complex implementation

### Three-Way Merge
- Merge non-conflicting fields automatically
- Only prompt user for actual conflicts
- More complex UX

### Offline-First Patterns
- Service Workers
- Progressive Web App (PWA)
- Background Sync API

---

## Implementation Checklist

### Phase 1: Initial Sync (CRITICAL) 🔥
- [ ] Add `SyncMetadata` table to database
- [ ] Implement `SyncEngine.performInitialSync()`
- [ ] Call initial sync on login
- [ ] Add loading indicator
- [ ] Test on fresh browser
- [ ] Verify no duplicate records
- [ ] Verify all entity types synced (songs, setlists, practices)

### Phase 2: Pull from Remote 📥
- [ ] Implement `SyncEngine.pullFromRemote()`
- [ ] Add per-entity sync tracking
- [ ] Uncomment `pullFromRemote()` call in `syncNow()`
- [ ] Implement Last-Write-Wins logic
- [ ] Test multi-device changes propagate
- [ ] Verify sync runs every 60 seconds

### Phase 3: Conflict Detection ⚠️
- [ ] Add `Conflicts` table to database
- [ ] Detect conflicts during pull
- [ ] Store conflicts in table
- [ ] Add badge to sync indicator
- [ ] Test conflict detection with simultaneous edits

### Phase 4: Conflict Resolution UI 🎨
- [ ] Create `ConflictResolutionModal` component
- [ ] Show local vs remote versions
- [ ] Implement choice buttons
- [ ] Apply user choice
- [ ] Clear conflict from table
- [ ] Test full conflict flow

---

## Success Metrics

### Must Have (MVP)
✅ Initial sync downloads all data on first login
✅ Changes on Device 1 appear on Device 2 within 60 seconds
✅ Offline edits sync when online
✅ No data loss in any scenario

### Nice to Have (Post-MVP)
✅ Conflicts detected and flagged
✅ User can resolve conflicts via UI
✅ Sync performance < 2 seconds for 1000 records
✅ Sync indicator shows accurate status

---

## Appendix A: Database Schema Changes

### SyncMetadata Table
```typescript
// Add to src/services/database/index.ts

export interface SyncMetadata {
  key: string           // Primary key: 'songs', 'setlists', etc.
  lastSyncTime: Date    // Last successful sync
  lastFullSync: Date    // Last complete download
  syncInProgress: boolean
}

// In Dexie class:
syncMetadata!: Table<SyncMetadata, string>

// In constructor:
this.version(3).stores({
  // ... existing tables
  syncMetadata: 'key, lastSyncTime, lastFullSync, syncInProgress'
})
```

### Conflicts Table
```typescript
// Add to src/services/database/index.ts

export interface SyncConflict {
  id?: number
  entityType: 'songs' | 'setlists' | 'practice_sessions'
  entityId: string
  localVersion: any
  remoteVersion: any
  detectedAt: Date
  status: 'pending' | 'resolved'
}

// In Dexie class:
conflicts!: Table<SyncConflict, number>

// In constructor:
this.version(3).stores({
  // ... existing tables
  conflicts: '++id, entityType, entityId, detectedAt, status'
})
```

---

## Appendix B: Key Code Locations

| Component | File Path | Purpose |
|-----------|-----------|---------|
| SyncEngine | `src/services/data/SyncEngine.ts` | Main sync logic |
| SyncRepository | `src/services/data/SyncRepository.ts` | Orchestrates local + sync |
| LocalRepository | `src/services/data/LocalRepository.ts` | IndexedDB operations |
| RemoteRepository | `src/services/data/RemoteRepository.ts` | Supabase operations |
| AuthService | `src/services/auth/SupabaseAuthService.ts` | Login + initial sync |
| SyncIndicator | `src/components/sync/SyncStatusIndicator.tsx` | UI status display |
| Database | `src/services/database/index.ts` | Dexie schema |

---

**Last Updated:** 2025-10-26T17:30
**Status:** Ready for Implementation
**Priority:** Critical - Blocks multi-device usage
**Estimated Total Time:** 10-14 hours for all phases
