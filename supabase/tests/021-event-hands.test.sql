-- Test: event_hands (raise-a-hand) schema + SECURITY coverage
-- Purpose: Lock down the fork #5 casting-console additions — the event_hands
--          table, events.allow_suggestions / auto_approve columns, the
--          auto-approve trigger, and (the headline) the RLS matrix proving:
--            * a guest can raise/withdraw only their OWN hand,
--            * a guest can NEVER self-accept a hand,
--            * a non-participant (stranger) can neither raise nor read hands,
--            * allow_suggestions=false blocks guest hands,
--            * auto_approve=true lands a raised hand 'accepted' with no host review,
--            * a manager can accept/decline any hand.
-- Category: Schema + RLS + Security (negative tests)
-- Created: 2026-07-06 (mobile-redesign-port / casting fork #5)
--
-- Note (same idiom as 019): tests.get_supabase_uid reads auth.users which the
-- 'authenticated' role cannot select — capture uids into GUCs while role=postgres.

begin;

select plan(29);

-- ── Schema (structural) ──────────────────────────────────────────────────────
select has_table('event_hands', 'event_hands table exists');
select has_column('event_hands', 'status', 'event_hands.status exists');
select has_column('event_hands', 'role_key', 'event_hands.role_key exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname='event_hands_status_check'
  AND conrelid='public.event_hands'::regclass), 'event_hands.status CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.event_hands'::regclass AND contype='u'),
  'event_hands has a UNIQUE constraint (one hand per person per part)');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.event_hands'::regclass),
  'RLS enabled on event_hands');
select has_column('events', 'allow_suggestions', 'events.allow_suggestions column exists');
select has_column('events', 'auto_approve', 'events.auto_approve column exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname='event_allows_suggestions'),
  'event_allows_suggestions() helper exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname='event_auto_approve'),
  'event_auto_approve() helper exists');
select ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_event_hand_autoapprove'),
  'auto-approve trigger exists on event_hands');
select ok(has_table_privilege('authenticated', 'public.event_hands', 'INSERT'),
  'authenticated can INSERT event_hands');
select ok(has_table_privilege('service_role', 'public.event_hands', 'INSERT'),
  'service_role can INSERT event_hands');

-- ── Fixtures (role=postgres) ─────────────────────────────────────────────────
select tests.create_supabase_user('eh-host@test.com');
select tests.create_supabase_user('eh-guest@test.com');
select tests.create_supabase_user('eh-stranger@test.com');

DO $$ BEGIN
  PERFORM set_config('test.host',     tests.get_supabase_uid('eh-host@test.com')::text, true);
  PERFORM set_config('test.guest',    tests.get_supabase_uid('eh-guest@test.com')::text, true);
  PERFORM set_config('test.stranger', tests.get_supabase_uid('eh-stranger@test.com')::text, true);
END $$;

-- Host creates an event + host/guest participants + a lineup item (all as host).
select tests.authenticate_as('eh-host@test.com');
insert into public.events (id, host_user_id, name, scheduled_date, visibility)
  values ('daaaaaaa-0000-4000-8000-000000000021',
          current_setting('test.host')::uuid,
          'Hands Test Jam', now() + interval '5 days', 'unlisted');
insert into public.event_participants (event_id, user_id, access_tier, rsvp) values
  ('daaaaaaa-0000-4000-8000-000000000021', current_setting('test.host')::uuid,  'host',  'going'),
  ('daaaaaaa-0000-4000-8000-000000000021', current_setting('test.guest')::uuid, 'guest', 'going');
insert into public.event_lineup_items (id, event_id, position, source, display_title, display_artist)
  values ('dbbbbbbb-0000-4000-8000-000000000021',
          'daaaaaaa-0000-4000-8000-000000000021', 1, 'external', 'Seven Nation Army', 'The White Stripes');
-- A SECOND public event the guest is NOT a participant of (its id is world-
-- readable via events_select) — the cross-tenant retarget target.
insert into public.events (id, host_user_id, name, scheduled_date, visibility)
  values ('daaaaaaa-0000-4000-8000-0000000000b2',
          current_setting('test.host')::uuid,
          'Other Public Event', now() + interval '9 days', 'public');
insert into public.event_participants (event_id, user_id, access_tier, rsvp) values
  ('daaaaaaa-0000-4000-8000-0000000000b2', current_setting('test.host')::uuid, 'host', 'going');

-- ── Guest raises a hand for 'guitar' → allowed, lands 'raised' ────────────────
select tests.authenticate_as('eh-guest@test.com');
select lives_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id, user_name)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'guitar', %L, 'Guest')$q$,
    current_setting('test.guest')),
  'Guest can raise a hand on an open part');
