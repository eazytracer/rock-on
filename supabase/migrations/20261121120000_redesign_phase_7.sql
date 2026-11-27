-- ============================================================================
-- Redesign phase 7: Jam on the Events tables (decisions: docs/DECISIONS.md →
-- "Jam (Phase 7)"; plan: docs/redesign/11-jam.md Part 3 + the Nov 20 decisions)
--
-- Parts
--   A part is a JSONB object {"key": k, "label"?: text}. k is one of vox,
--   guitar, bass, drums, keys, other; label is optional (≤ 30), e.g. a custom
--   Harmonica = {"key":"other","label":"Harmonica"}. A part's identity is key +
--   lower(label). Lists of parts are JSONB arrays:
--     events.default_parts            the host's starting parts (one per slot)
--     event_lineup_items.parts_needed one element per slot; duplicates are
--                                     slots ("Guitar 2" = a second {"key":"guitar"})
--     event_participants.parts        what a person plays (no duplicates)
--   Hands store the part as event_hands.role_key + role_label. Accepted hands
--   fill a part's slots in acceptance order; casting a part whose slots are all
--   taken adds a slot. Inputs also accept plain strings ("bass").
--
-- Schema
--   events               status 'live'; who_can_join invite|friends|code
--                        (default code; codes only work in code); requests_visible;
--                        group_size 0–5; joining_locked; default_parts. Every
--                        event has a short_code (needed for the realtime topic).
--                        visibility is left alone and unused by new code.
--   event_participants   user_id nullable (guests); guest_name ≤ 40; via
--                        app|web|walkup|kiosk; is_house; parts; share_songs;
--                        invited_by. rsvp 'pending' = invited, not joined yet;
--                        joining = 'going' (no RSVP work, D14).
--   event_lineup_items   state pending|open|queued|stage|played|left|removed
--                        (one stage per jam); parts_needed (from the jam's
--                        default_parts when not given); pitched_by; group_id;
--                        called_at; queue_position (order of the queue; up next =
--                        first queued, never stored).
--   event_hands          participant_id (filled from user_id for the legacy
--                        pages); role_label; user_id nullable; one hand per
--                        person per part.
--   event_guest_tokens   NEW. sha256 of guest / kiosk tokens only.
--   event_kiosk_pairings NEW. sha256 of one-time 6-char pairing codes (10 min).
--   jam_rate_limits      NEW. Fixed-window counters per bucket + key.
--   songs.tags           TEXT[] (+ GIN). Jam songs = personal songs tagged 'jam'.
--   normalize_text       also drops bracketed extras ("(Live)", "[Remastered]");
--                        songs.normalized_* recomputed.
--   0.3 jam sessions     co-participant policies dropped; join_jam_session,
--                        get_jam_session_by_code, replace_jam_matches revoked.
--                        Tables stay (a later release drops them).
--   anon                 may execute only the functions marked "Anon:" below.
--
-- Errors: RAISE … MESSAGE = key, HINT = copy (see _jam_copy for every key's copy).
-- Live updates: AFTER triggers on events / event_participants /
-- event_lineup_items / event_hands send one broadcast per transaction:
-- realtime.send({at}, 'changed', 'jam:<short_code>', private = false). Clients
-- listen to `jam:<short_code>` and refetch jam_state; ask_the_room sends
-- event 'nudge' {item_id, part, title} on the same topic.
-- Rate limits: per token / participant and per IP. IP = cf-connecting-ip, else
-- x-real-ip, else the LAST hop of x-forwarded-for ('unknown' when none). Never
-- the first XFF hop: local Kong keeps a client-sent X-Forwarded-For in front
-- ("203.0.113.9, 172.21.0.1"), so it's spoofable; x-real-ip is the peer Kong
-- saw. Verify on the hosted gateway before relying on per-IP limits. A call
-- that raises rolls its own hit back, so the code-taking anon functions
-- (jam_preview_by_code, join_jam_as_web_guest, jam_tv_feed, pair_kiosk,
-- resolve_code) never raise for a wrong or unusable code: they return a
-- refusal (a row / object with `error` = key and `hint` = copy, every other
-- field NULL), so a wrong guess counts. Any wrong code gives the same refusal.
-- Per IP, code-taking calls are capped generously (a bar's guests share one
-- Wi-Fi IP: 1000 lookups, 300 web-guest joins, 600 TV polls per 10 min); wrong
-- codes are capped strictly (30 per 10 min across preview / resolve / join / TV,
-- bucket 'code_miss'), and once over, the right code is refused too.
--
-- RPCs (SECURITY DEFINER; p_guest_token = a guest or kiosk token, NULL when
-- signed in). Returns → error keys:
--   create_jam(p_name, p_at, p_timezone?, p_where?, p_band_id?, p_who_can_join?, p_default_parts?)
--       → events                      name_required, forbidden, invalid_setting, invalid_parts
--   update_jam(p_event, p_patch {name, scheduled_date, timezone, venue, location, description, end_time}, p_expected_version)
--       → events  host               stale_version, name_required, not_found, forbidden
--   set_jam_settings(p_event, p_who_can_join?, p_requests_open?, p_approve_myself?, p_group_size?, p_requests_visible?, p_default_parts?)
--       → events  host               invalid_setting, invalid_parts
--   set_cohost(p_participant, p_on) → event_participants  host   needs_account, forbidden
--   delete_jam(p_event) → void  host, planned only; notifies joined people   not_planned
--   invite_to_jam(p_event, p_user_ids uuid[]) → setof event_participants (new invites)
--       host/co-hosts any mode; joined participants in friends/code modes;
--       invitees must be your friends (or bandmates for a band jam)   forbidden, not_friend, jam_ended
--   join_jam(p_code, p_parts?, p_share_songs?) → event_participants
--       no_jam, invite_only, jam_ended, not_taking_people, rate_limited
--   join_jam_by_id(p_event, p_parts?, p_share_songs?) → event_participants
--       invitees, and (friends mode) the host's friends / bandmates   forbidden, jam_ended, not_taking_people
--   list_my_jams() → table (section hosting|invited|friends, jam fields, my tier, joined, counts)
--   jam_preview_by_code(p_code) → table (event_id, name, status, when, where, host first name, people, is_participant, error, hint)
--       anon                          refusal row: no_jam, invite_only · raises: rate_limited
--   resolve_code(p_code) → table (kind 'band'|'jam'|NULL)  anon     rate_limited
--   join_jam_as_web_guest(p_code, p_name, p_parts?) → table (event_id, participant_id, token, error, hint)
--       anon; token returned once     refusal row: no_jam, invite_only, jam_ended, not_taking_people
--                                     raises (before the code is looked at): name_required, invalid_parts, rate_limited
--   update_me(p_event, p_name?, p_parts?, p_share_songs?, p_guest_token?) → event_participants
--       anon                          forbidden, jam_ended, name_required, invalid_parts
--   leave_jam(p_event, p_guest_token?) → void  anon            forbidden, host_cannot_leave
--   add_walkup(p_event, p_name, p_parts?, p_via 'walkup'|'kiosk', p_item?, p_pitch_title?, p_pitch_artist?, p_guest_token?)
--       → event_participants  host/co-host, or anon with a kiosk token
--       forbidden, jam_ended, invite_only, not_taking_people, name_required, invalid_parts, part_not_needed, requests_closed, title_*, rate_limited
--   add_lineup_songs(p_event, p_song_ids, p_parts_needed?) → setof event_lineup_items  host/co-host   not_found, jam_ended
--   add_lineup_title(p_event, p_title, p_artist?, p_parts_needed?) → event_lineup_items host/co-host title_required, title_too_long
--   set_item_parts(p_item, p_parts_needed) → event_lineup_items  host/co-host         invalid_parts
--   reorder_lineup(p_event, p_item_ids) → void  host/co-host
--   pitch_song(p_event, p_song_id?, p_title?, p_artist?, p_my_parts?, p_parts_needed?, p_group_id?, p_guest_token?)
--       → event_lineup_items ('pending' unless approval is off or a host pitches)
--       anon                          requests_closed, title_required, title_too_long, not_found, not_joined, jam_ended, rate_limited
--   approve_pitch(p_item) / decline_pitch(p_item) → event_lineup_items  host/co-host   not_pending
--   raise_hand(p_item, p_parts, p_guest_token?) → setof event_hands (yours on that song)
--       anon                          part_not_needed, invalid_parts, item_closed, not_joined, jam_ended, rate_limited
--   lower_hand(p_hand, p_guest_token?) → void  anon; own hands, hosts any   forbidden
--   set_cast(p_item, p_part, p_participant, p_on default true) → event_hands  host/co-host
--       puts anyone in the jam on a part (accepted hand; adds a slot when full); p_on false un-casts
--   jam_state(p_event, p_guest_token?) → jsonb   anon (guest or kiosk token)
--       {jam, me, people[], items[{…, slots[{key,label,nth,cast,raised,gap}], hands[], covered, total, rank, mine}],
--        stage, up_next, queue[]}
--   who_knows_your_songs(p_event, p_other?) → table (participant_id, name, common_count, common, only_mine, only_theirs)
--   go_live(p_event) → events  host/co-host; open lineup → the queue   not_planned
--   queue_pitch(p_item, p_position?) / move_queue_item(p_item, p_position) / make_up_next(p_item) → event_lineup_items
--   skip_up_next(p_event) → event_lineup_items (up next moves behind the next one)   not_live, invalid_state
--   call_up(p_item) → jsonb {called, previous}  previous stage → played   not_live, item_closed
--   set_queue_state(p_item, p_state open|queued|stage|played|left|removed, p_position?) → event_lineup_items
--       not_live, stage_busy, invalid_state
--   ask_the_room(p_item, p_part) → void  broadcast 'nudge'     not_live, part_not_needed
--   mark_house_player(p_participant, p_on) / remove_person(p_participant) / lock_joining(p_event, p_on)
--       host/co-host                  cannot_remove_host, forbidden
--   start_kiosk(p_event) → table (token, pairing_code, expires_at)  host/co-host   invite_only, jam_ended
--   pair_kiosk(p_pairing_code) → table (event_id, short_code, token, error, hint)  anon
--       refusal row: pairing_invalid · raises: rate_limited
--   end_jam(p_event) → events  host/co-host; guests, hands, tokens deleted   not_live
--   save_jam_as_setlist(p_event, p_context_type 'personal'|'band', p_context_id?) → setlists  host/co-host
--       nothing_played, forbidden
--   jam_tv_feed(p_code) → jsonb {jam, code, stage, up_next, group[], looking_for[]}, or {error, hint}  anon
--       refusal: no_jam, invite_only · raises: rate_limited
--   join_event_by_code (legacy pages) now refuses non-code, ended and locked jams.
--
-- release_notes: the redesign ships to production as one release, 1.0.0
-- (Phase 5 decision 3). Production last shipped 0.5.0, so the rows the earlier
-- redesign migrations added for 0.6.0–0.11.0 (never released) are removed and
-- one 1.0.0 entry replaces them.
-- Idempotent.
-- ============================================================================

-- ── 1. Columns ────────────────────────────────────────────────────────────────
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check
  CHECK (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'live'::text, 'completed'::text, 'cancelled'::text]));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS who_can_join TEXT NOT NULL DEFAULT 'code';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_who_can_join_check;
