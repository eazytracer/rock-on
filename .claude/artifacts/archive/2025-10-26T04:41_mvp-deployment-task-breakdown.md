---
timestamp: 2025-10-26T04:41
prompt: "Create comprehensive task breakdown for completing Supabase migration, hook integration, test cleanup, and MVP deployment preparation based on comprehensive deployment readiness analysis"
type: task-breakdown
status: active
---

# MVP Deployment Task Breakdown

**Based on**: `.claude/artifacts/2025-10-26T04:29_comprehensive-deployment-readiness-analysis.md`

## Executive Summary

**Current State**: ✅ Sync infrastructure 100% complete | ❌ UI integration 0% complete

**Critical Blocker**: React hooks bypass service layer → no sync functionality in production

**Goal**: Complete hook integration → Clean up tests → Validate with Chrome MCP → Prepare PR

**Estimated Time**: 8-12 hours of focused work

---

## Phase 1: Critical Hook Integration (BLOCKER) 🔴

### Priority: URGENT | Est. Time: 4-6 hours

**Problem**: All React hooks directly access Dexie, bypassing the service layer and sync infrastructure.

**Impact**: Users can create data locally, but nothing syncs to Supabase.

### Tasks

#### Task 1.1: Migrate useSongs Hook ✅ CRITICAL
**File**: `src/hooks/useSongs.ts`
**Status**: Pending
**Estimated Time**: 1-1.5 hours
**Agent**: nextjs-react-developer

**Current State**:
```typescript
// ❌ WRONG - Direct Dexie access
const subscription = liveQuery(async () => {
  const bandSongs = await db.songs
    .where('contextType').equals('band')
    .and(s => s.contextId === bandId)
    .toArray()
  return bandSongs
}).subscribe({ /* ... */ })
```

**Required State**:
```typescript
// ✅ CORRECT - Use service + sync event emitter
import { SongService } from '../services/SongService'
import { getSyncRepository } from '../services/data/SyncRepository'

useEffect(() => {
  // Initial fetch
  const fetchSongs = async () => {
    const songs = await SongService.getBandSongs(bandId)
    setSongs(songs)
  }
  fetchSongs()

  // Listen for sync events
  const repo = getSyncRepository()
  const handleSongChange = () => fetchSongs()
  repo.on('songsChanged', handleSongChange)

  return () => repo.off('songsChanged', handleSongChange)
}, [bandId])
```

**Test Requirements**:
- Create unit tests for migrated hook
- Test that hook uses SongService
- Test that hook responds to sync events
- Test loading/error states

**Success Criteria**:
- useSongs calls SongService methods
- Live updates work via sync event emitter
- All existing UI functionality preserved

---

#### Task 1.2: Migrate useBands Hook ✅ CRITICAL
**File**: `src/hooks/useBands.ts`
**Status**: Pending
**Estimated Time**: 1-1.5 hours
**Agent**: nextjs-react-developer

**Current State**:
```typescript
// ❌ WRONG
const foundBand = await db.bands.get(bandId)
const bandMembers = await db.bandMemberships.where('bandId').equals(bandId).toArray()
```

**Required State**:
```typescript
// ✅ CORRECT
const band = await BandService.getBandById(bandId)
const members = await BandMembershipService.getMembershipsByBandId(bandId)
```

**Test Requirements**:
- Unit tests for all hook functions (useBand, useBandMemberships, etc.)
- Test service integration
- Test sync event listening

**Success Criteria**:
- All CRUD operations use BandService
- Membership operations use BandMembershipService
- Live updates via sync events

---

#### Task 1.3: Migrate useSetlists Hook ✅ CRITICAL
**File**: `src/hooks/useSetlists.ts`
**Status**: Pending
**Estimated Time**: 1-1.5 hours
**Agent**: nextjs-react-developer

**Current State**:
```typescript
// ❌ WRONG
const bandSetlists = await db.setlists.where('bandId').equals(bandId).toArray()
await db.setlists.add(newSetlist)
```

