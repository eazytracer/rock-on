-- Add items column to setlists table to store ordered songs/breaks/sections
-- This is stored as JSONB in Supabase to match the IndexedDB structure

ALTER TABLE public.setlists
ADD COLUMN items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add index for better query performance
CREATE INDEX idx_setlists_items ON public.setlists USING gin (items);

-- Add comment
COMMENT ON COLUMN public.setlists.items IS 'Ordered array of setlist items (songs, breaks, sections) stored as JSONB';
