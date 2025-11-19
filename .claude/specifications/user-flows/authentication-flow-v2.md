---
title: User Authentication Flow Specification v2 (Updated)
created: 2025-11-19T22:20
updated: 2025-11-19T22:20
status: Active - Supersedes v1
type: Technical Implementation Guide
description: Complete signup + create band flow with fail-safe guarantees and no duplicate logic
---

# User Authentication Flow v2 - Technical Implementation

## Purpose

This document defines the **technical implementation** of the authentication flow, focusing on:
- Eliminating duplicate logic
- Fail-safe error handling
- Network timeout handling
- Idempotent operations
- Data consistency guarantees

**Companion Document:** `authentication-flow.md` (user-facing UX spec)

---

## Core Principles

1. **Server-side truth**: Supabase is the source of truth, IndexedDB is a cache
2. **Trigger-based automation**: Database triggers ensure atomicity
3. **No duplicate creation logic**: Each resource created in exactly one place
4. **Explicit verification**: Don't assume success, verify completion
5. **Graceful degradation**: Clear error states with retry paths
6. **Timeout handling**: All network calls have timeouts
7. **Idempotency**: Operations can be safely retried

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                           │
│              (Signup, Create Band, etc.)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supabase (Server-Side)                      │
│                                                              │
│  1. Create resource (band, user, etc.)                      │
│  2. Trigger fires (auto_add_band_creator, etc.)             │
│  3. Related resources created atomically                    │
│  4. RLS enforced                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Application (Client-Side)                       │
│                                                              │
│  1. Poll/wait for Supabase resources                        │
│  2. Verify completion with timeout                          │
│  3. Trigger sync engine pull                                │
│  4. Verify local cache populated                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  IndexedDB (Local Cache)                     │
│                                                              │
│  - Synced from Supabase via pull                            │
│  - Unique constraints prevent duplicates                    │
│  - Used for offline access                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 1: User Signup (Email/Password)

### Step 1: User Submits Signup Form

**File:** `src/pages/NewLayout/AuthPages.tsx`

**What Happens:**

```typescript
const handleSignUp = async () => {
  try {
    setLoading(true)
    setError(null)

    // 1. Call Supabase Auth
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    })

    if (signUpError) {
      throw signUpError
    }

    if (!data.user) {
      throw new Error('Signup succeeded but no user returned')
    }

    // 2. Wait for public.users entry (created by trigger)
    await waitForPublicUser(data.user.id)

    // 3. Session established, redirect to get-started
    navigate('/get-started')

  } catch (err) {
    setError(getUserFriendlyError(err))
  } finally {
    setLoading(false)
  }
}
```

**Server-Side (Automatic):**

```sql
-- Trigger: handle_new_user() in baseline migration
-- Fires: AFTER INSERT ON auth.users
-- Does: Creates matching entry in public.users

INSERT INTO public.users (id, email, name, created_date, last_login, auth_provider)
VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
  NEW.created_at,
  NOW(),
  COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
)
ON CONFLICT (id) DO UPDATE SET last_login = NOW();
```

**Verification:**

```typescript
async function waitForPublicUser(
  userId: string,
  options = { timeout: 5000, interval: 500 }
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout) {
    // Poll Supabase for public.users entry
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (data && !error) {
      return // Success!
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  throw new Error(
    'Account created but verification timed out. Please try signing in.'
  )
}
```

**Guarantees:**
- ✅ User exists in `auth.users` (Supabase Auth)
- ✅ User exists in `public.users` (trigger)
- ✅ No duplicate creation logic
- ✅ Clear error if trigger fails
- ✅ Timeout handled gracefully

---

## Flow 2: Create First Band

### Step 2: User Clicks "Create Band"

**File:** `src/pages/NewLayout/AuthPages.tsx`

**What Happens:**

```typescript
const handleCreateBand = async () => {
  try {
    setLoading(true)
    setError(null)

    if (!user?.id) {
      throw new Error('No user logged in')
    }

    // 1. Create band in Supabase FIRST (not IndexedDB)
    const bandId = await createBandInSupabase({
      name: bandName,
      description: bandDescription,
      createdBy: user.id
    })

    // 2. Wait for membership (created by trigger)
    await waitForMembership(bandId, user.id)

    // 3. Generate invite code
    const inviteCode = await BandMembershipService.createInviteCode({
      bandId,
      createdBy: user.id,
      maxUses: 999
    })

    // 4. Trigger sync to pull band + membership to IndexedDB
    const repo = getSyncRepository()
    await repo.syncNow()

    // 5. Verify local cache has data
    const localBand = await db.bands.get(bandId)
    if (!localBand) {
      console.warn('Band not yet in IndexedDB, will sync later')
    }

    // 6. Set current band and redirect
    localStorage.setItem('currentBandId', bandId)
    await switchBand(bandId)

    setToast({
      message: `Band created! Share invite code: ${inviteCode.code}`,
      type: 'success'
    })

    setTimeout(() => navigate('/songs'), 2000)

  } catch (err) {
    setError(getUserFriendlyError(err))
  } finally {
    setLoading(false)
  }
}
```

**Server-Side (Automatic):**

