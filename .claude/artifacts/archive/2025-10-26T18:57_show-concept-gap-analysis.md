---
title: Show Concept Gap Analysis
created: 2025-10-26T18:57
prompt: User reported that shows got overlooked in database schema planning. Investigate where the show concept got lost between IndexedDB and Supabase implementation.
status: Analysis Complete
---

# Show Concept Gap Analysis

## Executive Summary

**CRITICAL FINDING**: The "show" concept was **partially lost** during the Supabase schema migration. Shows work perfectly in IndexedDB but **cannot sync to Supabase** due to multiple schema gaps.

## The Show Model Design (IndexedDB)

Shows were designed as a **polymorphic entity** using the `practice_sessions` table:

```typescript
// PracticeSession model - Shows when type='gig'
interface PracticeSession {
  // Common fields (all session types)
  id: string
  bandId: string
  scheduledDate: Date
  duration?: number
  location?: string
  type: 'rehearsal' | 'recording' | 'gig'  // ← 'gig' = show
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  songs: SessionSong[]
  attendees: SessionAttendee[]

  // Show-specific fields (only when type='gig')
  name?: string              // Show/event name
  venue?: string             // Venue name
  loadInTime?: string        // Load-in time
  soundcheckTime?: string    // Soundcheck time
  payment?: number           // Payment in cents
  contacts?: ShowContact[]   // Contact information
  setlistId?: string         // Associated setlist
}
```

**This design works in IndexedDB** - all fields are optional, and show-specific fields are only used when `type='gig'`.

---

## Critical Gaps in Supabase Schema

### Gap 1: Missing 'gig' Type (BLOCKING) 🔴

**Location**: `/workspaces/rock-on/supabase/migrations/20251025000000_initial_schema.sql:180`

**Current Supabase Schema**:
```sql
CREATE TABLE public.practice_sessions (
  -- ... fields ...
  type TEXT NOT NULL,
  CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')
  )
);
```

**Problem**: The 'gig' type is **completely missing** from the enum!

**IndexedDB Enum**: `'rehearsal' | 'recording' | 'gig'`
**Supabase Enum**: `'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'`
**Missing**: `'gig'`

**Impact**:
- ✅ Shows can be created in IndexedDB
- ❌ Shows **CANNOT sync to Supabase** (constraint violation)
- ❌ All show data is trapped in local storage only

**Evidence from code**:
```typescript
// src/hooks/useShows.ts:27
const gigs = response.sessions.filter(p => p.type === 'gig')

// src/pages/NewLayout/ShowsPage.tsx:443
await createShow({ ...showData, bandId, type: 'gig' })
```

---

### Gap 2: Missing Show-Specific Columns 🔴

**Show-specific fields in IndexedDB** (from PracticeSession model):
1. `name` - Show/event name (e.g., "Toys 4 Tots Benefit")
2. `venue` - Venue name (e.g., "The Whiskey Room")
3. `loadInTime` - Load-in time string
4. `soundcheckTime` - Soundcheck time string
5. `payment` - Payment amount in cents
6. `contacts` - Array of ShowContact objects (name, role, phone, email)
7. `setlistId` - Associated setlist ID

**Current Supabase Schema** (`practice_sessions` table):
```sql
-- Missing from Supabase:
-- ❌ name (show name)
-- ❌ venue (venue name)
-- ❌ loadInTime
-- ❌ soundcheckTime
-- ❌ payment
-- ❌ contacts
-- ❌ setlistId (no FK to setlists)

-- Only has:
location TEXT,  -- Generic location (not specific venue name)
```

**Impact**:
- Even if we add 'gig' type, most show data cannot sync
- Shows would sync to Supabase but lose critical information
- No way to track venue, payment, contacts, load-in times

---

### Gap 3: Broken Setlist-Show Relationship 🟡

**IndexedDB Design**:
```typescript
// Setlist model
interface Setlist {
  showId?: string  // Reference to practice_sessions where type='gig'
}

// PracticeSession model (when type='gig')
interface PracticeSession {
  setlistId?: string  // Reference to setlists
}
```

