---
title: Shows Implementation - Complete Plan
created: 2025-10-27T00:18
prompt: User requested comprehensive plan for implementing shows table based on gap analysis, specifications, and workflow requirements
status: Ready for Implementation
priority: P0 - Critical (Blocking Production)
---

# Shows Implementation - Complete Plan

## Executive Summary

**Problem**: Shows (concerts/gigs) are fully functional in IndexedDB but **cannot sync to Supabase** due to:
1. Missing 'gig' type in type constraint
2. Missing 6 show-specific columns
3. Incomplete setlist-show relationship

**Impact**:
- ❌ Shows trapped in local storage only
- ❌ No multi-device sync for show data
- ❌ Payment, venue, contact data lost on sync attempts
- ❌ High risk of data loss

**Solution**: 3 SQL migrations + RemoteRepository updates = 1-1.5 hours work

---

## Background Context

### What are Shows?

Shows are implemented as a **polymorphic entity** using the `practice_sessions` table:
- When `type='gig'` → it's a show/concert/performance
- When `type='rehearsal'` → it's a practice session
- Show-specific fields (venue, payment, contacts) are only populated for gigs

### Current State

**IndexedDB (Local Storage)** ✅
```typescript
// PracticeSession with type='gig'
{
  id: "uuid",
  type: "gig",              // ✅ Works locally
  name: "Toys 4 Tots",      // ✅ Works locally
  venue: "The Whiskey Room",// ✅ Works locally
  payment: 50000,           // ✅ Works locally
  contacts: [...],          // ✅ Works locally
  // ... all other fields
}
```

**Supabase (Remote)** ❌
```sql
-- Constraint violation!
CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson'))
-- Missing: 'gig'

-- Missing columns: name, venue, load_in_time, soundcheck_time, payment, contacts
```

**Result**: Shows work perfectly in UI but fail to sync silently in background.

---

## Implementation Plan

### Overview

**Phase 1: Critical Database Fixes** (45 min)
- Task 1: Add 'gig' to type constraint
- Task 2: Add show-specific columns
- Task 3: Add setlist-show foreign key

**Phase 2: Application Layer Updates** (30 min)
- Task 4: Update RemoteRepository field mappings
- Task 5: Update unified schema documentation

**Phase 3: Testing & Validation** (30 min)
- Task 6: Test show creation and sync
- Task 7: Verify data integrity in Supabase

**Phase 4: Optional Enhancements** (2-3 hours, if needed)
- Task 8: Implement setlist forking feature

**Total Estimated Time**: 1.5-4.5 hours (depending on optional features)

---

## Phase 1: Critical Database Fixes

### Task 1: Add 'gig' Type to Constraint (5 min)

**Priority**: P0 - Blocking
**File**: `supabase/migrations/20251027000001_add_gig_type.sql`

**Problem**: Current constraint blocks 'gig' type
```sql
-- Current (WRONG)
CONSTRAINT session_type_check CHECK (
  type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')
)
```

**Solution**: Add 'gig' to allowed types

**Migration Script**:
```sql
-- Migration: Add 'gig' type to practice_sessions
-- Created: 2025-10-27
-- Purpose: Enable shows/concerts to sync to Supabase

BEGIN;

-- Drop existing constraint
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS session_type_check;

-- Add new constraint with 'gig' type
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')
  );

-- Update column comment to reflect new type
COMMENT ON COLUMN public.practice_sessions.type IS
  'Session type: rehearsal, writing, recording, audition, lesson, or gig (show/concert/performance)';

COMMIT;
```

**Validation Query**:
```sql
-- Test that 'gig' type is now accepted
INSERT INTO practice_sessions (
  band_id,
  scheduled_date,
  duration,
  type
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with test band ID
  NOW() + INTERVAL '7 days',
  120,
  'gig' -- Should not fail anymore
) RETURNING id, type;

-- Clean up test data
DELETE FROM practice_sessions WHERE type = 'gig' AND band_id = '00000000-0000-0000-0000-000000000000';
```

**Success Criteria**:
- ✅ Migration runs without errors
- ✅ Test insert with type='gig' succeeds
- ✅ All existing sessions remain intact

---

### Task 2: Add Show-Specific Columns (15 min)

**Priority**: P0 - Data loss prevention
**File**: `supabase/migrations/20251027000002_add_show_fields.sql`

