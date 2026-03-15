---
title: Proposed Unified Database Schema v2
created: 2025-10-27T17:27
status: PROPOSAL - Awaiting Review
description: Proposed schema refactor separating shows from practices + casting system review
comparison: See unified-database-schema.md for current schema
---

# Proposed Unified Database Schema v2

**PROPOSAL STATUS:** Under review - compares to `unified-database-schema.md`

## Summary of Changes

### 🔴 Breaking Changes

1. **NEW TABLE: `shows`** - Dedicated table for gigs/performances
2. **MODIFIED: `practice_sessions`** - Remove show-specific fields
3. **FIXED: JSON parsing** - Contacts field properly handled

### 🟢 Non-Breaking Changes

4. **VALIDATED: Casting tables** - Existing casting system is well-designed
5. **CLARIFIED: Relationships** - Document all FK relationships clearly

### Why These Changes?

**Problem:** Current `practice_sessions` table has polymorphic design (type='gig' vs type='rehearsal') causing:

- ❌ Sparse columns (half NULL for each type)
- ❌ Mixed business logic
- ❌ JSON parsing bugs (contacts field)
- ❌ Confusing queries (`WHERE type = 'gig'`)

**Solution:** Separate tables for separate entities:

- ✅ `shows` - gigs with venue, payment, contacts
- ✅ `practice_sessions` - rehearsals with objectives, attendance

---

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

---

## Table Index (Updated)

| IndexedDB (Dexie)      | Supabase (PostgreSQL)    | Purpose                 | Status           |
| ---------------------- | ------------------------ | ----------------------- | ---------------- |
| `users`                | `users`                  | User accounts           | ✅ No change     |
| `userProfiles`         | `user_profiles`          | Extended user info      | ✅ No change     |
| `bands`                | `bands`                  | Band entities           | ✅ No change     |
| `bandMemberships`      | `band_memberships`       | User-band relationships | ✅ No change     |
| `inviteCodes`          | `invite_codes`           | Band invitations        | ✅ No change     |
| `songs`                | `songs`                  | Song library            | ✅ No change     |
| `songGroups`           | `song_groups`            | Song variant groups     | ✅ No change     |
| `songGroupMemberships` | `song_group_memberships` | Song-group links        | ✅ No change     |
| `setlists`             | `setlists`               | Performance setlists    | ✅ No change     |
| **`shows`**            | **`shows`**              | **Gigs/performances**   | **🆕 NEW TABLE** |
| `practiceSessions`     | `practice_sessions`      | Rehearsals only         | **🔧 MODIFIED**  |
| `songCastings`         | `song_castings`          | Context casting         | ✅ No change     |
| `songAssignments`      | `song_assignments`       | Member assignments      | ✅ No change     |
| `assignmentRoles`      | `assignment_roles`       | Specific roles          | ✅ No change     |
| `castingTemplates`     | `casting_templates`      | Reusable templates      | ✅ No change     |
| `memberCapabilities`   | `member_capabilities`    | Member skills           | ✅ No change     |

---

## 🆕 NEW: shows table

**Purpose:** Gigs, concerts, performances - distinct from practice sessions

**Why Separate:**

- Different metadata (payment, load-in time, contacts)
- Different business logic (revenue tracking, venue management)
- Different user workflows (show planning vs practice planning)
- No future overlap expected

**Table Names:**

- IndexedDB: `shows`
- Supabase: `shows`

**Fields:**

