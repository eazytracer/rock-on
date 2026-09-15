-- Test: Extended Audit Logging (Phase 2)
-- Purpose: Validate that audit triggers added in 20260915000000_extend_audit_triggers
--          fire for bands, band_memberships, song_castings, song_assignments,
--          and member_capabilities — the change-feed tables the naive online
--          web client depends on for cross-member freshness.
-- Category: Audit
-- Created: 2026-09-15

begin;

-- ============================================================================
-- Cleanup: remove ALL existing data for isolation (triggers off during cleanup)
-- ============================================================================
SET session_replication_role = replica;

DELETE FROM audit_log;
DELETE FROM song_assignments;
DELETE FROM song_castings;
DELETE FROM casting_templates;
DELETE FROM member_capabilities;
DELETE FROM assignment_roles;
DELETE FROM song_group_memberships;
DELETE FROM song_groups;
DELETE FROM practice_sessions;
DELETE FROM shows;
DELETE FROM setlists;
DELETE FROM songs;
DELETE FROM invite_codes;
DELETE FROM band_memberships;
DELETE FROM bands;
DELETE FROM user_profiles;
DELETE FROM public.users WHERE email LIKE '%test.com';
DELETE FROM auth.users WHERE email LIKE '%test.com';

SET session_replication_role = DEFAULT;

select plan(7);

-- ============================================================================
-- Setup: create test user, authenticate
-- ============================================================================
select tests.create_supabase_user('audituser@test.com');
select tests.authenticate_as('audituser@test.com');

-- ----------------------------------------------------------------------------
-- bands: INSERT should emit a bands audit row (band's own id as band_id)
-- (this insert also auto-creates a band_memberships row via the creator trigger)
-- ----------------------------------------------------------------------------
insert into bands (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Audit Test Band');

select results_eq(
  $$select count(*)::int from audit_log where table_name = 'bands' and action = 'INSERT'$$,
  ARRAY[1],
  'bands INSERT should create an audit_log entry'
);

select results_eq(
  $$select band_id::text from audit_log where table_name = 'bands' and action = 'INSERT' limit 1$$,
  ARRAY['11111111-1111-1111-1111-111111111111'],
  'bands audit row band_id should equal the band''s own id'
);

-- ----------------------------------------------------------------------------
-- band_memberships: the creator-admin membership was auto-inserted above, so an
-- INSERT audit row should already exist with the correct band_id
-- ----------------------------------------------------------------------------
select results_eq(
  $$select count(*)::int from audit_log where table_name = 'band_memberships' and action = 'INSERT'$$,
  ARRAY[1],
  'band_memberships INSERT should create an audit_log entry'
);

select results_eq(
  $$select band_id::text from audit_log where table_name = 'band_memberships' and action = 'INSERT' limit 1$$,
  ARRAY['11111111-1111-1111-1111-111111111111'],
  'band_memberships audit row should capture band_id directly'
);

-- ----------------------------------------------------------------------------
-- member_capabilities: INSERT should emit an audit row with band_id.
-- These casting/capability tables are RLS deny-all for normal users (schema of
-- record), so perform the insert as postgres to bypass RLS — the audit trigger
-- is SECURITY DEFINER and fires regardless of the inserting role.
-- ----------------------------------------------------------------------------
set local role postgres;
insert into member_capabilities (id, user_id, band_id, role_type)
values (
  '33333333-3333-3333-3333-333333333333',
  tests.get_supabase_uid('audituser@test.com'),
  '11111111-1111-1111-1111-111111111111',
  'guitar'
);
reset role;

select results_eq(
  $$select band_id::text from audit_log where table_name = 'member_capabilities' and action = 'INSERT' limit 1$$,
  ARRAY['11111111-1111-1111-1111-111111111111'],
  'member_capabilities audit row should capture band_id directly'
);

-- ----------------------------------------------------------------------------
-- song_castings: INSERT should emit an audit row; band context → band_id set
-- ----------------------------------------------------------------------------
set local role postgres;
insert into songs (id, title, artist, context_type, context_id, created_by)
values (
  '44444444-4444-4444-4444-444444444444',
  'Cast Song', 'Cast Artist', 'band',
  '11111111-1111-1111-1111-111111111111',
  tests.get_supabase_uid('audituser@test.com')
);

insert into song_castings (id, context_type, context_id, song_id, created_by)
values (
  '55555555-5555-5555-5555-555555555555',
  'band',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  tests.get_supabase_uid('audituser@test.com')
);
reset role;

select results_eq(
  $$select band_id::text from audit_log where table_name = 'song_castings' and action = 'INSERT' limit 1$$,
  ARRAY['11111111-1111-1111-1111-111111111111'],
  'song_castings audit row should derive band_id from band context'
);

-- ----------------------------------------------------------------------------
-- song_assignments: INSERT should emit an audit row (band_id NULL by design)
-- ----------------------------------------------------------------------------
set local role postgres;
insert into song_assignments (id, song_casting_id, member_id, added_by)
values (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  tests.get_supabase_uid('audituser@test.com'),
  tests.get_supabase_uid('audituser@test.com')
);
reset role;

select results_eq(
  $$select count(*)::int from audit_log where table_name = 'song_assignments' and action = 'INSERT'$$,
  ARRAY[1],
  'song_assignments INSERT should create an audit_log entry'
);

select * from finish();
rollback;
