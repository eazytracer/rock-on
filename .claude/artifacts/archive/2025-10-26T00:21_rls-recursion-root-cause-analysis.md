---
timestamp: 2025-10-26T00:21
prompt: Analyze RLS recursion errors by reviewing actual SQL migration scripts and comparing against schema
status: ROOT CAUSE IDENTIFIED
severity: CRITICAL
---

# RLS Recursion Error - Root Cause Analysis

## Executive Summary

**ROOT CAUSE:** Original migration file `20251025000100_rls_policies.sql` created policies on `band_memberships` that query `band_memberships` itself, causing infinite recursion.

**COMPOUNDING ISSUE:** Fix scripts failed to drop the problematic policies, resulting in DUPLICATE policies - both old (recursive) AND new (non-recursive) policies exist simultaneously.

**IMPACT:** Any query that touches `band_memberships` (songs, bands, setlists, practices) triggers infinite recursion.

## The Smoking Gun

### Original Migration File (`supabase/migrations/20251025000100_rls_policies.sql`)

**Lines 80-90:** Policy that queries itself
```sql
CREATE POLICY "Members can view band memberships"
  ON public.band_memberships FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.band_memberships bm   -- ← RECURSION!
      WHERE bm.band_id = band_memberships.band_id
      AND bm.user_id = auth.uid()
      AND bm.status = 'active'
    )
  );
```

**Lines 92-102:** Another recursive policy
```sql
CREATE POLICY "Admins can manage memberships"
  ON public.band_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships bm   -- ← RECURSION!
      WHERE bm.band_id = band_memberships.band_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
      AND bm.status = 'active'
    )
  );
```

### How the Recursion Happens

**Execution Flow:**
1. User creates a song with `context_type = 'band'`
2. Songs INSERT policy checks: "Is user a member of this band?"
3. Runs: `SELECT band_id FROM band_memberships WHERE user_id = auth.uid()`
4. **Postgres must check RLS on band_memberships before executing SELECT**
5. Evaluates "Members can view band memberships" policy
6. Policy contains: `EXISTS (SELECT 1 FROM band_memberships...)`
7. **Postgres must check RLS on band_memberships again**
8. **Loop back to step 5 → INFINITE RECURSION!**

**Error:**
```
{
  "code": "42P17",
  "message": "infinite recursion detected in policy for relation \"band_memberships\""
}
```

## Evidence: Duplicate Policies Found

From your provided policy list, **multiple policies exist per operation** on several tables:

### band_memberships (CRITICAL)
```json
// NEW policies (from fix script):
"Users can view their own memberships" (SELECT)
"Users can create their own memberships" (INSERT)
"Users can update their own memberships" (UPDATE)
"Users can delete their own memberships" (DELETE)

// OLD policies (from migration - STILL THERE!):
"Members can view band memberships" (SELECT) ← Has recursion
"Admins can manage memberships" (ALL) ← Has recursion
```

### bands (Has duplicates)
```json
"Band members can view their bands" (SELECT) ← OLD migration
"Users can view their bands" (SELECT) ← NEW fix script

"Band admins can update bands" (UPDATE) ← OLD migration
"Users can update their bands" (UPDATE) ← NEW fix script
```

### practice_sessions (Has duplicates)
```json
"Band members can manage sessions" (ALL) ← OLD migration
"Users can view band practices" (SELECT) ← NEW fix script
"Users can create practices" (INSERT) ← NEW fix script
"Users can update practices" (UPDATE) ← NEW fix script
"Users can delete practices" (DELETE) ← NEW fix script
```

### setlists (Has duplicates)
```json
"Band members can manage setlists" (ALL) ← OLD migration
"Band members can view setlists" (SELECT) ← OLD migration
"Users can view band setlists" (SELECT) ← NEW fix script
"Users can create setlists" (INSERT) ← NEW fix script
"Users can update setlists" (UPDATE) ← NEW fix script
"Users can delete setlists" (DELETE) ← NEW fix script
```

### songs (Has duplicates)
```json
"Band members can view band songs" (SELECT) ← OLD migration
"Users can view their songs" (SELECT) ← NEW fix script

"Creators and band members can update songs" (UPDATE) ← OLD migration
"Users can update songs" (UPDATE) ← NEW fix script

"Creators can delete songs" (DELETE) ← OLD migration
"Users can delete songs" (DELETE) ← NEW fix script
```

## Why Fix Scripts Failed

### Problem 1: Incomplete DROP List

The fix script `fix-rls-policies-actual.sql` attempted to drop policies:

```sql
-- Lines 16-21: Only 2 policies dropped for band_memberships
DROP POLICY IF EXISTS "Admins can manage memberships" ON band_memberships;
DROP POLICY IF EXISTS "Members can view band memberships" ON band_memberships;
```