ALTER TABLE public.events ADD CONSTRAINT events_who_can_join_check
  CHECK (who_can_join IN ('invite', 'friends', 'code'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS requests_visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS group_size SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_group_size_check;
ALTER TABLE public.events ADD CONSTRAINT events_group_size_check CHECK (group_size BETWEEN 0 AND 5);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS joining_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS default_parts JSONB NOT NULL
  DEFAULT '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]'::jsonb;

ALTER TABLE public.event_participants ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS via TEXT NOT NULL DEFAULT 'app';
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS is_house BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS parts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS share_songs BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS invited_by UUID
  REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.event_participants DROP CONSTRAINT IF EXISTS event_participants_guest_name_check;
ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_guest_name_check
  CHECK (guest_name IS NULL OR char_length(guest_name) BETWEEN 1 AND 40);
ALTER TABLE public.event_participants DROP CONSTRAINT IF EXISTS event_participants_via_check;
ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_via_check
  CHECK (via IN ('app', 'web', 'walkup', 'kiosk'));
ALTER TABLE public.event_participants DROP CONSTRAINT IF EXISTS event_participants_who_check;
ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_who_check
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL);

ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.event_lineup_items DROP CONSTRAINT IF EXISTS event_lineup_items_state_check;
ALTER TABLE public.event_lineup_items ADD CONSTRAINT event_lineup_items_state_check
  CHECK (state IN ('pending', 'open', 'queued', 'stage', 'played', 'left', 'removed'));
ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS parts_needed JSONB NOT NULL
  DEFAULT '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]'::jsonb;
-- New rows take the jam's default_parts (trigger below), not a fixed default.
ALTER TABLE public.event_lineup_items ALTER COLUMN parts_needed DROP DEFAULT;
ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS pitched_by UUID
  REFERENCES public.event_participants(id) ON DELETE SET NULL;
ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ;
ALTER TABLE public.event_lineup_items ADD COLUMN IF NOT EXISTS queue_position INT;
CREATE UNIQUE INDEX IF NOT EXISTS event_lineup_items_one_stage
  ON public.event_lineup_items (event_id) WHERE state = 'stage';

ALTER TABLE public.event_hands ADD COLUMN IF NOT EXISTS participant_id UUID
  REFERENCES public.event_participants(id) ON DELETE CASCADE;
ALTER TABLE public.event_hands ADD COLUMN IF NOT EXISTS role_label TEXT;
ALTER TABLE public.event_hands ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.event_hands DROP CONSTRAINT IF EXISTS event_hands_who_check;
ALTER TABLE public.event_hands ADD CONSTRAINT event_hands_who_check
  CHECK (user_id IS NOT NULL OR participant_id IS NOT NULL);
UPDATE public.event_hands h SET participant_id = p.id
  FROM public.event_participants p
 WHERE h.participant_id IS NULL AND p.event_id = h.event_id AND p.user_id = h.user_id;
-- One hand per person per part (the legacy per-user key would block two custom parts).
ALTER TABLE public.event_hands DROP CONSTRAINT IF EXISTS event_hands_event_lineup_item_id_role_key_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS event_hands_one_per_part
  ON public.event_hands (event_lineup_item_id, role_key, lower(COALESCE(role_label, '')), participant_id);
CREATE INDEX IF NOT EXISTS idx_event_hands_participant ON public.event_hands (participant_id);

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_songs_tags ON public.songs USING GIN (tags);

-- ── 2. New tables (functions only: RLS on, no policies) ───────────────────────
CREATE TABLE IF NOT EXISTS public.event_guest_tokens (
  token_hash     BYTEA PRIMARY KEY,
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.event_participants(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL DEFAULT 'guest' CHECK (kind IN ('guest', 'kiosk')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  CONSTRAINT event_guest_tokens_participant_check CHECK ((kind = 'guest') = (participant_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_event_guest_tokens_event ON public.event_guest_tokens (event_id);
CREATE INDEX IF NOT EXISTS idx_event_guest_tokens_participant ON public.event_guest_tokens (participant_id);

CREATE TABLE IF NOT EXISTS public.event_kiosk_pairings (
  code_hash  BYTEA PRIMARY KEY,
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_kiosk_pairings_event ON public.event_kiosk_pairings (event_id);

CREATE TABLE IF NOT EXISTS public.jam_rate_limits (
  bucket       TEXT NOT NULL,
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
);

ALTER TABLE public.event_guest_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_kiosk_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_guest_tokens, public.event_kiosk_pairings, public.jam_rate_limits FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_guest_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_guest_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_kiosk_pairings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_kiosk_pairings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_rate_limits TO service_role;

-- ── 3. Song matching ──────────────────────────────────────────────────────────
-- Lowercase; drop bracketed extras ("(Live)", "[Remastered]"), punctuation and
-- apostrophes; squash spaces; drop a leading "the" / "a" / "an".
CREATE OR REPLACE FUNCTION public.normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT regexp_replace(
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(input), '[\(\[][^\)\]]*[\)\]]', ' ', 'g'),
        '[^a-z0-9\s]', '', 'g'),
      '\s+', ' ', 'g')),
    '^(the|a|an) ', '');
$$;

-- Recompute the stored generated columns, without touching versions or audit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.songs
              WHERE normalized_title IS DISTINCT FROM public.normalize_text(title)
                 OR normalized_artist IS DISTINCT FROM public.normalize_text(COALESCE(artist, ''))) THEN
    ALTER TABLE public.songs DISABLE TRIGGER USER;
    UPDATE public.songs SET title = title, artist = artist
     WHERE normalized_title IS DISTINCT FROM public.normalize_text(title)
        OR normalized_artist IS DISTINCT FROM public.normalize_text(COALESCE(artist, ''));
    ALTER TABLE public.songs ENABLE TRIGGER USER;
  END IF;
END $$;

-- ── 4. Codes: one /j/:code space shared with band invites ─────────────────────
-- 8 random characters without look-alikes, never an event's or a band invite's.
CREATE OR REPLACE FUNCTION public._random_code(p_len INT)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' ORDER BY i)
    FROM (SELECT extensions.gen_random_bytes(p_len) AS b) x, generate_series(0, p_len - 1) i;
$$;

CREATE OR REPLACE FUNCTION public.gen_event_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := public._random_code(8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE short_code = v_code)
          AND NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public._new_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := public.gen_friend_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE code = v_code)
          AND NOT EXISTS (SELECT 1 FROM public.events WHERE short_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Every event gets a code (it names the realtime topic); codes still only
-- join 'code' jams.
CREATE OR REPLACE FUNCTION public.set_event_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.gen_event_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Events that had no code (private) were invite only in practice.
DO $$
DECLARE r RECORD;
BEGIN
  UPDATE public.events SET who_can_join = 'invite'
   WHERE short_code IS NULL AND who_can_join = 'code';
  FOR r IN SELECT id FROM public.events WHERE short_code IS NULL LOOP
    UPDATE public.events SET short_code = public.gen_event_code() WHERE id = r.id;
  END LOOP;
END $$;

-- "ABCD-EFGH", "abcd efgh", "abcdefgh" → "ABCDEFGH".
CREATE OR REPLACE FUNCTION public._jam_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ── 5. Helpers ────────────────────────────────────────────────────────────────
-- Every jam error's copy. Keys never change.
CREATE OR REPLACE FUNCTION public._jam_copy(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_key
    WHEN 'forbidden'         THEN 'You don''t have access to this.'
    WHEN 'not_found'         THEN 'That isn''t here any more.'
    WHEN 'stale_version'     THEN 'Someone else changed this jam. Here''s the latest.'
    WHEN 'no_jam'            THEN 'No jam with that code. Check the letters, or ask the host.'
    WHEN 'invite_only'       THEN 'This jam is invite only.'
    WHEN 'jam_ended'         THEN 'This jam has ended. Thanks for playing.'
    WHEN 'not_taking_people' THEN 'This jam isn''t taking new people right now.'
    WHEN 'name_required'     THEN 'Add a name (up to 40 characters).'
    WHEN 'rate_limited'      THEN 'Too many tries. Wait a few minutes and try again.'
    WHEN 'requests_closed'   THEN 'Song requests are closed right now.'
    WHEN 'title_required'    THEN 'Add a song title.'
    WHEN 'title_too_long'    THEN 'Titles and artists are up to 80 characters.'
    WHEN 'invalid_parts'     THEN 'Pick parts from the list.'
    WHEN 'part_not_needed'   THEN 'That song doesn''t need that part.'
    WHEN 'not_joined'        THEN 'Join the jam first.'
    WHEN 'not_pending'       THEN 'That request was already handled.'
    WHEN 'not_planned'       THEN 'Only a planned jam can do that.'
    WHEN 'not_live'          THEN 'The jam isn''t live.'
    WHEN 'stage_busy'        THEN 'Someone''s already on stage.'
    WHEN 'item_closed'       THEN 'That song is done for tonight.'
    WHEN 'invalid_state'     THEN 'That can''t happen to this song.'
    WHEN 'invalid_setting'   THEN 'That setting isn''t valid.'
    WHEN 'needs_account'     THEN 'Only people on the app can do that.'
    WHEN 'cannot_remove_host' THEN 'The host can''t be removed.'
    WHEN 'host_cannot_leave' THEN 'You''re the host. Delete or end the jam instead.'
    WHEN 'not_friend'        THEN 'You can only invite your friends.'
    WHEN 'pairing_invalid'   THEN 'That pairing code isn''t valid. Get a new one from the host.'
    WHEN 'nothing_played'    THEN 'No songs were played.'
    ELSE p_key END;
$$;

CREATE OR REPLACE FUNCTION public._jam_fail(p_key TEXT, p_hint TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_key, HINT = COALESCE(p_hint, public._jam_copy(p_key));
END;
$$;

CREATE OR REPLACE FUNCTION public._part_id(p_key TEXT, p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_key, '') || ':' || lower(COALESCE(btrim(p_label), ''));
$$;

-- A parts list as sent → the stored shape, or invalid_parts. NULL stays NULL.
CREATE OR REPLACE FUNCTION public._jam_parts(p_parts JSONB, p_unique BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out   JSONB := '[]'::jsonb;
  v_el    JSONB;
  v_key   TEXT;
  v_label TEXT;
  v_seen  TEXT[] := '{}';
BEGIN
  IF p_parts IS NULL OR jsonb_typeof(p_parts) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_parts) <> 'array' OR jsonb_array_length(p_parts) > 12 THEN
    PERFORM public._jam_fail('invalid_parts');
  END IF;
  FOR v_el IN SELECT value FROM jsonb_array_elements(p_parts) LOOP
    IF jsonb_typeof(v_el) = 'string' THEN
      v_key := lower(btrim(v_el #>> '{}'));
      v_label := NULL;
    ELSIF jsonb_typeof(v_el) = 'object' THEN
      v_key := lower(btrim(COALESCE(v_el->>'key', '')));
      v_label := NULLIF(btrim(COALESCE(v_el->>'label', '')), '');
    ELSE
      PERFORM public._jam_fail('invalid_parts');
    END IF;
    IF v_key NOT IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other')
       OR char_length(COALESCE(v_label, '')) > 30 THEN
      PERFORM public._jam_fail('invalid_parts');
    END IF;
    IF p_unique AND public._part_id(v_key, v_label) = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || public._part_id(v_key, v_label);
    v_out := v_out || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('key', v_key, 'label', v_label)));
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_has_part(p_parts JSONB, p_key TEXT, p_label TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) n
                  WHERE public._part_id(n->>'key', n->>'label') = public._part_id(p_key, p_label));
$$;

-- What a person is called: a guest's first name, else the profile name.
CREATE OR REPLACE FUNCTION public._jam_name(p_guest_name TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_guest_name,
                  (SELECT COALESCE(NULLIF(btrim(up.display_name), ''), u.name)
                     FROM public.users u
                     LEFT JOIN public.user_profiles up ON up.user_id = u.id
                    WHERE u.id = p_user_id),
                  'Someone');
$$;

CREATE OR REPLACE FUNCTION public._jam_hash(p_token TEXT)
RETURNS BYTEA
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT extensions.digest(COALESCE(p_token, ''), 'sha256');
$$;

-- 32 random bytes, base64url. Only its hash is ever stored.
CREATE OR REPLACE FUNCTION public._jam_new_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

CREATE OR REPLACE FUNCTION public._jam_ip()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(h->>'cf-connecting-ip'), ''),
                  NULLIF(btrim(h->>'x-real-ip'), ''),
                  NULLIF(btrim(regexp_replace(COALESCE(h->>'x-forwarded-for', ''), '^.*,', '')), ''),
                  'unknown')
    FROM (SELECT COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::json AS h) x;
$$;

-- One more hit in this window for (bucket, key); rate_limited past p_max.
CREATE OR REPLACE FUNCTION public._jam_rate_check(p_bucket TEXT, p_key TEXT, p_max INT, p_window INTERVAL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secs  DOUBLE PRECISION := extract(epoch FROM p_window);
  v_start TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / v_secs) * v_secs);
  v_key   TEXT := COALESCE(p_key, 'unknown');
  v_hits  INT;
BEGIN
  DELETE FROM public.jam_rate_limits
   WHERE bucket = p_bucket AND key = v_key AND window_start < v_start;
  INSERT INTO public.jam_rate_limits (bucket, key, window_start, hits)
  VALUES (p_bucket, v_key, v_start, 1)
  ON CONFLICT (bucket, key, window_start) DO UPDATE SET hits = public.jam_rate_limits.hits + 1
  RETURNING hits INTO v_hits;
  IF v_hits > p_max THEN
    PERFORM public._jam_fail('rate_limited');
  END IF;
END;
$$;

