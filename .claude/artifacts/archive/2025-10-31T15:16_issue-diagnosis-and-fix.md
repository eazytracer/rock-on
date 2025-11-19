---
title: Issue Diagnosis and Fix Report
created: 2025-10-31T15:16
type: Diagnostic Report
status: In Progress
---

# Issue Diagnosis and Fix Report

## Issues Reported

1. **Duplicate Band Members**: User seeing two copies of whichever user logged in
2. **React Key Warning**: Same UUID used twice (`6ee2bc47-0014-4cdc-b063-68646bb5d3ba`)
3. **Real-time Sync Errors**: "mismatch between server and client bindings for postgres changes"
4. **Missing Other Users**: User not seeing other mock users in the band

## Root Cause Analysis

### Issue 1 & 2: Duplicate Band Members

**Suspected Cause**: The consolidation plan was created but NOT fully executed. The system may have:
- IndexedDB populated with old seed data (from before consolidation)
- Supabase data from SQL seeding
- When user logs in, both datasets are being mixed/merged incorrectly

**Evidence**:
- `main.tsx` was already updated to remove `seedMvpData()` call ✓
- But if browser IndexedDB wasn't cleared, old data may persist
- Console shows: "Synced 1 bands and 1 memberships" - suggesting sync is working
- React key warning with user ID suggests the same membership record exists twice in the rendered list

**Actual Problem**: The duplicate is happening in the **UI rendering**, not in the database. Looking at `BandMembersPage.tsx:96`, it calls `useBandMembers(currentBandId)` which returns members. The hook listens to `repo.on('changed', fetchMembers)` events. If the event emitter is triggering multiple times or if React is re-rendering with stale state, we could get duplicates.

### Issue 3: Real-time Sync Binding Mismatch

**Error**: `mismatch between server and client bindings for postgres changes`

**Cause**: This error occurs when Supabase Realtime tries to subscribe to a table, but the columns requested by the client don't match what's available in the database. This could be:

1. **Migration Not Applied**: The realtime migrations may not have been run properly
2. **Table Schema Mismatch**: The client code expects certain columns that don't exist
3. **Replica Identity Issue**: PostgreSQL needs REPLICA IDENTITY FULL for realtime to work with all columns

**Evidence From Code**:
- `RealtimeManager.ts` subscribes with `event: '*'` and `filter: '${filterField}=eq.${bandId}'`
- The subscription doesn't specify which columns to watch
- Error occurs for ALL tables: songs, setlists, shows, practice_sessions

**Likely Fix**: Need to ensure:
1. Database has been reset with `supabase db reset` to apply all migrations
2. REPLICA IDENTITY is set correctly (we have migration `20251030000002_enable_realtime_replica_identity.sql`)

### Issue 4: Missing Other Users

**Cause**: Related to Issue 1 - if there's data inconsistency, the user might only see their own band membership.

**Need to Check**:
1. Does Supabase actually have all 3 users in `band_memberships` table?
2. Is the sync downloading all memberships correctly?

## Investigation Steps

### Step 1: Check Supabase Database

```bash
# Query band_memberships table
curl -s 'http://localhost:54321/rest/v1/band_memberships?select=*' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  | jq '.[] | {user_id, band_id, role}'
```

### Step 2: Check Replica Identity

```bash
# Check if replica identity is set
docker exec supabase_db_rock-on psql -U postgres -d postgres -c \
  "SELECT schemaname, tablename, relreplident \
   FROM pg_class c \
   JOIN pg_namespace n ON n.oid = c.relnamespace \
   JOIN pg_tables t ON t.tablename = c.relname AND t.schemaname = n.nspname \
   WHERE n.nspname = 'public' AND t.tablename IN ('songs', 'setlists', 'shows', 'practice_sessions');"
```

### Step 3: Clear Browser State

User needs to:
```javascript
// In browser console
await indexedDB.deleteDatabase('RockOnDB')
localStorage.clear()
location.reload()
```

## Fix Plan

### Fix 1: Database Reset (CRITICAL)

Reset the database to ensure all migrations are applied:

```bash
cd /workspaces/rock-on
supabase db reset
```

This will:
- Drop and recreate the database
- Run all migrations (including realtime setup)
- Seed test data from `supabase/seed-mvp-data.sql`

### Fix 2: Check Realtime Configuration

After reset, verify realtime is enabled:

```sql
-- Check publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check replica identity
SELECT schemaname, tablename,
       CASE relreplident
         WHEN 'd' THEN 'default'
         WHEN 'n' THEN 'nothing'
         WHEN 'f' THEN 'full'
         WHEN 'i' THEN 'index'
       END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_tables t ON t.tablename = c.relname AND t.schemaname = n.nspname
WHERE n.nspname = 'public'
  AND t.tablename IN ('songs', 'setlists', 'shows', 'practice_sessions');
```

Expected output: All tables should have `replica_identity = 'full'`

### Fix 3: User Instructions for Testing

After database reset, user must:

1. **Clear browser data**:
   ```javascript
   // Browser console
   await indexedDB.deleteDatabase('RockOnDB')
   localStorage.clear()
   location.reload()
   ```

2. **Login as Eric**:
   - Click "Show Mock Users for Testing"
   - Click "Eric (Guitar, Vocals)"
   - Wait for sync to complete

3. **Verify**:
   - Check Band Members page - should see 3 members: Eric, Mike, Sarah
   - NO duplicates
   - NO React key warnings

### Fix 4: Code Review (If Issues Persist)

If duplicates still occur after database reset, investigate:

1. **React Strict Mode**: `main.tsx` uses `<React.StrictMode>` which causes double-renders in development. This is intentional and shouldn't cause actual bugs, but could make duplicate effects more visible.

2. **Event Emitter**: Check if `RealtimeManager` or `SyncRepository` events are being subscribed multiple times without cleanup.

3. **Hook Cleanup**: Verify `useBandMembers` properly cleans up event listeners in its `useEffect` return function.

## Expected Resolution Timeline

1. **Database Reset**: 2 minutes
2. **Verification**: 5 minutes
3. **User Testing**: 5 minutes
4. **Total**: ~12 minutes

## Success Criteria

✅ **Fixed when**:
1. User can see all 3 band members (Eric, Mike, Sarah)
2. No duplicate members in the list
3. No React key warnings in console
4. Real-time sync connects without errors
5. Changes made by one user appear for other users

## Notes

- The seed data consolidation plan was good but requires a full database reset to take effect
- Browser IndexedDB must be cleared to remove any old data
- Real-time sync requires proper PostgreSQL replica identity configuration
- All migrations must be applied in order

## Next Steps

1. Execute `supabase db reset`
2. Guide user to clear browser data
3. Test with all 3 mock users
4. Verify real-time sync works between users
