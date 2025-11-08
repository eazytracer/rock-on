-- ============================================================================
-- Migration: Fix RLS Infinite Recursion in band_memberships
-- ============================================================================
-- Purpose: Eliminate infinite recursion when checking admin privileges
--
-- Problem: memberships_insert_by_admin policy queries band_memberships to check
--          if user is admin, which triggers SELECT policy, which queries
--          band_memberships again → infinite recursion
--
-- Solution: Create SECURITY DEFINER function that bypasses RLS to check admin status
--
-- Created: 2025-11-07
-- ============================================================================

-- ============================================================================
-- Helper Function: Check if user is admin (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_band_admin(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER means this runs with the privileges of the function owner
  -- This bypasses RLS policies, preventing recursion
  RETURN EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION is_band_admin(UUID, UUID) TO authenticated;

-- ============================================================================
-- Recreate INSERT Policies Using Helper Function
-- ============================================================================

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "memberships_insert_self" ON public.band_memberships;
DROP POLICY IF EXISTS "memberships_insert_by_admin" ON public.band_memberships;

-- Policy 1: Users can add themselves to bands
-- (Primarily used by the auto_add_band_creator trigger)
CREATE POLICY "memberships_insert_self"
  ON public.band_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Policy 2: Admins can add other users to their band
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "memberships_insert_by_admin"
  ON public.band_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id != auth.uid() AND
    is_band_admin(band_memberships.band_id, auth.uid())
  );

-- ============================================================================
-- Also Fix Other Policies That Query band_memberships
-- ============================================================================

-- These policies also have the potential for recursion, though less likely
-- Let's use the helper function for consistency

DROP POLICY IF EXISTS "memberships_update_if_admin" ON public.band_memberships;
CREATE POLICY "memberships_update_if_admin"
  ON public.band_memberships
  FOR UPDATE TO authenticated
  USING (
    is_band_admin(band_memberships.band_id, auth.uid())
  );

DROP POLICY IF EXISTS "memberships_delete_if_admin_or_self" ON public.band_memberships;
CREATE POLICY "memberships_delete_if_admin_or_self"
  ON public.band_memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    is_band_admin(band_memberships.band_id, auth.uid())
  );

-- Note: memberships_select_if_member doesn't cause recursion because it only
-- checks membership, not admin status. We'll leave it as-is for now.

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Helper function check:' as test,
       proname as function_name,
       prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'is_band_admin';

SELECT 'Policy check:' as test,
       polname as policy_name
FROM pg_policy
WHERE polrelid = 'band_memberships'::regclass
ORDER BY polname;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP FUNCTION IF EXISTS is_band_admin(UUID, UUID);
--
-- -- Restore old policies from migration 20251107000003_auto_add_band_creator.sql
-- CREATE POLICY "memberships_insert_self" ON public.band_memberships
--   FOR INSERT TO authenticated
--   WITH CHECK (user_id = auth.uid());
--
-- CREATE POLICY "memberships_insert_by_admin" ON public.band_memberships
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     user_id != auth.uid() AND
--     EXISTS (SELECT 1 FROM public.band_memberships bm ...)
--   );
-- ... (restore other policies)
-- ============================================================================
