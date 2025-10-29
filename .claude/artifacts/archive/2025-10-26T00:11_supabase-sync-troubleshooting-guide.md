---
timestamp: 2025-10-26T00:11
prompt: Create comprehensive troubleshooting guide for Supabase experts documenting sync issues
status: BLOCKING - Sync Failing After Multiple RLS Fix Attempts
severity: Critical - No data syncing to production database
---

# Supabase Sync Troubleshooting Guide for Experts

## Executive Summary

**Problem:** Local-first app with IndexedDB → Supabase sync is failing due to RLS policy infinite recursion error.

**Symptom:** All sync operations return HTTP 500 with PostgreSQL error `42P17: infinite recursion detected in policy for relation "band_memberships"`

**What We've Tried:**
- 3 different RLS fix SQL scripts
- All scripts report "Success" but error persists
- Policies appear unchanged after running scripts

**Current Status:** BLOCKED - Need Supabase RLS expert assistance

---

## The Exact Error

### Error from Browser Console
```json
{
  "code": "42P17",
  "details": null,
  "hint": null,
  "message": "infinite recursion detected in policy for relation \"band_memberships\""
}
```

### When It Occurs
- User creates a song in local IndexedDB (succeeds)
- Sync engine attempts to INSERT into Supabase `songs` table
- Songs RLS policy checks if user is member of band
- Queries `band_memberships` table
- band_memberships RLS policy triggers
- **Infinite recursion occurs** (policies reference themselves)

### HTTP Response
- Status: `500 Internal Server Error`
- Operation: `POST https://khzeuxxhigqcmrytsfux.supabase.co/rest/v1/songs`
- Fails on ALL create/update/delete operations

---

## Application Architecture

### Local-First Sync Pattern
```
User Action → IndexedDB (Dexie) → Sync Queue → Supabase
                ↓                      ↓
            Immediate UI         Background sync
             (succeeds)          (fails with 500)
```

### Sync Flow
1. **Local operation**: User creates song → Saved to IndexedDB immediately
2. **Queue**: SyncRepository adds operation to `syncQueue` table
3. **Sync**: SyncEngine processes queue every 30s
4. **Remote**: RemoteRepository translates camelCase → snake_case and calls Supabase
5. **RLS Check**: Supabase evaluates RLS policies
6. **ERROR**: Infinite recursion detected → Operation fails

### Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Local DB**: Dexie (IndexedDB wrapper)
- **Remote DB**: Supabase (PostgreSQL + RLS)
- **Auth**: Supabase Auth with Google OAuth
- **Pattern**: Repository pattern with sync engine

---

## Current Database State

### Diagnostic Query Results

Ran this query to see actual policies:
```sql
SELECT policyname, cmd, qual as "USING clause", with_check as "WITH CHECK clause"
FROM pg_policies
WHERE tablename = 'band_memberships'
ORDER BY cmd, policyname;
```

**Output:**
```json
[
  {
    "policyname": "Admins can manage memberships",
    "cmd": "ALL",
    "USING clause": "(EXISTS ( SELECT 1 FROM band_memberships bm WHERE ((bm.band_id = band_memberships.band_id) AND (bm.user_id = auth.uid()) AND (bm.role = 'admin'::text) AND (bm.status = 'active'::text))))"
  },
  {
    "policyname": "Users can delete their own memberships",
    "cmd": "DELETE",
    "USING clause": "(user_id = auth.uid())"
  },
  {
    "policyname": "Users can create their own memberships",
    "cmd": "INSERT",
    "WITH CHECK clause": "(user_id = auth.uid())"
  },
  {
    "policyname": "Members can view band memberships",
    "cmd": "SELECT",
    "USING clause": "((user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM band_memberships bm WHERE ((bm.band_id = band_memberships.band_id) AND (bm.user_id = auth.uid()) AND (bm.status = 'active'::text)))))"
  },
  {
    "policyname": "Users can view their own memberships",
    "cmd": "SELECT",
    "USING clause": "(user_id = auth.uid())"
  },
  {
    "policyname": "Users can update their own memberships",
    "cmd": "UPDATE",
    "USING clause": "(user_id = auth.uid())"
  }
]
```

### The Problematic Policies

**1. "Admins can manage memberships"**
```sql
EXISTS (
  SELECT 1 FROM band_memberships bm  -- ← Queries band_memberships
  WHERE ...
)
```
**Problem:** This policy ON `band_memberships` queries the `band_memberships` table itself.

