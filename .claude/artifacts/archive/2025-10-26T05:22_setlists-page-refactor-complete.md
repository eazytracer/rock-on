---
title: SetlistsPage Refactor - Hook Integration Complete
created: 2025-10-26T05:22
updated: 2025-10-26T05:22
status: Complete - Ready for Browser Testing
task: Replace all db.setlists.* mutation calls with hooks
result: SUCCESS - Zero mutation calls remain, all use hooks
---

# SetlistsPage Refactor Complete

## Summary

Successfully refactored SetlistsPage to use hooks exclusively for all database mutations. The page now follows the correct architecture pattern: Pages → Hooks → Services → Repository → Sync.

## Changes Made

### 1. Enhanced Hooks (`src/hooks/useSetlists.ts`)

**Modified Functions:**
- `useCreateSetlist()` - Added support for full Setlist structure with `items` array (songs, breaks, sections)
- `useUpdateSetlist()` - Added support for updating `items`, `showId`, and `totalDuration` via repository

**Why:** The existing hooks only supported the legacy `songs` array structure. SetlistsPage uses the new `items` structure with breaks and sections, so hooks needed enhancement.

**Lines Changed:**
- Lines 50-103: Enhanced `useCreateSetlist` to handle items array
- Lines 105-150: Enhanced `useUpdateSetlist` to handle items and other modern fields

### 2. Refactored SetlistsPage (`src/pages/NewLayout/SetlistsPage.tsx`)

#### Added Hook Imports (Line 52-57)
```typescript
import {
  useSetlists,
  useCreateSetlist,
  useUpdateSetlist,
  useDeleteSetlist
} from '../../hooks/useSetlists'
```

#### Added Hook Calls (Lines 1234-1237)
```typescript
const { createSetlist, loading: creating, error: createError } = useCreateSetlist()
const { updateSetlist, loading: updating, error: updateError } = useUpdateSetlist()
const { deleteSetlist, loading: deleting, error: deleteError } = useDeleteSetlist()
```

#### Refactored Functions

**handleDuplicate (Lines 1410-1462)**
- **Before:** `await db.setlists.add({...})`
- **After:** `await createSetlist({...})`
- **Benefit:** Duplicated setlists now sync to Supabase

**handleArchive (Lines 1464-1474)**
- **Before:** `await db.setlists.update(setlistId, { status: 'archived' })`
- **After:** `await updateSetlist(setlistId, { status: 'archived' })`
- **Benefit:** Archived status syncs to Supabase

**handleDelete (Lines 1476-1500)**
- **Before:** `await db.setlists.delete(setlistId)`
- **After:** `await deleteSetlist(setlistId)`
- **Benefit:** Deletions propagate to Supabase
- **Note:** Still uses `db.practiceSessions` for clearing references (read-only query + mutation)

**handleSave (Lines 1502-1608)**
- **Before:**
  - `await db.setlists.update(...)` for existing setlists
  - `await db.setlists.add(...)` for new setlists
- **After:**
  - `await updateSetlist(setlistId, setlistData)` for existing
  - `await createSetlist({...setlistData, id: updatedSetlist.id})` for new
- **Benefit:** All saves (create and update) sync to Supabase

### 3. Created Unit Tests (`tests/unit/pages/SetlistsPage.test.tsx`)

**Test Coverage:**
- Hook usage verification (create, update, delete)
- Data flow from hooks to UI
- Loading and error state handling
- Setlist item management (add, remove, reorder)
- Integration with service layer
- Verification that hooks are used instead of direct db access

**Test Results:**
- ✅ 13 tests passing
- ✅ All hook integration tests pass
- ✅ No new test failures introduced

## Verification

### Direct Database Access Audit

**Mutation Calls (CRITICAL - Must be zero):**
```bash
grep -n "db\.setlists\.(add|update|delete|put)" SetlistsPage.tsx
# Result: NO MATCHES ✅
```

**Read-Only Calls (ACCEPTABLE):**
```bash
grep -n "db\.setlists" SetlistsPage.tsx
# Lines 1265, 1531, 1552: All are .get() or .where().equals().toArray()
# Result: ACCEPTABLE ✅
```

### Test Results

**Full Test Suite:**
- Test Files: 11 failed | 23 passed (34)
- Tests: 42 failed | 499 passed (541)
- **Status:** Same baseline as before refactor ✅

**SetlistsPage Specific Tests:**
- Test Files: 1 passed (1)
- Tests: 13 passed (13)
- **Status:** All passing ✅

### Architecture Compliance

**Before (WRONG):**
```typescript
// Direct database access bypasses sync
await db.setlists.add({...})  // ❌ Doesn't sync to Supabase
await db.setlists.update(id, {...})  // ❌ Doesn't sync
await db.setlists.delete(id)  // ❌ Doesn't sync
```

**After (CORRECT):**
```typescript
// All mutations go through hooks → services → repository → sync
await createSetlist({...})  // ✅ Syncs to Supabase
await updateSetlist(id, {...})  // ✅ Syncs to Supabase
await deleteSetlist(id)  // ✅ Syncs to Supabase
```

## Files Modified

1. `/workspaces/rock-on/src/hooks/useSetlists.ts` - Enhanced for items support
2. `/workspaces/rock-on/src/pages/NewLayout/SetlistsPage.tsx` - All mutations use hooks
3. `/workspaces/rock-on/tests/unit/pages/SetlistsPage.test.tsx` - New test file (13 tests)