-- Code-taking calls: a generous per-IP cap on all calls (a bar's guests share
-- one Wi-Fi IP), plus a strict cap on wrong codes, which is what guessing
-- looks like. Misses are noted without raising, so the hit commits.
CREATE OR REPLACE FUNCTION public._jam_code_gate(p_bucket TEXT, p_max INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip TEXT := COALESCE(public._jam_ip(), 'unknown');
BEGIN
  PERFORM public._jam_rate_check(p_bucket, v_ip, p_max, interval '10 minutes');
  IF COALESCE((SELECT hits FROM public.jam_rate_limits
                WHERE bucket = 'code_miss' AND key = v_ip
                  AND window_start = to_timestamp(floor(extract(epoch FROM now()) / 600) * 600)), 0) >= 30 THEN
    PERFORM public._jam_fail('rate_limited');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_code_miss()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._jam_rate_check('code_miss', public._jam_ip(), 2147483647, interval '10 minutes');
$$;

CREATE OR REPLACE FUNCTION public._jam_event(p_event UUID, p_lock BOOLEAN DEFAULT false)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events;
BEGIN
  IF p_lock THEN
    SELECT * INTO v_e FROM public.events WHERE id = p_event FOR UPDATE;
  ELSE
    SELECT * INTO v_e FROM public.events WHERE id = p_event;
  END IF;
  IF v_e.id IS NULL THEN
    PERFORM public._jam_fail('not_found');
  END IF;
  RETURN v_e;
END;
$$;

-- The jam, for its host or a co-host (locked for writes).
CREATE OR REPLACE FUNCTION public._jam_manager(p_event UUID, p_lock BOOLEAN DEFAULT true)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_e   public.events := public._jam_event(p_event, p_lock);
BEGIN
  IF NOT public.is_event_manager(v_e.id, v_uid) THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  RETURN v_e;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_host(p_event UUID, p_lock BOOLEAN DEFAULT true)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_e   public.events := public._jam_event(p_event, p_lock);
BEGIN
  IF v_e.host_user_id IS DISTINCT FROM v_uid THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  RETURN v_e;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_check_open(p_e public.events)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_e.status IN ('completed', 'cancelled') THEN
    PERFORM public._jam_fail('jam_ended');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_check_live(p_e public.events)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_e.status <> 'live' THEN
    PERFORM public._jam_fail('not_live');
  END IF;
END;
$$;

-- The caller as a participant of this jam: a live guest token for it, or the
-- signed-in user's row. Anything else → forbidden. Every anon function that
-- acts as a person starts here.
CREATE OR REPLACE FUNCTION public._jam_actor(p_event UUID, p_guest_token TEXT)
RETURNS public.event_participants
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.event_participants;
BEGIN
  IF p_guest_token IS NOT NULL THEN
    SELECT p.* INTO v_p
      FROM public.event_guest_tokens t
      JOIN public.event_participants p ON p.id = t.participant_id
      JOIN public.events e ON e.id = t.event_id
     WHERE t.token_hash = public._jam_hash(p_guest_token)
       AND t.kind = 'guest' AND t.revoked_at IS NULL
       AND t.event_id = p_event AND p.event_id = p_event
       AND e.status NOT IN ('completed', 'cancelled');
  ELSIF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_p FROM public.event_participants
     WHERE event_id = p_event AND user_id = auth.uid();
  END IF;
  IF v_p.id IS NULL THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  RETURN v_p;
END;
$$;

-- A live kiosk token for this jam?
CREATE OR REPLACE FUNCTION public._jam_kiosk_ok(p_event UUID, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_guest_tokens t
      JOIN public.events e ON e.id = t.event_id
     WHERE t.token_hash = public._jam_hash(p_token)
       AND t.kind = 'kiosk' AND t.revoked_at IS NULL
       AND t.event_id = p_event
       AND e.status NOT IN ('completed', 'cancelled'));
$$;

-- An event by its code; an all-NULL row when there's none.
CREATE OR REPLACE FUNCTION public._jam_find(p_code TEXT)
RETURNS public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.* FROM public.events e
   WHERE e.short_code = public._jam_code(p_code) AND public._jam_code(p_code) <> '';
$$;

-- Why an anon caller can't use this jam's code ('code' jams only), or NULL.
-- The code-taking anon functions return this as a row instead of raising, so
-- the rate-limit hit of a wrong guess commits. Any wrong code = 'no_jam'.
CREATE OR REPLACE FUNCTION public._jam_code_refusal(p_e public.events, p_joining BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_e.id IS NULL THEN 'no_jam'
    WHEN p_e.who_can_join <> 'code' THEN 'invite_only'
    WHEN p_joining AND p_e.status IN ('completed', 'cancelled') THEN 'jam_ended'
    WHEN p_joining AND p_e.joining_locked THEN 'not_taking_people'
  END;
$$;

-- An event by its code, or no_jam (any wrong code, same answer).
CREATE OR REPLACE FUNCTION public._jam_by_code(p_code TEXT)
RETURNS public.events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_find(p_code);
BEGIN
  IF v_e.id IS NULL THEN
    PERFORM public._jam_fail('no_jam');
  END IF;
  RETURN v_e;
END;
$$;

-- Friends mode lets in the host's friends, and bandmates for a band jam.
CREATE OR REPLACE FUNCTION public._jam_is_host_friend(p_e public.events, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND p_uid <> p_e.host_user_id
     AND (public.are_friends(p_uid, p_e.host_user_id)
          OR (p_e.band_id IS NOT NULL AND public.is_band_member(p_e.band_id, p_uid)));
$$;

CREATE OR REPLACE FUNCTION public._jam_can_read_song(p_song public.songs, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (p_song.context_type = 'personal' AND p_song.context_id = p_uid::text)
      OR (p_song.context_type = 'band' AND public.is_band_member(p_song.context_id::uuid, p_uid));
$$;

CREATE OR REPLACE FUNCTION public._jam_item(p_item UUID)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i public.event_lineup_items;
BEGIN
  SELECT * INTO v_i FROM public.event_lineup_items WHERE id = p_item;
  IF v_i.id IS NULL THEN
    PERFORM public._jam_fail('not_found');
  END IF;
  RETURN v_i;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_participant(p_participant UUID)
RETURNS public.event_participants
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.event_participants;
BEGIN
  SELECT * INTO v_p FROM public.event_participants WHERE id = p_participant;
  IF v_p.id IS NULL THEN
    PERFORM public._jam_fail('not_found');
  END IF;
  RETURN v_p;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_notify(p_user UUID, p_title TEXT, p_body TEXT, p_link TEXT, p_payload JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link, payload)
  VALUES (p_user, 'event', p_title, p_body, p_link, COALESCE(p_payload, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public._jam_when(p_e public.events)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(p_e.scheduled_date AT TIME ZONE COALESCE(p_e.timezone, 'UTC'), 'Dy, Mon FMDD · FMHH12:MI AM')
      || COALESCE(' · ' || NULLIF(btrim(p_e.venue), ''), '');
$$;

-- Raise p_who's hands on p_item for each part (each must be needed). A hand
-- the host declined comes back raised. Returns p_who's hands on the song.
CREATE OR REPLACE FUNCTION public._jam_raise(p_item public.event_lineup_items, p_who public.event_participants, p_parts JSONB)
RETURNS SETOF public.event_hands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts JSONB := public._jam_parts(p_parts, true);
  v_part  JSONB;
  v_name  TEXT := public._jam_name(p_who.guest_name, p_who.user_id);
BEGIN
  IF v_parts IS NULL OR jsonb_array_length(v_parts) = 0 THEN
    PERFORM public._jam_fail('invalid_parts');
  END IF;
  FOR v_part IN SELECT value FROM jsonb_array_elements(v_parts) LOOP
    IF NOT public._jam_has_part(p_item.parts_needed, v_part->>'key', v_part->>'label') THEN
      PERFORM public._jam_fail('part_not_needed');
    END IF;
    INSERT INTO public.event_hands
      (event_id, event_lineup_item_id, role_key, role_label, participant_id, user_id, user_name, status)
    VALUES
      (p_item.event_id, p_item.id, v_part->>'key', v_part->>'label', p_who.id, p_who.user_id, v_name, 'raised')
    ON CONFLICT DO NOTHING;
    UPDATE public.event_hands
       SET status = 'raised', resolved_by = NULL, resolved_date = NULL
     WHERE event_lineup_item_id = p_item.id AND participant_id = p_who.id
       AND public._part_id(role_key, role_label) = public._part_id(v_part->>'key', v_part->>'label')
       AND status IN ('declined', 'withdrawn');
  END LOOP;
  RETURN QUERY SELECT h.* FROM public.event_hands h
                WHERE h.event_lineup_item_id = p_item.id AND h.participant_id = p_who.id
                ORDER BY h.created_date;
END;
$$;

-- A pitch: a new lineup entry, 'pending' unless approval is off or a host
-- pitches, with the pitcher's hands raised on the parts they'll play.
CREATE OR REPLACE FUNCTION public._jam_pitch(
  p_e            public.events,
  p_who          public.event_participants,
  p_mgr          BOOLEAN,
  p_song_id      UUID,
  p_title        TEXT,
  p_artist       TEXT,
  p_my_parts     JSONB,
  p_parts_needed JSONB,
  p_group_id     UUID
)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song   public.songs;
  v_title  TEXT;
  v_artist TEXT;
  v_source TEXT := 'external';
  v_mine   JSONB := COALESCE(public._jam_parts(p_my_parts, true), '[]'::jsonb);
  v_needed JSONB;
  v_part   JSONB;
  v_item   public.event_lineup_items;
BEGIN
  IF NOT p_mgr AND NOT p_e.allow_suggestions THEN
    PERFORM public._jam_fail('requests_closed');
  END IF;
  IF p_song_id IS NOT NULL THEN
    IF p_who.user_id IS NULL THEN
      PERFORM public._jam_fail('forbidden');
    END IF;
    SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;
    IF v_song.id IS NULL OR NOT public._jam_can_read_song(v_song, p_who.user_id) THEN
      PERFORM public._jam_fail('not_found');
    END IF;
    v_title := v_song.title;
    v_artist := COALESCE(v_song.artist, '');
    v_source := CASE v_song.context_type WHEN 'personal' THEN 'mine' ELSE 'band' END;
  ELSE
    v_title := btrim(COALESCE(p_title, ''));
    v_artist := btrim(COALESCE(p_artist, ''));
    IF v_title = '' THEN
      PERFORM public._jam_fail('title_required');
    END IF;
    IF char_length(v_title) > 80 OR char_length(v_artist) > 80 THEN
      PERFORM public._jam_fail('title_too_long');
    END IF;
  END IF;

  v_needed := COALESCE(public._jam_parts(p_parts_needed), p_e.default_parts);
  FOR v_part IN SELECT value FROM jsonb_array_elements(v_mine) LOOP
    IF NOT public._jam_has_part(v_needed, v_part->>'key', v_part->>'label') THEN
      v_needed := v_needed || jsonb_build_array(v_part);
    END IF;
  END LOOP;

  INSERT INTO public.event_lineup_items
    (event_id, position, source, owner_id, song_id, display_title, display_artist, tuning, key,
     state, parts_needed, pitched_by, group_id)
  VALUES
    (p_e.id,
     (SELECT COALESCE(max(position), 0) + 1 FROM public.event_lineup_items WHERE event_id = p_e.id),
     v_source, p_who.user_id, v_song.id, v_title, v_artist, v_song.guitar_tuning, v_song.key,
     CASE WHEN p_mgr OR p_e.auto_approve THEN 'open' ELSE 'pending' END,
     v_needed, p_who.id, p_group_id)
  RETURNING * INTO v_item;

  IF jsonb_array_length(v_mine) > 0 THEN
    PERFORM public._jam_raise(v_item, p_who, v_mine);
  END IF;
  RETURN v_item;
END;
$$;

-- Take a person out: hands go; their pending / open pitches nobody else has a
-- hand on go to 'removed'; the row goes (tokens cascade, pitched_by nulls).
CREATE OR REPLACE FUNCTION public._jam_drop_person(p_who public.event_participants)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.event_hands WHERE participant_id = p_who.id;
  UPDATE public.event_lineup_items i SET state = 'removed'
   WHERE i.pitched_by = p_who.id AND i.state IN ('pending', 'open')
     AND NOT EXISTS (SELECT 1 FROM public.event_hands h WHERE h.event_lineup_item_id = i.id);
  DELETE FROM public.event_participants WHERE id = p_who.id;
END;
$$;

-- Put p_item at queue position p_pos (1-based; NULL = the end) and renumber.
-- p_item NULL just renumbers.
CREATE OR REPLACE FUNCTION public._jam_requeue(p_event UUID, p_item UUID, p_pos INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_at  INT;
BEGIN
  SELECT COALESCE(array_agg(id ORDER BY queue_position NULLS LAST, position, created_date), '{}') INTO v_ids
    FROM public.event_lineup_items
   WHERE event_id = p_event AND state = 'queued' AND id IS DISTINCT FROM p_item;
  IF p_item IS NOT NULL THEN
    v_at := LEAST(GREATEST(COALESCE(p_pos, cardinality(v_ids) + 1), 1), cardinality(v_ids) + 1);
    v_ids := v_ids[1:v_at - 1] || p_item || v_ids[v_at:];
    UPDATE public.event_lineup_items SET state = 'queued' WHERE id = p_item;
  END IF;
  UPDATE public.event_lineup_items i SET queue_position = o.ord
    FROM unnest(v_ids) WITH ORDINALITY o(id, ord)
   WHERE i.id = o.id AND i.queue_position IS DISTINCT FROM o.ord::int;
  UPDATE public.event_lineup_items SET queue_position = NULL
   WHERE event_id = p_event AND state <> 'queued' AND queue_position IS NOT NULL;
END;
$$;

-- ── 6. Triggers ───────────────────────────────────────────────────────────────
-- New lineup entries start from the jam's parts.
CREATE OR REPLACE FUNCTION public._jam_item_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parts_needed IS NULL THEN
    NEW.parts_needed := COALESCE((SELECT default_parts FROM public.events WHERE id = NEW.event_id),
                                 '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_jam_item_defaults ON public.event_lineup_items;
CREATE TRIGGER trg_jam_item_defaults BEFORE INSERT ON public.event_lineup_items
  FOR EACH ROW EXECUTE FUNCTION public._jam_item_defaults();

-- The legacy pages write hands by user_id: fill the participant (and the
-- other way round for guests' hands).
CREATE OR REPLACE FUNCTION public._jam_hand_fill_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.participant_id FROM public.event_participants
     WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.participant_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.event_participants WHERE id = NEW.participant_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_hand_fill_participant ON public.event_hands;
CREATE TRIGGER trg_event_hand_fill_participant BEFORE INSERT ON public.event_hands
  FOR EACH ROW EXECUTE FUNCTION public._jam_hand_fill_participant();

-- Legacy auto-approve stays for the legacy pages (they never set
-- participant_id; it fires before the fill trigger). Jam hands wait for the host.
CREATE OR REPLACE FUNCTION public.on_event_hand_autoapprove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_id IS NULL AND NEW.status = 'raised' AND public.event_auto_approve(NEW.event_id) THEN
    NEW.status := 'accepted';
    NEW.resolved_date := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Legacy request approval: same as before, without the dropped per-user key.
CREATE OR REPLACE FUNCTION public.on_event_request_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_item_id  UUID;
  next_pos     INTEGER;
  requester_nm TEXT;
  part         TEXT;
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
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- A new host (delete_account hands band jams to the owner) gets a host row.
CREATE OR REPLACE FUNCTION public._jam_host_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp, via)
  VALUES (NEW.id, NEW.host_user_id, 'host', 'going', 'app')
  ON CONFLICT (event_id, user_id) DO UPDATE SET access_tier = 'host', rsvp = 'going';
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_jam_host_row ON public.events;
CREATE TRIGGER trg_jam_host_row AFTER UPDATE OF host_user_id ON public.events
  FOR EACH ROW WHEN (OLD.host_user_id IS DISTINCT FROM NEW.host_user_id)
  EXECUTE FUNCTION public._jam_host_row();

-- Live updates: one 'changed' broadcast per jam per transaction.
CREATE OR REPLACE FUNCTION public._jam_broadcast_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event UUID;
  v_code  TEXT;
  v_sent  TEXT := COALESCE(current_setting('rockon.jam_sent', true), '');
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    IF TG_OP = 'DELETE' THEN
      v_event := OLD.id; v_code := OLD.short_code;
    ELSE
      v_event := NEW.id; v_code := NEW.short_code;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN v_event := OLD.event_id; ELSE v_event := NEW.event_id; END IF;
    SELECT short_code INTO v_code FROM public.events WHERE id = v_event;
  END IF;
  IF v_code IS NULL OR position(v_event::text IN v_sent) > 0 THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('rockon.jam_sent', v_sent || v_event::text || ',', true);
  PERFORM realtime.send(jsonb_build_object('at', now()), 'changed', 'jam:' || v_code, false);
  RETURN NULL;
END;
$$;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['events', 'event_participants', 'event_lineup_items', 'event_hands'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_jam_broadcast ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_jam_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public._jam_broadcast_changed()', t);
  END LOOP;
END $$;

-- ── 7. Backfill: pending requests → pending lineup entries with hands ─────────
-- A function so the seed and pgTAP can run it on fixtures. Each request is
-- moved once (resolved_lineup_item_id marks it); the request row stays for the
-- legacy pages.
CREATE OR REPLACE FUNCTION public._jam_backfill_requests()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r      RECORD;
  v_p    public.event_participants;
  v_item UUID;
  v_part TEXT;
  v_key  TEXT;
BEGIN
  FOR r IN SELECT * FROM public.event_lineup_requests
            WHERE status = 'pending' AND resolved_lineup_item_id IS NULL
            ORDER BY created_date LOOP
    SELECT * INTO v_p FROM public.event_participants
     WHERE event_id = r.event_id AND user_id = r.requester_id;
    INSERT INTO public.event_lineup_items
      (event_id, position, source, owner_id, song_id, display_title, display_artist, state, pitched_by, created_date)
    VALUES
      (r.event_id,
       (SELECT COALESCE(max(position), 0) + 1 FROM public.event_lineup_items WHERE event_id = r.event_id),
       r.source, r.owner_id, r.song_id, r.display_title, r.display_artist, 'pending', v_p.id, r.created_date)
    RETURNING id INTO v_item;
    IF v_p.id IS NOT NULL THEN
      FOREACH v_part IN ARRAY COALESCE(r.parts, '{}') LOOP
        v_key := lower(btrim(COALESCE(v_part, '')));
        CONTINUE WHEN v_key = '';
        IF v_key IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other') THEN
          INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, participant_id, user_id, user_name, status)
          VALUES (r.event_id, v_item, v_key, v_p.id, r.requester_id, public._jam_name(NULL, r.requester_id), 'raised')
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, role_label, participant_id, user_id, user_name, status)
          VALUES (r.event_id, v_item, 'other', left(btrim(v_part), 30), v_p.id, r.requester_id, public._jam_name(NULL, r.requester_id), 'raised')
          ON CONFLICT DO NOTHING;
        END IF;
        -- The pitcher's part is needed on their song.
        UPDATE public.event_lineup_items
           SET parts_needed = parts_needed || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
                 'key', CASE WHEN v_key IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other') THEN v_key ELSE 'other' END,
                 'label', CASE WHEN v_key IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other') THEN NULL ELSE left(btrim(v_part), 30) END)))
         WHERE id = v_item
           AND NOT public._jam_has_part(parts_needed,
                 CASE WHEN v_key IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other') THEN v_key ELSE 'other' END,
                 CASE WHEN v_key IN ('vox', 'guitar', 'bass', 'drums', 'keys', 'other') THEN NULL ELSE left(btrim(v_part), 30) END);
      END LOOP;
    END IF;
    UPDATE public.event_lineup_requests SET resolved_lineup_item_id = v_item WHERE id = r.id;
  END LOOP;
END;
$$;

SELECT public._jam_backfill_requests();

-- ── 8. Planning RPCs ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_jam(
  p_name          TEXT,
  p_at            TIMESTAMPTZ,
  p_timezone      TEXT DEFAULT NULL,
  p_where         TEXT DEFAULT NULL,
  p_band_id       UUID DEFAULT NULL,
  p_who_can_join  TEXT DEFAULT 'code',
  p_default_parts JSONB DEFAULT NULL
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := public._require_signed_in();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_e    public.events;
BEGIN
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN
    PERFORM public._jam_fail('name_required', 'Give the jam a name.');
  END IF;
  IF p_at IS NULL OR COALESCE(p_who_can_join, 'code') NOT IN ('invite', 'friends', 'code') THEN
    PERFORM public._jam_fail('invalid_setting');
  END IF;
  IF p_band_id IS NOT NULL AND NOT public.is_band_member(p_band_id, v_uid) THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  INSERT INTO public.events
    (host_user_id, band_id, name, venue, scheduled_date, timezone, visibility, who_can_join, default_parts, last_modified_by)
  VALUES
    (v_uid, p_band_id, v_name, NULLIF(btrim(COALESCE(p_where, '')), ''), p_at,
     COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), 'America/New_York'), 'unlisted',
     COALESCE(p_who_can_join, 'code'),
     COALESCE(public._jam_parts(p_default_parts, false), '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]'::jsonb),
     v_uid)
  RETURNING * INTO v_e;
  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp, via)
  VALUES (v_e.id, v_uid, 'host', 'going', 'app');
  RETURN v_e;
END;
$$;

-- update_jam: the host edits the facts. Patch keys: name, scheduled_date,
-- timezone, venue, location, description, end_time ('' clears the optional ones).
CREATE OR REPLACE FUNCTION public.update_jam(p_event UUID, p_patch JSONB, p_expected_version INT)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_host(p_event);
  v_p JSONB := COALESCE(p_patch, '{}'::jsonb);
BEGIN
  IF p_expected_version IS DISTINCT FROM v_e.version THEN
    PERFORM public._jam_fail('stale_version');
  END IF;
  IF v_p ? 'name' AND char_length(btrim(COALESCE(v_p->>'name', ''))) NOT BETWEEN 1 AND 80 THEN
    PERFORM public._jam_fail('name_required', 'Give the jam a name.');
  END IF;
  UPDATE public.events SET
    name           = CASE WHEN v_p ? 'name' THEN btrim(v_p->>'name') ELSE name END,
    scheduled_date = CASE WHEN v_p ? 'scheduled_date' AND v_p->>'scheduled_date' IS NOT NULL
                          THEN (v_p->>'scheduled_date')::timestamptz ELSE scheduled_date END,
    timezone       = CASE WHEN v_p ? 'timezone' AND NULLIF(btrim(v_p->>'timezone'), '') IS NOT NULL
                          THEN btrim(v_p->>'timezone') ELSE timezone END,
    venue          = CASE WHEN v_p ? 'venue' THEN NULLIF(btrim(COALESCE(v_p->>'venue', '')), '') ELSE venue END,
    location       = CASE WHEN v_p ? 'location' THEN NULLIF(btrim(COALESCE(v_p->>'location', '')), '') ELSE location END,
    description    = CASE WHEN v_p ? 'description' THEN NULLIF(btrim(COALESCE(v_p->>'description', '')), '') ELSE description END,
    end_time       = CASE WHEN v_p ? 'end_time' THEN NULLIF(v_p->>'end_time', '')::timestamptz ELSE end_time END,
    version = version + 1,
    calendar_sequence = calendar_sequence + 1,
    updated_date = now(),
    last_modified_by = auth.uid()
  WHERE id = v_e.id
  RETURNING * INTO v_e;
  RETURN v_e;
END;
$$;

-- set_jam_settings: the host's switches. NULL = leave as is.
-- requests_open = allow_suggestions; approve_myself = NOT auto_approve.
CREATE OR REPLACE FUNCTION public.set_jam_settings(
  p_event            UUID,
  p_who_can_join     TEXT DEFAULT NULL,
  p_requests_open    BOOLEAN DEFAULT NULL,
  p_approve_myself   BOOLEAN DEFAULT NULL,
  p_group_size       INT DEFAULT NULL,
  p_requests_visible BOOLEAN DEFAULT NULL,
  p_default_parts    JSONB DEFAULT NULL
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e     public.events := public._jam_host(p_event);
  v_parts JSONB := public._jam_parts(p_default_parts, false);
BEGIN
  IF (p_who_can_join IS NOT NULL AND p_who_can_join NOT IN ('invite', 'friends', 'code'))
     OR (p_group_size IS NOT NULL AND p_group_size NOT BETWEEN 0 AND 5) THEN
    PERFORM public._jam_fail('invalid_setting');
  END IF;
  IF v_parts IS NOT NULL AND jsonb_array_length(v_parts) = 0 THEN
    PERFORM public._jam_fail('invalid_parts');
  END IF;
  UPDATE public.events SET
    who_can_join      = COALESCE(p_who_can_join, who_can_join),
    allow_suggestions = COALESCE(p_requests_open, allow_suggestions),
    auto_approve      = COALESCE(NOT p_approve_myself, auto_approve),
    group_size        = COALESCE(p_group_size::smallint, group_size),
    requests_visible  = COALESCE(p_requests_visible, requests_visible),
    default_parts     = COALESCE(v_parts, default_parts),
    updated_date      = now()
  WHERE id = v_e.id
  RETURNING * INTO v_e;
  RETURN v_e;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_cohost(p_participant UUID, p_on BOOLEAN)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.event_participants := public._jam_participant(p_participant);
  v_e public.events := public._jam_host(v_p.event_id);
BEGIN
  IF v_p.user_id IS NULL THEN
    PERFORM public._jam_fail('needs_account', 'Only people on the app can be co-hosts.');
  END IF;
  IF v_p.user_id = v_e.host_user_id THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  UPDATE public.event_participants
     SET access_tier = CASE WHEN p_on THEN 'cohost' ELSE 'guest' END
   WHERE id = v_p.id
  RETURNING * INTO v_p;
  RETURN v_p;
END;
$$;

-- delete_jam: planned jams only; everyone who joined hears it was called off.
CREATE OR REPLACE FUNCTION public.delete_jam(p_event UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e    public.events := public._jam_host(p_event);
  v_host TEXT := split_part(public._jam_name(NULL, v_e.host_user_id), ' ', 1);
  r      RECORD;
BEGIN
  IF v_e.status NOT IN ('scheduled', 'confirmed') THEN
    PERFORM public._jam_fail('not_planned', 'Only a planned jam can be deleted.');
  END IF;
  FOR r IN SELECT user_id FROM public.event_participants
            WHERE event_id = v_e.id AND user_id IS NOT NULL AND user_id <> v_e.host_user_id
              AND rsvp IN ('going', 'maybe') LOOP
    PERFORM public._jam_notify(r.user_id, format('%s called off %s', v_host, v_e.name),
      public._jam_when(v_e), '/jam', jsonb_build_object('type', 'jam_called_off', 'event_id', v_e.id));
  END LOOP;
  DELETE FROM public.events WHERE id = v_e.id;
END;
$$;

-- invite_to_jam: host / co-hosts in any mode; joined participants in friends
-- and code modes. Invitees are the inviter's friends (or bandmates for a band
-- jam). Returns the new invites; people already in are skipped.
CREATE OR REPLACE FUNCTION public.invite_to_jam(p_event UUID, p_user_ids UUID[])
RETURNS SETOF public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := public._require_signed_in();
  v_e    public.events := public._jam_event(p_event, true);
  v_mgr  BOOLEAN := public.is_event_manager(p_event, v_uid);
  v_me   public.event_participants;
  v_name TEXT := split_part(public._jam_name(NULL, v_uid), ' ', 1);
  v_u    UUID;
  v_row  public.event_participants;
BEGIN
  SELECT * INTO v_me FROM public.event_participants WHERE event_id = p_event AND user_id = v_uid;
  IF NOT v_mgr AND (v_me.id IS NULL OR v_me.rsvp = 'pending' OR v_e.who_can_join = 'invite') THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  PERFORM public._jam_check_open(v_e);
  FOR v_u IN SELECT DISTINCT u FROM unnest(COALESCE(p_user_ids, '{}')) u WHERE u IS NOT NULL AND u <> v_uid LOOP
    IF NOT (public.are_friends(v_uid, v_u)
            OR (v_e.band_id IS NOT NULL AND public.is_band_member(v_e.band_id, v_uid)
                AND public.is_band_member(v_e.band_id, v_u))) THEN
      PERFORM public._jam_fail('not_friend');
    END IF;
    v_row := NULL;
    INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp, via, invited_by)
    VALUES (v_e.id, v_u, 'guest', 'pending', 'app', v_uid)
    ON CONFLICT (event_id, user_id) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.id IS NOT NULL THEN
      PERFORM public._jam_notify(v_u, format('%s invited you to %s', v_name, v_e.name),
        public._jam_when(v_e), '/jam/' || v_e.id,
        jsonb_build_object('type', 'jam_invite', 'event_id', v_e.id, 'band_id', v_e.band_id));
      RETURN NEXT v_row;
    END IF;
  END LOOP;
END;
$$;

-- join: an existing row (an invite) becomes Going; otherwise a new guest row.
CREATE OR REPLACE FUNCTION public._jam_join(p_e public.events, p_uid UUID, p_parts JSONB, p_share_songs BOOLEAN)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p     public.event_participants;
  v_parts JSONB := public._jam_parts(p_parts, true);
BEGIN
  SELECT * INTO v_p FROM public.event_participants WHERE event_id = p_e.id AND user_id = p_uid;
  IF v_p.id IS NOT NULL THEN
    UPDATE public.event_participants
       SET rsvp = CASE WHEN rsvp = 'pending' THEN 'going' ELSE rsvp END,
           parts = COALESCE(v_parts, parts),
           share_songs = COALESCE(p_share_songs, share_songs)
     WHERE id = v_p.id
    RETURNING * INTO v_p;
    RETURN v_p;
  END IF;
  IF p_e.joining_locked THEN
    PERFORM public._jam_fail('not_taking_people');
  END IF;
  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp, via, parts, share_songs)
  VALUES (p_e.id, p_uid, 'guest', 'going', 'app', COALESCE(v_parts, '[]'::jsonb), COALESCE(p_share_songs, true))
  RETURNING * INTO v_p;
  RETURN v_p;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_jam(p_code TEXT, p_parts JSONB DEFAULT NULL, p_share_songs BOOLEAN DEFAULT NULL)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_e   public.events;
BEGIN
  PERFORM public._jam_code_gate('code', 1000);
  v_e := public._jam_by_code(p_code);
  PERFORM public._jam_check_open(v_e);
  IF v_e.who_can_join <> 'code' THEN
    PERFORM public._jam_fail('invite_only');
  END IF;
  RETURN public._jam_join(v_e, v_uid, p_parts, p_share_songs);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_jam_by_id(p_event UUID, p_parts JSONB DEFAULT NULL, p_share_songs BOOLEAN DEFAULT NULL)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_e   public.events := public._jam_event(p_event, true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = v_e.id AND user_id = v_uid)
     AND NOT (v_e.who_can_join = 'friends' AND public._jam_is_host_friend(v_e, v_uid)) THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  PERFORM public._jam_check_open(v_e);
  RETURN public._jam_join(v_e, v_uid, p_parts, p_share_songs);
END;
$$;

-- The hub: jams I host or co-host, jams I'm in or invited to, and friends-mode
-- jams my friends host that I'm not in (upcoming or live).
CREATE OR REPLACE FUNCTION public.list_my_jams()
RETURNS TABLE (
  section           TEXT,
  id                UUID,
  name              TEXT,
  status            TEXT,
  scheduled_date    TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  timezone          TEXT,
  venue             TEXT,
  location          TEXT,
  band_id           UUID,
  who_can_join      TEXT,
  short_code        TEXT,
  host_user_id      UUID,
  host_name         TEXT,
  my_participant_id UUID,
  my_tier           TEXT,
  joined            BOOLEAN,
  people_count      INT,
  lineup_count      INT,
  pending_count     INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
BEGIN
  RETURN QUERY
  WITH mine AS (
    SELECT CASE WHEN p.access_tier IN ('host', 'cohost') OR e.host_user_id = v_uid THEN 'hosting' ELSE 'invited' END AS section,
           e.*, p.id AS pid, p.access_tier AS tier, p.rsvp <> 'pending' AS joined
      FROM public.event_participants p
      JOIN public.events e ON e.id = p.event_id
     WHERE p.user_id = v_uid
  ), friends AS (
    SELECT 'friends'::text AS section, e.*, NULL::uuid AS pid, NULL::text AS tier, false AS joined
      FROM public.events e
     WHERE e.who_can_join = 'friends'
       AND e.status IN ('scheduled', 'confirmed', 'live')
       AND (e.status = 'live' OR e.scheduled_date >= now() - interval '12 hours')
       AND public._jam_is_host_friend(e, v_uid)
       AND NOT EXISTS (SELECT 1 FROM public.event_participants p WHERE p.event_id = e.id AND p.user_id = v_uid)
  ), allj AS (
    SELECT * FROM mine UNION ALL SELECT * FROM friends
  )
  SELECT a.section, a.id, a.name, a.status, a.scheduled_date, a.end_time, a.timezone, a.venue, a.location,
         a.band_id, a.who_can_join, a.short_code, a.host_user_id,
         public._jam_name(NULL, a.host_user_id),
         a.pid, a.tier, a.joined,
         (SELECT count(*)::int FROM public.event_participants p WHERE p.event_id = a.id AND p.rsvp <> 'pending'),
         (SELECT count(*)::int FROM public.event_lineup_items i WHERE i.event_id = a.id AND i.state NOT IN ('pending', 'removed')),
         (SELECT count(*)::int FROM public.event_lineup_items i WHERE i.event_id = a.id AND i.state = 'pending')
    FROM allj a
   ORDER BY (a.status = 'live') DESC, a.scheduled_date;
END;
$$;

-- ── 9. Codes, previews, web guests ────────────────────────────────────────────
-- Anon: with a jam code, what the join screen shows (no ids of people).
CREATE OR REPLACE FUNCTION public.jam_preview_by_code(p_code TEXT)
RETURNS TABLE (
  event_id        UUID,
  name            TEXT,
  status          TEXT,
  scheduled_date  TIMESTAMPTZ,
  timezone        TEXT,
  venue           TEXT,
  host_first_name TEXT,
  people_count    INT,
  is_participant  BOOLEAN,
  error           TEXT,
  hint            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e   public.events;
  v_in  BOOLEAN;
  v_err TEXT;
BEGIN
  PERFORM public._jam_code_gate('code', 1000);
  v_e := public._jam_find(p_code);
  IF v_e.id IS NULL THEN
    PERFORM public._jam_code_miss();
  END IF;
  v_in := v_e.id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_participants ep WHERE ep.event_id = v_e.id AND ep.user_id = auth.uid());
  v_err := CASE WHEN NOT v_in THEN public._jam_code_refusal(v_e) END;
  IF v_err IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::timestamptz, NULL::text, NULL::text,
      NULL::text, NULL::int, NULL::boolean, v_err, public._jam_copy(v_err);
    RETURN;
  END IF;
  RETURN QUERY SELECT v_e.id, v_e.name, v_e.status, v_e.scheduled_date, v_e.timezone, v_e.venue,
    split_part(public._jam_name(NULL, v_e.host_user_id), ' ', 1),
    (SELECT count(*)::int FROM public.event_participants p WHERE p.event_id = v_e.id AND p.rsvp <> 'pending'),
    v_in, NULL::text, NULL::text;
END;
$$;

-- Anon: with any code, only whether it's a band invite, a jam, or nothing.
CREATE OR REPLACE FUNCTION public.resolve_code(p_code TEXT)
RETURNS TABLE (kind TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := public._jam_code(p_code);
  v_kind TEXT;
BEGIN
  PERFORM public._jam_code_gate('code', 1000);
  SELECT CASE
    WHEN v_code = '' THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.invite_codes c JOIN public.bands b ON b.id = c.band_id
                  WHERE c.code = v_code AND c.is_active AND c.expires_at > now()
                    AND (c.max_uses IS NULL OR c.current_uses < c.max_uses) AND b.deleted_at IS NULL) THEN 'band'
    WHEN EXISTS (SELECT 1 FROM public.events e WHERE e.short_code = v_code) THEN 'jam'
    ELSE NULL END INTO v_kind;
  IF v_kind IS NULL THEN
    PERFORM public._jam_code_miss();
  END IF;
  RETURN QUERY SELECT v_kind;
END;
$$;

-- Anon: with a code for an open 'code' jam, join as a web guest (first name +
-- parts). The token is returned once; only its hash is kept.
CREATE OR REPLACE FUNCTION public.join_jam_as_web_guest(p_code TEXT, p_name TEXT, p_parts JSONB DEFAULT NULL)
RETURNS TABLE (event_id UUID, participant_id UUID, token TEXT, error TEXT, hint TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e     public.events;
  v_name  TEXT := btrim(COALESCE(p_name, ''));
  v_parts JSONB;
  v_p     public.event_participants;
  v_token TEXT := public._jam_new_token();
  v_err   TEXT;
BEGIN
  PERFORM public._jam_code_gate('join', 300);
  -- Input errors come before the code is looked at, so they say nothing about it.
  IF char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    PERFORM public._jam_fail('name_required');
  END IF;
  v_parts := COALESCE(public._jam_parts(p_parts, true), '[]'::jsonb);
  v_e := public._jam_find(p_code);
  IF v_e.id IS NULL THEN
    PERFORM public._jam_code_miss();
  END IF;
  v_err := public._jam_code_refusal(v_e, true);
  IF v_err IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::text, v_err, public._jam_copy(v_err);
    RETURN;
  END IF;
  INSERT INTO public.event_participants (event_id, user_id, guest_name, access_tier, rsvp, via, parts, share_songs)
  VALUES (v_e.id, NULL, v_name, 'guest', 'going', 'web', v_parts, false)
  RETURNING * INTO v_p;
  INSERT INTO public.event_guest_tokens (token_hash, event_id, participant_id, kind)
  VALUES (public._jam_hash(v_token), v_e.id, v_p.id, 'guest');
  RETURN QUERY SELECT v_e.id, v_p.id, v_token, NULL::text, NULL::text;
END;
$$;

-- Anon: with your guest token, change your own name (guests) and parts.
CREATE OR REPLACE FUNCTION public.update_me(
  p_event       UUID,
  p_name        TEXT DEFAULT NULL,
  p_parts       JSONB DEFAULT NULL,
  p_share_songs BOOLEAN DEFAULT NULL,
  p_guest_token TEXT DEFAULT NULL
)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   public.event_participants := public._jam_actor(p_event, p_guest_token);
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  PERFORM public._jam_check_open(public._jam_event(p_event));
  IF p_name IS NOT NULL AND v_me.user_id IS NULL AND char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    PERFORM public._jam_fail('name_required');
  END IF;
  UPDATE public.event_participants SET
    guest_name  = CASE WHEN p_name IS NOT NULL AND user_id IS NULL THEN v_name ELSE guest_name END,
    parts       = COALESCE(public._jam_parts(p_parts, true), parts),
    share_songs = CASE WHEN user_id IS NULL THEN false ELSE COALESCE(p_share_songs, share_songs) END
  WHERE id = v_me.id
  RETURNING * INTO v_me;
  RETURN v_me;
END;
$$;

-- Anon: with your guest token, leave: your hands go, your token dies.
CREATE OR REPLACE FUNCTION public.leave_jam(p_event UUID, p_guest_token TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me public.event_participants := public._jam_actor(p_event, p_guest_token);
  v_e  public.events := public._jam_event(p_event, true);
BEGIN
  IF v_me.user_id IS NOT NULL AND v_me.user_id = v_e.host_user_id THEN
    PERFORM public._jam_fail('host_cannot_leave');
  END IF;
  PERFORM public._jam_drop_person(v_me);
END;
$$;

-- ── 10. Lineup, pitches, hands, cast ──────────────────────────────────────────
-- Anon: with a kiosk token, add a walk-up (name, parts, optional hand or pitch).
-- Signed in: the host or a co-host adds one.
CREATE OR REPLACE FUNCTION public.add_walkup(
  p_event        UUID,
  p_name         TEXT,
  p_parts        JSONB DEFAULT NULL,
  p_via          TEXT DEFAULT 'walkup',
  p_item         UUID DEFAULT NULL,
  p_pitch_title  TEXT DEFAULT NULL,
  p_pitch_artist TEXT DEFAULT NULL,
  p_guest_token  TEXT DEFAULT NULL
)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk BOOLEAN := p_guest_token IS NOT NULL;
  v_e     public.events;
  v_name  TEXT := btrim(COALESCE(p_name, ''));
  v_parts JSONB;
  v_p     public.event_participants;
  v_item  public.event_lineup_items;
BEGIN
  IF v_kiosk THEN
    IF NOT public._jam_kiosk_ok(p_event, p_guest_token) THEN
      PERFORM public._jam_fail('forbidden');
    END IF;
    v_e := public._jam_event(p_event, true);
    PERFORM public._jam_rate_check('walkup', encode(public._jam_hash(p_guest_token), 'hex'), 60, interval '10 minutes');
    IF v_e.who_can_join <> 'code' THEN
      PERFORM public._jam_fail('invite_only');
    END IF;
    IF v_e.joining_locked THEN
      PERFORM public._jam_fail('not_taking_people');
    END IF;
  ELSE
    v_e := public._jam_manager(p_event);
    IF COALESCE(p_via, 'walkup') NOT IN ('walkup', 'kiosk') THEN
      PERFORM public._jam_fail('invalid_setting');
    END IF;
  END IF;
  PERFORM public._jam_check_open(v_e);
  IF char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    PERFORM public._jam_fail('name_required');
  END IF;
  v_parts := COALESCE(public._jam_parts(p_parts, true), '[]'::jsonb);
  INSERT INTO public.event_participants (event_id, user_id, guest_name, access_tier, rsvp, via, parts, share_songs)
  VALUES (v_e.id, NULL, v_name, 'guest', 'going',
          CASE WHEN v_kiosk THEN 'kiosk' ELSE COALESCE(p_via, 'walkup') END, v_parts, false)
  RETURNING * INTO v_p;

  IF p_item IS NOT NULL THEN
    v_item := public._jam_item(p_item);
    IF v_item.event_id <> v_e.id THEN
      PERFORM public._jam_fail('not_found');
    END IF;
    IF v_item.state NOT IN ('pending', 'open', 'queued', 'stage') THEN
      PERFORM public._jam_fail('item_closed');
    END IF;
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_parts FROM jsonb_array_elements(v_p.parts) x
     WHERE public._jam_has_part(v_item.parts_needed, x->>'key', x->>'label');
    IF jsonb_array_length(v_parts) = 0 THEN
      PERFORM public._jam_fail('part_not_needed');
    END IF;
    PERFORM public._jam_raise(v_item, v_p, v_parts);
  END IF;
  IF NULLIF(btrim(COALESCE(p_pitch_title, '')), '') IS NOT NULL THEN
    PERFORM public._jam_pitch(v_e, v_p, NOT v_kiosk, NULL, p_pitch_title, p_pitch_artist, v_p.parts, NULL, NULL);
  END IF;
  RETURN v_p;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_lineup_songs(p_event UUID, p_song_ids UUID[], p_parts_needed JSONB DEFAULT NULL)
RETURNS SETOF public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e     public.events := public._jam_manager(p_event);
  v_parts JSONB := public._jam_parts(p_parts_needed);
  v_sid   UUID;
  v_song  public.songs;
  v_item  public.event_lineup_items;
BEGIN
  PERFORM public._jam_check_open(v_e);
  FOREACH v_sid IN ARRAY COALESCE(p_song_ids, '{}') LOOP
    SELECT * INTO v_song FROM public.songs WHERE id = v_sid;
    IF v_song.id IS NULL OR NOT public._jam_can_read_song(v_song, auth.uid()) THEN
      PERFORM public._jam_fail('not_found', 'That song isn''t in your catalog.');
    END IF;
    INSERT INTO public.event_lineup_items
      (event_id, position, source, owner_id, song_id, display_title, display_artist, tuning, key, state, parts_needed)
    VALUES
      (v_e.id, (SELECT COALESCE(max(position), 0) + 1 FROM public.event_lineup_items WHERE event_id = v_e.id),
       CASE v_song.context_type WHEN 'personal' THEN 'mine' ELSE 'band' END, auth.uid(), v_song.id,
       v_song.title, COALESCE(v_song.artist, ''), v_song.guitar_tuning, v_song.key, 'open', v_parts)
    RETURNING * INTO v_item;
    RETURN NEXT v_item;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_lineup_title(p_event UUID, p_title TEXT, p_artist TEXT DEFAULT NULL, p_parts_needed JSONB DEFAULT NULL)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e      public.events := public._jam_manager(p_event);
  v_title  TEXT := btrim(COALESCE(p_title, ''));
  v_artist TEXT := btrim(COALESCE(p_artist, ''));
  v_item   public.event_lineup_items;
BEGIN
  PERFORM public._jam_check_open(v_e);
  IF v_title = '' THEN
    PERFORM public._jam_fail('title_required');
  END IF;
  IF char_length(v_title) > 80 OR char_length(v_artist) > 80 THEN
    PERFORM public._jam_fail('title_too_long');
  END IF;
  INSERT INTO public.event_lineup_items
    (event_id, position, source, owner_id, display_title, display_artist, state, parts_needed)
  VALUES
    (v_e.id, (SELECT COALESCE(max(position), 0) + 1 FROM public.event_lineup_items WHERE event_id = v_e.id),
     'external', auth.uid(), v_title, v_artist, 'open', public._jam_parts(p_parts_needed))
  RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

-- set_item_parts: the parts a song calls for (one element per slot).
CREATE OR REPLACE FUNCTION public.set_item_parts(p_item UUID, p_parts_needed JSONB)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item  public.event_lineup_items := public._jam_item(p_item);
  v_e     public.events := public._jam_manager(v_item.event_id);
  v_parts JSONB := public._jam_parts(p_parts_needed);
BEGIN
  IF v_parts IS NULL OR jsonb_array_length(v_parts) = 0 THEN
    PERFORM public._jam_fail('invalid_parts');
  END IF;
  UPDATE public.event_lineup_items SET parts_needed = v_parts WHERE id = v_item.id RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

-- reorder_lineup: the planned order; ids not listed keep their order after.
CREATE OR REPLACE FUNCTION public.reorder_lineup(p_event UUID, p_item_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_manager(p_event);
BEGIN
  WITH listed AS (
    SELECT id, ord FROM unnest(COALESCE(p_item_ids, '{}')) WITH ORDINALITY u(id, ord)
  ), ordered AS (
    SELECT i.id, row_number() OVER (ORDER BY l.ord NULLS LAST, i.position, i.created_date) AS pos
      FROM public.event_lineup_items i
      LEFT JOIN listed l ON l.id = i.id
     WHERE i.event_id = v_e.id
  )
  UPDATE public.event_lineup_items i SET position = o.pos
    FROM ordered o WHERE i.id = o.id AND i.position IS DISTINCT FROM o.pos::int;
END;
$$;

-- Anon: with your guest token, pitch a song (free text only for guests) while
-- requests are open; your hands go up on the parts you'll play.
CREATE OR REPLACE FUNCTION public.pitch_song(
  p_event        UUID,
  p_song_id      UUID DEFAULT NULL,
  p_title        TEXT DEFAULT NULL,
  p_artist       TEXT DEFAULT NULL,
  p_my_parts     JSONB DEFAULT NULL,
  p_parts_needed JSONB DEFAULT NULL,
  p_group_id     UUID DEFAULT NULL,
  p_guest_token  TEXT DEFAULT NULL
)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me public.event_participants := public._jam_actor(p_event, p_guest_token);
  v_e  public.events := public._jam_event(p_event, true);
BEGIN
  PERFORM public._jam_check_open(v_e);
  IF v_me.rsvp = 'pending' THEN
    PERFORM public._jam_fail('not_joined');
  END IF;
  PERFORM public._jam_rate_check('pitch', v_me.id::text, 10, interval '10 minutes');
  PERFORM public._jam_rate_check('pitch_ip', public._jam_ip(), 600, interval '10 minutes');
  RETURN public._jam_pitch(v_e, v_me, public.is_event_manager(v_e.id, v_me.user_id),
                           p_song_id, p_title, p_artist, p_my_parts, p_parts_needed, p_group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_pitch(p_item UUID)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_item(p_item);
  v_e    public.events := public._jam_manager(v_item.event_id);
BEGIN
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  IF v_item.state <> 'pending' THEN
    PERFORM public._jam_fail('not_pending');
  END IF;
  UPDATE public.event_lineup_items SET state = 'open' WHERE id = v_item.id RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_pitch(p_item UUID)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_item(p_item);
  v_e    public.events := public._jam_manager(v_item.event_id);
BEGIN
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  IF v_item.state <> 'pending' THEN
    PERFORM public._jam_fail('not_pending');
  END IF;
  UPDATE public.event_lineup_items SET state = 'removed' WHERE id = v_item.id RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

-- Anon: with your guest token, raise your own hands on a song, only on parts it
-- needs, once per part.
CREATE OR REPLACE FUNCTION public.raise_hand(p_item UUID, p_parts JSONB, p_guest_token TEXT DEFAULT NULL)
RETURNS SETOF public.event_hands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items;
  v_me   public.event_participants;
  v_e    public.events;
BEGIN
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  -- A missing song answers like a foreign one: no probing ids.
  v_me := public._jam_actor(v_item.event_id, p_guest_token);
  v_e := public._jam_event(v_item.event_id, true);
  PERFORM public._jam_check_open(v_e);
  IF v_me.rsvp = 'pending' THEN
    PERFORM public._jam_fail('not_joined');
  END IF;
  IF v_item.state NOT IN ('pending', 'open', 'queued', 'stage') THEN
    PERFORM public._jam_fail('item_closed');
  END IF;
  PERFORM public._jam_rate_check('hand', v_me.id::text, 60, interval '10 minutes');
  PERFORM public._jam_rate_check('hand_ip', public._jam_ip(), 3000, interval '10 minutes');
  RETURN QUERY SELECT * FROM public._jam_raise(v_item, v_me, p_parts);
END;
$$;

-- Anon: with your guest token, lower one of your own hands (hosts: anyone's).
CREATE OR REPLACE FUNCTION public.lower_hand(p_hand UUID, p_guest_token TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h  public.event_hands;
  v_me public.event_participants;
BEGIN
  SELECT * INTO v_h FROM public.event_hands WHERE id = p_hand;
  v_me := public._jam_actor(v_h.event_id, p_guest_token);
  IF v_h.participant_id IS DISTINCT FROM v_me.id
     AND NOT (p_guest_token IS NULL AND public.is_event_manager(v_h.event_id, auth.uid())) THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  DELETE FROM public.event_hands WHERE id = v_h.id;
END;
$$;

-- set_cast: put someone in the jam on a part (their hand → accepted, created if
-- needed). If that part's slots are all taken, the song gets one more slot
-- ("Guitar 2"). p_on false puts the hand back to raised.
CREATE OR REPLACE FUNCTION public.set_cast(p_item UUID, p_part JSONB, p_participant UUID, p_on BOOLEAN DEFAULT true)
RETURNS public.event_hands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item  public.event_lineup_items := public._jam_item(p_item);
  v_e     public.events := public._jam_manager(v_item.event_id);
  v_who   public.event_participants := public._jam_participant(p_participant);
  v_parts JSONB := public._jam_parts(jsonb_build_array(p_part));
  v_part  JSONB;
  v_pid   TEXT;
  v_h     public.event_hands;
BEGIN
  IF v_parts IS NULL OR jsonb_array_length(v_parts) <> 1 THEN
    PERFORM public._jam_fail('invalid_parts');
  END IF;
  v_part := v_parts->0;
  v_pid := public._part_id(v_part->>'key', v_part->>'label');
  IF v_who.event_id <> v_e.id THEN
    PERFORM public._jam_fail('not_found');
  END IF;
  PERFORM public._jam_check_open(v_e);
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  IF v_item.state IN ('removed', 'played', 'left') THEN
    PERFORM public._jam_fail('item_closed');
  END IF;

  SELECT * INTO v_h FROM public.event_hands
   WHERE event_lineup_item_id = v_item.id AND participant_id = v_who.id
     AND public._part_id(role_key, role_label) = v_pid;
  IF NOT p_on THEN
    IF v_h.id IS NULL THEN
      PERFORM public._jam_fail('not_found');
    END IF;
    UPDATE public.event_hands SET status = 'raised', resolved_by = NULL, resolved_date = NULL
     WHERE id = v_h.id RETURNING * INTO v_h;
    RETURN v_h;
  END IF;

  IF NOT public._jam_has_part(v_item.parts_needed, v_part->>'key', v_part->>'label') THEN
    UPDATE public.event_lineup_items SET parts_needed = parts_needed || jsonb_build_array(v_part)
     WHERE id = v_item.id RETURNING * INTO v_item;
  END IF;
  IF v_h.id IS NULL THEN
    INSERT INTO public.event_hands
      (event_id, event_lineup_item_id, role_key, role_label, participant_id, user_id, user_name, status, resolved_by, resolved_date)
    VALUES
      (v_e.id, v_item.id, v_part->>'key', v_part->>'label', v_who.id, v_who.user_id,
       public._jam_name(v_who.guest_name, v_who.user_id), 'accepted', auth.uid(), now())
    RETURNING * INTO v_h;
  ELSIF v_h.status <> 'accepted' THEN
    UPDATE public.event_hands SET status = 'accepted', resolved_by = auth.uid(), resolved_date = now()
     WHERE id = v_h.id RETURNING * INTO v_h;
  END IF;
  -- More accepted than slots → one more slot for that part.
  IF (SELECT count(*) FROM public.event_hands
       WHERE event_lineup_item_id = v_item.id AND status = 'accepted'
         AND public._part_id(role_key, role_label) = v_pid)
     > (SELECT count(*) FROM jsonb_array_elements(v_item.parts_needed) n
         WHERE public._part_id(n->>'key', n->>'label') = v_pid) THEN
    UPDATE public.event_lineup_items SET parts_needed = parts_needed || jsonb_build_array(v_part)
     WHERE id = v_item.id;
  END IF;
  RETURN v_h;
END;
$$;

-- ── 11. The one read ──────────────────────────────────────────────────────────
-- p_viewer: 'app' (signed-in participant: full names, user ids, song ids, my
-- song matches), 'guest' / 'kiosk' / 'tv' (first names and parts only).
CREATE OR REPLACE FUNCTION public._jam_state(p_event UUID, p_viewer TEXT, p_me UUID, p_mgr BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e    public.events := public._jam_event(p_event);
  v_full BOOLEAN := p_viewer = 'app';
  v_uid  UUID;
  v_me   public.event_participants;
BEGIN
  SELECT * INTO v_me FROM public.event_participants WHERE id = p_me;
  v_uid := CASE WHEN v_full THEN v_me.user_id END;
  RETURN (
    WITH people AS (
      SELECT p.*, public._jam_name(p.guest_name, p.user_id) AS full_name
        FROM public.event_participants p
       WHERE p.event_id = p_event AND (v_full OR p.rsvp <> 'pending')
    ), items AS (
      SELECT i.* FROM public.event_lineup_items i
       WHERE i.event_id = p_event
         AND (i.state <> 'removed' OR p_mgr)
         AND (i.state <> 'pending' OR v_e.requests_visible OR p_mgr
              OR (p_me IS NOT NULL AND i.pitched_by = p_me))
    ), hands AS (
      SELECT h.*, public._part_id(h.role_key, h.role_label) AS pid
        FROM public.event_hands h
        JOIN items i ON i.id = h.event_lineup_item_id
       WHERE h.status IN ('raised', 'accepted')
    ), slots AS (
      SELECT i.id AS item_id, s.ord, s.part->>'key' AS key, s.part->>'label' AS label,
             public._part_id(s.part->>'key', s.part->>'label') AS pid,
             row_number() OVER (PARTITION BY i.id, public._part_id(s.part->>'key', s.part->>'label') ORDER BY s.ord) AS nth
        FROM items i, jsonb_array_elements(i.parts_needed) WITH ORDINALITY s(part, ord)
    ), acc AS (
      SELECT h.*, row_number() OVER (PARTITION BY h.event_lineup_item_id, h.pid
                                     ORDER BY h.resolved_date NULLS LAST, h.created_date, h.id) AS nth
        FROM hands h WHERE h.status = 'accepted'
    ), slot_rows AS (
      SELECT s.*, a.id AS cast_hand, a.participant_id AS cast_participant,
             (SELECT count(*) FROM hands h
               WHERE h.event_lineup_item_id = s.item_id AND h.pid = s.pid AND h.status = 'raised')::int AS raised
        FROM slots s
        LEFT JOIN acc a ON a.event_lineup_item_id = s.item_id AND a.pid = s.pid AND a.nth = s.nth
    ), cov AS (
      SELECT x.item_id, sum(LEAST(x.n, x.k))::int AS covered, sum(x.n)::int AS total
        FROM (SELECT s.item_id, s.pid, count(*) AS n,
                     (SELECT count(DISTINCT h.participant_id) FROM hands h
                       WHERE h.event_lineup_item_id = s.item_id AND h.pid = s.pid) AS k
                FROM slots s GROUP BY s.item_id, s.pid) x
       GROUP BY x.item_id
    ), ranked AS (
      SELECT i.id, row_number() OVER (
               ORDER BY COALESCE(c.covered, 0)::numeric / NULLIF(COALESCE(c.total, 0), 0) DESC NULLS LAST,
                        i.created_date) AS rank
        FROM items i LEFT JOIN cov c ON c.item_id = i.id
       WHERE i.state IN ('pending', 'open')
    ), mine AS (
      SELECT DISTINCT ON (i.id) i.id AS item_id, s.id AS song_id, 'jam' = ANY (s.tags) AS is_jam_song
        FROM items i
        JOIN public.songs s ON s.context_type = 'personal' AND s.context_id = v_uid::text
                           AND s.normalized_title = public.normalize_text(i.display_title)
                           AND s.normalized_artist = public.normalize_text(COALESCE(i.display_artist, ''))
       WHERE v_uid IS NOT NULL
       ORDER BY i.id, ('jam' = ANY (s.tags)) DESC, s.created_date
    )
    SELECT jsonb_build_object(
      'viewer', p_viewer,
      'jam', jsonb_build_object(
        'id', v_e.id, 'name', v_e.name, 'status', v_e.status,
        'scheduled_date', v_e.scheduled_date, 'end_time', v_e.end_time, 'timezone', v_e.timezone,
        'venue', v_e.venue, 'location', v_e.location, 'description', v_e.description,
        'short_code', v_e.short_code, 'band_id', CASE WHEN v_full THEN v_e.band_id END,
        'host_participant_id', (SELECT p.id FROM people p WHERE p.user_id = v_e.host_user_id),
        'host_name', split_part(public._jam_name(NULL, v_e.host_user_id), ' ', 1),
        'who_can_join', v_e.who_can_join, 'requests_open', v_e.allow_suggestions,
        'approve_myself', NOT v_e.auto_approve, 'requests_visible', v_e.requests_visible,
        'group_size', v_e.group_size, 'joining_locked', v_e.joining_locked,
        'default_parts', v_e.default_parts, 'version', v_e.version),
      'me', CASE WHEN v_me.id IS NULL THEN NULL ELSE jsonb_build_object(
        'participant_id', v_me.id, 'tier', v_me.access_tier, 'via', v_me.via,
        'name', public._jam_name(v_me.guest_name, v_me.user_id), 'parts', v_me.parts,
        'share_songs', v_me.share_songs, 'joined', v_me.rsvp <> 'pending', 'is_house', v_me.is_house,
        'is_host', v_me.user_id IS NOT NULL AND v_me.user_id = v_e.host_user_id, 'is_manager', p_mgr) END,
      'people', COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'participant_id', p.id,
          'user_id', CASE WHEN v_full THEN p.user_id END,
          'name', CASE WHEN v_full THEN p.full_name ELSE split_part(p.full_name, ' ', 1) END,
          'parts', p.parts, 'via', p.via, 'tier', p.access_tier, 'is_house', p.is_house,
          'joined', p.rsvp <> 'pending', 'has_account', p.user_id IS NOT NULL))
          ORDER BY (p.access_tier = 'host') DESC, p.joined_date) FROM people p), '[]'::jsonb),
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'position', i.position, 'queue_position', i.queue_position, 'state', i.state,
          'title', i.display_title, 'artist', i.display_artist, 'tuning', i.tuning, 'key', i.key,
          'song_id', CASE WHEN v_full THEN i.song_id END, 'source', i.source,
          'group_id', i.group_id, 'called_at', i.called_at, 'created_at', i.created_date,
          'pitched_by', i.pitched_by,
          'pitched_by_name', (SELECT CASE WHEN v_full THEN p.full_name ELSE split_part(p.full_name, ' ', 1) END
                                FROM people p WHERE p.id = i.pitched_by),
          'parts_needed', i.parts_needed,
          'covered', COALESCE(c.covered, 0), 'total', COALESCE(c.total, 0), 'rank', r.rank,
          'slots', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'key', sr.key, 'label', sr.label, 'nth', sr.nth,
              'cast', CASE WHEN sr.cast_participant IS NULL THEN NULL ELSE jsonb_build_object(
                'hand_id', sr.cast_hand, 'participant_id', sr.cast_participant,
                'name', (SELECT CASE WHEN v_full THEN p.full_name ELSE split_part(p.full_name, ' ', 1) END
                           FROM people p WHERE p.id = sr.cast_participant)) END,
              'raised', sr.raised, 'gap', sr.cast_participant IS NULL) ORDER BY sr.ord)
            FROM slot_rows sr WHERE sr.item_id = i.id), '[]'::jsonb),
          'hands', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id', h.id, 'participant_id', h.participant_id,
              'name', (SELECT CASE WHEN v_full THEN p.full_name ELSE split_part(p.full_name, ' ', 1) END
                         FROM people p WHERE p.id = h.participant_id),
              'key', h.role_key, 'label', h.role_label, 'status', h.status,
              'mine', p_me IS NOT NULL AND h.participant_id = p_me) ORDER BY h.created_date)
            FROM hands h WHERE h.event_lineup_item_id = i.id), '[]'::jsonb),
          'mine', (SELECT jsonb_build_object('song_id', m.song_id, 'is_jam_song', m.is_jam_song)
                     FROM mine m WHERE m.item_id = i.id))
          ORDER BY i.position, i.created_date)
        FROM items i LEFT JOIN cov c ON c.item_id = i.id LEFT JOIN ranked r ON r.id = i.id), '[]'::jsonb),
      'stage', (SELECT i.id FROM items i WHERE i.state = 'stage'),
      'up_next', (SELECT i.id FROM items i WHERE i.state = 'queued'
                   ORDER BY i.queue_position NULLS LAST, i.position LIMIT 1),
      'queue', COALESCE((SELECT jsonb_agg(i.id ORDER BY i.queue_position NULLS LAST, i.position)
                           FROM items i WHERE i.state = 'queued'), '[]'::jsonb))
  );
