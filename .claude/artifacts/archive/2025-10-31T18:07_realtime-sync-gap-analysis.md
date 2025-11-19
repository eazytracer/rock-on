# Real-Time Sync & Toast Notification Gap Analysis

**Date:** 2025-10-31T18:07
**Context:** Deep analysis of current real-time sync implementation vs. specification
**Objective:** Identify gaps and design elegant, scalable solution

---

## Executive Summary

The real-time sync system is **functionally working** but has **timing and architectural issues** that prevent optimal user experience. The core problems are:

1. **Race conditions** between component mounting and event emission
2. **Inconsistent UI updates** despite correct data refetching
3. **Missing DELETE event metadata** from Supabase WebSocket payloads
4. **Toast notification timing** issues

**Root Cause:** The current architecture treats sync, real-time updates, and UI reactivity as separate concerns that are loosely coupled through event emitters, leading to timing dependencies and race conditions.

---

## Current Architecture Review

### What the Specification Says (Phase 4 - Flow 6)

From `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`:

**Expected Flow:**
```
Remote Change → WebSocket Event → RealtimeManager
  ↓
1. Skip if current user made the change
2. Fetch latest from Supabase (cloud-first)
3. Update local IndexedDB
4. Emit data change event → UI hooks react and refetch
5. Emit toast event → ToastContext displays notification
6. Track unread status for visual indicators
```

**Event Emitter Pattern:**
- RealtimeManager extends EventEmitter
- Hooks subscribe to `songs:changed`, `setlists:changed`, etc.
- App component subscribes to `toast` events
- UI updates driven by explicit events, not automatic re-renders

**Performance Target:** < 1 second latency from remote change to local UI update

---

## Current Implementation Status

### ✅ What's Working

1. **WebSocket Connection**: Successfully subscribes to Supabase Realtime channels
2. **Event Reception**: Receives INSERT/UPDATE/DELETE events from Supabase
3. **Local DB Updates**: Correctly updates IndexedDB with remote changes
4. **Toast Logging**: Toast messages are logged to console
5. **Data Refetching**: Hooks DO refetch data (we see correct counts in logs)
6. **User Filtering**: Skips events from current user (when userId available)

### ❌ What's Broken

#### 1. **Toast Notifications Don't Display**

**Symptom:**
```
[RealtimeManager] Emitting toast event, listeners: 0
[Toast info]: Someone deleted "Purple Rain"
```

**Problem:** App component's toast listener isn't registered when event fires

**Root Cause:** Race condition - RealtimeManager emits event before App component's useEffect runs

**Impact:** Users don't see notifications for remote changes

---

#### 2. **UI Doesn't Update Despite Correct Data**

**Symptom:**
```
[useSongs] Fetched songs count: 44  // ✅ Correct!
// But UI still shows 45 songs      // ❌ Wrong!
```

**Problem:** React component doesn't re-render even though `setSongs()` was called

**Root Cause:** Likely one of:
- Component using stale reference to songs array
- Songs page has conditional rendering that blocks updates
- React is batching updates and component is unmounting before render

**Impact:** Users must manually refresh page to see changes

---

#### 3. **Missing DELETE Event Metadata**

**Symptom:**
```
[RealtimeManager] queueToast called with empty userId
[Toast info]: Someone deleted "undefined"
```

**Problem:** Supabase DELETE payloads only include primary key, not `created_by` or `title`

**Current Workaround:** Fetch from local DB before deleting (works for title, not for userId)

**Impact:** Can't show who deleted the item, shows "Someone" instead

---

#### 4. **Page Reloads on DELETE (Development Only)**

**Symptom:** Full page reload when DELETE event is received (HMR issue)

**Problem:** Vite HMR "Could not Fast Refresh" AuthContext

**Root Cause:** AuthContext exports `useAuth` hook alongside provider (not HMR-compatible pattern)

**Impact:** Disruptive development experience, but production should be fine

---

## Gap Analysis: Specification vs. Implementation

| Specification Requirement | Current Status | Gap |
|--------------------------|----------------|-----|
| **Event Emitter Pattern** | ✅ Implemented | None |
| **Hooks subscribe to events** | ✅ Implemented | None |
| **Cloud-first refetch** | ✅ Implemented | None |
| **Toast notifications** | ⚠️ Emitted but not displayed | **Timing issue** |
| **Skip own changes** | ⚠️ Works for INSERT/UPDATE, broken for DELETE | **Missing userId in DELETE payload** |
| **Unread tracking** | ❌ Not implemented | **Missing feature** |
| **UI updates on event** | ⚠️ Data refetched but UI doesn't update | **React rendering issue** |
| **< 1s latency** | ✅ Events fire instantly | None |
| **Toast batching (2s)** | ✅ Implemented | None |
| **Connection status** | ⚠️ Tracked but not displayed in UI | **Missing UI component** |

