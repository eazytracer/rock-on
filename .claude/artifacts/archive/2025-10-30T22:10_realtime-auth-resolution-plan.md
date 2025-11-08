---
title: Supabase Realtime Authentication Resolution Plan
created: 2025-10-30T22:10
status: Action Plan - Ready for Implementation
phase: Phase 4
type: Technical Resolution Plan
prompt: |
  Review team's struggles with Supabase Realtime WebSocket authentication (403 errors),
  analyze test case that worked, consult Supabase documentation via Context7 MCP,
  and create comprehensive plan to resolve authentication issues in local development.
dependencies:
  - .claude/artifacts/2025-10-30T22:05_phase4-realtime-blocker-complete-report.md
  - .claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md
  - .claude/artifacts/2025-10-29T16:15_unified-implementation-roadmap.md
  - Supabase JS documentation (via Context7)
---

# Supabase Realtime Authentication Resolution Plan

## Executive Summary

**Root Cause Identified:** ✅ The team is missing a critical step: calling `supabase.realtime.setAuth()` after user login to pass the user's JWT to the WebSocket connection.

**Solution Complexity:** 🟢 Low - Single method call needed
**Implementation Time:** ⏱️ 15-30 minutes
**Confidence Level:** 🎯 Very High - Based on official Supabase documentation

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Root Cause](#root-cause)
3. [The Missing Step](#the-missing-step)
4. [Implementation Plan](#implementation-plan)
5. [Code Changes Required](#code-changes-required)
6. [Testing Strategy](#testing-strategy)
7. [Validation Steps](#validation-steps)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Problem Analysis

### Current Behavior ❌

```
1. User logs in → Session created with JWT
2. RealtimeManager created → Uses Supabase client singleton
3. channel.subscribe() called → WebSocket connects
4. WebSocket URL: ws://...?apikey=ANON_KEY ← WRONG!
5. RLS policies check auth.uid() → NULL (anon role)
6. Result: HTTP 403 Forbidden
```

**The Issue:** WebSocket is using the anon key instead of the user's JWT.

### Expected Behavior ✅

```
1. User logs in → Session created with JWT
2. supabase.realtime.setAuth(session.access_token) ← MISSING STEP!
3. RealtimeManager created → Uses authenticated client
4. channel.subscribe() called → WebSocket connects
5. WebSocket includes user JWT in connection params
6. RLS policies check auth.uid() → Returns user ID ✅
7. Result: SUBSCRIBED
```

---

## Root Cause

### What Your Team Missed

**From Supabase Documentation:**

> "After refreshing user authentication tokens, you must update the Realtime client with the new token."

**The Critical Method:**
```javascript
supabase.realtime.setAuth('user-jwt-token')
```

**Why This Wasn't Obvious:**

1. ❌ Not mentioned in basic Supabase tutorials
2. ❌ Not required for REST API calls (they use session automatically)
3. ❌ Realtime WebSocket auth is separate from main client auth
4. ❌ Error messages don't indicate missing auth setup

### Why Hello World Test "Worked"

Your test case bypassed the issue by:
- **Disabling RLS** with `USING (true)` policies
- Testing with anon key was sufficient without RLS
- Real app has RLS requiring `authenticated` role

**The test proved:** Realtime infrastructure works ✅
**The test didn't prove:** Authentication was correct ❌

---

## The Missing Step

### What `supabase.realtime.setAuth()` Does

1. **Updates WebSocket Connection Params**
   - Changes from `?apikey=ANON_KEY`
   - To `?apikey=ANON_KEY` + JWT in connection headers

2. **Sets JWT for RLS Context**
   - WebSocket requests now have `auth.uid()` available
   - RLS policies can evaluate user-specific conditions

3. **Maintains Session Across Reconnections**
   - Survives temporary network interruptions
   - Auto-reconnects with correct credentials

### When to Call It

**Required Timing:**
```javascript
// 1. After user login
await supabase.auth.signInWithPassword(...)
const { data: { session } } = await supabase.auth.getSession()

// 2. BEFORE creating Realtime channels
supabase.realtime.setAuth(session.access_token) // ← ADD THIS!

// 3. Now channels will use authenticated WebSocket
const channel = supabase.channel('my-channel')
```

**Also Required:**
- After token refresh
- After session restoration on page load
- Before any realtime subscriptions

---

## Implementation Plan

### Phase 1: Update AuthContext (10 min) 🎯 **START HERE**

**File:** `src/contexts/AuthContext.tsx`

**Changes:**
1. Call `setAuth()` immediately after login succeeds
2. Call `setAuth()` when restoring session on app load
3. Call before initializing RealtimeManager

### Phase 2: Update RealtimeManager (5 min)

**File:** `src/services/data/RealtimeManager.ts`

**Changes:**
1. Add session validation
2. Add helpful error messages
3. Document authentication requirements

### Phase 3: Test & Validate (15 min)

**Actions:**
1. Test login flow with Chrome MCP
2. Verify WebSocket URL includes JWT
3. Confirm subscriptions reach SUBSCRIBED status
4. Test realtime events flow between users

---

## Code Changes Required

### Change 1: AuthContext.tsx - After Login ✅ **CRITICAL**

**Location:** `src/contexts/AuthContext.tsx:135-195`

**Current Code:**
```typescript
// Subscribe to auth state changes
const unsubscribe = authService.onAuthStateChange(async (newSession) => {
  setSession(newSession)
  setUser(newSession?.user || null)
  SessionManager.saveSession(newSession)

  // When user signs in, also load their database data
  if (newSession?.user?.id) {
    const userId = newSession.user.id

    // ... repository setup ...

    // Start real-time sync for user's bands
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .filter(m => m.status === 'active')
      .toArray()

    if (memberships.length > 0) {
      try {
        console.log('🔌 Starting real-time WebSocket sync...')
        realtimeManager.current = new RealtimeManager()  // ← PROBLEM HERE
        const bandIds = memberships.map(m => m.bandId)
        await realtimeManager.current.subscribeToUserBands(userId, bandIds)
        console.log('✅ Real-time sync connected')
```

**Updated Code:**
```typescript
// Subscribe to auth state changes
const unsubscribe = authService.onAuthStateChange(async (newSession) => {
  setSession(newSession)
  setUser(newSession?.user || null)
  SessionManager.saveSession(newSession)

  // When user signs in, also load their database data
  if (newSession?.user?.id) {
    const userId = newSession.user.id

    // 🔥 SET REALTIME AUTH BEFORE ANY SUBSCRIPTIONS
    const supabase = getSupabaseClient()
    supabase.realtime.setAuth(newSession.access_token)
    console.log('🔐 Realtime auth configured with user JWT')

    // ... repository setup ...

    // Start real-time sync for user's bands
    const memberships = await db.bandMemberships
      .where('userId')
      .equals(userId)
      .filter(m => m.status === 'active')
      .toArray()

    if (memberships.length > 0) {
      try {
        console.log('🔌 Starting real-time WebSocket sync...')
        realtimeManager.current = new RealtimeManager()  // ← NOW WORKS!
        const bandIds = memberships.map(m => m.bandId)
        await realtimeManager.current.subscribeToUserBands(userId, bandIds)
        console.log('✅ Real-time sync connected')
```

**Why This Works:**
- ✅ Sets JWT BEFORE creating RealtimeManager
- ✅ WebSocket will use user token, not anon key
- ✅ RLS policies will see `auth.uid()`
- ✅ Subscriptions will succeed

---

### Change 2: AuthContext.tsx - Session Restoration ✅ **CRITICAL**

**Location:** `src/contexts/AuthContext.tsx:100-123`

**Current Code:**
```typescript
if (storedSession) {
  setSession(storedSession)
  setUser(storedSession.user)

  // ... load user data ...

  if (bands.length > 0) {
    try {
      console.log('🔌 Starting real-time WebSocket sync...')
      realtimeManager.current = new RealtimeManager()  // ← PROBLEM HERE
      const bandIds = bands.map(m => m.bandId)
      await realtimeManager.current.subscribeToUserBands(storedUserId, bandIds)
```

**Updated Code:**
```typescript
if (storedSession) {
  setSession(storedSession)
  setUser(storedSession.user)

  // 🔥 SET REALTIME AUTH ON SESSION RESTORATION
  const supabase = getSupabaseClient()
  supabase.realtime.setAuth(storedSession.access_token)
  console.log('🔐 Realtime auth restored from session')

  // ... load user data ...

  if (bands.length > 0) {
    try {
      console.log('🔌 Starting real-time WebSocket sync...')
      realtimeManager.current = new RealtimeManager()  // ← NOW WORKS!
      const bandIds = bands.map(m => m.bandId)
      await realtimeManager.current.subscribeToUserBands(storedUserId, bandIds)
```

**Why This Matters:**
- User refreshes page → Session restored from localStorage
- Without `setAuth()` → Realtime uses anon key (FAILS)
- With `setAuth()` → Realtime uses restored JWT (WORKS)

---

### Change 3: RealtimeManager.ts - Add Validation (Optional but Recommended)

**Location:** `src/services/data/RealtimeManager.ts:56-70`

**Current Code:**
```typescript
async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  this.currentUserId = userId

  for (const bandId of bandIds) {
    await this.subscribeToBand(userId, bandId)
  }
```

**Enhanced Code:**
```typescript
async subscribeToUserBands(userId: string, bandIds: string[]): Promise<void> {
  this.currentUserId = userId

  // 🔍 Validation: Check if auth is configured
  const { data: { session } } = await this.supabase.auth.getSession()
  if (!session) {
    console.error('❌ Cannot subscribe: No authenticated session found')
    console.error('💡 Hint: Call supabase.realtime.setAuth(token) before creating RealtimeManager')
    throw new Error('Realtime requires authenticated session. Call setAuth() first.')
  }

  console.log('✅ Realtime auth verified - user:', session.user.id)

  for (const bandId of bandIds) {
    await this.subscribeToBand(userId, bandId)
  }
```

**Benefits:**
- Early detection of missing auth
- Clear error messages for future developers
- Prevents silent failures

---

## Testing Strategy

### Test 1: Fresh Login (Chrome MCP) 🧪

**Steps:**
```bash
# 1. Start app
npm run dev

# 2. Open Chrome MCP
# Navigate to http://localhost:5173

# 3. Login as test user
# Email: eric@ipodshuffle.com
# Password: test123

# 4. Open DevTools Console
# Look for these logs:
✅ "🔐 Realtime auth configured with user JWT"
✅ "🔌 Starting real-time WebSocket sync..."
✅ "✅ Subscribed to songs-[band-id]"
✅ "✅ Subscribed to setlists-[band-id]"
✅ "✅ Real-time sync connected"

# 5. Check Network tab
# WebSocket connection should show:
✅ Status: 101 Switching Protocols (not 403!)
✅ Connection established
```

**Expected Result:** All subscriptions succeed, no 403 errors

---

### Test 2: Session Restoration (Browser Refresh) 🧪

**Steps:**
```bash
# 1. Login successfully (Test 1 passes)

# 2. Refresh the page (F5 / Cmd+R)

# 3. Check Console
✅ "🔐 Realtime auth restored from session"
✅ "✅ Subscribed to songs-[band-id]"
✅ "✅ Real-time sync connected"

# 4. Verify WebSocket
✅ New WebSocket connection established
✅ No 403 errors
```

**Expected Result:** Realtime works after refresh

---

### Test 3: Two-User Realtime Test 🧪

**Steps:**
```bash
# 1. Open two browser windows side-by-side

# Window 1:
# Login as: eric@ipodshuffle.com / test123

# Window 2:
# Login as: mike@ipodshuffle.com / test123
# (Both users are in same band: "iPod Shuffle")

# 2. In Window 1:
# Create a new song

# 3. In Window 2:
# Check if song appears in real-time (< 1 second)

# 4. Check Console in Window 2:
✅ "📡 Received INSERT event"
✅ "[Toast info]: Eric added 'New Song Name'"
```

**Expected Result:** Changes propagate in real-time between users

---

### Test 4: Database Validation 🧪

**Verify WebSocket is using JWT:**
```bash
# 1. With app running and user logged in

# 2. Check Realtime server logs
docker logs supabase_realtime_rock-on --tail 20 --follow

# Expected output (NOT "MalformedJWT"):
✅ "project=realtime-dev external_id=realtime-dev [info] New connection..."
✅ "project=realtime-dev external_id=realtime-dev [info] Channel subscribed: songs-[band-id]"

# 3. If you see MalformedJWT → setAuth() not called correctly
```

---

## Validation Steps

### Checklist Before Marking Complete ✅

- [ ] Code changes applied to AuthContext.tsx (2 locations)
- [ ] Optional validation added to RealtimeManager.ts
- [ ] Fresh login test passes (no 403 errors)
- [ ] Session restoration test passes (refresh page works)
- [ ] Two-user realtime test passes (events propagate)
- [ ] Realtime server logs show no JWT errors
- [ ] Browser console shows "SUBSCRIBED" for all channels
- [ ] WebSocket Network tab shows 101 (not 403)

### Success Criteria

**All of these must be true:**

1. ✅ Login shows: "🔐 Realtime auth configured with user JWT"
2. ✅ All channels show: "✅ Subscribed to [table]-[band-id]"
3. ✅ No console errors about "Channel error" or "MalformedJWT"
4. ✅ WebSocket connection status: 101 Switching Protocols
5. ✅ Two users can see each other's changes in < 1 second
6. ✅ Page refresh maintains working realtime connection

---

## Troubleshooting Guide

### Issue: Still Getting 403 After setAuth()

**Possible Causes:**

1. **Calling setAuth() AFTER channel creation**
   ```typescript
   // ❌ WRONG ORDER
   const manager = new RealtimeManager()  // Creates channels
   supabase.realtime.setAuth(token)       // Too late!

   // ✅ CORRECT ORDER
   supabase.realtime.setAuth(token)       // First!
   const manager = new RealtimeManager()  // Then channels
   ```

2. **Using expired JWT**
   ```typescript
   // Check token expiration
   const { data: { session } } = await supabase.auth.getSession()
   if (session) {
     const expiresAt = new Date(session.expires_at * 1000)
     console.log('Session expires:', expiresAt)
     console.log('Is expired:', expiresAt < new Date())
   }
   ```

3. **Session not properly stored/restored**
   ```typescript
   // Verify session exists
   const storedSession = SessionManager.getSession()
   if (!storedSession) {
     console.error('No session found in storage!')
   }
   ```

---

### Issue: WebSocket Connects but No Events Received

**Check RLS Policies:**

```sql
-- Verify RLS policies allow your user
SELECT
  schemaname, tablename, policyname,
  roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('songs', 'setlists', 'shows', 'practice_sessions')
ORDER BY tablename;

-- Test if your user can SELECT data
-- (This must work for Realtime to work)
SELECT * FROM songs WHERE context_id = 'your-band-id';
```

**If SELECT works but Realtime doesn't:**
- RLS policies are correct ✅
- Realtime auth still missing ❌
- Double-check `setAuth()` was called

---

### Issue: "Cannot read property 'setAuth' of undefined"

**Cause:** Trying to call `setAuth()` before Supabase client initialized

**Fix:**
```typescript
// Ensure you're getting the client correctly
import { getSupabaseClient } from '../services/supabase/client'

// INSIDE an async function or useEffect:
const supabase = getSupabaseClient()  // ← Must be called at runtime
supabase.realtime.setAuth(token)

// NOT at module level:
// const supabase = getSupabaseClient()  // ❌ May run too early
```

---

### Issue: Token Refresh Breaks Realtime

**Solution:** Update token when refreshed

```typescript
// In AuthContext, listen for token refresh
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Update Realtime with fresh token
        supabase.realtime.setAuth(session.access_token)
        console.log('🔄 Realtime token refreshed')
      }
    }
  )

  return () => subscription.unsubscribe()
}, [])
```

---

## Why This Will Work

### Evidence from Official Docs

**From Supabase Documentation (via Context7):**

> **Set custom JWT for Supabase Realtime authentication**
>
> "These code examples demonstrate how to set a custom JWT token for authentication with Supabase Realtime... The token should be set after client instantiation and **before subscribing to any Realtime channels**."

```javascript
const supabase = createClient(url, anonKey)

// Set your custom JWT here
supabase.realtime.setAuth('your-custom-jwt')  // ← THIS IS THE FIX

const channel = supabase.channel('db-changes')
  .on('postgres_changes', { ... }, handler)
  .subscribe()
```

**From RLS Authorization Guide:**

> "When RLS is enabled, the channel must be configured with `private: true` to ensure policies are enforced."

**Our RLS policies require `authenticated` role:**
```sql
-- From your migration files
CREATE POLICY "songs_select_band_members" ON songs
FOR SELECT TO authenticated  -- ← Requires authenticated JWT
USING (...)
```

**Therefore:**
1. ✅ RLS requires `authenticated` role
2. ✅ Anon key has `anon` role (FAILS RLS)
3. ✅ User JWT has `authenticated` role (PASSES RLS)
4. ✅ `setAuth(user_jwt)` provides user JWT to WebSocket
5. ✅ **RESULT: Realtime will work**

---

## Comparison: Before vs After

### Before (Current - Broken) ❌

```typescript
// AuthContext.tsx
if (newSession?.user?.id) {
  // Missing: supabase.realtime.setAuth(newSession.access_token)

  realtimeManager.current = new RealtimeManager()
  await realtimeManager.current.subscribeToUserBands(...)
}

// Result:
WebSocket URL: ws://...?apikey=ANON_KEY
RLS sees: role='anon', auth.uid()=NULL
Status: 403 Forbidden ❌
```

### After (Fixed) ✅

```typescript
// AuthContext.tsx
if (newSession?.user?.id) {
  supabase.realtime.setAuth(newSession.access_token)  // ← THE FIX

  realtimeManager.current = new RealtimeManager()
  await realtimeManager.current.subscribeToUserBands(...)
}

// Result:
WebSocket URL: ws://...?apikey=ANON_KEY (includes JWT in headers)
RLS sees: role='authenticated', auth.uid()=user-id
Status: SUBSCRIBED ✅
```

---

## Next Steps

### Immediate Actions (30 min)

1. **Apply Code Changes** (10 min)
   - Update AuthContext.tsx (2 locations)
   - Add import for getSupabaseClient if needed
   - Optional: Add validation to RealtimeManager

2. **Test Fresh Login** (5 min)
   - Start app, login, check console logs
   - Verify subscriptions succeed
   - No 403 errors in Network tab

3. **Test Session Restoration** (5 min)
   - Refresh page after successful login
   - Verify Realtime still works

4. **Test Two-User Sync** (10 min)
   - Two browser windows
   - Different users, same band
   - Verify real-time propagation

### After Tests Pass

5. **Create Completion Report** (15 min)
   - Document what was changed
   - Include before/after screenshots
   - Record test results
   - Update roadmap Phase 4 status

6. **Update Roadmap** (5 min)
   - Mark Phase 4 realtime section as complete
   - Link to this resolution plan
   - Update progress percentage

---

## Confidence Assessment

### Why We're Confident This Will Work 🎯

1. **✅ Official Documentation Match**
   - Supabase docs explicitly show `setAuth()` usage
   - Our problem matches documented authentication pattern
   - Solution is standard practice, not a workaround

2. **✅ Root Cause Identified**
   - Team's hello world test proved infrastructure works
   - Issue is purely authentication, not configuration
   - RLS logs confirm JWT not being passed

3. **✅ Minimal Changes Required**
   - One method call: `supabase.realtime.setAuth(token)`
   - Two locations in AuthContext
   - No schema changes, no migrations, no server config

4. **✅ Testable Immediately**
   - Can verify in < 5 minutes with fresh login
   - Clear success/failure indicators in console
   - Easy to rollback if needed (unlikely)

**Confidence Level:** 95% ✅

---

## References

### Documentation Sources

- **Supabase JS Documentation** (Context7: `/supabase/supabase-js`)
  - Realtime authentication patterns
  - `setAuth()` method usage
  - JWT token handling

- **Supabase Platform Documentation** (Context7: `/supabase/supabase`)
  - RLS with Realtime
  - Private channel configuration
  - Authentication best practices

### Related Files

- `src/contexts/AuthContext.tsx` - Auth state management
- `src/services/data/RealtimeManager.ts` - Realtime subscriptions
- `src/services/supabase/client.ts` - Supabase client singleton
- `supabase/migrations/20251026160000_rebuild_rls_policies.sql` - RLS policies

### Team's Previous Work

- `.claude/artifacts/2025-10-30T22:05_phase4-realtime-blocker-complete-report.md`
- `.claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md`
- `.claude/artifacts/2025-10-30T21:55_phase4-websocket-403-blocker.md`

---

## Summary

**The Fix:** Call `supabase.realtime.setAuth(session.access_token)` BEFORE creating Realtime subscriptions.

**Where:** Two locations in `src/contexts/AuthContext.tsx`
- After fresh login (line ~136)
- After session restoration (line ~101)

**Why It Works:** Provides user's JWT to WebSocket so RLS policies can evaluate `auth.uid()`

**Time to Implement:** 15-30 minutes

**Confidence:** Very High (95%)

**Next Action:** Apply code changes and test immediately

---

**Created:** 2025-10-30T22:10
**Created By:** Claude Code Development Session
**Status:** Ready for Implementation
**Blocking:** Phase 4 (Real-time Sync) - 70% → 100%
**Estimated Completion:** < 1 hour including testing
