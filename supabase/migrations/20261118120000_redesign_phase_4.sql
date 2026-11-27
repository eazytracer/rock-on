-- ============================================================================
-- Redesign phase 4: calendar, shows, practices (0.11.0)
--
-- Schema
--   shows.confirmed          independent of status (DECISIONS Part A · 6);
--                            backfilled from status = 'confirmed', which leaves
--                            the status check.
--   setlists.copied_at       a show's set is its own setlist row (show_id set,
--                            source_setlist_id = the original, copied_at = when).
--                            Existing show ↔ setlist links are turned into copies.
--   practice_sessions.name   optional; the app falls back to the date.
--
-- RPCs (SECURITY INVOKER: RLS on shows / setlists / practice_sessions decides)
--   calendar_agenda          shows + practices of a band, one row each.
--   create_show, update_show, set_show_confirmed, set_show_cancelled,
--   delete_show              the show page (saves as you go).
--   attach_set_to_show, recopy_show_set, create_show_set
--                            the show's set copy. The source is never changed.
--   setlist_index            now skips show copies and finds a set's show
--                            through its copies.
-- Idempotent + additive.
-- ============================================================================

-- shows.confirmed -----------------------------------------------------------------
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false;

UPDATE public.shows SET confirmed = true, status = 'scheduled' WHERE status = 'confirmed';

ALTER TABLE public.shows DROP CONSTRAINT IF EXISTS shows_status_check;
ALTER TABLE public.shows ADD CONSTRAINT shows_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled'));

-- setlists.copied_at --------------------------------------------------------------
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS copied_at TIMESTAMPTZ;

-- practice_sessions.name ----------------------------------------------------------
ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill: every show's set becomes its own copy ----------------------------------
-- A show's own set has show_id = the show and copied_at set. Old per-show forks
-- (ShowService.forkSetlistForShow: show_id = the show, a source) are adopted as
-- they are; any other linked setlist is copied. Then show_id is cleared on every
-- setlist that isn't a show's own set, so legacy links stop hiding originals.
DO $$
DECLARE
  r   RECORD;
  v_id UUID;
BEGIN
  FOR r IN
    SELECT sh.id AS sid, sl.*
      FROM public.shows sh
      JOIN public.setlists sl
        ON sl.id = COALESCE(
             sh.setlist_id,
             (SELECT x.id FROM public.setlists x
               WHERE x.show_id = sh.id AND x.copied_at IS NULL
               ORDER BY x.last_modified DESC LIMIT 1))
     WHERE sl.copied_at IS NULL
  LOOP
    IF r.source_setlist_id IS NOT NULL AND r.show_id = r.sid THEN
      UPDATE public.setlists SET copied_at = r.created_date WHERE id = r.id;
      v_id := r.id;
    ELSE
      INSERT INTO public.setlists (
        name, band_id, context_type, context_id, created_by, last_modified_by,
        notes, tags, items, show_id, source_setlist_id, copied_at,
        created_date, last_modified
      ) VALUES (
        r.name, r.band_id, r.context_type, r.context_id, r.created_by,
        r.last_modified_by, r.notes, r.tags, COALESCE(r.items, '[]'::jsonb),
        r.sid, r.id, NOW(), NOW(), NOW()
      )
      RETURNING id INTO v_id;
    END IF;
    UPDATE public.shows SET setlist_id = v_id WHERE id = r.sid;
  END LOOP;

  UPDATE public.setlists SET show_id = NULL
   WHERE show_id IS NOT NULL AND copied_at IS NULL;
END;
$$;

