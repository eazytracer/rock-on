---
timestamp: 2025-10-25T15:06
prompt: Analyze existing services and create comprehensive migration strategy for Task 50 - Service Migration to SyncRepository pattern
---

# Service Migration Strategy - Task 50

## Executive Summary

This document outlines the strategy for migrating all existing services from direct Dexie database access to the new SyncRepository pattern. This migration will enable offline-first functionality with background sync to Supabase.

## Current State Analysis

### Existing Services

Based on codebase analysis, the following services currently use direct Dexie access:

1. **SongService** (src/services/SongService.ts) - Core MVP service
   - Methods: `getAllSongs`, `getPersonalSongs`, `getBandSongs`, `getUserAccessibleSongs`, `createSong`, `getSongById`, `updateSong`, `deleteSong`, `submitConfidenceRating`
   - Direct Dexie calls: `db.songs`, `db.bandMemberships`, `db.setlists`
   - Complexity: Medium (has filtering, validation, cross-entity queries)

2. **BandService** (src/services/BandService.ts) - Core MVP service
   - Methods: `getAllBands`, `createBand`, `getBandById`, `updateBand`, `deleteBand`, `getBandMembers`, `addMemberToBand`, `updateMember`, `removeMemberFromBand`
   - Direct Dexie calls: `db.bands`, `db.members`, `db.songs`, `db.practiceSessions`, `db.setlists`
   - Complexity: High (manages bands AND members, cross-entity validation)

3. **SetlistService** (src/services/SetlistService.ts)
   - Direct Dexie calls: `db.setlists`, related entities
   - Complexity: Medium-High (depends on SongService)

4. **PracticeSessionService** (src/services/PracticeSessionService.ts)
   - Complexity: Medium-High (depends on BandService, SongService)

5. **BandMembershipService** (src/services/BandMembershipService.ts)
   - Complexity: Medium (depends on BandService)

6. **CastingService** (src/services/CastingService.ts)
   - Complexity: Medium (depends on SessionService, SongService)

7. **SongLinkingService** (src/services/SongLinkingService.ts)
   - Complexity: Low (depends on SongService)

8. **MemberCapabilityService** (src/services/MemberCapabilityService.ts)
   - Complexity: Low (depends on BandService)

9. **DatabaseService** (src/services/DatabaseService.ts)
   - Likely legacy - needs investigation

10. **SyncService** (src/services/SyncService.ts)
   - Likely legacy - will be replaced by SyncRepository

### Current Pattern (Before Migration)

```typescript
// Example: SongService current pattern
import { db } from './database'

export class SongService {
  static async getAllSongs(filters: SongFilters): Promise<SongListResponse> {
    let query = db.songs.orderBy('title')

    if (filters.contextType) {
      query = query.filter(song => song.contextType === filters.contextType)
    }

    const songs = await query.toArray()
    const total = await db.songs.count()

    return { songs, total, filtered: songs.length }
  }

  static async createSong(songData: CreateSongRequest): Promise<Song> {
    // ... validation
    const newSong = { id: crypto.randomUUID(), ...songData, createdDate: new Date() }
    await db.songs.add(newSong)
    return newSong
  }
}
```

**Problems with current pattern:**
- ❌ Direct Dexie dependency - can't switch to remote
- ❌ No offline sync capability
- ❌ No background sync to Supabase
- ❌ No conflict resolution
- ❌ No optimistic updates

---

## Target Pattern (After Migration)

### New Pattern Using SyncRepository

```typescript
// Example: SongService migrated pattern
import { repository } from '@/services/data/RepositoryFactory'

export class SongService {
  static async getAllSongs(filters: SongFilters): Promise<SongListResponse> {
    // Convert our service filters to repository filters
    const repoFilter = {
      contextType: filters.contextType,
      contextId: filters.contextId,
      // Note: search, key, difficulty handled client-side for now
    }

    // Use repository instead of direct DB
    let songs = await repository.getSongs(repoFilter)

    // Apply client-side filters (until repository supports them)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      songs = songs.filter(song =>
        song.title.toLowerCase().includes(searchTerm) ||
        song.artist.toLowerCase().includes(searchTerm)
      )
    }

    if (filters.key) {
      songs = songs.filter(song => song.key === filters.key)
    }

    if (filters.difficulty) {
      songs = songs.filter(song => song.difficulty === filters.difficulty)
    }

    if (filters.tags?.length) {
      songs = songs.filter(song =>
        filters.tags!.some(tag => song.tags.includes(tag))
      )
    }

    const total = songs.length

    return { songs, total, filtered: songs.length }
  }

  static async createSong(songData: CreateSongRequest): Promise<Song> {
    // ... validation (same as before)

    // Use repository instead of direct DB
    const newSong = await repository.addSong({
      title: songData.title,
      artist: songData.artist,
      // ... map fields
      contextType: songData.contextType || 'band',
      contextId: songData.contextId || songData.bandId,
      createdBy: songData.createdBy,
    })

    return newSong
  }
}
```

