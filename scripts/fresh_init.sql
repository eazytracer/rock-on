-- ============================================================================
-- Rock On - Fresh Database Initialization Script
-- ============================================================================
-- Purpose: Complete database schema for fresh installations
-- Created: 2025-10-27
--
-- This script replaces chained migrations for clean initialization.
-- Use this for:
--   - Fresh local development setups
--   - Integration test environments
--   - Clean database resets
--
-- DO NOT use this on production databases with existing data!
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users and Authentication
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  auth_provider TEXT DEFAULT 'email',
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT,
  primary_instrument TEXT,
  instruments TEXT[] DEFAULT '{}',
  bio TEXT,
  avatar_url TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ----------------------------------------------------------------------------
-- Bands and Memberships
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT bands_name_check CHECK (char_length(name) >= 1)
);

CREATE TABLE IF NOT EXISTS public.band_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  permissions TEXT[] DEFAULT '{"member"}',
  joined_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(user_id, band_id),
  CONSTRAINT membership_role_check CHECK (role IN ('admin', 'member', 'viewer')),
  CONSTRAINT membership_status_check CHECK (status IN ('active', 'inactive', 'pending'))
);

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT invite_code_check CHECK (char_length(code) >= 6),
  CONSTRAINT invite_uses_check CHECK (current_uses <= max_uses)
);

-- ----------------------------------------------------------------------------
-- Songs
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  key TEXT,
  tempo INTEGER,
  time_signature TEXT,
  duration INTEGER,
  difficulty INTEGER DEFAULT 1,
  genre TEXT,
  notes TEXT,
  lyrics_url TEXT,
  chords_url TEXT,
  recording_url TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  last_practiced TIMESTAMPTZ,
  confidence_level INTEGER DEFAULT 1,
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  visibility TEXT NOT NULL DEFAULT 'band',
  song_group_id UUID,
  CONSTRAINT songs_difficulty_check CHECK (difficulty BETWEEN 1 AND 5),
  CONSTRAINT songs_confidence_check CHECK (confidence_level BETWEEN 1 AND 5),
  CONSTRAINT songs_context_type_check CHECK (context_type IN ('band', 'personal')),
  CONSTRAINT songs_visibility_check CHECK (visibility IN ('personal', 'band', 'public'))
);

-- ----------------------------------------------------------------------------
-- Song Groups (for variants)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.song_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT song_groups_context_type_check CHECK (context_type IN ('band', 'personal'))
);

CREATE TABLE IF NOT EXISTS public.song_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_group_id UUID NOT NULL REFERENCES public.song_groups(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  added_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(song_group_id, song_id)
);

-- ----------------------------------------------------------------------------
-- Setlists
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  show_id UUID,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  items JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT setlist_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

-- ----------------------------------------------------------------------------
-- Practice Sessions (includes Shows when type='gig')
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration INTEGER,
  location TEXT,
  type TEXT NOT NULL,
  notes TEXT,
  objectives TEXT[] DEFAULT '{}',
  completed_objectives TEXT[] DEFAULT '{}',
  session_rating INTEGER,
  songs JSONB DEFAULT '[]'::jsonb,
  attendees JSONB DEFAULT '[]'::jsonb,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Show-specific fields (only used when type='gig')
  name TEXT,
  venue TEXT,
  load_in_time TEXT,
  soundcheck_time TEXT,
  payment INTEGER,
  contacts JSONB DEFAULT '[]'::jsonb,

  CONSTRAINT session_type_check CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson', 'gig')),
  CONSTRAINT session_rating_check CHECK (session_rating IS NULL OR (session_rating BETWEEN 1 AND 5)),
  CONSTRAINT payment_positive_check CHECK (payment IS NULL OR payment >= 0)
);

-- Add foreign key from setlists to practice_sessions (for shows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setlists_show_id_fkey'
  ) THEN
    ALTER TABLE public.setlists
      ADD CONSTRAINT setlists_show_id_fkey
      FOREIGN KEY (show_id)
      REFERENCES public.practice_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Casting System
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.song_castings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  notes TEXT,
  CONSTRAINT casting_context_type_check CHECK (context_type IN ('band', 'setlist', 'session'))
);