**2. "Members can view band memberships"**
```sql
EXISTS (
  SELECT 1 FROM band_memberships bm  -- ← Queries band_memberships
  WHERE ...
)
```
**Problem:** Same - self-referencing query causes infinite loop.

### Why This Causes Infinite Recursion

1. INSERT into `songs` table
2. Songs RLS policy: "Is user member of band?"
   ```sql
   context_id IN (
     SELECT band_id::text FROM band_memberships  -- ← Query band_memberships
     WHERE user_id = auth.uid()
   )
   ```
3. PostgreSQL evaluates SELECT from `band_memberships`
4. band_memberships RLS policies trigger
5. "Admins can manage memberships" policy executes:
   ```sql
   EXISTS (SELECT 1 FROM band_memberships ...)  -- ← Queries itself!
   ```
6. **Infinite loop detected** → Error 42P17

---

## What We've Tried (Chronologically)

### Attempt 1: Initial RLS Fix Script
**File:** `supabase/fix-rls-policies.sql`

**What it did:**
- Attempted to DROP old policies
- Create new simple policies

**Result:** ❌ FAILED
- Got error: `relation "practices" does not exist`
- Should be `practice_sessions`

### Attempt 2: Corrected Table Names
**File:** `supabase/fix-rls-policies-corrected.sql`

**What it did:**
- Fixed table name to `practice_sessions`
- Still had wrong column references

**Result:** ❌ FAILED
- Got error: `column "band_id" does not exist on songs`
- Songs table uses `context_id` not `band_id`

### Attempt 3: Correct Column Names
**File:** `supabase/fix-rls-policies-final.sql`

**What it did:**
- Fixed songs to use `context_id`
- Fixed practice_sessions table name
- Tried to DROP policies by guessed names

**Result:** ❌ Script succeeded but policies unchanged
- User reported: "ran successfully"
- BUT: Same error persists
- Reason: DROP statements used wrong policy names

### Attempt 4: Actual Policy Names (Current)
**File:** `supabase/fix-rls-policies-actual.sql`

**What it did:**
- Used ACTUAL policy names from diagnostic query
- Comprehensive DROP list including:
  - "Admins can manage memberships"
  - "Members can view band memberships"
  - All variations we tried before

**Result:** ❌ Script succeeded but policies STILL unchanged
- User reported: "ran successfully"
- Tested with Chrome MCP: Same error persists
- Error unchanged: Still infinite recursion on band_memberships

---

## Why Scripts Aren't Working (Theory)

### Hypothesis 1: Policies Owned by Different Schema/User
- DROP POLICY might not have permission
- Policies may be owned by `postgres` user or different schema
- Our scripts run as authenticated user with limited permissions

### Hypothesis 2: Policies Created by Supabase Dashboard
- Supabase UI may create policies differently than SQL
- May have additional metadata or flags
- Direct SQL DROP may not work on UI-created policies

### Hypothesis 3: Cached or Replicated State
- Supabase may have multiple database replicas
- Policy changes may not propagate immediately
- Cache not being cleared after policy updates

### Hypothesis 4: Transaction Rollback
- Scripts may be running in auto-rollback transaction
- If ANY error occurs, entire script rolls back
- "Success" message misleading

### Hypothesis 5: Multiple Policy Versions
- Old and new policies both exist
- Query shows newest but old ones still evaluated
- Need to check `pg_catalog` directly

---

## Database Schema Details

### Critical Schema Information

**Table:** `band_memberships`
```sql
CREATE TABLE band_memberships (
  id UUID PRIMARY KEY,
  band_id UUID REFERENCES bands(id),
  user_id UUID REFERENCES users(id),
  role TEXT,  -- 'admin' | 'member'
  status TEXT,  -- 'active' | 'inactive'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Table:** `songs`
```sql
CREATE TABLE songs (
  id UUID PRIMARY KEY,
  title TEXT,
  artist TEXT,
  context_type TEXT,  -- 'personal' | 'band'
  context_id TEXT,  -- user_id OR band_id (as TEXT)
  created_by UUID,
  tempo INTEGER,  -- NOTE: NOT "bpm", it's "tempo"
  created_date TIMESTAMPTZ,
  -- ... other fields
);
```

**CRITICAL:** Songs uses `context_id` (TEXT), NOT `band_id`

### Full Schema Reference
See: `.claude/specifications/unified-database-schema.md`

---

## What SHOULD Happen

### Correct band_memberships Policies (Simple, No Recursion)

```sql
-- SELECT: Users can view their own memberships
CREATE POLICY "Users can view their own memberships"
ON band_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create their own memberships
CREATE POLICY "Users can create their own memberships"
ON band_memberships FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own memberships
CREATE POLICY "Users can update their own memberships"
ON band_memberships FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: Users can delete their own memberships
CREATE POLICY "Users can delete their own memberships"
ON band_memberships FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

