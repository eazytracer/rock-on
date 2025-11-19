---
title: Phase 4 Real-Time Sync - Gap Analysis
created: 2025-10-30T23:11
status: Assessment
phase: Phase 4
type: Gap Analysis
---

# Phase 4 Real-Time Sync - Gap Analysis

## Roadmap Requirements (Phase 4)

From `/workspaces/rock-on/.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`:

```markdown
### Phase 4: Real-Time Sync
- [ ] RealtimeManager working
- [ ] Two-device sync (< 1 second)
- [ ] Toast notifications appear
- [ ] Unread tracking works
- [ ] WebSocket reconnection works
- [ ] All tests passing
```

## Current State Assessment

### ✅ What's Working

1. **Supabase Services Running**
   - All 12 containers active
   - Realtime server healthy
   - No service-level issues

2. **WebSocket Connection Established**
   - `setAuth()` correctly implemented in AuthContext
   - Connection established on login
   - Events being received from Supabase

3. **RealtimeManager Core Functionality**
   - Subscribes to all 4 tables (songs, setlists, shows, practice_sessions)
   - Receives INSERT/UPDATE/DELETE events
   - Implements cloud-first fetching (pulls from Supabase on event)
   - Skips events from current user (no echo)

4. **Toast Notifications** (Partial)
   - Backend logic works (console logs show toasts)
   - Batching implemented (2-second debounce)
   - User name resolution works

### ❌ What's Broken

1. **UI Not Updating**
   - `useSongs` hook doesn't react to IndexedDB changes from Realtime events
   - Songs added in one browser don't appear in another
   - Hook only refetches on sync completion, not on direct DB writes

2. **Toast Notifications Not Visible**
   - Console logs work: `[Toast info]: Someone added "Song Name"`
   - But no UI toasts appear (ToastContext integration missing)

3. **Unread Tracking** (Unknown)
   - Backend marks items as `unread: true`
   - But unclear if UI actually displays this

4. **Tests** (Unknown)
   - No realtime-specific tests identified
   - Integration tests may not cover WebSocket scenarios

### ⚠️ Incomplete / Ad-Hoc Issues

