-- Test: privacy lockdown (emails, jam discovery, bandmate profiles)
-- Purpose: Regression guard for the 0.6.1 RLS audit.
--   1. Other users' email / last_login / last_active_at are not readable;
--      get_user_emails() returns your own email and, for band admins/owners
--      only, their bandmates' emails.
--   2. Jam sessions can't be listed or joined without the code.
--   3. Active bandmates can read each other's (non-discoverable) profiles.
-- Category: RLS & Security
-- Created: 2026-10-25
--
-- Uids are captured into GUCs while role=postgres (authenticated can't read
-- auth.users); auth.uid() itself works under authenticated.

begin;

select plan(22);

-- ── Users ────────────────────────────────────────────────────────────────────
select tests.create_supabase_user('pl-admin@test.com');
select tests.create_supabase_user('pl-member@test.com');
select tests.create_supabase_user('pl-quiet@test.com');
select tests.create_supabase_user('pl-stranger@test.com');
select tests.create_supabase_user('pl-host@test.com');

DO $$ BEGIN
  PERFORM set_config('test.admin_uid',    tests.get_supabase_uid('pl-admin@test.com')::text, true);
  PERFORM set_config('test.member_uid',   tests.get_supabase_uid('pl-member@test.com')::text, true);
  PERFORM set_config('test.quiet_uid',    tests.get_supabase_uid('pl-quiet@test.com')::text, true);
  PERFORM set_config('test.stranger_uid', tests.get_supabase_uid('pl-stranger@test.com')::text, true);
  PERFORM set_config('test.host_uid',     tests.get_supabase_uid('pl-host@test.com')::text, true);
END $$;

-- Band: admin + member + quiet (non-discoverable, no friends/events).
-- bands_auto_add_creator adds the authenticated creator as admin.
select tests.authenticate_as('pl-admin@test.com');
reset role;
INSERT INTO public.bands (id, name) VALUES ('eeeeeeee-0000-4000-8000-000000000027', 'Privacy Band');
select tests.add_user_to_band('pl-member@test.com', 'eeeeeeee-0000-4000-8000-000000000027', 'member');
select tests.add_user_to_band('pl-quiet@test.com', 'eeeeeeee-0000-4000-8000-000000000027', 'member');

INSERT INTO public.user_profiles (user_id, display_name, instruments, discoverable)
VALUES (current_setting('test.quiet_uid')::uuid, 'Quiet One', '{Keys}', false)
ON CONFLICT (user_id) DO UPDATE
  SET display_name = 'Quiet One', instruments = '{Keys}', discoverable = false;

-- Jams: one active, one expired, both hosted by host (host is a participant)
INSERT INTO public.jam_sessions (id, host_user_id, name, short_code, status, expires_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000027', current_setting('test.host_uid')::uuid,
   'Active Jam', 'PLJAM1', 'active', now() + interval '1 day'),
  ('dddddddd-0000-4000-8000-000000000028', current_setting('test.host_uid')::uuid,
   'Old Jam', 'PLJAM2', 'active', now() - interval '1 hour');
INSERT INTO public.jam_participants (jam_session_id, user_id, status)
VALUES
  ('dddddddd-0000-4000-8000-000000000027', current_setting('test.host_uid')::uuid, 'active'),
  ('dddddddd-0000-4000-8000-000000000028', current_setting('test.host_uid')::uuid, 'active');

-- ── 1. Emails & activity ─────────────────────────────────────────────────────
select tests.authenticate_as('pl-member@test.com');

select throws_ok(
  'SELECT email FROM public.users',
  '42501', NULL,
  'A member cannot select users.email');

select throws_ok(
  'SELECT last_active_at FROM public.users',
  '42501', NULL,
  'A member cannot select users.last_active_at');

select throws_ok(
  'SELECT last_login FROM public.users',
  '42501', NULL,
  'A member cannot select users.last_login');

select results_eq(
  format('SELECT name FROM public.users WHERE id = %L', current_setting('test.admin_uid')),
  ARRAY['pl-admin'],
  'A member can still read a bandmate''s name');

select is(
  (SELECT count(*)::int FROM public.get_user_emails(ARRAY[
     current_setting('test.admin_uid')::uuid, current_setting('test.quiet_uid')::uuid])),
  0,
  'get_user_emails: a non-admin member gets no bandmate emails');

select results_eq(
  format('SELECT email FROM public.get_user_emails(ARRAY[%L::uuid])', current_setting('test.member_uid')),
  ARRAY['pl-member@test.com'],
  'get_user_emails: you always get your own email');

select lives_ok(
  format('UPDATE public.users SET last_login = now() WHERE id = %L', current_setting('test.member_uid')),
  'A user can still update their own row (sign-in last_login)');