**Required State**:
```typescript
// ✅ CORRECT
const setlists = await SetlistService.getSetlists({ bandId })
await SetlistService.createSetlist(newSetlist)
```

**Test Requirements**:
- Unit tests for useSetlists, useCreateSetlist, etc.
- Test SetlistService integration
- Test sync events

**Success Criteria**:
- All operations use SetlistService
- Song management (add/remove/reorder) works
- Live updates via sync events

---

#### Task 1.4: Migrate usePractices Hook ✅ CRITICAL
**File**: `src/hooks/usePractices.ts`
**Status**: Pending
**Estimated Time**: 1-1.5 hours
**Agent**: nextjs-react-developer

**Current State**:
```typescript
// ❌ WRONG
const bandPractices = await db.practiceSessions
  .where('bandId').equals(bandId)
  .and(p => p.type === 'rehearsal')
  .toArray()
```

**Required State**:
```typescript
// ✅ CORRECT
const practices = await PracticeSessionService.getPracticeSessions({
  bandId,
  type: 'rehearsal'
})
```

**Test Requirements**:
- Unit tests for usePractices
- Test PracticeSessionService integration
- Test sync events

**Success Criteria**:
- All operations use PracticeSessionService
- Attendance tracking works
- Live updates via sync events

---

### Phase 1 Deliverables

✅ **Code Changes**:
- 4 hook files migrated
- All hooks use service layer
- All hooks listen to sync events

✅ **Tests**:
- Unit tests for each hook (target: 40+ new tests)
- All tests passing

✅ **Documentation**:
- Updated hook documentation
- Migration notes in artifact

---

## Phase 2: Test Cleanup 🟡

### Priority: High | Est. Time: 1-2 hours

**Goal**: Remove legacy/failing tests, shelve integration tests per user request

### Tasks

#### Task 2.1: Remove Legacy Integration Tests
**Status**: Pending
**Estimated Time**: 30 minutes

**Actions**:
- Move `tests/integration/practice-scheduling.test.tsx` to `tests/_archived/`
- Move `tests/integration/readiness-check.test.tsx` to `tests/_archived/`
- Move `tests/integration/setlist-creation.test.tsx` to `tests/_archived/`
- Move `tests/integration/song-management.test.tsx` to `tests/_archived/`
- Move `tests/integration/practice-execution.test.tsx` to `tests/_archived/`
- Move `tests/integration/setup.test.tsx` to `tests/_archived/`
- Update git ignore if needed

**Rationale**: User requested integration tests be shelved until better strategy

---

#### Task 2.2: Fix/Remove Legacy Unit Tests
**Status**: Pending
**Estimated Time**: 30 minutes

**Actions**:
- Review `tests/unit/hooks.test.ts` failures:
  - Fix BREAKPOINTS constant mismatch (simple value fix)
  - Remove mobile detection tests if testing legacy code
- Review `tests/unit/utils.test.ts` failures:
  - Remove mobile performance tests if not critical to MVP
  - Or fix mock setup issues if needed for MVP

**Decision Point**: Ask user if mobile performance utilities are needed for MVP

---

#### Task 2.3: Fix App Test
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Fix `src/App.test.tsx` "renders the navigation" test
- Likely needs to wait for auth context to resolve
- Add proper async/await or mock auth state

---

### Phase 2 Deliverables

✅ **Test Suite**:
- Integration tests archived (not deleted)
- Legacy unit tests removed or fixed
- All remaining tests passing

✅ **Documentation**:
- Update test strategy in README
- Note integration tests deferred

---

## Phase 3: Page Integration Validation 🟡

### Priority: High | Est. Time: 1-2 hours

**Goal**: Ensure all pages use the migrated hooks correctly

### Tasks

#### Task 3.1: Validate SongsPage Integration
**File**: `src/pages/NewLayout/SongsPage.tsx`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Verify page imports and uses migrated `useSongs`
- Test CRUD operations in browser
- Verify sync status indicator appears

---

#### Task 3.2: Validate SetlistsPage Integration
**File**: `src/pages/NewLayout/SetlistsPage.tsx`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Verify page uses migrated `useSetlists`
- Test setlist creation/editing
- Verify sync works

