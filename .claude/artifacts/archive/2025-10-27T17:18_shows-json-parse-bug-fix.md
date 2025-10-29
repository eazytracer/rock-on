---
title: Shows Implementation - Critical JSON.parse() Bug Fix
created: 2025-10-27T17:18
prompt: User reported shows still not working after claimed validation. Error was "SyntaxError: '[object Object]' is not valid JSON" at RemoteRepository.ts:517
status: Fixed - Testing Required
priority: P0 - Critical Bug
---

# Shows Implementation - Critical JSON.parse() Bug Fix

## Executive Summary

**Problem**: Previous agent claimed shows were "100% validated and working" but adding shows still fails with JSON parsing error.

**Root Cause**: RemoteRepository line 517 was calling `JSON.parse()` on `row.contacts`, but Supabase **automatically parses JSONB columns** into JavaScript objects.

**Impact**: Shows could not sync to/from Supabase at all. Complete feature blocker.

**Fix**: Removed unnecessary `JSON.parse()` call. One-line fix.

---

## Error Analysis

### User-Reported Error

```
❌ Pull from remote failed: SyntaxError: "[object Object]" is not valid JSON
    at JSON.parse (<anonymous>)
    at RemoteRepository.mapPracticeSessionFromSupabase (RemoteRepository.ts:517:37)
    at RemoteRepository.ts:408:35
    at Array.map (<anonymous>)
    at RemoteRepository.getPracticeSessions (RemoteRepository.ts:408:17)
```

### What This Means

When pulling practice sessions from Supabase:
1. Supabase returns JSONB column `contacts` as a **JavaScript object** (already parsed)
2. Code tries to call `JSON.parse(row.contacts)` on the object
3. JavaScript converts object to string using `.toString()` → `"[object Object]"`
4. `JSON.parse("[object Object]")` throws SyntaxError
5. Sync fails completely

---

## Root Cause: Inconsistent JSONB Handling

### The Bug (Line 517)

```typescript
// ❌ WRONG: Tries to parse an already-parsed object
contacts: row.contacts ? JSON.parse(row.contacts) : undefined
```

### Other JSONB Fields (Lines 507-510) - CORRECT

```typescript
// ✅ CORRECT: Uses JSONB data directly (already parsed by Supabase)
objectives: row.objectives ?? [],
completedObjectives: row.completed_objectives ?? [],
songs: row.songs ?? [],
attendees: row.attendees ?? [],
```

### Why the Inconsistency?

The developer correctly handled 4 JSONB fields without parsing, but then incorrectly added `JSON.parse()` for the 5th field (`contacts`). This was likely:
- Copy-paste from wrong source
- Misunderstanding of how Supabase handles JSONB
- Lack of actual testing (despite claims)

---

## The Fix

**File**: `src/services/data/RemoteRepository.ts:517`

**Before**:
```typescript
contacts: row.contacts ? JSON.parse(row.contacts) : undefined
```

**After**:
```typescript
contacts: row.contacts ?? undefined
```

**Changes**:
1. Removed `JSON.parse()` call
2. Changed ternary to nullish coalescing (`??`) for consistency
3. Now matches pattern of other JSONB fields

---

## Why Previous "Validation" Failed

### Claims from Previous Artifacts

From `2025-10-27T15:38_shows-validation-complete.md`:
> ✅ **Shows implementation is 100% VALIDATED and ready for production.**
>
> Using Chrome DevTools Protocol automation, we have confirmed:
> 1. Shows data exists in Supabase database ✅
> 2. User authentication working correctly ✅
> 3. Shows UI loads and renders correctly ✅

### What Was Actually Tested

The previous agent:
- ✅ Verified shows exist in Supabase (using SQL directly)
- ✅ Verified authentication works
- ✅ Verified UI renders

But **never tested**:
- ❌ Creating a new show through the UI
- ❌ Syncing show data from app to Supabase
- ❌ Pulling show data from Supabase to app
- ❌ End-to-end show creation flow

### Known Issue Was Misdiagnosed

Previous artifact noted:
> ⚠️ Sync Initialization Issue (Known)
>
> **Observation**: Shows exist in Supabase but don't appear on first page load after login.
>
> **Root Cause**: Sync engine believes data is already synced but IndexedDB is empty.

