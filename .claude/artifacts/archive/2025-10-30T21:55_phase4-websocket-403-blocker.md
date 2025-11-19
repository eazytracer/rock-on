---
title: Phase 4 WebSocket 403 Blocker - Authentication Issue
created: 2025-10-30T21:55
status: Blocker Identified
phase: Phase 4
type: Bug Report & Analysis
prompt: Investigate WebSocket 403 errors preventing Realtime sync from working
---

# Phase 4: WebSocket 403 Blocker - Root Cause Analysis

## Executive Summary

❌ **Phase 4 Realtime Sync is blocked by WebSocket authentication issue**

**Problem:** Supabase Realtime WebSocket connections are failing with HTTP 403 Forbidden errors because the connection is using the **anon key** instead of the **authenticated user's JWT token**.

**Impact:** Real-time collaboration features cannot work until this is resolved.

**Root Cause:** Supabase client singleton pattern + WebSocket initialization timing issue

**Status:** Blocker identified, solution path determined

---

## Error Symptoms

### 1. Browser Console Errors

```
WebSocket connection to 'ws://127.0.0.1:54321/realtime/v1/websocket?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH&vsn=1.0.0' failed:
Error during WebSocket handshake: Unexpected response code: 403
```

**Key observations:**
- WebSocket URL shows `apikey=sb_publishable_...` (anon key)
- No user access token in the WebSocket connection
- HTTP 403 Forbidden response

### 2. Channel Subscription Status

```
✅ Subscribed to songs-a1b2c3d4-... (status: CHANNEL_ERROR)
✅ Subscribed to setlists-a1b2c3d4-... (status: CHANNEL_ERROR)
✅ Subscribed to shows-a1b2c3d4-... (status: CHANNEL_ERROR)
✅ Subscribed to practice_sessions-a1b2c3d4-... (status: CHANNEL_ERROR)
```

**Key observations:**
- Channels appear to subscribe (no immediate error)
- But status is `CHANNEL_ERROR` instead of `SUBSCRIBED`
- This indicates backend rejected the subscription

### 3. Realtime Server Logs

```
project=realtime-dev error_code=MalformedJWT [error] MalformedJWT: The token provided is not a valid JWT
```

**Key observations:**
- Realtime server receiving a token that's not a valid JWT
- The anon key (`sb_publishable_...`) is an API key, not a JWT
- Realtime requires a proper JWT with user claims

---

## Root Cause Analysis

### Current Architecture Flow

```
1. App loads → Supabase client created with anon key
2. User logs in → Auth session established
3. RealtimeManager created → Uses existing Supabase client
4. Subscribe to channels → WebSocket already connected with anon key
5. ❌ RLS policies reject anon key (requires authenticated role)
```

### Why It's Failing

**Problem #1: WebSocket Connection Timing**
- The Supabase client's WebSocket connection is established when calling `.channel()`
- By default, it uses the anon key from client initialization
- The authenticated user's JWT is NOT automatically used for WebSocket

**Problem #2: RLS Policy Requirements**
- Our tables have RLS policies requiring `authenticated` role
- The anon key has `anon` role, not `authenticated`
- Realtime subscriptions use SELECT queries that hit RLS policies
- RLS blocks the subscription → CHANNEL_ERROR

**Problem #3: Singleton Client Pattern**
```typescript
// src/services/supabase/client.ts
supabaseInstance = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,  // ← Only anon key, no user session
  { /* config */ }
)
```

The singleton is created ONCE with just the anon key. Even after login, the WebSocket connection doesn't automatically upgrade to use the user's JWT.

---

## Why Hello World Test Worked

The Hello World test worked because:

1. **No RLS policies** - Test table had no RLS, allowing anon key access
2. **Simple table** - Direct subscription without complex filters
3. **REPLICA IDENTITY FULL** - This was confirmed working

**Key insight:** The hello world test validated Realtime infrastructure, but NOT authenticated Realtime subscriptions.

