-- Migration: Add 'gig' type to practice_sessions
-- Purpose: Enable shows (practice_sessions with type='gig') to sync to Supabase
-- Created: 2025-10-26

-- Drop existing constraint that doesn't include 'gig'
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS session_type_check;

-- Add new constraint with 'gig' type included
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT session_type_check CHECK (
    type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')
  );

-- Add comment documenting the types
COMMENT ON COLUMN public.practice_sessions.type IS
  'Session type: rehearsal (practice), writing (songwriting), recording (studio), audition, lesson, or gig (show/performance)';