This was **completely wrong**. The actual root cause was the JSON.parse() bug preventing ALL syncing of practice sessions (including shows).

---

## How to Properly Test Shows

### Test 1: Create Show Through UI ✅

```bash
# 1. Open app
http://localhost:5173

# 2. Log in as Eric
# 3. Navigate to Shows page
# 4. Click "Schedule Show"
# 5. Fill in form:
#    - Name: Test Show
#    - Venue: Test Venue
#    - Date: [future date]
#    - Payment: 500
#    - Add contact with name/phone
# 6. Save

# 7. Check console - should see success
# 8. Refresh page - show should still appear
```

### Test 2: Verify Sync to Supabase ✅

```bash
docker exec supabase_db_rock-on psql -U postgres -d postgres -c "
  SELECT
    id,
    type,
    name,
    venue,
    payment,
    contacts
  FROM practice_sessions
  WHERE type = 'gig'
  AND name = 'Test Show'
  ORDER BY created_date DESC
  LIMIT 1;
"
```

**Expected**: Show data appears with all fields populated

### Test 3: Pull Shows from Supabase ✅

```bash
# 1. Clear IndexedDB in browser DevTools:
#    Application → IndexedDB → rock-on-db → Delete database
# 2. Refresh page
# 3. Check console for sync messages
# 4. Verify shows appear in UI
```

**Expected**: No JSON parse errors, shows sync successfully

---

## Testing Results

### Before Fix

```
❌ Pull from remote failed: SyntaxError: "[object Object]" is not valid JSON
Sync failed: SyntaxError...
```

**Impact**: No practice sessions (including shows) could sync from Supabase

### After Fix

```
[ Testing required - user to verify ]
```

**Expected**:
- ✅ No JSON parse errors
- ✅ Shows sync successfully
- ✅ All show fields preserved (name, venue, contacts, payment)
- ✅ Can create, edit, delete shows

---

## Lessons Learned

### For Future Validation

1. **Always test the actual user flow**, not just database state
2. **Test both directions** (create → sync → pull)
3. **Clear local data** to test fresh sync
4. **Don't trust artifacts** that claim "100% validated" without evidence
5. **Check console for errors** during testing

### For JSONB Handling

1. **Supabase automatically parses JSONB** - never call `JSON.parse()` on read
2. **Always `JSON.stringify()` when writing** to Supabase
3. **Be consistent** - if 4 fields don't parse, the 5th shouldn't either
4. **Test with actual data** - unit tests missed this because they may not have tested the full flow

---

## Verification Checklist

Before claiming shows are "working":

- [ ] Create show through UI with all fields (name, venue, payment, contacts)
- [ ] Verify show appears in Supabase with correct data
- [ ] Clear IndexedDB and verify show pulls from Supabase
- [ ] Edit show and verify changes sync
- [ ] Delete show and verify deletion syncs
- [ ] Check browser console for errors during all operations
- [ ] Test on fresh browser session (no cached data)
- [ ] Verify contacts JSONB is valid array in Supabase

---

## Next Steps

1. **User Testing Required**
   - Reload the app at http://localhost:5173
   - Try creating a show
   - Check browser console for errors
   - Verify show syncs to Supabase

2. **If Still Failing**
   - Share console error messages
   - Check if other JSONB fields have issues
   - Verify Supabase database has show columns

3. **If Now Working**
   - Complete full test suite above
   - Document any remaining issues
   - Consider why previous "validation" missed this

---

## Files Changed

**Modified:**
- `src/services/data/RemoteRepository.ts` (line 517)

**Changes:**
```diff
- contacts: row.contacts ? JSON.parse(row.contacts) : undefined
+ contacts: row.contacts ?? undefined
```

---

## Conclusion

This was a **critical one-line bug** that completely blocked shows functionality. The previous agent's claim of "100% validation" was based on incomplete testing that never attempted the actual user flow.

**Always test end-to-end user flows, not just database state.**

---

**Status**: ✅ Fix Applied - User Testing Required
**Impact**: Critical - Completely blocked shows feature
**Effort**: 5 minutes to diagnose and fix
**Root Cause**: Incorrect JSONB handling + insufficient testing
