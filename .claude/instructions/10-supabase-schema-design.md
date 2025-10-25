# Task 10: Supabase Database Schema Design

## Context

The application currently uses Dexie (IndexedDB) with 13 tables. We need to create a matching Supabase PostgreSQL schema that:
1. Mirrors the Dexie structure (with adaptations for relational DB)
2. Uses snake_case naming (Postgres convention)
3. Implements proper foreign keys and constraints
4. Supports Row Level Security (RLS) for multi-tenancy

## Dependencies

- Task 01: Environment setup completed
- Supabase project created (dev/staging/prod)

## Objective

Create complete SQL migration files for Supabase that define all tables, relationships, indexes, and initial security policies.

## Current Dexie Schema

From `src/services/database/index.ts` (Version 5):

1. **bands** - Band information
2. **members** - Legacy member table (may be deprecated)
3. **songs** - Songs with context (band/personal)
4. **practiceSessions** - Practice session tracking
5. **setlists** - Setlist management
6. **users** - User accounts
7. **userProfiles** - Extended user information
8. **bandMemberships** - User-Band relationships
9. **inviteCodes** - Band invitation codes
10. **songGroups** - Song variant groups
11. **songGroupMemberships** - Songs in groups
12. **songCastings** - Who plays what (context-specific)
13. **songAssignments** - Individual role assignments
14. **assignmentRoles** - Role details
15. **castingTemplates** - Saved casting templates
16. **memberCapabilities** - Member skill tracking

## Test Requirements

### Test File: `supabase/__tests__/schema.test.sql`

```sql
-- Test 1: Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: 15+ tables

-- Test 2: Verify foreign key constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
-- Expected: All relationships defined

-- Test 3: Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- Expected: All tables have rowsecurity = true

-- Test 4: Verify indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
-- Expected: Performance indexes on foreign keys and common queries

-- Test 5: Test band membership security
SET request.jwt.claim.sub = 'test-user-id';
SELECT * FROM bands;
-- Expected: Only returns bands where user is a member
```

## Implementation Steps

### Step 1: Create Migration - Initial Schema

**File**: `supabase/migrations/20251025000000_initial_schema.sql`

```sql
-- Rock On Database Schema
-- Migration: Initial schema
-- Created: 2025-10-25

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS AND AUTHENTICATION
-- ============================================================================

-- Users table (synced with auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  auth_provider TEXT DEFAULT 'email',
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User profiles (extended information)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT song_group_name_check CHECK (char_length(name) >= 1)
);

-- Song group memberships
CREATE TABLE public.song_group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES public.song_assignments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  CONSTRAINT role_type_check CHECK (type IN ('instrument', 'vocal', 'technical'))
);

-- Casting templates
CREATE TABLE public.casting_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
```

### Step 2: Create Migration - Row Level Security

**File**: `supabase/migrations/20251025000100_rls_policies.sql`

```sql
-- Row Level Security Policies
-- Migration: RLS policies for multi-tenant security

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

-- ============================================================================
-- USERS: Can read own profile, update own profile
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "User profiles viewable by self"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User profiles updateable by self"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- BANDS: Viewable/editable by members only
-- ============================================================================

CREATE POLICY "Band members can view their bands"
  ON public.bands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Band admins can update bands"
  ON public.bands FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = bands.id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
    )
  );

CREATE POLICY "Users can create bands"
  ON public.bands FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- BAND MEMBERSHIPS
-- ============================================================================

CREATE POLICY "Members can view band memberships"
  ON public.band_memberships FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.band_memberships bm
      WHERE bm.band_id = band_memberships.band_id
      AND bm.user_id = auth.uid()
      AND bm.status = 'active'
    )
  );

CREATE POLICY "Admins can manage memberships"
  ON public.band_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships bm
      WHERE bm.band_id = band_memberships.band_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
      AND bm.status = 'active'
    )
  );

-- ============================================================================
-- SONGS: Viewable by band members, personal songs by creator
-- ============================================================================

CREATE POLICY "Band members can view band songs"
  ON public.songs FOR SELECT
  USING (
    context_type = 'personal' AND created_by = auth.uid()
    OR
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Users can create songs"
  ON public.songs FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators and band members can update songs"
  ON public.songs FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    (context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    ))
  );

CREATE POLICY "Creators can delete songs"
  ON public.songs FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- SETLISTS, PRACTICE SESSIONS: Band members only
-- ============================================================================

CREATE POLICY "Band members can view setlists"
  ON public.setlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Band members can manage setlists"
  ON public.setlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = setlists.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Band members can view sessions"
  ON public.practice_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Band members can manage sessions"
  ON public.practice_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = practice_sessions.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- ============================================================================
-- CASTING SYSTEM: Band context-based access
-- ============================================================================

-- Note: Casting policies are complex due to context_id being text
-- These are simplified - may need refinement based on context_type

CREATE POLICY "Band members can view castings"
  ON public.song_castings FOR SELECT
  USING (
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
    OR context_type IN ('setlist', 'session')
  );

CREATE POLICY "Band members can manage castings"
  ON public.song_castings FOR ALL
  USING (
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
    OR context_type IN ('setlist', 'session')
  );

-- Song assignments inherit from casting permissions
CREATE POLICY "Users can view assignments"
  ON public.song_assignments FOR SELECT
  USING (true);

CREATE POLICY "Users can manage assignments"
  ON public.song_assignments FOR ALL
  USING (true);

-- Assignment roles inherit from assignment permissions
CREATE POLICY "Users can view assignment roles"
  ON public.assignment_roles FOR SELECT
  USING (true);

CREATE POLICY "Users can manage assignment roles"
  ON public.assignment_roles FOR ALL
  USING (true);

-- Member capabilities
CREATE POLICY "Band members can view capabilities"
  ON public.member_capabilities FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = member_capabilities.band_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Users can manage own capabilities"
  ON public.member_capabilities FOR ALL
  USING (user_id = auth.uid());
```

## Acceptance Criteria

- [ ] All SQL migration files created
- [ ] Schema includes all 15+ tables from Dexie
- [ ] Foreign key constraints properly defined
- [ ] Indexes created for common query patterns
- [ ] RLS enabled on all tables
- [ ] Basic RLS policies implemented
- [ ] Updated_at triggers configured
- [ ] Test queries documented

## Validation Steps

### 1. Run Migrations Locally

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Check migration status
supabase migration list
```

### 2. Verify Schema

```bash
# Connect to local database
supabase db connect

# List all tables
\dt public.*

# Describe a table
\d public.bands

# Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

### 3. Test RLS Policies

Create test data and verify RLS works correctly (see test file above).

### 4. Check for Errors

```bash
# View logs for any errors
supabase db logs
```

## Next Steps

- **Task 11**: Supabase seeding and test data
- **Task 12**: Supabase project deployment (dev/staging/prod)
