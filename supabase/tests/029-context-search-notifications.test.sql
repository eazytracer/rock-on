-- Test: phase 1 contract — list_my_contexts, search, list_notifications,
--       mark_notifications_read (design/OPERATIONS.md §3).
-- Category: Functions + access
-- Created: 2026-11-07
--
-- Uids go into GUCs while role=postgres; writes that should be audited run as
-- the acting user so audit_log records them.

begin;

select plan(17);

select tests.create_supabase_user('cs-a@test.com');
select tests.create_supabase_user('cs-b@test.com');
select tests.create_supabase_user('cs-out@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('cs-a@test.com')::text, true);
  PERFORM set_config('test.b', tests.get_supabase_uid('cs-b@test.com')::text, true);
  PERFORM set_config('test.out', tests.get_supabase_uid('cs-out@test.com')::text, true);
END $$;

-- Band 1: A + B. Band 2: outsider only.
INSERT INTO public.bands (id, name, created_by) VALUES
  ('c5000000-0000-4000-8000-000000000001', 'Search Band', current_setting('test.a')::uuid),
  ('c5000000-0000-4000-8000-000000000002', 'Other Band', current_setting('test.out')::uuid);
INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date) VALUES
  (current_setting('test.a')::uuid,   'c5000000-0000-4000-8000-000000000001', 'admin',  'active', now() - interval '1 day'),
  (current_setting('test.b')::uuid,   'c5000000-0000-4000-8000-000000000001', 'member', 'active', now() - interval '1 day'),
  (current_setting('test.out')::uuid, 'c5000000-0000-4000-8000-000000000002', 'admin',  'active', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- B adds a song and a setlist containing it (audited as B).
select tests.authenticate_as('cs-b@test.com');
INSERT INTO public.songs (id, title, artist, context_type, context_id, created_by)
VALUES ('c5000000-0000-4000-8000-0000000000a1', 'Everlong', 'Foo Fighters', 'band',
        'c5000000-0000-4000-8000-000000000001', current_setting('test.b')::uuid);
INSERT INTO public.setlists (id, name, band_id, created_by, items)
VALUES ('c5000000-0000-4000-8000-0000000000b1', 'Fall Set',
        'c5000000-0000-4000-8000-000000000001', current_setting('test.b')::uuid,
        '[{"id":"i1","type":"song","position":1,"songId":"c5000000-0000-4000-8000-0000000000a1"}]');
reset role;

-- The outsider has a matching song in their own band.
INSERT INTO public.songs (title, artist, context_type, context_id, created_by)
VALUES ('Everlong (acoustic)', 'Foo Fighters', 'band',
        'c5000000-0000-4000-8000-000000000002', current_setting('test.out')::uuid);

-- ── list_my_contexts ────────────────────────────────────────────────────────
select tests.authenticate_as('cs-a@test.com');

select is((SELECT count(*)::int FROM public.list_my_contexts()), 1,
  'contexts: only bands the user is an active member of');
select is((SELECT member_count FROM public.list_my_contexts()), 2,
  'contexts: member count');
select ok((SELECT has_unread FROM public.list_my_contexts()),
  'contexts: a bandmate''s change makes the band unread');

-- ── search ──────────────────────────────────────────────────────────────────
select is((SELECT count(*)::int FROM public.search('ever', 'c5000000-0000-4000-8000-000000000001')
            WHERE kind = 'song'), 1,
  'search: finds the band song, not another band''s');
select is((SELECT matched_song FROM public.search('everlong', 'c5000000-0000-4000-8000-000000000001')
            WHERE kind = 'setlist'), 'Everlong',
  'search: finds a setlist by a song in it');
select is((SELECT count(*)::int FROM public.search('fall', 'c5000000-0000-4000-8000-000000000001')
            WHERE kind = 'setlist' AND matched_song IS NULL), 1,
  'search: finds a setlist by name');
select is((SELECT count(*)::int FROM public.search('ever', NULL)), 0,
  'search: Personal scope excludes band content');
select is((SELECT count(*)::int FROM public.search('ever', NULL, true) WHERE kind = 'song'), 1,
  'search: all contexts still only covers the user''s own contexts');
select is((SELECT count(*)::int FROM public.search('   ', 'c5000000-0000-4000-8000-000000000001')), 0,
  'search: a blank query returns nothing');
select throws_ok(
  $$SELECT * FROM public.search('ever', 'c5000000-0000-4000-8000-000000000002')$$,
  'P0001', 'forbidden', 'search: another band''s scope is forbidden');

-- ── list_notifications / mark_notifications_read ─────────────────────────────
select is((SELECT count(*)::int FROM public.list_notifications()
            WHERE source = 'activity' AND actor_id = current_setting('test.b')::uuid), 2,
  'notifications: A sees B''s two changes');
select ok((SELECT bool_and(NOT is_read) FROM public.list_notifications()),
  'notifications: they start unread');
select lives_ok($$SELECT public.mark_notifications_read()$$,
  'notifications: mark all read');
select ok((SELECT bool_and(is_read) FROM public.list_notifications()),
  'notifications: all read after marking');
select ok(NOT (SELECT has_unread FROM public.list_my_contexts()),
  'contexts: the unread dot clears with them');

select tests.authenticate_as('cs-b@test.com');
select is((SELECT count(*)::int FROM public.list_notifications()
            WHERE actor_id = current_setting('test.b')::uuid), 0,
  'notifications: never your own actions');

reset role;
select ok(NOT has_function_privilege('anon', 'public.search(text, uuid, boolean, integer)', 'EXECUTE'),
  'anon cannot call search');

select * from finish();
rollback;
