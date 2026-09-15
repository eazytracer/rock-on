-- Migration: extend_audit_triggers
-- Phase 2 data-layer simplification.
--
-- The web client is now a naive online Supabase client with no local sync
-- engine; it relies on the `audit_log` change-feed (already realtime-enabled in
-- the baseline) as its ONLY push channel for cross-device/cross-member
-- freshness. The baseline only installed audit triggers on songs, setlists,
-- shows, and practice_sessions — so changes to bands, memberships, and the
-- casting/capability tables never emitted a change event.
--
-- This migration:
--   1. Extends log_audit_trail() to derive band_id for the newly-covered tables.
--   2. Installs AFTER INSERT/UPDATE/DELETE audit triggers on:
--        bands, band_memberships, song_castings, song_assignments,
--        member_capabilities
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS before CREATE.
-- No new tables, so no GRANTs required (existing tables already granted).

-- ============================================================================
-- 1. Extend the audit function's band_id derivation
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_band_id UUID;
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
  v_context_type TEXT;
BEGIN
  -- Determine action and values
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_user_id := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  ELSE  -- INSERT
    v_action := 'INSERT';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    v_user_id := auth.uid();
  END IF;

  -- Get user_name from public.users first (MVP seed data has names there)
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name FROM public.users WHERE id = v_user_id;

    -- Fallback to auth.users metadata if needed
    IF v_user_name IS NULL THEN
      SELECT raw_user_meta_data->>'name' INTO v_user_name
      FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  -- Always set default if still NULL
  IF v_user_name IS NULL THEN
    v_user_name := 'System';
  END IF;

  -- Get band_id based on table
  IF TG_TABLE_NAME = 'songs' THEN
    -- For songs, get context_type to determine how to handle context_id
    IF TG_OP = 'DELETE' THEN
      v_context_type := OLD.context_type;
      IF v_context_type = 'band' THEN
        v_band_id := OLD.context_id::uuid;
      ELSE
        v_band_id := NULL;
      END IF;
    ELSE
      v_context_type := NEW.context_type;
      IF v_context_type = 'band' THEN
        v_band_id := NEW.context_id::uuid;
      ELSE
        v_band_id := NULL;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN ('setlists', 'shows', 'practice_sessions', 'band_memberships', 'member_capabilities') THEN
    -- These tables have band_id directly
    IF TG_OP = 'DELETE' THEN
      v_band_id := OLD.band_id;
    ELSE
      v_band_id := NEW.band_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'bands' THEN
    -- The band's own id IS the band_id
    v_band_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'song_castings' THEN
    -- Castings are context-scoped like songs; band_id only for band context
    IF TG_OP = 'DELETE' THEN
      v_context_type := OLD.context_type;
      IF v_context_type = 'band' THEN
        v_band_id := OLD.context_id::uuid;
      ELSE
        v_band_id := NULL;
      END IF;
    ELSE
      v_context_type := NEW.context_type;
      IF v_context_type = 'band' THEN
        v_band_id := NEW.context_id::uuid;
      ELSE
        v_band_id := NULL;
      END IF;
    END IF;
  ELSE
    -- song_assignments (no direct band_id — derived via casting join, left NULL)
    -- and any other table
    v_band_id := NULL;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_name,
    band_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    v_user_id,
    v_user_name,
    v_band_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION log_audit_trail() OWNER TO postgres;

-- ============================================================================
-- 2. Install audit triggers on the newly-covered tables (idempotent)
-- ============================================================================
DROP TRIGGER IF EXISTS bands_audit_log ON public.bands;
CREATE TRIGGER bands_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.bands
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS band_memberships_audit_log ON public.band_memberships;
CREATE TRIGGER band_memberships_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.band_memberships
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS song_castings_audit_log ON public.song_castings;
CREATE TRIGGER song_castings_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.song_castings
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS song_assignments_audit_log ON public.song_assignments;
CREATE TRIGGER song_assignments_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.song_assignments
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS member_capabilities_audit_log ON public.member_capabilities;
CREATE TRIGGER member_capabilities_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.member_capabilities
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- ============================================================================
-- 3. v0.6.0 release notes (Phase 1 release_notes row — data-only upsert)
--    Idempotent via ON CONFLICT (version). Drives the in-app "what's new".
-- ============================================================================
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.6.0',
  'Faster, simpler, always in sync',
  $md$Under the hood, Rock-On now talks to the cloud directly instead of keeping a
copy of your data on your device and syncing it in the background:

- **Your data is always current.** Changes you or your bandmates make show up
  without waiting on a background sync — everyone sees the same thing, sooner.
- **Less to go wrong.** Removing the on-device copy and the sync engine cuts out
  a whole class of "it synced on my phone but not my laptop" glitches.
- **A lighter, faster app.** The app downloads and starts up leaner than before.

You shouldn't have to change anything — just keep using Rock-On as usual.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;

