import { v4 as uuidv4 } from 'uuid'
import { Song } from '../../src/models/Song'
import { Setlist } from '../../src/models/Setlist'
import { PracticeSession } from '../../src/models/PracticeSession'
import { BandMembership } from '../../src/models/BandMembership'

/**
 * Shared test fixtures for both unit and integration tests
 *
 * These fixtures use proper UUIDs and consistent data structure
 * to ensure tests are realistic and maintainable.
 */

// Generate consistent UUIDs for a test run
export function createTestIds() {
  return {
    user1: uuidv4(),
    user2: uuidv4(),
    band1: uuidv4(),
    band2: uuidv4(),
    membership1: uuidv4(),
    membership2: uuidv4(),
    song1: uuidv4(),
    song2: uuidv4(),
    song3: uuidv4(),
    setlist1: uuidv4(),
    practice1: uuidv4(),
  }
}

export type TestIds = ReturnType<typeof createTestIds>

/**
 * Create a test band membership
 */
export function createTestMembership(ids: TestIds, overrides?: Partial<BandMembership>): BandMembership {
  return {
    id: ids.membership1,
    userId: ids.user1,
    bandId: ids.band1,
    role: 'admin',
    permissions: ['read', 'write'],
    joinedDate: new Date('2025-01-01'),
    status: 'active',
    ...overrides
  }
}

/**
 * Create a test song with proper UUIDs
 */
export function createTestSong(ids: TestIds, overrides?: Partial<Song>): Song {
  return {
    id: ids.song1,
    title: 'Test Song 1',
    artist: 'Test Artist',
    album: '',
    duration: 180,
    key: 'C',
    bpm: 120, // IndexedDB uses 'bpm', not 'tempo'
    difficulty: 3,
    guitarTuning: 'Standard',
    structure: [],
    lyrics: '',
    chords: [],
    referenceLinks: [],
    tags: [],
    notes: 'Test notes',
    createdDate: new Date('2025-01-01'),
    confidenceLevel: 3,
    contextType: 'band',
    contextId: ids.band1,
    createdBy: ids.user1,
    visibility: 'band',
    ...overrides
  }
}

/**
 * Create multiple test songs
 */
export function createTestSongs(ids: TestIds): Song[] {
  return [
    createTestSong(ids, {
      id: ids.song1,
      title: 'Test Song 1',
      notes: 'Test notes',
    }),
    createTestSong(ids, {
      id: ids.song2,
      title: 'Test Song 2',
      artist: 'Test Artist 2',
      bpm: 140,
      key: 'D',
    }),
    createTestSong(ids, {
      id: ids.song3,
      title: 'Test Song 3',
      artist: 'Test Artist 3',
      bpm: 100,
      key: 'G',
    })
  ]
}

/**
 * Create a test setlist
 */
export function createTestSetlist(ids: TestIds, overrides?: Partial<Setlist>): Setlist {
  return {
    id: ids.setlist1,
    name: 'Test Setlist',
    bandId: ids.band1,
    songs: [],
    items: [],
    totalDuration: 0,
    notes: '',
    status: 'draft',
    createdDate: new Date('2025-01-01'),
    lastModified: new Date('2025-01-01'),
    ...overrides
  }
}

/**
 * Create a test practice session
 */
export function createTestPractice(ids: TestIds, overrides?: Partial<PracticeSession>): PracticeSession {
  return {
    id: ids.practice1,
    bandId: ids.band1,
    scheduledDate: new Date('2025-01-10'),
    duration: 120,
    location: 'Studio A',
    type: 'rehearsal',
    status: 'scheduled',
    notes: 'Test practice',
    objectives: ['Practice new songs'],
    completedObjectives: [],
    songs: [],
    attendees: [],
    createdDate: new Date('2025-01-01'),
    ...overrides
  }
}

/**
 * Create a complete set of test data for a user with a band
 */
export function createTestDataSet(ids: TestIds) {
  return {
    memberships: [createTestMembership(ids)],
    songs: createTestSongs(ids),
    setlists: [createTestSetlist(ids)],
    practices: [createTestPractice(ids)]
  }
}

/**
 * Create Supabase-formatted song data (snake_case)
 * This matches what RemoteRepository returns from Supabase queries
 */
export function createSupabaseSong(ids: TestIds, overrides?: any) {
  const song = createTestSong(ids, overrides)
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    key: song.key,
    bpm: song.bpm, // Both IndexedDB and Supabase use 'bpm'
    difficulty: song.difficulty,
    guitarTuning: song.guitarTuning,
    structure: song.structure,
    lyrics: song.lyrics,
    chords: song.chords,
    referenceLinks: song.referenceLinks,
    tags: song.tags,
    notes: song.notes,
    createdDate: song.createdDate,
    // Note: Songs use createdDate for conflict resolution, not lastModified
    confidenceLevel: song.confidenceLevel,
    contextType: song.contextType,
    context_id: song.contextId, // Note: snake_case for Supabase
    createdBy: song.createdBy,
    visibility: song.visibility
  }
}

/**
 * Create multiple Supabase-formatted songs
 */
export function createSupabaseSongs(ids: TestIds) {
  return createTestSongs(ids).map(song => createSupabaseSong(ids, song))
}
