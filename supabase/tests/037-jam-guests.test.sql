-- Test: phase 7 Jam, the anonymous side: the anon surface sweep (D12), codes,
--       web guests, kiosk, bar TV, rate limits, client IP, tokens dying.
-- Category: Functions + access
-- Created: 2026-11-20

begin;

select plan(84);

select tests.create_supabase_user('g7-host@test.com');
select tests.create_supabase_user('g7-other@test.com');
select set_config('test.host', tests.get_supabase_uid('g7-host@test.com')::text, true);

select tests.authenticate_as('g7-host@test.com');
DO $$ BEGIN
  PERFORM set_config('test.j', (SELECT id::text FROM public.create_jam('Guest Jam', now() + interval '1 day')), true);
  PERFORM set_config('test.ji', (SELECT id::text FROM public.create_jam('Closed Jam', now() + interval '1 day',
    p_who_can_join => 'invite')), true);
  PERFORM set_config('test.jo', (SELECT id::text FROM public.create_jam('Other Jam', now() + interval '1 day')), true);
  PERFORM set_config('test.item', (SELECT id::text FROM public.add_lineup_title(current_setting('test.j')::uuid,
    'Song One', 'Band', '["vox", "guitar", {"key": "other", "label": "Harmonica"}]')), true);
  PERFORM set_config('test.band', (SELECT id::text FROM public.create_band('G7 Band')), true);
END $$;
reset role;
DO $$ BEGIN
  PERFORM set_config('test.c', (SELECT short_code FROM public.events WHERE id = current_setting('test.j')::uuid), true);
  PERFORM set_config('test.ci', (SELECT short_code FROM public.events WHERE id = current_setting('test.ji')::uuid), true);
  PERFORM set_config('test.co', (SELECT short_code FROM public.events WHERE id = current_setting('test.jo')::uuid), true);
  PERFORM set_config('test.cb', (SELECT code FROM public.invite_codes WHERE band_id = current_setting('test.band')::uuid
                                   AND is_active LIMIT 1), true);
  PERFORM set_config('test.hostp', (SELECT id::text FROM public.event_participants
    WHERE event_id = current_setting('test.j')::uuid AND user_id = current_setting('test.host')::uuid), true);
  PERFORM set_config('test.hosthand', '', true);
END $$;
-- The host's hand, for "lower someone else's hand".
select tests.authenticate_as('g7-host@test.com');
DO $$ BEGIN
  PERFORM set_config('test.hosthand', (SELECT id::text FROM public.raise_hand(current_setting('test.item')::uuid, '["vox"]')), true);
END $$;
reset role;

-- ── A. The anon surface (D12 sweep) ─────────────────────────────────────────
select set_eq(
  $$ SELECT p.oid::regprocedure::text FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.prorettype <> 'trigger'::regtype
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') $$,
  $$ SELECT unnest(ARRAY[
       'jam_preview_by_code(text)', 'resolve_code(text)', 'join_jam_as_web_guest(text,text,jsonb)',
       'update_me(uuid,text,jsonb,boolean,text)', 'leave_jam(uuid,text)',
       'add_walkup(uuid,text,jsonb,text,uuid,text,text,text)',
       'pitch_song(uuid,uuid,text,text,jsonb,jsonb,uuid,text)', 'raise_hand(uuid,jsonb,text)',
       'lower_hand(uuid,text)', 'jam_state(uuid,text)', 'jam_tv_feed(text)', 'pair_kiosk(text)']) $$,
  'anon sweep: anon may execute exactly the twelve token / code functions (each tested below)');
select ok(NOT has_function_privilege('anon', 'public._jam_actor(uuid,text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public._jam_actor(uuid,text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public._jam_state(uuid,text,uuid,boolean)', 'EXECUTE'),
  'anon sweep: the internal _jam_* helpers are callable by nobody but their owner');
select ok(NOT has_table_privilege('anon', 'public.event_guest_tokens', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.event_kiosk_pairings', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.jam_rate_limits', 'SELECT'),
  'anon sweep: no table access to tokens, pairings or rate limits');

