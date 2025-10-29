---
title: Unified Database Schema Reference
created: 2025-10-25T21:50
status: Authoritative Source of Truth
description: Single unified reference for ALL database operations (IndexedDB + Supabase)
---

# Unified Database Schema Reference

**CRITICAL**: This is the ONLY authoritative database schema document. All database operations MUST reference this file.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                  (TypeScript camelCase)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Repository Layer                           │
│         (Handles name mapping & type conversion)            │
│  Location: src/services/data/LocalRepository.ts             │
│           src/services/data/RemoteRepository.ts             │
└─────────────────────────────────────────────────────────────┘
                     ↙                ↘
        ┌──────────────────┐    ┌──────────────────┐
        │   IndexedDB      │    │   Supabase       │
        │   (Dexie.js)     │    │   (PostgreSQL)   │
        │   camelCase      │    │   snake_case     │
        │   Local-first    │    │   Remote sync    │
        └──────────────────┘    └──────────────────┘
```

## Naming Convention Rules

| System | Convention | Example | Where Used |
|--------|-----------|---------|------------|
| **Application** | camelCase | `userId`, `createdDate` | TypeScript models, props, state |
| **IndexedDB** | camelCase | `userId`, `createdDate` | Dexie.js table definitions |
| **Supabase** | snake_case | `user_id`, `created_date` | PostgreSQL columns, RLS policies |
| **Repository** | camelCase → snake_case | Automatic mapping | LocalRepository ↔ RemoteRepository |

---

## Table Index

All tables with both naming conventions:

| IndexedDB (Dexie) | Supabase (PostgreSQL) | Purpose |
|-------------------|----------------------|---------|
| `users` | `users` | User accounts |
| `userProfiles` | `user_profiles` | Extended user info |
| `bands` | `bands` | Band entities |
| `bandMemberships` | `band_memberships` | User-band relationships |
| `inviteCodes` | `invite_codes` | Band invitations |
| `songs` | `songs` | Song library |
| `songGroups` | `song_groups` | Song variant groups |
| `songGroupMemberships` | `song_group_memberships` | Song-group links |
| `setlists` | `setlists` | Performance setlists |
| `shows` | `shows` | Live performances/gigs |
| `practiceSessions` | `practice_sessions` | Practice sessions (NO gigs) |
| `songCastings` | `song_castings` | Context casting |
| `songAssignments` | `song_assignments` | Member assignments |
| `assignmentRoles` | `assignment_roles` | Specific roles |
| `castingTemplates` | `casting_templates` | Reusable templates |
| `memberCapabilities` | `member_capabilities` | Member skills |

---

## Complete Table Definitions

### users

**Purpose:** User authentication accounts

**Table Names:**
- IndexedDB: `users`
- Supabase: `users`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `email` | `email` | `email` | string | Yes | - | Email address (unique) |
| `name` | `name` | `name` | string | Yes | - | Display name |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Account creation |
| `lastLogin` | `lastLogin` | `last_login` | Date/TIMESTAMPTZ | No | - | Last login timestamp |
| `authProvider` | `authProvider` | `auth_provider` | string | Yes | 'email' | Auth provider |

**Indexes:**
- Dexie: `++id, email, name, createdDate, lastLogin, authProvider`
- Supabase: `idx_users_email` on `email`

**Constraints (Supabase only):**
- Email format validation regex
- UNIQUE on `email`

**Mapping Notes:**
- All fields use same logical name, just different case
- Repository auto-converts between camelCase ↔ snake_case

---

### user_profiles / userProfiles

**Purpose:** Extended user profile information

**Table Names:**
- IndexedDB: `userProfiles`
- Supabase: `user_profiles`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `userId` | `userId` | `user_id` | UUID | Yes | - | Associated user (FK) |
| `displayName` | `displayName` | `display_name` | string | No | - | Display name override |
| `primaryInstrument` | `primaryInstrument` | `primary_instrument` | string | No | - | Main instrument |
| `instruments` | `instruments` | `instruments` | string[] | No | [] | List of instruments |
| `bio` | `bio` | `bio` | string | No | - | User biography |
| `avatarUrl` | `avatarUrl` | `avatar_url` | string | No | - | Profile picture URL |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Profile creation |
| `updatedDate` | `updatedDate` | `updated_date` | Date/TIMESTAMPTZ | Yes | NOW() | Last modification |

**Indexes:**
- Dexie: `++id, userId, displayName, primaryInstrument, *instruments`
- Supabase: `idx_user_profiles_user_id` on `user_id`

**Constraints (Supabase only):**
- UNIQUE on `user_id`
- FK `user_id` → `users(id)` CASCADE

**Repository Mapping:**
```typescript
// LocalRepository (Dexie) → RemoteRepository (Supabase)
{
  userId: '123',           →  user_id: '123',
  displayName: 'John',     →  display_name: 'John',
  primaryInstrument: 'Guitar'  →  primary_instrument: 'Guitar'
}
```

---

### bands

**Purpose:** Band/group entities

**Table Names:**
- IndexedDB: `bands`
- Supabase: `bands`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `name` | `name` | `name` | string | Yes | - | Band name |
| `description` | `description` | `description` | string | No | - | Band description |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| `updatedDate` | - | `updated_date` | Date/TIMESTAMPTZ | No | - | Last modification (Supabase only) |
| `settings` | `settings` | `settings` | object/JSONB | Yes | {} | Band configuration |
| `isActive` | - | `is_active` | boolean | Yes | true | Active status (Supabase only) |
| `memberIds` | `memberIds` | - | UUID[] | Yes | [] | Member IDs (IndexedDB only - deprecated) |

**Indexes:**
- Dexie: `++id, name, createdDate`
- Supabase: None additional

**Structure Differences:**
- **IndexedDB** uses `memberIds` array (legacy)
- **Supabase** uses separate `band_memberships` table (normalized)

---

### band_memberships / bandMemberships

**Purpose:** Links users to bands with roles and permissions

**Table Names:**
- IndexedDB: `bandMemberships`
- Supabase: `band_memberships`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `userId` | `userId` | `user_id` | UUID | Yes | - | User ID (FK) |
| `bandId` | `bandId` | `band_id` | UUID | Yes | - | Band ID (FK) |
| `role` | `role` | `role` | enum | Yes | 'member' | Member role |
| `permissions` | `permissions` | `permissions` | string[] | Yes | ['member'] | Permission flags |
| `joinedDate` | `joinedDate` | `joined_date` | Date/TIMESTAMPTZ | Yes | NOW() | Join timestamp |
| `status` | `status` | `status` | enum | Yes | 'active' | Membership status |
| `nickname` | - | - | string | No | - | Band-specific nickname |
| `customRole` | - | - | string | No | - | Custom role title |

**Enums:**
- `role`: 'admin' | 'member' | 'viewer'
- `status`: 'active' | 'inactive' | 'pending'

**Indexes:**
- Dexie: `++id, userId, bandId, role, joinedDate, status, *permissions`
- Supabase: `idx_band_memberships_user_id`, `idx_band_memberships_band_id`, `idx_band_memberships_status`

**Constraints (Supabase only):**
- UNIQUE(`user_id`, `band_id`) - One membership per user per band
- FK `user_id` → `users(id)` CASCADE
- FK `band_id` → `bands(id)` CASCADE

---

### songs

**Purpose:** Song library with context support (band or personal)

**Table Names:**
- IndexedDB: `songs`
- Supabase: `songs`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `title` | `title` | `title` | string | Yes | - | Song title |
| `artist` | `artist` | `artist` | string | Yes | - | Artist name |
| `album` | `album` | - | string | No | - | Album name (IndexedDB only) |
| `duration` | `duration` | `duration` | number | Yes | - | Duration in seconds |
| `key` | `key` | `key` | string | Yes | - | Musical key |
| `bpm` | `bpm` | `tempo` | number | Yes | 120 | Beats per minute |
| `timeSignature` | - | `time_signature` | string | No | - | Time signature (Supabase only) |
| `difficulty` | `difficulty` | `difficulty` | number | Yes | 1 | Difficulty (1-5) |
| `guitarTuning` | `guitarTuning` | - | string | No | - | Guitar tuning (IndexedDB only) |
| `genre` | - | `genre` | string | No | - | Musical genre (Supabase only) |
| `lyrics` | `lyrics` | - | string | No | - | Song lyrics (IndexedDB only) |
| `lyricsUrl` | - | `lyrics_url` | string | No | - | Lyrics link (Supabase only) |
| `notes` | `notes` | `notes` | string | No | - | Practice notes |
| `chordsUrl` | - | `chords_url` | string | No | - | Chords/tabs link (Supabase only) |
| `recordingUrl` | - | `recording_url` | string | No | - | Recording link (Supabase only) |
| `chords` | `chords` | - | string[] | No | [] | Chord progression (IndexedDB only) |
| `tags` | `tags` | - | string[] | No | [] | Tags/categories (IndexedDB only) |
| `structure` | `structure` | - | object[] | No | [] | Song structure (IndexedDB only) |
| `referenceLinks` | `referenceLinks` | - | object[] | No | [] | External links (IndexedDB only) |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Creation date |
| `updatedDate` | - | `updated_date` | Date/TIMESTAMPTZ | No | - | Last modification (Supabase only) |
| `lastPracticed` | `lastPracticed` | `last_practiced` | Date/TIMESTAMPTZ | No | - | Last practice date |
| `confidenceLevel` | `confidenceLevel` | `confidence_level` | number | Yes | 1 | Confidence (1-5) |
| `contextType` | `contextType` | `context_type` | enum | Yes | - | 'band' or 'personal' |
| `contextId` | `contextId` | `context_id` | string | Yes | - | Band ID or User ID |
| `createdBy` | `createdBy` | `created_by` | UUID | Yes | - | Creator user ID |
| `visibility` | `visibility` | `visibility` | enum | Yes | 'band_only' | Visibility level |
| `songGroupId` | `songGroupId` | `song_group_id` | UUID | No | - | Linked song group |

**CRITICAL Naming Differences:**
- **BPM field:** IndexedDB uses `bpm`, Supabase uses `tempo`
- **Context field type:** Supabase stores `context_id` as TEXT, IndexedDB as string

**Enums:**
- `contextType`: 'band' | 'personal'
- `visibility`: 'private' | 'band_only' | 'public' (Supabase: 'personal' | 'band' | 'public')

**Indexes:**
- Dexie: `++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId`
- Supabase: `idx_songs_context` on (`context_type`, `context_id`), `idx_songs_created_by`, `idx_songs_song_group_id`

**Context System:**
- When `contextType = 'band'`: `contextId` contains the band's UUID
- When `contextType = 'personal'`: `contextId` contains the user's UUID

**Repository Mapping Example:**
```typescript
// IndexedDB (camelCase)
{
  bpm: 120,
  contextType: 'band',
  contextId: 'uuid-123',
  createdBy: 'uuid-456',
  songGroupId: 'uuid-789'
}