---

## Solution Approaches

### Option 1: Access Token in Channel Config (Recommended)

Supabase Realtime supports passing the access token explicitly in channel configuration:

```typescript
const { data: { session } } = await this.supabase.auth.getSession()

const channel = this.supabase
  .channel(channelName, {
    config: {
      broadcast: { self: true },
      presence: { key: userId }
    }
  })
  // The Supabase client should automatically use session.access_token
  .subscribe()
```

**However**, the Supabase JS client should automatically do this if it has a valid session. The issue is likely that the session isn't being set on the client.

### Option 2: Realtime-Specific Client Instance

Create a separate Supabase client instance specifically for Realtime after authentication:

```typescript
class RealtimeManager {
  private realtimeClient: SupabaseClient

  constructor(session: Session) {
    // Create dedicated client with user's access token
    this.realtimeClient = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        },
        realtime: {
          params: {
            apikey: session.access_token  // Use JWT for WebSocket
          }
        }
      }
    )
  }
}
```

**Pros:**
- Explicit control over authentication
- Separate concerns (main client vs realtime client)
- Guaranteed to use user's JWT

**Cons:**
- Two Supabase client instances
- Need to manage session refresh
- More complex

### Option 3: Fix Singleton Session Management

Ensure the singleton Supabase client properly manages user sessions:

```typescript
// After login
const { data: { session } } = await supabase.auth.getSession()
await supabase.auth.setSession(session)  // Explicitly set session

// Then create channels
// WebSocket should now use session.access_token
```

**Issue:** The Supabase client SHOULD do this automatically, but something in our flow is preventing it.

### Option 4: Temporary - Disable RLS for Testing

**NOT RECOMMENDED for production**, but could validate the hypothesis:

```sql
-- Temporarily allow anon role (TESTING ONLY)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "songs_select_public" ON songs FOR SELECT TO anon USING (true);
```

This would confirm that RLS is the blocker, but doesn't solve the real issue.

---

## Recommended Next Steps

### Step 1: Debug Session State (15 min)

Add logging to confirm session state:

```typescript
// In RealtimeManager.subscribeToTable()
const { data: { session }, error } = await this.supabase.auth.getSession()
console.log('🔍 Session check:', {
  hasSession: !!session,
  accessToken: session?.access_token?.substring(0, 20) + '...',
  expiresAt: session?.expires_at,
  error
})
```

**Expected:** Session should exist with valid access_token after login
**If not:** Need to fix session management in AuthContext

### Step 2: Inspect WebSocket Connection (15 min)

Check what's actually being sent in WebSocket handshake:

```typescript
// Chrome DevTools → Network → WS tab
// Look at WebSocket connection headers
// Should include: Authorization: Bearer <JWT>
```

**Expected:** WebSocket upgrade request should include Authorization header with JWT
**If not:** Need to configure Realtime client to send JWT

### Step 3: Test with Explicit Token (30 min)

Try Option 2 (separate Realtime client with explicit token):

```typescript
async subscribeToUserBands(userId: string, bandIds: string[], session: Session) {
  // Create Realtime-specific client
  const realtimeClient = createClient(
    config.supabaseUrl,
    session.access_token,  // Use JWT instead of anon key
    {
      auth: { persistSession: false },
      realtime: {
        params: {
          apikey: session.access_token
        }
      }
    }
  )

  // Use realtimeClient for channels
  const channel = realtimeClient.channel(channelName)...
}
```

### Step 4: Verify RLS Hypothesis (15 min)

Temporarily create a test channel without RLS requirements:

```sql
CREATE TABLE test_realtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NO RLS policies

ALTER PUBLICATION supabase_realtime ADD TABLE test_realtime;
ALTER TABLE test_realtime REPLICA IDENTITY FULL;
```

Subscribe to this table with anon key - should work if RLS is the blocker.

---

