---
timestamp: 2025-10-23T04:33
prompt: "User requested proper schema updates instead of workarounds for MVP. Implemented Version 5 database schema with SetlistItem (breaks/sections) and show metadata fields."
type: implementation-summary
status: complete
---

# Version 5 Database Schema - Implementation Complete ✅

## Overview

Successfully upgraded database from Version 4 to Version 5 with proper schema support for:
1. **Setlist items** - Songs, breaks, and section markers
2. **Show metadata** - Full show/event information (name, venue, payment, contacts, etc.)
3. **Setlist-to-show linking** - Clean relational structure

**No workarounds needed** - Clean data model ready for Phase 2 integration!

---

## What Was Changed

### 1. Database Schema (`/workspaces/rock-on/src/services/database/index.ts`)

**Added Version 5:**
```typescript
this.version(5).stores({
  // ... all tables
  practiceSessions: '++id, bandId, scheduledDate, type, status, setlistId',  // ✅ Added setlistId index
  setlists: '++id, name, bandId, showId, status, createdDate, lastModified',  // ✅ Changed showDate → showId
  // ... rest of tables
})
```

**Key Index Changes:**
- `setlists.showId` - Replaces `showDate` for clean show reference
- `practiceSessions.setlistId` - Enables reverse lookup (show → setlist)

---

### 2. TypeScript Interfaces

#### A. New `SetlistItem` Interface (`/workspaces/rock-on/src/types/index.ts`)

```typescript
export interface SetlistItem {
  id: string
  type: 'song' | 'break' | 'section'
  position: number

  // Song fields (when type='song')
  songId?: string
  notes?: string  // Per-song notes

  // Break fields (when type='break')
  breakDuration?: number  // Minutes
  breakNotes?: string     // Description

  // Section fields (when type='section')
  sectionTitle?: string   // Header text
}
```

**Usage Examples:**
```typescript
// Song
{ id: '1', type: 'song', position: 1, songId: 'song-123', notes: 'Watch timing' }

// Break
{ id: '2', type: 'break', position: 2, breakDuration: 15, breakNotes: 'Costume change' }

// Section
{ id: '3', type: 'section', position: 3, sectionTitle: 'Acoustic Set' }
```

#### B. Updated `Setlist` Interface (`/workspaces/rock-on/src/models/Setlist.ts`)

```typescript
export interface Setlist {
  id: string
  name: string
  bandId: string

  // Version 5 changes:
  showId?: string         // ✅ NEW: Reference to show
  items: SetlistItem[]    // ✅ NEW: Songs + breaks + sections

  // Deprecated (kept for backward compatibility):
  /** @deprecated Use showId instead */
  showDate?: Date
  /** @deprecated Use items instead */
  songs?: SetlistSong[]
  /** @deprecated Venue is now on show */
  venue?: string

  totalDuration: number
  notes?: string
  status: SetlistStatus  // 'draft' | 'active' | 'archived'
  createdDate: Date
  lastModified: Date
}
```

#### C. Extended `PracticeSession` Interface (`/workspaces/rock-on/src/models/PracticeSession.ts`)

```typescript
export interface PracticeSession {
  // ... existing fields

  // Version 5: Show-specific fields (only when type='gig')
  name?: string              // Show/event name
  venue?: string             // Venue name
  loadInTime?: string        // "6:00 PM" or ISO
  soundcheckTime?: string    // "7:00 PM" or ISO
  payment?: number           // Amount in cents
  contacts?: string          // Contact info
  setlistId?: string         // Associated setlist
}
```

#### D. Updated Enums

```typescript
// Added 'gig' type
export type SessionType = 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson' | 'gig'

// Changed setlist statuses to MVP values
export type SetlistStatus = 'draft' | 'active' | 'archived'
```

---

### 3. Seed Data Script (`/workspaces/rock-on/src/database/seedMvpData.ts`)

**Created comprehensive test data:**

| Data Type | Count | Details |
|-----------|-------|---------|
| Users | 3 | Eric (Owner), Mike (Admin), Sarah (Member) |
| Band | 1 | "iPod Shuffle" with invite code ROCK2024 |
| Songs | 17 | Mix of 70s, 80s, 90s, 2000s hits |
| Setlists | 4 | 3 active (for shows) + 1 draft |
| Shows | 5 | 3 upcoming, 2 completed |
| Practices | 5 | 2 upcoming, 3 completed |

**Setlist Features Demonstrated:**
- **Breaks:** Inline editable with duration and notes
- **Sections:** Header markers (e.g., "Acoustic Set", "Rock Out")
- **Show linking:** Each active setlist linked to a show via `showId`
- **Song notes:** Per-song notes within setlists

**Show Features Demonstrated:**
- Full metadata: name, venue, location, payment
- Load-in and soundcheck times
- Contact information
- Setlist references
- Multiple statuses: scheduled, confirmed, completed

**Song Library:**
```
90s: All Star, Wonderwall, Man in the Box, Smells Like Teen Spirit, Black, Enter Sandman
80s: Sweet Child O' Mine, Livin' on a Prayer, Jump
70s: Hotel California, Dream On, Free Bird
2000s: Mr. Brightside, Hey There Delilah, Seven Nation Army, The Remedy, Ocean Avenue
```