| Application      | IndexedDB        | Supabase          | Type             | Required | Default     | Description                        |
| ---------------- | ---------------- | ----------------- | ---------------- | -------- | ----------- | ---------------------------------- |
| `id`             | `id`             | `id`              | UUID             | Yes      | auto        | Unique identifier                  |
| `bandId`         | `bandId`         | `band_id`         | UUID             | Yes      | -           | Band ID (FK → bands)               |
| `setlistId`      | `setlistId`      | `setlist_id`      | UUID             | No       | -           | Associated setlist (FK → setlists) |
| `name`           | `name`           | `name`            | string           | Yes      | -           | Show/event name                    |
| `scheduledDate`  | `scheduledDate`  | `scheduled_date`  | Date/TIMESTAMPTZ | Yes      | -           | Performance date/time              |
| `duration`       | `duration`       | `duration`        | number           | Yes      | 120         | Duration in minutes                |
| `venue`          | `venue`          | `venue`           | string           | No       | -           | Venue name                         |
| `location`       | `location`       | `location`        | string           | No       | -           | Full address                       |
| `loadInTime`     | `loadInTime`     | `load_in_time`    | string           | No       | -           | Load-in time (e.g., "6:00 PM")     |
| `soundcheckTime` | `soundcheckTime` | `soundcheck_time` | string           | No       | -           | Soundcheck time                    |
| `payment`        | `payment`        | `payment`         | number           | No       | -           | Payment in cents                   |
| `contacts`       | `contacts`       | `contacts`        | object[]/JSONB   | No       | []          | Contact persons                    |
| `status`         | `status`         | `status`          | enum             | Yes      | 'scheduled' | Show status                        |
| `notes`          | `notes`          | `notes`           | string           | No       | -           | Show notes                         |
| `createdDate`    | `createdDate`    | `created_date`    | Date/TIMESTAMPTZ | Yes      | NOW()       | Creation timestamp                 |
| `updatedDate`    | `updatedDate`    | `updated_date`    | Date/TIMESTAMPTZ | Yes      | NOW()       | Last modification                  |

**Enums:**

- `status`: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

**Contact Object Structure:**

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

**Indexes:**

- Dexie: `++id, bandId, setlistId, scheduledDate, status, venue`
- Supabase: `idx_shows_band_id`, `idx_shows_setlist_id`, `idx_shows_scheduled_date`, `idx_shows_status`

**Constraints (Supabase only):**

- FK `band_id` → `bands(id)` ON DELETE CASCADE
- FK `setlist_id` → `setlists(id)` ON DELETE SET NULL
- CHECK payment >= 0
- CHECK duration > 0

**RLS Policies:**

```sql
-- Users can view shows for their bands
CREATE POLICY shows_select_if_member ON shows
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_id = shows.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Band admins can create shows
CREATE POLICY shows_insert_if_admin ON shows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_id = shows.band_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

-- Band admins can update/delete shows
CREATE POLICY shows_update_if_admin ON shows
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_id = shows.band_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

CREATE POLICY shows_delete_if_admin ON shows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_id = shows.band_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );
```

**Repository Mapping:**

```typescript
// TO Supabase
private mapShowToSupabase(show: Show): any {
  return {
    id: show.id,
    band_id: show.bandId,
    setlist_id: show.setlistId ?? null,
    name: show.name,
    scheduled_date: show.scheduledDate,
    duration: show.duration,
    venue: show.venue ?? null,
    location: show.location ?? null,
    load_in_time: show.loadInTime ?? null,
    soundcheck_time: show.soundcheckTime ?? null,
    payment: show.payment ?? null,
    contacts: show.contacts ? JSON.stringify(show.contacts) : null,  // ← Stringify
    status: show.status,
    notes: show.notes ?? null,
    created_date: show.createdDate,
    updated_date: show.updatedDate
  }
}

// FROM Supabase
private mapShowFromSupabase(row: any): Show {
  return {
    id: row.id,
    bandId: row.band_id,
    setlistId: row.setlist_id ?? undefined,
    name: row.name,
    scheduledDate: new Date(row.scheduled_date),
    duration: row.duration,
    venue: row.venue ?? undefined,
    location: row.location ?? undefined,
    loadInTime: row.load_in_time ?? undefined,
    soundcheckTime: row.soundcheck_time ?? undefined,
    payment: row.payment ?? undefined,
    contacts: row.contacts ? JSON.parse(row.contacts) : undefined,  // ← Parse JSON!
    status: row.status,
    notes: row.notes ?? undefined,
    createdDate: new Date(row.created_date),
    updatedDate: new Date(row.updated_date)
  }
}
```

---

## 🔧 MODIFIED: practice_sessions table

**Purpose:** Rehearsals and practice sessions ONLY (no longer for shows)

**What Changed:**

- ❌ **REMOVED:** `name`, `venue`, `load_in_time`, `soundcheck_time`, `payment`, `contacts`
- ✅ **KEPT:** All practice-specific fields
- ✅ **KEPT:** `type` field for future practice types (recording, writing, etc.)

**Table Names:**

- IndexedDB: `practiceSessions`
- Supabase: `practice_sessions`

**Fields:**

