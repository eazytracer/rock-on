-- Migration: Add setlist forking support
-- Purpose: Enable setlists to be copied/forked when creating shows
-- Created: 2025-10-26

-- Add source_setlist_id to track the original setlist a copy was made from
ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS source_setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL;

-- Add foreign key constraint for show_id -> practice_sessions
-- This creates the bidirectional relationship between shows and setlists
ALTER TABLE public.setlists
  DROP CONSTRAINT IF EXISTS setlists_show_id_fkey;

ALTER TABLE public.setlists
  ADD CONSTRAINT setlists_show_id_fkey
  FOREIGN KEY (show_id)
  REFERENCES public.practice_sessions(id)
  ON DELETE SET NULL;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_setlists_show_id
  ON public.setlists(show_id)
  WHERE show_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_setlists_source_setlist_id
  ON public.setlists(source_setlist_id)
  WHERE source_setlist_id IS NOT NULL;

-- Add column comments
COMMENT ON COLUMN public.setlists.show_id IS
  'Reference to practice_sessions(id) where type=gig. Creates bidirectional relationship between shows and setlists. Application enforces that referenced session has type=gig.';

COMMENT ON COLUMN public.setlists.source_setlist_id IS
  'Reference to the original setlist this was forked/copied from. Used when creating a show-specific copy of a setlist. Allows tracking setlist lineage and seeing what the original template was.';
