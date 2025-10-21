# Data Model: Rock On! Platform

## Entity Definitions

### Band
Represents a musical group with members and shared resources.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `name`: string - Band name
- `description`: string? - Optional band description
- `createdDate`: Date - When band was created
- `settings`: BandSettings - Band-specific preferences
- `memberIds`: string[] - Array of member IDs

**Validation Rules:**
- Band name must be 1-100 characters
- Description limited to 500 characters
- Must have at least 1 member
- Band names must be unique per creator

**State Transitions:**
- Created → Active (when first member joins)
- Active → Inactive (when all members leave)
- Inactive → Active (when member rejoins)

### Member
Individual users within a band with roles and capabilities.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `name`: string - Member's display name
- `email`: string - Contact email
- `phone`: string? - Optional phone number
- `instruments`: string[] - List of instruments played
- `primaryInstrument`: string - Main instrument
- `role`: MemberRole - Admin, Member, or Viewer
- `joinDate`: Date - When they joined the band
- `isActive`: boolean - Current membership status

**Relationships:**
- Belongs to one or more Bands
- Can be assigned to Songs in Sessions
- Creates and participates in PracticeSessions

**Validation Rules:**
- Name must be 1-50 characters
- Email must be valid format
- Must have at least one instrument
- Primary instrument must be in instruments list

### Song
Musical pieces in the band's repertoire with metadata and practice tracking.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `title`: string - Song title
- `artist`: string - Original artist/composer
- `album`: string? - Album name (optional)
- `duration`: number - Length in seconds
- `key`: string - Musical key (e.g., "C", "Am", "F#")
- `bpm`: number - Beats per minute
- `difficulty`: 1 | 2 | 3 | 4 | 5 - Difficulty rating
- `guitarTuning`: string? - Guitar tuning (e.g., "Standard", "Drop D", "DADGAD") - Used for quick setlist visualization to minimize mid-show tuning changes
- `structure`: SongSection[] - Song structure (verse, chorus, etc.)
- `lyrics`: string? - Song lyrics (optional)
- `chords`: string[] - Chord progression
- `notes`: string? - Band-specific notes
- `referenceLinks`: ReferenceLink[] - External resources
- `tags`: string[] - Custom categorization tags
- `createdDate`: Date - When added to catalog
- `lastPracticed`: Date? - Most recent practice date
- `confidenceLevel`: number - Average member confidence (1-5)

**Relationships:**
- Belongs to Band
- Referenced in PracticeSessions
- Included in Setlists
- Has ConfidenceRatings from Members

**Validation Rules:**
- Title must be 1-100 characters
- Artist must be 1-100 characters
- Duration must be positive number
- BPM must be 40-300 range
- Key must be valid musical key
- Difficulty must be 1-5

**State Transitions:**
- New → Learning (first practice)
- Learning → Rehearsed (confidence > 3)
- Rehearsed → Performance Ready (confidence > 4)

### PracticeSession
Scheduled or completed practice sessions with attendance and notes.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `bandId`: string - Associated band
- `scheduledDate`: Date - When session is/was scheduled
- `startTime`: Date? - Actual start time
- `endTime`: Date? - Actual end time
- `duration`: number? - Planned duration in minutes
- `location`: string? - Practice location
- `type`: SessionType - Rehearsal, Writing, Recording, etc.
- `songs`: SessionSong[] - Songs practiced with details
- `attendees`: SessionAttendee[] - Member attendance
- `notes`: string? - General session notes
- `objectives`: string[] - Session goals
- `completedObjectives`: string[] - Achieved goals
- `sessionRating`: number? - Overall session rating (1-5)

**Relationships:**
- Belongs to Band
- Has multiple SessionSongs
- Has multiple SessionAttendees (Members)

**Validation Rules:**
- Must have scheduled date
- Duration must be positive if specified
- Session rating must be 1-5 if provided
- Must have at least one attendee

**State Transitions:**
- Scheduled → In Progress (when started)
- In Progress → Completed (when ended)
- Scheduled → Cancelled (if not held)

### SessionSong
Individual song practice within a session with specific tracking.

**Fields:**
- `songId`: string - Reference to Song
- `timeSpent`: number - Minutes spent on this song
- `status`: SongStatus - Not Started, In Progress, Completed, Skipped
- `notes`: string? - Song-specific practice notes
- `sectionsWorked`: string[] - Parts of song practiced
- `improvements`: string[] - Areas that improved
- `needsWork`: string[] - Areas needing more practice
- `memberRatings`: MemberRating[] - Individual member assessments

**Validation Rules:**
- Time spent must be non-negative
- Status must be valid enum value
- Notes limited to 1000 characters