| Application           | IndexedDB             | Supabase               | Type             | Required | Default     | Description                      |
| --------------------- | --------------------- | ---------------------- | ---------------- | -------- | ----------- | -------------------------------- |
| `id`                  | `id`                  | `id`                   | UUID             | Yes      | auto        | Unique identifier                |
| `bandId`              | `bandId`              | `band_id`              | UUID             | Yes      | -           | Band ID (FK → bands)             |
| `setlistId`           | `setlistId`           | `setlist_id`           | UUID             | No       | -           | Practice setlist (FK → setlists) |
| `scheduledDate`       | `scheduledDate`       | `scheduled_date`       | Date/TIMESTAMPTZ | Yes      | -           | Scheduled date/time              |
| `startTime`           | `startTime`           | `start_time`           | Date/TIMESTAMPTZ | No       | -           | Actual start time                |
| `endTime`             | `endTime`             | `end_time`             | Date/TIMESTAMPTZ | No       | -           | Actual end time                  |
| `duration`            | `duration`            | `duration`             | number           | Yes      | 120         | Planned duration (minutes)       |
| `location`            | `location`            | `location`             | string           | No       | -           | Practice location                |
| `type`                | `type`                | `type`                 | enum             | Yes      | 'rehearsal' | Practice type                    |
| `status`              | `status`              | `status`               | enum             | Yes      | 'scheduled' | Session status                   |
| `notes`               | `notes`               | `notes`                | string           | No       | -           | Session notes                    |
| `objectives`          | `objectives`          | `objectives`           | string[]/TEXT[]  | No       | []          | Practice goals                   |
| `completedObjectives` | `completedObjectives` | `completed_objectives` | string[]/TEXT[]  | No       | []          | Completed goals                  |
| `sessionRating`       | `sessionRating`       | `session_rating`       | number           | No       | -           | Rating 1-5                       |
| `songs`               | `songs`               | `songs`                | object[]/JSONB   | No       | []          | Songs practiced                  |
| `attendees`           | `attendees`           | `attendees`            | object[]/JSONB   | No       | []          | Who attended                     |
| `createdDate`         | `createdDate`         | `created_date`         | Date/TIMESTAMPTZ | Yes      | NOW()       | Creation timestamp               |

**Enums:**

- `type`: 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
- `status`: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'

**Indexes:**

- Dexie: `++id, bandId, setlistId, scheduledDate, type, status`
- Supabase: `idx_practice_sessions_band_id`, `idx_practice_sessions_setlist_id`, `idx_practice_sessions_scheduled_date`, `idx_practice_sessions_type`

**Constraints (Supabase only):**

- FK `band_id` → `bands(id)` ON DELETE CASCADE
- FK `setlist_id` → `setlists(id)` ON DELETE SET NULL
- CHECK duration > 0
- CHECK session_rating BETWEEN 1 AND 5

---

## ✅ VALIDATED: setlists table (with updates)

**Table Names:**

- IndexedDB: `setlists`
- Supabase: `setlists`

**Fields:**

| Application         | IndexedDB           | Supabase              | Type             | Required | Default | Description                                  |
| ------------------- | ------------------- | --------------------- | ---------------- | -------- | ------- | -------------------------------------------- |
| `id`                | `id`                | `id`                  | UUID             | Yes      | auto    | Unique identifier                            |
| `name`              | `name`              | `name`                | string           | Yes      | -       | Setlist name                                 |
| `bandId`            | `bandId`            | `band_id`             | UUID             | Yes      | -       | Band ID (FK → bands)                         |
| `showId`            | `showId`            | `show_id`             | UUID             | No       | -       | **Associated show ID (FK → shows)**          |
| `practiceSessionId` | `practiceSessionId` | `practice_session_id` | UUID             | No       | -       | Associated practice (FK → practice_sessions) |
| `sourceSetlistId`   | `sourceSetlistId`   | `source_setlist_id`   | UUID             | No       | -       | Original setlist if forked                   |
| `items`             | `items`             | `items`               | object[]/JSONB   | Yes      | []      | Songs/breaks/sections                        |
| `notes`             | `notes`             | `notes`               | string           | No       | -       | Setlist notes                                |
| `status`            | `status`            | `status`              | enum             | Yes      | 'draft' | Setlist status                               |
| `createdDate`       | `createdDate`       | `created_date`        | Date/TIMESTAMPTZ | Yes      | NOW()   | Creation date                                |
| `lastModified`      | `lastModified`      | `last_modified`       | Date/TIMESTAMPTZ | Yes      | NOW()   | Last modification                            |
| `createdBy`         | `createdBy`         | `created_by`          | UUID             | Yes      | -       | Creator user ID                              |

