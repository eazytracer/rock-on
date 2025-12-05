-- Test: Trigger-Column Compatibility
-- Purpose: Ensure trigger functions only reference columns that exist on their tables
-- Category: Schema Validation
-- Created: 2025-12-05
--
-- This test catches a critical bug where a trigger function references a column
-- that doesn't exist on the table (e.g., update_updated_date_column on setlists
-- which uses last_modified instead of updated_date).

begin;

select plan(15);

-- ============================================================================
-- Helper function to check if a trigger function references valid columns
-- ============================================================================

-- Test: update_setlist_last_modified function should exist (for setlists)
select has_function(
  'update_setlist_last_modified',
  'Should have update_setlist_last_modified function for setlists table'
);

-- ============================================================================
-- Verify setlists trigger uses the correct function
-- ============================================================================

-- The setlists table uses last_modified, NOT updated_date
-- So it MUST use update_setlist_last_modified, NOT update_updated_date_column
select is(
  (SELECT proname FROM pg_trigger t
   JOIN pg_proc p ON t.tgfoid = p.oid
   WHERE tgrelid = 'public.setlists'::regclass
   AND tgname = 'update_setlists_last_modified'),
  'update_setlist_last_modified',
  'Setlists last_modified trigger should use update_setlist_last_modified function'
);

-- ============================================================================
-- Verify each table has the correct timestamp column for its triggers
-- ============================================================================

-- Tables with updated_date column should use update_updated_date_column trigger
select col_type_is(
  'bands',
  'updated_date',
  'timestamp with time zone',
  'Bands should have updated_date column for timestamp trigger'
);

select col_type_is(
  'songs',
  'updated_date',
  'timestamp with time zone',
  'Songs should have updated_date column for timestamp trigger'
);

select col_type_is(
  'shows',
  'updated_date',
  'timestamp with time zone',
  'Shows should have updated_date column for timestamp trigger'
);

select col_type_is(
  'user_profiles',
  'updated_date',
  'timestamp with time zone',
  'User profiles should have updated_date column for timestamp trigger'
);

-- Setlists uses last_modified instead of updated_date
select col_type_is(
  'setlists',
  'last_modified',
  'timestamp with time zone',
  'Setlists should have last_modified column (not updated_date)'
);

-- Verify setlists does NOT have updated_date column
select hasnt_column(
  'setlists',
  'updated_date',
  'Setlists should NOT have updated_date column (uses last_modified instead)'
);

-- ============================================================================
-- Test that triggers using update_updated_date_column are on correct tables
-- ============================================================================

-- Get all triggers using update_updated_date_column and verify their tables have updated_date
select ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE p.proname = 'update_updated_date_column'
    AND c.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = c.relname
      AND column_name = 'updated_date'
    )
  ),
  'All triggers using update_updated_date_column should be on tables with updated_date column'
);

-- ============================================================================
-- Test that triggers using update_setlist_last_modified are on correct tables
-- ============================================================================

select ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE p.proname = 'update_setlist_last_modified'
    AND c.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = c.relname
      AND column_name = 'last_modified'
    )
  ),
  'All triggers using update_setlist_last_modified should be on tables with last_modified column'
);

-- ============================================================================
-- Test version triggers are on tables with version column
-- ============================================================================

select ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE p.proname = 'increment_version'
    AND c.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = c.relname
      AND column_name = 'version'
    )
  ),
  'All triggers using increment_version should be on tables with version column'
);

-- ============================================================================
-- Test created_by triggers are on tables with created_by column
-- ============================================================================

select ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE p.proname = 'set_created_by'
    AND c.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = c.relname
      AND column_name = 'created_by'
    )
  ),
  'All triggers using set_created_by should be on tables with created_by column'
);

-- ============================================================================
-- Test last_modified_by triggers are on tables with last_modified_by column
-- ============================================================================

select ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE p.proname = 'set_last_modified_by'
    AND c.relnamespace = 'public'::regnamespace
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = c.relname
      AND column_name = 'last_modified_by'
    )
  ),
  'All triggers using set_last_modified_by should be on tables with last_modified_by column'
);

-- ============================================================================
-- Functional test: Actually try to update a setlist (catches runtime errors)
-- ============================================================================

-- Create test data
DO $$
DECLARE
  test_user_id UUID;
  test_band_id UUID;
  test_setlist_id UUID;
BEGIN
  -- Create test user
  INSERT INTO public.users (id, email, name)
  VALUES (gen_random_uuid(), 'trigger-test@example.com', 'Trigger Test')
  RETURNING id INTO test_user_id;

  -- Create test band
  INSERT INTO public.bands (id, name, created_by)
  VALUES (gen_random_uuid(), 'Trigger Test Band', test_user_id)
  RETURNING id INTO test_band_id;

  -- Create test setlist
  INSERT INTO public.setlists (id, name, band_id, created_by, status)
  VALUES (gen_random_uuid(), 'Trigger Test Setlist', test_band_id, test_user_id, 'draft')
  RETURNING id INTO test_setlist_id;

  -- Store IDs for later tests
  PERFORM set_config('test.setlist_id', test_setlist_id::text, true);
END $$;

-- Test: Update should succeed without "record has no field" error
select lives_ok(
  format('UPDATE public.setlists SET name = ''Updated Name'' WHERE id = %L', current_setting('test.setlist_id')::uuid),
  'Updating a setlist should not fail due to missing column in trigger'
);

-- Test: Verify last_modified is not null after UPDATE
select ok(
  (SELECT last_modified IS NOT NULL FROM public.setlists WHERE id = current_setting('test.setlist_id')::uuid),
  'Setlist last_modified should be set after UPDATE'
);

select * from finish();
rollback;