END;
$$;

-- Anon: with a guest or kiosk token for this jam, read it (first names and
-- parts only). Signed in: a participant reads it.
CREATE OR REPLACE FUNCTION public.jam_state(p_event UUID, p_guest_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me public.event_participants;
BEGIN
  IF p_guest_token IS NOT NULL AND public._jam_kiosk_ok(p_event, p_guest_token) THEN
    RETURN public._jam_state(p_event, 'kiosk', NULL, false);
  END IF;
  v_me := public._jam_actor(p_event, p_guest_token);
  IF p_guest_token IS NOT NULL THEN
    RETURN public._jam_state(p_event, 'guest', v_me.id, false);
  END IF;
  RETURN public._jam_state(p_event, 'app', v_me.id, public.is_event_manager(p_event, auth.uid()));
END;
$$;

-- Anon: with a code for a 'code' jam, the bar TV: on stage, up next, songs
-- looking for someone. First names and parts only.
CREATE OR REPLACE FUNCTION public.jam_tv_feed(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events;
  v_s JSONB;
BEGIN
  PERFORM public._jam_code_gate('tv', 600);
  v_e := public._jam_find(p_code);
  IF v_e.id IS NULL THEN
    PERFORM public._jam_code_miss();
  END IF;
  IF public._jam_code_refusal(v_e) IS NOT NULL THEN
    RETURN jsonb_build_object('error', public._jam_code_refusal(v_e),
                              'hint', public._jam_copy(public._jam_code_refusal(v_e)));
  END IF;
  IF v_e.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('jam', jsonb_build_object('name', v_e.name, 'status', v_e.status),
                              'code', v_e.short_code, 'stage', NULL, 'up_next', NULL, 'looking_for', '[]'::jsonb);
  END IF;
  v_s := public._jam_state(v_e.id, 'tv', NULL, false);
  RETURN jsonb_build_object(
    'jam', (v_s->'jam') - 'band_id' - 'version' - 'default_parts' - 'host_participant_id',
    'code', v_e.short_code,
    'stage', (SELECT x FROM jsonb_array_elements(v_s->'items') x WHERE x->>'id' = v_s->>'stage'),
    'up_next', (SELECT x FROM jsonb_array_elements(v_s->'items') x WHERE x->>'id' = v_s->>'up_next'),
    'group', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x->>'id', 'title', x->>'title', 'state', x->>'state')
                                        ORDER BY (x->>'position')::int)
                         FROM jsonb_array_elements(v_s->'items') x, jsonb_array_elements(v_s->'items') st
                        WHERE st->>'id' = v_s->>'stage' AND st->>'group_id' IS NOT NULL
                          AND x->>'group_id' = st->>'group_id'), '[]'::jsonb),
    'looking_for', COALESCE((SELECT jsonb_agg(x ORDER BY COALESCE((x->>'rank')::int, 0), (x->>'position')::int)
                               FROM jsonb_array_elements(v_s->'items') x
                              WHERE x->>'state' IN ('open', 'queued', 'pending')
                                AND EXISTS (SELECT 1 FROM jsonb_array_elements(x->'slots') sl WHERE (sl->>'gap')::boolean)),
                            '[]'::jsonb));
