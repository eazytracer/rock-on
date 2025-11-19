---
timestamp: 2025-10-26T04:24
prompt: "Investigate the current state of pages integration with the new sync services. Check which pages exist in src/pages/NewLayout/, analyze their service integration, compare against MVP spec, and identify gaps."
type: analysis
status: complete
---

# Pages Integration Status Report

## Executive Summary

All 5 MVP pages exist in `/workspaces/rock-on/src/pages/NewLayout/` but have **mixed integration levels** with the new repository-based sync infrastructure. Only **SongsPage** is fully integrated with the new `SyncRepository` pattern. The other 4 pages use direct Dexie database access through hooks, bypassing the sync layer.

**Critical Finding:** 4 out of 5 pages need migration to use repository-based services for proper sync functionality.

---

## Pages Inventory

### Files Found in `/workspaces/rock-on/src/pages/NewLayout/`

1. **SongsPage.tsx** (74,889 bytes) - ✅ Fully integrated
2. **SetlistsPage.tsx** (65,638 bytes) - ⚠️ Direct Dexie access
3. **ShowsPage.tsx** (48,575 bytes) - ⚠️ Direct Dexie access
4. **PracticesPage.tsx** (37,829 bytes) - ⚠️ Direct Dexie access
5. **BandMembersPage.tsx** (52,977 bytes) - ⚠️ Direct Dexie access
6. **AuthPages.tsx** (47,632 bytes) - Not an MVP page (auth flow)
7. **NewLayout.tsx** (9,315 bytes) - Layout component, not a page

---

## Detailed Integration Analysis

### 1. SongsPage.tsx ✅ FULLY INTEGRATED

**Status:** Complete repository integration with sync support

**Imports:**
```typescript
import { useSongs, useCreateSong, useUpdateSong, useDeleteSong } from '../../hooks/useSongs'
```

**Hook Implementation (useSongs.ts):**
```typescript
// READS: Direct Dexie with liveQuery (line 26-34)
const subscription = liveQuery(async () => {
  const bandSongs = await db.songs
    .where('contextType')
    .equals('band')
    .and(s => s.contextId === bandId)
    .toArray()
  return bandSongs
})

// WRITES: Use SyncRepository (lines 82, 110, 157)
await getSyncRepository().addSong(newSong)      // CREATE
await getSyncRepository().updateSong(songId, updates)  // UPDATE
await getSyncRepository().deleteSong(songId)    // DELETE
```

**Sync Integration:**
- ✅ All write operations use `SyncRepository`
- ✅ Changes are automatically queued for sync
- ✅ Supabase integration active
- ⚠️ Read operations still use direct Dexie (this is acceptable for performance)

**MVP Compliance:**
- ✅ Search and filtering
- ✅ Add/Edit/Delete songs
- ✅ Song metadata (title, artist, key, tuning, BPM, duration)
- ✅ Database-backed (no mock data)

---

### 2. SetlistsPage.tsx ⚠️ DIRECT DEXIE ACCESS

**Status:** Uses direct database access, bypasses sync layer

**Imports:**
```typescript
import { db } from '../../services/database'
```

**Direct Database Calls:**
```typescript
// CREATE (line 70)
await db.setlists.add(newSetlist)

// UPDATE (line 97-99)
await db.setlists.update(setlistId, {
  ...updates,
  lastModified: new Date()
})

// DELETE (line 138)
await db.setlists.delete(setlistId)
```

**Hooks Used:**
- `useSetlists(bandId)` - Direct Dexie queries
- `useCreateSetlist()` - Direct db.setlists.add()
- `useUpdateSetlist()` - Direct db.setlists.update()
- `useDeleteSetlist()` - Direct db.setlists.delete()
- `useAddSetlistItem()` - Direct operations
- `useRemoveSetlistItem()` - Direct operations
- `useReorderSetlistItems()` - Direct operations

**Sync Status:** ❌ NO SYNC - Changes not propagated to Supabase

**MVP Compliance:**
- ✅ Create/edit setlists
- ✅ Add/remove songs
- ✅ Drag-and-drop reordering
- ✅ Associate with shows
- ❌ Sync to cloud (critical gap)

**Required Changes:**
```typescript
// CURRENT (no sync):
await db.setlists.add(newSetlist)

// NEEDED (with sync):
await getSyncRepository().addSetlist(newSetlist)
```

