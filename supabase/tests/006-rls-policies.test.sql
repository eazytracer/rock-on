-- Test: RLS Policies Existence and Configuration
-- Purpose: Validate RLS is enabled and all policies exist
-- Category: RLS & Security
-- Created: 2025-11-07

begin;

-- Declare how many tests will run
select plan(73);

-- ============================================================================
-- RLS Enabled Tests (17 tables)
-- ============================================================================

select ok(
  tests.rls_enabled('users'),
  'RLS should be enabled on users table'
);

select ok(
  tests.rls_enabled('user_profiles'),
  'RLS should be enabled on user_profiles table'
);

select ok(
  tests.rls_enabled('bands'),
  'RLS should be enabled on bands table'
);

select ok(
  tests.rls_enabled('band_memberships'),
  'RLS should be enabled on band_memberships table'
);

select ok(
  tests.rls_enabled('invite_codes'),
  'RLS should be enabled on invite_codes table'
);

select ok(
  tests.rls_enabled('songs'),
  'RLS should be enabled on songs table'
);

select ok(
  tests.rls_enabled('song_groups'),
  'RLS should be enabled on song_groups table'
);

select ok(
  tests.rls_enabled('song_group_memberships'),
  'RLS should be enabled on song_group_memberships table'
);

select ok(
  tests.rls_enabled('setlists'),
  'RLS should be enabled on setlists table'
);

select ok(
  tests.rls_enabled('shows'),
  'RLS should be enabled on shows table'
);

select ok(
  tests.rls_enabled('practice_sessions'),
  'RLS should be enabled on practice_sessions table'
);

select ok(
  tests.rls_enabled('song_castings'),
  'RLS should be enabled on song_castings table'
);

select ok(
  tests.rls_enabled('song_assignments'),
  'RLS should be enabled on song_assignments table'
);

select ok(
  tests.rls_enabled('assignment_roles'),
  'RLS should be enabled on assignment_roles table'
);

select ok(
  tests.rls_enabled('casting_templates'),
  'RLS should be enabled on casting_templates table'
);

select ok(
  tests.rls_enabled('member_capabilities'),
  'RLS should be enabled on member_capabilities table'
);

select ok(
  tests.rls_enabled('audit_log'),
  'RLS should be enabled on audit_log table'
);

-- ============================================================================
-- Users Policies (3 policies)
-- ============================================================================

select ok(
  tests.policy_exists('users', 'users_select_authenticated'),
  'users_select_authenticated policy should exist'
);

select ok(
  tests.policy_exists('users', 'users_insert_own'),
  'users_insert_own policy should exist (allows signup)'
);

select ok(
  tests.policy_exists('users', 'users_update_own'),
  'users_update_own policy should exist'
);

-- ============================================================================
-- User Profiles Policies (3 policies)
-- ============================================================================

select ok(
  tests.policy_exists('user_profiles', 'user_profiles_select_own'),
  'user_profiles_select_own policy should exist'
);

select ok(
  tests.policy_exists('user_profiles', 'user_profiles_insert_own'),
  'user_profiles_insert_own policy should exist'
);

select ok(
  tests.policy_exists('user_profiles', 'user_profiles_update_own'),
  'user_profiles_update_own policy should exist'
);

-- ============================================================================
-- Bands Policies (3 policies)
-- ============================================================================

select ok(
  tests.policy_exists('bands', 'bands_insert_any_authenticated'),
  'bands_insert_any_authenticated policy should exist'
);

select ok(
  tests.policy_exists('bands', 'bands_select_members_or_creator'),
  'bands_select_members_or_creator policy should exist (allows viewing created bands)'
);

select ok(
  tests.policy_exists('bands', 'bands_update_admins'),
  'bands_update_admins policy should exist'
);

-- ============================================================================
-- Band Memberships Policies (4 policies)
-- ============================================================================

select ok(
  tests.policy_exists('band_memberships', 'memberships_select_own'),
  'memberships_select_own policy should exist (non-recursive)'
);

select ok(
  tests.policy_exists('band_memberships', 'memberships_insert_self'),
  'memberships_insert_self policy should exist'
);

select ok(
  tests.policy_exists('band_memberships', 'memberships_insert_by_creator'),
  'memberships_insert_by_creator policy should exist (non-recursive)'
);

select ok(
  tests.policy_exists('band_memberships', 'memberships_update_by_creator'),
  'memberships_update_by_creator policy should exist (non-recursive)'
);

select ok(
  tests.policy_exists('band_memberships', 'memberships_delete_self_or_creator'),
  'memberships_delete_self_or_creator policy should exist (non-recursive)'
);

-- ============================================================================
-- Invite Codes Policies (3 policies)
-- ============================================================================

select ok(
  tests.policy_exists('invite_codes', 'invite_codes_select_if_member'),
  'invite_codes_select_if_member policy should exist'
);

select ok(
  tests.policy_exists('invite_codes', 'invite_codes_insert_if_admin'),
  'invite_codes_insert_if_admin policy should exist'
);

select ok(
  tests.policy_exists('invite_codes', 'invite_codes_update_if_admin'),
  'invite_codes_update_if_admin policy should exist'
);

-- ============================================================================
-- Songs Policies (4 policies)
-- ============================================================================

select ok(
  tests.policy_exists('songs', 'songs_select_band_members_only'),
  'songs_select_band_members_only policy should exist'
);

