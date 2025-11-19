---
timestamp: 2025-10-26T04:58
prompt: "Critical diagnosis of why sync is not working despite hook migration"
type: root-cause-analysis
status: urgent
---

# CRITICAL: Sync Not Working - Root Cause Analysis

## User Report

1. ✅ Songs still work (they were before with manual override)
2. ❌ Setlists show up locally but NOT in Supabase
3. ❌ Practices give success message but don't appear (not even locally!)
4. ❌ Shows entity completely missing from migration
5. ❌ No shows table in Supabase

## Root Cause: Incomplete Integration

### Problem 1: Pages Bypass Hooks Entirely

**The hook migration was successful, BUT the pages don't exclusively use the hooks.**

#### SetlistsPage.tsx - 20+ Direct DB Calls

Lines with direct `db.` access:
- Line 1254: `await db.setlists.where(...)`
- Line 1260: `await db.songs.where(...)`
- Line 1270: `await db.practiceSessions.where(...)`
- Line 1283: `await db.practiceSessions.where(...)`
- Line 1301: `await db.practiceSessions.get(...)`
- Line 1315: `await db.songs.get(...)`
- **Line 1430: `await db.setlists.add(...)` ← SETLIST CREATION BYPASSES HOOK!**
- Line 1454: `await db.setlists.update(...)`
- Line 1467: `await db.practiceSessions.where(...)`
- Line 1473: `await db.practiceSessions.update(...)`
- **Line 1477: `await db.setlists.delete(...)` ← DELETE BYPASSES HOOK!**
- **Line 1523: `await db.setlists.update(...)` ← UPDATE BYPASSES HOOK!**
- And more...

**Impact**: Setlist CRUD operations in the page go directly to Dexie, never touching SetlistService → **NO SYNC**

#### PracticesPage.tsx - Direct DB Access

- Line 88: `await db.songs.where(...)`
- Line 547: `await db.songs.get(...)`

Plus the page logic doesn't properly use the hooks' return values.

**Impact**: Practice display may not reflect hook data → **Practices don't show up**

### Problem 2: Shows Entity Completely Missed

**Shows are NOT a separate table** - they're stored as `practice_sessions` with `type='show'`:

```sql
-- From Supabase schema
CREATE TABLE public.practice_sessions (
  ...
  type TEXT NOT NULL DEFAULT 'rehearsal',
  CONSTRAINT session_type_check CHECK (type IN ('rehearsal', 'show'))
);
```

**Migration status**:
- ❌ No ShowService created
- ❌ No useShows hook created
- ❌ ShowsPage still uses direct db access
- ✅ Shows stored in same table as practices (good design)

**Impact**: Shows functionality completely non-functional with sync

### Problem 3: Hook Architecture Issue

The hooks were migrated to use services, but:
1. **Hooks are imported but not exclusively used**
2. **Pages have their own database logic mixed in**
3. **Pages need full refactor, not just hook import**

## What Actually Works

### Songs ✅ (with manual override)
- SongsPage likely uses the hook properly
- Or you manually forced it to use SongService earlier
- This is the ONLY entity actually syncing

### Everything Else ❌
- Bands: Unknown (not tested yet)
- Setlists: Direct db writes bypass sync
- Practices: Hook usage incomplete
- Shows: Not migrated at all

## The Real Scope

### What Was Done
✅ Migrated 4 hooks to use services
✅ Created 90 new tests for hooks
✅ Services already use repository pattern

### What Was MISSED
❌ **Pages still have embedded database logic**
❌ **Pages need refactoring to ONLY use hooks**
❌ **Shows entity not included in migration**
❌ **No validation that pages actually use hooks exclusively**

## Fix Strategy

### Option 1: Quick Fix (Band-Aid) - 2-4 hours
**Scope**: Fix the pages to use hooks exclusively

**Tasks**:
1. **SetlistsPage**: Remove all `db.setlists.*` calls, use hooks only
2. **PracticesPage**: Remove all `db.practiceSessions.*` calls, use hooks only
3. **ShowsPage**: Create useShows hook, refactor page
4. **BandMembersPage**: Verify uses hooks exclusively
5. **Test each page manually**

