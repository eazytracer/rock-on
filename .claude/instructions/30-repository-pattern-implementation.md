# Task 30: Repository Pattern Implementation

## Context

The application currently has services that directly access Dexie. We need to create a repository layer that abstracts data access, allowing us to swap between local (Dexie), remote (Supabase), or synchronized storage without changing service code.

## Dependencies

- Task 01: Environment setup completed
- Task 10: Supabase schema deployed
- Task 20: Authentication system updated (see task 20-auth-system.md)

## Objective

Create repository interfaces and three implementations:
1. **LocalRepository**: Direct Dexie access (current functionality)
2. **RemoteRepository**: Supabase access
3. **SyncRepository**: Hybrid (local-first with background sync)

## Test Requirements (Write These First)

### Test File: `src/services/data/__tests__/LocalRepository.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LocalRepository } from '../LocalRepository'
import { db } from '../../database'
import { Song } from '../../../models/Song'

describe('LocalRepository - Songs', () => {
  let repository: LocalRepository
  const testSong: Song = {
    id: 'test-song-1',
    title: 'Test Song',
    artist: 'Test Artist',
    contextType: 'band',
    contextId: 'test-band-1',
    createdBy: 'test-user-1',
    confidenceLevel: 3,
    createdDate: new Date()
  }

  beforeEach(async () => {
    repository = new LocalRepository()
    await db.songs.clear()
  })

  afterEach(async () => {
    await db.songs.clear()
  })

  it('should add a song', async () => {
    const result = await repository.addSong(testSong)

    expect(result).toMatchObject({
      title: 'Test Song',
      artist: 'Test Artist'
    })
    expect(result.id).toBeDefined()

    const stored = await db.songs.get(result.id)
    expect(stored).toBeDefined()
    expect(stored?.title).toBe('Test Song')
  })

  it('should get songs by filter', async () => {
    await db.songs.add(testSong)
    await db.songs.add({
      ...testSong,
      id: 'test-song-2',
      contextId: 'other-band'
    })

    const results = await repository.getSongs({
      contextType: 'band',
      contextId: 'test-band-1'
    })

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('test-song-1')
  })

  it('should update a song', async () => {
    await db.songs.add(testSong)

    const updated = await repository.updateSong('test-song-1', {
      title: 'Updated Title',
      confidenceLevel: 5
    })

    expect(updated.title).toBe('Updated Title')
    expect(updated.confidenceLevel).toBe(5)
  })

  it('should delete a song', async () => {
    await db.songs.add(testSong)

    await repository.deleteSong('test-song-1')

    const stored = await db.songs.get('test-song-1')
    expect(stored).toBeUndefined()
  })

  it('should handle non-existent song gracefully', async () => {
    const result = await repository.getSong('non-existent')
    expect(result).toBeNull()
  })
})

describe('LocalRepository - Bands', () => {
  let repository: LocalRepository

  beforeEach(async () => {
    repository = new LocalRepository()
    await db.bands.clear()
  })

  it('should add a band', async () => {
    const band = {
      id: 'test-band-1',
      name: 'Test Band',
      createdDate: new Date()
    }

    const result = await repository.addBand(band)
    expect(result.name).toBe('Test Band')
  })

  it('should get bands for a user', async () => {
    // Add bands
    await db.bands.add({ id: 'band-1', name: 'Band 1', createdDate: new Date() })
    await db.bands.add({ id: 'band-2', name: 'Band 2', createdDate: new Date() })

    // Add memberships
    await db.bandMemberships.add({
      id: 'mem-1',
      userId: 'user-1',
      bandId: 'band-1',
      role: 'admin',
      status: 'active',
      joinedDate: new Date()
    })

    const bands = await repository.getBandsForUser('user-1')
    expect(bands).toHaveLength(1)
    expect(bands[0].id).toBe('band-1')
  })
})
```

### Test File: `src/services/data/__tests__/RemoteRepository.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RemoteRepository } from '../RemoteRepository'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('../../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [
            {
              id: 'test-song-1',
              title: 'Test Song',
              artist: 'Test Artist',
              context_type: 'band',
              context_id: 'test-band-1',
              created_by: 'test-user-1',
              confidence_level: 3
            }
          ],
          error: null
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'new-song-1',
              title: 'New Song',
              artist: 'New Artist'
            },
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'test-song-1', title: 'Updated' },
              error: null
            }))
          }))
        }))
      }))
    }))
  }
}))

