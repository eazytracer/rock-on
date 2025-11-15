-- Fix RLS infinite recursion in band_memberships SELECT policy
-- The previous policy had a circular dependency: it checked band_memberships within the policy FOR band_memberships
-- This caused "infinite recursion detected in policy for relation band_memberships" errors

-- Drop the broken policy
DROP POLICY IF EXISTS "memberships_select_band" ON public.band_memberships;

-- Create corrected policy that checks bands table instead (no circular dependency)
-- Users can see:
-- 1. Their own memberships (always)
-- 2. Other members' memberships for bands they created (checked via bands table)
CREATE POLICY "memberships_select_own_or_band_owner"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    -- Can see own memberships
    user_id = (select auth.uid())
    OR
    -- Can see other members for bands you own
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = (select auth.uid())
    )
  );
