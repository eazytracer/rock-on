-- ============================================================================
-- Redesign phase 5: tools and chart (decisions: docs/DECISIONS.md)
--
-- Schema
--   song_charts              one chart per song (ChordPro + starting note).
--                            Readable by whoever can access the song; written
--                            only through the RPCs below. A small dedicated
--                            audit trigger (no chart text in audit_log).
--   tunings                  4 extended-range built-ins, colours for the
--                            extended-range rows (decision 15), and a unique
--                            index on custom tunings (duplicates merged first).
--
-- RPCs (SECURITY DEFINER, access checked in each)
--   get_chart, save_chart, set_starting_note, copy_linked_chart
--   duplicate_song                 now copies the chart.
--   copy_band_songs_to_personal    now copies each band song's chart (decision 2).
--   create_tuning, update_tuning
--
-- No release_notes row: the redesign ships as one release (decision 3).
-- Idempotent + additive.
-- ============================================================================

-- song_charts ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.song_charts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id          UUID NOT NULL UNIQUE REFERENCES public.songs(id) ON DELETE CASCADE,
  chordpro         TEXT NOT NULL DEFAULT '' CHECK (octet_length(chordpro) <= 204800),
  starting_note    SMALLINT CHECK (starting_note BETWEEN 0 AND 127),
  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  last_modified_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_charts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_charts TO service_role;

ALTER TABLE public.song_charts ENABLE ROW LEVEL SECURITY;

-- Read: whoever can access the song. No write policies: writes go through the RPCs.
DROP POLICY IF EXISTS "song_charts_select" ON public.song_charts;
CREATE POLICY "song_charts_select" ON public.song_charts FOR SELECT TO authenticated
  USING (public.can_access_song(song_id, (select auth.uid())));

-- Audit: the change feed only needs "this song's chart changed". record_id is the
-- song id (one chart per song); the values carry song_id + version, never the text.
CREATE OR REPLACE FUNCTION public.log_song_chart_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       public.song_charts := COALESCE(NEW, OLD);
  v_user_id   UUID := auth.uid();
  v_user_name TEXT;
  v_band_id   UUID;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name FROM public.users WHERE id = v_user_id;
    IF v_user_name IS NULL THEN
      SELECT raw_user_meta_data->>'name' INTO v_user_name
        FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  SELECT s.context_id::uuid INTO v_band_id
    FROM public.songs s
    JOIN public.bands b ON b.id::text = s.context_id
   WHERE s.id = v_row.song_id AND s.context_type = 'band';

  INSERT INTO public.audit_log (
    table_name, record_id, action, old_values, new_values, user_id, user_name, band_id
  ) VALUES (
    TG_TABLE_NAME,
    v_row.song_id::text,
    TG_OP,
    CASE WHEN TG_OP <> 'INSERT'
         THEN jsonb_build_object('song_id', OLD.song_id, 'version', OLD.version) END,
    CASE WHEN TG_OP <> 'DELETE'
         THEN jsonb_build_object('song_id', NEW.song_id, 'version', NEW.version) END,
    v_user_id,
    COALESCE(v_user_name, 'System'),
    v_band_id
  );
  RETURN v_row;
END;
$$;
ALTER FUNCTION public.log_song_chart_audit() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_song_chart_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS song_charts_audit_log ON public.song_charts;
CREATE TRIGGER song_charts_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.song_charts
  FOR EACH ROW EXECUTE FUNCTION public.log_song_chart_audit();

