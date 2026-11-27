-- Test: phase 7 Jam contract (signed-in side): matching + tags, codes, create /
--       update / settings / co-host, join by code / by id, invites, hub,
--       lineup, pitches, hands, cast + grid, who knows your songs, the live
--       night, end, save as setlist, delete, backfill, legacy pages,
--       delete_account with guests, realtime broadcast.
-- Category: Functions + access
-- Created: 2026-11-20

begin;

select plan(146);

DO $$
DECLARE e TEXT;
BEGIN
  FOREACH e IN ARRAY ARRAY['host', 'co', 'fr', 'inv', 'gst', 'gst2', 'str', 'own', 'mate', 'del'] LOOP
    PERFORM tests.create_supabase_user('p7-' || e || '@test.com');
    PERFORM set_config('test.' || e, tests.get_supabase_uid('p7-' || e || '@test.com')::text, true);
  END LOOP;
END $$;

-- Friends of host: fr, inv, co. gst ↔ str are friends.
INSERT INTO public.friendships (user_a, user_b)
SELECT LEAST(a, b), GREATEST(a, b) FROM (VALUES
  (current_setting('test.host')::uuid, current_setting('test.fr')::uuid),
  (current_setting('test.host')::uuid, current_setting('test.inv')::uuid),
  (current_setting('test.host')::uuid, current_setting('test.co')::uuid),
  (current_setting('test.gst')::uuid,  current_setting('test.str')::uuid)) v(a, b);

-- A band owned by own; host, mate and del are members.
select tests.authenticate_as('p7-own@test.com');
DO $$ BEGIN
  PERFORM set_config('test.band', (SELECT id::text FROM public.create_band('P7 Band')), true);
END $$;
reset role;
INSERT INTO public.band_memberships (band_id, user_id, role, status, permissions)
SELECT current_setting('test.band')::uuid, u, 'member', 'active', '{member}'
  FROM unnest(ARRAY[current_setting('test.host')::uuid, current_setting('test.mate')::uuid,
                    current_setting('test.del')::uuid]) u;

-- ── A. Matching and tags ────────────────────────────────────────────────────
select is(public.normalize_text('The Killers'), 'killers', 'normalize_text: drops a leading "the"');
select is(public.normalize_text('Plush (Live)'), 'plush', 'normalize_text: drops "(Live)"');
select is(public.normalize_text('Black [Remastered 2011]'), 'black', 'normalize_text: drops "[...]"');
select is(public.normalize_text('Don''t  Stop   Believin'''), 'dont stop believin',
  'normalize_text: drops apostrophes, squashes spaces');
select is(public.normalize_text('Mr. Brightside'), public.normalize_text('mr brightside'),
  'normalize_text: punctuation and case don''t matter');
INSERT INTO public.songs (id, title, artist, context_type, context_id, created_by, visibility) VALUES
  ('77000000-0000-4000-8000-0000000000a1', 'Plush (Live)', 'The Stone Temple Pilots', 'personal',
   current_setting('test.host'), current_setting('test.host')::uuid, 'personal');
select is((SELECT normalized_title || '|' || normalized_artist || '|' || cardinality(tags)
             FROM public.songs WHERE id = '77000000-0000-4000-8000-0000000000a1'),
  'plush|stone temple pilots|0', 'songs: generated columns use the new matcher; tags default to {}');
select ok((SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.event_guest_tokens'::regclass, 'public.event_kiosk_pairings'::regclass,
                          'public.jam_rate_limits'::regclass)),
  'new tables: RLS on');
