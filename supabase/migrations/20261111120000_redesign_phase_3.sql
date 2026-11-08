-- ============================================================================
-- Redesign phase 3 · Setlists (0.10.0). docs/redesign/10 Part 2, design/OPERATIONS §9.
--   setlist_index      the index's cards and the editor's switcher: show line
--                      and length, songs in order (for counts, minutes,
--                      retunes and the first titles), break minutes.
--   duplicate_setlist  a copy, not attached to a show.
--   rename_setlist, set_setlist_notes, add_songs_to_setlist, insert_setlist_item,
--   update_setlist_item, move_setlist_item, remove_setlist_item
--                      the editor. Each rewrites one setlist row under a row lock
--                      and touches only the item named, so two members editing at
--                      once don't overwrite each other.
-- All run as the caller (SECURITY INVOKER): RLS on setlists, songs and shows
-- decides what is visible. Idempotent + additive.
-- ============================================================================

-- setlist_index -------------------------------------------------------------------
-- One row per setlist in a context. The show is the soonest upcoming one using
-- the set (shows.setlist_id, or setlists.show_id), else the latest past one.
-- The show's length and set time feed the editor's "47 of 45 min" and timeline.
DROP FUNCTION IF EXISTS public.setlist_index(TEXT, TEXT);
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
       WHERE (x.setlist_id = sl.id OR x.id = sl.show_id)
         AND COALESCE(x.status, '') <> 'cancelled'
       ORDER BY (x.scheduled_date < date_trunc('day', NOW())),
                CASE WHEN x.scheduled_date >= date_trunc('day', NOW())
                     THEN x.scheduled_date END ASC,
                x.scheduled_date DESC
       LIMIT 1
    ) sh ON TRUE
   WHERE sl.context_type = p_context_type
     AND COALESCE(sl.context_id, sl.band_id::text) = p_context_id;
