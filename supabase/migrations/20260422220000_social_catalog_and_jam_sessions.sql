-- ============================================================================
-- Migration: Social Catalog & Jam Sessions
-- Date: 2026-04-22
-- Description:
--   Consolidates the personal catalog + jam session feature set (shipped to
--   the baseline during pre-1.0 development) into a single incremental
--   migration. Applies cleanly on top of the prior baseline version
--   `20251106000000` to bring an existing production database up to parity
--   with the current baseline file.
--
--   After this migration, the pre-1.0 "modify baseline in-place" policy is
--   retired. Going forward, each release/feature gets its own consolidated
--   incremental migration (one per release, not one per commit) — see
--   CLAUDE.md for the updated policy.
--
--   SAFETY: all changes are additive and idempotent.
--     - ADD COLUMN IF NOT EXISTS
--     - CREATE TABLE IF NOT EXISTS
--     - CREATE INDEX IF NOT EXISTS
--     - DROP POLICY IF EXISTS before CREATE POLICY
--     - Constraint adds wrapped in exception handlers
--     - Publication ADD TABLE wrapped in exception handlers
--
--   Running this migration more than once is safe.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Users — account tier columns
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_tier TEXT NOT NULL DEFAULT 'free';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_account_tier_check
    CHECK (account_tier IN ('free', 'pro'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 2: Text normalization function (required for songs generated columns)
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(input), '^(the|a|an)\s+', '', 'i'),
      '[^a-z0-9 ]', '', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

COMMENT ON FUNCTION normalize_text IS 'Normalize song titles/artists for jam session matching: strips leading articles, punctuation, lowercases, collapses whitespace';

-- ============================================================================
-- SECTION 3: Songs — normalized computed columns (for jam matching)
-- ============================================================================

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS normalized_title TEXT
  GENERATED ALWAYS AS (normalize_text(title)) STORED;

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS normalized_artist TEXT
  GENERATED ALWAYS AS (normalize_text(COALESCE(artist, ''))) STORED;

-- ============================================================================
-- SECTION 4: Setlists — context columns, jam linkage, tags
-- ============================================================================

-- Make band_id nullable (personal setlists don't have a band_id)
ALTER TABLE public.setlists
  ALTER COLUMN band_id DROP NOT NULL;

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS context_type TEXT NOT NULL DEFAULT 'band';

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS context_id TEXT;

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS jam_session_id UUID;

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE public.setlists
    ADD CONSTRAINT setlist_context_type_check
    CHECK (context_type IN ('band', 'personal'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setlists
    ADD CONSTRAINT setlist_context_check
    CHECK (
      (context_type = 'band' AND band_id IS NOT NULL) OR
      (context_type = 'personal' AND context_id IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 5: Jam session tables
-- ============================================================================

-- Jam sessions: ephemeral collaborative sessions for finding common songs
CREATE TABLE IF NOT EXISTS public.jam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code TEXT UNIQUE NOT NULL,
  name TEXT,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'saved')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  saved_setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  seed_setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  view_token TEXT UNIQUE,
  view_token_expires_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1 NOT NULL,
  last_modified_by UUID REFERENCES public.users(id)
);

COMMENT ON TABLE jam_sessions IS 'Ephemeral jam sessions for finding common songs across personal catalogs';
COMMENT ON COLUMN jam_sessions.view_token IS 'SHA-256 hashed token for anonymous read-only access via Edge Function';
COMMENT ON COLUMN jam_sessions.short_code IS '6-character alphanumeric code for joining a session';

-- Jam participants: users who have joined a session
CREATE TABLE IF NOT EXISTS public.jam_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'left', 'kicked')),
  shared_contexts JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(jam_session_id, user_id)
);

COMMENT ON TABLE jam_participants IS 'Users who have joined a jam session and the catalog contexts they are sharing';

-- Jam song matches: pre-computed common songs across all participants
CREATE TABLE IF NOT EXISTS public.jam_song_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id UUID NOT NULL REFERENCES public.jam_sessions(id) ON DELETE CASCADE,
  canonical_title TEXT NOT NULL,
  canonical_artist TEXT NOT NULL,
  display_title TEXT NOT NULL,
  display_artist TEXT NOT NULL,
  match_confidence TEXT NOT NULL DEFAULT 'exact'
    CHECK (match_confidence IN ('exact', 'fuzzy', 'manual')),
  is_confirmed BOOLEAN NOT NULL DEFAULT true,
  matched_songs JSONB NOT NULL DEFAULT '[]'::jsonb,
  participant_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jam_song_matches IS 'Pre-computed song matches for a jam session. Never stores full song catalog data.';

-- ============================================================================
-- SECTION 6: Setlists → Jam sessions FK (added after jam_sessions exists)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.setlists
    ADD CONSTRAINT setlists_jam_session_id_fkey
    FOREIGN KEY (jam_session_id) REFERENCES public.jam_sessions(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 7: New indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_songs_normalized
  ON public.songs(normalized_title, normalized_artist);

CREATE INDEX IF NOT EXISTS idx_jam_sessions_host
  ON public.jam_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_short_code
  ON public.jam_sessions(short_code);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_status
  ON public.jam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_jam_sessions_view_token
  ON public.jam_sessions(view_token) WHERE view_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jam_participants_session
  ON public.jam_participants(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_jam_participants_user
  ON public.jam_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_jam_song_matches_session
  ON public.jam_song_matches(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_jam_song_matches_canonical
  ON public.jam_song_matches(canonical_title, canonical_artist);

-- ============================================================================
-- SECTION 8: Jam helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_jam_participant(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jam_participants
    WHERE jam_session_id = p_session_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

ALTER FUNCTION is_jam_participant(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_jam_participant(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION is_jam_participant IS 'Check if user is an active jam session participant - SECURITY DEFINER to prevent RLS recursion';

CREATE OR REPLACE FUNCTION are_jam_coparticipants(p_caller UUID, p_song_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jam_participants jp_caller
    JOIN public.jam_participants jp_owner
      ON jp_caller.jam_session_id = jp_owner.jam_session_id
    JOIN public.jam_sessions js
      ON js.id = jp_caller.jam_session_id
    WHERE jp_caller.user_id = p_caller
      AND jp_owner.user_id  = p_song_owner
      AND jp_caller.status  = 'active'
      AND jp_owner.status   = 'active'
      AND js.status         = 'active'
  );
$$;

ALTER FUNCTION are_jam_coparticipants(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION are_jam_coparticipants(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION are_jam_coparticipants IS 'Returns true when both users are active participants in the same active jam session. Used by RLS to allow cross-participant personal song reads.';

-- ============================================================================
-- SECTION 9: Enable RLS on new tables
-- ============================================================================

ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_song_matches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 10: Replace existing RLS policies (users, songs, setlists)
-- Old policies are dropped and replaced with scoped variants that support
-- personal catalogs + jam co-participant access.
-- ============================================================================

-- ---- Users ----
-- Drop the old permissive "any authenticated can read all users" policy
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;

-- Drop any previous copies of the replacements (idempotency on re-run)
DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_select_band_member" ON public.users;
DROP POLICY IF EXISTS "users_select_jam_coparticipant" ON public.users;

CREATE POLICY "users_select_self"
  ON public.users FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "users_select_band_member"
  ON public.users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.band_memberships bm_self
      JOIN public.band_memberships bm_other
        ON bm_self.band_id = bm_other.band_id
      WHERE bm_self.user_id = (select auth.uid())
        AND bm_other.user_id = users.id
        AND bm_self.status = 'active'
        AND bm_other.status = 'active'
    )
  );

CREATE POLICY "users_select_jam_coparticipant"
  ON public.users FOR SELECT TO authenticated
  USING (are_jam_coparticipants((select auth.uid()), users.id));

-- ---- User profiles (additive; keep existing policies) ----
DROP POLICY IF EXISTS "user_profiles_select_jam_coparticipant" ON public.user_profiles;

CREATE POLICY "user_profiles_select_jam_coparticipant"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (are_jam_coparticipants((select auth.uid()), user_id));

-- ---- Songs ----
-- Drop prior band-only policies (both old and new names for re-run safety)
DROP POLICY IF EXISTS "songs_select_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_update_band_members_only" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_band_admins_only" ON public.songs;

DROP POLICY IF EXISTS "songs_select_personal_own" ON public.songs;
DROP POLICY IF EXISTS "songs_select_jam_coparticipant" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_personal_own" ON public.songs;
DROP POLICY IF EXISTS "songs_update_personal_own" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_personal_own" ON public.songs;
DROP POLICY IF EXISTS "songs_select_band_members" ON public.songs;
DROP POLICY IF EXISTS "songs_insert_band_members" ON public.songs;
DROP POLICY IF EXISTS "songs_update_band_members" ON public.songs;
DROP POLICY IF EXISTS "songs_delete_band_admins" ON public.songs;

-- Personal songs
CREATE POLICY "songs_select_personal_own"
  ON public.songs FOR SELECT TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "songs_select_jam_coparticipant"
  ON public.songs FOR SELECT TO authenticated
  USING (
    context_type = 'personal' AND
    are_jam_coparticipants((select auth.uid()), songs.context_id::uuid)
  );

CREATE POLICY "songs_insert_personal_own"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) AND
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "songs_update_personal_own"
  ON public.songs FOR UPDATE TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  )
  WITH CHECK (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "songs_delete_personal_own"
  ON public.songs FOR DELETE TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

-- Band songs
CREATE POLICY "songs_select_band_members"
  ON public.songs FOR SELECT TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_insert_band_members"
  ON public.songs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) AND
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_update_band_members"
  ON public.songs FOR UPDATE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  )
  WITH CHECK (
    context_type = 'band' AND
    is_band_member(songs.context_id::uuid, (select auth.uid()))
  );

CREATE POLICY "songs_delete_band_admins"
  ON public.songs FOR DELETE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_admin(songs.context_id::uuid, (select auth.uid()))
  );

-- ---- Setlists ----
DROP POLICY IF EXISTS "setlists_select_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_insert_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_update_if_member" ON public.setlists;
DROP POLICY IF EXISTS "setlists_delete_if_creator_or_admin" ON public.setlists;

DROP POLICY IF EXISTS "setlists_select_personal_own" ON public.setlists;
DROP POLICY IF EXISTS "setlists_insert_personal_own" ON public.setlists;
DROP POLICY IF EXISTS "setlists_update_personal_own" ON public.setlists;
DROP POLICY IF EXISTS "setlists_delete_personal_own" ON public.setlists;
DROP POLICY IF EXISTS "setlists_select_band_members" ON public.setlists;
DROP POLICY IF EXISTS "setlists_insert_band_members" ON public.setlists;
DROP POLICY IF EXISTS "setlists_update_band_members" ON public.setlists;
DROP POLICY IF EXISTS "setlists_delete_band_creator_or_admin" ON public.setlists;

CREATE POLICY "setlists_select_personal_own"
  ON public.setlists FOR SELECT TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "setlists_insert_personal_own"
  ON public.setlists FOR INSERT TO authenticated
  WITH CHECK (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "setlists_update_personal_own"
  ON public.setlists FOR UPDATE TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  )
  WITH CHECK (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "setlists_delete_personal_own"
  ON public.setlists FOR DELETE TO authenticated
  USING (
    context_type = 'personal' AND
    context_id = (select auth.uid())::text
  );

CREATE POLICY "setlists_select_band_members"
  ON public.setlists FOR SELECT TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(setlists.band_id, (select auth.uid()))
  );

CREATE POLICY "setlists_insert_band_members"
  ON public.setlists FOR INSERT TO authenticated
  WITH CHECK (
    context_type = 'band' AND
    is_band_member(setlists.band_id, (select auth.uid()))
  );

CREATE POLICY "setlists_update_band_members"
  ON public.setlists FOR UPDATE TO authenticated
  USING (
    context_type = 'band' AND
    is_band_member(setlists.band_id, (select auth.uid()))
  );

CREATE POLICY "setlists_delete_band_creator_or_admin"
  ON public.setlists FOR DELETE TO authenticated
  USING (
    context_type = 'band' AND (
      created_by = (select auth.uid()) OR
      is_band_admin(setlists.band_id, (select auth.uid()))
    )
  );

-- ---- Jam session policies ----
DROP POLICY IF EXISTS "jam_sessions_select" ON public.jam_sessions;
DROP POLICY IF EXISTS "jam_sessions_select_by_code" ON public.jam_sessions;
DROP POLICY IF EXISTS "jam_sessions_insert" ON public.jam_sessions;
DROP POLICY IF EXISTS "jam_sessions_update" ON public.jam_sessions;
DROP POLICY IF EXISTS "jam_sessions_delete" ON public.jam_sessions;

CREATE POLICY "jam_sessions_select"
  ON public.jam_sessions FOR SELECT TO authenticated
  USING (
    host_user_id = (select auth.uid()) OR
    is_jam_participant(id, (select auth.uid()))
  );

CREATE POLICY "jam_sessions_select_by_code"
  ON public.jam_sessions FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY "jam_sessions_insert"
  ON public.jam_sessions FOR INSERT TO authenticated
  WITH CHECK (host_user_id = (select auth.uid()));

CREATE POLICY "jam_sessions_update"
  ON public.jam_sessions FOR UPDATE TO authenticated
  USING (host_user_id = (select auth.uid()));

CREATE POLICY "jam_sessions_delete"
  ON public.jam_sessions FOR DELETE TO authenticated
  USING (host_user_id = (select auth.uid()));

-- ---- Jam participants ----
DROP POLICY IF EXISTS "jam_participants_select" ON public.jam_participants;
DROP POLICY IF EXISTS "jam_participants_insert_self" ON public.jam_participants;
DROP POLICY IF EXISTS "jam_participants_update_self" ON public.jam_participants;
DROP POLICY IF EXISTS "jam_participants_delete_self_or_host" ON public.jam_participants;

CREATE POLICY "jam_participants_select"
  ON public.jam_participants FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    is_jam_participant(jam_session_id, (select auth.uid()))
  );

CREATE POLICY "jam_participants_insert_self"
  ON public.jam_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "jam_participants_update_self"
  ON public.jam_participants FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "jam_participants_delete_self_or_host"
  ON public.jam_participants FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.jam_sessions
      WHERE id = jam_session_id
        AND host_user_id = (select auth.uid())
    )
  );

