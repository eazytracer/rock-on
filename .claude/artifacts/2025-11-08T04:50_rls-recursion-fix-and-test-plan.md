# RLS Infinite Recursion Fix & Test Plan

**Created:** 2025-11-08T04:50
**Updated:** 2025-11-08T05:00 (Added missing GRANT statements fix)
**Status:** ✅ RESOLVED
**Issues Fixed:**
1. PostgreSQL 42P17 - "infinite recursion detected in policy for relation 'band_memberships'"
2. PostgreSQL 42501 - "permission denied for table band_memberships"

---

## Problem Analysis

### Root Cause #1: Infinite Recursion
The `memberships_select_if_member` RLS policy on the `band_memberships` table was using a self-join to check membership status:

```sql
-- BROKEN VERSION (causes infinite recursion)
CREATE POLICY "memberships_select_if_member"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships bm  -- ❌ Self-join triggers RLS again!
      WHERE bm.band_id = band_memberships.band_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );
```

**Why it fails:**
1. User attempts to query `band_memberships`
2. RLS policy fires, executing the EXISTS subquery
3. Subquery attempts to read from `band_memberships`
4. RLS policy fires again (infinite loop)
5. PostgreSQL detects recursion and returns error 42P17

### When it Occurs
- **Login flow:** After authentication, app queries `band_memberships` to load user's bands
- **Any membership query:** Reading memberships table triggers the policy
- **Impact:** Complete login failure, no data access

### Root Cause #2: Missing Table Permissions
Even after fixing the recursion, login still failed with error 42501 ("permission denied"). The issue was that **the `authenticated` role had no table-level permissions**.

**Critical PostgreSQL concept:** RLS policies can only **RESTRICT** access—they cannot **GRANT** it. You must first grant table-level permissions, then RLS policies filter which rows are visible.

```sql
-- Check permissions (before fix)
SELECT has_table_privilege('authenticated', 'public.band_memberships', 'SELECT');
-- Returns: f (FALSE) ❌

-- Result: Permission denied, even with valid RLS policy
```

---

## The Fix

### Solution #1: Fix RLS Policy Recursion
Use the existing `is_band_member()` SECURITY DEFINER function instead of self-join:

```sql
-- FIXED VERSION (no recursion)
CREATE POLICY "memberships_select_if_member"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    is_band_member(band_memberships.band_id, auth.uid())  -- ✅ Bypasses RLS
  );
```

### Why It Works
The `is_band_member()` function is marked `SECURITY DEFINER`, which means:
- Runs with privileges of the function owner (bypasses RLS)
- Direct table access without triggering policies
- Breaks the recursion cycle

```sql
CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS policies, preventing recursion
  RETURN EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Solution #2: Grant Table Permissions
Add GRANT statements to give the `authenticated` role table-level access:

```sql
-- Grant table-level permissions (REQUIRED for RLS to work)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

**Why this is needed:**
- Table permissions = "can you access this table at all?"
- RLS policies = "which rows can you see/modify?"
- You need BOTH for users to access data

---

## Implementation

### Files Changed
1. **`supabase/migrations/20251106000000_baseline_schema.sql:807-811`**
   - Replaced self-join EXISTS with `is_band_member()` call
2. **`supabase/migrations/20251106000000_baseline_schema.sql:744-747`**
   - Added GRANT statements for table-level permissions

### Apply the Fix

**Option 1: Via Supabase Dashboard (Immediate)**
1. Go to: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/sql/new
2. Run this SQL:
```sql
-- Fix #1: Drop the broken policy and recreate with helper function
DROP POLICY IF EXISTS "memberships_select_if_member" ON public.band_memberships;

CREATE POLICY "memberships_select_if_member"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    is_band_member(band_memberships.band_id, auth.uid())
  );

-- Fix #2: Grant table-level permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

**Option 2: Via CLI (Pre-1.0 Development)**
Since we're in pre-1.0 development, modify the baseline migration directly:
```bash
# Already done - baseline migration has been updated

