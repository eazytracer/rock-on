# Page Layer Refactor - Remove Direct Database Access

**Priority**: 🔴 CRITICAL - Blocks MVP deployment
**Estimated Time**: 8-12 hours
**Status**: Not Started
**Phase**: UI Integration - Full Refactor

---

## Context

**Problem Discovered**: Hook migration was successful, but pages still contain direct database access that bypasses the service layer and prevents Supabase sync.

**Root Cause**: Pages have embedded database logic that was written before the service layer existed. When hooks were migrated, pages weren't refactored to use them exclusively.

**Impact**:
- ❌ Setlists don't sync to Supabase (direct `db.setlists.add()` calls)
- ❌ Practices don't display properly (hook data not used)
- ❌ Shows completely non-functional (not migrated)
- ✅ Songs work (already fixed manually)

**Reference**:
- `.claude/artifacts/2025-10-26T04:58_critical-diagnosis-sync-not-working.md`
- `.claude/artifacts/2025-10-26T04:41_mvp-deployment-task-breakdown.md`

---

## Architecture Goals

### Current (Broken) Pattern

```typescript
// Page has embedded database logic
async function handleCreateSetlist(data) {
  // ❌ WRONG - Bypasses service layer
  await db.setlists.add({
    id: generateId(),
    ...data,
    createdDate: new Date()
  })
}

// Hook imported but not used!
const { createSetlist } = useCreateSetlist()
```

**Result**: Data saved to IndexedDB but never syncs to Supabase

### Target (Correct) Pattern

```typescript
// Page ONLY uses hooks, no direct DB access
const { createSetlist, loading, error } = useCreateSetlist()

async function handleCreateSetlist(data) {
  // ✅ CORRECT - Uses hook which uses service
  await createSetlist(data)
}
```

**Result**: Data saved to IndexedDB AND syncs to Supabase via repository pattern

---

## Refactor Strategy

### Phase 1: Audit and Document

For each page:
1. **Find all `db.` calls** - Search for direct database access
2. **Categorize by type**:
   - **Mutations** (add, update, delete) - CRITICAL, must use hooks
   - **Queries** (get, where, toArray) - Can use hooks or direct (read-only)
3. **Map to existing hooks** - Which hook should handle this?
4. **Identify missing hooks** - Do we need new hooks?

### Phase 2: Create Missing Hooks

1. **Shows hook** - Filter practices by type='show'
2. **Complex query hooks** - If pages have complex queries
3. **Compound operation hooks** - Multi-step operations

### Phase 3: Refactor Pages

For each page:
1. **Import hooks** - Add all needed hooks at top
2. **Replace mutations** - Use hook methods instead of `db.` calls
3. **Replace queries** - Use hook data instead of direct queries
4. **Remove db import** - Final verification (should cause errors if missed any)
5. **Test manually** - Verify CRUD operations work

### Phase 4: Validation

1. **Search for `db.` in pages** - Should only find `db` in comments/strings
2. **Test each page** - All CRUD operations
3. **Verify sync** - Check Supabase for synced data
4. **Check console** - No errors

---

## Pages to Refactor

### Priority 1: Critical Mutations (Blocks Sync)

#### 1. SetlistsPage.tsx
**File**: `src/pages/NewLayout/SetlistsPage.tsx`
**Status**: ❌ Broken - 20+ direct DB calls
**Priority**: 🔴 URGENT

**Direct DB Calls Found**:
- Line 1254: Query setlists
- Line 1260: Query songs
- Line 1270: Query shows
- Line 1283: Query practices
- **Line 1430: CREATE setlist** ← Blocks sync
- **Line 1454: UPDATE setlist status** ← Blocks sync
- **Line 1477: DELETE setlist** ← Blocks sync
- **Line 1523: UPDATE setlist** ← Blocks sync

**Hooks Available**:
- `useSetlists(bandId)` - Fetch setlists
- `useCreateSetlist()` - Create setlist
- `useUpdateSetlist()` - Update setlist
- `useDeleteSetlist()` - Delete setlist
- `useAddSetlistItem()` - Add song to setlist
- `useRemoveSetlistItem()` - Remove song
- `useReorderSetlistItems()` - Reorder songs

**Action Required**:
1. Replace line 1430 with `createSetlist()` from hook
2. Replace line 1454 with `updateSetlist()` from hook
3. Replace line 1477 with `deleteSetlist()` from hook
4. Replace line 1523 with `updateSetlist()` from hook
5. Extract complex query logic to new hooks if needed
6. Test all setlist CRUD operations

