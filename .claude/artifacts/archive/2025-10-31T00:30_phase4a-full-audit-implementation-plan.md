---
title: Phase 4a - Full Audit System Implementation Plan
created: 2025-10-31T00:30
status: Ready to Execute
phase: Phase 4a
type: Implementation Plan (Option B - Full Version Control)
prompt: "Complete implementation plan for full audit tracking system with version control"
---

# Phase 4a - Full Audit System Implementation Plan

## Executive Summary

**Objective:** Implement complete change tracking (version control) for all records

**Duration:** 5-6 hours

**Deliverables:**
1. ✅ Database migration (created)
2. TypeScript model updates
3. Repository layer updates
4. RealtimeManager user filtering
5. Tests and validation
6. Documentation updates

**Benefits:**
- Complete change history (like git)
- Who changed what, when
- Foundation for revert functionality
- Better debugging capabilities
- No need to migrate data later

---

## 📋 Implementation Checklist

### Step 1: Database Migration (30 min)

#### 1.1: Review Migration File ✅
- [x] Migration created: `supabase/migrations/20251031000001_add_audit_tracking.sql`
- [ ] Review migration contents
- [ ] Understand what each part does

**What the migration includes:**
1. `last_modified_by` column added to all tables (songs, setlists, shows, practice_sessions)
2. `audit_log` table for complete change history
3. Indexes for fast queries
4. Row-Level Security (RLS) policies
5. Trigger functions for auto-tracking
6. Triggers on all tables
7. Verification queries

#### 1.2: Apply Migration (10 min)

```bash
# Stop dev server if running
# (migrations require exclusive DB access)

# Apply migration
supabase db reset

# Wait for migration to complete (~30 seconds)
```

**Expected output:**
```
Applying migration 20251031000001_add_audit_tracking.sql...
Seeding data from seed-local-dev.sql...
Database reset complete!
```

#### 1.3: Verify Migration (10 min)

```bash
# Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Run verification queries:**

```sql
-- 1. Verify last_modified_by columns exist
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE column_name = 'last_modified_by'
  AND table_schema = 'public'
ORDER BY table_name;
-- Expected: 4 rows (songs, setlists, shows, practice_sessions)

-- 2. Verify triggers installed
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%modified_by%'
   OR trigger_name LIKE '%audit_log%'
ORDER BY event_object_table, trigger_name;
-- Expected: 12 triggers (3 per table: set_created_by, set_last_modified_by, audit_log)

-- 3. Verify audit_log table exists
\d audit_log
-- Expected: Table structure with id, table_name, record_id, action, user_id, etc.

-- 4. Verify indexes
\di audit_log*
-- Expected: 4 indexes (table_record, band_date, user_date, changed_at)

-- 5. Test trigger functionality
-- Create a test song and verify audit log entry
INSERT INTO songs (id, title, artist, context_id, created_by)
VALUES ('test-song-1', 'Test Song', 'Test Artist',
        (SELECT id FROM bands LIMIT 1),
        (SELECT id FROM users LIMIT 1))
RETURNING *;

-- Check audit log
SELECT * FROM audit_log WHERE table_name = 'songs' AND record_id = 'test-song-1';
-- Expected: 1 row with action='INSERT', new_values populated

-- Update the song
UPDATE songs
SET title = 'Updated Test Song'
WHERE id = 'test-song-1'
RETURNING *;

-- Check audit log again
SELECT
  action,
  user_name,
  old_values->>'title' as old_title,
  new_values->>'title' as new_title
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'test-song-1'
ORDER BY changed_at DESC;
-- Expected: 2 rows (INSERT and UPDATE)

-- Clean up test data
DELETE FROM songs WHERE id = 'test-song-1';
-- Audit log will have DELETE entry too!