// Supabase (snake_case)
{
  tempo: 120,
  context_type: 'band',
  context_id: 'uuid-123',
  created_by: 'uuid-456',
  song_group_id: 'uuid-789'
}
```

---

### practice_sessions / practiceSessions

**Purpose:** Practice sessions (rehearsals, writing sessions, recording sessions, etc.)

**⚠️ IMPORTANT:** Shows/gigs are now in a separate `shows` table (see below)

**Table Names:**
- IndexedDB: `practiceSessions`
- Supabase: `practice_sessions` ⚠️ **Note the underscore!**

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `bandId` | `bandId` | `band_id` | UUID | Yes | - | Band ID (FK) |
| `setlistId` | - | `setlist_id` | UUID | No | - | Associated setlist (Supabase only) |
| `scheduledDate` | `scheduledDate` | `scheduled_date` | Date/TIMESTAMPTZ | Yes | - | Scheduled date/time |
| `startTime` | - | `start_time` | Date/TIMESTAMPTZ | No | - | Actual start (Supabase only) |
| `endTime` | - | `end_time` | Date/TIMESTAMPTZ | No | - | Actual end (Supabase only) |
| `duration` | `duration` | `duration` | number | Yes | - | Duration in minutes |
| `location` | `location` | `location` | string | No | - | Location/venue |
| `type` | `type` | `type` | enum | Yes | - | Session type |
| `status` | `status` | - | enum | Yes | - | Session status (IndexedDB only) |
| `notes` | `notes` | `notes` | string | No | - | Session notes |
| `objectives` | `objectives` | `objectives` | string[] | No | [] | Session goals |
| `completedObjectives` | `completedObjectives` | `completed_objectives` | string[] | No | [] | Completed goals |
| `sessionRating` | - | `session_rating` | number | No | - | Rating 1-5 (Supabase only) |
| `songs` | `songs` | `songs` | object[]/JSONB | Yes | [] | Songs list |
| `attendees` | `attendees` | `attendees` | object[]/JSONB | Yes | [] | Attendance |
| `createdDate` | - | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Creation (Supabase only) |

**Enums:**
- `type` (Supabase): 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson' (⚠️ NO 'gig' - use shows table)
- `status` (IndexedDB only): 'scheduled' | 'in-progress' | 'completed' | 'cancelled'

**⚠️ CRITICAL:** Table name mismatch!
- ❌ **WRONG:** `practices` (does not exist)
- ✅ **CORRECT:** `practice_sessions`

**Indexes:**
- Dexie: `++id, bandId, scheduledDate, type, status`
- Supabase: `idx_practice_sessions_band_id`, `idx_practice_sessions_setlist_id`, `idx_practice_sessions_scheduled_date`

---

### shows

**Purpose:** Live performance shows/gigs (separated from practice_sessions for clean domain separation)

**Table Names:**
- IndexedDB: `shows`
- Supabase: `shows`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `name` | `name` | `name` | string | Yes | - | Show name (e.g., "Toys 4 Tots Benefit") |
| `bandId` | `bandId` | `band_id` | UUID | Yes | - | Band ID (FK) |
| `setlistId` | `setlistId` | `setlist_id` | UUID | No | - | Associated setlist (FK) |
| `scheduledDate` | `scheduledDate` | `scheduled_date` | Date/TIMESTAMPTZ | Yes | - | Show date/time |
| `duration` | `duration` | `duration` | number | Yes | 120 | Duration in minutes |
| `venue` | `venue` | `venue` | string | No | - | Venue name (e.g., "The Whiskey Room") |
| `location` | `location` | `location` | string | No | - | Full address |
| `loadInTime` | `loadInTime` | `load_in_time` | string | No | - | Load-in time (e.g., "6:00 PM") |
| `soundcheckTime` | `soundcheckTime` | `soundcheck_time` | string | No | - | Soundcheck time (e.g., "7:00 PM") |
| `setTime` | - | `set_time` | string | No | - | Performance start time (Supabase only) |
| `endTime` | - | `end_time` | string | No | - | Performance end time (Supabase only) |
| `payment` | `payment` | `payment` | number | No | - | Payment in cents (e.g., 50000 = $500.00) |
| `contacts` | `contacts` | `contacts` | ShowContact[]/JSONB | No | [] | Venue contacts (see JSONB handling below) |
| `status` | `status` | `status` | enum | Yes | 'upcoming' | Show status |
| `notes` | `notes` | `notes` | string | No | - | Show notes |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Creation timestamp |
| `updatedDate` | `updatedDate` | `updated_date` | Date/TIMESTAMPTZ | Yes | NOW() | Last modification |
| `createdBy` | - | `created_by` | UUID | Yes | - | Creator user ID (Supabase only) |

**ShowContact Interface:**
```typescript
{
  id: string,
  name: string,
  role: string,        // e.g., "Venue Manager", "Sound Engineer"
  phone?: string,
  email?: string,
  notes?: string
}
```

**Enums:**
- `status`: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

**Indexes:**
- Dexie: `++id, name, bandId, setlistId, scheduledDate, status`
- Supabase: `idx_shows_band_id`, `idx_shows_setlist_id`, `idx_shows_scheduled_date`, `idx_shows_status`

**Constraints (Supabase only):**
- FK `band_id` → `bands(id)` CASCADE
- FK `setlist_id` → `setlists(id)` SET NULL
- FK `created_by` → `auth.users(id)`
- CHECK `payment` >= 0

**Migration Note:**
- Created 2025-10-28 via migration `20251028000000_create_shows_table.sql`
- Migrated existing `type='gig'` records from `practice_sessions`
- `practice_sessions` no longer stores shows/gigs

---

### setlists

**Purpose:** Performance setlists

**Table Names:**
- IndexedDB: `setlists`
- Supabase: `setlists`

**Fields:**

| Application | IndexedDB | Supabase | Type | Required | Default | Description |
|-------------|-----------|----------|------|----------|---------|-------------|
| `id` | `id` | `id` | UUID | Yes | auto | Unique identifier |
| `name` | `name` | `name` | string | Yes | - | Setlist name |
| `bandId` | `bandId` | `band_id` | UUID | Yes | - | Band ID (FK) |
| `showId` | `showId` | `show_id` | UUID | No | - | Associated show ID |
| `showDate` | `showDate` | - | Date | No | - | Show date (deprecated) |
| `venue` | `venue` | - | string | No | - | Venue (deprecated) |
| `songs` | `songs` | - | object[] | Yes | [] | Songs (deprecated - use items) |
| `items` | `items` | - | object[] | Yes | [] | Ordered songs/breaks/sections |
| `totalDuration` | `totalDuration` | - | number | Yes | calc | Total duration seconds |
| `notes` | `notes` | `notes` | string | No | - | Setlist notes |
| `status` | `status` | `status` | enum | Yes | 'draft' | Setlist status |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes | NOW() | Creation date |
| `lastModified` | `lastModified` | `last_modified` | Date/TIMESTAMPTZ | Yes | NOW() | Last modification |
| `createdBy` | - | `created_by` | UUID | Yes | - | Creator user ID (Supabase only) |

**Enums:**
- `status`: 'draft' | 'active' | 'archived'

**Indexes:**
- Dexie: `++id, name, bandId, showId, status, createdDate, lastModified`
- Supabase: `idx_setlists_band_id`, `idx_setlists_show_id`

---

## Repository Layer Mapping

**Location:**
- `src/services/data/LocalRepository.ts` (IndexedDB/Dexie)
- `src/services/data/RemoteRepository.ts` (Supabase)

### Auto-Mapping Functions

```typescript
// Example mapping in RemoteRepository

