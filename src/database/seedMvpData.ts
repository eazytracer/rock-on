/**
 * @deprecated DO NOT USE - This file seeds IndexedDB directly and causes data duplication.
 *
 * **PROBLEM:** Creates random UUIDs that don't match Supabase, causing "user bubble" isolation
 * where band members can't see each other's data.
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
import type { SetlistItem } from '../types'

/**
 * @deprecated - See file header for details
 *
 * Seed database with realistic MVP test data
 *
 * Includes:
 * - 3-4 test users with profiles
 * - 1 band ("Demo Band") with memberships
 * - 15-20 songs across different decades/styles
 * - 3-4 setlists with breaks and sections
 * - 3-5 shows with metadata
 * - 4-6 practice sessions
 */
export async function seedMvpData() {
  console.log('🌱 Starting MVP data seed...')

  try {
    // Check if data already exists
    const existingUsers = await db.users.count()
    console.log(`📊 Existing users in database: ${existingUsers}`)

    if (existingUsers > 0) {
      console.log('✅ Database already seeded, skipping...')

      // Log what users exist for debugging
      const users = await db.users.toArray()
      console.log(
        '👥 Existing users:',
        users.map(u => u.email)
      )
      return
    }

    console.log('🚀 Database is empty, starting seeding process...')
  } catch (error) {
    console.error('❌ Error checking database state:', error)
    throw error
  }

  try {
    // ========================================
    // 1. USERS & PROFILES
    // ========================================
    console.log('👥 Seeding users...')

    const ericId = crypto.randomUUID()
    const mikeId = crypto.randomUUID()
    const sarahId = crypto.randomUUID()

    await db.users.bulkAdd([
      {
        id: ericId,
        email: 'eric@testband.demo',
        name: 'Eric Johnson',
        authProvider: 'mock',
        createdDate: new Date('2024-01-15'),
        lastLogin: new Date(),
      },
      {
        id: mikeId,
        email: 'mike@testband.demo',
        name: 'Mike Thompson',
        authProvider: 'mock',
        createdDate: new Date('2024-01-20'),
        lastLogin: new Date(),
      },
      {
        id: sarahId,
        email: 'sarah@testband.demo',
        name: 'Sarah Chen',
        authProvider: 'mock',
        createdDate: new Date('2024-02-01'),
        lastLogin: new Date(),
      },
    ])

    await db.userProfiles.bulkAdd([
      {
        id: crypto.randomUUID(),
        userId: ericId,
        displayName: 'Eric',
        instruments: ['Guitar', 'Vocals'],
        primaryInstrument: 'Guitar',
        createdDate: new Date(),
        updatedDate: new Date(),
      },
      {
        id: crypto.randomUUID(),
        userId: mikeId,
        displayName: 'Mike',
        instruments: ['Bass', 'Harmonica', 'Vocals', 'Guitar'],
        primaryInstrument: 'Bass',
        createdDate: new Date(),
        updatedDate: new Date(),
      },
      {
        id: crypto.randomUUID(),
        userId: sarahId,
        displayName: 'Sarah',
        instruments: ['Drums', 'Percussion'],
        primaryInstrument: 'Drums',
        createdDate: new Date(),
        updatedDate: new Date(),
      },
    ])

    // ========================================
    // 2. BAND & MEMBERSHIPS
    // ========================================
    console.log('🎸 Seeding band...')

    const bandId = crypto.randomUUID()
    await db.bands.add({
      id: bandId,
      name: 'Demo Band',
      description: 'A demo band for testing Rock-On features',
      createdDate: new Date('2024-01-15'),
      memberIds: [ericId, mikeId, sarahId],
      settings: {
        defaultPracticeTime: 120,
        reminderMinutes: [60, 30, 10],
        autoSaveInterval: 30,
      },
    })

    await db.bandMemberships.bulkAdd([
      {
        id: crypto.randomUUID(),
        userId: ericId,
        bandId,
        role: 'admin',
        joinedDate: new Date('2024-01-15'),
        status: 'active',
        permissions: ['owner', 'admin'],
      },
      {
        id: crypto.randomUUID(),
        userId: mikeId,
        bandId,
        role: 'admin',
        joinedDate: new Date('2024-01-20'),
        status: 'active',
        permissions: ['admin'],
      },
      {
        id: crypto.randomUUID(),
        userId: sarahId,
        bandId,
        role: 'member',
        joinedDate: new Date('2024-02-01'),
        status: 'active',
        permissions: ['member'],
      },
    ])

    // Create invite code
    await db.inviteCodes.add({
      id: crypto.randomUUID(),
      bandId,
      code: 'ROCK2025',
      createdBy: ericId,
      createdDate: new Date(),
      currentUses: 2,
      isActive: true,
    })

    // ========================================
    // 3. SONGS (15-20 songs)
    // ========================================
    console.log('🎵 Seeding songs...')

    const songIds: Record<string, string> = {}

    const songs = [
      // 90s Hits
      {
        key: 'allStar',
        title: 'All Star',
        artist: 'Smash Mouth',
        album: 'Astro Lounge',
        duration: 194,
        keyNote: 'F#',
        bpm: 104,
        tuning: 'Standard',
        tags: ['Rock', 'Cover', '90s'],
      },
      {
        key: 'wonderwall',
        title: 'Wonderwall',
        artist: 'Oasis',
        album: "(What's the Story) Morning Glory?",
        duration: 258,
        keyNote: 'F#m',
        bpm: 87,
        tuning: 'Standard',
        tags: ['Rock', 'Cover', '90s'],
      },
      {
        key: 'manInBox',
        title: 'Man in the Box',
        artist: 'Alice In Chains',
        album: 'Facelift',
        duration: 287,
        keyNote: 'Ebm',
        bpm: 108,
        tuning: 'Half-step down',
        tags: ['Grunge', 'Cover', '90s'],
      },
      {
        key: 'smellsLike',
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        album: 'Nevermind',
        duration: 301,
        keyNote: 'F',
        bpm: 116,
        tuning: 'Standard',
        tags: ['Grunge', 'Rock', '90s'],
      },
      {
        key: 'creep',
        title: 'Creep',
        artist: 'Radiohead',
        album: 'Pablo Honey',
        duration: 238,
        keyNote: 'G',
        bpm: 92,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'justAGirl',
        title: 'Just A Girl',
        artist: 'No Doubt',
        album: 'Tragic Kingdom',
        duration: 210,
        keyNote: 'D',
        bpm: 108,
        tuning: 'Standard',
        tags: ['Ska', 'Rock', '90s'],
      },
      {
        key: 'losingMyReligion',
        title: 'Losing my Religion',
        artist: 'R.E.M.',
        album: 'Out of Time',
        duration: 269,
        keyNote: 'Am',
        bpm: 125,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'zombie',
        title: 'Zombie',
        artist: 'The Cranberries',
        album: 'No Need to Argue',
        duration: 306,
        keyNote: 'Em',
        bpm: 84,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'noRain',
        title: 'No Rain',
        artist: 'Blind Melon',
        album: 'Blind Melon',
        duration: 217,
        keyNote: 'A',
        bpm: 148,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'plush',
        title: 'Plush',
        artist: 'Stone Temple Pilots',
        album: 'Core',
        duration: 310,
        keyNote: 'Gm',
        bpm: 73,
        tuning: 'Standard',
        tags: ['Grunge', 'Rock', '90s'],
      },
      {
        key: 'cumbersome',
        title: 'Cumbersome',
        artist: 'Seven Mary Three',
        album: 'American Standard',
        duration: 362,
        keyNote: 'B',
        bpm: 87,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'buddyHolly',
        title: 'Buddy Holly',
        artist: 'Weezer',
        album: 'Weezer (Blue Album)',
        duration: 160,
        keyNote: 'Ab',
        bpm: 121,
        tuning: 'Half-step down',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'everythingZen',
        title: 'Everything Zen',
        artist: 'Bush',
        album: 'Sixteen Stone',
        duration: 278,
        keyNote: 'Em',
        bpm: 134,
        tuning: 'Standard',
        tags: ['Grunge', 'Alternative', '90s'],
      },
      {
        key: 'lump',
        title: 'Lump',
        artist: 'The Presidents of the United States of America',
        album: 'The Presidents of the United States of America',
        duration: 134,
        keyNote: 'F#',
        bpm: 142,
        tuning: 'Drop C#',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'lightningCrashes',
        title: 'Lightning Crashes',
        artist: 'Live',
        album: 'Throwing Copper',
        duration: 326,
        keyNote: 'B',
        bpm: 90,
        tuning: 'Half-step down',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'shine',
        title: 'Shine',
        artist: 'Collective Soul',
        album: 'Hints Allegations and Things Left Unsaid',
        duration: 306,
        keyNote: 'F#',
        bpm: 150,
        tuning: 'Drop C#',
        tags: ['Alternative', 'Rock', '90s'],
      },

      // 80s Classics
      {
        key: 'sweet Child',
        title: "Sweet Child O' Mine",
        artist: "Guns N' Roses",
        album: 'Appetite for Destruction',
        duration: 356,
        keyNote: 'Db',
        bpm: 122,
        tuning: 'Eb tuning',
        tags: ['Rock', 'Cover', '80s'],
      },
      {
        key: 'livin',
        title: "Livin' on a Prayer",
        artist: 'Bon Jovi',
        album: 'Slippery When Wet',
        duration: 249,
        keyNote: 'Em',
        bpm: 123,
        tuning: 'Standard',
        tags: ['Rock', '80s'],
      },
      {
        key: 'jump',
        title: 'Jump',
        artist: 'Van Halen',
        album: '1984',
        duration: 241,
        keyNote: 'C',
        bpm: 130,
        tuning: 'Standard',
        tags: ['Rock', '80s'],
      },
      {
        key: 'kickstartMyHeart',
        title: 'Kickstart My Heart',
        artist: 'Mötley Crüe',
        album: 'Dr. Feelgood',
        duration: 284,
        keyNote: 'Gm',
        bpm: 179,
        tuning: 'Drop D',
        tags: ['Metal', 'Rock', '80s'],
      },

      // 70s Legends
      {
        key: 'hotel',
        title: 'Hotel California',
        artist: 'Eagles',
        album: 'Hotel California',
        duration: 390,
        keyNote: 'Bm',
        bpm: 74,
        tuning: 'Standard',
        tags: ['Classic Rock', 'Cover', '70s'],
      },
      {
        key: 'dream On',
        title: 'Dream On',
        artist: 'Aerosmith',
        album: 'Aerosmith',
        duration: 265,
        keyNote: 'Fm',
        bpm: 84,
        tuning: 'Standard',
        tags: ['Rock', '70s'],
      },
      {
        key: 'free Bird',
        title: 'Free Bird',
        artist: 'Lynyrd Skynyrd',
        album: "(Pronounced 'Lĕh-'nérd 'Skin-'nérd)",
        duration: 548,
        keyNote: 'G',
        bpm: 60,
        tuning: 'Standard',
        tags: ['Southern Rock', '70s'],
      },
      {
        key: 'laGrange',
        title: 'La Grange',
        artist: 'ZZ Top',
        album: 'Tres Hombres',
        duration: 271,
        keyNote: 'Am',
        bpm: 162,
        tuning: 'Standard',
        tags: ['Blues Rock', '70s'],
      },
      {
        key: 'heartacheTonight',
        title: 'Heartache Tonight',
        artist: 'Eagles',
        album: 'The Long Run',
        duration: 266,
        keyNote: 'G',
        bpm: 113,
        tuning: 'Standard',
        tags: ['Rock', '70s'],
      },
      {
        key: 'whiteRabbit',
        title: 'White Rabbit',
        artist: 'Jefferson Airplane',
        album: 'Surrealistic Pillow',
        duration: 153,
        keyNote: 'F#m',
        bpm: 105,
        tuning: 'Standard',
        tags: ['Psychedelic Rock', '60s'],
      },
      {
        key: 'maryJanesLastDance',
        title: "Mary Jane's Last Dance",
        artist: 'Tom Petty and the Heartbreakers',
        album: 'Greatest Hits',
        duration: 272,
        keyNote: 'Gm',
        bpm: 170,
        tuning: 'Standard',
        tags: ['Rock', '90s'],
      },

      // 2000s Hits
      {
        key: 'mr Bright',
        title: 'Mr. Brightside',
        artist: 'The Killers',
        album: 'Hot Fuss',
        duration: 223,
        keyNote: 'D',
        bpm: 148,
        tuning: 'Standard',
        tags: ['Indie Rock', '2000s'],
      },
      {
        key: 'hey There',
        title: 'Hey There Delilah',
        artist: "Plain White T's",
        album: 'All That We Needed',
        duration: 233,
        keyNote: 'D',
        bpm: 104,
        tuning: 'Standard',
        tags: ['Acoustic', '2000s'],
      },
      {
        key: 'seven Nation',
        title: 'Seven Nation Army',
        artist: 'The White Stripes',
        album: 'Elephant',
        duration: 231,
        keyNote: 'E',
        bpm: 124,
        tuning: 'Standard',
        tags: ['Rock', '2000s'],
      },
      {
        key: 'whenIcomeAround',
        title: 'When I Come Around',
        artist: 'Green Day',
        album: 'Dookie',
        duration: 178,
        keyNote: 'B',
        bpm: 98,
        tuning: 'Half-step down',
        tags: ['Punk', 'Rock', '90s'],
      },
      {
        key: 'kryptonite',
        title: 'Kryptonite',
        artist: '3 Doors Down',
        album: 'The Better Life',
        duration: 233,
        keyNote: 'Bm',
        bpm: 100,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '2000s'],
      },
      {
        key: 'burnItToTheGround',
        title: 'Burn It to the Ground',
        artist: 'Nickelback',
        album: 'Dark Horse',
        duration: 212,
        keyNote: 'B',
        bpm: 132,
        tuning: 'Drop B',
        tags: ['Rock', '2000s'],
      },
      {
        key: 'danceDance',
        title: 'Dance, Dance',
        artist: 'Fall Out Boy',
        album: 'From Under the Cork Tree',
        duration: 181,
        keyNote: 'Bm',
        bpm: 114,
        tuning: 'Drop D',
        tags: ['Pop Punk', '2000s'],
      },
      {
        key: 'broken',
        title: 'Broken',
        artist: 'Seether',
        album: 'Disclaimer II',
        duration: 259,
        keyNote: 'Ebm',
        bpm: 124,
        tuning: 'Half-step down',
        tags: ['Alternative', 'Rock', '2000s'],
      },
      {
        key: 'harderToBreathe',
        title: 'Harder to Breathe',
        artist: 'Maroon 5',
        album: 'Songs About Jane',
        duration: 174,
        keyNote: 'C#m',
        bpm: 150,
        tuning: 'Standard',
        tags: ['Pop Rock', '2000s'],
      },
      {
        key: 'shortSkirt',
        title: 'Short Skirt/Long Jacket',
        artist: 'Cake',
        album: 'Comfort Eagle',
        duration: 197,
        keyNote: 'D',
        bpm: 120,
        tuning: 'Standard',
        tags: ['Alternative', 'Rock', '2000s'],
      },
      {
        key: 'whenYouWereYoung',
        title: 'When You Were Young',
        artist: 'The Killers',
        album: "Sam's Town",
        duration: 220,
        keyNote: 'B',
        bpm: 130,
        tuning: 'Half-step down',
        tags: ['Rock', '2000s'],
      },
      {
        key: 'takeAPicture',
        title: 'Take A Picture',
        artist: 'Filter',
        album: 'Title of Record',
        duration: 263,
        keyNote: 'D',
        bpm: 99,
        tuning: 'Drop D',
        tags: ['Alternative', 'Rock', '90s'],
      },
      {
        key: 'monkeyWrench',
        title: 'Monkey Wrench',
        artist: 'Foo Fighters',
        album: 'The Colour and the Shape',
        duration: 231,
        keyNote: 'B',
        bpm: 174,
        tuning: 'Drop D',
        tags: ['Rock', '90s'],
      },

      // More variety
      {
        key: 'black',
        title: 'Black',
        artist: 'Pearl Jam',
        album: 'Ten',
        duration: 343,
        keyNote: 'E',
        bpm: 107,
        tuning: 'Standard',
        tags: ['Grunge', '90s'],
      },
      {
        key: 'enter Sandman',
        title: 'Enter Sandman',
        artist: 'Metallica',
        album: 'Metallica',
        duration: 331,
        keyNote: 'Em',
        bpm: 123,
        tuning: 'Eb tuning',
        tags: ['Metal', '90s'],
      },
      {
        key: 'sadButTrue',
        title: 'Sad But True',
        artist: 'Metallica',
        album: 'Metallica',
        duration: 325,
        keyNote: 'G',
        bpm: 89,
        tuning: 'Drop D',
        tags: ['Metal', '90s'],
      },
      {
        key: 'remedy',
        title: 'The Remedy',
        artist: 'Jason Mraz',
        album: 'Waiting for My Rocket to Come',
        duration: 254,
        keyNote: 'G',
        bpm: 150,
        tuning: 'Standard',
        tags: ['Pop', '2000s'],
      },
      {
        key: 'yellowCard',
        title: 'Ocean Avenue',
        artist: 'Yellowcard',
        album: 'Ocean Avenue',
        duration: 213,
        keyNote: 'C',
        bpm: 190,
        tuning: 'Standard',
        tags: ['Pop Punk', '2000s'],
      },
    ]

    for (const song of songs) {
      const songId = crypto.randomUUID()
      songIds[song.key] = songId

      await db.songs.add({
        id: songId,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        key: song.keyNote,
        bpm: song.bpm,
        difficulty: 3,
        guitarTuning: song.tuning,
        tags: song.tags,
        contextType: 'band',
        contextId: bandId,
        createdBy: ericId,
        visibility: 'band',
        createdDate: new Date(),
        confidenceLevel: 3,
        structure: [],
        chords: [],
        referenceLinks: [
          {
            icon: 'youtube',
            url: `https://youtube.com/watch/${song.key}`,
            description: 'Tutorial',
          },
          {
            icon: 'spotify',
            url: `https://spotify.com/track/${song.key}`,
            description: 'Original',
          },
        ],
        notes:
          song.key === 'allStar'
            ? 'Fun crowd pleaser. Start with palm muted power chords.'
            : song.key === 'hotel'
              ? "Don't rush the intro. Let it breathe."
              : song.key === 'manInBox'
                ? 'Heavy riff. Watch the wah-wah pedal timing.'
                : undefined,
      })
    }

    // ========================================
    // 4. SHOWS (3 upcoming, 2 past)
    // ========================================
    console.log('🎤 Seeding shows...')

    const showIds: Record<string, string> = {}

    // Upcoming show 1
    showIds.toys4Tots = crypto.randomUUID()
    await db.shows.add({
      id: showIds.toys4Tots,
      bandId,
      name: 'Toys 4 Tots Benefit Concert',
      venue: 'The Crocodile',
      scheduledDate: new Date('2025-12-08T20:00:00'),
      duration: 90,
      location: '2505 1st Ave, Seattle, WA 98121',
      status: 'scheduled',
      notes: 'Charity event. Bring extension cords. Sound check at 7 PM.',
      loadInTime: '6:00 PM',
      soundcheckTime: '7:00 PM',
      payment: 50000, // $500 in cents
      contacts: [
        {
          id: crypto.randomUUID(),
          name: 'John Smith',
          role: 'Promoter',
          phone: '555-1234',
          email: 'john@toys4tots.org',
        },
      ],
      createdDate: new Date('2024-11-01'),
      updatedDate: new Date('2024-11-15'),
    })

    // Upcoming show 2
    showIds.newYears = crypto.randomUUID()
    await db.shows.add({
      id: showIds.newYears,
      bandId,
      name: "New Year's Eve Party",
      venue: 'The Showbox',
      scheduledDate: new Date('2025-12-31T22:00:00'),
      duration: 120,
      location: '1426 1st Ave, Seattle, WA 98101',
      status: 'scheduled',
      notes: 'Two sets. Midnight countdown. Confetti cannons.',
      loadInTime: '8:00 PM',
      soundcheckTime: '9:00 PM',
      payment: 120000, // $1200
      contacts: [
        {
          id: crypto.randomUUID(),
          name: 'Sarah Johnson',
          role: 'Venue Manager',
          phone: '555-5678',
        },
      ],
      createdDate: new Date('2024-11-10'),
      updatedDate: new Date('2024-11-20'),
    })

    // Upcoming show 3
    showIds.summerFest = crypto.randomUUID()
    await db.shows.add({
      id: showIds.summerFest,
      bandId,
      name: 'Summer Music Festival',
      venue: 'Woodland Park',
      scheduledDate: new Date('2025-11-30T17:00:00'),
      duration: 60,
      location: 'Woodland Park, Seattle, WA',
      status: 'scheduled',
      notes: 'Outdoor festival. Bring sun hats. Generator power only.',
      loadInTime: '3:00 PM',
      soundcheckTime: '4:00 PM',
      payment: 75000, // $750
      contacts: [
        {
          id: crypto.randomUUID(),
          name: 'Mike Davis',
          role: 'Festival Coordinator',
          phone: '555-9012',
        },
      ],
      createdDate: new Date('2024-11-05'),
      updatedDate: new Date('2024-11-18'),
    })

    // Past show 1
    await db.shows.add({
      id: crypto.randomUUID(),
      bandId,
      name: 'Halloween Bash',
      venue: 'Neumos',
      scheduledDate: new Date('2024-10-31T21:00:00'),
      duration: 90,
      location: '925 E Pike St, Seattle, WA 98122',
      status: 'completed',
      notes: 'Great turnout! Costumes were a hit.',
      loadInTime: '7:00 PM',
      soundcheckTime: '8:00 PM',
      payment: 60000, // $600
      contacts: [
        {
          id: crypto.randomUUID(),
          name: 'Emily Brown',
          role: 'Venue Manager',
          phone: '555-3456',
        },
      ],
      createdDate: new Date('2024-10-01'),
      updatedDate: new Date('2024-10-15'),
    })

    // Past show 2
    await db.shows.add({
      id: crypto.randomUUID(),
      bandId,
      name: 'Spring Fling',
      venue: 'The Tractor Tavern',
      scheduledDate: new Date('2024-04-20T20:00:00'),
      duration: 75,
      location: '5213 Ballard Ave NW, Seattle, WA 98107',
      status: 'completed',
      notes: 'Solid performance. Good crowd energy.',
      loadInTime: '6:30 PM',
      soundcheckTime: '7:30 PM',
      payment: 45000, // $450
      createdDate: new Date('2024-03-15'),
      updatedDate: new Date('2024-04-01'),
    })

    // ========================================
    // 5. SETLISTS (3-4 setlists with breaks/sections)
    // ========================================
    console.log('📝 Seeding setlists...')

    const setlistIds: Record<string, string> = {}

    // Setlist 1: Toys 4 Tots (for upcoming show)
    setlistIds.toys4Tots = crypto.randomUUID()
    const toys4TotsItems: SetlistItem[] = [
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 1,
        songId: songIds.allStar,
        notes: 'Energy opener!',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 2,
        songId: songIds['mr Bright'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 3,
        songId: songIds.livin,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 4,
        songId: songIds['seven Nation'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 5,
        songId: songIds.jump,
      },
      {
        id: crypto.randomUUID(),
        type: 'break',
        position: 6,
        breakDuration: 15,
        breakNotes: 'Quick break - stay hydrated',
      },
      {
        id: crypto.randomUUID(),
        type: 'section',
        position: 7,
        sectionTitle: 'Acoustic Set',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 8,
        songId: songIds.wonderwall,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 9,
        songId: songIds['hey There'],
      },
      {
        id: crypto.randomUUID(),
        type: 'section',
        position: 10,
        sectionTitle: 'Rock Out',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 11,
        songId: songIds.manInBox,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 12,
        songId: songIds['sweet Child'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 13,
        songId: songIds.smellsLike,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 14,
        songId: songIds['enter Sandman'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 15,
        songId: songIds.hotel,
        notes: 'Extended solo for finale',
      },
    ]

    await db.setlists.add({
      id: setlistIds.toys4Tots,
      name: 'Toys 4 Tots Benefit Set',
      bandId,
      showId: showIds.toys4Tots,
      items: toys4TotsItems,
      totalDuration: 3600, // Calculate from songs + breaks
      status: 'active',
      notes: 'Keep energy high. Audience will be families.',
      createdDate: new Date('2024-11-01'),
      lastModified: new Date('2024-11-15'),
    })

    // Setlist 2: New Year's Eve (2 sets with break)
    setlistIds.newYears = crypto.randomUUID()
    const newYearsItems: SetlistItem[] = [
      {
        id: crypto.randomUUID(),
        type: 'section',
        position: 1,
        sectionTitle: 'Set 1 - Party Starters',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 2,
        songId: songIds['mr Bright'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 3,
        songId: songIds.allStar,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 4,
        songId: songIds.jump,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 5,
        songId: songIds.livin,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 6,
        songId: songIds['seven Nation'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 7,
        songId: songIds.yellowCard,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 8,
        songId: songIds.remedy,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 9,
        songId: songIds.smellsLike,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 10,
        songId: songIds.black,
      },
      {
        id: crypto.randomUUID(),
        type: 'break',
        position: 11,
        breakDuration: 30,
        breakNotes: 'Costume change + refreshments',
      },
      {
        id: crypto.randomUUID(),
        type: 'section',
        position: 12,
        sectionTitle: 'Set 2 - Countdown to Midnight',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 13,
        songId: songIds['sweet Child'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 14,
        songId: songIds['dream On'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 15,
        songId: songIds['enter Sandman'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 16,
        songId: songIds.manInBox,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 17,
        songId: songIds.wonderwall,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 18,
        songId: songIds['hey There'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 19,
        songId: songIds.hotel,
        notes: 'Time for midnight countdown after this',
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 20,
        songId: songIds['free Bird'],
        notes: 'Encore - extended jam',
      },
    ]

    await db.setlists.add({
      id: setlistIds.newYears,
      name: "New Year's Eve Party - Full Show",
      bandId,
      showId: showIds.newYears,
      items: newYearsItems,
      totalDuration: 5400,
      status: 'active',
      notes: 'Two sets with costume change. Midnight countdown between songs.',
      createdDate: new Date('2024-11-10'),
      lastModified: new Date('2024-11-20'),
    })

    // Setlist 3: Summer Festival (shorter set)
    setlistIds.summerFest = crypto.randomUUID()
    const summerFestItems: SetlistItem[] = [
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 1,
        songId: songIds['mr Bright'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 2,
        songId: songIds.allStar,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 3,
        songId: songIds.remedy,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 4,
        songId: songIds['seven Nation'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 5,
        songId: songIds.wonderwall,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 6,
        songId: songIds.jump,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 7,
        songId: songIds.livin,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 8,
        songId: songIds.smellsLike,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 9,
        songId: songIds['sweet Child'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 10,
        songId: songIds['hey There'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 11,
        songId: songIds['enter Sandman'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 12,
        songId: songIds.hotel,
      },
    ]

    await db.setlists.add({
      id: setlistIds.summerFest,
      name: 'Summer Festival - 60min Set',
      bandId,
      showId: showIds.summerFest,
      items: summerFestItems,
      totalDuration: 3000,
      status: 'active',
      notes: 'Outdoor stage. Keep songs upbeat and energetic.',
      createdDate: new Date('2024-11-05'),
      lastModified: new Date('2024-11-18'),
    })

    // Setlist 4: Practice setlist (draft)
    const practiceItems: SetlistItem[] = [
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 1,
        songId: songIds.black,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 2,
        songId: songIds.yellowCard,
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 3,
        songId: songIds['free Bird'],
      },
      {
        id: crypto.randomUUID(),
        type: 'song',
        position: 4,
        songId: songIds['dream On'],
      },
    ]

    await db.setlists.add({
      id: crypto.randomUUID(),
      name: 'New Songs to Learn',
      bandId,
      items: practiceItems,
      totalDuration: 1200,
      status: 'draft',
      notes: 'Songs we want to add to rotation',
      createdDate: new Date('2024-11-22'),
      lastModified: new Date('2024-11-22'),
    })

    // ========================================
    // 6. PRACTICES (2 upcoming, 3 past)
    // ========================================
    console.log('🥁 Seeding practice sessions...')

    // Upcoming practice 1 - Prep for Toys 4 Tots
    await db.practiceSessions.add({
      id: crypto.randomUUID(),
      bandId,
      scheduledDate: new Date('2025-11-24T19:00:00'),
      duration: 120,
      location: "Mike's Garage",
      type: 'rehearsal',
      status: 'scheduled',
      songs: [
        {
          songId: songIds.allStar,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.wonderwall,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.manInBox,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.hotel,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds['enter Sandman'],
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
      ],
      attendees: [],
      notes: 'Focus on transitions. Run through full Toys 4 Tots set.',
      objectives: [
        'Tighten transitions between songs',
        'Nail the Hotel California solo',
      ],
      completedObjectives: [],
      createdDate: new Date('2024-11-15'),
    })

    // Upcoming practice 2 - General rehearsal
    await db.practiceSessions.add({
      id: crypto.randomUUID(),
      bandId,
      scheduledDate: new Date('2025-12-01T19:00:00'),
      duration: 90,
      location: "Eric's Studio",
      type: 'rehearsal',
      status: 'scheduled',
      songs: [
        {
          songId: songIds.black,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds['free Bird'],
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.yellowCard,
          timeSpent: 0,
          status: 'not-started',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
      ],
      attendees: [],
      notes: 'Work on new songs',
      objectives: ['Learn Black verse progression', 'Practice Free Bird jam'],
      completedObjectives: [],
      createdDate: new Date('2024-11-22'),
    })

    // Past practice 1
    await db.practiceSessions.add({
      id: crypto.randomUUID(),
      bandId,
      scheduledDate: new Date('2024-11-17T19:00:00'),
      duration: 120,
      location: "Mike's Garage",
      type: 'rehearsal',
      status: 'completed',
      songs: [
        {
          songId: songIds['mr Bright'],
          timeSpent: 20,
          status: 'completed',
          sectionsWorked: ['intro', 'chorus'],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.smellsLike,
          timeSpent: 25,
          status: 'completed',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds['sweet Child'],
          timeSpent: 30,
          status: 'completed',
          sectionsWorked: [],
          improvements: [],
          needsWork: ['solo timing'],
          memberRatings: [],
        },
      ],
      attendees: [],
      notes: 'Great energy today. Sweet Child solo needs more practice.',
      objectives: ['Run through show openers', 'Tighten up timing'],
      completedObjectives: ['Run through show openers'],
      createdDate: new Date('2024-11-10'),
    })

    // Past practice 2
    await db.practiceSessions.add({
      id: crypto.randomUUID(),
      bandId,
      scheduledDate: new Date('2024-11-10T19:00:00'),
      duration: 90,
      location: "Eric's Studio",
      type: 'rehearsal',
      status: 'completed',
      songs: [
        {
          songId: songIds.wonderwall,
          timeSpent: 25,
          status: 'completed',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds['hey There'],
          timeSpent: 20,
          status: 'completed',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds.jump,
          timeSpent: 15,
          status: 'completed',
          sectionsWorked: [],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
      ],
      attendees: [],
      notes: 'Focused on acoustic songs. Sounding good!',
      objectives: ['Perfect acoustic songs'],
      completedObjectives: ['Perfect acoustic songs'],
      createdDate: new Date('2024-11-03'),
    })

    // Past practice 3
    await db.practiceSessions.add({
      id: crypto.randomUUID(),
      bandId,
      scheduledDate: new Date('2024-11-03T19:00:00'),
      duration: 120,
      location: "Mike's Garage",
      type: 'rehearsal',
      status: 'completed',
      songs: [
        {
          songId: songIds.hotel,
          timeSpent: 40,
          status: 'completed',
          sectionsWorked: ['intro', 'solo'],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
        {
          songId: songIds['free Bird'],
          timeSpent: 35,
          status: 'completed',
          sectionsWorked: ['solo'],
          improvements: [],
          needsWork: [],
          memberRatings: [],
        },
      ],
      attendees: [],
      notes: 'Epic jam session. Long songs day.',
      objectives: ['Master Hotel California', 'Nail Free Bird solo'],
      completedObjectives: ['Master Hotel California'],
      createdDate: new Date('2024-10-28'),
    })

    console.log('✅ MVP data seed complete!')
    console.log('📊 Database summary:')
    console.log(`   - Users: ${await db.users.count()}`)
    console.log(`   - Bands: ${await db.bands.count()}`)
    console.log(`   - Songs: ${await db.songs.count()}`)
    console.log(`   - Setlists: ${await db.setlists.count()}`)
    console.log(`   - Shows: ${await db.shows.count()}`)
    console.log(`   - Practices: ${await db.practiceSessions.count()}`)
  } catch (error) {
    console.error('❌ Error seeding MVP data:', error)
    throw error
  }
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  console.log('💡 Call seedMvpData() to populate database with test data')
  console.log('💡 Or add to your app initialization')
}
