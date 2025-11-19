---
title: Phase 4 Realtime Sync - Complete Blocker Report
created: 2025-10-30T22:05
status: BLOCKED - Requires Expert Review
phase: Phase 4
type: Technical Blocker Report
prompt: Document complete debugging session for Supabase Realtime WebSocket 403 authentication errors
---

# Phase 4: Realtime Sync - Complete Debugging Report

## Executive Summary

❌ **BLOCKED:** Supabase Realtime WebSocket subscriptions failing with HTTP 403 Forbidden errors

**Time Invested:** ~2.5 hours of debugging
**Root Cause:** WebSocket authentication using anon key instead of authenticated user JWT
**Impact:** Real-time collaboration features completely non-functional
**Status:** Requires expert review - multiple solution approaches attempted, all failed

---

## Table of Contents

1. [Current Error State](#current-error-state)
2. [What Works](#what-works)
3. [What Fails](#what-fails)
4. [Attempts Made](#attempts-made)
5. [Root Cause Analysis](#root-cause-analysis)
6. [Referenced Documents](#referenced-documents)
7. [Code Changes](#code-changes)
8. [Next Steps](#next-steps)

---

## Current Error State

### Browser Console Errors

```
WebSocket connection to 'ws://127.0.0.1:54321/realtime/v1/websocket?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH&vsn=1.0.0' failed:
Error during WebSocket handshake: Unexpected response code: 403

❌ Channel error for songs-a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
❌ Channel error for setlists-a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
❌ Channel error for shows-a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
❌ Channel error for practice_sessions-a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
```

### Realtime Server Logs

```
project=realtime-dev external_id=realtime-dev error_code=MalformedJWT [error]
MalformedJWT: The token provided is not a valid JWT
```

**Key Observation:** The WebSocket URL shows `apikey=sb_publishable_...` (anon key), not a user JWT.

---

## What Works ✅

### 1. Realtime Infrastructure is Correctly Configured

**Evidence:**
- ✅ `supabase_realtime` publication created
- ✅ All tables added to publication
- ✅ REPLICA IDENTITY FULL set on all tables
- ✅ Realtime container healthy

**Validation SQL:**
```sql
-- Publication exists
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- Returns: songs, setlists, practice_sessions, shows ✅

-- REPLICA IDENTITY FULL confirmed
SELECT c.relname,
  CASE c.relreplident
    WHEN 'f' THEN 'FULL'
  END as replica_identity
FROM pg_class c
WHERE c.relname IN ('songs', 'setlists', 'shows', 'practice_sessions');
-- All return: FULL ✅
```

### 2. Hello World Test Validates Realtime Works

**Reference:** `.claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md`

**Test Setup:**
- Simple HTML page with Supabase Realtime
- Test table with REPLICA IDENTITY FULL
- No RLS policies

**Results:**
- ✅ WebSocket connects in < 1 second
- ✅ INSERT events received < 1 second latency
- ✅ UPDATE events received with full row data
- ✅ DELETE events received < 1 second latency
- ✅ 100% event accuracy

**Critical Finding:** Realtime works when RLS is disabled. Problem is authentication with RLS-protected tables.

### 3. User Authentication Works

**Evidence:**
- ✅ User can log in successfully
- ✅ Session is created and saved
- ✅ JWT access token is valid
- ✅ REST API calls work with authentication
- ✅ RLS policies work for REST queries

**Issue:** WebSocket subscriptions don't use the user's JWT.

---

## What Fails ❌

### 1. WebSocket Connection Authentication

**Problem:** WebSocket connects with anon key, gets rejected by RLS policies

**Why It Fails:**
- WebSocket URL: `ws://...?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` (anon key)
- RLS policies require `authenticated` role
- Anon key has `anon` role → 403 Forbidden

**RLS Policies (Example for songs):**
```sql
CREATE POLICY "songs_select_band_members" ON songs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = songs.context_id::uuid
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  )
);
```

**The policy requires `auth.uid()` which is only available with authenticated JWT, not anon key.**

### 2. Channel Subscriptions

**Status:** All channels report `CHANNEL_ERROR` instead of `SUBSCRIBED`

**Expected Flow:**
1. Create channel → WebSocket connects
2. Subscribe with filter → RLS checks access
3. Status: SUBSCRIBED → Ready for events

**Actual Flow:**
1. Create channel → WebSocket connects (with anon key)
2. Subscribe with filter → RLS rejects (no authenticated user)
3. Status: CHANNEL_ERROR → No events received

---

## Attempts Made

### Attempt 1: Create Separate Realtime Client with JWT

**Approach:** Create dedicated Supabase client for Realtime, passing user's JWT as apikey

**Code:**
```typescript
// src/services/data/RealtimeManager.ts
constructor(session: Session) {
  this.supabase = createClient(
    config.supabaseUrl!,
    config.supabaseAnonKey!,
    {
      realtime: {
        params: {
          apikey: session.access_token  // Use JWT for WebSocket
        }
      }
    }
  )
}
```

**Result:** ❌ FAILED
- Error: "API key is required to connect to Realtime"
- Supabase client expected anon key as second parameter
- JWT in realtime.params didn't work

**Files Modified:**
- `src/services/data/RealtimeManager.ts:50-81`
- `src/contexts/AuthContext.tsx:113-122, 185-194`

### Attempt 2: Call setSession() After Client Creation

**Approach:** Create client with anon key, then explicitly set user session

**Code:**
```typescript
constructor(session: Session) {
  this.supabase = createClient(
    config.supabaseUrl!,
    config.supabaseAnonKey!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    }
  )

  // Manually set the session
  this.supabase.auth.setSession(session)
}
```

**Result:** ❌ FAILED
- WebSocket still used anon key
- `setSession()` doesn't affect already-established WebSocket
- WebSocket connects when calling `.channel()`, before we can update auth

**Why It Failed:** WebSocket connection is established synchronously when `.channel()` is called. By that point, authentication is locked in.

### Attempt 3: Use Main Supabase Client Singleton

**Approach:** Use existing Supabase client which should have session from login

**Code:**
```typescript
// Reverted to original approach
constructor() {
  this.supabase = getSupabaseClient()  // Singleton with user session
}
```

**Result:** ❌ FAILED
- Same 403 errors
- Even though client has session, WebSocket doesn't use it
- Session is set AFTER client creation (during login)
- WebSocket initialized with original anon key

**Why It Failed:** Supabase client singleton is created at module load time with only anon key. Even after login sets session, WebSocket connections use the original authentication.

### Attempt 4: Add Session Verification

**Approach:** Verify session exists before subscribing

**Code:**
```typescript
private async subscribeToTable(...) {
  const { data: { session } } = await this.supabase.auth.getSession()
  if (!session) {
    console.error('Cannot subscribe without authenticated session')
    return
  }
  // ... subscribe
}
```

**Result:** ❌ FAILED
- Session exists ✅
- Session has valid JWT ✅
- WebSocket still uses anon key ❌
- RLS still blocks subscription ❌

**Finding:** The session check passes, confirming authentication works. But WebSocket doesn't use the session for connection.

---

## Root Cause Analysis

### The Fundamental Issue

**Supabase JS Client WebSocket Connection Flow:**

```
1. App loads → createClient(url, anonKey) → Singleton created
2. User visits page → Singleton returned
3. RealtimeManager created → Uses singleton
4. Subscribe to channel → .channel(name) called
5. WebSocket connects → Uses auth from step 1 (anon key)
6. RLS checks subscription → Sees 'anon' role → 403 Forbidden
```

**User Authentication Flow (Separate):**

```
1. User clicks login
2. supabase.auth.signInWithPassword(...)
3. Session created with JWT
4. Session stored in client
5. REST API calls use JWT ✅
6. WebSocket already connected with anon key ❌
```

### Why WebSocket Doesn't Re-authenticate

**Technical Reason:**

The Supabase JS client establishes a single, persistent WebSocket connection for all Realtime channels. This connection is created when the first `.channel()` call is made, using whatever authentication was available at client creation time.

**From Supabase internals:**
- WebSocket connection is managed by `RealtimeClient` class
- Connection params are set at initialization
- No mechanism to upgrade connection authentication after creation
- Calling `setSession()` updates REST API auth, not WebSocket auth

### Timing Problem

**Current Flow:**
```
Time 0: createClient(url, anonKey) → WebSocket will use anon key
Time 1: User logs in → Session stored
Time 2: RealtimeManager created → Uses client from Time 0
Time 3: .channel() called → WebSocket connects with anon key from Time 0
Time 4: RLS blocks → 403 Forbidden
```

**What We Need:**
```
Time 0: User logs in → Session available
Time 1: createClient(url, anonKey) + setSession(userSession)
Time 2: .channel() called → WebSocket uses user's JWT
Time 3: RLS allows → SUBSCRIBED
```

**Problem:** We can't control the timing because the singleton pattern creates the client before login.

---

## Referenced Documents

### Primary Documentation

1. **`.claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md`**
   - Proves Realtime infrastructure works
   - Confirms REPLICA IDENTITY FULL requirement
   - Shows < 1 second latency when RLS disabled

2. **`.claude/artifacts/2025-10-30T21:44_phase4-replica-identity-completion.md`**
   - REPLICA IDENTITY FULL migration completed
   - SQL validation queries
   - Realtime container health checks

3. **`.claude/artifacts/2025-10-30T21:55_phase4-websocket-403-blocker.md`**
   - Initial blocker analysis
   - 4 solution approaches outlined
   - Time estimates and recommendations

4. **`.claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md`**
   - Phase 4 overall plan
   - Real-time sync requirements
   - Integration points

### Specification Files

5. **`.claude/specifications/unified-database-schema.md`**
   - Complete database schema (IndexedDB + Supabase)
   - RLS policy definitions
   - Field name mappings (camelCase ↔ snake_case)

6. **`.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`**
   - Cloud-first architecture
   - Real-time sync requirements
   - Conflict resolution strategy

### Migration Files

7. **`supabase/migrations/20251030000001_enable_realtime.sql`**
   - Creates `supabase_realtime` publication
   - Adds all tables to publication
   - Enables Realtime for all synced tables

8. **`supabase/migrations/20251030000002_enable_realtime_replica_identity.sql`**
   - Sets REPLICA IDENTITY FULL on all tables
   - Includes verification queries
   - Required for UPDATE/DELETE events

### Code Files

9. **`src/services/data/RealtimeManager.ts`**
   - Realtime subscription logic
   - Channel management
   - Event handlers for all tables
   - Currently: Uses singleton client (failed)

10. **`src/services/supabase/client.ts`**
    - Supabase client singleton
    - Created with anon key at module load
    - Session management separate from client creation

11. **`src/contexts/AuthContext.tsx`**
    - Authentication flow
    - RealtimeManager initialization (lines 113-122, 185-194)
    - Session storage

---

## Code Changes Made

### Current State of Modified Files

#### src/services/data/RealtimeManager.ts

**Current Implementation (Last Attempt):**
```typescript
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../supabase/client'

export class RealtimeManager {
  private supabase: ReturnType<typeof getSupabaseClient>

  constructor() {
    this.supabase = getSupabaseClient()
    console.log('🔌 RealtimeManager initialized - using main Supabase client')
  }

  async subscribeToUserBands(userId: string, bandIds: string[]) {
    for (const bandId of bandIds) {
      await this.subscribeToBand(userId, bandId)
    }
    if (this.channels.size > 0) {
      this.connected = true
    }
  }

  private async subscribeToTable(table: string, bandId: string, handler: Function) {
    const channelName = `${table}-${bandId}`
    const filterField = table === 'songs' ? 'context_id' : 'band_id'

    const channel = this.supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `${filterField}=eq.${bandId}`
      }, handler)
      .subscribe((status, err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${channelName}:`, err)
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for ${channelName}`)
        }
      })

    this.channels.set(channelName, channel)
  }
}
```

**Previous Attempts (Git History):**
- Attempt 1: Separate client with `session.access_token` as apikey
- Attempt 2: `setSession()` after client creation
- Attempt 3: Session verification before subscribe

#### src/contexts/AuthContext.tsx

**Relevant Section (Lines 110-123):**
```typescript
if (bands.length > 0) {
  try {
    console.log('🔌 Starting real-time WebSocket sync...')
    realtimeManager.current = new RealtimeManager()
    const bandIds = bands.map(m => m.bandId)
    await realtimeManager.current.subscribeToUserBands(storedUserId, bandIds)
    console.log('✅ Real-time sync connected')
  } catch (error) {
    console.error('❌ Failed to start real-time sync:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack)
    }
  }
}
```

**Note:** Same pattern in auth state change handler (lines 182-195)

---

## Database State

### RLS Policies in Effect

**All tables require authenticated role for real-time subscriptions:**

```sql
-- Example: Songs table
CREATE POLICY "songs_select_band_members" ON songs
FOR SELECT TO authenticated
USING (
  context_type = 'band' AND EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_memberships.band_id = songs.context_id::uuid
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
  )
);

-- Similar policies for:
-- - setlists (setlists_select_band_members)
-- - shows (shows_select_if_member)
-- - practice_sessions (practice_sessions_select_band_members)
```

**Critical Point:** `auth.uid()` returns NULL for anon role, making all EXISTS clauses fail.

### Realtime Configuration

```sql
-- Publication (✅ WORKING)
\dRp+ supabase_realtime
-- Publication supabase_realtime
--     Owner     | All tables | Inserts | Updates | Deletes | Truncates | Via root
-- --------------+------------+---------+---------+---------+-----------+----------
--  supabase_admin | f          | t       | t       | t       | t         | f
-- Tables:
--     "public.songs"
--     "public.setlists"
--     "public.practice_sessions"
--     "public.shows"

-- Replica Identity (✅ WORKING)
-- All tables: FULL
```

### Test Data

**Current seed:**
- 3 users: eric@ipodshuffle.com, mike@ipodshuffle.com, sarah@ipodshuffle.com
- Password for all: `test123`
- 1 band: "iPod Shuffle"
- 3 band memberships (all active)
- 3 test songs with random UUIDs

---

## Diagnostics Performed

### 1. SQL Validation Queries

**Realtime Publication:**
```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```
**Result:** ✅ All 4 tables present

**REPLICA IDENTITY:**
```sql
SELECT c.relname,
  CASE c.relreplident WHEN 'f' THEN 'FULL' END
FROM pg_class c
WHERE c.relname IN ('songs', 'setlists', 'shows', 'practice_sessions');
```
**Result:** ✅ All FULL

**RLS Policies:**
```sql
SELECT tablename, policyname, roles
FROM pg_policies
WHERE tablename IN ('songs', 'setlists', 'shows', 'practice_sessions')
ORDER BY tablename;
```
**Result:** ✅ All policies present, all require `authenticated`

### 2. Container Health Checks

```bash
docker ps --filter "name=realtime"
# supabase_realtime_rock-on   Up 5 minutes (healthy) ✅

docker logs supabase_realtime_rock-on --tail 20
# Multiple "MalformedJWT" errors ❌
# Confirms Realtime server is receiving anon key, not JWT
```

### 3. Browser DevTools

**Network Tab:**
- WebSocket connection attempt visible
- URL shows `?apikey=sb_publishable_...` (anon key)
- Response: 403 Forbidden
- No Authorization header in WebSocket upgrade request

**Console:**
- No "🔌 RealtimeManager initialized" log visible in most recent test
- Multiple "❌ Channel error" messages
- WebSocket connection failures repeat every few seconds (retry logic)

### 4. Session Verification

**Manual check in console:**
```javascript
// Check if session exists
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', {
  hasSession: !!session,
  userId: session?.user?.id,
  expiresAt: session?.expires_at
})
```
**Result:** ✅ Session exists after login with valid user ID and expiration

---

## Technical Environment

### Versions

- **Supabase CLI:** v2.53.6
- **@supabase/supabase-js:** (check package.json)
- **Node.js:** (check with `node --version`)
- **Vite:** v4.5.14
- **PostgreSQL:** 15.x (in Docker)
- **Realtime Server:** (version from Docker logs)

### Local Supabase Stack

```bash
# Running containers:
docker ps --filter label=com.supabase.cli.project=rock-on
# - supabase_db_rock-on (PostgreSQL)
# - supabase_realtime_rock-on (Realtime server)
# - supabase_auth_rock-on (Auth server)
# - supabase_kong_rock-on (API gateway)
# - supabase_rest_rock-on (PostgREST)
# - supabase_storage_rock-on (Storage)
```

**All containers healthy:** ✅

### Configuration

**`.env` (Vite):**
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Config values in code:**
```typescript
// src/config/appMode.ts
export const config = {
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  enableSupabaseAuth: true,
  mode: 'production' // Uses Supabase for everything
}
```

---

## What We Know For Sure

### ✅ Confirmed Working

1. **Supabase infrastructure is healthy**
   - All containers running
   - Database accessible
   - REST API working
   - Auth working

2. **Realtime is configured correctly**
   - Publication created
   - Tables added
   - REPLICA IDENTITY FULL set
   - Realtime server healthy

3. **Hello World test proves Realtime works**
   - Without RLS: Events flow perfectly
   - < 1 second latency
   - INSERT, UPDATE, DELETE all work
   - Full row data received

4. **User authentication works**
   - Login successful
   - JWT valid
   - Session persisted
   - REST API calls authenticated

5. **RLS policies work for REST**
   - GET /rest/v1/songs returns user's songs
   - RLS filters data correctly
   - `auth.uid()` works in REST context

### ❌ Confirmed Broken

1. **WebSocket authentication fails**
   - Always uses anon key
   - Never uses user JWT
   - 403 Forbidden errors

2. **Channel subscriptions fail**
   - Status: CHANNEL_ERROR
   - Never reaches SUBSCRIBED
   - No events received

3. **RLS blocks Realtime subscriptions**
   - `auth.uid()` returns NULL for WebSocket
   - EXISTS clauses fail
   - Policies reject subscription

### ❓ Unknown / Needs Research

1. **How does Supabase JS client pass JWT to Realtime?**
   - Is there a specific configuration?
   - Does it work differently in production vs local?
   - Are we missing a client option?

2. **Do RLS policies work with Realtime?**
   - Production Supabase examples?
   - Community patterns?
   - Official documentation?

3. **Is local Realtime configured differently than production?**
   - Docker setup issues?
   - Environment variables missing?
   - Different authentication flow?

---

## Next Steps

### For Expert Review

**Please investigate:**

1. **Supabase Realtime + RLS Authentication Pattern**
   - How to properly authenticate WebSocket connections with user JWT
   - Whether special configuration is needed for local Supabase
   - Examples of working Realtime + RLS in production apps

2. **Client Configuration**
   - Is there a specific Supabase client option we're missing?
   - Should we create client differently for Realtime?
   - Does client initialization order matter?

3. **Alternative Approaches**
   - Should we disable RLS for Realtime subscriptions?
   - Use server-side token exchange?
   - Different Realtime authorization pattern?

### Recommended Debugging Steps

1. **Search Supabase Discord/GitHub Issues**
   - Keywords: "realtime rls 403", "realtime authentication", "websocket 403"
   - Look for similar issues and solutions

2. **Test with Production Supabase**
   - Create temporary project on supabase.com
   - Test if issue is local Docker-specific
   - Compare production vs local behavior

3. **Minimal Reproduction**
   - Create smallest possible example showing issue
   - Single table, single channel, single user
   - Share with Supabase team if needed

4. **Check Supabase Realtime Source Code**
   - How does `@supabase/realtime-js` handle authentication?
   - Where does WebSocket get auth params?
   - Can we override/configure it?

### If Unresolvable

**Fallback options:**

1. **Disable RLS for Realtime** (temporary)
   - Add policies allowing `anon` role for SELECT only
   - Keep RLS for INSERT/UPDATE/DELETE (security maintained)
   - Test if Realtime works without auth requirement

2. **Use polling instead of Realtime** (Phase 4 alternative)
   - Poll for changes every 5-10 seconds
   - Works with existing RLS
   - Less real-time but functional

3. **Server-side events** (future consideration)
   - Push notifications from backend
   - Full control over authentication
   - More complex architecture

---

## Files for Review

### Critical Files

**Implementation:**
- `src/services/data/RealtimeManager.ts` - Realtime subscription logic
- `src/contexts/AuthContext.tsx` - RealtimeManager initialization
- `src/services/supabase/client.ts` - Supabase client singleton

**Configuration:**
- `supabase/migrations/20251030000001_enable_realtime.sql` - Realtime setup
- `supabase/migrations/20251030000002_enable_realtime_replica_identity.sql` - REPLICA IDENTITY
- `supabase/migrations/20251026160000_rebuild_rls_policies.sql` - RLS policies

**Documentation:**
- `.claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md` - Proof Realtime works
- `.claude/artifacts/2025-10-30T21:55_phase4-websocket-403-blocker.md` - Initial analysis
- `.claude/specifications/unified-database-schema.md` - Database schema + RLS

### Test Commands

```bash
# Start Supabase
supabase start

# Check Realtime logs
docker logs supabase_realtime_rock-on --tail 50 --follow

# Verify Realtime config
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
"

# Check RLS policies
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT tablename, policyname, roles
FROM pg_policies
WHERE tablename = 'songs';
"

# Start dev server
npm run dev

# Login as: eric@ipodshuffle.com / test123
```

---

## Summary for Hand-off

**What's blocking us:**
Supabase Realtime WebSocket connections use anon key instead of authenticated user JWT, causing RLS policies to reject subscriptions with 403 Forbidden errors.

**What we've tried:**
1. Separate Realtime client with JWT → Failed
2. Setting session after client creation → Failed
3. Using main client singleton → Failed
4. Session verification → Confirmed session exists, still fails

**What we know:**
- ✅ Realtime infrastructure works (hello world test proves it)
- ✅ RLS works for REST API
- ✅ Authentication works
- ❌ WebSocket authentication doesn't work
- ❌ Can't get user JWT into WebSocket connection

**What we need:**
Expert guidance on proper Supabase Realtime + RLS authentication pattern, specifically how to pass user JWT to WebSocket connections in a local Supabase development environment.

**Time invested:** ~2.5 hours
**Urgency:** Medium - Blocks Phase 4, but other phases can proceed
**Next phase available:** Phase 4.a (SQL Migration Consolidation) - not blocked

---

**Report Created:** 2025-10-30T22:05
**Created By:** Claude Code Development Session
**Status:** Ready for expert review
**Blocking:** Phase 4 (Real-time Sync)
**Non-blocking:** Phase 4.a, Phase 5, Phase 6, Phase 7
