---
title: Supabase Realtime Configuration Guide
created: 2025-10-30T13:36
status: Configuration Required
priority: Critical (blocks Phase 4 two-device testing)
---

# Supabase Realtime Configuration Guide

## Problem

WebSocket subscriptions are failing with empty error objects:

```
Failed to subscribe to songs-<band-id>: {}
Failed to subscribe to setlists-<band-id>: {}
Failed to subscribe to shows-<band-id>: {}
Failed to subscribe to practice_sessions-<band-id>: {}
```

## Root Cause

Supabase Realtime is either:
1. Not enabled in the Supabase project
2. RLS policies are blocking real-time subscriptions
3. Tables are not configured for real-time broadcasts

---

## Step 1: Enable Realtime in Supabase Project

### Via Supabase Dashboard

1. **Log in to Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project

2. **Navigate to Database → Replication**
   - Click on "Database" in left sidebar
   - Click "Replication" tab

3. **Enable Realtime for Tables**
   - Find table: `songs`
   - Toggle "Enable Realtime" → ON
   - Repeat for: `setlists`, `shows`, `practice_sessions`

### Via SQL (Alternative)

```sql
-- Enable Realtime for all sync tables
ALTER PUBLICATION supabase_realtime ADD TABLE songs;
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
ALTER PUBLICATION supabase_realtime ADD TABLE shows;
ALTER PUBLICATION supabase_realtime ADD TABLE practice_sessions;
```

---

## Step 2: Verify RLS Policies Allow Subscriptions

Real-time subscriptions require `SELECT` permission via RLS.

### Check Existing Policies

```sql
-- Check songs policies
SELECT * FROM pg_policies WHERE tablename = 'songs';

-- Check setlists policies
SELECT * FROM pg_policies WHERE tablename = 'setlists';

-- Check shows policies
SELECT * FROM pg_policies WHERE tablename = 'shows';

-- Check practice_sessions policies
SELECT * FROM pg_policies WHERE tablename = 'practice_sessions';
```

### Ensure SELECT Policies Exist

For each table, there must be a policy allowing SELECT for band members:

```sql
-- Example for songs table
CREATE POLICY "Users can view songs in their bands"
ON songs
FOR SELECT
USING (
  context_type = 'band' AND
  context_id IN (
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
  OR
  context_type = 'personal' AND created_by = auth.uid()
);
```

**NOTE:** Policies may already exist from Phase 1. Verify they include `FOR SELECT`.

---

## Step 3: Test Realtime Connection

### Using Browser Console

1. **Open browser at http://localhost:5173**
2. **Log in as test user**
3. **Open DevTools console** (F12)
4. **Run test subscription:**

```javascript
// Get Supabase client from window (if exposed) or import
const { createClient } = supabase

// Create client (replace with your Supabase URL and anon key)
const supabaseClient = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
)

// Test subscription
const channel = supabaseClient
  .channel('test-songs')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'songs'
  }, (payload) => {
    console.log('✅ Received change:', payload)
  })
  .subscribe((status, err) => {
    if (err) {
      console.error('❌ Subscription error:', err)
    } else {
      console.log('📡 Subscription status:', status)
    }
  })
```

**Expected Output:**
```
📡 Subscription status: SUBSCRIBED
```

**If Error:**
```
❌ Subscription error: { ... details ... }
```

---

## Step 4: Verify Realtime Is Enabled (Project Settings)

1. **Go to Project Settings**
   - Click gear icon in left sidebar
   - Navigate to "API" section

2. **Check Realtime Configuration**
   - Look for "Realtime" section
   - Verify: "Enable Realtime" is toggled ON
   - Verify: "Enable Postgres Changes" is toggled ON

3. **Check Connection Limits**
   - Free tier: 200 concurrent connections
   - Pro tier: 500+ concurrent connections
   - Verify you haven't hit the limit

---

## Step 5: Debug Subscription Code

### Check RealtimeManager Subscription

**File:** `src/services/data/RealtimeManager.ts`
**Lines:** 89-123

**Current Code:**
```typescript
private async subscribeToTable(
  table: string,
  bandId: string,
  handler: (payload: RealtimePayload) => Promise<void>
): Promise<void> {
  try {
    const channelName = `${table}-${bandId}`
    const filterField = table === 'songs' ? 'context_id' : 'band_id'

    const channel = this.supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `${filterField}=eq.${bandId}`
      }, (payload: any) => {
        handler(payload as RealtimePayload).catch(error => {
          console.error(`Error handling ${table} change:`, error)
        })
      })
      .subscribe(async (status, err) => {
        if (err) {
          console.error(`Failed to subscribe to ${channelName}:`, err)
          this.connected = false
        }
      })

    this.channels.set(channelName, channel)
  } catch (error) {
    console.error(`Error subscribing to ${table} for band ${bandId}:`, error)
  }
}
```

**Potential Issues:**
1. **Empty error object:** Supabase client not returning detailed errors
2. **Filter syntax:** Verify `filter` parameter format is correct
3. **Authentication:** Verify user is authenticated when subscribing

### Add More Detailed Logging

