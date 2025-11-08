-- Migration: Add show-specific fields to practice_sessions
-- Purpose: Store show details (name, venue, payment, contacts, etc.)
-- Created: 2025-10-26
-- Note: These fields are only used when type='gig'

-- Add show-specific columns
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS load_in_time TEXT,
  ADD COLUMN IF NOT EXISTS soundcheck_time TEXT,
  ADD COLUMN IF NOT EXISTS payment INTEGER,
  ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- Add constraint for payment (must be positive if set)
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT payment_positive_check
    CHECK (payment IS NULL OR payment >= 0);

-- Add indexes for show queries (partial indexes for performance)
CREATE INDEX IF NOT EXISTS idx_practice_sessions_name
  ON public.practice_sessions(name)
  WHERE name IS NOT NULL AND type = 'gig';

CREATE INDEX IF NOT EXISTS idx_practice_sessions_venue
  ON public.practice_sessions(venue)
  WHERE venue IS NOT NULL AND type = 'gig';

-- Add indexes for upcoming shows query
CREATE INDEX IF NOT EXISTS idx_practice_sessions_gig_scheduled
  ON public.practice_sessions(band_id, scheduled_date)
  WHERE type = 'gig';

-- Add column comments
COMMENT ON COLUMN public.practice_sessions.name IS
  'Show/event name (e.g., "Toys 4 Tots Benefit"). Only used when type=gig.';

COMMENT ON COLUMN public.practice_sessions.venue IS
  'Venue name (e.g., "The Whiskey Room"). Only used when type=gig.';

COMMENT ON COLUMN public.practice_sessions.load_in_time IS
  'Load-in time string (e.g., "6:00 PM"). Only used when type=gig.';

COMMENT ON COLUMN public.practice_sessions.soundcheck_time IS
  'Soundcheck time string (e.g., "7:00 PM"). Only used when type=gig.';

COMMENT ON COLUMN public.practice_sessions.payment IS
  'Payment amount in cents (e.g., 50000 = $500.00). Only used when type=gig.';

COMMENT ON COLUMN public.practice_sessions.contacts IS
  'Array of contact objects with name, role, phone, email fields. Only used when type=gig. Format: [{"id":"uuid","name":"John Doe","role":"Venue Manager","phone":"555-1234","email":"john@venue.com"}]';