**Problem**: Show-specific fields have nowhere to go in Supabase
- `name` (show/event name)
- `venue` (venue name, different from generic `location`)
- `loadInTime` (load-in time string)
- `soundcheckTime` (soundcheck time string)
- `payment` (payment in cents)
- `contacts` (array of contact objects with name, role, phone, email)

**Solution**: Add optional columns to `practice_sessions` table

**Migration Script**:
```sql
-- Migration: Add show-specific fields to practice_sessions
-- Created: 2025-10-27
-- Purpose: Store show/concert metadata (only used when type='gig')

BEGIN;

-- Add show-specific columns
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS load_in_time TEXT,
  ADD COLUMN IF NOT EXISTS soundcheck_time TEXT,
  ADD COLUMN IF NOT EXISTS payment INTEGER,
  ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- Add constraints
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT payment_positive_check
    CHECK (payment IS NULL OR payment >= 0);

-- Add indexes for common show queries
CREATE INDEX IF NOT EXISTS idx_practice_sessions_name
  ON public.practice_sessions(name)
  WHERE name IS NOT NULL AND type = 'gig';

CREATE INDEX IF NOT EXISTS idx_practice_sessions_venue
  ON public.practice_sessions(venue)
  WHERE venue IS NOT NULL AND type = 'gig';

CREATE INDEX IF NOT EXISTS idx_practice_sessions_type_scheduled
  ON public.practice_sessions(type, scheduled_date DESC)
  WHERE type = 'gig';

-- Add column comments
COMMENT ON COLUMN public.practice_sessions.name IS
  'Show/event name (only used when type=''gig'')';
COMMENT ON COLUMN public.practice_sessions.venue IS
  'Venue name for shows (only used when type=''gig''). Different from generic location field.';
COMMENT ON COLUMN public.practice_sessions.load_in_time IS
  'Load-in time string, e.g., "6:00 PM" (only used when type=''gig'')';
COMMENT ON COLUMN public.practice_sessions.soundcheck_time IS
  'Soundcheck time string, e.g., "7:00 PM" (only used when type=''gig'')';
COMMENT ON COLUMN public.practice_sessions.payment IS
  'Payment amount in cents (only used when type=''gig''). Example: 50000 = $500.00';
COMMENT ON COLUMN public.practice_sessions.contacts IS
  'Array of contact objects with name, role, phone, email (only used when type=''gig'')';

COMMIT;
```

**Field Details**:

| Field | Type | Nullable | Default | Description | Example |
|-------|------|----------|---------|-------------|---------|
| `name` | TEXT | YES | NULL | Show/event name | "Toys 4 Tots Benefit" |
| `venue` | TEXT | YES | NULL | Venue name | "The Whiskey Room" |
| `load_in_time` | TEXT | YES | NULL | Load-in time | "6:00 PM" |
| `soundcheck_time` | TEXT | YES | NULL | Soundcheck time | "7:00 PM" |
| `payment` | INTEGER | YES | NULL | Payment in cents | 50000 ($500) |
| `contacts` | JSONB | YES | [] | Contact array | See below |

**Contacts JSONB Structure**:
```json
[
  {
    "name": "John Smith",
    "role": "Venue Manager",
    "phone": "555-1234",
    "email": "john@venue.com"
  },
  {
    "name": "Jane Doe",
    "role": "Sound Engineer",
    "phone": "555-5678",
    "email": "jane@sound.com"
  }
]
```

**Validation Query**:
```sql
-- Test show creation with all fields
INSERT INTO practice_sessions (
  band_id,
  scheduled_date,
  duration,
  type,
  name,
  venue,
  load_in_time,
  soundcheck_time,
  payment,
  contacts
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with test band ID
  '2025-12-31 20:00:00',
  180,
  'gig',
  'New Year''s Eve Show',
  'Downtown Music Hall',
  '6:00 PM',
  '7:30 PM',
  100000, -- $1000
  '[{"name":"Alex","role":"Manager","phone":"555-9999","email":"alex@venue.com"}]'::jsonb
) RETURNING *;

-- Verify all fields stored correctly
SELECT
  id,
  type,
  name,
  venue,
  load_in_time,
  soundcheck_time,
  payment,
  contacts
FROM practice_sessions
WHERE type = 'gig'
ORDER BY scheduled_date DESC
LIMIT 5;

-- Clean up test data
DELETE FROM practice_sessions WHERE name = 'New Year''s Eve Show';
```

**Success Criteria**:
- ✅ Migration runs without errors
- ✅ All 6 new columns exist
- ✅ Test insert with all show fields succeeds
- ✅ Indexes created for performance
- ✅ Constraint prevents negative payments

