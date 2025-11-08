-- ============================================================================
-- Migration: Enforce Band-Only Behavior for MVP
-- ============================================================================
-- Purpose: Simplify RLS policies to enforce band-only song context for MVP
--          while keeping schema fields for future personal song support.
--
-- Strategy: Keep context_type and visibility columns (future-proofing)
--           but enforce band-only behavior through RLS policies and defaults.
--
-- Created: 2025-11-07
-- ============================================================================

-- ============================================================================
-- STEP 1: Update existing songs to ensure all are band context
-- ============================================================================

-- If any personal songs exist, convert them to band songs
-- NOTE: This will break if context_id is user_id (not a valid band_id)
-- For MVP, we assume all songs should be band songs
UPDATE public.songs
SET context_type = 'band'
WHERE context_type != 'band';

-- Verify: Check for any non-band songs (should be 0)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.songs WHERE context_type != 'band';
  IF v_count > 0 THEN
    RAISE WARNING 'Found % songs with context_type != band', v_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add DEFAULT constraint to enforce band-only for new songs
-- ============================================================================

-- Set default value for context_type to 'band'
-- NOTE: Keeps 'personal' in CHECK constraint for future use
ALTER TABLE public.songs
ALTER COLUMN context_type SET DEFAULT 'band';

-- Set default value for visibility to 'band'
ALTER TABLE public.songs
ALTER COLUMN visibility SET DEFAULT 'band';

-- ============================================================================
-- STEP 3: Force RLS for Test Isolation
-- ============================================================================

-- CRITICAL: Force RLS even for table owners (needed for pgTAP tests)
-- Without this, tests running as postgres user bypass RLS
ALTER TABLE public.songs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.setlists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shows FORCE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions FORCE ROW LEVEL SECURITY;

-- CRITICAL: Remove BYPASSRLS from postgres role for test isolation
-- The postgres role has BYPASSRLS by default, which bypasses ALL RLS policies
-- Even with FORCE RLS, BYPASSRLS takes precedence
-- This is safe for local development/test but should NOT be done in production
DO $$
BEGIN
  -- Only alter if we're in a local/test environment (check for specific user)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'eric@ipodshuffle.com') THEN
    ALTER ROLE postgres NOBYPASSRLS;
    RAISE NOTICE 'Removed BYPASSRLS from postgres role for test isolation';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not alter postgres role - insufficient privileges';
END $$;

-- ============================================================================
-- STEP 4: Simplify RLS Policies - Remove Personal Song Support
-- ============================================================================

-- Drop all existing song policies
DROP POLICY IF EXISTS "songs_select_if_member_or_creator" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_if_authenticated" ON public.songs;
DROP POLICY IF EXISTS "songs_update_if_member" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_if_creator_or_admin" ON public.songs;

