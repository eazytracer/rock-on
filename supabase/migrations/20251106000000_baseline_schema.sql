-- ============================================================================
-- Rock On - Consolidated Baseline Schema Migration
-- Created: 2025-11-06
-- Updated: 2025-11-07 (consolidated 5 patch migrations)
-- Description: Single comprehensive migration for fresh installations
-- ============================================================================
-- This migration consolidates 17 previous incremental migrations into a
-- single baseline. For fresh installations, this is the only migration needed.
--
-- Previous migrations (now archived):
-- - 20251025000000_initial_schema.sql
-- - 20251026160000_rebuild_rls_policies.sql
-- - 20251026170000_add_setlist_items.sql
-- - 20251026170100_fix_setlist_trigger.sql
-- - 20251026190000_add_gig_type.sql
-- - 20251026190100_add_show_fields.sql
-- - 20251026190200_add_setlist_forking.sql
-- - 20251026213000_enable_rls.sql
-- - 20251026221000_fix_rls_recursion.sql
-- - 20251026221100_fix_rls_recursion_v2.sql
-- - 20251026221500_fix_song_delete_policy.sql
-- - 20251028000000_create_shows_table.sql
-- - 20251029000001_add_version_tracking.sql
-- - 20251030000001_enable_realtime.sql
-- - 20251030000002_enable_realtime_replica_identity.sql
-- - 20251031000001_add_audit_tracking.sql
-- - 20251101000001_enable_audit_log_realtime.sql
--
-- Consolidated patch migrations (2025-11-07):
-- - 20251107000001_fix_schema_bugs.sql
-- - 20251107000002_enforce_band_only_mvp.sql
-- - 20251107000003_auto_add_band_creator.sql
-- - 20251107000004_fix_rls_recursion.sql
-- - 20251107000005_fix_all_recursion.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: Core Tables - Users, Bands, Memberships
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

-- Bands
CREATE TABLE public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT bands_name_check CHECK (char_length(name) >= 1)
);

-- Band memberships
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
  expires_at TIMESTAMPTZ,  -- Nullable - allows permanent invite codes
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT invite_code_check CHECK (char_length(code) >= 6),
  CONSTRAINT invite_uses_check CHECK (current_uses <= max_uses)
);

-- ============================================================================
-- SECTION 2: Content Tables - Songs, Setlists, Shows, Practice Sessions
-- ============================================================================

-- Songs (with version tracking and audit fields)
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
  -- MVP: All songs are band songs (enforced by DEFAULT and RLS policies)
  context_type TEXT NOT NULL DEFAULT 'band',
  context_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  visibility TEXT DEFAULT 'band',

  -- Song variant linking
  song_group_id UUID,

  -- Version tracking & audit (Phase 3)
  version INTEGER DEFAULT 1 NOT NULL,
  last_modified_by UUID REFERENCES auth.users(id),

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

-- Setlists (with JSONB items column and version tracking)
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

  -- Setlist items (songs, breaks, sections)
  items JSONB DEFAULT '[]'::jsonb,

  -- Forking support
  forked_from UUID REFERENCES public.setlists(id),
  fork_count INTEGER DEFAULT 0,

  -- Version tracking & audit (Phase 3)
  version INTEGER DEFAULT 1 NOT NULL,
  last_modified_by UUID REFERENCES auth.users(id),

  CONSTRAINT setlist_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

-- Shows (live performance gigs)
CREATE TABLE public.shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,

  -- Timing details
  load_in_time TEXT,
  soundcheck_time TEXT,
  set_time TEXT,
  end_time TEXT,
  duration INTEGER,

  -- Business details
  payment INTEGER CHECK (payment IS NULL OR payment >= 0),
  contacts JSONB DEFAULT '[]'::jsonb,
  notes TEXT,

  -- Show type (from add_gig_type migration)
  gig_type TEXT,

  -- Status and timestamps
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Version tracking & audit (Phase 3)
  version INTEGER DEFAULT 1 NOT NULL,
  last_modified_by UUID REFERENCES auth.users(id)
);

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

  -- Version tracking & audit (Phase 3)
  -- NOTE: Practice sessions track version and last_modified_by but NOT created_by
  version INTEGER DEFAULT 1 NOT NULL,
  last_modified_by UUID REFERENCES auth.users(id),

  CONSTRAINT session_type_check CHECK (type IN ('rehearsal', 'writing', 'recording', 'audition', 'lesson')),
  CONSTRAINT session_rating_check CHECK (session_rating IS NULL OR (session_rating BETWEEN 1 AND 5))
);