**Temporary Debug Code:**
```typescript
.subscribe(async (status, err) => {
  console.log(`📡 [${channelName}] Status: ${status}`)

  if (err) {
    console.error(`❌ [${channelName}] Error:`, {
      error: err,
      message: err.message,
      code: err.code,
      details: err.details
    })
    this.connected = false
  } else if (status === 'SUBSCRIBED') {
    console.log(`✅ [${channelName}] Successfully subscribed!`)
  } else if (status === 'CHANNEL_ERROR') {
    console.error(`❌ [${channelName}] Channel error (check Realtime enabled)`)
  } else if (status === 'TIMED_OUT') {
    console.error(`❌ [${channelName}] Subscription timed out`)
  }
})
```

---

## Step 6: Verify Authentication

Realtime subscriptions require an authenticated user.

### Check Auth Token

```javascript
// In browser console
const session = await supabase.auth.getSession()
console.log('Session:', session)
console.log('Access Token:', session.data.session?.access_token)
```

**Should return:**
- Valid session object
- Access token (JWT)

**If null:**
- User is not authenticated
- Subscriptions will fail

---

## Step 7: Check Supabase Project Status

### Via Dashboard

1. **Go to Project Overview**
2. **Check "Status" indicator**
   - Should be: "Healthy" (green)
   - If "Paused" or "Inactive": Restart project

3. **Check Realtime Server Status**
   - Look for "Realtime" service
   - Should show: "Running"

---

## Step 8: Test with Minimal Example

### Create Test HTML File

**File:** `test-realtime.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Supabase Realtime Test</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <h1>Supabase Realtime Test</h1>
  <div id="status">Not connected</div>
  <div id="output"></div>

  <script>
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'

    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const statusEl = document.getElementById('status')
    const outputEl = document.getElementById('output')

    // Test connection
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'songs'
      }, (payload) => {
        outputEl.innerHTML += `<p>✅ Change received: ${JSON.stringify(payload)}</p>`
      })
      .subscribe((status, err) => {
        if (err) {
          statusEl.innerHTML = `❌ Error: ${JSON.stringify(err)}`
        } else {
          statusEl.innerHTML = `📡 Status: ${status}`
        }
      })
  </script>
</body>
</html>
```

**Test:**
1. Replace URL and API key
2. Open in browser
3. Check status message
4. If "SUBSCRIBED" → Realtime is working!

---

## Common Issues & Solutions

### Issue 1: Empty Error Object

**Symptom:**
```
Failed to subscribe to songs-...: {}
```

**Cause:** Supabase client catching error but not exposing details
**Solution:**
- Add more verbose logging (Step 5)
- Check Supabase project status (Step 7)
- Verify Realtime is enabled (Step 1)

### Issue 2: "CHANNEL_ERROR" Status

**Symptom:**
```
📡 Status: CHANNEL_ERROR
```

**Cause:** Realtime not enabled for table
**Solution:**
- Enable Realtime via Dashboard (Step 1)
- Or use SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE songs;`

### Issue 3: "TIMED_OUT" Status

**Symptom:**
```
📡 Status: TIMED_OUT
```

**Cause:** Network issue or Supabase server slow
**Solution:**
- Check internet connection
- Check Supabase project status
- Try again (may be temporary)

### Issue 4: Subscription Silent Failure

**Symptom:** No error, no success log
**Cause:** Callback not being called
**Solution:**
- Verify `subscribe()` is actually being called
- Check async/await flow
- Add `console.log` before `.subscribe()`

---

## Validation Checklist

Before declaring Realtime working, verify:

- [ ] Realtime enabled for all 4 tables (songs, setlists, shows, practice_sessions)
- [ ] RLS policies allow SELECT for band members
- [ ] User is authenticated when subscribing
- [ ] Subscription status is "SUBSCRIBED" (not error)
- [ ] Test with minimal example (test-realtime.html)
- [ ] No console errors in browser
- [ ] Create a test song in Supabase → See WebSocket event in console

---

## Next Steps After Realtime Working

1. **Test Two-Device Sync**
   - Open app in Chrome
   - Open app in Firefox (or Chrome Incognito)
   - Create song on Device A
   - Verify appears on Device B within 1 second

2. **Measure Latency**
   - Record time when change made on Device A
   - Record time when change appears on Device B
   - Calculate: Latency = TimeB - TimeA
   - **Target:** < 1000ms

3. **Test All Operations**
   - Create
   - Update
   - Delete
   - Verify all work in real-time

---

## Resources

- **Supabase Realtime Docs:** https://supabase.com/docs/guides/realtime
- **Postgres Changes:** https://supabase.com/docs/guides/realtime/postgres-changes
- **RLS Policies:** https://supabase.com/docs/guides/auth/row-level-security
- **Troubleshooting:** https://supabase.com/docs/guides/realtime/troubleshooting

---

## File References

- `src/services/data/RealtimeManager.ts` - Subscription logic
- `src/contexts/AuthContext.tsx` - Where subscriptions are initiated
- `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md` - Specification

---

**Created:** 2025-10-30T13:36
**Status:** Configuration Guide
**Priority:** Critical - Blocks Phase 4 completion
**Next:** Enable Realtime in Supabase Dashboard
