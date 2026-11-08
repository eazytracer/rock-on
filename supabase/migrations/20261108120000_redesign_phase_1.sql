-- ============================================================================
-- Redesign phase 1 · Shell and Home (0.8.0)
-- ----------------------------------------------------------------------------
-- OPERATIONS.md §3 (context, search, notifications), as RPCs per
-- docs/redesign/08-api-conventions.md so web and Flutter share them:
--   list_my_contexts, search, list_notifications, mark_notifications_read.
-- Activity is read from audit_log (bandmates' changes; never your own) plus the
-- user's rows in notifications. "Read" is one marker per user
-- (user_preferences.notifications_seen_at) plus read_at on notification rows.
-- Idempotent + additive.
-- ============================================================================

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

-- Activity worth telling a bandmate about, one row per (who, what, hour) so a
-- burst of edits to one song reads as one line.
CREATE OR REPLACE FUNCTION public._band_activity(p_user UUID)
RETURNS TABLE (
  id          TEXT,
  band_id     UUID,
  actor_id    UUID,
  actor_name  TEXT,
  verb        TEXT,
  object_type TEXT,
  object_id   TEXT,
  object_name TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (a.user_id, a.record_id, date_trunc('hour', a.changed_at))
    a.id::text,
    a.band_id,
    a.user_id,
    a.user_name,
    CASE a.action
      WHEN 'INSERT' THEN CASE WHEN a.table_name = 'band_memberships' THEN 'joined' ELSE 'added' END
      WHEN 'UPDATE' THEN 'edited'
      ELSE 'deleted'
    END,
    CASE a.table_name
      WHEN 'songs' THEN 'song'
      WHEN 'setlists' THEN 'setlist'
      WHEN 'shows' THEN 'show'
      WHEN 'practice_sessions' THEN 'practice'
      ELSE 'band'
    END,
    a.record_id,
    COALESCE(
      a.new_values->>'title', a.old_values->>'title',
      a.new_values->>'name',  a.old_values->>'name',
      CASE WHEN a.table_name = 'practice_sessions' THEN 'a practice' END,
      b.name
    ),
    CASE WHEN a.table_name = 'songs' THEN NULLIF(COALESCE(a.new_values, a.old_values)->>'artist', '') END,
    a.changed_at
  FROM public.audit_log a
  JOIN public.band_memberships m
    ON m.band_id = a.band_id AND m.user_id = p_user AND m.status = 'active'
  JOIN public.bands b ON b.id = a.band_id
  WHERE a.user_id IS NOT NULL AND a.user_id <> p_user
    AND (
      a.table_name IN ('songs', 'setlists', 'shows', 'practice_sessions')
      OR (a.table_name = 'band_memberships' AND a.action = 'INSERT')
    )
    AND a.changed_at > m.joined_date
  ORDER BY a.user_id, a.record_id, date_trunc('hour', a.changed_at), a.changed_at DESC;
$$;

REVOKE ALL ON FUNCTION public._band_activity(UUID) FROM PUBLIC, anon, authenticated;

-- list_my_contexts ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_contexts()
RETURNS TABLE (
  band_id      UUID,
  name         TEXT,
  role         TEXT,
  member_count INT,
  has_unread   BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seen AS (
    SELECT COALESCE(
      (SELECT notifications_seen_at FROM public.user_preferences WHERE user_id = auth.uid()),
      '-infinity'::timestamptz) AS at
  ), act AS (
    SELECT DISTINCT x.band_id FROM public._band_activity(auth.uid()) x, seen
     WHERE x.created_at > seen.at
  )
  SELECT b.id, b.name, m.role,
         (SELECT count(*)::int FROM public.band_memberships mm
           WHERE mm.band_id = b.id AND mm.status = 'active'),
         EXISTS (SELECT 1 FROM act WHERE act.band_id = b.id)
    FROM public.band_memberships m
    JOIN public.bands b ON b.id = m.band_id
   WHERE m.user_id = auth.uid() AND m.status = 'active'
   ORDER BY lower(b.name);
$$;

-- list_notifications ----------------------------------------------------------
-- p_before: keyset cursor (created_at of the last item already shown).
CREATE OR REPLACE FUNCTION public.list_notifications(
  p_before TIMESTAMPTZ DEFAULT NULL,
  p_limit  INT DEFAULT 50
)
RETURNS TABLE (
  id          TEXT,
  source      TEXT,
  band_id     UUID,
  band_name   TEXT,
  actor_id    UUID,
  actor_name  TEXT,
  verb        TEXT,
  object_type TEXT,
  object_id   TEXT,
  object_name TEXT,
  detail      TEXT,
  link        TEXT,
  created_at  TIMESTAMPTZ,
  is_read     BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seen AS (
    SELECT COALESCE(
      (SELECT notifications_seen_at FROM public.user_preferences WHERE user_id = auth.uid()),
      '-infinity'::timestamptz) AS at
  ), items AS (
    SELECT x.id, 'activity'::text AS source, x.band_id, b.name AS band_name,
           x.actor_id, x.actor_name, x.verb, x.object_type, x.object_id,
           x.object_name, x.detail, NULL::text AS link, x.created_at,
           x.created_at <= seen.at AS is_read
      FROM public._band_activity(auth.uid()) x
      JOIN public.bands b ON b.id = x.band_id, seen
    UNION ALL
    SELECT n.id::text, 'notice'::text, NULLIF(n.payload->>'band_id', '')::uuid, NULL,
           NULL, NULL, NULL, n.kind, NULL, n.title, n.body, n.link, n.created_date,
           n.read_at IS NOT NULL OR n.created_date <= seen.at
      FROM public.notifications n, seen
     WHERE n.user_id = auth.uid() AND n.kind <> 'release'
  )
  SELECT * FROM items
   WHERE p_before IS NULL OR items.created_at < p_before
   ORDER BY items.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

-- mark_notifications_read -----------------------------------------------------
-- No ids: everything up to now is read. With ids: those notification rows only.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;

  IF p_ids IS NULL THEN
    INSERT INTO public.user_preferences (user_id, notifications_seen_at)
    VALUES (auth.uid(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET notifications_seen_at = NOW();
    UPDATE public.notifications SET read_at = NOW()
     WHERE user_id = auth.uid() AND read_at IS NULL;
  ELSE
    UPDATE public.notifications SET read_at = NOW()
     WHERE user_id = auth.uid() AND id = ANY (p_ids) AND read_at IS NULL;
  END IF;
END;
$$;

-- search ----------------------------------------------------------------------
-- p_band_id: the current context (NULL = Personal). p_all: every context the
-- user belongs to. Calendar items match by name, venue, or a song in their set
-- (shows, practices) or lineup (jams).
CREATE OR REPLACE FUNCTION public.search(
  p_query   TEXT,
  p_band_id UUID DEFAULT NULL,
  p_all     BOOLEAN DEFAULT FALSE,
  p_limit   INT DEFAULT 20
)
RETURNS TABLE (
  kind         TEXT,
  id           UUID,
  band_id      UUID,
  context_name TEXT,
  title        TEXT,
  subtitle     TEXT,
  matched_song TEXT,
  starts_at    TIMESTAMPTZ,
  tuning       TEXT,
  duration     INT,
  song_count   INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_q   TEXT := '%' || regexp_replace(trim(COALESCE(p_query, '')), '([%_\\])', '\\\1', 'g') || '%';
  v_lim INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  IF p_band_id IS NOT NULL AND NOT public.is_band_member(p_band_id, v_uid) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  IF length(trim(COALESCE(p_query, ''))) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH bands_in_scope AS (
    SELECT m.band_id AS bid, b.name AS bname
      FROM public.band_memberships m JOIN public.bands b ON b.id = m.band_id
     WHERE m.user_id = v_uid AND m.status = 'active'
       AND (p_all OR m.band_id = p_band_id)
  ),
  personal_in_scope AS (SELECT (p_all OR p_band_id IS NULL) AS yes),
  matched_songs AS (
    -- Songs the user can see that match; reused to find sets / lineups.
    SELECT s.id, s.title, s.artist, s.guitar_tuning, s.duration,
           CASE WHEN s.context_type = 'band' THEN s.context_id::uuid END AS bid
      FROM public.songs s
     WHERE (s.title ILIKE v_q OR s.artist ILIKE v_q)
       AND (
         (s.context_type = 'band' AND s.context_id::uuid IN (SELECT bid FROM bands_in_scope))
         OR (s.context_type = 'personal' AND s.context_id = v_uid::text
             AND (SELECT yes FROM personal_in_scope))
       )
  ),
  song_hits AS (
    SELECT 'song'::text, ms.id, ms.bid,
           COALESCE((SELECT bname FROM bands_in_scope WHERE bid = ms.bid), 'Personal'),
           ms.title, ms.artist, NULL::text, NULL::timestamptz,
           ms.guitar_tuning, ms.duration, NULL::int
      FROM matched_songs ms
     ORDER BY (ms.title ILIKE trim(p_query) || '%') DESC, lower(ms.title)
     LIMIT v_lim
  ),
  setlist_hits AS (
    SELECT 'setlist'::text, sl.id, sl.band_id, bs.bname, sl.name, NULL::text,
           (SELECT ms.title FROM matched_songs ms
              JOIN jsonb_array_elements(sl.items) it ON it->>'songId' = ms.id::text
             WHERE sl.name NOT ILIKE v_q LIMIT 1),
           NULL::timestamptz, NULL::text, NULL::int,
           (SELECT count(*)::int FROM jsonb_array_elements(sl.items) it WHERE it->>'type' = 'song')
      FROM public.setlists sl
      JOIN bands_in_scope bs ON bs.bid = sl.band_id
     WHERE sl.name ILIKE v_q
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(sl.items) it
                     JOIN matched_songs ms ON it->>'songId' = ms.id::text)
     ORDER BY sl.last_modified DESC NULLS LAST
     LIMIT v_lim
  ),
  show_hits AS (
    SELECT 'show'::text, sh.id, sh.band_id, bs.bname, sh.name, sh.venue,
           (SELECT ms.title FROM public.setlists sl
              CROSS JOIN jsonb_array_elements(sl.items) it
              JOIN matched_songs ms ON it->>'songId' = ms.id::text
             WHERE sl.id = sh.setlist_id AND sh.name NOT ILIKE v_q LIMIT 1),
           sh.scheduled_date, NULL::text, NULL::int, NULL::int
      FROM public.shows sh
      JOIN bands_in_scope bs ON bs.bid = sh.band_id
     WHERE sh.name ILIKE v_q OR sh.venue ILIKE v_q
        OR EXISTS (SELECT 1 FROM public.setlists sl
                     CROSS JOIN jsonb_array_elements(sl.items) it
                     JOIN matched_songs ms ON it->>'songId' = ms.id::text
                    WHERE sl.id = sh.setlist_id)
     ORDER BY sh.scheduled_date DESC
     LIMIT v_lim
  ),
  practice_hits AS (
    SELECT 'practice'::text, ps.id, ps.band_id, bs.bname, 'Practice'::text, ps.location,
           (SELECT ms.title FROM jsonb_array_elements(ps.songs) it
              JOIN matched_songs ms ON it->>'songId' = ms.id::text LIMIT 1),
           ps.scheduled_date, NULL::text, ps.duration, NULL::int
      FROM public.practice_sessions ps
      JOIN bands_in_scope bs ON bs.bid = ps.band_id
     WHERE ps.location ILIKE v_q
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(ps.songs) it
                     JOIN matched_songs ms ON it->>'songId' = ms.id::text)
     ORDER BY ps.scheduled_date DESC
     LIMIT v_lim
  ),
  jam_hits AS (
    SELECT 'jam'::text, e.id, e.band_id,
           COALESCE((SELECT bname FROM bands_in_scope WHERE bid = e.band_id), 'Personal'),
           e.name, e.venue,
           (SELECT li.display_title FROM public.event_lineup_items li
             WHERE li.event_id = e.id AND li.display_title ILIKE v_q
               AND e.name NOT ILIKE v_q LIMIT 1),
           e.scheduled_date, NULL::text, NULL::int, NULL::int
      FROM public.events e
     WHERE (e.host_user_id = v_uid OR public.is_event_participant(e.id, v_uid)
            OR e.band_id IN (SELECT bid FROM bands_in_scope))
       AND (p_all OR e.band_id IS NOT DISTINCT FROM p_band_id)
       AND (e.name ILIKE v_q OR e.venue ILIKE v_q
            OR EXISTS (SELECT 1 FROM public.event_lineup_items li
                        WHERE li.event_id = e.id AND li.display_title ILIKE v_q))
     ORDER BY e.scheduled_date DESC
     LIMIT v_lim
  )
  SELECT * FROM song_hits
  UNION ALL SELECT * FROM setlist_hits
  UNION ALL SELECT * FROM show_hits
  UNION ALL SELECT * FROM practice_hits
  UNION ALL SELECT * FROM jam_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_contexts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_notifications(TIMESTAMPTZ, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_notifications_read(UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search(TEXT, UUID, BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_contexts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_notifications(TIMESTAMPTZ, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search(TEXT, UUID, BOOLEAN, INT) TO authenticated, service_role;

-- Release notes ---------------------------------------------------------------
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.8.0',
  'Find your way',
  $md$- **New Home.** Your next show and practice up top with a countdown, then what's coming up.
- **Search everything.** Songs, setlists, shows, practices and jams, including any show with a song in its set. On a computer, press ⌘K.
- **One switcher.** Tap the band name at the top to switch between Personal and your bands.
- **Notifications.** See what your bandmates changed, and what's new in the app.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