---

### Task 3: Add Setlist-Show Foreign Key (10 min)

**Priority**: P1 - Data integrity
**File**: `supabase/migrations/20251027000003_add_show_setlist_fk.sql`

**Problem**: `setlists.show_id` has no FK constraint to enforce referential integrity

**Current State**:
```sql
-- setlists table
CREATE TABLE setlists (
  show_id UUID,  -- ❌ No FK constraint
  ...
);

-- practice_sessions table
CREATE TABLE practice_sessions (
  setlist_id UUID REFERENCES setlists(id),  -- ✅ FK exists
  ...
);
```

**Solution**: Add bidirectional FK relationships

**Migration Script**:
```sql
-- Migration: Add foreign key from setlists.show_id to practice_sessions
-- Created: 2025-10-27
-- Purpose: Enforce referential integrity between setlists and shows

BEGIN;

-- Add foreign key from setlists.show_id to practice_sessions.id
ALTER TABLE public.setlists
  ADD CONSTRAINT IF NOT EXISTS setlists_show_id_fkey
  FOREIGN KEY (show_id)
  REFERENCES public.practice_sessions(id)
  ON DELETE SET NULL;

-- Add index for show_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_setlists_show_id
  ON public.setlists(show_id)
  WHERE show_id IS NOT NULL;

-- Update column comment
COMMENT ON COLUMN public.setlists.show_id IS
  'Reference to practice_sessions(id) where type=''gig''. Application enforces type check.';

COMMIT;
```

**Note on Type Validation**:
PostgreSQL cannot enforce that `show_id` references a practice_session with `type='gig'`. This must be validated in application code.

**Application-Level Validation** (add to SetlistService):
```typescript
// When setting setlist.showId
async updateSetlist(setlistId: string, updates: Partial<Setlist>) {
  // Validate show_id points to a gig
  if (updates.showId) {
    const session = await repository.getPracticeSession(updates.showId)
    if (session.type !== 'gig') {
      throw new Error('show_id must reference a practice_session with type=\'gig\'')
    }
  }

  return repository.updateSetlist(setlistId, updates)
}
```

**Validation Query**:
```sql
-- Test FK constraint
-- 1. Create a show
INSERT INTO practice_sessions (band_id, scheduled_date, type, name)
VALUES ('00000000-0000-0000-0000-000000000000', NOW(), 'gig', 'Test Show')
RETURNING id;

-- 2. Create setlist referencing the show
INSERT INTO setlists (band_id, name, show_id, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Test Setlist',
  '<show_id_from_step_1>',
  auth.uid()
) RETURNING *;

-- 3. Verify FK relationship
SELECT
  s.id AS setlist_id,
  s.name AS setlist_name,
  ps.id AS show_id,
  ps.name AS show_name,
  ps.type AS show_type
FROM setlists s
JOIN practice_sessions ps ON s.show_id = ps.id
WHERE s.name = 'Test Setlist';

-- 4. Test ON DELETE SET NULL
DELETE FROM practice_sessions WHERE name = 'Test Show';

-- 5. Verify setlist.show_id is now NULL
SELECT show_id FROM setlists WHERE name = 'Test Setlist';
-- Should return NULL

-- Clean up
DELETE FROM setlists WHERE name = 'Test Setlist';
```

**Success Criteria**:
- ✅ FK constraint created
- ✅ Index created for performance
- ✅ Can join setlists to shows
- ✅ ON DELETE SET NULL works correctly
- ✅ Cannot set show_id to non-existent ID

---

## Phase 2: Application Layer Updates

### Task 4: Update RemoteRepository Mappings (30 min)

**Priority**: P0 - Sync functionality
**Files**:
- `src/services/data/RemoteRepository.ts`
- `src/types/index.ts` (if needed)

**Problem**: RemoteRepository doesn't know how to map show fields

**Current Mapping** (missing show fields):
```typescript
private mapPracticeSessionToSupabase(session: PracticeSession): any {
  return {
    id: session.id,
    band_id: session.bandId,
    setlist_id: session.setlistId || null,
    scheduled_date: session.scheduledDate.toISOString(),
    duration: session.duration || null,
    location: session.location || null,
    type: session.type,
    notes: session.notes || null,
    // ❌ Missing: name, venue, loadInTime, soundcheckTime, payment, contacts
  }
}
```