END;
$$;

-- who_knows_your_songs: people here whose jam songs match yours (personal
-- songs tagged 'jam', both sides sharing; normalised title + artist). With
-- p_other: that one person, plus the songs only you / only they know.
CREATE OR REPLACE FUNCTION public.who_knows_your_songs(p_event UUID, p_other UUID DEFAULT NULL)
RETURNS TABLE (
  participant_id UUID,
  name           TEXT,
  common_count   INT,
  common         JSONB,
  only_mine      JSONB,
  only_theirs    JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_me  public.event_participants := public._jam_actor(p_event, NULL);
BEGIN
  IF v_me.rsvp = 'pending' OR NOT v_me.share_songs THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH my_songs AS (
    SELECT DISTINCT ON (s.normalized_title, s.normalized_artist) s.id, s.title, s.artist,
           s.normalized_title AS nt, s.normalized_artist AS na
      FROM public.songs s
     WHERE s.context_type = 'personal' AND s.context_id = v_uid::text AND 'jam' = ANY (s.tags)
     ORDER BY s.normalized_title, s.normalized_artist, s.created_date
  ), others AS (
    SELECT p.id, p.user_id, public._jam_name(NULL, p.user_id) AS name
      FROM public.event_participants p
     WHERE p.event_id = p_event AND p.user_id IS NOT NULL AND p.user_id <> v_uid
       AND p.rsvp <> 'pending' AND p.share_songs
       AND (p_other IS NULL OR p.id = p_other)
  ), their_songs AS (
    SELECT DISTINCT ON (o.id, s.normalized_title, s.normalized_artist) o.id AS pid, s.title, s.artist,
           s.normalized_title AS nt, s.normalized_artist AS na
      FROM others o
      JOIN public.songs s ON s.context_type = 'personal' AND s.context_id = o.user_id::text AND 'jam' = ANY (s.tags)
     ORDER BY o.id, s.normalized_title, s.normalized_artist, s.created_date
  )
  SELECT o.id, o.name,
         (SELECT count(*)::int FROM their_songs t JOIN my_songs m ON m.nt = t.nt AND m.na = t.na WHERE t.pid = o.id),
         COALESCE((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'artist', m.artist, 'my_song_id', m.id)
                                    ORDER BY lower(m.title))
                     FROM their_songs t JOIN my_songs m ON m.nt = t.nt AND m.na = t.na WHERE t.pid = o.id), '[]'::jsonb),
         CASE WHEN p_other IS NULL THEN NULL ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'title', m.title, 'artist', m.artist, 'my_song_id', m.id) ORDER BY lower(m.title))
              FROM my_songs m WHERE NOT EXISTS (SELECT 1 FROM their_songs t
                                                 WHERE t.pid = o.id AND t.nt = m.nt AND t.na = m.na)), '[]'::jsonb) END,
         CASE WHEN p_other IS NULL THEN NULL ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'title', t.title, 'artist', t.artist) ORDER BY lower(t.title))
              FROM their_songs t WHERE t.pid = o.id AND NOT EXISTS (SELECT 1 FROM my_songs m
                                                                     WHERE t.nt = m.nt AND t.na = m.na)), '[]'::jsonb) END
    FROM others o
   WHERE p_other IS NOT NULL
      OR EXISTS (SELECT 1 FROM their_songs t JOIN my_songs m ON m.nt = t.nt AND m.na = t.na WHERE t.pid = o.id)
   ORDER BY 3 DESC, o.name;
