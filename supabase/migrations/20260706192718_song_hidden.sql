-- ============================================================================
-- Song hidden (#3 Catalog provenance / Source filter — Hide / Re-add)
-- ============================================================================
-- A per-user "hide this song from my catalog view" join table. Hiding is a
-- PERSONAL, NON-DESTRUCTIVE preference: it does not delete the song, does not
-- touch the band catalog, and is invisible to everyone else. "Re-add" simply
-- deletes the row. Provenance ("from <band>") and the Source filter are derived
-- in-app from songs.context_id / songs.linked_from_song_id — no schema needed
-- for those; only the hide state is persisted here (D4: a JOIN table, not a
-- boolean on songs).
--
-- Ownership is dead simple: a row is owned by user_id, and RLS restricts every
-- verb to the caller's own rows (user_id = auth.uid()). There is deliberately
-- NO update policy — the row carries no mutable state (its existence IS the
-- flag), so UPDATE stays RLS-denied. Idempotent.
-- ============================================================================

-- ── song_hidden table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.song_hidden (
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  song_id      UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One hide row per (user, song); re-hiding is a no-op upsert target.
  PRIMARY KEY (user_id, song_id)
);

-- Filtering starts from "songs this user has hidden", so index by user_id.
-- (song_id is already covered as the trailing PK column for the reverse lookup
-- "who hid this song", which the ON DELETE CASCADE from songs also relies on.)
CREATE INDEX IF NOT EXISTS idx_song_hidden_user ON public.song_hidden (user_id);

-- New table → explicit grants required (the baseline's snapshot grant only
-- covered tables that existed when it ran; later tables inherit nothing).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_hidden TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_hidden TO service_role;

-- ── RLS: own rows only, every verb ──────────────────────────────────────────
ALTER TABLE public.song_hidden ENABLE ROW LEVEL SECURITY;

-- SELECT: a user sees only their own hide rows.
DROP POLICY IF EXISTS "song_hidden_select_own" ON public.song_hidden;
CREATE POLICY "song_hidden_select_own" ON public.song_hidden FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- INSERT: a user may only hide as themselves (cannot forge someone else's row).
DROP POLICY IF EXISTS "song_hidden_insert_own" ON public.song_hidden;
CREATE POLICY "song_hidden_insert_own" ON public.song_hidden FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- DELETE (re-add): a user may only un-hide their own rows.
DROP POLICY IF EXISTS "song_hidden_delete_own" ON public.song_hidden;
CREATE POLICY "song_hidden_delete_own" ON public.song_hidden FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- No UPDATE policy on purpose: the row has no mutable columns, so UPDATE is
-- (correctly) denied by RLS for authenticated callers.
