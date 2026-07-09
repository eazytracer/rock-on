-- ─────────────────────────────────────────────────────────────────────────────
-- 0.4 event-ops patch — pre-raise hand on song request (EC4 #6)
--
-- A guest requesting a song may optionally offer to play one or more parts
-- ("I'd play" chips). We store those on the request; when a host APPROVES the
-- request, the existing promote trigger (which creates the lineup item) now also
-- raises a hand for the requester on each offered part against the new item.
--
-- Idempotent — safe to re-run via `supabase db reset`.
-- Feature: .claude/completed/0.4-small-patch/SUMMARY.md ("Request to play")
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Requests carry the offered parts. (No new table → existing GRANTs on
--    event_lineup_requests cover this column.)
ALTER TABLE public.event_lineup_requests
  ADD COLUMN IF NOT EXISTS parts TEXT[];

-- 1b. Per-lineup-item tuning + key overrides — a host can set a tuning/key for a
--     song in the event lineup, independent of the catalog song. Both optional.
--     (No new table → existing GRANTs on event_lineup_items cover these columns.)
ALTER TABLE public.event_lineup_items
  ADD COLUMN IF NOT EXISTS tuning TEXT;
ALTER TABLE public.event_lineup_items
  ADD COLUMN IF NOT EXISTS key TEXT;

-- 2. Extend the approve→promote trigger to pre-raise the requester's hands.
--    Behavior unchanged except for the new event_hands inserts. The existing
--    BEFORE INSERT auto-approve trigger on event_hands still applies (a raised
--    hand lands 'accepted' when the event auto-approves).
CREATE OR REPLACE FUNCTION public.on_event_request_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_item_id   UUID;
  next_pos      INTEGER;
  requester_nm  TEXT;
  part          TEXT;
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

    -- Pre-raise a hand for the requester on each offered part.
    IF NEW.parts IS NOT NULL AND array_length(NEW.parts, 1) IS NOT NULL THEN
      SELECT name INTO requester_nm FROM public.users WHERE id = NEW.requester_id;
      FOREACH part IN ARRAY NEW.parts LOOP
        IF part IS NULL OR btrim(part) = '' THEN
          CONTINUE;
        END IF;
        INSERT INTO public.event_hands
          (event_id, event_lineup_item_id, role_key, user_id, user_name, status)
        VALUES
          (NEW.event_id, new_item_id, part, NEW.requester_id, requester_nm, 'raised')
        ON CONFLICT (event_lineup_item_id, role_key, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger binding is unchanged (BEFORE UPDATE); re-assert idempotently.
DROP TRIGGER IF EXISTS trg_event_request_approved ON public.event_lineup_requests;
CREATE TRIGGER trg_event_request_approved
  BEFORE UPDATE ON public.event_lineup_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_event_request_approved();

-- 3. Co-hosts (EC4 #1, v0.4.2). A host may promote a participant to 'cohost'
--    (which grants cast + approve-request writes via is_event_manager, host +
--    cohost). But co-hosts must NOT be able to ALTER the event itself, so the
--    events UPDATE policy is narrowed from is_event_manager → host-only. Delete
--    was already host-only (events_delete_host); casting/lineup/request writes
--    stay manager-scoped so co-hosts keep those abilities.
DROP POLICY IF EXISTS "events_update_manager" ON public.events;
DROP POLICY IF EXISTS "events_update_host" ON public.events;
CREATE POLICY "events_update_host" ON public.events FOR UPDATE TO authenticated
  USING (host_user_id = (select auth.uid()))
  WITH CHECK (host_user_id = (select auth.uid()));

-- 4. Release note for 0.4.3 — surfaced in-app as "what's new" (the notifications
--    feed compares release_notes against users.last_seen_release_version).
--    Idempotent upsert so `db reset` / re-push is safe.
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.4.3',
  'Co-hosts + smarter event lineups',
  $md$Fresh in this update:

- **Co-hosts** — promote a friend to co-host from an event's People tab. Co-hosts can cast and approve song requests; only you (the host) can edit or cancel the event.
- **Tuning & key per song** — set a tuning and key on any song in your event lineup.
- **Request to play** — when someone requests a song they can raise their hand for a part; approving it puts the song on the lineup with their hand already up.
- **Faster lineups** — add songs directly, drag to reorder, edit or remove, and manage who's in the event.
- **Guests can raise hands in the grid**, and the songs you're cast on are highlighted so you can see what's next for you.
- **Home** now shows your upcoming events.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
