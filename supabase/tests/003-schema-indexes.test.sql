-- Test: Validate performance indexes exist
-- Purpose: Ensure all critical indexes are created for query performance
-- Category: Schema
-- Created: 2025-11-07

begin;

select plan(29);

-- ============================================================================
-- User indexes (2 tests)
-- ============================================================================
select has_index('users', 'idx_users_email', 'users should have email index');
select has_index('user_profiles', 'idx_user_profiles_user_id', 'user_profiles should have user_id index');

-- ============================================================================
-- Band membership indexes (3 tests)
-- ============================================================================
select has_index('band_memberships', 'idx_band_memberships_user_id', 'band_memberships should have user_id index');
select has_index('band_memberships', 'idx_band_memberships_band_id', 'band_memberships should have band_id index');
select has_index('band_memberships', 'idx_band_memberships_status', 'band_memberships should have status index');

-- ============================================================================
-- Song indexes (5 tests)
-- ============================================================================
select has_index('songs', 'idx_songs_context', 'songs should have context composite index');
select has_index('songs', 'idx_songs_created_by', 'songs should have created_by index');
select has_index('songs', 'idx_songs_song_group_id', 'songs should have song_group_id index');
select has_index('songs', 'idx_songs_version', 'songs should have version index');
select has_index('songs', 'idx_songs_version_modified', 'songs should have version+updated_date composite index');

-- ============================================================================
-- Song group indexes (2 tests)
-- ============================================================================
select has_index('song_group_memberships', 'idx_song_group_memberships_song_id', 'song_group_memberships should have song_id index');
select has_index('song_group_memberships', 'idx_song_group_memberships_group_id', 'song_group_memberships should have group_id index');

-- ============================================================================
-- Setlist indexes (4 tests)
-- ============================================================================
select has_index('setlists', 'idx_setlists_band_id', 'setlists should have band_id index');
select has_index('setlists', 'idx_setlists_show_id', 'setlists should have show_id index');
select has_index('setlists', 'idx_setlists_version', 'setlists should have version index');
select has_index('setlists', 'idx_setlists_version_modified', 'setlists should have version+last_modified composite index');

-- ============================================================================
-- Show indexes (5 tests)
-- ============================================================================
select has_index('shows', 'idx_shows_band_id', 'shows should have band_id index');
select has_index('shows', 'idx_shows_setlist_id', 'shows should have setlist_id index');
select has_index('shows', 'idx_shows_scheduled_date', 'shows should have scheduled_date composite index');
select has_index('shows', 'idx_shows_status', 'shows should have status index');
select has_index('shows', 'idx_shows_version', 'shows should have version index');

-- ============================================================================
-- Practice session indexes (4 tests)
-- ============================================================================
select has_index('practice_sessions', 'idx_practice_sessions_band_id', 'practice_sessions should have band_id index');
select has_index('practice_sessions', 'idx_practice_sessions_setlist_id', 'practice_sessions should have setlist_id index');
select has_index('practice_sessions', 'idx_practice_sessions_scheduled_date', 'practice_sessions should have scheduled_date index');
select has_index('practice_sessions', 'idx_practice_sessions_version', 'practice_sessions should have version index');

-- ============================================================================
-- Audit log indexes (4 tests)
-- ============================================================================
select has_index('audit_log', 'idx_audit_log_table_record', 'audit_log should have table_record composite index');
select has_index('audit_log', 'idx_audit_log_band_date', 'audit_log should have band_date composite index');
select has_index('audit_log', 'idx_audit_log_user_date', 'audit_log should have user_date composite index');
select has_index('audit_log', 'idx_audit_log_changed_at', 'audit_log should have changed_at index');

select * from finish();
rollback;