// TO Supabase (camelCase → snake_case)
private mapSongToSupabase(song: Song): any {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    tempo: song.bpm,                    // Field name change!
    context_type: song.contextType,     // camelCase → snake_case
    context_id: song.contextId,
    created_by: song.createdBy,
    song_group_id: song.songGroupId,
    created_date: song.createdDate,
    last_practiced: song.lastPracticed,
    confidence_level: song.confidenceLevel
    // ... etc
  }
}

// FROM Supabase (snake_case → camelCase)
private mapSongFromSupabase(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: row.tempo,                     // Field name change!
    contextType: row.context_type,      // snake_case → camelCase
    contextId: row.context_id,
    createdBy: row.created_by,
    songGroupId: row.song_group_id,
    createdDate: row.created_date,
    lastPracticed: row.last_practiced,
    confidenceLevel: row.confidence_level
    // ... etc
  }
}
```

### Key Mapping Patterns

1. **Simple snake_case ↔ camelCase:**
   - `user_id` ↔ `userId`
   - `created_date` ↔ `createdDate`
   - `band_id` ↔ `bandId`

2. **Field name changes:**
   - `tempo` (Supabase) ↔ `bpm` (IndexedDB)
   - Any other semantic differences

3. **Type conversions:**
   - `context_id` TEXT (Supabase) ↔ `contextId` string (IndexedDB)
   - `permissions` TEXT[] (Supabase) ↔ `permissions` string[] (IndexedDB)
   - `settings` JSONB (Supabase) ↔ `settings` object (IndexedDB)

### JSONB Field Handling

**⚠️ CRITICAL:** Supabase PostgreSQL JSONB columns automatically handle JSON serialization.

**DO NOT use `JSON.stringify()` or `JSON.parse()`** when working with JSONB columns!

#### Why JSONB is Special

PostgreSQL JSONB columns:
- Store JSON data in a binary format
- **Automatically serialize** JavaScript objects on INSERT/UPDATE
- **Automatically deserialize** to JavaScript objects on SELECT
- Support JSON operators and indexing

#### Correct Pattern

```typescript
// ✅ CORRECT: Let Supabase handle JSON serialization
private mapShowToSupabase(show: Partial<Show>): any {
  return {
    contacts: show.contacts ?? null,  // Pass object directly
    // Supabase automatically converts: object → JSONB
  }
}