COMMENT ON TABLE practice_sessions IS 'Practice sessions - tracks version and last_modified_by (does NOT track created_by)';

-- ============================================================================
-- SECTION 3: Casting System (Optional for MVP)
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
-- SECTION 4: Audit System (Phase 4a)
-- ============================================================================

-- Audit log table (complete change history)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was changed
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Who changed it
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,

  -- When it was changed
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- What changed
  old_values JSONB,
  new_values JSONB,

  -- Band context (for RLS and filtering)
  -- NOTE: Nullable to support personal songs and non-band records
  band_id UUID REFERENCES bands(id),

  -- Optional metadata
  client_info JSONB
);

COMMENT ON TABLE audit_log IS 'Complete change history for all records - never delete from this table';
COMMENT ON COLUMN audit_log.user_name IS 'Denormalized user name for fast queries without JOINs';
COMMENT ON COLUMN audit_log.old_values IS 'Complete previous record state (JSONB) - NULL for INSERTs';
COMMENT ON COLUMN audit_log.new_values IS 'Complete new record state (JSONB) - NULL for DELETEs';
COMMENT ON COLUMN audit_log.band_id IS 'Band context (for RLS and filtering) - NULL for personal songs and other non-band records';

-- ============================================================================
-- SECTION 5: Indexes for Performance
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

-- Version tracking indexes (Phase 3)
CREATE INDEX idx_songs_version ON songs(version);
CREATE INDEX idx_songs_version_modified ON songs(version, updated_date);

-- Setlist indexes
CREATE INDEX idx_setlists_band_id ON public.setlists(band_id);
CREATE INDEX idx_setlists_show_id ON public.setlists(show_id);
CREATE INDEX idx_setlists_version ON setlists(version);
CREATE INDEX idx_setlists_version_modified ON setlists(version, last_modified);

-- Show indexes
CREATE INDEX idx_shows_band_id ON public.shows(band_id);
CREATE INDEX idx_shows_setlist_id ON public.shows(setlist_id) WHERE setlist_id IS NOT NULL;
CREATE INDEX idx_shows_scheduled_date ON public.shows(band_id, scheduled_date);
CREATE INDEX idx_shows_status ON public.shows(status);
CREATE INDEX idx_shows_version ON shows(version);
CREATE INDEX idx_shows_version_modified ON shows(version, updated_date);

-- Practice session indexes
CREATE INDEX idx_practice_sessions_band_id ON public.practice_sessions(band_id);
CREATE INDEX idx_practice_sessions_setlist_id ON public.practice_sessions(setlist_id);
CREATE INDEX idx_practice_sessions_scheduled_date ON public.practice_sessions(scheduled_date);
CREATE INDEX idx_practice_sessions_version ON practice_sessions(version);
CREATE INDEX idx_practice_sessions_version_created ON practice_sessions(version, created_date);

-- Casting indexes
CREATE INDEX idx_song_castings_context ON public.song_castings(context_type, context_id);
CREATE INDEX idx_song_castings_song_id ON public.song_castings(song_id);
CREATE INDEX idx_song_assignments_casting_id ON public.song_assignments(song_casting_id);
CREATE INDEX idx_song_assignments_member_id ON public.song_assignments(member_id);
CREATE INDEX idx_member_capabilities_user_band ON public.member_capabilities(user_id, band_id);

-- Audit log indexes (Phase 4a)
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id, changed_at DESC);
CREATE INDEX idx_audit_log_band_date ON audit_log(band_id, changed_at DESC);
CREATE INDEX idx_audit_log_user_date ON audit_log(user_id, changed_at DESC);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);

-- ============================================================================
-- SECTION 6: Functions & Triggers
-- ============================================================================

-- Function to update updated_date timestamp
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$;

-- Function to increment version on UPDATE (Phase 3)
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-increment version on every UPDATE
  NEW.version = COALESCE(OLD.version, 0) + 1;

  -- Update timestamp based on table structure
  IF TG_TABLE_NAME = 'songs' OR TG_TABLE_NAME = 'shows' THEN
    NEW.updated_date = NOW();
  ELSIF TG_TABLE_NAME = 'setlists' THEN
    NEW.last_modified = NOW();
  END IF;

  -- Set last_modified_by if not explicitly provided
  IF NEW.last_modified_by IS NULL THEN
    NEW.last_modified_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION increment_version() IS 'Auto-increments version number and updates timestamp on UPDATE operations';