describe('RemoteRepository - Songs', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    repository = new RemoteRepository()
  })

  it('should map camelCase to snake_case', () => {
    const song = {
      id: 'test',
      title: 'Test',
      contextType: 'band',
      contextId: 'band-1',
      createdBy: 'user-1',
      confidenceLevel: 3
    }

    const mapped = repository['mapSongToSupabase'](song)

    expect(mapped).toHaveProperty('context_type', 'band')
    expect(mapped).toHaveProperty('context_id', 'band-1')
    expect(mapped).toHaveProperty('created_by', 'user-1')
    expect(mapped).toHaveProperty('confidence_level', 3)
  })

  it('should map snake_case to camelCase', () => {
    const row = {
      id: 'test',
      title: 'Test',
      context_type: 'band',
      context_id: 'band-1',
      created_by: 'user-1',
      confidence_level: 3
    }

    const mapped = repository['mapSongFromSupabase'](row)

    expect(mapped).toHaveProperty('contextType', 'band')
    expect(mapped).toHaveProperty('contextId', 'band-1')
    expect(mapped).toHaveProperty('createdBy', 'user-1')
    expect(mapped).toHaveProperty('confidenceLevel', 3)
  })
})
```

## Implementation Steps

### Step 1: Create Repository Interface

**File**: `src/services/data/IDataRepository.ts`

```typescript
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { BandMembership } from '../../models/BandMembership'

export interface SongFilter {
  contextType?: 'band' | 'personal'
  contextId?: string
  createdBy?: string
  songGroupId?: string
}

export interface BandFilter {
  userId?: string
  isActive?: boolean
}

/**
 * Data repository interface
 * Abstracts data access for local, remote, or synchronized storage
 */
export interface IDataRepository {
  // ========== SONGS ==========
  getSongs(filter?: SongFilter): Promise<Song[]>
  getSong(id: string): Promise<Song | null>
  addSong(song: Song): Promise<Song>
  updateSong(id: string, updates: Partial<Song>): Promise<Song>
  deleteSong(id: string): Promise<void>

  // ========== BANDS ==========
  getBands(filter?: BandFilter): Promise<Band[]>
  getBand(id: string): Promise<Band | null>
  getBandsForUser(userId: string): Promise<Band[]>
  addBand(band: Band): Promise<Band>
  updateBand(id: string, updates: Partial<Band>): Promise<Band>
  deleteBand(id: string): Promise<void>

  // ========== SETLISTS ==========
  getSetlists(bandId: string): Promise<Setlist[]>
  getSetlist(id: string): Promise<Setlist | null>
  addSetlist(setlist: Setlist): Promise<Setlist>
  updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist>
  deleteSetlist(id: string): Promise<void>

  // ========== PRACTICE SESSIONS ==========
  getPracticeSessions(bandId: string): Promise<PracticeSession[]>
  getPracticeSession(id: string): Promise<PracticeSession | null>
  addPracticeSession(session: PracticeSession): Promise<PracticeSession>
  updatePracticeSession(id: string, updates: Partial<PracticeSession>): Promise<PracticeSession>
  deletePracticeSession(id: string): Promise<void>

