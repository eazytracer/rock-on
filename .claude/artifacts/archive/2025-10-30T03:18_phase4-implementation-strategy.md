---
title: Phase 4 Real-Time WebSocket Sync - Implementation Strategy
created: 2025-10-30T03:18
status: In Progress
phase: Phase 4
prompt: |
  Create implementation strategy for Phase 4 real-time WebSocket sync using Supabase Realtime.
  Review existing infrastructure (ToastContext, AuthContext, Supabase client) and plan TDD approach.
---

# Phase 4: Real-Time WebSocket Sync - Implementation Strategy

## 🎯 Executive Summary

**Goal**: Replace periodic sync (30s polling) with real-time WebSocket subscriptions for sub-second multi-user collaboration.

**Approach**: Use Supabase Realtime (built-in WebSocket support) for live database change notifications.

**Timeline**: 6-8 hours (TDD approach)

---

## 📊 Current State

### What We Have (Phase 3 Complete)
- ✅ Immediate sync (~300ms via queue)
- ✅ Optimistic updates (local writes instant)
- ✅ Version tracking (conflict resolution ready)
- ✅ SyncEngine (21/21 tests passing)
- ✅ ToastContext (notifications ready)
- ✅ AuthContext (user/band context available)
- ✅ Supabase client (`src/services/supabase/client.ts`)

### What We Need to Add
- 🔄 RealtimeManager (WebSocket subscription management)
- 🔄 Real-time event handlers (INSERT/UPDATE/DELETE)
- 🔄 Unread tracking (mark items changed by others)
- 🔄 Toast notifications (show who changed what)
- 🔄 Integration with AuthContext (auto-subscribe on login)

---

## 🏗️ Architecture Design

### Component: RealtimeManager

**Purpose**: Manage WebSocket subscriptions to Supabase tables for the current user's bands.

**Responsibilities**:
1. Subscribe to band channels on user login
2. Listen for INSERT/UPDATE/DELETE events from Supabase
3. Update local IndexedDB when remote changes occur
4. Mark items as "unread" if changed by another user
5. Show toast notifications for remote changes
6. Handle reconnection on network interruptions
7. Batch rapid changes to avoid toast spam

**Location**: `src/services/data/RealtimeManager.ts`

---

## 🔄 Data Flow

### Real-Time Update Flow

```
Device A: User creates song
    ↓
Write to local IndexedDB (instant)
    ↓
Queue for sync → Push to Supabase (~300ms)
    ↓
Supabase database updated
    ↓
PostgreSQL triggers WebSocket event
    ↓
Supabase Realtime broadcasts to all subscribers
    ↓
Device B: RealtimeManager receives event
    ↓
Update local IndexedDB
    ↓
Mark as unread (different user)
    ↓
Show toast: "Alice added 'Song Name'"
    ↓
UI re-renders automatically (React Query invalidation)
```

### Subscription Strategy

**One channel per table per band**:
```
songs-{bandId}      → Listen to songs for this band
setlists-{bandId}   → Listen to setlists for this band
shows-{bandId}      → Listen to shows for this band
practices-{bandId}  → Listen to practice sessions for this band
```

**Why per-band channels?**
- Users are in multiple bands
- Only receive updates for relevant bands
- Reduces unnecessary WebSocket traffic
- Supabase filter: `context_id=eq.{bandId}` or `band_id=eq.{bandId}`

---

## 🧪 Testing Strategy (TDD)

### Unit Tests (4-5 hours)

**File**: `tests/unit/services/data/RealtimeManager.test.ts`

**Test Coverage**:
1. **Subscription Management**
   - ✅ Subscribe to all table channels for a band
   - ✅ Unsubscribe on logout
   - ✅ Subscribe to multiple bands simultaneously
   - ✅ Handle subscription errors gracefully

2. **Event Handling - INSERT**
   - ✅ Remote INSERT updates local IndexedDB
   - ✅ Items created by current user NOT marked unread
   - ✅ Items created by others marked unread
   - ✅ Toast shown for remote inserts

3. **Event Handling - UPDATE**
   - ✅ Remote UPDATE syncs to local
   - ✅ Version increments properly
   - ✅ Conflict resolution (last-write-wins)
   - ✅ Toast shown with user name