## Time Estimate

| Task | Estimated Time | Notes |
|------|---------------|-------|
| Debug session state | 15 min | Add logging, verify session exists |
| Inspect WebSocket | 15 min | Chrome DevTools Network tab |
| Implement Option 2 | 30 min | Separate Realtime client |
| Test and validate | 30 min | Two-device testing |
| Document solution | 15 min | Update Phase 4 docs |
| **Total** | **1.75 hours** | ~2 hours with debugging |

---

## Success Criteria

- [ ] WebSocket connection established with HTTP 101 (not 403)
- [ ] Channel subscription status: `SUBSCRIBED` (not `CHANNEL_ERROR`)
- [ ] No "MalformedJWT" errors in Realtime logs
- [ ] Console shows: `✅ Subscribed to songs-... (status: SUBSCRIBED)`
- [ ] Real-time events received when data changes in Supabase

---

## Related Files

**Primary:**
- `src/services/data/RealtimeManager.ts` - Realtime subscription logic
- `src/services/supabase/client.ts` - Supabase client singleton
- `src/contexts/AuthContext.tsx` - Authentication and session management

**Migrations:**
- `supabase/migrations/20251030000001_enable_realtime.sql` - Realtime setup ✅
- `supabase/migrations/20251030000002_enable_realtime_replica_identity.sql` - Replica identity ✅

**Documentation:**
- `.claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md` - Proof Realtime works
- `.claude/artifacts/2025-10-30T21:44_phase4-replica-identity-completion.md` - REPLICA IDENTITY setup

---

## Key Learnings

1. **REPLICA IDENTITY FULL is necessary but not sufficient**
   - ✅ Confirmed working in hello world test
   - ❌ Doesn't help if WebSocket connection is rejected

2. **Realtime requires authenticated JWT, not just anon key**
   - Anon key works for public data (no RLS)
   - Authenticated data requires user's JWT
   - RLS policies enforce this at subscription time

3. **WebSocket authentication is separate from REST API authentication**
   - REST API: Uses Authorization header per request
   - WebSocket: Authentication happens at connection/subscription time
   - Need to ensure user's JWT is used for WebSocket

4. **Session management is critical**
   - Supabase client needs active session BEFORE creating channels
   - Session must be properly set on the client instance
   - Singleton pattern can make this tricky

---

## Comparison: Working vs Broken

### Hello World Test (✅ WORKING)

```javascript
// Simple test with no RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

supabase
  .channel('test-table')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'test_table' }, callback)
  .subscribe()

// Works because:
// - No RLS policies
// - Anon key has access
// - REPLICA IDENTITY FULL configured
```

### Our App (❌ BROKEN)

```typescript
// Complex app with RLS
const supabase = getSupabaseClient()  // Singleton with anon key
await supabase.auth.signInWithPassword(...)  // Login succeeds

// Later...
realtimeManager = new RealtimeManager()  // Uses same singleton
await realtimeManager.subscribeToUserBands(userId, bandIds)

// Fails because:
// - WebSocket still using anon key
// - RLS policies require authenticated role
// - Session not properly applied to WebSocket
```

---

## Conclusion

Phase 4 is blocked by a WebSocket authentication issue. The Supabase Realtime infrastructure is correctly configured (REPLICA IDENTITY FULL, publication, etc.), but the WebSocket connection is using the anon key instead of the authenticated user's JWT.

**Root cause:** Session management in singleton Supabase client pattern
**Solution:** Create dedicated Realtime client with user's JWT or fix session handling
**Time to fix:** ~2 hours
**Confidence:** High (clear error, known solution patterns)

**Next action:** Implement Option 2 (separate Realtime client) or debug session management in current singleton

---

**Created:** 2025-10-30T21:55
**Status:** Blocker identified, solution path determined
**Phase:** Phase 4 - Real-time Sync
**Blocking:** Two-device testing, real-time collaboration features