private mapShowFromSupabase(row: any): Show {
  return {
    contacts: row.contacts ?? undefined,  // Already an object!
    // Supabase automatically converts: JSONB → object
  }
}
```

#### Incorrect Pattern (DO NOT USE)

```typescript
// ❌ WRONG: Manual JSON serialization causes errors
private mapShowToSupabase(show: Partial<Show>): any {
  return {
    contacts: show.contacts ? JSON.stringify(show.contacts) : null,
    // This creates a JSON STRING in JSONB (double-encoded)
  }
}

private mapShowFromSupabase(row: any): Show {
  return {
    contacts: row.contacts ? JSON.parse(row.contacts) : undefined,
    // Error: row.contacts is already an object, not a string!
  }
}
```

#### JSONB Fields in Schema

| Table | Field | Type | Handling |
|-------|-------|------|----------|
| `shows` | `contacts` | ShowContact[] / JSONB | Pass objects directly |
| `practice_sessions` | `songs` | object[] / JSONB | Pass arrays directly |
| `practice_sessions` | `attendees` | object[] / JSONB | Pass arrays directly |
| `bands` | `settings` | object / JSONB | Pass object directly |
| `setlists` | `items` | object[] / JSONB | Pass arrays directly (IndexedDB only) |

#### Testing JSONB Fields

```bash
# Check JSONB column type
docker exec supabase_db_rock-on psql -U postgres -d postgres \
  -c "SELECT pg_typeof(contacts) FROM shows LIMIT 1;"