**Updated Mapping** (complete):
```typescript
private mapPracticeSessionToSupabase(session: PracticeSession): any {
  return {
    id: session.id,
    band_id: session.bandId,
    setlist_id: session.setlistId || null,
    scheduled_date: session.scheduledDate.toISOString(),
    duration: session.duration || null,
    location: session.location || null,
    type: session.type,
    notes: session.notes || null,
    objectives: session.objectives || [],
    completed_objectives: session.completedObjectives || [],
    session_rating: session.sessionRating || null,
    songs: JSON.stringify(session.songs || []),
    attendees: JSON.stringify(session.attendees || []),

    // Show-specific fields (only populated when type='gig')
    name: session.name || null,
    venue: session.venue || null,
    load_in_time: session.loadInTime || null,
    soundcheck_time: session.soundcheckTime || null,
    payment: session.payment || null,
    contacts: session.contacts ? JSON.stringify(session.contacts) : null,
  }
}

private mapPracticeSessionFromSupabase(row: any): PracticeSession {
  return {
    id: row.id,
    bandId: row.band_id,
    setlistId: row.setlist_id || undefined,
    scheduledDate: new Date(row.scheduled_date),
    duration: row.duration || undefined,
    location: row.location || undefined,
    type: row.type as SessionType,
    status: 'scheduled', // Default for local
    notes: row.notes || undefined,
    objectives: row.objectives || [],
    completedObjectives: row.completed_objectives || [],
    sessionRating: row.session_rating || undefined,
    songs: row.songs ? JSON.parse(row.songs) : [],
    attendees: row.attendees ? JSON.parse(row.attendees) : [],

    // Show-specific fields
    name: row.name || undefined,
    venue: row.venue || undefined,
    loadInTime: row.load_in_time || undefined,
    soundcheckTime: row.soundcheck_time || undefined,
    payment: row.payment || undefined,
    contacts: row.contacts ? JSON.parse(row.contacts) : undefined,
  }
}
```

**Implementation Steps**:

1. **Locate RemoteRepository.ts**:
   ```bash
   # File location
   src/services/data/RemoteRepository.ts
   ```

2. **Find the mapping functions**:
   - Search for `mapPracticeSessionToSupabase`
   - Search for `mapPracticeSessionFromSupabase`

3. **Add show field mappings**:
   - Add 6 new field mappings to both functions
   - Handle null/undefined correctly
   - Parse/stringify JSONB fields (contacts)

4. **Verify TypeScript types**:
   ```typescript
   // Check that PracticeSession interface includes show fields
   // File: src/types/index.ts or src/models/PracticeSession.ts

   interface PracticeSession {
     // ... existing fields ...

     // Show-specific (optional, only when type='gig')
     name?: string
     venue?: string
     loadInTime?: string
     soundcheckTime?: string
     payment?: number  // cents
     contacts?: ShowContact[]
   }

   interface ShowContact {
     name: string
     role?: string
     phone?: string
     email?: string
   }
   ```

**Testing the Mappings**:
```typescript
// Add to RemoteRepository.test.ts
describe('PracticeSession mapping', () => {
  it('maps show fields to Supabase', () => {
    const show: PracticeSession = {
      id: 'test-id',
      bandId: 'band-id',
      scheduledDate: new Date('2025-12-31'),
      duration: 180,
      type: 'gig',
      status: 'scheduled',
      songs: [],
      attendees: [],

      // Show-specific
      name: 'New Year Show',
      venue: 'Music Hall',
      loadInTime: '6:00 PM',
      soundcheckTime: '7:00 PM',
      payment: 100000,
      contacts: [{ name: 'John', phone: '555-1234' }],
    }

    const supabaseRow = repository['mapPracticeSessionToSupabase'](show)

    expect(supabaseRow.type).toBe('gig')
    expect(supabaseRow.name).toBe('New Year Show')
    expect(supabaseRow.venue).toBe('Music Hall')
    expect(supabaseRow.load_in_time).toBe('6:00 PM')
    expect(supabaseRow.soundcheck_time).toBe('7:00 PM')
    expect(supabaseRow.payment).toBe(100000)
    expect(JSON.parse(supabaseRow.contacts)).toEqual([
      { name: 'John', phone: '555-1234' }
    ])
  })

  it('maps Supabase show data to PracticeSession', () => {
    const supabaseRow = {
      id: 'test-id',
      band_id: 'band-id',
      scheduled_date: '2025-12-31T00:00:00Z',
      duration: 180,
      type: 'gig',
      songs: '[]',
      attendees: '[]',

      // Show-specific
      name: 'New Year Show',
      venue: 'Music Hall',
      load_in_time: '6:00 PM',
      soundcheck_time: '7:00 PM',
      payment: 100000,
      contacts: '[{"name":"John","phone":"555-1234"}]',
    }

    const session = repository['mapPracticeSessionFromSupabase'](supabaseRow)

    expect(session.type).toBe('gig')
    expect(session.name).toBe('New Year Show')
    expect(session.venue).toBe('Music Hall')
    expect(session.loadInTime).toBe('6:00 PM')
    expect(session.soundcheckTime).toBe('7:00 PM')
    expect(session.payment).toBe(100000)
    expect(session.contacts).toEqual([
      { name: 'John', phone: '555-1234' }
    ])
  })
})
```

