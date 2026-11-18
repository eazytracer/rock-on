-- Test: phase 5 contract: song_charts + get_chart, save_chart, set_starting_note,
--       copy_linked_chart, duplicate_song / copy_band_songs_to_personal copying the
--       chart, create_tuning, update_tuning, the custom-tuning unique index and the
--       extended-range seeds (docs/redesign/12-tools-and-chart.md · 4).
-- Category: Functions + access
-- Created: 2026-11-16

begin;

select plan(61);

select tests.create_supabase_user('ch-a@test.com');
select tests.create_supabase_user('ch-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('ch-a@test.com')::text, true);
  PERFORM set_config('test.out', tests.get_supabase_uid('ch-out@test.com')::text, true);
END $$;

INSERT INTO public.bands (id, name, created_by) VALUES
  ('c9000000-0000-4000-8000-000000000001', 'Chart Band', current_setting('test.a')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  (current_setting('test.a')::uuid, 'c9000000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT DO NOTHING;

-- a1: band song with a chart; a2: band song, no chart; a3: band song charted later
-- (for "Copy ‹band›'s chart"); a4: band song that never gets one; f1: personal.
INSERT INTO public.songs (id, title, context_type, context_id, created_by) VALUES
  ('c9000000-0000-4000-8000-0000000000a1', 'Everlong', 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c9000000-0000-4000-8000-0000000000a2', 'Monkey Wrench', 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c9000000-0000-4000-8000-0000000000a3', 'My Hero', 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c9000000-0000-4000-8000-0000000000a4', 'Times Like These', 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c9000000-0000-4000-8000-0000000000f1', 'Solo Song', 'personal',
   current_setting('test.a'), current_setting('test.a')::uuid);
INSERT INTO public.song_charts (song_id, chordpro, starting_note) VALUES
  ('c9000000-0000-4000-8000-0000000000a1', '{title: Everlong}' || chr(10) || '[D]Hello', 62);

select tests.authenticate_as('ch-a@test.com');

-- ── get_chart / save_chart ──────────────────────────────────────────────────
select is((SELECT count(*)::int FROM public.get_chart('c9000000-0000-4000-8000-0000000000a2')), 0,
  'get_chart: no chart → no rows');
select is((SELECT starting_note::int FROM public.get_chart('c9000000-0000-4000-8000-0000000000a1')), 62,
  'get_chart: reads the song''s chart');
select is((SELECT version FROM public.save_chart('c9000000-0000-4000-8000-0000000000a2', '[G]One')), 1,
  'save_chart: first save creates version 1');
select is((SELECT chordpro || '|' || COALESCE(editor_name, '∅') FROM public.get_chart('c9000000-0000-4000-8000-0000000000a2')),
  '[G]One|' || COALESCE((SELECT name FROM public.users WHERE id = current_setting('test.a')::uuid), '∅'),
  'get_chart: returns the text and the editor''s name');
select is((SELECT version FROM public.save_chart('c9000000-0000-4000-8000-0000000000a2', '[G]Two', 1)), 2,
  'save_chart: the current version saves and bumps it');
select throws_ok($$ SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a2', '[G]Old', 1) $$,
  'P0001', 'stale_version', 'save_chart: an old version → stale_version');
select is((SELECT chordpro FROM public.get_chart('c9000000-0000-4000-8000-0000000000a2')), '[G]Two',
  'save_chart: a stale save writes nothing');
select throws_ok($$ SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a2', repeat('a', 204801)) $$,
  'P0001', 'chart_too_long', 'save_chart: over 200 KB → chart_too_long');
select lives_ok($$ SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a2', repeat('a', 204800), 2) $$,
  'save_chart: exactly 200 KB saves');
select throws_ok($$ SELECT public.get_chart('c9000000-0000-4000-8000-00000000dead') $$,
  'P0001', 'not_found', 'get_chart: unknown song → not_found');
select throws_ok($$ SELECT public.save_chart('c9000000-0000-4000-8000-00000000dead', 'x') $$,
  'P0001', 'not_found', 'save_chart: unknown song → not_found');

-- ── set_starting_note ───────────────────────────────────────────────────────
select is((SELECT starting_note::int || ':' || version
             FROM public.set_starting_note('c9000000-0000-4000-8000-0000000000a2', 50::smallint)), '50:3',
  'set_starting_note: saves the note and leaves the version alone');
select is((SELECT starting_note FROM public.set_starting_note('c9000000-0000-4000-8000-0000000000a2', NULL)), NULL,
  'set_starting_note: NULL clears');
select is((SELECT chordpro || ':' || starting_note
             FROM public.set_starting_note('c9000000-0000-4000-8000-0000000000a4', 40::smallint)), ':40',
  'set_starting_note: creates a chart row holding only the note');
select throws_ok($$ SELECT public.set_starting_note('c9000000-0000-4000-8000-0000000000a2', 128::smallint) $$,
  'P0001', 'invalid_note', 'set_starting_note: above 127 → invalid_note');
select throws_ok($$ SELECT public.set_starting_note('c9000000-0000-4000-8000-0000000000a2', (-1)::smallint) $$,
  'P0001', 'invalid_note', 'set_starting_note: below 0 → invalid_note');

-- ── audit: a small row, the band's feed ─────────────────────────────────────
RESET ROLE;
select is((SELECT band_id::text FROM public.audit_log
            WHERE table_name = 'song_charts' AND record_id = 'c9000000-0000-4000-8000-0000000000a2'
            ORDER BY changed_at DESC LIMIT 1),
  'c9000000-0000-4000-8000-000000000001', 'audit: chart changes reach the band''s feed');
select is((SELECT bool_and(NOT (new_values ? 'chordpro') AND new_values ? 'version')
             FROM public.audit_log
            WHERE table_name = 'song_charts' AND record_id = 'c9000000-0000-4000-8000-0000000000a2'), true,
  'audit: rows carry song_id + version, never the chart text');
select tests.authenticate_as('ch-a@test.com');

-- ── duplicate_song copies the chart ─────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('test.dup',
    (SELECT id::text FROM public.duplicate_song('c9000000-0000-4000-8000-0000000000a1')), true);
END $$;
select is((SELECT chordpro || ':' || starting_note FROM public.get_chart(current_setting('test.dup')::uuid)),
  '{title: Everlong}' || chr(10) || '[D]Hello:62', 'duplicate_song: copies the chart');

-- ── copy_band_songs_to_personal: a snapshot of the chart (decision 2) ───────
select is((SELECT count(*)::int FROM public.copy_band_songs_to_personal(ARRAY[
    'c9000000-0000-4000-8000-0000000000a1', 'c9000000-0000-4000-8000-0000000000a3',
    'c9000000-0000-4000-8000-0000000000a4']::uuid[])), 3,
  'copy to personal: three copies');
DO $$ BEGIN
  PERFORM set_config('test.c1', (SELECT id::text FROM public.songs
    WHERE linked_from_song_id = 'c9000000-0000-4000-8000-0000000000a1' AND context_type = 'personal'), true);
  PERFORM set_config('test.c3', (SELECT id::text FROM public.songs
    WHERE linked_from_song_id = 'c9000000-0000-4000-8000-0000000000a3' AND context_type = 'personal'), true);
  PERFORM set_config('test.c4', (SELECT id::text FROM public.songs
    WHERE linked_from_song_id = 'c9000000-0000-4000-8000-0000000000a4' AND context_type = 'personal'), true);
END $$;
select is((SELECT chordpro || ':' || starting_note FROM public.get_chart(current_setting('test.c1')::uuid)),
  '{title: Everlong}' || chr(10) || '[D]Hello:62', 'copy to personal: the copy gets the band''s chart');
select is((SELECT count(*)::int FROM public.get_chart(current_setting('test.c3')::uuid)), 0,
  'copy to personal: no band chart → the copy has none');
SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a1', '[E]Changed');
select is((SELECT chordpro FROM public.get_chart(current_setting('test.c1')::uuid)),
  '{title: Everlong}' || chr(10) || '[D]Hello', 'copy to personal: later band edits don''t reach the copy');

-- ── copy_linked_chart ("Copy ‹band›'s chart") ───────────────────────────────
select throws_ok(format($$ SELECT public.copy_linked_chart(%L) $$, current_setting('test.c3')),
  'P0001', 'not_found', 'copy_linked_chart: band song without a chart → not_found');
SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a3', '[A]Hero');
select is((SELECT chordpro FROM public.copy_linked_chart(current_setting('test.c3')::uuid)), '[A]Hero',
  'copy_linked_chart: copies the band''s chart onto an empty copy');
select throws_ok(format($$ SELECT public.copy_linked_chart(%L) $$, current_setting('test.c3')),
  'P0001', 'chart_exists', 'copy_linked_chart: the copy already has a chart → chart_exists');
SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a4', '[C]Times');
select is((SELECT chordpro || ':' || starting_note FROM public.copy_linked_chart(current_setting('test.c4')::uuid)),
  '[C]Times:40', 'copy_linked_chart: fills a note-only chart row and keeps its note');
select throws_ok($$ SELECT public.copy_linked_chart('c9000000-0000-4000-8000-0000000000f1') $$,
  'P0001', 'forbidden', 'copy_linked_chart: not a linked copy → forbidden');

-- ── a non-member ────────────────────────────────────────────────────────────
select tests.authenticate_as('ch-out@test.com');
select throws_ok($$ SELECT public.get_chart('c9000000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'forbidden', 'non-member: get_chart → forbidden');
select throws_ok($$ SELECT public.save_chart('c9000000-0000-4000-8000-0000000000a1', 'x') $$,
  'P0001', 'forbidden', 'non-member: save_chart → forbidden');
select throws_ok($$ SELECT public.set_starting_note('c9000000-0000-4000-8000-0000000000a1', 40::smallint) $$,
  'P0001', 'forbidden', 'non-member: set_starting_note → forbidden');
select throws_ok($$ SELECT public.copy_linked_chart('c9000000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'forbidden', 'non-member: copy_linked_chart → forbidden');
select is((SELECT count(*)::int FROM public.song_charts), 0,
  'non-member: RLS hides every chart');

select tests.authenticate_as('ch-a@test.com');
select is((SELECT count(*)::int FROM public.song_charts
            WHERE song_id = 'c9000000-0000-4000-8000-0000000000a1'), 1,
  'member: reads the band chart directly');
select throws_ok($$ INSERT INTO public.song_charts (song_id) VALUES ('c9000000-0000-4000-8000-0000000000f1') $$,
  '42501', NULL, 'member: no direct writes (RPCs only)');

-- ── tunings: create_tuning ──────────────────────────────────────────────────
select is((SELECT name || ':' || context_type || ':' || version
             FROM public.create_tuning('  Open C  ', 'guitar', 6, '{36,43,48,55,60,64}',
                                       'personal', current_setting('test.a'), '#ff0000')),
  'Open C:personal:1', 'create_tuning: saves a trimmed name in the context');
select throws_ok(format($$ SELECT public.create_tuning('Again', 'guitar', 6, '{36,43,48,55,60,64}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'duplicate_tuning', 'create_tuning: same strings as a custom in the context → duplicate_tuning');
select throws_ok(format($$ SELECT public.create_tuning('Mine', 'guitar', 6, '{38,45,50,55,59,64}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'duplicate_tuning', 'create_tuning: same strings as a built-in → duplicate_tuning');
DO $$
DECLARE v_hint TEXT;
BEGIN
  PERFORM public.create_tuning('Mine', 'guitar', 6, '{38,45,50,55,59,64}', 'personal', current_setting('test.a'));
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT;
  PERFORM set_config('test.hint', v_hint, true);
END $$;
select is(current_setting('test.hint'), 'That''s Drop D. It''s already in your tunings.',
  'create_tuning: the duplicate hint names the tuning');
select lives_ok($$ SELECT public.create_tuning('Band Open C', 'guitar', 6, '{36,43,48,55,60,64}',
                                       'band', 'c9000000-0000-4000-8000-000000000001') $$,
  'create_tuning: the same strings in another context are fine');
select throws_ok(format($$ SELECT public.create_tuning('   ', 'guitar', 6, '{36,43,48,55,60,62}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'name_required', 'create_tuning: blank name → name_required');
select throws_ok(format($$ SELECT public.create_tuning('High', 'guitar', 6, '{48,45,50,55,59,64}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'invalid_pitches', 'create_tuning: more than 7 up → invalid_pitches');
select throws_ok(format($$ SELECT public.create_tuning('Low', 'bass', 4, '{15,33,38,43}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'invalid_pitches', 'create_tuning: more than an octave down → invalid_pitches');
select throws_ok(format($$ SELECT public.create_tuning('Nine', 'guitar', 9, '{25,30,35,40,45,50,55,59,64}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'invalid_pitches', 'create_tuning: unsupported string count → invalid_pitches');
select throws_ok(format($$ SELECT public.create_tuning('Short', 'guitar', 6, '{40,45,50,55,59}',
                                       'personal', %L) $$, current_setting('test.a')),
  'P0001', 'invalid_pitches', 'create_tuning: wrong number of strings → invalid_pitches');
select throws_ok($$ SELECT public.create_tuning('Other', 'guitar', 6, '{36,43,48,55,60,62}',
                                       'band', 'c9000000-0000-4000-8000-0000000000ff') $$,
  'P0001', 'forbidden', 'create_tuning: a band you''re not in → forbidden');

-- ── tunings: update_tuning ──────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('test.t1', (SELECT id::text FROM public.tunings WHERE name = 'Open C'), true);
END $$;
select is((SELECT name || ':' || version || ':' || COALESCE(color, '∅')
             FROM public.update_tuning(current_setting('test.t1')::uuid, 'Open C6',
                                       '{36,43,48,55,60,64}', NULL, 1)),
  'Open C6:2:∅', 'update_tuning: renames, keeps its own strings, bumps the version');
select throws_ok(format($$ SELECT public.update_tuning(%L, 'X', '{36,43,48,55,60,64}', NULL, 1) $$,
                        current_setting('test.t1')),
  'P0001', 'stale_version', 'update_tuning: an old version → stale_version');
select throws_ok(format($$ SELECT public.update_tuning(%L, 'X', '{40,45,50,55,59,64}') $$,
                        current_setting('test.t1')),
  'P0001', 'duplicate_tuning', 'update_tuning: strings of a built-in → duplicate_tuning');
select throws_ok(format($$ SELECT public.update_tuning(%L, 'X', '{40,45,50,55,59}') $$,
                        current_setting('test.t1')),
  'P0001', 'invalid_pitches', 'update_tuning: wrong number of strings → invalid_pitches');
select throws_ok(format($$ SELECT public.update_tuning(%L, '', '{36,43,48,55,60,62}') $$,
                        current_setting('test.t1')),
  'P0001', 'name_required', 'update_tuning: blank name → name_required');
select throws_ok($$ SELECT public.update_tuning((SELECT id FROM public.tunings WHERE slug = 'drop-d'),
                                       'Mine', '{38,45,50,55,59,62}') $$,
  'P0001', 'forbidden', 'update_tuning: a built-in → forbidden');
select throws_ok($$ SELECT public.update_tuning('c9000000-0000-4000-8000-00000000dead', 'X', '{40,45,50,55,59,62}') $$,
  'P0001', 'not_found', 'update_tuning: unknown tuning → not_found');
select tests.authenticate_as('ch-out@test.com');
select throws_ok(format($$ SELECT public.update_tuning(%L, 'Stolen', '{36,43,48,55,60,62}') $$,
                        current_setting('test.t1')),
  'P0001', 'forbidden', 'update_tuning: someone else''s tuning → forbidden');

-- ── the unique index, seeds, colours, grants ────────────────────────────────
RESET ROLE;
select has_index('public', 'tunings', 'tunings_unique_pitches', 'tunings: unique index on custom pitches');
select throws_ok(format($$ INSERT INTO public.tunings
    (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
    VALUES ('guitar', 6, '{36,43,48,55,60,64}', 'Dupe', false, 'personal', %L, %L) $$,
    current_setting('test.a'), current_setting('test.a')),
  '23505', NULL, 'tunings: the index refuses a duplicate custom in one context');
select is((SELECT count(*)::int FROM public.tunings WHERE is_builtin), 22,
  'seeds: 22 built-ins (four extended-range added)');
select is((SELECT string_agg(slug || '=' || array_to_string(pitches, ','), ' ' ORDER BY slug)
             FROM public.tunings
            WHERE slug IN ('drop-a-7', 'a-standard-7', 'drop-g-sharp-7', 'b-standard-baritone')),
  'a-standard-7=33,38,43,48,53,57,62 b-standard-baritone=35,40,45,50,54,59 '
  'drop-a-7=33,40,45,50,55,59,64 drop-g-sharp-7=32,39,44,49,54,58,63',
  'seeds: the extended-range pitches');
select is((SELECT string_agg(slug || '=' || COALESCE(color, 'grey'), ' ' ORDER BY slug)
             FROM public.tunings
            WHERE slug IN ('standard-7', 'standard-8', 'bass-standard', 'bass-5', 'bass-6', 'drop-a-7',
                           'bass-drop-d', 'a-standard-7', 'bass-eb', 'drop-g-sharp-7', 'b-standard-baritone')),
  'a-standard-7=#0ea5e9 b-standard-baritone=grey bass-5=#60a5fa bass-6=#60a5fa bass-drop-d=#84cc16 '
  'bass-eb=#14b8a6 bass-standard=#60a5fa drop-a-7=#84cc16 drop-g-sharp-7=#f59e0b '
  'standard-7=#60a5fa standard-8=#60a5fa',
  'seeds: extended-range colours follow their 6-string shape (decision 15)');
select ok((SELECT bool_and(has_table_privilege('authenticated', 'public.song_charts', p))
             FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  'grants: authenticated on song_charts');
select ok((SELECT bool_and(has_table_privilege('service_role', 'public.song_charts', p))
             FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  'grants: service_role on song_charts');

select * from finish();
rollback;
