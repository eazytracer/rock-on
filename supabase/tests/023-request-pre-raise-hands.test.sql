-- Test: Pre-raise hand on song request (EC4 #6)
-- Purpose: A request may carry offered parts; approving it must promote the song
--          AND raise a hand for the requester on each part. Null parts => no hands.
-- Category: Schema + Data Integrity (trigger)
-- Created: 2026-07-09 (0.4-small-patch)

begin;

select plan(8);

-- ── Columns (3) ──────────────────────────────────────────────────────────────
select has_column('event_lineup_requests', 'parts', 'event_lineup_requests.parts column exists');
select has_column('event_lineup_items', 'tuning', 'event_lineup_items.tuning column exists');
select has_column('event_lineup_items', 'key', 'event_lineup_items.key column exists');

-- ── Fixture: host + guest + event (auto_approve off) + request with parts ─────
DO $$
DECLARE
  host_id  UUID := gen_random_uuid();
  guest_id UUID := gen_random_uuid();
  ev       UUID := gen_random_uuid();
  req      UUID;
  req_null UUID;
BEGIN
  INSERT INTO public.users (id, email, name) VALUES
    (host_id,  format('prh-host-%s@example.com',  host_id::text),  'Host'),
    (guest_id, format('prh-guest-%s@example.com', guest_id::text), 'Connor');
  -- auto_approve defaults false → raised hands stay 'raised'
  INSERT INTO public.events (id, host_user_id, name, scheduled_date)
    VALUES (ev, host_id, 'Pre-raise Event', now() + interval '5 days');
  INSERT INTO public.event_participants (event_id, user_id, access_tier)
    VALUES (ev, host_id, 'host'), (ev, guest_id, 'guest');
  -- Request WITH offered parts
  INSERT INTO public.event_lineup_requests (event_id, requester_id, source, display_title, display_artist, parts)
    VALUES (ev, guest_id, 'external', 'Creep', 'Radiohead', ARRAY['guitar','vox'])
    RETURNING id INTO req;
  -- Request WITHOUT parts (control)
  INSERT INTO public.event_lineup_requests (event_id, requester_id, source, display_title, display_artist)
    VALUES (ev, guest_id, 'external', 'Black', 'Pearl Jam')
    RETURNING id INTO req_null;
  PERFORM set_config('test.ev', ev::text, true);
  PERFORM set_config('test.guest', guest_id::text, true);
  PERFORM set_config('test.req', req::text, true);
  PERFORM set_config('test.req_null', req_null::text, true);
END $$;

-- Pre-approve: no hands yet (1)
select results_eq(
  format($f$SELECT count(*)::int FROM public.event_hands WHERE event_id = %L$f$,
    current_setting('test.ev')),
  ARRAY[0], 'Pre-approve: no hands raised');

-- Approve the request that carries parts.
DO $$ BEGIN
  UPDATE public.event_lineup_requests SET status = 'approved' WHERE id = current_setting('test.req')::uuid;
END $$;

-- After approve: exactly two hands for the requester, against the resolved item (1)
select results_eq(
  format($f$SELECT count(*)::int FROM public.event_hands h
             JOIN public.event_lineup_requests r ON r.resolved_lineup_item_id = h.event_lineup_item_id
            WHERE r.id = %L AND h.user_id = %L$f$,
    current_setting('test.req'), current_setting('test.guest')),
  ARRAY[2], 'Approving a request with 2 parts raises 2 hands for the requester');

-- The two hands are for the offered role_keys (1)
select is(
  (SELECT array_agg(h.role_key ORDER BY h.role_key) FROM public.event_hands h
     JOIN public.event_lineup_requests r ON r.resolved_lineup_item_id = h.event_lineup_item_id
    WHERE r.id = current_setting('test.req')::uuid),
  ARRAY['guitar','vox'], 'Pre-raised hands carry the offered role_keys');

-- Hands land 'raised' (event is not auto-approve) (1)
select results_eq(
  format($f$SELECT DISTINCT h.status FROM public.event_hands h
             JOIN public.event_lineup_requests r ON r.resolved_lineup_item_id = h.event_lineup_item_id
            WHERE r.id = %L$f$, current_setting('test.req')),
  ARRAY['raised'], 'Pre-raised hands are status raised when event is not auto-approve');

-- Approving a request with NULL parts raises no hands (no regression) (1)
DO $$ BEGIN
  UPDATE public.event_lineup_requests SET status = 'approved' WHERE id = current_setting('test.req_null')::uuid;
END $$;
select results_eq(
  format($f$SELECT count(*)::int FROM public.event_hands h
             JOIN public.event_lineup_requests r ON r.resolved_lineup_item_id = h.event_lineup_item_id
            WHERE r.id = %L$f$, current_setting('test.req_null')),
  ARRAY[0], 'Approving a request with no parts raises no hands');

select * from finish();
rollback;
