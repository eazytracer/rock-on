-- =====================================================
-- CREATE SHOWS TABLE
-- =====================================================
-- Separate shows table to match frontend architecture
-- Shows were previously stored in practice_sessions with type='gig'
-- This creates a dedicated shows table and migrates existing data
-- =====================================================

-- Create shows table
CREATE TABLE IF NOT EXISTS public.shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  load_in_time TEXT,
  soundcheck_time TEXT,
  set_time TEXT,
  end_time TEXT,
  duration INTEGER,
  payment INTEGER CHECK (payment IS NULL OR payment >= 0),
  contacts JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shows_band_id ON public.shows(band_id);
CREATE INDEX IF NOT EXISTS idx_shows_setlist_id ON public.shows(setlist_id) WHERE setlist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shows_scheduled_date ON public.shows(band_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_shows_status ON public.shows(status);

-- Migrate existing shows from practice_sessions
-- Note: practice_sessions doesn't have created_by, so we use a default user
INSERT INTO public.shows (
  id, name, venue, band_id, setlist_id, scheduled_date,
  load_in_time, soundcheck_time, payment, contacts, notes,
  created_date, updated_date, created_by, status
)
SELECT
  ps.id, ps.name, ps.location as venue, ps.band_id, ps.setlist_id, ps.scheduled_date,
  NULL as load_in_time, NULL as soundcheck_time, NULL as payment,
  '[]'::jsonb as contacts, ps.notes,
  ps.created_date, ps.created_date as updated_date,
  -- Use the first active band member as creator (fallback to first member if no active)
  COALESCE(
    (SELECT user_id FROM band_memberships
     WHERE band_id = ps.band_id AND status = 'active'
     ORDER BY joined_date LIMIT 1),
    (SELECT user_id FROM band_memberships
     WHERE band_id = ps.band_id
     ORDER BY joined_date LIMIT 1)
  ) as created_by,
  CASE
    WHEN ps.scheduled_date < NOW() THEN 'completed'
    ELSE 'scheduled'
  END as status
FROM public.practice_sessions ps
WHERE ps.type = 'gig'
  -- Only migrate if we can find a band member to assign as creator
  AND EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_id = ps.band_id
  )
ON CONFLICT (id) DO NOTHING;

-- Clean up: Remove gig records from practice_sessions (now in shows table)
DELETE FROM public.practice_sessions WHERE type = 'gig';

-- Note: If you manually altered status values before running this migration,
-- ensure all status values match the CHECK constraint: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

-- Add RLS policies (match band_memberships pattern)
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

-- Users can view shows for bands they're in
CREATE POLICY "shows_select_if_member"
  ON public.shows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = shows.band_id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.status = 'active'
    )
  );

-- Users can create shows for bands they're in
CREATE POLICY "shows_insert_if_member"
  ON public.shows FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = shows.band_id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.status = 'active'
    )
  );

-- Users can update shows for bands they're in
CREATE POLICY "shows_update_if_member"
  ON public.shows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_memberships.band_id = shows.band_id
        AND band_memberships.user_id = auth.uid()
        AND band_memberships.status = 'active'
    )
  );

-- Users can delete shows they created
CREATE POLICY "shows_delete_if_creator"
  ON public.shows FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Add trigger for updated_date
CREATE OR REPLACE FUNCTION update_show_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER show_updated_date_trigger
  BEFORE UPDATE ON public.shows
  FOR EACH ROW
  EXECUTE FUNCTION update_show_updated_date();

-- Add comments
COMMENT ON TABLE public.shows IS 'Live performance shows/gigs for bands';
COMMENT ON COLUMN public.shows.name IS 'Show name (e.g., "Toys 4 Tots Benefit")';
COMMENT ON COLUMN public.shows.venue IS 'Venue name (e.g., "The Whiskey Room")';
COMMENT ON COLUMN public.shows.load_in_time IS 'Load-in time (e.g., "6:00 PM")';
COMMENT ON COLUMN public.shows.soundcheck_time IS 'Soundcheck time (e.g., "7:00 PM")';
COMMENT ON COLUMN public.shows.set_time IS 'Performance start time (e.g., "9:00 PM")';
COMMENT ON COLUMN public.shows.payment IS 'Payment amount in cents (e.g., 50000 = $500.00)';
COMMENT ON COLUMN public.shows.contacts IS 'Array of contact objects: [{"id":"uuid","name":"John","role":"Manager","phone":"555-1234","email":"john@venue.com"}]';

-- Verify migration
SELECT 'Shows migrated:' as message, COUNT(*) as count FROM public.shows;