**Benefits of new pattern:**
- ✅ Automatic offline-first behavior
- ✅ Background sync to Supabase
- ✅ Optimistic updates (instant UI feedback)
- ✅ Conflict resolution built-in
- ✅ Works in both local and production modes

---

## Migration Strategy

### Phase 1: Core Services (Critical Path)

**Order of migration (by dependency):**

1. **SongService** (Task 51) - No dependencies, most fundamental
2. **BandService** (Task 52) - No dependencies, required by many others
3. **SetlistService** (Task 53) - Depends on SongService
4. **PracticeSessionService** (Task 54) - Depends on SongService, BandService

### Phase 2: Supporting Services

5. **BandMembershipService** (Task 55) - Depends on BandService
6. **CastingService** (Task 56) - Depends on PracticeSessionService, SongService
7. **SongLinkingService** (Task 57) - Depends on SongService
8. **MemberCapabilityService** - Depends on BandService

### Phase 3: Cleanup

9. **DatabaseService** - Investigate and deprecate if redundant
10. **SyncService** - Deprecate in favor of SyncRepository

---

## Migration Pattern (Step-by-Step)

### For Each Service Migration:

#### Step 1: Write Failing Tests (TDD Approach)

Create test file: `tests/unit/services/{ServiceName}.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SongService } from '@/services/SongService'
import * as RepositoryFactory from '@/services/data/RepositoryFactory'

describe('SongService - Migrated', () => {
  let mockRepository: any

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getSongs: vi.fn(),
      addSong: vi.fn(),
      updateSong: vi.fn(),
      deleteSong: vi.fn(),
    }

    // Mock the factory to return our mock
    vi.spyOn(RepositoryFactory, 'repository', 'get')
      .mockReturnValue(mockRepository)
  })

  it('should get all songs via repository', async () => {
    // Arrange
    const mockSongs = [
      { id: '1', title: 'Song 1', artist: 'Artist 1' },
      { id: '2', title: 'Song 2', artist: 'Artist 2' },
    ]
    mockRepository.getSongs.mockResolvedValue(mockSongs)

    // Act
    const result = await SongService.getAllSongs({ bandId: 'band-1' })

    // Assert
    expect(mockRepository.getSongs).toHaveBeenCalledWith(
      expect.objectContaining({ contextType: undefined })
    )
    expect(result.songs).toEqual(mockSongs)
  })

  it('should create song via repository', async () => {
    // Arrange
    const mockSong = { id: '123', title: 'New Song', artist: 'Artist' }
    mockRepository.addSong.mockResolvedValue(mockSong)

    // Act
    const result = await SongService.createSong({
      title: 'New Song',
      artist: 'Artist',
      // ... other required fields
    })

    // Assert
    expect(mockRepository.addSong).toHaveBeenCalled()
    expect(result).toEqual(mockSong)
  })
})
```

**Run tests to see them FAIL:**
```bash
npm test -- tests/unit/services/SongService.test.ts
```

#### Step 2: Implement Migration

1. **Update imports**
   ```typescript
   // OLD
   import { db } from './database'

   // NEW
   import { repository } from '@/services/data/RepositoryFactory'
   ```

2. **Replace Dexie calls with repository calls**
   - `db.songs.toArray()` → `repository.getSongs()`
   - `db.songs.add(song)` → `repository.addSong(song)`
   - `db.songs.update(id, updates)` → `repository.updateSong(id, updates)`
   - `db.songs.delete(id)` → `repository.deleteSong(id)`
   - `db.songs.get(id)` → `repository.getSongs({ id })[0]`

3. **Handle filtering differences**
   - Repository has limited filtering support
   - Complex filters done client-side AFTER fetching from repository
   - This is acceptable - we're optimizing for sync, not query complexity

4. **Preserve validation logic**
   - All validation stays in service layer
   - Repository is just a data access layer

#### Step 3: Run Tests to Pass

```bash
npm test -- tests/unit/services/SongService.test.ts
```

All tests should now pass ✅

#### Step 4: Integration Testing

Test with real UI:
```bash
npm run dev
```

- Navigate to Songs page
- Verify songs load correctly
- Add a new song - verify it appears
- Edit a song - verify changes persist
- Delete a song - verify it's removed
- Check browser DevTools → Application → IndexedDB → verify data is there

#### Step 5: Verify Sync Behavior (Once Supabase is set up)

- Make changes offline
- Go online
- Verify changes sync to Supabase
- Make changes in another browser/device
- Verify changes sync back

