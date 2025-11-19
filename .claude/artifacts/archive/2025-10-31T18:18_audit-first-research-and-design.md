# Audit-First Real-Time Sync: Research & Design

**Date:** 2025-10-31T18:18
**Status:** Research & Planning Phase
**Context:** Migrating from per-table subscriptions to single audit_log subscription

---

## Executive Summary

**Proposed Change:** Replace 4 WebSocket subscriptions per band (songs, setlists, shows, practice_sessions) with a single subscription to the `audit_log` table.

**Key Benefits:**
- ✅ Complete DELETE metadata (user_name, old_values)
- ✅ 75% reduction in WebSocket connections
- ✅ Simpler, more maintainable code
- ✅ Future-proof for new tables
- ✅ Single source of truth for all changes

**Estimated Effort:** 2-3 hours to implement + test

---

## Part 1: Current Implementation Analysis

### Current Architecture

**File:** `src/services/data/RealtimeManager.ts`

**Subscription Model:**
```typescript
subscribeToUserBands(userId, bandIds) {
  for each band:
    subscribeToBand(userId, bandId)
}

subscribeToBand(userId, bandId) {
  subscribeToTable('songs', bandId, handleSongChange)
  subscribeToTable('setlists', bandId, handleSetlistChange)
  subscribeToTable('shows', bandId, handleShowChange)
  subscribeToTable('practice_sessions', bandId, handlePracticeSessionChange)
}
```

**Current Subscriptions:**
- 1 band = 4 WebSocket channels
- 2 bands = 8 WebSocket channels
- 5 bands = 20 WebSocket channels

**Channel Names:** `{table}-{bandId}` (e.g., `songs-abc-123`)

**Filter Logic:**
- Songs: Filter by `context_id=eq.{bandId}`
- Others: Filter by `band_id=eq.{bandId}`

**Event Handling Flow:**
```
1. WebSocket event received (INSERT/UPDATE/DELETE)
2. Check if current user made change → Skip if yes
3. For INSERT/UPDATE:
   - Fetch latest from Supabase (cloud-first)
   - Update local IndexedDB
   - Emit '{table}:changed' event
   - Queue toast notification
4. For DELETE:
   - Fetch item title from local DB (before deleting)
   - Delete from local IndexedDB
   - Emit '{table}:changed' event
   - Queue toast notification
```

### Current Issues Identified

#### Issue 1: Missing DELETE Metadata

**Problem:**
```typescript
if (eventType === 'DELETE') {
  // Supabase DELETE payload only has:
  oldRow: {
    id: 'uuid',        // ✅ Has
    title: undefined,  // ❌ Missing
    created_by: undefined  // ❌ Missing
  }
}
```

**Current Workaround:**
```typescript
// Fetch title from local DB before deleting
const song = await db.songs.get(oldRow.id)
const songTitle = song?.title || 'a song'

// But userId is still unknown!
await this.queueToast('unknown', 'DELETE', 'song', songTitle)
```