select ok((SELECT bool_and(has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE'))
             FROM unnest(ARRAY['authenticated', 'service_role']) r,
                  unnest(ARRAY['public.event_guest_tokens', 'public.event_kiosk_pairings', 'public.jam_rate_limits']) t),
  'new tables: explicit grants to authenticated and service_role');
select is((SELECT count(*)::int FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('event_guest_tokens', 'event_kiosk_pairings', 'jam_rate_limits')),
  0, 'new tables: no policies (functions only)');

-- ── B. Codes ────────────────────────────────────────────────────────────────
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN
  PERFORM set_config('test.j1', (SELECT id::text FROM public.create_jam('  Friday Jam ', now() + interval '2 days',
    'America/Los_Angeles', 'Lucky''s')), true);
  PERFORM set_config('test.j2', (SELECT id::text FROM public.create_jam('Friends Jam', now() + interval '3 days',
    p_who_can_join => 'friends')), true);
  PERFORM set_config('test.j3', (SELECT id::text FROM public.create_jam('Invite Jam', now() + interval '4 days',
    p_who_can_join => 'invite')), true);
  PERFORM set_config('test.j4', (SELECT id::text FROM public.create_jam('Band Friends Jam', now() + interval '5 days',
    p_band_id => current_setting('test.band')::uuid, p_who_can_join => 'friends',
    p_default_parts => '["vox", {"key": "other", "label": " Harmonica "}]')), true);
END $$;
reset role;
DO $$ BEGIN
  PERFORM set_config('test.c1', (SELECT short_code FROM public.events WHERE id = current_setting('test.j1')::uuid), true);
  PERFORM set_config('test.c3', (SELECT short_code FROM public.events WHERE id = current_setting('test.j3')::uuid), true);
  PERFORM set_config('test.hp1', (SELECT id::text FROM public.event_participants
    WHERE event_id = current_setting('test.j1')::uuid AND user_id = current_setting('test.host')::uuid), true);
END $$;
select matches(current_setting('test.c1'), '^[A-HJ-NP-Z2-9]{8}$', 'create_jam: an 8-character code without look-alikes');
select ok((SELECT prosrc ILIKE '%invite_codes%' FROM pg_proc WHERE oid = 'public.gen_event_code()'::regprocedure)
          AND (SELECT prosrc ILIKE '%public.events%' FROM pg_proc WHERE oid = 'public._new_invite_code()'::regprocedure),
  'codes: each generator checks the other table');
INSERT INTO public.events (id, host_user_id, name, scheduled_date, visibility)
VALUES ('77000000-0000-4000-8000-0000000000e9', current_setting('test.host')::uuid, 'Legacy private', now(), 'private');
select ok((SELECT short_code IS NOT NULL FROM public.events WHERE id = '77000000-0000-4000-8000-0000000000e9'),
  'codes: every event gets one, even private (it names the realtime topic)');

-- ── C. Create, update, settings, co-host ────────────────────────────────────
select is((SELECT name || '|' || who_can_join || '|' || venue || '|' || timezone || '|' || status
             FROM public.events WHERE id = current_setting('test.j1')::uuid),
  'Friday Jam|code|Lucky''s|America/Los_Angeles|scheduled', 'create_jam: name trimmed, code mode by default');
select is((SELECT access_tier || '/' || rsvp || '/' || via FROM public.event_participants
            WHERE event_id = current_setting('test.j1')::uuid AND user_id = current_setting('test.host')::uuid),
  'host/going/app', 'create_jam: the caller is the host participant');
select is((SELECT default_parts FROM public.events WHERE id = current_setting('test.j1')::uuid),
  '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]'::jsonb,
  'create_jam: default parts vox, guitar, bass, drums');
select is((SELECT default_parts FROM public.events WHERE id = current_setting('test.j4')::uuid),
  '[{"key":"vox"},{"key":"other","label":"Harmonica"}]'::jsonb,
  'create_jam: custom parts (strings or {key, label}) stored as {key, label?}');
select tests.authenticate_as('p7-host@test.com');
select throws_ok($$ SELECT public.create_jam('  ', now()) $$, 'P0001', 'name_required', 'create_jam: a blank name → name_required');
select throws_ok($$ SELECT public.create_jam('X', now(), p_who_can_join => 'everyone') $$, 'P0001', 'invalid_setting',
  'create_jam: an unknown who_can_join → invalid_setting');
select throws_ok($$ SELECT public.create_jam('X', now(), p_default_parts => '["kazoo"]') $$, 'P0001', 'invalid_parts',
  'create_jam: a part outside the vocabulary → invalid_parts');
select tests.authenticate_as('p7-str@test.com');
select throws_ok(format($$ SELECT public.create_jam('X', now(), p_band_id => %L) $$, current_setting('test.band')),
  'P0001', 'forbidden', 'create_jam: a band you''re not in → forbidden');

select tests.authenticate_as('p7-host@test.com');
select is((SELECT name || '|' || version FROM public.update_jam(current_setting('test.j1')::uuid,
            '{"name": "Friday Night Jam", "venue": ""}', 1)),
  'Friday Night Jam|2', 'update_jam: patched, version bumped');
select ok((SELECT venue IS NULL FROM public.events WHERE id = current_setting('test.j1')::uuid), 'update_jam: '''' clears venue');
select throws_ok(format($$ SELECT public.update_jam(%L, '{"name": "Again"}', 1) $$, current_setting('test.j1')),
  'P0001', 'stale_version', 'update_jam: an old version → stale_version');
select is((SELECT auto_approve::text || group_size || requests_visible::text
             FROM public.set_jam_settings(current_setting('test.j1')::uuid, p_approve_myself => false,
                                          p_group_size => 3, p_requests_visible => true)),
  'true3true', 'set_jam_settings: approve myself off = auto_approve; group size');
select throws_ok(format($$ SELECT public.set_jam_settings(%L, p_group_size => 9) $$, current_setting('test.j1')),
  'P0001', 'invalid_setting', 'set_jam_settings: group size over 5 → invalid_setting');
DO $$ BEGIN PERFORM public.set_jam_settings(current_setting('test.j1')::uuid, p_approve_myself => true); END $$;

-- ── D. Joins, invites, hub ──────────────────────────────────────────────────
select tests.authenticate_as('p7-gst@test.com');
select is((SELECT access_tier || '/' || rsvp || '/' || via || '/' || parts::text
             FROM public.join_jam(current_setting('test.c1'), '["bass", "bass", "vox"]')),
  'guest/going/app/[{"key": "bass"}, {"key": "vox"}]', 'join_jam: a guest, Going, parts de-duplicated');
DO $$ BEGIN PERFORM set_config('test.gp1', (SELECT id::text FROM public.join_jam(current_setting('test.c1'))), true); END $$;
select is((SELECT count(*)::int FROM public.event_participants
            WHERE event_id = current_setting('test.j1')::uuid AND user_id = current_setting('test.gst')::uuid),
  1, 'join_jam: joining again keeps one row');
select tests.authenticate_as('p7-gst2@test.com');
select lives_ok(format($$ SELECT public.join_jam(%L) $$,
  lower(substr(current_setting('test.c1'), 1, 4)) || '-' || lower(substr(current_setting('test.c1'), 5))),
  'join_jam: the code works lowercase, with the hyphen');
select throws_ok(format($$ SELECT public.join_jam(%L) $$, current_setting('test.c3')), 'P0001', 'invite_only',
  'join_jam: an invite-only jam''s code → invite_only');
select throws_ok($$ SELECT public.join_jam('ZZZZ2222') $$, 'P0001', 'no_jam', 'join_jam: a wrong code → no_jam');
select tests.authenticate_as('p7-mate@test.com');
DO $$ BEGIN PERFORM public.join_jam(current_setting('test.c1')); END $$;

select tests.authenticate_as('p7-host@test.com');
select is((SELECT access_tier FROM public.set_cohost(
            (SELECT p.id FROM public.event_participants p WHERE p.event_id = current_setting('test.j1')::uuid
               AND p.user_id = current_setting('test.gst2')::uuid), true)),
  'cohost', 'set_cohost: the host makes a co-host');
select tests.authenticate_as('p7-gst2@test.com');
select throws_ok(format($$ SELECT public.update_jam(%L, '{"name": "Mine"}', 2) $$, current_setting('test.j1')),
  'P0001', 'forbidden', 'update_jam: a co-host can''t (host only)');
select throws_ok(format($$ SELECT public.set_cohost(%L, true) $$, current_setting('test.gp1')),
  'P0001', 'forbidden', 'set_cohost: a co-host can''t');

select tests.authenticate_as('p7-fr@test.com');
select is((SELECT rsvp FROM public.join_jam_by_id(current_setting('test.j2')::uuid)), 'going',
  'join_jam_by_id: the host''s friend joins a friends jam');
select tests.authenticate_as('p7-str@test.com');
select throws_ok(format($$ SELECT public.join_jam_by_id(%L) $$, current_setting('test.j2')), 'P0001', 'forbidden',
  'join_jam_by_id: a stranger can''t join a friends jam');
select throws_ok(format($$ SELECT public.join_jam_by_id(%L) $$, current_setting('test.j3')), 'P0001', 'forbidden',
  'join_jam_by_id: a stranger can''t join an invite-only jam');
select tests.authenticate_as('p7-mate@test.com');
select lives_ok(format($$ SELECT public.join_jam_by_id(%L) $$, current_setting('test.j4')),
  'join_jam_by_id: a bandmate joins the band''s friends jam');

select tests.authenticate_as('p7-host@test.com');
select is((SELECT count(*)::int FROM public.invite_to_jam(current_setting('test.j3')::uuid,
            ARRAY[current_setting('test.inv')::uuid, current_setting('test.host')::uuid])),
  1, 'invite_to_jam: the host invites a friend (yourself is skipped)');
select is((SELECT count(*)::int FROM public.invite_to_jam(current_setting('test.j3')::uuid,
            ARRAY[current_setting('test.inv')::uuid])),
  0, 'invite_to_jam: someone already invited is skipped');
select throws_ok(format($$ SELECT public.invite_to_jam(%L, ARRAY[%L]::uuid[]) $$, current_setting('test.j3'), current_setting('test.str')),
  'P0001', 'not_friend', 'invite_to_jam: not your friend → not_friend');
select tests.authenticate_as('p7-inv@test.com');
select is((SELECT title || '|' || link || '|' || (payload->>'type') FROM public.notifications
            WHERE user_id = current_setting('test.inv')::uuid AND kind = 'event'),
  format('p7-host invited you to Invite Jam|/jam/%s|jam_invite', current_setting('test.j3')),
  'invite_to_jam: the invitee gets a notification linking to the jam');
select is((SELECT section || '/' || joined::text FROM public.list_my_jams() WHERE id = current_setting('test.j3')::uuid),
  'invited/false', 'list_my_jams: an invite shows under Invited, not joined yet');
select throws_ok(format($$ SELECT public.invite_to_jam(%L, ARRAY[%L]::uuid[]) $$, current_setting('test.j3'), current_setting('test.host')),
  'P0001', 'forbidden', 'invite_to_jam: an invitee who hasn''t joined can''t invite');
select is((SELECT rsvp FROM public.join_jam_by_id(current_setting('test.j3')::uuid)), 'going',
  'join_jam_by_id: an invitee joins an invite-only jam');
select throws_ok(format($$ SELECT public.invite_to_jam(%L, ARRAY[%L]::uuid[]) $$, current_setting('test.j3'), current_setting('test.host')),
  'P0001', 'forbidden', 'invite_to_jam: participants can''t invite in invite-only jams');
select tests.authenticate_as('p7-gst@test.com');
select is((SELECT count(*)::int FROM public.invite_to_jam(current_setting('test.j1')::uuid, ARRAY[current_setting('test.str')::uuid])),
  1, 'invite_to_jam: a participant invites their own friend in a code jam');
select tests.authenticate_as('p7-co@test.com');
select is((SELECT string_agg(section || ':' || name, ', ' ORDER BY name) FROM public.list_my_jams()),
  'friends:Band Friends Jam, friends:Friends Jam',
  'list_my_jams: friends-mode jams by my friends that I''m not in show as Friends'' jams');
select tests.authenticate_as('p7-host@test.com');
select is((SELECT string_agg(section, ',' ORDER BY name) FROM public.list_my_jams()),
  'hosting,hosting,hosting,hosting', 'list_my_jams: the host sees Hosting (jams they''re a participant of)');

-- ── E. Lineup ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('test.i1', (SELECT id::text FROM public.add_lineup_songs(current_setting('test.j1')::uuid,
    ARRAY['77000000-0000-4000-8000-0000000000a1'::uuid])), true);
  PERFORM set_config('test.i2', (SELECT id::text FROM public.add_lineup_title(current_setting('test.j1')::uuid,
    ' Seven Nation Army ', 'The White Stripes')), true);
  PERFORM set_config('test.i3', (SELECT id::text FROM public.add_lineup_title(current_setting('test.j4')::uuid, 'Low Rider', 'War')), true);
END $$;
select is((SELECT source || '|' || display_title || '|' || state || '|' || jsonb_array_length(parts_needed)
             FROM public.event_lineup_items WHERE id = current_setting('test.i1')::uuid),
  'mine|Plush (Live)|open|4', 'add_lineup_songs: copies the song, open, the jam''s parts');
select is((SELECT parts_needed FROM public.event_lineup_items WHERE id = current_setting('test.i3')::uuid),
  '[{"key":"vox"},{"key":"other","label":"Harmonica"}]'::jsonb, 'add_lineup_title: starts from the jam''s default parts');
select throws_ok(format($$ SELECT public.add_lineup_title(%L, '  ') $$, current_setting('test.j1')), 'P0001', 'title_required',
  'add_lineup_title: blank → title_required');
select throws_ok(format($$ SELECT public.add_lineup_title(%L, repeat('x', 81)) $$, current_setting('test.j1')), 'P0001', 'title_too_long',
  'add_lineup_title: over 80 → title_too_long');
select is((SELECT jsonb_array_length(parts_needed) FROM public.set_item_parts(current_setting('test.i2')::uuid,
            '["vox", "guitar", "guitar", "bass", "drums"]')),
  5, 'set_item_parts: duplicate slots allowed (Guitar 2)');
select throws_ok(format($$ SELECT public.set_item_parts(%L, '[]') $$, current_setting('test.i2')), 'P0001', 'invalid_parts',
  'set_item_parts: no parts → invalid_parts');
DO $$ BEGIN PERFORM public.reorder_lineup(current_setting('test.j1')::uuid, ARRAY[current_setting('test.i2')::uuid]); END $$;
select is((SELECT string_agg(display_title, ',' ORDER BY position) FROM public.event_lineup_items
            WHERE event_id = current_setting('test.j1')::uuid), 'Seven Nation Army,Plush (Live)',
  'reorder_lineup: listed ids first, the rest after');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.add_lineup_songs(%L, ARRAY['77000000-0000-4000-8000-0000000000a1']::uuid[]) $$, current_setting('test.j1')),
  'P0001', 'forbidden', 'add_lineup_songs: a guest can''t');
select tests.authenticate_as('p7-gst2@test.com');
select throws_ok(format($$ SELECT public.add_lineup_songs(%L, ARRAY['77000000-0000-4000-8000-0000000000a1']::uuid[]) $$, current_setting('test.j1')),
  'P0001', 'not_found', 'add_lineup_songs: a co-host can''t add someone else''s personal song');

-- ── F. Pitches ──────────────────────────────────────────────────────────────
select tests.authenticate_as('p7-gst@test.com');
DO $$ BEGIN
  PERFORM set_config('test.p1', (SELECT id::text FROM public.pitch_song(current_setting('test.j1')::uuid,
    p_title => 'Everlong', p_artist => 'Foo Fighters', p_my_parts => '["drums", {"key": "keys"}]')), true);
END $$;
reset role;
select is((SELECT state || '|' || (pitched_by::text = current_setting('test.gp1'))::text FROM public.event_lineup_items
            WHERE id = current_setting('test.p1')::uuid),
  'pending|true', 'pitch_song: pending while the host approves; pitched_by is me');
select is((SELECT parts_needed FROM public.event_lineup_items WHERE id = current_setting('test.p1')::uuid),
  '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"},{"key":"keys"}]'::jsonb,
  'pitch_song: a part I''ll play that the jam lacks is added');
select is((SELECT string_agg(role_key || ':' || status, ',' ORDER BY role_key) FROM public.event_hands
            WHERE event_lineup_item_id = current_setting('test.p1')::uuid),
  'drums:raised,keys:raised', 'pitch_song: my hands go up in the same call');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_song_id => '77000000-0000-4000-8000-0000000000a1') $$, current_setting('test.j1')),
  'P0001', 'not_found', 'pitch_song: someone else''s song → not_found');
select throws_ok(format($$ SELECT public.approve_pitch(%L) $$, current_setting('test.p1')), 'P0001', 'forbidden',
  'approve_pitch: a guest can''t');
select tests.authenticate_as('p7-str@test.com');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => 'X') $$, current_setting('test.j1')), 'P0001', 'not_joined',
  'pitch_song: an invitee who hasn''t joined → not_joined');
select tests.authenticate_as('p7-host@test.com');
select is((SELECT state FROM public.pitch_song(current_setting('test.j1')::uuid, p_title => 'Host Pick')), 'open',
  'pitch_song: a host''s pitch is open straight away');
select is((SELECT state FROM public.approve_pitch(current_setting('test.p1')::uuid)), 'open', 'approve_pitch: pending → open');
select throws_ok(format($$ SELECT public.approve_pitch(%L) $$, current_setting('test.p1')), 'P0001', 'not_pending',
  'approve_pitch: again → not_pending');
select tests.authenticate_as('p7-gst@test.com');
DO $$ BEGIN
  PERFORM set_config('test.p2', (SELECT id::text FROM public.pitch_song(current_setting('test.j1')::uuid, p_title => 'Hidden Pitch')), true);
END $$;
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.set_jam_settings(current_setting('test.j1')::uuid, p_requests_visible => false); END $$;
select ok(public.jam_state(current_setting('test.j1')::uuid)->'items' @> jsonb_build_array(jsonb_build_object('id', current_setting('test.p2'))),
  'requests_visible off: the host still sees pending pitches');
select tests.authenticate_as('p7-gst@test.com');
select ok(public.jam_state(current_setting('test.j1')::uuid)->'items' @> jsonb_build_array(jsonb_build_object('id', current_setting('test.p2'))),
  'requests_visible off: the pitcher sees their own');
select tests.authenticate_as('p7-mate@test.com');
select ok(NOT public.jam_state(current_setting('test.j1')::uuid)->'items' @> jsonb_build_array(jsonb_build_object('id', current_setting('test.p2'))),
  'requests_visible off: other participants don''t');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.set_jam_settings(current_setting('test.j1')::uuid, p_requests_visible => true, p_requests_open => false); END $$;
select is((SELECT state FROM public.decline_pitch(current_setting('test.p2')::uuid)), 'removed', 'decline_pitch: → removed');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => 'Closed') $$, current_setting('test.j1')), 'P0001', 'requests_closed',
  'pitch_song: requests closed → requests_closed');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.set_jam_settings(current_setting('test.j1')::uuid, p_requests_open => true); END $$;

-- ── G. Hands, cast, grid ────────────────────────────────────────────────────
select tests.authenticate_as('p7-gst@test.com');
select is((SELECT count(*)::int FROM public.raise_hand(current_setting('test.i2')::uuid, '["guitar", "bass"]')), 2,
  'raise_hand: one hand per part');
select is((SELECT count(*)::int FROM public.raise_hand(current_setting('test.i2')::uuid, '["guitar"]')), 2,
  'raise_hand: raising again doesn''t add a second hand');
select throws_ok(format($$ SELECT public.raise_hand(%L, '["keys"]') $$, current_setting('test.i2')), 'P0001', 'part_not_needed',
  'raise_hand: a part the song doesn''t need → part_not_needed');
select tests.authenticate_as('p7-mate@test.com');
select throws_ok(format($$ SELECT public.lower_hand((SELECT id FROM public.event_hands WHERE event_lineup_item_id = %L
                                                     AND role_key = 'bass' LIMIT 1)) $$, current_setting('test.i2')),
  'P0001', 'forbidden', 'lower_hand: someone else''s hand → forbidden (a guest)');
select tests.authenticate_as('p7-gst@test.com');
DO $$ BEGIN
  PERFORM public.lower_hand((SELECT id FROM public.event_hands WHERE event_lineup_item_id = current_setting('test.i2')::uuid
                               AND role_key = 'bass' AND participant_id = current_setting('test.gp1')::uuid));
END $$;
select is((SELECT count(*)::int FROM public.event_hands WHERE event_lineup_item_id = current_setting('test.i2')::uuid), 1,
  'lower_hand: your own hand goes');

-- Legacy pages: a direct insert by user_id gets its participant filled.
INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id, user_name)
VALUES (current_setting('test.j1')::uuid, current_setting('test.i1')::uuid, 'vox', current_setting('test.gst')::uuid, 'G');
reset role;
select is((SELECT participant_id::text FROM public.event_hands
            WHERE event_lineup_item_id = current_setting('test.i1')::uuid AND role_key = 'vox'),
  current_setting('test.gp1'), 'legacy hands: participant_id filled from user_id');
select is((SELECT status FROM public.event_hands
            WHERE event_lineup_item_id = current_setting('test.i1')::uuid AND role_key = 'vox'),
  'raised', 'legacy hands: auto-approve still follows the event setting (off here)');

select tests.authenticate_as('p7-host@test.com');
select is((SELECT status FROM public.set_cast(current_setting('test.i2')::uuid, '"guitar"', current_setting('test.gp1')::uuid)),
  'accepted', 'set_cast: accepts their raised hand');
DO $$ BEGIN
  PERFORM public.add_walkup(current_setting('test.j1')::uuid, 'Sam', '["guitar"]');
  PERFORM set_config('test.sam', (SELECT id::text FROM public.event_participants
    WHERE event_id = current_setting('test.j1')::uuid AND guest_name = 'Sam'), true);
  PERFORM public.mark_house_player(current_setting('test.sam')::uuid, true);
END $$;
select is((SELECT status FROM public.set_cast(current_setting('test.i2')::uuid, '{"key": "guitar"}', current_setting('test.sam')::uuid)),
  'accepted', 'set_cast: a house player with no hand gets an accepted one');
select is((SELECT jsonb_agg(s->'cast'->>'name' ORDER BY lower(s->'cast'->>'name'))
             FROM jsonb_array_elements(public.jam_state(current_setting('test.j1')::uuid)->'items') i,
                  jsonb_array_elements(i->'slots') s
            WHERE i->>'id' = current_setting('test.i2') AND s->>'key' = 'guitar'),
  jsonb_build_array('p7-gst', 'Sam'), 'jam_state grid: Guitar 1 and Guitar 2 both filled');
select is((SELECT status FROM public.set_cast(current_setting('test.i2')::uuid, '"guitar"', current_setting('test.hp1')::uuid)),
  'accepted', 'set_cast: a third guitar');
select is((SELECT count(*)::int FROM public.event_lineup_items i, jsonb_array_elements(i.parts_needed) p
            WHERE i.id = current_setting('test.i2')::uuid AND p->>'key' = 'guitar'),
  3, 'set_cast: all slots taken → a slot is added (Guitar 3)');
select is((SELECT status FROM public.set_cast(current_setting('test.i2')::uuid, '"guitar"', current_setting('test.hp1')::uuid, false)),
  'raised', 'set_cast: p_on false un-casts (back to raised)');
select is((SELECT jsonb_build_object('gap', s->'gap', 'raised', s->'raised')
             FROM jsonb_array_elements(public.jam_state(current_setting('test.j1')::uuid)->'items') i,
                  jsonb_array_elements(i->'slots') s
            WHERE i->>'id' = current_setting('test.i2') AND s->>'key' = 'guitar' AND (s->>'nth')::int = 3),
  '{"gap": true, "raised": 1}'::jsonb, 'jam_state grid: an empty slot is a gap with its hand count');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.set_cast(%L, '"bass"', %L) $$, current_setting('test.i2'), current_setting('test.gp1')),
  'P0001', 'forbidden', 'set_cast: a guest can''t');

-- ── H. Who knows your songs, and my matches on the lineup ───────────────────
reset role;
INSERT INTO public.songs (title, artist, context_type, context_id, created_by, visibility, tags) VALUES
  ('Plush', 'Stone Temple Pilots', 'personal', current_setting('test.gst'), current_setting('test.gst')::uuid, 'personal', '{jam}'),
  ('Seven Nation Army', 'White Stripes', 'personal', current_setting('test.gst'), current_setting('test.gst')::uuid, 'personal', '{jam}'),
  ('Untagged Song', 'Nobody', 'personal', current_setting('test.gst'), current_setting('test.gst')::uuid, 'personal', '{}'),
  ('Untagged Song', 'Nobody', 'personal', current_setting('test.host'), current_setting('test.host')::uuid, 'personal', '{jam}'),
  ('Only Mine', 'Me', 'personal', current_setting('test.host'), current_setting('test.host')::uuid, 'personal', '{jam}'),
  ('Plush', 'Stone Temple Pilots', 'personal', current_setting('test.gst2'), current_setting('test.gst2')::uuid, 'personal', '{jam}');
UPDATE public.songs SET tags = '{jam}' WHERE id = '77000000-0000-4000-8000-0000000000a1';
UPDATE public.event_participants SET share_songs = false
 WHERE event_id = current_setting('test.j1')::uuid AND user_id = current_setting('test.gst2')::uuid;
select tests.authenticate_as('p7-host@test.com');
select is((SELECT jsonb_agg(jsonb_build_object('name', name, 'n', common_count)) FROM public.who_knows_your_songs(current_setting('test.j1')::uuid)),
  '[{"n": 1, "name": "p7-gst"}]'::jsonb,
  'who_knows_your_songs: jam-tagged on both sides, normalised; untagged and not-sharing people don''t count');
select is((SELECT jsonb_build_object('mine', only_mine->0->>'title', 'theirs', only_theirs->0->>'title')
             FROM public.who_knows_your_songs(current_setting('test.j1')::uuid, current_setting('test.gp1')::uuid)),
  '{"mine": "Only Mine", "theirs": "Seven Nation Army"}'::jsonb,
  'who_knows_your_songs: compare with one person gives only-mine / only-theirs (tagged songs only)');
select tests.authenticate_as('p7-gst@test.com');
select is((SELECT i->'mine'->>'is_jam_song' FROM jsonb_array_elements(public.jam_state(current_setting('test.j1')::uuid)->'items') i
            WHERE i->>'id' = current_setting('test.i1')), 'true',
  'jam_state: a lineup song matching my jam song says so ("Plush (Live)" = "Plush")');
select is((SELECT i->'mine' FROM jsonb_array_elements(public.jam_state(current_setting('test.j1')::uuid)->'items') i
            WHERE i->>'id' = current_setting('test.p1')), 'null'::jsonb,
  'jam_state: no match → mine is null ("Add to My Songs")');
select tests.authenticate_as('p7-str@test.com');
select throws_ok(format($$ SELECT * FROM public.who_knows_your_songs(%L) $$, current_setting('test.j2')), 'P0001', 'forbidden',
  'who_knows_your_songs: not in the jam → forbidden');

-- ── I. The live night ───────────────────────────────────────────────────────
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.go_live(%L) $$, current_setting('test.j1')), 'P0001', 'forbidden', 'go_live: a guest can''t');
select tests.authenticate_as('p7-host@test.com');
select throws_ok(format($$ SELECT public.call_up(%L) $$, current_setting('test.i2')), 'P0001', 'not_live', 'call_up: not live → not_live');
select is((SELECT status FROM public.go_live(current_setting('test.j1')::uuid)), 'live', 'go_live: planned → live');
select is((SELECT string_agg(display_title || '#' || queue_position, ',' ORDER BY queue_position) FROM public.event_lineup_items
            WHERE event_id = current_setting('test.j1')::uuid AND state = 'queued'),
  'Seven Nation Army#1,Plush (Live)#2,Everlong#3,Host Pick#4', 'go_live: the open lineup becomes the queue, in order');
select throws_ok(format($$ SELECT public.go_live(%L) $$, current_setting('test.j1')), 'P0001', 'not_planned', 'go_live: again → not_planned');
select tests.authenticate_as('p7-gst@test.com');
DO $$ BEGIN
  PERFORM set_config('test.p3', (SELECT id::text FROM public.pitch_song(current_setting('test.j1')::uuid, p_title => 'Late Pitch')), true);
END $$;
select tests.authenticate_as('p7-host@test.com');
select is((SELECT queue_position FROM public.make_up_next(current_setting('test.p3')::uuid)), 1, 'make_up_next: a pitch jumps to up next');
select is(public.jam_state(current_setting('test.j1')::uuid)->>'up_next', current_setting('test.p3'), 'jam_state: up next = first queued');
select is((SELECT queue_position FROM public.skip_up_next(current_setting('test.j1')::uuid)), 2, 'skip_up_next: up next moves behind the next');
select is((SELECT queue_position FROM public.move_queue_item(current_setting('test.p3')::uuid, 99)), 5, 'move_queue_item: past the end = last');
select is((SELECT jsonb_build_object('called', r->'called'->>'state', 'previous', r->'previous')
             FROM public.call_up(current_setting('test.i2')::uuid) r),
  '{"called": "stage", "previous": null}'::jsonb, 'call_up: on stage');
select is((SELECT jsonb_build_object('called', r->'called'->>'id', 'previous', r->'previous'->>'state')
             FROM public.call_up(current_setting('test.i1')::uuid) r),
  jsonb_build_object('called', current_setting('test.i1'), 'previous', 'played'), 'call_up: the previous stage song is played');
select is((SELECT count(*)::int FROM public.event_lineup_items WHERE event_id = current_setting('test.j1')::uuid AND state = 'stage'),
  1, 'call_up: only one song on stage');
select throws_ok(format($$ SELECT public.set_queue_state(%L, 'stage') $$, current_setting('test.p3')), 'P0001', 'stage_busy',
  'set_queue_state: stage while someone''s on → stage_busy');
select throws_ok(format($$ SELECT public.set_queue_state(%L, 'gone') $$, current_setting('test.p3')), 'P0001', 'invalid_state',
  'set_queue_state: an unknown state → invalid_state');
select is((SELECT state || '|' || (queue_position IS NULL)::text FROM public.set_queue_state(current_setting('test.p3')::uuid, 'left')),
  'left|true', 'set_queue_state: left (off the queue)');
select is((SELECT state || '|' || queue_position FROM public.set_queue_state(current_setting('test.p3')::uuid, 'queued', 1)),
  'queued|1', 'set_queue_state: Undo back into the queue at a position');
select tests.authenticate_as('p7-gst2@test.com');
select lives_ok(format($$ SELECT public.queue_pitch(%L, 2) $$, current_setting('test.p3')), 'queue_pitch: a co-host runs the queue');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.call_up(%L) $$, current_setting('test.p3')), 'P0001', 'forbidden', 'call_up: a guest can''t');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.ask_the_room(current_setting('test.p3')::uuid, '"drums"'); END $$;
reset role;
select ok(EXISTS (SELECT 1 FROM realtime.messages WHERE topic = 'jam:' || current_setting('test.c1') AND event = 'nudge'
                    AND payload->>'item_id' = current_setting('test.p3')),
  'ask_the_room: a nudge on the jam''s topic');
select is((SELECT count(*)::int FROM realtime.messages WHERE topic = 'jam:' || current_setting('test.c1') AND event = 'changed'),
  1, 'live updates: one ''changed'' broadcast per jam per transaction');
select tests.authenticate_as('p7-host@test.com');
select throws_ok(format($$ SELECT public.ask_the_room(%L, '"keys"') $$, current_setting('test.i2')), 'P0001', 'part_not_needed',
  'ask_the_room: a part the song doesn''t need');
select throws_ok(format($$ SELECT public.remove_person(%L) $$, current_setting('test.hp1')), 'P0001', 'cannot_remove_host',
  'remove_person: never the host');
select is((SELECT joining_locked FROM public.lock_joining(current_setting('test.j1')::uuid, true)), true, 'lock_joining: on');
select tests.authenticate_as('p7-co@test.com');
select throws_ok(format($$ SELECT public.join_jam(%L) $$, current_setting('test.c1')), 'P0001', 'not_taking_people',
  'join_jam: locked → not_taking_people');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.lock_joining(current_setting('test.j1')::uuid, false); END $$;

-- remove_person: hands and lone pitches go.
select tests.authenticate_as('p7-co@test.com');
DO $$ BEGIN
  PERFORM public.join_jam(current_setting('test.c1'), '["drums"]');
  PERFORM set_config('test.cop', (SELECT id::text FROM public.event_participants
    WHERE event_id = current_setting('test.j1')::uuid AND user_id = current_setting('test.co')::uuid), true);
  PERFORM set_config('test.p4', (SELECT id::text FROM public.pitch_song(current_setting('test.j1')::uuid,
    p_title => 'Lone Pitch', p_my_parts => '["drums"]')), true);
END $$;
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.remove_person(current_setting('test.cop')::uuid); END $$;
reset role;
select is((SELECT state FROM public.event_lineup_items WHERE id = current_setting('test.p4')::uuid), 'removed',
  'remove_person: their pitch nobody else is on goes');
select is((SELECT count(*)::int FROM public.event_participants WHERE id = current_setting('test.cop')::uuid), 0,
  'remove_person: the person goes');

-- ── J. End and save ─────────────────────────────────────────────────────────
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN
  PERFORM public.add_walkup(current_setting('test.j1')::uuid, 'Walk Up', '["bass"]', p_item => current_setting('test.p3')::uuid);
END $$;
select is((SELECT status FROM public.end_jam(current_setting('test.j1')::uuid)), 'completed', 'end_jam: live → ended');
reset role;
select is((SELECT count(*)::int FROM public.event_hands WHERE event_id = current_setting('test.j1')::uuid), 0, 'end_jam: no hands left');
select is((SELECT count(*)::int FROM public.event_participants WHERE event_id = current_setting('test.j1')::uuid
             AND (via <> 'app' OR guest_name IS NOT NULL)), 0, 'end_jam: walk-ups and guests (and their names) are gone');
select is((SELECT string_agg(display_title || ':' || state, ',' ORDER BY called_at) FROM public.event_lineup_items
            WHERE event_id = current_setting('test.j1')::uuid AND state = 'played'),
  'Seven Nation Army:played,Plush (Live):played', 'end_jam: the song on stage counts as played; played songs stay');
select is((SELECT count(*)::int FROM public.event_lineup_items WHERE event_id = current_setting('test.j1')::uuid
             AND state NOT IN ('played', 'removed')), 0, 'end_jam: everything else is removed');
select tests.authenticate_as('p7-host@test.com');
select throws_ok(format($$ SELECT public.end_jam(%L) $$, current_setting('test.j1')), 'P0001', 'not_live', 'end_jam: again → not_live');
select tests.authenticate_as('p7-gst@test.com');
select throws_ok(format($$ SELECT public.join_jam(%L) $$, current_setting('test.c1')), 'P0001', 'jam_ended', 'join_jam: an ended jam → jam_ended');
select throws_ok(format($$ SELECT public.raise_hand(%L, '["vox"]') $$, current_setting('test.i2')), 'P0001', 'jam_ended',
  'raise_hand: an ended jam → jam_ended');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN
  PERFORM set_config('test.set', (SELECT id::text FROM public.save_jam_as_setlist(current_setting('test.j1')::uuid, 'personal')), true);
END $$;
reset role;
select is((SELECT string_agg(s.title, ',' ORDER BY it.ord) FROM public.setlists l,
                  jsonb_array_elements(l.items) WITH ORDINALITY it(v, ord)
             JOIN public.songs s ON s.id = (it.v->>'songId')::uuid
            WHERE l.id = current_setting('test.set')::uuid),
  'Seven Nation Army,Plush (Live)', 'save_jam_as_setlist: played songs in called order');
select is((SELECT tags::text || '|' || context_type || '|' || name FROM public.setlists WHERE id = current_setting('test.set')::uuid),
  '{jam}|personal|Friday Night Jam', 'save_jam_as_setlist: a personal setlist tagged jam');
select ok((SELECT count(*) = 1 FROM public.songs WHERE context_type = 'personal' AND context_id = current_setting('test.host')
             AND title = 'Seven Nation Army'),
  'save_jam_as_setlist: a song missing from the catalog is added there (the existing one is reused)');
select tests.authenticate_as('p7-host@test.com');
select throws_ok(format($$ SELECT public.save_jam_as_setlist(%L, 'band', %L) $$, current_setting('test.j1'), gen_random_uuid()),
  'P0001', 'forbidden', 'save_jam_as_setlist: a band you''re not in → forbidden');
select throws_ok(format($$ SELECT public.save_jam_as_setlist(%L, 'personal') $$, current_setting('test.j2')),
  'P0001', 'nothing_played', 'save_jam_as_setlist: nothing played → nothing_played');

-- ── K. Delete ───────────────────────────────────────────────────────────────
select throws_ok(format($$ SELECT public.delete_jam(%L) $$, current_setting('test.j1')), 'P0001', 'not_planned',
  'delete_jam: an ended jam can''t be deleted');
select tests.authenticate_as('p7-fr@test.com');
select throws_ok(format($$ SELECT public.delete_jam(%L) $$, current_setting('test.j2')), 'P0001', 'forbidden',
  'delete_jam: not the host → forbidden');
select tests.authenticate_as('p7-host@test.com');
DO $$ BEGIN PERFORM public.invite_to_jam(current_setting('test.j2')::uuid, ARRAY[current_setting('test.inv')::uuid]); END $$;
select lives_ok(format($$ SELECT public.delete_jam(%L) $$, current_setting('test.j2')), 'delete_jam: a planned jam');
reset role;
select is((SELECT count(*)::int FROM public.events WHERE id = current_setting('test.j2')::uuid), 0, 'delete_jam: gone');
select is((SELECT title FROM public.notifications WHERE user_id = current_setting('test.fr')::uuid AND payload->>'type' = 'jam_called_off'),
  'p7-host called off Friends Jam', 'delete_jam: people who joined hear "‹Host› called off ‹Jam›"');
select is((SELECT count(*)::int FROM public.notifications WHERE user_id = current_setting('test.inv')::uuid
             AND payload->>'type' = 'jam_called_off'), 0, 'delete_jam: people only invited aren''t told');

-- ── L. Backfill and the legacy pages ────────────────────────────────────────
INSERT INTO public.events (id, host_user_id, name, scheduled_date, visibility)
VALUES ('77000000-0000-4000-8000-0000000000e1', current_setting('test.host')::uuid, 'Legacy', now() + interval '1 day', 'unlisted');
INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp) VALUES
  ('77000000-0000-4000-8000-0000000000e1', current_setting('test.host')::uuid, 'host', 'going'),
  ('77000000-0000-4000-8000-0000000000e1', current_setting('test.gst')::uuid, 'guest', 'going');
INSERT INTO public.event_lineup_requests (event_id, requester_id, source, display_title, display_artist, parts)
VALUES ('77000000-0000-4000-8000-0000000000e1', current_setting('test.gst')::uuid, 'external', 'Old Request', 'Band',
        '{bass,Kazoo}');
select lives_ok($$ SELECT public._jam_backfill_requests(); SELECT public._jam_backfill_requests(); $$, 'backfill: runs twice');
select is((SELECT state || '|' || (pitched_by IS NOT NULL)::text || '|' || parts_needed::text FROM public.event_lineup_items
            WHERE event_id = '77000000-0000-4000-8000-0000000000e1'),
  'pending|true|[{"key": "vox"}, {"key": "guitar"}, {"key": "bass"}, {"key": "drums"}, {"key": "other", "label": "Kazoo"}]',
  'backfill: a pending request is one pending lineup entry, pitched by the requester; a custom part is other + label');
select is((SELECT string_agg(role_key || COALESCE(':' || role_label, ''), ',' ORDER BY role_key) FROM public.event_hands
            WHERE event_id = '77000000-0000-4000-8000-0000000000e1'),
  'bass,other:Kazoo', 'backfill: the offered parts are raised hands');
select set_config('test.cl', (SELECT short_code FROM public.events WHERE id = '77000000-0000-4000-8000-0000000000e1'), true);
select tests.authenticate_as('p7-str@test.com');
select is((SELECT count(*)::int FROM public.join_event_by_code(current_setting('test.c3'))), 0,
  'join_event_by_code (legacy): an invite-only jam''s code joins nothing');
select is((SELECT count(*)::int FROM public.join_event_by_code(current_setting('test.cl'))), 1,
  'join_event_by_code (legacy): a code jam still joins');

-- ── M. delete_account with guests in a band jam ─────────────────────────────
select tests.authenticate_as('p7-del@test.com');
DO $$ BEGIN
  PERFORM set_config('test.dj', (SELECT id::text FROM public.create_jam('Del Band Jam', now() + interval '1 day',
    p_band_id => current_setting('test.band')::uuid)), true);
  PERFORM set_config('test.dpj', (SELECT id::text FROM public.create_jam('Del Own Jam', now() + interval '1 day')), true);
  PERFORM set_config('test.di', (SELECT id::text FROM public.add_lineup_title(current_setting('test.dj')::uuid, 'Kept Song')), true);
END $$;
reset role;
select set_config('test.dc', (SELECT short_code FROM public.events WHERE id = current_setting('test.dj')::uuid), true);
select set_config('request.headers', '{"x-real-ip": "10.7.0.1"}', true);
select tests.clear_authentication();
set role anon;
DO $$ BEGIN
  PERFORM set_config('test.dtok', (SELECT token FROM public.join_jam_as_web_guest(current_setting('test.dc'), 'Dee', '["bass"]')), true);
  PERFORM public.raise_hand(current_setting('test.di')::uuid, '["bass"]', current_setting('test.dtok'));
END $$;
reset role;
select tests.authenticate_as('p7-del@test.com');
select lives_ok($$ SELECT public.delete_account() $$, 'delete_account: a host with a web guest in a band jam');
reset role;
select is((SELECT host_user_id::text FROM public.events WHERE id = current_setting('test.dj')::uuid), current_setting('test.own'),
  'delete_account: the band jam goes to the band owner');
select is((SELECT access_tier FROM public.event_participants
            WHERE event_id = current_setting('test.dj')::uuid AND user_id = current_setting('test.own')::uuid),
  'host', 'delete_account: the new host has a host row');
select is((SELECT count(*)::int FROM public.events WHERE id = current_setting('test.dpj')::uuid), 0,
  'delete_account: their personal jam goes');
set role anon;
select is((SELECT jsonb_build_object('me', s->'me'->>'name', 'hands', jsonb_array_length(s->'items'->0->'hands'))
             FROM public.jam_state(current_setting('test.dj')::uuid, current_setting('test.dtok')) s),
  '{"me": "Dee", "hands": 1}'::jsonb, 'delete_account: the web guest, their token and hand survive');
reset role;

select * from finish();
rollback;