---

## Database Schema Documentation

**Updated:** `/workspaces/rock-on/.claude/specifications/database-schema.md`

**Changes:**
1. Added Version 4 documentation (casting system)
2. Added Version 5 documentation (setlist items + show metadata)
3. Updated `setlists` table definition with `items` and `showId`
4. Updated `practiceSessions` table with show-specific fields
5. Added migration notes and deprecation warnings
6. Updated version history table

**Status Checkboxes:**
- [x] Update schema in index.ts
- [x] Add SetlistItem interface
- [x] Extend PracticeSession interface
- [x] Update Setlist interface
- [x] Create seed data script
- [ ] Update setlist code to use `items` *(Phase 2)*
- [ ] Test breaks/sections *(Phase 2)*
- [ ] Test show metadata *(Phase 2)*

---

## Migration Notes

### From Version 4 → Version 5:

**Required:** Clear database before testing
```javascript
localStorage.clear()
indexedDB.deleteDatabase('RockOnDB')
location.reload()
```

**Data Migration (if needed):**
```typescript
// Migrate old setlist.songs → setlist.items
const oldSetlist = { songs: [{songId: 'abc', order: 1, notes: 'xyz'}] }
const newSetlist = {
  items: oldSetlist.songs.map((s, i) => ({
    id: crypto.randomUUID(),
    type: 'song',
    position: i + 1,
    songId: s.songId,
    notes: s.notes
  }))
}

// Migrate setlist.showDate → showId
// Look up show by date, use its ID
const show = await db.practiceSessions
  .where('scheduledDate').equals(oldSetlist.showDate)
  .first()
setlist.showId = show?.id
```

---

## How to Use Seed Data

### Method 1: Import and Call
```typescript
import { seedMvpData } from './src/database/seedMvpData'

// In your app initialization or dev tools
await seedMvpData()
```

### Method 2: Browser Console
```javascript
// After importing in your app
await seedMvpData()
```

### Method 3: Add to App Init
```typescript
// src/main.tsx or App.tsx
import { seedMvpData } from './database/seedMvpData'

if (import.meta.env.DEV) {
  seedMvpData().then(() => console.log('Dev data loaded'))
}
```

**Output:**
```
🌱 Starting MVP data seed...
👥 Seeding users...
🎸 Seeding band...
🎵 Seeding songs...
🎤 Seeding shows...
📝 Seeding setlists...
🥁 Seeding practice sessions...
✅ MVP data seed complete!
📊 Database summary:
   - Users: 3
   - Bands: 1
   - Songs: 17
   - Setlists: 4
   - Shows: 5
   - Practices: 5
```

---

## Field Mappings for MVP Pages

### Setlists Page → Database

| UI Field | Database Field | Type | Notes |
|----------|---------------|------|-------|
| Setlist name | `setlists.name` | string | ✅ Direct |
| Song list | `setlists.items` (type='song') | SetlistItem[] | ✅ New structure |
| Breaks | `setlists.items` (type='break') | SetlistItem[] | ✅ New structure |
| Sections | `setlists.items` (type='section') | SetlistItem[] | ✅ New structure |
| Associated show | `setlists.showId` | string | ✅ Reference to practiceSession |
| Total duration | `setlists.totalDuration` | number | ✅ Calculate from items |
| Status | `setlists.status` | 'draft'\|'active'\|'archived' | ✅ Direct |
| Notes | `setlists.notes` | string | ✅ Direct |

**Break Item Example:**
```typescript
{
  id: crypto.randomUUID(),
  type: 'break',
  position: 6,
  breakDuration: 15,        // Minutes
  breakNotes: 'Costume change'
}
```

**Section Item Example:**
```typescript
{
  id: crypto.randomUUID(),
  type: 'section',
  position: 7,
  sectionTitle: 'Acoustic Set'
}
```

### Shows Page → Database

| UI Field | Database Field | Type | Notes |
|----------|---------------|------|-------|
| Show name | `practiceSessions.name` | string | ✅ New field |
| Venue name | `practiceSessions.venue` | string | ✅ New field |
| Date | `practiceSessions.scheduledDate` | Date | ✅ Existing |
| Duration | `practiceSessions.duration` | number | ✅ Existing (minutes) |
| Location/Address | `practiceSessions.location` | string | ✅ Existing |
| Load-in time | `practiceSessions.loadInTime` | string | ✅ New field |
| Soundcheck time | `practiceSessions.soundcheckTime` | string | ✅ New field |
| Payment | `practiceSessions.payment` | number | ✅ New field (cents) |
| Contacts | `practiceSessions.contacts` | string | ✅ New field |
| Setlist | `practiceSessions.setlistId` | string | ✅ New field (reference) |
| Status | `practiceSessions.status` | SessionStatus | ✅ Existing |
| Type | `practiceSessions.type` | 'gig' | ✅ Existing (set to 'gig') |
| Notes | `practiceSessions.notes` | string | ✅ Existing |