**Recent Ad-Hoc Changes (Not in Roadmap):**
- Attempted Dexie hooks subscription (failed - hooks don't work that way)
- Cloud-first fetching in RealtimeManager (good idea but not specified)
- Multiple attempts to fix UI updates without proper design

**Root Problem:**
We're making tactical fixes without a strategic plan for how the UI should react to realtime events.

## The Core Architectural Question

**How should UI components know when IndexedDB changes?**

### Option 1: Dexie Live Queries
```typescript
// Use dexie-react-hooks
const songs = useLiveQuery(
  () => db.songs.where('contextId').equals(bandId).toArray(),
  [bandId]
)
```

**Pros:**
- Automatic reactivity
- Built into Dexie
- No manual subscriptions

**Cons:**
- Adds dependency on `dexie-react-hooks`
- Different pattern than current hooks
- May cause unnecessary re-renders

### Option 2: Event Emitter Pattern
```typescript
// RealtimeManager emits events
realtimeManager.emit('songs:changed', { bandId })

// useSongs subscribes
useEffect(() => {
  const handler = () => fetchSongs()
  realtimeManager.on('songs:changed', handler)
  return () => realtimeManager.off('songs:changed', handler)
}, [bandId])
```

**Pros:**
- Explicit control
- Can debounce/batch
- Familiar pattern

**Cons:**
- More boilerplate
- Manual subscription management
- RealtimeManager needs to become event emitter

### Option 3: Sync Engine Notification
```typescript
// RealtimeManager triggers sync engine after DB write
await db.songs.put(song)
this.syncEngine.notifyLocalChange('songs')

// useSongs already listens to sync status
// Extend to listen for local changes too
```

**Pros:**
- Leverages existing sync infrastructure
- Consistent with current architecture
- Minimal new code

**Cons:**
- Blurs line between "sync" and "realtime"
- May be confusing semantically

### Option 4: Simple Polling (Temporary)
```typescript
// useSongs polls every N seconds when realtime is active
useEffect(() => {
  const interval = setInterval(fetchSongs, 2000)
  return () => clearInterval(interval)
}, [bandId])
```

**Pros:**
- Simple to implement
- Guaranteed to work
- Easy to remove later

**Cons:**
- Inefficient
- Delays up to 2 seconds
- Not elegant

## Recommended Approach

**For Phase 4 (Minimal Viable):**
Use **Option 2: Event Emitter** with these modifications:

1. **RealtimeManager** becomes an EventEmitter
2. **Emits events** after successful DB writes:
   - `songs:changed`
   - `setlists:changed`
   - `shows:changed`
   - `practices:changed`
3. **Hooks subscribe** to specific events
4. **Toast integration** happens in one place (RealtimeManager)

**Why this approach:**
- Aligns with "RealtimeManager working" requirement
- Explicit and debuggable
- Can be replaced with Option 1 later if needed
- Keeps concerns separated

## Implementation Plan (Proper)

### Step 1: Make RealtimeManager an EventEmitter
```typescript
import { EventEmitter } from 'events'

export class RealtimeManager extends EventEmitter {
  // ... existing code

  private async handleSongChange(payload: RealtimePayload) {
    // ... fetch from Supabase, update DB
    await db.songs.put(song)

    // Emit change event
    this.emit('songs:changed', { bandId: song.contextId })
  }
}
```

### Step 2: Update useSongs to Listen
```typescript
export function useSongs(bandId: string) {
  // ... existing code

  useEffect(() => {
    // Listen for realtime changes
    const handleRealtimeChange = () => {
      console.log('[useSongs] Realtime change detected, refetching...')
      fetchSongs()
    }

    // Get RealtimeManager instance from AuthContext
    const manager = getRealtimeManager()
    manager?.on('songs:changed', handleRealtimeChange)

    return () => {
      manager?.off('songs:changed', handleRealtimeChange)
    }
  }, [bandId])
}
```

### Step 3: Integrate Toast UI
```typescript
// In RealtimeManager
private showToast(message: string, type: 'info' | 'success' | 'error') {
  // Emit event that ToastContext can listen to
  this.emit('toast', { message, type })
}
```

### Step 4: Test Two-Browser Sync
- Manual test with Firefox + Chrome
- Verify < 1 second latency
- Check toast appears
- Verify unread markers (if UI supports it)

## What NOT to Do

- ❌ Don't add Dexie hooks (they don't work the way we thought)
- ❌ Don't use polling as a permanent solution
- ❌ Don't make more ad-hoc fixes without updating the plan
- ❌ Don't add live queries unless we commit to that pattern everywhere

## Success Criteria (Phase 4 Complete)

- [ ] Create song in Firefox → Appears in Chrome < 1 second
- [ ] Update song in Chrome → Updates in Firefox < 1 second
- [ ] Delete song in Firefox → Disappears from Chrome < 1 second
- [ ] Toast notification appears in UI (not just console)
- [ ] Unread indicator shows for items modified by others
- [ ] WebSocket survives network interruption and reconnects
- [ ] All existing tests still pass
- [ ] No console errors on realtime events

## Timeline Estimate

**With proper planning:**
- Step 1 (EventEmitter): 30 minutes
- Step 2 (Hook updates): 30 minutes
- Step 3 (Toast integration): 20 minutes
- Step 4 (Testing): 30 minutes
- **Total: ~2 hours**

**Ad-hoc approach (what we were doing):**
- Keep trying random fixes: ∞ hours
- May never work correctly
- Creates technical debt

## Recommendation

**STOP** making fixes right now.

**START** by deciding:
1. Do we want EventEmitter pattern for Phase 4?
2. Or do we want to commit to Dexie live queries?
3. Or something else entirely?

Once decided, update this document with the chosen approach, then implement systematically.

---

**Created:** 2025-10-30T23:11
**Status:** Awaiting Decision
**Blocking:** Phase 4 completion
**Next Action:** User/team decides on UI reactivity pattern