-- setlist_index -------------------------------------------------------------------
-- Same shape as phase 3. Show copies are not listed; a set's show is the soonest
-- upcoming (else latest past) show holding a copy of it.
CREATE OR REPLACE FUNCTION public.setlist_index(
  p_context_type TEXT,
  p_context_id   TEXT
)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  last_modified TIMESTAMPTZ,
  show_id       UUID,
  show_name     TEXT,
  show_venue    TEXT,
  show_at       TIMESTAMPTZ,
  show_minutes  INT,
  show_set_time TEXT,
  songs         JSONB,
  break_minutes INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT sl.id, sl.name, sl.last_modified,
         sh.id, sh.name, sh.venue, sh.scheduled_date, sh.duration, sh.set_time,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id', s.id,
                    'title', s.title,
                    'tuning', s.guitar_tuning,
                    'seconds', COALESCE(s.duration, 0))
                  ORDER BY it.ord)
             FROM jsonb_array_elements(COALESCE(sl.items, '[]'::jsonb))
                  WITH ORDINALITY AS it(item, ord)
             JOIN public.songs s ON s.id = (it.item->>'songId')::uuid
            WHERE it.item->>'type' = 'song'
         ), '[]'::jsonb),
         COALESCE((
           SELECT SUM(COALESCE((it.item->>'breakDuration')::int, 0))::int
             FROM jsonb_array_elements(COALESCE(sl.items, '[]'::jsonb)) it(item)
            WHERE it.item->>'type' = 'break'
         ), 0)
    FROM public.setlists sl
    LEFT JOIN LATERAL (
      SELECT x.id, x.name, x.venue, x.scheduled_date, x.duration, x.set_time
        FROM public.shows x
        JOIN public.setlists c ON c.id = x.setlist_id AND c.show_id = x.id
       WHERE c.source_setlist_id = sl.id
         AND COALESCE(x.status, '') <> 'cancelled'
       ORDER BY (x.scheduled_date < date_trunc('day', NOW())),
                CASE WHEN x.scheduled_date >= date_trunc('day', NOW())
                     THEN x.scheduled_date END ASC,
                x.scheduled_date DESC
       LIMIT 1
    ) sh ON TRUE
   WHERE sl.context_type = p_context_type
     AND COALESCE(sl.context_id, sl.band_id::text) = p_context_id
     AND sl.show_id IS NULL;