CREATE TABLE IF NOT EXISTS public.song_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_id UUID NOT NULL REFERENCES public.song_castings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casting_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.assignment_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.song_assignments(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  instrument TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.casting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  template_data JSONB NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id)
);

-- ----------------------------------------------------------------------------
-- Member Capabilities
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  proficiency INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, band_id, instrument),
  CONSTRAINT capability_proficiency_check CHECK (proficiency BETWEEN 1 AND 5)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- User Profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Band Memberships
CREATE INDEX IF NOT EXISTS idx_band_memberships_user_id ON public.band_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_band_memberships_band_id ON public.band_memberships(band_id);
CREATE INDEX IF NOT EXISTS idx_band_memberships_status ON public.band_memberships(status);

-- Songs
CREATE INDEX IF NOT EXISTS idx_songs_context ON public.songs(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_by ON public.songs(created_by);
CREATE INDEX IF NOT EXISTS idx_songs_song_group_id ON public.songs(song_group_id) WHERE song_group_id IS NOT NULL;

-- Song Groups
CREATE INDEX IF NOT EXISTS idx_song_groups_context ON public.song_groups(context_type, context_id);

-- Setlists
CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON public.setlists(band_id);
CREATE INDEX IF NOT EXISTS idx_setlists_show_id ON public.setlists(show_id) WHERE show_id IS NOT NULL;

-- Practice Sessions (includes Shows)
CREATE INDEX IF NOT EXISTS idx_practice_sessions_band_id ON public.practice_sessions(band_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_setlist_id ON public.practice_sessions(setlist_id) WHERE setlist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_practice_sessions_scheduled_date ON public.practice_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_type ON public.practice_sessions(type);

-- Show-specific indexes (partial indexes for performance)
CREATE INDEX IF NOT EXISTS idx_practice_sessions_name ON public.practice_sessions(name) WHERE name IS NOT NULL AND type = 'gig';
CREATE INDEX IF NOT EXISTS idx_practice_sessions_venue ON public.practice_sessions(venue) WHERE venue IS NOT NULL AND type = 'gig';
CREATE INDEX IF NOT EXISTS idx_practice_sessions_gig_scheduled ON public.practice_sessions(band_id, scheduled_date) WHERE type = 'gig';

-- Song Castings
CREATE INDEX IF NOT EXISTS idx_song_castings_context ON public.song_castings(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_song_castings_song_id ON public.song_castings(song_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update last_modified timestamp on setlists
CREATE OR REPLACE FUNCTION update_setlist_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER setlist_last_modified_trigger
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW
  EXECUTE FUNCTION update_setlist_last_modified();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_capabilities ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Users Policies
-- ----------------------------------------------------------------------------

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY users_insert_own ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ----------------------------------------------------------------------------
-- User Profiles Policies
-- ----------------------------------------------------------------------------

CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Bands Policies
-- ----------------------------------------------------------------------------

CREATE POLICY bands_select_if_member ON public.bands
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY bands_insert_authenticated ON public.bands
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY bands_update_if_admin ON public.bands
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

CREATE POLICY bands_delete_if_admin ON public.bands
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- Band Memberships Policies (Non-recursive to avoid infinite recursion)
-- ----------------------------------------------------------------------------

-- Allow users to see only their own memberships
-- Other memberships are visible through application logic, not RLS
CREATE POLICY band_memberships_select_own ON public.band_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow authenticated users to insert memberships
-- (Application layer should enforce admin checks)
CREATE POLICY band_memberships_insert_authenticated ON public.band_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own memberships
CREATE POLICY band_memberships_update_own ON public.band_memberships
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own memberships (leave band)
CREATE POLICY band_memberships_delete_own ON public.band_memberships
  FOR DELETE
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Songs Policies
-- ----------------------------------------------------------------------------

CREATE POLICY songs_select_if_visible ON public.songs
  FOR SELECT
  USING (
    -- Personal songs: only creator can see
    (context_type = 'personal' AND context_id = auth.uid()::text)
    OR
    -- Band songs: any band member can see
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = songs.context_id
        AND user_id = auth.uid()
        AND status = 'active'
    ))
    OR
    -- Public songs: anyone can see
    visibility = 'public'
  );

CREATE POLICY songs_insert_if_member ON public.songs
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      -- Personal songs
      (context_type = 'personal' AND context_id = auth.uid()::text)
      OR
      -- Band songs: must be a member
      (context_type = 'band' AND EXISTS (
        SELECT 1 FROM public.band_memberships
        WHERE band_id::text = context_id
          AND user_id = auth.uid()
          AND status = 'active'
      ))
    )
  );