-- Function to set last_modified_by on UPDATE (Phase 4a)
CREATE OR REPLACE FUNCTION set_last_modified_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_modified_by = auth.uid();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_last_modified_by() IS 'Auto-set last_modified_by column on UPDATE';

-- Function to set created_by on INSERT (Phase 4a)
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_created_by() IS 'Auto-set created_by column on INSERT if not provided';

-- Function to log all changes to audit_log (Phase 4a)
-- Updated to handle NULL band_id for personal songs
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_band_id UUID;
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
  v_context_type TEXT;
BEGIN
  -- Determine action and values
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_user_id := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  ELSE  -- INSERT
    v_action := 'INSERT';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  END IF;

  -- Get user_name from public.users first (MVP seed data has names there)
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name FROM public.users WHERE id = v_user_id;

    -- Fallback to auth.users metadata if needed
    IF v_user_name IS NULL THEN
      SELECT raw_user_meta_data->>'name' INTO v_user_name
      FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  -- Always set default if still NULL
  IF v_user_name IS NULL THEN
    v_user_name := 'System';
  END IF;

  -- Get band_id based on table
  IF TG_TABLE_NAME = 'songs' THEN
    -- For songs, get context_type to determine how to handle context_id
    IF TG_OP = 'DELETE' THEN
      v_context_type := OLD.context_type;
      -- MVP: All songs should be band songs
      IF v_context_type = 'band' THEN
        v_band_id := OLD.context_id::uuid;
      ELSE
        -- Personal songs: no band_id
        v_band_id := NULL;
      END IF;
    ELSE
      v_context_type := NEW.context_type;
      -- MVP: All songs should be band songs
      IF v_context_type = 'band' THEN
        v_band_id := NEW.context_id::uuid;
      ELSE
        -- Personal songs: no band_id
        v_band_id := NULL;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('setlists', 'shows', 'practice_sessions') THEN
    -- Other tables have band_id directly
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.band_id;
    ELSE
      v_band_id := NEW.band_id;
    END IF;
  ELSE
    v_band_id := NULL;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_name,
    band_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    v_user_id,
    v_user_name,
    v_band_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION log_audit_trail() IS 'Log all INSERT/UPDATE/DELETE operations to audit_log table - handles NULL band_id for personal songs';

-- Function to auto-add band creator as admin (from patch 003)
CREATE OR REPLACE FUNCTION auto_add_band_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();

  -- Only proceed if there's an authenticated user
  IF v_user_id IS NOT NULL THEN
    -- Add the creator as band admin (highest available role per schema constraint)
    -- NOTE: Schema constraint only allows 'admin', 'member', 'viewer' (no 'owner')
    INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
    VALUES (v_user_id, NEW.id, 'admin', 'active', now())
    ON CONFLICT (user_id, band_id) DO NOTHING; -- Prevent duplicates
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_add_band_creator() IS 'Automatically add band creator as admin when band is created';

-- Apply updated_date triggers
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

-- Apply version increment triggers (Phase 3)
CREATE TRIGGER songs_version_trigger BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER setlists_version_trigger BEFORE UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER shows_version_trigger BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER practice_sessions_version_trigger BEFORE UPDATE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION increment_version();

-- Apply audit tracking triggers (Phase 4a)
-- Created_by triggers (BEFORE INSERT)
-- NOTE: practice_sessions does NOT have a created_by column, so no trigger for it
CREATE TRIGGER songs_set_created_by BEFORE INSERT ON songs
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

CREATE TRIGGER setlists_set_created_by BEFORE INSERT ON setlists
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

CREATE TRIGGER shows_set_created_by BEFORE INSERT ON shows
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Last_modified_by triggers (BEFORE UPDATE)
CREATE TRIGGER songs_set_last_modified_by BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER setlists_set_last_modified_by BEFORE UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER shows_set_last_modified_by BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION set_last_modified_by();

CREATE TRIGGER practice_sessions_set_last_modified_by BEFORE UPDATE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION set_last_modified_by();

