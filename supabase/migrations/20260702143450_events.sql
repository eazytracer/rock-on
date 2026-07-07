-- ============================================================================
-- Events feature (mobile-redesign-port)
-- Host-owned, access-controlled events with a song lineup people sign up to play.
-- Song requests stay unresolved until the host approves; a SECURITY DEFINER trigger
-- promotes an approved request into the lineup atomically. Supabase-only. Idempotent.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  band_id           UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  venue             TEXT,
  location          TEXT,
  scheduled_date    TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  visibility        TEXT NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('private','unlisted','public')),
  status            TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  short_code        TEXT UNIQUE,
  view_token        TEXT UNIQUE,
  view_token_expires_at TIMESTAMPTZ,
  setlist_id        UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  calendar_uid      UUID DEFAULT gen_random_uuid(),
  calendar_sequence INTEGER NOT NULL DEFAULT 0,
  created_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version           INTEGER NOT NULL DEFAULT 1,
  last_modified_by  UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.event_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_tier TEXT NOT NULL DEFAULT 'guest'
                CHECK (access_tier IN ('host','cohost','guest','viewer')),
  rsvp        TEXT NOT NULL DEFAULT 'pending'
                CHECK (rsvp IN ('pending','going','maybe','declined')),
  joined_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_lineup_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL DEFAULT 0,
  source         TEXT NOT NULL CHECK (source IN ('mine','band','public','external')),
  owner_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  song_id        UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  display_title  TEXT NOT NULL,
  display_artist TEXT NOT NULL,
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_lineup_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source                  TEXT NOT NULL CHECK (source IN ('mine','band','public','external')),
  owner_id                UUID REFERENCES public.users(id) ON DELETE SET NULL,
  song_id                 UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  display_title           TEXT NOT NULL,
  display_artist          TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
  resolved_lineup_item_id UUID REFERENCES public.event_lineup_items(id) ON DELETE SET NULL,
  created_date            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_host           ON public.events (host_user_id);
