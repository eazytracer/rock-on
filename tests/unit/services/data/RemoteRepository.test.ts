import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RemoteRepository } from '../../../../src/services/data/RemoteRepository'

// Mock Supabase client
vi.mock('../../../../src/services/supabase/client', () => ({
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

describe('RemoteRepository - Field Mapping', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    repository = new RemoteRepository()
  })

  it('should map camelCase to snake_case for Songs', () => {
    const song = {
      id: 'test',
      title: 'Test',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      key: 'C',
      bpm: 120,
      difficulty: 3 as 1 | 2 | 3 | 4 | 5,
      guitarTuning: 'Standard',
      structure: [],
      chords: ['C', 'G', 'Am'],
      referenceLinks: [],
      tags: ['rock'],
      createdDate: new Date('2024-01-01'),
      lastPracticed: new Date('2024-01-15'),
      confidenceLevel: 3,
      contextType: 'band' as 'band' | 'personal',
      contextId: 'band-1',
      createdBy: 'user-1',
      visibility: 'band_only' as 'private' | 'band_only' | 'public',
      songGroupId: 'group-1'
    }

    const mapped = repository['mapSongToSupabase'](song)

    expect(mapped).toHaveProperty('context_type', 'band')
    expect(mapped).toHaveProperty('context_id', 'band-1')
    expect(mapped).toHaveProperty('created_by', 'user-1')
    expect(mapped).toHaveProperty('confidence_level', 3)
    expect(mapped).toHaveProperty('song_group_id', 'group-1')
    expect(mapped).toHaveProperty('last_practiced')
  })

  it('should map snake_case to camelCase for Songs', () => {
    const row = {
      id: 'test',
      title: 'Test',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      key: 'C',
      tempo: 120,
      difficulty: 3,
      guitar_tuning: 'Standard',
      notes: 'Some notes',
      genre: 'Rock',
      context_type: 'band',
      context_id: 'band-1',
      created_by: 'user-1',
      confidence_level: 3,
      visibility: 'band_only',
      song_group_id: 'group-1',
      created_date: '2024-01-01T00:00:00Z',
      last_practiced: '2024-01-15T00:00:00Z'
    }

    const mapped = repository['mapSongFromSupabase'](row)

    expect(mapped).toHaveProperty('contextType', 'band')
    expect(mapped).toHaveProperty('contextId', 'band-1')
    expect(mapped).toHaveProperty('createdBy', 'user-1')
    expect(mapped).toHaveProperty('confidenceLevel', 3)
    expect(mapped).toHaveProperty('songGroupId', 'group-1')
    expect(mapped.createdDate).toBeInstanceOf(Date)
    expect(mapped.lastPracticed).toBeInstanceOf(Date)
  })

  it('should handle partial Song objects in mapping to Supabase', () => {
    const partialSong = {
      id: 'test',
      title: 'Test',
      contextType: 'band' as 'band' | 'personal',
      contextId: 'band-1'
    }

    const mapped = repository['mapSongToSupabase'](partialSong)

    expect(mapped).toHaveProperty('context_type', 'band')
    expect(mapped).toHaveProperty('context_id', 'band-1')
    expect(mapped.title).toBe('Test')
  })

  it('should handle null/undefined fields in mapping from Supabase', () => {
    const row = {
      id: 'test',
      title: 'Test',
      artist: 'Test Artist',
      context_type: 'band',
      context_id: 'band-1',
      created_by: 'user-1',
      confidence_level: 3,
      created_date: null,
      last_practiced: null
    }

    const mapped = repository['mapSongFromSupabase'](row)

    expect(mapped.createdDate).toBeInstanceOf(Date) // Falls back to new Date()
    expect(mapped.lastPracticed).toBeUndefined()
  })
})

describe('RemoteRepository - Songs CRUD (Stubs)', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    repository = new RemoteRepository()
  })

  it('should have getSongs method', () => {
    expect(repository.getSongs).toBeDefined()
    expect(typeof repository.getSongs).toBe('function')
  })

  it('should have getSong method', () => {
    expect(repository.getSong).toBeDefined()
    expect(typeof repository.getSong).toBe('function')
  })

  it('should have addSong method', () => {
    expect(repository.addSong).toBeDefined()
    expect(typeof repository.addSong).toBe('function')
  })

  it('should have updateSong method', () => {
    expect(repository.updateSong).toBeDefined()
    expect(typeof repository.updateSong).toBe('function')
  })

  it('should have deleteSong method', () => {
    expect(repository.deleteSong).toBeDefined()
    expect(typeof repository.deleteSong).toBe('function')
  })
})

describe('RemoteRepository - Other Entities (Stubs)', () => {
  let repository: RemoteRepository

  beforeEach(() => {
    repository = new RemoteRepository()
  })

  it('should have Band methods as stubs', () => {
    expect(repository.getBands).toBeDefined()
    expect(repository.getBand).toBeDefined()
    expect(repository.getBandsForUser).toBeDefined()
    expect(repository.addBand).toBeDefined()
    expect(repository.updateBand).toBeDefined()
    expect(repository.deleteBand).toBeDefined()
  })

  it('should have Setlist methods as stubs', () => {
    expect(repository.getSetlists).toBeDefined()
    expect(repository.getSetlist).toBeDefined()
    expect(repository.addSetlist).toBeDefined()
    expect(repository.updateSetlist).toBeDefined()
    expect(repository.deleteSetlist).toBeDefined()
  })

  it('should have PracticeSession methods as stubs', () => {
    expect(repository.getPracticeSessions).toBeDefined()
    expect(repository.getPracticeSession).toBeDefined()
    expect(repository.addPracticeSession).toBeDefined()
    expect(repository.updatePracticeSession).toBeDefined()
    expect(repository.deletePracticeSession).toBeDefined()
  })

  it('should have BandMembership methods as stubs', () => {
    expect(repository.getBandMemberships).toBeDefined()
    expect(repository.getUserMemberships).toBeDefined()
    expect(repository.addBandMembership).toBeDefined()
    expect(repository.updateBandMembership).toBeDefined()
    expect(repository.deleteBandMembership).toBeDefined()
  })
})
