---
title: Phase 4 - Event Emitter Pattern Specification Update
created: 2025-10-30T23:17
status: Complete - Architecture Finalized
phase: Phase 4
type: Architecture Decision & Planning Update
prompt: "Review gap analysis, add event emitter pattern to specification, update roadmap with implementation plan"
---

# Phase 4 - Event Emitter Pattern Specification Update

## Executive Summary

**Decision Made:** Event Emitter Pattern for UI Reactivity ✅

Following the gap analysis in `.claude/artifacts/2025-10-30T23:11_phase4-gap-analysis.md`, we have finalized the architecture for Phase 4 real-time sync using the **Event Emitter pattern** for UI reactivity.

**Status:** Phase 4 is now 70% complete with clear implementation path
**Remaining Work:** 3-4 hours (Steps 4.1-4.5)
**ETA:** Phase 4 completion by end of day

---

## Documents Updated

### 1. Bidirectional Sync Specification ✅

**File:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

**Changes Made:**
- ✅ Updated frontmatter with new timestamp (2025-10-30T23:17)
- ✅ Added event emitter pattern architecture to Flow 6
- ✅ Documented complete event type system (current + future)
- ✅ Provided UI integration pattern examples
- ✅ Added extensibility framework for future phases
- ✅ Updated Phase 4 status from 30% → 70% complete
- ✅ Updated ETA from 10-12 hours → 3-4 hours remaining
- ✅ Replaced generic TODO list with event emitter implementation steps

**Key Additions:**

#### Event Emitter Architecture
```typescript
export class RealtimeManager extends EventEmitter {
  private async handleTableChange(table: string, payload: any) {
    // 1. Fetch from Supabase
    // 2. Update local IndexedDB
    await db[table].put(record)

    // 3. Emit for UI reactivity
    this.emit(`${table}:changed`, { bandId, action, recordId })

    // 4. Emit for toast notifications
    this.emit('toast', { message, type })
  }
}
```

#### Event Type System
```typescript
type RealtimeEvents = {
  // Current Phase 4 Events
  'songs:changed': { bandId: string; action: string; recordId: string }
  'setlists:changed': { ... }
  'shows:changed': { ... }
  'practices:changed': { ... }
  'toast': { message: string; type: 'info' | 'success' | 'error' }

  // Future extensibility (Phase 5+)
  'song:casting:changed': { songId: string; userId: string; casting: CastingVote }
  'setlist:collaboration:active': { setlistId: string; users: string[] }
  'connection:status': { status: 'connected' | 'connecting' | 'disconnected' }
  'sync:conflict': { table: string; recordId: string; conflict: SyncConflict }
}
```

#### UI Integration Pattern
```typescript
export function useSongs(bandId: string) {
  useEffect(() => {
    const handleChange = () => fetchSongs()
    const manager = getRealtimeManager()
    manager?.on('songs:changed', handleChange)
    return () => manager?.off('songs:changed', handleChange)
  }, [bandId])
}
```

---

### 2. Unified Implementation Roadmap ✅

**File:** `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`

**Changes Made:**
- ✅ Updated frontmatter with new timestamp (2025-10-30T23:17)
- ✅ Added gap analysis to dependencies
- ✅ Updated executive summary: Phase 4 now 70% complete
- ✅ Added event emitter architecture overview to Phase 4
- ✅ Added extensibility framework section
- ✅ Completely rewrote Phase 4 implementation steps

**New Phase 4 Structure:**

#### Step 4.1: Make RealtimeManager an EventEmitter (30 min)
- Import EventEmitter from 'events'
- Extend RealtimeManager class
- Add event emissions after DB writes
- Update all 4 handle methods

#### Step 4.2: Update Hooks to Listen for Events (30 min)
- Export RealtimeManager from AuthContext
- Update useSongs, useSetlists, useShows, usePractices
- Add event listeners with proper cleanup

#### Step 4.3: Integrate Toast Notifications (20 min)
- Find or create ToastContext
- Add toast event listener to layout
- Test toast appearance in UI

#### Step 4.4: Two-Device Sync Testing (30 min)
- Test create, update, delete sync
- Measure latencies (target < 1s)
- Test offline/online scenarios
- Capture screenshots

#### Step 4.5: Phase 4 Completion Report (30 min)
- Document implementation
- Include test results with metrics
- Update specification status

