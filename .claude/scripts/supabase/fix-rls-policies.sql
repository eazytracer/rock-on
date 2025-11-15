-- ==========================================
-- FIX RLS POLICIES FOR REMOTE SUPABASE
-- ==========================================
-- Copy and paste this entire file into Supabase SQL Editor
-- Project: khzeuxxhigqcmrytsfux
-- URL: https://supabase.com/dashboard/project/khzeuxxhigqcmrytsfux/sql/new

-- 1. Fix bands table RLS policies
-- This allows ANY authenticated user to create bands
DROP POLICY IF EXISTS "bands_insert_any_authenticated" ON public.bands;

CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);

-- Ensure other bands policies exist
DROP POLICY IF EXISTS "bands_select_members" ON public.bands;
CREATE POLICY "bands_select_members"
  ON public.bands FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_memberships.band_id = bands.id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.status = 'active'
    )
  );

DROP POLICY IF EXISTS "bands_update_admins" ON public.bands;
CREATE POLICY "bands_update_admins"
  ON public.bands FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_memberships.band_id = bands.id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.role = 'admin'
      AND band_memberships.status = 'active'
    )
  );

-- Enable RLS
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;

-- 2. Fix users table RLS policies
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all"
  ON public.users FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Fix user_profiles table RLS policies
DROP POLICY IF EXISTS "profiles_insert_own" ON public.user_profiles;
CREATE POLICY "profiles_insert_own"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_select_all" ON public.user_profiles;
CREATE POLICY "profiles_select_all"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.user_profiles;
CREATE POLICY "profiles_update_own"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Fix band_memberships table RLS policies
DROP POLICY IF EXISTS "memberships_insert_if_admin_or_valid_invite" ON public.band_memberships;
CREATE POLICY "memberships_insert_if_admin_or_valid_invite"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow if user is admin of the band
    EXISTS (
      SELECT 1 FROM public.band_memberships existing
      WHERE existing.band_id = band_id
      AND existing.user_id = auth.uid()
      AND existing.role = 'admin'
      AND existing.status = 'active'
    )
    -- OR if user is creating their own membership (via invite code)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "memberships_select_if_member" ON public.band_memberships;
CREATE POLICY "memberships_select_if_member"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    -- Can see memberships of bands they're in
    EXISTS (
      SELECT 1 FROM public.band_memberships existing
      WHERE existing.band_id = band_id
      AND existing.user_id = auth.uid()
      AND existing.status = 'active'
    )
  );

DROP POLICY IF EXISTS "memberships_update_if_admin" ON public.band_memberships;
CREATE POLICY "memberships_update_if_admin"
  ON public.band_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships existing
      WHERE existing.band_id = band_id
      AND existing.user_id = auth.uid()
      AND existing.role = 'admin'
      AND existing.status = 'active'
    )
  );

ALTER TABLE public.band_memberships ENABLE ROW LEVEL SECURITY;

-- 5. Fix invite_codes table RLS policies
DROP POLICY IF EXISTS "invite_codes_insert_if_admin" ON public.invite_codes;
CREATE POLICY "invite_codes_insert_if_admin"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_memberships.band_id = band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.role = 'admin'
      AND band_memberships.status = 'active'
    )
  );

DROP POLICY IF EXISTS "invite_codes_select_public" ON public.invite_codes;
CREATE POLICY "invite_codes_select_public"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "invite_codes_update_if_admin" ON public.invite_codes;
CREATE POLICY "invite_codes_update_if_admin"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_memberships.band_id = band_id
      AND band_memberships.user_id = auth.uid()
      AND band_memberships.role = 'admin'
      AND band_memberships.status = 'active'
    )
  );

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these after applying the policies above to verify:

-- Check bands policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'bands'
ORDER BY policyname;

-- Check users policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Check band_memberships policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'band_memberships'
ORDER BY policyname;

-- Expected output:
-- bands: 3 policies (insert, select, update)
-- users: 3 policies (insert, select, update)
-- user_profiles: 3 policies (insert, select, update)
-- band_memberships: 3 policies (insert, select, update)
-- invite_codes: 3 policies (insert, select, update)
