-- ============================================================================
-- Casting feature (mobile-redesign-port) — v1 "bones"
-- Per-song, per-role assignment of members to parts, as metadata on a setlist OR
-- an event lineup. Band-scoped for history. Supabase-only + Realtime.
--
-- Security is the headline (validated by an adversarial review):
--  * write policy binds band_id ↔ context_id ↔ song_id (+ event slot) via
--    SECURITY DEFINER helpers so a director cannot forge cross-band rows;
--  * member_id constrained to the band/event; created_by pinned;
--  * 4 separate policies (UPDATE has its own WITH CHECK; no FOR ALL).
-- Roles are DATA (band_roles reference table), not a CHECK enum (kills the
-- enum-drift bug class that broke the legacy casting system).
-- ============================================================================

-- ── band_roles: the per-band role vocabulary (defaults + custom) ─────────────
CREATE TABLE IF NOT EXISTS public.band_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id         UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,                    -- stable machine key (e.g. 'guitar')
  label           TEXT NOT NULL,                    -- display ('Guitar')
  sort            INTEGER NOT NULL DEFAULT 0,
  is_default_part BOOLEAN NOT NULL DEFAULT false,   -- part of the default required lineup (drives "N/M cast")
  created_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (band_id, key)
);
CREATE INDEX IF NOT EXISTS idx_band_roles_band ON public.band_roles (band_id);

