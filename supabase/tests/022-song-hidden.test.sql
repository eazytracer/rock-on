-- Test: song_hidden (#3 Catalog provenance / Source filter — Hide/Re-add) schema + SECURITY
-- Purpose: Lock down the song_hidden join table — structure, grants, RLS — and
--          prove the RLS matrix:
--            * a user may hide/see/un-hide only their OWN rows,
--            * a user can NEVER forge a hide row for someone else (WITH CHECK),
--            * a user can NEVER see or delete another user's hide rows,
--            * UPDATE is denied for everyone (no update policy; row is immutable).
-- Category: Schema + RLS + Security (negative tests)
-- Created: 2026-07-06 (mobile-redesign-port #3 source filter)
--
-- Note (same idiom as 019/021): tests.get_supabase_uid reads auth.users which the
-- 'authenticated' role cannot select — capture uids into GUCs while role=postgres.

begin;

select plan(19);

-- ── Schema (structural) ──────────────────────────────────────────────────────
select has_table('song_hidden', 'song_hidden table exists');
select has_column('song_hidden', 'user_id', 'song_hidden.user_id exists');
select has_column('song_hidden', 'song_id', 'song_hidden.song_id exists');
select has_column('song_hidden', 'created_date', 'song_hidden.created_date exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.song_hidden'::regclass AND contype='p'),
  'song_hidden has a composite PRIMARY KEY (user_id, song_id)');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.song_hidden'::regclass),
  'RLS enabled on song_hidden');
select ok(has_table_privilege('authenticated', 'public.song_hidden', 'INSERT'),
  'authenticated can INSERT song_hidden');
select ok(has_table_privilege('service_role', 'public.song_hidden', 'INSERT'),
  'service_role can INSERT song_hidden');
-- Row is immutable: there must be NO update policy, so UPDATE is RLS-denied.
select is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND tablename='song_hidden' AND cmd='UPDATE'),
  0, 'no UPDATE policy exists (row is immutable — hide state is its existence)');

-- ── Fixtures (role=postgres) ─────────────────────────────────────────────────
select tests.create_supabase_user('sh-owner@test.com');
select tests.create_supabase_user('sh-other@test.com');

DO $$ BEGIN
  PERFORM set_config('test.owner', tests.get_supabase_uid('sh-owner@test.com')::text, true);
  PERFORM set_config('test.other', tests.get_supabase_uid('sh-other@test.com')::text, true);
END $$;

-- Owner creates a personal song to hide (id fixed for referencing under RLS).
select tests.authenticate_as('sh-owner@test.com');
insert into public.songs (id, title, context_type, context_id, created_by, visibility)
  values ('50000000-0000-4000-8000-000000000001', 'Hide Me',
          'personal', current_setting('test.owner'), current_setting('test.owner')::uuid, 'personal');

-- ── Positive: owner hides + sees their own row ───────────────────────────────
select lives_ok(
  $q$insert into public.song_hidden (user_id, song_id)
       values (current_setting('test.owner')::uuid, '50000000-0000-4000-8000-000000000001')$q$,
  'owner can hide their own song');

select is(
  (SELECT count(*)::int FROM public.song_hidden
     WHERE song_id = '50000000-0000-4000-8000-000000000001'),
  1, 'owner sees their own hide row');

-- ── Negative: a stranger cannot forge, see, or delete the owner''s hide ──────
select tests.authenticate_as('sh-other@test.com');

-- Cannot forge a hide row for another user (WITH CHECK user_id = auth.uid()).
select throws_ok(
  $q$insert into public.song_hidden (user_id, song_id)
       values (current_setting('test.owner')::uuid, '50000000-0000-4000-8000-000000000001')$q$,
  '42501', 'new row violates row-level security policy for table "song_hidden"',
  'other user CANNOT forge a hide row owned by someone else');

-- Cannot even see the owner''s hide rows (RLS filters SELECT to own rows).
select is(
  (SELECT count(*)::int FROM public.song_hidden
     WHERE song_id = '50000000-0000-4000-8000-000000000001'),
  0, 'other user sees NONE of the owner''s hide rows');

-- A stranger''s delete of the owner''s row matches nothing (RLS filters DELETE) —
-- it does not error, it is simply a no-op.
select lives_ok(
  $q$delete from public.song_hidden
       where song_id = '50000000-0000-4000-8000-000000000001'$q$,
  'other user''s DELETE of the owner''s hide row is a silent no-op (no error)');

-- ── The owner''s row survived the stranger''s attempts ───────────────────────
select tests.authenticate_as('sh-owner@test.com');
select is(
  (SELECT count(*)::int FROM public.song_hidden
     WHERE song_id = '50000000-0000-4000-8000-000000000001'),
  1, 'owner''s hide row still present after stranger''s insert/delete attempts');

-- ── UPDATE is denied at RUNTIME (granted, but no policy → RLS filters to 0) ───
-- Attempt to backdate created_date; it must NOT take effect (row is immutable).
select lives_ok(
  $q$update public.song_hidden set created_date = '2000-01-01T00:00:00Z'
       where song_id = '50000000-0000-4000-8000-000000000001'$q$,
  'owner UPDATE does not error (RLS silently filters it to a no-op)');
select is(
  (SELECT (created_date < '2020-01-01')::boolean FROM public.song_hidden
     WHERE song_id = '50000000-0000-4000-8000-000000000001'),
  false, 'row was NOT modified by the UPDATE (RLS-denied → created_date unchanged)');

-- ── Re-add: owner can delete (un-hide) their own row ─────────────────────────
select lives_ok(
  $q$delete from public.song_hidden
       where song_id = '50000000-0000-4000-8000-000000000001'$q$,
  'owner can un-hide (DELETE) their own row');
select is(
  (SELECT count(*)::int FROM public.song_hidden
     WHERE song_id = '50000000-0000-4000-8000-000000000001'),
  0, 'row is gone after the owner un-hides it');

select * from finish();
rollback;