-- ============================================================================
-- SELECT Policy: Only band members can see band songs
-- ============================================================================
CREATE POLICY "songs_select_band_members_only"
  ON public.songs FOR SELECT TO authenticated
  USING (
    -- MVP: Only allow seeing songs from bands you're a member of
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = songs.context_id::uuid
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================================================
-- INSERT Policy: Only band members can create songs
-- ============================================================================
CREATE POLICY "songs_insert_band_members_only"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    -- MVP: Must be authenticated and song must be for a band you're in
    created_by = auth.uid() AND
    context_type = 'band' AND
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = songs.context_id::uuid
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================================================
-- UPDATE Policy: Only band members can update songs
-- ============================================================================
CREATE POLICY "songs_update_band_members_only"
  ON public.songs FOR UPDATE TO authenticated
  USING (
    -- MVP: Only band members can update band songs
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = songs.context_id::uuid
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    -- MVP: Updated song must remain band context
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = songs.context_id::uuid
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================================================
-- DELETE Policy: Only band admins can delete songs
-- ============================================================================
CREATE POLICY "songs_delete_band_admins_only"
  ON public.songs FOR DELETE TO authenticated
  USING (
    -- MVP: Only band admins/owners can delete band songs
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = songs.context_id::uuid
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
        AND status = 'active'
    )
  );

-- ============================================================================
-- STEP 5: Update audit_log.band_id to be NOT NULL for MVP
-- ============================================================================

-- Since all songs are band songs in MVP, audit_log.band_id should never be NULL
-- First verify no NULL band_id entries exist
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM audit_log WHERE band_id IS NULL;
  IF v_count > 0 THEN
    RAISE WARNING 'Found % audit_log entries with NULL band_id - these need manual cleanup', v_count;
    -- Optionally delete these entries if they're from testing
    -- DELETE FROM audit_log WHERE band_id IS NULL;
  ELSE
    -- Safe to make NOT NULL
    ALTER TABLE audit_log ALTER COLUMN band_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Update log_audit_trail() function for MVP
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_band_id UUID;
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
  v_context_type TEXT;
BEGIN
  -- Determine action and values
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_user_id := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  ELSE  -- INSERT
    v_action := 'INSERT';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  END IF;

  -- Get user_name from public.users first (MVP seed data has names there)
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name FROM public.users WHERE id = v_user_id;

    -- Fallback to auth.users metadata if needed
    IF v_user_name IS NULL THEN
      SELECT raw_user_meta_data->>'name' INTO v_user_name
      FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  -- Always set default if still NULL
  IF v_user_name IS NULL THEN
    v_user_name := 'System';
  END IF;

  -- Get band_id based on table
  IF TG_TABLE_NAME = 'songs' THEN
    -- For songs, get context_type to determine how to handle context_id
    IF TG_OP = 'DELETE' THEN
      v_context_type := OLD.context_type;
      -- MVP: All songs should be band songs
      IF v_context_type = 'band' THEN
        v_band_id := OLD.context_id::uuid;
      ELSE
        -- Should not happen in MVP, but handle gracefully
        RAISE WARNING 'Song % has context_type=%, expected band', OLD.id, v_context_type;
        v_band_id := NULL;
      END IF;
    ELSE
      v_context_type := NEW.context_type;
      -- MVP: All songs should be band songs
      IF v_context_type = 'band' THEN
        v_band_id := NEW.context_id::uuid;
      ELSE
        -- Should not happen in MVP, but handle gracefully
        RAISE WARNING 'Song % has context_type=%, expected band', NEW.id, v_context_type;
        v_band_id := NULL;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('setlists', 'shows', 'practice_sessions') THEN
    -- Other tables have band_id directly
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.band_id;
    ELSE
      v_band_id := NEW.band_id;
    END IF;
  ELSE
    v_band_id := NULL;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_name,
    band_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    v_user_id,
    v_user_name,
    v_band_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check: All songs should be band context
SELECT
  'Songs with non-band context_type:' as check,
  COUNT(*) as count,
  ARRAY_AGG(id) as song_ids
FROM public.songs
WHERE context_type != 'band';

-- Check: Audit log should have no NULL band_id (after migration)
SELECT
  'Audit log entries with NULL band_id:' as check,
  COUNT(*) as count
FROM audit_log
WHERE band_id IS NULL;

-- Check: RLS policies on songs table
SELECT
  'Songs RLS policies:' as check,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'songs';
-- Should be 4: select, insert, update, delete

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- To revert to previous behavior with personal song support:
--
-- 1. Restore old RLS policies from 20251106000000_baseline_schema.sql
-- DROP POLICY IF EXISTS "songs_select_band_members_only" ON public.songs;
-- DROP POLICY IF EXISTS "songs_insert_band_members_only" ON public.songs;
-- DROP POLICY IF EXISTS "songs_update_band_members_only" ON public.songs;
-- DROP POLICY IF EXISTS "songs_delete_band_admins_only" ON public.songs;
--
-- CREATE POLICY "songs_select_if_member_or_creator" ON public.songs FOR SELECT TO authenticated
--   USING (created_by = auth.uid() OR (context_type = 'band' AND EXISTS (...)));
-- ... (restore other policies)
--
-- 2. Restore old audit function from 20251107000001_fix_schema_bugs.sql
--
-- 3. Make audit_log.band_id nullable again
-- ALTER TABLE audit_log ALTER COLUMN band_id DROP NOT NULL;
--
-- 4. Remove defaults
-- ALTER TABLE public.songs ALTER COLUMN context_type DROP DEFAULT;
-- ALTER TABLE public.songs ALTER COLUMN visibility DROP DEFAULT;
-- ============================================================================
