---
title: Unified Database Schema Reference
created: 2025-10-25T21:50
updated: 2026-03-15T21:32 (Schema audit corrections + social-catalog new tables)
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

| System          | Convention             | Example                   | Where Used                          |
| --------------- | ---------------------- | ------------------------- | ----------------------------------- |
| **Application** | camelCase              | `userId`, `createdDate`   | TypeScript models, props, state     |
| **IndexedDB**   | camelCase              | `userId`, `createdDate`   | Dexie.js table definitions          |
| **Supabase**    | snake_case             | `user_id`, `created_date` | PostgreSQL columns, RLS policies    |
| **Repository**  | camelCase → snake_case | Automatic mapping         | LocalRepository ↔ RemoteRepository |

---

## Table Index

All tables with both naming conventions:

| IndexedDB (Dexie)      | Supabase (PostgreSQL)    | Purpose                                   |
| ---------------------- | ------------------------ | ----------------------------------------- |
| `users`                | `users`                  | User accounts                             |
| `userProfiles`         | `user_profiles`          | Extended user info                        |
| `bands`                | `bands`                  | Band entities                             |
| `bandMemberships`      | `band_memberships`       | User-band relationships                   |
| `inviteCodes`          | `invite_codes`           | Band invitations                          |
| `songs`                | `songs`                  | Song library                              |
| `songGroups`           | `song_groups`            | Song variant groups                       |
| `songGroupMemberships` | `song_group_memberships` | Song-group links                          |
| `setlists`             | `setlists`               | Performance setlists                      |
| `shows`                | `shows`                  | Live performances/gigs                    |
| `practiceSessions`     | `practice_sessions`      | Practice sessions (NO gigs)               |
| `songCastings`         | `song_castings`          | Context casting                           |
| `songAssignments`      | `song_assignments`       | Member assignments                        |
| `assignmentRoles`      | `assignment_roles`       | Specific roles                            |
| `castingTemplates`     | `casting_templates`      | Reusable templates                        |
| `memberCapabilities`   | `member_capabilities`    | Member skills                             |
| `songPersonalNotes`    | `song_personal_notes`    | Per-user private song notes               |
| `songNoteEntries`      | `song_note_entries`      | Band-visible practice log entries         |
| N/A                    | `audit_log`              | Complete change history (Supabase only)   |
| N/A                    | `jam_sessions`           | Ephemeral jam sessions (Supabase only)    |
| N/A                    | `jam_participants`       | Jam session participants (Supabase only)  |
| N/A                    | `jam_song_matches`       | Pre-computed song matches (Supabase only) |

---

## Complete Table Definitions

### users

**Purpose:** User authentication accounts

**Table Names:**

- IndexedDB: `users`
- Supabase: `users`

**Fields:**

| Application     | IndexedDB      | Supabase          | Type             | Required | Default | Description                            |
| --------------- | -------------- | ----------------- | ---------------- | -------- | ------- | -------------------------------------- |
| `id`            | `id`           | `id`              | UUID             | Yes      | auto    | Unique identifier                      |
| `email`         | `email`        | `email`           | string           | Yes      | -       | Email address (unique)                 |
| `name`          | `name`         | `name`            | string           | Yes      | -       | Display name                           |
| `createdDate`   | `createdDate`  | `created_date`    | Date/TIMESTAMPTZ | Yes      | NOW()   | Account creation                       |
| `lastLogin`     | `lastLogin`    | `last_login`      | Date/TIMESTAMPTZ | No       | -       | Last login timestamp                   |
| `authProvider`  | `authProvider` | `auth_provider`   | string           | Yes      | 'email' | Auth provider                          |
| `accountTier`   | -              | `account_tier`    | enum             | Yes      | 'free'  | Account tier (Supabase only)           |
| `tierUpdatedAt` | -              | `tier_updated_at` | Date/TIMESTAMPTZ | No       | NOW()   | When tier last changed (Supabase only) |

**Indexes:**

- Dexie: `++id, email, name, createdDate, lastLogin, authProvider`
- Supabase: `idx_users_email` on `email`

**Constraints (Supabase only):**

- Email format validation regex
- UNIQUE on `email`
- CHECK `account_tier IN ('free', 'pro')`

**Mapping Notes:**

- `accountTier` / `tierUpdatedAt` are Supabase-only tier fields; not synced to IndexedDB

---

### user_profiles / userProfiles

**Purpose:** Extended user profile information

**Table Names:**

- IndexedDB: `userProfiles`
- Supabase: `user_profiles`

**Fields:**

| Application         | IndexedDB           | Supabase             | Type             | Required | Default | Description           |
| ------------------- | ------------------- | -------------------- | ---------------- | -------- | ------- | --------------------- |
| `id`                | `id`                | `id`                 | UUID             | Yes      | auto    | Unique identifier     |
| `userId`            | `userId`            | `user_id`            | UUID             | Yes      | -       | Associated user (FK)  |
| `displayName`       | `displayName`       | `display_name`       | string           | No       | -       | Display name override |
| `primaryInstrument` | `primaryInstrument` | `primary_instrument` | string           | No       | -       | Main instrument       |
| `instruments`       | `instruments`       | `instruments`        | string[]         | No       | []      | List of instruments   |
| `bio`               | `bio`               | `bio`                | string           | No       | -       | User biography        |
| `avatarUrl`         | `avatarUrl`         | `avatar_url`         | string           | No       | -       | Profile picture URL   |
| `createdDate`       | `createdDate`       | `created_date`       | Date/TIMESTAMPTZ | Yes      | NOW()   | Profile creation      |
| `updatedDate`       | `updatedDate`       | `updated_date`       | Date/TIMESTAMPTZ | Yes      | NOW()   | Last modification     |