-- get_chart -----------------------------------------------------------------------
-- The song's own chart (a linked copy has its own, decision 2). No chart → no rows.
CREATE OR REPLACE FUNCTION public.get_chart(p_song_id UUID)
RETURNS TABLE (
  song_id       UUID,
  chordpro      TEXT,
  starting_note SMALLINT,
  version       INT,
  updated_date  TIMESTAMPTZ,
  editor_name   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._require_song(p_song_id);
  RETURN QUERY
  SELECT c.song_id, c.chordpro, c.starting_note, c.version, c.updated_date, u.name
    FROM public.song_charts c
    LEFT JOIN public.users u ON u.id = c.last_modified_by
   WHERE c.song_id = p_song_id;
END;
$$;

-- save_chart ----------------------------------------------------------------------
-- Stores ChordPro as given (the client converts chords-over-lyrics, decision 4).
-- p_expected_version: the version the editor opened (NULL = no chart was loaded).
CREATE OR REPLACE FUNCTION public.save_chart(
  p_song_id          UUID,
  p_chordpro         TEXT,
  p_expected_version INT DEFAULT NULL
)
RETURNS public.song_charts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chart public.song_charts;
BEGIN
  PERFORM public._require_song(p_song_id);
  IF octet_length(COALESCE(p_chordpro, '')) > 204800 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'chart_too_long',
      HINT = 'That''s too long for one chart.';
  END IF;

  SELECT * INTO v_chart FROM public.song_charts WHERE song_id = p_song_id FOR UPDATE;
  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_chart.version <> p_expected_version THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stale_version',
        HINT = 'Someone just changed this. Showing the latest.';
    END IF;
    UPDATE public.song_charts
       SET chordpro = COALESCE(p_chordpro, ''),
           version = version + 1,
           updated_date = NOW(),
           last_modified_by = auth.uid()
     WHERE song_id = p_song_id
    RETURNING * INTO v_chart;
  ELSE
    INSERT INTO public.song_charts (song_id, chordpro, last_modified_by)
    VALUES (p_song_id, COALESCE(p_chordpro, ''), auth.uid())
    ON CONFLICT (song_id) DO NOTHING
    RETURNING * INTO v_chart;
    IF v_chart.id IS NULL THEN
      -- Someone created it between our read and insert.
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stale_version',
        HINT = 'Someone just changed this. Showing the latest.';
    END IF;
  END IF;
  RETURN v_chart;
END;
$$;

-- set_starting_note ---------------------------------------------------------------
-- Saves as you pick. Doesn't bump `version` (that guards the chart text), so
-- picking a note in the editor never makes your own save stale. NULL clears.
CREATE OR REPLACE FUNCTION public.set_starting_note(p_song_id UUID, p_note SMALLINT DEFAULT NULL)
RETURNS public.song_charts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chart public.song_charts;
BEGIN
  PERFORM public._require_song(p_song_id);
  IF p_note IS NOT NULL AND (p_note < 0 OR p_note > 127) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_note',
      HINT = 'Pick a note from the keyboard.';
  END IF;
  INSERT INTO public.song_charts (song_id, starting_note, last_modified_by)
  VALUES (p_song_id, p_note, auth.uid())
  ON CONFLICT (song_id) DO UPDATE SET starting_note = EXCLUDED.starting_note
  RETURNING * INTO v_chart;
  RETURN v_chart;
END;
$$;

-- copy_linked_chart ---------------------------------------------------------------
-- "Copy ‹band›'s chart" on a linked copy whose chart is empty: the same snapshot
-- copy_band_songs_to_personal takes. Keeps the copy's starting note if it has one.
CREATE OR REPLACE FUNCTION public.copy_linked_chart(p_song_id UUID)
RETURNS public.song_charts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song  public.songs := public._require_song(p_song_id);
  v_src   public.song_charts;
  v_chart public.song_charts;
BEGIN
  IF v_song.linked_from_song_id IS NULL
     OR NOT public.can_access_song(v_song.linked_from_song_id, auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  SELECT * INTO v_src FROM public.song_charts
   WHERE song_id = v_song.linked_from_song_id AND chordpro <> '';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'The band''s song has no chart.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.song_charts
              WHERE song_id = p_song_id AND chordpro <> '') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'chart_exists',
      HINT = 'This song already has a chart.';
  END IF;

  INSERT INTO public.song_charts (song_id, chordpro, starting_note, last_modified_by)
  VALUES (p_song_id, v_src.chordpro, v_src.starting_note, auth.uid())
  ON CONFLICT (song_id) DO UPDATE
    SET chordpro = EXCLUDED.chordpro,
        starting_note = COALESCE(public.song_charts.starting_note, EXCLUDED.starting_note),
        version = public.song_charts.version + 1,
        updated_date = NOW(),
        last_modified_by = auth.uid()
  RETURNING * INTO v_chart;
  RETURN v_chart;
END;
$$;

-- duplicate_song (phase 2 + the chart) ----------------------------------------------
-- Copies facts, links and chart (not notes) into the same context as "‹title› (copy)".
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

  INSERT INTO public.song_charts (song_id, chordpro, starting_note, last_modified_by)
  SELECT v_copy.id, c.chordpro, c.starting_note, auth.uid()
    FROM public.song_charts c
   WHERE c.song_id = p_song_id;

  RETURN v_copy;
END;
$$;

-- copy_band_songs_to_personal (phase 2 + the chart, decision 2) ---------------------
-- NULL = all of them. Never band → band; already-linked songs are skipped. Each new
-- copy gets a snapshot of its band song's chart; after that the two are separate.
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
  WITH copies AS (
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
    RETURNING *
  ), charts AS (
    INSERT INTO public.song_charts (song_id, chordpro, starting_note, last_modified_by)
    SELECT c.id, sc.chordpro, sc.starting_note, auth.uid()
      FROM copies c
      JOIN public.song_charts sc ON sc.song_id = c.linked_from_song_id
    RETURNING song_id
  )
  SELECT * FROM copies;
END;
$$;

-- Tunings: extended-range built-ins + colours (decision 15) --------------------------
INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin) VALUES
  ('guitar', 7, '{33,40,45,50,55,59,64}', '7-string Drop A',      'drop-a-7',            true),
  ('guitar', 7, '{33,38,43,48,53,57,62}', '7-string A Standard',  'a-standard-7',        true),
  ('guitar', 7, '{32,39,44,49,54,58,63}', '7-string Drop G#',     'drop-g-sharp-7',      true),
  ('guitar', 6, '{35,40,45,50,54,59}',    'Baritone B Standard',  'b-standard-baritone', true)
