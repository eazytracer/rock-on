-- Test: Friends feature schema coverage
-- Purpose: Lock down user_profiles friend columns, friend_requests + friendships
--          tables, the canonical-pair CHECK, the accept trigger, resolve_friend_code
--          RPC, RLS, grants, and cascades.
-- Category: Schema + RLS + Data Integrity
-- Created: 2026-07-02 (mobile-redesign-port)

begin;

select plan(23);

-- ── user_profiles columns (3) ───────────────────────────────────────────────
select has_column('user_profiles', 'discoverable', 'user_profiles.discoverable exists');
select has_column('user_profiles', 'friend_code', 'user_profiles.friend_code exists');
select has_column('user_profiles', 'friend_request_policy', 'user_profiles.friend_request_policy exists');

-- ── Tables (2) ──────────────────────────────────────────────────────────────
select has_table('friend_requests', 'friend_requests table exists');
select has_table('friendships', 'friendships table exists');

-- ── friend_requests constraints (3) ─────────────────────────────────────────
select ok(
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_not_self'
    AND conrelid = 'public.friend_requests'::regclass AND contype = 'c'),
  'friend_requests should forbid self (requester <> addressee)');
select ok(
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_status_check'
    AND conrelid = 'public.friend_requests'::regclass AND contype = 'c'),
  'friend_requests should have status CHECK');
select ok(
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_requester_id_addressee_id_key'
    AND conrelid = 'public.friend_requests'::regclass AND contype = 'u'),
  'friend_requests should be UNIQUE (requester, addressee)');

-- ── friendships canonical pair (2) ──────────────────────────────────────────
select ok(
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'friendships_ordered'
    AND conrelid = 'public.friendships'::regclass AND contype = 'c'),
  'friendships should enforce user_a < user_b (canonical pair)');
select ok(
  EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'friendships_user_a_user_b_key'
    AND conrelid = 'public.friendships'::regclass AND contype = 'u'),
  'friendships should be UNIQUE (user_a, user_b)');

-- ── Indexes (2) — partial indexes; check via pg_indexes (has_index is brittle here) ─
select ok(
  EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_friend_requests_addressee'),
  'friend_requests should have partial addressee (incoming) index');
select ok(
  EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_friend_code'),
  'user_profiles should have friend_code lookup index');

-- ── Functions exist (3) ─────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'are_friends'),
  'are_friends() function exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'resolve_friend_code'),
  'resolve_friend_code() function exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'gen_friend_code'),
  'gen_friend_code() function exists');

-- ── RLS enabled (2) ─────────────────────────────────────────────────────────
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.friend_requests'::regclass),
  'RLS enabled on friend_requests');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.friendships'::regclass),
  'RLS enabled on friendships');

-- ── friendships has NO authenticated INSERT policy (trigger/service only) (1) ─
select ok(
  NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'friendships' AND cmd = 'INSERT'),
  'friendships should have NO INSERT policy (written by accept trigger only)');

-- ── Grants (1) ──────────────────────────────────────────────────────────────
select ok(has_table_privilege('authenticated', 'public.friend_requests', 'INSERT'),
  'authenticated can INSERT friend_requests');

-- ── FK cascades (1) ─────────────────────────────────────────────────────────
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'friend_requests_requester_id_fkey')::text,
  'c', 'friend_requests.requester_id ON DELETE CASCADE');

-- ── Functional: accept trigger writes canonical friendship (2) ───────────────
DO $$
DECLARE
  a UUID := gen_random_uuid();
  b UUID := gen_random_uuid();
  req UUID;
BEGIN
  INSERT INTO public.users (id, email, name) VALUES
    (a, format('fr-a-%s@example.com', a::text), 'FR A'),
    (b, format('fr-b-%s@example.com', b::text), 'FR B');
  INSERT INTO public.friend_requests (requester_id, addressee_id, status)
    VALUES (a, b, 'pending') RETURNING id INTO req;
  UPDATE public.friend_requests SET status = 'accepted' WHERE id = req;
  PERFORM set_config('test.fr_a', a::text, true);
  PERFORM set_config('test.fr_b', b::text, true);
END $$;

select results_eq(
  format($f$SELECT count(*)::int FROM public.friendships
    WHERE user_a = LEAST(%L::uuid,%L::uuid) AND user_b = GREATEST(%L::uuid,%L::uuid)$f$,
    current_setting('test.fr_a'), current_setting('test.fr_b'),
    current_setting('test.fr_a'), current_setting('test.fr_b')),
  ARRAY[1],
  'Accepting a friend request should create exactly one canonical friendship row');

select results_eq(
  format($f$SELECT are_friends(%L::uuid, %L::uuid)$f$,
    current_setting('test.fr_b'), current_setting('test.fr_a')),
  ARRAY[true],
  'are_friends() should be true (order-independent) after accept');

-- ── unfriend cleanup trigger (1): deleting a friendship clears the paired
--    friend_requests row (incl. the stale 'accepted' one) so the pair can
--    re-add each other — the v0.4.5 re-add lockout fix.
DELETE FROM public.friendships
  WHERE user_a = LEAST(current_setting('test.fr_a')::uuid, current_setting('test.fr_b')::uuid)
    AND user_b = GREATEST(current_setting('test.fr_a')::uuid, current_setting('test.fr_b')::uuid);

select results_eq(
  format($f$SELECT count(*)::int FROM public.friend_requests
    WHERE (requester_id = %L::uuid AND addressee_id = %L::uuid)
       OR (requester_id = %L::uuid AND addressee_id = %L::uuid)$f$,
    current_setting('test.fr_a'), current_setting('test.fr_b'),
    current_setting('test.fr_b'), current_setting('test.fr_a')),
  ARRAY[0],
  'Unfriending should clear the paired friend_requests row (re-add unblocked)');

select * from finish();
rollback;
