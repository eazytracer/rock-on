-- ============================================================================
-- Redesign phase 2 · Songs (0.9.0)
-- ----------------------------------------------------------------------------
-- OPERATIONS.md §6 as RPCs (docs/redesign/08-api-conventions.md):
--   song_usage, song_next_shows, set_band_note, duplicate_song, delete_song,
--   band_songs_not_in_my_catalog, copy_band_songs_to_personal.
-- songs gains album (was silently dropped by the client) and the band note's
-- last editor (DECISIONS Part A · 7: one shared band note = songs.notes).
-- Idempotent + additive.
-- ============================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS album TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS notes_edited_by UUID
  REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS notes_edited_at TIMESTAMPTZ;

-- Can the user see / change this song? Band songs: active member. Personal: owner.
CREATE OR REPLACE FUNCTION public.can_access_song(p_song_id UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.songs s
     WHERE s.id = p_song_id
       AND (
         (s.context_type = 'band' AND public.is_band_member(s.context_id::uuid, p_user))
         OR (s.context_type = 'personal' AND s.context_id = p_user::text)
       )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_song(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_song(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._require_song(p_song_id UUID)
RETURNS public.songs
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song public.songs;
BEGIN
  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This song was deleted.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.can_access_song(p_song_id, auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN v_song;
END;
$$;
REVOKE ALL ON FUNCTION public._require_song(UUID) FROM PUBLIC, anon, authenticated;

-- song_usage ("Used in") ---------------------------------------------------------
-- Setlists in the song's context (with the song's position among the set's
-- songs), shows whose set contains it, and upcoming practices that run it.
CREATE OR REPLACE FUNCTION public.song_usage(p_song_id UUID)
RETURNS TABLE (
  kind      TEXT,
  id        UUID,
  name      TEXT,
  "position" INT,
  starts_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song public.songs := public._require_song(p_song_id);
BEGIN
  RETURN QUERY
  WITH sets AS (
    SELECT sl.id, sl.name, sl.show_id, sl.last_modified,
           (SELECT n FROM (
              SELECT it->>'songId' AS sid,
                     row_number() OVER (ORDER BY (it->>'position')::int NULLS LAST) AS n
                FROM jsonb_array_elements(sl.items) it
               WHERE it->>'type' = 'song') q
             WHERE q.sid = p_song_id::text LIMIT 1)::int AS pos
      FROM public.setlists sl
     WHERE sl.items @> jsonb_build_array(jsonb_build_object('songId', p_song_id::text))
       AND (
         (v_song.context_type = 'band' AND sl.band_id = v_song.context_id::uuid)
         OR (v_song.context_type = 'personal' AND sl.context_type = 'personal'
             AND sl.context_id = v_song.context_id)
       )
  )
  SELECT 'setlist'::text, s.id, s.name, s.pos, NULL::timestamptz
    FROM sets s
  UNION ALL
  SELECT 'show'::text, sh.id, sh.name, s.pos, sh.scheduled_date
    FROM public.shows sh
    JOIN sets s ON s.id = sh.setlist_id
  UNION ALL
  SELECT 'practice'::text, ps.id, 'Practice'::text, NULL::int, ps.scheduled_date
    FROM public.practice_sessions ps
   WHERE v_song.context_type = 'band'
     AND ps.band_id = v_song.context_id::uuid
     AND ps.scheduled_date >= date_trunc('day', NOW())
     AND (ps.songs @> jsonb_build_array(jsonb_build_object('songId', p_song_id::text))
          OR ps.setlist_id IN (SELECT s.id FROM sets s));
END;
$$;

-- song_next_shows -----------------------------------------------------------------
-- For each song in a band, the soonest upcoming show whose set includes it.
CREATE OR REPLACE FUNCTION public.song_next_shows(p_band_id UUID)
RETURNS TABLE (
  song_id   UUID,
  show_id   UUID,
  show_name TEXT,
  starts_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_band_member(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON ((it->>'songId')::uuid)
         (it->>'songId')::uuid, sh.id, sh.name, sh.scheduled_date
    FROM public.shows sh
    JOIN public.setlists sl ON sl.id = sh.setlist_id
    CROSS JOIN jsonb_array_elements(sl.items) it
   WHERE sh.band_id = p_band_id
     AND sh.scheduled_date >= date_trunc('day', NOW())
     AND COALESCE(sh.status, '') <> 'cancelled'
     AND it->>'type' = 'song' AND it ? 'songId'
   ORDER BY (it->>'songId')::uuid, sh.scheduled_date;
END;
$$;

-- set_band_note -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_band_note(
  p_song_id          UUID,
  p_notes            TEXT,
  p_expected_version INT DEFAULT NULL
)
RETURNS public.songs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song public.songs := public._require_song(p_song_id);
BEGIN
  IF p_expected_version IS NOT NULL AND v_song.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stale_version',
      HINT = 'Someone just changed this. Showing the latest.';
  END IF;
  UPDATE public.songs
     SET notes = p_notes,
         notes_edited_by = auth.uid(),
         notes_edited_at = NOW(),
         last_modified_by = auth.uid()
   WHERE id = p_song_id
  RETURNING * INTO v_song;
  RETURN v_song;
END;
$$;

-- duplicate_song ------------------------------------------------------------------
-- Copies facts and links (not notes) into the same context as "‹title› (copy)".
CREATE OR REPLACE FUNCTION public.duplicate_song(p_song_id UUID)
RETURNS public.songs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src  public.songs := public._require_song(p_song_id);
  v_copy public.songs;
BEGIN
  INSERT INTO public.songs (
    title, artist, album, key, tempo, time_signature, duration, difficulty,
    guitar_tuning, tuning_id, reference_links, context_type, context_id,
    created_by, visibility, confidence_level, last_modified_by
  ) VALUES (
    v_src.title || ' (copy)', v_src.artist, v_src.album, v_src.key, v_src.tempo,
    v_src.time_signature, v_src.duration, v_src.difficulty, v_src.guitar_tuning,
    v_src.tuning_id, v_src.reference_links, v_src.context_type, v_src.context_id,
    auth.uid(), v_src.visibility, v_src.confidence_level, auth.uid()
  ) RETURNING * INTO v_copy;
  RETURN v_copy;
END;
$$;

-- delete_song ---------------------------------------------------------------------
-- Removes it from setlists in its context (shows keep pointing at those sets),
-- then deletes it. One transaction.
CREATE OR REPLACE FUNCTION public.delete_song(p_song_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song public.songs := public._require_song(p_song_id);
BEGIN
  UPDATE public.setlists sl
     SET items = COALESCE((
           SELECT jsonb_agg(it ORDER BY (it->>'position')::int NULLS LAST)
             FROM jsonb_array_elements(sl.items) it
            WHERE it->>'songId' IS DISTINCT FROM p_song_id::text), '[]'::jsonb),
         last_modified = NOW(),
         last_modified_by = auth.uid()
   WHERE sl.items @> jsonb_build_array(jsonb_build_object('songId', p_song_id::text))
     AND (
       (v_song.context_type = 'band' AND sl.band_id = v_song.context_id::uuid)
       OR (v_song.context_type = 'personal' AND sl.context_id = v_song.context_id)
     );
  DELETE FROM public.songs WHERE id = p_song_id;
END;
$$;

-- band_songs_not_in_my_catalog ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.band_songs_not_in_my_catalog()
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  artist        TEXT,
  band_id       UUID,
  band_name     TEXT,
  guitar_tuning TEXT,
  duration      INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.artist, b.id, b.name, s.guitar_tuning, s.duration
    FROM public.songs s
    JOIN public.band_memberships m
      ON m.band_id = s.context_id::uuid AND m.user_id = auth.uid() AND m.status = 'active'
    JOIN public.bands b ON b.id = m.band_id
   WHERE s.context_type = 'band'
     AND NOT EXISTS (
       SELECT 1 FROM public.songs p
        WHERE p.context_type = 'personal' AND p.context_id = auth.uid()::text
          AND p.linked_from_song_id = s.id)
     AND NOT EXISTS (
       SELECT 1 FROM public.song_hidden h WHERE h.user_id = auth.uid() AND h.song_id = s.id)
   ORDER BY lower(s.title);
$$;

-- copy_band_songs_to_personal -----------------------------------------------------
-- NULL = all of them. Never band → band; already-linked songs are skipped.
CREATE OR REPLACE FUNCTION public.copy_band_songs_to_personal(p_song_ids UUID[] DEFAULT NULL)
RETURNS SETOF public.songs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN QUERY
  INSERT INTO public.songs (
    title, artist, album, key, tempo, time_signature, duration, difficulty,
    guitar_tuning, tuning_id, reference_links, context_type, context_id,
    created_by, visibility, confidence_level, linked_from_song_id, last_modified_by
  )
  SELECT s.title, s.artist, s.album, s.key, s.tempo, s.time_signature, s.duration,
         s.difficulty, s.guitar_tuning, s.tuning_id, s.reference_links, 'personal',
         auth.uid()::text, auth.uid(), 'personal', s.confidence_level, s.id, auth.uid()
    FROM public.band_songs_not_in_my_catalog() n
    JOIN public.songs s ON s.id = n.id
   WHERE p_song_ids IS NULL OR s.id = ANY (p_song_ids)
  RETURNING *;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.song_usage(uuid)',
    'public.song_next_shows(uuid)',
    'public.set_band_note(uuid, text, integer)',
    'public.duplicate_song(uuid)',
    'public.delete_song(uuid)',
    'public.band_songs_not_in_my_catalog()',
    'public.copy_band_songs_to_personal(uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- Release notes ---------------------------------------------------------------
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.9.0',
  'Songs, cleaned up',
  $md$- **New song list.** Tuning, length, key and BPM at a glance. Pick Comfortable or Compact and which details show under View; it remembers per list.
- **Sort and filter.** Sort by title, artist, newest, oldest or next show. Tap a tuning to see only those songs.
- **Song page.** Tap a song to see everything about it: links, the band's note, your own notes, and where it's used.
- **One band note.** Each song has one shared note, with who edited it last.
- **Copy band songs to My Songs** in one go from your Personal songs.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