**Indexes:**

- Dexie: `++id, userId, displayName, primaryInstrument, *instruments`
- Supabase: `idx_user_profiles_user_id` on `user_id`

**Constraints (Supabase only):**

- UNIQUE on `user_id`
- FK `user_id` → `users(id)` CASCADE

---

### bands

**Purpose:** Band/group entities

**Table Names:**

- IndexedDB: `bands`
- Supabase: `bands`

**Fields:**

| Application   | IndexedDB     | Supabase       | Type             | Required | Default | Description                          |
| ------------- | ------------- | -------------- | ---------------- | -------- | ------- | ------------------------------------ |
| `id`          | `id`          | `id`           | UUID             | Yes      | auto    | Unique identifier                    |
| `name`        | `name`        | `name`         | string           | Yes      | -       | Band name                            |
| `description` | `description` | `description`  | string           | No       | -       | Band description                     |
| `createdBy`   | -             | `created_by`   | UUID             | No       | -       | Creator user ID (Supabase only)      |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation timestamp                   |
| `updatedDate` | -             | `updated_date` | Date/TIMESTAMPTZ | No       | -       | Last modification (Supabase only)    |
| `settings`    | `settings`    | `settings`     | object/JSONB     | Yes      | {}      | Band configuration                   |
| `isActive`    | -             | `is_active`    | boolean          | Yes      | true    | Active status (Supabase only)        |
| `memberIds`   | `memberIds`   | -              | UUID[]           | Yes      | []      | Member IDs (IndexedDB only — legacy) |

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

| Application   | IndexedDB     | Supabase      | Type             | Required | Default    | Description       |
| ------------- | ------------- | ------------- | ---------------- | -------- | ---------- | ----------------- |
| `id`          | `id`          | `id`          | UUID             | Yes      | auto       | Unique identifier |
| `userId`      | `userId`      | `user_id`     | UUID             | Yes      | -          | User ID (FK)      |
| `bandId`      | `bandId`      | `band_id`     | UUID             | Yes      | -          | Band ID (FK)      |
| `role`        | `role`        | `role`        | enum             | Yes      | 'member'   | Member role       |
| `permissions` | `permissions` | `permissions` | string[]         | Yes      | ['member'] | Permission flags  |
| `joinedDate`  | `joinedDate`  | `joined_date` | Date/TIMESTAMPTZ | Yes      | NOW()      | Join timestamp    |
| `status`      | `status`      | `status`      | enum             | Yes      | 'active'   | Membership status |

**Enums:**

- `role`: 'admin' | 'member' | 'viewer'
- `status`: 'active' | 'inactive' | 'pending'

**Indexes:**

- Dexie: `++id, [userId+bandId], userId, bandId, role, joinedDate, status, *permissions`
  - **CRITICAL:** `[userId+bandId]` is a compound unique index (Version 8+)
  - Prevents duplicate memberships for same user+band combination
  - Mirrors Supabase UNIQUE constraint
- Supabase: `idx_band_memberships_user_id`, `idx_band_memberships_band_id`, `idx_band_memberships_status`

**Constraints:**

- **IndexedDB (Version 8+):** Compound unique index on `[userId+bandId]`
- **Supabase:** UNIQUE(`user_id`, `band_id`) — One membership per user per band
- FK `user_id` → `users(id)` CASCADE
- FK `band_id` → `bands(id)` CASCADE

---

### songs

**Purpose:** Song library with context support (band or personal)

**Table Names:**

- IndexedDB: `songs`
- Supabase: `songs`

**Fields:**

