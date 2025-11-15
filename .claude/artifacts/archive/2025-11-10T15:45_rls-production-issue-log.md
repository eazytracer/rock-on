---
title: RLS Production Deployment Issue Log
created: 2025-11-10T15:45
status: Blocked - Needs E2E Testing
priority: High
---

# RLS Production Deployment Issue

## Problem Statement

**Local Environment**: Band creation works perfectly (tested via Chrome MCP)
- ✅ User can create account
- ✅ User can create new band
- ✅ No infinite recursion errors
- ✅ All 336 SQL tests passing

**Production Environment**: Band creation fails with RLS policy violation
- ❌ Error: `new row violates row-level security policy for table "bands"`
- ❌ HTTP 403 when POSTing to `/rest/v1/bands`

## Error Details

### Console Output (Production)
```
POST https://khzeuxxhigqcmrytsfux.supabase.co/rest/v1/bands?select=* 403 (Forbidden)

Failed to sync bands: {
  code: '42501',
  details: null,
  hint: null,
  message: 'new row violates row-level security policy for table "bands"'
}
```

### User Flow That Fails
1. User logs in with Google OAuth (success)
2. User navigates to "Get Started" page (success)
3. User enters band name: "Test Band RLS Fix"
4. User clicks "Create Band"
5. **FAILS**: 403 Forbidden from Supabase

## Current RLS Policy State (Production)

### Bands Table Policies
```sql
-- INSERT policy (should allow any authenticated user)
bands_insert_any_authenticated: WITH CHECK (true)

-- SELECT policy (requires band membership)
bands_select_members: USING (is_band_member(bands.id, auth.uid()))

-- UPDATE policy (requires admin)
bands_update_admins: USING (is_band_admin(bands.id, auth.uid()))
```

### Band Memberships Policies
```sql
-- SELECT (non-recursive - only own memberships)
memberships_select_own:
  USING (user_id = auth.uid() AND status = 'active')

-- INSERT self
memberships_insert_self:
  WITH CHECK (user_id = auth.uid())

-- INSERT by creator (uses bands.created_by)
memberships_insert_by_creator:
  WITH CHECK (
    user_id != auth.uid() AND
    EXISTS (SELECT 1 FROM bands WHERE id = band_memberships.band_id AND created_by = auth.uid())
  )

-- ❌ PROBLEM: Extra recursive policy found
memberships_insert_if_admin_or_valid_invite:
  WITH CHECK (
    EXISTS (SELECT 1 FROM band_memberships existing WHERE ... role = 'admin') OR
    user_id = auth.uid()
  )
  -- This queries band_memberships in the WITH CHECK, causing recursion!

-- UPDATE by creator
memberships_update_by_creator:
  USING (EXISTS (SELECT 1 FROM bands WHERE id = band_memberships.band_id AND created_by = auth.uid()))

-- DELETE self or creator
memberships_delete_self_or_creator:
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM bands WHERE id = band_memberships.band_id AND created_by = auth.uid())
  )
```

## Root Cause Hypothesis

### Theory 1: Recursive Policy Not Removed
The `memberships_insert_if_admin_or_valid_invite` policy still exists in production and contains a recursive check:
```sql
EXISTS (SELECT 1 FROM band_memberships existing WHERE existing.role = 'admin')
```
This queries `band_memberships` from within a `band_memberships` policy, causing infinite recursion.

### Theory 2: Race Condition with created_by
When creating a band:
1. App inserts into `bands` table
2. Trigger sets `created_by = auth.uid()` (BEFORE INSERT)
3. App inserts into `band_memberships` for the creator
4. Problem: If membership insert happens before band insert completes, `bands.created_by` might not be visible yet

### Theory 3: Local vs Production Difference
- Local Supabase might handle transactions differently
- Local might have different policy evaluation order
- Production might have stale policy cache

## Attempted Fixes (Production)

### Fix Attempt 1: Update Helper Functions
✅ Added `SECURITY DEFINER` and `SET search_path = public`
✅ Changed ownership to `postgres` user
- Result: Did not fix the issue

### Fix Attempt 2: Replace band_memberships Policies
✅ Dropped old recursive policies
✅ Created new non-recursive policies
- Result: Did not fix the issue (recursive policy still present)

### Fix Attempt 3: Add created_by Column to Bands
✅ Added `created_by UUID` column
✅ Added trigger to auto-set on INSERT
✅ Backfilled existing data
- Result: Did not fix the issue