**Enums:**

- `status`: 'draft' | 'active' | 'archived'

**Constraints (Supabase only):**

- FK `band_id` → `bands(id)` ON DELETE CASCADE
- FK `show_id` → `shows(id)` ON DELETE SET NULL
- FK `practice_session_id` → `practice_sessions(id)` ON DELETE SET NULL
- FK `source_setlist_id` → `setlists(id)` ON DELETE SET NULL (allows tracking even if original deleted)
- FK `created_by` → `users(id)` ON DELETE SET NULL

**Note:** A setlist can be linked to EITHER a show OR a practice, not both.

---

## ✅ VALIDATED: Casting System Tables

The existing casting system is well-designed and doesn't need changes. Here's how it works:

### Song Casting Flow

```
1. Create casting for a context (setlist or practice)
   ↓
2. Assign members to songs
   ↓
3. Define specific roles for each assignment
```

### song_castings table

**Purpose:** Links contexts (setlists, practices) to songs with casting information

**Fields:**

| Application   | IndexedDB     | Supabase       | Type | Description            |
| ------------- | ------------- | -------------- | ---- | ---------------------- |
| `id`          | `id`          | `id`           | UUID | Unique identifier      |
| `contextType` | `contextType` | `context_type` | enum | 'setlist' or 'session' |
| `contextId`   | `contextId`   | `context_id`   | UUID | Setlist or practice ID |
| `songId`      | `songId`      | `song_id`      | UUID | Song ID (FK → songs)   |
| `createdDate` | `createdDate` | `created_date` | Date | Creation date          |
| `createdBy`   | `createdBy`   | `created_by`   | UUID | Creator user ID        |

**Enums:**

- `contextType`: 'setlist' | 'session'

**Example:** "For the 'Rock Classics' setlist, we have casting for 'Sweet Child O' Mine'"

### song_assignments table

**Purpose:** Assigns band members to songs in a specific context

**Fields:**

| Application     | IndexedDB       | Supabase          | Type    | Description                       |
| --------------- | --------------- | ----------------- | ------- | --------------------------------- |
| `id`            | `id`            | `id`              | UUID    | Unique identifier                 |
| `songCastingId` | `songCastingId` | `song_casting_id` | UUID    | Casting ID (FK → song_castings)   |
| `memberId`      | `memberId`      | `member_id`       | UUID    | Member ID (FK → band_memberships) |
| `isPrimary`     | `isPrimary`     | `is_primary`      | boolean | Primary performer                 |
| `isBackup`      | `isBackup`      | `is_backup`       | boolean | Backup performer                  |
| `createdDate`   | `createdDate`   | `created_date`    | Date    | Creation date                     |

**Example:** "John is assigned to play 'Sweet Child O' Mine' in the Rock Classics setlist"

### assignment_roles table

**Purpose:** Specific roles/instruments for each assignment

**Fields:**

| Application    | IndexedDB      | Supabase        | Type   | Description                                     |
| -------------- | -------------- | --------------- | ------ | ----------------------------------------------- |
| `id`           | `id`           | `id`            | UUID   | Unique identifier                               |
| `assignmentId` | `assignmentId` | `assignment_id` | UUID   | Assignment ID (FK → song_assignments)           |
| `role`         | `role`         | `role`          | string | Role/instrument (e.g., "Lead Guitar", "Vocals") |
| `confidence`   | `confidence`   | `confidence`    | number | Confidence level 1-5                            |
| `notes`        | `notes`        | `notes`         | string | Role-specific notes                             |

**Example:** "John plays Lead Guitar (confidence: 4) and Backing Vocals (confidence: 3)"

### casting_templates table

**Purpose:** Reusable casting patterns

**Fields:**

| Application   | IndexedDB     | Supabase       | Type         | Description          |
| ------------- | ------------- | -------------- | ------------ | -------------------- |
| `id`          | `id`          | `id`           | UUID         | Unique identifier    |
| `bandId`      | `bandId`      | `band_id`      | UUID         | Band ID (FK → bands) |
| `name`        | `name`        | `name`         | string       | Template name        |
| `description` | `description` | `description`  | string       | Template description |
| `template`    | `template`    | `template`     | object/JSONB | Template structure   |
| `createdDate` | `createdDate` | `created_date` | Date         | Creation date        |
| `createdBy`   | `createdBy`   | `created_by`   | UUID         | Creator user ID      |

