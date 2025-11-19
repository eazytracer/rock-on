-- Test: Validate all tables exist
-- Purpose: Ensure complete schema is deployed
-- Category: Schema
-- Created: 2025-11-07

begin;

select plan(17);

-- Core tables
select has_table('users', 'users table should exist');
select has_table('user_profiles', 'user_profiles table should exist');
select has_table('bands', 'bands table should exist');
select has_table('band_memberships', 'band_memberships table should exist');
select has_table('invite_codes', 'invite_codes table should exist');

-- Content tables
select has_table('songs', 'songs table should exist');
select has_table('song_groups', 'song_groups table should exist');
select has_table('song_group_memberships', 'song_group_memberships table should exist');
select has_table('setlists', 'setlists table should exist');
select has_table('shows', 'shows table should exist');
select has_table('practice_sessions', 'practice_sessions table should exist');

-- Casting tables
select has_table('song_castings', 'song_castings table should exist');
select has_table('song_assignments', 'song_assignments table should exist');
select has_table('assignment_roles', 'assignment_roles table should exist');
select has_table('casting_templates', 'casting_templates table should exist');
select has_table('member_capabilities', 'member_capabilities table should exist');

-- Audit table
select has_table('audit_log', 'audit_log table should exist');

select * from finish();
rollback;