\q
```

**Validation Checklist:**
- [ ] `last_modified_by` column exists in all 4 tables
- [ ] 12 triggers installed (3 per table)
- [ ] `audit_log` table exists with correct structure
- [ ] 4 indexes created
- [ ] Test INSERT creates audit log entry
- [ ] Test UPDATE creates audit log entry with old/new values
- [ ] Test DELETE creates audit log entry

---

### Step 2: Update TypeScript Models (30 min)

#### 2.1: Update Song Model (10 min)

**File:** `src/models/Song.ts`

```typescript
export interface Song {
  id: string
  title: string
  artist: string
  album?: string
  key?: string
  bpm?: number
  duration?: number
  difficulty: number
  guitarTuning?: string
  structure?: SongStructure
  lyrics?: string
  chords?: ChordChart
  notes?: string
  referenceLinks?: string[]
  tags?: string[]
  contextId: string
  createdBy: string
  lastModifiedBy?: string  // 🆕 NEW - Who last modified this song
  createdDate: Date
  updatedDate?: Date
  version: number
}
```

**Changes:**
- [x] Add `lastModifiedBy?: string` field
- [ ] Add JSDoc comment explaining field purpose

#### 2.2: Update Setlist Model (5 min)

**File:** `src/models/Setlist.ts`

```typescript
export interface Setlist {
  id: string
  name: string
  bandId: string
  items: SetlistItem[]
  createdBy: string
  lastModifiedBy?: string  // 🆕 NEW
  createdDate: Date
  lastModified: Date
  version: number
}
```

#### 2.3: Update Show Model (5 min)

**File:** `src/models/Show.ts`

```typescript
export interface Show {
  id: string
  name: string
  date: Date
  venue: string
  bandId: string
  setlistId?: string
  notes?: string
  createdBy: string
  lastModifiedBy?: string  // 🆕 NEW
  createdDate: Date
  updatedDate?: Date
  version: number
}
```

#### 2.4: Update PracticeSession Model (5 min)

**File:** `src/models/PracticeSession.ts`

```typescript
export interface PracticeSession {
  id: string
  date: Date
  bandId: string
  songs: string[]
  notes?: string
  createdBy: string
  lastModifiedBy?: string  // 🆕 NEW (even though practices don't get updated often)
  createdDate: Date
  version: number
}
```

#### 2.5: Update Supabase Type Definitions (5 min)

**File:** `src/services/data/RemoteRepository.ts` (top of file)

Add `last_modified_by` to Supabase interfaces:

```typescript
interface SupabaseSong {
  id: string
  title: string
  artist: string | null
  // ... existing fields ...
  created_by: string
  last_modified_by: string | null  // 🆕 NEW
  created_date: string
  updated_date: string | null
  version: number
}

// Repeat for SupabaseSetlist, SupabaseShow, SupabasePracticeSession
```

**Validation:**
- [ ] `npm run type-check` passes (no TypeScript errors)

---

### Step 3: Update Repository Layer (45 min)

#### 3.1: Update Song Conversion Functions (15 min)

**File:** `src/services/data/RemoteRepository.ts`

**convertSongFromSupabase:**
```typescript
export function convertSongFromSupabase(row: SupabaseSong): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist || '',
    album: row.album || undefined,
    key: row.key || undefined,
    bpm: row.tempo || undefined,  // tempo → bpm
    duration: row.duration || undefined,
    difficulty: row.difficulty,
    guitarTuning: row.guitar_tuning || undefined,
    structure: row.structure || undefined,
    lyrics: row.lyrics || undefined,
    chords: row.chords || undefined,
    notes: row.notes || undefined,
    referenceLinks: row.reference_links || undefined,
    tags: row.tags || undefined,
    contextId: row.context_id,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by || undefined,  // 🆕 NEW
    createdDate: new Date(row.created_date),
    updatedDate: row.updated_date ? new Date(row.updated_date) : undefined,
    version: row.version
  }
}
```

**convertSongToSupabase:**
```typescript
export function convertSongToSupabase(song: Song): SupabaseSong {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || null,
    album: song.album || null,
    key: song.key || null,
    tempo: song.bpm || null,  // bpm → tempo
    duration: song.duration || null,
    difficulty: song.difficulty,
    guitar_tuning: song.guitarTuning || null,
    structure: song.structure || null,
    lyrics: song.lyrics || null,
    chords: song.chords || null,
    notes: song.notes || null,
    reference_links: song.referenceLinks || null,
    tags: song.tags || null,
    context_id: song.contextId,
    created_by: song.createdBy,
    last_modified_by: song.lastModifiedBy || null,  // 🆕 NEW
    created_date: song.createdDate.toISOString(),
    updated_date: song.updatedDate?.toISOString() || null,
    version: song.version
  }
}
```

#### 3.2: Update Setlist Conversion Functions (10 min)

```typescript
export function convertSetlistFromSupabase(row: SupabaseSetlist): Setlist {
  return {
    id: row.id,
    name: row.name,
    bandId: row.band_id,
    items: row.items || [],
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by || undefined,  // 🆕 NEW
    createdDate: new Date(row.created_date),
    lastModified: new Date(row.last_modified),
    version: row.version
  }
}

