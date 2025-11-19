-- Fix band_memberships SELECT policy to allow users to see all members of their bands
-- Previous policy only allowed users to see their own membership row
-- This prevented band members from seeing each other in the UI

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "memberships_select_own" ON public.band_memberships;

-- Create new policy that allows:
-- 1. Users to see their own memberships (always - needed for join flow)
-- 2. Users to see other members' memberships for bands they belong to
CREATE POLICY "memberships_select_band"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    -- Can see own memberships
    user_id = (select auth.uid())
    OR
    -- Can see other members' memberships for bands you belong to
    EXISTS (
      SELECT 1 FROM public.band_memberships my_membership
      WHERE my_membership.band_id = band_memberships.band_id
        AND my_membership.user_id = (select auth.uid())
        AND my_membership.status = 'active'
    )
  );