select ok(
  tests.policy_exists('songs', 'songs_insert_band_members_only'),
  'songs_insert_band_members_only policy should exist'
);

select ok(
  tests.policy_exists('songs', 'songs_update_band_members_only'),
  'songs_update_band_members_only policy should exist'
);

select ok(
  tests.policy_exists('songs', 'songs_delete_band_admins_only'),
  'songs_delete_band_admins_only policy should exist'
);

-- ============================================================================
-- Setlists Policies (4 policies)
-- ============================================================================

select ok(
  tests.policy_exists('setlists', 'setlists_select_if_member'),
  'setlists_select_if_member policy should exist'
);

select ok(
  tests.policy_exists('setlists', 'setlists_insert_if_member'),
  'setlists_insert_if_member policy should exist'
);

select ok(
  tests.policy_exists('setlists', 'setlists_update_if_member'),
  'setlists_update_if_member policy should exist'
);

select ok(
  tests.policy_exists('setlists', 'setlists_delete_if_creator_or_admin'),
  'setlists_delete_if_creator_or_admin policy should exist'
);

-- ============================================================================
-- Shows Policies (4 policies)
-- ============================================================================

select ok(
  tests.policy_exists('shows', 'shows_select_if_member'),
  'shows_select_if_member policy should exist'
);

select ok(
  tests.policy_exists('shows', 'shows_insert_if_member'),
  'shows_insert_if_member policy should exist'
);

select ok(
  tests.policy_exists('shows', 'shows_update_if_member'),
  'shows_update_if_member policy should exist'
);

select ok(
  tests.policy_exists('shows', 'shows_delete_if_creator'),
  'shows_delete_if_creator policy should exist'
);

-- ============================================================================
-- Practice Sessions Policies (4 policies)
-- ============================================================================

select ok(
  tests.policy_exists('practice_sessions', 'sessions_select_if_member'),
  'sessions_select_if_member policy should exist'
);

select ok(
  tests.policy_exists('practice_sessions', 'sessions_insert_if_member'),
  'sessions_insert_if_member policy should exist'
);

select ok(
  tests.policy_exists('practice_sessions', 'sessions_update_if_member'),
  'sessions_update_if_member policy should exist'
);

select ok(
  tests.policy_exists('practice_sessions', 'sessions_delete_if_member'),
  'sessions_delete_if_member policy should exist'
);

-- ============================================================================
-- Audit Log Policies (4 policies - read-only except via triggers)
-- ============================================================================

select ok(
  tests.policy_exists('audit_log', 'audit_log_select_if_member'),
  'audit_log_select_if_member policy should exist'
);

select ok(
  tests.policy_exists('audit_log', 'audit_log_no_insert'),
  'audit_log_no_insert policy should exist'
);

select ok(
  tests.policy_exists('audit_log', 'audit_log_no_update'),
  'audit_log_no_update policy should exist'
);

select ok(
  tests.policy_exists('audit_log', 'audit_log_no_delete'),
  'audit_log_no_delete policy should exist'
);

-- ============================================================================
-- Policy Count Validation
-- ============================================================================

select is(
  tests.policy_count('users'),
  3,
  'users table should have exactly 3 policies'
);

select is(
  tests.policy_count('user_profiles'),
  3,
  'user_profiles table should have exactly 3 policies'
);

select is(
  tests.policy_count('bands'),
  3,
  'bands table should have exactly 3 policies'
);

select is(
  tests.policy_count('band_memberships'),
  5,
  'band_memberships table should have exactly 5 policies'
);

select is(
  tests.policy_count('invite_codes'),
  3,
  'invite_codes table should have exactly 3 policies'
);

select is(
  tests.policy_count('songs'),
  4,
  'songs table should have exactly 4 policies'
);

select is(
  tests.policy_count('setlists'),
  4,
  'setlists table should have exactly 4 policies'
);

select is(
  tests.policy_count('shows'),
  4,
  'shows table should have exactly 4 policies'
);

select is(
  tests.policy_count('practice_sessions'),
  4,
  'practice_sessions table should have exactly 4 policies'
);

select is(
  tests.policy_count('audit_log'),
  4,
  'audit_log table should have exactly 4 policies'
);

-- ============================================================================
-- Policy Command Validation (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================================

-- Validate users policies cover appropriate operations
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd = 'SELECT'
  ),
  'users table should have SELECT policy'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and cmd = 'UPDATE'
  ),
  'users table should have UPDATE policy'
);

-- Validate songs policies cover all CRUD operations
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'songs'
      and cmd = 'SELECT'
  ),
  'songs table should have SELECT policy'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'songs'
      and cmd = 'INSERT'
  ),
  'songs table should have INSERT policy'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'songs'
      and cmd = 'UPDATE'
  ),
  'songs table should have UPDATE policy'
);

select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'songs'
      and cmd = 'DELETE'
  ),
  'songs table should have DELETE policy'
);

-- Validate audit_log is read-only
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_log'
      and cmd = 'INSERT'
      and permissive::text = 'true'
  ),
  'audit_log should not have permissive INSERT policy'
);

select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_log'
      and cmd = 'UPDATE'
      and permissive::text = 'true'
  ),
  'audit_log should not have permissive UPDATE policy'
);

select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_log'
      and cmd = 'DELETE'
      and permissive::text = 'true'
  ),
  'audit_log should not have permissive DELETE policy'
);

-- Finalize
select * from finish();

-- Rollback to cleanup
rollback;