END;
$$;

-- ── 12. The live night ────────────────────────────────────────────────────────
-- go_live: planned → live; the open lineup becomes the queue, in order.
CREATE OR REPLACE FUNCTION public.go_live(p_event UUID)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_manager(p_event);
BEGIN
  IF v_e.status NOT IN ('scheduled', 'confirmed') THEN
    PERFORM public._jam_fail('not_planned', 'This jam isn''t planned any more.');
  END IF;
  UPDATE public.event_lineup_items SET state = 'queued' WHERE event_id = v_e.id AND state = 'open';
  PERFORM public._jam_requeue(v_e.id, NULL, NULL);
  UPDATE public.events SET status = 'live', updated_date = now() WHERE id = v_e.id RETURNING * INTO v_e;
  RETURN v_e;
END;
$$;

CREATE OR REPLACE FUNCTION public._jam_queue_item(p_item UUID, p_live BOOLEAN DEFAULT true)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_item(p_item);
  v_e    public.events := public._jam_manager(v_item.event_id);
BEGIN
  IF p_live THEN
    PERFORM public._jam_check_live(v_e);
  END IF;
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  RETURN v_item;
END;
$$;

-- queue_pitch: a pending / open song into the queue (p_position 1 = up next).
CREATE OR REPLACE FUNCTION public.queue_pitch(p_item UUID, p_position INT DEFAULT NULL)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_queue_item(p_item);
BEGIN
  IF v_item.state NOT IN ('pending', 'open', 'queued') THEN
    PERFORM public._jam_fail('invalid_state');
  END IF;
  PERFORM public._jam_requeue(v_item.event_id, v_item.id, p_position);
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_queue_item(p_item UUID, p_position INT)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_queue_item(p_item);
BEGIN
  IF v_item.state <> 'queued' THEN
    PERFORM public._jam_fail('invalid_state');
  END IF;
  PERFORM public._jam_requeue(v_item.event_id, v_item.id, p_position);
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.make_up_next(p_item UUID)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.queue_pitch(p_item, 1);
END;
$$;

