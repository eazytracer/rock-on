-- ============================================================================
-- Migration: Add Song Notes System and Wrapup Notes
-- Date: 2026-01-12
-- Description: Adds wrapup_notes to practice sessions and the song notes
--              system (personal notes + practice log entries)
--
-- NOTE: guitar_tuning was already added to songs in a previous migration
--
-- SAFETY: All changes are non-breaking additive changes:
--   - New columns are nullable
--   - New tables don't affect existing data
--   - Existing users and songs are unaffected
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add New Columns to Existing Tables
-- ============================================================================

-- Add wrapup_notes column to practice_sessions (nullable, no default needed)
ALTER TABLE public.practice_sessions
ADD COLUMN IF NOT EXISTS wrapup_notes TEXT;

COMMENT ON COLUMN public.practice_sessions.wrapup_notes IS 'Session wrapup notes entered when ending a practice';

-- ============================================================================
-- SECTION 2: Song Notes System Tables
-- ============================================================================

-- Personal notes (one per user per song per band)
CREATE TABLE IF NOT EXISTS public.song_personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  content TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER DEFAULT 1 NOT NULL,
  UNIQUE(song_id, user_id, band_id)
);

COMMENT ON TABLE song_personal_notes IS 'Personal notes for songs - one per user per song per band';

-- Practice log entries (Jira-style comments visible to band)
CREATE TABLE IF NOT EXISTS public.song_note_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  session_type TEXT,
  session_id UUID,
  content TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'band',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  version INTEGER DEFAULT 1 NOT NULL,
  CONSTRAINT note_entry_session_check
    CHECK (session_type IS NULL OR session_type IN ('practice', 'show')),
  CONSTRAINT note_entry_visibility_check
    CHECK (visibility IN ('personal', 'band'))
);

COMMENT ON TABLE song_note_entries IS 'Practice log entries for songs - Jira-style comments with optional session context';

-- ============================================================================
-- SECTION 3: Indexes for New Tables
-- ============================================================================

-- Song personal notes indexes
CREATE INDEX IF NOT EXISTS idx_song_personal_notes_song ON song_personal_notes(song_id);
CREATE INDEX IF NOT EXISTS idx_song_personal_notes_user ON song_personal_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_song_personal_notes_band ON song_personal_notes(band_id);
CREATE INDEX IF NOT EXISTS idx_song_personal_notes_version ON song_personal_notes(version);

-- Song note entries indexes
CREATE INDEX IF NOT EXISTS idx_song_note_entries_song ON song_note_entries(song_id);
CREATE INDEX IF NOT EXISTS idx_song_note_entries_user ON song_note_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_song_note_entries_band ON song_note_entries(band_id);
CREATE INDEX IF NOT EXISTS idx_song_note_entries_session ON song_note_entries(session_type, session_id);
CREATE INDEX IF NOT EXISTS idx_song_note_entries_created ON song_note_entries(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_song_note_entries_version ON song_note_entries(version);

-- ============================================================================
-- SECTION 4: Enable RLS on New Tables
-- ============================================================================

ALTER TABLE public.song_personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_note_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: RLS Policies for song_personal_notes
-- Users can only access their own personal notes
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'personal_notes_select_own') THEN
    CREATE POLICY "personal_notes_select_own"
      ON public.song_personal_notes FOR SELECT TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'personal_notes_insert_own') THEN
    CREATE POLICY "personal_notes_insert_own"
      ON public.song_personal_notes FOR INSERT TO authenticated
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'personal_notes_update_own') THEN
    CREATE POLICY "personal_notes_update_own"
      ON public.song_personal_notes FOR UPDATE TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'personal_notes_delete_own') THEN
    CREATE POLICY "personal_notes_delete_own"
      ON public.song_personal_notes FOR DELETE TO authenticated
      USING (user_id = (select auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- SECTION 6: RLS Policies for song_note_entries
-- Band members can view band-visible entries
-- Users can manage their own entries
-- Admins can delete any entry in their band
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'note_entries_select') THEN
    CREATE POLICY "note_entries_select"
      ON public.song_note_entries FOR SELECT TO authenticated
      USING (
        -- Can see personal entries (own only)
        (visibility = 'personal' AND user_id = (select auth.uid()))
        OR
        -- Can see band entries if member of that band
        (visibility = 'band' AND is_band_member(band_id, (select auth.uid())))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'note_entries_insert_own') THEN
    CREATE POLICY "note_entries_insert_own"
      ON public.song_note_entries FOR INSERT TO authenticated
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'note_entries_update_own') THEN
    CREATE POLICY "note_entries_update_own"
      ON public.song_note_entries FOR UPDATE TO authenticated
      USING (user_id = (select auth.uid()))
      WITH CHECK (user_id = (select auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'note_entries_delete_own_or_admin') THEN
    CREATE POLICY "note_entries_delete_own_or_admin"
      ON public.song_note_entries FOR DELETE TO authenticated
      USING (
        user_id = (select auth.uid())
        OR is_band_admin(band_id, (select auth.uid()))
      );
  END IF;
END $$;

-- ============================================================================
-- SECTION 7: Realtime Configuration
-- ============================================================================

-- Add song_note_entries to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'song_note_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE song_note_entries;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL for realtime UPDATE/DELETE events
ALTER TABLE song_note_entries REPLICA IDENTITY FULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
