-- Test: Co-host permissions (EC4 #1, v0.4.2)
-- Purpose: A host can promote a participant to 'cohost' (→ is_event_manager, so
--          they can cast/approve), but a co-host must NOT be able to alter the
--          event itself (events UPDATE is host-only).
-- Category: RLS + Data Integrity
-- Created: 2026-07-09 (0.4-small-patch)

begin;

select plan(6);

-- ── Policy shape (2) ─────────────────────────────────────────────────────────
select ok(
  EXISTS(SELECT 1 FROM pg_policies
         WHERE tablename = 'events' AND policyname = 'events_update_host'),
  'events_update_host policy exists');
select ok(
  NOT EXISTS(SELECT 1 FROM pg_policies
             WHERE tablename = 'events' AND policyname = 'events_update_manager'),
  'old manager-scoped events_update_manager policy is gone');

-- ── Fixture: host + guest, host promotes guest → cohost ──────────────────────
select tests.create_supabase_user('ec-cohost-host@test.com');
select tests.create_supabase_user('ec-cohost-guest@test.com');
DO $$ BEGIN
  PERFORM set_config('t.host', tests.get_supabase_uid('ec-cohost-host@test.com')::text, true);
  PERFORM set_config('t.guest', tests.get_supabase_uid('ec-cohost-guest@test.com')::text, true);
END $$;

select tests.authenticate_as('ec-cohost-host@test.com');
insert into public.events (id, host_user_id, name, scheduled_date, visibility)
  values ('caaaaaaa-0000-4000-8000-000000000024',
          current_setting('t.host')::uuid, 'Cohost Test',
          now() + interval '3 days', 'unlisted');
insert into public.event_participants (event_id, user_id, access_tier, rsvp) values
  ('caaaaaaa-0000-4000-8000-000000000024', current_setting('t.host')::uuid, 'host', 'going'),
  ('caaaaaaa-0000-4000-8000-000000000024', current_setting('t.guest')::uuid, 'guest', 'going');

DO $$ BEGIN
  UPDATE public.event_participants SET access_tier = 'cohost'
    WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000024'
      AND user_id = current_setting('t.guest')::uuid;
END $$;
select results_eq(
  format($q$SELECT access_tier FROM public.event_participants
             WHERE event_id = 'caaaaaaa-0000-4000-8000-000000000024' AND user_id = %L$q$,
    current_setting('t.guest')),
  ARRAY['cohost'], 'Host can promote a guest to co-host');

-- Co-host counts as an event manager → casting / approving requests (1).
select ok(
  public.is_event_manager('caaaaaaa-0000-4000-8000-000000000024',
                          current_setting('t.guest')::uuid),
  'Co-host is an event manager (can cast / approve requests)');

-- ── Co-host cannot ALTER the event (events UPDATE is host-only) ───────────────
-- RLS USING excludes the row for a non-host, so the UPDATE is a no-op (0 rows).
select tests.authenticate_as('ec-cohost-guest@test.com');
DO $$ BEGIN
  UPDATE public.events SET name = 'Hacked'
    WHERE id = 'caaaaaaa-0000-4000-8000-000000000024';
END $$;
select results_eq(
  $q$SELECT name FROM public.events WHERE id = 'caaaaaaa-0000-4000-8000-000000000024'$q$,
  ARRAY['Cohost Test'], 'Co-host cannot alter the event (name unchanged)');

-- ── Host CAN alter the event ─────────────────────────────────────────────────
select tests.authenticate_as('ec-cohost-host@test.com');
DO $$ BEGIN
  UPDATE public.events SET name = 'Renamed'
    WHERE id = 'caaaaaaa-0000-4000-8000-000000000024';
END $$;
select results_eq(
  $q$SELECT name FROM public.events WHERE id = 'caaaaaaa-0000-4000-8000-000000000024'$q$,
  ARRAY['Renamed'], 'Host can alter the event');

select * from finish();
rollback;