-- skip_up_next: up next moves behind the song after it.
CREATE OR REPLACE FUNCTION public.skip_up_next(p_event UUID)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e    public.events := public._jam_manager(p_event);
  v_item public.event_lineup_items;
BEGIN
  PERFORM public._jam_check_live(v_e);
  SELECT * INTO v_item FROM public.event_lineup_items
   WHERE event_id = v_e.id AND state = 'queued' ORDER BY queue_position NULLS LAST, position LIMIT 1;
  IF v_item.id IS NULL THEN
    PERFORM public._jam_fail('invalid_state', 'Nothing is up next.');
  END IF;
  PERFORM public._jam_requeue(v_e.id, v_item.id, 2);
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = v_item.id;
  RETURN v_item;
END;
$$;

-- call_up: this song goes on stage (open parts or not); whatever was on stage
-- is played. Returns both so Undo can put them back.
CREATE OR REPLACE FUNCTION public.call_up(p_item UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_queue_item(p_item);
  v_prev public.event_lineup_items;
BEGIN
  IF v_item.state IN ('removed', 'played', 'left') THEN
    PERFORM public._jam_fail('item_closed');
  END IF;
  IF v_item.state <> 'stage' THEN
    UPDATE public.event_lineup_items SET state = 'played', queue_position = NULL
     WHERE event_id = v_item.event_id AND state = 'stage'
    RETURNING * INTO v_prev;
    UPDATE public.event_lineup_items SET state = 'stage', called_at = now(), queue_position = NULL
     WHERE id = v_item.id RETURNING * INTO v_item;
    PERFORM public._jam_requeue(v_item.event_id, NULL, NULL);
  END IF;
  RETURN jsonb_build_object('called', to_jsonb(v_item),
                            'previous', CASE WHEN v_prev.id IS NULL THEN NULL ELSE to_jsonb(v_prev) END);
END;
$$;

-- set_queue_state: open / removed at any time; queued / stage / played / left
-- while live (stage only when the stage is free). Undo uses the same call.
CREATE OR REPLACE FUNCTION public.set_queue_state(p_item UUID, p_state TEXT, p_position INT DEFAULT NULL)
RETURNS public.event_lineup_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.event_lineup_items := public._jam_queue_item(p_item, false);
  v_e    public.events := public._jam_event(v_item.event_id);
BEGIN
  IF p_state NOT IN ('open', 'queued', 'stage', 'played', 'left', 'removed') THEN
    PERFORM public._jam_fail('invalid_state');
  END IF;
  IF p_state NOT IN ('open', 'removed') THEN
    PERFORM public._jam_check_live(v_e);
  ELSE
    PERFORM public._jam_check_open(v_e);
  END IF;
  IF p_state = 'stage' AND v_item.state <> 'stage'
     AND EXISTS (SELECT 1 FROM public.event_lineup_items WHERE event_id = v_e.id AND state = 'stage') THEN
    PERFORM public._jam_fail('stage_busy');
  END IF;
  IF p_state = 'queued' THEN
    PERFORM public._jam_requeue(v_e.id, v_item.id, p_position);
  ELSE
    UPDATE public.event_lineup_items
       SET state = p_state,
           queue_position = NULL,
           called_at = CASE WHEN p_state IN ('stage', 'played') THEN COALESCE(called_at, now()) ELSE called_at END
     WHERE id = v_item.id;
    PERFORM public._jam_requeue(v_e.id, NULL, NULL);
  END IF;
  SELECT * INTO v_item FROM public.event_lineup_items WHERE id = p_item;
  RETURN v_item;
END;
$$;

-- ask_the_room: a 'nudge' broadcast {item_id, part, title}; clients show it to
-- people who play that part. No table, no push.
CREATE OR REPLACE FUNCTION public.ask_the_room(p_item UUID, p_part JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item  public.event_lineup_items := public._jam_queue_item(p_item);
  v_e     public.events := public._jam_event(v_item.event_id);
  v_parts JSONB := public._jam_parts(jsonb_build_array(p_part));
BEGIN
  IF v_parts IS NULL OR NOT public._jam_has_part(v_item.parts_needed, v_parts->0->>'key', v_parts->0->>'label') THEN
    PERFORM public._jam_fail('part_not_needed');
  END IF;
  PERFORM realtime.send(jsonb_build_object('item_id', v_item.id, 'part', v_parts->0, 'title', v_item.display_title),
                        'nudge', 'jam:' || v_e.short_code, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_house_player(p_participant UUID, p_on BOOLEAN)
RETURNS public.event_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.event_participants := public._jam_participant(p_participant);
  v_e public.events := public._jam_manager(v_p.event_id);
BEGIN
  UPDATE public.event_participants SET is_house = COALESCE(p_on, false) WHERE id = v_p.id RETURNING * INTO v_p;
  RETURN v_p;
END;
$$;

-- remove_person: hosts / co-hosts; never the host, and co-hosts can't remove
-- co-hosts. Their hands, lone pitches and token go.
CREATE OR REPLACE FUNCTION public.remove_person(p_participant UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.event_participants := public._jam_participant(p_participant);
  v_e public.events := public._jam_manager(v_p.event_id);
BEGIN
  IF v_p.user_id IS NOT NULL AND v_p.user_id = v_e.host_user_id THEN
    PERFORM public._jam_fail('cannot_remove_host');
  END IF;
  IF v_p.access_tier = 'cohost' AND auth.uid() <> v_e.host_user_id THEN
    PERFORM public._jam_fail('forbidden');
  END IF;
  PERFORM public._jam_drop_person(v_p);
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_joining(p_event UUID, p_on BOOLEAN)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_manager(p_event);
BEGIN
  UPDATE public.events SET joining_locked = COALESCE(p_on, false) WHERE id = v_e.id RETURNING * INTO v_e;
  RETURN v_e;
END;
$$;

-- start_kiosk: a kiosk token (for the QR, kept in the URL hash) and a one-time
-- 6-character pairing code good for 10 minutes. 'code' jams only.
CREATE OR REPLACE FUNCTION public.start_kiosk(p_event UUID)
RETURNS TABLE (token TEXT, pairing_code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e     public.events := public._jam_manager(p_event);
  v_token TEXT := public._jam_new_token();
  v_code  TEXT;
  v_until TIMESTAMPTZ := now() + interval '10 minutes';
BEGIN
  PERFORM public._jam_check_open(v_e);
  IF v_e.who_can_join <> 'code' THEN
    PERFORM public._jam_fail('invite_only');
  END IF;
  DELETE FROM public.event_kiosk_pairings
   WHERE event_kiosk_pairings.event_id = v_e.id
     AND (event_kiosk_pairings.used_at IS NOT NULL OR event_kiosk_pairings.expires_at < now());
  LOOP
    v_code := public._random_code(6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.event_kiosk_pairings k WHERE k.code_hash = public._jam_hash(v_code));
  END LOOP;
  INSERT INTO public.event_kiosk_pairings (code_hash, event_id, expires_at)
  VALUES (public._jam_hash(v_code), v_e.id, v_until);
  INSERT INTO public.event_guest_tokens (token_hash, event_id, participant_id, kind)
  VALUES (public._jam_hash(v_token), v_e.id, NULL, 'kiosk');
  RETURN QUERY SELECT v_token, v_code, v_until;
END;
$$;

-- Anon: with a live one-time pairing code, get that jam's kiosk token.
CREATE OR REPLACE FUNCTION public.pair_kiosk(p_pairing_code TEXT)
RETURNS TABLE (event_id UUID, short_code TEXT, token TEXT, error TEXT, hint TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_k     public.event_kiosk_pairings;
  v_e     public.events;
  v_token TEXT := public._jam_new_token();
BEGIN
  PERFORM public._jam_rate_check('pair', public._jam_ip(), 10, interval '10 minutes');
  SELECT k.* INTO v_k FROM public.event_kiosk_pairings k
   WHERE k.code_hash = public._jam_hash(public._jam_code(p_pairing_code))
     AND k.used_at IS NULL AND k.expires_at > now()
   FOR UPDATE;
  SELECT * INTO v_e FROM public.events e WHERE e.id = v_k.event_id;
  IF v_k.code_hash IS NULL OR v_e.id IS NULL OR v_e.status IN ('completed', 'cancelled')
     OR v_e.who_can_join <> 'code' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, 'pairing_invalid'::text, public._jam_copy('pairing_invalid');
    RETURN;
  END IF;
  UPDATE public.event_kiosk_pairings SET used_at = now() WHERE code_hash = v_k.code_hash;
  INSERT INTO public.event_guest_tokens (token_hash, event_id, participant_id, kind)
  VALUES (public._jam_hash(v_token), v_e.id, NULL, 'kiosk');
  RETURN QUERY SELECT v_e.id, v_e.short_code, v_token, NULL::text, NULL::text;
END;
$$;

-- end_jam: live → ended in one go. Hands go; songs not played go to
-- 'removed' (the one on stage counts as played); web / walk-up / kiosk people
-- go (their names with them); every token and pairing code dies.
CREATE OR REPLACE FUNCTION public.end_jam(p_event UUID)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e public.events := public._jam_manager(p_event);
BEGIN
  PERFORM public._jam_check_live(v_e);
  DELETE FROM public.event_hands WHERE event_id = v_e.id;
  UPDATE public.event_lineup_items SET state = 'played', called_at = COALESCE(called_at, now())
   WHERE event_id = v_e.id AND state = 'stage';
  UPDATE public.event_lineup_items SET state = 'removed', queue_position = NULL
   WHERE event_id = v_e.id AND state NOT IN ('played', 'removed');
  DELETE FROM public.event_participants WHERE event_id = v_e.id AND via IN ('web', 'walkup', 'kiosk');
  DELETE FROM public.event_guest_tokens WHERE event_id = v_e.id;
  DELETE FROM public.event_kiosk_pairings WHERE event_id = v_e.id;
  UPDATE public.events SET status = 'completed', joining_locked = false, updated_date = now()
   WHERE id = v_e.id RETURNING * INTO v_e;
  RETURN v_e;
END;
$$;

-- save_jam_as_setlist: tonight's played songs, in the order they were called,
-- as a new setlist tagged 'jam' in your personal catalog or a band's. Songs the
-- context doesn't have (by id, then normalised title + artist) are added there.
CREATE OR REPLACE FUNCTION public.save_jam_as_setlist(p_event UUID, p_context_type TEXT, p_context_id TEXT DEFAULT NULL)
RETURNS public.setlists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_e     public.events := public._jam_manager(p_event, false);
  v_uid   UUID := auth.uid();
  v_ctx   TEXT;
  v_items JSONB := '[]'::jsonb;
  v_seen  UUID[] := '{}';
  v_sid   UUID;
  r       RECORD;
  v_set   public.setlists;
BEGIN
  IF p_context_type = 'personal' THEN
    v_ctx := v_uid::text;
  ELSIF p_context_type = 'band' AND p_context_id IS NOT NULL
        AND public.is_band_member(p_context_id::uuid, v_uid) THEN
    v_ctx := p_context_id;
  ELSE
    PERFORM public._jam_fail('forbidden');
  END IF;
  FOR r IN SELECT i.* FROM public.event_lineup_items i
            WHERE i.event_id = v_e.id AND i.state IN ('played', 'stage')
            ORDER BY i.called_at NULLS LAST, i.position LOOP
    SELECT s.id INTO v_sid FROM public.songs s
     WHERE s.context_type = p_context_type AND s.context_id = v_ctx
       AND (s.id = r.song_id
            OR (s.normalized_title = public.normalize_text(r.display_title)
                AND s.normalized_artist = public.normalize_text(COALESCE(r.display_artist, ''))))
     ORDER BY (s.id = r.song_id) DESC, s.created_date
     LIMIT 1;
    IF v_sid IS NULL THEN
      INSERT INTO public.songs (title, artist, key, context_type, context_id, created_by, visibility, last_modified_by)
      VALUES (r.display_title, NULLIF(r.display_artist, ''), r.key, p_context_type, v_ctx, v_uid,
              CASE p_context_type WHEN 'personal' THEN 'personal' ELSE 'band' END, v_uid)
      RETURNING id INTO v_sid;
    END IF;
    IF NOT v_sid = ANY (v_seen) THEN
      v_seen := v_seen || v_sid;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text, 'type', 'song', 'songId', v_sid::text));
    END IF;
  END LOOP;
  IF jsonb_array_length(v_items) = 0 THEN
    PERFORM public._jam_fail('nothing_played');
  END IF;
  INSERT INTO public.setlists (name, band_id, context_type, context_id, created_by, tags, items, last_modified_by)
  VALUES (v_e.name, CASE WHEN p_context_type = 'band' THEN v_ctx::uuid END, p_context_type, v_ctx, v_uid,
          ARRAY['jam'], v_items, v_uid)
  RETURNING * INTO v_set;
  RETURN v_set;
END;
$$;

-- ── 13. Legacy code join: codes only work in 'code' jams ──────────────────────
CREATE OR REPLACE FUNCTION public.join_event_by_code(p_code TEXT)
RETURNS TABLE (out_event_id UUID, out_name TEXT, out_host_name TEXT, out_scheduled_date TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := (SELECT auth.uid());
  v_code   TEXT := public._jam_code(p_code);
  v_event  public.events%ROWTYPE;
BEGIN
  -- Unauthenticated or empty code → no match (no enumeration surface).
  IF v_caller IS NULL OR v_code = '' THEN
    RETURN;
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.short_code = v_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = v_event.id AND user_id = v_caller) THEN
    IF v_event.who_can_join <> 'code' OR v_event.joining_locked
       OR v_event.status IN ('completed', 'cancelled') THEN
      RETURN;
    END IF;
    INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp)
    VALUES (v_event.id, v_caller, 'guest', 'going')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;
  RETURN QUERY
    SELECT v_event.id, v_event.name,
           (SELECT u.name FROM public.users u WHERE u.id = v_event.host_user_id),
           v_event.scheduled_date;
END;
$$;

-- ── 14. Retire 0.3 jam sessions (7d): stop the reads, keep the tables ────────
DROP POLICY IF EXISTS songs_select_jam_coparticipant ON public.songs;
DROP POLICY IF EXISTS users_select_jam_coparticipant ON public.users;
DROP POLICY IF EXISTS user_profiles_select_jam_coparticipant ON public.user_profiles;
REVOKE ALL ON FUNCTION public.join_jam_session(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_jam_session_by_code(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_jam_matches(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ── 15. Grants ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
  -- Anon: the token / code functions, each marked "Anon:" above.
  v_anon TEXT[] := ARRAY[
    'public.jam_preview_by_code(text)',
    'public.resolve_code(text)',
    'public.join_jam_as_web_guest(text, text, jsonb)',
    'public.update_me(uuid, text, jsonb, boolean, text)',
    'public.leave_jam(uuid, text)',
    'public.add_walkup(uuid, text, jsonb, text, uuid, text, text, text)',
    'public.pitch_song(uuid, uuid, text, text, jsonb, jsonb, uuid, text)',
    'public.raise_hand(uuid, jsonb, text)',
    'public.lower_hand(uuid, text)',
    'public.jam_state(uuid, text)',
    'public.jam_tv_feed(text)',
    'public.pair_kiosk(text)'
  ];
  v_anon_oids OID[];
  r RECORD;
BEGIN
  SELECT array_agg(to_regprocedure(x)::oid) INTO v_anon_oids FROM unnest(v_anon) x;
  FOREACH f IN ARRAY v_anon LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.create_jam(text, timestamptz, text, text, uuid, text, jsonb)',
    'public.update_jam(uuid, jsonb, integer)',
    'public.set_jam_settings(uuid, text, boolean, boolean, integer, boolean, jsonb)',
    'public.set_cohost(uuid, boolean)',
    'public.delete_jam(uuid)',
    'public.invite_to_jam(uuid, uuid[])',
    'public.join_jam(text, jsonb, boolean)',
    'public.join_jam_by_id(uuid, jsonb, boolean)',
    'public.list_my_jams()',
    'public.add_lineup_songs(uuid, uuid[], jsonb)',
    'public.add_lineup_title(uuid, text, text, jsonb)',
    'public.set_item_parts(uuid, jsonb)',
    'public.reorder_lineup(uuid, uuid[])',
    'public.approve_pitch(uuid)',
    'public.decline_pitch(uuid)',
    'public.set_cast(uuid, jsonb, uuid, boolean)',
    'public.who_knows_your_songs(uuid, uuid)',
    'public.go_live(uuid)',
    'public.queue_pitch(uuid, integer)',
    'public.move_queue_item(uuid, integer)',
    'public.make_up_next(uuid)',
    'public.skip_up_next(uuid)',
    'public.call_up(uuid)',
    'public.set_queue_state(uuid, text, integer)',
    'public.ask_the_room(uuid, jsonb)',
    'public.mark_house_player(uuid, boolean)',
    'public.remove_person(uuid)',
    'public.lock_joining(uuid, boolean)',
    'public.start_kiosk(uuid)',
    'public.end_jam(uuid)',
    'public.save_jam_as_setlist(uuid, text, text)',
    'public.join_event_by_code(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public._random_code(integer)',
    'public._jam_code(text)',
    'public._jam_fail(text, text)',
    'public._jam_copy(text)',
    'public._jam_find(text)',
    'public._jam_code_refusal(public.events, boolean)',
    'public._part_id(text, text)',
    'public._jam_parts(jsonb, boolean)',
    'public._jam_has_part(jsonb, text, text)',
    'public._jam_name(text, uuid)',
    'public._jam_hash(text)',
    'public._jam_new_token()',
    'public._jam_ip()',
    'public._jam_rate_check(text, text, integer, interval)',
    'public._jam_code_gate(text, integer)',
    'public._jam_code_miss()',
    'public._jam_event(uuid, boolean)',
    'public._jam_manager(uuid, boolean)',
    'public._jam_host(uuid, boolean)',
    'public._jam_check_open(public.events)',
    'public._jam_check_live(public.events)',
    'public._jam_actor(uuid, text)',
    'public._jam_kiosk_ok(uuid, text)',
    'public._jam_by_code(text)',
    'public._jam_is_host_friend(public.events, uuid)',
    'public._jam_can_read_song(public.songs, uuid)',
    'public._jam_item(uuid)',
    'public._jam_participant(uuid)',
    'public._jam_notify(uuid, text, text, text, jsonb)',
    'public._jam_when(public.events)',
    'public._jam_raise(public.event_lineup_items, public.event_participants, jsonb)',
    'public._jam_pitch(public.events, public.event_participants, boolean, uuid, text, text, jsonb, jsonb, uuid)',
    'public._jam_drop_person(public.event_participants)',
    'public._jam_requeue(uuid, uuid, integer)',
    'public._jam_join(public.events, uuid, jsonb, boolean)',
    'public._jam_state(uuid, text, uuid, boolean)',
    'public._jam_queue_item(uuid, boolean)',
    'public._jam_backfill_requests()',
    'public.gen_event_code()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;

  -- Every other public function: not for anon (decision 12: the anon surface is
  -- the list above). Trigger functions and extension members are skipped;
  -- authenticated / service_role keep what they had.
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.prorettype <> 'trigger'::regtype
       AND p.prokind = 'f'
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND p.oid <> ALL (v_anon_oids)
  LOOP
    IF r.auth_ok THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- ── release_notes: 1.0.0 ─────────────────────────────────────────────────────
DELETE FROM public.release_notes
 WHERE version IN ('0.6.0', '0.6.1', '0.7.0', '0.8.0', '0.9.0', '0.9.1', '0.10.0', '0.11.0');

INSERT INTO public.release_notes (version, title, body) VALUES (
  '1.0.0',
  'A whole new Rock On',
  $md$Rock On has been rebuilt from the ground up, with a fresh look and everything
your band needs in fewer taps:

- **Songs** open as a page, with chords and lyrics you can read on stage, links,
  notes and the song's tuning.
- **Setlists** edit in place: drag to reorder, breaks and sections, retunes
  between songs, and a running time against your slot.
- **One Calendar** for shows, practices and jams. Plan a practice from a
  setlist, then run it live with big Prev / Next buttons, the chart on screen
  and a wrap-up at the end.
- **Jam**: host a night, share a code, and let anyone join from their phone, no
  account needed.
- **Tools**: a tuner, a metronome and chord charts, one tap from any song.
- **Your band and friends**: invite by link or code, band roles, and privacy
  settings for what friends see.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