**BUT** the original migration created these policies under `public.band_memberships`, and the fix script might not have targeted the right schema or there were MORE policies we didn't account for.

### Problem 2: Other Tables Not Cleaned

The fix script dropped OLD policies for band_memberships, songs, bands, etc., but **the original migration policies are STILL active** based on your output.

This suggests:
1. The DROP commands didn't execute successfully
2. There's a schema mismatch (`public.band_memberships` vs `band_memberships`)
3. Policies were re-created by a trigger or another script

### Problem 3: ALL Policies

The migration uses `FOR ALL` policies:
- "Admins can manage memberships" (FOR ALL)
- "Band members can manage setlists" (FOR ALL)
- "Band members can manage sessions" (FOR ALL)

These are **broad policies** that apply to SELECT, INSERT, UPDATE, AND DELETE. When you create more specific policies (e.g., "Users can view their own memberships" for SELECT), you now have **TWO policies** evaluating for SELECT operations.

## Original Migration Analysis

### What Was Wrong

**File:** `supabase/migrations/20251025000100_rls_policies.sql`

**Lines 49-58:** Bands policy queries band_memberships (OK - not recursive)
```sql
CREATE POLICY "Band members can view their bands"
  ON public.bands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships   -- ← OK: bands querying band_memberships
      WHERE band_id = bands.id
      ...
    )
  );
```

**Lines 80-90:** band_memberships policy queries band_memberships (RECURSION!)
```sql
CREATE POLICY "Members can view band memberships"
  ON public.band_memberships FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.band_memberships bm  -- ← RECURSION: band_memberships querying itself!
      ...
    )
  );
```

**The Rule:**
- ✅ **OK:** Table A policy queries Table B
- ✅ **OK:** Table B policy queries Table C
- ❌ **RECURSION:** Table A policy queries Table A
- ❌ **MUTUAL RECURSION:** Table A policy queries B, AND Table B policy queries A

### Current State: Mixed Policies

Your database has:
- ✅ Some good non-recursive policies (from fix scripts)
- ❌ Some recursive policies (from original migration - STILL ACTIVE)
- ⚠️ BOTH types active simultaneously

**When Postgres evaluates RLS:**
1. It evaluates **ALL** policies for a given operation
2. Policies are combined with **OR** logic (any policy that returns TRUE grants access)
3. If ANY policy has recursion → **ENTIRE QUERY FAILS**

## The Complete Fix Strategy

### Option 1: Nuclear Approach (RECOMMENDED)

**Drop ALL policies and start fresh:**

1. **Create comprehensive DROP script** with:
   - ALL policy names from original migration
   - ALL policy names from fix attempts
   - ALL policy names from your output
   - Use `public.` schema prefix explicitly

2. **Verify all policies dropped:**
   ```sql
   SELECT COUNT(*) FROM pg_policies WHERE tablename IN (...);
   -- Expected: 0
   ```

3. **Create NEW simplified policies** (from scratch):
   - band_memberships: ONLY direct `user_id = auth.uid()` checks
   - Other tables: CAN query band_memberships (no recursion)

4. **Verify policy count:**
   ```sql
   -- Should be exactly 28 policies (4 per table × 7 tables)
   ```

### Option 2: Surgical Approach (RISKY)

1. Drop ONLY the problematic recursive policies
2. Keep the good policies from fix scripts
3. Test thoroughly

**Risk:** May miss hidden policies or have schema mismatches

### Why Nuclear Is Better

1. **Certainty:** Guarantees all old policies are gone
2. **Clean state:** No ambiguity about which policies are active
3. **Testable:** Clear expected outcome (28 policies)
4. **Version controlled:** Create proper migration file

## Critical Policies to Remove

**From original migration (`20251025000100_rls_policies.sql`):**

### band_memberships (MUST REMOVE)
- ❌ "Members can view band memberships" (line 80) - HAS RECURSION
- ❌ "Admins can manage memberships" (line 92) - HAS RECURSION

### bands (Remove to avoid conflicts)
- "Band members can view their bands" (line 49)
- "Band admins can update bands" (line 60)
- "Users can create bands" (line 72)

### songs (Remove to avoid conflicts)
- "Band members can view band songs" (line 108)
- "Users can create songs" (line 121)
- "Creators and band members can update songs" (line 125)
- "Creators can delete songs" (line 138)

### setlists (Remove to avoid conflicts)
- "Band members can view setlists" (line 146)
- "Band members can manage setlists" (line 157)

### practice_sessions (Remove to avoid conflicts)
- "Band members can view sessions" (line 168)
- "Band members can manage sessions" (line 179)

### users (Remove to avoid conflicts)
- "Users can view own profile" (line 25)
- "Users can update own profile" (line 29)

### user_profiles (Remove to avoid conflicts)
- "User profiles viewable by self" (line 33)
- "User profiles updateable by self" (line 37)
- "Users can create own profile" (line 41)

