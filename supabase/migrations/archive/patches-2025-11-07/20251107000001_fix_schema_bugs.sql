-- Migration: Fix Schema Bugs
-- Created: 2025-11-07T04:54:49 UTC
-- Purpose: Fix 3 critical schema bugs identified by pgTAP tests
-- Related Issues:
--   1. practice_sessions has set_created_by trigger but no created_by column
--   2. audit_log.band_id is NOT NULL but personal songs have no band
--   3. log_audit_trail() function doesn't handle personal songs correctly

-- ==============================================================================
-- BUG FIX 1: Drop practice_sessions_set_created_by trigger
-- ==============================================================================
-- Problem: The practice_sessions table doesn't have a created_by column,
--          but has a trigger that tries to set it. Practice sessions only track
--          version and last_modified_by, not created_by.
-- Solution: Drop the invalid trigger
-- Evidence: src/models/PracticeSession.ts has no createdBy field
--           RemoteRepository.mapPracticeSessionToSupabase() doesn't map created_by

DROP TRIGGER IF EXISTS practice_sessions_set_created_by ON practice_sessions;

COMMENT ON TABLE practice_sessions IS
  'Practice sessions - tracks version and last_modified_by (does NOT track created_by)';

-- Rollback: Re-create the trigger if needed (but it will fail on INSERT)
-- CREATE TRIGGER practice_sessions_set_created_by BEFORE INSERT ON practice_sessions
--   FOR EACH ROW EXECUTE FUNCTION set_created_by();


-- ==============================================================================
-- BUG FIX 2: Make audit_log.band_id NULLABLE
-- ==============================================================================
-- Problem: Songs with context_type='personal' have context_id = user_id (not a band_id).
--          When the audit trigger fires, it tries to insert a user_id as band_id,
--          causing a foreign key violation (user_id doesn't exist in bands table).
-- Solution: Make band_id nullable to support personal songs
-- Evidence: songs table has context_type CHECK ('band', 'personal')
--           Personal songs use context_id = user_id, not band_id

ALTER TABLE audit_log ALTER COLUMN band_id DROP NOT NULL;

COMMENT ON COLUMN audit_log.band_id IS
  'Band context (for RLS and filtering) - NULL for personal songs and other non-band records';

-- Rollback: Make band_id NOT NULL again (but this will fail if personal songs exist)
-- ALTER TABLE audit_log ALTER COLUMN band_id SET NOT NULL;


-- ==============================================================================
-- BUG FIX 3: Update log_audit_trail() function to handle NULL band_id
-- ==============================================================================
-- Problem: The function blindly extracts context_id as band_id for ALL songs,
--          but personal songs have context_id = user_id, not band_id.
-- Solution: Check context_type and set band_id = NULL for personal songs

CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_band_id UUID;
BEGIN
  -- Get user_id from the record (if available)
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.last_modified_by;
  ELSE
    v_user_id := NEW.last_modified_by;
  END IF;

  -- Fallback to current user if no last_modified_by
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;

  -- Get user_name (denormalized for fast queries)
  IF v_user_id IS NOT NULL THEN
    -- Try to get name from public.users first (MVP seed data)
    SELECT name INTO v_user_name FROM public.users WHERE id = v_user_id;

    -- Fallback to auth.users metadata if not in public.users
    IF v_user_name IS NULL THEN
      SELECT raw_user_meta_data->>'name' INTO v_user_name
      FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  -- Always set default if still NULL
  IF v_user_name IS NULL THEN
    v_user_name := 'System';
  END IF;

  -- Get band_id from the record
  -- Special handling for songs: check context_type to determine if band_id is valid
  IF TG_TABLE_NAME = 'songs' THEN
    -- For songs, only use context_id as band_id if context_type = 'band'
    IF TG_OP = 'DELETE' THEN
      IF OLD.context_type = 'band' THEN
        v_band_id := OLD.context_id::uuid;
      ELSE
        v_band_id := NULL;  -- Personal song: no band_id
      END IF;
    ELSE
      IF NEW.context_type = 'band' THEN
        v_band_id := NEW.context_id::uuid;
      ELSE
        v_band_id := NULL;  -- Personal song: no band_id
      END IF;
    END IF;
  ELSE
    -- For other tables, use band_id directly
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.band_id;
    ELSE
      v_band_id := NEW.band_id;
    END IF;
  END IF;

  -- Insert audit log entry based on operation type
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, band_id, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_user_id, v_user_name, v_band_id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, band_id, old_values, new_values)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_user_id, v_user_name, v_band_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, band_id, old_values)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_user_id, v_user_name, v_band_id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_trail() IS
  'Log all INSERT/UPDATE/DELETE operations to audit_log table - handles NULL band_id for personal songs';

-- Rollback: Restore the original function (copy from baseline migration)
-- CREATE OR REPLACE FUNCTION log_audit_trail() ...
--   (see lines 473-529 in 20251106000000_baseline_schema.sql)


-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================
-- Run these after applying the migration to verify fixes:

-- 1. Verify trigger is dropped:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'practice_sessions_set_created_by';
-- Expected: 0 rows

-- 2. Verify audit_log.band_id is nullable:
-- SELECT is_nullable FROM information_schema.columns
-- WHERE table_name = 'audit_log' AND column_name = 'band_id';
-- Expected: YES

-- 3. Test personal song audit logging:
-- INSERT INTO songs (title, context_type, context_id, created_by, last_modified_by)
-- VALUES ('Test Personal', 'personal', auth.uid()::text, auth.uid(), auth.uid());
-- SELECT band_id FROM audit_log WHERE table_name = 'songs' ORDER BY changed_at DESC LIMIT 1;
-- Expected: NULL (no foreign key error)