**Example:** "Standard 4-piece band setup: Lead Guitar, Rhythm Guitar, Bass, Drums"

### member_capabilities table

**Purpose:** What instruments/roles each member can perform

**Fields:**

| Application       | IndexedDB         | Supabase           | Type    | Description                       |
| ----------------- | ----------------- | ------------------ | ------- | --------------------------------- |
| `id`              | `id`              | `id`               | UUID    | Unique identifier                 |
| `memberId`        | `memberId`        | `member_id`        | UUID    | Member ID (FK → band_memberships) |
| `instrument`      | `instrument`      | `instrument`       | string  | Instrument/role name              |
| `proficiency`     | `proficiency`     | `proficiency`      | number  | Skill level 1-5                   |
| `isPrimary`       | `isPrimary`       | `is_primary`       | boolean | Primary instrument                |
| `yearsExperience` | `yearsExperience` | `years_experience` | number  | Years of experience               |
| `notes`           | `notes`           | `notes`            | string  | Additional notes                  |

**Example:** "Sarah: Drums (primary, proficiency: 5, 10 years), Percussion (proficiency: 4, 5 years)"

---

## Relationship Diagram

```
users
  ↓ (1:1)
user_profiles

users ←→ band_memberships ←→ bands
  ↓                              ↓
member_capabilities            songs
                                 ↓
                          song_groups
                                 ↓
                            setlists ←→ shows
                                 ↓         ↓
                          song_castings    ↓
                                 ↓         ↓
                          song_assignments ↓
                                 ↓         ↓
                          assignment_roles ↓
                                           ↓
                                    practice_sessions

Forking:
setlists.source_setlist_id → setlists.id

Invitations:
invite_codes → bands
```

---

## Foreign Key Reference

### Core Relationships

| Child Table              | FK Column       | Parent Table  | Parent Column | On Delete |
| ------------------------ | --------------- | ------------- | ------------- | --------- |
| `user_profiles`          | `user_id`       | `users`       | `id`          | CASCADE   |
| `band_memberships`       | `user_id`       | `users`       | `id`          | CASCADE   |
| `band_memberships`       | `band_id`       | `bands`       | `id`          | CASCADE   |
| `invite_codes`           | `band_id`       | `bands`       | `id`          | CASCADE   |
| `songs`                  | `created_by`    | `users`       | `id`          | SET NULL  |
| `songs`                  | `song_group_id` | `song_groups` | `id`          | SET NULL  |
| `song_group_memberships` | `song_group_id` | `song_groups` | `id`          | CASCADE   |
| `song_group_memberships` | `song_id`       | `songs`       | `id`          | CASCADE   |

### Setlist & Show Relationships

| Child Table         | FK Column             | Parent Table        | Parent Column | On Delete    |
| ------------------- | --------------------- | ------------------- | ------------- | ------------ |
| **`shows`**         | **`band_id`**         | **`bands`**         | **`id`**      | **CASCADE**  |
| **`shows`**         | **`setlist_id`**      | **`setlists`**      | **`id`**      | **SET NULL** |
| `setlists`          | `band_id`             | `bands`             | `id`          | CASCADE      |
| **`setlists`**      | **`show_id`**         | **`shows`**         | **`id`**      | **SET NULL** |
| `setlists`          | `practice_session_id` | `practice_sessions` | `id`          | SET NULL     |
| `setlists`          | `source_setlist_id`   | `setlists`          | `id`          | SET NULL     |
| `setlists`          | `created_by`          | `users`             | `id`          | SET NULL     |
| `practice_sessions` | `band_id`             | `bands`             | `id`          | CASCADE      |
| `practice_sessions` | `setlist_id`          | `setlists`          | `id`          | SET NULL     |

### Casting Relationships

| Child Table           | FK Column         | Parent Table       | Parent Column | On Delete |
| --------------------- | ----------------- | ------------------ | ------------- | --------- |
| `song_castings`       | `song_id`         | `songs`            | `id`          | CASCADE   |
| `song_castings`       | `created_by`      | `users`            | `id`          | SET NULL  |
| `song_assignments`    | `song_casting_id` | `song_castings`    | `id`          | CASCADE   |
| `song_assignments`    | `member_id`       | `band_memberships` | `id`          | CASCADE   |
| `assignment_roles`    | `assignment_id`   | `song_assignments` | `id`          | CASCADE   |
| `casting_templates`   | `band_id`         | `bands`            | `id`          | CASCADE   |
| `casting_templates`   | `created_by`      | `users`            | `id`          | SET NULL  |
| `member_capabilities` | `member_id`       | `band_memberships` | `id`          | CASCADE   |

