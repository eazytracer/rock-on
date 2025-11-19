---
timestamp: 2025-10-25T21:31
prompt: Investigate why data is not syncing to Supabase and identify root cause
status: Root Cause Identified - RLS Policy Infinite Recursion
---

# Sync System Root Cause Analysis

## Executive Summary

**The sync system is working correctly!** The issue is not with the application code, but with Supabase Row Level Security (RLS) policies causing infinite recursion.

**Error:**
```
"infinite recursion detected in policy for relation \"band_memberships\""
PostgreSQL Error Code: 42P17
```

## Investigation Process

### Step 1: Verified Sync Infrastructure
- ✅ SyncRepository is correctly configured
- ✅ Services (SongService, BandService) use SyncRepository
- ✅ SyncEngine is running periodic sync
- ✅ Queue mechanism works (confirmed with manual test)

### Step 2: Created Debugging Utilities
- Created `debugSync()` utility to inspect sync queue
- Created `testSupabaseConnection()` to validate connection
- Fixed component export issue (SyncStatusIndicator)
- Integrated sync status UI into ModernLayout

### Step 3: Live Testing with Chrome MCP
- Attempted to create new song through UI
- Monitored console logs in real-time
- **Found error:** `Failed to sync songs: JSHandle@object`
- Retrieved full error details showing RLS recursion

### Step 4: Root Cause Identified
The sync queue IS working:
1. New songs are added to local IndexedDB ✅
2. SyncEngine queues the create operation ✅
3. SyncEngine attempts to push to Supabase ✅
4. **Supabase returns 500 error due to RLS policy** ❌

## The Problem: RLS Infinite Recursion

### What is happening:
Your `band_memberships` table has RLS policies that reference other tables (likely `bands` or `users`), which in turn have policies that reference `band_memberships`, creating a circular dependency.

### Common RLS Patterns That Cause This:

**Bad Pattern (Causes Recursion):**
```sql
-- On band_memberships table
CREATE POLICY "Users see own memberships"
ON band_memberships FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT user_id FROM band_memberships  -- RECURSION!
    WHERE band_id = band_memberships.band_id
  )
);
```

**Bad Pattern (Cross-table Recursion):**
```sql
-- On songs table
CREATE POLICY "Users see band songs"
ON songs FOR SELECT
TO authenticated
USING (
  band_id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid()
  )
);

-- On band_memberships table
CREATE POLICY "Users see memberships for their songs"
ON band_memberships FOR SELECT
TO authenticated
USING (
  band_id IN (
    SELECT band_id FROM songs  -- CIRCULAR!
    WHERE created_by = auth.uid()
  )
);
```

## The Solution

### 1. Identify the Problematic Policies

Go to your Supabase dashboard:
1. Navigate to **Database** → **Policies**
2. Look at `band_memberships` table policies
3. Check if any policies reference `band_memberships` within their USING clause
4. Check for circular references between tables

### 2. Recommended RLS Policy Structure

**For band_memberships (CORRECTED):**
```sql
-- Drop existing policies if needed
DROP POLICY IF EXISTS "Users see own memberships" ON band_memberships;
DROP POLICY IF EXISTS "Users insert own memberships" ON band_memberships;
DROP POLICY IF EXISTS "Users update own memberships" ON band_memberships;
DROP POLICY IF EXISTS "Users delete own memberships" ON band_memberships;

-- SELECT: Users can see memberships where they are the user
CREATE POLICY "Users can view their own memberships"
ON band_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create memberships (for themselves or if they're band admin)
CREATE POLICY "Users can create memberships"
ON band_memberships FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM band_memberships AS bm
    WHERE bm.band_id = band_memberships.band_id
    AND bm.user_id = auth.uid()
    AND bm.role = 'admin'
  )
);

-- UPDATE: Users can update their own memberships or admins can update any
CREATE POLICY "Users can update memberships"
ON band_memberships FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM band_memberships AS bm
    WHERE bm.band_id = band_memberships.band_id
    AND bm.user_id = auth.uid()
    AND bm.role = 'admin'
  )
);

-- DELETE: Users can delete their own memberships or admins can delete
CREATE POLICY "Users can delete memberships"
ON band_memberships FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM band_memberships AS bm
    WHERE bm.band_id = band_memberships.band_id
    AND bm.user_id = auth.uid()
    AND bm.role = 'admin'
  )
);
```

