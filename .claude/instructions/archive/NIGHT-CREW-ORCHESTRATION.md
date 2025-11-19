# Night Crew Orchestration Plan - Page Layer Refactor

**Created**: 2025-10-26T05:07
**Priority**: 🔴 CRITICAL - Blocks MVP deployment
**Execution**: Parallel (4 agents simultaneously)
**Estimated Time**: 2-3 hours wall time (8-12 hours sequential)

---

## Mission Briefing

**Objective**: Fix UI integration layer so Supabase sync actually works

**Problem**: Hook migration completed successfully (22 hooks, 90 tests), but pages have embedded database logic that bypasses the hooks entirely. Result: **sync doesn't work**.

**User Impact**:
- Created setlists don't sync to Supabase
- Created practices disappear from UI
- Shows completely non-functional
- Only songs work (manually fixed earlier)

**Solution**: Refactor 5 pages to use hooks exclusively, removing all direct database access

---

## Critical Understanding

### What Works ✅
- Sync infrastructure (73 tests passing)
- Service layer (120 tests passing)
- Hook layer (77/90 tests passing)
- All architectural components ready

### What's Broken ❌
- Pages bypass hooks with direct `db.*` calls
- Mutations go straight to IndexedDB
- Sync queue never populated
- Data never reaches Supabase

### Why This Happened
- Hooks were migrated but pages weren't refactored
- Pages have legacy embedded database logic
- Integration gap not caught by unit tests
- User testing revealed the issue

---

## Agent Assignment

### Agent 1: SetlistsPage Refactor (CRITICAL)
**Type**: `nextjs-react-developer`
**Priority**: 🔴 URGENT
**Estimated Time**: 3-4 hours
**Complexity**: High (20+ direct DB calls)

**Task Description**:
Refactor `src/pages/NewLayout/SetlistsPage.tsx` to use hooks exclusively, removing all direct database access.

**Detailed Instructions**:
```
CRITICAL TASK: Refactor SetlistsPage to use hooks exclusively

Context:
- SetlistsPage has 20+ direct db.setlists.* calls
- Line 1430: db.setlists.add() - bypasses useCreateSetlist()
- Line 1454, 1477, 1523: Updates/deletes bypass hooks
- Result: Setlists save locally but DON'T sync to Supabase

Reference:
- `.claude/instructions/70-page-layer-refactor.md` Section "SetlistsPage.tsx"
- Hooks available: useSetlists, useCreateSetlist, useUpdateSetlist, useDeleteSetlist, useAddSetlistItem, useRemoveSetlistItem, useReorderSetlistItems

Requirements:
1. Replace ALL db.setlists.* mutation calls with hook methods
2. Extract complex queries to hooks if needed
3. Preserve all existing functionality
4. Test all setlist CRUD operations
5. Verify sync to Supabase works

Success Criteria:
- Zero db.setlists.* mutation calls remain
- All CRUD uses hooks
- Created setlists appear in Supabase
- Manual testing passes

TDD Required:
- Write tests before refactoring
- Run tests continuously
- All tests must pass

Return detailed summary of changes, tests created, and sync verification.
```

---

### Agent 2: PracticesPage Refactor (HIGH)
**Type**: `nextjs-react-developer`
**Priority**: 🔴 HIGH
**Estimated Time**: 2-3 hours
**Complexity**: Medium (display issues + direct queries)

**Task Description**:
Fix PracticesPage to properly use hook data and remove direct database access.

**Detailed Instructions**:
```
CRITICAL TASK: Fix PracticesPage hook integration

Context:
- PracticesPage imports hooks but doesn't use them properly
- useUpcomingPractices() called but data not displayed
- Direct song queries (lines 88, 547)
- Result: Practices created but don't appear in UI

Reference:
- `.claude/instructions/70-page-layer-refactor.md` Section "PracticesPage.tsx"
- Hooks available: useUpcomingPractices, useCreatePractice, useUpdatePractice, useDeletePractice, useAutoSuggestSongs

Requirements:
1. Use useUpcomingPractices() return value for display
2. Verify useCreatePractice() is called on submit
3. Replace direct song queries with useSongs() hook
4. Fix state management to reflect hook data
5. Test practice CRUD operations

Success Criteria:
- Created practices appear immediately
- Practices sync to Supabase
- Practice list updates on creation
- All CRUD operations work

TDD Required:
- Test display logic
- Test hook integration
- Verify sync

Return detailed summary of fixes, tests, and sync verification.
```

---

### Agent 3: Shows Migration (HIGH)
**Type**: `nextjs-react-developer`
**Priority**: 🔴 HIGH
**Estimated Time**: 2-3 hours
**Complexity**: Medium (new hook + page refactor)