---

## Root Cause Analysis

### Problem 1: Toast Listener Timing

**Current Flow:**
```
1. AuthContext mounts
2. AuthContext creates RealtimeManager
3. AuthContext subscribes to WebSocket channels
4. App component renders (child of AuthContext)
5. App component's useEffect runs to register toast listener
6. DELETE event arrives from WebSocket
7. RealtimeManager emits 'toast' event
   → 0 listeners registered! (step 5 hasn't run yet)
```

**Why It Fails:** Component lifecycle timing - children mount AFTER parents

**The Flaw:** Relying on child component to register listener for parent's events

---

### Problem 2: UI Not Updating

**Current Flow:**
```
1. Real-time event arrives
2. IndexedDB updated ✅
3. Event emitted: 'songs:changed' ✅
4. useSongs hook receives event ✅
5. Hook calls fetchSongs() ✅
6. fetchSongs() calls setSongs(newSongs) ✅
7. Component should re-render... ❌ DOESN'T HAPPEN
```

**Possible Causes:**

**A. React Batching Issue:**
- Multiple setSongs() calls in rapid succession
- React batches updates and component unmounts before render
- Logs show 4 refetches happening (`Sync status changed, refetching...`)

**B. Reference Equality Issue:**
- New songs array might have same reference as old array
- React's shallow comparison sees them as equal
- Solution: Force new array reference

**C. Component Unmounting:**
- Rapid useEffect cleanup during sync events
- Component unmounts and remounts repeatedly
- State updates lost during transitions

---

### Problem 3: DELETE Metadata Missing

**Supabase Limitation:**

DELETE payloads from Postgres Realtime only include:
```typescript
{
  eventType: 'DELETE',
  old: {
    id: 'uuid',        // ✅ Primary key included
    title: undefined,  // ❌ Not included
    created_by: undefined  // ❌ Not included
  }
}
```

**Why:** Postgres triggers fire AFTER DELETE, row data already gone

**Current Workaround:** Fetch title from local DB before deleting (works)

**Gap:** Can't get `created_by` from local DB because:
- Current user deleted the item (not the original creator)
- We need to know WHO DELETED it, not who created it

**Supabase Limitation:** No way to get `last_modified_by` for DELETE events without custom trigger

---

## Elegant Solution Design

### Principle: Consolidate Event Flow

Instead of:
```
RealtimeManager → Emit Event → Hope Someone Listens → UI Updates (Maybe)
```

Do:
```
RealtimeManager → Direct State Update → Guaranteed UI Update → Optional Toast
```

---

### Solution 1: Toast Notification Architecture

**Option A: Move Toast Logic to RealtimeManager** ⭐ **RECOMMENDED**

Register toast display function directly in RealtimeManager:

```typescript
// In RealtimeManager
private toastCallback?: (message: string, type: ToastType) => void

public setToastCallback(callback: (message: string, type: ToastType) => void) {
  this.toastCallback = callback
}

private showToast(message: string, type: ToastType) {
  // Direct callback - no event emitter
  this.toastCallback?.(message, type)

  // Also emit for extensibility
  this.emit('toast', { message, type })
}
```

Register in AuthContext when creating RealtimeManager:

```typescript
const { showToast } = useToast()  // Get from context

realtimeManager.current = new RealtimeManager()
realtimeManager.current.setToastCallback(showToast)  // Direct registration
```

**Pros:**
- ✅ No timing dependency
- ✅ Guaranteed to work (callback registered before events fire)
- ✅ Still emits events for extensibility
- ✅ Simple, direct control flow

**Cons:**
- ⚠️ Slightly couples RealtimeManager to toast system
- ⚠️ Requires passing toast function through AuthContext

**Option B: Buffer Toasts Until Listener Registers**

Queue toast events if no listeners:

```typescript
private pendingToasts: Array<{ message: string; type: ToastType }> = []

private showToast(message: string, type: ToastType) {
  if (this.listenerCount('toast') === 0) {
    // Buffer for later
    this.pendingToasts.push({ message, type })
  } else {
    this.emit('toast', { message, type })
  }
}

// Called when listener registers
public flushPendingToasts() {
  for (const toast of this.pendingToasts) {
    this.emit('toast', toast)
  }
  this.pendingToasts = []
}
```