**Success Criteria**:
- ✅ All 6 show fields mapped correctly
- ✅ camelCase ↔ snake_case conversion works
- ✅ JSONB stringify/parse works
- ✅ null/undefined handled correctly
- ✅ Tests pass

---

### Task 5: Update Schema Documentation (20 min)

**Priority**: P1 - Documentation accuracy
**File**: `.claude/specifications/unified-database-schema.md`

**Current Documentation** (incorrect):
```markdown
**Enums:**
- `type` (IndexedDB): 'rehearsal' | 'recording' | 'gig'
- `type` (Supabase): 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
```

**Updated Documentation** (correct):
```markdown
**Enums:**
- `type` (IndexedDB): 'rehearsal' | 'recording' | 'gig'
- `type` (Supabase): 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson' | 'gig' ✅
```

**Full Updates Needed**:

1. **Update type enum** (line ~328)
2. **Add show-specific fields table** (new section)
3. **Add show field mapping examples** (new section)
4. **Update repository mapping examples** (existing section)

**New Section to Add**:
```markdown
### practice_sessions - Show-Specific Fields

**Purpose**: When `type='gig'`, these additional fields store show/concert metadata.

**Show-Specific Fields** (optional, only used when `type='gig'`):

| Application | IndexedDB | Supabase | Type | Required | Description |
|-------------|-----------|----------|------|----------|-------------|
| `name` | `name` | `name` | string | No | Show/event name (e.g., "Toys 4 Tots Benefit") |
| `venue` | `venue` | `venue` | string | No | Venue name (e.g., "The Whiskey Room") |
| `loadInTime` | `loadInTime` | `load_in_time` | string | No | Load-in time (e.g., "6:00 PM") |
| `soundcheckTime` | `soundcheckTime` | `soundcheck_time` | string | No | Soundcheck time (e.g., "7:00 PM") |
| `payment` | `payment` | `payment` | number | No | Payment in cents (e.g., 50000 = $500) |
| `contacts` | `contacts` | `contacts` | array/JSONB | No | Contact objects array |

**Contact Object Structure**:
```typescript
interface ShowContact {
  name: string       // Required
  role?: string      // Optional, e.g., "Venue Manager"
  phone?: string     // Optional, e.g., "555-1234"
  email?: string     // Optional, e.g., "contact@venue.com"
}
```

**Example Show in IndexedDB**:
```typescript
{
  id: "uuid",
  bandId: "band-uuid",
  type: "gig",
  scheduledDate: new Date("2025-12-31T20:00:00"),
  duration: 180,

  // Show-specific
  name: "New Year's Eve Show",
  venue: "Downtown Music Hall",
  loadInTime: "6:00 PM",
  soundcheckTime: "7:30 PM",
  payment: 100000, // $1000
  contacts: [
    { name: "Alex Smith", role: "Manager", phone: "555-9999" }
  ]
}
```

**Example Show in Supabase**:
```sql
SELECT * FROM practice_sessions WHERE type = 'gig';

-- Result:
id              | band_id | type | scheduled_date      | name                 | venue                | payment | ...
uuid            | uuid    | gig  | 2025-12-31 20:00:00 | New Year's Eve Show  | Downtown Music Hall  | 100000  | ...
```
```

**Implementation**:
1. Open `.claude/specifications/unified-database-schema.md`
2. Find practice_sessions section (around line 300)
3. Update type enum to include 'gig' in Supabase
4. Add new section after main practice_sessions table
5. Update mapping examples to include show fields

**Success Criteria**:
- ✅ Type enum shows 'gig' in both IndexedDB and Supabase
- ✅ Show-specific fields documented
- ✅ Field mapping table complete
- ✅ Examples show real-world usage
- ✅ Contact structure documented

