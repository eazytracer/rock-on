# Manual Remote Database Deployment Guide

**Date:** 2025-11-19T16:52
**Purpose:** Deploy consolidated baseline migration to remote Supabase (manual method)
**Reason:** Supabase CLI authentication issues in devcontainer environment

## Summary

Since the Supabase CLI cannot authenticate from the devcontainer environment, we'll deploy the baseline migration manually using the Supabase Studio SQL editor.

## Prerequisites

✅ **Local testing complete:** 337/337 pgTAP tests passing
✅ **Baseline migration:** `supabase/migrations/20251106000000_baseline_schema.sql`
✅ **Reset script:** `supabase/reset-remote-database.sql`

## Step-by-Step Deployment Process

### Step 1: Access Supabase Studio SQL Editor

1. Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/sql
2. Click "New Query" button

### Step 2: Backup Current Data (If Needed)

⚠️ **WARNING:** The reset script will DELETE ALL DATA in the public schema.

If you have production data you want to keep:
1. Use Supabase Studio > Table Editor to export any critical data
2. Or skip this deployment and migrate data properly first

### Step 3: Run Reset Script

1. Open file: `supabase/reset-remote-database.sql`
2. Copy the entire contents
3. Paste into Supabase Studio SQL Editor
4. Click "Run" button
5. **Verify the output shows all counts as 0:**
   - Tables remaining: 0
   - Functions remaining: 0
   - Policies remaining: 0
   - Migrations remaining: 0

**Expected output:**
```
Tables remaining: 0
Functions remaining: 0
Policies remaining: 0
Migrations remaining: 0
```

### Step 4: Apply Baseline Migration

1. Open file: `supabase/migrations/20251106000000_baseline_schema.sql`
2. Copy the entire contents
3. Create a new query in Supabase Studio SQL Editor
4. Paste the migration SQL
5. Click "Run" button
6. **Wait for completion** (may take 30-60 seconds due to ~2500 lines)

**Expected success indicators:**
- No errors in output
- "Success. No rows returned" or similar message
- Green checkmark icon

### Step 5: Verify Schema Deployment

Run this verification query in SQL Editor:

```sql
-- Count tables (should be 11)
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Count RLS policies (should be ~71)
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';

-- Count functions (should be 8)
SELECT COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';

-- Check migration history (should show baseline)
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

**Expected results:**
- **Tables:** 11 (users, bands, songs, setlists, shows, etc.)
- **RLS Policies:** ~71
- **Functions:** 8
- **Migration:** Single entry for `20251106000000_baseline_schema`

### Step 6: Update Migration History

The baseline migration includes this line, but verify it was recorded:

```sql
SELECT * FROM supabase_migrations.schema_migrations;
```

Should show:
```
version              | name
---------------------+------------------
20251106000000       | baseline_schema
```

If missing, manually insert:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, executed_at)
VALUES ('20251106000000', 'baseline_schema', NOW())
ON CONFLICT (version) DO NOTHING;
```

### Step 7: Enable Realtime (If Not Auto-Enabled)

The baseline migration includes realtime configuration, but verify:

```sql
-- Check realtime publications
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

**Should include these 5 tables:**
- songs
- bands
- setlists
- practice_sessions
- band_memberships

If missing, the baseline should have set this up, but you can verify in:
- Database > Replication (in Supabase Studio sidebar)

### Step 8: Test with Your Application

1. Open your deployed Rock-On app
2. Log in with test account
3. **Create a new song:**
   - Should sync to Supabase without 403 errors
   - Check browser console for errors
4. **Join a band via invite code:**
   - Should work without policy violations
5. **Check sync status:**
   - Should show "Connected" (once status validation is implemented)
   - Pending items should sync and reach 0

### Step 9: Monitor Logs

In Supabase Studio:
1. Go to Logs > Postgres Logs
2. Watch for any RLS policy violations or errors
3. Successful operations should show no errors

**Common success indicators:**
- ✅ No "policy violation" errors
- ✅ No "infinite recursion" errors
- ✅ INSERT/UPDATE/SELECT operations succeed
- ✅ Sync counter decrements to 0

## Troubleshooting

### Issue: "relation does not exist" errors

**Solution:** The reset script didn't fully clean up. Try:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

Then re-run the baseline migration.

### Issue: Migration shows as already applied

**Solution:** Clear migration history:
```sql
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20251106000000';
```

Then re-run the baseline migration.

### Issue: RLS policies not working

**Symptoms:**
- 403 Forbidden errors in app
- "policy violation" in logs

**Solution:**
1. Verify RLS is enabled on tables:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
   All tables should show `rowsecurity = true`

2. Check policies exist:
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, cmd;
   ```

### Issue: Triggers not firing

**Solution:** Verify trigger ownership:
```sql
SELECT n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f';
```

All functions should be owned by `postgres` (not `anon` or `authenticated`).

## What This Deployment Includes

✅ **Complete schema:** All 11 tables with proper column types
✅ **Version tracking:** `version` and `last_modified_by` on all tables
✅ **Audit logging:** Complete change history system
✅ **RLS policies:** Row-level security for multi-user isolation
✅ **Realtime sync:** 5 tables configured for real-time updates
✅ **Helper functions:** `user_belongs_to_band()`, `increment_invite_code_usage()`
✅ **Triggers:** Auto-update timestamps, versions, audit logs
✅ **Indexes:** Performance optimization for common queries
✅ **Constraints:** Data integrity (foreign keys, check constraints)

## Files Used

1. **Reset script:** `supabase/reset-remote-database.sql`
2. **Baseline migration:** `supabase/migrations/20251106000000_baseline_schema.sql`
3. **Test suite:** `supabase/tests/*.test.sql` (for local validation)

## Post-Deployment Checklist

- [ ] All verification queries show expected counts
- [ ] No errors in Supabase Postgres logs
- [ ] Application can create songs/bands
- [ ] Invite codes work correctly
- [ ] Realtime sync is working
- [ ] No 403 errors in browser console
- [ ] Migration history shows baseline entry

## Next Steps After Successful Deployment

1. **Test thoroughly** with your deployed app
2. **Monitor logs** for 24-48 hours
3. **Commit the deployment** to git (already done on `backup/pre-sql-cleanup` branch)
4. **Merge to main** after validation
5. **Update CLAUDE.md** if deployment process changes

## Notes

- **Why manual deployment?** Supabase CLI authentication fails in devcontainer
- **Is this safe?** Yes - extensively tested locally (337/337 tests passing)
- **Can we use CLI later?** Yes - once auth issues are resolved
- **Will this affect local dev?** No - local Supabase is independent

---

**Status:** Ready to deploy
**Risk Level:** Low (thoroughly tested locally)
**Estimated Time:** 10-15 minutes