---

### 3. ShowsPage.tsx ⚠️ DIRECT DEXIE ACCESS

**Status:** Uses direct database access, bypasses sync layer

**Imports:**
```typescript
import { db } from '../../services/database'
import { useUpcomingShows, useCreateShow, useUpdateShow, useDeleteShow } from '../../hooks/useShows'
```

**Direct Database Calls in Hooks:**
```typescript
// CREATE (useShows.ts line 92)
await db.practiceSessions.add(newShow)

// UPDATE (line 119)
await db.practiceSessions.update(showId, updates)

// DELETE (line 158)
await db.practiceSessions.delete(showId)
```

**Hooks Used:**
- `useUpcomingShows(bandId)` - Reads from db.practiceSessions
- `useCreateShow()` - Direct db.practiceSessions.add()
- `useUpdateShow()` - Direct db.practiceSessions.update()
- `useDeleteShow()` - Direct db.practiceSessions.delete()

**Sync Status:** ❌ NO SYNC - Shows/gigs not synced to Supabase

**MVP Compliance:**
- ✅ Schedule shows with date/time/location
- ✅ Associate setlist
- ✅ Contact information
- ✅ Payment tracking
- ❌ Sync to cloud (critical gap)

**Table Name Note:**
- Uses `db.practiceSessions` table (correct)
- Filters by `type === 'gig'` to distinguish from practices

---

### 4. PracticesPage.tsx ⚠️ DIRECT DEXIE ACCESS

**Status:** Uses direct database access, bypasses sync layer

**Imports:**
```typescript
import { db } from '../../services/database'
import {
  useUpcomingPractices,
  useCreatePractice,
  useUpdatePractice,
  useDeletePractice,
  useAutoSuggestSongs
} from '../../hooks/usePractices'
```

**Direct Database Calls in Hooks:**
```typescript
// CREATE (usePractices.ts line 92)
await db.practiceSessions.add(newPractice)

// UPDATE (line 119)
await db.practiceSessions.update(practiceId, updates)

// DELETE (line 146)
await db.practiceSessions.delete(practiceId)
```

**Additional Direct Access in Component:**
```typescript
// Load songs (line 88-97)
const songs = await db.songs
  .where('contextType')
  .equals('band')
  .and(s => s.contextId === bandId)
  .toArray()

// Load song details (line 547)
const song = await db.songs.get(sessionSong.songId)
```

**Sync Status:** ❌ NO SYNC - Practice sessions not synced to Supabase

**MVP Compliance:**
- ✅ Schedule practices with date/time/location
- ✅ Add songs to practice
- ✅ Auto-suggest songs from upcoming shows
- ✅ Track duration
- ❌ Sync to cloud (critical gap)

**Table Name Note:**
- Uses `db.practiceSessions` table (correct)
- Filters by `type === 'rehearsal'` to distinguish from shows

---

### 5. BandMembersPage.tsx ⚠️ DIRECT DEXIE ACCESS

**Status:** Uses direct database access, bypasses sync layer

**Imports:**
```typescript
import { db } from '../../services/database'
import {
  useBand,
  useBandMembers,
  useBandInviteCodes,
  useGenerateInviteCode,
  useRemoveBandMember,
  useUpdateMemberRole
} from '../../hooks/useBands'
```

**Direct Database Calls in Hooks:**
```typescript
// READ Band (useBands.ts line 25)
const foundBand = await db.bands.get(bandId)

// READ Memberships (line 60-62)
const bandMemberships = await db.bandMemberships
  .where('bandId')
  .equals(bandId)
  .toArray()

// CREATE Band (line 207)
await db.bands.add(newBand)
await db.bandMemberships.add({...}) // line 210

// UPDATE Band (line 252)
await db.bands.update(currentBandId, {
  name: editBandName,
  description: editBandDescription
})

// DELETE Membership (line 285)
await db.bandMemberships.delete(membershipId)
```

**Additional Direct Access in Component:**
```typescript
// Load user info (line 144)
const user = await db.users.get(membership.userId)

// Load profile (line 269)
const profile = await db.userProfiles
  .where('userId')
  .equals(selectedMember.userId)
  .first()

// Update profile (line 279)
await db.userProfiles.update(profile.id, {
  instruments: instrumentNames,
  primaryInstrument: primaryInstrument || instrumentNames[0],
  updatedDate: new Date()
})
```

