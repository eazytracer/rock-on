-- Test: Events feature schema coverage
-- Purpose: Lock down the 4 event tables, enums, the approve trigger (request →
--          lineup promotion), helpers, RLS, grants, and cascades.
-- Category: Schema + RLS + Data Integrity
-- Created: 2026-07-02 (mobile-redesign-port)

begin;

select plan(20);

-- ── Tables (4) ──────────────────────────────────────────────────────────────
select has_table('events', 'events table exists');
select has_table('event_participants', 'event_participants table exists');
select has_table('event_lineup_items', 'event_lineup_items table exists');
select has_table('event_lineup_requests', 'event_lineup_requests table exists');

-- ── Enums / checks (3) ──────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'events_visibility_check'
  AND conrelid = 'public.events'::regclass), 'events.visibility CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_access_tier_check'
  AND conrelid = 'public.event_participants'::regclass), 'event_participants.access_tier CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'event_lineup_requests_status_check'
  AND conrelid = 'public.event_lineup_requests'::regclass), 'event_lineup_requests.status CHECK exists');

-- ── Uniqueness (1) ──────────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_event_id_user_id_key'
  AND conrelid = 'public.event_participants'::regclass AND contype = 'u'),
  'event_participants UNIQUE (event_id, user_id)');

-- ── Helpers + trigger (3) ───────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_event_participant'),
  'is_event_participant() exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_event_manager'),
  'is_event_manager() exists');
select ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trg_event_request_approved'),
  'approve trigger exists on event_lineup_requests');

-- ── RLS enabled (4) ─────────────────────────────────────────────────────────
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.events'::regclass), 'RLS on events');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_participants'::regclass), 'RLS on event_participants');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_lineup_items'::regclass), 'RLS on event_lineup_items');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_lineup_requests'::regclass), 'RLS on event_lineup_requests');

-- ── Grants (1) ──────────────────────────────────────────────────────────────
select ok(has_table_privilege('authenticated', 'public.events', 'INSERT'),
  'authenticated can INSERT events');

-- ── FK cascade (1) ──────────────────────────────────────────────────────────
select is((SELECT confdeltype FROM pg_constraint WHERE conname = 'event_participants_event_id_fkey')::text,
  'c', 'event_participants.event_id ON DELETE CASCADE');

-- ── Functional: approving a request promotes it into the lineup (3) ──────────
DO $$
DECLARE
  host_id UUID := gen_random_uuid();
  guest_id UUID := gen_random_uuid();
  ev UUID := gen_random_uuid();
  req UUID;
BEGIN
  INSERT INTO public.users (id, email, name) VALUES
    (host_id, format('ev-host-%s@example.com', host_id::text), 'Host'),
    (guest_id, format('ev-guest-%s@example.com', guest_id::text), 'Guest');
  INSERT INTO public.events (id, host_user_id, name, scheduled_date)
    VALUES (ev, host_id, 'Test Event', now() + interval '5 days');
  INSERT INTO public.event_participants (event_id, user_id, access_tier)
    VALUES (ev, host_id, 'host'), (ev, guest_id, 'guest');
  INSERT INTO public.event_lineup_requests (event_id, requester_id, source, display_title, display_artist)
    VALUES (ev, guest_id, 'external', 'Creep', 'Radiohead') RETURNING id INTO req;
  PERFORM set_config('test.ev', ev::text, true);
  PERFORM set_config('test.req', req::text, true);
END $$;

-- Before approve: no lineup items.
select results_eq(
  format($f$SELECT count(*)::int FROM public.event_lineup_items WHERE event_id = %L$f$,
    current_setting('test.ev')),
  ARRAY[0], 'Pre-approve: lineup is empty');

DO $$ BEGIN
  UPDATE public.event_lineup_requests SET status = 'approved' WHERE id = current_setting('test.req')::uuid;
END $$;

-- After approve: exactly one lineup item, and the request links to it.
select results_eq(
  format($f$SELECT count(*)::int FROM public.event_lineup_items WHERE event_id = %L AND display_title = 'Creep'$f$,
    current_setting('test.ev')),
  ARRAY[1], 'Approving a request should create a lineup item');

select results_eq(
  format($f$SELECT (resolved_lineup_item_id IS NOT NULL) FROM public.event_lineup_requests WHERE id = %L$f$,
    current_setting('test.req')),
  ARRAY[true], 'Approved request should link resolved_lineup_item_id');

select * from finish();
rollback;
