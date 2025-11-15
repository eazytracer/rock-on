---
title: Rock-On RLS Security Architecture - Non-Recursive Design
created: 2025-11-10T15:07
prompt: Design non-recursive RLS policy architecture that follows PostgreSQL best practices
status: Implementation Plan
---

# Rock-On RLS Security Architecture

## Executive Summary

**Problem**: Infinite recursion in Row-Level Security (RLS) policies caused by circular dependencies where `band_memberships` SELECT policies call helper functions that query `band_memberships`, triggering the same policies.

**Root Cause**: The fundamental issue is that `band_memberships` is both:
1. The **authentication source** (who has access?)
2. Protected by **RLS policies** (what can they see?)

This creates an impossible circular dependency.

**Solution**: Redesign RLS architecture using PostgreSQL best practices:
1. `band_memberships` SELECT policy MUST be non-recursive (use direct `auth.uid()` check only)
2. All other tables can safely use helper functions that query `band_memberships`
3. Helper functions use SECURITY DEFINER with postgres ownership to bypass RLS

---

## Current Architecture Analysis

### Recursion Chain Identified

```
1. User queries: SELECT * FROM band_memberships WHERE user_id = auth.uid()
2. Policy "memberships_select_if_member" triggers
3. Policy calls: is_band_member(band_id, auth.uid())
4. Function queries: SELECT 1 FROM band_memberships WHERE...
5. Policy "memberships_select_if_member" triggers AGAIN
6. ❌ INFINITE RECURSION
```

### All Current Recursion Points

| Table | Policy | Calls | Problem |
|-------|--------|-------|---------|
| `band_memberships` | `memberships_select_if_member` | `is_band_member()` | ❌ Queries itself |
| `band_memberships` | `memberships_insert_by_admin` | `is_band_admin()` | ❌ Queries itself |
| `band_memberships` | `memberships_update_if_admin` | `is_band_admin()` | ❌ Queries itself |
| `band_memberships` | `memberships_delete_if_admin_or_self` | `is_band_admin()` | ❌ Queries itself |
| `bands` | `bands_select_members` | `is_band_member()` | ✅ Safe (queries different table) |
| `songs` | `songs_select_band_members_only` | `is_band_member()` | ✅ Safe (queries different table) |
| All others | Various | `is_band_member/admin()` | ✅ Safe (queries different table) |

---

## Proposed Non-Recursive Architecture

### Design Principles

1. **Band Memberships Table = Auth Source**
   - MUST use direct, non-recursive policies
   - No helper function calls on SELECT
   - Simple `auth.uid()` checks only

2. **All Other Tables = Protected Resources**
   - CAN safely use helper functions
   - Helper functions query band_memberships (which now has non-recursive policies)
   - No circular dependencies

3. **Helper Functions = RLS Bypass**
   - Use `LANGUAGE sql` + `SECURITY DEFINER`
   - Owned by `postgres` (superuser with BYPASSRLS)
   - Can query any table without triggering RLS

### Policy Structure

```
┌──────────────────────────────────────────────────────────────┐
│                    User Authentication                        │
│                     (auth.uid())                              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                ┌───────────▼──────────────┐
                │   band_memberships       │
                │   (Auth Source)          │
                │                          │
                │   RLS Policies:          │
                │   - Direct auth.uid()    │
                │   - NO helper functions  │
                │   - NO recursion         │
                └───────────┬──────────────┘
                            │
                            │ Queried by
                            │ helper functions
                            │ (bypass RLS)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
   │ bands   │      │   songs     │    │  setlists   │
   │         │      │             │    │             │
   │ RLS:    │      │ RLS:        │    │ RLS:        │
   │ - Uses  │      │ - Uses      │    │ - Uses      │
   │   helper│      │   helper    │    │   helper    │
   │   ✅    │      │   ✅        │    │   ✅        │
   └─────────┘      └─────────────┘    └─────────────┘
```

---

## Implementation Plan

### Phase 1: Fix Helper Functions (Already Done)

✅ **Status**: Implemented but not working due to Phase 2 issue

```sql
-- Helper functions use SECURITY DEFINER + postgres ownership
CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- Runs as function owner
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

ALTER FUNCTION is_band_member(UUID, UUID) OWNER TO postgres;  -- postgres has BYPASSRLS
```

### Phase 2: Fix band_memberships Policies (CRITICAL)