-- Audit log triggers (AFTER INSERT/UPDATE/DELETE)
CREATE TRIGGER songs_audit_log AFTER INSERT OR UPDATE OR DELETE ON songs
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER setlists_audit_log AFTER INSERT OR UPDATE OR DELETE ON setlists
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER shows_audit_log AFTER INSERT OR UPDATE OR DELETE ON shows
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER practice_sessions_audit_log AFTER INSERT OR UPDATE OR DELETE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Set created_by on band creation
CREATE TRIGGER bands_set_created_by
  BEFORE INSERT ON public.bands
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- Auto-add band creator trigger (from patch 003)
CREATE TRIGGER bands_auto_add_creator
  AFTER INSERT ON public.bands
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_band_creator();

-- ============================================================================
-- SECTION 7: RLS Helper Functions (from patch 004 & 005)
-- ============================================================================

-- Helper function: Check if user is band admin (bypasses RLS to prevent recursion)
-- Uses direct table access without RLS by being owned by postgres with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_band_admin(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Direct table query - SECURITY DEFINER means this runs as function owner (postgres)
  -- who has BYPASSRLS privilege, preventing infinite recursion
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
  );
$$;

-- Ensure function is owned by postgres (superuser with BYPASSRLS)
ALTER FUNCTION is_band_admin(UUID, UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION is_band_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_band_admin IS 'Check if user is band admin - uses SECURITY DEFINER owned by postgres to bypass RLS and prevent recursion';

-- Helper function: Check if user is band member (bypasses RLS to prevent recursion)
-- Uses direct table access without RLS by being owned by postgres with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_band_member(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Direct table query - SECURITY DEFINER means this runs as function owner (postgres)
  -- who has BYPASSRLS privilege, preventing infinite recursion
  SELECT EXISTS (
    SELECT 1 FROM public.band_memberships
    WHERE band_id = p_band_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

-- Ensure function is owned by postgres (superuser with BYPASSRLS)
ALTER FUNCTION is_band_member(UUID, UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION is_band_member(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_band_member IS 'Check if user is band member - uses SECURITY DEFINER owned by postgres to bypass RLS and prevent recursion';

-- ============================================================================
-- SECTION 8: Row-Level Security (RLS) Policies
-- ============================================================================

-- Grant table-level permissions to authenticated role
-- (RLS policies can only restrict, not grant access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

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
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (needed for pgTAP test isolation)
ALTER TABLE public.songs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.setlists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shows FORCE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions FORCE ROW LEVEL SECURITY;

-- Users policies (optimized with subquery)
CREATE POLICY "users_select_authenticated"
  ON public.users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- User profiles policies (optimized with subquery)
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Bands policies (optimized with subquery for helper functions)
CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "bands_select_members"
  ON public.bands FOR SELECT TO authenticated
  USING (is_band_member(bands.id, (select auth.uid())));

CREATE POLICY "bands_update_admins"
  ON public.bands FOR UPDATE TO authenticated
  USING (is_band_admin(bands.id, (select auth.uid())));

-- Band memberships policies (non-recursive, optimized with subquery)
-- CRITICAL: These policies MUST NOT call is_band_member/is_band_admin to avoid infinite recursion
-- band_memberships is the auth source - it can only use direct auth.uid() checks

-- SELECT: Users can only see their own memberships (most secure, non-recursive)
CREATE POLICY "memberships_select_own"
  ON public.band_memberships FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) AND
    status = 'active'
  );

-- INSERT: Self-join (user adding themselves)
CREATE POLICY "memberships_insert_self"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- INSERT: Band creator can add others (non-recursive - checks bands table, not band_memberships)
CREATE POLICY "memberships_insert_by_creator"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id != (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = (select auth.uid())
    )
  );

-- UPDATE: Only band creator can update memberships
CREATE POLICY "memberships_update_by_creator"
  ON public.band_memberships FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = (select auth.uid())
    )
  );

-- DELETE: Self-delete OR band creator can delete
CREATE POLICY "memberships_delete_self_or_creator"
  ON public.band_memberships FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = (select auth.uid())
    )
  );

-- Invite codes policies
-- SELECT: Allow all authenticated users to read invite codes (needed to join bands)
CREATE POLICY "invite_codes_select_authenticated"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "invite_codes_insert_if_admin"
  ON public.invite_codes FOR INSERT TO authenticated
  WITH CHECK (is_band_admin(invite_codes.band_id, (select auth.uid())));