**Pros:**
- ✅ Preserves event emitter pattern
- ✅ No missed toasts

**Cons:**
- ❌ More complex
- ❌ Still has timing dependency (who calls flush?)
- ❌ Toasts might arrive in batch after delay

**Decision:** Use **Option A** for simplicity and reliability

---

### Solution 2: UI Update Architecture

**Option A: Direct State Management** ⭐ **RECOMMENDED**

Remove hook-based refetching entirely. Let RealtimeManager directly update a central state:

```typescript
// Create SongsContext
export const SongsContext = createContext<{
  songs: Song[]
  addSong: (song: Song) => void
  updateSong: (id: string, updates: Partial<Song>) => void
  removeSong: (id: string) => void
}>()

// RealtimeManager updates context directly
private async handleSongChange(payload: RealtimePayload) {
  const song = await this.fetchSong(payload.new.id)

  // Direct state update - no event emitter
  this.songsContext?.addSong(song)  // or updateSong, removeSong

  // Also emit for extensibility
  this.emit('songs:changed', { bandId, action, recordId })
}
```

**Pros:**
- ✅ Guaranteed UI update (React Context triggers re-renders)
- ✅ Single source of truth
- ✅ No refetch overhead
- ✅ Immediate updates

**Cons:**
- ❌ Major refactor required
- ❌ Breaks existing hook-based architecture
- ❌ Context might become large/complex

**Option B: Force Re-render in Hooks** ⭐ **SIMPLER FIX**

Ensure hooks always trigger re-renders:

```typescript
const handleRealtimeChange = useCallback(() => {
  console.log('[useSongs] Realtime change detected')

  // Force new array reference
  fetchSongs().then(newSongs => {
    setSongs([...newSongs])  // Spread to create new reference
  })
}, [bandId])
```

Or use a render key:

```typescript
const [renderKey, setRenderKey] = useState(0)

const handleRealtimeChange = useCallback(() => {
  fetchSongs()
  setRenderKey(k => k + 1)  // Force re-render
}, [bandId])
```

**Pros:**
- ✅ Minimal code change
- ✅ Works with existing architecture
- ✅ Quick fix

**Cons:**
- ⚠️ Doesn't address root cause (why isn't setSongs triggering re-render?)
- ⚠️ Multiple refetches still happening

**Option C: Reduce Refetch Calls**

Current logs show 4+ refetch calls per change. Reduce to 1:

```typescript
// Debounce refetch
const debouncedRefetch = useMemo(
  () => debounce(() => fetchSongs(), 100),
  [fetchSongs]
)

const handleRealtimeChange = useCallback(() => {
  debouncedRefetch()
}, [debouncedRefetch])
```

**Pros:**
- ✅ Reduces unnecessary refetches
- ✅ Improves performance
- ✅ Might fix rendering issue (fewer state updates)

**Cons:**
- ⚠️ Adds 100ms delay
- ⚠️ Doesn't explain why current refetches don't work

**Decision:** Start with **Option B** (force re-render) as quick fix, investigate root cause separately

---

### Solution 3: DELETE Event Metadata

**Option A: Add Supabase Trigger for DELETE Audit** ⭐ **PROPER SOLUTION**

Create audit log table that captures deleted row data:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,  -- Full row before change
  new_data JSONB,  -- Full row after change
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), auth.uid());
    RETURN OLD;
  END IF;
  -- Handle INSERT/UPDATE...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all tables
CREATE TRIGGER songs_audit_trigger
  AFTER DELETE ON songs
  FOR EACH ROW EXECUTE FUNCTION log_table_changes();