export function convertSetlistToSupabase(setlist: Setlist): SupabaseSetlist {
  return {
    id: setlist.id,
    name: setlist.name,
    band_id: setlist.bandId,
    items: setlist.items,
    created_by: setlist.createdBy,
    last_modified_by: setlist.lastModifiedBy || null,  // 🆕 NEW
    created_date: setlist.createdDate.toISOString(),
    last_modified: setlist.lastModified.toISOString(),
    version: setlist.version
  }
}
```

#### 3.3: Update Show Conversion Functions (10 min)

```typescript
export function convertShowFromSupabase(row: SupabaseShow): Show {
  return {
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    venue: row.venue,
    bandId: row.band_id,
    setlistId: row.setlist_id || undefined,
    notes: row.notes || undefined,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by || undefined,  // 🆕 NEW
    createdDate: new Date(row.created_date),
    updatedDate: row.updated_date ? new Date(row.updated_date) : undefined,
    version: row.version
  }
}

export function convertShowToSupabase(show: Show): SupabaseShow {
  return {
    id: show.id,
    name: show.name,
    date: show.date.toISOString(),
    venue: show.venue,
    band_id: show.bandId,
    setlist_id: show.setlistId || null,
    notes: show.notes || null,
    created_by: show.createdBy,
    last_modified_by: show.lastModifiedBy || null,  // 🆕 NEW
    created_date: show.createdDate.toISOString(),
    updated_date: show.updatedDate?.toISOString() || null,
    version: show.version
  }
}
```

#### 3.4: Update PracticeSession Conversion Functions (10 min)

```typescript
export function convertPracticeSessionFromSupabase(row: SupabasePracticeSession): PracticeSession {
  return {
    id: row.id,
    date: new Date(row.date),
    bandId: row.band_id,
    songs: row.songs || [],
    notes: row.notes || undefined,
    createdBy: row.created_by,
    lastModifiedBy: row.last_modified_by || undefined,  // 🆕 NEW
    createdDate: new Date(row.created_date),
    version: row.version
  }
}