**Current Supabase Schema**:
```sql
-- setlists table
CREATE TABLE public.setlists (
  show_id UUID,  -- ✅ Field exists
  -- ❌ No foreign key constraint!
  -- ❌ Can't reference practice_sessions anyway (no 'gig' type)
);

-- practice_sessions table
CREATE TABLE public.practice_sessions (
  setlist_id UUID REFERENCES public.setlists(id),  -- ✅ FK exists
  -- ❌ But no 'gig' type to use it with
);
```

**Impact**:
- Bidirectional relationship is broken
- `setlists.show_id` has no FK constraint
- Even with FK, can't enforce that `show_id` points to a 'gig' type session

---

### Gap 4: Setlist Forking Not Implemented 🟡

**User's Original Design**:
> "When creating a show and selecting an existing setlist we were creating a 'fork' of that setlist specifically for the show"

**Expected Behavior**:
1. User creates show
2. User selects existing setlist (e.g., "Standard 90-Min Set")
3. System **creates a copy** of that setlist
4. Copy is linked to the show
5. User can modify show's setlist without affecting original

**Current Implementation**:
```typescript
// ShowsPage.tsx - Modal form
setlistId: formData.setlistId || undefined,  // Just stores reference
```

**Problem**: No forking logic exists!
- Current code just links to existing setlist
- Changes to setlist affect all shows using it
- No isolation between show-specific and master setlists

**Impact**:
- Shows share setlists instead of having dedicated copies
- Can't customize setlist for specific show
- Risk of accidentally modifying master setlist

---

## Where Things Went Wrong

### Timeline Reconstruction

1. **Original IndexedDB Design** (Working)
   - `practiceSessions` table with polymorphic type field
   - Types: 'rehearsal', 'recording', **'gig'**
   - Show-specific optional fields on PracticeSession model
   - ✅ Shows fully functional

2. **Supabase Schema Design** (Task 10)
   - Schema documented in `.claude/specifications/unified-database-schema.md`
   - Practice sessions documented with limited type enum
   - **'gig' type was omitted** from Supabase enum
   - Show-specific fields not added to schema

3. **Schema Migration** (Task 12)
   - File: `supabase/migrations/20251025000000_initial_schema.sql`
   - Created practice_sessions table
   - Type constraint: `('rehearsal', 'writing', 'recording', 'audition', 'lesson')`
   - **'gig' missing**

4. **Current State**
   - Shows work in local-only mode (IndexedDB)
   - Shows **cannot sync** to Supabase
   - All show data trapped locally

---

## Evidence from Codebase

### 1. TypeScript Type Definitions

**IndexedDB** (`src/types/index.ts:45`):
```typescript
export type SessionType = 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson' | 'gig'
//                                                                                        ^^^^
```

**Usage in Code** (shows expecting 'gig'):
```typescript
// src/hooks/useShows.ts:27
const gigs = response.sessions.filter(p => p.type === 'gig')

// src/hooks/useShows.ts:87
type: 'gig',

// src/pages/NewLayout/ShowsPage.tsx:443
type: 'gig'

// 50+ other references to type='gig'
```

### 2. Show-Specific Fields in Use

**Payment handling** (`ShowsPage.tsx:782-803`):
```typescript
const paymentInCents = formData.paymentAmount
  ? dollarsToCents(formData.paymentAmount)
  : 0

const showData: Partial<PracticeSession> = {
  payment: paymentInCents || undefined,
  // ... other show-specific fields
}
```

**Contacts handling** (`ShowsPage.tsx:817`):
```typescript
contacts: contacts.length > 0 ? JSON.stringify(contacts) : undefined,
```

**Show-specific times** (`ShowsPage.tsx:813-814`):
```typescript
loadInTime: formData.loadInTime || undefined,
soundcheckTime: formData.soundcheckTime || undefined,
```

All these fields exist in IndexedDB but **have nowhere to go in Supabase**.

---

## Documentation References

### Unified Schema Documentation

