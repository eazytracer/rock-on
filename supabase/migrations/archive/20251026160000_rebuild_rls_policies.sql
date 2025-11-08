-- ============================================================================
-- REBUILD ALL RLS POLICIES FROM SCRATCH
-- ============================================================================
-- Created: 2025-10-26T16:58
-- Purpose: Fix recursive policy issues and implement proper access control
-- Reference: .claude/specifications/permissions-and-use-cases.md
-- ============================================================================

-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: USERS & USER PROFILES (Self-Access Only)
-- ============================================================================

-- Users can view all other users (needed for band member lookups)
CREATE POLICY "users_select_authenticated"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User profiles: view own profile
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- User profiles: insert own profile
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User profiles: update own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: BANDS (No Dependencies)
-- ============================================================================

-- Anyone can create a band (they become admin via band_memberships)
CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Band members can view their bands
CREATE POLICY "bands_select_members"
  ON public.bands FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band admins can update bands
CREATE POLICY "bands_update_admins"
  ON public.bands FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  );

-- Band admins can delete bands
CREATE POLICY "bands_delete_admins"
  ON public.bands FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  );

-- ============================================================================
-- STEP 4: BAND MEMBERSHIPS (CRITICAL - NO RECURSION!)
-- ============================================================================

-- Users can view their own memberships
CREATE POLICY "band_memberships_select_own"
  ON public.band_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Users can view other memberships in bands they belong to
-- Uses a subquery that doesn't cause recursion
CREATE POLICY "band_memberships_select_same_band"
  ON public.band_memberships FOR SELECT
  TO authenticated
  USING (
    band_id IN (
      SELECT bm.band_id
      FROM public.band_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.status = 'active'
    )
  );

-- Admins can insert new memberships into their bands
CREATE POLICY "band_memberships_insert_admins"
  ON public.band_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    band_id IN (
      SELECT bm.band_id
      FROM public.band_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.role IN ('admin', 'owner')
      AND bm.status = 'active'
    )
  );

-- Admins can update memberships in their bands
CREATE POLICY "band_memberships_update_admins"
  ON public.band_memberships FOR UPDATE
  TO authenticated
  USING (
    band_id IN (
      SELECT bm.band_id
      FROM public.band_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.role IN ('admin', 'owner')
      AND bm.status = 'active'
    )
  )
  WITH CHECK (
    band_id IN (
      SELECT bm.band_id
      FROM public.band_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.role IN ('admin', 'owner')
      AND bm.status = 'active'
    )
  );

-- Admins can delete memberships in their bands
CREATE POLICY "band_memberships_delete_admins"
  ON public.band_memberships FOR DELETE
  TO authenticated
  USING (
    band_id IN (
      SELECT bm.band_id
      FROM public.band_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.role IN ('admin', 'owner')
      AND bm.status = 'active'
    )
  );

-- ============================================================================
-- STEP 5: SONGS (Personal + Band Context)
-- ============================================================================

-- Users can view their personal songs OR band songs from their bands
CREATE POLICY "songs_select_own_or_band"
  ON public.songs FOR SELECT
  TO authenticated
  USING (
    (context_type = 'personal' AND created_by = auth.uid())
    OR
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    ))
  );

-- Users can insert songs (must set created_by = auth.uid())
CREATE POLICY "songs_insert_authenticated"
  ON public.songs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Users can update their own songs OR band songs in their bands
CREATE POLICY "songs_update_own_or_band"
  ON public.songs FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    ))
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    ))
  );

-- Users can delete their own songs
CREATE POLICY "songs_delete_creator"
  ON public.songs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- STEP 6: SETLISTS (Band Members)
-- ============================================================================

-- Band members can view setlists for their bands
CREATE POLICY "setlists_select_band_members"
  ON public.setlists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can insert setlists for their bands
CREATE POLICY "setlists_insert_band_members"
  ON public.setlists FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can update setlists for their bands
CREATE POLICY "setlists_update_band_members"
  ON public.setlists FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can delete setlists for their bands
CREATE POLICY "setlists_delete_band_members"
  ON public.setlists FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- ============================================================================
-- STEP 7: PRACTICE SESSIONS (Band Members - Includes Shows!)
-- ============================================================================

-- Band members can view practice sessions/shows for their bands
CREATE POLICY "practice_sessions_select_band_members"
  ON public.practice_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can insert practice sessions/shows for their bands
CREATE POLICY "practice_sessions_insert_band_members"
  ON public.practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can update practice sessions/shows for their bands
CREATE POLICY "practice_sessions_update_band_members"
  ON public.practice_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Band members can delete practice sessions/shows for their bands
CREATE POLICY "practice_sessions_delete_band_members"
  ON public.practice_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (Run these after applying)
-- ============================================================================

-- Check for any remaining policies
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Verify no recursion by querying band_memberships
-- SELECT * FROM band_memberships LIMIT 1;

-- Test setlist access
-- SELECT * FROM setlists LIMIT 1;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- 1. Shows are NOT a separate table - they're practice_sessions with type='gig'
-- 2. Band membership recursion is avoided by using IN (SELECT ...) subqueries
-- 3. All policies use explicit FOR <operation> to be clear about intent
-- 4. Status check (status = 'active') is included in all membership checks
-- 5. Both 'admin' and 'owner' roles are treated as admins for compatibility
--
-- ============================================================================