CREATE INDEX IF NOT EXISTS idx_events_band           ON public.events (band_id);
CREATE INDEX IF NOT EXISTS idx_events_scheduled_date ON public.events (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_events_short_code     ON public.events (short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_view_token     ON public.events (view_token) WHERE view_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants (event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user  ON public.event_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_event_lineup_items_event ON public.event_lineup_items (event_id);
CREATE INDEX IF NOT EXISTS idx_event_lineup_requests_pending
  ON public.event_lineup_requests (event_id) WHERE status = 'pending';

-- ── Helpers (SECURITY DEFINER — avoid RLS recursion) ────────────────────────
CREATE OR REPLACE FUNCTION public.is_event_participant(p_event UUID, p_user UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_participants
                 WHERE event_id = p_event AND user_id = p_user);
$$;

CREATE OR REPLACE FUNCTION public.is_event_manager(p_event UUID, p_user UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events
                 WHERE id = p_event AND host_user_id = p_user)
      OR EXISTS (SELECT 1 FROM public.event_participants
                 WHERE event_id = p_event AND user_id = p_user
                   AND access_tier IN ('host','cohost'));
$$;

-- ── Approve trigger: promote an approved request into the lineup ─────────────
CREATE OR REPLACE FUNCTION public.on_event_request_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_item_id UUID;
  next_pos INTEGER;
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    SELECT COALESCE(MAX(position), 0) + 1 INTO next_pos
      FROM public.event_lineup_items WHERE event_id = NEW.event_id;
    INSERT INTO public.event_lineup_items
      (event_id, position, source, owner_id, song_id, display_title, display_artist)
    VALUES
      (NEW.event_id, next_pos, NEW.source, NEW.owner_id, NEW.song_id, NEW.display_title, NEW.display_artist)
    RETURNING id INTO new_item_id;
    NEW.resolved_lineup_item_id := new_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_request_approved ON public.event_lineup_requests;
CREATE TRIGGER trg_event_request_approved
  BEFORE UPDATE ON public.event_lineup_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_event_request_approved();

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events                TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_participants    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_items    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_items    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.is_event_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_manager(UUID, UUID) TO authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_lineup_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_lineup_requests ENABLE ROW LEVEL SECURITY;

-- events
DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated
  USING (host_user_id = (select auth.uid())
         OR is_event_participant(id, (select auth.uid()))
         OR visibility = 'public');
DROP POLICY IF EXISTS "events_insert_host" ON public.events;
CREATE POLICY "events_insert_host" ON public.events FOR INSERT TO authenticated
  WITH CHECK (host_user_id = (select auth.uid()));
DROP POLICY IF EXISTS "events_update_manager" ON public.events;
CREATE POLICY "events_update_manager" ON public.events FOR UPDATE TO authenticated
  USING (is_event_manager(id, (select auth.uid())));
DROP POLICY IF EXISTS "events_delete_host" ON public.events;
CREATE POLICY "events_delete_host" ON public.events FOR DELETE TO authenticated
  USING (host_user_id = (select auth.uid()));

-- event_participants
DROP POLICY IF EXISTS "event_participants_select" ON public.event_participants;
CREATE POLICY "event_participants_select" ON public.event_participants FOR SELECT TO authenticated
  USING (is_event_participant(event_id, (select auth.uid())));
DROP POLICY IF EXISTS "event_participants_insert_self" ON public.event_participants;
CREATE POLICY "event_participants_insert_self" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR is_event_manager(event_id, (select auth.uid())));
DROP POLICY IF EXISTS "event_participants_update" ON public.event_participants;
CREATE POLICY "event_participants_update" ON public.event_participants FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR is_event_manager(event_id, (select auth.uid())));
DROP POLICY IF EXISTS "event_participants_delete" ON public.event_participants;
CREATE POLICY "event_participants_delete" ON public.event_participants FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR is_event_manager(event_id, (select auth.uid())));

-- event_lineup_items
DROP POLICY IF EXISTS "event_lineup_items_select" ON public.event_lineup_items;
CREATE POLICY "event_lineup_items_select" ON public.event_lineup_items FOR SELECT TO authenticated
  USING (is_event_participant(event_id, (select auth.uid()))
         OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'public'));
DROP POLICY IF EXISTS "event_lineup_items_write_manager" ON public.event_lineup_items;
CREATE POLICY "event_lineup_items_write_manager" ON public.event_lineup_items FOR ALL TO authenticated
  USING (is_event_manager(event_id, (select auth.uid())))
  WITH CHECK (is_event_manager(event_id, (select auth.uid())));

-- event_lineup_requests
DROP POLICY IF EXISTS "event_lineup_requests_select" ON public.event_lineup_requests;
CREATE POLICY "event_lineup_requests_select" ON public.event_lineup_requests FOR SELECT TO authenticated
  USING (requester_id = (select auth.uid()) OR is_event_manager(event_id, (select auth.uid())));
DROP POLICY IF EXISTS "event_lineup_requests_insert" ON public.event_lineup_requests;
CREATE POLICY "event_lineup_requests_insert" ON public.event_lineup_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = (select auth.uid())
              AND is_event_participant(event_id, (select auth.uid())));
DROP POLICY IF EXISTS "event_lineup_requests_update_manager" ON public.event_lineup_requests;
CREATE POLICY "event_lineup_requests_update_manager" ON public.event_lineup_requests FOR UPDATE TO authenticated
  USING (is_event_manager(event_id, (select auth.uid())) OR requester_id = (select auth.uid()));

-- ── Realtime (host console + guest live updates) ────────────────────────────
ALTER TABLE public.event_participants     REPLICA IDENTITY FULL;
ALTER TABLE public.event_lineup_requests  REPLICA IDENTITY FULL;
ALTER TABLE public.event_lineup_items     REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_lineup_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
