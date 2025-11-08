-- Test: RLS Band Isolation
-- Purpose: Validate band members can only access their band's data
-- Category: RLS & Security
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

-- Clean up test users (preserve seed users if needed, or delete all)
DELETE FROM public.users WHERE email LIKE '%test.com';
DELETE FROM auth.users WHERE email LIKE '%test.com';

-- Re-enable triggers after cleanup
SET session_replication_role = DEFAULT;

-- Declare how many tests will run (AFTER cleanup)
select plan(22);

-- ============================================================================
-- Setup: Create test users and bands
-- ============================================================================

-- Create two test users
select tests.create_supabase_user('banduser1@test.com');
select tests.create_supabase_user('banduser2@test.com');

-- Create two separate bands
-- User 1 creates Band Alpha (trigger auto-adds them as admin)
select tests.authenticate_as('banduser1@test.com');
insert into bands (id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Band Alpha');
-- NOTE: band_memberships entry auto-created by trigger

-- User 2 creates Band Beta (trigger auto-adds them as admin)
select tests.authenticate_as('banduser2@test.com');
insert into bands (id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Band Beta');
-- NOTE: band_memberships entry auto-created by trigger

-- Band IDs are hardcoded in inserts above (no prepare needed)

-- ============================================================================
-- Songs Isolation Tests
-- ============================================================================

-- User 1 creates a song for Band Alpha
select tests.authenticate_as('banduser1@test.com');

insert into songs (id, title, artist, context_type, context_id, created_by)
values (
  'aaaaaaaa-0001-0000-0000-000000000001',
  'Alpha Band Song',
  'Alpha Artist',
  'band',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tests.get_supabase_uid('banduser1@test.com')
);

-- User 2 creates a song for Band Beta
select tests.authenticate_as('banduser2@test.com');

insert into songs (id, title, artist, context_type, context_id, created_by)
values (
  'bbbbbbbb-0001-0000-0000-000000000001',
  'Beta Band Song',
  'Beta Artist',
  'band',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  tests.get_supabase_uid('banduser2@test.com')
);

-- Test: User 1 can see only Band Alpha songs
select tests.authenticate_as('banduser1@test.com');

select is(
  (select count(*)::int from songs),
  1,
  'User 1 should see exactly 1 song (their band)'
);

select is(
  (select title from songs where id = 'aaaaaaaa-0001-0000-0000-000000000001'),
  'Alpha Band Song',
  'User 1 should see their band song'
);

select is(
  (select count(*)::int from songs where id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  0,
  'User 1 should NOT see Band Beta songs'
);

-- Test: User 2 can see only Band Beta songs
select tests.authenticate_as('banduser2@test.com');

select is(
  (select count(*)::int from songs),
  1,
  'User 2 should see exactly 1 song (their band)'
);

select is(
  (select title from songs where id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  'Beta Band Song',
  'User 2 should see their band song'
);

select is(
  (select count(*)::int from songs where id = 'aaaaaaaa-0001-0000-0000-000000000001'),
  0,
  'User 2 should NOT see Band Alpha songs'
);

-- ============================================================================
-- Setlists Isolation Tests
-- ============================================================================

-- User 1 creates a setlist for Band Alpha
select tests.authenticate_as('banduser1@test.com');

insert into setlists (id, name, band_id, created_by, items)
values (
  'aaaaaaaa-0002-0000-0000-000000000001',
  'Alpha Setlist',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tests.get_supabase_uid('banduser1@test.com'),
  '[]'::jsonb
);

-- User 2 creates a setlist for Band Beta
select tests.authenticate_as('banduser2@test.com');

insert into setlists (id, name, band_id, created_by, items)
values (
  'bbbbbbbb-0002-0000-0000-000000000001',
  'Beta Setlist',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  tests.get_supabase_uid('banduser2@test.com'),
  '[]'::jsonb
);

-- Test: User 1 can see only Band Alpha setlists
select tests.authenticate_as('banduser1@test.com');

select is(
  (select count(*)::int from setlists),
  1,
  'User 1 should see exactly 1 setlist (their band)'
);

select is(
  (select name from setlists where id = 'aaaaaaaa-0002-0000-0000-000000000001'),
  'Alpha Setlist',
  'User 1 should see their band setlist'
);

select is(
  (select count(*)::int from setlists where id = 'bbbbbbbb-0002-0000-0000-000000000001'),
  0,
  'User 1 should NOT see Band Beta setlists'
);

-- Test: User 2 can see only Band Beta setlists
select tests.authenticate_as('banduser2@test.com');

select is(
  (select count(*)::int from setlists),
  1,
  'User 2 should see exactly 1 setlist (their band)'
);

select is(
  (select name from setlists where id = 'bbbbbbbb-0002-0000-0000-000000000001'),
  'Beta Setlist',
  'User 2 should see their band setlist'
);

select is(
  (select count(*)::int from setlists where id = 'aaaaaaaa-0002-0000-0000-000000000001'),
  0,
  'User 2 should NOT see Band Alpha setlists'
);

-- ============================================================================
-- Shows Isolation Tests
-- ============================================================================

-- User 1 creates a show for Band Alpha
select tests.authenticate_as('banduser1@test.com');

insert into shows (id, name, venue, band_id, scheduled_date, created_by)
values (
  'aaaaaaaa-0003-0000-0000-000000000001',
  'Alpha Show',
  'Alpha Venue',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  now() + interval '7 days',
  tests.get_supabase_uid('banduser1@test.com')
);

-- User 2 creates a show for Band Beta
select tests.authenticate_as('banduser2@test.com');

insert into shows (id, name, venue, band_id, scheduled_date, created_by)
values (
  'bbbbbbbb-0003-0000-0000-000000000001',
  'Beta Show',
  'Beta Venue',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  now() + interval '7 days',
  tests.get_supabase_uid('banduser2@test.com')
);

-- Test: User 1 can see only Band Alpha shows
select tests.authenticate_as('banduser1@test.com');

select is(
  (select count(*)::int from shows),
  1,
  'User 1 should see exactly 1 show (their band)'
);

select is(
  (select name from shows where id = 'aaaaaaaa-0003-0000-0000-000000000001'),
  'Alpha Show',
  'User 1 should see their band show'
);

select is(
  (select count(*)::int from shows where id = 'bbbbbbbb-0003-0000-0000-000000000001'),
  0,
  'User 1 should NOT see Band Beta shows'
);

-- Test: User 2 can see only Band Beta shows
select tests.authenticate_as('banduser2@test.com');

select is(
  (select count(*)::int from shows),
  1,
  'User 2 should see exactly 1 show (their band)'
);

select is(
  (select name from shows where id = 'bbbbbbbb-0003-0000-0000-000000000001'),
  'Beta Show',
  'User 2 should see their band show'
);

select is(
  (select count(*)::int from shows where id = 'aaaaaaaa-0003-0000-0000-000000000001'),
  0,
  'User 2 should NOT see Band Alpha shows'
);

-- ============================================================================
-- Practice Sessions Isolation Tests
-- ============================================================================

-- User 1 creates a practice session for Band Alpha
select tests.authenticate_as('banduser1@test.com');

insert into practice_sessions (id, band_id, scheduled_date, type)
values (
  'aaaaaaaa-0004-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  now() + interval '3 days',
  'rehearsal'
);

-- User 2 creates a practice session for Band Beta
select tests.authenticate_as('banduser2@test.com');

insert into practice_sessions (id, band_id, scheduled_date, type)
values (
  'bbbbbbbb-0004-0000-0000-000000000001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  now() + interval '3 days',
  'rehearsal'
);

-- Test: User 1 can see only Band Alpha practice sessions
select tests.authenticate_as('banduser1@test.com');

select is(
  (select count(*)::int from practice_sessions),
  1,
  'User 1 should see exactly 1 practice session (their band)'
);

select is(
  (select count(*)::int from practice_sessions where id = 'bbbbbbbb-0004-0000-0000-000000000001'),
  0,
  'User 1 should NOT see Band Beta practice sessions'
);

-- Test: User 2 can see only Band Beta practice sessions
select tests.authenticate_as('banduser2@test.com');

select is(
  (select count(*)::int from practice_sessions),
  1,
  'User 2 should see exactly 1 practice session (their band)'
);

select is(
  (select count(*)::int from practice_sessions where id = 'aaaaaaaa-0004-0000-0000-000000000001'),
  0,
  'User 2 should NOT see Band Alpha practice sessions'
);

-- Finalize
select * from finish();

-- Rollback to cleanup
rollback;
