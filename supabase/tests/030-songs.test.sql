-- Test: phase 2 contract — song_usage, song_next_shows, set_band_note,
--       duplicate_song, delete_song, band_songs_not_in_my_catalog,
--       copy_band_songs_to_personal (design/OPERATIONS.md §6).
-- Category: Functions + access
-- Created: 2026-11-07

begin;

select plan(20);

select tests.create_supabase_user('sg-a@test.com');
select tests.create_supabase_user('sg-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('sg-a@test.com')::text, true);
  PERFORM set_config('test.out', tests.get_supabase_uid('sg-out@test.com')::text, true);
END $$;

INSERT INTO public.bands (id, name, created_by) VALUES
  ('c6000000-0000-4000-8000-000000000001', 'Song Band', current_setting('test.a')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  (current_setting('test.a')::uuid, 'c6000000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.songs (id, title, artist, album, context_type, context_id, created_by, notes) VALUES
  ('c6000000-0000-4000-8000-0000000000a1', 'Everlong', 'Foo Fighters', 'The Colour and the Shape',
   'band', 'c6000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid, 'Drop D'),
  ('c6000000-0000-4000-8000-0000000000a2', 'Monkey Wrench', 'Foo Fighters', NULL,
   'band', 'c6000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid, NULL),
  ('c6000000-0000-4000-8000-0000000000a3', 'Hidden One', 'Nobody', NULL,
   'band', 'c6000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid, NULL);
INSERT INTO public.song_hidden (user_id, song_id)
VALUES (current_setting('test.a')::uuid, 'c6000000-0000-4000-8000-0000000000a3');

INSERT INTO public.setlists (id, name, band_id, created_by, items) VALUES
  ('c6000000-0000-4000-8000-0000000000b1', 'Fall Set',
   'c6000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid,
   '[{"id":"i1","type":"song","position":1,"songId":"c6000000-0000-4000-8000-0000000000a2"},
     {"id":"i2","type":"break","position":2},
     {"id":"i3","type":"song","position":3,"songId":"c6000000-0000-4000-8000-0000000000a1"}]');
INSERT INTO public.shows (id, name, band_id, setlist_id, scheduled_date, created_by) VALUES
  ('c6000000-0000-4000-8000-0000000000c1', 'Later Gig', 'c6000000-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-0000000000b1', now() + interval '10 days', current_setting('test.a')::uuid),
  ('c6000000-0000-4000-8000-0000000000c2', 'Sooner Gig', 'c6000000-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-0000000000b1', now() + interval '3 days', current_setting('test.a')::uuid),
  ('c6000000-0000-4000-8000-0000000000c3', 'Old Gig', 'c6000000-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-0000000000b1', now() - interval '30 days', current_setting('test.a')::uuid);

select tests.authenticate_as('sg-a@test.com');

-- ── song_usage ──────────────────────────────────────────────────────────────
select is((SELECT "position" FROM public.song_usage('c6000000-0000-4000-8000-0000000000a1')
            WHERE kind = 'setlist'), 2,
  'usage: position counts songs only, not breaks');
select is((SELECT count(*)::int FROM public.song_usage('c6000000-0000-4000-8000-0000000000a1')
            WHERE kind = 'show'), 3,
  'usage: every show playing that set');

-- ── song_next_shows ─────────────────────────────────────────────────────────
select is((SELECT show_name FROM public.song_next_shows('c6000000-0000-4000-8000-000000000001')
            WHERE song_id = 'c6000000-0000-4000-8000-0000000000a1'), 'Sooner Gig',
  'next shows: the soonest upcoming show');
select is((SELECT count(*)::int FROM public.song_next_shows('c6000000-0000-4000-8000-000000000001')), 2,
  'next shows: one row per song in an upcoming set');

-- ── set_band_note ───────────────────────────────────────────────────────────
select is((SELECT notes_edited_by FROM public.set_band_note(
            'c6000000-0000-4000-8000-0000000000a1', 'Capo 2')),
  current_setting('test.a')::uuid, 'band note: records the last editor');
select is((SELECT notes FROM public.songs WHERE id = 'c6000000-0000-4000-8000-0000000000a1'),
  'Capo 2', 'band note: saved');
select throws_ok(
  $$SELECT public.set_band_note('c6000000-0000-4000-8000-0000000000a1', 'x', -1)$$,
  'P0001', 'stale_version', 'band note: a stale version is rejected');

-- ── duplicate_song ──────────────────────────────────────────────────────────
select is((SELECT title FROM public.duplicate_song('c6000000-0000-4000-8000-0000000000a1')),
  'Everlong (copy)', 'duplicate: "(copy)" title');
select is((SELECT album FROM public.songs WHERE title = 'Everlong (copy)'),
  'The Colour and the Shape', 'duplicate: copies facts');
select is((SELECT notes FROM public.songs WHERE title = 'Everlong (copy)'),
  NULL, 'duplicate: does not copy notes');

-- ── band_songs_not_in_my_catalog / copy_band_songs_to_personal ──────────────
select is((SELECT count(*)::int FROM public.band_songs_not_in_my_catalog()), 3,
  'not in catalog: band songs minus hidden ones');
select is((SELECT count(*)::int FROM public.copy_band_songs_to_personal(
            ARRAY['c6000000-0000-4000-8000-0000000000a2']::uuid[])), 1,
  'copy: picked songs only');
select is((SELECT context_id FROM public.songs
            WHERE linked_from_song_id = 'c6000000-0000-4000-8000-0000000000a2'),
  current_setting('test.a'), 'copy: lands in My Songs, linked to the band song');
select is((SELECT count(*)::int FROM public.copy_band_songs_to_personal()), 2,
  'copy all: skips songs already in My Songs');
select is((SELECT count(*)::int FROM public.band_songs_not_in_my_catalog()), 0,
  'not in catalog: empty once copied');

-- ── delete_song ─────────────────────────────────────────────────────────────
select lives_ok($$SELECT public.delete_song('c6000000-0000-4000-8000-0000000000a1')$$,
  'delete: succeeds');
select is((SELECT jsonb_array_length(items) FROM public.setlists
            WHERE id = 'c6000000-0000-4000-8000-0000000000b1'), 2,
  'delete: removed from the setlist, the rest kept');

-- ── access ──────────────────────────────────────────────────────────────────
select tests.authenticate_as('sg-out@test.com');
select throws_ok($$SELECT * FROM public.song_usage('c6000000-0000-4000-8000-0000000000a2')$$,
  'P0001', 'forbidden', 'usage: outsiders are refused');
select throws_ok($$SELECT public.delete_song('c6000000-0000-4000-8000-0000000000a2')$$,
  'P0001', 'forbidden', 'delete: outsiders are refused');
select throws_ok($$SELECT * FROM public.song_next_shows('c6000000-0000-4000-8000-000000000001')$$,
  'P0001', 'forbidden', 'next shows: outsiders are refused');

select * from finish();
rollback;
