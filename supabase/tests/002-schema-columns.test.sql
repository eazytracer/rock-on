-- Test: Validate critical columns with correct types
-- Purpose: Ensure all critical columns exist with correct data types
-- Category: Schema
-- Created: 2025-11-07

begin;

select plan(81);

-- ============================================================================
-- Users table (6 tests)
-- ============================================================================
select has_column('users', 'id', 'users should have id column');
select col_is_pk('users', 'id', 'users.id should be primary key');
select has_column('users', 'email', 'users should have email column');
select col_type_is('users', 'email', 'text', 'users.email should be text');
select has_column('users', 'name', 'users should have name column');
select has_column('users', 'created_date', 'users should have created_date column');

-- ============================================================================
-- User Profiles table (6 tests)
-- ============================================================================
select has_column('user_profiles', 'id', 'user_profiles should have id column');
select col_is_pk('user_profiles', 'id', 'user_profiles.id should be primary key');
select has_column('user_profiles', 'user_id', 'user_profiles should have user_id column');
select col_type_is('user_profiles', 'user_id', 'uuid', 'user_profiles.user_id should be uuid');
select has_column('user_profiles', 'display_name', 'user_profiles should have display_name column');
select has_column('user_profiles', 'primary_instrument', 'user_profiles should have primary_instrument column');

-- ============================================================================
-- Bands table (6 tests)
-- ============================================================================
select has_column('bands', 'id', 'bands should have id column');
select col_is_pk('bands', 'id', 'bands.id should be primary key');
select has_column('bands', 'name', 'bands should have name column');
select col_type_is('bands', 'name', 'text', 'bands.name should be text');
select has_column('bands', 'created_date', 'bands should have created_date column');
select has_column('bands', 'updated_date', 'bands should have updated_date column');

-- ============================================================================
-- Band Memberships table (8 tests)
-- ============================================================================
select has_column('band_memberships', 'id', 'band_memberships should have id column');
select col_is_pk('band_memberships', 'id', 'band_memberships.id should be primary key');
select has_column('band_memberships', 'user_id', 'band_memberships should have user_id column');
select has_column('band_memberships', 'band_id', 'band_memberships should have band_id column');
select has_column('band_memberships', 'role', 'band_memberships should have role column');
select col_type_is('band_memberships', 'role', 'text', 'band_memberships.role should be text');
select has_column('band_memberships', 'status', 'band_memberships should have status column');
select has_column('band_memberships', 'joined_date', 'band_memberships should have joined_date column');

-- ============================================================================
-- Songs table (12 tests - CRITICAL FIELDS)
-- ============================================================================
select has_column('songs', 'id', 'songs should have id column');
select col_is_pk('songs', 'id', 'songs.id should be primary key');
select has_column('songs', 'tempo', 'songs should have tempo column (NOT bpm)');
select col_type_is('songs', 'tempo', 'integer', 'songs.tempo should be integer');
select has_column('songs', 'context_id', 'songs should have context_id column');
select col_type_is('songs', 'context_id', 'text', 'songs.context_id should be text (NOT uuid)');
select has_column('songs', 'context_type', 'songs should have context_type column');
select has_column('songs', 'version', 'songs should have version column');
select col_default_is('songs', 'version', '1', 'songs.version should default to 1');
select has_column('songs', 'last_modified_by', 'songs should have last_modified_by column');
select col_type_is('songs', 'last_modified_by', 'uuid', 'songs.last_modified_by should be uuid');
select col_is_null('songs', 'last_modified_by', 'songs.last_modified_by should be nullable');

-- ============================================================================
-- Setlists table (10 tests - CRITICAL FIELDS)
-- ============================================================================
select has_column('setlists', 'id', 'setlists should have id column');
select col_is_pk('setlists', 'id', 'setlists.id should be primary key');
select has_column('setlists', 'items', 'setlists should have items column');
select col_type_is('setlists', 'items', 'jsonb', 'setlists.items should be jsonb');
select has_column('setlists', 'last_modified', 'setlists should have last_modified column (NOT updated_date)');
select col_type_is('setlists', 'last_modified', 'timestamp with time zone', 'setlists.last_modified should be timestamptz');
select has_column('setlists', 'version', 'setlists should have version column');
select has_column('setlists', 'last_modified_by', 'setlists should have last_modified_by column');
select has_column('setlists', 'forked_from', 'setlists should have forked_from column');
select has_column('setlists', 'fork_count', 'setlists should have fork_count column');

-- ============================================================================
-- Shows table (8 tests)
-- ============================================================================
select has_column('shows', 'id', 'shows should have id column');
select col_is_pk('shows', 'id', 'shows.id should be primary key');
select has_column('shows', 'gig_type', 'shows should have gig_type column');
select has_column('shows', 'venue', 'shows should have venue column');
select has_column('shows', 'load_in_time', 'shows should have load_in_time column');
select has_column('shows', 'soundcheck_time', 'shows should have soundcheck_time column');
select has_column('shows', 'set_time', 'shows should have set_time column');
select has_column('shows', 'version', 'shows should have version column');

-- ============================================================================
-- Practice Sessions table (6 tests)
-- ============================================================================
select has_column('practice_sessions', 'id', 'practice_sessions should have id column');
select col_is_pk('practice_sessions', 'id', 'practice_sessions.id should be primary key');
select has_column('practice_sessions', 'type', 'practice_sessions should have type column');
select col_not_null('practice_sessions', 'type', 'practice_sessions.type should be NOT NULL');
select has_column('practice_sessions', 'version', 'practice_sessions should have version column');
select has_column('practice_sessions', 'last_modified_by', 'practice_sessions should have last_modified_by column');

-- ============================================================================
-- Audit Log table (13 tests)
-- ============================================================================
select has_column('audit_log', 'id', 'audit_log should have id column');
select col_is_pk('audit_log', 'id', 'audit_log.id should be primary key');
select has_column('audit_log', 'table_name', 'audit_log should have table_name column');
select col_type_is('audit_log', 'table_name', 'text', 'audit_log.table_name should be text');
select has_column('audit_log', 'record_id', 'audit_log should have record_id column');
select col_type_is('audit_log', 'record_id', 'text', 'audit_log.record_id should be text');
select has_column('audit_log', 'action', 'audit_log should have action column');
select has_column('audit_log', 'user_id', 'audit_log should have user_id column');
select has_column('audit_log', 'user_name', 'audit_log should have user_name column');
select has_column('audit_log', 'old_values', 'audit_log should have old_values column');
select col_type_is('audit_log', 'old_values', 'jsonb', 'audit_log.old_values should be jsonb');
select has_column('audit_log', 'new_values', 'audit_log should have new_values column');
select col_type_is('audit_log', 'new_values', 'jsonb', 'audit_log.new_values should be jsonb');

-- ============================================================================
-- Additional Critical Columns (6 tests)
-- ============================================================================
select has_column('invite_codes', 'code', 'invite_codes should have code column');
select has_column('song_groups', 'name', 'song_groups should have name column');
select has_column('song_castings', 'context_type', 'song_castings should have context_type column');
select has_column('song_assignments', 'song_casting_id', 'song_assignments should have song_casting_id column');
select has_column('assignment_roles', 'type', 'assignment_roles should have type column');
select has_column('casting_templates', 'template_data', 'casting_templates should have template_data column');

select * from finish();
rollback;