# Should return: jsonb

# Check JSONB value (already parsed)
docker exec supabase_db_rock-on psql -U postgres -d postgres \
  -c "SELECT contacts FROM shows WHERE id = 'some-uuid';"
# Returns: [] or [{...}] (not a string!)
```

---

## Usage Guidelines

### When Writing SQL (Supabase)

**ALWAYS use snake_case:**
```sql
✅ CORRECT:
SELECT user_id, created_date, band_id
FROM band_memberships
WHERE user_id = '123';

❌ WRONG:
SELECT userId, createdDate, bandId
FROM bandMemberships
WHERE userId = '123';
```

### When Writing TypeScript (Application/IndexedDB)

**ALWAYS use camelCase:**
```typescript
✅ CORRECT:
const membership = {
  userId: '123',
  bandId: 'abc',
  createdDate: new Date()
};
await db.bandMemberships.add(membership);

❌ WRONG:
const membership = {
  user_id: '123',
  band_id: 'abc',
  created_date: new Date()
};
await db.band_memberships.add(membership);
```

### When Using Repository Pattern

**Let the repository handle mapping:**
```typescript
✅ CORRECT - Application code uses camelCase:
const song = {
  title: 'Wonderwall',
  artist: 'Oasis',
  bpm: 120,              // Application uses 'bpm'
  contextType: 'band',
  contextId: bandId,
  createdBy: userId
};

