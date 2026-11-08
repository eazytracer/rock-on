-- ============================================================================
-- Redesign phase 2.1 · Song page (0.9.1)
-- ----------------------------------------------------------------------------
-- docs/redesign/10 · 1.4: the song page edits a set's per-song note ("In ‹set›",
-- the setlist item's `notes`) on its own. Setlist items live in one JSONB array,
-- so writing the whole array back from the song page would drop a bandmate's
-- concurrent change; set_setlist_item_note rewrites just that item, atomically.
-- Runs as the caller (SECURITY INVOKER): the setlists RLS policies decide who
-- may write. Facts save through the existing songs update (with version).
-- Idempotent + additive.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_setlist_item_note(
  p_setlist_id UUID,
  p_item_id    TEXT,
  p_notes      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  UPDATE public.setlists s
     SET items = (
           SELECT jsonb_agg(
                    CASE WHEN it->>'id' = p_item_id
                         THEN it || jsonb_build_object('notes', NULLIF(p_notes, ''))
                         ELSE it END
                    ORDER BY ord)
             FROM jsonb_array_elements(s.items) WITH ORDINALITY AS e(it, ord)
         ),
         last_modified = NOW(),
         last_modified_by = auth.uid()
   WHERE s.id = p_setlist_id
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(s.items) it WHERE it->>'id' = p_item_id
     )
  RETURNING TRUE INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'This song is no longer in that setlist.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_setlist_item_note(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_setlist_item_note(uuid, text, text) TO authenticated, service_role;

-- Release notes ---------------------------------------------------------------
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.9.1',
  'Open a song as a page',
  $md$Edit everything about a song in one place. Back takes you to where you came from.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