**Total Remaining Time:** ~2 hours (plus 30 min report)

---

## Why Event Emitter Pattern?

### Decision Rationale

**✅ Chosen: Event Emitter Pattern**

**Advantages:**
1. ✅ **Explicit Control**: Clear visibility into when UI updates occur
2. ✅ **Separation of Concerns**: Sync logic separate from UI reactivity
3. ✅ **Extensibility**: Clean foundation for future features
4. ✅ **Familiar Pattern**: Standard Node.js/React pattern
5. ✅ **Debuggable**: Easy to log and monitor event flow

**Rejected Alternatives:**

❌ **Dexie Live Queries**
- Requires additional dependency (`dexie-react-hooks`)
- Different pattern than current hooks
- May cause unnecessary re-renders
- Locks us into Dexie-specific patterns

❌ **Polling**
- Inefficient (CPU/battery drain)
- Delays up to 2 seconds
- Not elegant
- Already proven problematic (causes UI "blinking")

❌ **Sync Engine Notification**
- Blurs line between "sync" and "realtime"
- Semantically confusing
- Mixes concerns

---

## Extensibility Framework

The Event Emitter pattern provides a clean foundation for future features:

### Phase 5+: Song Casting
```typescript
// Backend: Track casting votes in realtime
this.emit('song:casting:changed', {
  songId: song.id,
  userId: user.id,
  casting: { vote: 'yes', timestamp: Date.now() }
})

// Frontend: Update casting UI in real-time
manager.on('song:casting:changed', ({ songId, casting }) => {
  updateCastingDisplay(songId, casting)
})
```

### Phase 5+: Collaborative Editing Indicators
```typescript
// Show who else is editing a setlist
this.emit('setlist:collaboration:active', {
  setlistId: setlist.id,
  users: ['user-1', 'user-2'] // Active editors
})
```

### Post-MVP: Conflict Resolution
```typescript
// Notify user of sync conflicts
this.emit('sync:conflict', {
  table: 'songs',
  recordId: song.id,
  conflict: { local: localVersion, remote: remoteVersion }
})
```

### Phase 4: Connection Status
```typescript
// Real-time connection health
this.emit('connection:status', {
  status: 'connected' | 'connecting' | 'disconnected'
})
```

---

## Implementation Path Forward

### Immediate Next Steps (3-4 hours)

1. **Step 4.1** (30 min): Make RealtimeManager extend EventEmitter
   - Add event emissions after DB writes
   - Test compilation

2. **Step 4.2** (30 min): Update hooks to listen for events
   - Export RealtimeManager from AuthContext
   - Add listeners to all 4 hooks
   - Test event flow

3. **Step 4.3** (20 min): Integrate toast notifications
   - Wire up ToastContext
   - Test toasts appear in UI

4. **Step 4.4** (30 min): Two-device sync testing
   - Test create/update/delete sync
   - Measure latencies
   - Validate < 1s target

5. **Step 4.5** (30 min): Create completion report
   - Document all changes
   - Include test results
   - Update roadmap

### Success Criteria

Phase 4 will be complete when:

- ✅ RealtimeManager is an EventEmitter
- ✅ All hooks listen for relevant events
- ✅ UI updates when remote changes occur
- ✅ Toast notifications appear in UI
- ✅ Two-device sync < 1 second latency
- ✅ All tests passing
- ✅ Completion report created

---

## Database Considerations

**Question:** Does the event emitter pattern require database changes?

**Answer:** ❌ No database changes required

**Rationale:**
- Event Emitter is purely application-layer code
- Database schema already has everything needed (version tracking, last_modified_by)
- Supabase Realtime already configured (REPLICA IDENTITY FULL)
- No new tables or columns needed
- All changes are in TypeScript code only

**Files to Modify:**
1. `src/services/data/RealtimeManager.ts` - Extend EventEmitter
2. `src/contexts/AuthContext.tsx` - Export manager
3. `src/hooks/useSongs.ts` - Add event listener
4. `src/hooks/useSetlists.ts` - Add event listener
5. `src/hooks/useShows.ts` - Add event listener
6. `src/hooks/usePractices.ts` - Add event listener
7. `src/components/layout/ModernLayout.tsx` - Toast integration

**No database migrations needed!** ✅

