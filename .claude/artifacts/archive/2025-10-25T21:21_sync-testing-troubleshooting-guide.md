---
timestamp: 2025-10-25T21:21
prompt: Create comprehensive testing guide for validating Supabase sync functionality and troubleshooting sync issues
status: Phase 1 Complete - Sync Infrastructure Testing
---

# Supabase Sync Testing & Troubleshooting Guide

## Overview

This guide provides step-by-step instructions for testing the local-first sync system with Supabase and troubleshooting common issues. The app uses a **local-first architecture** where:

- All reads come from local IndexedDB (instant, offline-capable)
- All writes go to local first (optimistic updates)
- Changes are queued and synced to Supabase in the background
- Periodic sync pulls remote changes back to local

## Prerequisites

Before testing sync, ensure:

1. **Supabase project is configured** with all tables and RLS policies
2. **Environment variables** are set correctly (`.env.production` or `.env.local`)
3. **User is authenticated** (sync only works for logged-in users)
4. **App is running** in production mode (`VITE_MOCK_AUTH=false`)

## Quick Diagnostic Tools

The app includes built-in debugging utilities accessible from the browser console:

### `debugSync()` - Inspect Sync Status

Run this in the browser console to get a comprehensive view of the sync system:

```javascript
debugSync()
```

**What it shows:**
- Configuration (mode, Supabase URL, auth status)
- Sync queue items (pending, syncing, failed)
- Last sync timestamps for each table
- Local data counts
- Network status

**Example Output:**
```
🔍 Sync Debug Information
========================

📋 Configuration:
  Mode: production
  Is Production: true
  Enable Supabase Auth: true
  Supabase URL: https://khzeuxxhigqcmrytsfux.supabase.co

📦 Sync Queue:
  Total items: 3
  Pending: 2
  Syncing: 0
  Failed: 1

  Queue items:
    1. create songs - Status: pending
    2. create bands - Status: pending
    3. create users - Status: failed
       Error: RLS policy violation

⏰ Last Sync:
  songs: 2025-10-25 21:15:32
  bands: Never
  users: 2025-10-25 21:10:45

💾 Local Data:
  Songs: 5
  Bands: 2
  Users: 1

🌐 Network:
  Online: true
```

### `testSupabaseConnection()` - Validate Connection

Run this to test Supabase connectivity and RLS policies:

```javascript
testSupabaseConnection()
```

**What it tests:**
- Supabase client initialization
- Auth session status
- Database read access
- RLS policy enforcement

## Step-by-Step Testing Procedure

### 1. Initial Setup Verification

**Goal:** Confirm app is in production mode and connected to Supabase

1. Open browser console
2. Check for these log messages on app load:
   ```
   ☁️  Using SupabaseAuthService
   📦 Production mode - skipping database seeding
   ```
3. Run `testSupabaseConnection()`
4. Verify you see: `✅ Supabase client initialized`

**What success looks like:**
- No "Using MockAuthService" message
- testSupabaseConnection() shows Supabase URL
- No connection errors

**If this fails:**
- Check `.env.production` or `.env.local` has correct values
- Verify `VITE_MOCK_AUTH=false`
- Restart dev server after changing env vars

### 2. Authentication Test

**Goal:** Sign in and verify user is synced to local DB and Supabase

1. Navigate to `/auth` or `/get-started`
2. Sign up with a new email/password OR sign in with Google
3. After redirect, run `testSupabaseConnection()` again
4. Verify you see:
   ```
   ✅ Active session found
   👤 User: your-email@example.com
   ```
5. Run `debugSync()` and check:
   - Users count should be 1
   - Last sync time for users should be recent

**What success looks like:**
- User email shown in test output
- User appears in local IndexedDB
- No auth errors in console

**If this fails:**
- Check Supabase dashboard → Authentication → Users
- Verify email confirmation is disabled for testing
- Check for RLS policy errors in console
- Try signing out and in again

### 3. Visual Sync Indicators

**Goal:** Confirm UI shows sync status correctly

**Where to look:**
- **Bottom-right corner**: Animated sync status indicator
  - Green checkmark: Synced
  - Blue spinning: Syncing
  - Yellow warning: Pending items
  - Red X: Sync errors
- **Top banner**: Offline indicator (only shows when offline)

**Test online/offline:**
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Verify offline banner appears at top
4. Uncheck "Offline"
5. Verify banner disappears

**What success looks like:**
- Sync indicator visible and responding to state changes
- Offline banner toggles correctly
- No console errors about missing components

**If this fails:**
- Check `ModernLayout.tsx` has `<SyncStatusIndicator />` and `<OfflineIndicator />`
- Verify imports are correct
- Check React DevTools for component hierarchy

### 4. Create Data and Monitor Sync

**Goal:** Verify data flows from local → queue → Supabase

**Test creating a song:**