---

## Phase 3: Testing & Validation

### Task 6: Test Show Creation and Sync (20 min)

**Priority**: P0 - Verification
**Method**: Chrome MCP browser testing

**Test Script**:

1. **Create a show in UI**:
   ```typescript
   // Navigate to Shows page
   await chrome.navigate('http://localhost:5173/shows')

   // Click "Create Show"
   await chrome.click('button:has-text("Create Show")')

   // Fill in show details
   await chrome.fill('input[name="name"]', 'Test Show - Sync Verification')
   await chrome.fill('input[name="venue"]', 'Test Venue')
   await chrome.fill('input[name="scheduledDate"]', '2025-12-31')
   await chrome.fill('input[name="loadInTime"]', '6:00 PM')
   await chrome.fill('input[name="soundcheckTime"]', '7:30 PM')
   await chrome.fill('input[name="payment"]', '500') // $500

   // Add contact
   await chrome.click('button:has-text("Add Contact")')
   await chrome.fill('input[name="contacts[0].name"]', 'John Doe')
   await chrome.fill('input[name="contacts[0].role"]', 'Venue Manager')
   await chrome.fill('input[name="contacts[0].phone"]', '555-1234')

   // Save
   await chrome.click('button:has-text("Save Show")')

   // Wait for success message
   await chrome.waitFor('text:Saved successfully')
   ```

2. **Wait for sync** (30 seconds):
   ```typescript
   // Monitor console for sync messages
   await chrome.waitFor('text:✅ Pull from remote complete', { timeout: 30000 })
   ```

3. **Verify in Supabase**:
   ```bash
   docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
     SELECT
       id,
       type,
       name,
       venue,
       load_in_time,
       soundcheck_time,
       payment,
       contacts
     FROM practice_sessions
     WHERE type = 'gig'
     AND name LIKE 'Test Show%'
     ORDER BY created_date DESC
     LIMIT 1;
   "
   ```

**Expected Result**:
```
 id                  | type | name                          | venue      | load_in_time | soundcheck_time | payment | contacts
---------------------+------+-------------------------------+------------+--------------+-----------------+---------+----------
 <uuid>              | gig  | Test Show - Sync Verification | Test Venue | 6:00 PM      | 7:30 PM         | 50000   | [{"name":"John Doe","role":"Venue Manager","phone":"555-1234"}]
```

**Success Criteria**:
- ✅ Show created in UI
- ✅ Sync completes without errors
- ✅ All fields present in Supabase
- ✅ JSONB contacts parsed correctly
- ✅ Payment stored in cents

---

### Task 7: Verify Data Integrity (10 min)

**Priority**: P1 - Validation

**Verification Queries**:

```sql
-- 1. Verify type constraint allows 'gig'
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'practice_sessions'::regclass
AND conname = 'session_type_check';

-- Expected: type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')

-- 2. Verify all show columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'practice_sessions'
AND column_name IN ('name', 'venue', 'load_in_time', 'soundcheck_time', 'payment', 'contacts')
ORDER BY column_name;

-- Expected: 6 rows returned

-- 3. Verify FK constraint exists
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'setlists'::regclass
AND conname = 'setlists_show_id_fkey';

-- Expected: FOREIGN KEY (show_id) REFERENCES practice_sessions(id) ON DELETE SET NULL

-- 4. Verify indexes created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'practice_sessions'
AND indexname LIKE '%gig%' OR indexname LIKE '%show%';

-- Expected: idx_practice_sessions_name, idx_practice_sessions_venue, idx_practice_sessions_type_scheduled

-- 5. Count shows in database
SELECT
  type,
  COUNT(*) as count,
  MIN(scheduled_date) as earliest_show,
  MAX(scheduled_date) as latest_show
FROM practice_sessions
GROUP BY type
ORDER BY type;

-- Expected: At least one row with type='gig' if tests were run
```

**Success Criteria**:
- ✅ All constraints updated
- ✅ All columns exist and nullable
- ✅ FK constraint in place
- ✅ Indexes created
- ✅ Can query shows by type='gig'

---

## Phase 4: Optional Enhancements

### Task 8: Implement Setlist Forking (2-3 hours)

**Priority**: P2 - Feature enhancement
**Decision Required**: Ask user if they want this feature

**Original Design Intent**:
> "When creating a show and selecting an existing setlist we were creating a 'fork' of that setlist specifically for the show"

