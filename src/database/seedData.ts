/**
 * @deprecated DO NOT USE - Legacy seeding file with outdated data structure.
 *
 * **PROBLEM:** Contains hardcoded IDs and outdated data that doesn't match current schema.
 *
 * **SOLUTION:** Use Supabase seeding instead: `supabase db reset`
 *
 * IndexedDB is now populated via SyncEngine.performInitialSync() on first login.
 *
 * See: .claude/specifications/2025-10-27T18:16_test-data-and-seeding-specification.md
 * See: .claude/artifacts/2025-10-31T13:20_seed-data-consolidation-plan.md
 *
 * @deprecated Since 2025-10-31
 */

import { db } from '../services/database'
import { Song } from '../models/Song'
import { Member } from '../models/Member'
import { PracticeSession } from '../models/PracticeSession'
import { Setlist } from '../models/Setlist'
import { Band } from '../models/Band'
import { BandMembership } from '../models/BandMembership'
import { User } from '../models/User'

// @deprecated - See file header for details
// Initial seed data for the application
const initialSongs: Song[] = [
  {
    id: '1',
    title: 'Wonderwall',
    artist: 'Oasis',
    album: "(What's the Story) Morning Glory?",
    duration: 258,
    key: 'Em',
    bpm: 87,
    difficulty: 3,
    structure: [],
    chords: ['Em', 'G', 'D', 'C'],
    notes: 'Classic crowd pleaser',
    referenceLinks: [],
    tags: ['rock', 'cover', 'popular'],
    createdDate: new Date('2024-01-15'),
    lastPracticed: new Date('2024-09-20'),
    confidenceLevel: 4.2,
    contextType: 'band',
    contextId: 'band1',
    createdBy: '1',
    visibility: 'band',
  },
  {
    id: '2',
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    duration: 356,
    key: 'D',
    bpm: 125,
    difficulty: 4,
    structure: [],
    chords: ['D', 'C', 'G', 'F'],
    notes: 'Work on the solo section',
    referenceLinks: [],
    tags: ['rock', 'cover', 'challenging'],
    createdDate: new Date('2024-01-20'),
    lastPracticed: new Date('2024-09-18'),
    confidenceLevel: 2.8,
    contextType: 'band',
    contextId: 'band1',
    createdBy: '1',
    visibility: 'band',
  },
  {
    id: '3',
    title: 'Hotel California',
    artist: 'Eagles',
    duration: 391,
    key: 'Bm',
    bpm: 75,
    difficulty: 4,
    structure: [],
    chords: ['Bm', 'F#', 'A', 'E', 'G', 'D', 'Em'],
    notes: 'Long song, need to practice transitions',
    referenceLinks: [],
    tags: ['rock', 'cover', 'epic'],
    createdDate: new Date('2024-02-01'),
    confidenceLevel: 3.5,
    contextType: 'band',
    contextId: 'band1',
    createdBy: '1',
    visibility: 'band',
  },
]

const initialMembers: Member[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@rockband.com',
    instruments: ['guitar', 'vocals'],
    primaryInstrument: 'guitar',
    role: 'admin',
    joinDate: new Date('2024-01-01'),
    isActive: true,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@rockband.com',
    instruments: ['bass'],
    primaryInstrument: 'bass',
    role: 'member',
    joinDate: new Date('2024-01-05'),
    isActive: true,
  },
]

const initialSessions: PracticeSession[] = [
  {
    id: '1',
    bandId: 'band1',
    scheduledDate: new Date('2024-09-30T19:00:00'),
    duration: 120,
    location: "Mike's Garage",
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      {
        songId: '1',
        timeSpent: 0,
        status: 'not-started',
        sectionsWorked: [],
        improvements: [],
        needsWork: [],
        memberRatings: [],
      },
      {
        songId: '2',
        timeSpent: 0,
        status: 'not-started',
        sectionsWorked: [],
        improvements: [],
        needsWork: [],
        memberRatings: [],
      },
    ],
    attendees: [
      { memberId: '1', confirmed: true, attended: false },
      { memberId: '2', confirmed: true, attended: false },
    ],
    notes: 'Focus on transitions between songs',
    objectives: ['Work on song transitions', 'Practice harmonies'],
    completedObjectives: [],
    createdDate: new Date('2024-09-25'),
  },
]

