-- Test: phase 3 contract — setlist_index, duplicate_setlist and the editor ops
--       (docs/redesign/10 Part 2, design/OPERATIONS §9).
-- Category: Functions + access
-- Created: 2026-11-08

begin;

select plan(33);

select tests.create_supabase_user('sl-a@test.com');
select tests.create_supabase_user('sl-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('sl-a@test.com')::text, true);
END $$;

INSERT INTO public.bands (id, name, created_by) VALUES
  ('c8000000-0000-4000-8000-000000000001', 'Index Band', current_setting('test.a')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  (current_setting('test.a')::uuid, 'c8000000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.songs (id, title, guitar_tuning, duration, context_type, context_id, created_by) VALUES
  ('c8000000-0000-4000-8000-0000000000a1', 'Everlong', 'Drop D', 250, 'band',
   'c8000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c8000000-0000-4000-8000-0000000000a2', 'Black', 'Standard', 343, 'band',
   'c8000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid);

INSERT INTO public.songs (id, title, guitar_tuning, duration, context_type, context_id, created_by) VALUES
  ('c8000000-0000-4000-8000-0000000000a3', 'Mine', 'Standard', 200, 'personal',
   current_setting('test.a'), current_setting('test.a')::uuid),
  ('c8000000-0000-4000-8000-0000000000a4', 'Breed', 'Standard', 184, 'band',
   'c8000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid);

INSERT INTO public.setlists (id, name, band_id, context_type, context_id, created_by, items) VALUES
  ('c8000000-0000-4000-8000-0000000000b1', 'Fall Set',
   'c8000000-0000-4000-8000-000000000001', 'band', 'c8000000-0000-4000-8000-000000000001',
   current_setting('test.a')::uuid,
   '[{"id":"i1","type":"song","position":1,"songId":"c8000000-0000-4000-8000-0000000000a2"},
     {"id":"i2","type":"break","position":2,"breakDuration":15},
     {"id":"i3","type":"section","position":3,"sectionTitle":"Set 2"},
     {"id":"i4","type":"song","position":4,"songId":"c8000000-0000-4000-8000-0000000000a1","notes":"slow"}]'),
  ('c8000000-0000-4000-8000-0000000000b2', 'Empty Set',
   'c8000000-0000-4000-8000-000000000001', 'band', 'c8000000-0000-4000-8000-000000000001',
   current_setting('test.a')::uuid, '[]');

-- A past show and an upcoming one use Fall Set; the upcoming one wins.
INSERT INTO public.shows (name, venue, band_id, setlist_id, scheduled_date, created_by, duration) VALUES
  ('Old Gig', 'Somewhere', 'c8000000-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-0000000000b1', NOW() - interval '30 days', current_setting('test.a')::uuid, 60),
  ('Next Gig', 'The Crocodile', 'c8000000-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-0000000000b1', NOW() + interval '5 days', current_setting('test.a')::uuid, 45);

select tests.authenticate_as('sl-a@test.com');

-- ── setlist_index ───────────────────────────────────────────────────────────
select is((SELECT count(*)::int FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')),
  2, 'index: one row per setlist in the context');
select is((SELECT jsonb_agg(x->>'title') FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001') i,
                  jsonb_array_elements(i.songs) x WHERE i.name = 'Fall Set'),
  '["Black", "Everlong"]'::jsonb, 'index: songs in set order, breaks and sections skipped');
select is((SELECT songs->1->>'tuning' || ':' || (songs->1->>'seconds')
             FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001') WHERE name = 'Fall Set'),
  'Drop D:250', 'index: each song carries tuning and seconds');
select is((SELECT break_minutes FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')
            WHERE name = 'Fall Set'), 15, 'index: break minutes summed');
select is((SELECT show_minutes FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')
            WHERE name = 'Fall Set'), 45, 'index: carries the show length');
select is((SELECT show_name || ' @ ' || show_venue FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')
            WHERE name = 'Fall Set'), 'Next Gig @ The Crocodile', 'index: the upcoming show beats a past one');
select is((SELECT songs::text || ':' || (show_id IS NULL)::text FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')
            WHERE name = 'Empty Set'), '[]:true', 'index: an empty set has no songs and no show');

-- ── duplicate_setlist ───────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('test.copy',
    public.duplicate_setlist('c8000000-0000-4000-8000-0000000000b1')::text, true);
END $$;
select is((SELECT name FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  'Fall Set copy', 'duplicate: named "‹name› copy"');
select is((SELECT jsonb_array_length(items) || ':' || (items->3->>'notes') || ':' || (items->1->>'breakDuration')
             FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  '4:slow:15', 'duplicate: copies items, breaks and per-set notes');
select isnt((SELECT items->0->>'id' FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  'i1', 'duplicate: items get fresh ids');
select is((SELECT show_id IS NULL AND NOT EXISTS (
             SELECT 1 FROM public.shows WHERE setlist_id = current_setting('test.copy')::uuid)
             FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  true, 'duplicate: not attached to a show');


-- ── editor ops (on Empty Set: b2) ──────────────────────────────────────────
select tests.authenticate_as('sl-a@test.com');
select is((SELECT array_length(public.add_songs_to_setlist('c8000000-0000-4000-8000-0000000000b2',
            ARRAY['c8000000-0000-4000-8000-0000000000a1','c8000000-0000-4000-8000-0000000000a2']::uuid[]), 1)),
  2, 'add: returns one id per song');
select is((SELECT jsonb_agg(it->>'songId' ORDER BY (it->>'position')::int)
             FROM public.setlists, jsonb_array_elements(items) it WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  '["c8000000-0000-4000-8000-0000000000a1", "c8000000-0000-4000-8000-0000000000a2"]'::jsonb,
  'add: songs appended in order with positions');
select throws_ok($$ SELECT public.add_songs_to_setlist('c8000000-0000-4000-8000-0000000000b2',
            ARRAY['c8000000-0000-4000-8000-0000000000a1']::uuid[]) $$,
  'P0001', 'duplicate', 'add: a song already in the set is refused');
DO $$ BEGIN
  PERFORM set_config('test.first', (SELECT items->0->>'id' FROM public.setlists
    WHERE id = 'c8000000-0000-4000-8000-0000000000b2'), true);
END $$;
DO $$ BEGIN
  PERFORM set_config('test.after', (public.add_songs_to_setlist('c8000000-0000-4000-8000-0000000000b2',
    ARRAY['c8000000-0000-4000-8000-0000000000a4']::uuid[], current_setting('test.first')))[1], true);
END $$;
select is((SELECT items->1->>'id' FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  current_setting('test.after'), 'add: after an item lands right after it');

-- From my songs: a personal song is copied into the band, once.
DO $$ BEGIN
  PERFORM public.add_songs_to_setlist('c8000000-0000-4000-8000-0000000000b2',
    ARRAY['c8000000-0000-4000-8000-0000000000a3']::uuid[]);
END $$;
select is((SELECT s.context_type || ':' || s.title FROM public.setlists sl,
             jsonb_array_elements(sl.items) it JOIN public.songs s ON s.id = (it->>'songId')::uuid
            WHERE sl.id = 'c8000000-0000-4000-8000-0000000000b2' AND it->>'position' = '4'),
  'band:Mine', 'add: your own song is copied into the band');
select is((SELECT linked_from_song_id IS NOT NULL FROM public.songs WHERE id = 'c8000000-0000-4000-8000-0000000000a3'),
  true, 'add: your song is linked to the band copy');
select throws_ok($$ SELECT public.add_songs_to_setlist('c8000000-0000-4000-8000-0000000000b2',
            ARRAY['c8000000-0000-4000-8000-0000000000a3']::uuid[]) $$,
  'P0001', 'duplicate', 'add: adding it again finds the band copy (no second copy)');

-- Breaks and sections.
DO $$ BEGIN
  PERFORM set_config('test.brk', public.insert_setlist_item('c8000000-0000-4000-8000-0000000000b2',
    'break', current_setting('test.first')), true);
  PERFORM set_config('test.sec', public.insert_setlist_item('c8000000-0000-4000-8000-0000000000b2',
    'section', NULL, NULL, NULL, 'Encore'), true);
END $$;
select is((SELECT (items->1->>'type') || ':' || (items->1->>'breakDuration') FROM public.setlists
            WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  'break:15', 'insert: a break defaults to 15 min, after the item');
select is((SELECT (items->-1->>'sectionTitle') FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  'Encore', 'insert: a section with no anchor goes at the end');
DO $$ BEGIN
  PERFORM set_config('test.top', public.insert_setlist_item('c8000000-0000-4000-8000-0000000000b2',
    'section', '', NULL, NULL, 'Opener'), true);
END $$;
select is((SELECT items->0->>'id' FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  current_setting('test.top'), 'insert: an empty anchor means the top');
DO $$ BEGIN
  PERFORM public.remove_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.top'));
END $$;
select throws_ok($$ SELECT public.insert_setlist_item('c8000000-0000-4000-8000-0000000000b2', 'break', NULL, 90) $$,
  'P0001', 'invalid', 'insert: a break is 5–60 min');
select throws_ok($$ SELECT public.insert_setlist_item('c8000000-0000-4000-8000-0000000000b2', 'section', NULL, NULL, NULL, '  ') $$,
  'P0001', 'invalid', 'insert: a section needs a label');

-- Update.
DO $$ BEGIN
  PERFORM public.update_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.brk'),
    '{"breakDuration": 20, "breakNotes": "Swap kit"}');
  PERFORM public.update_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.first'),
    '{"notes": "Count in slow", "sectionTitle": "ignored"}');
END $$;
select is((SELECT (items->1->>'breakDuration') || ':' || (items->1->>'breakNotes') || ':' ||
                  (items->0->>'notes') || ':' || COALESCE(items->0->>'sectionTitle', '-')
             FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  '20:Swap kit:Count in slow:-', 'update: break and per-set note change; foreign keys ignored');
select throws_ok($$ SELECT public.update_setlist_item('c8000000-0000-4000-8000-0000000000b2', 'gone', '{}') $$,
  'P0001', 'not_found', 'update: a removed row says so');

-- Move and remove.
DO $$ BEGIN
  PERFORM public.move_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.sec'), 0);
END $$;
select is((SELECT (items->0->>'id') = current_setting('test.sec') AND (items->0->>'position') = '1'
             FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  true, 'move: to the top, positions renumbered');
DO $$ BEGIN
  PERFORM public.move_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.sec'), 99);
END $$;
select is((SELECT items->-1->>'id' FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  current_setting('test.sec'), 'move: past the end clamps to last');
DO $$ BEGIN
  PERFORM public.remove_setlist_item('c8000000-0000-4000-8000-0000000000b2', current_setting('test.brk'));
END $$;
select is((SELECT jsonb_array_length(items) || ':' ||
                  NOT EXISTS (SELECT 1 FROM jsonb_array_elements(items) it WHERE it->>'id' = current_setting('test.brk'))
             FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  '5:true', 'remove: the row goes, the rest stay');

-- Rename and notes.
select throws_ok($$ SELECT public.rename_setlist('c8000000-0000-4000-8000-0000000000b2', '   ') $$,
  'P0001', 'invalid', 'rename: 1–80 characters');
DO $$ BEGIN
  PERFORM public.rename_setlist('c8000000-0000-4000-8000-0000000000b2', '  Encore Ideas ');
  PERFORM public.set_setlist_notes('c8000000-0000-4000-8000-0000000000b2', 'Two sets.');
END $$;
select is((SELECT name || ':' || notes FROM public.setlists WHERE id = 'c8000000-0000-4000-8000-0000000000b2'),
  'Encore Ideas:Two sets.', 'rename + notes save (trimmed)');

select tests.authenticate_as('sl-out@test.com');
select is((SELECT count(*)::int FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')),
  0, 'index: a non-member sees nothing (RLS)');
select throws_ok($$ SELECT public.duplicate_setlist('c8000000-0000-4000-8000-0000000000b1') $$,
  'P0001', 'not_found', 'duplicate: a non-member cannot copy (RLS)');
select throws_ok($$ SELECT public.remove_setlist_item('c8000000-0000-4000-8000-0000000000b1', 'i1') $$,
  'P0001', 'not_found', 'remove: a non-member cannot edit (RLS)');

select * from finish();
rollback;