---

## Performance Expectations

### Current Metrics (from testing)

- **WebSocket connection time:** < 1 second
- **INSERT event latency:** < 1 second
- **UPDATE event latency:** < 1 second
- **DELETE event latency:** < 1 second
- **Event accuracy:** 100%

### Expected Metrics After Implementation

- **Local write:** < 50ms (already achieved)
- **Remote sync latency:** ~300ms (immediate sync - already achieved)
- **Real-time update latency:** < 1s (target for Phase 4)
- **Toast notification delay:** < 500ms
- **UI re-render time:** < 100ms

**Total end-to-end:** Device A change → Device B UI update in **< 1.5 seconds**

---

## Risk Assessment

### Low Risk ✅

**Why Phase 4 is Low Risk:**

1. **Foundation Complete**: WebSocket connection already working
2. **Event Emitter**: Well-proven Node.js pattern
3. **Small Surface Area**: Only 7 files to modify
4. **No Database Changes**: Pure application logic
5. **Easy Rollback**: Can disable event listeners without breaking anything
6. **Incremental Testing**: Each step can be validated independently

### Potential Issues & Mitigations

| Issue | Likelihood | Impact | Mitigation |
|-------|-----------|--------|------------|
| Event listener memory leaks | Low | Medium | Proper cleanup in useEffect return |
| Event emitter type safety | Low | Low | TypeScript event type definitions |
| Toast spam (rapid changes) | Medium | Low | Batching already implemented |
| Infinite re-render loops | Low | High | Careful dependency arrays in useEffect |

**Overall Risk:** LOW ✅

---

## Testing Strategy

### Unit Tests (Optional for Phase 4)

Event emitter pattern can be tested, but not critical for Phase 4 MVP:

```typescript
describe('RealtimeManager Event Emitter', () => {
  it('should emit songs:changed after handleSongChange', async () => {
    const manager = new RealtimeManager()
    let eventFired = false

    manager.on('songs:changed', () => {
      eventFired = true
    })

    await manager.handleSongChange(mockPayload)

    expect(eventFired).toBe(true)
  })
})
```

### Integration Tests (Recommended)

Two-device testing provides better validation than unit tests:

1. Manual testing with Chrome + Firefox
2. Measure actual latencies
3. Test all CRUD operations
4. Validate toast notifications
5. Test offline/online scenarios

**Priority:** Manual integration testing > Unit tests

---

## Documentation Updates Completed

### Specification Document ✅

**File:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

- ✅ Event Emitter architecture documented
- ✅ Event type system defined (current + future)
- ✅ UI integration patterns provided
- ✅ Extensibility framework outlined
- ✅ Implementation steps updated
- ✅ Performance targets included
- ✅ Why not other patterns explained

### Roadmap Document ✅

**File:** `.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`

- ✅ Phase 4 status updated (70% complete)
- ✅ Event Emitter overview added
- ✅ Implementation steps rewritten
- ✅ Time estimates updated (3-4 hours)
- ✅ Extensibility framework noted
- ✅ Dependencies updated

---

## Summary

**What Was Accomplished:**

1. ✅ Reviewed gap analysis and evaluated 4 UI reactivity options
2. ✅ Made architectural decision: Event Emitter pattern
3. ✅ Updated specification with complete event emitter design
4. ✅ Added extensibility framework for future features
5. ✅ Rewrote Phase 4 roadmap with clear implementation steps
6. ✅ Updated time estimates (3-4 hours remaining)
7. ✅ Documented why other patterns were rejected
8. ✅ Provided code examples and integration patterns

**What's Next:**

1. Implement Step 4.1: Make RealtimeManager an EventEmitter (30 min)
2. Implement Step 4.2: Update hooks to listen (30 min)
3. Implement Step 4.3: Integrate toast notifications (20 min)
4. Execute Step 4.4: Two-device testing (30 min)
5. Create Step 4.5: Phase 4 completion report (30 min)

**Total Remaining:** ~2.5 hours of implementation work

**Ready to Proceed:** ✅ YES

---

**Created:** 2025-10-30T23:17
**Status:** Complete - Architecture Finalized
**Phase 4 Progress:** 70% → 100% (after implementation)
**Next Action:** Begin Step 4.1 (Make RealtimeManager an EventEmitter)