| Application        | IndexedDB         | Supabase            | Type             | Required | Default    | Description                                                    |
| ------------------ | ----------------- | ------------------- | ---------------- | -------- | ---------- | -------------------------------------------------------------- |
| `id`               | `id`              | `id`                | UUID             | Yes      | auto       | Unique identifier                                              |
| `title`            | `title`           | `title`             | string           | Yes      | -          | Song title                                                     |
| `artist`           | `artist`          | `artist`            | string           | Yes      | -          | Artist name                                                    |
| `album`            | `album`           | -                   | string           | No       | -          | Album name (IndexedDB only)                                    |
| `duration`         | `duration`        | `duration`          | number           | Yes      | -          | Duration in seconds                                            |
| `key`              | `key`             | `key`               | string           | Yes      | -          | Musical key                                                    |
| `bpm`              | `bpm`             | `tempo`             | number           | Yes      | 120        | Beats per minute                                               |
| `timeSignature`    | -                 | `time_signature`    | string           | No       | -          | Time signature (Supabase only)                                 |
| `difficulty`       | `difficulty`      | `difficulty`        | number           | Yes      | 1          | Difficulty (1-5)                                               |
| `guitarTuning`     | `guitarTuning`    | `guitar_tuning`     | string           | No       | 'Standard' | Guitar tuning (both systems)                                   |
| `genre`            | -                 | `genre`             | string           | No       | -          | Musical genre (Supabase only)                                  |
| `lyrics`           | `lyrics`          | -                   | string           | No       | -          | Song lyrics (IndexedDB only)                                   |
| `lyricsUrl`        | -                 | `lyrics_url`        | string           | No       | -          | Lyrics link (Supabase only)                                    |
| `notes`            | `notes`           | `notes`             | string           | No       | -          | Practice notes                                                 |
| `chordsUrl`        | -                 | `chords_url`        | string           | No       | -          | Chords/tabs link (Supabase only)                               |
| `recordingUrl`     | -                 | `recording_url`     | string           | No       | -          | Recording link (Supabase only)                                 |
| `chords`           | `chords`          | -                   | string[]         | No       | []         | Chord progression (IndexedDB only)                             |
| `tags`             | `tags`            | -                   | string[]         | No       | []         | Tags/categories (IndexedDB only)                               |
| `structure`        | `structure`       | -                   | object[]         | No       | []         | Song structure (IndexedDB only)                                |
| `referenceLinks`   | `referenceLinks`  | `reference_links`   | object[]/JSONB   | No       | []         | External links (both systems)                                  |
| `createdDate`      | `createdDate`     | `created_date`      | Date/TIMESTAMPTZ | Yes      | NOW()      | Creation date                                                  |
| `updatedDate`      | -                 | `updated_date`      | Date/TIMESTAMPTZ | No       | -          | Last modification (Supabase only)                              |
| `lastPracticed`    | `lastPracticed`   | `last_practiced`    | Date/TIMESTAMPTZ | No       | -          | Last practice date                                             |
| `confidenceLevel`  | `confidenceLevel` | `confidence_level`  | number           | Yes      | 1          | Confidence (1-5)                                               |
| `contextType`      | `contextType`     | `context_type`      | enum             | Yes      | -          | 'band' or 'personal'                                           |
| `contextId`        | `contextId`       | `context_id`        | string           | Yes      | -          | Band ID or User ID                                             |
| `createdBy`        | `createdBy`       | `created_by`        | UUID             | Yes      | -          | Creator user ID                                                |
| `visibility`       | `visibility`      | `visibility`        | enum             | Yes      | 'band'     | Visibility level                                               |
| `songGroupId`      | `songGroupId`     | `song_group_id`     | UUID             | No       | -          | Linked song group                                              |
| `normalizedTitle`  | -                 | `normalized_title`  | string           | No       | computed   | Normalized title for jam matching (Supabase generated column)  |
| `normalizedArtist` | -                 | `normalized_artist` | string           | No       | computed   | Normalized artist for jam matching (Supabase generated column) |
| `version`          | `version`         | `version`           | number           | No       | 1          | Version for conflict detection                                 |
| `lastModifiedBy`   | `lastModifiedBy`  | `last_modified_by`  | UUID             | No       | -          | Last modifier user ID                                          |

**CRITICAL Naming Differences:**

- **BPM field:** IndexedDB uses `bpm`, Supabase uses `tempo`
- **Guitar tuning:** IndexedDB uses `guitarTuning`, Supabase uses `guitar_tuning` — present in BOTH systems
- **Reference links:** IndexedDB uses `referenceLinks`, Supabase uses `reference_links` (JSONB) — present in BOTH systems
- **Context field type:** Supabase stores `context_id` as TEXT, IndexedDB as string

**Enums:**

- `contextType`: 'band' | 'personal'
- `visibility`: 'personal' | 'band' | 'public' (**unified across both systems**)

**Indexes:**

- Dexie: `++id, title, artist, key, difficulty, createdDate, lastPracticed, confidenceLevel, contextType, contextId, createdBy, visibility, songGroupId`
- Supabase: `idx_songs_context` on (`context_type`, `context_id`), `idx_songs_created_by`, `idx_songs_song_group_id`, `idx_songs_normalized` on (`normalized_title`, `normalized_artist`)

**Context System:**

- When `contextType = 'band'`: `contextId` contains the band's UUID
- When `contextType = 'personal'`: `contextId` contains the user's UUID

**Normalized Columns:**

- `normalized_title` and `normalized_artist` are Supabase **generated columns** (STORED)
- Computed via `normalize_text()` SQL function (strips leading articles, punctuation, lowercases)
- Used exclusively for jam session song matching — never displayed in UI
- Not present in IndexedDB or TypeScript models

**Repository Mapping Example:**