**Success Criteria**:
- ✅ Create setlist syncs to Supabase
- ✅ Update setlist syncs to Supabase
- ✅ Delete setlist syncs to Supabase
- ✅ No `db.setlists.` mutation calls remain
- ✅ Song management works (add/remove/reorder)

---

#### 2. PracticesPage.tsx
**File**: `src/pages/NewLayout/PracticesPage.tsx`
**Status**: ⚠️ Partially broken - Display issues
**Priority**: 🔴 HIGH

**Issues Found**:
1. Hooks imported but data not properly used
2. Direct song queries (lines 88, 547)
3. Practice creation works but display doesn't update

**Hooks Available**:
- `useUpcomingPractices(bandId)` - Fetch upcoming practices
- `useCreatePractice()` - Create practice
- `useUpdatePractice()` - Update practice
- `useDeletePractice()` - Delete practice
- `useAutoSuggestSongs(bandId)` - Get song suggestions

**Action Required**:
1. Use `useUpcomingPractices()` return value for display
2. Verify `useCreatePractice()` is called on submit
3. Replace direct song queries with `useSongs()` hook
4. Fix state management to reflect hook data
5. Test practice creation and display

**Success Criteria**:
- ✅ Created practices appear immediately
- ✅ Practices sync to Supabase
- ✅ Practice list updates on creation
- ✅ All practice CRUD works

---

#### 3. ShowsPage.tsx
**File**: `src/pages/NewLayout/ShowsPage.tsx`
**Status**: ❌ Not migrated at all
**Priority**: 🔴 HIGH

**Current State**:
- No useShows hook exists
- Page has direct DB access to practice_sessions
- Shows are practice_sessions with type='show'

**Action Required**:
1. **Create useShows hook** (similar to usePractices):
   ```typescript
   // src/hooks/useShows.ts
   export function useShows(bandId: string) {
     // Filter practice_sessions by type='show'
     return usePracticeSessions(bandId, 'show')
   }
   ```
2. **Create show mutation hooks**:
   - `useCreateShow()` - Create show (practice with type='show')
   - `useUpdateShow()` - Update show
   - `useDeleteShow()` - Delete show
3. **Refactor ShowsPage** to use hooks exclusively
4. Test show CRUD operations

**Success Criteria**:
- ✅ useShows hook created and tested
- ✅ Show mutations use hooks
- ✅ Shows sync to Supabase
- ✅ No direct db.practiceSessions calls for shows

---

### Priority 2: Verification (Ensure Compliance)

#### 4. SongsPage.tsx
**File**: `src/pages/NewLayout/SongsPage.tsx`
**Status**: ✅ Likely working (manually fixed earlier)
**Priority**: 🟡 MEDIUM

**Action Required**:
1. Audit for any remaining `db.songs` calls
2. Verify uses `useSongs()` hook exclusively
3. Test song CRUD operations
4. Verify sync to Supabase

**Success Criteria**:
- ✅ No direct `db.songs` mutation calls
- ✅ All CRUD uses hooks
- ✅ Sync verified working

---

#### 5. BandMembersPage.tsx
**File**: `src/pages/NewLayout/BandMembersPage.tsx`
**Status**: ⚠️ Unknown - Not tested
**Priority**: 🟡 MEDIUM

**Hooks Available**:
- `useBand(bandId)` - Get band info
- `useBandMembers(bandId)` - Get members with user data
- `useBandInviteCodes(bandId)` - Get invite codes
- `useCreateBand()` - Create band
- `useGenerateInviteCode()` - Generate code
- `useRemoveBandMember()` - Remove member
- `useUpdateMemberRole()` - Update role

**Action Required**:
1. Audit for `db.bands` and `db.bandMemberships` calls
2. Ensure all mutations use hooks
3. Test band member CRUD
4. Verify sync to Supabase

**Success Criteria**:
- ✅ No direct band/membership mutations
- ✅ All operations use hooks
- ✅ Sync verified working

---

## Implementation Guidelines

### Rule 1: NO Direct Database Mutations in Pages

```typescript
// ❌ NEVER DO THIS in a page component
await db.songs.add(newSong)
await db.setlists.update(id, data)
await db.practiceSessions.delete(id)

// ✅ ALWAYS DO THIS
const { createSong } = useCreateSong()
await createSong(newSong)
```

### Rule 2: Read-Only Queries are Acceptable (But Prefer Hooks)

```typescript
// ⚠️ ACCEPTABLE for read-only lookups
const song = await db.songs.get(songId)

// ✅ PREFERRED - use hook data
const { songs } = useSongs(bandId)
const song = songs.find(s => s.id === songId)
```

### Rule 3: Complex Queries → Create New Hook

