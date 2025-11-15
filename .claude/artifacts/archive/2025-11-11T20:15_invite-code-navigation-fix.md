---
created: 2025-11-11T20:15
type: bug-fix-plan
status: ready-for-implementation
severity: high
component: band-joining, navigation, sync-repository
related_files:
  - src/services/data/SyncRepository.ts
  - src/contexts/AuthContext.tsx
  - src/services/BandMembershipService.ts
  - tests/unit/services/data/SyncRepository.test.ts
---

# Invite Code Join - Navigation Bug Fix Plan

## Executive Summary

**Status**: Backend join ✅ WORKING | UI Navigation ❌ BROKEN

**Problem**: After successfully joining a band via invite code (membership created, usage incremented), the UI shows "Failed to join band" error and doesn't navigate to `/songs`. The join operation completes successfully at the database level, but the post-join navigation fails.

**Root Cause**: `getBand()` method in SyncRepository is LOCAL-ONLY. When User 2 joins User 1's band, the band data doesn't exist in User 2's local IndexedDB, causing `switchBand()` to fail with "Band not found".

**Impact**: Users cannot successfully join bands via invite codes (critical MVP blocker).

---

## Root Cause Analysis

### The Complete Flow

**What Happens When User 2 Joins User 1's Band:**

1. ✅ User 1 creates band → Band stored in:
   - User 1's IndexedDB ✅
   - Supabase (via sync) ✅

2. ✅ User 1 gets invite code → Code stored in:
   - User 1's IndexedDB ✅
   - Supabase (via sync) ✅

3. ✅ User 2 enters invite code → Code validation:
   - Queries Supabase (cloud-first) ✅
   - Validates code is active, not expired ✅

4. ✅ User 2 clicks "Join Band" → Membership creation:
   - Creates membership in User 2's IndexedDB ✅
   - Queues sync to Supabase ✅
   - Sync completes, membership in Supabase ✅

5. ✅ Invite code usage incremented:
   - Calls Postgres function `increment_invite_code_usage()` ✅
   - Usage count updated in Supabase ✅

6. ❌ **Post-join navigation fails** → `switchBand(bandId)` called:
   ```typescript
   // src/contexts/AuthContext.tsx:578
   const band = await repository.getBand(bandId)
   if (!band) {
     throw new Error('Band not found')  // ← THROWS HERE
   }
   ```