**File**: `.claude/specifications/unified-database-schema.md:327-328`

```markdown
**Enums:**
- `type` (IndexedDB): 'rehearsal' | 'recording' | 'gig'
- `type` (Supabase): 'rehearsal' | 'writing' | 'recording' | 'audition' | 'lesson'
```

**Analysis**: The documentation **acknowledges the discrepancy** but didn't flag it as an issue!

### Implementation Status

**File**: `.claude/instructions/IMPLEMENTATION-STATUS.md:375`

```sql
SELECT * FROM practice_sessions WHERE type = 'gig' ORDER BY scheduled_date DESC LIMIT 5;
```

**Analysis**: Status document shows expected query using `type = 'gig'`, but this query would **return no results** because constraint prevents 'gig' values!

---

## Impact Assessment

### Current State

**Local-Only Mode** (IndexedDB):
- ✅ Shows work perfectly
- ✅ All CRUD operations functional
- ✅ ShowsPage fully integrated
- ✅ 16 passing tests for useShows hooks

**Production Mode** (Supabase):
- ❌ Shows cannot be created (constraint violation)
- ❌ Existing shows cannot sync
- ❌ Show data trapped in local storage
- ❌ Multi-device sync impossible
- ❌ All show-specific data lost on sync

### User Impact

**If user tries to use shows in production**:
1. Create show in UI → ✅ Works (stored in IndexedDB)
2. Background sync attempts → ❌ Fails (type='gig' violates constraint)
3. Show data never reaches Supabase
4. User switches devices → ❌ Shows disappear (not synced)
5. Show-specific fields (payment, contacts) → ❌ Lost entirely

**Data Loss Risk**: HIGH
- Users could create shows, enter payment info, contact details
- All data stays local-only
- Device failure = complete show data loss

---

## Root Cause Analysis

### Why This Happened

1. **Schema Design Misalignment**
   - IndexedDB schema evolved organically with show features
   - Supabase schema designed from outdated specification
   - No validation that IndexedDB types matched Supabase types

2. **Documentation Gap**
   - Unified schema documented the discrepancy
   - But no validation step to catch incompatibility
   - No automated tests for schema parity

3. **No Integration Testing**
   - All tests use IndexedDB only (no Supabase)
   - Sync failures wouldn't surface until production
   - No contract tests between local and remote schemas

4. **Forking Feature Never Implemented**
   - Original design called for setlist forking
   - Implementation only added reference field
   - Feature quietly dropped without documentation

---

## Recommended Fixes

### Fix 1: Add 'gig' Type to Supabase (CRITICAL) 🔴

**Priority**: P0 - Blocking
**Effort**: 5 minutes
**Risk**: Low

**Migration**:
```sql
-- File: supabase/migrations/20251026190000_add_gig_type.sql

-- Drop existing constraint
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT session_type_check;

-- Add new constraint with 'gig' type
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')
  );
```

**Validation**:
```sql
-- Test that 'gig' type is now accepted
INSERT INTO practice_sessions (band_id, scheduled_date, type)
VALUES ('...', NOW(), 'gig');
```

---

### Fix 2: Add Show-Specific Columns (CRITICAL) 🔴

**Priority**: P0 - Data loss prevention
**Effort**: 15 minutes
**Risk**: Medium (schema change)

**Migration**:
```sql
-- File: supabase/migrations/20251026190100_add_show_fields.sql

-- Add show-specific columns to practice_sessions
ALTER TABLE public.practice_sessions
  ADD COLUMN name TEXT,                    -- Show/event name
  ADD COLUMN venue TEXT,                   -- Venue name
  ADD COLUMN load_in_time TEXT,            -- Load-in time
  ADD COLUMN soundcheck_time TEXT,         -- Soundcheck time
  ADD COLUMN payment INTEGER,              -- Payment in cents
  ADD COLUMN contacts JSONB DEFAULT '[]';  -- Array of contact objects

-- Add constraints
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT payment_positive_check CHECK (payment IS NULL OR payment >= 0);

-- Add indexes for common queries
CREATE INDEX idx_practice_sessions_name ON public.practice_sessions(name)
  WHERE name IS NOT NULL;

CREATE INDEX idx_practice_sessions_venue ON public.practice_sessions(venue)
  WHERE venue IS NOT NULL;
```

