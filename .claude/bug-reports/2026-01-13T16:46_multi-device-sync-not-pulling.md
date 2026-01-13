# Bug Report: Multi-Device Sync Not Pulling Remote Changes

**Date:** 2026-01-13
**Severity:** High
**Component:** Sync Engine / Real-time Sync
**Status:** Open

## Summary

When a user is logged in on multiple devices (e.g., PC and mobile), changes made on one device do not appear on the other device until the user clears site data and re-logs in. The sync is one-way: local changes push to Supabase correctly, but remote changes are never pulled to existing sessions.

## User-Reported Symptoms

1. User adds songs on PC - they sync to Supabase correctly
2. User opens app on mobile (already logged in from previous session)
3. Songs added on PC do NOT appear on mobile
4. No errors or warnings in console
5. User must clear all site data and re-login to see the songs
6. After re-login, all songs appear (initial sync works)

## Root Cause Analysis

### The Problem

The `pullFromRemote()` method exists in `SyncEngine.ts` but is only called in specific scenarios:

1. **During `syncNow()`** - Before pushing changes (line 159)
2. **During initial sync** - First login only

It is **NOT called**:

- On app load for returning users
- On page navigation
- On tab/app focus
- Periodically in the background

### Architecture Gap

The bidirectional sync spec (`.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`) shows:

| Feature                        | Status              | Notes                                      |
| ------------------------------ | ------------------- | ------------------------------------------ |
| Initial sync (first login)     | ✅ Complete         | Downloads all data once                    |
| Push to cloud (local → remote) | ✅ Complete         | ~300ms latency                             |
| Periodic pull (60s polling)    | ❌ **DEPRECATED**   | Removed to avoid UI blinking               |
| WebSocket real-time            | 🟡 **30% complete** | RealtimeManager created but not integrated |

**The gap:** Periodic pull was deprecated in favor of WebSocket real-time sync, but WebSocket sync was never completed. This left existing sessions with no way to receive remote changes.

### Code Evidence

```typescript
// SyncEngine.ts - pullFromRemote exists but is rarely called
async pullFromRemote(userId: string): Promise<void> {
  // Pulls songs, setlists, practices, shows, invite codes
  await this.pullSongs(bandIds)
  await this.pullSetlists(bandIds)
  // ...
}

// Only called here:
async syncNow(): Promise<void> {
  // 1. Pull latest from remote (cloud → local)
  if (this.currentUserId) {
    await this.pullFromRemote(this.currentUserId)  // ← Only place it's called regularly
  }
  // 2. Push queued changes (local → cloud)
  await this.processQueue()
}
```

The problem: `syncNow()` is only triggered when there are local changes to push. If a device has no local changes, `pullFromRemote()` is never called.

## Impact

- **Multi-device workflows broken:** Users can't collaborate across devices
- **Data appears "lost":** Users think their data didn't save
- **Workaround is destructive:** Clearing site data loses any unsynced local changes
- **Support burden:** Users report "missing data" bugs

## Recommended Fix Options

### Option 1: Call `pullFromRemote()` on App Load (Quick Fix)

**Pros:** Simple, fast to implement
**Cons:** Adds latency to app startup, not real-time

```typescript
// In AuthContext or App initialization
useEffect(() => {
  if (user && currentBandId) {
    const repo = getSyncRepository()
    repo.pullFromRemote(user.id)
  }
}, [user, currentBandId])
```

### Option 2: Complete WebSocket Real-Time Sync (Best Long-term)

**Pros:** Real-time updates, no polling overhead
**Cons:** More complex, ~7-9 hours estimated work

Complete Phase 4 of the sync spec:

1. Integrate RealtimeManager into AuthContext
2. Subscribe to band channels on login
3. Handle WebSocket events to update local IndexedDB
4. Show toast notifications for remote changes

### Option 3: Add Manual "Refresh" Button (Interim)

**Pros:** User control, simple implementation
**Cons:** Not automatic, poor UX

```tsx
<Button onClick={() => getSyncRepository().pullFromRemote(userId)}>
  Refresh
</Button>
```

### Option 4: Restore Periodic Pull (Not Recommended)

**Pros:** Automatic sync
**Cons:** UI blinking issues (why it was deprecated)

## Acceptance Criteria

- [ ] User A creates song on PC
- [ ] User A's mobile (already logged in) sees song within 5 seconds
- [ ] No need to clear site data or re-login
- [ ] Works for all entity types: songs, setlists, shows, practices
- [ ] No UI blinking or performance degradation

## Related Files

- `src/services/data/SyncEngine.ts` - `pullFromRemote()` method (line 670)
- `src/services/data/SyncRepository.ts` - `pullFromRemote()` wrapper (line 724)
- `src/services/data/RealtimeManager.ts` - WebSocket sync (30% complete)
- `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md` - Sync architecture

## Related Issues

- **2025-12-04T04:31_realtime-sync-one-way.md** - May be the same or related issue
- **Setlist sync bypass bug** - Separate issue where setlists don't push to Supabase at all

## Test Cases Needed

1. Login on Device A, create song
2. Open app on Device B (already logged in) - verify song appears
3. Edit song on Device B - verify change appears on Device A
4. Create setlist on Device A - verify appears on Device B
5. Test with poor network conditions
6. Test with app in background then foregrounded
