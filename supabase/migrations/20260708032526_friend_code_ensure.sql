-- ============================================================================
-- Friend-code robustness (bug fix for the friends feature)
--
-- The original friends migration backfilled friend_code for profiles that
-- existed at migration time and added a UNIQUE constraint, but gave the column
-- no DEFAULT and no way to populate NEW rows. The app never inserts a
-- user_profiles row (handle_new_user only creates public.users), so users end
-- up with either no profile row or a NULL friend_code → the share code renders
-- blank with no way to generate one.
--
-- This migration makes friend_code self-provisioning:
--   1. DEFAULT gen_friend_code() so any future INSERT auto-gets a code.
--   2. Backfill any existing NULLs (network-wide, so search/codes work).
--   3. ensure_friend_code() RPC — creates-or-fills the caller's profile row and
--      returns the code, so the client can self-heal on load.
-- Idempotent + additive; no data loss.
-- ============================================================================

-- 1. Future rows auto-provision a code (gen_friend_code is VOLATILE → per-row).
ALTER TABLE public.user_profiles
  ALTER COLUMN friend_code SET DEFAULT public.gen_friend_code();

-- 2. Backfill any profile still missing a code.
UPDATE public.user_profiles
  SET friend_code = public.gen_friend_code()
  WHERE friend_code IS NULL;

-- 3. Ensure the caller has a profile row WITH a friend_code; return the code.
--    SECURITY DEFINER so it can insert/patch under RLS. COALESCE short-circuits
--    so gen_friend_code() only fires when the existing code is NULL.
CREATE OR REPLACE FUNCTION public.ensure_friend_code()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := (select auth.uid());
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.user_profiles (user_id, friend_code)
  VALUES (v_uid, public.gen_friend_code())
  ON CONFLICT (user_id) DO UPDATE
    SET friend_code = COALESCE(public.user_profiles.friend_code, public.gen_friend_code())
  RETURNING friend_code INTO v_code;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_friend_code() TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