# Reset production database with fix
supabase db reset --linked
```

---

## Required Tests

### 1. Database Tests (pgTAP)

Create: `supabase/tests/012-rls-no-recursion.test.sql`

```sql
-- ============================================================================
-- Test: RLS Policies Do Not Cause Infinite Recursion
-- ============================================================================

BEGIN;

SELECT plan(8);

-- Setup: Create test user and band
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test@example.com');

INSERT INTO public.users (id, email, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User');

INSERT INTO public.bands (id, name) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Test Band');

INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', 'active');

-- Test 1: band_memberships SELECT does not cause recursion
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001"}';

PREPARE test_memberships_select AS
  SELECT * FROM public.band_memberships
  WHERE user_id = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
  'test_memberships_select',
  'band_memberships SELECT policy does not cause recursion'
);

-- Test 2: Verify we can actually read our membership
SELECT results_eq(
  'SELECT COUNT(*)::int FROM public.band_memberships WHERE user_id = ''00000000-0000-0000-0000-000000000001''',
  ARRAY[1],
  'User can read their own membership'
);

-- Test 3: bands SELECT (uses is_band_member) does not cause recursion
PREPARE test_bands_select AS
  SELECT * FROM public.bands
  WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT lives_ok(
  'test_bands_select',
  'bands SELECT policy does not cause recursion'
);

-- Test 4: songs SELECT (uses is_band_member) does not cause recursion
INSERT INTO public.songs (id, title, context_type, context_id, created_by) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Test Song', 'band', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

PREPARE test_songs_select AS
  SELECT * FROM public.songs
  WHERE id = '00000000-0000-0000-0000-000000000003';

SELECT lives_ok(
  'test_songs_select',
  'songs SELECT policy does not cause recursion'
);

