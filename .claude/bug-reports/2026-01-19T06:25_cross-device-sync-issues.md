# Bug Report: Cross-Device Sync Not Working

**Date:** 2026-01-19
**Severity:** Critical
**Status:** Diagnosed, pending fix

## Summary

Two separate bugs prevent cross-device synchronization from working:

1. **WebSocket real-time sync** skips all changes from the same user (breaks same-user-different-device)
2. **Incremental sync query** misses newly created records (queries `updated_date` which is NULL for new records)

## Symptoms

User scenario:

- User is logged in on both desktop (browser) and phone
- User adds a song on phone
- Song syncs to Supabase (confirmed)
- Desktop does NOT show the new song:
  - Not via WebSocket real-time (immediate)
  - Not via incremental sync (on refresh)

## Bug 1: WebSocket Same-User Skip

### Location

`src/services/data/RealtimeManager.ts` - Lines 787-791

### Current Code

```typescript
// Skip if current user made this change (avoid redundant refetches and toasts)
if (audit.user_id === this.currentUserId) {
  console.log('[RealtimeManager] Skipping own change')
  return
}
```

### Problem

This logic assumes same user = same device. It was intended to prevent the device that made a change from redundantly processing the WebSocket event (since it already has the data locally).

However, when the **same user** is on **two different devices**:

- User adds song on Device A (phone)
- WebSocket sends audit event to both devices
- Device B (desktop) receives event, sees `user_id === currentUserId`, **skips it**
- Song never appears on Device B

### Root Cause

The skip logic uses `user_id` to determine "own change", but it should use something device-specific (like checking if the record already exists locally with the same version).

### Proposed Fix Options

**Option A: Remove the skip entirely**

- Simplest fix
- Downside: Device that made the change will re-fetch and re-process its own change (minor performance hit)

**Option B: Check if local record already has this version**

```typescript
// Instead of skipping by user_id, check if we already have this version
const localRecord = await this.getLocalRecord(audit.table_name, audit.record_id)
if (localRecord && localRecord.version >= audit.new_values?.version) {
  console.log('[RealtimeManager] Already have this version, skipping')
  return
}
```

**Option C: Use a client/device identifier**

- Generate a unique device ID per browser session
- Include it in changes sent to Supabase
- Skip only if device ID matches

### Recommendation

**Option A** is the simplest and safest. The performance cost of re-processing own changes is negligible compared to the bug of missing cross-device changes.

---

## Bug 2: Incremental Sync Misses New Records

### Location

`src/services/data/RemoteRepository.ts` - Lines 210-216

### Current Code

```typescript
const { data, error, count } = await supabase
  .from('songs')
  .select('*', { count: 'exact' })
  .in('context_id', bandIds)
  .eq('context_type', 'band')
  .gte('updated_date', since.toISOString()) // <-- PROBLEM
  .order('updated_date', { ascending: false })
```

### Problem

The query filters by `updated_date >= since`, but:

1. When a song is **created**, `updated_date` is not set (NULL)
2. The `mapSongToSupabase()` function does NOT include `updated_date` field
3. Records with NULL `updated_date` are excluded by the `.gte()` filter

### Root Cause

The field mapping in `mapSongToSupabase()` (line 139-163) does not include `updated_date`:

```typescript
private mapSongToSupabase(song: Partial<Song>): Record<string, any> {
  return {
    id: song.id,
    title: song.title,
    // ... other fields ...
    created_date: song.createdDate,
    // updated_date is NOT included!
  }
}
```

### Affected Queries

All `*Since` methods have the same issue:

| Method                       | File                | Line | Filter Field              |
| ---------------------------- | ------------------- | ---- | ------------------------- |
| `getSongsSince()`            | RemoteRepository.ts | 215  | `updated_date`            |
| `getSetlistsSince()`         | RemoteRepository.ts | ~TBD | `last_modified`           |
| `getPracticeSessionsSince()` | RemoteRepository.ts | ~TBD | `created_date` or similar |
| `getShowsSince()`            | RemoteRepository.ts | ~TBD | `updated_date`            |

### Proposed Fix Options

**Option A: Query both created_date and updated_date**

```typescript
// Use OR condition to get both new and updated records
const { data, error, count } = await supabase
  .from('songs')
  .select('*', { count: 'exact' })
  .in('context_id', bandIds)
  .eq('context_type', 'band')
  .or(
    `created_date.gte.${since.toISOString()},updated_date.gte.${since.toISOString()}`
  )
  .order('created_date', { ascending: false })
```

**Option B: Set updated_date on creation**

- Update `mapSongToSupabase()` to include `updated_date: song.createdDate` for new records
- Requires checking if it's a new record vs update

**Option C: Database trigger to set updated_date**

- Add a Supabase trigger that sets `updated_date = created_date` on INSERT
- Ensures all records have a valid `updated_date`

### Recommendation

**Option A** is the safest immediate fix - it handles both scenarios without requiring database changes.

**Option C** would be a good long-term improvement for data consistency.

---

## Testing Plan

### WebSocket Fix Testing

1. Open app on two devices/browsers with same user account
2. Add a song on Device A
3. Verify Device B shows the song immediately (within 2-3 seconds)
4. Check console on Device B - should NOT say "Skipping own change"

### Incremental Sync Fix Testing

1. Open app on Device A, let it sync
2. Close Device A browser completely
3. Add a song on Device B
4. Wait 1 minute (ensure Device A's sync timestamp is "old")
5. Open Device A browser
6. Verify the new song appears after refresh

### Regression Testing

1. Verify normal single-device operation still works
2. Verify toast notifications still appear for OTHER users' changes
3. Run existing sync tests: `npm test -- tests/unit/services/data/SyncEngine.test.ts`

---

## Files to Modify

| File                                          | Change                                 |
| --------------------------------------------- | -------------------------------------- |
| `src/services/data/RealtimeManager.ts`        | Remove or modify same-user skip logic  |
| `src/services/data/RemoteRepository.ts`       | Fix `getSongsSince()` query            |
| `src/services/data/RemoteRepository.ts`       | Fix `getSetlistsSince()` query         |
| `src/services/data/RemoteRepository.ts`       | Fix `getPracticeSessionsSince()` query |
| `src/services/data/RemoteRepository.ts`       | Fix `getShowsSince()` query            |
| `tests/unit/services/data/SyncEngine.test.ts` | Add tests for new record sync          |

---

## Priority

These bugs should be fixed together as they both affect the same user scenario (cross-device sync). Fixing only one would still leave sync broken.

**Recommended order:**

1. Fix Bug 1 (WebSocket) - enables real-time cross-device sync
2. Fix Bug 2 (Incremental query) - ensures sync works on refresh/reconnect
3. Test both together