**Result:** Toast shows "Someone deleted 'Song Name'" (can't show actual user)

#### Issue 2: Code Duplication

4 nearly identical handlers:
- `handleSongChange()` - 130 lines
- `handleSetlistChange()` - 70 lines
- `handleShowChange()` - 70 lines
- `handlePracticeSessionChange()` - 70 lines

**Total:** ~340 lines of repetitive code

#### Issue 3: Subscription Overhead

**Current:** User in 3 bands = 12 WebSocket connections
- 3 × songs
- 3 × setlists
- 3 × shows
- 3 × practice_sessions

**Potential Issues:**
- Browser connection limits
- Supabase connection limits
- Memory overhead
- Reconnection complexity

---

## Part 2: Audit Log Analysis

### Migration Status

**File:** `supabase/migrations/20251031000001_add_audit_tracking.sql`
**Created:** 2025-10-31
**Size:** 14KB
**Status:** ⚠️ Migration file exists but **NOT YET APPLIED** (local Supabase not initialized)

### Audit Log Schema

```sql
CREATE TABLE audit_log (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What changed
  table_name TEXT NOT NULL,  -- 'songs', 'setlists', 'shows', 'practice_sessions'
  record_id TEXT NOT NULL,    -- UUID of the changed record
  action TEXT NOT NULL,       -- 'INSERT', 'UPDATE', 'DELETE'

  -- Who changed it
  user_id UUID REFERENCES auth.users(id),  -- NULL for system operations
  user_name TEXT NOT NULL,                 -- Denormalized for performance

  -- When changed
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Complete record data (JSONB)
  old_values JSONB,  -- Complete record BEFORE change (NULL for INSERT)
  new_values JSONB,  -- Complete record AFTER change (NULL for DELETE)

  -- Band context (for filtering)
  band_id UUID NOT NULL REFERENCES bands(id),

  -- Optional
  client_info JSONB
);
```

### Audit Log Triggers

**Function:** `log_audit_trail()`
**Trigger Timing:** AFTER INSERT OR UPDATE OR DELETE
**Applied To:** songs, setlists, shows, practice_sessions

**Key Features:**
1. **Captures user_name** from users table (denormalized)
2. **Stores complete JSONB** of old/new values
3. **Extracts band_id** (handles songs using context_id)
4. **Falls back to 'System'** if no user_id available

**Example DELETE Trigger:**
```sql
ELSIF (TG_OP = 'DELETE') THEN
  INSERT INTO audit_log (
    table_name, record_id, action,
    user_id, user_name, band_id,
    old_values  -- ✅ Complete deleted record!
  ) VALUES (
    TG_TABLE_NAME, OLD.id, 'DELETE',
    v_user_id, v_user_name, v_band_id,
    to_jsonb(OLD)  -- ✅ Full row as JSONB
  );
  RETURN OLD;
END IF;
```

### RLS Policies

```sql
-- Band members can view audit logs for their bands
CREATE POLICY "Band members can view audit logs for their bands"
  ON audit_log FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM band_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Only triggers can INSERT (users cannot)
CREATE POLICY "Only system can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (false);

-- Audit logs are immutable (cannot UPDATE or DELETE)
CREATE POLICY "No one can update audit logs"
  ON audit_log FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete audit logs"
  ON audit_log FOR DELETE
  USING (false);
```

**Implications for Real-Time:**
- ✅ RLS will filter audit_log by band membership
- ✅ Subscription filter should still use `band_id=eq.{bandId}` for efficiency
- ✅ Append-only table (only INSERT events to subscribe to)

---

## Part 3: Audit-First Design

### Proposed Architecture

**New Subscription Model:**
```typescript
subscribeToUserBands(userId, bandIds) {
  for each band:
    subscribeToAuditLog(userId, bandId)  // Single subscription!
}

subscribeToAuditLog(userId, bandId) {
  channel = supabase.channel(`audit-${bandId}`)
    .on('postgres_changes', {
      event: 'INSERT',  // Audit log is append-only
      schema: 'public',
      table: 'audit_log',
      filter: `band_id=eq.${bandId}`
    }, handleAuditChange)
}
```

**New Subscriptions:**
- 1 band = 1 WebSocket channel (was 4)
- 2 bands = 2 WebSocket channels (was 8)
- 5 bands = 5 WebSocket channels (was 20)

**75% reduction in connections!**

### Unified Event Handler

```typescript
private async handleAuditChange(payload: RealtimePayload): Promise<void> {
  const audit = payload.new as {
    id: string
    table_name: string        // 'songs' | 'setlists' | 'shows' | 'practice_sessions'
    record_id: string         // UUID
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    user_id: string | null    // UUID
    user_name: string         // ✅ Always available!
    changed_at: string        // ISO timestamp
    old_values: any           // ✅ Complete JSONB for DELETE
    new_values: any           // ✅ Complete JSONB for INSERT/UPDATE
    band_id: string           // UUID
  }

  // Skip own changes
  if (audit.user_id === this.currentUserId) {
    console.log('[RealtimeManager] Skipping own change:', audit.table_name)
    return
  }

  // Route to appropriate handler
  switch (audit.action) {
    case 'INSERT':
    case 'UPDATE':
      await this.handleRecordUpsert(audit)
      break
    case 'DELETE':
      await this.handleRecordDelete(audit)
      break
  }

  // Show toast with REAL user name and item name
  const itemName = this.extractItemName(audit)
  await this.queueToast(audit.user_name, audit.action, audit.table_name, itemName)

  // Emit change event for UI
  this.emit(`${audit.table_name}:changed`, {
    bandId: audit.band_id,
    action: audit.action,
    recordId: audit.record_id
  })
}
```

### Record Mapping

**Challenge:** Audit log has JSONB (snake_case), need to convert to IndexedDB models (camelCase)

**Solution:** Reuse existing RemoteRepository conversion logic

```typescript
private async handleRecordUpsert(audit: AuditLogEntry): Promise<void> {
  const { table_name, new_values } = audit

  switch (table_name) {
    case 'songs':
      const song = this.mapAuditToSong(new_values)
      await db.songs.put(song)
      break

    case 'setlists':
      const setlist = this.mapAuditToSetlist(new_values)
      await db.setlists.put(setlist)
      break

    // ... similar for shows, practice_sessions
  }
}

private async handleRecordDelete(audit: AuditLogEntry): Promise<void> {
  const { table_name, record_id } = audit

  switch (table_name) {
    case 'songs':
      await repository.deleteSong(record_id)
      break

    case 'setlists':
      await repository.deleteSetlist(record_id)
      break

    // ... similar for shows, practice_sessions
  }
}
```

### Field Mapping Helpers

**Reuse Existing Logic:**
```typescript
import { RemoteRepository } from './RemoteRepository'

private mapAuditToSong(jsonb: any): Song {
  // Use RemoteRepository's existing conversion
  // It already handles snake_case → camelCase
  return {
    id: jsonb.id,
    title: jsonb.title,
    artist: jsonb.artist || '',
    album: jsonb.album || undefined,
    key: jsonb.key || '',
    bpm: jsonb.tempo || 120,  // tempo → bpm
    // ... rest of mapping
  }
}
```

**Alternative:** Extract RemoteRepository mapping functions into shared utils

---

## Part 4: Implementation Plan

### Prerequisites

**✅ DONE:**
1. Audit log migration created
2. Triggers implemented
3. RLS policies defined

**⚠️ TODO:**
1. Apply audit_log migration to Supabase
2. Verify triggers are firing
3. Test RLS policies

### Migration Path

#### Phase 1: Prepare (30 min)

**1.1: Apply Migration**
```bash
# If using local Supabase
supabase db reset  # Reapply all migrations

# If using hosted Supabase
# Run migration via Supabase Studio or CLI
```

**1.2: Verify Audit Log**
```sql
-- Check table exists
SELECT * FROM information_schema.tables WHERE table_name = 'audit_log';

-- Check triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%audit%';

-- Test trigger (should create audit entry)
INSERT INTO songs (...) VALUES (...);
SELECT * FROM audit_log WHERE table_name = 'songs' ORDER BY changed_at DESC LIMIT 1;
```

**1.3: Enable Realtime on audit_log**
```sql
-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Set replica identity (for DELETE events, though we only care about INSERT)
ALTER TABLE audit_log REPLICA IDENTITY FULL;
```

#### Phase 2: Implement Audit-First Handler (1 hour)

**2.1: Add Audit Types**
```typescript
// Add to RealtimeManager.ts
interface AuditLogEntry {
  id: string
  table_name: 'songs' | 'setlists' | 'shows' | 'practice_sessions'
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  user_id: string | null
  user_name: string
  changed_at: string
  old_values: any
  new_values: any
  band_id: string
}
```

**2.2: Implement subscribeToAuditLog()**
```typescript
private async subscribeToAuditLog(userId: string, bandId: string): Promise<void> {
  const channelName = `audit-${bandId}`

  const channel = this.supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT',  // Only INSERT (audit log is append-only)
      schema: 'public',
      table: 'audit_log',
      filter: `band_id=eq.${bandId}`
    }, (payload: any) => {
      this.handleAuditChange(payload).catch(error => {
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
      }
    })

  this.channels.set(channelName, channel)
}
```

**2.3: Implement handleAuditChange()**

See "Unified Event Handler" section above for full implementation.

**2.4: Implement Mapping Helpers**

See "Record Mapping" section above for conversion logic.

#### Phase 3: Update Entry Point (15 min)

**3.1: Modify subscribeToUserBands()**
```typescript
async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  this.currentUserId = userId

  for (const bandId of bandIds) {
    // NEW: Single audit subscription per band
    await this.subscribeToAuditLog(userId, bandId)

    // OLD: Removed subscribeToBand() which did 4 subscriptions
  }

  if (this.channels.size > 0) {
    this.connected = true
  }
}
```

**3.2: Remove Old Methods**
- Delete `subscribeToBand()`
- Delete `subscribeToTable()`
- Delete `handleSongChange()`
- Delete `handleSetlistChange()`
- Delete `handleShowChange()`
- Delete `handlePracticeSessionChange()`

**Result:** ~340 lines of code removed!

#### Phase 4: Test (45 min)

**4.1: Unit Tests**
- Mock audit_log payload
- Verify mapping functions
- Verify event emission

**4.2: Integration Test**
```bash
# Two-browser test
1. Open Chrome + Firefox
2. Login as different users, same band
3. Create song in Chrome → Should appear in Firefox
4. Update song in Firefox → Should update in Chrome
5. Delete song in Chrome → Should remove in Firefox
6. Check toast shows ACTUAL user name (not "Someone")
7. Check toast shows correct item name (not "undefined")
```

**4.3: Performance Test**
- Measure latency: DELETE on Device A → UI update on Device B
- Target: < 1 second
- Compare to current implementation

---

## Part 5: Risk Analysis

### Risk 1: Audit Log Migration Not Applied

**Likelihood:** High (local Supabase not initialized)
**Impact:** High (blocks implementation)

**Mitigation:**
1. Document clear migration steps
2. Test on hosted Supabase first
3. Provide rollback plan

**Rollback:** Keep current per-table subscription code until audit-first is proven

### Risk 2: JSONB Mapping Errors

**Likelihood:** Medium (complex field conversions)
**Impact:** Medium (data corruption if wrong)

**Mitigation:**
1. Reuse existing RemoteRepository mapping
2. Add validation/type checking
3. Log any mapping errors
4. Test with real data samples

**Validation Code:**
```typescript
private validateSong(song: any): song is Song {
  return (
    typeof song.id === 'string' &&
    typeof song.title === 'string' &&
    typeof song.bpm === 'number' &&
    // ... rest of validation
  )
}
```

### Risk 3: RLS Policy Blocks Subscriptions

**Likelihood:** Low (RLS looks correct)
**Impact:** High (no real-time updates)

**Mitigation:**
1. Test RLS policies in SQL before coding
2. Verify band_memberships query works
3. Check Supabase logs for RLS errors

**Test Query:**
```sql
-- As authenticated user
SET request.jwt.claims.sub = '{user-id}';

-- Should return audit entries for user's bands only
SELECT * FROM audit_log WHERE band_id = '{band-id}' LIMIT 10;
```

### Risk 4: Performance Degradation

**Likelihood:** Low (fewer subscriptions = better)
**Impact:** Medium (if audit table grows large)

**Mitigation:**
1. Audit log has proper indexes (already defined)
2. Monitor query performance
3. Consider archiving old audit entries

**Indexes (Already Defined):**
```sql
CREATE INDEX idx_audit_log_band_date ON audit_log(band_id, changed_at DESC);
```

---

## Part 6: Benefits Analysis

### Benefits Summary

| Aspect | Current | Audit-First | Improvement |
|--------|---------|-------------|-------------|
| **Subscriptions** | 4 per band | 1 per band | 75% reduction |
| **Code Lines** | ~340 lines | ~120 lines | 65% reduction |
| **DELETE Metadata** | Missing | Complete | ✅ Fixed |
| **User Attribution** | "Someone" | Actual name | ✅ Fixed |
| **Future Tables** | Add new handler | Automatic | ✅ Scalable |
| **Audit Trail** | None | Complete | ✅ Bonus |

### Long-Term Benefits

**1. Compliance & Debugging**
- Complete change history
- Who changed what, when
- Can reconstruct any record state

**2. Undo Functionality**
- `old_values` JSONB enables undo
- Can revert changes programmatically

**3. Activity Dashboard**
- Recent changes feed
- User activity tracking
- Band collaboration insights

**4. Extensibility**
- Add new tables? Audit log handles automatically
- No RealtimeManager changes needed

---

## Part 7: Specification Updates Needed

### Files to Update

**1. Bidirectional Sync Specification**
- **File:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`
- **Section:** "Flow 6: Real-Time WebSocket Sync"
- **Changes:**
  - Replace per-table subscription with audit-first approach
  - Update architecture diagram
  - Document audit_log schema
  - Update event handling flow

**2. Unified Database Schema**
- **File:** `.claude/specifications/unified-database-schema.md`
- **Changes:**
  - Add `audit_log` table documentation
  - Document field mapping for audit JSONB

**3. Implementation Instructions**
- **New File:** `.claude/instructions/05-audit-first-realtime-implementation.md`
- **Contents:**
  - Step-by-step implementation guide
  - Code samples
  - Testing checklist
  - Rollback procedures

---

## Part 8: Implementation Checklist

### Prerequisites
- [ ] Apply audit_log migration to Supabase
- [ ] Enable realtime on audit_log table
- [ ] Verify triggers are firing (test INSERT/UPDATE/DELETE)
- [ ] Verify RLS policies work (test as different users)

### Code Changes
- [ ] Add AuditLogEntry interface
- [ ] Implement subscribeToAuditLog()
- [ ] Implement handleAuditChange()
- [ ] Implement handleRecordUpsert()
- [ ] Implement handleRecordDelete()
- [ ] Implement mapping helpers (mapAuditToSong, etc.)
- [ ] Implement extractItemName()
- [ ] Update subscribeToUserBands()
- [ ] Remove old subscription methods
- [ ] Remove old change handlers

### Testing
- [ ] Unit tests for mapping functions
- [ ] Unit tests for audit event handling
- [ ] Integration test: Two-browser CREATE
- [ ] Integration test: Two-browser UPDATE
- [ ] Integration test: Two-browser DELETE
- [ ] Performance test: Measure latency
- [ ] Toast test: Verify user name displayed
- [ ] Toast test: Verify item name displayed

### Validation
- [ ] No console errors
- [ ] Toast notifications appear < 2s
- [ ] UI updates < 1s
- [ ] Correct user attribution
- [ ] Works across multiple bands
- [ ] Works offline → online

### Documentation
- [ ] Update sync specification
- [ ] Create implementation instructions
- [ ] Document rollback procedure
- [ ] Update CLAUDE.md if needed

---

## Part 9: Rollback Plan

If audit-first approach fails, we can rollback:

### Keep Old Code
```typescript
// In RealtimeManager.ts, add feature flag
private USE_AUDIT_FIRST = false  // Set to false to rollback

async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  if (this.USE_AUDIT_FIRST) {
    // New: Audit-first approach
    for (const bandId of bandIds) {
      await this.subscribeToAuditLog(userId, bandId)
    }
  } else {
    // Old: Per-table approach (keep as fallback)
    for (const bandId of bandIds) {
      await this.subscribeToBand(userId, bandId)
    }
  }
}
```

### Gradual Migration
1. Test audit-first with 1 band
2. If successful, enable for all bands
3. If issues, revert to per-table for affected users
4. Debug and retry

---

## Conclusion

**Recommendation:** Proceed with audit-first approach

**Confidence Level:** High (95%)

**Reasons:**
1. Audit log migration already exists and is well-designed
2. Benefits are significant (75% fewer connections, complete DELETE metadata)
3. Code simplification is substantial (340 → 120 lines)
4. Future-proof architecture
5. Rollback plan exists

**Risks:** Manageable
- Migration must be applied first
- JSONB mapping needs careful testing
- RLS policies need verification

**Next Steps:**
1. Create implementation instructions document
2. Apply migration to Supabase
3. Implement audit-first handler
4. Test thoroughly
5. Update specifications

**Estimated Timeline:**
- Prerequisites: 30 minutes
- Implementation: 1-1.5 hours
- Testing: 45 minutes
- Documentation: 30 minutes
- **Total: 2.5-3 hours**

---

**Ready to proceed with implementation instructions?**