**Key:** These policies use ONLY `user_id = auth.uid()` - NO subqueries to band_memberships!

### Correct songs Policies (Can Query band_memberships Safely)

```sql
CREATE POLICY "Users can view their songs"
ON songs FOR SELECT
TO authenticated
USING (
  (context_type = 'personal' AND context_id = auth.uid()::text)
  OR
  (context_type = 'band' AND context_id IN (
    SELECT band_id::text FROM band_memberships  -- ← This is OK!
    WHERE user_id = auth.uid()
  ))
);
```

**Why this works:** Songs policies can query band_memberships because it won't cause recursion (songs ≠ band_memberships).

---

## Diagnostic Commands for Experts

### 1. Check All Policies on band_memberships
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'band_memberships';
```

### 2. Check Policy Ownership
```sql
SELECT
  pol.polname as policy_name,
  pol.polrelid::regclass as table_name,
  rol.rolname as policy_owner,
  nsp.nspname as schema_name
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
LEFT JOIN pg_roles rol ON cls.relowner = rol.oid
WHERE cls.relname = 'band_memberships';
```

### 3. Force Drop All Policies (Try as superuser)
```sql
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'band_memberships'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON band_memberships', pol.policyname);
  END LOOP;
END $$;
```

### 4. Verify No Policies Remain
```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'band_memberships';
```
Expected: `0` (after dropping all)

### 5. Create Simple Policies
Use the SQL from `supabase/fix-rls-policies-actual.sql`

---

## Environment Details

### Supabase Project
- **Project ID:** `khzeuxxhigqcmrytsfux`
- **Region:** Unknown (check dashboard)
- **Postgres Version:** Unknown (check dashboard)
- **Plan:** Unknown

### Authentication
- Method: Supabase Auth + Google OAuth
- User ID source: `auth.uid()`
- Session managed by: Supabase client library

### Current User
- Email: eric@example.com
- Has active session: YES
- Can read users table: YES
- Can read bands: YES (when RLS allows)

---

## Testing Procedure

### How to Test After Fix

1. **Verify policies were actually changed:**
   ```sql
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'band_memberships';
   ```
   Should show ONLY 4 simple policies (no EXISTS subqueries)

2. **Test simple INSERT:**
   ```sql
   -- As authenticated user (eric@example.com)
   INSERT INTO songs (
     id, title, artist, context_type, context_id, created_by, created_date
   ) VALUES (
     gen_random_uuid(),
     'Test Song',
     'Test Artist',
     'personal',
     auth.uid()::text,
     auth.uid(),
     now()
   );
   ```
   Should succeed without recursion error

3. **Test from app:**
   - Go to http://localhost:5173/songs
   - Click "Add Song"
   - Fill form and submit
   - Open console (F12)
   - Run: `debugSync()`
   - Should see: No errors, item processed

4. **Verify in Supabase:**
   - Go to Supabase Dashboard → Table Editor → songs
   - Should see new test song appear within 30 seconds

---

## Files Available

### SQL Scripts (All in `/workspaces/rock-on/supabase/`)
1. ✅ **`diagnose-rls-policies.sql`** - Shows current policies
2. ❌ **`fix-rls-policies.sql`** - First attempt (wrong table names)
3. ❌ **`fix-rls-policies-corrected.sql`** - Second attempt (wrong column names)
4. ❌ **`fix-rls-policies-final.sql`** - Third attempt (wrong policy names)
5. ⭐ **`fix-rls-policies-actual.sql`** - Latest attempt (should work but doesn't)

### Schema Documentation
- **`/.claude/specifications/unified-database-schema.md`** - Complete schema with both IndexedDB and Supabase

### Artifacts (All in `/.claude/artifacts/`)
- `2025-10-25T21:34_beta-deployment-checklist.md` - Original deployment plan
- `2025-10-25T22:01_rls-policies-not-applied-diagnosis.md` - First diagnostic
- `2025-10-26T00:11_supabase-sync-troubleshooting-guide.md` - This document

---

## Questions for Supabase Experts

### Critical Questions

1. **Why do DROP POLICY statements succeed but policies remain unchanged?**
   - Do we need special permissions?
   - Is there a cache to clear?
   - Are policies created by dashboard handled differently?

2. **How can we verify policies are actually dropped?**
   - Beyond `SELECT FROM pg_policies`
   - Any system catalogs to check?
   - Any replication lag?

3. **Is there a way to force-drop all policies as superuser?**
   - Can we escalate permissions temporarily?
   - Use Supabase CLI with elevated access?
   - Reset RLS completely and start over?

4. **Why does infinite recursion occur on band_memberships specifically?**
   - Other tables (bands, songs, etc.) work fine querying band_memberships
   - Only band_memberships querying itself causes issues
   - Is this a known PostgreSQL RLS limitation?

5. **Best practice for breaking circular RLS dependencies?**
   - How should band admin checks work?
   - Alternative to subqueries on same table?
   - Use security definer functions?

### Alternative Approaches

1. **Use security definer functions?**
   ```sql
   CREATE FUNCTION is_band_admin(p_band_id UUID) RETURNS BOOLEAN
   SECURITY DEFINER
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM band_memberships
       WHERE band_id = p_band_id
       AND user_id = auth.uid()
       AND role = 'admin'
     );
   $$ LANGUAGE SQL;
   ```
   Would this avoid recursion?

2. **Disable RLS temporarily for testing?**
   ```sql
   ALTER TABLE band_memberships DISABLE ROW LEVEL SECURITY;
   ```
   Just to verify sync works without RLS?

3. **Use separate service role for sync operations?**
   - Bypass RLS entirely for sync
   - Validate permissions in application code
   - Less secure but might work

4. **Restructure schema to avoid circular dependencies?**
   - Denormalize band admin data?
   - Cache memberships in application layer?
   - Use different auth pattern?

---

## Immediate Next Steps

### For User
1. Share this document with Supabase experts/support
2. Include project ID: `khzeuxxhigqcmrytsfux`
3. Request assistance with RLS policy debugging
4. Ask about policy ownership/permissions issues

### For Supabase Expert
1. Review current policies (see diagnostic output above)
2. Identify why DROP POLICY statements don't work
3. Provide working SQL to actually remove problematic policies
4. Confirm simple policies will avoid recursion
5. Test solution before user applies to production

### For Development Team
1. **PAUSE production deployment** until sync works
2. Continue local development (IndexedDB works fine)
3. Consider setting up local Supabase for testing
4. Document any workarounds found

---

## Success Criteria

### Fix is Complete When:
- ✅ NO "infinite recursion" errors in console
- ✅ HTTP 200 responses from Supabase (not 500)
- ✅ `debugSync()` shows queue processing successfully
- ✅ Data appears in Supabase tables within 30 seconds
- ✅ All CRUD operations work (create, read, update, delete)
- ✅ RLS still enforces proper security (users only see their data)

### Verification Steps:
1. Create song → Appears in Supabase
2. Update song → Changes reflected in Supabase
3. Delete song → Removed from Supabase
4. User can only see/modify their own bands
5. Band admins can manage band data
6. Regular members have read-only access

---

## Additional Context

### Why This Is Critical
- App is local-first (works offline)
- Without sync, data never reaches cloud
- Users lose data when switching devices
- Collaboration features don't work
- Production deployment blocked

### Timeline
- **2025-10-25**: Discovered sync failing
- **2025-10-25**: Multiple RLS fix attempts
- **2025-10-26**: Escalating to Supabase experts

### Project Context
- MVP for band management app
- Core features: Songs, setlists, practices, shows
- Multi-user bands with admin roles
- Offline-first, sync when online
- Beta testing blocked by this issue

---

## Contact & Resources

### Project Repository
- Local path: `/workspaces/rock-on`
- GitHub: (add if applicable)

### Team
- Developer: (add contact)
- Supabase Project Owner: (add contact)

### Documentation
- Supabase Docs: https://supabase.com/docs
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

---

**Last Updated:** 2025-10-26T00:11
**Status:** BLOCKING - Awaiting Supabase Expert Assistance
**Priority:** P0 - Production deployment blocked