$$;
REVOKE ALL ON FUNCTION public.setlist_index(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setlist_index(TEXT, TEXT) TO authenticated, service_role;

-- calendar_agenda -----------------------------------------------------------------
-- One row per show and practice of a band, soonest first. Practices carry what
-- a past row says ("1:52 played · 5 of 6 songs"); shows carry their set's size.
DROP FUNCTION IF EXISTS public.calendar_agenda(UUID);
CREATE OR REPLACE FUNCTION public.calendar_agenda(p_band_id UUID)
RETURNS TABLE (
  type        TEXT,
  id          UUID,
  name        TEXT,
  venue       TEXT,
  at          TIMESTAMPTZ,
  minutes     INT,
  cancelled   BOOLEAN,
  confirmed   BOOLEAN,
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  songs_total INT,
  songs_done  INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 'show', sh.id, sh.name, sh.venue, sh.scheduled_date, sh.duration,
         sh.status = 'cancelled', sh.confirmed, NULL::timestamptz, NULL::timestamptz,
         COALESCE((
           SELECT COUNT(*)::int
             FROM public.setlists c,
                  jsonb_array_elements(COALESCE(c.items, '[]'::jsonb)) it(item)
            WHERE c.id = sh.setlist_id AND it.item->>'type' = 'song'
         ), 0),
         0
    FROM public.shows sh
   WHERE sh.band_id = p_band_id
  UNION ALL
  SELECT 'practice', p.id, COALESCE(p.name, ''), p.location, p.scheduled_date,
         p.duration, false, false, p.start_time, p.end_time,
         jsonb_array_length(COALESCE(p.songs, '[]'::jsonb)),
         (SELECT COUNT(*)::int
            FROM jsonb_array_elements(COALESCE(p.songs, '[]'::jsonb)) s(song)
           WHERE s.song->>'status' = 'completed')
    FROM public.practice_sessions p
   WHERE p.band_id = p_band_id
   ORDER BY 5;
$$;
REVOKE ALL ON FUNCTION public.calendar_agenda(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_agenda(UUID) TO authenticated, service_role;

-- Show helpers ---------------------------------------------------------------------
-- The show row, locked for this transaction.
CREATE OR REPLACE FUNCTION public._show_lock(p_show_id UUID)
RETURNS public.shows
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.shows;
BEGIN
  SELECT * INTO v FROM public.shows WHERE id = p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This show was deleted.';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public._show_lock(UUID) FROM PUBLIC, anon;

-- Applies the editable fields of a patch (app camelCase keys) to a show.
-- Keys: name, venue, location, scheduledDate, loadInTime, soundcheckTime,
-- duration, payment (cents), notes, contacts.
CREATE OR REPLACE FUNCTION public._show_apply(p_show_id UUID, p_patch JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_patch ? 'name' AND length(COALESCE(p_patch->>'name', '')) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'Keep the name under 120 characters.';
  END IF;
  IF p_patch ? 'duration' AND p_patch->>'duration' IS NOT NULL
     AND ((p_patch->>'duration')::int < 5 OR (p_patch->>'duration')::int > 600) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'A set runs between 5 minutes and 10 hours.';
  END IF;
  IF p_patch ? 'payment' AND p_patch->>'payment' IS NOT NULL
     AND (p_patch->>'payment')::numeric < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'Pay can''t be negative.';
  END IF;
  IF p_patch ? 'contacts' AND jsonb_typeof(p_patch->'contacts') <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'Contacts must be a list.';
  END IF;

  UPDATE public.shows SET
    name            = CASE WHEN p_patch ? 'name' THEN COALESCE(btrim(p_patch->>'name'), '') ELSE name END,
    venue           = CASE WHEN p_patch ? 'venue' THEN NULLIF(btrim(p_patch->>'venue'), '') ELSE venue END,
    location        = CASE WHEN p_patch ? 'location' THEN NULLIF(btrim(p_patch->>'location'), '') ELSE location END,
    scheduled_date  = CASE WHEN p_patch ? 'scheduledDate' AND p_patch->>'scheduledDate' IS NOT NULL
                           THEN (p_patch->>'scheduledDate')::timestamptz ELSE scheduled_date END,
    load_in_time    = CASE WHEN p_patch ? 'loadInTime' THEN NULLIF(p_patch->>'loadInTime', '') ELSE load_in_time END,
    soundcheck_time = CASE WHEN p_patch ? 'soundcheckTime' THEN NULLIF(p_patch->>'soundcheckTime', '') ELSE soundcheck_time END,
    duration        = CASE WHEN p_patch ? 'duration' THEN (p_patch->>'duration')::int ELSE duration END,
    payment         = CASE WHEN p_patch ? 'payment' THEN round((p_patch->>'payment')::numeric)::int ELSE payment END,
    notes           = CASE WHEN p_patch ? 'notes' THEN p_patch->>'notes' ELSE notes END,
    contacts        = CASE WHEN p_patch ? 'contacts' THEN p_patch->'contacts' ELSE contacts END,
    updated_date    = NOW(),
    last_modified_by = auth.uid()
  WHERE id = p_show_id;
END;
$$;
REVOKE ALL ON FUNCTION public._show_apply(UUID, JSONB) FROM PUBLIC, anon;

-- create_show ------------------------------------------------------------------------
-- A show from the first field typed on the blank show page. scheduledDate is
-- required (the page picks a default); everything else is optional.
CREATE OR REPLACE FUNCTION public.create_show(p_band_id UUID, p_patch JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_patch->>'scheduledDate' IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'Pick a date for the show.';
  END IF;
  INSERT INTO public.shows (band_id, name, scheduled_date, duration, created_by, last_modified_by)
  VALUES (p_band_id, '', (p_patch->>'scheduledDate')::timestamptz, 45, auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public._show_apply(v_id, p_patch);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_show(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_show(UUID, JSONB) TO authenticated, service_role;

-- update_show --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_show(p_show_id UUID, p_patch JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public._show_lock(p_show_id);
  PERFORM public._show_apply(p_show_id, p_patch);
END;
$$;
REVOKE ALL ON FUNCTION public.update_show(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_show(UUID, JSONB) TO authenticated, service_role;

-- set_show_confirmed / set_show_cancelled ---------------------------------------------
-- Confirmed and Cancelled are independent: undoing a cancel leaves confirmed alone.
CREATE OR REPLACE FUNCTION public.set_show_confirmed(p_show_id UUID, p_confirmed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public._show_lock(p_show_id);
  UPDATE public.shows
     SET confirmed = p_confirmed, updated_date = NOW(), last_modified_by = auth.uid()
   WHERE id = p_show_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_show_confirmed(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_show_confirmed(UUID, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_show_cancelled(p_show_id UUID, p_cancelled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.shows;
BEGIN
  v := public._show_lock(p_show_id);
  UPDATE public.shows
     SET status = CASE
                    WHEN p_cancelled THEN 'cancelled'
                    WHEN v.status = 'cancelled' THEN 'scheduled'
                    ELSE v.status
                  END,
         updated_date = NOW(), last_modified_by = auth.uid()
   WHERE id = p_show_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_show_cancelled(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_show_cancelled(UUID, BOOLEAN) TO authenticated, service_role;

-- delete_show ----------------------------------------------------------------------------
-- The show and its own set copy go; the setlist it was copied from never does.
CREATE OR REPLACE FUNCTION public.delete_show(p_show_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public._show_lock(p_show_id);
  DELETE FROM public.shows WHERE id = p_show_id;
  DELETE FROM public.setlists WHERE show_id = p_show_id AND copied_at IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_show(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_show(UUID) TO authenticated, service_role;

-- attach_set_to_show -------------------------------------------------------------------
-- Copies a setlist into the show (replacing any set it had). Returns the copy.
CREATE OR REPLACE FUNCTION public.attach_set_to_show(p_show_id UUID, p_setlist_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_show public.shows;
  v_src  public.setlists;
  v_id   UUID;
BEGIN
  v_show := public._show_lock(p_show_id);
  SELECT * INTO v_src FROM public.setlists WHERE id = p_setlist_id;
  IF NOT FOUND OR v_src.show_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'That setlist was deleted.';
  END IF;
  IF jsonb_array_length(COALESCE(v_src.items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'empty',
      HINT = 'This setlist is empty.';
  END IF;

  DELETE FROM public.setlists WHERE show_id = p_show_id AND copied_at IS NOT NULL;
  INSERT INTO public.setlists (
    name, band_id, context_type, context_id, created_by, last_modified_by,
    notes, tags, items, show_id, source_setlist_id, copied_at
  ) VALUES (
    v_src.name, v_src.band_id, v_src.context_type, v_src.context_id,
    auth.uid(), auth.uid(), v_src.notes, v_src.tags, v_src.items,
    p_show_id, v_src.id, NOW()
  )
  RETURNING id INTO v_id;
  UPDATE public.shows
     SET setlist_id = v_id, updated_date = NOW(), last_modified_by = auth.uid()
   WHERE id = p_show_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_set_to_show(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_set_to_show(UUID, UUID) TO authenticated, service_role;

-- recopy_show_set ------------------------------------------------------------------------
-- Replaces the copy's contents from the same source, keeping the copy's id.
CREATE OR REPLACE FUNCTION public.recopy_show_set(p_show_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_copy public.setlists;
  v_src  public.setlists;
BEGIN
  PERFORM public._show_lock(p_show_id);
  SELECT * INTO v_copy FROM public.setlists
   WHERE show_id = p_show_id AND copied_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This show has no set yet.';
  END IF;
  SELECT * INTO v_src FROM public.setlists WHERE id = v_copy.source_setlist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = format('%s was deleted. The show keeps its copy.', v_copy.name);
  END IF;
  UPDATE public.setlists
     SET name = v_src.name, items = v_src.items, notes = v_src.notes,
         copied_at = NOW(), last_modified = NOW(), last_modified_by = auth.uid()
   WHERE id = v_copy.id;
  RETURN v_copy.id;
END;
$$;
REVOKE ALL ON FUNCTION public.recopy_show_set(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recopy_show_set(UUID) TO authenticated, service_role;

-- create_show_set ------------------------------------------------------------------------
-- An empty set of the show's own (no source). Returns the existing one if any.
CREATE OR REPLACE FUNCTION public.create_show_set(p_show_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_show public.shows;
  v_id   UUID;
BEGIN
  v_show := public._show_lock(p_show_id);
  SELECT id INTO v_id FROM public.setlists
   WHERE show_id = p_show_id AND copied_at IS NOT NULL;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  INSERT INTO public.setlists (
    name, band_id, context_type, context_id, created_by, last_modified_by,
    items, show_id, copied_at
  ) VALUES (
    left(COALESCE(NULLIF(v_show.name, ''), v_show.venue, 'Show') || ' set', 80),
    v_show.band_id, 'band', v_show.band_id::text, auth.uid(), auth.uid(),
    '[]'::jsonb, p_show_id, NOW()
  )
  RETURNING id INTO v_id;
  UPDATE public.shows
     SET setlist_id = v_id, updated_date = NOW(), last_modified_by = auth.uid()
   WHERE id = p_show_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_show_set(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_show_set(UUID) TO authenticated, service_role;

-- duplicate_show -------------------------------------------------------------------------
-- Same venue, times, pay, contacts and notes a week later; not confirmed. The
-- set comes along as a fresh copy with the same source. Returns the new show.
CREATE OR REPLACE FUNCTION public.duplicate_show(p_show_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src  public.shows;
  v_copy public.setlists;
  v_id   UUID;
  v_set  UUID;
BEGIN
  SELECT * INTO v_src FROM public.shows WHERE id = p_show_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This show was deleted.';
  END IF;
  INSERT INTO public.shows (
    band_id, name, venue, location, scheduled_date, load_in_time, soundcheck_time,
    set_time, duration, payment, contacts, notes, gig_type, created_by, last_modified_by
  ) VALUES (
    v_src.band_id, v_src.name, v_src.venue, v_src.location,
    v_src.scheduled_date + interval '7 days', v_src.load_in_time, v_src.soundcheck_time,
    v_src.set_time, v_src.duration, v_src.payment, v_src.contacts, v_src.notes,
    v_src.gig_type, auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  SELECT * INTO v_copy FROM public.setlists
   WHERE show_id = p_show_id AND copied_at IS NOT NULL;
  IF FOUND THEN
    INSERT INTO public.setlists (
      name, band_id, context_type, context_id, created_by, last_modified_by,
      notes, tags, items, show_id, source_setlist_id, copied_at
    ) VALUES (
      v_copy.name, v_copy.band_id, v_copy.context_type, v_copy.context_id,
      auth.uid(), auth.uid(), v_copy.notes, v_copy.tags, v_copy.items,
      v_id, v_copy.source_setlist_id, NOW()
    )
    RETURNING id INTO v_set;
    UPDATE public.shows SET setlist_id = v_set WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_show(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_show(UUID) TO authenticated, service_role;

-- ── What's new ────────────────────────────────────────────────────────────────
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.11.0',
  'Calendar, shows and practices, rebuilt',
  $md$Shows, practices and jams now share one Calendar, with a filter for each. A show page edits in place: mark it Confirmed, cancel it (with Undo), and give it a set. The set is the show's own copy, so changing it never touches the original. Practices get names, an editor that adds songs from any setlist, and a stage-sized practice session: big Prev and Next, notes a tap away, a warning before a retune, and a wrap-up the whole band can read.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
