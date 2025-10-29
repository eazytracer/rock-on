---
title: Test Data and Seeding Specification
created: 2025-10-27T18:16
status: ACTIVE
type: Development Reference
purpose: Document seeded test data structure for development and integration testing
---

# Test Data and Seeding Specification

**Purpose:** This document describes the structure and content of seeded test data in the rock-on application. Use this as a reference when writing integration tests, debugging, or understanding the development environment.

## Table of Contents
- [Overview](#overview)
- [Seed Data Files](#seed-data-files)
- [Database Schema](#database-schema)
- [Seeded Entities](#seeded-entities)
- [Data Relationships](#data-relationships)
- [Integration Testing Guide](#integration-testing-guide)
- [Reset & Reseed Process](#reset--reseed-process)

---

## Overview

### Seeding Modes

The application has **two seed data files**:

1. **`seedData.ts`** - Minimal seed data (legacy, basic example)
2. **`seedMvpData.ts`** - Complete MVP test data (🎯 **USE THIS**)

### When Seeding Occurs

**Automatic seeding** happens when:
- Local IndexedDB is empty
- User count is 0
- Development environment is detected

**Manual seeding:**
```javascript
// In browser console
await seedMvpData()
```

**Reset database:**
```javascript
// In browser console
resetDB()  // Clears and reseeds
```

---

## Seed Data Files

### File: `src/database/seedMvpData.ts`

**Purpose:** Realistic MVP test data with multiple entities, relationships, and edge cases.

**Key Features:**
- 3 test users (Eric, Mike, Sarah)
- 1 band (iPod Shuffle) with 3 members
- 17 songs across different genres and decades
- 4 setlists with breaks, sections, and items
- 5 shows (3 upcoming, 2 past)
- 5 practice sessions (2 upcoming, 3 past)
- Invite code for easy band joining

**Database Summary After Seeding:**
```javascript
{
  users: 3,
  bands: 1,
  bandMemberships: 3,
  songs: 17,
  setlists: 4,
  shows: 5,
  practices: 5,
  inviteCodes: 1
}
```

---

## Database Schema

### Critical Tables

| Table | IndexedDB Name | Supabase Name | Purpose |
|-------|---------------|---------------|---------|
| Users | `users` | `users` | User accounts |
| User Profiles | `userProfiles` | `user_profiles` | Extended user info |
| Bands | `bands` | `bands` | Band entities |
| Band Memberships | `bandMemberships` | `band_memberships` | User ↔ Band links |
| Songs | `songs` | `songs` | Song library |
| Setlists | `setlists` | `setlists` | Performance setlists |
| **Shows** | **`shows`** | **`shows`** | **Gigs/performances** |
| Practice Sessions | `practiceSessions` | `practice_sessions` | Rehearsals |
| Invite Codes | `inviteCodes` | `invite_codes` | Band invitations |

### Schema Version

**Current Version:** `70` (Version 7.0)

**Version 7 Changes:**
- ✅ Added `shows` table (separated from practice_sessions)
- ✅ Updated practice_sessions (removed show-specific fields)

**Reference:** See `.claude/specifications/proposed-unified-schema-v2.md` for complete schema.

---

## Seeded Entities

### 1. Users (3 total)

**Mock Test Users:**

| Name | Email | ID | Role in Band | Instruments |
|------|-------|----|--------------|-----------|
| Eric Johnson | eric@ipodshuffle.com | `crypto.randomUUID()` | Admin | Guitar, Vocals |
| Mike Thompson | mike@ipodshuffle.com | `crypto.randomUUID()` | Admin | Bass, Harmonica, Vocals, Guitar |
| Sarah Chen | sarah@ipodshuffle.com | `crypto.randomUUID()` | Member | Drums, Percussion |

**Quick Login:**
All users have mock authentication enabled. Click "Show Mock Users for Testing" on the login page.

**Band Membership:**
- Eric: Owner + Admin (joined 2024-01-15)
- Mike: Admin (joined 2024-01-20)
- Sarah: Member (joined 2024-02-01)

### 2. Band (1 total)

**Name:** iPod Shuffle
**Description:** "A rockin' cover band playing hits from every decade"
**Created:** 2024-01-15
**Invite Code:** `ROCK2025`
**Members:** 3 (Eric, Mike, Sarah)

**Settings:**
```json
{
  "defaultPracticeTime": 120,
  "reminderMinutes": [60, 30, 10],
  "autoSaveInterval": 30
}
```

### 3. Songs (17 total)

**Song Library Breakdown:**

| Decade | Count | Examples |
|--------|-------|----------|
| 70s | 3 | Hotel California, Dream On, Free Bird |
| 80s | 3 | Sweet Child O' Mine, Livin' on a Prayer, Jump |
| 90s | 5 | Wonderwall, Smells Like Teen Spirit, Man in the Box, Black, Enter Sandman |
| 2000s | 6 | Mr. Brightside, Hey There Delilah, Seven Nation Army, The Remedy, Ocean Avenue |

**Common Fields:**
```typescript
{
  id: string                    // UUID
  title: string                 // Song name
  artist: string                // Artist name
  album?: string                // Album name
  duration: number              // Duration in seconds
  key: string                   // Musical key (e.g., 'F#m', 'D')
  bpm: number                   // Tempo
  difficulty: number            // 1-5 scale
  guitarTuning?: string         // e.g., 'Standard', 'Drop D'
  tags: string[]                // Genre tags
  contextType: 'band'           // All songs are band-scoped
  contextId: string             // Band ID
  createdBy: string             // User ID (Eric)
  visibility: 'band'            // All band members can see
  createdDate: Date
  confidenceLevel: number       // 1-5 scale
  structure: []                 // Song sections (empty for now)
  chords: []                    // Chord progression (empty for now)
  referenceLinks: Array<{       // YouTube/Spotify links
    type: 'youtube' | 'spotify'
    url: string
    description: string
  }>
}
```

**Notable Songs:**
- **All Star** - Fun crowd pleaser, palm muted power chords
- **Hotel California** - Don't rush the intro
- **Man in the Box** - Heavy riff, watch wah-wah timing

### 4. Setlists (4 total)

**Setlist Structure:**

| Name | Status | Shows/Practice | Songs | Duration | Notes |
|------|--------|----------------|-------|----------|-------|
| Toys 4 Tots Benefit Set | Active | Toys 4 Tots show | 15 items | 60 min | Families audience, high energy |
| New Year's Eve Party - Full Show | Active | New Year's show | 20 items | 90 min | Two sets with costume change |
| Summer Festival - 60min Set | Active | Summer Festival | 12 items | 50 min | Outdoor, upbeat songs |
| New Songs to Learn | Draft | None | 4 items | 20 min | Practice setlist |

**Setlist Items:**

Each setlist contains an `items` array with:

```typescript
type SetlistItem =
  | { id: string, type: 'song', position: number, songId: string, notes?: string }
  | { id: string, type: 'break', position: number, breakDuration: number, breakNotes?: string }
  | { id: string, type: 'section', position: number, sectionTitle: string }
```

**Example:**
```javascript
{
  id: crypto.randomUUID(),
  name: 'Toys 4 Tots Benefit Set',
  bandId: bandId,
  showId: showIds.toys4Tots,  // Linked to show
  items: [
    { id: '...', type: 'song', position: 1, songId: songIds.allStar, notes: 'Energy opener!' },
    { id: '...', type: 'song', position: 2, songId: songIds['mr Bright'] },
    // ... more songs
    { id: '...', type: 'break', position: 6, breakDuration: 15, breakNotes: 'Quick break - stay hydrated' },
    { id: '...', type: 'section', position: 7, sectionTitle: 'Acoustic Set' },
    // ... more items
  ],
  status: 'active',
  createdDate: new Date('2024-11-01'),
  lastModified: new Date('2024-11-15')
}
```

### 5. Shows (5 total)

**🆕 SEPARATED FROM PRACTICE SESSIONS** (as of 2025-10-27)

**Upcoming Shows (3):**

| Name | Venue | Date | Payment | Status | Duration | Contacts |
|------|-------|------|---------|--------|----------|----------|
| Summer Music Festival | Woodland Park | Nov 30, 2025 | $750 | Scheduled | 60 min | Mike Davis (Festival Coordinator) |
| Toys 4 Tots Benefit Concert | The Crocodile | Dec 8, 2025 | $500 | Scheduled | 90 min | John Smith (Promoter) |
| New Year's Eve Party | The Showbox | Dec 31, 2025 | $1,200 | Scheduled | 120 min | Sarah Johnson (Venue Manager) |

**Past Shows (2):**

| Name | Venue | Date | Payment | Status | Duration |
|------|-------|------|---------|--------|----------|
| Spring Fling | The Tractor Tavern | Apr 20, 2024 | $450 | Completed | 75 min |
| Halloween Bash | Neumos | Oct 31, 2024 | $600 | Completed | 90 min |

**Show Fields:**
```typescript
{
  id: string                    // UUID
  bandId: string                // Band ID
  setlistId?: string            // Linked setlist (optional)
  name: string                  // Show name
  scheduledDate: Date           // Performance date/time
  duration: number              // Duration in minutes
  venue?: string                // Venue name
  location?: string             // Full address
  loadInTime?: string           // e.g., "6:00 PM"
  soundcheckTime?: string       // e.g., "7:00 PM"
  payment?: number              // Payment in cents
  contacts?: ShowContact[]      // Array of contacts
  status: ShowStatus            // 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string                // Show notes
  createdDate: Date
  updatedDate: Date
}
```

**ShowContact Structure:**
```typescript
{
  id: string          // UUID
  name: string        // Contact name
  role: string        // e.g., "Venue Manager", "Sound Engineer"
  phone?: string      // Phone number
  email?: string      // Email address
  notes?: string      // Additional notes
}
```

### 6. Practice Sessions (5 total)

**🔧 MODIFIED** - Show-specific fields removed (as of 2025-10-27)

**Upcoming Practices (2):**

| Date | Location | Duration | Type | Songs to Practice |
|------|----------|----------|------|-------------------|
| Nov 24, 2025 7:00 PM | Mike's Garage | 120 min | Rehearsal | 5 songs (Toys 4 Tots prep) |
| Dec 1, 2025 7:00 PM | Eric's Studio | 90 min | Rehearsal | 3 songs (new songs) |

**Past Practices (3):**

| Date | Location | Duration | Status | Rating |
|------|----------|----------|--------|--------|
| Nov 17, 2024 7:00 PM | Mike's Garage | 120 min | Completed | N/A |
| Nov 10, 2024 7:00 PM | Eric's Studio | 90 min | Completed | N/A |
| Nov 3, 2024 7:00 PM | Mike's Garage | 120 min | Completed | N/A |

**Practice Session Fields:**
```typescript
{
  id: string
  bandId: string
  setlistId?: string           // Optional practice setlist
  scheduledDate: Date
  startTime?: Date
  endTime?: Date
  duration: number             // Minutes
  location?: string
  type: PracticeType           // 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
  status: PracticeStatus       // 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes?: string
  objectives?: string[]        // Practice goals
  completedObjectives?: string[]
  sessionRating?: number       // 1-5
  songs?: PracticeSong[]       // Songs practiced
  attendees?: PracticeAttendee[]
  createdDate: Date

  // ❌ REMOVED (moved to Shows table):
  // name, venue, loadInTime, soundcheckTime, payment, contacts
}
```

---

## Data Relationships

### Entity Relationship Diagram

```
users (3)
  ↓
  ├─ userProfiles (3)
  └─ bandMemberships (3) ──→ bands (1)
                                ↓
                                ├─ songs (17)
                                ├─ setlists (4) ←──┐
                                ├─ shows (5) ───────┤ (bidirectional)
                                └─ practiceSessions (5)
```

### Key Relationships

**1. Users ↔ Bands**
- Via `bandMemberships` table
- Each user can be in multiple bands
- Each band can have multiple members

**2. Songs → Band**
- All songs are scoped to a band via `contextId`
- Songs are owned by the band, not individual users

**3. Setlists ↔ Shows** (bidirectional)
- A setlist can reference a show via `setlist.showId`
- A show can reference a setlist via `show.setlistId`
- When creating a show with a setlist, the setlist is **forked** (copied)

**4. Setlists ↔ Practices**
- A setlist can reference a practice via `setlist.practiceSessionId`
- A practice can reference a setlist via `practice.setlistId`

**5. Setlist Forking**
- Setlists can be forked (copied) via `setlist.sourceSetlistId`
- Preserves lineage: `sourceSetlistId → original setlist ID`

---

## Integration Testing Guide

### Prerequisites for Tests

When writing integration tests, assume the following data exists:

**Users:**
```javascript
const ERIC_EMAIL = 'eric@ipodshuffle.com'
const MIKE_EMAIL = 'mike@ipodshuffle.com'
const SARAH_EMAIL = 'sarah@ipodshuffle.com'
```

**Band:**
```javascript
const BAND_NAME = 'iPod Shuffle'
const INVITE_CODE = 'ROCK2025'
```

**Song Count Expectations:**
```javascript
expect(songs).toHaveLength(17)
expect(songs.filter(s => s.tags.includes('90s'))).toHaveLength(5)
```

**Setlist Count Expectations:**
```javascript
expect(setlists).toHaveLength(4)
expect(setlists.filter(s => s.status === 'active')).toHaveLength(3)
expect(setlists.filter(s => s.status === 'draft')).toHaveLength(1)
```

**Show Count Expectations:**
```javascript
expect(shows).toHaveLength(5)
expect(shows.filter(s => s.status === 'scheduled')).toHaveLength(3)
expect(shows.filter(s => s.status === 'completed')).toHaveLength(2)
```

### Example Integration Tests

#### Test 1: User Login and Band Access

```typescript
it('should log in and access band data', async () => {
  // 1. Login as Eric
  await authService.login({ email: 'eric@ipodshuffle.com', password: 'mock' })

  // 2. Get user's bands
  const memberships = await repository.getUserMemberships(currentUserId)
  expect(memberships).toHaveLength(1)
  expect(memberships[0].role).toBe('admin')

  // 3. Get band details
  const band = await repository.getBand(memberships[0].bandId)
  expect(band.name).toBe('iPod Shuffle')
  expect(band.memberIds).toContain(currentUserId)
})
```

#### Test 2: Setlist Creation and Show Linking

```typescript
it('should create setlist and link to show', async () => {
  // 1. Get upcoming shows
  const shows = await ShowService.getUpcomingShows(bandId)
  expect(shows.length).toBeGreaterThan(0)

  // 2. Get a setlist
  const setlists = await repository.getSetlists(bandId)
  const sourceSetlist = setlists[0]

  // 3. Fork setlist for show
  const forkedId = await ShowService.forkSetlistForShow(shows[0].id, sourceSetlist.id)

  // 4. Verify bidirectional link
  const updatedShow = await repository.getShow(shows[0].id)
  expect(updatedShow.setlistId).toBe(forkedId)

  const forkedSetlist = await repository.getSetlist(forkedId)
  expect(forkedSetlist.showId).toBe(shows[0].id)
  expect(forkedSetlist.sourceSetlistId).toBe(sourceSetlist.id)
})
```

#### Test 3: Song Filtering and Search

```typescript
it('should filter songs by decade', async () => {
  const songs = await repository.getSongs({ contextType: 'band', contextId: bandId })

  const nineties = songs.filter(s => s.tags.includes('90s'))
  expect(nineties).toHaveLength(5)
  expect(nineties.map(s => s.title)).toContain('Wonderwall')
  expect(nineties.map(s => s.title)).toContain('Smells Like Teen Spirit')
})
```

---

## Reset & Reseed Process

### Browser Console Method

```javascript
// Full reset (clears and reseeds)
resetDB()

// Manual steps
// 1. Clear IndexedDB
const dbs = await indexedDB.databases()
for (const db of dbs) {
  if (db.name) indexedDB.deleteDatabase(db.name)
}

// 2. Clear localStorage
localStorage.clear()

// 3. Reload page
location.reload()

// 4. Seed data (automatic on reload if DB is empty)
```

### Programmatic Method (Tests)

```typescript
beforeEach(async () => {
  // Clear all tables
  await db.users.clear()
  await db.bands.clear()
  await db.bandMemberships.clear()
  await db.songs.clear()
  await db.setlists.clear()
  await db.shows.clear()
  await db.practiceSessions.clear()

  // Reseed
  await seedMvpData()
})
```

### Supabase Local (Development)

If using local Supabase:

```bash
# Reset Supabase database
supabase db reset

# Migrations will run automatically
# Then seed local data in browser
```

---

## Data Consistency Rules

### Critical Data Integrity

1. **Band ID Consistency**
   - All songs, setlists, shows, and practices MUST reference the same `bandId`
   - Do NOT mix band IDs from Supabase sync and local seeding

2. **Date Consistency**
   - Upcoming shows: `scheduledDate >= now` AND `status !== 'cancelled'`
   - Past shows: `scheduledDate < now` OR `status === 'completed'`

3. **Setlist Item Positions**
   - Must be sequential: 1, 2, 3, ...
   - No gaps in positions
   - Each item must have unique position

4. **Show Status Lifecycle**
   ```
   scheduled → confirmed → completed
                ↓
              cancelled (terminal)
   ```

5. **Payment in Cents**
   - Always store payment as cents (integer)
   - Display: `payment / 100` formatted as currency
   - Example: 50000 cents = $500.00

---

## Troubleshooting

### Issue: "No shows/songs/setlists found"

**Cause:** Band ID mismatch between Supabase sync and local seed data

**Solution:**
```javascript
// 1. Check current band ID
const currentBandId = localStorage.getItem('currentBandId')

// 2. Check shows' band IDs
const shows = await db.shows.toArray()
console.log('Show band IDs:', shows.map(s => s.bandId))

// 3. Update shows to correct band
for (const show of shows) {
  show.bandId = currentBandId
  await db.shows.put(show)
}
```

### Issue: Sync errors "Could not find table 'public.shows'"

**Cause:** Supabase doesn't have shows table yet (development mode)

**Solution:** This is expected. The sync engine now gracefully handles this with informational message:
```
ℹ️ Shows table not available in remote database (development mode)
```

To create the table in Supabase, run the migration from `proposed-unified-schema-v2.md`.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-27 | 7.0 | Added `shows` table, separated from `practice_sessions` |
| 2024-11-01 | 6.0 | Added setlist items structure (breaks, sections) |
| 2024-10-23 | 5.0 | Added band memberships, invite codes |

---

## Related Documentation

- **Database Schema:** `.claude/specifications/proposed-unified-schema-v2.md`
- **Sync Implementation:** `.claude/instructions/40-sync-engine-implementation.md`
- **Repository Pattern:** `.claude/instructions/30-repository-pattern-implementation.md`

---

**Last Updated:** 2025-10-27T18:16
**Maintained By:** Claude Code Orchestrator
**Status:** Active - Use for all integration testing and development
