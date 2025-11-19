-- Test: Setup Test Helpers
-- Purpose: Create helper functions for RLS and user testing
-- Category: Setup
-- Created: 2025-11-07

-- Create test schema for helper functions
create schema if not exists tests;

-- Grant usage on tests schema to authenticated role (needed when SET ROLE authenticated)
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

-- Grant authenticated role access to auth.users for test helpers
-- This is needed because tests.authenticate_as() queries auth.users
grant select on auth.users to authenticated;

-- Helper: Create test user in auth.users and public.users
create or replace function tests.create_supabase_user(email text)
returns uuid as $$
declare
  user_id uuid;
begin
  -- Reset to postgres role for elevated privileges (needed after SET ROLE authenticated)
  reset role;

  user_id := gen_random_uuid();

  -- Create user in auth schema (Supabase auth system)
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change_token_new,
    recovery_token
  ) values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email,
    crypt('password', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    '',
    ''
  );

  -- NOTE: public.users entry is auto-created by handle_new_user() trigger
  -- No need to manually insert - trigger handles it automatically
  -- This ensures tests match production behavior

  return user_id;
end;
$$ language plpgsql;

-- Helper: Authenticate as user (sets JWT context)
create or replace function tests.authenticate_as(email text)
returns void as $$
declare
  user_id uuid;
begin
  -- Reset to postgres role to query auth.users (needed after previous SET ROLE authenticated)
  reset role;

  select id into user_id from auth.users where auth.users.email = authenticate_as.email;

  if user_id is null then
    raise exception 'User % not found', email;
  end if;

  -- Set JWT claims to simulate authenticated user
  execute format('set request.jwt.claim.sub=%L', user_id);
  execute format('set request.jwt.claims=%L', json_build_object('sub', user_id, 'role', 'authenticated')::text);

  -- Also set local.user_id for triggers that use it
  execute format('set local.user_id=%L', user_id);

  -- CRITICAL: Switch to 'authenticated' role to enforce RLS policies
  -- The 'postgres' role has BYPASSRLS which ignores all RLS policies
  -- By switching to 'authenticated', RLS policies will be properly enforced
  set role authenticated;
end;
$$ language plpgsql;

-- Helper: Clear authentication context
create or replace function tests.clear_authentication()
returns void as $$
begin
  set request.jwt.claim.sub = '';
  set request.jwt.claims = '';
  set local.user_id = '';
end;
$$ language plpgsql;

-- Helper: Get user ID by email
create or replace function tests.get_supabase_uid(email text)
returns uuid as $$
begin
  return (select id from auth.users where auth.users.email = get_supabase_uid.email);
end;
$$ language plpgsql;

-- Helper: Check if RLS is enabled on a table
create or replace function tests.rls_enabled(table_name text)
returns boolean as $$
begin
  return (
    select relrowsecurity
    from pg_class
    where relname = table_name
    and relnamespace = 'public'::regnamespace
  );
end;
$$ language plpgsql;

-- Helper: Check if a policy exists
create or replace function tests.policy_exists(table_name text, policy_name text)
returns boolean as $$
begin
  return exists(
    select 1
    from pg_policies
    where schemaname = 'public'
    and tablename = table_name
    and policyname = policy_name
  );
end;
$$ language plpgsql;

-- Helper: Get count of policies on a table
create or replace function tests.policy_count(table_name text)
returns integer as $$
begin
  return (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
    and tablename = table_name
  );
end;
$$ language plpgsql;

-- Helper: Create test band with user as admin
create or replace function tests.create_test_band(band_name text, admin_email text)
returns uuid as $$
declare
  band_id uuid;
  user_id uuid;
begin
  band_id := gen_random_uuid();
  user_id := tests.get_supabase_uid(admin_email);

  if user_id is null then
    raise exception 'User % not found. Create user first with tests.create_supabase_user()', admin_email;
  end if;

  -- Authenticate as user to satisfy RLS
  perform tests.authenticate_as(admin_email);

  -- Create band (no created_by column in bands table)
  insert into public.bands (id, name, created_date, updated_date)
  values (band_id, band_name, now(), now());

  -- Add user as admin
  insert into public.band_memberships (user_id, band_id, role, status, joined_date)
  values (user_id, band_id, 'admin', 'active', now());

  return band_id;
end;
$$ language plpgsql;

-- Helper: Add user to band
create or replace function tests.add_user_to_band(
  user_email text,
  band_id uuid,
  member_role text default 'member',
  member_status text default 'active'
)
returns void as $$
declare
  user_id uuid;
begin
  user_id := tests.get_supabase_uid(user_email);

  if user_id is null then
    raise exception 'User % not found', user_email;
  end if;

  insert into public.band_memberships (user_id, band_id, role, status, joined_date)
  values (user_id, band_id, member_role, member_status, now());
end;
$$ language plpgsql;

-- Helper: Cleanup test data (for manual cleanup if needed)
create or replace function tests.cleanup_test_data()
returns void as $$
begin
  -- Delete in order to respect foreign keys
  delete from public.song_assignments;
  delete from public.song_castings;
  delete from public.casting_templates;
  delete from public.member_capabilities;
  delete from public.assignment_roles;
  delete from public.song_group_memberships;
  delete from public.song_groups;
  delete from public.practice_sessions;
  delete from public.shows;
  delete from public.setlists;
  delete from public.songs;
  delete from public.band_memberships;
  delete from public.invite_codes;
  delete from public.bands;
  delete from public.user_profiles;
  delete from public.users;

  -- Clean auth users
  delete from auth.users;

  -- Clean audit log
  delete from public.audit_log;
end;
$$ language plpgsql;

-- No tests in this file, just setup
-- This file runs first (000-) to set up helpers for other tests