export function convertPracticeSessionToSupabase(practice: PracticeSession): SupabasePracticeSession {
  return {
    id: practice.id,
    date: practice.date.toISOString(),
    band_id: practice.bandId,
    songs: practice.songs,
    notes: practice.notes || null,
    created_by: practice.createdBy,
    last_modified_by: practice.lastModifiedBy || null,  // 🆕 NEW
    created_date: practice.createdDate.toISOString(),
    version: practice.version
  }
}
```

**Validation:**
- [ ] `npm run type-check` passes
- [ ] All conversion functions updated

---

### Step 4: Update RealtimeManager (30 min)

#### 4.1: Restore User Filtering Logic (20 min)

**File:** `src/services/data/RealtimeManager.ts`

**Update `handleSongChange`:**

```typescript
private async handleSongChange(payload: RealtimePayload): Promise<void> {
  const { eventType, new: newRow, old: oldRow } = payload

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    // ✅ Now we have last_modified_by column!
    const modifiedBy = newRow.last_modified_by || newRow.created_by

    // Skip if current user made this change (avoid redundant refetch)
    if (modifiedBy === this.currentUserId) {
      console.log('[RealtimeManager] Skipping own change')
      return
    }

    console.log(`📡 Received ${eventType} event from user ${modifiedBy}`)

    // Fetch from Supabase and update IndexedDB
    try {
      const { data, error } = await this.supabase
        .from('songs')
        .select('*')
        .eq('id', newRow.id)
        .single<SupabaseSong>()

      if (error) throw error
      if (!data) return

      const song = convertSongFromSupabase(data)
      await db.songs.put(song)

      // Emit change event
      this.emit('songs:changed', {
        bandId: song.contextId,
        action: eventType,
        recordId: song.id
      })

      // Emit toast with user info
      const userName = await this.getUserName(modifiedBy)
      this.emit('toast', {
        message: `${userName} ${this.getActionText(eventType)} "${song.title}"`,
        type: 'info'
      })
    } catch (error) {
      console.error('[RealtimeManager] Error handling song change:', error)
    }
  }

  // ... handle DELETE (same as before)
}
```

**Apply same pattern to:**
- [ ] `handleSetlistChange()`
- [ ] `handleShowChange()`
- [ ] `handlePracticeSessionChange()`

**Validation:**
- [ ] `npm run type-check` passes
- [ ] No TypeScript errors

#### 4.2: Test User Filtering (10 min)

**Manual test:**
1. Login as User A in Firefox
2. Login as User B in Chrome
3. User A creates a song
4. User A should NOT see a toast (own change)
5. User B SHOULD see a toast ("Alice created 'Song Name'")
6. User B updates the song
7. User B should NOT see a toast (own change)
8. User A SHOULD see a toast ("Bob updated 'Song Name'")

---

### Step 5: Update Schema Documentation (20 min)

#### 5.1: Update Unified Database Schema

**File:** `.claude/specifications/unified-database-schema.md`

Add `lastModifiedBy` / `last_modified_by` to all table definitions:

**Songs Table:**
```markdown
| IndexedDB (camelCase) | Supabase (snake_case) | Type | Notes |
|-----------------------|-----------------------|------|-------|
| createdBy | created_by | UUID | FK to auth.users(id) |
| lastModifiedBy | last_modified_by | UUID | FK to auth.users(id), NULL for old records |
```

**Repeat for Setlists, Shows, Practice Sessions**

#### 5.2: Add Audit Log Documentation

Add new section to schema documentation:

```markdown
## Audit Log Table

**Purpose:** Complete change history for all records (version control)

| IndexedDB | Supabase | Type | Notes |
|-----------|----------|------|-------|
| N/A | id | UUID | Primary key |
| N/A | table_name | TEXT | Which table (songs, setlists, etc.) |
| N/A | record_id | TEXT | ID of the record |
| N/A | action | TEXT | INSERT, UPDATE, or DELETE |
| N/A | user_id | UUID | Who made the change |
| N/A | user_name | TEXT | Denormalized for performance |
| N/A | changed_at | TIMESTAMPTZ | When the change occurred |
| N/A | old_values | JSONB | Previous record state (NULL for INSERT) |
| N/A | new_values | JSONB | New record state (NULL for DELETE) |
| N/A | band_id | UUID | Band context |

**Indexes:**
- `idx_audit_log_table_record` (table_name, record_id, changed_at DESC)
- `idx_audit_log_band_date` (band_id, changed_at DESC)
- `idx_audit_log_user_date` (user_id, changed_at DESC)
- `idx_audit_log_changed_at` (changed_at DESC)

