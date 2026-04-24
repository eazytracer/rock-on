-- ============================================================================
-- Hotfix: Grant service_role access to all public tables (baseline gap)
-- Date: 2026-04-24
-- Description:
--   The baseline migration (20251106000000) granted
--       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--         TO authenticated;
--   but never emitted an equivalent statement for `service_role`. As a
--   result, every edge function that queries public tables via the
--   service_role key fails with "permission denied" at the Postgres role
--   level, despite service_role having rolbypassrls=true.
--
--   Preceding hotfix 20260424013000 granted only the jam_* tables; a full
--   audit showed ALL 19 public tables missing service_role grants. This
--   migration closes the gap broadly and sets default privileges so any
--   tables added in future incremental migrations will inherit the grant
--   automatically.
--
--   The jam-view edge function was the first visible failure (404 on
--   "session not found" despite valid data in the DB). Other edge
--   functions would have surfaced the same issue as soon as they needed
--   to read public tables via service_role.
--
-- SAFETY: GRANT / ALTER DEFAULT PRIVILEGES are idempotent.
-- ============================================================================

-- Grant full DML on every existing public table to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Set default privileges so future tables/sequences/functions created by
-- postgres in the public schema automatically grant to service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Same for the authenticated role (baseline only set snapshot grants at
-- baseline-run time; no default privileges were configured, which is why
-- the original 20260422 social-catalog migration needed its own
-- authenticated-grant hotfix). Belt and braces.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;