select tests.authenticate_as('pl-admin@test.com');

select is(
  (SELECT count(*)::int FROM public.get_user_emails(ARRAY[
     current_setting('test.member_uid')::uuid, current_setting('test.quiet_uid')::uuid])),
  2,
  'get_user_emails: a band admin/owner gets their bandmates'' emails');

select is(
  (SELECT count(*)::int FROM public.get_user_emails(ARRAY[current_setting('test.stranger_uid')::uuid])),
  0,
  'get_user_emails: an admin gets no email for someone outside their bands');

-- ── 3. Bandmate profiles ─────────────────────────────────────────────────────
select tests.authenticate_as('pl-member@test.com');

select results_eq(
  format('SELECT display_name FROM public.user_profiles WHERE user_id = %L', current_setting('test.quiet_uid')),
  ARRAY['Quiet One'],
  'A bandmate''s non-discoverable profile is readable by band members');

select tests.authenticate_as('pl-stranger@test.com');

select is(
  (SELECT count(*)::int FROM public.user_profiles WHERE user_id = current_setting('test.quiet_uid')::uuid),
  0,
  'A non-discoverable profile is not readable by a stranger');

-- ── 2. Jam discovery & join ──────────────────────────────────────────────────
select is(
  (SELECT count(*)::int FROM public.jam_sessions
    WHERE id IN ('dddddddd-0000-4000-8000-000000000027', 'dddddddd-0000-4000-8000-000000000028')),
  0,
  'A stranger cannot list active jam sessions');

select throws_ok(
  format($q$INSERT INTO public.jam_participants (jam_session_id, user_id, status)
            VALUES ('dddddddd-0000-4000-8000-000000000027', %L, 'active')$q$,
    current_setting('test.stranger_uid')),
  '42501', NULL,
  'A stranger cannot insert themselves into a jam directly');

select is(
  (SELECT count(*)::int FROM public.get_jam_session_by_code('nope00')),
  0,
  'get_jam_session_by_code: a wrong code returns nothing');

select results_eq(
  $q$SELECT name FROM public.get_jam_session_by_code(' pljam1 ')$q$,
  ARRAY['Active Jam'],
  'get_jam_session_by_code: the exact code (trimmed, any case) finds the session');

select is(
  (SELECT count(*)::int FROM public.join_jam_session('nope00')),
  0,
  'join_jam_session: a wrong code joins nothing');

select throws_ok(
  $q$SELECT * FROM public.join_jam_session('PLJAM2')$q$,
  'P0001', 'This jam session is no longer active',
  'join_jam_session: an expired session cannot be joined');

select results_eq(
  $q$SELECT name FROM public.join_jam_session('PLJAM1')$q$,
  ARRAY['Active Jam'],
  'join_jam_session: the right code joins the session');

select results_eq(
  format($q$SELECT status FROM public.jam_participants
            WHERE jam_session_id = 'dddddddd-0000-4000-8000-000000000027' AND user_id = %L$q$,
    current_setting('test.stranger_uid')),
  ARRAY['active'],
  'The joiner is now an active participant');

select throws_ok(
  'SELECT email FROM public.users',
  '42501', NULL,
  'A jam co-participant still cannot read emails');

-- Kicked participants stay kicked when they re-join
reset role;
UPDATE public.jam_participants SET status = 'kicked'
  WHERE jam_session_id = 'dddddddd-0000-4000-8000-000000000027'
    AND user_id = current_setting('test.stranger_uid')::uuid;
select tests.authenticate_as('pl-stranger@test.com');
DO $$ BEGIN PERFORM public.join_jam_session('PLJAM1'); END $$;
reset role;
select results_eq(
  format($q$SELECT status FROM public.jam_participants
            WHERE jam_session_id = 'dddddddd-0000-4000-8000-000000000027' AND user_id = %L$q$,
    current_setting('test.stranger_uid')),
  ARRAY['kicked'],
  'join_jam_session does not re-activate a kicked participant');

-- Host can still add themselves when creating a jam
select tests.authenticate_as('pl-host@test.com');
INSERT INTO public.jam_sessions (id, host_user_id, name, short_code, status, expires_at)
VALUES ('dddddddd-0000-4000-8000-000000000029', current_setting('test.host_uid')::uuid,
        'New Jam', 'PLJAM3', 'active', now() + interval '1 day');
select lives_ok(
  format($q$INSERT INTO public.jam_participants (jam_session_id, user_id, status)
            VALUES ('dddddddd-0000-4000-8000-000000000029', %L, 'active')$q$,
    current_setting('test.host_uid')),
  'The host can add themselves as a participant of their own jam');

select * from finish();

rollback;