ON CONFLICT (slug) DO NOTHING;

-- Each takes the colour of the 6-string tuning with the same shape relative to its
-- own standard. Baritone B Standard has no same-shape match: no colour (grey).
UPDATE public.tunings SET color = '#60a5fa'   -- Standard
 WHERE is_builtin AND slug IN ('standard-7', 'standard-8', 'bass-standard', 'bass-5', 'bass-6');
UPDATE public.tunings SET color = '#84cc16'   -- Drop D
 WHERE is_builtin AND slug IN ('drop-a-7', 'bass-drop-d');
UPDATE public.tunings SET color = '#f59e0b'   -- Drop Db (½ step down + drop)
 WHERE is_builtin AND slug = 'drop-g-sharp-7';
UPDATE public.tunings SET color = '#0ea5e9'   -- Whole-step down
 WHERE is_builtin AND slug = 'a-standard-7';
UPDATE public.tunings SET color = '#14b8a6'   -- Half-step down
 WHERE is_builtin AND slug = 'bass-eb';

-- Tunings: one custom per pitch set per context -------------------------------------
-- Merge any existing duplicates first (songs move to the oldest), then the index.
DO $$
BEGIN
  CREATE TEMP TABLE _tuning_dupes ON COMMIT DROP AS
  SELECT id, keep_id FROM (
    SELECT id,
           first_value(id) OVER (
             PARTITION BY context_type, context_id, instrument, string_count, pitches
             ORDER BY created_date, id) AS keep_id
      FROM public.tunings
     WHERE NOT is_builtin
  ) r
  WHERE id <> keep_id;

  UPDATE public.songs s SET tuning_id = d.keep_id
    FROM _tuning_dupes d WHERE s.tuning_id = d.id;
  DELETE FROM public.tunings t USING _tuning_dupes d WHERE t.id = d.id;
  DROP TABLE _tuning_dupes;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tunings_unique_pitches
  ON public.tunings (context_type, context_id, instrument, string_count, pitches)
  WHERE NOT is_builtin;

-- Tunings: shared checks for create / update ----------------------------------------
-- Standard per instrument and string count (decision 6: guitar 6/7/8, bass 4/5/6).
CREATE OR REPLACE FUNCTION public._standard_tuning(p_instrument TEXT, p_string_count INT)
RETURNS SMALLINT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_instrument = 'guitar' AND p_string_count = 6 THEN '{40,45,50,55,59,64}'
    WHEN p_instrument = 'guitar' AND p_string_count = 7 THEN '{35,40,45,50,55,59,64}'
    WHEN p_instrument = 'guitar' AND p_string_count = 8 THEN '{30,35,40,45,50,55,59,64}'
    WHEN p_instrument = 'bass'   AND p_string_count = 4 THEN '{28,33,38,43}'
    WHEN p_instrument = 'bass'   AND p_string_count = 5 THEN '{23,28,33,38,43}'
    WHEN p_instrument = 'bass'   AND p_string_count = 6 THEN '{23,28,33,38,43,48}'
  END::smallint[];
$$;

