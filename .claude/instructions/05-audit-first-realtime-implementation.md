# Implementation Instructions: Audit-First Real-Time Sync

**Document:** `.claude/instructions/05-audit-first-realtime-implementation.md`
**Created:** 2025-10-31T18:18
**Phase:** 4 - Real-Time WebSocket Sync (Audit-First Approach)
**Estimated Time:** 2.5-3 hours
**Prerequisites:** `.claude/artifacts/2025-10-31T18:18_audit-first-research-and-design.md`

---

## Overview

This document provides step-by-step instructions for migrating from per-table WebSocket subscriptions to a single audit_log subscription.

**What We're Building:**
- Single WebSocket subscription per band (was 4)
- Complete DELETE metadata (user_name, old_values)
- Simplified codebase (340 → 120 lines)
- Future-proof for new tables

---

## Prerequisites Checklist

Before starting implementation, ensure:

- [ ] Research document read: `.claude/artifacts/2025-10-31T18:18_audit-first-research-and-design.md`
- [ ] Gap analysis read: `.claude/artifacts/2025-10-31T18:07_realtime-sync-gap-analysis.md`
- [ ] Audit migration file exists: `supabase/migrations/20251031000001_add_audit_tracking.sql`
- [ ] Development environment running: `npm run dev`
- [ ] Supabase accessible (local or hosted)

---

## Step 1: Apply Audit Log Migration (30 min)

### 1.1: Check Current Migration Status

```bash
# If using local Supabase
supabase status

# If using hosted Supabase
# Check via Supabase Studio → Database → Migrations
```

### 1.2: Apply Migration

**Option A: Local Supabase**
```bash
# Reset database (reapplies all migrations)
cd /workspaces/rock-on
supabase db reset

# OR apply just the audit migration
supabase db push
```

**Option B: Hosted Supabase**
```bash
# Via Supabase CLI
supabase db push

# OR manually in Supabase Studio:
# 1. Go to SQL Editor
# 2. Copy contents of supabase/migrations/20251031000001_add_audit_tracking.sql
# 3. Run the SQL
```

### 1.3: Enable Realtime on audit_log

```sql
-- Run this in Supabase SQL Editor or via CLI

-- Enable realtime for audit_log table
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Set replica identity (for completeness, though we only subscribe to INSERT)
ALTER TABLE audit_log REPLICA IDENTITY FULL;
```

### 1.4: Verify Migration

```sql
-- 1. Check audit_log table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid)
-- table_name (text)
-- record_id (text)
-- action (text)
-- user_id (uuid)
-- user_name (text)
-- changed_at (timestamptz)
-- old_values (jsonb)
-- new_values (jsonb)
-- band_id (uuid)
-- client_info (jsonb)

-- 2. Check triggers are installed
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%audit%'
ORDER BY event_object_table;

-- Expected: 8 triggers (2 per table × 4 tables)
-- - songs_audit_log (AFTER INSERT OR UPDATE OR DELETE)
-- - setlists_audit_log (AFTER INSERT OR UPDATE OR DELETE)
-- - shows_audit_log (AFTER INSERT OR UPDATE OR DELETE)
-- - practice_sessions_audit_log (AFTER INSERT OR UPDATE OR DELETE)

-- 3. Test trigger (creates audit entry)
-- Create a test song
INSERT INTO songs (id, title, context_type, context_id, created_by)
VALUES (
  gen_random_uuid(),
  'Test Audit Song',
  'band',
  (SELECT id FROM bands LIMIT 1),  -- Use existing band
  auth.uid()
);

-- Check audit log was created
SELECT
  table_name, action, user_name,
  new_values->>'title' as song_title,
  changed_at
FROM audit_log
WHERE table_name = 'songs'
ORDER BY changed_at DESC
LIMIT 5;

-- Should see: 'songs', 'INSERT', user_name, 'Test Audit Song', timestamp

-- Clean up test
DELETE FROM songs WHERE title = 'Test Audit Song';

-- Verify DELETE was also logged
SELECT
  table_name, action, user_name,
  old_values->>'title' as deleted_song
FROM audit_log
WHERE table_name = 'songs' AND action = 'DELETE'
ORDER BY changed_at DESC
LIMIT 1;

-- Should see: 'songs', 'DELETE', user_name, 'Test Audit Song'
```