  // ========== BAND MEMBERSHIPS ==========
  getBandMemberships(bandId: string): Promise<BandMembership[]>
  getUserMemberships(userId: string): Promise<BandMembership[]>
  addBandMembership(membership: BandMembership): Promise<BandMembership>
  updateBandMembership(id: string, updates: Partial<BandMembership>): Promise<BandMembership>
  deleteBandMembership(id: string): Promise<void>
}
```

### Step 2: Implement LocalRepository

**File**: `src/services/data/LocalRepository.ts`

```typescript
import { db } from '../database'
import { IDataRepository, SongFilter, BandFilter } from './IDataRepository'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { Setlist } from '../../models/Setlist'
import { PracticeSession } from '../../models/PracticeSession'
import { BandMembership } from '../../models/BandMembership'

/**
 * Local repository implementation using Dexie (IndexedDB)
 * This is the existing data access pattern, refactored into a repository
 */
export class LocalRepository implements IDataRepository {
  // ========== SONGS ==========

  async getSongs(filter?: SongFilter): Promise<Song[]> {
    let query = db.songs.toCollection()

    if (filter?.contextType) {
      query = db.songs.where('contextType').equals(filter.contextType)

      if (filter.contextId) {
        return query.filter(s => s.contextId === filter.contextId).toArray()
      }
    }

    if (filter?.createdBy) {
      return query.filter(s => s.createdBy === filter.createdBy).toArray()
    }

    if (filter?.songGroupId) {
      return query.filter(s => s.songGroupId === filter.songGroupId).toArray()
    }

    return query.toArray()
  }

  async getSong(id: string): Promise<Song | null> {
    const song = await db.songs.get(id)
    return song || null
  }

  async addSong(song: Song): Promise<Song> {
    // Ensure ID exists
    if (!song.id) {
      song.id = crypto.randomUUID()
    }

    await db.songs.add(song)
    return song
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    await db.songs.update(id, updates)

    const updated = await db.songs.get(id)
    if (!updated) {
      throw new Error(`Song ${id} not found after update`)
    }

    return updated
  }

  async deleteSong(id: string): Promise<void> {
    await db.songs.delete(id)
  }

  // ========== BANDS ==========

  async getBands(filter?: BandFilter): Promise<Band[]> {
    let query = db.bands.toCollection()

    if (filter?.isActive !== undefined) {
      query = query.filter(b => (b.isActive ?? true) === filter.isActive)
    }

    if (filter?.userId) {
      // Get bands where user is a member
      const memberships = await db.bandMemberships
        .where('userId')
        .equals(filter.userId)
        .filter(m => m.status === 'active')
        .toArray()

      const bandIds = memberships.map(m => m.bandId)
      return query.filter(b => bandIds.includes(b.id)).toArray()
    }

    return query.toArray()
  }

  async getBand(id: string): Promise<Band | null> {
    const band = await db.bands.get(id)
    return band || null
  }

  async getBandsForUser(userId: string): Promise<Band[]> {
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .filter(m => m.status === 'active')
      .toArray()

    const bands = await Promise.all(
      memberships.map(async (m) => await db.bands.get(m.bandId))
    )

    return bands.filter((b): b is Band => b !== undefined)
  }

  async addBand(band: Band): Promise<Band> {
    if (!band.id) {
      band.id = crypto.randomUUID()
    }

    await db.bands.add(band)
    return band
  }

  async updateBand(id: string, updates: Partial<Band>): Promise<Band> {
    await db.bands.update(id, updates)

    const updated = await db.bands.get(id)
    if (!updated) {
      throw new Error(`Band ${id} not found after update`)
    }

    return updated
  }

  async deleteBand(id: string): Promise<void> {
    await db.bands.delete(id)
  }

  // ========== SETLISTS ==========

  async getSetlists(bandId: string): Promise<Setlist[]> {
    return db.setlists
      .where('bandId')
      .equals(bandId)
      .reverse()
      .toArray()
  }

  async getSetlist(id: string): Promise<Setlist | null> {
    const setlist = await db.setlists.get(id)
    return setlist || null
  }

