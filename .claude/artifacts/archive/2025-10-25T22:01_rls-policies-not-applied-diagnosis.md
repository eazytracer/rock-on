---
timestamp: 2025-10-25T22:01
prompt: Diagnose why RLS policies weren't applied after user ran the fix script
status: RLS Policies NOT Applied - Same Error Persists
---

# RLS Policies NOT Applied - Diagnosis & Fix

## Problem Confirmed

Using Chrome MCP, I tested song creation and confirmed the **EXACT SAME ERROR** is still occurring:

```json
{
  "code": "42P17",
  "message": "infinite recursion detected in policy for relation \"band_memberships\""
}
```

**This is identical to the error before the "fix" was applied.**

## What Happened

When you said "I ran the RLS fixes and it ran successfully", the SQL script likely:
1. **Ran without syntax errors** (hence "successful")
2. **BUT did not actually fix the policies** (they still cause recursion)

Possible causes:
- Wrong script file was run
- Policies weren't actually dropped
- There are additional policies we didn't account for
- Script executed partially but failed silently

## Files Available

You have TWO RLS fix scripts:

1. ❌ **`supabase/fix-rls-policies-corrected.sql`**
   - Still references `band_id` on songs table (WRONG)
   - Will fail with column errors

2. ✅ **`supabase/fix-rls-policies-final.sql`** ⭐ **USE THIS ONE**
   - Uses correct `context_id` for songs table
   - Has proper column names for all tables
   - Should fix the infinite recursion

## Step 1: Diagnostic Query

**Before running any fix**, run this diagnostic to see what policies currently exist:

```bash
File: /workspaces/rock-on/supabase/diagnose-rls-policies.sql
```

**How to run:**
1. Go to Supabase Dashboard → SQL Editor
2. Open file: `/workspaces/rock-on/supabase/diagnose-rls-policies.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **Run**

**Expected output:**
- Shows ALL current policies
- Count per table
- Detailed policy definitions for band_memberships

**What to look for:**
- Are there policies we didn't account for?
- Do the band_memberships policies match what we expect?
- Are there duplicate policies?

## Step 2: Apply CORRECT RLS Fix

**File:** `/workspaces/rock-on/supabase/fix-rls-policies-final.sql` ⭐

**How to run:**
1. Go to Supabase Dashboard → SQL Editor
2. Open file: `/workspaces/rock-on/supabase/fix-rls-policies-final.sql`
3. Copy **ENTIRE** contents (all 369 lines)
4. Paste into SQL Editor
5. Click **Run**
6. **IMPORTANT:** Wait for "Success. No rows returned" message

**What it does:**
1. Drops ALL existing policies (comprehensive list)
2. Creates new, simple policies that avoid recursion
3. Uses correct column names (`context_id`, `practice_sessions`, etc.)
4. Runs verification query at the end

**Verification:**
The script includes a verification query at the end that shows:
- All 28 policies (4 per table × 7 tables)
- Policy names and commands

## Step 3: Test Sync Again

After running the CORRECT script:

1. Go to your app: http://localhost:5173/songs
2. Open browser console (F12)
3. Create a new test song
4. Immediately run: `debugSync()`
5. Check for errors in console

**Expected result:**
- ✅ Song appears in local DB immediately
- ✅ Item appears in sync queue briefly
- ✅ NO errors in console
- ✅ Song appears in Supabase within ~30 seconds

**If still failing:**
- Check console for NEW error message (should be different)
- Run diagnostic query again to verify policies
- Copy exact error message for further debugging

## Root Cause Analysis

### The Infinite Recursion Problem

Original broken policy (what's STILL in your Supabase):
```sql
-- This causes infinite recursion:
CREATE POLICY "Users can view their bands"
ON bands FOR SELECT
USING (
  id IN (
    SELECT band_id FROM band_memberships  -- ← Queries band_memberships
    WHERE user_id IN (
      SELECT user_id FROM band_memberships  -- ← Recursion!
      WHERE band_id = bands.id
    )
  )
);
```

Fixed policy (what SHOULD be there):
```sql
-- Simple, no recursion:
CREATE POLICY "Users can view their bands"
ON bands FOR SELECT
USING (
  id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid()  -- ← Direct check, no recursion
  )
);
```

### Why band_memberships Was the Problem

When syncing a song:
1. INSERT into `songs` table
2. Songs RLS policy checks: "Is user member of this band?"
3. Queries `band_memberships` table
4. band_memberships RLS policy triggers
5. **IF** band_memberships policy references itself → INFINITE LOOP

The fix: Make band_memberships policies simple and direct:
```sql
-- Simple: just check if this membership belongs to current user
USING (user_id = auth.uid())
```

## Local Supabase Setup (Future Enhancement)

For testing RLS changes without affecting production:

### Requirements
- Docker Desktop installed
- Supabase CLI installed

### Quick Start (after installing prerequisites)
```bash
# Initialize Supabase project
npx supabase init

# Start local Supabase
npx supabase start

# Get local credentials
npx supabase status
```

### Benefits
- Test RLS policies safely
- Reset anytime with `npx supabase db reset`
- Apply migrations incrementally
- No risk to production data

**Recommendation:** Set this up after we fix the production RLS issue.

## Next Steps

### Immediate (Fix Production)
1. ✅ Run diagnostic query to see current policies
2. ✅ Run CORRECT fix script (`fix-rls-policies-final.sql`)
3. ✅ Verify with test song creation
4. ✅ Confirm data appears in Supabase

### Short-term (Better Testing)
1. Set up local Supabase with Docker
2. Test RLS changes locally first
3. Create migration files for version control
4. Apply tested migrations to production

### Long-term (Deployment)
1. Once sync confirmed working locally AND in production
2. Clean up test data
3. Deploy to Vercel
4. Beta test with real users

## Summary

**Problem:** RLS fix script wasn't actually applied (policies still broken)

**Solution:** Run the CORRECT script (`fix-rls-policies-final.sql`)

**Verification:** Test song creation, check `debugSync()`, verify data in Supabase

**Prevention:** Set up local Supabase for testing future changes

---

## Quick Reference

**Files to use:**
- ✅ `supabase/fix-rls-policies-final.sql` - THE CORRECT FIX
- ✅ `supabase/diagnose-rls-policies.sql` - DIAGNOSTIC QUERY
- ❌ `supabase/fix-rls-policies-corrected.sql` - DON'T USE (wrong column names)

**Expected policies per table:**
- band_memberships: 4 policies
- songs: 4 policies
- bands: 4 policies
- setlists: 4 policies
- practice_sessions: 4 policies
- users: 4 policies
- user_profiles: 4 policies
- **Total: 28 policies**

**Test command:**
```javascript
// In browser console
debugSync()
```

**Success criteria:**
- No "infinite recursion" errors
- No 500 errors in network tab
- Data appears in Supabase tables
- Sync queue processes items and clears