4. **Event Handling - DELETE**
   - ✅ Remote DELETE removes from local
   - ✅ Toast shown: "Item deleted"

5. **Reconnection Logic**
   - ✅ Detect disconnection
   - ✅ Attempt reconnect with exponential backoff
   - ✅ Re-subscribe to all channels on reconnect
   - ✅ Trigger background sync on reconnect

6. **Toast Batching**
   - ✅ Batch multiple rapid changes (< 2s apart)
   - ✅ Show single toast: "3 changes by Alice"
   - ✅ Individual toasts for changes > 2s apart

### Integration Tests (1-2 hours)

**File**: `tests/integration/realtime-sync.test.ts`

**Test Scenarios**:
1. **Two-User Simulation**
   - User A creates song
   - User B receives update within 1 second
   - User B sees unread badge

2. **Multi-Table Sync**
   - User A creates song, setlist, show
   - User B receives all three updates
   - All marked as unread

3. **Offline/Online**
   - Disconnect WebSocket
   - Make changes
   - Reconnect
   - Verify sync resumes

### Manual Testing (1 hour)

**Two Browser Tabs**:
1. Tab A: Login as Alice
2. Tab B: Login as Bob
3. Both in same band
4. Tab A: Create song
5. Tab B: Should see song appear + toast
6. Verify < 1 second latency

---

## 📁 File Structure

### New Files to Create

1. **`src/services/data/RealtimeManager.ts`**
   - Main RealtimeManager class
   - WebSocket subscription management
   - Event handlers
   - Toast notifications

2. **`tests/unit/services/data/RealtimeManager.test.ts`**
   - Comprehensive unit tests (TDD)
   - 20+ test cases

3. **`tests/integration/realtime-sync.test.ts`**
   - Integration tests with actual Supabase
   - Two-user scenarios

4. **`.claude/artifacts/2025-10-30T{time}_phase4-completion-report.md`**
   - Final report with results

### Files to Modify

1. **`src/contexts/AuthContext.tsx`**
   - Import RealtimeManager
   - Subscribe on login
   - Unsubscribe on logout

2. **`src/services/data/LocalRepository.ts`** (maybe)
   - Add `markAsUnread()` method if needed
   - Or use existing update methods

---

## 🎨 User Experience Design

### Toast Notifications

**Format**:
```
[Icon] [Message] [Close]
```

**Examples**:
- "Alice added 'Wonderwall'"
- "Bob updated 'Setlist 1'"
- "Charlie deleted a song"
- "3 changes by Alice"

**Styling**: Use existing ToastContext (already perfect!)

### Unread Indicators

**Visual**: Blue badge on sync icon

**Logic**:
- Item created/updated by another user → unread = true
- User views item → unread = false
- Survives page refresh (stored in IndexedDB)

---

## 🚀 Implementation Phases

### Phase 4.1: RealtimeManager Core (3-4 hours)

**TDD Steps**:
1. Write test: "Subscribe to songs channel"
2. Watch it fail
3. Implement RealtimeManager.subscribeToBand()
4. Watch it pass
5. Repeat for all event types

**Deliverables**:
- RealtimeManager class
- Subscribe/unsubscribe methods
- Event handlers (INSERT/UPDATE/DELETE)
- 15+ unit tests passing

### Phase 4.2: Toast Notifications (1-2 hours)

**TDD Steps**:
1. Write test: "Show toast on remote INSERT"
2. Implement toast logic
3. Write test: "Batch rapid changes"
4. Implement batching

**Deliverables**:
- Toast notifications working
- Batching logic implemented
- User name resolution
- 5+ tests passing

### Phase 4.3: Unread Tracking (1-2 hours)

**TDD Steps**:
1. Write test: "Mark remote changes as unread"
2. Implement unread flag updates
3. Write test: "Clear unread on view"
4. Implement clear logic

**Deliverables**:
- Unread tracking working
- Persistence in IndexedDB
- UI updates automatically
- 5+ tests passing

### Phase 4.4: Integration & Testing (1-2 hours)

**Steps**:
1. Integrate with AuthContext
2. Manual testing (two tabs)
3. Performance validation (< 1s latency)
4. Screenshot documentation
5. Completion report

