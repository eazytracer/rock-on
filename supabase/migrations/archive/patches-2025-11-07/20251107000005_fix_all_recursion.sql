-- ============================================================================
-- Migration: Fix ALL RLS Recursion (Songs and Other Tables)
-- ============================================================================
-- Purpose: Extend recursion fix to ALL policies that query band_memberships
--
-- Problem: Not just band_memberships policies cause recursion - any policy
--          that queries band_memberships also triggers the SELECT policy,
--          which queries band_memberships again → infinite recursion
--
-- Solution: Create SECURITY DEFINER helper function for membership checks
--           and use it in ALL policies across ALL tables
--
-- Created: 2025-11-07
-- ============================================================================

-- ============================================================================
-- Helper Function: Check if user is member of band (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER means this runs with the privileges of the function owner
  -- This bypasses RLS policies, preventing recursion
  RETURN EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION is_band_member(UUID, UUID) TO authenticated;

-- ============================================================================
-- Recreate ALL Songs Policies Using Helper Functions
-- ============================================================================

-- Drop existing songs policies
DROP POLICY IF EXISTS "songs_select_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_update_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_band_admins_only" ON public.songs;

-- SELECT: Only band members can see band songs
CREATE POLICY "songs_select_band_members_only"
  ON public.songs FOR SELECT TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, auth.uid())
  );

-- INSERT: Only band members can create songs
CREATE POLICY "songs_insert_band_members_only"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, auth.uid())
  );

-- UPDATE: Only band members can update songs
CREATE POLICY "songs_update_band_members_only"
  ON public.songs FOR UPDATE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, auth.uid())
  )
  WITH CHECK (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, auth.uid())
  );

-- DELETE: Only band admins can delete songs
CREATE POLICY "songs_delete_band_admins_only"
  ON public.songs FOR DELETE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_admin(songs.context_id::uuid, auth.uid())
  );

-- ============================================================================
-- Recreate Setlists Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "setlists_select_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_insert_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_update_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_delete_if_creator_or_admin" ON public.setlists;

CREATE POLICY "setlists_select_if_member"
  ON public.setlists FOR SELECT TO authenticated
  USING (is_band_member(setlists.band_id, auth.uid()));

CREATE POLICY "setlists_insert_if_member"
  ON public.setlists FOR INSERT TO authenticated
  WITH CHECK (is_band_member(setlists.band_id, auth.uid()));

CREATE POLICY "setlists_update_if_member"
  ON public.setlists FOR UPDATE TO authenticated
  USING (is_band_member(setlists.band_id, auth.uid()));

CREATE POLICY "setlists_delete_if_creator_or_admin"
  ON public.setlists FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    is_band_admin(setlists.band_id, auth.uid())
  );

-- ============================================================================
-- Recreate Shows Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "shows_select_if_member" ON public.shows;
DROP POLICY IF EXISTS "shows_insert_if_member" ON public.shows;
DROP POLICY IF EXISTS "shows_update_if_member" ON public.shows;
DROP POLICY IF EXISTS "shows_delete_if_creator" ON public.shows;

CREATE POLICY "shows_select_if_member"
  ON public.shows FOR SELECT TO authenticated
  USING (is_band_member(shows.band_id, auth.uid()));

CREATE POLICY "shows_insert_if_member"
  ON public.shows FOR INSERT TO authenticated
  WITH CHECK (is_band_member(shows.band_id, auth.uid()));

CREATE POLICY "shows_update_if_member"
  ON public.shows FOR UPDATE TO authenticated
  USING (is_band_member(shows.band_id, auth.uid()));

CREATE POLICY "shows_delete_if_creator"
  ON public.shows FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- Recreate Practice Sessions Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "sessions_select_if_member" ON public.practice_sessions;
DROP POLICY IF EXISTS "sessions_insert_if_member" ON public.practice_sessions;
DROP POLICY IF EXISTS "sessions_update_if_member" ON public.practice_sessions;
DROP POLICY IF EXISTS "sessions_delete_if_member" ON public.practice_sessions;

CREATE POLICY "sessions_select_if_member"
  ON public.practice_sessions FOR SELECT TO authenticated
  USING (is_band_member(practice_sessions.band_id, auth.uid()));

CREATE POLICY "sessions_insert_if_member"
  ON public.practice_sessions FOR INSERT TO authenticated
  WITH CHECK (is_band_member(practice_sessions.band_id, auth.uid()));

CREATE POLICY "sessions_update_if_member"
  ON public.practice_sessions FOR UPDATE TO authenticated
  USING (is_band_member(practice_sessions.band_id, auth.uid()));

CREATE POLICY "sessions_delete_if_member"
  ON public.practice_sessions FOR DELETE TO authenticated
  USING (is_band_member(practice_sessions.band_id, auth.uid()));

-- ============================================================================
-- Recreate Bands Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "bands_select_members" ON public.bands;
DROP POLICY IF EXISTS "bands_update_admins" ON public.bands;

-- Note: bands_insert_any_authenticated doesn't query band_memberships, so no change needed

CREATE POLICY "bands_select_members"
  ON public.bands FOR SELECT TO authenticated
  USING (is_band_member(bands.id, auth.uid()));

CREATE POLICY "bands_update_admins"
  ON public.bands FOR UPDATE TO authenticated
  USING (is_band_admin(bands.id, auth.uid()));

-- ============================================================================
-- Recreate Invite Codes Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "invite_codes_select_if_member" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes_insert_if_admin" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes_update_if_admin" ON public.invite_codes;

CREATE POLICY "invite_codes_select_if_member"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (is_band_member(invite_codes.band_id, auth.uid()));

CREATE POLICY "invite_codes_insert_if_admin"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (is_band_admin(invite_codes.band_id, auth.uid()));

CREATE POLICY "invite_codes_update_if_admin"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (is_band_admin(invite_codes.band_id, auth.uid()));

-- ============================================================================
-- Recreate Audit Log Policies Using Helper Functions
-- ============================================================================

DROP POLICY IF EXISTS "audit_log_select_if_member" ON public.audit_log;

CREATE POLICY "audit_log_select_if_member"
  ON public.audit_log FOR SELECT TO authenticated
  USING (is_band_member(audit_log.band_id, auth.uid()));

-- Note: audit_log_no_insert, audit_log_no_update, audit_log_no_delete don't query
-- band_memberships, so they don't need changes

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Helper functions:' as test,
       COUNT(*) as count
FROM pg_proc
WHERE proname IN ('is_band_admin', 'is_band_member')
  AND prosecdef = true;
-- Should be 2

SELECT 'Songs policies using helper functions:' as test,
       COUNT(*) as count
FROM pg_policy
WHERE polrelid = 'songs'::regclass;
-- Should be 4

SELECT 'All tables with band_id policies updated:' as test,
       COUNT(DISTINCT polrelid) as table_count
FROM pg_policy
WHERE polrelid IN (
  'songs'::regclass,
  'setlists'::regclass,
  'shows'::regclass,
  'practice_sessions'::regclass,
  'bands'::regclass,
  'invite_codes'::regclass,
  'audit_log'::regclass
);
-- Should be 7 tables

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP FUNCTION IF EXISTS is_band_member(UUID, UUID);
-- DROP FUNCTION IF EXISTS is_band_admin(UUID, UUID);
--
-- Then restore old policies from migration 20251107000002
-- ============================================================================
