---
feature: audit-log-sync
issue: practices-audit-sync
created: 2026-01-21
updated: 2026-01-21
status: diagnosis-complete
root-cause: Multiple - missing fields in audit mapper + pages don't listen to sync events
severity: high
---

# Diagnosis: Practices Page Not Syncing via Audit Log

## Issue Summary

**User-reported symptoms:**

1. When User A edits song metadata (from another device, or from the practice screen), the changes don't reflect on User B's practice page that has the session open
2. Session notes (`wrapupNotes`) never appear at all
3. Going to the main songs page, then back to practice, fixes the song data

**Impact:** Multi-device collaboration during practices is broken. Session wrap-up notes are lost during sync.

## Root Causes Identified

### Root Cause 1: `wrapupNotes` Missing from Audit Mapper (CRITICAL)

**File:** `src/services/data/auditMappers.ts:111-132`

The `mapAuditToPractice` function does NOT map `wrapupNotes`:

```typescript
export function mapAuditToPractice(jsonb: any): PracticeSession {
  return {
    id: jsonb.id,
    scheduledDate: parseDate(jsonb.scheduled_date),
    // ... other fields ...
    notes: jsonb.notes || '',
    // ❌ MISSING: wrapupNotes: jsonb.wrapup_notes || '',
    // ❌ MISSING: sessionRating: jsonb.session_rating ?? undefined,
    attendees: jsonb.attendees || [],
    // ...
  }
}
```

**Impact:**

- When practice session is synced via audit log (incremental sync OR real-time WebSocket), `wrapupNotes` is LOST
- User saves wrapup notes → Supabase has full data → audit_log has full data → `mapAuditToPractice` drops `wrapupNotes` → Other user's IndexedDB is missing the field

**Evidence:**

- `RemoteRepository.ts:596` correctly sends: `wrapup_notes: session.wrapupNotes` ✓
- `RemoteRepository.ts:621` correctly receives: `wrapupNotes: row.wrapup_notes ?? ''` ✓
- `auditMappers.ts:111-132` - **NO** `wrapupNotes` or `sessionRating` mapping ✗

This mapper is used by BOTH:

1. `SyncEngine.pullFromAuditLog()` - for incremental sync on app load
2. `RealtimeManager.handleRecordUpsert()` - for real-time WebSocket sync

### Root Cause 2: Practice Pages Don't Listen to Sync Events

**Affected files:**

- `src/pages/PracticeViewPage.tsx` - uses direct `db.*` queries
- `src/pages/PracticeSessionPage.tsx` - uses direct `db.*` queries

**How the audit-log sync architecture works:**

1. User B edits a song → write goes to Supabase
2. Supabase trigger writes to `audit_log` table
3. `RealtimeManager` is subscribed to `audit_log` via WebSocket
4. When audit_log INSERT occurs:
   - `handleAuditChange()` is called
   - `mapAuditToSong()` converts JSONB to Song model
   - `db.songs.put()` updates IndexedDB
   - Emits `'songs:changed'` event

5. Hooks like `useSongs` and `usePractices` subscribe to these events and refetch

6. **Problem:** Practice pages don't use these hooks - they load data directly:

```typescript
// PracticeViewPage.tsx - Lines 155-228
useEffect(() => {
  const loadPractice = async () => {
    // Direct IndexedDB access - no sync event subscription
    const loadedDbSongs = await db.songs
      .where('contextType')
      .equals('band')
      .toArray()
    const practiceSession = await db.practiceSessions.get(practiceId)
  }
  loadPractice()
}, [practiceId, navigate, currentBandId, isNewMode])
// ❌ No RealtimeManager subscription for songs:changed or practices:changed
```

**User flow (broken):**

1. User A opens practice session on Device 1
2. PracticeViewPage loads songs from IndexedDB
3. User B edits a song on Device 2 (or User A on another tab)
4. RealtimeManager receives audit_log event, updates IndexedDB
5. RealtimeManager emits `'songs:changed'` event
6. **PracticeViewPage doesn't listen** - shows stale data
7. User A navigates to Songs page (uses `useSongs` hook which listens)
8. Songs page shows updated data (useSongs received the event)
9. User A navigates back to practice - now shows updated data (fresh IndexedDB read)

## Complete List of Missing Fields in `mapAuditToPractice`

| Field           | In PracticeSession Model | In mapAuditToPractice | In RemoteRepository |
| --------------- | ------------------------ | --------------------- | ------------------- |
| `wrapupNotes`   | ✅ (line 28)             | ❌ **MISSING**        | ✅ (line 621)       |
| `sessionRating` | ✅ (line 31)             | ❌ **MISSING**        | Not mapped          |

## Why Songs Page Works

`SongsPage.tsx` uses `useSongs(currentBandId)` hook which has RealtimeManager subscription:

```typescript
// useSongs.ts - has sync event subscription
useEffect(() => {
  if (realtimeManager) {
    const handleChange = (event: any) => {
      if (event.bandId === bandId) {
        fetchSongs(true) // Refetch when songs:changed fires
      }
    }
    realtimeManager.on('songs:changed', handleChange)
    return () => realtimeManager.off('songs:changed', handleChange)
  }
}, [bandId, realtimeManager, fetchSongs])
```