-- Each anon function refuses without a valid token / code. Distinct IPs keep
-- the rate limits out of the way.
select set_config('request.headers', '{"x-real-ip": "10.1.0.1"}', true);
select tests.clear_authentication();
set role anon;
select is((SELECT error FROM public.jam_preview_by_code('ZZZZ2222')), 'no_jam', 'jam_preview_by_code: a bad code → a no_jam row');
select is((SELECT kind FROM public.resolve_code('ZZZZ2222')), NULL, 'resolve_code: a bad code → nothing');
select is((SELECT error || '|' || (token IS NULL)::text FROM public.join_jam_as_web_guest('ZZZZ2222', 'X')), 'no_jam|true',
  'join_jam_as_web_guest: a bad code → a no_jam row, no token');
select throws_ok(format($$ SELECT public.update_me(%L, 'X') $$, current_setting('test.j')), 'P0001', 'forbidden',
  'update_me: no token → forbidden');
select throws_ok(format($$ SELECT public.leave_jam(%L) $$, current_setting('test.j')), 'P0001', 'forbidden',
  'leave_jam: no token → forbidden');
select throws_ok(format($$ SELECT public.add_walkup(%L, 'X') $$, current_setting('test.j')), 'P0001', 'forbidden',
  'add_walkup: no token → forbidden');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => 'X') $$, current_setting('test.j')), 'P0001', 'forbidden',
  'pitch_song: no token → forbidden');
select throws_ok(format($$ SELECT public.raise_hand(%L, '["vox"]') $$, current_setting('test.item')), 'P0001', 'forbidden',
  'raise_hand: no token → forbidden');
select throws_ok(format($$ SELECT public.lower_hand(%L) $$, current_setting('test.hosthand')), 'P0001', 'forbidden',
  'lower_hand: no token → forbidden');
select throws_ok(format($$ SELECT public.jam_state(%L) $$, current_setting('test.j')), 'P0001', 'forbidden',
  'jam_state: no token → forbidden');
select throws_ok(format($$ SELECT public.jam_state(%L, 'not-a-token') $$, current_setting('test.j')), 'P0001', 'forbidden',
  'jam_state: a made-up token → forbidden');
select is(public.jam_tv_feed('ZZZZ2222')->>'error', 'no_jam', 'jam_tv_feed: a bad code → {error: no_jam}');
select is((SELECT error FROM public.pair_kiosk('ZZZ222')), 'pairing_invalid', 'pair_kiosk: a bad code → a pairing_invalid row');

-- ── B. Codes ────────────────────────────────────────────────────────────────
select is((SELECT kind FROM public.resolve_code(lower(current_setting('test.c')))), 'jam', 'resolve_code: a jam code, any case');
select is((SELECT kind FROM public.resolve_code(current_setting('test.cb'))), 'band', 'resolve_code: a band invite code');
select is((SELECT name || '|' || host_first_name || '|' || people_count::text || '|' || is_participant::text
             FROM public.jam_preview_by_code(substr(current_setting('test.c'), 1, 4) || '-' || substr(current_setting('test.c'), 5))),
  'Guest Jam|g7-host|1|false', 'jam_preview_by_code: name, host, people (hyphen accepted)');
select is((SELECT error || '|' || hint || '|' || (event_id IS NULL AND name IS NULL)::text
             FROM public.jam_preview_by_code(current_setting('test.ci'))),
  'invite_only|This jam is invite only.|true', 'jam_preview_by_code: an invite-only jam → an invite_only row with its copy, nothing else');
select is(public.jam_tv_feed(current_setting('test.ci')), '{"error": "invite_only", "hint": "This jam is invite only."}'::jsonb,
  'jam_tv_feed: an invite-only jam → {error: invite_only} only');

-- ── C. Web guests ───────────────────────────────────────────────────────────
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, '  ') $$, current_setting('test.c')), 'P0001', 'name_required',
  'join_jam_as_web_guest: a blank name → name_required');
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, repeat('x', 41)) $$, current_setting('test.c')), 'P0001',
  'name_required', 'join_jam_as_web_guest: over 40 → name_required');
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, 'X', '["kazoo"]') $$, current_setting('test.c')), 'P0001',
  'invalid_parts', 'join_jam_as_web_guest: a part outside the vocabulary → invalid_parts');
select is((SELECT error FROM public.join_jam_as_web_guest(current_setting('test.ci'), 'X')), 'invite_only',
  'join_jam_as_web_guest: an invite-only jam → an invite_only row');
select throws_ok($$ SELECT * FROM public.join_jam_as_web_guest('ZZZZ2222', '  ') $$, 'P0001', 'name_required',
  'join_jam_as_web_guest: input errors come first (a bad name says nothing about the code)');