## Schema Discrepancies

### Table Name Correctness ✅

All table names in migration match unified schema:
- ✅ `practice_sessions` (NOT `practices`)
- ✅ `band_memberships` (NOT `bandMemberships`)
- ✅ All using snake_case

### Field Name Correctness ✅

All field names in migration match Supabase schema:
- ✅ `user_id`, `band_id` (NOT `userId`, `bandId`)
- ✅ `context_id`, `context_type` (NOT `contextId`, `contextType`)
- ✅ `created_by` (NOT `createdBy`)

### Context Casting ✅

Migration properly casts UUIDs to TEXT for context_id:
```sql
-- Line 115: Correct
WHERE band_id::text = context_id

-- Line 132: Correct
WHERE band_id::text = context_id
```

## Recommended Action Plan

### Phase 1: Complete Policy Audit (DO THIS FIRST)

Run this in Supabase SQL Editor to get FULL policy definitions:
```sql
SELECT
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename IN (
  'band_memberships',
  'songs',
  'bands',
  'setlists',
  'practice_sessions',
  'users',
  'user_profiles'
)
ORDER BY tablename, cmd, policyname;
```

**Save the FULL output** - we need to see the `using_clause` to identify ALL recursive queries.

### Phase 2: Create Nuclear Fix Script

I will create a new script that:

1. **Drops ALL policies** using exact names from your database
2. **Verifies tables are empty** of policies
3. **Creates NEW clean policies** with no recursion
4. **Verifies exactly 28 policies** were created
5. **Tests with sample query** to confirm no recursion

### Phase 3: Update Migration Files

1. **Fix the original migration:** `supabase/migrations/20251025000100_rls_policies.sql`
2. **Create new migration:** `20251026_fix_rls_recursion.sql`
3. **Document the issue** for future reference

### Phase 4: Test & Verify

1. Run diagnostic query (policy count)
2. Test song creation
3. Test band operations
4. Check for ANY recursion errors
5. Verify sync queue processes

## Prevention for Future

### Rules for Writing RLS Policies

1. **NEVER query the same table** the policy is on
   ```sql
   -- ❌ WRONG - will recurse
   CREATE POLICY "foo" ON table_a FOR SELECT
   USING (EXISTS (SELECT 1 FROM table_a WHERE ...));

   -- ✅ CORRECT
   CREATE POLICY "foo" ON table_a FOR SELECT
   USING (user_id = auth.uid());
   ```

2. **Use direct comparisons** when possible
   ```sql
   -- ✅ BEST: No subquery
   USING (user_id = auth.uid())

   -- ⚠️ OK: Subquery to DIFFERENT table
   USING (id IN (SELECT band_id FROM band_memberships WHERE ...))
   ```

3. **Avoid mutual recursion**
   ```sql
   -- ❌ WRONG: A queries B, B queries A
   -- Policy on table_a:
   USING (EXISTS (SELECT 1 FROM table_b WHERE ...))

   -- Policy on table_b:
   USING (EXISTS (SELECT 1 FROM table_a WHERE ...))
   ```

4. **Test policies incrementally**
   - Add one table's policies at a time
   - Test after each addition
   - Use local Supabase for testing

### Recommended Policy Pattern

**For junction tables (like band_memberships):**
```sql
-- Simple, direct, no recursion
CREATE POLICY "Users can view own memberships"
ON band_memberships FOR SELECT
USING (user_id = auth.uid());
```

**For related tables (like songs, bands, etc.):**
```sql
-- OK to query band_memberships from other tables
CREATE POLICY "Band members can view band songs"
ON songs FOR SELECT
USING (
  context_type = 'band' AND EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_id::text = songs.context_id
    AND user_id = auth.uid()
  )
);
```

## Next Steps

**WAITING FOR YOUR APPROVAL** before executing fix:

1. ✅ **Review this analysis** - Does it match what you're seeing?
2. ⏳ **Run diagnostic query** - Get full policy definitions (optional)
3. ⏳ **Approve nuclear fix** - I'll create comprehensive DROP + CREATE script
4. ⏳ **Execute fix** - Run new script in Supabase
5. ⏳ **Test & verify** - Confirm recursion is gone
6. ⏳ **Update migrations** - Fix source files to prevent recurrence

## Summary

**Root Cause:** Original migration `20251025000100_rls_policies.sql` created policies on `band_memberships` that query `band_memberships`, causing infinite recursion.

**Current State:** Database has BOTH old (recursive) and new (non-recursive) policies active simultaneously. The recursive policies are still triggering errors.

**Solution:** Drop ALL existing policies using exact policy names, then create clean non-recursive policies from scratch.

**Validation:** After fix, should have exactly 28 policies (4 per table × 7 tables), and NO recursion errors when creating songs.

---

**Ready to proceed with nuclear fix?** Please confirm and I'll create the comprehensive fix script.
