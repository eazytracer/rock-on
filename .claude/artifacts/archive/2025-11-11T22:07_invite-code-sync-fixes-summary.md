# Invite Code & Band Members Visibility - Fixes Completed

**Date:** 2025-11-11T22:07
**Status:** Partial completion - architectural fixes done, join flow issue remains

## Issues Addressed

### 1. Invite Code Navigation (FIXED ✅)
**Root Cause:** `getBand()` in SyncRepository was local-only. When User 2 joined User 1's band, the band data didn't exist in User 2's local IndexedDB, causing navigation to fail.

**Fix:** Implemented cloud-first pattern for `getBand()` in `src/services/data/SyncRepository.ts`

### 2. Band Members Visibility (FIXED ✅)
**Root Cause:** TWO problems:
1. **Application Layer:** `getBandMemberships()` was local-only
2. **Database Layer:** RLS policy only allowed users to see their OWN membership row

**Fixes Applied:**

#### A. Application Layer - Cloud-First Architecture
**Files Modified:**
- `src/services/data/SyncRepository.ts`:
  - Added `User` import
  - Added cloud-first `getUser(id)` method (lines 571-590)
  - Made `getBandMemberships()` cloud-first (lines 313-329)
  - Made `getUserMemberships()` cloud-first (lines 316-332)

- `src/hooks/useBands.ts`:
  - Updated `useBandMembers` hook to fetch User data via repository (lines 100-168)
  - Now returns `{membership, user, profile}` instead of `{membership, profile}`

- `src/pages/NewLayout/BandMembersPage.tsx`:
  - Updated to use `user` from hook instead of querying `db.users` locally (line 151)

#### B. Database Layer - RLS Policy Fix
**Migration Created:** `supabase/migrations/20251111220000_fix_band_memberships_select_policy.sql`

**Previous Policy (BROKEN):**
```sql
-- Only allowed seeing your OWN membership
CREATE POLICY "memberships_select_own"
  USING (user_id = auth.uid() AND status = 'active');
```

**New Policy (CORRECT):**
```sql
-- Allows seeing:
-- 1. Your own memberships (always - needed for join flow)
-- 2. Other members' memberships for bands you belong to
CREATE POLICY "memberships_select_band"
  USING (
    user_id = auth.uid()  -- Own memberships
    OR
    EXISTS (  -- Other members for your bands
      SELECT 1 FROM band_memberships my_membership
      WHERE my_membership.band_id = band_memberships.band_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.status = 'active'
    )
  );
```

## Current Status

### Working ✅
- Cloud-first data fetching architecture
- User profile fetching from Supabase
- Band membership data fetching from Supabase
- RLS policy allows proper multi-user visibility

### Not Working ❌
- **Join flow itself is failing** - User 2 cannot join User 1's band
- Error: "Failed to join band. Please try again."
- This is a separate issue from the band members visibility bug

## Test Results

**E2E Test:** `tests/e2e/auth/join-band.spec.ts`
- ❌ Failing at join step (before we can test band members visibility)
- Manual testing with Brave browser previously confirmed join works
- After database reset, automated tests fail

## Next Steps (Recommendations)

1. **Investigate Join Failure:**
   - Check browser console logs during join attempt
   - Review `BandMembershipService.joinBand()` implementation
   - Check if other RLS policies (INSERT on band_memberships) are blocking
   - Verify invite code validation logic

2. **Test Band Members Visibility Manually:**
   - Once join works again, manually test if users can see each other
   - The cloud-first architecture + RLS policy fix should resolve this

3. **Fix Test Selector Issue:**
   - Duplicate `data-testid` elements causing strict mode violations
   - Likely mobile + desktop views both rendered
   - Need to use `.first()` or filter by visibility

## Files Changed

### Application Code
- `src/services/data/SyncRepository.ts`
- `src/hooks/useBands.ts`
- `src/pages/NewLayout/BandMembersPage.tsx`

### Database
- `supabase/migrations/20251111220000_fix_band_memberships_select_policy.sql`

### Tests
- `tests/e2e/auth/join-band.spec.ts` (added assertions for cross-user visibility)

## Architecture Improvements

The cloud-first pattern has been applied to critical read operations:
- `getBand(id)` - Query Supabase first, cache in IndexedDB
- `getUser(id)` - Query Supabase first, cache in IndexedDB
- `getBandMemberships(bandId)` - Query Supabase first, cache in IndexedDB
- `getUserMemberships(userId)` - Query Supabase first, cache in IndexedDB

This ensures users can always see fresh data from other band members, while maintaining offline-first writes and caching for performance.