### Setlist
Ordered collection of songs for performances.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `name`: string - Setlist name
- `bandId`: string - Associated band
- `showDate`: Date? - Performance date (if scheduled)
- `venue`: string? - Performance venue
- `songs`: SetlistSong[] - Ordered song list
- `totalDuration`: number - Calculated total time
- `notes`: string? - Performance notes
- `status`: SetlistStatus - Draft, Rehearsed, Performed
- `createdDate`: Date - When setlist was created
- `lastModified`: Date - Last update timestamp

**Relationships:**
- Belongs to Band
- Contains multiple Songs (via SetlistSong)
- May be associated with Show

**Validation Rules:**
- Name must be 1-100 characters
- Must contain at least 1 song
- Total duration calculated from song durations
- Notes limited to 1000 characters

### SetlistSong
Song within a setlist with ordering and performance details.

**Fields:**
- `songId`: string - Reference to Song
- `order`: number - Position in setlist (1-based)
- `transitionNotes`: string? - Notes for transition to next song
- `keyChange`: string? - Key change for this performance
- `tempoChange`: number? - Tempo modification
- `specialInstructions`: string? - Performance-specific notes

**Future Enhancement - Instrument Casting:**
In future versions, SetlistSong will support per-song instrument assignments with custom tunings:
- `instrumentAssignments`: InstrumentAssignment[]? - Member-to-instrument mappings for this performance
  - Each assignment would include: `memberId`, `instrument`, `tuning`
  - Allows different members to play instruments in different tunings for different songs
  - Primary use case: Visualizing tuning changes across setlist to minimize mid-show tuning adjustments

**Validation Rules:**
- Order must be positive integer
- Key change must be valid musical key if specified
- Tempo change must be reasonable percentage if specified

### Show
Performance events with logistical and business details.

**Fields:**
- `id`: string (UUID) - Unique identifier
- `bandId`: string - Associated band
- `name`: string - Show/event name
- `venue`: string - Performance venue
- `date`: Date - Performance date
- `loadInTime`: Date? - Equipment load-in time
- `soundCheckTime`: Date? - Sound check time
- `startTime`: Date - Performance start time
- `endTime`: Date? - Expected/actual end time
- `setlistIds`: string[] - Associated setlists
- `contacts`: Contact[] - Venue/promoter contacts
- `paymentInfo`: PaymentInfo? - Financial details
- `attendanceExpected`: number? - Expected audience size
- `attendanceActual`: number? - Actual attendance
- `performanceNotes`: string? - Post-show notes
- `rating`: number? - Show quality rating (1-5)

**Validation Rules:**
- Name must be 1-200 characters
- Venue must be 1-200 characters
- Times must be in logical order
- Rating must be 1-5 if provided

## Supporting Types

### SongSection
```typescript
interface SongSection {
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'solo' | 'other'
  name?: string // Custom section name
  duration?: number // Section length in seconds
  chords?: string[] // Chord progression for this section
}
```

### ReferenceLink
```typescript
interface ReferenceLink {
  type: 'spotify' | 'youtube' | 'tabs' | 'lyrics' | 'other'
  url: string
  description?: string
}
```

### SessionAttendee
```typescript
interface SessionAttendee {
  memberId: string
  confirmed: boolean // RSVP status
  attended: boolean // Actually showed up
  arrivalTime?: Date
  departureTime?: Date
}
```

### MemberRating
```typescript
interface MemberRating {
  memberId: string
  confidence: 1 | 2 | 3 | 4 | 5 // How ready they feel
  feedback?: string // Optional notes
}
```

### Contact
```typescript
interface Contact {
  name: string
  role: string // 'venue manager', 'promoter', etc.
  email?: string
  phone?: string
  notes?: string
}
```

### PaymentInfo
```typescript
interface PaymentInfo {
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled'
  method?: string
  notes?: string
}
```

## Relationships Summary

### One-to-Many Relationships
- Band → Members
- Band → Songs
- Band → PracticeSessions
- Band → Setlists
- Band → Shows
- PracticeSession → SessionSongs
- Setlist → SetlistSongs

### Many-to-Many Relationships
- Members ↔ PracticeSessions (via SessionAttendee)
- Songs ↔ Setlists (via SetlistSong)
- Songs ↔ PracticeSessions (via SessionSong)

### Calculated Fields
- `Song.confidenceLevel`: Average of all member ratings
- `Song.lastPracticed`: Most recent practice session date
- `Setlist.totalDuration`: Sum of all song durations
- `PracticeSession.duration`: Difference between start and end times

## Data Constraints

### Storage Considerations
- Client-side storage using Dexie.js (IndexedDB)
- Offline-first design with local data persistence
- No external database dependencies for MVP

### Performance Optimizations
- Index on frequently queried fields:
  - `Song.title`, `Song.artist`, `Song.key`
  - `PracticeSession.scheduledDate`
  - `Setlist.showDate`
  - `Member.name`

### Data Limits (MVP)
- Maximum 500 songs per band
- Maximum 100 practice sessions per band
- Maximum 50 setlists per band
- Maximum 8 members per band