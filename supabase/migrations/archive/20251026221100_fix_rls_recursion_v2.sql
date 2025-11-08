-- =====================================================
-- FIX RLS RECURSION IN BAND_MEMBERSHIPS (V2)
-- =====================================================
-- Complete rewrite to eliminate ALL recursion
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "band_memberships_select_any" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_insert_admins" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_update_admins" ON public.band_memberships;
DROP POLICY IF EXISTS "band_memberships_delete_admins" ON public.band_memberships;

-- Helper function to check membership (CREATE FIRST before using in policies!)
CREATE OR REPLACE FUNCTION public.user_is_band_member(p_band_id UUID, p_user_id UUID)
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
    AND status = 'active'
  );
$$;

-- Simplest possible policies: NO subqueries on same table

-- Users can view their own memberships
CREATE POLICY "band_memberships_select_own"
  ON public.band_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can view other memberships in same band (uses function to avoid recursion)
CREATE POLICY "band_memberships_select_same_band"
  ON public.band_memberships FOR SELECT
  TO authenticated
  USING (
    public.is_band_admin(band_id, auth.uid())
    OR
    -- Check via security definer function to avoid recursion
    public.user_is_band_member(band_id, auth.uid())
  );

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_is_band_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_band_admin(UUID, UUID) TO authenticated;