DO $$ BEGIN
  PERFORM set_config('test.tok', (SELECT token FROM public.join_jam_as_web_guest(current_setting('test.c'), ' Robin ',
    '["guitar", {"key": "other", "label": "harmonica"}]')), true);
  PERFORM set_config('test.tok2', (SELECT token FROM public.join_jam_as_web_guest(current_setting('test.c'), 'Pat', '["vox"]')), true);
  PERFORM set_config('test.toko', (SELECT token FROM public.join_jam_as_web_guest(current_setting('test.co'), 'Other', '["vox"]')), true);
END $$;
reset role;
select is((SELECT guest_name || '|' || via || '|' || share_songs::text || '|' || (user_id IS NULL)::text
             FROM public.event_participants WHERE event_id = current_setting('test.j')::uuid AND guest_name = 'Robin'),
  'Robin|web|false|true', 'join_jam_as_web_guest: a named web guest with no account, not sharing songs');
select ok(NOT EXISTS (SELECT 1 FROM public.event_guest_tokens WHERE token_hash = convert_to(current_setting('test.tok'), 'UTF8'))
          AND EXISTS (SELECT 1 FROM public.event_guest_tokens WHERE token_hash = extensions.digest(current_setting('test.tok'), 'sha256')),
  'tokens: only the sha256 is stored');
set role anon;
select is(public.jam_state(current_setting('test.j')::uuid, current_setting('test.tok'))->'me'->>'name', 'Robin',
  'jam_state: a guest reads the jam with their token');
select ok(NOT (public.jam_state(current_setting('test.j')::uuid, current_setting('test.tok'))::text ~ current_setting('test.host')),
  'jam_state (guest): no account ids anywhere');
select is((SELECT p->>'name' FROM jsonb_array_elements(public.jam_state(current_setting('test.j')::uuid, current_setting('test.tok'))->'people') p
            WHERE p->>'tier' = 'host'), 'g7-host', 'jam_state (guest): people by first name');
select throws_ok(format($$ SELECT public.jam_state(%L, %L) $$, current_setting('test.j'), current_setting('test.toko')), 'P0001', 'forbidden',
  'jam_state: another jam''s token → forbidden');
select throws_ok(format($$ SELECT public.update_me(%L, 'X', p_guest_token => %L) $$, current_setting('test.j'), current_setting('test.toko')),
  'P0001', 'forbidden', 'update_me: another jam''s token → forbidden');
select is((SELECT guest_name || '|' || share_songs::text FROM public.update_me(current_setting('test.j')::uuid, 'Robin B',
            '["guitar"]', true, current_setting('test.tok'))),
  'Robin B|false', 'update_me: a guest renames themselves; share_songs stays off (no catalog)');
select throws_ok(format($$ SELECT public.update_me(%L, '', p_guest_token => %L) $$, current_setting('test.j'), current_setting('test.tok')),
  'P0001', 'name_required', 'update_me: a blank name → name_required');

select is((SELECT count(*)::int FROM public.raise_hand(current_setting('test.item')::uuid, '["guitar"]', current_setting('test.tok'))), 1,
  'raise_hand: a guest raises a hand');
select throws_ok(format($$ SELECT public.raise_hand(%L, '["drums"]', %L) $$, current_setting('test.item'), current_setting('test.tok')),
  'P0001', 'part_not_needed', 'raise_hand: a part the song doesn''t need → part_not_needed');
select is((SELECT count(*)::int FROM public.raise_hand(current_setting('test.item')::uuid, '[{"key": "other", "label": "HARMONICA"}]',
            current_setting('test.tok'))), 2, 'raise_hand: a custom part matches whatever the case');
select throws_ok(format($$ SELECT public.raise_hand(%L, '["vox"]', %L) $$, current_setting('test.item'), current_setting('test.toko')),
  'P0001', 'forbidden', 'raise_hand: another jam''s token → forbidden');
select throws_ok(format($$ SELECT public.lower_hand(%L, %L) $$, current_setting('test.hosthand'), current_setting('test.tok')),
  'P0001', 'forbidden', 'lower_hand: someone else''s hand → forbidden');
reset role;
select set_config('test.rh', (SELECT h.id::text FROM public.event_hands h JOIN public.event_participants p ON p.id = h.participant_id
                               WHERE p.guest_name = 'Robin B' AND h.role_key = 'guitar'), true);
set role anon;
select lives_ok(format($$ SELECT public.lower_hand(%L, %L) $$, current_setting('test.rh'), current_setting('test.tok')),
  'lower_hand: your own hand');

