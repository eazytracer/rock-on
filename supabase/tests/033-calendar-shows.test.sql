-- Test: phase 4 contract — calendar_agenda, the show page ops and the show's set
--       copy (design/OPERATIONS §10, docs/redesign/04 → Calendar).
-- Category: Functions + access
-- Created: 2026-11-08

begin;

select plan(32);

select tests.create_supabase_user('cal-a@test.com');
select tests.create_supabase_user('cal-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('cal-a@test.com')::text, true);
END $$;

INSERT INTO public.bands (id, name, created_by) VALUES
  ('c9000000-0000-4000-8000-000000000001', 'Cal Band', current_setting('test.a')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status) VALUES
  (current_setting('test.a')::uuid, 'c9000000-0000-4000-8000-000000000001', 'admin', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.songs (id, title, guitar_tuning, duration, context_type, context_id, created_by) VALUES
  ('c9000000-0000-4000-8000-0000000000a1', 'Everlong', 'Drop D', 250, 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid),
  ('c9000000-0000-4000-8000-0000000000a2', 'Black', 'Standard', 343, 'band',
   'c9000000-0000-4000-8000-000000000001', current_setting('test.a')::uuid);

INSERT INTO public.setlists (id, name, band_id, context_type, context_id, created_by, items, notes) VALUES
  ('c9000000-0000-4000-8000-0000000000b1', 'Fall Set',
   'c9000000-0000-4000-8000-000000000001', 'band', 'c9000000-0000-4000-8000-000000000001',
   current_setting('test.a')::uuid,
   '[{"id":"i1","type":"song","position":1,"songId":"c9000000-0000-4000-8000-0000000000a2"},
     {"id":"i2","type":"song","position":2,"songId":"c9000000-0000-4000-8000-0000000000a1"}]',
   'Loud'),
  ('c9000000-0000-4000-8000-0000000000b2', 'Empty Set',
   'c9000000-0000-4000-8000-000000000001', 'band', 'c9000000-0000-4000-8000-000000000001',
   current_setting('test.a')::uuid, '[]', NULL);

INSERT INTO public.practice_sessions (id, band_id, scheduled_date, duration, location, type, name, songs,
                                      start_time, end_time) VALUES
  ('c9000000-0000-4000-8000-0000000000d1', 'c9000000-0000-4000-8000-000000000001',
   NOW() - interval '3 days', 120, 'Garage', 'rehearsal', 'Thursday run',
   '[{"songId":"c9000000-0000-4000-8000-0000000000a1","status":"completed"},
     {"songId":"c9000000-0000-4000-8000-0000000000a2","status":"skipped"}]',
   NOW() - interval '3 days', NOW() - interval '3 days' + interval '92 minutes');

select tests.authenticate_as('cal-a@test.com');

-- ── create_show / update_show ───────────────────────────────────────────────
select throws_ok(
  $$ SELECT public.create_show('c9000000-0000-4000-8000-000000000001', '{"venue":"Neumos"}') $$,
  'P0001', 'invalid', 'create: a date is required');

DO $$ BEGIN
  PERFORM set_config('test.show', public.create_show('c9000000-0000-4000-8000-000000000001',
    jsonb_build_object('venue', ' Neumos ', 'scheduledDate', (NOW() + interval '10 days')::text))::text, true);
END $$;
select is((SELECT venue || ':' || name || ':' || duration::text || ':' || confirmed::text
             FROM public.shows WHERE id = current_setting('test.show')::uuid),
  'Neumos::45:false', 'create: blank name, trimmed venue, 45 min set, not confirmed');

select lives_ok($$ SELECT public.update_show(current_setting('test.show')::uuid,
  '{"name":"Fall Kickoff","loadInTime":"6:30 PM","payment":30000,"duration":60,
    "contacts":[{"id":"c1","name":"Jess","role":"Booking","phone":"555"}]}') $$,
  'update: several fields at once');
select is((SELECT name || '|' || load_in_time || '|' || payment::text || '|' || duration::text || '|' || (contacts->0->>'name')
             FROM public.shows WHERE id = current_setting('test.show')::uuid),
  'Fall Kickoff|6:30 PM|30000|60|Jess', 'update: fields saved');
select lives_ok($$ SELECT public.update_show(current_setting('test.show')::uuid, '{"venue":""}') $$,
  'update: clearing a field');
select is((SELECT venue IS NULL AND name = 'Fall Kickoff' FROM public.shows WHERE id = current_setting('test.show')::uuid),
  true, 'update: keys not in the patch are untouched; empty clears');
select throws_ok($$ SELECT public.update_show(current_setting('test.show')::uuid, '{"payment":-5}') $$,
  'P0001', 'invalid', 'update: pay can''t be negative');
select throws_ok($$ SELECT public.update_show(current_setting('test.show')::uuid, '{"duration":2}') $$,
  'P0001', 'invalid', 'update: set length 5–600');

-- ── confirmed / cancelled ──────────────────────────────────────────────────
select lives_ok($$ SELECT public.set_show_confirmed(current_setting('test.show')::uuid, true) $$, 'confirm');
select lives_ok($$ SELECT public.set_show_cancelled(current_setting('test.show')::uuid, true) $$, 'cancel');
select is((SELECT status || ':' || confirmed::text FROM public.shows WHERE id = current_setting('test.show')::uuid),
  'cancelled:true', 'cancel keeps confirmed');