CREATE POLICY "invite_codes_update_if_admin"
  ON public.invite_codes FOR UPDATE TO authenticated
  USING (is_band_admin(invite_codes.band_id, (select auth.uid())));

-- Songs policies (MVP: band-only, optimized with subquery)
CREATE POLICY "songs_select_band_members_only"
  ON public.songs FOR SELECT TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_insert_band_members_only"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) AND
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_update_band_members_only"
  ON public.songs FOR UPDATE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  )
  WITH CHECK (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_delete_band_admins_only"
  ON public.songs FOR DELETE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_admin(songs.context_id::uuid, (select auth.uid()))
  );

-- Setlists policies (optimized with subquery)
CREATE POLICY "setlists_select_if_member"
  ON public.setlists FOR SELECT TO authenticated
  USING (is_band_member(setlists.band_id, (select auth.uid())));

CREATE POLICY "setlists_insert_if_member"
  ON public.setlists FOR INSERT TO authenticated
  WITH CHECK (is_band_member(setlists.band_id, (select auth.uid())));

CREATE POLICY "setlists_update_if_member"
  ON public.setlists FOR UPDATE TO authenticated
  USING (is_band_member(setlists.band_id, (select auth.uid())));

CREATE POLICY "setlists_delete_if_creator_or_admin"
  ON public.setlists FOR DELETE TO authenticated
  USING (
    created_by = (select auth.uid()) OR
    is_band_admin(setlists.band_id, (select auth.uid()))
  );

-- Shows policies (optimized with subquery)
CREATE POLICY "shows_select_if_member"
  ON public.shows FOR SELECT TO authenticated
  USING (is_band_member(shows.band_id, (select auth.uid())));

CREATE POLICY "shows_insert_if_member"
  ON public.shows FOR INSERT TO authenticated
  WITH CHECK (is_band_member(shows.band_id, (select auth.uid())));

CREATE POLICY "shows_update_if_member"
  ON public.shows FOR UPDATE TO authenticated
  USING (is_band_member(shows.band_id, (select auth.uid())));

CREATE POLICY "shows_delete_if_creator"
  ON public.shows FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- Practice sessions policies (optimized with subquery)
CREATE POLICY "sessions_select_if_member"
  ON public.practice_sessions FOR SELECT TO authenticated
  USING (is_band_member(practice_sessions.band_id, (select auth.uid())));

CREATE POLICY "sessions_insert_if_member"
  ON public.practice_sessions FOR INSERT TO authenticated
  WITH CHECK (is_band_member(practice_sessions.band_id, (select auth.uid())));

CREATE POLICY "sessions_update_if_member"
  ON public.practice_sessions FOR UPDATE TO authenticated
  USING (is_band_member(practice_sessions.band_id, (select auth.uid())));

CREATE POLICY "sessions_delete_if_member"
  ON public.practice_sessions FOR DELETE TO authenticated
  USING (is_band_member(practice_sessions.band_id, (select auth.uid())));

-- Audit log policies (optimized with subquery)
CREATE POLICY "audit_log_select_if_member"
  ON audit_log FOR SELECT TO authenticated
  USING (is_band_member(audit_log.band_id, (select auth.uid())));

CREATE POLICY "audit_log_no_insert"
  ON audit_log FOR INSERT
  WITH CHECK (false);

CREATE POLICY "audit_log_no_update"
  ON audit_log FOR UPDATE
  USING (false);

CREATE POLICY "audit_log_no_delete"
  ON audit_log FOR DELETE
  USING (false);

-- ============================================================================
-- SECTION 9: Realtime Configuration (Phase 4)
-- ============================================================================

-- Enable realtime publication for sync tables
ALTER PUBLICATION supabase_realtime ADD TABLE songs;
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
ALTER PUBLICATION supabase_realtime ADD TABLE shows;
ALTER PUBLICATION supabase_realtime ADD TABLE practice_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Set REPLICA IDENTITY FULL (required for realtime UPDATE/DELETE events)
ALTER TABLE songs REPLICA IDENTITY FULL;
ALTER TABLE setlists REPLICA IDENTITY FULL;
ALTER TABLE shows REPLICA IDENTITY FULL;
ALTER TABLE practice_sessions REPLICA IDENTITY FULL;
ALTER TABLE audit_log REPLICA IDENTITY FULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries
SELECT 'Schema setup complete!' as status;
SELECT COUNT(*) as table_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