select is((SELECT state || '|' || source FROM public.pitch_song(current_setting('test.j')::uuid, p_title => 'Free Text',
            p_my_parts => '["guitar"]', p_guest_token => current_setting('test.tok'))),
  'pending|external', 'pitch_song: a guest pitches free text; pending');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_song_id => gen_random_uuid(), p_guest_token => %L) $$,
                        current_setting('test.j'), current_setting('test.tok')),
  'P0001', 'forbidden', 'pitch_song: a guest can''t pitch from a catalog');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => repeat('x', 81), p_guest_token => %L) $$,
                        current_setting('test.j'), current_setting('test.tok')),
  'P0001', 'title_too_long', 'pitch_song: over 80 → title_too_long');
select throws_ok(format($$ SELECT public.add_walkup(%L, 'X', p_guest_token => %L) $$, current_setting('test.j'), current_setting('test.tok')),
  'P0001', 'forbidden', 'add_walkup: a guest token isn''t a kiosk token');

-- Rate limit: ten pitches per person per 10 minutes.
DO $$ BEGIN
  FOR i IN 1..9 LOOP
    PERFORM public.pitch_song(current_setting('test.j')::uuid, p_title => 'Pitch ' || i, p_guest_token => current_setting('test.tok'));
  END LOOP;
END $$;
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => 'One Too Many', p_guest_token => %L) $$,
                        current_setting('test.j'), current_setting('test.tok')),
  'P0001', 'rate_limited', 'pitch_song: the eleventh pitch in 10 minutes → rate_limited');

select lives_ok(format($$ SELECT public.leave_jam(%L, %L) $$, current_setting('test.j'), current_setting('test.tok2')), 'leave_jam: a guest leaves');
select throws_ok(format($$ SELECT public.jam_state(%L, %L) $$, current_setting('test.j'), current_setting('test.tok2')), 'P0001', 'forbidden',
  'leave_jam: their token is dead');
reset role;
select is((SELECT count(*)::int FROM public.event_participants WHERE event_id = current_setting('test.j')::uuid AND guest_name = 'Pat'), 0,
  'leave_jam: the guest row goes');

-- Signed-in: host can't leave; a revoked token is dead.
select tests.authenticate_as('g7-host@test.com');
select throws_ok(format($$ SELECT public.leave_jam(%L) $$, current_setting('test.j')), 'P0001', 'host_cannot_leave',
  'leave_jam: the host → host_cannot_leave');
reset role;
UPDATE public.event_guest_tokens SET revoked_at = now() WHERE token_hash = extensions.digest(current_setting('test.toko'), 'sha256');
set role anon;
select throws_ok(format($$ SELECT public.jam_state(%L, %L) $$, current_setting('test.jo'), current_setting('test.toko')), 'P0001', 'forbidden',
  'tokens: a revoked token → forbidden');

-- ── D. Joins rate limit and the client IP ───────────────────────────────────
reset role;
select set_config('request.headers', '{"x-real-ip": "10.2.0.1", "x-forwarded-for": "203.0.113.9, 10.2.0.1"}', true);
select is(public._jam_ip(), '10.2.0.1', '_jam_ip: x-real-ip, never the client-supplied first XFF hop');
select set_config('request.headers', '{"cf-connecting-ip": "198.51.100.7", "x-real-ip": "10.2.0.1"}', true);
select is(public._jam_ip(), '198.51.100.7', '_jam_ip: cf-connecting-ip first');
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.9, 10.9.9.9"}', true);
select is(public._jam_ip(), '10.9.9.9', '_jam_ip: else the last XFF hop');
select set_config('request.headers', '{"x-real-ip": "10.2.0.1"}', true);
set role anon;
DO $$ BEGIN
  -- A bar's crowd on one Wi-Fi IP: 300 joins in 10 minutes are fine.
  FOR i IN 1..300 LOOP
    PERFORM public.join_jam_as_web_guest(current_setting('test.c'), 'Crowd ' || i);
  END LOOP;
END $$;
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, 'One Too Many') $$, current_setting('test.c')), 'P0001', 'rate_limited',
  'join_jam_as_web_guest: the 301st join from one IP in 10 minutes → rate_limited');
reset role;
select set_config('request.headers', '{"x-real-ip": "10.2.0.1", "x-forwarded-for": "203.0.113.50, 10.2.0.1"}', true);
set role anon;
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, 'Spoofer') $$, current_setting('test.c')), 'P0001', 'rate_limited',
  'join_jam_as_web_guest: a forged X-Forwarded-For doesn''t reset the limit');