-- ---- Jam song matches ----
DROP POLICY IF EXISTS "jam_song_matches_select" ON public.jam_song_matches;
DROP POLICY IF EXISTS "jam_song_matches_update_host" ON public.jam_song_matches;
DROP POLICY IF EXISTS "jam_song_matches_insert_participant" ON public.jam_song_matches;
DROP POLICY IF EXISTS "jam_song_matches_delete_host" ON public.jam_song_matches;

CREATE POLICY "jam_song_matches_select"
  ON public.jam_song_matches FOR SELECT TO authenticated
  USING (is_jam_participant(jam_session_id, (select auth.uid())));

CREATE POLICY "jam_song_matches_update_host"
  ON public.jam_song_matches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jam_sessions
      WHERE id = jam_session_id
        AND host_user_id = (select auth.uid())
    )
  );

CREATE POLICY "jam_song_matches_insert_participant"
  ON public.jam_song_matches FOR INSERT TO authenticated
  WITH CHECK (is_jam_participant(jam_session_id, (select auth.uid())));

CREATE POLICY "jam_song_matches_delete_host"
  ON public.jam_song_matches FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jam_sessions
      WHERE id = jam_session_id
        AND host_user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- SECTION 11: Realtime configuration (add jam tables to publication)
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_participants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jam_song_matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.jam_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.jam_participants REPLICA IDENTITY FULL;
ALTER TABLE public.jam_song_matches REPLICA IDENTITY FULL;

