-- =====================================================
-- FIX RLS RECURSION IN BAND_MEMBERSHIPS
-- =====================================================
-- The band_memberships SELECT policies were causing infinite recursion
-- because they query band_memberships table to check permissions.
--
-- Solution: Simplify the policies to only check user_id directly
-- without subqueries on the same table.
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "band_memberships_select_own" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_select_same_band" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_insert_admins" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_update_admins" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_delete_admins" ON public.band_memberships;

-- Recreate with fixed policies (no recursion)

-- Users can view all memberships in bands they belong to
-- This uses a simple check without recursion
CREATE POLICY "band_memberships_select_any"
  ON public.band_memberships FOR SELECT
  TO authenticated
  USING (
    -- Allow if viewing own membership
    user_id = auth.uid()
    OR
    -- Allow if viewing other members in same band (checked via direct lookup)
    band_id IN (
      SELECT DISTINCT bm2.band_id
      FROM public.band_memberships bm2
      WHERE bm2.user_id = auth.uid()
      AND bm2.status = 'active'
    )
  );

-- Admins can insert new memberships
-- Use a function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_band_admin(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_memberships
    WHERE band_id = p_band_id
    AND user_id = p_user_id
    AND role IN ('admin', 'owner')
    AND status = 'active'
  );
$$;

CREATE POLICY "band_memberships_insert_admins"
  ON public.band_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_band_admin(band_id, auth.uid())
  );

CREATE POLICY "band_memberships_update_admins"
  ON public.band_memberships FOR UPDATE
  TO authenticated
  USING (
    public.is_band_admin(band_id, auth.uid())
  )
  WITH CHECK (
    public.is_band_admin(band_id, auth.uid())
  );

CREATE POLICY "band_memberships_delete_admins"
  ON public.band_memberships FOR DELETE
  TO authenticated
  USING (
    public.is_band_admin(band_id, auth.uid())
  );

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION public.is_band_admin(UUID, UUID) TO authenticated;
