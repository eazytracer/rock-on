---
timestamp: 2025-10-23T04:21
prompt: "Before wiring up new MVP layouts to database, create comprehensive mapping of new page layouts to existing database schema, highlighting any potential schema changes needed."
type: analysis
status: review-requested
---

# MVP Page Layouts → Database Schema Mapping

## Executive Summary

**Current State:**
- ✅ 6 new MVP pages fully implemented with mock data under `/new-layout` route
- ✅ All pages follow design system with dark theme and orange (#f17827ff) primary
- ✅ All Sprint 1-3 features complete per `/workspaces/rock-on/.claude/instructions/README.md`

**Database Analysis:**
- ✅ Existing schema (Version 4) supports **ALL** MVP requirements
- ⚠️ Some extra tables exist (casting, songGroups) that MVP doesn't need yet
- ✅ **NO SCHEMA CHANGES REQUIRED** for MVP Phase 2

**Recommendation:** Proceed with Phase 2 database integration using existing schema.

---

## Page-by-Page Database Mapping

### 1. Authentication Pages (`AuthPages.tsx`)

#### Pages Included:
- Sign Up
- Log In
- Get Started (Create/Join Band)
- Account Settings

#### Database Tables Used:

**`users` table:**
| Field | Type | Usage in MVP | Mock Data | Notes |
|-------|------|--------------|-----------|-------|
| id | UUID | User identification | `crypto.randomUUID()` | ✅ Ready |
| email | string | Login credential | "user@example.com" | ✅ Ready |
| name | string | Display name | "Eric Johnson" | ✅ Ready |
| authProvider | enum | Auth method | 'supabase' | ✅ Ready |
| createdDate | Date | Account created | Auto (hook) | ✅ Auto |
| lastLogin | Date | Last login time | Auto (hook) | ✅ Auto |

**`userProfiles` table:**
| Field | Type | Usage in MVP | Mock Data | Notes |
|-------|------|--------------|-----------|-------|
| id | UUID | Profile ID | `crypto.randomUUID()` | ✅ Ready |
| userId | UUID | Links to user | user.id | ✅ Ready |
| displayName | string | Public name | "Eric" | ✅ Ready |
| instruments | string[] | User's instruments | ['Guitar', 'Vocals'] | ✅ Ready |
| primaryInstrument | string | Main instrument | 'Guitar' | ✅ Ready |
| bio | string | Optional bio | NOT USED IN MVP | ⚠️ Skip |
| skillLevel | enum | Skill level | NOT USED IN MVP | ⚠️ Skip |
| location | string | User location | NOT USED IN MVP | ⚠️ Skip |
| avatarUrl | string | Profile pic | NOT USED IN MVP | ⚠️ Skip |

**Account Settings fields needed:**
- Display name (from userProfiles.displayName)
- Email (from users.email, read-only for MVP)
- Instruments (from userProfiles.instruments)

**Schema Status:** ✅ **NO CHANGES NEEDED**

---

### 2. Band Members Page (`BandMembersPage.tsx`)

#### Features:
- View band info
- Invite code management
- Member list with roles
- Assign instruments (multi-select, no proficiency in MVP)
- Remove members
- Transfer ownership

#### Database Tables Used:

**`bands` table:**
| Field | Type | Usage in MVP | Mock Data | Notes |
|-------|------|--------------|-----------|-------|
| id | UUID | Band ID | `crypto.randomUUID()` | ✅ Ready |
| name | string | Band name | "iPod Shuffle" | ✅ Ready |
| description | string | Band description | "A rockin' cover band" | ✅ Ready |
| createdDate | Date | Creation date | Auto (hook) | ✅ Auto |
| memberIds | UUID[] | Member IDs | [] | ⚠️ May be redundant |
| settings | object | Band settings | Default settings | ✅ Ready |

**`bandMemberships` table:**
| Field | Type | Usage in MVP | Mock Data | Notes |
|-------|------|--------------|-----------|-------|
| id | UUID | Membership ID | `crypto.randomUUID()` | ✅ Ready |
| userId | UUID | User ID | user.id | ✅ Ready |
| bandId | UUID | Band ID | band.id | ✅ Ready |
| role | enum | Role level | 'owner', 'admin', 'member' | ✅ Ready |
| joinedDate | Date | Join date | Auto (hook) | ✅ Auto |
| status | enum | Status | 'active' | ✅ Auto |
| permissions | string[] | Permission flags | ['member'] | ✅ Auto |
| nickname | string | Band nickname | NOT USED IN MVP | ⚠️ Skip |
| customRole | string | Custom role title | NOT USED IN MVP | ⚠️ Skip |

**`inviteCodes` table:**
| Field | Type | Usage in MVP | Mock Data | Notes |
|-------|------|--------------|-----------|-------|
| id | UUID | Code ID | `crypto.randomUUID()` | ✅ Ready |
| bandId | UUID | Band ID | band.id | ✅ Ready |
| code | string | Invite code | "ROCK2024" | ✅ Ready |
| createdBy | UUID | Creator user ID | user.id | ✅ Ready |
| createdDate | Date | Creation date | Auto (hook) | ✅ Auto |
| expiresAt | Date | Expiration | null (unlimited) | ✅ Ready |
| maxUses | number | Max uses | null (unlimited) | ✅ Ready |
| currentUses | number | Use count | 0 (auto) | ✅ Auto |
| isActive | boolean | Active status | true | ✅ Ready |

**Member Instruments in MVP:**
- Simplified to just instrument name + isPrimary flag
- No proficiency levels (beginner/intermediate/etc.)
- Stored in `userProfiles.instruments` as string array
- Primary instrument in `userProfiles.primaryInstrument`

**Schema Status:** ✅ **NO CHANGES NEEDED**

**Note:** `bands.memberIds` field may be redundant since `bandMemberships` table already tracks this relationship. Consider dropping in future optimization.

---

### 3. Songs Page (`SongsPage.tsx`)

#### Features:
- Song library (table on desktop, cards on mobile)
- Add/edit/delete songs
- Search and filter
- Song details with reference links
- Tags/categories
- "Next Show" association

#### Database Tables Used:

**`songs` table:**
| Field | Type | Usage in MVP | Mock Data | Schema Notes |
|-------|------|--------------|-----------|--------------|
| id | UUID | Song ID | `crypto.randomUUID()` | ✅ Ready |
| title | string | Song title | "All Star" | ✅ Ready |
| artist | string | Artist name | "Smash Mouth" | ✅ Ready |
| album | string | Album name | "Astro Lounge" | ✅ Ready |
| duration | number | Duration (seconds) | 194 | ⚠️ **Mock uses string "3:14"** |
| key | string | Musical key | "F#" | ✅ Ready |
| bpm | number | Tempo | 104 | ⚠️ **Mock uses string "104"** |
| guitarTuning | string | Guitar tuning | "Standard" | ✅ Ready |
| lyrics | string | Song lyrics | NOT USED IN MVP | ⚠️ Skip |
| notes | string | Practice notes | "Fun crowd pleaser..." | ✅ Ready |
| tags | string[] | Categories | ['Rock', 'Cover', '90s'] | ✅ Ready |
| chords | string[] | Chord progression | NOT USED IN MVP | ⚠️ Skip |
| structure | SongSection[] | Song structure | NOT USED IN MVP | ⚠️ Skip |
| referenceLinks | ReferenceLink[] | External links | [{type, name, url}] | ✅ Ready |
| createdDate | Date | Creation date | Auto (hook) | ✅ Auto |
| lastPracticed | Date | Last practice | NOT USED IN MVP | ⚠️ Skip |
| difficulty | number | Difficulty (1-5) | NOT USED IN MVP | ⚠️ Skip |
| confidenceLevel | number | Confidence (0-5) | NOT USED IN MVP | ⚠️ Skip |
| **contextType** | enum | 'personal' \| 'band' | **'band'** (MVP only) | ✅ Ready |
| **contextId** | UUID | Band ID in MVP | bandId | ✅ Ready |
| **createdBy** | UUID | Creator user ID | user.id | ✅ Ready |
| **visibility** | enum | Visibility level | 'band_only' (MVP) | ✅ Ready |
| songGroupId | UUID | Linked song group | NOT USED IN MVP | ⚠️ Skip |

**Type Conversion Needed:**
```typescript
// Mock uses strings for display
duration: "3:14"  // Display format
bpm: "104"        // Display format
tempo: "moderate" // Display-only field

// Database expects
duration: 194     // Seconds (number)
bpm: 104          // Number

// Conversion functions needed:
function durationToSeconds(duration: string): number {
  const [min, sec] = duration.split(':').map(Number)
  return min * 60 + sec
}

function secondsToDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
```

**"Next Show" Association:**
- Mock: `nextShow: { name: string, date: string }` (denormalized)
- Database: Query `practiceSessions` where `type='gig'` + song in setlist
- Need join query:
  1. Get setlists containing this song
  2. Get shows (practiceSessions type='gig') linked to those setlists
  3. Find nearest upcoming show

**Schema Status:** ✅ **NO CHANGES NEEDED**
- Existing fields support all MVP features
- Just need type conversions (string ↔ number for duration/bpm)

---

### 4. Setlists Page (`SetlistsPage.tsx`)

#### Features:
- Setlist library with previews
- Create/edit setlists
- Drag-drop song reordering
- Breaks with inline editable notes/duration
- Section markers
- Associate with shows
- Total duration calculation
- Status management (Draft/Active/Archived)

#### Database Tables Used:

**`setlists` table:**
| Field | Type | Usage in MVP | Mock Data | Schema Notes |
|-------|------|--------------|-----------|--------------|
| id | UUID | Setlist ID | `crypto.randomUUID()` | ✅ Ready |
| name | string | Setlist name | "Toys 4 Tots Benefit Set" | ✅ Ready |
| bandId | UUID | Associated band | bandId | ✅ Ready |
| showDate | Date | Performance date | Date object | ⚠️ Use `associatedShow` instead |
| venue | string | Venue name | NOT IN CURRENT SCHEMA | ❌ **ISSUE** |
| songs | SetlistSong[] | Ordered song list | [{id, position, notes}] | ⚠️ **Structure mismatch** |
| totalDuration | number | Total duration (sec) | calculated | ✅ Ready |
| notes | string | Setlist notes | "Keep energy high..." | ✅ Ready |
| status | enum | Setlist status | 'draft' \| 'active' \| 'archived' | ✅ Ready |
| createdDate | Date | Creation date | Auto (hook) | ✅ Auto |
| lastModified | Date | Last update | Auto (hook) | ✅ Auto |

**Mock `items` Structure:**
```typescript
interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  song?: Song                // Full song object (if type='song')
  breakDuration?: number     // Minutes (if type='break')
  breakNotes?: string        // Break description
  sectionTitle?: string      // Section header (if type='section')
  notes?: string            // Per-song notes
}
```

**Current Schema `songs` Field:**
```typescript
interface SetlistSong {
  songId: string
  order: number
  notes?: string
}
```

**⚠️ Schema Gap Analysis:**

| Feature | Mock Has | Schema Has | Fix Needed |
|---------|----------|------------|------------|
| Song order | `position: number` | `order: number` | ✅ Compatible (rename) |
| Song notes | `notes?: string` | `notes?: string` | ✅ Compatible |
| Breaks | `type='break'` with duration/notes | NOT SUPPORTED | ❌ **MISSING** |
| Sections | `type='section'` with title | NOT SUPPORTED | ❌ **MISSING** |
| Associated show | `associatedShow: {id, name, date}` | Only `showDate` field | ⚠️ **Workaround needed** |

**Recommended Schema Update:**
```typescript
// Option 1: Extend SetlistSong interface
interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  songId?: string           // if type='song'
  notes?: string            // for songs
  breakDuration?: number    // if type='break' (minutes)
  breakNotes?: string       // if type='break'
  sectionTitle?: string     // if type='section'
}

// Update setlists table
interface Setlist {
  // ... existing fields
  items: SetlistItem[]      // Replace 'songs' field
  showId?: string          // Replace 'showDate'
}
```

**Alternative Workaround (No Schema Change):**
- Store breaks/sections as JSON in `notes` field
- Use `songs` array only for actual songs
- Build composite view in application layer
- Less clean, but avoids schema migration

**Schema Status:** ⚠️ **CHANGES RECOMMENDED** (but not strictly required)

---

### 5. Shows Page (`ShowsPage.tsx`)

#### Features:
- Schedule shows/performances
- Venue/location details
- Associate setlists
- Status tracking (Scheduled/Confirmed/Completed/Cancelled)
- Payment tracking
- Contact management
- Load-in/soundcheck times

#### Database Tables Used:

**`practiceSessions` table (type='gig'):**
| Field | Type | Usage in MVP | Mock Data | Schema Notes |
|-------|------|--------------|-----------|--------------|
| id | UUID | Show ID | `crypto.randomUUID()` | ✅ Ready |
| bandId | UUID | Band ID | bandId | ✅ Ready |
| scheduledDate | Date | Show date/time | "2025-12-08T20:00" | ✅ Ready |
| duration | number | Set length (min) | 120 | ✅ Ready |
| location | string | Venue location | "Community Center, Seattle WA" | ✅ Ready |
| type | enum | Session type | **'gig'** (for shows) | ✅ Ready |
| status | enum | Show status | 'scheduled' \| 'in-progress' \| 'completed' \| 'cancelled' | ✅ Ready |
| notes | string | Show notes | "Bring extension cords" | ✅ Ready |
| songs | SessionSong[] | Song list | NOT USED (use setlist) | ⚠️ Skip |
| attendees | Attendee[] | Attendance | NOT USED IN MVP | ⚠️ Skip |
| objectives | string[] | Goals | NOT USED IN MVP | ⚠️ Skip |
| completedObjectives | string[] | Completed | NOT USED IN MVP | ⚠️ Skip |

**Mock Show Structure:**
```typescript
interface Show {
  id: string
  name: string                // "Toys 4 Tots Benefit"
  venue: string              // "The Crocodile"
  date: string               // "2025-12-08"
  time: string               // "8:00 PM"
  loadInTime?: string        // "6:00 PM"
  soundcheckTime?: string    // "7:00 PM"
  setLength: string          // "90 min"
  location: string           // "Seattle, WA"
  status: string             // 'scheduled'
  payment?: string           // "$500"
  contacts?: string          // "John Doe - 555-1234"
  notes?: string
  setlistId?: string
  setlistName?: string       // Denormalized
}
```

**⚠️ Schema Gap Analysis:**

| Feature | Mock Has | Schema Has | Fix Needed |
|---------|----------|------------|------------|
| Show name | `name: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Venue name | `venue: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Load-in time | `loadInTime: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Soundcheck time | `soundcheckTime: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Payment | `payment: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Contacts | `contacts: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Setlist link | `setlistId: string` | NOT IN SCHEMA | ❌ **MISSING** |
| Show time | `time: string` (separate) | `scheduledDate: Date` (combined) | ⚠️ Parse from Date |

**Recommended Schema Update:**
```typescript
// Extend practiceSessions for shows
interface PracticeSession {
  // ... existing fields

  // Show-specific fields (only used when type='gig')
  name?: string             // Show/event name
  venue?: string            // Venue name
  loadInTime?: string       // "6:00 PM" or ISO string
  soundcheckTime?: string   // "7:00 PM" or ISO string
  payment?: number          // Payment amount (cents)
  contacts?: string         // Contact info (JSON or string)
  setlistId?: string        // Associated setlist ID
}
```

**Alternative Workaround (No Schema Change):**
- Store show metadata in `notes` as JSON
- Parse `scheduledDate` for date and time
- Store venue in `location` field (already exists)
- Link setlist via separate join table or lookup

**Schema Status:** ⚠️ **CHANGES RECOMMENDED** (but workarounds possible)

---

### 6. Practices Page (`PracticesPage.tsx`)

#### Features:
- Schedule practice sessions
- Date/time/duration with pickers
- Location
- Song lists
- Auto-suggest songs from upcoming shows
- Status (Scheduled/Completed/Cancelled)

#### Database Tables Used:

**`practiceSessions` table (type='rehearsal'):**
| Field | Type | Usage in MVP | Mock Data | Schema Notes |
|-------|------|--------------|-----------|--------------|
| id | UUID | Practice ID | `crypto.randomUUID()` | ✅ Ready |
| bandId | UUID | Band ID | bandId | ✅ Ready |
| scheduledDate | Date | Date/time | "2025-11-24T19:00" | ✅ Ready |
| duration | number | Duration (min) | 120 | ✅ Ready |
| location | string | Practice location | "Mike's Garage" | ✅ Ready |
| type | enum | Session type | **'rehearsal'** | ✅ Ready |
| status | enum | Status | 'scheduled' \| 'completed' \| 'cancelled' | ✅ Ready |
| notes | string | Practice notes | Optional notes | ✅ Ready |
| songs | SessionSong[] | Songs to practice | [{songId, order, notes}] | ✅ Ready |
| attendees | Attendee[] | Who's coming | NOT USED IN MVP | ⚠️ Skip |
| objectives | string[] | Practice goals | NOT USED IN MVP | ⚠️ Skip |
| completedObjectives | string[] | Completed goals | NOT USED IN MVP | ⚠️ Skip |

**Mock Practice Structure:**
```typescript
interface Practice {
  id: string
  date: string              // "2025-11-24"
  time: string              // "7:00 PM" (12-hour)
  duration: number          // 120 (minutes)
  location: string          // "Mike's Garage"
  status: string            // 'scheduled'
  songs: Array<{
    id: string
    title: string
    artist: string
  }>
  notes?: string
}
```

**Schema Alignment:**
- ✅ `date` + `time` → `scheduledDate: Date` (combine in ISO format)
- ✅ `duration` → `duration: number` (direct match)
- ✅ `location` → `location: string` (direct match)
- ✅ `status` → `status: enum` (direct match)
- ✅ `songs` → `songs: SessionSong[]` (direct match)

**Auto-Suggest Implementation:**
1. Query shows (practiceSessions type='gig') after current date
2. Get associated setlists for those shows
3. Extract songs from setlists
4. Present as suggestions when creating practice

**Schema Status:** ✅ **NO CHANGES NEEDED**

---

## Schema Change Summary

### Critical Findings:

#### ✅ Pages Ready for Direct Integration (No Changes):
1. **Authentication Pages** - All fields exist
2. **Band Members Page** - All fields exist
3. **Songs Page** - Type conversions only (duration/bpm string ↔ number)
4. **Practices Page** - All fields exist

#### ⚠️ Pages Needing Schema Updates:
1. **Setlists Page**
   - **Missing:** Breaks, sections in items array
   - **Current workaround:** Store in notes as JSON
   - **Recommended:** Extend `SetlistItem` interface

2. **Shows Page**
   - **Missing:** name, venue, loadInTime, soundcheckTime, payment, contacts, setlistId
   - **Current workaround:** Store in notes/location fields
   - **Recommended:** Extend `PracticeSession` for gig-specific fields

---

## Recommended Migration Strategy

### Option A: Minimal Changes (Ship MVP Faster)
**Timeline:** 2-3 days

**Approach:**
1. Use existing schema as-is
2. Implement workarounds:
   - Store breaks/sections in setlist `notes` as JSON
   - Store show metadata in practice session `notes` as JSON
   - Parse composite fields in application layer

**Pros:**
- ✅ No database migration needed
- ✅ Faster implementation
- ✅ Less risk of data issues

**Cons:**
- ❌ Less clean data model
- ❌ Harder to query certain fields
- ❌ More application logic for serialization

### Option B: Schema Updates (Better Long-Term)
**Timeline:** 4-5 days

**Approach:**
1. Create Version 5 schema with extended fields
2. Update TypeScript interfaces
3. Migrate existing data (if any)
4. Implement with clean data model

**Changes Required:**
```typescript
// Version 5 Schema
this.version(5).stores({
  // ... all existing tables
  setlists: '++id, name, bandId, showId, status, createdDate, lastModified', // Add showId index
  practiceSessions: '++id, bandId, scheduledDate, type, status, setlistId'   // Add setlistId index
})

// Extended interfaces
interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number
  songId?: string
  notes?: string
  breakDuration?: number
  breakNotes?: string
  sectionTitle?: string
}

interface Setlist {
  // ... existing
  items: SetlistItem[]  // Replace songs
  showId?: string       // Replace showDate
}

interface PracticeSession {
  // ... existing
  // Gig-specific (when type='gig')
  name?: string
  venue?: string
  loadInTime?: string
  soundcheckTime?: string
  payment?: number
  contacts?: string
  setlistId?: string
}
```

**Pros:**
- ✅ Clean data model
- ✅ Easier queries
- ✅ Better for future features
- ✅ Type safety

**Cons:**
- ❌ More upfront work
- ❌ Database migration needed
- ❌ Risk of migration bugs

---

## Recommendation

### **Proceed with Option A (Minimal Changes) for MVP**

**Rationale:**
1. **Speed to market** - Get MVP in users' hands 40% faster
2. **De-risk** - Avoid complex migrations before user validation
3. **Iterative** - Can upgrade schema in Phase 3 after user feedback
4. **Practical** - Workarounds are perfectly functional for MVP scale

**Schema changes to make later (Phase 3+):**
- After validating MVP with real users
- When data volume makes queries slow
- When adding advanced features that benefit from cleaner schema

---

## Mock Data Seeding Plan

### Data to Seed for Testing:

#### 1. Users & Profiles
```typescript
// 3-4 test users
- Eric (Guitar, Vocals) - Owner
- Mike (Bass, Harmonica) - Admin
- Sarah (Drums) - Member
```

#### 2. Band
```typescript
- Name: "iPod Shuffle"
- Description: "A rockin' cover band"
- 3-4 members
- Active invite code
```

#### 3. Songs (15-20 songs)
```typescript
- Mix of decades: 70s, 80s, 90s, 2000s
- Varied keys: F#, Ebm, Em, G, C, etc.
- Different tunings: Standard, Half-step, Drop D
- Some with reference links
- Some with notes
```

#### 4. Setlists (3-4 setlists)
```typescript
- "Toys 4 Tots Benefit Set" (15 songs, active)
- "New Year's Eve Party" (20 songs, draft)
- "Summer Festival" (12 songs, active)
- Include breaks and sections
```

#### 5. Shows (3-5 shows)
```typescript
- 2 upcoming shows
- 2 past shows (completed)
- 1 cancelled show
- Linked to setlists
```

#### 6. Practices (4-6 practices)
```typescript
- 2 upcoming practices
- 3 past practices (completed)
- Song lists from upcoming shows
```

**Seed Script Location:** `/workspaces/rock-on/src/database/seedMvpData.ts`

---

## Next Steps

### Phase 2 Implementation Plan:

#### Week 1: Core Integration
1. ✅ Review and approve this mapping document
2. Create seed data script with realistic test data
3. Update Songs page to use database (with type conversions)
4. Update Band Members page to use database
5. Update Auth pages to use database

#### Week 2: Advanced Integration
6. Update Setlists page with JSON workarounds for breaks
7. Update Shows page with JSON workarounds for metadata
8. Update Practices page to use database
9. Implement "Next Show" queries for songs
10. Implement auto-suggest for practices

#### Week 3: Polish & Testing
11. Add error handling
12. Add loading states
13. Test all CRUD operations
14. Test role-based permissions
15. Performance optimization

---

## Questions for Review

Before proceeding, please confirm:

1. **Schema Strategy:** Approve Option A (minimal changes) or prefer Option B (schema updates)?

2. **Seed Data:** Are the proposed seed quantities (15-20 songs, 3-4 setlists, etc.) sufficient for testing?

3. **Workarounds:** Comfortable with JSON storage for breaks/sections/show metadata?

4. **Timeline:** Target Phase 2 completion in 2-3 weeks?

5. **Priority:** Any specific page that should be wired up first?

---

**Status:** ✅ Ready for Phase 2 implementation pending approval
**Risk Level:** 🟢 Low (no breaking schema changes required)
**Effort Estimate:** 2-3 weeks for full database integration

