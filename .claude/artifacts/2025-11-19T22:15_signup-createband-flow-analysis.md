---
title: Sign Up + Create Band Flow Analysis
created: 2025-11-19T22:15
type: Technical Analysis
status: Draft
purpose: Identify duplicate logic, race conditions, and fail-safe gaps in user signup flow
---

# Sign Up + Create Band Flow Analysis

## Executive Summary

**Problem:** Duplicate band_membership entries appearing in IndexedDB (but not Supabase) when users sign up and create bands. Error message: `[BandMembersPage] DUPLICATE user IDs in dbMembers: ['user-id']`

**Root Causes Identified:**
1. **No unique constraint in IndexedDB** on `[userId+bandId]` (Supabase has `UNIQUE(user_id, band_id)`)
2. **Multiple code paths** creating memberships (trigger vs manual insert)
3. **Race conditions** between sync operations
4. **No idempotency** in membership creation
5. **Missing error handling** for network timeouts
6. **No recovery mechanisms** for partial failures

---

## Current Flow: New User Signs Up + Creates Band

### Step 1: User Submits Signup Form

**File:** `src/pages/NewLayout/AuthPages.tsx:606-654`

**What Happens:**
```typescript
const handleSignUp = async () => {
  // 1. Call Supabase Auth signup
  const { error, data } = await supabaseAuth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  })

  // 2. If successful, SupabaseAuthService handles post-signup
}
```

**Outcome:**
- ✅ Creates user in `auth.users` (Supabase managed)
- ⚠️ **TRIGGER FIRES** → Creates user in `public.users` via `handle_new_user()` trigger
- ✅ User authenticated
- ❌ No error handling for trigger failure
- ❌ No verification that `public.users` entry was created

---

### Step 2: SupabaseAuthService Post-Signup Hook

**File:** `src/services/auth/SupabaseAuthService.ts:67-94`

**What Happens:**
```typescript
// Inside signUp() method after Supabase auth completes:

// Ensure user exists in public.users table
const { error } = await this.supabase
  .from('users')
  .upsert({
    id: user.id,
    email: user.email,
    name: user.name,
    // ...
  }, { onConflict: 'id' })

if (error) {
  console.error('⚠️ Failed to sync user to Supabase public.users:', error)
  // DON'T THROW - log and continue
}
```

**Outcome:**
- ⚠️ **DUPLICATE WORK**: Tries to insert into `public.users` again
- ✅ Uses `ON CONFLICT` so doesn't fail if trigger already created it
- ❌ **Silent failure**: Errors are logged but not thrown
- ❌ No retry mechanism
- ❌ User might proceed without `public.users` entry

---

### Step 3: User Clicks "Create Band"

**File:** `src/pages/NewLayout/AuthPages.tsx:785-834`

**What Happens:**
```typescript
const handleCreateBand = async () => {
  // 1. Create band using hook
  const bandId = await createBand({ name: bandName }, user.id)

  // 2. Generate invite code
  const inviteCode = await BandMembershipService.createInviteCode({
    bandId,
    createdBy: user.id,
    maxUses: 999
  })

  // 3. Set current band
  localStorage.setItem('currentBandId', bandId)
  await switchBand(bandId)
}
```

**Outcome:**
- ✅ Calls `useCreateBand` hook
- ❌ No verification that membership was created
- ❌ No error handling for partial failures
- ❌ If `switchBand` fails, user is in bad state

---

### Step 4: useCreateBand Hook Creates Band

**File:** `src/hooks/useBands.ts:218-263`

**What Happens:**
```typescript
const createBand = async (bandData, ownerId) => {
  // 1. Create band via service
  const newBand = await BandService.createBand({
    name: bandData.name || 'My Band',
    description: bandData.description || '',
  })

  // 2. Ensure user context exists (?)
  await BandMembershipService.getUserBands(ownerId)

  // 3. Create owner membership DIRECTLY in IndexedDB
  const membership = {
    id: crypto.randomUUID(),
    userId: ownerId,
    bandId: newBand.id,
    role: 'admin',
    joinedDate: new Date(),
    status: 'active',
    permissions: ['owner', 'admin']
  }

  await db.bandMemberships.add(membership)  // ⚠️ DIRECT INSERT

  return newBand.id
}
```

**Outcome:**
- ✅ Band created in IndexedDB
- ⚠️ **Membership added directly to IndexedDB** (bypassing sync layer)
- ❌ Membership NOT immediately in Supabase
- ❌ Sync engine will queue this for upload later
- ⚠️ **Race condition**: If sync pulls before upload, duplicate possible

---

### Step 5: BandService.createBand

**File:** `src/services/BandService.ts:45-72`

**What Happens:**
```typescript
static async createBand(bandData) {
  // Create band object
  const newBand = {
    id: crypto.randomUUID(),
    name: bandData.name,
    description: bandData.description,
    createdDate: new Date(),
    settings: { /* defaults */ },
    memberIds: []  // ⚠️ Empty array
  }

  // Add to repository (IndexedDB + queues for sync)
  return await repository.addBand(newBand)
}
```