**Current Behavior** (simple reference):
```typescript
// User selects setlist ID
setlist: { id: 'existing-setlist-id', name: 'Standard Set' }

// Show is created with reference
show: { setlistId: 'existing-setlist-id' }

// Problem: Changes to setlist affect all shows using it
```

**Desired Behavior** (forking):
```typescript
// User selects source setlist
sourceSetlist: { id: 'existing-setlist-id', name: 'Standard Set' }

// System creates a copy for this show
forkedSetlist: {
  id: 'new-uuid',
  name: 'Standard Set (New Year Show)',
  showId: 'show-uuid',
  items: [...sourceSetlist.items], // Deep copy
}

// Show linked to fork
show: { setlistId: 'forked-setlist-id' }

// Benefit: Show-specific customization without affecting master
```

**Implementation**:

1. **Create SetlistForkingService**:
```typescript
// File: src/services/SetlistForkingService.ts

export class SetlistForkingService {
  constructor(private repository: Repository) {}

  async forkSetlistForShow(
    sourceSetlistId: string,
    showName: string
  ): Promise<Setlist> {
    // 1. Get source setlist
    const source = await this.repository.getSetlist(sourceSetlistId)

    if (!source) {
      throw new Error(`Setlist ${sourceSetlistId} not found`)
    }

    // 2. Create forked copy
    const forked: Setlist = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (${showName})`,
      showId: undefined, // Will be set after show creation
      createdDate: new Date(),
      lastModified: new Date(),
      status: 'draft', // Forked setlist starts as draft
    }

    // 3. Save fork
    await this.repository.addSetlist(forked)

    return forked
  }

  async createShowWithForkedSetlist(
    showData: Partial<PracticeSession>,
    sourceSetlistId?: string
  ): Promise<{ show: PracticeSession; setlist?: Setlist }> {
    let forkedSetlist: Setlist | undefined

    // Fork setlist if source provided
    if (sourceSetlistId) {
      forkedSetlist = await this.forkSetlistForShow(
        sourceSetlistId,
        showData.name || 'Untitled Show'
      )
      showData.setlistId = forkedSetlist.id
    }

    // Create show
    const show = await this.repository.addPracticeSession({
      ...showData,
      type: 'gig',
    } as PracticeSession)

    // Link forked setlist back to show
    if (forkedSetlist) {
      await this.repository.updateSetlist(forkedSetlist.id, {
        showId: show.id,
      })
    }

    return { show, setlist: forkedSetlist }
  }
}
```

2. **Update ShowsPage UI**:
```typescript
// Add forking option to create show modal
<FormField label="Setlist">
  <Select
    value={formData.setlistId}
    onChange={handleSetlistChange}
  >
    <option value="">No setlist</option>
    {setlists.map(sl => (
      <option key={sl.id} value={sl.id}>
        {sl.name}
      </option>
    ))}
  </Select>

  {formData.setlistId && (
    <Checkbox
      label="Create a copy for this show"
      checked={shouldFork}
      onChange={setShouldFork}
      hint="Changes to this setlist won't affect the original"
    />
  )}
</FormField>

