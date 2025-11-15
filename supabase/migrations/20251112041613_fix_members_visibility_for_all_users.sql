-- Fix band_memberships SELECT policy to allow ALL band members to see each other
-- Previous policy only allowed band owners to see other members
-- This broke the ability for regular members to see their bandmates

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "memberships_select_own_or_band_owner" ON public.band_memberships;

-- Create helper function with SECURITY DEFINER to check if user belongs to a band
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION public.user_belongs_to_band(check_band_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_memberships
    WHERE band_id = check_band_id
      AND user_id = check_user_id
      AND status = 'active'
  );
$$;

-- Create new policy that allows:
-- 1. Users to see their own memberships (always)
-- 2. Users to see other members' memberships for bands they belong to
CREATE POLICY "memberships_select_for_band_members"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    -- Can see own memberships
    user_id = (select auth.uid())
    OR
    -- Can see other members' memberships for bands you belong to
    -- Uses SECURITY DEFINER function to avoid infinite recursion
    public.user_belongs_to_band(band_id, (select auth.uid()))
  );

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.user_belongs_to_band(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.user_belongs_to_band IS
  'Security-definer function to check if a user belongs to a band. Used by RLS policies to avoid infinite recursion.';

COMMENT ON POLICY "memberships_select_for_band_members" ON public.band_memberships IS
  'Allows users to see their own memberships and all members of bands they belong to.';