**Outcome:**
- ✅ Band created in IndexedDB
- ✅ Queued for sync to Supabase
- ❌ `memberIds` is empty array (not used anymore with band_memberships table)
- ❌ No membership created here

---

### Step 6: Sync Engine Uploads Band

**File:** `src/services/data/SyncEngine.ts`

**What Happens:**
1. Band upload queued
2. Sync engine processes queue
3. Band uploaded to Supabase
4. **Supabase trigger fires:** `auto_add_band_creator` (line 678-684 of baseline migration)

```sql
-- From supabase/migrations/20251106000000_baseline_schema.sql:678-684
IF v_user_id IS NOT NULL THEN
  INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
  VALUES (v_user_id, NEW.id, 'admin', 'active', now())
  ON CONFLICT (user_id, band_id) DO NOTHING;
END IF;
```

**Outcome:**
- ✅ Band now in Supabase `bands` table
- ✅ **Trigger creates membership** in Supabase `band_memberships`
- ⚠️ **Now have TWO memberships:**
  - One in IndexedDB (created by `useCreateBand`)
  - One in Supabase (created by trigger)

---

### Step 7: Sync Engine Pulls Changes

**What Happens:**
1. Sync engine periodically pulls from Supabase
2. Finds new `band_membership` from trigger
3. **Attempts to insert into IndexedDB**

**File:** `src/services/data/LocalRepository.ts` (addBandMembership method)

**Outcome:**
- ⚠️ **DUPLICATE**: IndexedDB has no unique constraint on `[userId+bandId]`
- ✅ Supabase prevents duplicate (has `UNIQUE(user_id, band_id)`)
- ❌ Result: IndexedDB has 2 entries for same user+band

---

## Identified Issues

### 1. **Duplicate User Creation Logic**

**Problem:** Both trigger AND application code try to create `public.users` entry.

**Locations:**
- `handle_new_user()` trigger (baseline migration line 55-90)
- `SupabaseAuthService.signUp()` line 67-94

**Solution:**
- ✅ Keep trigger (reliable, bypasses RLS)
- ✅ Remove application upsert (redundant)
- ✅ Add verification step instead

### 2. **Duplicate Membership Creation Logic**

**Problem:** Both trigger AND application code try to create membership.

**Locations:**
- `auto_add_band_creator` trigger (baseline migration line 678-684)
- `useCreateBand()` hook line 250

**Solution:**
- ✅ Keep trigger (server-side, atomic with band creation)
- ❌ Remove `db.bandMemberships.add()` from useCreateBand
- ✅ Poll/wait for membership to sync from Supabase instead

### 3. **Missing Unique Constraint in IndexedDB**

**Problem:** IndexedDB allows duplicate `[userId+bandId]` entries.

**Current schema:**
```typescript
bandMemberships: '++id, userId, bandId, role, joinedDate, status, *permissions'
```

**Should be:**
```typescript
bandMemberships: '++id, [userId+bandId], userId, bandId, role, joinedDate, status, *permissions'
```

**Solution:** Add Version 8 schema with compound unique index

### 4. **No Idempotency**

**Problem:** Operations can be retried without checking if already done.

**Example:** User clicks "Create Band" → Network timeout → Clicks again → Creates 2 bands

**Solution:**
- Add idempotency keys
- Check if operation already succeeded before retrying
- Use `ON CONFLICT` in all sync operations

### 5. **Silent Failures**

**Problem:** Errors logged to console but user never notified.

**Locations:**
- `SupabaseAuthService.signUp()` - user sync failure
- `useCreateBand()` - no try/catch around db operations
- Sync engine - silent queue failures

**Solution:**
- Throw errors for critical operations
- Show user-friendly error messages
- Add retry UI for recoverable errors

### 6. **No Timeout Handling**

**Problem:** Network requests can hang indefinitely.

**Impact:**
- User clicks button
- Loading spinner never stops
- User stuck in bad state

**Solution:**
- Add timeouts to all Supabase calls (default: 10s)
- Implement exponential backoff for retries
- Show clear error message on timeout

### 7. **No Partial Failure Recovery**

**Problem:** If band created but membership fails, no recovery path.

**Scenarios:**
```
✅ Band in Supabase
❌ Membership creation fails
❌ User can't see their band
❌ No way to retry just the membership
```

**Solution:**
- Implement transaction-like operations
- Add reconciliation step: "Verify band access"
- Background job to fix orphaned resources

---

## Recommended Flow (Simplified)

### New Flow: User Signs Up + Creates Band

