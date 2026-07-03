-- Test: Notifications feature schema coverage
-- Purpose: Lock down the notifications + release_notes tables, the kind CHECK,
--          indexes, RLS policies (incl. service_role-only INSERT), grants, and
--          the user-delete cascade.
-- Category: Schema + RLS + Data Integrity
-- Created: 2026-07-02 (mobile-redesign-port)

begin;

select plan(22);

-- ── Tables (2) ──────────────────────────────────────────────────────────────
select has_table('notifications', 'notifications table should exist');
select has_table('release_notes', 'release_notes table should exist');

-- ── Columns (6) ─────────────────────────────────────────────────────────────
select has_column('notifications', 'user_id', 'notifications.user_id exists');
select has_column('notifications', 'kind', 'notifications.kind exists');
select has_column('notifications', 'read_at', 'notifications.read_at exists (unread = NULL)');
select col_type_is('notifications', 'payload', 'jsonb', 'notifications.payload is jsonb');
select has_column('release_notes', 'version', 'release_notes.version exists (PK)');
select has_column('users', 'last_seen_release_version',
  'users.last_seen_release_version exists (what''s-new gate)');

-- ── kind CHECK (1) ──────────────────────────────────────────────────────────
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_kind_check'
      AND conrelid = 'public.notifications'::regclass
      AND contype = 'c'
  ),
  'notifications should have a kind CHECK constraint'
);

-- ── Indexes (2) ─────────────────────────────────────────────────────────────
select has_index('notifications', 'idx_notifications_user_unread',
  ARRAY['user_id', 'created_date'],
  'notifications should have the partial unread index');
select has_index('notifications', 'idx_notifications_user',
  ARRAY['user_id', 'created_date'],
  'notifications should have the user feed index');

-- ── RLS enabled (2) ─────────────────────────────────────────────────────────
select ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notifications'::regclass),
  'RLS should be enabled on notifications'
);
select ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.release_notes'::regclass),
  'RLS should be enabled on release_notes'
);

-- ── Policies (5) ────────────────────────────────────────────────────────────
select ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select_own'),
  'notifications_select_own policy exists');
select ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update_own'),
  'notifications_update_own policy exists');
select ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_delete_own'),
  'notifications_delete_own policy exists');
select ok(
  EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'release_notes' AND policyname = 'release_notes_select_all'),
  'release_notes_select_all policy exists');
-- INSERT is service_role only — there must be NO authenticated INSERT policy.
select ok(
  NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND cmd = 'INSERT'),
  'notifications should have NO INSERT policy (minted by service_role only)');

-- ── Grants (2) ──────────────────────────────────────────────────────────────
select ok(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  'authenticated can SELECT notifications');
select ok(
  has_table_privilege('service_role', 'public.notifications', 'INSERT'),
  'service_role can INSERT notifications');

-- ── FK cascade (1) ──────────────────────────────────────────────────────────
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'notifications_user_id_fkey')::text,
  'c',
  'notifications.user_id should ON DELETE CASCADE');

-- ── Functional cascade (1): deleting a user wipes their notifications ────────
DO $$
DECLARE
  n_user_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (n_user_id, format('notif-%s@example.com', n_user_id::text), 'Notif Test');
  INSERT INTO public.notifications (user_id, kind, title)
  VALUES (n_user_id, 'activity', 'Hello');
  PERFORM set_config('test.notif_user_id', n_user_id::text, true);
END $$;

DO $$ BEGIN
  DELETE FROM public.users WHERE id = current_setting('test.notif_user_id')::uuid;
END $$;

select results_eq(
  format($f$SELECT count(*)::int FROM public.notifications WHERE user_id = %L$f$,
    current_setting('test.notif_user_id')),
  ARRAY[0],
  'Deleting a user should cascade-delete their notifications');

select * from finish();
rollback;