---

#### Task 3.3: Validate PracticesPage Integration
**File**: `src/pages/NewLayout/PracticesPage.tsx`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Verify page uses migrated `usePractices`
- Test practice scheduling
- Verify sync works

---

#### Task 3.4: Validate BandMembersPage Integration
**File**: `src/pages/NewLayout/BandMembersPage.tsx`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Verify page uses migrated `useBands`
- Test member management
- Verify sync works

---

#### Task 3.5: Validate ShowsPage Integration
**File**: `src/pages/NewLayout/ShowsPage.tsx`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Check if ShowsPage needs hook migration
- If yes, add to Phase 1 tasks
- Test shows functionality

---

### Phase 3 Deliverables

✅ **Validation**:
- All pages tested manually
- All CRUD operations work
- Sync indicators visible

✅ **Bug Fixes**:
- Any page-level issues resolved

---

## Phase 4: MCP Chrome Server Testing 🟢

### Priority: Medium | Est. Time: 1-2 hours

**Goal**: Validate sync functionality with actual UI testing

### Tasks

#### Task 4.1: Set Up Chrome Testing Environment
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Start dev server (`npm run dev`)
- Use `/chrome-testing` slash command
- Open browser with remote debugging

---

#### Task 4.2: Test Song Sync Flow
**Status**: Pending
**Estimated Time**: 20 minutes

**Actions Using MCP Chrome**:
1. Navigate to Songs page
2. Create a new song
3. Verify song appears immediately (optimistic update)
4. Check sync status indicator shows "syncing"
5. Wait for sync completion
6. Verify sync status shows "synced"
7. Check browser DevTools → Application → IndexedDB
8. Verify sync queue is empty

**Success Criteria**:
- Song created successfully
- Sync status updates correctly
- No errors in console

---

#### Task 4.3: Test Offline Behavior
**Status**: Pending
**Estimated Time**: 20 minutes

**Actions Using MCP Chrome**:
1. Navigate to Songs page
2. Use Chrome DevTools → Network → Throttle → Offline
3. Create a song while offline
4. Verify offline indicator appears
5. Verify song still created locally
6. Check sync queue has pending operation
7. Go back online
8. Verify sync completes automatically

**Success Criteria**:
- Offline indicator works
- Offline operations queued
- Auto-sync when online

---

#### Task 4.4: Test Multi-Entity Sync
**Status**: Pending
**Estimated Time**: 20 minutes

**Actions**:
- Create band
- Create songs
- Create setlist
- Schedule practice
- Verify all sync correctly
- Check for any conflicts or errors

**Success Criteria**:
- All entities sync
- No data loss
- No console errors

---

### Phase 4 Deliverables

✅ **Testing**:
- Manual test report
- Screenshots of sync working
- List of any bugs found

✅ **Bug Fixes**:
- Critical bugs fixed before PR

---

## Phase 5: Documentation & PR Preparation 🟢

### Priority: Medium | Est. Time: 1-2 hours

**Goal**: Update documentation and prepare for pull request

### Tasks

#### Task 5.1: Update TASK-INDEX.md
**File**: `.claude/instructions/TASK-INDEX.md`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Mark hook integration tasks as complete
- Update test coverage numbers
- Update phase completion percentages

---

#### Task 5.2: Update IMPLEMENTATION-STATUS.md
**File**: `.claude/instructions/IMPLEMENTATION-STATUS.md`
**Status**: Pending
**Estimated Time**: 15 minutes

**Actions**:
- Update phase completion to 100%
- Add hook migration to completed work
- Update test counts
- Add "Ready for MVP deployment" status

---

#### Task 5.3: Create PR Documentation
**Status**: Pending
**Estimated Time**: 30 minutes

**Actions**:
- Create PR description template
- List all changes made
- Include test coverage report
- Add deployment checklist
- Document known issues/limitations

**Template Sections**:
1. Overview
2. Changes Made
3. Testing Performed
4. Breaking Changes (none expected)
5. Deployment Notes
6. Next Steps

---