```typescript
// ❌ DON'T put complex queries in pages
const upcoming = await db.practiceSessions
  .where('bandId').equals(bandId)
  .and(p => new Date(p.scheduledDate) > new Date())
  .sortBy('scheduledDate')

// ✅ CREATE a hook for this
export function useUpcomingPractices(bandId: string) {
  // Implementation
}
```

### Rule 4: Preserve User Experience

- Loading states must still work
- Error handling must still work
- Optimistic updates should be instant
- Don't break existing functionality

### Rule 5: Test-Driven Refactoring

1. Write test for expected behavior
2. Refactor page to use hooks
3. Run test to verify
4. Manual test in browser
5. Verify sync in Supabase

---

## Testing Requirements

### Unit Tests

Each refactored page should have tests verifying:
1. **Hook usage** - Page calls hook methods
2. **No direct DB** - No db.* calls for mutations
3. **State management** - Data flows from hooks to UI
4. **Error handling** - Errors displayed properly

### Manual Testing Checklist

For each page:
- [ ] Navigate to page
- [ ] Create new item
- [ ] Verify appears immediately (optimistic update)
- [ ] Check Supabase - item synced
- [ ] Update item
- [ ] Verify updates in Supabase
- [ ] Delete item
- [ ] Verify deleted in Supabase
- [ ] Test offline mode (if applicable)
- [ ] Check browser console - no errors

### Integration Testing

- [ ] Full flow: Create song → Add to setlist → Add to practice → Delete
- [ ] Multi-device: Create on device A, verify on device B
- [ ] Conflict resolution: Edit same item on two devices
- [ ] Error scenarios: Network failure, invalid data

---

## Agent Assignment Strategy

### Agent 1: SetlistsPage Refactor
**Type**: nextjs-react-developer
**Task**: Refactor SetlistsPage to use hooks exclusively
**Time**: 2-3 hours
**Instructions**: This file, Section "SetlistsPage.tsx"

### Agent 2: PracticesPage Refactor
**Type**: nextjs-react-developer
**Task**: Fix PracticesPage display and hook integration
**Time**: 1-2 hours
**Instructions**: This file, Section "PracticesPage.tsx"

### Agent 3: Shows Migration
**Type**: nextjs-react-developer
**Task**: Create useShows hook and refactor ShowsPage
**Time**: 2-3 hours
**Instructions**: This file, Section "ShowsPage.tsx"

### Agent 4: Verification
**Type**: nextjs-react-developer
**Task**: Audit SongsPage and BandMembersPage
**Time**: 1-2 hours
**Instructions**: This file, Sections "SongsPage.tsx" and "BandMembersPage.tsx"

**Total Parallel Time**: 2-3 hours (with 4 agents)
**Sequential Time**: 8-10 hours

---

## Success Criteria

### Code Quality
- ✅ Zero direct `db.` mutation calls in pages
- ✅ All pages use hooks exclusively for data operations
- ✅ Clean separation: Pages (UI) → Hooks (Data) → Services (Logic) → Repository (Sync)
- ✅ Consistent patterns across all pages

### Functionality
- ✅ All CRUD operations work as before
- ✅ Loading states work
- ✅ Error states work
- ✅ Optimistic updates work

### Sync
- ✅ All created items appear in Supabase
- ✅ All updates sync to Supabase
- ✅ All deletes sync to Supabase
- ✅ Multi-device sync works

### Testing
- ✅ All manual tests pass
- ✅ No console errors
- ✅ No TypeScript errors
- ✅ Integration tests pass (if added)

---

## Rollback Plan

If refactor breaks functionality:

1. **Immediate**: Revert page changes, keep hook changes
2. **Investigate**: Use git diff to see what broke
3. **Fix**: Address specific issue
4. **Test**: Verify fix works
5. **Continue**: Resume refactor

**Git strategy**: Create branch for each page refactor, merge when verified working

---

## Related Documents

**Problem Diagnosis**:
- `.claude/artifacts/2025-10-26T04:58_critical-diagnosis-sync-not-working.md`

**Hook Migration Results**:
- `.claude/artifacts/2025-10-26T04:52_phase-1-hook-migration-complete.md`

**Original Task Breakdown**:
- `.claude/artifacts/2025-10-26T04:41_mvp-deployment-task-breakdown.md`

**Specifications**:
- `.claude/specifications/unified-database-schema.md`
- `.claude/instructions/mvp-*-page.md` (individual page specs)

---

## Status Tracking

**Created**: 2025-10-26T05:00
**Last Updated**: 2025-10-26T05:00
**Status**: Ready for night crew
**Blocking**: MVP deployment
**Next Action**: Launch parallel agents for page refactor