  async addSetlist(setlist: Setlist): Promise<Setlist> {
    if (!setlist.id) {
      setlist.id = crypto.randomUUID()
    }

    await db.setlists.add(setlist)
    return setlist
  }

  async updateSetlist(id: string, updates: Partial<Setlist>): Promise<Setlist> {
    await db.setlists.update(id, updates)

    const updated = await db.setlists.get(id)
    if (!updated) {
      throw new Error(`Setlist ${id} not found after update`)
    }

    return updated
  }

  async deleteSetlist(id: string): Promise<void> {
    await db.setlists.delete(id)
  }

  // ========== PRACTICE SESSIONS ==========

  async getPracticeSessions(bandId: string): Promise<PracticeSession[]> {
    return db.practiceSessions
      .where('bandId')
      .equals(bandId)
      .reverse()
      .toArray()
  }

  async getPracticeSession(id: string): Promise<PracticeSession | null> {
    const session = await db.practiceSessions.get(id)
    return session || null
  }

  async addPracticeSession(session: PracticeSession): Promise<PracticeSession> {
    if (!session.id) {
      session.id = crypto.randomUUID()
    }

    await db.practiceSessions.add(session)
    return session
  }

  async updatePracticeSession(id: string, updates: Partial<PracticeSession>): Promise<PracticeSession> {
    await db.practiceSessions.update(id, updates)

    const updated = await db.practiceSessions.get(id)
    if (!updated) {
      throw new Error(`Practice session ${id} not found after update`)
    }

    return updated
  }

  async deletePracticeSession(id: string): Promise<void> {
    await db.practiceSessions.delete(id)
  }

  // ========== BAND MEMBERSHIPS ==========

  async getBandMemberships(bandId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('bandId')
      .equals(bandId)
      .toArray()
  }

  async getUserMemberships(userId: string): Promise<BandMembership[]> {
    return db.bandMemberships
      .where('userId')
      .equals(userId)
      .toArray()
  }

  async addBandMembership(membership: BandMembership): Promise<BandMembership> {
    if (!membership.id) {
      membership.id = crypto.randomUUID()
    }

    await db.bandMemberships.add(membership)
    return membership
  }

  async updateBandMembership(id: string, updates: Partial<BandMembership>): Promise<BandMembership> {
    await db.bandMemberships.update(id, updates)

    const updated = await db.bandMemberships.get(id)
    if (!updated) {
      throw new Error(`Band membership ${id} not found after update`)
    }

    return updated
  }

  async deleteBandMembership(id: string): Promise<void> {
    await db.bandMemberships.delete(id)
  }
}
```

### Step 3: Create Supabase Client

**File**: `src/services/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { config } from '../../config/appMode'

let supabaseInstance: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!config.isProduction) {
    throw new Error('Supabase client should only be used in production mode')
  }

  if (!supabaseInstance) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase URL and anon key must be configured')
    }

    supabaseInstance = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    )
  }

  return supabaseInstance
}

// Export singleton instance (only in production mode)
export const supabase = config.isProduction ? getSupabaseClient() : null
```

### Step 4: Implement RemoteRepository (Partial)

**File**: `src/services/data/RemoteRepository.ts`

```typescript
import { IDataRepository, SongFilter, BandFilter } from './IDataRepository'
import { Song } from '../../models/Song'
import { Band } from '../../models/Band'
import { supabase } from '../supabase/client'

/**
 * Remote repository implementation using Supabase
 */
export class RemoteRepository implements IDataRepository {
  // ========== SONGS ==========

  async getSongs(filter?: SongFilter): Promise<Song[]> {
    if (!supabase) throw new Error('Supabase client not initialized')

    let query = supabase.from('songs').select('*')

    if (filter?.contextType) {
      query = query.eq('context_type', filter.contextType)
    }

    if (filter?.contextId) {
      query = query.eq('context_id', filter.contextId)
    }

    if (filter?.createdBy) {
      query = query.eq('created_by', filter.createdBy)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(this.mapSongFromSupabase)
  }

  async getSong(id: string): Promise<Song | null> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return this.mapSongFromSupabase(data)
  }