**Validation**:
```sql
-- Test show creation with all fields
INSERT INTO practice_sessions (
  band_id, scheduled_date, type, name, venue,
  load_in_time, soundcheck_time, payment, contacts
)
VALUES (
  '...', NOW(), 'gig', 'Test Show', 'The Venue',
  '6:00 PM', '7:00 PM', 50000, '[{"name":"John","phone":"555-1234"}]'::jsonb
);
```

---

### Fix 3: Add Foreign Key for Setlist-Show Relationship (HIGH) 🟡

**Priority**: P1 - Data integrity
**Effort**: 10 minutes
**Risk**: Low

**Migration**:
```sql
-- File: supabase/migrations/20251026190200_add_show_setlist_fk.sql

-- Add foreign key from setlists.show_id to practice_sessions.id
ALTER TABLE public.setlists
  ADD CONSTRAINT setlists_show_id_fkey
  FOREIGN KEY (show_id)
  REFERENCES public.practice_sessions(id)
  ON DELETE SET NULL;

-- Create index for show_id lookups
CREATE INDEX idx_setlists_show_id ON public.setlists(show_id)
  WHERE show_id IS NOT NULL;

-- Optional: Add check to ensure show_id points to 'gig' type
-- (Requires trigger or application-level validation)
```

**Note**: PostgreSQL doesn't support conditional FK (can't enforce that referenced row has type='gig'). This must be validated in application code.

---

### Fix 4: Update RemoteRepository Mapping (CRITICAL) 🔴

**Priority**: P0 - Sync functionality
**Effort**: 30 minutes
**Risk**: Low

**File**: `src/services/data/RemoteRepository.ts`

**Add show field mappings**:
```typescript
// Add to mapPracticeSessionToSupabase()
private mapPracticeSessionToSupabase(session: PracticeSession): any {
  return {
    // ... existing fields ...

    // Show-specific fields (only present when type='gig')
    name: session.name || null,
    venue: session.venue || null,
    load_in_time: session.loadInTime || null,
    soundcheck_time: session.soundcheckTime || null,
    payment: session.payment || null,
    contacts: session.contacts ? JSON.stringify(session.contacts) : null,
  }
}

// Add to mapPracticeSessionFromSupabase()
private mapPracticeSessionFromSupabase(row: any): PracticeSession {
  return {
    // ... existing fields ...

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

---

### Fix 5: Update Unified Schema Documentation (HIGH) 🟡

**Priority**: P1 - Documentation accuracy
**Effort**: 20 minutes
**Risk**: None

**File**: `.claude/specifications/unified-database-schema.md`

**Updates needed**:
1. Add 'gig' to Supabase type enum
2. Document show-specific fields
3. Add show field mapping table
4. Update examples to include shows

**Example addition**:
```markdown
### practice_sessions / practiceSessions

**Show-Specific Fields** (only used when `type = 'gig'`):