**Pros**: Gets sync working quickly
**Cons**: Doesn't address architectural issues

### Option 2: Proper Refactor (Correct) - 8-12 hours
**Scope**: Full page layer refactor + shows migration

**Tasks**:
1. **Shows Migration**:
   - Create ShowService (extends PracticeSessionService)
   - Create useShows hook (similar to usePractices)
   - Update ShowsPage to use hook

2. **Page Refactoring**:
   - SetlistsPage: Extract all DB logic to hooks
   - PracticesPage: Extract all DB logic to hooks
   - ShowsPage: Extract all DB logic to hooks
   - BandMembersPage: Audit and fix

3. **Validation**:
   - Verify NO `db.` calls in pages (except read-only lookups if needed)
   - All mutations through hooks
   - Manual testing of all CRUD operations

**Pros**: Proper architecture, maintainable
**Cons**: More time investment

### Option 3: Hybrid (Recommended) - 4-6 hours
**Scope**: Fix critical mutations, defer complex refactors

**Phase 1 (URGENT - 2 hours)**:
1. Fix SetlistsPage mutations to use hooks:
   - Replace `db.setlists.add()` with `useCreateSetlist()`
   - Replace `db.setlists.update()` with `useUpdateSetlist()`
   - Replace `db.setlists.delete()` with `useDeleteSetlist()`

2. Fix PracticesPage to properly display hook data:
   - Use `useUpcomingPractices()` return value
   - Verify practice creation uses `useCreatePractice()`

3. Quick Shows fix:
   - Copy usePractices → useShows (filter by type='show')
   - Update ShowsPage to use useShows

**Phase 2 (Short-term - 2-4 hours)**:
4. Audit all pages for direct db mutations
5. Extract complex DB logic to new hooks
6. Full manual testing

**Pros**: Gets sync working fast, plans for proper fix
**Cons**: Technical debt remains

## Immediate Actions Needed

### 1. Verify Current State
- [ ] Check browser console for errors
- [ ] Test if SongsPage actually syncs (or just works locally)
- [ ] Verify Supabase connection is working

### 2. Fix Critical Mutations
- [ ] SetlistsPage: Use useCreateSetlist hook
- [ ] PracticesPage: Fix display issue
- [ ] ShowsPage: Add basic useShows hook

### 3. Test and Validate
- [ ] Manual test each entity
- [ ] Check Supabase for synced data
- [ ] Verify MCP Chrome shows no errors

## Lessons Learned

1. **Hook migration ≠ Page integration**
   - Migrating hooks is only half the work
   - Pages must be refactored to use hooks exclusively

2. **Need comprehensive entity mapping**
   - Shows were missed because they share a table
   - Should have audited all entities first

3. **Testing is not enough**
   - Hook tests passed, but pages still broken
   - Need integration tests for full flow

4. **Scope creep in complex systems**
   - "Migrate hooks" seemed simple
   - Actually requires full page layer refactor

## Recommended Next Steps

**Immediate (RIGHT NOW)**:
1. Apologize to user for incomplete work
2. Propose Option 3 (Hybrid approach)
3. Ask user: "Fix critical mutations first (2 hrs) then refactor later, OR do full refactor now (8 hrs)?"

**Short-term**:
4. Implement chosen option
5. Manual test ALL pages
6. Verify sync with Supabase
7. Document what's working vs not

**Medium-term**:
8. Complete full page refactor
9. Add integration tests (page → hook → service → sync)
10. Create architectural guidelines to prevent this

## Status

**Current**: ❌ **BROKEN** - Sync not working for most entities
**Blocker**: Pages bypass hooks with direct DB access
**Priority**: 🔴 **URGENT** - Prevents deployment
**ETA to fix**: 2-8 hours depending on approach

---

**Document Status**: Active Diagnosis
**Next Action**: Present options to user, get direction
**Last Updated**: 2025-10-26T04:58
