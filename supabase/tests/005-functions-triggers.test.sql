-- Test: Functions and Triggers
-- Purpose: Validate trigger functions and triggers exist and work correctly
-- Category: Functions/Triggers
-- Created: 2025-11-07

begin;

-- Note: Plan reduced from 29 to 28 - practice_sessions created_by trigger removed in migration 20251107000001
select plan(28);

-- ============================================================================
-- Function Existence Tests
-- ============================================================================

select has_function(
  'update_updated_date_column',
  'Should have update_updated_date_column function'
);

select has_function(
  'increment_version',
  'Should have increment_version function'
);

select has_function(
  'set_last_modified_by',
  'Should have set_last_modified_by function'
);

select has_function(
  'set_created_by',
  'Should have set_created_by function'
);

select has_function(
  'log_audit_trail',
  'Should have log_audit_trail function'
);

-- ============================================================================
-- Function Return Types Tests
-- ============================================================================

select function_returns(
  'update_updated_date_column',
  'trigger',
  'update_updated_date_column should return trigger'
);

select function_returns(
  'increment_version',
  'trigger',
  'increment_version should return trigger'
);

select function_returns(
  'set_last_modified_by',
  'trigger',
  'set_last_modified_by should return trigger'
);

select function_returns(
  'set_created_by',
  'trigger',
  'set_created_by should return trigger'
);

select function_returns(
  'log_audit_trail',
  'trigger',
  'log_audit_trail should return trigger'
);

-- ============================================================================
-- Updated_date Trigger Tests
-- ============================================================================

select has_trigger(
  'bands',
  'update_bands_updated_date',
  'Bands should have updated_date trigger'
);

select has_trigger(
  'songs',
  'update_songs_updated_date',
  'Songs should have updated_date trigger'
);

select has_trigger(
  'setlists',
  'update_setlists_last_modified',
  'Setlists should have last_modified trigger'
);

-- ============================================================================
-- Version Increment Trigger Tests
-- ============================================================================

select has_trigger(
  'songs',
  'songs_version_trigger',
  'Songs should have version increment trigger'
);

select has_trigger(
  'setlists',
  'setlists_version_trigger',
  'Setlists should have version increment trigger'
);

select has_trigger(
  'shows',
  'shows_version_trigger',
  'Shows should have version increment trigger'
);

select has_trigger(
  'practice_sessions',
  'practice_sessions_version_trigger',
  'Practice sessions should have version increment trigger'
);

-- ============================================================================
-- Created_by Trigger Tests
-- ============================================================================

select has_trigger(
  'songs',
  'songs_set_created_by',
  'Songs should have created_by trigger'
);

select has_trigger(
  'setlists',
  'setlists_set_created_by',
  'Setlists should have created_by trigger'
);

select has_trigger(
  'shows',
  'shows_set_created_by',
  'Shows should have created_by trigger'
);

-- REMOVED: practice_sessions no longer has created_by trigger (dropped in migration 20251107000001)
-- practice_sessions does not have a created_by column, so the trigger was causing errors
-- select has_trigger(
--   'practice_sessions',
--   'practice_sessions_set_created_by',
--   'Practice sessions should have created_by trigger'
-- );

-- ============================================================================
-- Last_modified_by Trigger Tests
-- ============================================================================

select has_trigger(
  'songs',
  'songs_set_last_modified_by',
  'Songs should have last_modified_by trigger'
);

select has_trigger(
  'setlists',
  'setlists_set_last_modified_by',
  'Setlists should have last_modified_by trigger'
);

select has_trigger(
  'shows',
  'shows_set_last_modified_by',
  'Shows should have last_modified_by trigger'
);

select has_trigger(
  'practice_sessions',
  'practice_sessions_set_last_modified_by',
  'Practice sessions should have last_modified_by trigger'
);

-- ============================================================================
-- Audit Log Trigger Tests
-- ============================================================================

select has_trigger(
  'songs',
  'songs_audit_log',
  'Songs should have audit log trigger'
);

select has_trigger(
  'setlists',
  'setlists_audit_log',
  'Setlists should have audit log trigger'
);

select has_trigger(
  'shows',
  'shows_audit_log',
  'Shows should have audit log trigger'
);

select has_trigger(
  'practice_sessions',
  'practice_sessions_audit_log',
  'Practice sessions should have audit log trigger'
);

select * from finish();
rollback;
