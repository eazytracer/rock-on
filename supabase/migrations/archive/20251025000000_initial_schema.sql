-- Rock On Database Schema
-- Migration: Initial schema
-- Created: 2025-10-25

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS AND AUTHENTICATION
-- ============================================================================

-- Users table (synced with auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  auth_provider TEXT DEFAULT 'email',
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User profiles (extended information)
CREATE TABLE public.user_profiles (
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

-- ============================================================================
-- BANDS AND MEMBERSHIPS
-- ============================================================================

-- Bands
CREATE TABLE public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT bands_name_check CHECK (char_length(name) >= 1)
);

-- Band memberships (replaces member_ids array)
CREATE TABLE public.band_memberships (
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

-- Invite codes
CREATE TABLE public.invite_codes (
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

-- ============================================================================
-- SONGS
-- ============================================================================

-- Songs (supports both band and personal contexts)
CREATE TABLE public.songs (
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

  -- Context fields (band or personal)
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  visibility TEXT DEFAULT 'band',

  -- Song variant linking
  song_group_id UUID,

  CONSTRAINT song_difficulty_check CHECK (difficulty BETWEEN 1 AND 5),
  CONSTRAINT song_confidence_check CHECK (confidence_level BETWEEN 1 AND 5),
  CONSTRAINT song_context_check CHECK (context_type IN ('band', 'personal')),
  CONSTRAINT song_visibility_check CHECK (visibility IN ('band', 'personal', 'public'))
);

-- Song groups (for linking song variants)
CREATE TABLE public.song_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT song_group_name_check CHECK (char_length(name) >= 1)
);

-- Song group memberships
CREATE TABLE public.song_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  song_group_id UUID NOT NULL REFERENCES public.song_groups(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.users(id),
  added_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(song_id, song_group_id)
);

-- ============================================================================
-- SETLISTS
-- ============================================================================

-- Setlists
CREATE TABLE public.setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  show_id UUID,
  status TEXT DEFAULT 'draft',
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  notes TEXT,
  CONSTRAINT setlist_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

-- ============================================================================
-- PRACTICE SESSIONS
-- ============================================================================

-- Practice sessions
CREATE TABLE public.practice_sessions (
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
  CONSTRAINT session_type_check CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')),
  CONSTRAINT session_rating_check CHECK (session_rating IS NULL OR (session_rating BETWEEN 1 AND 5))
);

-- ============================================================================
-- CASTING SYSTEM
-- ============================================================================

-- Song castings (context-specific: band, setlist, or session)
CREATE TABLE public.song_castings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  CONSTRAINT casting_context_check CHECK (context_type IN ('band', 'setlist', 'session'))
);

-- Song assignments (who plays what)
CREATE TABLE public.song_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_casting_id UUID NOT NULL REFERENCES public.song_castings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  confidence INTEGER DEFAULT 3,
  added_by UUID NOT NULL REFERENCES public.users(id),
  added_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  CONSTRAINT assignment_confidence_check CHECK (confidence BETWEEN 1 AND 5)
);

-- Assignment roles (specific instruments/parts)
CREATE TABLE public.assignment_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.song_assignments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  CONSTRAINT role_type_check CHECK (type IN ('instrument', 'vocal', 'technical'))
);

-- Casting templates
CREATE TABLE public.casting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context_type TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT template_context_check CHECK (context_type IN ('band', 'setlist', 'session'))
);

-- Member capabilities
CREATE TABLE public.member_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 1,
  is_primary BOOLEAN DEFAULT false,
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, band_id, role_type),
  CONSTRAINT capability_proficiency_check CHECK (proficiency_level BETWEEN 1 AND 5)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Band indexes
CREATE INDEX idx_band_memberships_user_id ON public.band_memberships(user_id);
CREATE INDEX idx_band_memberships_band_id ON public.band_memberships(band_id);
CREATE INDEX idx_band_memberships_status ON public.band_memberships(status);

-- Song indexes
CREATE INDEX idx_songs_context ON public.songs(context_type, context_id);
CREATE INDEX idx_songs_created_by ON public.songs(created_by);
CREATE INDEX idx_songs_song_group_id ON public.songs(song_group_id);
CREATE INDEX idx_song_group_memberships_song_id ON public.song_group_memberships(song_id);
CREATE INDEX idx_song_group_memberships_group_id ON public.song_group_memberships(song_group_id);

-- Setlist indexes
CREATE INDEX idx_setlists_band_id ON public.setlists(band_id);
CREATE INDEX idx_setlists_show_id ON public.setlists(show_id);

-- Practice session indexes
CREATE INDEX idx_practice_sessions_band_id ON public.practice_sessions(band_id);
CREATE INDEX idx_practice_sessions_setlist_id ON public.practice_sessions(setlist_id);
CREATE INDEX idx_practice_sessions_scheduled_date ON public.practice_sessions(scheduled_date);

-- Casting indexes
CREATE INDEX idx_song_castings_context ON public.song_castings(context_type, context_id);
CREATE INDEX idx_song_castings_song_id ON public.song_castings(song_id);
CREATE INDEX idx_song_assignments_casting_id ON public.song_assignments(song_casting_id);
CREATE INDEX idx_song_assignments_member_id ON public.song_assignments(member_id);
CREATE INDEX idx_member_capabilities_user_band ON public.member_capabilities(user_id, band_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Function to update updated_date timestamp
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_date
CREATE TRIGGER update_bands_updated_date BEFORE UPDATE ON public.bands
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_user_profiles_updated_date BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_songs_updated_date BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_setlists_last_modified BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_song_castings_updated_date BEFORE UPDATE ON public.song_castings
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_song_assignments_updated_date BEFORE UPDATE ON public.song_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_casting_templates_updated_date BEFORE UPDATE ON public.casting_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
