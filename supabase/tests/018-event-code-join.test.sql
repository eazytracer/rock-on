-- Test: Event-code join feature (band-less user flow Phase 2)
-- Purpose: Lock down gen_event_code(), the short-code auto-assign trigger, and the
--          join_event_by_code() RPC — including its security contract (forces guest
--          tier, no escalation, wrong code reveals nothing).
-- Category: Functions + Triggers + Security
-- Created: 2026-07-03 (mobile-redesign-port)
--
-- Note: join_event_by_code derives the participant from auth.uid(), which reads the
-- request.jwt.claims GUC. We set that GUC to impersonate each caller; the function is
-- SECURITY DEFINER so it runs regardless of the executing role.

begin;

select plan(10);

-- ── Objects exist (3) ────────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'gen_event_code'),
  'gen_event_code() exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'join_event_by_code'),
  'join_event_by_code() exists');
select ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_event_short_code'),
  'short-code auto-assign trigger exists on events');

-- ── Grants (2) ───────────────────────────────────────────────────────────────
select ok(has_function_privilege('authenticated', 'public.join_event_by_code(text)', 'EXECUTE'),
  'authenticated can EXECUTE join_event_by_code');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'join_event_by_code' AND prosecdef),
  'join_event_by_code is SECURITY DEFINER');

-- ── Trigger auto-assigns a short_code on insert (1) ──────────────────────────
DO $$
DECLARE host_id UUID := gen_random_uuid(); ev UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name)
    VALUES (host_id, format('ec-host-%s@example.com', host_id::text), 'Code Host');
  -- Insert WITHOUT a short_code — the trigger fills one in for non-private events.
  INSERT INTO public.events (id, host_user_id, name, scheduled_date, visibility)
    VALUES (ev, host_id, 'Auto Code Event', now() + interval '7 days', 'unlisted');
  -- Host is a participant with tier 'host' (for the no-escalation check below).
  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp)
    VALUES (ev, host_id, 'host', 'going');
  PERFORM set_config('test.host', host_id::text, true);
  PERFORM set_config('test.ev', ev::text, true);
END $$;

select isnt(
  (SELECT short_code FROM public.events WHERE id = current_setting('test.ev')::uuid),
  NULL, 'BEFORE INSERT trigger auto-assigns a short_code');

-- ── join_event_by_code: valid code joins caller as guest (1) ─────────────────
DO $$
DECLARE
  joiner_id UUID := gen_random_uuid();
  ev UUID := current_setting('test.ev')::uuid;
  the_code TEXT;
BEGIN
  INSERT INTO public.users (id, email, name)
    VALUES (joiner_id, format('ec-join-%s@example.com', joiner_id::text), 'Joiner');
  SELECT short_code INTO the_code FROM public.events WHERE id = ev;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', joiner_id::text)::text, true);
  PERFORM public.join_event_by_code(the_code);
  PERFORM set_config('test.joiner', joiner_id::text, true);
  PERFORM set_config('test.code', the_code, true);
END $$;

select results_eq(
  format($f$SELECT access_tier FROM public.event_participants
             WHERE event_id = %L AND user_id = %L$f$,
    current_setting('test.ev'), current_setting('test.joiner')),
  ARRAY['guest'], 'Valid code joins the caller as a guest participant');

-- ── Wrong code joins nobody (1) ──────────────────────────────────────────────
DO $$
DECLARE stranger_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name)
    VALUES (stranger_id, format('ec-strange-%s@example.com', stranger_id::text), 'Stranger');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', stranger_id::text)::text, true);
  PERFORM public.join_event_by_code('ZZZZZZ');  -- not a real code
  PERFORM set_config('test.stranger', stranger_id::text, true);
END $$;

select results_eq(
  format($f$SELECT count(*)::int FROM public.event_participants WHERE user_id = %L$f$,
    current_setting('test.stranger')),
  ARRAY[0], 'A wrong code joins the caller to nothing');

-- ── Unauthenticated caller (no jwt sub) joins nothing (1) ────────────────────
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);  -- no sub → auth.uid() null
  PERFORM public.join_event_by_code(current_setting('test.code'));
END $$;

select results_eq(
  format($f$SELECT count(*)::int FROM public.event_participants WHERE event_id = %L$f$,
    current_setting('test.ev')),
  ARRAY[2], 'Unauthenticated call adds no participant (still host + joiner only)');

-- ── No tier escalation: an existing host who re-joins by code stays host (1) ─
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', current_setting('test.host'))::text, true);
  PERFORM public.join_event_by_code(current_setting('test.code'));  -- host re-runs own code
END $$;

select results_eq(
  format($f$SELECT access_tier FROM public.event_participants
             WHERE event_id = %L AND user_id = %L$f$,
    current_setting('test.ev'), current_setting('test.host')),
  ARRAY['host'], 'Re-joining by code does not downgrade/escalate an existing participant');

select * from finish();
rollback;
