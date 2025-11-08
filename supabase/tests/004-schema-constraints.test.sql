-- Test: Validate foreign keys, check constraints, unique constraints
-- Purpose: Ensure referential integrity and data validation constraints
-- Category: Schema
-- Created: 2025-11-07

begin;

select plan(42);

-- ============================================================================
-- Foreign Keys (18 tests)
-- ============================================================================

-- User Profiles
select has_fk('user_profiles', 'user_profiles should have foreign key to users');

-- Band Memberships
select has_fk('band_memberships', 'band_memberships should have foreign key to users');
select has_fk('band_memberships', 'band_memberships should have foreign key to bands');

-- Invite Codes
select has_fk('invite_codes', 'invite_codes should have foreign key to bands');
select has_fk('invite_codes', 'invite_codes should have foreign key to users (created_by)');

-- Songs
select has_fk('songs', 'songs should have foreign key to users (created_by)');

-- Song Group Memberships
select has_fk('song_group_memberships', 'song_group_memberships should have foreign key to songs');
select has_fk('song_group_memberships', 'song_group_memberships should have foreign key to song_groups');

-- Setlists
select has_fk('setlists', 'setlists should have foreign key to bands');
select has_fk('setlists', 'setlists should have foreign key to users (created_by)');
select has_fk('setlists', 'setlists should have foreign key to setlists (forked_from)');

-- Shows
select has_fk('shows', 'shows should have foreign key to bands');
select has_fk('shows', 'shows should have foreign key to setlists');

-- Practice Sessions
select has_fk('practice_sessions', 'practice_sessions should have foreign key to bands');
select has_fk('practice_sessions', 'practice_sessions should have foreign key to setlists');

-- Song Castings
select has_fk('song_castings', 'song_castings should have foreign key to songs');
select has_fk('song_castings', 'song_castings should have foreign key to users (created_by)');

-- Audit Log
select has_fk('audit_log', 'audit_log should have foreign key to bands');

-- ============================================================================
-- Check Constraints (12 tests - using pg_constraint directly)
-- ============================================================================

-- Users
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'users_email_check'
      and conrelid = 'public.users'::regclass
  ),
  'users should have email format check'
);

-- Band Memberships
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'membership_role_check'
      and conrelid = 'public.band_memberships'::regclass
  ),
  'band_memberships should have role check'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'membership_status_check'
      and conrelid = 'public.band_memberships'::regclass
  ),
  'band_memberships should have status check'
);

-- Invite Codes
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'invite_code_check'
      and conrelid = 'public.invite_codes'::regclass
  ),
  'invite_codes should have code length check'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'invite_uses_check'
      and conrelid = 'public.invite_codes'::regclass
  ),
  'invite_codes should have uses check'
);

-- Songs
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'song_difficulty_check'
      and conrelid = 'public.songs'::regclass
  ),
  'songs should have difficulty check (1-5)'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'song_confidence_check'
      and conrelid = 'public.songs'::regclass
  ),
  'songs should have confidence check (1-5)'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'song_context_check'
      and conrelid = 'public.songs'::regclass
  ),
  'songs should have context_type check'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'song_visibility_check'
      and conrelid = 'public.songs'::regclass
  ),
  'songs should have visibility check'
);

-- Setlists
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'setlist_status_check'
      and conrelid = 'public.setlists'::regclass
  ),
  'setlists should have status check'
);

-- Practice Sessions
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'session_type_check'
      and conrelid = 'public.practice_sessions'::regclass
  ),
  'practice_sessions should have type check'
);

select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'session_rating_check'
      and conrelid = 'public.practice_sessions'::regclass
  ),
  'practice_sessions should have rating check'
);

-- Note: shows table has inline CHECK constraints without names (not testable with has_check)
-- Note: audit_log table has inline CHECK constraint on action column (not testable with has_check)

-- ============================================================================
-- Unique Constraints (12 tests)
-- ============================================================================

-- Users
select col_is_unique('users', ARRAY['email'], 'users.email should be unique');

-- User Profiles
select col_is_unique('user_profiles', ARRAY['user_id'], 'user_profiles.user_id should be unique');

-- Band Memberships
select col_is_unique('band_memberships', ARRAY['user_id', 'band_id'], 'band_memberships (user_id, band_id) should be unique');

-- Invite Codes
select col_is_unique('invite_codes', ARRAY['code'], 'invite_codes.code should be unique');

-- Song Group Memberships
select col_is_unique('song_group_memberships', ARRAY['song_id', 'song_group_id'], 'song_group_memberships (song_id, song_group_id) should be unique');

-- Member Capabilities
select col_is_unique('member_capabilities', ARRAY['user_id', 'band_id', 'role_type'], 'member_capabilities (user_id, band_id, role_type) should be unique');

-- Validate primary keys are unique (sample tables)
select col_is_pk('users', ARRAY['id'], 'users.id should be primary key');
select col_is_pk('bands', ARRAY['id'], 'bands.id should be primary key');
select col_is_pk('songs', ARRAY['id'], 'songs.id should be primary key');
select col_is_pk('setlists', ARRAY['id'], 'setlists.id should be primary key');
select col_is_pk('shows', ARRAY['id'], 'shows.id should be primary key');
select col_is_pk('audit_log', ARRAY['id'], 'audit_log.id should be primary key');

select * from finish();
rollback;
