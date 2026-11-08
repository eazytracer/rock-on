-- Test: phase 3 contract — setlist_index and duplicate_setlist
--       (docs/redesign/10 Part 2, design/OPERATIONS §9).
-- Category: Functions + access
-- Created: 2026-11-08

begin;

select plan(12);

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
INSERT INTO public.shows (name, venue, band_id, setlist_id, scheduled_date, created_by) VALUES
  ('Old Gig', 'Somewhere', 'c8000000-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-0000000000b1', NOW() - interval '30 days', current_setting('test.a')::uuid),
  ('Next Gig', 'The Crocodile', 'c8000000-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-0000000000b1', NOW() + interval '5 days', current_setting('test.a')::uuid);

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

select tests.authenticate_as('sl-out@test.com');
select is((SELECT count(*)::int FROM public.setlist_index('band', 'c8000000-0000-4000-8000-000000000001')),
  0, 'index: a non-member sees nothing (RLS)');
select throws_ok($$ SELECT public.duplicate_setlist('c8000000-0000-4000-8000-0000000000b1') $$,
  'P0001', 'not_found', 'duplicate: a non-member cannot copy (RLS)');

select * from finish();
rollback;