**Sync Status:** ❌ NO SYNC - Band/membership changes not synced to Supabase

**MVP Compliance:**
- ✅ View band members
- ✅ Edit band info
- ✅ Generate/share invite codes
- ✅ Manage member roles (owner/admin/member)
- ✅ Edit member instruments
- ✅ Remove members
- ❌ Sync to cloud (critical gap)

**Note:** Band management is particularly critical for multi-device sync

---

## Service Layer Analysis

### Repository-Based Services (New Pattern)

**Location:** `/workspaces/rock-on/src/services/data/`

**Available Services:**
1. ✅ `SyncRepository` - Fully implemented, used by SongsPage
   - Methods: `addSong()`, `updateSong()`, `deleteSong()`
   - Auto-queues changes for Supabase sync
   - Handles offline/online scenarios

**Missing Repository Services:**
2. ❌ `SetlistRepository` - NOT IMPLEMENTED
3. ❌ `PracticeSessionRepository` - NOT IMPLEMENTED (needed for shows & practices)
4. ❌ `BandRepository` - NOT IMPLEMENTED
5. ❌ `BandMembershipRepository` - NOT IMPLEMENTED

### Legacy Direct Services (Old Pattern)

**Location:** `/workspaces/rock-on/src/services/`

These services use direct Dexie access and need migration:
- `BandService.ts` - Direct db access
- `BandMembershipService.ts` - Direct db access
- `PracticeSessionService.ts` - Direct db access
- `SetlistService.ts` - Direct db access
- `SongService.ts` - MIGRATED to SyncRepository ✅

---

## Hook Layer Analysis

### Hooks Using Direct Database Access

**Problematic Hooks (Need Repository Pattern):**

1. **useSetlists.ts** (260 lines)
   - All CRUD operations use `db.setlists.*` directly
   - No sync integration

2. **useShows.ts** (172 lines)
   - All CRUD operations use `db.practiceSessions.*` directly
   - No sync integration

3. **usePractices.ts** (211 lines)
   - All CRUD operations use `db.practiceSessions.*` directly
   - No sync integration

4. **useBands.ts** (341 lines)
   - All CRUD operations use `db.bands.*` and `db.bandMemberships.*` directly
   - No sync integration

### Hooks Using Repository Pattern

1. **useSongs.ts** ✅ CORRECT PATTERN
   - Reads: Direct Dexie with liveQuery (performance optimization)
   - Writes: `getSyncRepository().addSong/updateSong/deleteSong()`
   - This is the reference implementation

---

## MVP Spec Compliance

### Required Pages (from MVP Spec)

1. ✅ **Songs Page** - Exists and fully functional
2. ✅ **Setlists Page** - Exists and fully functional
3. ✅ **Shows Page** - Exists and fully functional
4. ✅ **Practices Page** - Exists and fully functional
5. ✅ **Band Members Page** - Exists and fully functional

### Missing from MVP Spec

- ❌ Dashboard page (explicitly out of scope)
- ❌ Profile/Account Settings page (mentioned in spec but not implemented)

### Functional Gaps

**Critical Sync Gaps:**
1. ❌ Setlists not syncing to Supabase
2. ❌ Shows not syncing to Supabase
3. ❌ Practices not syncing to Supabase
4. ❌ Band/membership changes not syncing to Supabase

**Impact:** 80% of app data is NOT syncing across devices

---

## Database Schema Compliance

### Table Name Verification

**Correct Usage:**
- ✅ `db.practiceSessions` (not `db.practices`)
  - Used correctly in ShowsPage and PracticesPage
  - Differentiated by `type` field ('gig' vs 'rehearsal')

**Field Name Patterns:**
- ✅ IndexedDB uses camelCase (`userId`, `createdDate`, `bandId`)
- ✅ Components correctly use camelCase
- ⚠️ Sync layer should handle camelCase → snake_case conversion

---

## Recommendations

### Priority 1: Complete Sync Infrastructure (CRITICAL)

**Implement Missing Repositories:**

1. **SetlistRepository**
   ```typescript
   class SetlistRepository {
     async addSetlist(setlist: Setlist): Promise<void>
     async updateSetlist(id: string, updates: Partial<Setlist>): Promise<void>
     async deleteSetlist(id: string): Promise<void>
   }
   ```