| Application | IndexedDB | Supabase | Type | Required | Description |
|-------------|-----------|----------|------|----------|-------------|
| `name` | `name` | `name` | string | No | Show/event name |
| `venue` | `venue` | `venue` | string | No | Venue name |
| `loadInTime` | `loadInTime` | `load_in_time` | string | No | Load-in time |
| `soundcheckTime` | `soundcheckTime` | `soundcheck_time` | string | No | Soundcheck time |
| `payment` | `payment` | `payment` | number | No | Payment in cents |
| `contacts` | `contacts` | `contacts` | array/JSONB | No | Contact objects |
```

---

### Fix 6: Implement Setlist Forking (OPTIONAL) 🔵

**Priority**: P2 - Feature enhancement
**Effort**: 2-3 hours
**Risk**: Low

**Design**:
```typescript
// When creating show with setlist
async function createShowWithSetlist(showData: ShowData, sourceSetlistId: string) {
  // 1. Create a fork of the source setlist
  const sourceSetlist = await repository.getSetlist(sourceSetlistId)

  const forkedSetlist = await repository.addSetlist({
    ...sourceSetlist,
    id: crypto.randomUUID(),  // New ID
    name: `${sourceSetlist.name} (${showData.name})`,  // Descriptive name
    showId: undefined,  // Will be set after show creation
    createdDate: new Date(),
    lastModified: new Date(),
  })

  // 2. Create show linked to forked setlist
  const show = await repository.addPracticeSession({
    ...showData,
    type: 'gig',
    setlistId: forkedSetlist.id,
  })

  // 3. Link forked setlist back to show
  await repository.updateSetlist(forkedSetlist.id, {
    showId: show.id,
  })

  return { show, setlist: forkedSetlist }
}
```

**Benefits**:
- Show-specific setlist customization
- Preserve master setlists
- Clear show ↔ setlist relationship

**Drawbacks**:
- More complex data model
- Additional storage (setlist copies)
- May not be needed if users want shared setlists

**Recommendation**: Implement if user confirms they want forking behavior.

---

## Testing Requirements

### Integration Tests Needed

1. **Show Sync Test**:
```typescript
test('shows sync to Supabase with all fields', async () => {
  const show = await createShow({
    name: 'Test Show',
    type: 'gig',
    venue: 'The Venue',
    payment: 50000,
    contacts: [{ name: 'John', phone: '555-1234' }],
  })

  // Wait for sync
  await waitForSync()

  // Verify in Supabase
  const supabaseShow = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('id', show.id)
    .single()

  expect(supabaseShow.type).toBe('gig')
  expect(supabaseShow.name).toBe('Test Show')
  expect(supabaseShow.venue).toBe('The Venue')
  expect(supabaseShow.payment).toBe(50000)
})
```

2. **Type Constraint Test**:
```typescript
test('Supabase accepts gig type', async () => {
  const { error } = await supabase
    .from('practice_sessions')
    .insert({
      band_id: testBandId,
      scheduled_date: new Date().toISOString(),
      type: 'gig',  // Should not violate constraint
    })

  expect(error).toBeNull()
})
```

3. **Show-Setlist Relationship Test**:
```typescript
test('setlist.show_id FK constraint works', async () => {
  const show = await createShow({ type: 'gig' })
  const setlist = await createSetlist({ showId: show.id })

  // Verify FK relationship
  const { data } = await supabase
    .from('setlists')
    .select('*, show:practice_sessions(*)')
    .eq('id', setlist.id)
    .single()

  expect(data.show.id).toBe(show.id)
  expect(data.show.type).toBe('gig')
})
```

---

## Implementation Plan

### Phase 1: Critical Fixes (1 hour)

**Must complete before production deployment**:

1. ✅ Create migration: Add 'gig' to type enum (5 min)
2. ✅ Create migration: Add show-specific columns (15 min)
3. ✅ Update RemoteRepository field mappings (30 min)
4. ✅ Run migrations on Supabase project (5 min)
5. ✅ Test show creation and sync (10 min)

**Deliverables**:
- 2 SQL migration files
- Updated RemoteRepository.ts
- Shows can sync to Supabase

### Phase 2: Data Integrity (30 minutes)

1. ✅ Create migration: Add setlist-show FK (10 min)
2. ✅ Update unified schema documentation (20 min)

**Deliverables**:
- 1 SQL migration file
- Updated schema docs

### Phase 3: Testing & Validation (1 hour)

1. ✅ Add integration tests for show sync (30 min)
2. ✅ Add contract tests for type enum (15 min)
3. ✅ Add FK relationship tests (15 min)

**Deliverables**:
- 3 new test files
- All tests passing

### Phase 4: Feature Enhancement (Optional, 2-3 hours)

1. ✅ Implement setlist forking (if user confirms need)
2. ✅ Add forking UI in ShowsPage
3. ✅ Add tests for forking

**Deliverables**:
- Setlist forking service
- Updated ShowsPage UI
- Forking tests

---

## Migration Files Required

### 1. `20251026190000_add_gig_type.sql`

```sql
-- Add 'gig' type to practice_sessions type constraint