**Task Description**:
Create useShows hook and refactor ShowsPage to use it.

**Detailed Instructions**:
```
CRITICAL TASK: Shows entity migration

Context:
- Shows NOT migrated in hook migration
- Shows use practice_sessions table with type='show'
- ShowsPage has direct db.practiceSessions access
- Result: Shows completely non-functional

Reference:
- `.claude/instructions/70-page-layer-refactor.md` Section "ShowsPage.tsx"
- Pattern: Similar to usePractices but filter by type='show'

Requirements:
1. CREATE useShows hook (filter practices by type='show'):
   - File: src/hooks/useShows.ts
   - Hooks needed: useShows, useCreateShow, useUpdateShow, useDeleteShow
   - Use PracticeSessionService with type='show' filter

2. CREATE hook tests:
   - File: tests/unit/hooks/useShows.test.ts
   - Minimum 8 comprehensive tests
   - Verify service integration
   - Test sync events

3. REFACTOR ShowsPage:
   - Replace all db.practiceSessions calls for shows
   - Use useShows hook exclusively
   - Test show CRUD operations

Success Criteria:
- useShows hook created and tested
- Show mutations use hooks
- Shows sync to Supabase
- No direct db.practiceSessions calls for shows

TDD Required:
- Write hook tests first
- Implement hook
- Refactor page
- Verify all tests pass

Return detailed summary of hook implementation, page refactor, tests, and sync verification.
```

---

### Agent 4: Page Verification (MEDIUM)
**Type**: `nextjs-react-developer`
**Priority**: 🟡 MEDIUM
**Estimated Time**: 1-2 hours
**Complexity**: Low (audit + fix)

**Task Description**:
Audit SongsPage and BandMembersPage for direct database access and fix any issues.

**Detailed Instructions**:
```
TASK: Verify SongsPage and BandMembersPage use hooks exclusively

Context:
- SongsPage likely works (manually fixed earlier)
- BandMembersPage not tested yet
- Need to verify NO direct db.* mutation calls

Reference:
- `.claude/instructions/70-page-layer-refactor.md` Sections "SongsPage.tsx" and "BandMembersPage.tsx"

Requirements:

1. AUDIT SongsPage (src/pages/NewLayout/SongsPage.tsx):
   - Search for all db.songs.* calls
   - Verify uses useSongs() hook exclusively
   - Check mutations use hook methods
   - Test song CRUD operations
   - Verify sync to Supabase

2. AUDIT BandMembersPage (src/pages/NewLayout/BandMembersPage.tsx):
   - Search for db.bands.* and db.bandMemberships.* calls
   - Verify uses useBand, useBandMembers, etc. hooks
   - Check mutations use hook methods
   - Test band member CRUD operations
   - Verify sync to Supabase

3. FIX any remaining issues:
   - Replace direct DB calls with hooks
   - Update state management
   - Test all CRUD operations

Success Criteria:
- SongsPage verified clean (no direct mutations)
- BandMembersPage verified clean (no direct mutations)
- All CRUD operations tested
- Sync verified for both pages

Report:
- List of all db.* calls found
- Changes made to fix them
- Test results
- Sync verification

Return detailed audit report and any fixes made.
```

---

## Execution Strategy

### 1. Pre-Launch Checklist
- [ ] All 4 agents ready to launch
- [ ] Instruction file exists: `.claude/instructions/70-page-layer-refactor.md`
- [ ] Reference files accessible
- [ ] Test environment ready

### 2. Launch Sequence

**Launch Command** (all 4 agents in single message):
```
Launch 4 parallel nextjs-react-developer agents for page layer refactor:

Agent 1: [SetlistsPage task above]
Agent 2: [PracticesPage task above]
Agent 3: [Shows migration task above]
Agent 4: [Page verification task above]
```

### 3. Monitoring During Execution
- Check agent status every 30 minutes
- Watch for common errors
- Be ready to provide clarifications
- Monitor test output

### 4. Agent Completion Criteria

Each agent must report:
1. **Changes made** - Line-by-line summary
2. **Tests created** - Number and type
3. **Test results** - Pass/fail counts
4. **Sync verification** - Actual Supabase sync test
5. **Issues encountered** - Any blockers or problems

### 5. Post-Execution Validation

After all 4 agents complete:
1. **Run full test suite** - `npm test`
2. **Manual testing** - Test each page in browser
3. **Supabase verification** - Check data actually synced
4. **Documentation update** - Record what was done

---

## Success Metrics

### Code Quality
- [ ] Zero `db.*` mutation calls in pages
- [ ] All pages use hooks exclusively
- [ ] Clean separation: Pages → Hooks → Services → Repository
- [ ] Consistent patterns across all pages