select results_eq(
  $q$SELECT status FROM public.event_hands WHERE role_key='guitar'$q$,
  ARRAY['raised'], 'Guest hand lands at status raised');

-- ── The exploit: guest tries to self-accept their own hand → blocked ─────────
select throws_ok(
  format($q$UPDATE public.event_hands SET status='accepted'
             WHERE role_key='guitar' AND user_id=%L$q$, current_setting('test.guest')),
  '42501', NULL, 'Guest self-accept is rejected by RLS WITH CHECK');
select results_eq(
  $q$SELECT status FROM public.event_hands WHERE role_key='guitar'$q$,
  ARRAY['raised'], 'Guest hand stays raised after the blocked self-accept');

-- ── Cross-tenant retarget: guest cannot move their hand onto another event ────
-- (Security review MEDIUM fix — WITH CHECK re-asserts participation on NEW event.)
select throws_ok(
  format($q$UPDATE public.event_hands SET event_id='daaaaaaa-0000-4000-8000-0000000000b2'
             WHERE role_key='guitar' AND user_id=%L$q$, current_setting('test.guest')),
  '42501', NULL, 'Guest cannot retarget their hand onto an event they are not in');

-- ── Attribution forgery: guest cannot insert a hand with resolved_by preset ──
select throws_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id, resolved_by)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'keys', %L, %L)$q$,
    current_setting('test.guest'), current_setting('test.host')),
  '42501', NULL, 'Guest cannot forge resolved_by on a raised hand');

-- ── Guest can raise then withdraw their OWN hand (not over-restrictive) ───────
select lives_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id, user_name)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'bass', %L, 'Guest')$q$,
    current_setting('test.guest')),
  'Guest can raise a second hand (bass)');
select lives_ok(
  format($q$UPDATE public.event_hands SET status='withdrawn'
             WHERE role_key='bass' AND user_id=%L$q$, current_setting('test.guest')),
  'Guest can withdraw their own hand');

-- ── Guest cannot raise a hand ON BEHALF OF another user ──────────────────────
select throws_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'drums', %L)$q$,
    current_setting('test.stranger')),
  '42501', NULL, 'Guest cannot raise a hand for someone else (user_id must be self)');

-- ── A stranger (non-participant) can neither raise nor read hands ────────────
select tests.authenticate_as('eh-stranger@test.com');
select throws_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'keys', %L)$q$,
    current_setting('test.stranger')),
  '42501', NULL, 'Stranger (non-participant) cannot raise a hand');
select results_eq(
  $q$SELECT count(*)::int FROM public.event_hands$q$,
  ARRAY[0], 'Stranger cannot read any hands (RLS SELECT scoped to participants)');

-- ── Host CAN accept the guest's guitar hand ──────────────────────────────────
select tests.authenticate_as('eh-host@test.com');
select lives_ok(
  format($q$UPDATE public.event_hands SET status='accepted', resolved_by=%L, resolved_date=now()
             WHERE role_key='guitar'$q$, current_setting('test.host')),
  'Host (manager) can accept a raised hand');
select results_eq(
  $q$SELECT status FROM public.event_hands WHERE role_key='guitar'$q$,
  ARRAY['accepted'], 'Guitar hand is accepted after host resolve');

-- ── allow_suggestions=false blocks a guest from raising a new hand ───────────
update public.events SET allow_suggestions=false
  WHERE id='daaaaaaa-0000-4000-8000-000000000021';
select tests.authenticate_as('eh-guest@test.com');
select throws_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'keys', %L)$q$,
    current_setting('test.guest')),
  '42501', NULL, 'allow_suggestions=false blocks a guest hand');

-- ── auto_approve=true lands a freshly-raised guest hand 'accepted' ───────────
select tests.authenticate_as('eh-host@test.com');
update public.events SET allow_suggestions=true, auto_approve=true
  WHERE id='daaaaaaa-0000-4000-8000-000000000021';
select tests.authenticate_as('eh-guest@test.com');
select lives_ok(
  format($q$INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, user_id, user_name)
             VALUES ('daaaaaaa-0000-4000-8000-000000000021',
                     'dbbbbbbb-0000-4000-8000-000000000021', 'lead_vocals', %L, 'Guest')$q$,
    current_setting('test.guest')),
  'Guest can raise a hand while auto_approve is on');
select results_eq(
  $q$SELECT status FROM public.event_hands WHERE role_key='lead_vocals'$q$,
  ARRAY['accepted'], 'auto_approve lands a raised hand at accepted (trigger)');

select * from finish();
rollback;
