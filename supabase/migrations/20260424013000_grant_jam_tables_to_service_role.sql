-- ============================================================================
-- Hotfix: Grant DML privileges on jam_* tables to service_role
-- Date: 2026-04-24
-- Description:
--   The preceding hotfix (20260424000000_hotfix_grant_jam_tables.sql) only
--   granted DML to the `authenticated` role. The edge functions (jam-view,
--   jam-recompute) use the service_role key and query these tables via
--   PostgREST. Despite `service_role` having `rolbypassrls = true`, it
--   still needs explicit GRANT statements — BYPASSRLS disables RLS but
--   does NOT confer table-level privileges.
--
--   Symptom: the jam-view edge function returned 404 "Session not found"
--   for every anonymous lookup, because the underlying SELECT failed with
--   "permission denied" and supabase-js surfaced the empty result as
--   not-found. Direct curl verification plus a SET ROLE service_role
--   test confirmed the missing grants.
--
--   Fix: grant SELECT/INSERT/UPDATE/DELETE on all three jam tables to
--   service_role as well.
--
-- SAFETY: GRANT is idempotent. Already applied inline on production
-- during debugging; this migration captures that change in version
-- control so other environments (local dev, future production fresh
-- installs) stay in sync.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_song_matches TO service_role;