1. Navigate to `/songs`
2. Open console and run `debugSync()` - note current queue size
3. Click "Add Song" and create a new song
4. Immediately run `debugSync()` again
5. Check sync queue - should see new `create songs` item with `pending` status
6. Wait 30 seconds (periodic sync interval)
7. Run `debugSync()` again - queue item should be gone or marked `synced`
8. Check Supabase dashboard → Table Editor → songs
9. Verify song appears with matching ID

**What success looks like:**
```
📦 Sync Queue (before):
  Total items: 0

📦 Sync Queue (after create):
  Total items: 1
  Pending: 1
  Queue items:
    1. create songs - Status: pending

📦 Sync Queue (after sync):
  Total items: 0
  ✅ Queue is empty

💾 Local Data:
  Songs: 1
```

**Test updating a song:**

1. Edit the song you just created
2. Run `debugSync()` - should see `update songs` in queue
3. Wait for sync
4. Verify update appears in Supabase

**Test deleting a song:**

1. Delete the song
2. Run `debugSync()` - should see `delete songs` in queue
3. Wait for sync
4. Verify song removed from Supabase

**If this fails - see Troubleshooting section below**

### 5. Test Two-Way Sync

**Goal:** Verify changes in Supabase appear locally

**Manual Supabase edit:**

1. Go to Supabase dashboard → Table Editor → songs
2. Click "Insert row" and add a song manually
3. In app, run `debugSync()`
4. Check last sync time for songs
5. Wait 30 seconds or trigger manual sync
6. Refresh `/songs` page
7. Verify new song appears

**What success looks like:**
- Remote song appears in app within 30 seconds
- No duplicate entries
- All fields match

**If this fails:**
- Check SyncEngine is running periodic sync
- Verify RemoteRepository.getAll() works
- Check console for sync errors
- Verify RLS policies allow reads

### 6. Offline Functionality Test

**Goal:** Verify app works offline and queues sync

1. Create a song while online (verify it syncs)
2. Open DevTools → Network → Check "Offline"
3. Create another song
4. Run `debugSync()` - should see item in queue with `pending` status
5. Try to navigate around - app should still work
6. Uncheck "Offline"
7. Run `debugSync()` - queue should process automatically
8. Check Supabase - both songs should be there

**What success looks like:**
- Full app functionality while offline
- Sync queue holds operations
- Auto-sync when back online
- No data loss

**If this fails:**
- Check Service Worker registration
- Verify SyncEngine subscribes to online events
- Check for errors in SW console

## Troubleshooting Common Issues

### Issue: Data stays in sync queue indefinitely

**Symptoms:**
- `debugSync()` shows pending items that never clear
- Sync indicator stuck on "syncing" or "pending"

**Possible Causes:**

1. **RLS Policies Blocking Writes**
   - Check queue items for `lastError` field
   - Look for "RLS policy violation" or "permission denied"
   - **Fix:** Update RLS policies in Supabase to allow authenticated writes

2. **SyncEngine Not Running**
   - Check console for "SyncEngine initialized" message
   - Verify periodic sync is scheduled
   - **Fix:** Ensure SyncEngine starts on app init

3. **Network Errors**
   - Check browser Network tab for failed requests
   - Look for CORS errors or 500 responses
   - **Fix:** Check Supabase API status, verify URL/key

**Debug Steps:**
```javascript
// Check queue item details
debugSync()
// Look for "Error: ..." under queue items

// Check if SyncEngine is processing
// Should see console logs like:
// "🔄 Processing sync queue (3 items)"
// "✅ Synced create songs for ID xyz"
```

### Issue: RLS Policy Violations

**Symptoms:**
- Queue items show `lastError: "RLS policy violation"`
- Supabase logs show "permission denied for table"

**Root Cause:**
Row Level Security policies don't allow the authenticated user to insert/update/delete

**Fix:**

1. Go to Supabase dashboard → Authentication → Policies
2. For each table (songs, bands, setlists, etc.):
   ```sql
   -- Allow authenticated users to insert their own data
   CREATE POLICY "Users can insert own data"
   ON songs
   FOR INSERT
   TO authenticated
   WITH CHECK (user_id = auth.uid());

   -- Allow authenticated users to update their own data
   CREATE POLICY "Users can update own data"
   ON songs
   FOR UPDATE
   TO authenticated
   USING (user_id = auth.uid());

   -- Allow authenticated users to delete their own data
   CREATE POLICY "Users can delete own data"
   ON songs
   FOR DELETE
   TO authenticated
   USING (user_id = auth.uid());

   -- Allow authenticated users to read their own data
   CREATE POLICY "Users can read own data"
   ON songs
   FOR SELECT
   TO authenticated
   USING (user_id = auth.uid());
   ```

3. Test by running `debugSync()` and creating new data

### Issue: Data appears locally but not in Supabase

**Symptoms:**
- Song shows in app immediately
- `debugSync()` shows local data count increasing
- Supabase table stays empty
- No errors in sync queue

