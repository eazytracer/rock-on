-- ============================================================================
-- Redesign phase 3 · Setlists (0.10.0). docs/redesign/10 Part 2, design/OPERATIONS §9.
--   setlist_index      the index's cards: show line, songs in order (for counts,
--                      minutes, retunes and the first titles), break minutes.
--   duplicate_setlist  a copy, not attached to a show.
-- Both run as the caller (SECURITY INVOKER): RLS on setlists, songs and shows
-- decides what is visible. Idempotent + additive.
-- ============================================================================

-- setlist_index -------------------------------------------------------------------
-- One row per setlist in a context. The show is the soonest upcoming one using
-- the set (shows.setlist_id, or setlists.show_id), else the latest past one.
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
  songs         JSONB,
  break_minutes INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT sl.id, sl.name, sl.last_modified,
         sh.id, sh.name, sh.venue, sh.scheduled_date,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
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
      SELECT x.id, x.name, x.venue, x.scheduled_date
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
