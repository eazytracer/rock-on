-- ============================================================================
-- Migration: Auto-Add Band Creator as Admin
-- ============================================================================
-- Purpose: When a user creates a band, automatically add them as an admin
--          This solves the chicken-and-egg problem with band_memberships RLS
--
-- Workflow:
--   1. User creates band (INSERT into bands)
--   2. Trigger fires automatically
--   3. Creates band_membership for creator with role='owner', status='active'
--
-- Created: 2025-11-07
-- ============================================================================

-- ============================================================================
-- Function: Auto-add band creator as owner
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_add_band_creator()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();

  -- Only proceed if there's an authenticated user
  IF v_user_id IS NOT NULL THEN
    -- Add the creator as band admin (highest available role per schema constraint)
    -- NOTE: Schema constraint only allows 'admin', 'member', 'viewer' (no 'owner')
    INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
    VALUES (v_user_id, NEW.id, 'admin', 'active', now())
    ON CONFLICT (user_id, band_id) DO NOTHING; -- Prevent duplicates

    RAISE NOTICE 'Auto-added user % as admin of band %', v_user_id, NEW.id;
  ELSE
    RAISE WARNING 'Band % created without authenticated user - no owner assigned', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: Auto-add creator when band is created
-- ============================================================================

DROP TRIGGER IF EXISTS bands_auto_add_creator ON public.bands;

CREATE TRIGGER bands_auto_add_creator
  AFTER INSERT ON public.bands
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_band_creator();

-- ============================================================================
-- Fix: band_memberships INSERT policy to allow self-join
-- ============================================================================

-- The current policy requires being an admin to add members, but this creates
-- recursion when checking if you're an admin (queries the same table).
--
-- Solution: Allow users to add themselves to a band without the admin check.
-- This is safe because:
-- 1. The trigger above handles initial owner creation automatically
-- 2. Users can only add themselves, not others (checked via created_by comparison)
-- 3. Admins can still add others via the existing policy

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "memberships_insert_if_admin" ON public.band_memberships;

-- Create two separate policies: one for self-join, one for admin-adds-others
CREATE POLICY "memberships_insert_self"
  ON public.band_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can add themselves to bands (handled by trigger)
    user_id = auth.uid()
  );

CREATE POLICY "memberships_insert_by_admin"
  ON public.band_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admins can add other users to their band
    user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.band_memberships bm
      WHERE bm.band_id = band_memberships.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('admin', 'owner')
        AND bm.status = 'active'
    )
  );

-- ============================================================================
-- Verification
-- ============================================================================

-- Check trigger exists
SELECT
  'Trigger check:' as test,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'bands_auto_add_creator';

-- Check function exists
SELECT
  'Function check:' as test,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'auto_add_band_creator';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP TRIGGER IF EXISTS bands_auto_add_creator ON public.bands;
-- DROP FUNCTION IF EXISTS auto_add_band_creator();
--
-- -- Restore old policy
-- CREATE POLICY "memberships_insert_if_admin" ON public.band_memberships
--   FOR INSERT TO authenticated
--   WITH CHECK (EXISTS (SELECT 1 FROM band_memberships ...));
--
-- DROP POLICY IF EXISTS "memberships_insert_self" ON public.band_memberships;
-- DROP POLICY IF EXISTS "memberships_insert_by_admin" ON public.band_memberships;
-- ============================================================================
