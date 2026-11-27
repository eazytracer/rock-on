-- Test: phase 2.1 contract — set_setlist_item_note (docs/redesign/10 · 1.4),
--       and the version-checked songs update the song page relies on.
-- Category: Functions + access
-- Created: 2026-11-08

begin;

select plan(9);

select tests.create_supabase_user('sp-a@test.com');
select tests.create_supabase_user('sp-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('sp-a@test.com')::text, true);
END $$;

INSERT INTO public.bands (id, name, created_by) VALUES
  ('c7000000-0000-4000-8000-000000000001', 'Page Band', current_setting('test.a')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  (current_setting('test.a')::uuid, 'c7000000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.songs (id, title, context_type, context_id, created_by) VALUES
  ('c7000000-0000-4000-8000-0000000000a1', 'Everlong', 'band',
   'c7000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid);

INSERT INTO public.setlists (id, name, band_id, context_type, context_id, created_by, items) VALUES
  ('c7000000-0000-4000-8000-0000000000b1', 'Fall Set',
   'c7000000-0000-4000-8000-000000000001', 'band', 'c7000000-0000-4000-8000-000000000001',
   current_setting('test.a')::uuid,
   '[{"id":"i1","type":"song","position":1,"songId":"c7000000-0000-4000-8000-0000000000a1","notes":"old"},
     {"id":"i2","type":"break","position":2,"breakDuration":15},
     {"id":"i3","type":"song","position":3,"songId":"c7000000-0000-4000-8000-0000000000a1"}]');

select tests.authenticate_as('sp-a@test.com');

-- ── set_setlist_item_note ───────────────────────────────────────────────────
select lives_ok($$ SELECT public.set_setlist_item_note(
  'c7000000-0000-4000-8000-0000000000b1', 'i3', 'Straight out of i1') $$,
  'item note: a member can set it');
select is((SELECT items->2->>'notes' FROM public.setlists
            WHERE id = 'c7000000-0000-4000-8000-0000000000b1'), 'Straight out of i1',
  'item note: writes the named item');
select is((SELECT items->0->>'notes' FROM public.setlists
            WHERE id = 'c7000000-0000-4000-8000-0000000000b1'), 'old',
  'item note: leaves the other items alone');
select is((SELECT jsonb_array_length(items) || ':' || (items->1->>'breakDuration')
             FROM public.setlists WHERE id = 'c7000000-0000-4000-8000-0000000000b1'), '3:15',
  'item note: keeps order and every other field');
SELECT public.set_setlist_item_note('c7000000-0000-4000-8000-0000000000b1', 'i1', '');
select is((SELECT items->0 ? 'notes' AND items->0->'notes' = 'null'::jsonb FROM public.setlists
            WHERE id = 'c7000000-0000-4000-8000-0000000000b1'), true,
  'item note: empty clears it');
select throws_ok($$ SELECT public.set_setlist_item_note(
  'c7000000-0000-4000-8000-0000000000b1', 'nope', 'x') $$,
  'P0001', 'not_found', 'item note: unknown item → not_found');

select tests.authenticate_as('sp-out@test.com');
select throws_ok($$ SELECT public.set_setlist_item_note(
  'c7000000-0000-4000-8000-0000000000b1', 'i1', 'x') $$,
  'P0001', 'not_found', 'item note: a non-member cannot write (RLS)');

-- ── version-checked update (RemoteRepository.updateSong) ────────────────────
select tests.authenticate_as('sp-a@test.com');
UPDATE public.songs SET tempo = 170
 WHERE id = 'c7000000-0000-4000-8000-0000000000a1' AND version = 1;
select is((SELECT version FROM public.songs WHERE id = 'c7000000-0000-4000-8000-0000000000a1'), 2,
  'update: the current version writes and bumps it');
UPDATE public.songs SET tempo = 120
 WHERE id = 'c7000000-0000-4000-8000-0000000000a1' AND version = 1;
select is((SELECT tempo FROM public.songs WHERE id = 'c7000000-0000-4000-8000-0000000000a1'), 170,
  'update: a stale version writes nothing');

select * from finish();
rollback;