-- ============================================================================
-- SECTION 12: replace_jam_matches RPC (atomic match replacement)
-- ============================================================================

/**
 * Atomically replaces all jam_song_matches rows for a session in a single
 * transaction. Called by the jam-recompute Edge Function.
 *
 * Security: SECURITY DEFINER runs as the function owner (postgres), bypassing
 * RLS. The Edge Function is responsible for verifying the caller is a session
 * participant before invoking this RPC.
 */
CREATE OR REPLACE FUNCTION public.replace_jam_matches(
  p_session_id UUID,
  p_matches    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM jam_song_matches WHERE jam_session_id = p_session_id;

  IF jsonb_array_length(p_matches) > 0 THEN
    INSERT INTO jam_song_matches (
      id,
      jam_session_id,
      canonical_title,
      canonical_artist,
      display_title,
      display_artist,
      match_confidence,
      is_confirmed,
      matched_songs,
      participant_count,
      computed_at
    )
    SELECT
      (elem->>'id')::UUID,
      p_session_id,
      elem->>'canonical_title',
      elem->>'canonical_artist',
      elem->>'display_title',
      elem->>'display_artist',
      elem->>'match_confidence',
      (elem->>'is_confirmed')::BOOLEAN,
      elem->'matched_songs',
      (elem->>'participant_count')::INTEGER,
      NOW()
    FROM jsonb_array_elements(p_matches) AS elem;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_jam_matches(UUID, JSONB) TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
