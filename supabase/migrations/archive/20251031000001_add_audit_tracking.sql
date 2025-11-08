-- =====================================================================
-- Migration: Add Audit Tracking System (Full Version Control)
-- Created: 2025-10-31
-- Phase: 4a - Audit System Implementation
-- Purpose: Track who modified what, when - complete change history
-- =====================================================================

-- =====================================================================
-- PART 1: Add last_modified_by Column (Quick Wins)
-- =====================================================================
-- This enables immediate UX improvements (no redundant notifications)
-- and provides current-state attribution

-- Songs table
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Setlists table
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Shows table
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Practice Sessions table
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN songs.last_modified_by IS 'User who last modified this record';
COMMENT ON COLUMN setlists.last_modified_by IS 'User who last modified this record';
COMMENT ON COLUMN shows.last_modified_by IS 'User who last modified this record';
COMMENT ON COLUMN practice_sessions.last_modified_by IS 'User who last modified this record';

-- =====================================================================
-- PART 2: Create Audit Log Table (Full Version History)
-- =====================================================================
-- This table stores EVERY change to EVERY record - like git history

CREATE TABLE audit_log (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was changed
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Who changed it (NULL allowed for system/seeding operations)
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL, -- Denormalized for performance (avoid JOIN on every query)

  -- When it was changed
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- What changed (for UPDATE: old vs new, for INSERT: just new, for DELETE: just old)
  old_values JSONB,
  new_values JSONB,

  -- Band context (for RLS and filtering)
  band_id UUID NOT NULL REFERENCES bands(id),

  -- Optional metadata (future use)
  client_info JSONB -- Can store browser, IP, device type, etc.
);

-- Comments for documentation
COMMENT ON TABLE audit_log IS 'Complete change history for all records - never delete from this table';
COMMENT ON COLUMN audit_log.table_name IS 'Which table was modified (songs, setlists, shows, practice_sessions)';
COMMENT ON COLUMN audit_log.record_id IS 'ID of the record that was modified';
COMMENT ON COLUMN audit_log.action IS 'Type of change: INSERT, UPDATE, or DELETE';
COMMENT ON COLUMN audit_log.user_name IS 'Denormalized user name for fast queries without JOINs';
COMMENT ON COLUMN audit_log.old_values IS 'Complete previous record state (JSONB) - NULL for INSERTs';
COMMENT ON COLUMN audit_log.new_values IS 'Complete new record state (JSONB) - NULL for DELETEs';

-- =====================================================================
-- PART 3: Indexes for Performance
-- =====================================================================

-- Query by table + record (most common: "show me history of this song")
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id, changed_at DESC);

-- Query by band (band admin dashboard: "show all recent changes")
CREATE INDEX idx_audit_log_band_date ON audit_log(band_id, changed_at DESC);

-- Query by user (user activity: "show what Mike changed today")
CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, changed_at DESC);