```typescript
// IndexedDB (camelCase)
{
  bpm: 120,
  guitarTuning: 'Drop D',
  contextType: 'band',
  contextId: 'uuid-123',
  createdBy: 'uuid-456',
  visibility: 'band',
  referenceLinks: [{ icon: 'youtube', url: '...' }]
}

// Supabase (snake_case)
{
  tempo: 120,
  guitar_tuning: 'Drop D',
  context_type: 'band',
  context_id: 'uuid-123',
  created_by: 'uuid-456',
  visibility: 'band',
  reference_links: [{ icon: 'youtube', url: '...' }]
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

| Application           | IndexedDB             | Supabase               | Type             | Required | Default | Description                                |
| --------------------- | --------------------- | ---------------------- | ---------------- | -------- | ------- | ------------------------------------------ |
| `id`                  | `id`                  | `id`                   | UUID             | Yes      | auto    | Unique identifier                          |
| `bandId`              | `bandId`              | `band_id`              | UUID             | Yes      | -       | Band ID (FK)                               |
| `setlistId`           | -                     | `setlist_id`           | UUID             | No       | -       | Associated setlist (Supabase only)         |
| `scheduledDate`       | `scheduledDate`       | `scheduled_date`       | Date/TIMESTAMPTZ | Yes      | -       | Scheduled date/time                        |
| `startTime`           | -                     | `start_time`           | Date/TIMESTAMPTZ | No       | -       | Actual start (Supabase only)               |
| `endTime`             | -                     | `end_time`             | Date/TIMESTAMPTZ | No       | -       | Actual end (Supabase only)                 |
| `duration`            | `duration`            | `duration`             | number           | Yes      | -       | Duration in minutes                        |
| `location`            | `location`            | `location`             | string           | No       | -       | Location/venue                             |
| `type`                | `type`                | `type`                 | enum             | Yes      | -       | Session type                               |
| `status`              | `status`              | -                      | enum             | Yes      | -       | Session status (IndexedDB only)            |
| `notes`               | `notes`               | `notes`                | string           | No       | -       | Session notes                              |
| `wrapupNotes`         | -                     | `wrapup_notes`         | string           | No       | -       | Post-session wrap-up notes (Supabase only) |
| `objectives`          | `objectives`          | `objectives`           | string[]         | No       | []      | Session goals                              |
| `completedObjectives` | `completedObjectives` | `completed_objectives` | string[]         | No       | []      | Completed goals                            |
| `sessionRating`       | -                     | `session_rating`       | number           | No       | -       | Rating 1-5 (Supabase only)                 |
| `songs`               | `songs`               | `songs`                | object[]/JSONB   | Yes      | []      | Songs list                                 |
| `attendees`           | `attendees`           | `attendees`            | object[]/JSONB   | Yes      | []      | Attendance                                 |
| `createdDate`         | -                     | `created_date`         | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation (Supabase only)                   |
| `version`             | `version`             | `version`              | number           | No       | 1       | Version for conflict detection             |
| `lastModifiedBy`      | `lastModifiedBy`      | `last_modified_by`     | UUID             | No       | -       | Last modifier user ID                      |

**Enums:**

- `type` (Supabase): 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson' (⚠️ NO 'gig' — use shows table)
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

| Application      | IndexedDB        | Supabase           | Type                | Required | Default    | Description                               |
| ---------------- | ---------------- | ------------------ | ------------------- | -------- | ---------- | ----------------------------------------- |
| `id`             | `id`             | `id`               | UUID                | Yes      | auto       | Unique identifier                         |
| `name`           | `name`           | `name`             | string              | Yes      | -          | Show name (e.g., "Toys 4 Tots Benefit")   |
| `bandId`         | `bandId`         | `band_id`          | UUID                | Yes      | -          | Band ID (FK)                              |
| `setlistId`      | `setlistId`      | `setlist_id`       | UUID                | No       | -          | Associated setlist (FK)                   |
| `scheduledDate`  | `scheduledDate`  | `scheduled_date`   | Date/TIMESTAMPTZ    | Yes      | -          | Show date/time                            |
| `duration`       | `duration`       | `duration`         | number              | Yes      | 120        | Duration in minutes                       |
| `venue`          | `venue`          | `venue`            | string              | No       | -          | Venue name (e.g., "The Whiskey Room")     |
| `location`       | `location`       | `location`         | string              | No       | -          | Full address                              |
| `gigType`        | `gigType`        | `gig_type`         | string              | No       | -          | Gig type/category                         |
| `loadInTime`     | `loadInTime`     | `load_in_time`     | string              | No       | -          | Load-in time (e.g., "6:00 PM")            |
| `soundcheckTime` | `soundcheckTime` | `soundcheck_time`  | string              | No       | -          | Soundcheck time (e.g., "7:00 PM")         |
| `setTime`        | -                | `set_time`         | string              | No       | -          | Performance start time (Supabase only)    |
| `endTime`        | -                | `end_time`         | string              | No       | -          | Performance end time (Supabase only)      |
| `payment`        | `payment`        | `payment`          | number              | No       | -          | Payment in cents (e.g., 50000 = $500.00)  |
| `contacts`       | `contacts`       | `contacts`         | ShowContact[]/JSONB | No       | []         | Venue contacts (see JSONB handling below) |
| `status`         | `status`         | `status`           | enum                | Yes      | 'upcoming' | Show status                               |
| `notes`          | `notes`          | `notes`            | string              | No       | -          | Show notes                                |
| `createdDate`    | `createdDate`    | `created_date`     | Date/TIMESTAMPTZ    | Yes      | NOW()      | Creation timestamp                        |
| `updatedDate`    | `updatedDate`    | `updated_date`     | Date/TIMESTAMPTZ    | Yes      | NOW()      | Last modification                         |
| `createdBy`      | -                | `created_by`       | UUID                | Yes      | -          | Creator user ID (Supabase only)           |
| `version`        | `version`        | `version`          | number              | No       | 1          | Version for conflict detection            |
| `lastModifiedBy` | `lastModifiedBy` | `last_modified_by` | UUID                | No       | -          | Last modifier user ID                     |

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

---

### setlists

**Purpose:** Performance setlists (band or personal context)

**Table Names:**

- IndexedDB: `setlists`
- Supabase: `setlists`

**Fields:**

| Application       | IndexedDB        | Supabase            | Type             | Required | Default | Description                                          |
| ----------------- | ---------------- | ------------------- | ---------------- | -------- | ------- | ---------------------------------------------------- |
| `id`              | `id`             | `id`                | UUID             | Yes      | auto    | Unique identifier                                    |
| `name`            | `name`           | `name`              | string           | Yes      | -       | Setlist name                                         |
| `bandId`          | `bandId`         | `band_id`           | UUID             | No       | -       | Band ID (FK) — nullable for personal setlists        |
| `contextType`     | -                | `context_type`      | enum             | Yes      | 'band'  | 'band' or 'personal' (Supabase only)                 |
| `contextId`       | -                | `context_id`        | string           | No       | -       | userId (personal) or bandId (band) (Supabase only)   |
| `showId`          | `showId`         | `show_id`           | UUID             | No       | -       | Associated show ID                                   |
| `showDate`        | `showDate`       | -                   | Date             | No       | -       | Show date (deprecated)                               |
| `venue`           | `venue`          | -                   | string           | No       | -       | Venue (deprecated)                                   |
| `songs`           | `songs`          | -                   | object[]         | Yes      | []      | Songs (deprecated — use items)                       |
| `items`           | `items`          | `items`             | object[]/JSONB   | Yes      | []      | Ordered songs/breaks/sections (both systems)         |
| `totalDuration`   | `totalDuration`  | -                   | number           | Yes      | calc    | Total duration seconds (IndexedDB only)              |
| `notes`           | `notes`          | `notes`             | string           | No       | -       | Setlist notes                                        |
| `status`          | `status`         | `status`            | enum             | Yes      | 'draft' | Setlist status                                       |
| `tags`            | -                | `tags`              | string[]         | No       | []      | Tags e.g. ['jam'] (Supabase only)                    |
| `jamSessionId`    | -                | `jam_session_id`    | UUID             | No       | -       | Source jam session FK (Supabase only)                |
| `forkedFrom`      | -                | `forked_from`       | UUID             | No       | -       | Setlist this was forked from (Supabase only)         |
| `forkCount`       | -                | `fork_count`        | number           | No       | 0       | Number of times this has been forked (Supabase only) |
| `sourceSetlistId` | -                | `source_setlist_id` | UUID             | No       | -       | Template/duplication source (Supabase only)          |
| `createdDate`     | `createdDate`    | `created_date`      | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation date                                        |
| `lastModified`    | `lastModified`   | `last_modified`     | Date/TIMESTAMPTZ | Yes      | NOW()   | Last modification (**NOT** `updated_date`)           |
| `createdBy`       | -                | `created_by`        | UUID             | Yes      | -       | Creator user ID (Supabase only)                      |
| `version`         | `version`        | `version`           | number           | No       | 1       | Version for conflict detection                       |
| `lastModifiedBy`  | `lastModifiedBy` | `last_modified_by`  | UUID             | No       | -       | Last modifier user ID                                |

**⚠️ CRITICAL — Timestamp field name:**

- Setlists use `last_modified` (NOT `updated_date`)
- All other tables use `updated_date`

**⚠️ CRITICAL — `items` field:**

- `items` is present in **both** IndexedDB and Supabase (as JSONB)
- Contains the ordered song/break/section list

**⚠️ CRITICAL — `band_id` is nullable:**

- Personal setlists have `band_id = NULL`
- The constraint ensures: if `context_type = 'band'` then `band_id IS NOT NULL`; if `context_type = 'personal'` then `context_id IS NOT NULL`

**Enums:**

- `status`: 'draft' | 'active' | 'archived'
- `contextType` (Supabase): 'band' | 'personal'

**Indexes:**

- Dexie: `++id, name, bandId, showId, status, createdDate, lastModified`
- Supabase: `idx_setlists_band_id`, `idx_setlists_show_id`, `idx_setlists_source_setlist_id`

---

### song_personal_notes / songPersonalNotes

**Purpose:** Per-user private notes on a song, scoped per band context. One record per (song, user, band) combination.

**Table Names:**

- IndexedDB: `songPersonalNotes`
- Supabase: `song_personal_notes`

**Fields:**

| Application   | IndexedDB     | Supabase       | Type             | Required | Default | Description                    |
| ------------- | ------------- | -------------- | ---------------- | -------- | ------- | ------------------------------ |
| `id`          | `id`          | `id`           | UUID             | Yes      | auto    | Unique identifier              |
| `songId`      | `songId`      | `song_id`      | UUID             | Yes      | -       | Song FK                        |
| `userId`      | `userId`      | `user_id`      | UUID             | Yes      | -       | User FK (owner)                |
| `bandId`      | `bandId`      | `band_id`      | UUID             | Yes      | -       | Band context FK                |
| `content`     | `content`     | `content`      | string           | No       | -       | Note text                      |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation date                  |
| `updatedDate` | `updatedDate` | `updated_date` | Date/TIMESTAMPTZ | Yes      | NOW()   | Last modification              |
| `version`     | `version`     | `version`      | number           | No       | 1       | Version for conflict detection |

**Constraints (Supabase only):**

- UNIQUE(`song_id`, `user_id`, `band_id`)
- FK `song_id` → `songs(id)` CASCADE
- FK `user_id` → `users(id)` CASCADE
- FK `band_id` → `bands(id)` CASCADE

**RLS:**

- Users can only access their own personal notes (`user_id = auth.uid()`)

**Indexes:**

- Supabase: `idx_song_personal_notes_song`, `idx_song_personal_notes_user`, `idx_song_personal_notes_band`

---

### song_note_entries / songNoteEntries

**Purpose:** Jira-style practice log entries for songs. Can be personal (private) or band-visible. May be linked to a practice session or show.

**Table Names:**

- IndexedDB: `songNoteEntries`
- Supabase: `song_note_entries`

**Fields:**

| Application   | IndexedDB     | Supabase       | Type             | Required | Default | Description                       |
| ------------- | ------------- | -------------- | ---------------- | -------- | ------- | --------------------------------- |
| `id`          | `id`          | `id`           | UUID             | Yes      | auto    | Unique identifier                 |
| `songId`      | `songId`      | `song_id`      | UUID             | Yes      | -       | Song FK                           |
| `userId`      | `userId`      | `user_id`      | UUID             | Yes      | -       | Author FK                         |
| `bandId`      | `bandId`      | `band_id`      | UUID             | Yes      | -       | Band context FK                   |
| `sessionType` | `sessionType` | `session_type` | enum             | No       | -       | 'practice' or 'show'              |
| `sessionId`   | `sessionId`   | `session_id`   | UUID             | No       | -       | FK to practice/show (polymorphic) |
| `content`     | `content`     | `content`      | string           | Yes      | -       | Entry text                        |
| `visibility`  | `visibility`  | `visibility`   | enum             | Yes      | 'band'  | 'personal' or 'band'              |
| `createdDate` | `createdDate` | `created_date` | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation date                     |
| `updatedDate` | -             | `updated_date` | Date/TIMESTAMPTZ | No       | -       | Last modification (Supabase only) |
| `version`     | `version`     | `version`      | number           | No       | 1       | Version for conflict detection    |

**Enums:**

- `sessionType`: 'practice' | 'show'
- `visibility`: 'personal' | 'band'

**RLS:**

- Personal entries (`visibility='personal'`): visible only to author
- Band entries (`visibility='band'`): visible to all band members
- Authors can manage their own entries; band admins can delete any entry

**Indexes:**

- Supabase: `idx_song_note_entries_song`, `idx_song_note_entries_user`, `idx_song_note_entries_band`, `idx_song_note_entries_session`, `idx_song_note_entries_created`

---

### jam_sessions (Supabase Only)

**Purpose:** Ephemeral collaborative jam sessions where users find common songs from their personal catalogs.

**Table Names:**

- IndexedDB: N/A (not cached locally)
- Supabase: `jam_sessions`

**Fields:**

| Application | IndexedDB | Supabase                | Type        | Required | Default  | Description                                             |
| ----------- | --------- | ----------------------- | ----------- | -------- | -------- | ------------------------------------------------------- |
| N/A         | N/A       | `id`                    | UUID        | Yes      | auto     | Unique identifier                                       |
| N/A         | N/A       | `short_code`            | TEXT        | Yes      | -        | 6-char alphanumeric join code (UNIQUE)                  |
| N/A         | N/A       | `name`                  | TEXT        | No       | -        | Optional session name                                   |
| N/A         | N/A       | `host_user_id`          | UUID        | Yes      | -        | Hosting user FK                                         |
| N/A         | N/A       | `status`                | enum        | Yes      | 'active' | Session state                                           |
| N/A         | N/A       | `created_date`          | TIMESTAMPTZ | Yes      | NOW()    | Creation timestamp                                      |
| N/A         | N/A       | `expires_at`            | TIMESTAMPTZ | Yes      | -        | Expiry timestamp (24h free / 7d pro)                    |
| N/A         | N/A       | `saved_setlist_id`      | UUID        | No       | -        | FK to setlist if session was saved                      |
| N/A         | N/A       | `view_token`            | TEXT        | No       | -        | SHA-256 hashed token for anon read-only access (UNIQUE) |
| N/A         | N/A       | `view_token_expires_at` | TIMESTAMPTZ | No       | -        | Expiry for anonymous view token                         |
| N/A         | N/A       | `settings`              | JSONB       | No       | {}       | Session config (matchThreshold, maxParticipants, etc.)  |
| N/A         | N/A       | `version`               | INTEGER     | No       | 1        | Version for conflict detection                          |
| N/A         | N/A       | `last_modified_by`      | UUID        | No       | -        | Last modifier user ID                                   |

**Enums:**

- `status`: 'active' | 'expired' | 'saved'

**RLS:**

- Host and active participants can SELECT
- Only host can INSERT, UPDATE, DELETE
- Anonymous access only via Edge Function (not via direct Supabase queries)

**Indexes:**

- `idx_jam_sessions_host` on `host_user_id`
- `idx_jam_sessions_short_code` on `short_code`
- `idx_jam_sessions_status` on `status`
- `idx_jam_sessions_view_token` on `view_token` WHERE `view_token IS NOT NULL`

---

### jam_participants (Supabase Only)

**Purpose:** Tracks which users have joined a jam session and what catalog contexts they are sharing.

**Table Names:**

- IndexedDB: N/A
- Supabase: `jam_participants`

**Fields:**

| Application | IndexedDB | Supabase          | Type        | Required | Default  | Description                                                                     |
| ----------- | --------- | ----------------- | ----------- | -------- | -------- | ------------------------------------------------------------------------------- |
| N/A         | N/A       | `id`              | UUID        | Yes      | auto     | Unique identifier                                                               |
| N/A         | N/A       | `jam_session_id`  | UUID        | Yes      | -        | Jam session FK                                                                  |
| N/A         | N/A       | `user_id`         | UUID        | Yes      | -        | Participant user FK                                                             |
| N/A         | N/A       | `joined_date`     | TIMESTAMPTZ | Yes      | NOW()    | When they joined                                                                |
| N/A         | N/A       | `status`          | enum        | Yes      | 'active' | Participation state                                                             |
| N/A         | N/A       | `shared_contexts` | JSONB       | Yes      | []       | Which catalogs they're sharing — e.g., `[{"type":"personal","id":"user-uuid"}]` |

**Enums:**

- `status`: 'active' | 'left' | 'kicked'

**Constraints:**

- UNIQUE(`jam_session_id`, `user_id`)

**RLS:**

- Active participants can SELECT all participants in their session
- Users can INSERT themselves; host can DELETE participants

**Indexes:**

- `idx_jam_participants_session` on `jam_session_id`
- `idx_jam_participants_user` on `user_id`

---

### jam_song_matches (Supabase Only)

**Purpose:** Pre-computed common song matches across all participants in a jam session. Never stores raw song catalog data from participants — only the canonical match representation.

**Table Names:**

- IndexedDB: N/A
- Supabase: `jam_song_matches`

**Fields:**

| Application | IndexedDB | Supabase            | Type        | Required | Default | Description                                                                                           |
| ----------- | --------- | ------------------- | ----------- | -------- | ------- | ----------------------------------------------------------------------------------------------------- |
| N/A         | N/A       | `id`                | UUID        | Yes      | auto    | Unique identifier                                                                                     |
| N/A         | N/A       | `jam_session_id`    | UUID        | Yes      | -       | Jam session FK                                                                                        |
| N/A         | N/A       | `canonical_title`   | TEXT        | Yes      | -       | Normalized title used to match                                                                        |
| N/A         | N/A       | `canonical_artist`  | TEXT        | Yes      | -       | Normalized artist used to match                                                                       |
| N/A         | N/A       | `display_title`     | TEXT        | Yes      | -       | Human-readable title for UI                                                                           |
| N/A         | N/A       | `display_artist`    | TEXT        | Yes      | -       | Human-readable artist for UI                                                                          |
| N/A         | N/A       | `match_confidence`  | enum        | Yes      | 'exact' | Match quality indicator                                                                               |
| N/A         | N/A       | `is_confirmed`      | BOOLEAN     | Yes      | true    | false = pending host confirmation for fuzzy matches                                                   |
| N/A         | N/A       | `matched_songs`     | JSONB       | Yes      | []      | Per-participant match detail — `[{"userId":"...","songId":"...","rawTitle":"...","rawArtist":"..."}]` |
| N/A         | N/A       | `participant_count` | INTEGER     | Yes      | 0       | How many participants have this song                                                                  |
| N/A         | N/A       | `computed_at`       | TIMESTAMPTZ | Yes      | NOW()   | When this match was computed                                                                          |

**Enums:**

- `match_confidence`: 'exact' | 'fuzzy' | 'manual'

**RLS:**

- Active participants can SELECT
- No INSERT/UPDATE/DELETE from application layer — computed by `JamSessionService` via service_role

**Indexes:**

- `idx_jam_song_matches_session` on `jam_session_id`
- `idx_jam_song_matches_canonical` on (`canonical_title`, `canonical_artist`)

---

## Repository Layer Mapping

**Location:**

- `src/services/data/LocalRepository.ts` (IndexedDB/Dexie)
- `src/services/data/RemoteRepository.ts` (Supabase)

### Auto-Mapping Functions

```typescript
// Example mapping in RemoteRepository