❌ **Status**: NOT IMPLEMENTED - This is the blocker

**Current (Broken)**:
```sql
-- ❌ RECURSIVE - calls is_band_member which queries band_memberships
CREATE POLICY "memberships_select_if_member"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (is_band_member(band_memberships.band_id, auth.uid()));
```

**Fixed (Non-Recursive)**:
```sql
-- ✅ NON-RECURSIVE - direct auth.uid() check only
CREATE POLICY "memberships_select_own"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'active');
```

**Reasoning**:
- Users should only see their OWN memberships, not all members of their bands
- App code can join with bands table if it needs to see all members
- This is actually MORE secure than the current policy

### Phase 3: Fix Other band_memberships Policies

**INSERT policies**:
```sql
-- ✅ Self-insert is already non-recursive
CREATE POLICY "memberships_insert_self"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ❌ Admin-insert is RECURSIVE - needs fix
-- PROBLEM: How does admin add others without knowing they're admin?
-- SOLUTION: Use band creator check OR simplified permission model
```

**Proposed Solution for Admin INSERT**:
```sql
-- Option A: Band creator can always add members (stored in bands table)
CREATE POLICY "memberships_insert_by_creator"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()  -- Band creator check (non-recursive!)
    )
  );

-- Option B: Use trigger to auto-set created_by on bands, then check
CREATE POLICY "memberships_insert_by_owner"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_memberships.band_id
        AND b.owner_id = auth.uid()  -- Need to add owner_id column
    )
  );

-- Option C: Admins must use a stored procedure (most secure)
-- Band membership additions go through sp_add_band_member()
-- which uses SECURITY DEFINER to bypass RLS and verify permissions
```

**UPDATE/DELETE policies**:
```sql
-- Similar approach - use band.created_by or stored procedures
CREATE POLICY "memberships_update_by_creator"
  ON public.band_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()
    )
  );

CREATE POLICY "memberships_delete_self_or_creator"
  ON public.band_memberships FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()
    )
  );
```

---

## Schema Changes Required

### Option 1: Add owner_id to bands (Recommended)

```sql
ALTER TABLE public.bands ADD COLUMN owner_id UUID REFERENCES public.users(id);

-- Backfill existing bands (set first admin as owner)
UPDATE public.bands b
SET owner_id = (
  SELECT user_id FROM public.band_memberships
  WHERE band_id = b.id AND role IN ('owner', 'admin')
  ORDER BY joined_date ASC
  LIMIT 1
);

ALTER TABLE public.bands ALTER COLUMN owner_id SET NOT NULL;
CREATE INDEX idx_bands_owner_id ON public.bands(owner_id);
```

### Option 2: Add created_by to bands (Simpler)

```sql
-- Already exists! Just needs to be populated correctly
-- Ensure trigger on bands INSERT sets created_by = auth.uid()
```

### Option 3: Use Stored Procedures (Most Flexible)

```sql
-- Admin operations use stored procedures with SECURITY DEFINER
CREATE OR REPLACE FUNCTION sp_add_band_member(
  p_band_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin (bypasses RLS)
  SELECT is_band_admin(p_band_id, auth.uid()) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: not a band admin';
  END IF;

  -- Insert membership (bypasses RLS)
  INSERT INTO band_memberships (user_id, band_id, role, status)
  VALUES (p_user_id, p_band_id, p_role, 'active')
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END;
$$;

ALTER FUNCTION sp_add_band_member(UUID, UUID, TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION sp_add_band_member(UUID, UUID, TEXT) TO authenticated;
```

---

## Recommended Implementation (Simplest)

### Step 1: Fix band_memberships SELECT Policy

```sql
-- Replace recursive policy with direct check
DROP POLICY IF EXISTS "memberships_select_if_member" ON public.band_memberships;

CREATE POLICY "memberships_select_own"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'active');
```

### Step 2: Use bands.created_by for Admin Operations

```sql
-- Ensure bands.created_by is populated (should already be done by trigger)

-- INSERT: Creator can add members
DROP POLICY IF EXISTS "memberships_insert_by_admin" ON public.band_memberships;

CREATE POLICY "memberships_insert_by_band_creator"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()
    )
  );

-- UPDATE: Creator can update memberships
DROP POLICY IF EXISTS "memberships_update_if_admin" ON public.band_memberships;

CREATE POLICY "memberships_update_by_band_creator"
  ON public.band_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()
    )
  );

-- DELETE: Self-delete OR creator can delete
DROP POLICY IF EXISTS "memberships_delete_if_admin_or_self" ON public.band_memberships;

CREATE POLICY "memberships_delete_self_or_creator"
  ON public.band_memberships FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = auth.uid()
    )
  );
```