// Repository automatically maps to Supabase:
await repository.addSong(song);
// → Internally converts bpm → tempo, contextType → context_type, etc.
```

---

## Quick Reference: Critical Differences

### Table Names

| Concept | IndexedDB | Supabase | Note |
|---------|-----------|----------|------|
| Practice sessions | `practiceSessions` | `practice_sessions` | **Underscore in Supabase!** |
| All others | Same (camelCase) | Same (snake_case) | Just case difference |

### Field Names

| Concept | IndexedDB | Supabase | Note |
|---------|-----------|----------|------|
| Tempo/BPM | `bpm` | `tempo` | **Different field name!** |
| User foreign key | `userId` | `user_id` | Case only |
| Band foreign key | `bandId` | `band_id` | Case only |
| Created date | `createdDate` | `created_date` | Case only |
| Song group | `songGroupId` | `song_group_id` | Case only |

### Special Cases

**Songs Context:**
- Supabase stores `context_id` as **TEXT** (not UUID)
- When comparing: Must cast `auth.uid()::text`

**Band Memberships:**
- Supabase has UNIQUE constraint on (`user_id`, `band_id`)
- IndexedDB allows duplicates (handle in app logic)

---

## Migration & Sync

### How Data Flows

```
User Action (TypeScript/camelCase)
       ↓