**Deliverables**:
- Full integration working
- Two-tab testing validated
- Screenshots captured
- Phase 4 completion report

---

## 📊 Success Criteria

### Performance
- ✅ WebSocket latency < 1 second
- ✅ Local update still instant (< 50ms)
- ✅ Toast appears within 1 second of remote change
- ✅ No UI blocking or stuttering

### Reliability
- ✅ Reconnection works after network loss
- ✅ No duplicate notifications
- ✅ No missed updates during brief disconnects
- ✅ Graceful degradation if WebSocket fails (fall back to periodic sync)

### User Experience
- ✅ Clear toast messages ("Who did what")
- ✅ Unread badges visible and intuitive
- ✅ No toast spam (batching works)
- ✅ Fast enough to feel "real-time"

### Code Quality
- ✅ All tests passing (20+ unit, 5+ integration)
- ✅ TypeScript compilation clean
- ✅ No breaking changes to existing code
- ✅ Clean architecture (single responsibility)

---

## 🔍 Key Implementation Details

### Supabase Realtime API Usage

```typescript
import { getSupabaseClient } from '../supabase/client'

const supabase = getSupabaseClient()

// Subscribe to songs for a specific band
const channel = supabase
  .channel(`songs-${bandId}`)
  .on('postgres_changes', {
    event: '*',                    // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'songs',
    filter: `context_id=eq.${bandId}`  // Only this band's songs
  }, (payload) => {
    handleSongChange(payload)
  })
  .subscribe()

// Later: unsubscribe
await channel.unsubscribe()
```

### Event Payload Structure

```typescript
interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, any>  // New row (for INSERT/UPDATE)
  old: Record<string, any>  // Old row (for UPDATE/DELETE)
  schema: string
  table: string
}
```

### Determining "Current User" for Unread Logic

```typescript
// From AuthContext
const { currentUser } = useAuth()

// In event handler
if (payload.new.created_by === currentUser?.id) {
  // Current user made this change - don't mark unread
  return
}

// Different user - mark as unread
await localRepo.updateSong(payload.new.id, {
  ...song,
  unread: true
})
```

### User Name Resolution

```typescript
// Option 1: Fetch from local IndexedDB (fast)
const user = await db.users.get(userId)
const displayName = user?.displayName || 'Someone'

// Option 2: Cache user names in RealtimeManager
private userCache = new Map<string, string>()
```

---

## 🛡️ Error Handling

### Scenarios to Handle

1. **WebSocket Connection Fails**
   - Log error
   - Set `isConnected = false`
   - Attempt reconnect (exponential backoff)
   - Fall back to periodic sync if persistent failure

2. **Subscription Error**
   - Log specific channel/table error
   - Continue with other subscriptions
   - Retry failed subscription

3. **Event Handler Error**
   - Catch and log error
   - Don't crash entire RealtimeManager
   - Show error toast to user (optional)

4. **Network Interruption**
   - Detect via connection status
   - Pause subscriptions
   - Trigger background sync when back online
   - Re-subscribe to all channels

---

## 🔄 Rollback Plan

### If Phase 4 Fails

**Easy Rollback**:
- RealtimeManager is additive (no changes to existing sync)
- Simply don't integrate with AuthContext
- Phase 3 immediate sync continues working
- No data loss risk

**Graceful Degradation**:
- If WebSocket fails, periodic sync still works
- User experience slightly worse (30s vs 1s) but functional

---

## 📚 References

### Supabase Documentation
- [Realtime: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Realtime: Subscribe to Changes](https://supabase.com/docs/reference/javascript/subscribe)

### Internal Documents
- `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md` - Overall plan
- `.claude/artifacts/2025-10-30T02:51_phase3-completion-report.md` - Phase 3 status

---

## ✅ Next Steps

1. **Write RealtimeManager.test.ts** (TDD approach)
2. **Implement RealtimeManager.ts** (make tests pass)
3. **Integrate with AuthContext**
4. **Manual testing (two tabs)**
5. **Create completion report**

**Let's begin with the test file!** 🚀

---

**Created**: 2025-10-30T03:18
**Status**: Ready for Implementation
**Confidence**: High (building on proven Phase 3 foundation)
