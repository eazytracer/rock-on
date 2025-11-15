-- ============================================================================
-- Fix RLS Helper Functions to Prevent Infinite Recursion
-- Created: 2025-11-10
-- Description: Rewrites is_band_member() and is_band_admin() to use SQL
--              SECURITY DEFINER with postgres ownership to bypass RLS
-- ============================================================================
--
-- ISSUE: The previous plpgsql implementations of these functions were still
-- subject to RLS policies when querying band_memberships, causing infinite
-- recursion when RLS policies called these functions.
--
-- SOLUTION: Rewrite as SQL functions owned by postgres (superuser with
-- BYPASSRLS privilege) so they can query band_memberships directly without
-- triggering RLS policies.
-- ============================================================================

-- Helper function: Check if user is band admin (bypasses RLS to prevent recursion)
-- Uses direct table access without RLS by being owned by postgres with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_band_admin(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Direct table query - SECURITY DEFINER means this runs as function owner (postgres)
  -- who has BYPASSRLS privilege, preventing infinite recursion
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
  );
$$;

-- Ensure function is owned by postgres (superuser with BYPASSRLS)
ALTER FUNCTION is_band_admin(UUID, UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION is_band_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_band_admin IS 'Check if user is band admin - uses SECURITY DEFINER owned by postgres to bypass RLS and prevent recursion';

-- Helper function: Check if user is band member (bypasses RLS to prevent recursion)
-- Uses direct table access without RLS by being owned by postgres with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Direct table query - SECURITY DEFINER means this runs as function owner (postgres)
  -- who has BYPASSRLS privilege, preventing infinite recursion
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

-- Ensure function is owned by postgres (superuser with BYPASSRLS)
ALTER FUNCTION is_band_member(UUID, UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION is_band_member(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_band_member IS 'Check if user is band member - uses SECURITY DEFINER owned by postgres to bypass RLS and prevent recursion';

-- ============================================================================
-- Fix Other SECURITY DEFINER Functions
-- ============================================================================
-- All SECURITY DEFINER functions that interact with RLS-protected tables
-- must be owned by postgres to bypass RLS. This is especially critical for
-- auto_add_band_creator() which is causing new users to fail band creation.

-- Fix auto_add_band_creator() - CRITICAL for band creation
ALTER FUNCTION auto_add_band_creator() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION auto_add_band_creator() TO authenticated;
COMMENT ON FUNCTION auto_add_band_creator() IS 'Automatically add band creator as admin - owned by postgres to bypass RLS';

-- Fix other trigger functions for consistency
ALTER FUNCTION set_created_by() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION set_created_by() TO authenticated;
COMMENT ON FUNCTION set_created_by() IS 'Auto-set created_by column - owned by postgres to bypass RLS';

ALTER FUNCTION set_last_modified_by() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION set_last_modified_by() TO authenticated;
COMMENT ON FUNCTION set_last_modified_by() IS 'Auto-set last_modified_by column - owned by postgres to bypass RLS';

ALTER FUNCTION log_audit_trail() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION log_audit_trail() TO authenticated;
COMMENT ON FUNCTION log_audit_trail() IS 'Log all changes to audit_log - owned by postgres to bypass RLS';

ALTER FUNCTION increment_version() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION increment_version() TO authenticated;
COMMENT ON FUNCTION increment_version() IS 'Auto-increment version number - owned by postgres to bypass RLS';

ALTER FUNCTION update_updated_date_column() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION update_updated_date_column() TO authenticated;
COMMENT ON FUNCTION update_updated_date_column() IS 'Update updated_date timestamp - owned by postgres to bypass RLS';