---

## Migration Checklist Template

Use this checklist for each service:

### Service: {ServiceName}

#### Pre-Migration
- [ ] Identify all Dexie calls (`db.{entity}.*`)
- [ ] List all methods to migrate
- [ ] Identify dependencies on other services
- [ ] Check if dependency services are migrated

#### Migration
- [ ] Create test file: `tests/unit/services/{ServiceName}.test.ts`
- [ ] Write failing tests for all methods
- [ ] Run tests to verify they fail
- [ ] Update imports to use `repository`
- [ ] Replace `db.{entity}.*` calls with `repository.*` calls
- [ ] Handle filtering/querying differences
- [ ] Preserve all validation logic
- [ ] Run tests to verify they pass ✅

#### Post-Migration
- [ ] Manual UI testing with `npm run dev`
- [ ] Verify data loads correctly
- [ ] Verify create/update/delete operations work
- [ ] Check IndexedDB has data
- [ ] Verify no console errors
- [ ] Update any documentation

#### Once Supabase is Set Up
- [ ] Test offline → online sync
- [ ] Verify data syncs to Supabase
- [ ] Test conflict resolution (edit same record offline + online)

---

## Repository API Reference

### Current IDataRepository Interface

```typescript
interface IDataRepository {
  // Songs
  getSongs(filter?: SongFilter): Promise<Song[]>
  addSong(song: SongInsert): Promise<Song>
  updateSong(id: string, updates: SongUpdate): Promise<Song>
  deleteSong(id: string): Promise<void>

  // Bands
  getBands(filter?: BandFilter): Promise<Band[]>
  addBand(band: BandInsert): Promise<Band>
  updateBand(id: string, updates: BandUpdate): Promise<Band>
  deleteBand(id: string): Promise<void>

  // Setlists
  getSetlists(filter?: SetlistFilter): Promise<Setlist[]>
  addSetlist(setlist: SetlistInsert): Promise<Setlist>
  updateSetlist(id: string, updates: SetlistUpdate): Promise<Setlist>
  deleteSetlist(id: string): Promise<void>

  // Practice Sessions
  getPracticeSessions(filter?: PracticeSessionFilter): Promise<PracticeSession[]>
  addPracticeSession(session: PracticeSessionInsert): Promise<PracticeSession>
  updatePracticeSession(id: string, updates: PracticeSessionUpdate): Promise<PracticeSession>
  deletePracticeSession(id: string): Promise<void>
}
```

### Available Filters

```typescript
interface SongFilter {
  id?: string
  contextType?: 'personal' | 'band'
  contextId?: string
  userId?: string
}

interface BandFilter {
  id?: string
  userId?: string
}

interface SetlistFilter {
  id?: string
  bandId?: string
  userId?: string
}

interface PracticeSessionFilter {
  id?: string
  bandId?: string
  userId?: string
}
```

**Note:** Complex filters (search, tags, difficulty) should be applied client-side after fetching from repository.

---

## Field Mapping Considerations

### Service Layer vs Repository Layer

**Service Layer** (SongService, BandService, etc.):
- Uses application domain models (Song, Band, etc.)
- Has business logic and validation
- Exposes high-level methods to UI

**Repository Layer** (SyncRepository):
- Uses same domain models
- No business logic
- Just CRUD operations + sync

**No mapping needed!** Both layers use the same types. This simplifies migration significantly.

---

## Handling Cross-Entity Queries

Some services query multiple entities. Example from SongService:

```typescript
// OLD: Direct cross-entity query
const memberships = await db.bandMemberships
  .where('userId').equals(userId)
  .and(m => m.status === 'active')
  .toArray()

const bandIds = memberships.map(m => m.bandId)

const songs = await db.songs
  .filter(song => bandIds.includes(song.contextId))
  .toArray()
```

**NEW: Fetch separately and filter client-side**

```typescript
// Option 1: If BandMemberships are in repository
const allBands = await repository.getBands({ userId })
const bandIds = allBands.map(b => b.id)

const allSongs = await repository.getSongs({ contextType: 'band' })
const songs = allSongs.filter(song => bandIds.includes(song.contextId))

// Option 2: Keep direct Dexie for relationships (temporary)
// Only for entities NOT yet in repository
const memberships = await db.bandMemberships
  .where('userId').equals(userId)
  .toArray()
const bandIds = memberships.map(m => m.bandId)

const allSongs = await repository.getSongs({ contextType: 'band' })
const songs = allSongs.filter(song => bandIds.includes(song.contextId))
```

**Decision:** Use Option 2 initially. Once all entities are in repository, migrate to Option 1.

---

## Potential Issues & Solutions