CREATE POLICY songs_update_if_creator_or_member ON public.songs
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (
      context_type = 'band' AND EXISTS (
        SELECT 1 FROM public.band_memberships
        WHERE band_id::text = songs.context_id
          AND user_id = auth.uid()
          AND status = 'active'
      )
    )
  );

CREATE POLICY songs_delete_if_creator ON public.songs
  FOR DELETE
  USING (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Setlists Policies
-- ----------------------------------------------------------------------------

CREATE POLICY setlists_select_if_member ON public.setlists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY setlists_insert_if_member ON public.setlists
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY setlists_update_if_member ON public.setlists
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY setlists_delete_if_creator ON public.setlists
  FOR DELETE
  USING (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Practice Sessions (includes Shows) Policies
-- ----------------------------------------------------------------------------

CREATE POLICY practice_sessions_select_if_member ON public.practice_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY practice_sessions_insert_if_member ON public.practice_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY practice_sessions_update_if_member ON public.practice_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY practice_sessions_delete_if_member ON public.practice_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- Song Groups Policies
-- ----------------------------------------------------------------------------

CREATE POLICY song_groups_select_if_member ON public.song_groups
  FOR SELECT
  USING (
    (context_type = 'personal' AND context_id = auth.uid()::text)
    OR
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = song_groups.context_id
        AND user_id = auth.uid()
        AND status = 'active'
    ))
  );

CREATE POLICY song_groups_insert_if_member ON public.song_groups
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (context_type = 'personal' AND context_id = auth.uid()::text)
      OR
      (context_type = 'band' AND EXISTS (
        SELECT 1 FROM public.band_memberships
        WHERE band_id::text = context_id
          AND user_id = auth.uid()
          AND status = 'active'
      ))
    )
  );

CREATE POLICY song_groups_update_if_creator ON public.song_groups
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY song_groups_delete_if_creator ON public.song_groups
  FOR DELETE
  USING (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Song Group Memberships Policies
-- ----------------------------------------------------------------------------

CREATE POLICY song_group_memberships_select_if_can_see_group ON public.song_group_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.song_groups sg
      WHERE sg.id = song_group_memberships.song_group_id
        AND (
          (sg.context_type = 'personal' AND sg.context_id = auth.uid()::text)
          OR
          (sg.context_type = 'band' AND EXISTS (
            SELECT 1 FROM public.band_memberships
            WHERE band_id::text = sg.context_id
              AND user_id = auth.uid()
              AND status = 'active'
          ))
        )
    )
  );

CREATE POLICY song_group_memberships_insert_if_can_modify_group ON public.song_group_memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.song_groups
      WHERE id = song_group_memberships.song_group_id
        AND created_by = auth.uid()
    )
  );

CREATE POLICY song_group_memberships_delete_if_can_modify_group ON public.song_group_memberships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.song_groups
      WHERE id = song_group_memberships.song_group_id
        AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.practice_sessions IS
  'Practice sessions and shows (concerts). When type=gig, this represents a show/performance.';

COMMENT ON COLUMN public.practice_sessions.type IS
  'Session type: rehearsal (practice), writing (songwriting), recording (studio), audition, lesson, or gig (show/performance)';

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

COMMENT ON COLUMN public.setlists.show_id IS
  'Reference to practice_sessions(id) where type=gig. Links setlist to a specific show.';

-- ============================================================================
-- END OF FRESH INITIALIZATION SCRIPT
-- ============================================================================
