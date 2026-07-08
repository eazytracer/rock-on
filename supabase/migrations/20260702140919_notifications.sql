-- ============================================================================
-- Notifications feature (mobile-redesign-port)
-- In-app notification feed + versioned release notes.
-- Supabase-only + Realtime (NOT in the local-first band sync engine).
-- Idempotent. Explicit GRANTs to authenticated AND service_role. RLS enabled.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('release','activity','event','friend')),
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at      TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.release_notes (
  version      TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_release_version TEXT;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_date DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id, created_date DESC);

-- ── Grants (explicit; both roles) ───────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_notes TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- notifications: a user sees / mutates only their own rows. INSERT is service_role
-- only (minted server-side) — there is deliberately no authenticated INSERT policy.
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- release_notes: global content, readable by any authenticated user. Writes are
-- service_role only (no authenticated write policy).
DROP POLICY IF EXISTS "release_notes_select_all" ON public.release_notes;
CREATE POLICY "release_notes_select_all"
  ON public.release_notes FOR SELECT TO authenticated
  USING (true);

-- ── Realtime (bell live-updates) ────────────────────────────────────────────
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