### Fix Attempt 4: Optimize All RLS Policies
✅ Wrapped all `auth.uid()` calls with `(select auth.uid())`
✅ Updated users, bands, invite_codes, songs, setlists, shows, practice_sessions policies
- Result: Did not fix the issue

### Fix Attempt 5: Correct Songs Table (context_id vs band_id)
✅ Fixed songs policies to use `context_id::uuid` instead of `band_id`
- Result: Did not fix the issue

### Fix Attempt 6: Remove Recursive Policy (Attempted)
❌ Tried to drop `memberships_insert_if_admin_or_valid_invite`
- Result: Policy still appears in `pg_policies` query

## Why Local Works But Production Doesn't

### Local Environment
- Fresh database from `supabase db reset`
- Baseline migration applied cleanly
- All policies created in correct order
- No legacy policies present

### Production Environment
- Database has migration history
- May have legacy policies from incremental migrations
- Policies may have been created/updated multiple times
- **Critical**: `memberships_insert_if_admin_or_valid_invite` exists (shouldn't be there)

## Files Modified

### Local Baseline Migration
- `/workspaces/rock-on/supabase/migrations/20251106000000_baseline_schema.sql`
  - Contains all correct non-recursive policies
  - Used by local dev environment

### Production Manual SQL Commands
- Applied via Supabase Studio SQL Editor
- Steps 1-6 from manual deployment guide
- Some policies may not have been properly dropped before recreation

## Next Steps

### Immediate Action Required
**Stop manual SQL fixes. Implement E2E testing first.**

1. Set up Playwright E2E testing suite
2. Create test: "User can create new band"
3. Run test against local Supabase (verify it passes)
4. Run test against production Supabase (capture exact failure)
5. Use E2E test results to identify exact policy blocking the operation

### E2E Test Scenarios Needed

```typescript
// Test 1: New user creates first band
test('new user can create their first band', async ({ page }) => {
  // 1. Sign up new user
  // 2. Navigate to get-started
  // 3. Enter band name
  // 4. Click "Create Band"
  // 5. Assert: Band created successfully
  // 6. Assert: User is owner of band
  // 7. Assert: No console errors
});

// Test 2: Existing user creates second band
test('existing user can create additional band', async ({ page }) => {
  // 1. Login existing user with band
  // 2. Navigate to create band flow
  // 3. Create new band
  // 4. Assert: New band created
  // 5. Assert: Can switch between bands
});

// Test 3: User can join band with invite code
test('user can join existing band with invite code', async ({ page }) => {
  // 1. Create band with user A
  // 2. Generate invite code
  // 3. Sign up user B
  // 4. Use invite code to join
  // 5. Assert: User B is member of band
});
```

### Debugging Plan (After E2E Tests)

1. **Enable Supabase SQL Logging**
   - Check which exact policy is rejecting the INSERT
   - Capture the full SQL query being executed

2. **Compare Policy Definitions**
   - Export all policies from local DB
   - Export all policies from production DB
   - Diff the two to find discrepancies

3. **Nuclear Option: Drop All Policies and Recreate**
   ```sql
   -- Drop ALL policies on band_memberships
   DO $$
   DECLARE
     r RECORD;
   BEGIN
     FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'band_memberships'
     LOOP
       EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.band_memberships';
     END LOOP;
   END $$;

   -- Then recreate from baseline migration
   ```

## Lessons Learned

### What Went Wrong
1. **No E2E testing before production deployment** - Caught issue too late
2. **Manual SQL application** - Error-prone, hard to verify
3. **Local vs Production drift** - Different policy states
4. **Incremental fixes without validation** - Compounded the problem

### What Should Have Been Done
1. ✅ E2E tests BEFORE modifying production
2. ✅ Automated deployment pipeline (not manual SQL)
3. ✅ Policy diff tool to compare local vs production
4. ✅ Rollback plan (database snapshots)

## References

- Baseline Migration: `supabase/migrations/20251106000000_baseline_schema.sql`
- Architecture Doc: `.claude/artifacts/2025-11-10T15:07_rls-security-architecture.md`
- Supabase Advisor Report: `.claude/artifacts/supabase-advisor-suggestions.md`
- Manual Deployment Commands: (in conversation history)
- SQL Test Suite: `supabase/tests/006-rls-policies.test.sql`

## Production Database Access

- Project Ref: `khzeuxxhigqcmrytsfux`
- Dashboard: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux
- SQL Editor: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/sql/new
- Access Token: In `.env.supabase.local` (expires Dec 10, 2025)

---

**Status**: Blocked pending E2E test implementation
**Next**: Set up Playwright and create band creation E2E test