### Functionality
- [ ] All CRUD operations work as before
- [ ] Loading states work
- [ ] Error states work
- [ ] Optimistic updates work

### Sync (CRITICAL)
- [ ] Setlists sync to Supabase ✅
- [ ] Practices sync to Supabase ✅
- [ ] Shows sync to Supabase ✅
- [ ] Songs sync verified ✅
- [ ] Band members sync verified ✅

### Testing
- [ ] New hook tests passing (useShows)
- [ ] Page integration verified
- [ ] No TypeScript errors
- [ ] No console errors

---

## Risk Mitigation

### Risk 1: Agent Conflicts
**Probability**: Low (agents work on different files)
**Mitigation**: Each agent has separate file targets

### Risk 2: Breaking Changes
**Probability**: Medium
**Mitigation**:
- TDD approach (tests first)
- Incremental changes
- Git branches for rollback

### Risk 3: Time Overruns
**Probability**: Medium (complex refactors)
**Mitigation**:
- Clear instructions
- Reference documentation
- Can deploy partial if needed

### Risk 4: Sync Still Doesn't Work
**Probability**: Low (well-diagnosed issue)
**Mitigation**:
- Manual testing required
- Actual Supabase verification
- User testing after completion

---

## Rollback Plan

If refactor breaks functionality:

1. **Immediate**: Note which agent/page has issue
2. **Isolate**: Revert that specific page only
3. **Diagnose**: Review agent's changes via git diff
4. **Fix**: Address specific issue
5. **Retry**: Re-run that agent with updated instructions

**Git Strategy**: Each page refactor on separate branch

---

## Expected Timeline

### Parallel Execution (4 agents)
- **Hour 0-1**: Agent setup and initial implementation
- **Hour 1-2**: Testing and iteration
- **Hour 2-3**: Final testing and sync verification
- **Total**: 2-3 hours wall time

### Sequential (if needed)
- SetlistsPage: 3-4 hours
- PracticesPage: 2-3 hours
- Shows: 2-3 hours
- Verification: 1-2 hours
- **Total**: 8-12 hours

---

## Post-Completion Actions

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```

2. **Manual Browser Testing**:
   - [ ] Create setlist → Verify in Supabase
   - [ ] Create practice → Verify in Supabase
   - [ ] Create show → Verify in Supabase
   - [ ] Create song → Verify in Supabase
   - [ ] Add band member → Verify in Supabase

3. **Update Documentation**:
   - [ ] Update IMPLEMENTATION-STATUS.md
   - [ ] Update TASK-INDEX.md
   - [ ] Create completion artifact

4. **Prepare for Next Phase**:
   - [ ] Integration testing
   - [ ] Test cleanup
   - [ ] PR preparation

---

## Communication

### Agent Reports Format

Each agent should provide:
```markdown
## [Agent Name] - [Page/Task] Refactor Complete

### Summary
- [Brief overview of what was done]

### Files Modified
1. [file path] - [what changed]
2. [file path] - [what changed]

### Tests Created
- [test file path] - [number] tests

### Test Results
- Passing: [number]
- Failing: [number]
- Pass rate: [percentage]

### Sync Verification
- [Method used to verify sync]
- [Results - data appeared in Supabase? Yes/No]

### Issues Encountered
- [Any problems or blockers]

### Next Steps
- [Recommendations for follow-up]
```

---

## Final Checks Before Deployment

After all agents complete:

### 1. Code Review
- [ ] No `db.*` mutations in pages
- [ ] All hooks properly used
- [ ] TypeScript compiles
- [ ] No ESLint errors

### 2. Test Verification
- [ ] All new tests passing
- [ ] No regressions in existing tests
- [ ] Integration points verified

### 3. Manual Testing
- [ ] Every page tested in browser
- [ ] Every CRUD operation tested
- [ ] Supabase data verified

### 4. Performance Check
- [ ] No performance regressions
- [ ] Loading states appropriate
- [ ] No UI freezes

### 5. Documentation
- [ ] All changes documented
- [ ] TASK-INDEX updated
- [ ] IMPLEMENTATION-STATUS updated

---

## Success Declaration

This refactor is complete when:

✅ All 4 agents have reported completion
✅ All tests passing (or documented reasons for failures)
✅ Manual testing shows all CRUD operations work
✅ **Supabase verification shows data actually syncing**
✅ No TypeScript or ESLint errors
✅ Documentation updated

**Then**: Ready for integration testing and deployment!

---

**Document Status**: Ready for Night Crew Execution
**Created**: 2025-10-26T05:07
**Next Action**: Launch 4 parallel agents
**Expected Completion**: 2025-10-26T08:00 (3 hours from now)
