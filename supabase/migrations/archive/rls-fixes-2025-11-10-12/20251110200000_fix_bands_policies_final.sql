-- ============================================================================
-- Fix Bands Policies - Allow Creator to SELECT Newly Created Bands
-- Created: 2025-11-10
-- Description: Fix the chicken-and-egg problem where RETURNING clause fails
--              because user isn't a member yet when band is first created
-- ============================================================================

-- ISSUE: When creating a band with RETURNING clause:
-- 1. INSERT executes (WITH CHECK passes)
-- 2. BEFORE INSERT triggers set created_by
-- 3. RETURNING clause needs to SELECT the row (fails - user not a member yet!)
-- 4. AFTER INSERT trigger adds membership (too late for RETURNING clause)
--
-- SOLUTION: Allow users to SELECT bands they created, even before membership

DROP POLICY IF EXISTS "bands_select_members" ON public.bands;
DROP POLICY IF EXISTS "bands_select_members_or_creator" ON public.bands;

-- New SELECT policy: Users can see bands they're members of OR bands they created
CREATE POLICY "bands_select_members_or_creator"
  ON public.bands FOR SELECT TO authenticated
  USING (
    is_band_member(bands.id, (select auth.uid())) OR
    created_by = (select auth.uid())
  );

-- Ensure INSERT policy exists and is correct
DROP POLICY IF EXISTS "bands_insert_all" ON public.bands;
DROP POLICY IF EXISTS "bands_insert_any_authenticated" ON public.bands;

CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "bands_select_members_or_creator" ON public.bands IS
  'Allow users to SELECT bands they are members of or created (fixes RETURNING clause issue)';

COMMENT ON POLICY "bands_insert_any_authenticated" ON public.bands IS
  'Allow any authenticated user to create a band';