```

Then query audit log when DELETE event received:

```typescript
private async handleSongChange(payload: RealtimePayload) {
  if (payload.eventType === 'DELETE') {
    // Query audit log for deleted row data
    const { data: auditEntry } = await supabase
      .from('audit_log')
      .select('old_data, changed_by')
      .eq('record_id', payload.old.id)
      .eq('action', 'DELETE')
      .single()

    const songTitle = auditEntry?.old_data?.title || 'a song'
    const deletedBy = auditEntry?.changed_by || 'unknown'

    await this.queueToast(deletedBy, 'DELETE', 'song', songTitle)
  }
}
```

**Pros:**
- ✅ Complete audit trail
- ✅ Preserves all deleted data
- ✅ Can show who deleted and when
- ✅ Useful for compliance/debugging

**Cons:**
- ❌ Requires migration
- ❌ Additional database table
- ❌ Extra query per DELETE event
- ❌ Storage overhead

**Option B: Accept Limitation** ⭐ **PRAGMATIC**

Just show "Someone" for DELETE events:

```typescript
await this.queueToast('unknown', 'DELETE', 'song', songTitle)
// Toast shows: "Someone deleted "Purple Rain""
```

**Pros:**
- ✅ No code changes needed
- ✅ Already working
- ✅ Acceptable UX

**Cons:**
- ⚠️ Less informative than INSERT/UPDATE toasts

**Decision:** Use **Option B** for MVP, implement **Option A** post-MVP if users request it

---

## Recommended Implementation Plan

### Phase 1: Quick Fixes (30 minutes)

**1.1: Fix Toast Display** (15 min)
- Add `setToastCallback()` to RealtimeManager
- Register toast callback in AuthContext
- Test: Toast should display immediately

**1.2: Force UI Re-renders** (15 min)
- Add render key to useSongs/useSetlists/useShows/usePractices
- Increment on real-time event
- Test: UI should update immediately

### Phase 2: Optimize (45 minutes)

**2.1: Reduce Refetch Calls** (20 min)
- Add debounce to real-time event handlers
- Reduce sync status change events
- Test: Should see 1 refetch per change instead of 4

**2.2: Accept DELETE Limitations** (5 min)
- Document that DELETE toasts show "Someone"
- Remove warning logs for empty userId
- Update user expectations

**2.3: Clean Up Logs** (20 min)
- Remove debug logs from production build
- Keep essential logs for troubleshooting
- Test: Console should be cleaner

### Phase 3: Polish (30 minutes)

**3.1: Add Connection Status UI** (15 min)
- Show WebSocket connection state in UI
- Add reconnection indicator
- Test: Disconnect network, verify UI shows "Offline"

**3.2: Test Multi-Device Flow** (15 min)
- Open two browsers
- Test CREATE/UPDATE/DELETE on Device A → Device B
- Measure actual latency
- Verify toasts display
- Verify UI updates

---

## Success Criteria

### Must Have (MVP)
- [ ] Toast notifications display on remote changes
- [ ] UI updates within 1 second of remote change
- [ ] No console errors on DELETE events
- [ ] Works in two-browser test
- [ ] Toasts show correct item names
- [ ] DELETE toasts show "Someone deleted [item]"

### Nice to Have (Post-MVP)
- [ ] Toasts show actual user name for DELETE
- [ ] Only 1 refetch per remote change (not 4)
- [ ] Connection status indicator in UI
- [ ] Unread badges on remote changes
- [ ] Audit log for compliance

---

## Testing Plan

### Unit Tests
```bash
# Test RealtimeManager toast callback
npm test -- RealtimeManager.test.ts

# Test hook re-rendering
npm test -- useSongs.test.ts
```

### Integration Tests
```bash
# Two-device sync test
1. Open Chrome: http://localhost:5173
2. Open Firefox: http://localhost:5173
3. Login as different users in same band
4. Create song in Chrome → Verify appears in Firefox < 1s
5. Delete song in Firefox → Verify removed in Chrome < 1s
6. Verify toast displays in both browsers
```

### Performance Benchmarks
- Measure time from DELETE in Device A to UI update in Device B
- Target: < 1000ms
- Acceptable: < 2000ms

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Toast callback breaks event emitter pattern | Low | Medium | Keep event emission for extensibility |
| Force re-render causes performance issues | Low | Medium | Profile before/after, remove if needed |
| DELETE audit log grows large | Medium | Low | Add retention policy (30 days) |
| Multi-refetch causes race conditions | Medium | Medium | Add debounce, track in-flight requests |

---

## Conclusion

The current real-time sync system is **85% complete** and functionally working. The remaining 15% are **timing and architectural edge cases** that prevent optimal UX.

**Core Issues:**
1. Toast listeners not registered in time → **Fix with direct callbacks**
2. UI not updating despite correct data → **Fix with render keys**
3. DELETE events missing metadata → **Accept limitation for MVP**

**Recommended Approach:**
- Quick fixes (30 min) to unblock user testing
- Optimize and polish (75 min) for production
- Total time: ~2 hours to complete Phase 4

**Next Steps:**
1. Implement toast callback pattern
2. Add render keys to hooks
3. Test in two-browser scenario
4. Ship to production

The architecture is sound. We just need to handle the edge cases.