// TO Supabase (camelCase → snake_case)
private mapSongToSupabase(song: Partial<Song>): Record<string, any> {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    tempo: song.bpm,                    // Field name change!
    guitar_tuning: song.guitarTuning,   // Both systems have this field
    reference_links: song.referenceLinks, // Both systems have this field
    context_type: song.contextType,     // camelCase → snake_case
    context_id: song.contextId,
    created_by: song.createdBy,
    visibility: song.visibility,        // Same enum values in both systems
    song_group_id: song.songGroupId,
    created_date: song.createdDate,
    last_practiced: song.lastPracticed,
    confidence_level: song.confidenceLevel
    // normalized_title, normalized_artist: generated by DB — never sent
  }
}

// FROM Supabase (snake_case → camelCase)
private mapSongFromSupabase(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: row.tempo,                     // Field name change!
    guitarTuning: row.guitar_tuning,    // Both systems have this field
    referenceLinks: row.reference_links ?? [], // Both systems have this field
    contextType: row.context_type,      // snake_case → camelCase
    contextId: row.context_id,
    createdBy: row.created_by,
    visibility: row.visibility,
    songGroupId: row.song_group_id,
    createdDate: row.created_date,
    lastPracticed: row.last_practiced,
    confidenceLevel: row.confidence_level
    // normalized_title, normalized_artist: not mapped to application model
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

3. **Type conversions:**
   - `context_id` TEXT (Supabase) ↔ `contextId` string (IndexedDB)
   - `permissions` TEXT[] (Supabase) ↔ `permissions` string[] (IndexedDB)
   - `settings` JSONB (Supabase) ↔ `settings` object (IndexedDB)

### JSONB Field Handling

**⚠️ CRITICAL:** Supabase PostgreSQL JSONB columns automatically handle JSON serialization.

**DO NOT use `JSON.stringify()` or `JSON.parse()`** when working with JSONB columns!

PostgreSQL JSONB columns:

- **Automatically serialize** JavaScript objects on INSERT/UPDATE
- **Automatically deserialize** to JavaScript objects on SELECT

```typescript
// ✅ CORRECT: Let Supabase handle JSON serialization
private mapShowToSupabase(show: Partial<Show>): any {
  return {
    contacts: show.contacts ?? null,  // Pass object directly
  }
}
```

#### JSONB Fields in Schema

| Table               | Field             | Type                  | Handling                            |
| ------------------- | ----------------- | --------------------- | ----------------------------------- |
| `shows`             | `contacts`        | ShowContact[] / JSONB | Pass objects directly               |
| `practice_sessions` | `songs`           | object[] / JSONB      | Pass arrays directly                |
| `practice_sessions` | `attendees`       | object[] / JSONB      | Pass arrays directly                |
| `bands`             | `settings`        | object / JSONB        | Pass object directly                |
| `setlists`          | `items`           | object[] / JSONB      | Pass arrays directly (both systems) |
| `songs`             | `reference_links` | object[] / JSONB      | Pass arrays directly (both systems) |
| `jam_sessions`      | `settings`        | object / JSONB        | Pass object directly                |
| `jam_participants`  | `shared_contexts` | object[] / JSONB      | Pass arrays directly                |
| `jam_song_matches`  | `matched_songs`   | object[] / JSONB      | Pass arrays directly                |

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

| Concept           | IndexedDB          | Supabase            | Note                        |
| ----------------- | ------------------ | ------------------- | --------------------------- |
| Practice sessions | `practiceSessions` | `practice_sessions` | **Underscore in Supabase!** |
| All others        | Same (camelCase)   | Same (snake_case)   | Just case difference        |

### Field Names

| Concept          | IndexedDB        | Supabase          | Note                      |
| ---------------- | ---------------- | ----------------- | ------------------------- |
| Tempo/BPM        | `bpm`            | `tempo`           | **Different field name!** |
| User foreign key | `userId`         | `user_id`         | Case only                 |
| Band foreign key | `bandId`         | `band_id`         | Case only                 |
| Created date     | `createdDate`    | `created_date`    | Case only                 |
| Song group       | `songGroupId`    | `song_group_id`   | Case only                 |
| Guitar tuning    | `guitarTuning`   | `guitar_tuning`   | Both systems — case only  |
| Reference links  | `referenceLinks` | `reference_links` | Both systems — case only  |

### Version Defaults

All tables with `version` tracking default to `DEFAULT 1` in Supabase (not 0).

### Special Cases

**Songs Context:**

- Supabase stores `context_id` as **TEXT** (not UUID)
- When comparing: Must cast `auth.uid()::text`

**Songs Visibility:**

- Enum is `'personal' | 'band' | 'public'` in **both** IndexedDB and Supabase
- ❌ `'private'` does not exist; ❌ `'band_only'` does not exist

**Setlists Timestamp:**

- Setlists use `last_modified` — **NOT** `updated_date`
- All other tables use `updated_date`

**Setlists `band_id`:**

- Nullable — personal setlists have `band_id = NULL`
- Band setlists still require `band_id IS NOT NULL` (enforced by check constraint)

**Band Memberships:**

- Supabase has UNIQUE constraint on (`user_id`, `band_id`)
- IndexedDB allows duplicates (handle in app logic)
- `nickname` and `customRole` fields do **NOT exist** in either system

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

### Jam Session / Supabase-Only Tables

Jam session tables (`jam_sessions`, `jam_participants`, `jam_song_matches`) are **not synced to IndexedDB**. All jam session operations go directly to Supabase via `RemoteRepository`. These tables use Supabase Realtime for live updates.

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

## Audit & Version Control

### audit_log (Supabase Only)

**Purpose:** Complete change history for all records (like git history)

**Table Names:**

- IndexedDB: N/A (not needed locally)
- Supabase: `audit_log`

**Fields:**

| Application | IndexedDB | Supabase      | Type        | Required | Default | Description                                                |
| ----------- | --------- | ------------- | ----------- | -------- | ------- | ---------------------------------------------------------- |
| N/A         | N/A       | `id`          | UUID        | Yes      | auto    | Unique identifier                                          |
| N/A         | N/A       | `table_name`  | TEXT        | Yes      | -       | Which table was modified                                   |
| N/A         | N/A       | `record_id`   | TEXT        | Yes      | -       | ID of the modified record                                  |
| N/A         | N/A       | `action`      | TEXT        | Yes      | -       | INSERT, UPDATE, or DELETE                                  |
| N/A         | N/A       | `user_id`     | UUID        | Yes      | -       | Who made the change (FK)                                   |
| N/A         | N/A       | `user_name`   | TEXT        | Yes      | -       | Denormalized user name (fast queries)                      |
| N/A         | N/A       | `changed_at`  | TIMESTAMPTZ | Yes      | NOW()   | When the change occurred                                   |
| N/A         | N/A       | `old_values`  | JSONB       | No       | -       | Previous record state (NULL for INSERT)                    |
| N/A         | N/A       | `new_values`  | JSONB       | No       | -       | New record state (NULL for DELETE)                         |
| N/A         | N/A       | `band_id`     | UUID        | No       | -       | Band context for RLS filtering (NULL for personal records) |
| N/A         | N/A       | `client_info` | JSONB       | No       | -       | Optional metadata (browser, IP, etc.)                      |

**Indexes:**

- `idx_audit_log_table_record` on (`table_name`, `record_id`, `changed_at DESC`)
- `idx_audit_log_band_date` on (`band_id`, `changed_at DESC`)
- `idx_audit_log_user_date` on (`user_id`, `changed_at DESC`)
- `idx_audit_log_changed_at` on (`changed_at DESC`)

**Realtime Configuration:**

- Added to `supabase_realtime` publication
- Replica identity set to FULL

**Row-Level Security:**

- Band members can view audit logs for their bands
- Only system (via triggers) can INSERT
- No one can UPDATE or DELETE

### Version Tracking

All main tables (songs, setlists, shows, practice_sessions, jam_sessions) include:

- `version` (number): **Defaults to 1** (NOT 0). Auto-incremented on each UPDATE.
- `lastModifiedBy` / `last_modified_by` (UUID): User who last modified the record.

**Conflict Resolution:**

- When updating a record, check if version matches expected
- If version mismatch detected, fetch latest from server
- Currently: Last-write-wins (Post-MVP will add conflict UI)

---

## Deprecated Schemas

**DO NOT USE:**

- `.claude/specifications/database-schema.md` (IndexedDB only — incomplete)
- `.claude/specifications/supabase-schema.md` (Supabase only — incomplete)

**USE ONLY:**

- `.claude/specifications/unified-database-schema.md` (THIS FILE)

---

**Last Updated:** 2026-03-15T21:32 (Schema audit corrections: fixed guitar_tuning, reference_links, visibility enum, version defaults, gig_type, setlist fields, removed ghost band_membership fields; added song_personal_notes, song_note_entries, bands.created_by; added social-catalog tables: jam_sessions, jam_participants, jam_song_matches; added users.account_tier stub)
**Maintained By:** Claude Code Development Team
**Status:** Authoritative Source of Truth
