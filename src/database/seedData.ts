import { db } from './db'
import { Song } from '../models/Song'
import { Member } from '../models/Member'
import { PracticeSession } from '../models/PracticeSession'
import { Setlist } from '../models/Setlist'

// Initial seed data for the application
const initialSongs: Song[] = [
  {
    id: '1',
    title: 'Wonderwall',
    artist: 'Oasis',
    album: '(What\'s the Story) Morning Glory?',
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
    confidenceLevel: 4.2
  },
  {
    id: '2',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
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
    confidenceLevel: 2.8
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
    confidenceLevel: 3.5
  }
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
    isActive: true
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@rockband.com',
    instruments: ['bass'],
    primaryInstrument: 'bass',
    role: 'member',
    joinDate: new Date('2024-01-05'),
    isActive: true
  }
]

const initialSessions: PracticeSession[] = [
  {
    id: '1',
    bandId: 'band1',
    scheduledDate: new Date('2024-09-30T19:00:00'),
    duration: 120,
    location: 'Mike\'s Garage',
    type: 'rehearsal',
    status: 'scheduled',
    songs: [
      { songId: '1', timeSpent: 0, status: 'not-started', sectionsWorked: [], improvements: [], needsWork: [], memberRatings: [] },
      { songId: '2', timeSpent: 0, status: 'not-started', sectionsWorked: [], improvements: [], needsWork: [], memberRatings: [] }
    ],
    attendees: [
      { memberId: '1', confirmed: true, attended: false },
      { memberId: '2', confirmed: true, attended: false }
    ],
    notes: 'Focus on transitions between songs',
    objectives: ['Work on song transitions', 'Practice harmonies'],
    completedObjectives: []
  }
]

const initialSetlists: Setlist[] = [
  {
    id: '1',
    name: 'Coffee Shop Gig',
    bandId: 'band1',
    showDate: new Date('2024-10-15T20:00:00'),
    venue: 'Downtown Coffee',
    songs: [
      { songId: '1', order: 1 },
      { songId: '3', order: 2 },
      { songId: '2', order: 3 }
    ],
    totalDuration: 1005,
    notes: 'Acoustic setup, intimate venue',
    status: 'draft',
    createdDate: new Date('2024-09-25'),
    lastModified: new Date('2024-09-26')
  }
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

    // Add all seed data
    await db.transaction('rw', db.songs, db.members, db.practiceSessions, db.setlists, async () => {
      await db.songs.bulkAdd(initialSongs)
      await db.members.bulkAdd(initialMembers)
      await db.practiceSessions.bulkAdd(initialSessions)
      await db.setlists.bulkAdd(initialSetlists)
    })

    console.log('Database seeded successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

export { initialSongs, initialMembers, initialSessions, initialSetlists }