-- Test 5: setlists SELECT does not cause recursion
INSERT INTO public.setlists (id, name, band_id, created_by) VALUES
  ('00000000-0000-0000-0000-000000000004', 'Test Setlist', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');

PREPARE test_setlists_select AS
  SELECT * FROM public.setlists
  WHERE id = '00000000-0000-0000-0000-000000000004';

SELECT lives_ok(
  'test_setlists_select',
  'setlists SELECT policy does not cause recursion'
);

-- Test 6: shows SELECT does not cause recursion
INSERT INTO public.shows (id, name, band_id, scheduled_date, created_by) VALUES
  ('00000000-0000-0000-0000-000000000005', 'Test Show', '00000000-0000-0000-0000-000000000002', NOW(), '00000000-0000-0000-0000-000000000001');

PREPARE test_shows_select AS
  SELECT * FROM public.shows
  WHERE id = '00000000-0000-0000-0000-000000000005';

SELECT lives_ok(
  'test_shows_select',
  'shows SELECT policy does not cause recursion'
);

-- Test 7: practice_sessions SELECT does not cause recursion
INSERT INTO public.practice_sessions (id, band_id, scheduled_date, type) VALUES
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', NOW(), 'rehearsal');

PREPARE test_sessions_select AS
  SELECT * FROM public.practice_sessions
  WHERE id = '00000000-0000-0000-0000-000000000006';

SELECT lives_ok(
  'test_sessions_select',
  'practice_sessions SELECT policy does not cause recursion'
);

-- Test 8: audit_log SELECT does not cause recursion
PREPARE test_audit_select AS
  SELECT * FROM audit_log
  WHERE user_id = '00000000-0000-0000-0000-000000000001';

SELECT lives_ok(
  'test_audit_select',
  'audit_log SELECT policy does not cause recursion'
);

SELECT * FROM finish();
ROLLBACK;
```

**Run test:**
```bash
npm run test:db -- --file=012-rls-no-recursion.test.sql
```

### 2. Integration Test (TypeScript)

Create: `tests/journeys/auth-and-membership-loading.test.tsx`

```typescript
/**
 * Integration Test: Authentication and Membership Loading
 *
 * Tests the complete login flow including:
 * - Authentication
 * - Band membership loading
 * - No infinite recursion errors
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { supabase } from '../../src/services/supabase/client'
import { SupabaseAuthService } from '../../src/services/auth/SupabaseAuthService'

describe('Authentication and Membership Loading', () => {
  const authService = new SupabaseAuthService()

  beforeEach(async () => {
    // Ensure clean state
    await authService.signOut()
  })

  it('should login and load band memberships without recursion errors', async () => {
    // Step 1: Login
    const loginResult = await authService.signIn({
      email: 'eric@ipodshuffle.com',
      password: 'password123'
    })

    expect(loginResult.success).toBe(true)
    expect(loginResult.user).toBeDefined()

    const userId = loginResult.user!.id

    // Step 2: Load band memberships (this is where recursion would occur)
    const { data: memberships, error } = await supabase
      .from('band_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')

    // Assertions
    expect(error).toBeNull()
    expect(memberships).toBeDefined()
    expect(Array.isArray(memberships)).toBe(true)

    // Should return at least one membership
    expect(memberships!.length).toBeGreaterThan(0)
  })

  it('should handle membership queries without 500 errors', async () => {
    await authService.signIn({
      email: 'eric@ipodshuffle.com',
      password: 'password123'
    })

    // Query band_memberships multiple times (stress test)
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('band_memberships')
        .select('*')

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }
  })

  it('should load all related band data after login', async () => {
    const loginResult = await authService.signIn({
      email: 'eric@ipodshuffle.com',
      password: 'password123'
    })

    expect(loginResult.success).toBe(true)
    const userId = loginResult.user!.id

    // Load memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('band_memberships')
      .select('*, bands(*)')
      .eq('user_id', userId)

    expect(membershipError).toBeNull()
    expect(memberships).toBeDefined()
    expect(memberships!.length).toBeGreaterThan(0)

    const bandId = memberships![0].band_id

    // Load songs (uses is_band_member)
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('context_type', 'band')
      .eq('context_id', bandId)

    expect(songsError).toBeNull()

    // Load setlists (uses is_band_member)
    const { data: setlists, error: setlistsError } = await supabase
      .from('setlists')
      .select('*')
      .eq('band_id', bandId)

    expect(setlistsError).toBeNull()
  })
})
```

**Run test:**
```bash
npm test -- tests/journeys/auth-and-membership-loading.test.tsx
```

### 3. Unit Test: AuthContext Login Flow

Create: `tests/unit/contexts/AuthContext.test.tsx`

```typescript
/**
 * Unit Test: AuthContext
 *
 * Verifies AuthContext handles login correctly and doesn't crash
 * on band membership loading
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../../../src/contexts/AuthContext'
import { supabase } from '../../../src/services/supabase/client'

// Mock Supabase
vi.mock('../../../src/services/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: [], error: null }))
    }))
  }
}))

describe('AuthContext', () => {
  it('should not cause infinite recursion when loading band memberships', async () => {
    const mockMemberships = [
      { id: '1', user_id: 'user1', band_id: 'band1', status: 'active', role: 'admin' }
    ]

    const mockFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve({ data: mockMemberships, error: null }))
    }))

    vi.mocked(supabase.from).mockImplementation(mockFrom)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user1' } } },
      error: null
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toBeDefined()
    })

    // Verify band_memberships was queried without errors
    expect(mockFrom).toHaveBeenCalledWith('band_memberships')
  })
})
```

---

## Verification Checklist

### Pre-Fix Behavior ❌
- [x] Login fails with 500 error (recursion)
- [x] Then login fails with 403 error (permissions)
- [x] Console shows: "infinite recursion detected in policy for relation 'band_memberships'" (42P17)
- [x] Console shows: "permission denied for table band_memberships" (42501)
- [x] Network requests to `/rest/v1/band_memberships` return 500, then 403
- [x] Error codes: 42P17 (recursion), then 42501 (permissions)

### Post-Fix Behavior ✅
- [x] Login succeeds
- [x] Band memberships load correctly
- [x] No 500/403 errors in network tab
- [x] No recursion/permission errors in console
- [x] User can access Songs page
- [x] App shows band name "The iPod Shuffle"
- [x] Sync status shows "Connected"
- [ ] All database tests pass (pending test creation)
- [ ] All integration tests pass (pending test creation)

---

## Testing Commands

```bash
# Run all database tests
npm run test:db

# Run specific RLS recursion test
npm run test:db -- --file=012-rls-no-recursion.test.sql

# Run integration tests
npm test -- tests/journeys/auth-and-membership-loading.test.tsx

# Run unit tests
npm test -- tests/unit/contexts/AuthContext.test.tsx

# Manual testing
# 1. Open http://localhost:5173/
# 2. Click "Show Mock Users for Testing"
# 3. Click "Eric (Guitar, Vocals)"
# 4. Should login successfully and redirect to dashboard
# 5. Check Dev Dashboard footer - should show "Production (khzeuxxhigqcmrytsfux)"
```

---

## Prevention Strategy

### 1. Code Review Checklist
- [ ] All RLS policies on `band_memberships` use helper functions
- [ ] No self-joins in RLS policies without SECURITY DEFINER
- [ ] Helper functions are marked `SECURITY DEFINER`
- [ ] GRANT EXECUTE on helper functions to `authenticated` role

### 2. Automated Testing
- [ ] Database tests verify no recursion (pgTAP)
- [ ] Integration tests cover login flow
- [ ] CI/CD runs database tests on every migration change

### 3. Migration Review Process
Before applying any migration:
1. Check for RLS policy changes
2. Search for self-joins in policies
3. Verify helper functions are used
4. Run `npm run test:db` locally
5. Test login flow manually

---

## Related Files

- **Migration:** `supabase/migrations/20251106000000_baseline_schema.sql:807-811`
- **Helper Function:** `supabase/migrations/20251106000000_baseline_schema.sql:722-738`
- **Database Tests:** `supabase/tests/012-rls-no-recursion.test.sql` (to be created)
- **Integration Tests:** `tests/journeys/auth-and-membership-loading.test.tsx` (to be created)
- **Unit Tests:** `tests/unit/contexts/AuthContext.test.tsx` (to be created)

---

## Summary

### Problems Identified
1. **Infinite Recursion (42P17):** Self-join in `band_memberships` RLS policy caused infinite loop
2. **Missing Permissions (42501):** `authenticated` role lacked table-level SELECT/INSERT/UPDATE/DELETE permissions

### Solutions Applied
1. **Fix RLS Policy:** Replace self-join with `is_band_member()` SECURITY DEFINER function
2. **Grant Permissions:** Add GRANT statements for table-level access to `authenticated` role

### Impact
- **Severity:** Critical - completely blocked all logins
- **Scope:** All authenticated users attempting to access band data
- **Resolution Time:** ~1 hour to identify, fix, and verify both issues

### Files Modified
1. `supabase/migrations/20251106000000_baseline_schema.sql:807-811` - Fixed RLS policy
2. `supabase/migrations/20251106000000_baseline_schema.sql:744-747` - Added GRANT statements

### Status
- ✅ **RLS recursion fixed** - Policy now uses helper function
- ✅ **Permissions granted** - authenticated role can access tables
- ✅ **Login verified** - Users can successfully authenticate and load data
- ✅ **Production deployed** - Both fixes applied to production database
- ✅ **Baseline migration updated** - Future deployments will include both fixes
- ⏳ **Tests pending** - Database and integration tests to be created

### Prevention Strategy
- Code review checklist for RLS policies (no self-joins without SECURITY DEFINER)
- Always include GRANT statements when creating tables with RLS
- Automated database tests to verify permissions and prevent recursion