$$;
REVOKE ALL ON FUNCTION public.setlist_index(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setlist_index(TEXT, TEXT) TO authenticated, service_role;

-- duplicate_setlist ------------------------------------------------------------------
-- Copies name (+ " copy"), items (fresh item ids), notes and tags. Never attached
-- to a show. Returns the new setlist's id.
CREATE OR REPLACE FUNCTION public.duplicate_setlist(p_setlist_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src public.setlists;
  v_id  UUID;
BEGIN
  SELECT * INTO v_src FROM public.setlists WHERE id = p_setlist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This setlist was deleted.';
  END IF;

  INSERT INTO public.setlists (
    name, band_id, context_type, context_id, created_by, last_modified_by,
    notes, tags, items, source_setlist_id
  ) VALUES (
    left(v_src.name || ' copy', 80), v_src.band_id, v_src.context_type,
    v_src.context_id, auth.uid(), auth.uid(), v_src.notes, v_src.tags,
    COALESCE((
      SELECT jsonb_agg(it.item || jsonb_build_object('id', gen_random_uuid()::text)
                       ORDER BY it.ord)
        FROM jsonb_array_elements(COALESCE(v_src.items, '[]'::jsonb))
             WITH ORDINALITY AS it(item, ord)
    ), '[]'::jsonb),
    v_src.id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_setlist(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_setlist(UUID) TO authenticated, service_role;

-- Editor helpers -------------------------------------------------------------------
-- The setlist row, locked for this transaction (RLS decides visibility).
CREATE OR REPLACE FUNCTION public._setlist_lock(p_setlist_id UUID)
RETURNS public.setlists
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.setlists;
BEGIN
  SELECT * INTO v FROM public.setlists WHERE id = p_setlist_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This setlist was deleted.';
  END IF;
  RETURN v;
END;
$$;

-- 0-based index of an item, or raises when it's gone.
CREATE OR REPLACE FUNCTION public._setlist_item_index(p_items JSONB, p_item_id TEXT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_i INT;
BEGIN
  SELECT (ord - 1)::int INTO v_i
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY e(it, ord)
   WHERE it->>'id' = p_item_id;
  IF v_i IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'That row was removed from the set.';
  END IF;
  RETURN v_i;
END;
$$;

-- Where new items go: after p_after_item; NULL = at the end, '' = at the top.
CREATE OR REPLACE FUNCTION public._setlist_anchor(p_items JSONB, p_after_item TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_after_item IS NULL THEN jsonb_array_length(COALESCE(p_items, '[]'::jsonb))
              WHEN p_after_item = '' THEN 0
              ELSE public._setlist_item_index(p_items, p_after_item) + 1 END;
$$;

-- p_new spliced in at 0-based p_at (clamped).
CREATE OR REPLACE FUNCTION public._jsonb_insert_at(p_items JSONB, p_at INT, p_new JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY o), '[]'::jsonb) FROM (
    SELECT it AS x, (ord - 1)::numeric AS o
      FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY e(it, ord)
    UNION ALL
    SELECT n, LEAST(GREATEST(p_at, 0), jsonb_array_length(COALESCE(p_items, '[]'::jsonb)))
              - 0.5 + (ord::numeric / 1000)
      FROM jsonb_array_elements(p_new) WITH ORDINALITY e(n, ord)
  ) z;
$$;

-- Writes items back with positions 1..n.
CREATE OR REPLACE FUNCTION public._setlist_save_items(p_setlist_id UUID, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(it || jsonb_build_object('position', ord) ORDER BY ord), '[]'::jsonb)
    INTO v_items
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY e(it, ord);
  UPDATE public.setlists
     SET items = v_items, last_modified = NOW(), last_modified_by = auth.uid()
   WHERE id = p_setlist_id;
  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION public._setlist_lock(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._setlist_item_index(JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._jsonb_insert_at(JSONB, INT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._setlist_anchor(JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._setlist_save_items(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._setlist_lock(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._setlist_item_index(JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._jsonb_insert_at(JSONB, INT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._setlist_anchor(JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._setlist_save_items(UUID, JSONB) TO authenticated, service_role;

-- rename_setlist ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rename_setlist(p_setlist_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'A setlist name is 1 to 80 characters.';
  END IF;
  PERFORM public._setlist_lock(p_setlist_id);
  UPDATE public.setlists
     SET name = v_name, last_modified = NOW(), last_modified_by = auth.uid()
   WHERE id = p_setlist_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rename_setlist(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_setlist(UUID, TEXT) TO authenticated, service_role;

-- set_setlist_notes --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_setlist_notes(p_setlist_id UUID, p_notes TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public._setlist_lock(p_setlist_id);
  UPDATE public.setlists
     SET notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
         last_modified = NOW(), last_modified_by = auth.uid()
   WHERE id = p_setlist_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_setlist_notes(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_setlist_notes(UUID, TEXT) TO authenticated, service_role;

-- add_songs_to_setlist -----------------------------------------------------------------
-- Songs go in after p_after_item (NULL = at the end, '' = at the top), in order. In a
-- band set, one of your own songs is first copied into the band ("From my songs")
-- unless it was already copied there; your song is then linked to the band copy.
-- A song already in the set is refused by name. Returns the new items' ids.
CREATE OR REPLACE FUNCTION public.add_songs_to_setlist(
  p_setlist_id UUID,
  p_song_ids   UUID[],
  p_after_item TEXT DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set   public.setlists;
  v_song  public.songs;
  v_band  public.songs;
  v_id    UUID;
  v_sid   UUID;
  v_new   JSONB := '[]'::jsonb;
  v_ids   TEXT[] := '{}';
  v_item  TEXT;
  v_at    INT;
BEGIN
  v_set := public._setlist_lock(p_setlist_id);
  v_at := public._setlist_anchor(v_set.items, p_after_item);

  FOREACH v_sid IN ARRAY COALESCE(p_song_ids, '{}') LOOP
    SELECT * INTO v_song FROM public.songs WHERE id = v_sid;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
        HINT = 'This song was deleted.';
    END IF;
    v_id := v_song.id;

    IF v_set.context_type = 'band' AND v_song.context_type = 'personal' THEN
      IF v_song.context_id IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
          HINT = 'You don''t have access to this.';
      END IF;
      SELECT * INTO v_band FROM public.songs
       WHERE id = v_song.linked_from_song_id
         AND context_type = 'band' AND context_id = v_set.context_id;
      IF FOUND THEN
        v_id := v_band.id;
      ELSE
        INSERT INTO public.songs (
          title, artist, album, key, tempo, time_signature, duration, difficulty,
          guitar_tuning, tuning_id, reference_links, context_type, context_id,
          created_by, visibility, confidence_level, last_modified_by
        ) VALUES (
          v_song.title, v_song.artist, v_song.album, v_song.key, v_song.tempo,
          v_song.time_signature, v_song.duration, v_song.difficulty,
          v_song.guitar_tuning, v_song.tuning_id, v_song.reference_links, 'band',
          v_set.context_id, auth.uid(), 'band', v_song.confidence_level, auth.uid()
        ) RETURNING id INTO v_id;
        UPDATE public.songs SET linked_from_song_id = v_id
         WHERE id = v_song.id AND linked_from_song_id IS NULL;
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_set.items, '[]'::jsonb) || v_new) it
                WHERE it->>'songId' = v_id::text) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'duplicate',
        HINT = format('%s is already in this set.', v_song.title);
    END IF;

    v_item := gen_random_uuid()::text;
    v_ids := v_ids || v_item;
    v_new := v_new || jsonb_build_array(jsonb_build_object(
      'id', v_item, 'type', 'song', 'songId', v_id::text));
  END LOOP;

  PERFORM public._setlist_save_items(p_setlist_id,
    public._jsonb_insert_at(v_set.items, v_at, v_new));
  RETURN v_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.add_songs_to_setlist(UUID, UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_songs_to_setlist(UUID, UUID[], TEXT) TO authenticated, service_role;

-- insert_setlist_item ------------------------------------------------------------------
-- A break (5–60 min, default 15, optional note) or a section label, after
-- p_after_item (NULL = at the end, '' = at the top). Returns the new item's id.
CREATE OR REPLACE FUNCTION public.insert_setlist_item(
  p_setlist_id UUID,
  p_type       TEXT,
  p_after_item TEXT DEFAULT NULL,
  p_minutes    INT DEFAULT 15,
  p_note       TEXT DEFAULT NULL,
  p_label      TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set  public.setlists;
  v_id   TEXT := gen_random_uuid()::text;
  v_item JSONB;
  v_at   INT;
BEGIN
  IF p_type = 'break' THEN
    IF COALESCE(p_minutes, 0) NOT BETWEEN 5 AND 60 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
        HINT = 'A break is 5 to 60 minutes.';
    END IF;
    v_item := jsonb_build_object('id', v_id, 'type', 'break', 'breakDuration', p_minutes)
           || COALESCE(jsonb_build_object('breakNotes', NULLIF(btrim(p_note), '')), '{}');
    v_item := jsonb_strip_nulls(v_item);
  ELSIF p_type = 'section' THEN
    IF char_length(btrim(COALESCE(p_label, ''))) NOT BETWEEN 1 AND 40 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
        HINT = 'A section label is 1 to 40 characters.';
    END IF;
    v_item := jsonb_build_object('id', v_id, 'type', 'section', 'sectionTitle', btrim(p_label));
  ELSE
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
      HINT = 'Insert a break or a section.';
  END IF;

  v_set := public._setlist_lock(p_setlist_id);
  v_at := public._setlist_anchor(v_set.items, p_after_item);
  PERFORM public._setlist_save_items(p_setlist_id,
    public._jsonb_insert_at(v_set.items, v_at, jsonb_build_array(v_item)));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_setlist_item(UUID, TEXT, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_setlist_item(UUID, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated, service_role;

-- update_setlist_item ------------------------------------------------------------------
-- Break minutes / note, a section label, or a song's per-set note. Keys that
-- don't fit the item's type are ignored; an empty note clears it.
CREATE OR REPLACE FUNCTION public.update_setlist_item(
  p_setlist_id UUID,
  p_item_id    TEXT,
  p_patch      JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set   public.setlists;
  v_i     INT;
  v_item  JSONB;
  v_text  TEXT;
BEGIN
  v_set := public._setlist_lock(p_setlist_id);
  v_i := public._setlist_item_index(v_set.items, p_item_id);
  v_item := v_set.items->v_i;

  IF v_item->>'type' = 'break' THEN
    IF p_patch ? 'breakDuration' THEN
      IF COALESCE((p_patch->>'breakDuration')::int, 0) NOT BETWEEN 5 AND 60 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
          HINT = 'A break is 5 to 60 minutes.';
      END IF;
      v_item := v_item || jsonb_build_object('breakDuration', (p_patch->>'breakDuration')::int);
    END IF;
    IF p_patch ? 'breakNotes' THEN
      v_text := NULLIF(btrim(COALESCE(p_patch->>'breakNotes', '')), '');
      v_item := CASE WHEN v_text IS NULL THEN v_item - 'breakNotes'
                     ELSE v_item || jsonb_build_object('breakNotes', v_text) END;
    END IF;
  ELSIF v_item->>'type' = 'section' AND p_patch ? 'sectionTitle' THEN
    v_text := btrim(COALESCE(p_patch->>'sectionTitle', ''));
    IF char_length(v_text) NOT BETWEEN 1 AND 40 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid',
        HINT = 'A section label is 1 to 40 characters.';
    END IF;
    v_item := v_item || jsonb_build_object('sectionTitle', v_text);
  ELSIF v_item->>'type' = 'song' AND p_patch ? 'notes' THEN
    v_text := NULLIF(btrim(COALESCE(p_patch->>'notes', '')), '');
    v_item := CASE WHEN v_text IS NULL THEN v_item - 'notes'
                   ELSE v_item || jsonb_build_object('notes', v_text) END;
  END IF;

  PERFORM public._setlist_save_items(p_setlist_id,
    jsonb_set(v_set.items, ARRAY[v_i::text], v_item));
END;
$$;
REVOKE ALL ON FUNCTION public.update_setlist_item(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_setlist_item(UUID, TEXT, JSONB) TO authenticated, service_role;

-- move_setlist_item --------------------------------------------------------------------
-- Moves an item to 0-based p_to (clamped): the index it ends up at.
CREATE OR REPLACE FUNCTION public.move_setlist_item(
  p_setlist_id UUID,
  p_item_id    TEXT,
  p_to         INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set  public.setlists;
  v_i    INT;
BEGIN
  v_set := public._setlist_lock(p_setlist_id);
  v_i := public._setlist_item_index(v_set.items, p_item_id);
  PERFORM public._setlist_save_items(p_setlist_id,
    public._jsonb_insert_at(v_set.items - v_i, p_to, jsonb_build_array(v_set.items->v_i)));
END;
$$;
REVOKE ALL ON FUNCTION public.move_setlist_item(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_setlist_item(UUID, TEXT, INT) TO authenticated, service_role;

-- remove_setlist_item ------------------------------------------------------------------
-- The song stays in the catalog and in every other set.
CREATE OR REPLACE FUNCTION public.remove_setlist_item(p_setlist_id UUID, p_item_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_set public.setlists;
BEGIN
  v_set := public._setlist_lock(p_setlist_id);
  PERFORM public._setlist_save_items(p_setlist_id,
    v_set.items - public._setlist_item_index(v_set.items, p_item_id));
END;
$$;
REVOKE ALL ON FUNCTION public.remove_setlist_item(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_setlist_item(UUID, TEXT) TO authenticated, service_role;

-- Release notes ---------------------------------------------------------------
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.10.0',
  'Setlists, rebuilt',
  $md$Setlists open as cards, next show first. A set opens full width: switch to another set from its name, add songs, breaks and sections where you want them, drag to reorder, and see the retunes and running time as you go. Everything saves as you edit.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