  async addSong(song: Song): Promise<Song> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('songs')
      .insert(this.mapSongToSupabase(song))
      .select()
      .single()

    if (error) throw error

    return this.mapSongFromSupabase(data)
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { data, error } = await supabase
      .from('songs')
      .update(this.mapSongToSupabase(updates))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return this.mapSongFromSupabase(data)
  }

  async deleteSong(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase client not initialized')

    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // ========== FIELD MAPPING ==========

  private mapSongToSupabase(song: Partial<Song>): any {
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      key: song.key,
      tempo: song.tempo,
      time_signature: song.timeSignature,
      duration: song.duration,
      difficulty: song.difficulty,
      genre: song.genre,
      notes: song.notes,
      lyrics_url: song.lyricsUrl,
      chords_url: song.chordsUrl,
      recording_url: song.recordingUrl,
      created_date: song.createdDate,
      updated_date: song.updatedDate,
      last_practiced: song.lastPracticed,
      confidence_level: song.confidenceLevel,
      context_type: song.contextType,
      context_id: song.contextId,
      created_by: song.createdBy,
      visibility: song.visibility,
      song_group_id: song.songGroupId
    }
  }

  private mapSongFromSupabase(row: any): Song {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      key: row.key,
      tempo: row.tempo,
      timeSignature: row.time_signature,
      duration: row.duration,
      difficulty: row.difficulty,
      genre: row.genre,
      notes: row.notes,
      lyricsUrl: row.lyrics_url,
      chordsUrl: row.chords_url,
      recordingUrl: row.recording_url,
      createdDate: row.created_date ? new Date(row.created_date) : undefined,
      updatedDate: row.updated_date ? new Date(row.updated_date) : undefined,
      lastPracticed: row.last_practiced ? new Date(row.last_practiced) : undefined,
      confidenceLevel: row.confidence_level,
      contextType: row.context_type,
      contextId: row.context_id,
      createdBy: row.created_by,
      visibility: row.visibility,
      songGroupId: row.song_group_id
    }
  }

  // ========== BANDS (Implement similar patterns) ==========
  // TODO: Implement remaining methods following the same pattern
  async getBands(filter?: BandFilter): Promise<Band[]> {
    throw new Error('Not yet implemented')
  }

  async getBand(id: string): Promise<Band | null> {
    throw new Error('Not yet implemented')
  }

  async getBandsForUser(userId: string): Promise<Band[]> {
    throw new Error('Not yet implemented')
  }

  async addBand(band: Band): Promise<Band> {
    throw new Error('Not yet implemented')
  }

  async updateBand(id: string, updates: Partial<Band>): Promise<Band> {
    throw new Error('Not yet implemented')
  }

  async deleteBand(id: string): Promise<void> {
    throw new Error('Not yet implemented')
  }

  // ... (implement remaining methods)
}
```

## Acceptance Criteria

- [ ] `IDataRepository` interface created with all CRUD operations
- [ ] `LocalRepository` implemented and tested
- [ ] `RemoteRepository` partially implemented (songs complete)
- [ ] Field mapping functions (camelCase ↔ snake_case) working
- [ ] All tests passing
- [ ] No breaking changes to existing code
- [ ] TypeScript compilation successful

## Validation Steps

### 1. Run Tests

```bash
npm test src/services/data/__tests__/
```

### 2. Test Local Repository Integration

```bash
# In dev console or test file
import { LocalRepository } from './services/data/LocalRepository'
const repo = new LocalRepository()
const songs = await repo.getSongs({ contextType: 'band' })
console.log(songs)
```

### 3. Verify No Regression

Ensure existing app functionality still works with Dexie directly.

## Next Steps

- **Task 31**: Complete RemoteRepository implementation
- **Task 40**: Sync engine implementation
- **Task 50**: Migrate services to use repositories