### Issue 1: Repository doesn't support all filters

**Problem:** Service uses complex Dexie queries like `.where()`, `.and()`, `.filter()`

**Solution:** Fetch broader dataset from repository, filter client-side

```typescript
// Fetch all songs for user's context
const allSongs = await repository.getSongs({ contextType: 'band', contextId: bandId })

// Apply additional filters client-side
const filtered = allSongs.filter(song => {
  if (filters.search) {
    const term = filters.search.toLowerCase()
    if (!song.title.toLowerCase().includes(term) &&
        !song.artist.toLowerCase().includes(term)) {
      return false
    }
  }
  if (filters.key && song.key !== filters.key) return false
  if (filters.difficulty && song.difficulty !== filters.difficulty) return false
  return true
})
```

**Performance:** Acceptable for MVP. Can optimize later with:
- Enhanced repository filtering
- Server-side filtering (Supabase queries)
- Client-side indexing

### Issue 2: Entities not yet in repository

**Problem:** Service queries `db.members`, but members aren't in SyncRepository yet

**Solution:** Keep direct Dexie access temporarily for unmigrated entities

```typescript
import { db } from './database' // Keep this temporarily
import { repository } from '@/services/data/RepositoryFactory'

export class BandService {
  static async getBandMembers(bandId: string): Promise<Member[]> {
    const band = await repository.getBands({ id: bandId })
    if (!band[0]) throw new Error('Band not found')

    // Members not in repository yet - use Dexie directly
    const members = await Promise.all(
      band[0].memberIds.map(id => db.members.get(id))
    )

    return members.filter(Boolean) as Member[]
  }
}
```

**Future:** Once Members are added to repository, migrate this too.

### Issue 3: Transaction/Atomicity

**Problem:** Old code uses Dexie transactions for atomic multi-entity updates

**Solution:** For now, perform updates sequentially. If one fails, handle in catch block.

```typescript
// OLD (with transaction)
await db.transaction('rw', [db.songs, db.setlists], async () => {
  await db.songs.delete(songId)
  await db.setlists.where('songIds').equals(songId).modify(...)
})

// NEW (sequential for MVP)
try {
  await repository.deleteSong(songId)
  // Cascade delete handled by service logic
  const setlists = await repository.getSetlists({ /* filter */ })
  for (const setlist of setlists) {
    if (setlist.songIds.includes(songId)) {
      await repository.updateSetlist(setlist.id, {
        songIds: setlist.songIds.filter(id => id !== songId)
      })
    }
  }
} catch (error) {
  // Log error, potentially retry
  console.error('Failed to delete song and update setlists:', error)
  throw error
}
```

**Future:** Add transaction support to repository if needed.

---

## Testing Strategy

### Unit Tests

- Mock repository using `vi.fn()`
- Test all service methods
- Verify repository methods called with correct arguments
- Verify service logic (validation, filtering) still works

### Integration Tests (After All Services Migrated)

- Test cross-service workflows
- Example: Create band → Add song → Create setlist with song
- Verify data consistency across entities
- Test with real SyncRepository (not mocked)

### E2E Tests (After Supabase Setup)

- Test offline → online sync
- Test conflict resolution
- Test multi-device scenarios

---

## Success Criteria

### Per-Service Success

- ✅ All unit tests passing
- ✅ Service uses `repository` instead of `db`
- ✅ UI functionality unchanged (manual testing)
- ✅ No console errors
- ✅ Data persists in IndexedDB

### Overall Migration Success

- ✅ All services migrated
- ✅ All tests passing
- ✅ MVP UI fully functional
- ✅ Ready for Supabase integration
- ✅ Offline-first behavior working

---

## Timeline Estimate

Based on comprehensive planning:

- **SongService** (Task 51): 3-4 hours
- **BandService** (Task 52): 2-3 hours (simpler than Song)
- **SetlistService** (Task 53): 2-3 hours
- **PracticeSessionService** (Task 54): 3-4 hours
- **BandMembershipService** (Task 55): 2-3 hours
- **CastingService** (Task 56): 3-4 hours
- **Other services**: 4-6 hours
- **Integration testing**: 4-6 hours

**Total: 24-33 hours (3-4 days)**

---

## Next Actions

1. ✅ Complete this migration strategy (Task 50)
2. **Start Task 51: Migrate SongService**
   - Create `tests/unit/services/SongService.test.ts`
   - Write failing tests
   - Implement migration
   - Verify tests pass
   - Manual UI testing
3. **Continue with Task 52: Migrate BandService**
4. **Continue remaining services in order**

---

**Document Complete**: 2025-10-25T15:06
**Status**: Migration strategy defined, ready to begin Task 51
**Next Task**: Task 51 - Migrate SongService using TDD approach
