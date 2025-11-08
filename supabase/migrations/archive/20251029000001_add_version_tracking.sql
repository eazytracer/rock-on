-- Migration: Add Version Tracking to Synced Tables
-- Date: 2025-10-29
-- Phase 3, Step 3.1: Version Control for Conflict Resolution
--
-- This migration adds version tracking fields and triggers to all synced tables
-- to enable conflict detection and resolution during sync operations.
--
-- Changes:
-- 1. Add `version` column (INTEGER DEFAULT 1) to songs, setlists, shows, practice_sessions
-- 2. Add `last_modified_by` column (UUID REFERENCES auth.users) to track who made changes
-- 3. Create `increment_version()` trigger function to auto-increment version on UPDATE
-- 4. Create triggers on each table to call increment_version()
-- 5. Add performance indexes on version columns

-- ============================================================================
-- Add version columns to all synced tables
-- ============================================================================

-- Songs
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Setlists
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Shows
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Practice Sessions
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- Create version increment trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-increment version on every UPDATE
  NEW.version = COALESCE(OLD.version, 0) + 1;

  -- Update timestamp based on table structure
  -- Songs and shows use updated_date, setlists use last_modified,
  -- practice_sessions don't have an update timestamp
  IF TG_TABLE_NAME = 'songs' OR TG_TABLE_NAME = 'shows' THEN
    NEW.updated_date = NOW();
  ELSIF TG_TABLE_NAME = 'setlists' THEN
    NEW.last_modified = NOW();
  END IF;

  -- Set last_modified_by if not explicitly provided
  -- (In authenticated context, auth.uid() will be available)
  IF NEW.last_modified_by IS NULL THEN
    NEW.last_modified_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to function
COMMENT ON FUNCTION increment_version() IS 'Auto-increments version number and updates timestamp on UPDATE operations. Used for conflict detection in sync operations.';

-- ============================================================================
-- Create triggers for each table
-- ============================================================================

-- Songs trigger
DROP TRIGGER IF EXISTS songs_version_trigger ON songs;
CREATE TRIGGER songs_version_trigger
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Setlists trigger
DROP TRIGGER IF EXISTS setlists_version_trigger ON setlists;
CREATE TRIGGER setlists_version_trigger
  BEFORE UPDATE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Shows trigger
DROP TRIGGER IF EXISTS shows_version_trigger ON shows;
CREATE TRIGGER shows_version_trigger
  BEFORE UPDATE ON shows
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Practice Sessions trigger
DROP TRIGGER IF EXISTS practice_sessions_version_trigger ON practice_sessions;
CREATE TRIGGER practice_sessions_version_trigger
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- ============================================================================
-- Create performance indexes
-- ============================================================================

-- Index on version columns for efficient conflict detection queries
CREATE INDEX IF NOT EXISTS idx_songs_version ON songs(version);
CREATE INDEX IF NOT EXISTS idx_songs_version_modified ON songs(version, updated_date);

CREATE INDEX IF NOT EXISTS idx_setlists_version ON setlists(version);
CREATE INDEX IF NOT EXISTS idx_setlists_version_modified ON setlists(version, last_modified);

CREATE INDEX IF NOT EXISTS idx_shows_version ON shows(version);
CREATE INDEX IF NOT EXISTS idx_shows_version_modified ON shows(version, updated_date);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_version ON practice_sessions(version);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_version_created ON practice_sessions(version, created_date);

-- ============================================================================
-- Verification queries (for testing)
-- ============================================================================

-- These comments document how to verify the migration worked:
--
-- Check columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'songs' AND column_name IN ('version', 'last_modified_by');
--
-- Check triggers exist:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_table IN ('songs', 'setlists', 'shows', 'practice_sessions');
--
-- Check indexes exist:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('songs', 'setlists', 'shows', 'practice_sessions')
-- AND indexname LIKE '%version%';
--
-- Test version increment:
-- UPDATE songs SET title = 'Test' WHERE id = '<some-id>' RETURNING version;
