-- ============================================================================
-- Privacy lockdown: emails, jam discovery, bandmate profiles
-- ============================================================================
-- Security fix (found in the 0.6.1 RLS audit). Idempotent.
--
-- 1. Emails & activity are no longer readable by other users.
--    RLS is row-level: anyone who could see a `users` row (bandmates, jam and
--    event co-participants) also saw its email, last_login and last_active_at.
--    Column privileges now expose only non-sensitive columns. Emails are read
--    through get_user_emails(), which returns your own email and — for band
--    admins/owners only — the emails of members of bands they administer.
--    NOTE: column grants are explicit. A column added to users later is NOT
--    readable by `authenticated` until it is added to the GRANT below.
--
-- 2. Jam sessions can't be discovered or joined without the code.
--    `jam_sessions_select_by_code` only checked status = 'active' (the code
--    was filtered client-side), so any signed-in user could list every active
--    jam, and `jam_participants_insert_self` let them join any of them.
--    Lookup and join now go through get_jam_session_by_code() and
--    join_jam_session(), which require the exact code. Direct participant
--    inserts are limited to the host adding themselves at creation.
--
-- 3. Bandmates can read each other's profiles.
--    user_profiles had no band-member SELECT policy, so a bandmate who wasn't
--    discoverable (and not a friend / co-participant) showed no display name
--    or instruments on the roster.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. users: column-level SELECT
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.users FROM authenticated, anon;
GRANT SELECT (
  id,
  name,
  created_date,
  auth_provider,
  account_tier,
  tier_updated_at,
  last_seen_release_version
) ON public.users TO authenticated;
-- Hidden from authenticated: email, last_login, last_active_at.
-- service_role keeps full table access (edge functions).

-- Your own email, plus bandmates' emails for bands where you are admin/owner.
CREATE OR REPLACE FUNCTION public.get_user_emails(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM public.users u
  WHERE u.id = ANY(p_user_ids)
    AND (
      u.id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.band_memberships me
        JOIN public.band_memberships them ON them.band_id = me.band_id
        WHERE me.user_id = (SELECT auth.uid())
          AND them.user_id = u.id
          AND me.status = 'active'
          AND them.status = 'active'
          AND (me.role = 'admin' OR 'owner' = ANY(me.permissions))
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_emails(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Jam sessions: code-gated lookup and join
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS jam_sessions_select_by_code ON public.jam_sessions;

-- Exact-code lookup (any status, so the caller can show "expired" etc.).
-- Wrong or empty code → no row; nothing to enumerate.
CREATE OR REPLACE FUNCTION public.get_jam_session_by_code(p_code TEXT)
RETURNS SETOF public.jam_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT js.*
  FROM public.jam_sessions js
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND js.short_code = upper(trim(coalesce(p_code, '')))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_jam_session_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_jam_session_by_code(TEXT) TO authenticated;

-- Join an active, unexpired session by code, sharing the caller's personal
-- catalog. ON CONFLICT DO NOTHING keeps an existing row as-is (a 'kicked'
-- participant is not re-activated).
CREATE OR REPLACE FUNCTION public.join_jam_session(p_code TEXT)
RETURNS SETOF public.jam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  UUID := (SELECT auth.uid());
  v_code    TEXT := upper(trim(coalesce(p_code, '')));
  v_session public.jam_sessions%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR v_code = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_session FROM public.jam_sessions WHERE short_code = v_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.status <> 'active' OR v_session.expires_at < now() THEN
    RAISE EXCEPTION 'This jam session is no longer active';
  END IF;

  INSERT INTO public.jam_participants (jam_session_id, user_id, status, shared_contexts)
  VALUES (
    v_session.id,
    v_caller,
    'active',
    jsonb_build_array(jsonb_build_object('type', 'personal', 'id', v_caller))
  )
  ON CONFLICT (jam_session_id, user_id) DO NOTHING;

  RETURN NEXT v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.join_jam_session(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_jam_session(TEXT) TO authenticated;

-- Direct inserts: only the host adding themselves (JamSessionService.createSession).
DROP POLICY IF EXISTS jam_participants_insert_self ON public.jam_participants;
DROP POLICY IF EXISTS jam_participants_insert_host_self ON public.jam_participants;
CREATE POLICY jam_participants_insert_host_self ON public.jam_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jam_sessions js
      WHERE js.id = jam_session_id
        AND js.host_user_id = (SELECT auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 3. user_profiles: readable by active bandmates
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS user_profiles_select_band_member ON public.user_profiles;
CREATE POLICY user_profiles_select_band_member ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.band_memberships me
      JOIN public.band_memberships them ON them.band_id = me.band_id
      WHERE me.user_id = (SELECT auth.uid())
        AND them.user_id = user_profiles.user_id
        AND me.status = 'active'
        AND them.status = 'active'
    )
  );