2. **PracticeSessionRepository** (handles both shows and practices)
   ```typescript
   class PracticeSessionRepository {
     async addPracticeSession(session: PracticeSession): Promise<void>
     async updatePracticeSession(id: string, updates: Partial<PracticeSession>): Promise<void>
     async deletePracticeSession(id: string): Promise<void>
   }
   ```

3. **BandRepository & BandMembershipRepository**
   ```typescript
   class BandRepository {
     async addBand(band: Band): Promise<void>
     async updateBand(id: string, updates: Partial<Band>): Promise<void>
     async deleteBand(id: string): Promise<void>
   }
   
   class BandMembershipRepository {
     async addMembership(membership: BandMembership): Promise<void>
     async updateMembership(id: string, updates: Partial<BandMembership>): Promise<void>
     async deleteMembership(id: string): Promise<void>
   }
   ```

### Priority 2: Migrate Hooks to Use Repositories

**Migration Pattern (from useSongs.ts):**

```typescript
// BEFORE (direct access):
await db.setlists.add(newSetlist)

// AFTER (repository pattern):
await getSyncRepository().addSetlist(newSetlist)
```

**Hooks to Migrate:**
1. `useSetlists.ts` → Use SetlistRepository
2. `useShows.ts` → Use PracticeSessionRepository
3. `usePractices.ts` → Use PracticeSessionRepository
4. `useBands.ts` → Use BandRepository + BandMembershipRepository

### Priority 3: Add Missing MVP Pages

1. **Account Settings Page**
   - User profile editing
   - Email/password management
   - Notification preferences

### Priority 4: Testing & Validation

1. Test sync for all entity types
2. Verify offline → online sync queue processing
3. Test multi-device sync scenarios
4. Validate RLS policies for all tables

---

## Migration Complexity Estimate

### Effort by Component

**SetlistsPage Migration:** 🟡 Medium
- Estimated: 3-4 hours
- Create SetlistRepository
- Update useSetlists hook
- Test sync with shows
- Complexity: Items are nested (songs, breaks, sections)

**ShowsPage Migration:** 🟡 Medium
- Estimated: 3-4 hours
- Create PracticeSessionRepository
- Update useShows hook
- Handle setlist associations
- Complexity: Payment tracking, contacts

**PracticesPage Migration:** 🟡 Medium
- Estimated: 3-4 hours
- Reuse PracticeSessionRepository
- Update usePractices hook
- Handle song associations
- Complexity: Auto-suggest feature

**BandMembersPage Migration:** 🔴 High
- Estimated: 5-6 hours
- Create BandRepository + BandMembershipRepository
- Update useBands hook
- Handle user profiles, invite codes
- Complexity: Multiple related entities

**Total Estimated Effort:** 14-18 hours

---

## Success Criteria

### Phase 1: Infrastructure (Complete)
- ✅ SyncRepository implemented
- ✅ SongService migrated
- ✅ SongsPage integrated
- ✅ Song sync working end-to-end

### Phase 2: Remaining Repositories (IN PROGRESS)
- ⬜ SetlistRepository implemented
- ⬜ PracticeSessionRepository implemented
- ⬜ BandRepository implemented
- ⬜ BandMembershipRepository implemented

### Phase 3: Page Migrations (NOT STARTED)
- ⬜ SetlistsPage using repository
- ⬜ ShowsPage using repository
- ⬜ PracticesPage using repository
- ⬜ BandMembersPage using repository

### Phase 4: End-to-End Validation (NOT STARTED)
- ⬜ All CRUD operations sync to Supabase
- ⬜ Offline changes queue and sync when online
- ⬜ Multi-device sync tested
- ⬜ RLS policies verified for all entities

---

## Conclusion

The pages are **functionally complete** for MVP feature requirements, but **critically incomplete** for sync infrastructure. Only 1 out of 5 pages (20%) properly syncs data to Supabase.

**Next Steps:**
1. Prioritize implementing the 4 missing repository classes
2. Migrate hooks to use repositories (following useSongs.ts pattern)
3. Test end-to-end sync for all entity types
4. Validate multi-device scenarios

**Timeline:** With focused effort, the remaining sync integration can be completed in 2-3 days of development work.