### 1.5: Verify RLS Policies

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'audit_log';

-- Should return: rowsecurity = true

-- Check policies exist
SELECT polname, polcmd, polroles
FROM pg_policy
WHERE polrelid = 'audit_log'::regclass;

-- Expected policies:
-- - "Band members can view audit logs for their bands" (SELECT)
-- - "Only system can insert audit logs" (INSERT)
-- - "No one can update audit logs" (UPDATE)
-- - "No one can delete audit logs" (DELETE)
```

**✅ Checkpoint:** Audit log migration is applied and working

---

## Step 2: Implement Audit-First Handler (1-1.5 hours)

### 2.1: Add Type Definitions

**File:** `src/services/data/RealtimeManager.ts`

**Add after line 17 (after RealtimePayload interface):**

```typescript
/**
 * Audit log entry structure from Supabase
 */
interface AuditLogEntry {
  id: string
  table_name: 'songs' | 'setlists' | 'shows' | 'practice_sessions'
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  user_id: string | null
  user_name: string  // Denormalized user name - always available!
  changed_at: string  // ISO timestamp
  old_values: any  // Complete JSONB record before change (NULL for INSERT)
  new_values: any  // Complete JSONB record after change (NULL for DELETE)
  band_id: string
  client_info?: any  // Optional metadata
}
```

### 2.2: Implement subscribeToAuditLog()

**Add after subscribeToTable() method (around line 152):**

```typescript
/**
 * Subscribe to audit_log for a specific band
 * This replaces subscribeToBand() which created 4 subscriptions
 */
