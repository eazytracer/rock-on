-- ============================================================================
-- Add INSERT Policy for Users Table
-- Created: 2025-11-10
-- Description: Allow authenticated users to insert their own user record
--              Required for ensureUserInSupabase() to work on signup
-- ============================================================================

-- ISSUE: Users table only has SELECT and UPDATE policies, no INSERT policy
-- This causes ensureUserInSupabase() to fail when new users sign up
-- The upsert operation fails because authenticated users can't INSERT

-- Add INSERT policy: Users can only insert their own record
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

COMMENT ON POLICY "users_insert_own" ON public.users IS
  'Allow authenticated users to insert their own user record during signup';