**RLS Policies:**
- Band members can SELECT audit logs for their bands
- No one can INSERT/UPDATE/DELETE (only triggers)

**Usage Examples:**
```sql
-- Show history of a song
SELECT changed_at, action, user_name,
       old_values->>'title' as old_title,
       new_values->>'title' as new_title
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'some-id'
ORDER BY changed_at DESC;

-- Show recent changes in a band
SELECT changed_at, table_name, action, user_name
FROM audit_log
WHERE band_id = 'some-band-id'
ORDER BY changed_at DESC
LIMIT 50;
```
```

---

### Step 6: Testing & Validation (90 min)

#### 6.1: Unit Tests (30 min)

**Update RealtimeManager.test.ts:**

The tests should now pass because we're using proper `last_modified_by`:

```typescript
it('should NOT refetch if current user made the change', async () => {
  const userId = 'user-1'
  const bandIds = ['band-1']

  await manager.subscribeToUserBands(userId, bandIds)

  const onCall = mockChannel.on.mock.calls.find((call: any[]) =>
    call[1]?.table === 'songs'
  )
  const handler = onCall![2]

  const payload = {
    eventType: 'UPDATE',
    new: {
      id: 'song-1',
      title: 'Updated by me',
      last_modified_by: 'user-1',  // Current user
      context_id: 'band-1'
    },
    old: {},
    schema: 'public',
    table: 'songs'
  }

  await handler(payload)

  // Should NOT fetch from Supabase or update IndexedDB
  expect(mockSupabase.from).not.toHaveBeenCalled()
  expect(mockDb.songs.put).not.toHaveBeenCalled()
})

it('should refetch if another user made the change', async () => {
  const userId = 'user-1'
  const bandIds = ['band-1']

  await manager.subscribeToUserBands(userId, bandIds)

  const onCall = mockChannel.on.mock.calls.find((call: any[]) =>
    call[1]?.table === 'songs'
  )
  const handler = onCall![2]

  const payload = {
    eventType: 'UPDATE',
    new: {
      id: 'song-1',
      title: 'Updated by Alice',
      last_modified_by: 'user-2',  // Different user
      context_id: 'band-1'
    },
    old: {},
    schema: 'public',
    table: 'songs'
  }

  await handler(payload)

  // Should fetch from Supabase and update IndexedDB
  expect(mockSupabase.from).toHaveBeenCalledWith('songs')
  expect(mockDb.songs.put).toHaveBeenCalled()
})
```

**Run tests:**
```bash
npm test -- tests/unit/services/data/RealtimeManager.test.ts --run
```

**Target:** 24/24 passing

#### 6.2: Integration Tests (30 min)

**Create test file:** `tests/integration/audit-tracking.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { supabase } from '../../src/services/supabase/client'