-- Query recent changes (dashboard: "last 50 changes across all bands")
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- =====================================================================
-- PART 4: Row-Level Security (RLS)
-- =====================================================================
-- Only band members can view audit logs for their bands

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view audit logs for their bands"
  ON audit_log FOR SELECT
  USING (
    band_id IN (
      SELECT band_id
      FROM band_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Only the system can INSERT into audit_log (via triggers)
-- Users cannot manually insert, update, or delete audit logs
CREATE POLICY "Only system can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (false); -- No one can INSERT directly (only triggers)

CREATE POLICY "No one can update audit logs"
  ON audit_log FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete audit logs"
  ON audit_log FOR DELETE
  USING (false);

-- =====================================================================
-- PART 5: Trigger Functions
-- =====================================================================

-- Function to automatically set last_modified_by on UPDATE
CREATE OR REPLACE FUNCTION set_last_modified_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Set last_modified_by to current authenticated user
  NEW.last_modified_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_last_modified_by() IS 'Auto-set last_modified_by column on UPDATE';

-- Function to automatically set created_by on INSERT (if NULL)
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if not already provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_created_by() IS 'Auto-set created_by column on INSERT if not provided';

-- Function to log all changes to audit_log
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  v_band_id UUID;
  v_user_name TEXT;
  v_user_id UUID;
BEGIN
  -- Get user_id (might be NULL during seeding/migrations)
  v_user_id := auth.uid();

  -- If no user_id, use NULL and set user_name to 'System'
  IF v_user_id IS NULL THEN
    v_user_name := 'System';
  ELSE
    -- Get user name (denormalized for performance)
    SELECT name INTO v_user_name
    FROM users
    WHERE id = v_user_id;

    -- If user not found, use 'System'
    IF v_user_name IS NULL THEN
      v_user_name := 'System';
    END IF;
  END IF;

  -- Get band_id from the record
  -- Songs use context_id, others use band_id
  IF TG_TABLE_NAME = 'songs' THEN
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.context_id;
    ELSE
      v_band_id := NEW.context_id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.band_id;
    ELSE
      v_band_id := NEW.band_id;
    END IF;
  END IF;

  -- Insert audit log entry based on operation type
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      table_name, record_id, action,
      user_id, user_name, band_id,
      new_values
    ) VALUES (
      TG_TABLE_NAME, NEW.id, 'INSERT',
      v_user_id, v_user_name, v_band_id,
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (
      table_name, record_id, action,
      user_id, user_name, band_id,
      old_values, new_values
    ) VALUES (
      TG_TABLE_NAME, NEW.id, 'UPDATE',
      v_user_id, v_user_name, v_band_id,
      to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (
      table_name, record_id, action,
      user_id, user_name, band_id,
      old_values
    ) VALUES (
      TG_TABLE_NAME, OLD.id, 'DELETE',
      v_user_id, v_user_name, v_band_id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_trail() IS 'Log all INSERT/UPDATE/DELETE operations to audit_log table';

-- =====================================================================
-- PART 6: Create Triggers (last_modified_by)
-- =====================================================================

-- Songs
CREATE TRIGGER songs_set_last_modified_by
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER songs_set_created_by
  BEFORE INSERT ON songs
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- Setlists
CREATE TRIGGER setlists_set_last_modified_by
  BEFORE UPDATE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER setlists_set_created_by
  BEFORE INSERT ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- Shows
CREATE TRIGGER shows_set_last_modified_by
  BEFORE UPDATE ON shows
  FOR EACH ROW
  EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER shows_set_created_by
  BEFORE INSERT ON shows
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- Practice Sessions
CREATE TRIGGER practice_sessions_set_last_modified_by
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER practice_sessions_set_created_by
  BEFORE INSERT ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- =====================================================================
-- PART 7: Create Triggers (audit_log)
-- =====================================================================
-- These run AFTER the operation to capture the final state

-- Songs
CREATE TRIGGER songs_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Setlists
CREATE TRIGGER setlists_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Shows
CREATE TRIGGER shows_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON shows
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- Practice Sessions
CREATE TRIGGER practice_sessions_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

-- =====================================================================
-- PART 8: Verification Queries
-- =====================================================================

-- Verify last_modified_by columns exist
SELECT
  'last_modified_by columns:' as check_type,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'last_modified_by'
  AND table_schema = 'public'
  AND table_name IN ('songs', 'setlists', 'shows', 'practice_sessions')
ORDER BY table_name;

-- Verify triggers are installed
SELECT
  'Triggers installed:' as check_type,
  trigger_schema,
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%modified_by%' OR trigger_name LIKE '%created_by%' OR trigger_name LIKE '%audit_log%'
ORDER BY event_object_table, trigger_name;

-- Verify audit_log table structure
SELECT
  'audit_log table:' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
  'Indexes:' as check_type,
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename = 'audit_log' OR indexname LIKE '%audit%')
ORDER BY tablename, indexname;

-- =====================================================================
-- PART 9: Helpful Queries (Examples)
-- =====================================================================

-- Show recent changes across all bands (admin view)
-- SELECT
--   al.changed_at,
--   al.table_name,
--   al.action,
--   al.user_name,
--   al.new_values->>'title' as item_title
-- FROM audit_log al
-- ORDER BY al.changed_at DESC
-- LIMIT 50;

-- Show history of a specific song
-- SELECT
--   changed_at,
--   action,
--   user_name,
--   old_values->>'title' as old_title,
--   new_values->>'title' as new_title
-- FROM audit_log
-- WHERE table_name = 'songs' AND record_id = 'some-song-id'
-- ORDER BY changed_at DESC;

-- Show what changed between two versions
-- WITH versions AS (
--   SELECT
--     changed_at,
--     new_values,
--     LAG(new_values) OVER (ORDER BY changed_at) as prev_values
--   FROM audit_log
--   WHERE table_name = 'songs' AND record_id = 'some-song-id'
-- )
-- SELECT
--   changed_at,
--   jsonb_diff(prev_values, new_values) as changes
-- FROM versions
-- WHERE prev_values IS NOT NULL;

-- =====================================================================
-- PART 10: Maintenance
-- =====================================================================

-- Optional: Archive old audit logs (run periodically, e.g., annually)
-- DELETE FROM audit_log WHERE changed_at < NOW() - INTERVAL '2 years';

-- Optional: Create archive table for old logs
-- CREATE TABLE audit_log_archive (LIKE audit_log INCLUDING ALL);
-- INSERT INTO audit_log_archive SELECT * FROM audit_log WHERE changed_at < NOW() - INTERVAL '1 year';
-- DELETE FROM audit_log WHERE changed_at < NOW() - INTERVAL '1 year';

-- =====================================================================
-- Migration Complete
-- =====================================================================

-- Run verification queries above to ensure everything is set up correctly