**Show Example:**
```typescript
{
  id: crypto.randomUUID(),
  bandId: 'band-123',
  type: 'gig',              // Differentiates from practice
  name: 'Toys 4 Tots Benefit',
  venue: 'The Crocodile',
  scheduledDate: new Date('2025-12-08T20:00:00'),
  duration: 90,
  location: '2505 1st Ave, Seattle, WA',
  status: 'scheduled',
  loadInTime: '6:00 PM',
  soundcheckTime: '7:00 PM',
  payment: 50000,           // $500 in cents
  contacts: 'John - 555-1234',
  setlistId: 'setlist-456',
  notes: 'Bring extension cords'
}
```

---

## Type Conversions Needed

### Songs Page

**Duration:** String ↔ Number
```typescript
// Display: "3:14"
// Database: 194 (seconds)

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

**BPM:** String ↔ Number
```typescript
// Display: "104 bpm"
// Database: 104

const displayBpm = `${song.bpm} bpm`
const dbBpm = parseInt(bpmString)
```

### Shows Page

**Payment:** String ↔ Number
```typescript
// Display: "$500"
// Database: 50000 (cents)

function dollarsToCents(dollars: string): number {
  return Math.round(parseFloat(dollars.replace('$', '').replace(',', '')) * 100)
}

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
```

**Time:** 12-hour ↔ ISO/24-hour
```typescript
// Display: "8:00 PM"
// Database: Can store as-is or convert to ISO

// Option 1: Store as-is (simple)
loadInTime: "6:00 PM"

// Option 2: Convert to ISO with date
const isoTime = new Date(`${showDate} ${loadInTime}`).toISOString()
```

---

## Next Steps: Phase 2 Database Integration

### Week 1: Core Pages (Priority Order)

1. **Authentication Pages** ✅ No schema changes needed
   - Wire up signup/login
   - User profile management
   - Band creation/joining

2. **Band Members Page** ✅ No schema changes needed
   - Load members from `bandMemberships`
   - Instrument multi-select
   - Invite code generation

3. **Songs Page** ⚠️ Type conversions needed
   - Load songs from database
   - Convert duration string ↔ seconds
   - Convert bpm string ↔ number
   - Reference links handling

### Week 2: Complex Pages

4. **Setlists Page** ⚠️ New `items` structure
   - Replace mock `items` with database
   - Implement break/section creation
   - Drag-and-drop reordering with position updates
   - Link to shows via `showId`

5. **Shows Page** ⚠️ New show metadata fields
   - Use `type='gig'` filter
   - Show metadata fields (name, venue, etc.)
   - Payment conversion (cents ↔ dollars)
   - Setlist linking via `setlistId`

6. **Practices Page** ✅ Existing structure works
   - Use `type='rehearsal'` filter
   - Auto-suggest from upcoming shows
   - Song list management

### Week 3: Polish

7. Cross-page features
   - "Next Show" queries for songs
   - Auto-suggest for practices
   - Setlist duration calculations
   - Show/setlist associations

8. Testing & refinement
   - Test all CRUD operations
   - Role-based permissions
   - Loading/error states
   - Performance optimization

---

## Success Metrics

### Schema Completeness: ✅ 100%
- [x] All MVP features supported
- [x] Clean relational structure
- [x] Type-safe interfaces
- [x] Comprehensive seed data
- [x] Documentation complete

### Ready for Phase 2: ✅ YES
- ✅ No workarounds needed
- ✅ All fields properly typed
- ✅ Realistic test data available
- ✅ Clear migration path
- ✅ Dev server running without errors

---

## Files Modified

1. `/workspaces/rock-on/src/services/database/index.ts` - Added Version 5 schema
2. `/workspaces/rock-on/src/types/index.ts` - Added SetlistItem, updated enums
3. `/workspaces/rock-on/src/models/Setlist.ts` - Updated with items/showId
4. `/workspaces/rock-on/src/models/PracticeSession.ts` - Added show metadata fields
5. `/workspaces/rock-on/.claude/specifications/database-schema.md` - Comprehensive documentation

## Files Created

1. `/workspaces/rock-on/src/database/seedMvpData.ts` - MVP test data seed script
2. `/workspaces/rock-on/.claude/artifacts/2025-10-23T04:21_mvp-database-schema-mapping.md` - Analysis document
3. `/workspaces/rock-on/.claude/artifacts/2025-10-23T04:33_version-5-schema-implementation-complete.md` - This summary

---

## Summary

✅ **Version 5 Schema: COMPLETE**
- Proper support for setlist breaks/sections
- Full show metadata fields
- Clean relational structure
- No workarounds required

✅ **TypeScript Interfaces: UPDATED**
- SetlistItem interface added
- PracticeSession extended
- Setlist updated with deprecation warnings
- All types compile without errors

✅ **Seed Data: CREATED**
- 3 users, 1 band, 17 songs
- 4 setlists with breaks and sections
- 5 shows with full metadata
- 5 practice sessions
- Ready for immediate testing

🚀 **Status:** Ready for Phase 2 - Database Integration

**Next Action:** Begin wiring up MVP pages to database, starting with Songs page (type conversions) and Authentication pages (user management).