SyncRepository
       ↓
LocalRepository.addSong(camelCase)
       ↓
IndexedDB (stores as camelCase)
       ↓
SyncEngine queues sync
       ↓
RemoteRepository.addSong(camelCase)
       ↓
mapSongToSupabase(snake_case)
       ↓
Supabase INSERT (snake_case)
```

### Sync Direction

**Local → Remote:**
- Application creates data in camelCase
- Stored in IndexedDB as camelCase
- Repository maps to snake_case
- Synced to Supabase

**Remote → Local:**
- Supabase returns snake_case
- Repository maps to camelCase
- Stored in IndexedDB as camelCase
- Application receives camelCase

---

## Testing Checklist

When validating database operations:

**IndexedDB (DevTools → Application → IndexedDB → RockOnDB):**
- [ ] Check table name is camelCase (e.g., `bandMemberships`)
- [ ] Check field names are camelCase (e.g., `userId`, `createdDate`)
- [ ] Verify data structure matches TypeScript models

**Supabase (Dashboard → Table Editor):**
- [ ] Check table name is snake_case (e.g., `band_memberships`)
- [ ] Check column names are snake_case (e.g., `user_id`, `created_date`)
- [ ] Run test queries with correct column names

**Repository Mapping:**
- [ ] Add test data via repository
- [ ] Verify IndexedDB has camelCase
- [ ] Verify Supabase has snake_case
- [ ] Verify values are identical (just different case)

---

## Deprecated Schemas

**DO NOT USE:**
- `.claude/specifications/database-schema.md` (IndexedDB only - incomplete)
- `.claude/specifications/supabase-schema.md` (Supabase only - incomplete)

**USE ONLY:**
- `.claude/specifications/unified-database-schema.md` (THIS FILE)

---

**Last Updated:** 2025-10-25T21:50
**Maintained By:** Claude Code Development Team
**Status:** Authoritative Source of Truth
