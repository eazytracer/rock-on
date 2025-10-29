/**
 * Full Song Catalog for Seeding
 *
 * This file contains the complete song catalog for the band.
 * Used by:
 * - Database seeding (SQL generation)
 * - Tests (mock data)
 * - Development (consistent data across environments)
 */

export interface SeedSong {
  id: string
  title: string
  artist: string
  duration: number // seconds
  key: string
  tempo: number // BPM
  album?: string
  tuning?: string
  notes?: string
}

/**
 * Full song catalog organized by era
 */
export const SEED_SONG_CATALOG: Record<string, SeedSong[]> = {
  '90s_rock': [
    {
      id: '00000000-0000-0000-0000-000000000010',
      title: 'All Star',
      artist: 'Smash Mouth',
      duration: 194,
      key: 'F#',
      tempo: 104,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      title: 'Wonderwall',
      artist: 'Oasis',
      duration: 258,
      key: 'F#m',
      tempo: 87,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      title: 'Man in the Box',
      artist: 'Alice In Chains',
      duration: 287,
      key: 'Ebm',
      tempo: 108,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      title: 'Smells Like Teen Spirit',
      artist: 'Nirvana',
      duration: 301,
      key: 'F',
      tempo: 116,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      title: 'Black',
      artist: 'Pearl Jam',
      duration: 343,
      key: 'E',
      tempo: 107,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000015',
      title: 'Enter Sandman',
      artist: 'Metallica',
      duration: 331,
      key: 'Em',
      tempo: 123,
      tuning: 'Standard'
    }
  ],

  '80s_rock': [
    {
      id: '00000000-0000-0000-0000-000000000020',
      title: 'Sweet Child O\' Mine',
      artist: 'Guns N\' Roses',
      duration: 356,
      key: 'D',
      tempo: 125,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      title: 'Livin\' on a Prayer',
      artist: 'Bon Jovi',
      duration: 249,
      key: 'Em',
      tempo: 123,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      title: 'Jump',
      artist: 'Van Halen',
      duration: 241,
      key: 'C',
      tempo: 130,
      tuning: 'Standard'
    }
  ],

  '70s_rock': [
    {
      id: '00000000-0000-0000-0000-000000000030',
      title: 'Hotel California',
      artist: 'Eagles',
      duration: 390,
      key: 'Bm',
      tempo: 74,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000031',
      title: 'Dream On',
      artist: 'Aerosmith',
      duration: 265,
      key: 'Fm',
      tempo: 84,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000032',
      title: 'Free Bird',
      artist: 'Lynyrd Skynyrd',
      duration: 548,
      key: 'G',
      tempo: 60,
      tuning: 'Standard'
    }
  ],

  '2000s': [
    {
      id: '00000000-0000-0000-0000-000000000040',
      title: 'Mr. Brightside',
      artist: 'The Killers',
      duration: 223,
      key: 'D',
      tempo: 148,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000041',
      title: 'Hey There Delilah',
      artist: 'Plain White T\'s',
      duration: 233,
      key: 'D',
      tempo: 104,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000042',
      title: 'Seven Nation Army',
      artist: 'The White Stripes',
      duration: 231,
      key: 'E',
      tempo: 124,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000043',
      title: 'The Remedy',
      artist: 'Jason Mraz',
      duration: 254,
      key: 'G',
      tempo: 150,
      tuning: 'Standard'
    },
    {
      id: '00000000-0000-0000-0000-000000000044',
      title: 'Ocean Avenue',
      artist: 'Yellowcard',
      duration: 213,
      key: 'C',
      tempo: 190,
      tuning: 'Standard'
    }
  ],

  'modern': [
    {
      id: '00000000-0000-0000-0000-000000000050',
      title: 'Shallow',
      artist: 'Lady Gaga & Bradley Cooper',
      duration: 215,
      key: 'G',
      tempo: 96,
      tuning: 'Standard'
    }
  ],

  'custom': [
    {
      id: 'c2946b79-3ecf-4483-86d4-cb9c08c3e1f6',
      title: 'A song',
      artist: 'Someone',
      duration: 180,
      key: 'G',
      tempo: 120,
      tuning: 'Standard'
    }
  ]
}

/**
 * Get all songs as a flat array
 */
export function getAllSongs(): SeedSong[] {
  return Object.values(SEED_SONG_CATALOG).flat()
}

/**
 * Get songs by era
 */
export function getSongsByEra(era: keyof typeof SEED_SONG_CATALOG): SeedSong[] {
  return SEED_SONG_CATALOG[era] || []
}

/**
 * Get total song count
 */
export function getTotalSongCount(): number {
  return getAllSongs().length
}

/**
 * Generate SQL INSERT statements from song data
 * Useful for creating seed files
 *
 * Note: Only includes columns that exist in the Supabase schema
 * (tuning field stored in notes/metadata if needed)
 */
export function generateSongInsertSQL(
  bandId: string = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  userId: string = '7e75840e-9d91-422e-a949-849f0b8e2ea4'
): string {
  const songs = getAllSongs()

  const values = songs.map(song => {
    // Escape single quotes in strings
    const title = song.title.replace(/'/g, "''")
    const artist = song.artist.replace(/'/g, "''")

    return `    ('${song.id}', '${title}', '${artist}', ${song.duration}, '${song.key}', ${song.tempo}, NOW(), NOW(), '${userId}', 'band', '${bandId}')`
  }).join(',\n')

  return `  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo,
    created_date, updated_date, created_by,
    context_type, context_id
  ) VALUES
${values};`
}

/**
 * Get a subset of songs for minimal seed data (3 songs)
 */
export function getMinimalSongSet(): SeedSong[] {
  return [
    SEED_SONG_CATALOG['90s_rock'][1], // Wonderwall
    SEED_SONG_CATALOG['80s_rock'][0],  // Sweet Child O' Mine
    SEED_SONG_CATALOG['modern'][0]     // Shallow
  ]
}

/**
 * Get a medium set of songs for testing (8 songs)
 */
export function getMediumSongSet(): SeedSong[] {
  return [
    ...SEED_SONG_CATALOG['90s_rock'].slice(0, 3),
    ...SEED_SONG_CATALOG['80s_rock'].slice(0, 2),
    ...SEED_SONG_CATALOG['70s_rock'].slice(0, 2),
    SEED_SONG_CATALOG['modern'][0]
  ]
}