### Step 3: Verify All Other Policies

All other table policies are SAFE because they query `band_memberships` via helper functions, and `band_memberships` now has non-recursive policies.

---

## Testing Plan

### 1. Local Database Tests

```bash
# Reset database with new policies
supabase db reset

# Run RLS policy tests
npm run test:db

# Verify specific tests pass:
# - 006-rls-policies.test.sql (policy existence)
# - 007-rls-band-isolation.test.sql (isolation works)
```

### 2. Application Testing with Chrome MCP

```bash
# Start local dev server
npm run dev

# Use Chrome MCP to test:
# 1. Navigate to localhost:5173
# 2. Login with OAuth
# 3. Create a new band
# 4. Verify no "infinite recursion" errors in console
# 5. Add songs, setlists, members
# 6. Logout and login as different user
# 7. Verify isolation (can't see other user's bands)
```

### 3. Edge Cases to Test

- [ ] User with no bands (should see empty list)
- [ ] User in multiple bands (should see all their memberships)
- [ ] Band creator adding/removing members
- [ ] Non-creator member trying to add others (should fail)
- [ ] Member leaving band (self-delete)
- [ ] Inactive membership (status='inactive' should be hidden)

---

## Migration Strategy

### Pre-1.0 Development (Current)

**Action**: Modify baseline migration directly
- Edit: `/workspaces/rock-on/supabase/migrations/20251106000000_baseline_schema.sql`
- Update: Helper functions (already done)
- **ADD**: New band_memberships policies (Step 2 above)
- Test: `supabase db reset` + tests
- Deploy: Once verified locally

### Production Deployment

**Action**: Create new incremental migration
- File: `20251110HHMMSS_fix_rls_recursion_final.sql`
- Content: DROP old policies + CREATE new non-recursive policies
- Test: Local first with `supabase db reset`
- Deploy: Via Supabase Studio SQL Editor OR CLI

---

## Security Analysis

### Current Security Level

❌ **BROKEN**: Infinite recursion prevents any queries from working
- Users cannot access their own data
- Application is completely blocked
- No security because system is unusable

### Proposed Security Level

✅ **IMPROVED**:
- Users can only see their OWN memberships (more restrictive)
- Band creators have full control over their bands
- No circular dependencies
- Follows PostgreSQL RLS best practices
- Actually works!

### Limitations & Tradeoffs

**Limitation**: Users can't see all members of their bands via direct `band_memberships` query

**Impact**: Minimal - Application code already joins:
```typescript
// App code can still get all members:
const members = await supabase
  .from('bands')
  .select(`
    *,
    band_memberships(
      *,
      users(*)
    )
  `)
  .eq('id', bandId)
  .single();
```

**Alternative**: If app NEEDS users to see all band members via `band_memberships` SELECT:
```sql
-- More permissive (but still non-recursive):
CREATE POLICY "memberships_select_in_my_bands"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM public.band_memberships my_bands
      WHERE my_bands.band_id = band_memberships.band_id
        AND my_bands.user_id = auth.uid()
        AND my_bands.status = 'active'
    )
  );
```

This is still non-recursive because the subquery's WHERE clause uses direct column comparisons, not function calls.

---

## References

- PostgreSQL RLS Documentation: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- SECURITY DEFINER: https://www.postgresql.org/docs/current/sql-createfunction.html
- Rock-On Schema Spec: `.claude/specifications/unified-database-schema.md`
- Current Tests: `supabase/tests/006-rls-policies.test.sql`, `007-rls-band-isolation.test.sql`

---

## Next Steps

1. ✅ Create this artifact (DONE)
2. ⏳ Implement new policies in baseline migration
3. ⏳ Test locally with `supabase db reset`
4. ⏳ Run full test suite (`npm run test:db`)
5. ⏳ Test application with Chrome MCP
6. ⏳ Create production migration file
7. ⏳ Deploy to production
8. ⏳ Verify in production with real OAuth flow