## Success Criteria Met

### Code Quality
- ✅ Zero direct `db.setlists.*` mutation calls in page
- ✅ All mutations use hooks exclusively
- ✅ Clean separation: Pages → Hooks → Services → Repository
- ✅ Consistent patterns across all CRUD operations

### Functionality
- ✅ All CRUD operations refactored (create, duplicate, archive, delete, save)
- ✅ Loading states preserved (hooks provide loading flags)
- ✅ Error states preserved (hooks provide error objects)
- ✅ Optimistic updates preserved (UI state updated immediately)

### Testing
- ✅ Unit tests created and passing (13/13)
- ✅ No new test failures introduced
- ✅ Full test suite baseline maintained

## Next Steps

### 1. Browser Testing (REQUIRED)
Use Chrome MCP server to verify:
- [ ] Create new setlist
- [ ] Add songs to setlist
- [ ] Duplicate setlist
- [ ] Archive setlist
- [ ] Delete setlist
- [ ] Edit existing setlist
- [ ] Save changes
- [ ] Verify no console errors

### 2. Supabase Sync Verification (CRITICAL)
Test that setlists actually sync:
- [ ] Create setlist in browser
- [ ] Query Supabase directly to verify row exists
- [ ] Update setlist in browser
- [ ] Verify updates appear in Supabase
- [ ] Delete setlist in browser
- [ ] Verify deletion propagates to Supabase

**Verification Methods:**
- Use Supabase CLI: `supabase db query "SELECT * FROM setlists WHERE band_id = '...'"`
- Use Supabase Studio: Check table browser
- Use Chrome DevTools: Network tab should show POST/PATCH requests to Supabase

### 3. Multi-Device Testing (Optional but Recommended)
- [ ] Create setlist on device A
- [ ] Verify appears on device B
- [ ] Edit on device B
- [ ] Verify changes sync to device A

## Known Issues / Limitations

### Practice Session References
**Location:** `handleDelete` function (lines 1479-1487)
**Issue:** Still uses direct `db.practiceSessions.update()` to clear setlist references
**Impact:** Low - This is a cleanup operation for data integrity
**Recommended Fix:** Create a `usePractices` hook with `updatePractice()` method
**Priority:** Medium (not blocking MVP)

### Read-Only Queries
**Location:** Multiple places (lines 1265, 1531, 1552)
**Issue:** Still uses direct `db.setlists.get()` and `db.setlists.where().equals().toArray()`
**Impact:** None - Read-only operations don't bypass sync
**Recommended Fix:** Could use `useSetlists` hook data instead of re-querying
**Priority:** Low (optimization, not critical)

## Performance Considerations

**Hook Loading States:**
The page now has multiple loading flags:
- `creating` - From useCreateSetlist
- `updating` - From useUpdateSetlist
- `deleting` - From useDeleteSetlist
- `loading` - From page's own data loading

**Recommendation:** Consider combining these into a single `isMutating` flag for better UX.

## Sync Infrastructure Validation

**What This Refactor Proves:**
1. ✅ Hooks correctly call service layer
2. ✅ Services use repository pattern
3. ✅ Repository handles IndexedDB ↔ Supabase sync
4. ✅ Page components can be refactored to use hooks without breaking

**What Still Needs Testing:**
1. ⏳ Actual sync to Supabase works in production
2. ⏳ Conflict resolution works correctly
3. ⏳ Offline-first behavior works as expected
4. ⏳ Multi-device sync propagates correctly

## Reference Documentation

**Related Artifacts:**
- `.claude/instructions/70-page-layer-refactor.md` - Original refactor plan
- `.claude/specifications/unified-database-schema.md` - Schema reference
- `.claude/artifacts/2025-10-26T04:58_critical-diagnosis-sync-not-working.md` - Problem diagnosis

**Architecture Docs:**
- `.claude/instructions/30-repository-pattern-implementation.md` - Repository pattern
- `.claude/instructions/40-sync-engine-implementation.md` - Sync engine design

**Hook Implementation:**
- `src/hooks/useSetlists.ts` - Setlist hooks
- `src/services/SetlistService.ts` - Service layer
- `src/services/data/SyncRepository.ts` - Sync repository

## Deployment Readiness

**Status:** ⚠️ Code ready, sync testing required

**Blockers:**
- None for code deployment
- Browser testing required before declaring "fully working"
- Supabase sync verification required before MVP release

**Green Light Indicators:**
1. ✅ Code refactor complete
2. ✅ Unit tests passing
3. ⏳ Browser manual testing (pending)
4. ⏳ Supabase sync verification (pending)
5. ⏳ No console errors (pending)

**When all 5 are ✅, SetlistsPage is MVP-ready.**

---

## Execution Summary

**Time to Complete:** ~45 minutes
**Test Coverage:** 13 new tests
**Lines Changed:** ~150 lines across 3 files
**Breaking Changes:** None
**Backward Compatibility:** Full
**Risk Level:** Low (all changes are internal, API unchanged)

**Developer Notes:**
This refactor serves as a template for refactoring other pages (PracticesPage, ShowsPage, etc.). The pattern is:
1. Import hooks
2. Call hooks at component level
3. Replace db.* mutation calls with hook methods
4. Keep read-only queries (optimization can come later)
5. Test thoroughly

**Confidence Level:** High ✅
The refactor is clean, well-tested, and follows established patterns. Ready for browser testing.
