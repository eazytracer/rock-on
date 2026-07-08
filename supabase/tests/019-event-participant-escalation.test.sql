-- Test: event_participants self-tier escalation is blocked (RLS)
-- Purpose: Regression guard for FINDING 1 of the event-code-join security review.
--          A guest (e.g. one who joined via join_event_by_code) must NOT be able to
--          self-promote their own participant row to 'host'/'cohost'. Managers keep
--          full control. Verified with real role switching so RLS WITH CHECK applies.
-- Category: RLS & Security
-- Created: 2026-07-03 (mobile-redesign-port)
--
-- Note: tests.get_supabase_uid() reads auth.users, which the 'authenticated' role
-- cannot select — so we capture the uids into GUCs while still role=postgres and
-- reference those (auth.uid() itself works under authenticated; it reads a GUC).

begin;

select plan(5);

-- ── Users + captured uids (role=postgres here) ───────────────────────────────
select tests.create_supabase_user('ec-esc-host@test.com');
select tests.create_supabase_user('ec-esc-guest@test.com');
select tests.create_supabase_user('ec-esc-stranger@test.com');

DO $$ BEGIN
  PERFORM set_config('test.host_uid',     tests.get_supabase_uid('ec-esc-host@test.com')::text, true);
  PERFORM set_config('test.guest_uid',    tests.get_supabase_uid('ec-esc-guest@test.com')::text, true);
  PERFORM set_config('test.stranger_uid', tests.get_supabase_uid('ec-esc-stranger@test.com')::text, true);
END $$;

-- ── Host creates an unlisted event (trigger assigns a code) + host row ───────
select tests.authenticate_as('ec-esc-host@test.com');
insert into public.events (id, host_user_id, name, scheduled_date, visibility)
  values ('caaaaaaa-0000-4000-8000-000000000019',
          current_setting('test.host_uid')::uuid,
          'Escalation Test Event', now() + interval '5 days', 'unlisted');
insert into public.event_participants (event_id, user_id, access_tier, rsvp)
  values ('caaaaaaa-0000-4000-8000-000000000019',
          current_setting('test.host_uid')::uuid, 'host', 'going');
-- Stash the trigger-assigned code (readable: host is a participant).
DO $$ BEGIN
  PERFORM set_config('test.ecode',
    (SELECT short_code FROM public.events WHERE id = 'caaaaaaa-0000-4000-8000-000000000019'),
    true);
END $$;

-- ── Guest joins by code (RPC inserts them as 'guest') ────────────────────────
select tests.authenticate_as('ec-esc-guest@test.com');
DO $$ BEGIN PERFORM public.join_event_by_code(current_setting('test.ecode')); END $$;

select results_eq(
  format($q$SELECT access_tier FROM public.event_participants
             WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000019' AND user_id = %L$q$,
    current_setting('test.guest_uid')),
  ARRAY['guest'], 'Guest joined by code lands at tier guest');

-- ── The exploit: guest tries to PATCH their own row to host → must be blocked ─
select throws_ok(
  format($q$UPDATE public.event_participants SET access_tier = 'host'
             WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000019' AND user_id = %L$q$,
    current_setting('test.guest_uid')),
  '42501', NULL,
  'Guest self-escalation to host is rejected by RLS WITH CHECK');

-- Tier is unchanged after the blocked attempt.
select results_eq(
  format($q$SELECT access_tier FROM public.event_participants
             WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000019' AND user_id = %L$q$,
    current_setting('test.guest_uid')),
  ARRAY['guest'], 'Guest tier stays guest after the blocked escalation');

-- ── Not over-restrictive: a guest CAN still update their own rsvp ────────────
select lives_ok(
  format($q$UPDATE public.event_participants SET rsvp = 'maybe'
             WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000019' AND user_id = %L$q$,
    current_setting('test.guest_uid')),
  'Guest can still update their own rsvp (fix is not over-broad)');

-- ── A stranger cannot self-insert as host either ────────────────────────────
select tests.authenticate_as('ec-esc-stranger@test.com');
select throws_ok(
  format($q$INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp)
             VALUES ('caaaaaaa-0000-4000-8000-000000000019', %L, 'host', 'going')$q$,
    current_setting('test.stranger_uid')),
  '42501', NULL,
  'Stranger self-insert as host is rejected by RLS WITH CHECK');

select * from finish();
rollback;