#### Task 5.4: Create Migration Summary Artifact
**Status**: Pending
**Estimated Time**: 20 minutes

**Actions**:
- Create comprehensive summary artifact
- Document architectural decisions
- List all files changed
- Include performance notes
- Add troubleshooting guide

---

### Phase 5 Deliverables

✅ **Documentation**:
- TASK-INDEX.md updated
- IMPLEMENTATION-STATUS.md updated
- PR description ready

✅ **Artifacts**:
- Migration summary created
- Test report included

---

## Summary

### Critical Path

1. **Phase 1** (4-6 hours): Hook integration → BLOCKS DEPLOYMENT
2. **Phase 2** (1-2 hours): Test cleanup → Quality improvement
3. **Phase 3** (1-2 hours): Page validation → Catch integration issues
4. **Phase 4** (1-2 hours): Chrome testing → Validate in real browser
5. **Phase 5** (1-2 hours): Documentation → Prepare for PR

**Total Estimated Time**: 8-14 hours

### Parallel Execution Strategy

**Can run in parallel**:
- Phase 1: Tasks 1.1, 1.2, 1.3, 1.4 (4 agents simultaneously)
- Phase 2: Tasks 2.1, 2.2, 2.3 (can be done independently)

**Must run sequentially**:
- Phase 1 → Phase 3 (can't validate pages until hooks work)
- Phase 3 → Phase 4 (manual testing after integration)
- Phase 4 → Phase 5 (documentation after validation)

### Risk Mitigation

**Risk 1**: Hook migration breaks existing UI
- **Mitigation**: Comprehensive unit tests before integration
- **Fallback**: Revert hook changes, keep service layer for future

**Risk 2**: Sync events don't trigger UI updates
- **Mitigation**: Test event emitter thoroughly
- **Fallback**: Add polling fallback if events fail

**Risk 3**: Tests fail after migration
- **Mitigation**: Run tests continuously during development
- **Fallback**: Fix tests as part of migration task

### Success Metrics

**Phase 1 Complete**:
- ✅ All 4 hooks migrated
- ✅ 40+ new hook tests passing
- ✅ All existing tests still passing

**Phase 2 Complete**:
- ✅ Integration tests archived
- ✅ Legacy tests removed/fixed
- ✅ Test suite clean

**Phase 3 Complete**:
- ✅ All pages manually validated
- ✅ CRUD operations working
- ✅ Sync indicators visible

**Phase 4 Complete**:
- ✅ Chrome testing successful
- ✅ Offline mode working
- ✅ No critical bugs found

**Phase 5 Complete**:
- ✅ Documentation updated
- ✅ PR ready to submit
- ✅ Team can review

### MVP Deployment Readiness Checklist

After completing all phases:

- [ ] All hooks use service layer
- [ ] Sync infrastructure validated end-to-end
- [ ] Tests passing (target: >90%)
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] PR description written
- [ ] Known issues documented
- [ ] Deployment guide ready

**Then ready for**:
1. Pull request submission
2. Team code review
3. Staging deployment
4. Supabase configuration
5. Production deployment

---

## Agent Assignment Plan

### Phase 1: Hook Integration (Parallel Execution)

**Agent 1** (nextjs-react-developer):
- Task 1.1: Migrate useSongs hook
- Create unit tests
- Validate against SongService

**Agent 2** (nextjs-react-developer):
- Task 1.2: Migrate useBands hook
- Create unit tests
- Validate against BandService

**Agent 3** (nextjs-react-developer):
- Task 1.3: Migrate useSetlists hook
- Create unit tests
- Validate against SetlistService

**Agent 4** (nextjs-react-developer):
- Task 1.4: Migrate usePractices hook
- Create unit tests
- Validate against PracticeSessionService

### Phase 2-5: Sequential Tasks

**Main Agent** (general-purpose):
- Coordinate test cleanup
- Perform manual validation
- Update documentation
- Prepare PR

---

**Document Status**: Active Task Breakdown
**Next Action**: Begin Phase 1 with parallel agent execution
**Last Updated**: 2025-10-26T04:41