**Possible Causes:**

1. **Queue items being created but not processed**
   - Run `debugSync()` and check queue
   - If queue is empty but Supabase is empty, sync succeeded but RLS blocks read

2. **Wrong Supabase project**
   - Check `VITE_SUPABASE_URL` matches your dashboard URL
   - Verify you're looking at correct table in correct project

3. **User ID mismatch**
   - Local user_id might not match Supabase auth.uid()
   - Check user_id field in local data vs Supabase auth user

**Debug Steps:**
```javascript
// Check what's actually in IndexedDB
debugSync()
// Compare local Songs count to Supabase count

// Check Supabase directly
testSupabaseConnection()
// Should show database access results

// Manually query Supabase
// In browser console:
const { data } = await supabase.from('songs').select('*')
console.log('Supabase songs:', data)
```

### Issue: Sync indicator not visible

**Symptoms:**
- No sync status shown in bottom-right corner
- No offline banner at top

**Root Cause:**
Components not integrated into layout

**Fix:**
Verify `src/components/layout/ModernLayout.tsx` includes:
```tsx
import { SyncStatusIndicator, OfflineIndicator } from '../sync'

// In JSX:
<OfflineIndicator />
{/* ... other layout ... */}
<div className="fixed bottom-4 right-4 z-50">
  <SyncStatusIndicator />
</div>
```

### Issue: "Synced" status shows but data not in Supabase

**Symptoms:**
- Sync indicator shows green checkmark
- Queue is empty
- Local data exists
- Supabase table is empty

**Possible Causes:**

1. **Silent RLS failure**
   - RemoteRepository might swallow errors
   - Check browser console for suppressed errors

2. **Wrong table name**
   - Verify table names in Supabase match code
   - Check for typos (songs vs song, etc.)

**Debug Steps:**
1. Check RemoteRepository error handling
2. Add logging to RemoteRepository methods
3. Check Supabase logs for rejected requests

## Advanced Debugging

### Enable Verbose Logging

To see detailed sync logs, add this to your console:

```javascript
// Enable verbose sync logging
localStorage.setItem('debug', 'sync:*')
// Reload page
location.reload()
```

### Manually Trigger Sync

```javascript
// Import and run sync manually
import { syncEngine } from './services/data/SyncEngine'
await syncEngine.processQueue()
```

### Inspect IndexedDB Directly

1. Open DevTools → Application tab
2. Expand IndexedDB → rock-on-db
3. Click on tables: songs, syncQueue, syncMetadata
4. Verify data structure matches schema

### Check Supabase Logs

1. Go to Supabase dashboard → Logs
2. Select "Postgres Logs"
3. Look for errors during sync operations
4. Check for RLS policy violations

## Success Checklist

Before marking sync as "working", verify:

- [ ] `testSupabaseConnection()` shows active session
- [ ] `debugSync()` shows correct config and online status
- [ ] Sync status indicator visible in bottom-right
- [ ] Creating data shows in local immediately
- [ ] Created data appears in Supabase within 30 seconds
- [ ] `debugSync()` shows empty queue after sync
- [ ] Editing data syncs to Supabase
- [ ] Deleting data removes from Supabase
- [ ] Data created in Supabase appears in app within 30 seconds
- [ ] Offline mode works (data queued, syncs when online)
- [ ] No RLS policy errors in console or queue
- [ ] All tables (songs, bands, setlists, practices) sync correctly

## Next Steps After Successful Testing

Once local sync is working:

1. **Test Google OAuth** - Verify OAuth login works and syncs user
2. **Deploy to Vercel** - Test sync in production environment
3. **Add error handling** - Improve user messaging for sync failures
4. **Optimize sync frequency** - Adjust 30s interval based on usage
5. **Add manual sync button** - Let users trigger sync on demand
6. **Monitor sync performance** - Track queue size and sync duration

## Reference Files

Key files for sync system:

- `src/services/data/SyncRepository.ts` - Local-first sync orchestrator
- `src/services/data/SyncEngine.ts` - Background sync processor
- `src/services/data/RemoteRepository.ts` - Supabase data layer
- `src/services/data/LocalRepository.ts` - IndexedDB data layer
- `src/components/sync/SyncStatusIndicator.tsx` - Visual sync status
- `src/components/sync/OfflineIndicator.tsx` - Offline banner
- `src/hooks/useSyncStatus.ts` - Sync status hook
- `src/utils/debugSync.ts` - Debug utility
- `src/utils/testSupabaseConnection.ts` - Connection test utility

## Support

If issues persist after following this guide:

1. Run both `debugSync()` and `testSupabaseConnection()`
2. Capture full console output (including errors)
3. Check Supabase dashboard for RLS policy configuration
4. Review browser Network tab for failed requests
5. Check IndexedDB structure in DevTools

Document findings and consult implementation team for assistance.