reset role;
select set_config('request.headers', '{"x-real-ip": "10.3.0.1"}', true);

-- ── E. Kiosk ────────────────────────────────────────────────────────────────
select tests.authenticate_as('g7-host@test.com');
select throws_ok(format($$ SELECT * FROM public.start_kiosk(%L) $$, current_setting('test.ji')), 'P0001', 'invite_only',
  'start_kiosk: not a code jam → invite_only');
DO $$ BEGIN
  PERFORM set_config('test.pair', (SELECT pairing_code FROM public.start_kiosk(current_setting('test.j')::uuid)), true);
END $$;
select matches(current_setting('test.pair'), '^[A-HJ-NP-Z2-9]{6}$', 'start_kiosk: a 6-character pairing code');
reset role;
select tests.clear_authentication();
set role anon;
DO $$ BEGIN
  PERFORM set_config('test.ktok', (SELECT token FROM public.pair_kiosk(lower(current_setting('test.pair')))), true);
END $$;
select ok(length(current_setting('test.ktok')) >= 32, 'pair_kiosk: the code gives a kiosk token');
select is((SELECT error FROM public.pair_kiosk(current_setting('test.pair'))), 'pairing_invalid',
  'pair_kiosk: a used code → pairing_invalid');
select is(public.jam_state(current_setting('test.j')::uuid, current_setting('test.ktok'))->'me', 'null'::jsonb,
  'jam_state: the kiosk reads the jam (no "me")');
select is((SELECT guest_name || '|' || via FROM public.add_walkup(current_setting('test.j')::uuid, 'Sam', '["vox"]', 'kiosk',
            p_item => current_setting('test.item')::uuid, p_guest_token => current_setting('test.ktok'))),
  'Sam|kiosk', 'add_walkup: the kiosk signs up a walk-up, hand and all');
select throws_ok(format($$ SELECT public.pitch_song(%L, p_title => 'X', p_guest_token => %L) $$, current_setting('test.j'), current_setting('test.ktok')),
  'P0001', 'forbidden', 'pitch_song: a kiosk token isn''t a guest token');
reset role;
UPDATE public.event_kiosk_pairings SET expires_at = now() - interval '1 minute';
INSERT INTO public.event_kiosk_pairings (code_hash, event_id, expires_at)
VALUES (extensions.digest('OLDOLD', 'sha256'), current_setting('test.j')::uuid, now() - interval '1 minute');
set role anon;
select is((SELECT error FROM public.pair_kiosk('OLDOLD')), 'pairing_invalid', 'pair_kiosk: an expired code → pairing_invalid');

-- ── F. Bar TV ───────────────────────────────────────────────────────────────
select is((SELECT jsonb_build_object('code', f->>'code', 'looking', jsonb_array_length(f->'looking_for') > 0)
             FROM public.jam_tv_feed(current_setting('test.c')) f),
  jsonb_build_object('code', current_setting('test.c'), 'looking', true), 'jam_tv_feed: the code and songs looking for someone');
select ok(NOT (public.jam_tv_feed(current_setting('test.c'))::text ~ current_setting('test.host')), 'jam_tv_feed: no account ids');

-- ── F2. Wrong codes count toward the limits ─────────────────────────────────
reset role;
select set_config('test.near', substr(current_setting('test.c'), 1, 7)
  || CASE WHEN right(current_setting('test.c'), 1) = 'A' THEN 'B' ELSE 'A' END, true);
select set_config('request.headers', '{"x-real-ip": "10.5.0.1"}', true);
set role anon;
select is((SELECT to_jsonb(x) FROM public.jam_preview_by_code(current_setting('test.near')) x),
          (SELECT to_jsonb(x) FROM public.jam_preview_by_code('ZZZZ2222') x),
  'near-miss: one letter off a real code answers exactly like any wrong code');
select is((SELECT to_jsonb(x) FROM public.join_jam_as_web_guest(current_setting('test.near'), 'X') x),
          (SELECT to_jsonb(x) FROM public.join_jam_as_web_guest('ZZZZ2222', 'X') x),
  'near-miss: join answers exactly like any wrong code');
select is(public.jam_tv_feed(current_setting('test.near')), public.jam_tv_feed('ZZZZ2222'),
  'near-miss: the TV feed answers exactly like any wrong code');