private async subscribeToAuditLog(userId: string, bandId: string): Promise<void> {
  try {
    const channelName = `audit-${bandId}`

    console.log(`[RealtimeManager] Subscribing to audit log for band: ${bandId}`)

    const channel = this.supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',  // Only INSERT (audit_log is append-only)
        schema: 'public',
        table: 'audit_log',
        filter: `band_id=eq.${bandId}`
      }, (payload: any) => {
        this.handleAuditChange(payload as RealtimePayload).catch(error => {
          console.error(`Error handling audit change:`, error)
        })
      })
      .subscribe(async (status, err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${channelName}:`, err)
          this.connected = false
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${channelName} (audit-first)`)
          this.connected = true
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for ${channelName}`)
          this.connected = false
        }
      })

    this.channels.set(channelName, channel)
  } catch (error) {
    console.error(`Error subscribing to audit_log for band ${bandId}:`, error)
  }
}
```

### 2.3: Implement handleAuditChange()

**Add after subscribeToAuditLog():**

```typescript
/**
 * Handle audit log changes from Supabase
 * Single unified handler for all entity types
 */
private async handleAuditChange(payload: RealtimePayload): Promise<void> {
  const audit = payload.new as AuditLogEntry

  console.log(`📡 Received audit event:`, {
    table: audit.table_name,
    action: audit.action,
    user: audit.user_name,
    recordId: audit.record_id
  })

  // Skip if current user made this change (avoid redundant refetches and toasts)
  if (audit.user_id === this.currentUserId) {
    console.log('[RealtimeManager] Skipping own change')
    return
  }

  // Handle based on action type
  try {
    switch (audit.action) {
      case 'INSERT':
      case 'UPDATE':
        await this.handleRecordUpsert(audit)
        break

      case 'DELETE':
        await this.handleRecordDelete(audit)
        break
    }

    // Extract item name for toast
    const itemName = this.extractItemName(audit)

    // Show toast with ACTUAL user name (not "Someone"!)
    await this.queueToast(audit.user_name, audit.action, audit.table_name, itemName)

    // Emit change event for UI reactivity
    this.emit(`${audit.table_name}:changed`, {
      bandId: audit.band_id,
      action: audit.action,
      recordId: audit.record_id
    })
  } catch (error) {
    console.error('[RealtimeManager] Error processing audit change:', error)
  }
}
```

### 2.4: Implement handleRecordUpsert()

**Add after handleAuditChange():**

```typescript
/**
 * Handle INSERT and UPDATE operations
 * Maps JSONB from audit log to local IndexedDB
 */
private async handleRecordUpsert(audit: AuditLogEntry): Promise<void> {
  const { table_name, new_values } = audit

  if (!new_values) {
    console.warn('[RealtimeManager] No new_values in audit entry for INSERT/UPDATE')
    return
  }

  switch (table_name) {
    case 'songs': {
      const song = this.mapAuditToSong(new_values)
      await db.songs.put(song)
      console.log(`✅ Synced song from audit log:`, song.title)
      break
    }

    case 'setlists': {
      const setlist = this.mapAuditToSetlist(new_values)
      await db.setlists.put(setlist)
      console.log(`✅ Synced setlist from audit log:`, setlist.name)
      break
    }

    case 'shows': {
      const show = this.mapAuditToShow(new_values)
      await db.shows.put(show)
      console.log(`✅ Synced show from audit log:`, show.name)
      break
    }

    case 'practice_sessions': {
      const practice = this.mapAuditToPractice(new_values)
      await db.practiceSessions.put(practice)
      console.log(`✅ Synced practice from audit log`)
      break
    }

    default:
      console.warn(`[RealtimeManager] Unknown table_name: ${table_name}`)
  }
}
```

### 2.5: Implement handleRecordDelete()

**Add after handleRecordUpsert():**

```typescript
/**
 * Handle DELETE operations
 * Uses existing repository delete methods
 */
private async handleRecordDelete(audit: AuditLogEntry): Promise<void> {
  const { table_name, record_id } = audit

  switch (table_name) {
    case 'songs':
      await repository.deleteSong(record_id)
      console.log(`✅ Deleted song from audit log:`, record_id)
      break

    case 'setlists':
      await repository.deleteSetlist(record_id)
      console.log(`✅ Deleted setlist from audit log:`, record_id)
      break

    case 'shows':
      await repository.deleteShow(record_id)
      console.log(`✅ Deleted show from audit log:`, record_id)
      break

    case 'practice_sessions':
      await repository.deletePracticeSession(record_id)
      console.log(`✅ Deleted practice from audit log:`, record_id)
      break

    default:
      console.warn(`[RealtimeManager] Unknown table_name for DELETE: ${table_name}`)
  }
}
```

### 2.6: Implement Mapping Helpers

**Add after handleRecordDelete():**

```typescript
/**
 * Map audit log JSONB to Song model
 * Handles snake_case → camelCase conversion
 */
private mapAuditToSong(jsonb: any): Song {
  return {
    id: jsonb.id,
    title: jsonb.title || '',
    artist: jsonb.artist || '',
    album: jsonb.album || undefined,
    key: jsonb.key || '',
    bpm: jsonb.tempo || 120,  // tempo → bpm
    duration: jsonb.duration || 0,
    difficulty: (jsonb.difficulty || 1) as 1 | 2 | 3 | 4 | 5,
    guitarTuning: jsonb.guitar_tuning || undefined,
    structure: jsonb.structure || [],
    lyrics: jsonb.lyrics || undefined,
    chords: jsonb.chords || [],
    notes: jsonb.notes || '',
    referenceLinks: jsonb.reference_links || [],
    tags: jsonb.tags || [],
    createdDate: new Date(jsonb.created_date),
    lastPracticed: jsonb.last_practiced ? new Date(jsonb.last_practiced) : undefined,
    confidenceLevel: jsonb.confidence_level || 1,
    contextType: jsonb.context_type,
    contextId: jsonb.context_id,
    createdBy: jsonb.created_by,
    visibility: jsonb.visibility || 'band',
    songGroupId: jsonb.song_group_id || undefined,
    linkedFromSongId: jsonb.linked_from_song_id || undefined,
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined
  }
}

/**
 * Map audit log JSONB to Setlist model
 */
private mapAuditToSetlist(jsonb: any): Setlist {
  return {
    id: jsonb.id,
    name: jsonb.name || '',
    bandId: jsonb.band_id,
    items: jsonb.items || [],  // Already JSONB
    createdDate: new Date(jsonb.created_date),
    lastModified: new Date(jsonb.last_modified),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined
  }
}

/**
 * Map audit log JSONB to Show model
 */
private mapAuditToShow(jsonb: any): Show {
  return {
    id: jsonb.id,
    name: jsonb.name || '',
    venue: jsonb.venue || '',
    scheduledDate: new Date(jsonb.scheduled_date),
    bandId: jsonb.band_id,
    setlistId: jsonb.setlist_id || undefined,
    status: jsonb.status || 'upcoming',
    notes: jsonb.notes || '',
    createdDate: new Date(jsonb.created_date),
    updatedDate: new Date(jsonb.updated_date),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined
  }
}

/**
 * Map audit log JSONB to PracticeSession model
 */
private mapAuditToPractice(jsonb: any): PracticeSession {
  return {
    id: jsonb.id,
    scheduledDate: new Date(jsonb.scheduled_date),
    startTime: jsonb.start_time ? new Date(jsonb.start_time) : undefined,
    endTime: jsonb.end_time ? new Date(jsonb.end_time) : undefined,
    location: jsonb.location || '',
    bandId: jsonb.band_id,
    setlistId: jsonb.setlist_id || undefined,
    notes: jsonb.notes || '',
    attendees: jsonb.attendees || [],
    createdDate: new Date(jsonb.created_date),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined
  }
}

/**
 * Extract item name from audit entry for toast display
 */
private extractItemName(audit: AuditLogEntry): string {
  // For DELETE, use old_values; for INSERT/UPDATE, use new_values
  const values = audit.action === 'DELETE' ? audit.old_values : audit.new_values

  if (!values) {
    return 'item'
  }

  // Try common name fields
  return values.title || values.name || 'item'
}
```

### 2.7: Update subscribeToUserBands()

**Replace existing subscribeToUserBands() method (around line 79):**

```typescript
/**
 * Subscribe to audit_log for the user's bands
 * Single subscription per band (was 4)
 */
async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  this.currentUserId = userId

  console.log(`[RealtimeManager] Subscribing to ${bandIds.length} bands (audit-first)`)

  for (const bandId of bandIds) {
    await this.subscribeToAuditLog(userId, bandId)
  }

  // Mark as connected if at least one subscription succeeded
  if (this.channels.size > 0) {
    this.connected = true
    console.log(`✅ Real-time sync connected (${this.channels.size} channels)`)
  }
}
```

### 2.8: Remove Old Methods

**Delete these methods (they're no longer needed):**

1. `subscribeToBand()` (around line 95)
2. `subscribeToTable()` (around line 112)
3. `handleSongChange()` (around line 157)
4. `handleSetlistChange()` (around line 287)
5. `handleShowChange()` (around line 345)
6. `handlePracticeSessionChange()` (around line 407)

**Result:** ~340 lines removed, replaced with ~120 lines

### 2.9: Update queueToast() Signature

**Modify queueToast() to accept userName string (around line 521):**

```typescript
/**
 * Queue a toast notification (batches rapid changes)
 * Now accepts userName directly (from audit log)
 */
private async queueToast(
  userName: string,  // Changed: was userId, now userName
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  itemName: string
): Promise<void> {
  // No more user lookup needed! userName comes from audit log
  const effectiveUserId = userName  // Use userName as key

  // Add to pending toasts
  let pending = this.pendingToasts.get(effectiveUserId)
  if (!pending) {
    pending = {
      userId: effectiveUserId,
      userName,  // Already have it!
      changes: [],
      timestamp: Date.now()
    }
    this.pendingToasts.set(effectiveUserId, pending)
  }

  pending.changes.push({ type: eventType, table, itemName })

  // Reset batch timer
  if (this.toastBatchTimeout) {
    clearTimeout(this.toastBatchTimeout)
  }

  this.toastBatchTimeout = setTimeout(() => {
    this.flushToasts()
  }, this.TOAST_BATCH_DELAY)
}
```

**✅ Checkpoint:** Audit-first handler is implemented

---

## Step 3: Testing (45 min)

### 3.1: Unit Test - Mapping Functions

Create `tests/unit/services/data/RealtimeManager.audit.test.ts`:

```typescript
import { RealtimeManager } from '../../../../src/services/data/RealtimeManager'

describe('RealtimeManager - Audit Log Mapping', () => {
  let manager: RealtimeManager

  beforeEach(() => {
    manager = new RealtimeManager()
  })

  test('mapAuditToSong converts snake_case to camelCase', () => {
    const jsonb = {
      id: '123',
      title: 'Test Song',
      tempo: 140,  // snake_case
      guitar_tuning: 'Drop D',  // snake_case
      created_date: '2025-01-01T00:00:00Z',
      context_type: 'band',
      context_id: 'band-123',
      created_by: 'user-456'
    }

    const song = (manager as any).mapAuditToSong(jsonb)

    expect(song.bpm).toBe(140)  // tempo → bpm
    expect(song.guitarTuning).toBe('Drop D')
    expect(song.contextType).toBe('band')
  })

  test('extractItemName gets title from new_values', () => {
    const audit = {
      action: 'INSERT',
      new_values: { title: 'My Song' },
      old_values: null
    }

    const name = (manager as any).extractItemName(audit)
    expect(name).toBe('My Song')
  })

  test('extractItemName gets title from old_values for DELETE', () => {
    const audit = {
      action: 'DELETE',
      new_values: null,
      old_values: { title: 'Deleted Song' }
    }

    const name = (manager as any).extractItemName(audit)
    expect(name).toBe('Deleted Song')
  })
})
```

Run test:
```bash
npm test -- RealtimeManager.audit.test.ts
```

### 3.2: Integration Test - Two Browser

**Setup:**
1. Open Chrome: `http://localhost:5173`
2. Open Firefox: `http://localhost:5173`
3. Login as **different users** in the **same band**

**Test CREATE:**
1. In Chrome: Create new song "Audit Test Song"
2. Expected in Firefox (< 1s):
   - Song appears in list
   - Toast shows: "[Chrome User] added 'Audit Test Song'"
3. Check Chrome console: Should NOT see own event
4. Check Firefox console: Should see audit event

**Test UPDATE:**
1. In Firefox: Edit "Audit Test Song" → Change title to "Updated Song"
2. Expected in Chrome (< 1s):
   - Song title updates
   - Toast shows: "[Firefox User] updated 'Updated Song'"

**Test DELETE:**
1. In Chrome: Delete "Updated Song"
2. Expected in Firefox (< 1s):
   - Song disappears from list
   - Toast shows: "[Chrome User] deleted 'Updated Song'" (not "Someone deleted undefined"!)

**✅ Success Criteria:**
- All changes sync < 1 second
- Toast shows ACTUAL user name (not "Someone")
- Toast shows correct item name (not "undefined")
- No console errors
- Current user doesn't see toast for own changes

### 3.3: Performance Test

**Measure Latency:**

Add timestamps to measure end-to-end latency:

```typescript
// In Chrome console before DELETE:
const deleteTime = Date.now()
window.deleteTime = deleteTime

// In Firefox console, add listener:
const startTime = window.deleteTime || Date.now()
// Wait for song to disappear from list
const endTime = Date.now()
console.log('Latency:', endTime - startTime, 'ms')
```

**Target:** < 1000ms from DELETE to UI update

### 3.4: Verify Audit Log Entries

```sql
-- Check recent audit entries
SELECT
  changed_at,
  table_name,
  action,
  user_name,
  new_values->>'title' as item_name
FROM audit_log
WHERE band_id = '{your-band-id}'
ORDER BY changed_at DESC
LIMIT 20;

-- Should see all CREATE/UPDATE/DELETE events with user_name populated
```

**✅ Checkpoint:** All tests passing

---

## Step 4: Documentation Updates (30 min)

### 4.1: Update Sync Specification

**File:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

**Section to Update:** "Flow 6: Real-Time WebSocket Sync"

**Changes:**

```markdown
### Flow 6: Real-Time WebSocket Sync (Cloud → Local) ✅ **COMPLETE (Audit-First)**

**Status:** ✅ 100% Complete (Audit-First Approach)
**Trigger:** Remote database change (via Supabase Realtime + Audit Log)

**Architecture: Audit-First Subscription**

Instead of subscribing to 4 tables per band, we subscribe to a single `audit_log` table:

```typescript
// Old: 4 subscriptions per band
subscribe('songs-{bandId}')
subscribe('setlists-{bandId}')
subscribe('shows-{bandId}')
subscribe('practice_sessions-{bandId}')

// New: 1 subscription per band
subscribe('audit-{bandId}') → audit_log table
```

**Benefits:**
- 75% reduction in WebSocket connections
- Complete DELETE metadata (user_name, old_values)
- Simpler code (340 → 120 lines)
- Future-proof (new tables handled automatically)
- Complete audit trail

**Audit Log Schema:**
```typescript
interface AuditLogEntry {
  id: string
  table_name: 'songs' | 'setlists' | 'shows' | 'practice_sessions'
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  user_id: string | null
  user_name: string  // ✅ Always available!
  changed_at: string
  old_values: any    // ✅ Complete JSONB for DELETE
  new_values: any    // ✅ Complete JSONB for INSERT/UPDATE
  band_id: string
}
```

**Event Flow:**
1. User makes change (INSERT/UPDATE/DELETE)
2. Database trigger captures change to audit_log
3. Supabase Realtime broadcasts audit_log INSERT
4. Other devices receive audit event
5. Map JSONB to local model
6. Update IndexedDB
7. Emit UI event
8. Show toast with actual user name

**Performance:** < 1 second latency measured
```

### 4.2: Update CLAUDE.md

**File:** `/workspaces/rock-on/CLAUDE.md`

**Add to "Recent Changes" section:**

```markdown
## Recent Changes
- 2025-10-31: Migrated to audit-first real-time sync (1 subscription per band vs 4)
- 2025-10-31: Fixed DELETE toast notifications (now shows actual user name)
- 2025-10-25: Phase 1 Supabase sync complete (73 tests passing)
```

### 4.3: Create Rollback Document

**File:** `.claude/artifacts/2025-10-31T18:18_audit-first-rollback-plan.md`

```markdown
# Rollback Plan: Audit-First Real-Time Sync

If audit-first approach fails, rollback steps:

## 1. Keep Old Code (Recommended)

Add feature flag to RealtimeManager:

```typescript
private USE_AUDIT_FIRST = false  // Set to false to rollback

async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  if (this.USE_AUDIT_FIRST) {
    // Audit-first (new)
    for (const bandId of bandIds) {
      await this.subscribeToAuditLog(userId, bandId)
    }
  } else {
    // Per-table (old)
    for (const bandId of bandIds) {
      await this.subscribeToBand(userId, bandId)
    }
  }
}
```

## 2. Git Revert

```bash
git log --oneline  # Find commit before audit-first
git revert {commit-hash}
```

## 3. Issues & Solutions

**Issue:** Toasts show "Someone" again
**Solution:** Acceptable for MVP, can improve later

**Issue:** Performance degradation
**Solution:** Check audit_log indexes, consider archiving
```

**✅ Checkpoint:** Documentation updated

---

## Validation Checklist

Before marking complete, verify:

### Code
- [ ] AuditLogEntry interface added
- [ ] subscribeToAuditLog() implemented
- [ ] handleAuditChange() implemented
- [ ] handleRecordUpsert() implemented
- [ ] handleRecordDelete() implemented
- [ ] Mapping helpers implemented (4 functions)
- [ ] extractItemName() implemented
- [ ] subscribeToUserBands() updated
- [ ] queueToast() signature updated
- [ ] Old methods removed (6 methods)

### Database
- [ ] audit_log migration applied
- [ ] Realtime enabled on audit_log
- [ ] Triggers tested (INSERT/UPDATE/DELETE)
- [ ] RLS policies verified
- [ ] Audit entries populated correctly

### Testing
- [ ] Unit tests pass
- [ ] Two-browser CREATE works
- [ ] Two-browser UPDATE works
- [ ] Two-browser DELETE works
- [ ] Toast shows actual user name
- [ ] Toast shows correct item name
- [ ] Latency < 1 second
- [ ] No console errors

### Performance
- [ ] WebSocket connections reduced (verify in browser DevTools)
- [ ] Memory usage acceptable
- [ ] No lag or delays

### Documentation
- [ ] Sync specification updated
- [ ] CLAUDE.md updated
- [ ] Rollback plan created
- [ ] Implementation instructions (this file) complete

---

## Troubleshooting

### Issue: No audit entries created

**Symptoms:** Test INSERT doesn't appear in audit_log

**Debug:**
```sql
-- Check if triggers exist
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE '%audit%';

-- Manually test trigger
INSERT INTO songs (...) VALUES (...);
SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 1;
```

**Solution:** Re-run migration, verify SECURITY DEFINER on functions

### Issue: RLS blocks audit subscription

**Symptoms:** WebSocket connects but no events received

**Debug:**
```sql
-- Test as user
SET request.jwt.claims.sub = '{user-id}';
SELECT * FROM audit_log WHERE band_id = '{band-id}' LIMIT 1;
```

**Solution:** Verify user is in band_memberships, check RLS policy

### Issue: Mapping errors

**Symptoms:** TypeError in mapAuditToSong()

**Debug:**
```typescript
console.log('[RealtimeManager] audit.new_values:', audit.new_values)
console.log('[RealtimeManager] mapped song:', song)
```

**Solution:** Add null checks, validate JSONB structure

### Issue: Toast doesn't display

**Symptoms:** Console shows toast log but UI doesn't show

**Debug:**
```typescript
// In handleAuditChange, add:
console.log('[RealtimeManager] Emitting toast, listeners:', this.listenerCount('toast'))
```

**Solution:** Verify toast callback registered (see gap analysis doc)

---

## Success Criteria

Implementation is complete when:

1. ✅ Single subscription per band (verify in DevTools Network tab)
2. ✅ DELETE shows actual user name in toast
3. ✅ DELETE shows correct item name in toast
4. ✅ All changes sync < 1 second
5. ✅ No console errors
6. ✅ Works across multiple bands
7. ✅ Current user doesn't see own changes
8. ✅ All tests passing
9. ✅ Documentation updated
10. ✅ Rollback plan exists

---

## Post-Implementation

### Monitoring

Add logging to track audit-first performance:

```typescript
// In handleAuditChange
const startTime = Date.now()
// ... process audit entry
const endTime = Date.now()
console.log(`[RealtimeManager] Processed ${audit.table_name} ${audit.action} in ${endTime - startTime}ms`)
```

### Future Enhancements

1. **Batch UI Updates:** If rapid changes, batch refetches
2. **Audit Log Archiving:** Archive entries > 90 days old
3. **Undo Functionality:** Use old_values to enable undo
4. **Activity Feed:** Show recent changes dashboard
5. **Conflict Detection:** Compare versions from audit log

---

## Completion

When all checks pass:

1. Update todo list: Mark "Implement audit-first sync" as complete
2. Create completion artifact: `.claude/artifacts/2025-10-31_audit-first-completion.md`
3. Commit changes: `git add . && git commit -m "Implement audit-first real-time sync"`
4. Celebrate! 🎉 75% fewer WebSocket connections!

---

**Questions or issues? Refer to:**
- Research doc: `.claude/artifacts/2025-10-31T18:18_audit-first-research-and-design.md`
- Gap analysis: `.claude/artifacts/2025-10-31T18:07_realtime-sync-gap-analysis.md`
- Sync spec: `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`