```sql
-- Trigger: auto_add_band_creator in baseline migration
-- Fires: AFTER INSERT ON public.bands
-- Does: Creates admin membership for band creator

IF v_user_id IS NOT NULL THEN
  INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
  VALUES (v_user_id, NEW.id, 'admin', 'active', now())
  ON CONFLICT (user_id, band_id) DO NOTHING;
END IF;
```

**Helper Functions:**

```typescript
async function createBandInSupabase(params: {
  name: string
  description: string
  createdBy: string
}): Promise<string> {
  const bandId = crypto.randomUUID()

  const { error } = await supabase
    .from('bands')
    .insert({
      id: bandId,
      name: params.name,
      description: params.description,
      created_by: params.createdBy,
      created_date: new Date().toISOString(),
      settings: {},
      is_active: true
    })

  if (error) {
    if (error.code === '23505') {
      // Duplicate band name
      throw new Error('Band name already exists')
    }
    throw new Error(`Failed to create band: ${error.message}`)
  }

  return bandId
}

async function waitForMembership(
  bandId: string,
  userId: string,
  options = { timeout: 5000, interval: 500 }
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout) {
    // Poll Supabase for membership
    const { data, error } = await supabase
      .from('band_memberships')
      .select('id')
      .eq('band_id', bandId)
      .eq('user_id', userId)
      .single()

    if (data && !error) {
      return // Success!
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  throw new Error(
    'Band created but membership not found. Please refresh the page.'
  )
}
```

**Guarantees:**
- ✅ Band exists in Supabase `bands` table
- ✅ Membership exists in Supabase `band_memberships` table (trigger)
- ✅ Band synced to IndexedDB (or will be soon)
- ✅ Membership synced to IndexedDB (or will be soon)
- ✅ No duplicate logic
- ✅ Clear error states
- ✅ Retryable operations

---

## Flow 3: Sync Engine Pulls Data

### Step 3: Background Sync

**File:** `src/services/data/SyncEngine.ts`

**What Happens:**

```typescript
async syncFromRemote() {
  // 1. Pull all user's band memberships
  const memberships = await remoteRepo.getUserMemberships(userId)

  // 2. For each membership, sync to IndexedDB
  for (const membership of memberships) {
    await localRepo.addOrUpdateBandMembership(membership)
    // Compound unique index [userId+bandId] prevents duplicates
  }

  // 3. Pull all bands
  const bands = await remoteRepo.getBands()

  for (const band of bands) {
    await localRepo.addOrUpdateBand(band)
  }

  // 4. Pull band data (songs, setlists, etc.)
  // ...
}
```

**LocalRepository addOrUpdateBandMembership:**

```typescript
async addOrUpdateBandMembership(membership: BandMembership): Promise<void> {
  // Uses Dexie's put() which is upsert based on primary key
  // Compound unique index [userId+bandId] ensures no duplicates
  await db.bandMemberships.put(membership)
}
```

**Guarantees:**
- ✅ No duplicates in IndexedDB (compound unique index)
- ✅ Idempotent (can safely retry)
- ✅ Eventually consistent with Supabase
- ✅ Offline-capable (IndexedDB cache)

---

## Required IndexedDB Schema Changes

### Version 8: Add Compound Unique Index

**File:** `src/services/database/index.ts`

**Change:**

```typescript
// OLD (Version 7):
this.version(7).stores({
  bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions',
  // ❌ No unique constraint - allows duplicates
})

// NEW (Version 8):
this.version(8).stores({
  bandMemberships: '++id, [userId+bandId], userId, bandId, role, joinedDate, status, *permissions',
  // ✅ Compound unique index prevents duplicates
})
```

**Migration Behavior:**
- Dexie automatically handles schema upgrades
- Existing duplicates will throw error on upgrade
- Need to clean duplicates before upgrading (see below)

**Pre-Migration Cleanup:**

```typescript
// Add to Version 8 upgrade function
this.version(8)
  .stores({
    bandMemberships: '++id, [userId+bandId], userId, bandId, role, joinedDate, status, *permissions',
  })
  .upgrade(async (tx) => {
    // Remove duplicate memberships before adding unique constraint
    const memberships = await tx.table('bandMemberships').toArray()

    // Group by userId+bandId
    const grouped = new Map<string, BandMembership[]>()
    for (const m of memberships) {
      const key = `${m.userId}|${m.bandId}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(m)
    }

    // Keep only the most recent membership for each userId+bandId
    for (const [key, dupes] of grouped) {
      if (dupes.length > 1) {
        // Sort by joinedDate (most recent first)
        dupes.sort((a, b) => b.joinedDate.getTime() - a.joinedDate.getTime())

        // Delete all but the first (most recent)
        for (let i = 1; i < dupes.length; i++) {
          await tx.table('bandMemberships').delete(dupes[i].id)
        }
      }
    }
  })
```

---

## Error Handling Strategy

### Network Timeout Example

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Request timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  )

  return Promise.race([promise, timeout])
}

// Usage:
const user = await withTimeout(
  supabase.auth.signUp({ email, password }),
  10000,
  'Signup request timed out. Please check your connection and try again.'
)
```

