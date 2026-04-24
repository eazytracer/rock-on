-- ============================================================================
-- Hotfix: Grant table-level privileges on jam_* tables to authenticated
-- Date: 2026-04-24
-- Description:
--   The previous incremental migration (20260422220000_social_catalog_and_
--   jam_sessions.sql) created three new tables (jam_sessions,
--   jam_participants, jam_song_matches) and attached RLS policies but did
--   NOT grant the `authenticated` role the table-level DML privileges it
--   needs to actually read or write them.
--
--   Supabase's baseline migration grants privileges via
--   `GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated` — that's a
--   SNAPSHOT grant, not a default-privilege rule, so tables created after
--   the baseline don't inherit it. New tables always need explicit grants.
--
--   Without these grants, PostgREST returned 403 for every SELECT / INSERT
--   / UPDATE / DELETE against the jam tables despite valid JWTs, breaking
--   the entire jam session flow on production.
--
-- SAFETY: GRANT is idempotent — safe to re-run.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jam_song_matches TO authenticated;

-- No sequences on these tables (UUID PKs via gen_random_uuid()), so no
-- USAGE grants needed.