// Update submit handler
const handleSubmit = async () => {
  if (shouldFork && formData.setlistId) {
    const { show, setlist } = await forkingService.createShowWithForkedSetlist(
      formData,
      formData.setlistId
    )
    // Show success with both created
  } else {
    const show = await showsService.createShow(formData)
    // Show success
  }
}
```

3. **Add Tests**:
```typescript
describe('SetlistForkingService', () => {
  it('creates a copy of setlist for show', async () => {
    const original = await createSetlist({ name: 'Standard Set' })
    const show = await createShow({ name: 'New Year Show' })

    const forked = await forkingService.forkSetlistForShow(
      original.id,
      show.name
    )

    expect(forked.id).not.toBe(original.id)
    expect(forked.name).toBe('Standard Set (New Year Show)')
    expect(forked.items).toEqual(original.items)
    expect(forked.status).toBe('draft')
  })

  it('creates show with forked setlist in one operation', async () => {
    const original = await createSetlist({ name: 'Standard Set' })

    const { show, setlist } = await forkingService.createShowWithForkedSetlist(
      { name: 'New Year Show', bandId: testBandId },
      original.id
    )

    expect(show.setlistId).toBe(setlist?.id)
    expect(setlist?.showId).toBe(show.id)
    expect(setlist?.name).toContain('New Year Show')
  })
})
```

**Pros of Forking**:
- ✅ Show-specific customization
- ✅ Preserve master setlists
- ✅ Clear history of what was played
- ✅ Can tweak setlist without affecting future shows

**Cons of Forking**:
- ❌ More complex to implement
- ❌ Additional storage (duplicate setlists)
- ❌ May confuse users with too many setlists
- ❌ Updates to master don't propagate to forks

**Decision Point**:
Ask user: "Do you want setlists to be forked (copied) when creating a show, or just referenced?"

---

## Deployment Checklist

### Pre-Deployment

- [ ] All migration files created
- [ ] Migration files reviewed and tested locally
- [ ] RemoteRepository mappings updated
- [ ] Schema documentation updated
- [ ] Tests written and passing

### Local Testing

- [ ] Run migrations on local Supabase
- [ ] Create test show in UI
- [ ] Verify sync to local Supabase
- [ ] Verify all show fields present
- [ ] Test setlist-show relationship
- [ ] Delete test data

### Production Deployment

- [ ] Backup Supabase database
- [ ] Run migration 1: Add 'gig' type
- [ ] Verify migration 1 successful
- [ ] Run migration 2: Add show fields
- [ ] Verify migration 2 successful
- [ ] Run migration 3: Add FK constraint
- [ ] Verify migration 3 successful
- [ ] Deploy updated app code
- [ ] Test show creation in production
- [ ] Monitor sync logs for errors
- [ ] Verify data in Supabase dashboard

### Rollback Plan (if needed)

```sql
-- Rollback migration 3
ALTER TABLE setlists DROP CONSTRAINT IF EXISTS setlists_show_id_fkey;

-- Rollback migration 2
ALTER TABLE practice_sessions
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS venue,
  DROP COLUMN IF EXISTS load_in_time,
  DROP COLUMN IF EXISTS soundcheck_time,
  DROP COLUMN IF EXISTS payment,
  DROP COLUMN IF EXISTS contacts;

-- Rollback migration 1
ALTER TABLE practice_sessions DROP CONSTRAINT session_type_check;
ALTER TABLE practice_sessions
  ADD CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')
  );
```

---

## Success Metrics

### Technical Metrics
- ✅ All migrations run successfully
- ✅ No constraint violations in logs
- ✅ Shows sync to Supabase within 30 seconds
- ✅ All show fields preserved during sync
- ✅ FK relationships enforceable

### User Experience Metrics
- ✅ Can create shows with all fields
- ✅ Shows appear on all devices (multi-device sync)
- ✅ Payment/contact data persists
- ✅ Setlist-show relationship works
- ✅ No data loss reported

### Data Quality Metrics
- ✅ Type='gig' rows queryable
- ✅ Show-specific fields only on type='gig'
- ✅ Contacts JSONB valid format
- ✅ FK constraints prevent orphaned records

---

## Next Steps

**Immediate** (start now):
1. Review this plan with user
2. Get decision on setlist forking
3. Begin Phase 1: Create migration files
4. Test migrations on local Supabase

**Short-term** (within 1-2 hours):
1. Complete all migrations
2. Update RemoteRepository
3. Test show creation and sync
4. Update documentation

**Follow-up** (within 1 day):
1. Deploy to production Supabase
2. Monitor sync logs
3. Verify multi-device sync working
4. Add integration tests

**Optional** (if forking desired):
1. Implement SetlistForkingService
2. Update UI with fork option
3. Add forking tests
4. Document forking behavior

---

## Questions for User

Before proceeding, please confirm:

1. **Forking Decision**: Do you want setlists to be forked (copied) when creating a show, or should shows just reference the original setlist?

2. **Migration Timing**: Should I create the migration files now, or do you want to review the SQL first?

3. **Testing Preference**: Should I use Chrome MCP to test live, or write automated tests first?

4. **Additional Features**: Are there any other show-specific fields you remember from the original design that we should include?

---

## Estimated Timeline

| Phase | Tasks | Time | Blocker? |
|-------|-------|------|----------|
| Phase 1 | Database migrations | 45 min | Yes |
| Phase 2 | App layer updates | 30 min | Yes |
| Phase 3 | Testing & validation | 30 min | No |
| **Phase 4** | **Setlist forking** | **2-3 hours** | **Optional** |
| **Total** | **Without forking** | **1.5 hours** | - |
| **Total** | **With forking** | **4-4.5 hours** | - |

---

**Status**: Ready for implementation
**Next Action**: User review and decision on forking
