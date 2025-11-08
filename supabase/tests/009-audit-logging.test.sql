-- Test: Audit Logging
-- Purpose: Validate audit trail triggers log changes correctly
-- Category: Audit
-- Created: 2025-11-07

begin;

-- ============================================================================
-- Cleanup: Remove ALL existing data to ensure test isolation
-- MUST happen BEFORE select plan() to avoid FK constraint issues
-- ============================================================================

-- Temporarily disable triggers to avoid audit_log creation during cleanup
SET session_replication_role = replica;

-- Delete in reverse dependency order to avoid FK violations
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

-- Clean up test users
DELETE FROM public.users WHERE email LIKE '%test.com';
DELETE FROM auth.users WHERE email LIKE '%test.com';

-- Re-enable triggers after cleanup
SET session_replication_role = DEFAULT;

-- Declare how many tests will run (AFTER cleanup)
select plan(15);

-- ============================================================================
-- Setup: Create test user and band
-- ============================================================================

-- Create test user and band (authenticate first so trigger auto-adds user as admin)
select tests.create_supabase_user('testuser@test.com');
select tests.authenticate_as('testuser@test.com');
insert into bands (id, name) values ('11111111-1111-1111-1111-111111111111', 'Test Band');
-- NOTE: band_memberships entry auto-created by trigger

-- Authenticate as test user
select tests.authenticate_as('testuser@test.com');

-- ============================================================================
-- Test INSERT Creates Audit Log
-- ============================================================================

-- Insert a song
insert into songs (id, title, artist, context_type, context_id, created_by)
values (
  '22222222-2222-2222-2222-222222222222',
  'Test Song',
  'Test Artist',
  'band',
  '11111111-1111-1111-1111-111111111111',
  tests.get_supabase_uid('testuser@test.com')
);

select results_eq(
  $$select count(*)::int from audit_log where table_name = 'songs' and action = 'INSERT'$$,
  ARRAY[1],
  'INSERT should create audit log entry'
);

select results_eq(
  $$select record_id::text from audit_log where table_name = 'songs' and action = 'INSERT'$$,
  ARRAY['22222222-2222-2222-2222-222222222222'],
  'Audit log should have correct record_id for INSERT'
);

select ok(
  (select new_values is not null from audit_log where table_name = 'songs' and action = 'INSERT' limit 1),
  'Audit log should capture new_values on INSERT'
);

select results_eq(
  $$select (new_values->>'title')::text from audit_log where table_name = 'songs' and action = 'INSERT'$$,
  ARRAY['Test Song'],
  'Audit log new_values should contain correct title'
);

select is(
  (select old_values from audit_log where table_name = 'songs' and action = 'INSERT' limit 1),
  null::jsonb,
  'Audit log old_values should be NULL for INSERT'
);

-- ============================================================================
-- Test UPDATE Creates Audit Log
-- ============================================================================

-- Update the song
update songs set title = 'Updated Title' where id = '22222222-2222-2222-2222-222222222222';

select results_eq(
  $$select count(*)::int from audit_log where table_name = 'songs' and action = 'UPDATE'$$,
  ARRAY[1],
  'UPDATE should create audit log entry'
);

select ok(
  (select old_values is not null from audit_log where table_name = 'songs' and action = 'UPDATE' limit 1),
  'Audit log should capture old_values on UPDATE'
);

select ok(
  (select new_values is not null from audit_log where table_name = 'songs' and action = 'UPDATE' limit 1),
  'Audit log should capture new_values on UPDATE'
);

select results_eq(
  $$select (old_values->>'title')::text from audit_log where table_name = 'songs' and action = 'UPDATE'$$,
  ARRAY['Test Song'],
  'Audit log old_values should contain original title'
);

select results_eq(
  $$select (new_values->>'title')::text from audit_log where table_name = 'songs' and action = 'UPDATE'$$,
  ARRAY['Updated Title'],
  'Audit log new_values should contain updated title'
);

-- ============================================================================
-- Test DELETE Creates Audit Log
-- ============================================================================

-- Delete the song
delete from songs where id = '22222222-2222-2222-2222-222222222222';

select results_eq(
  $$select count(*)::int from audit_log where table_name = 'songs' and action = 'DELETE'$$,
  ARRAY[1],
  'DELETE should create audit log entry'
);

select ok(
  (select old_values is not null from audit_log where table_name = 'songs' and action = 'DELETE' limit 1),
  'Audit log should capture old_values on DELETE'
);

select is(
  (select new_values from audit_log where table_name = 'songs' and action = 'DELETE' limit 1),
  null::jsonb,
  'Audit log new_values should be NULL for DELETE'
);

-- ============================================================================
-- Test Audit Log Metadata
-- ============================================================================

select results_eq(
  $$select user_name from audit_log where table_name = 'songs' and action = 'INSERT' limit 1$$,
  ARRAY['testuser'],
  'Audit log should capture user_name'
);

select results_eq(
  $$select band_id::text from audit_log where table_name = 'songs' and action = 'INSERT' limit 1$$,
  ARRAY['11111111-1111-1111-1111-111111111111'],
  'Audit log should capture band_id from context_id'
);

select * from finish();
rollback;