-- Seed the canonical default lineup for a band (idempotent).
CREATE OR REPLACE FUNCTION public.seed_band_roles(p_band UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.band_roles (band_id, key, label, sort, is_default_part) VALUES
    (p_band, 'lead_vocals',    'Lead Vocals',    1, true),
    (p_band, 'backing_vocals', 'Backing Vocals', 2, false),
    (p_band, 'guitar',         'Guitar',         3, true),
    (p_band, 'bass',           'Bass',           4, true),
    (p_band, 'drums',          'Drums',          5, true),
    (p_band, 'keys',           'Keys',           6, true)
  ON CONFLICT (band_id, key) DO NOTHING;
$$;

-- Backfill existing bands + auto-seed new ones.
DO $$ DECLARE b RECORD; BEGIN
  FOR b IN SELECT id FROM public.bands LOOP PERFORM public.seed_band_roles(b.id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.on_band_insert_seed_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.seed_band_roles(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_band_seed_roles ON public.bands;
CREATE TRIGGER trg_band_seed_roles AFTER INSERT ON public.bands
  FOR EACH ROW EXECUTE FUNCTION public.on_band_insert_seed_roles();

-- ── casting_assignments: one row per (slot, role, member) ────────────────────
CREATE TABLE IF NOT EXISTS public.casting_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type         TEXT NOT NULL CHECK (context_type IN ('setlist','event')),
  context_id           UUID NOT NULL,                 -- setlists.id OR events.id
  setlist_item_id      TEXT,                           -- SetlistItem.id (JSONB soft ref)
  event_lineup_item_id UUID REFERENCES public.event_lineup_items(id) ON DELETE CASCADE, -- real FK
  band_id              UUID REFERENCES public.bands(id) ON DELETE CASCADE,  -- NULL for personal events
  song_id              UUID REFERENCES public.songs(id) ON DELETE SET NULL, -- history snapshot
  role_key             TEXT NOT NULL,                  -- band_roles.key (soft; band-less events use defaults)
  member_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  member_name          TEXT,                            -- snapshot for history durability
  is_primary           BOOLEAN NOT NULL DEFAULT true,   -- starter vs backup/sub
  priority             INTEGER,                          -- optional ranking among backups
  confidence           SMALLINT CHECK (confidence BETWEEN 1 AND 5),
  arrangement          TEXT,                             -- "Drop D", "Acoustic"
  notes                TEXT,
  created_by           UUID NOT NULL REFERENCES public.users(id),
  created_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version              INTEGER NOT NULL DEFAULT 1,
  -- setlist rows are always band-scoped (makes SELECT NULL-safety structural)
  CONSTRAINT casting_setlist_needs_band CHECK (context_type <> 'setlist' OR band_id IS NOT NULL),
  -- exactly one slot column, matching the context
  CONSTRAINT casting_slot_matches_context CHECK (
    (context_type = 'setlist' AND setlist_item_id IS NOT NULL AND event_lineup_item_id IS NULL)
    OR (context_type = 'event' AND event_lineup_item_id IS NOT NULL AND setlist_item_id IS NULL)
  )
);

-- Uniqueness across the polymorphic slot (coalesce both slot columns to one key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_casting_slot_role_member ON public.casting_assignments
  (context_type, context_id, COALESCE(setlist_item_id, event_lineup_item_id::text), role_key, member_id);
CREATE INDEX IF NOT EXISTS idx_casting_context ON public.casting_assignments (context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_casting_band_song ON public.casting_assignments (band_id, song_id)
  WHERE song_id IS NOT NULL;                             -- band-wide history query

-- ── Binding helpers (SECURITY DEFINER; owned by postgres via ALTER below) ─────
-- Bind band ↔ setlist-context ↔ song. (songs store their band in context_id::text!)
CREATE OR REPLACE FUNCTION public.casting_setlist_ctx_ok(p_ctx UUID, p_band UUID, p_song UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.setlists s
                 WHERE s.id = p_ctx AND s.context_type = 'band' AND s.band_id = p_band)
     AND (p_song IS NULL OR EXISTS (SELECT 1 FROM public.songs sg
                 WHERE sg.id = p_song AND sg.context_type = 'band' AND sg.context_id = p_band::text));
$$;

-- Bind band ↔ event-context ↔ slot ↔ song (event lineup item ties slot+event+song).
CREATE OR REPLACE FUNCTION public.casting_event_ctx_ok(p_ctx UUID, p_band UUID, p_slot UUID, p_song UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = p_ctx AND e.band_id IS NOT DISTINCT FROM p_band)
     AND EXISTS (SELECT 1 FROM public.event_lineup_items li
                 WHERE li.id = p_slot AND li.event_id = p_ctx
                   AND li.song_id IS NOT DISTINCT FROM p_song);
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_roles           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.casting_assignments  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_band_roles(UUID)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.casting_setlist_ctx_ok(UUID,UUID,UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.casting_event_ctx_ok(UUID,UUID,UUID,UUID)   TO authenticated;

-- Ensure SECURITY DEFINER helpers run as postgres (BYPASSRLS, no recursion) — matches baseline helpers.
ALTER FUNCTION public.seed_band_roles(UUID)                     OWNER TO postgres;
ALTER FUNCTION public.on_band_insert_seed_roles()              OWNER TO postgres;
ALTER FUNCTION public.casting_setlist_ctx_ok(UUID,UUID,UUID)   OWNER TO postgres;
ALTER FUNCTION public.casting_event_ctx_ok(UUID,UUID,UUID,UUID) OWNER TO postgres;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.band_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_assignments ENABLE ROW LEVEL SECURITY;

-- band_roles: band members read; band admins manage.
DROP POLICY IF EXISTS "band_roles_select_member" ON public.band_roles;
CREATE POLICY "band_roles_select_member" ON public.band_roles
  FOR SELECT TO authenticated USING (public.is_band_member(band_id, (select auth.uid())));
DROP POLICY IF EXISTS "band_roles_write_admin" ON public.band_roles;
CREATE POLICY "band_roles_write_admin" ON public.band_roles
  FOR ALL TO authenticated
  USING (public.is_band_admin(band_id, (select auth.uid())))
  WITH CHECK (public.is_band_admin(band_id, (select auth.uid())));

-- casting_assignments — SELECT: band members (setlist) / event participants (event).
DROP POLICY IF EXISTS "casting_select" ON public.casting_assignments;
CREATE POLICY "casting_select" ON public.casting_assignments
  FOR SELECT TO authenticated
  USING (
    (context_type = 'setlist' AND public.is_band_member(band_id, (select auth.uid())))
    OR (context_type = 'event' AND public.is_event_participant(context_id, (select auth.uid())))
  );

-- INSERT: director authority + fully-bound post-image + member∈scope + actor pinned.
DROP POLICY IF EXISTS "casting_insert" ON public.casting_assignments;
CREATE POLICY "casting_insert" ON public.casting_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      (context_type = 'setlist'
        AND public.is_band_admin(band_id, (select auth.uid()))
        AND public.casting_setlist_ctx_ok(context_id, band_id, song_id)
        AND (member_id IS NULL OR public.is_band_member(band_id, member_id)))
      OR
      (context_type = 'event'
        AND public.is_event_manager(context_id, (select auth.uid()))
        AND public.casting_event_ctx_ok(context_id, band_id, event_lineup_item_id, song_id)
        AND (member_id IS NULL OR public.is_event_participant(context_id, member_id)))
    )
  );

-- UPDATE: manage OLD row (USING) AND re-validate NEW row (WITH CHECK).
DROP POLICY IF EXISTS "casting_update" ON public.casting_assignments;
CREATE POLICY "casting_update" ON public.casting_assignments
  FOR UPDATE TO authenticated
  USING (
    (context_type = 'setlist' AND public.is_band_admin(band_id, (select auth.uid())))
    OR (context_type = 'event' AND public.is_event_manager(context_id, (select auth.uid())))
  )
  -- NOTE: UPDATE does NOT pin created_by (unlike INSERT) so a co-director/co-host can
  -- edit a row another director created. Authorization is still the admin/manager check
  -- + the band↔context↔song binding on the NEW image (no cross-band smuggling).
  WITH CHECK (
    (context_type = 'setlist'
      AND public.is_band_admin(band_id, (select auth.uid()))
      AND public.casting_setlist_ctx_ok(context_id, band_id, song_id)
      AND (member_id IS NULL OR public.is_band_member(band_id, member_id)))
    OR
    (context_type = 'event'
      AND public.is_event_manager(context_id, (select auth.uid()))
      AND public.casting_event_ctx_ok(context_id, band_id, event_lineup_item_id, song_id)
      AND (member_id IS NULL OR public.is_event_participant(context_id, member_id)))
  );

-- DELETE: director authority on the OLD row.
DROP POLICY IF EXISTS "casting_delete" ON public.casting_assignments;
CREATE POLICY "casting_delete" ON public.casting_assignments
  FOR DELETE TO authenticated
  USING (
    (context_type = 'setlist' AND public.is_band_admin(band_id, (select auth.uid())))
    OR (context_type = 'event' AND public.is_event_manager(context_id, (select auth.uid())))
  );

-- ── Realtime (live casting for co-directors) ────────────────────────────────
ALTER TABLE public.casting_assignments REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.casting_assignments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