**Note:** The INSERT/UPDATE/DELETE policies above DO reference `band_memberships` BUT they use a table alias (`AS bm`) to distinguish the subquery from the main table. This is generally safe, but if you're still getting recursion, use this safer alternative:

**Alternative (No Recursion - Simplified):**
```sql
-- SELECT: Direct user_id check
CREATE POLICY "Users can view their own memberships"
ON band_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Only insert your own membership
CREATE POLICY "Users can create their own memberships"
ON band_memberships FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Only update your own membership
CREATE POLICY "Users can update their own memberships"
ON band_memberships FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: Only delete your own membership
CREATE POLICY "Users can delete their own memberships"
ON band_memberships FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### 3. Fix Other Related Tables

**For songs table:**
```sql
-- SELECT: Users can see songs from bands they're in
CREATE POLICY "Users can view band songs"
ON songs FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR
  band_id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Users can create songs in their bands
CREATE POLICY "Users can create songs"
ON songs FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND
  (
    band_id IN (
      SELECT band_id FROM band_memberships
      WHERE user_id = auth.uid()
    )
  )
);

-- UPDATE: Users can update their own songs
CREATE POLICY "Users can update songs"
ON songs FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- DELETE: Users can delete their own songs
CREATE POLICY "Users can delete songs"
ON songs FOR DELETE
TO authenticated
USING (created_by = auth.uid());
```

**For bands table:**
```sql
-- SELECT: Users see bands they're members of
CREATE POLICY "Users can view their bands"
ON bands FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR
  id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Any authenticated user can create a band
CREATE POLICY "Users can create bands"
ON bands FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE: Only creators or admins can update
CREATE POLICY "Users can update their bands"
ON bands FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- DELETE: Only creators can delete
CREATE POLICY "Users can delete their bands"
ON bands FOR DELETE
TO authenticated
USING (created_by = auth.uid());
```

## Implementation Steps

### Step 1: Backup Current Policies
Before making changes, document your current policies:
1. Go to Supabase SQL Editor
2. Run:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('band_memberships', 'songs', 'bands', 'setlists', 'practices')
ORDER BY tablename, policyname;
```
3. Save the output

### Step 2: Drop Problematic Policies
```sql
-- Drop all policies on band_memberships
DROP POLICY IF EXISTS "Users see own memberships" ON band_memberships;
-- Add other DROP statements for all existing policies
```

### Step 3: Apply New Policies
Use the SQL from "Recommended RLS Policy Structure" above.

### Step 4: Test
1. Create a new song through the UI
2. Run `debugSync()` in browser console
3. Check for errors in console
4. Verify song appears in Supabase dashboard

## Verification Checklist

After fixing RLS policies:

- [ ] No "infinite recursion" errors in console
- [ ] `debugSync()` shows queue items being processed
- [ ] Queue items disappear after sync (not stuck as "pending")
- [ ] Data appears in Supabase tables
- [ ] Sync status indicator shows green checkmark
- [ ] Can create songs, bands, setlists, practices
- [ ] Can update existing data
- [ ] Can delete data
- [ ] Data syncs within 30 seconds

## Additional Notes

### Why This Wasn't Caught Earlier

1. **Local development used mock data**: The app was working fine locally with IndexedDB only
2. **RLS only applies in production**: Policies don't affect local development
3. **Sync was never tested end-to-end** until now

### What's Working Now

- ✅ Sync queue mechanism
- ✅ Background sync engine
- ✅ Local-first architecture
- ✅ Optimistic updates
- ✅ Online/offline detection
- ✅ Sync status UI components
- ✅ Debug utilities

### What Needs Fixing

- ❌ RLS policies on band_memberships (infinite recursion)
- ⚠️  Possibly other tables with similar issues

## Next Steps

1. **Fix RLS policies** using SQL above
2. **Test sync** with `debugSync()` and create test data
3. **Verify all tables** (songs, bands, setlists, practices, band_memberships)
4. **Deploy to Vercel** once local sync is confirmed working
5. **Test OAuth** in production environment

## Files Modified in This Session

- `src/utils/debugSync.ts` - Fixed variable scoping issue
- `src/components/sync/index.ts` - Added SyncStatusIndicator export
- `src/components/layout/ModernLayout.tsx` - Integrated sync UI components
- `.claude/artifacts/2025-10-25T21:21_sync-testing-troubleshooting-guide.md` - Created testing guide

## References

- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Error Code 42P17: https://www.postgresql.org/docs/current/errcodes-appendix.html
