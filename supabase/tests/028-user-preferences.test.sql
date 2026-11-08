-- Test: user_preferences (redesign phase 0)
-- Purpose: One row per user, readable and writable only by that user; theme is
--          constrained; updates bump version + updated_date.
-- Category: Schema + RLS
-- Created: 2026-11-07

begin;

select plan(10);

select has_table('user_preferences', 'user_preferences table exists');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_preferences'::regclass),
  'RLS enabled on user_preferences');
select ok(has_table_privilege('authenticated', 'public.user_preferences', 'SELECT,INSERT,UPDATE'),
  'authenticated has table grants');
select ok(has_table_privilege('service_role', 'public.user_preferences', 'SELECT,INSERT,UPDATE'),
  'service_role has table grants');

select tests.create_supabase_user('up-a@test.com');
select tests.create_supabase_user('up-b@test.com');

DO $$ BEGIN
  PERFORM set_config('test.a_uid', tests.get_supabase_uid('up-a@test.com')::text, true);
  PERFORM set_config('test.b_uid', tests.get_supabase_uid('up-b@test.com')::text, true);
END $$;

-- B has a row; A must not see or change it.
INSERT INTO public.user_preferences (user_id, theme)
VALUES (current_setting('test.b_uid')::uuid, 'dark');

select tests.authenticate_as('up-a@test.com');

select lives_ok(
  $$INSERT INTO public.user_preferences (user_id, theme)
    VALUES (current_setting('test.a_uid')::uuid, 'light')$$,
  'a user can create their own preferences');

select throws_ok(
  $$INSERT INTO public.user_preferences (user_id, theme)
    VALUES (current_setting('test.a_uid')::uuid, 'neon')
    ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme$$,
  '23514', NULL, 'theme outside system/light/dark is rejected');

select is((SELECT count(*)::int FROM public.user_preferences), 1,
  'a user sees only their own row');

select throws_ok(
  $$INSERT INTO public.user_preferences (user_id, theme)
    VALUES (current_setting('test.b_uid')::uuid, 'light')$$,
  '42501', NULL, 'a user cannot create preferences for someone else');

UPDATE public.user_preferences SET theme = 'light'
 WHERE user_id = current_setting('test.b_uid')::uuid;

UPDATE public.user_preferences SET theme = 'system'
 WHERE user_id = current_setting('test.a_uid')::uuid;

select is((SELECT version FROM public.user_preferences
            WHERE user_id = current_setting('test.a_uid')::uuid), 2,
  'an update bumps version');

reset role;
select is((SELECT theme FROM public.user_preferences
            WHERE user_id = current_setting('test.b_uid')::uuid), 'dark',
  'a user cannot update someone else''s preferences');

select * from finish();
rollback;