describe('Audit Tracking', () => {
  let testSongId: string
  let testUserId: string
  let testBandId: string

  beforeAll(async () => {
    // Get test user and band
    const { data: user } = await supabase.auth.getUser()
    testUserId = user!.user!.id

    const { data: bands } = await supabase.from('bands').select('id').limit(1)
    testBandId = bands![0].id
  })

  it('should automatically set created_by on INSERT', async () => {
    const { data, error } = await supabase
      .from('songs')
      .insert({
        title: 'Audit Test Song',
        artist: 'Test Artist',
        context_id: testBandId
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data.created_by).toBe(testUserId)
    testSongId = data.id
  })

  it('should automatically set last_modified_by on UPDATE', async () => {
    const { data, error } = await supabase
      .from('songs')
      .update({ title: 'Updated Audit Test Song' })
      .eq('id', testSongId)
      .select()
      .single()

    expect(error).toBeNull()
    expect(data.last_modified_by).toBe(testUserId)
  })

  it('should create audit log entry on INSERT', async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', 'songs')
      .eq('record_id', testSongId)
      .eq('action', 'INSERT')
      .single()

    expect(error).toBeNull()
    expect(data.user_id).toBe(testUserId)
    expect(data.new_values.title).toBe('Audit Test Song')
  })

  it('should create audit log entry on UPDATE with old and new values', async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', 'songs')
      .eq('record_id', testSongId)
      .eq('action', 'UPDATE')
      .single()

    expect(error).toBeNull()
    expect(data.old_values.title).toBe('Audit Test Song')
    expect(data.new_values.title).toBe('Updated Audit Test Song')
  })

  it('should create audit log entry on DELETE', async () => {
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', testSongId)

    expect(deleteError).toBeNull()

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', 'songs')
      .eq('record_id', testSongId)
      .eq('action', 'DELETE')
      .single()

    expect(error).toBeNull()
    expect(data.old_values.title).toBe('Updated Audit Test Song')
    expect(data.new_values).toBeNull()
  })

  it('should have complete change history', async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', 'songs')
      .eq('record_id', testSongId)
      .order('changed_at', { ascending: true })

    expect(error).toBeNull()
    expect(data).toHaveLength(3) // INSERT, UPDATE, DELETE
    expect(data[0].action).toBe('INSERT')
    expect(data[1].action).toBe('UPDATE')
    expect(data[2].action).toBe('DELETE')
  })
})
```

**Run tests:**
```bash
npm test -- tests/integration/audit-tracking.test.ts --run
```

#### 6.3: Manual Two-Device Testing (30 min)

**Setup:**
1. Firefox: Login as User A (e.g., Eric)
2. Chrome: Login as User B (e.g., Mike)
3. Both in same band

**Test Scenarios:**

**Scenario 1: User doesn't see own changes**
1. User A creates a song
2. ✅ User A should NOT see toast
3. ✅ User B SHOULD see toast: "Eric created 'Song Name'"

**Scenario 2: User sees other's changes**
1. User B updates the song title
2. ✅ User B should NOT see toast
3. ✅ User A SHOULD see toast: "Mike updated 'Song Name'"

**Scenario 3: Deletions**
1. User A deletes the song
2. ✅ User A should NOT see toast
3. ✅ User B SHOULD see toast: "Eric deleted 'Song Name'"
4. ✅ Song disappears from both UIs

**Scenario 4: All table types**
- [ ] Test songs (create, update, delete)
- [ ] Test setlists (create, update, delete)
- [ ] Test shows (create, update, delete)
- [ ] Test practices (create, delete)

**Scenario 5: Audit log query**
1. User A creates, updates, deletes a song
2. Query audit log:
```sql
SELECT changed_at, action, user_name,
       old_values->>'title' as old_title,
       new_values->>'title' as new_title