select lives_ok($$ SELECT public.set_show_cancelled(current_setting('test.show')::uuid, false) $$, 'undo cancel');
select is((SELECT status || ':' || confirmed::text FROM public.shows WHERE id = current_setting('test.show')::uuid),
  'scheduled:true', 'undo restores scheduled, confirmed untouched');

-- ── the set copy ───────────────────────────────────────────────────────────
select throws_ok($$ SELECT public.attach_set_to_show(current_setting('test.show')::uuid,
  'c9000000-0000-4000-8000-0000000000b2') $$, 'P0001', 'empty', 'attach: an empty setlist is refused');

DO $$ BEGIN
  PERFORM set_config('test.copy', public.attach_set_to_show(current_setting('test.show')::uuid,
    'c9000000-0000-4000-8000-0000000000b1')::text, true);
END $$;
select is((SELECT name || ':' || (show_id = current_setting('test.show')::uuid)::text || ':'
                  || (source_setlist_id = 'c9000000-0000-4000-8000-0000000000b1')::text || ':'
                  || (copied_at IS NOT NULL)::text || ':' || jsonb_array_length(items)::text || ':' || notes
             FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  'Fall Set:true:true:true:2:Loud', 'attach: a copy owned by the show, with its source and copy time');
select is((SELECT setlist_id FROM public.shows WHERE id = current_setting('test.show')::uuid),
  current_setting('test.copy')::uuid, 'attach: the show points at its copy');

-- Editing the show's set never changes the source.
select lives_ok($$ SELECT public.remove_setlist_item(current_setting('test.copy')::uuid, 'i1') $$,
  'edit the copy');
select is((SELECT jsonb_array_length(items) FROM public.setlists WHERE id = 'c9000000-0000-4000-8000-0000000000b1'),
  2, 'the source setlist is unchanged by edits to the copy');

-- The index skips copies and finds the set's show through them.
select is((SELECT count(*)::int FROM public.setlist_index('band', 'c9000000-0000-4000-8000-000000000001')),
  2, 'index: show copies are not listed');
select is((SELECT show_name FROM public.setlist_index('band', 'c9000000-0000-4000-8000-000000000001')
            WHERE name = 'Fall Set'), 'Fall Kickoff', 'index: the set''s show comes through its copy');

select is((SELECT public.recopy_show_set(current_setting('test.show')::uuid)), current_setting('test.copy')::uuid,
  'recopy: keeps the copy''s id');
select is((SELECT jsonb_array_length(items) FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  2, 'recopy: contents replaced from the source');

-- ── duplicate_show ─────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM set_config('test.dup', public.duplicate_show(current_setting('test.show')::uuid)::text, true);
END $$;
select is((SELECT name || ':' || confirmed::text || ':' || (scheduled_date - (SELECT scheduled_date FROM public.shows
                    WHERE id = current_setting('test.show')::uuid))::text
             FROM public.shows WHERE id = current_setting('test.dup')::uuid),
  'Fall Kickoff:false:7 days', 'duplicate: a week later, not confirmed');
select is((SELECT (c.source_setlist_id = 'c9000000-0000-4000-8000-0000000000b1')::text || ':'
                  || (c.id <> current_setting('test.copy')::uuid)::text
             FROM public.shows sh JOIN public.setlists c ON c.id = sh.setlist_id
            WHERE sh.id = current_setting('test.dup')::uuid),
  'true:true', 'duplicate: its own set copy, same source');
select lives_ok($$ SELECT public.delete_show(current_setting('test.dup')::uuid) $$, 'delete the duplicate');

-- ── calendar_agenda ────────────────────────────────────────────────────────
select is((SELECT string_agg(type || ':' || name, ',' ORDER BY at)
             FROM public.calendar_agenda('c9000000-0000-4000-8000-000000000001')),
  'practice:Thursday run,show:Fall Kickoff', 'agenda: shows and practices, soonest first');
select is((SELECT songs_total || '/' || songs_done || ':' || extract(epoch FROM ended_at - started_at)::int / 60
             FROM public.calendar_agenda('c9000000-0000-4000-8000-000000000001') WHERE type = 'practice'),
  '2/1:92', 'agenda: a played practice carries songs reached and time played');
select is((SELECT songs_total::text || ':' || confirmed::text FROM public.calendar_agenda('c9000000-0000-4000-8000-000000000001')
            WHERE type = 'show'), '2:true', 'agenda: a show carries its set size and confirmed');

-- ── delete_show ────────────────────────────────────────────────────────────
select lives_ok($$ SELECT public.delete_show(current_setting('test.show')::uuid) $$, 'delete');
select is((SELECT count(*)::int FROM public.setlists WHERE id = current_setting('test.copy')::uuid),
  0, 'delete: the set copy goes with the show');
select is((SELECT count(*)::int FROM public.setlists WHERE id = 'c9000000-0000-4000-8000-0000000000b1'),
  1, 'delete: the source setlist stays');

-- ── access ─────────────────────────────────────────────────────────────────
select tests.authenticate_as('cal-out@test.com');
select is((SELECT count(*)::int FROM public.calendar_agenda('c9000000-0000-4000-8000-000000000001')),
  0, 'access: a non-member sees nothing');

select * from finish();
rollback;