const initialSetlists: Setlist[] = [
  {
    id: '1',
    name: 'Coffee Shop Gig',
    bandId: 'band1',
    items: [
      { id: crypto.randomUUID(), type: 'song', position: 1, songId: '1' },
      { id: crypto.randomUUID(), type: 'song', position: 2, songId: '3' },
      { id: crypto.randomUUID(), type: 'song', position: 3, songId: '2' },
    ],
    totalDuration: 1005,
    notes: 'Acoustic setup, intimate venue',
    status: 'draft',
    createdDate: new Date('2024-09-25'),
    lastModified: new Date('2024-09-26'),
  },
]

const initialBands: Band[] = [
  {
    id: 'band1',
    name: 'The Rock Legends',
    description: 'Default band for all users',
    createdDate: new Date('2024-01-01'),
    memberIds: [],
    settings: {
      defaultPracticeTime: 120,
      reminderMinutes: [60, 30, 10],
      autoSaveInterval: 30,
    },
  },
]

// Test users (for development/testing)
const initialUsers: User[] = [
  {
    id: 'alice',
    email: 'alice@test.com',
    name: 'Alice Anderson',
    createdDate: new Date('2024-01-01'),
    authProvider: 'mock',
  },
  {
    id: 'bob',
    email: 'bob@test.com',
    name: 'Bob Baker',
    createdDate: new Date('2024-01-02'),
    authProvider: 'mock',
  },
  {
    id: 'charlie',
    email: 'charlie@test.com',
    name: 'Charlie Chen',
    createdDate: new Date('2024-01-03'),
    authProvider: 'mock',
  },
]

// Link test users to band1
const initialBandMemberships: BandMembership[] = [
  {
    id: 'membership-alice',
    userId: 'alice',
    bandId: 'band1',
    role: 'admin',
    joinedDate: new Date('2024-01-01'),
    status: 'active',
    permissions: ['admin', 'member'],
  },
  {
    id: 'membership-bob',
    userId: 'bob',
    bandId: 'band1',
    role: 'member',
    joinedDate: new Date('2024-01-02'),
    status: 'active',
    permissions: ['member'],
  },
  {
    id: 'membership-charlie',
    userId: 'charlie',
    bandId: 'band1',
    role: 'member',
    joinedDate: new Date('2024-01-03'),
    status: 'active',
    permissions: ['member'],
  },
]

export async function seedDatabase(): Promise<void> {
  try {
    // Check if data already exists
    const songCount = await db.songs.count()
    if (songCount > 0) {
      console.log('Database already seeded, skipping initialization')
      return
    }

    console.log('Seeding database with initial data...')

    // Add all seed data (use put to allow overwriting existing records)
    await db.transaction(
      'rw',
      [
        db.users,
        db.songs,
        db.members,
        db.practiceSessions,
        db.setlists,
        db.bands,
        db.bandMemberships,
      ],
      async () => {
        // Add test users first
        await db.users.bulkPut(initialUsers)
        console.log('Added test users (Alice, Bob, Charlie)')

        await db.bands.bulkPut(initialBands)
        await db.songs.bulkPut(initialSongs)
        await db.members.bulkPut(initialMembers)
        await db.practiceSessions.bulkPut(initialSessions)
        await db.setlists.bulkPut(initialSetlists)

        // Add band memberships to link test users to band1
        await db.bandMemberships.bulkPut(initialBandMemberships)
        console.log('Added band memberships for test users')
      }
    )

    console.log('Database seeded successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

export {
  initialSongs,
  initialMembers,
  initialSessions,
  initialSetlists,
  initialBands,
  initialUsers,
  initialBandMemberships,
}
