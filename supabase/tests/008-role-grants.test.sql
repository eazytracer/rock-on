-- Test: Role Grants on Public Tables
-- Purpose: Verify every public table grants the full DML set (SELECT /
--          INSERT / UPDATE / DELETE) to BOTH `authenticated` and
--          `service_role` — the two roles PostgREST / edge functions rely
--          on. Also verifies default privileges on the public schema so
--          tables added in future migrations inherit the grants.
-- Category: Security & Permissions
-- Created: 2026-04-24
--
-- Why this test exists:
--   v0.3.0's post-deploy cascade (403 on every jam REST call; 404 on the
--   jam-view edge function; hostDisplayName="Host" for anonymous viewers)
--   all traced back to missing table-level GRANTs. The baseline migration
--   used a snapshot-style `GRANT ... ON ALL TABLES IN SCHEMA public TO
--   authenticated` that did NOT cover tables added later, and never
--   emitted an equivalent grant for `service_role` at all.
--
--   Local Supabase has more permissive default privileges than the hosted
--   service, so `information_schema.role_table_grants` checks can appear
--   healthy locally while the hosted DB fails. This test uses pgTAP's
--   `has_table_privilege()` which mirrors the actual permission check the
--   database performs at query time — so it catches the real gap.
--
-- If this test fails:
--   The reported (role, table, privilege) tuple identifies exactly what's
--   missing. Add a `GRANT <privilege> ON public.<table> TO <role>` to the
--   feature's incremental migration. Going forward, every new table MUST
--   include explicit grants for both roles (see CLAUDE.md "Migration
--   Policy").

begin;

-- Plan: 4 privileges × 2 roles per table + 4 default-ACL checks + 2
-- RLS-wide checks + a couple of sanity assertions.
select plan(
  (
    (select count(*)::int from pg_tables where schemaname = 'public')
    * 4  -- SELECT, INSERT, UPDATE, DELETE
    * 2  -- authenticated, service_role
  )
  + 4  -- default privileges (2 roles × 2 object types: tables, sequences)
  + 1  -- public schema USAGE for service_role
);

-- ============================================================================
-- Per-table role grant checks
-- ============================================================================
-- Iterates every public BASE TABLE × {authenticated, service_role} × {SELECT,
-- INSERT, UPDATE, DELETE}. A missing grant at the hosted-DB level will fail
-- the corresponding assertion with a clear name.

select ok(
  has_table_privilege(role_name, full_table, privilege),
  format(
    '%s should have %s on %s',
    role_name,
    privilege,
    full_table
  )
)
from (
  select
    t.schemaname || '.' || t.tablename as full_table,
    r.role_name,
    p.privilege
  from pg_tables t
  cross join (
    values ('authenticated'), ('service_role')
  ) as r(role_name)
  cross join (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) as p(privilege)
  where t.schemaname = 'public'
) grants_to_check
order by full_table, role_name, privilege;

-- ============================================================================
-- Default privileges — future tables inherit grants automatically
-- ============================================================================
-- Without these, every new-table migration would have to remember to emit
-- `GRANT ... TO authenticated, service_role`. Default privileges set this
-- up at the schema level so postgres-owned tables created in `public` get
-- the grants for free.

select ok(
  exists (
    select 1 from pg_default_acl
    where defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'r'  -- tables
      and exists (
        select 1 from unnest(defaclacl) acl
        where acl::text like '%authenticated%'
      )
  ),
  'public schema should have default ALTER DEFAULT PRIVILEGES granting table access to authenticated'
);

select ok(
  exists (
    select 1 from pg_default_acl
    where defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'r'  -- tables
      and exists (
        select 1 from unnest(defaclacl) acl
        where acl::text like '%service_role%'
      )
  ),
  'public schema should have default ALTER DEFAULT PRIVILEGES granting table access to service_role'
);

select ok(
  exists (
    select 1 from pg_default_acl
    where defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'S'  -- sequences
      and exists (
        select 1 from unnest(defaclacl) acl
        where acl::text like '%authenticated%'
      )
  ),
  'public schema should have default privileges for authenticated on sequences'
);

select ok(
  exists (
    select 1 from pg_default_acl
    where defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'S'  -- sequences
      and exists (
        select 1 from unnest(defaclacl) acl
        where acl::text like '%service_role%'
      )
  ),
  'public schema should have default privileges for service_role on sequences'
);

-- ============================================================================
-- Schema-level sanity
-- ============================================================================

select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'service_role should have USAGE on public schema'
);

select * from finish();
rollback;