DO $$ BEGIN
  -- 6 misses above (preview, join and TV, twice each); 24 more fill the 30.
  FOR i IN 1..24 LOOP PERFORM public.jam_preview_by_code('ZZZZ' || lpad(i::text, 4, '2')); END LOOP;
END $$;
select throws_ok($$ SELECT * FROM public.jam_preview_by_code('ZZZZ9999') $$, 'P0001', 'rate_limited',
  'jam_preview_by_code: 30 wrong codes from one IP, then rate_limited');
select throws_ok(format($$ SELECT * FROM public.jam_preview_by_code(%L) $$, current_setting('test.c')), 'P0001', 'rate_limited',
  'jam_preview_by_code: once limited, the right code is refused too');
select throws_ok(format($$ SELECT * FROM public.join_jam_as_web_guest(%L, 'X') $$, current_setting('test.c')), 'P0001', 'rate_limited',
  'join_jam_as_web_guest: wrong codes anywhere count (joins limited too)');
select throws_ok(format($$ SELECT public.jam_tv_feed(%L) $$, current_setting('test.c')), 'P0001', 'rate_limited',
  'jam_tv_feed: wrong codes anywhere count (TV limited too)');
select throws_ok($$ SELECT * FROM public.resolve_code('ZZZZ9999') $$, 'P0001', 'rate_limited',
  'resolve_code: wrong codes anywhere count (resolve limited too)');
reset role;
select is((SELECT hits FROM public.jam_rate_limits WHERE bucket = 'code_miss' AND key = '10.5.0.1'), 30,
  'jam_rate_limits: every miss was recorded');
select set_config('request.headers', '{"x-real-ip": "10.5.0.2"}', true);
set role anon;
select is((SELECT error FROM public.jam_preview_by_code('ZZZZ9999')), 'no_jam', 'jam_preview_by_code: another IP isn''t limited');
DO $$ BEGIN
  -- Right codes don't count as misses: 100 previews of a real code are fine.
  FOR i IN 1..100 LOOP PERFORM public.jam_preview_by_code(current_setting('test.c')); END LOOP;
END $$;
select is((SELECT error FROM public.jam_preview_by_code(current_setting('test.c'))), NULL,
  'jam_preview_by_code: a crowd previewing the right code isn''t limited');
DO $$ BEGIN
  FOR i IN 1..10 LOOP PERFORM public.pair_kiosk('ZZZ' || lpad(i::text, 3, '2')); END LOOP;
END $$;
select throws_ok($$ SELECT * FROM public.pair_kiosk('ZZZ999') $$, 'P0001', 'rate_limited',
  'pair_kiosk: 10 tries from one IP, then rate_limited');
reset role;
select set_config('request.headers', '{"x-real-ip": "10.5.0.3"}', true);
set role anon;
select is((SELECT error FROM public.pair_kiosk('ZZZ999')), 'pairing_invalid', 'pair_kiosk: another IP isn''t limited');
reset role;
select set_config('request.headers', '{"x-real-ip": "10.3.0.1"}', true);

-- ── G. Ending kills every token ─────────────────────────────────────────────
reset role;
select tests.authenticate_as('g7-host@test.com');
DO $$ BEGIN
  PERFORM public.go_live(current_setting('test.j')::uuid);
  PERFORM public.end_jam(current_setting('test.j')::uuid);
END $$;
reset role;
select is((SELECT count(*)::int FROM public.event_guest_tokens WHERE event_id = current_setting('test.j')::uuid), 0,
  'end_jam: every token for the jam is gone');
select is((SELECT count(*)::int FROM public.event_kiosk_pairings WHERE event_id = current_setting('test.j')::uuid), 0,
  'end_jam: every pairing code is gone');
select tests.clear_authentication();
set role anon;
select throws_ok(format($$ SELECT public.jam_state(%L, %L) $$, current_setting('test.j'), current_setting('test.tok')), 'P0001', 'forbidden',
  'end_jam: the guest token is dead');
select throws_ok(format($$ SELECT public.add_walkup(%L, 'Late', p_guest_token => %L) $$, current_setting('test.j'), current_setting('test.ktok')),
  'P0001', 'forbidden', 'end_jam: the kiosk token is dead');
select is((SELECT f->'jam'->>'status' FROM public.jam_tv_feed(current_setting('test.c')) f), 'completed',
  'jam_tv_feed: an ended jam shows as ended, nothing else');
reset role;

select * from finish();
rollback;