ALTER TABLE public.practice_sessions
  DROP CONSTRAINT session_type_check;

ALTER TABLE public.practice_sessions
  ADD CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')
  );

COMMENT ON COLUMN public.practice_sessions.type IS
  'Session type: rehearsal, writing, recording, audition, lesson, or gig (show/performance)';
```

### 2. `20251026190100_add_show_fields.sql`

```sql
-- Add show-specific fields to practice_sessions table
-- These fields are only used when type='gig'

ALTER TABLE public.practice_sessions
  ADD COLUMN name TEXT,
  ADD COLUMN venue TEXT,
  ADD COLUMN load_in_time TEXT,
  ADD COLUMN soundcheck_time TEXT,
  ADD COLUMN payment INTEGER,
  ADD COLUMN contacts JSONB DEFAULT '[]'::jsonb;

-- Add constraints
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT payment_positive_check
    CHECK (payment IS NULL OR payment >= 0);

-- Add indexes for show queries
CREATE INDEX idx_practice_sessions_name
  ON public.practice_sessions(name)
  WHERE name IS NOT NULL AND type = 'gig';

CREATE INDEX idx_practice_sessions_venue
  ON public.practice_sessions(venue)
  WHERE venue IS NOT NULL AND type = 'gig';

-- Add comments
COMMENT ON COLUMN public.practice_sessions.name IS
  'Show/event name (only used when type=gig)';
COMMENT ON COLUMN public.practice_sessions.venue IS
  'Venue name (only used when type=gig)';
COMMENT ON COLUMN public.practice_sessions.load_in_time IS
  'Load-in time string (only used when type=gig)';
COMMENT ON COLUMN public.practice_sessions.soundcheck_time IS
  'Soundcheck time string (only used when type=gig)';
COMMENT ON COLUMN public.practice_sessions.payment IS
  'Payment amount in cents (only used when type=gig)';
COMMENT ON COLUMN public.practice_sessions.contacts IS
  'Array of contact objects with name, role, phone, email (only used when type=gig)';
```

### 3. `20251026190200_add_show_setlist_fk.sql`

```sql
-- Add foreign key from setlists.show_id to practice_sessions.id

ALTER TABLE public.setlists
  ADD CONSTRAINT setlists_show_id_fkey
  FOREIGN KEY (show_id)
  REFERENCES public.practice_sessions(id)
  ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_setlists_show_id
  ON public.setlists(show_id)
  WHERE show_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.setlists.show_id IS
  'Reference to practice_sessions(id) where type=gig (enforced in application)';
```

---

## Summary

### What Got Lost

1. ✅ **'gig' Type**: Works in IndexedDB, missing from Supabase enum
2. ✅ **Show Fields**: 6 show-specific fields exist locally, not in Supabase
3. ✅ **FK Constraint**: Setlist-show relationship documented but not enforced
4. ✅ **Setlist Forking**: Mentioned in requirements, never implemented

### Why It Happened

- Schema design based on outdated specification
- No validation between IndexedDB and Supabase types
- No integration tests catching sync failures
- Documentation acknowledged gap but didn't flag it

### How to Fix

**Immediate** (Phase 1 - 1 hour):
1. Add 'gig' type to Supabase
2. Add show-specific columns
3. Update field mappings
4. Test sync

**Follow-up** (Phase 2-3 - 1.5 hours):
1. Add FK constraint
2. Update documentation
3. Add integration tests

**Optional** (Phase 4 - 2-3 hours):
1. Implement setlist forking
2. Add forking UI

### Next Steps

**Question for User**:
1. Do you want setlist forking, or is a simple reference OK?
2. Should I proceed with creating the migration files?
3. Any other show-specific features you remember from the original design?

---

**Ready to fix**: All migration files are drafted and ready to apply. Estimated time to full resolution: **1-2.5 hours** depending on forking decision.