```
1. User submits signup form
   ↓
2. Supabase Auth creates user in auth.users
   ↓
3. handle_new_user() trigger creates public.users entry
   ↓ (trigger is atomic and reliable)
4. SupabaseAuthService verifies public.users exists
   - If missing: retry or show error
   - Don't attempt to create (trust trigger)
   ↓
5. User clicks "Create Band"
   ↓
6. Create band in Supabase FIRST (not IndexedDB)
   - auto_add_band_creator trigger creates membership
   - Both band + membership atomic in Supabase
   ↓
7. Poll Supabase until membership appears
   - Retry up to 3 times, 1 second apart
   - If timeout: show error, allow retry
   ↓
8. Sync engine pulls band + membership to IndexedDB
   - Compound unique index prevents duplicates
   ↓
9. Set currentBandId and redirect
```

**Benefits:**
- ✅ Single source of truth (Supabase)
- ✅ Triggers ensure atomicity
- ✅ No duplicate logic
- ✅ Clear error states
- ✅ Retryable operations

---

## Required Changes

### 1. Update IndexedDB Schema (High Priority)

**File:** `src/services/database/index.ts`

Add Version 8 with compound unique index:

```typescript
// Version 8: Fix duplicate memberships
this.version(8).stores({
  // ... all other tables ...
  bandMemberships: '++id, [userId+bandId], userId, bandId, role, joinedDate, status, *permissions',
  // Compound unique index prevents duplicates
})
```

### 2. Remove Duplicate User Creation (Medium Priority)

**File:** `src/services/auth/SupabaseAuthService.ts:67-94`

**Before:**
```typescript
// Try to sync user to public.users
const { error } = await this.supabase
  .from('users')
  .upsert({ id, email, name })

if (error) {
  console.error('Failed to sync user')
  // Continue anyway
}
```

**After:**
```typescript
// Verify trigger created user in public.users
const { data, error } = await this.supabase
  .from('users')
  .select('id')
  .eq('id', user.id)
  .single()

if (error || !data) {
  throw new Error('User account created but verification failed. Please try signing in.')
}
```

### 3. Remove Duplicate Membership Creation (High Priority)

**File:** `src/hooks/useBands.ts:234-250`

**Before:**
```typescript
// Create owner membership
const membership = { /* ... */ }
await db.bandMemberships.add(membership)  // ❌ Direct insert
```

**After:**
```typescript
// Wait for trigger to create membership, then poll for it
await waitForMembership(newBand.id, ownerId, { timeout: 5000 })
```

### 4. Add Helper: waitForMembership

**New function in** `src/hooks/useBands.ts`:

```typescript
async function waitForMembership(
  bandId: string,
  userId: string,
  options = { timeout: 5000, interval: 500 }
): Promise<BandMembership> {
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout) {
    // Check if membership synced to IndexedDB
    const membership = await db.bandMemberships
      .where('[userId+bandId]')
      .equals([userId, bandId])
      .first()

    if (membership) {
      return membership
    }

    // Trigger sync engine to pull
    const repo = getSyncRepository()
    await repo.syncNow()

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  throw new Error('Timeout waiting for band membership. Please refresh the page.')
}
```

### 5. Add Timeout Wrappers (Low Priority, Future Work)

Wrap all Supabase calls with timeout logic:

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  )

  return Promise.race([promise, timeout])
}
```

---

## Testing Checklist

After implementing changes:

- [ ] Fresh signup + create band (no duplicates in IndexedDB)
- [ ] Refresh page immediately after creating band (data persists)
- [ ] Network timeout during band creation (error shown, retry works)
- [ ] Multiple rapid clicks on "Create Band" (only one band created)
- [ ] Offline mode: create band → go online (syncs correctly)
- [ ] User signs up but trigger fails (error shown, can retry)
- [ ] Join existing band (no duplicate memberships)
- [ ] Switch between bands (correct data loaded)

---

## Next Steps

1. ✅ **Immediate:** Add Version 8 schema with compound unique index
2. ✅ **High Priority:** Remove duplicate membership creation from useCreateBand
3. ✅ **High Priority:** Add `waitForMembership` polling function
4. ⬜ **Medium Priority:** Replace user upsert with verification
5. ⬜ **Low Priority:** Add timeout wrappers to all Supabase calls
6. ⬜ **Future:** Implement reconciliation background job
7. ⬜ **Future:** Add idempotency keys to all mutations

---

## Related Files

**Implementation Files:**
- `src/services/auth/SupabaseAuthService.ts` - User signup + sync
- `src/hooks/useBands.ts` - Band creation hooks
- `src/services/BandService.ts` - Band business logic
- `src/services/database/index.ts` - IndexedDB schema
- `src/pages/NewLayout/AuthPages.tsx` - UI flow

**Database:**
- `supabase/migrations/20251106000000_baseline_schema.sql`
  - Line 55-90: `handle_new_user()` trigger
  - Line 678-684: `auto_add_band_creator` trigger

**Specifications:**
- `.claude/specifications/user-flows/authentication-flow.md` - Expected UX
- `.claude/specifications/unified-database-schema.md` - Schema reference

---

**Status:** Ready for implementation
**Priority:** High - Affects all new user signups
**Estimated effort:** 2-3 hours