## Architecture Diagram

```
User B edits song
       ↓
  Supabase songs table (UPDATE)
       ↓
  audit_log trigger (INSERT)
       ↓
  RealtimeManager WebSocket subscription
       ↓
  handleAuditChange() → mapAuditToSong() → db.songs.put()
       ↓
  emit('songs:changed')
       ↓
  ┌─────────────────────────────────┐
  │ useSongs hook                   │ ← LISTENS → refetches → UI updates ✓
  │ (SongsPage, PracticesPage)      │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │ PracticeViewPage                │ ← NOT LISTENING → stale data ✗
  │ PracticeSessionPage             │
  └─────────────────────────────────┘
```

## Fix Plan

### Fix 1: Add Missing Fields to `mapAuditToPractice` (CRITICAL)

**File:** `src/services/data/auditMappers.ts`

```diff
export function mapAuditToPractice(jsonb: any): PracticeSession {
  return {
    id: jsonb.id,
    scheduledDate: parseDate(jsonb.scheduled_date),
    startTime: jsonb.start_time ? parseDate(jsonb.start_time) : undefined,
    endTime: jsonb.end_time ? parseDate(jsonb.end_time) : undefined,
    duration: jsonb.duration || 120,
    location: jsonb.location || '',
    type: jsonb.type || 'rehearsal',
    status: 'scheduled',
    objectives: jsonb.objectives || [],
    completedObjectives: jsonb.completed_objectives || [],
    songs: jsonb.songs || [],
    bandId: jsonb.band_id,
    setlistId: jsonb.setlist_id || undefined,
    notes: jsonb.notes || '',
+   wrapupNotes: jsonb.wrapup_notes || '',
+   sessionRating: jsonb.session_rating ?? undefined,
    attendees: jsonb.attendees || [],
    createdDate: parseDate(jsonb.created_date),
    version: jsonb.version || 0,
    lastModifiedBy: jsonb.last_modified_by || undefined,
  }
}
```

**This fixes:** Session wrap-up notes not appearing on other devices.

### Fix 2: Add RealtimeManager Event Listeners to Practice Pages

**Option A (Quick fix):** Add RealtimeManager subscription directly to pages

**Option B (Better architecture):** Refactor pages to use `useSongs()` and `usePractices()` hooks

**Recommended:** Option A for immediate fix, Option B as follow-up refactor.

**For PracticeViewPage.tsx:**

```typescript
import { useAuth } from '../contexts/AuthContext'

// In component
const { realtimeManager } = useAuth()

// Add effect to listen for changes
useEffect(() => {
  if (!realtimeManager) return

  const handleSongsChange = () => {
    // Refetch songs from IndexedDB (now updated by RealtimeManager)
    loadDbSongs()
  }

  const handlePracticesChange = (event: any) => {
    if (event.recordId === practiceId) {
      // Refetch this practice session
      loadPractice()
    }
  }

  realtimeManager.on('songs:changed', handleSongsChange)
  realtimeManager.on('practices:changed', handlePracticesChange)

  return () => {
    realtimeManager.off('songs:changed', handleSongsChange)
    realtimeManager.off('practices:changed', handlePracticesChange)
  }
}, [realtimeManager, practiceId])
```

**This fixes:** Song/practice changes from other users not appearing in real-time.

### Fix 3: Ensure Song Edits from Practice Page Go Through SyncRepository

**File:** `src/pages/PracticeViewPage.tsx` (EditSongModal save handler)

```diff
- await db.songs.update(updatedSong.id!, updatedSong)
+ import { getSyncRepository } from '../services/data/SyncRepository'
+ await getSyncRepository().updateSong(updatedSong.id!, updatedSong)
```

This ensures edits trigger the sync pipeline and emit events.

## Verification Steps

After applying fixes:

1. **Test wrapupNotes sync:**
   - User A opens practice session, adds wrapup notes, saves
   - User B (or User A on different device) opens same practice
   - Verify wrapup notes appear

2. **Test real-time song updates:**
   - User A opens practice session with songs
   - User B edits a song's metadata (key, BPM, notes)
   - Verify User A sees changes without navigating away

3. **Check browser console:**
   - Look for `[RealtimeManager] Emitting songs:changed event`
   - Look for `[RealtimeManager] Emitting practices:changed event`
   - Verify handlers fire in PracticeViewPage

## Files to Modify

1. `src/services/data/auditMappers.ts` - Add `wrapupNotes`, `sessionRating`
2. `src/pages/PracticeViewPage.tsx` - Add RealtimeManager event subscription
3. `src/pages/PracticeSessionPage.tsx` - Add RealtimeManager event subscription

## Severity

**High** - Multi-user collaboration is broken for practice sessions, and session wrap-up notes are completely lost during sync.

## Next Steps

Ready for `/plan` to create detailed implementation plan.