---

## Migration Path

### Step 1: Create shows table

```sql
CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL DEFAULT 120,
  venue TEXT,
  location TEXT,
  load_in_time TEXT,
  soundcheck_time TEXT,
  payment INTEGER CHECK (payment >= 0),
  contacts JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shows_band_id ON shows(band_id);
CREATE INDEX idx_shows_setlist_id ON shows(setlist_id);
CREATE INDEX idx_shows_scheduled_date ON shows(scheduled_date);
CREATE INDEX idx_shows_status ON shows(status);
```

### Step 2: Migrate existing shows from practice_sessions

```sql
INSERT INTO shows (
  id, band_id, setlist_id, name, scheduled_date, duration,
  venue, location, load_in_time, soundcheck_time, payment, contacts,
  status, notes, created_date
)
SELECT
  id, band_id, setlist_id, name, scheduled_date, duration,
  venue, location, load_in_time, soundcheck_time, payment,
  COALESCE(contacts, '[]'::jsonb),
  'scheduled' as status,  -- Default status
  notes, created_date
FROM practice_sessions
WHERE type = 'gig';
```

### Step 3: Update setlists to reference shows

```sql
-- Add show_id column if not exists
ALTER TABLE setlists ADD COLUMN IF NOT EXISTS show_id UUID REFERENCES shows(id) ON DELETE SET NULL;

-- Update setlists that were linked to shows
UPDATE setlists s
SET show_id = ps.id
FROM practice_sessions ps
WHERE s.practice_session_id = ps.id
  AND ps.type = 'gig';

-- Or if using direct setlist_id on practice_sessions:
UPDATE setlists s
SET show_id = sh.id
FROM shows sh
WHERE s.id = sh.setlist_id;
```

### Step 4: Remove show records from practice_sessions

```sql
DELETE FROM practice_sessions WHERE type = 'gig';
```

### Step 5: Drop show-specific columns from practice_sessions

```sql
ALTER TABLE practice_sessions
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS venue,
  DROP COLUMN IF EXISTS load_in_time,
  DROP COLUMN IF EXISTS soundcheck_time,
  DROP COLUMN IF EXISTS payment,
  DROP COLUMN IF EXISTS contacts;
```

### Step 6: Update type enum (optional - for clarity)

```sql
-- Update check constraint to remove 'gig'
ALTER TABLE practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_type_check;

ALTER TABLE practice_sessions
  ADD CONSTRAINT practice_sessions_type_check
  CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson'));
```

---

## Code Changes Required

### 1. Create Show Model

**File:** `src/models/Show.ts` (NEW)

```typescript
export interface Show {
  id: string
  bandId: string
  setlistId?: string
  name: string
  scheduledDate: Date
  duration: number
  venue?: string
  location?: string
  loadInTime?: string
  soundcheckTime?: string
  payment?: number // in cents
  contacts?: ShowContact[]
  status: ShowStatus
  notes?: string
  createdDate: Date
  updatedDate: Date
}

export interface ShowContact {
  id: string
  name: string
  role: string
  phone?: string
  email?: string
  notes?: string
}

export type ShowStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
```

### 2. Update PracticeSession Model

**File:** `src/models/PracticeSession.ts`

```typescript
export interface PracticeSession {
  id: string
  bandId: string
  setlistId?: string
  scheduledDate: Date
  startTime?: Date
  endTime?: Date
  duration: number
  location?: string
  type: PracticeType
  status: PracticeStatus
  notes?: string
  objectives?: string[]
  completedObjectives?: string[]
  sessionRating?: number
  songs?: PracticeSong[]
  attendees?: PracticeAttendee[]
  createdDate: Date
  // REMOVED: name, venue, loadInTime, soundcheckTime, payment, contacts
}

export type PracticeType =
  | 'rehearsal'
  | 'writing'
  | 'recording'
  | 'audition'
  | 'lesson'
export type PracticeStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
```

### 3. Create ShowService

**File:** `src/services/ShowService.ts` (NEW)

Based on SetlistService pattern, create separate service for shows.

### 4. Create ShowRepository methods

**File:** `src/services/data/RemoteRepository.ts` & `LocalRepository.ts`

Add methods:

- `getShows(bandId): Promise<Show[]>`
- `getShow(id): Promise<Show | null>`
- `addShow(show): Promise<Show>`
- `updateShow(id, updates): Promise<Show>`
- `deleteShow(id): Promise<void>`

Plus mapping functions shown above.

### 5. Create Show Hooks

**File:** `src/hooks/useShows.ts` (REPLACE existing)

Create clean show hooks separate from practice hooks.

### 6. Update SyncEngine

**File:** `src/services/data/SyncEngine.ts`

Add:

- `pullShows(bandIds): Promise<void>`
- Update `pullFromRemote()` to include shows

### 7. Update ShowsPage

**File:** `src/pages/NewLayout/ShowsPage.tsx`

Update to use new `Show` model and `ShowService` instead of `PracticeSessionService`.

---

## Testing Checklist

### Database

- [ ] Create shows table in Supabase
- [ ] Migrate existing shows data
- [ ] Drop show columns from practice_sessions
- [ ] Verify all FKs working
- [ ] Test RLS policies

### Repository

- [ ] Test Show CRUD via RemoteRepository
- [ ] Test Show CRUD via LocalRepository
- [ ] Verify JSON.parse on contacts field
- [ ] Test field mapping (camelCase ↔ snake_case)

### Services

- [ ] ShowService.create()
- [ ] ShowService.update()
- [ ] ShowService.delete()
- [ ] ShowService.getByBand()
- [ ] SetlistService.forkSetlist() still works

### Sync

- [ ] Shows sync to Supabase
- [ ] Shows sync from Supabase
- [ ] Practice sessions still sync correctly
- [ ] No conflicts between shows and practices

### UI

- [ ] Create show form works
- [ ] Show list displays correctly
- [ ] Edit show works
- [ ] Delete show works
- [ ] Setlist forking for shows works

---

## Future Extensibility

### Easily Add (Column additions only)

- Show ticket price/link
- Show poster/flyer image
- Show attendance tracking
- Show revenue vs expenses
- Practice session feedback/comments
- Practice session recordings
- Setlist audience ratings

### Requires New Tables

- Tour management (shows grouped into tours)
- Merchandise inventory
- Expense tracking (separate from shows)
- Contract management
- Stage plot/tech rider

### Already Supported

✅ Song casting per context (setlist or practice)
✅ Member capabilities/instruments
✅ Song assignments with roles
✅ Casting templates
✅ Setlist forking
✅ Multi-band support
✅ User permissions/roles

---

## Comparison: Current vs Proposed

| Aspect            | Current (v1)                        | Proposed (v2)              | Benefit                   |
| ----------------- | ----------------------------------- | -------------------------- | ------------------------- |
| **Shows Storage** | `practice_sessions` with type='gig' | Dedicated `shows` table    | ✅ Clean separation       |
| **Show Fields**   | Mixed with practice fields          | Only show-relevant fields  | ✅ No NULL waste          |
| **Contacts**      | ❌ Not parsing JSON                 | ✅ JSON.parse()            | ✅ Fixed bug              |
| **Queries**       | Need `WHERE type = 'gig'`           | Direct table access        | ✅ Simpler queries        |
| **RLS Policies**  | Handle both types                   | Separate policies          | ✅ Better security        |
| **Code**          | Mixed logic                         | Separate services          | ✅ Better maintainability |
| **Casting**       | Already good                        | ✅ No changes needed       | ✅ Well-designed          |
| **Future**        | Hard to extend polymorphic          | Easy to add columns/tables | ✅ Scalable               |

---

## Recommendation

**PROCEED WITH REFACTOR**

**Why:**

1. ✅ Cleaner architecture (separate concerns)
2. ✅ Fixes JSON parsing bug
3. ✅ Better performance (focused indexes)
4. ✅ Easier to maintain
5. ✅ Plans for future features
6. ✅ Migration path is straightforward

**Effort:** Medium

- Database: 1-2 hours (create table, migrate data, update constraints)
- Backend: 3-4 hours (new service, repository methods, sync)
- Frontend: 2-3 hours (update UI to use Show model)
- Testing: 2-3 hours (verify all flows)

**Total:** ~8-12 hours

**Risk:** Low

- Migration script can be tested on local Supabase first
- Old data preserved until verified
- Can rollback if issues found

---

**Status:** PROPOSAL - Awaiting approval to proceed
**Created:** 2025-10-27T17:27
**Next Steps:** Review with team, get approval, begin migration