-- Raises the tuning errors; returns the trimmed name.
CREATE OR REPLACE FUNCTION public._check_tuning(
  p_name         TEXT,
  p_instrument   TEXT,
  p_string_count INT,
  p_pitches      SMALLINT[],
  p_context_type TEXT,
  p_context_id   TEXT,
  p_self         UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_std  SMALLINT[] := public._standard_tuning(p_instrument, p_string_count);
  v_dupe TEXT;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'name_required',
      HINT = 'Give the tuning a name.';
  END IF;
  IF v_std IS NULL OR p_pitches IS NULL
     OR cardinality(p_pitches) <> cardinality(v_std)
     OR EXISTS (
       SELECT 1 FROM unnest(p_pitches, v_std) AS x(p, s)
        WHERE x.p IS NULL OR x.p - x.s < -12 OR x.p - x.s > 7) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_pitches',
      HINT = 'Each string can go an octave down or 7 half steps up from standard.';
  END IF;

  SELECT t.name INTO v_dupe
    FROM public.tunings t
   WHERE t.instrument = p_instrument
     AND t.string_count = p_string_count
     AND t.pitches = p_pitches
     AND (t.is_builtin
          OR (t.context_type = p_context_type AND t.context_id = p_context_id))
     AND t.id IS DISTINCT FROM p_self
   ORDER BY t.is_builtin DESC
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'duplicate_tuning',
      HINT = format('That''s %s. It''s already in your tunings.', v_dupe);
  END IF;
  RETURN v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public._can_use_context(p_context_type TEXT, p_context_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    (p_context_type = 'personal' AND p_context_id = auth.uid()::text)
    OR (p_context_type = 'band'
        AND p_context_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.is_band_member(p_context_id::uuid, auth.uid()))
  );
$$;

-- create_tuning -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tuning(
  p_name         TEXT,
  p_instrument   TEXT,
  p_string_count INT,
  p_pitches      SMALLINT[],
  p_context_type TEXT,
  p_context_id   TEXT,
  p_color        TEXT DEFAULT NULL
)
RETURNS public.tunings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name   TEXT;
  v_tuning public.tunings;
BEGIN
  IF NOT public._can_use_context(p_context_type, p_context_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  v_name := public._check_tuning(p_name, p_instrument, p_string_count, p_pitches,
                                 p_context_type, p_context_id, NULL);
  BEGIN
    INSERT INTO public.tunings (
      instrument, string_count, pitches, name, is_builtin, color,
      context_type, context_id, created_by, last_modified_by
    ) VALUES (
      p_instrument, p_string_count, p_pitches, v_name, false, p_color,
      p_context_type, p_context_id, auth.uid(), auth.uid()
    ) RETURNING * INTO v_tuning;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'duplicate_tuning',
      HINT = 'That tuning is already in your tunings.';
  END;
  RETURN v_tuning;
END;
$$;

-- update_tuning -------------------------------------------------------------------
-- Name, strings and colour (NULL colour = automatic). Instrument, string count and
-- owner stay. Built-ins are read-only.
CREATE OR REPLACE FUNCTION public.update_tuning(
  p_tuning_id        UUID,
  p_name             TEXT,
  p_pitches          SMALLINT[],
  p_color            TEXT DEFAULT NULL,
  p_expected_version INT DEFAULT NULL
)
RETURNS public.tunings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old    public.tunings;
  v_name   TEXT;
  v_tuning public.tunings;
BEGIN
  SELECT * INTO v_old FROM public.tunings WHERE id = p_tuning_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This tuning was deleted.';
  END IF;
  IF v_old.is_builtin OR NOT public._can_use_context(v_old.context_type, v_old.context_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  IF p_expected_version IS NOT NULL AND v_old.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stale_version',
      HINT = 'Someone just changed this. Showing the latest.';
  END IF;
  v_name := public._check_tuning(p_name, v_old.instrument, v_old.string_count, p_pitches,
                                 v_old.context_type, v_old.context_id, v_old.id);
  BEGIN
    UPDATE public.tunings
       SET name = v_name,
           pitches = p_pitches,
           color = p_color,
           version = version + 1,
           updated_date = NOW(),
           last_modified_by = auth.uid()
     WHERE id = p_tuning_id
    RETURNING * INTO v_tuning;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'duplicate_tuning',
      HINT = 'That tuning is already in your tunings.';
  END;
  RETURN v_tuning;
END;
$$;

-- Grants --------------------------------------------------------------------------
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_chart(uuid)',
    'public.save_chart(uuid, text, integer)',
    'public.set_starting_note(uuid, smallint)',
    'public.copy_linked_chart(uuid)',
    'public.duplicate_song(uuid)',
    'public.copy_band_songs_to_personal(uuid[])',
    'public.create_tuning(text, text, integer, smallint[], text, text, text)',
    'public.update_tuning(uuid, text, smallint[], text, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public._standard_tuning(text, integer)',
    'public._check_tuning(text, text, integer, smallint[], text, text, uuid)',
    'public._can_use_context(text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