7. ❌ **Why it fails:**
   - `repository.getBand()` queries LOCAL IndexedDB only
   - User 2's IndexedDB doesn't have the band (they didn't create it)
   - Returns `null`
   - Error thrown and caught
   - UI shows "Failed to join band"

### Code Evidence

**File**: `src/services/data/SyncRepository.ts:132-134`

```typescript
async getBand(id: string): Promise<Band | null> {
  return this.local.getBand(id)  // ← LOCAL-ONLY, no cloud fallback
}
```

**Comparison with Working Cloud-First Pattern:**

**File**: `src/services/data/SyncRepository.ts:342-351` (getInviteCode - WORKS)

```typescript
async getInviteCode(id: string): Promise<InviteCode | null> {
  // Cloud-first read: try remote first, fallback to local
  if (this.isOnline && this.remote) {
    try {
      return await this.remote.getInviteCode(id)
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed, using local:', error)
    }
  }
  return this.local.getInviteCode(id)
}
```

### Why getBand() Is Local-Only

The current implementation assumes:
- Users only interact with bands in their local IndexedDB
- Bands are synced via realtime subscriptions
- **BUT**: Bands table does NOT have realtime enabled ❌

**Realtime-Enabled Tables** (from database):
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```
Result:
- `songs` ✓
- `setlists` ✓
- `shows` ✓
- `practice_sessions` ✓
- `audit_log` ✓
- `bands` ❌ NOT ENABLED
- `band_memberships` ❌ NOT ENABLED

So when User 2 joins a band:
- No realtime event pushes band data to User 2's IndexedDB
- User 2 only has the membership, not the band
- `getBand()` local query fails

---

## The Fix

### Option 1: Make getBand() Cloud-First (RECOMMENDED)

**Rationale**:
- Consistent with `getInviteCode()` pattern
- Handles all multi-user scenarios (join, invite, etc.)
- Minimal code changes
- Works offline (falls back to local)

**Implementation**:

**File**: `src/services/data/SyncRepository.ts:132-134`

```typescript
async getBand(id: string): Promise<Band | null> {
  // Cloud-first read: try remote first, fallback to local
  // This ensures users joining via invite code can access band data
  if (this.isOnline && this.remote) {
    try {
      const remoteBand = await this.remote.getBand(id)
      if (remoteBand) {
        // Cache in local for offline access
        await this.local.addBand(remoteBand)
        return remoteBand
      }
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed for band, using local:', error)
    }
  }
  return this.local.getBand(id)
}
```

**Changes**:
1. Query remote (Supabase) first if online
2. If found, cache in local IndexedDB for offline access
3. If remote fails or offline, fallback to local
4. Return null if not found in either

**Benefits**:
- ✅ Users joining via invite code can access band data immediately
- ✅ Works offline (falls back to cached data)
- ✅ Self-healing (caches missing data automatically)
- ✅ Consistent with existing cloud-first patterns
- ✅ No breaking changes to API

**Considerations**:
- Adds network latency to getBand() calls (mitigated by caching)
- RLS policies must allow band members to read band data (already in place ✓)

---

### Option 2: Make getUserMemberships() Cloud-First

**Rationale**:
- Could help with stale membership data
- Provides fresh membership status

**Implementation**:

**File**: `src/services/data/SyncRepository.ts:302-304`

```typescript
async getUserMemberships(userId: string): Promise<BandMembership[]> {
  // Cloud-first read: try remote first, fallback to local
  if (this.isOnline && this.remote) {
    try {
      const remoteMemberships = await this.remote.getUserMemberships(userId)
      // Cache in local
      for (const membership of remoteMemberships) {
        await this.local.addBandMembership(membership)
      }
      return remoteMemberships
    } catch (error) {
      console.warn('[SyncRepository] Remote fetch failed for memberships, using local:', error)
    }
  }
  return this.local.getUserMemberships(userId)
}
```

**Analysis**: This alone won't fix the issue because `getBand()` would still fail. However, it could be useful for keeping membership data fresh.

**Recommendation**: Implement Option 1 (primary fix) + Option 2 (optional enhancement).

---

### Option 3: Explicitly Fetch Band After Join

**File**: `src/services/BandMembershipService.ts:145-158`

```typescript
// After creating membership and incrementing usage:

// Explicitly fetch band data and cache it for the new member
const band = await repository.getBand(inviteCode.bandId)
if (band) {
  // Band is now in local cache for this user
}

return { success: true, membership, band }  // Return band too
```

**Analysis**: This is a workaround, not a proper fix. It couples the join logic with caching logic and doesn't solve the underlying problem that `getBand()` should work for multi-user scenarios.

**Recommendation**: Don't implement this. Fix the root cause instead (Option 1).

---

## Implementation Plan

### Step 1: Update getBand() to Cloud-First Pattern

**File**: `src/services/data/SyncRepository.ts`

**Changes**:
1. Line 132-134: Replace local-only implementation with cloud-first pattern
2. Add remote query with error handling
3. Cache successful remote fetches in local
4. Fallback to local if remote fails or offline

**Code** (see Option 1 above)

### Step 2: (Optional Enhancement) Update getUserMemberships()

**File**: `src/services/data/SyncRepository.ts`

**Changes**:
1. Line 302-304: Replace local-only implementation with cloud-first pattern
2. Add remote query with error handling
3. Cache successful remote fetches in local
4. Fallback to local if remote fails or offline

**Code** (see Option 2 above)

### Step 3: Verify RLS Policies Allow Band Access

**Current Policy** (already in place ✓):
```sql
-- bands SELECT policy
CREATE POLICY "bands_select_members_or_creator"
  ON public.bands FOR SELECT TO authenticated
  USING (
    is_band_member(id, auth.uid()) OR
    created_by = auth.uid()
  );
```

**Verification**:
- ✅ Users who are band members can read band data
- ✅ `is_band_member()` uses SECURITY DEFINER to bypass RLS recursion
- ✅ Works immediately after membership is created (same transaction)

**No changes needed** ✓

### Step 4: Test the Fix

Run E2E tests:
```bash
npm run test:e2e -- tests/e2e/auth/join-band.spec.ts
```

**Expected Results**:
- ✅ User 2 can enter invite code
- ✅ User 2 clicks "Join Band"
- ✅ Backend creates membership (already working)
- ✅ Backend increments usage count (already working)
- ✅ UI shows success toast: "You joined {band name}!"
- ✅ UI navigates to `/songs` page
- ✅ User 2 sees band in sidebar
- ✅ User 2 can navigate to Band Members and see User 1

---

## Unit Tests

### Test Suite: SyncRepository.getBand()

**File**: `tests/unit/services/data/SyncRepository.test.ts`

#### Test 1: getBand() fetches from remote when online and caches locally

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncRepository } from '../../../src/services/data/SyncRepository'
import { LocalRepository } from '../../../src/services/data/LocalRepository'
import { RemoteRepository } from '../../../src/services/data/RemoteRepository'
import type { Band } from '../../../src/types/band'

describe('SyncRepository.getBand() - Cloud-First Pattern', () => {
  let syncRepo: SyncRepository
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  const mockBand: Band = {
    id: 'band-123',
    name: 'Test Band',
    description: 'A test band',
    createdBy: 'user-1',
    createdDate: new Date(),
    updatedDate: new Date()
  }

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncRepo = new SyncRepository(localRepo, remoteRepo, /* syncEngine */ null, true)
  })

  it('should fetch from remote when online and band not in local', async () => {
    // Mock remote to return band
    vi.spyOn(remoteRepo, 'getBand').mockResolvedValue(mockBand)
    // Mock local to return null initially
    vi.spyOn(localRepo, 'getBand').mockResolvedValue(null)
    // Mock local addBand to cache the band
    const addBandSpy = vi.spyOn(localRepo, 'addBand').mockResolvedValue(mockBand)

    const result = await syncRepo.getBand('band-123')

    // Assertions
    expect(result).toEqual(mockBand)
    expect(remoteRepo.getBand).toHaveBeenCalledWith('band-123')
    expect(addBandSpy).toHaveBeenCalledWith(mockBand)
  })

  it('should return local band if remote fetch fails', async () => {
    // Mock remote to throw error
    vi.spyOn(remoteRepo, 'getBand').mockRejectedValue(new Error('Network error'))
    // Mock local to return cached band
    vi.spyOn(localRepo, 'getBand').mockResolvedValue(mockBand)

    const result = await syncRepo.getBand('band-123')

    // Assertions
    expect(result).toEqual(mockBand)
    expect(remoteRepo.getBand).toHaveBeenCalledWith('band-123')
    expect(localRepo.getBand).toHaveBeenCalledWith('band-123')
  })

  it('should return null if band not found in remote or local', async () => {
    // Mock both to return null
    vi.spyOn(remoteRepo, 'getBand').mockResolvedValue(null)
    vi.spyOn(localRepo, 'getBand').mockResolvedValue(null)

    const result = await syncRepo.getBand('nonexistent-band')

    expect(result).toBeNull()
  })

  it('should fallback to local when offline', async () => {
    // Create offline repository
    const offlineRepo = new SyncRepository(localRepo, remoteRepo, null, false) // offline

    // Mock local to return band
    vi.spyOn(localRepo, 'getBand').mockResolvedValue(mockBand)
    // Remote should not be called when offline
    const remoteGetBandSpy = vi.spyOn(remoteRepo, 'getBand')

    const result = await offlineRepo.getBand('band-123')

    expect(result).toEqual(mockBand)
    expect(remoteGetBandSpy).not.toHaveBeenCalled()
  })

  it('should use cached local band on subsequent calls', async () => {
    // First call: fetch from remote
    vi.spyOn(remoteRepo, 'getBand').mockResolvedValue(mockBand)
    vi.spyOn(localRepo, 'getBand')
      .mockResolvedValueOnce(null)  // First call: not in local
      .mockResolvedValueOnce(mockBand) // Second call: in local cache
    vi.spyOn(localRepo, 'addBand').mockResolvedValue(mockBand)

    // First call
    const result1 = await syncRepo.getBand('band-123')
    expect(result1).toEqual(mockBand)

    // Second call: should still try remote first (cloud-first pattern)
    // but local will have it cached
    const result2 = await syncRepo.getBand('band-123')
    expect(result2).toEqual(mockBand)
  })
})
```

#### Test 2: getUserMemberships() cloud-first (if implementing Option 2)

```typescript
describe('SyncRepository.getUserMemberships() - Cloud-First Pattern', () => {
  let syncRepo: SyncRepository
  let localRepo: LocalRepository
  let remoteRepo: RemoteRepository

  const mockMemberships: BandMembership[] = [
    {
      id: 'membership-1',
      userId: 'user-123',
      bandId: 'band-1',
      role: 'member',
      joinedDate: new Date(),
      status: 'active',
      permissions: ['member']
    },
    {
      id: 'membership-2',
      userId: 'user-123',
      bandId: 'band-2',
      role: 'admin',
      joinedDate: new Date(),
      status: 'active',
      permissions: ['admin']
    }
  ]

  beforeEach(() => {
    localRepo = new LocalRepository()
    remoteRepo = new RemoteRepository()
    syncRepo = new SyncRepository(localRepo, remoteRepo, null, true)
  })

  it('should fetch fresh memberships from remote when online', async () => {
    // Mock remote to return memberships
    vi.spyOn(remoteRepo, 'getUserMemberships').mockResolvedValue(mockMemberships)
    // Mock local caching
    const addMembershipSpy = vi.spyOn(localRepo, 'addBandMembership')
      .mockResolvedValue(mockMemberships[0])
      .mockResolvedValue(mockMemberships[1])

    const result = await syncRepo.getUserMemberships('user-123')

    expect(result).toEqual(mockMemberships)
    expect(remoteRepo.getUserMemberships).toHaveBeenCalledWith('user-123')
    expect(addMembershipSpy).toHaveBeenCalledTimes(2)
  })

  it('should fallback to local if remote fails', async () => {
    // Mock remote to fail
    vi.spyOn(remoteRepo, 'getUserMemberships').mockRejectedValue(new Error('Network error'))
    // Mock local to return cached memberships
    vi.spyOn(localRepo, 'getUserMemberships').mockResolvedValue(mockMemberships)

    const result = await syncRepo.getUserMemberships('user-123')

    expect(result).toEqual(mockMemberships)
    expect(localRepo.getUserMemberships).toHaveBeenCalledWith('user-123')
  })

  it('should use local memberships when offline', async () => {
    const offlineRepo = new SyncRepository(localRepo, remoteRepo, null, false)

    vi.spyOn(localRepo, 'getUserMemberships').mockResolvedValue(mockMemberships)
    const remoteGetMembershipsSpy = vi.spyOn(remoteRepo, 'getUserMemberships')

    const result = await offlineRepo.getUserMemberships('user-123')

    expect(result).toEqual(mockMemberships)
    expect(remoteGetMembershipsSpy).not.toHaveBeenCalled()
  })
})
```

---

## Integration Tests

### Test Suite: Join Band E2E Flow

**File**: `tests/e2e/auth/join-band.spec.ts` (already exists, should pass after fix)

**Key Test Cases**:

1. ✅ New user can join existing band via invite code (main test)
2. ✅ User 2 can see band details immediately after joining
3. ✅ User 2 can see User 1 in band members list
4. ✅ Invalid invite code shows error
5. ✅ User can be member of multiple bands

**Current Status**: Tests fail at navigation step (fixed by this change)

**After Fix**: All tests should pass ✓

---

## Acceptance Criteria

### Must Pass

- [ ] E2E test: "new user can join existing band via invite code" passes
- [ ] Unit test: `getBand()` fetches from remote when online
- [ ] Unit test: `getBand()` falls back to local when remote fails
- [ ] Unit test: `getBand()` uses local when offline
- [ ] Manual test: User 2 successfully joins User 1's band and navigates to `/songs`

### Should Pass (Nice to Have)

- [ ] Unit test: `getUserMemberships()` fetches from remote when online (if implementing Option 2)
- [ ] Performance: Band fetches are cached locally after first remote fetch
- [ ] Offline: Users can access previously fetched bands when offline

---

## Rollback Plan

If the cloud-first pattern causes issues:

### Immediate Rollback

```typescript
// Revert src/services/data/SyncRepository.ts getBand() to local-only:
async getBand(id: string): Promise<Band | null> {
  return this.local.getBand(id)
}
```

### Alternative Fix (if needed)

Add explicit band caching in `joinBandWithCode()`:

```typescript
// src/services/BandMembershipService.ts after creating membership:

// Cache band data for new member
const band = await repository.remote.getBand(inviteCode.bandId)
if (band) {
  await repository.local.addBand(band)
}
```

---

## Performance Considerations

### Network Latency

**Before**: 0ms (local-only read)
**After**: ~50-200ms (remote query + cache write)

**Mitigation**:
- First call queries remote (acceptable for join flow)
- Subsequent calls use cached local data
- Offline mode bypasses remote entirely

### Cache Staleness

**Risk**: Cached band data becomes stale if band is updated elsewhere

**Mitigation**:
- Cloud-first pattern always fetches latest from remote when online
- Users see fresh data on each fetch
- Consider adding cache TTL in future (out of scope for this fix)

---

## Security Considerations

### RLS Policy Verification

**Current Policy** (already in place):
```sql
CREATE POLICY "bands_select_members_or_creator"
  ON public.bands FOR SELECT TO authenticated
  USING (
    is_band_member(id, auth.uid()) OR
    created_by = auth.uid()
  );
```

**Security Properties**:
- ✅ Only band members and creator can read band data
- ✅ `is_band_member()` uses SECURITY DEFINER to avoid RLS recursion
- ✅ Policy enforced at database level (defense in depth)

**No security regressions** from this change ✓

---

## Related Changes Already Implemented

### Backend Fixes (Completed)

1. ✅ **Schema Fix**: Made `invite_codes.expires_at` nullable
   - File: `supabase/migrations/20251106000000_baseline_schema.sql:103`

2. ✅ **RLS Policy Fix**: Changed invite_codes SELECT policy
   - From: Only band members can read codes (catch-22)
   - To: All authenticated users can read codes
   - File: `supabase/migrations/20251106000000_baseline_schema.sql:909-912`

3. ✅ **Postgres Function**: Created `increment_invite_code_usage()`
   - Bypasses RLS restriction for non-admin users
   - File: `supabase/migrations/20251111194800_add_increment_invite_code_usage.sql`

4. ✅ **Service Layer**: Updated `BandMembershipService.joinBandWithCode()`
   - Uses new `incrementInviteCodeUsage()` method
   - File: `src/services/BandMembershipService.ts:148`

**Result**: Backend join operation ✅ FULLY WORKING

---

## Timeline

**Implementation**: 30 minutes
- Update `getBand()`: 10 minutes
- Update `getUserMemberships()` (optional): 10 minutes
- Test and verify: 10 minutes

**Testing**: 20 minutes
- Write unit tests: 15 minutes
- Run E2E tests: 5 minutes

**Total**: ~50 minutes

---

## Success Metrics

### Before Fix

- ❌ E2E test pass rate: 0/5 (all failing)
- ❌ Join success rate: 0% (navigation blocked)
- ❌ User reported issue: "Can't join bands"

### After Fix

- ✅ E2E test pass rate: 5/5 (all passing)
- ✅ Join success rate: 100%
- ✅ User flow: Invite code → Join → Navigate → Success ✓

---

## Documentation Updates

### Update CLAUDE.md

Add note about cloud-first pattern for getBand():

```markdown
## Repository Patterns

### Cloud-First Reads

The following methods use cloud-first pattern (query remote first, fallback to local):
- `getInviteCode()` - For invite code validation
- `getInviteCodeByCode()` - For multi-user invite code lookups
- `getBand()` - **NEW**: For multi-user band access (e.g., after joining via invite)
- `getUserMemberships()` - **OPTIONAL**: For fresh membership status

**Rationale**: Multi-user scenarios require querying Supabase to ensure users can access
data created by others (e.g., bands created by other users).
```

---

**Status**: Ready for implementation ✅

**Estimated Time**: 50 minutes (implementation + testing)

**Risk Level**: Low (well-tested pattern, clear rollback plan)

**Priority**: High (blocks MVP invite code feature)

---

**Last Updated**: 2025-11-11T20:15