### User-Friendly Error Messages

```typescript
function getUserFriendlyError(error: any): string {
  // Network errors
  if (error.message === 'Failed to fetch') {
    return 'Network error. Please check your internet connection and try again.'
  }

  // Timeout errors
  if (error.message.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }

  // Duplicate data
  if (error.code === '23505') {
    if (error.message.includes('email')) {
      return 'This email is already registered. Please sign in instead.'
    }
    if (error.message.includes('band')) {
      return 'Band name already exists. Please choose a different name.'
    }
  }

  // Invalid credentials
  if (error.message.includes('Invalid login credentials')) {
    return 'Incorrect email or password. Please try again.'
  }

  // Default
  return 'Something went wrong. Please try again or contact support.'
}
```

### Retry UI Pattern

```typescript
const [retryCount, setRetryCount] = useState(0)

const handleRetry = async () => {
  setRetryCount(prev => prev + 1)
  try {
    await handleCreateBand()
  } catch (err) {
    // Error already handled in handleCreateBand
  }
}

// In JSX:
{error && (
  <div className="error-banner">
    <p>{error}</p>
    {retryCount < 3 && (
      <button onClick={handleRetry}>
        Retry {retryCount > 0 && `(Attempt ${retryCount + 1}/3)`}
      </button>
    )}
    {retryCount >= 3 && (
      <p>Multiple retries failed. Please <a href="/support">contact support</a>.</p>
    )}
  </div>
)}
```

---

## Testing Scenarios

### Happy Path
- [ ] New user signs up → public.users created → no errors
- [ ] User creates band → membership created → band visible
- [ ] User joins band → membership created → band data synced

### Edge Cases
- [ ] Signup while offline → error shown → retry when online works
- [ ] Create band timeout → error shown → retry succeeds
- [ ] Duplicate membership sync → IndexedDB rejects duplicate → no error
- [ ] Trigger fails → verification catches it → clear error shown

### Failure Recovery
- [ ] Band created but membership missing → error → retry creates membership
- [ ] User in auth.users but not public.users → verification fails → sign in tries again
- [ ] Multiple rapid band creation clicks → only one band created

### Performance
- [ ] Signup completes in < 3 seconds
- [ ] Band creation completes in < 2 seconds
- [ ] Verification timeout is reasonable (5 seconds)
- [ ] UI never "hangs" indefinitely

---

## Implementation Checklist

### Phase 1: Fix Duplicate Memberships (High Priority)
- [ ] Add Version 8 schema with compound unique index
- [ ] Add duplicate cleanup in upgrade function
- [ ] Remove `db.bandMemberships.add()` from `useCreateBand`
- [ ] Add `createBandInSupabase` helper
- [ ] Add `waitForMembership` polling function
- [ ] Test: Create band → verify no duplicates

### Phase 2: Fix Duplicate User Creation (Medium Priority)
- [ ] Remove upsert from `SupabaseAuthService.signUp`
- [ ] Add `waitForPublicUser` verification function
- [ ] Test: Signup → verify public.users exists
- [ ] Test: Trigger failure → error shown

### Phase 3: Add Timeout Handling (Low Priority)
- [ ] Add `withTimeout` wrapper function
- [ ] Wrap all Supabase calls with timeout
- [ ] Add timeout error messages
- [ ] Test: Slow network → timeout → retry

### Phase 4: Improve Error UX (Low Priority)
- [ ] Add `getUserFriendlyError` function
- [ ] Replace generic error messages
- [ ] Add retry UI pattern
- [ ] Add loading states
- [ ] Test: All error paths show friendly messages

---

## Migration Path for Existing Users

For users who already have duplicate memberships:

```typescript
// Background cleanup job (runs once on app load)
async function cleanupDuplicateMemberships() {
  const memberships = await db.bandMemberships.toArray()

  const seen = new Set<string>()
  const toDelete: string[] = []

  for (const m of memberships) {
    const key = `${m.userId}|${m.bandId}`
    if (seen.has(key)) {
      toDelete.push(m.id)
    } else {
      seen.add(key)
    }
  }

  if (toDelete.length > 0) {
    console.log(`Cleaning up ${toDelete.length} duplicate memberships`)
    await db.bandMemberships.bulkDelete(toDelete)
  }
}
```

---

## Related Documentation

**Specifications:**
- `authentication-flow.md` - User-facing UX spec
- `unified-database-schema.md` - Database schema reference
- `bidirectional-sync-specification.md` - Sync engine design

**Analysis:**
- `.claude/artifacts/2025-11-19T22:15_signup-createband-flow-analysis.md` - Detailed issue analysis
- `.claude/artifacts/2025-11-19T21:38_foreign-key-inconsistency-analysis.md` - FK fixes

**Code Files:**
- `src/services/auth/SupabaseAuthService.ts`
- `src/hooks/useBands.ts`
- `src/services/database/index.ts`
- `supabase/migrations/20251106000000_baseline_schema.sql`

---

**Status:** Ready for implementation
**Last Updated:** 2025-11-19T22:20
**Supersedes:** authentication-flow.md (user flows remain valid)