FROM audit_log
WHERE table_name = 'songs' AND record_id = 'the-song-id'
ORDER BY changed_at DESC;
```
3. ✅ Should see 3 entries (INSERT, UPDATE, DELETE)
4. ✅ All entries have correct user_name

---

### Step 7: Documentation (30 min)

#### 7.1: Create Completion Report

**File:** `.claude/artifacts/2025-10-31T0X:XX_phase4a-completion-report.md`

Include:
- Summary of what was delivered
- Migration validation results
- Test results (unit, integration, manual)
- SQL query examples
- Performance metrics
- Screenshots (optional)

#### 7.2: Update Roadmap

**File:** `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`

- [x] Mark Phase 4a as COMPLETE
- [ ] Add completion report link
- [ ] Update status to Phase 4b (Test Cleanup)

---

## 🎯 Success Criteria

### Database ✅
- [ ] Migration applied successfully
- [ ] `last_modified_by` column exists in all tables
- [ ] `audit_log` table created with correct structure
- [ ] All triggers installed (12 total)
- [ ] All indexes created (4 on audit_log)
- [ ] RLS policies active

### Code ✅
- [ ] TypeScript models updated (Song, Setlist, Show, PracticeSession)
- [ ] All conversion functions updated (8 functions)
- [ ] RealtimeManager user filtering restored (4 handlers)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

### Testing ✅
- [ ] RealtimeManager unit tests pass (24/24)
- [ ] Audit tracking integration tests pass (6/6)
- [ ] Manual two-device testing successful
- [ ] Users don't see their own changes
- [ ] Toast messages show correct user attribution

### Documentation ✅
- [ ] Schema documentation updated
- [ ] Audit log usage examples documented
- [ ] Completion report created
- [ ] Roadmap updated

---

## 🚀 Performance Impact

**Expected Performance:**
- Minimal impact on write operations (triggers are fast)
- Negligible storage growth (2KB per change)
- Fast audit log queries (properly indexed)

**Measured Performance (to be collected during testing):**
- INSERT latency: ~XX ms (before/after)
- UPDATE latency: ~XX ms (before/after)
- Audit log query time: ~XX ms (for 100 entries)

---

## 📊 Estimated Timeline

| Step | Duration | Cumulative |
|------|----------|------------|
| 1. Database Migration | 30 min | 0:30 |
| 2. TypeScript Models | 30 min | 1:00 |
| 3. Repository Layer | 45 min | 1:45 |
| 4. RealtimeManager | 30 min | 2:15 |
| 5. Schema Documentation | 20 min | 2:35 |
| 6. Testing & Validation | 90 min | 4:05 |
| 7. Documentation | 30 min | 4:35 |
| **Buffer** | 25 min | 5:00 |

**Total:** ~5 hours

---

## 🔗 Related Documentation

**Phase 4 Completion:**
- `.claude/artifacts/2025-10-31T00:22_phase4-final-summary.md`

**Audit System Design:**
- `.claude/artifacts/2025-10-31T00:15_phase4-completion-and-audit-design.md`

**Migration File:**
- `supabase/migrations/20251031000001_add_audit_tracking.sql` ⭐

**Schema Reference:**
- `.claude/specifications/unified-database-schema.md`

---

## 🎓 Notes for Future Agents

### When to Use Audit Log

**Query change history:**
```sql
-- All changes to a specific song
SELECT * FROM audit_log
WHERE table_name = 'songs' AND record_id = 'song-id'
ORDER BY changed_at DESC;

-- Recent changes in a band
SELECT * FROM audit_log
WHERE band_id = 'band-id'
ORDER BY changed_at DESC
LIMIT 50;

-- What Mike changed today
SELECT * FROM audit_log
WHERE user_id = 'mike-id'
  AND changed_at > CURRENT_DATE
ORDER BY changed_at DESC;
```

### Maintenance

**Archive old logs (optional, run annually):**
```sql
-- Move to archive table
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE changed_at < NOW() - INTERVAL '2 years';

-- Delete from main table
DELETE FROM audit_log
WHERE changed_at < NOW() - INTERVAL '2 years';
```

**Monitor storage:**
```sql
-- Check audit log size
SELECT
  pg_size_pretty(pg_total_relation_size('audit_log')) as total_size,
  COUNT(*) as row_count,
  MIN(changed_at) as oldest_entry,
  MAX(changed_at) as newest_entry
FROM audit_log;
```

---

## ✅ Ready to Execute

**Prerequisites:**
- [x] Migration file created
- [x] Implementation plan documented
- [x] Test strategy defined
- [x] Success criteria established

**Next Steps:**
1. Review this plan
2. Apply migration (Step 1)
3. Update TypeScript models (Step 2)
4. Update repository layer (Step 3)
5. Update RealtimeManager (Step 4)
6. Test thoroughly (Step 6)
7. Document results (Step 7)

**Estimated Completion:** ~5 hours from now

---

**Created:** 2025-10-31T00:30
**Status:** Ready to Execute ✅
**Phase:** 4a - Full Audit System Implementation
**Option:** B (Full Version Control)
