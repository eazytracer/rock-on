-- ============================================================================
-- Social events (mobile-redesign-port) — piece A: cast from event PARTICIPANTS
-- ============================================================================
-- The casting DB already permits casting any event participant (casting_insert /
-- casting_update use is_event_participant) and free-text names (member_id NULL).
-- The one missing capability for a host to CAST guests is NAME VISIBILITY: a guest
-- who is not a band co-member (nor a jam co-participant) is not readable in the
-- `users` / `user_profiles` tables, so the cast picker would show blank names.
--
-- This migration adds a co-participant name-visibility policy, mirroring the proven
-- `users_select_jam_coparticipant` / `user_profiles_select_jam_coparticipant`
-- pattern: two users who share an event may read each other's name.
--
-- Security notes:
--  * SECURITY DEFINER helper owned by postgres → no RLS recursion on event_participants.
--  * Symmetric (co-participation is mutual); self is already covered by users_select_self.
--  * Exposes users.*/user_profiles.* to event co-participants — identical surface to the
--    established jam co-participant policy (the app queries only name/displayName).
-- ============================================================================

-- ── are_event_coparticipants: both users participate in the same event ───────
CREATE OR REPLACE FUNCTION public.are_event_coparticipants(p_caller UUID, p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_participants ep_caller
    JOIN public.event_participants ep_other
      ON ep_caller.event_id = ep_other.event_id
    WHERE ep_caller.user_id = p_caller
      AND ep_other.user_id  = p_other
  );
$$;

ALTER FUNCTION public.are_event_coparticipants(UUID, UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.are_event_coparticipants(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.are_event_coparticipants IS
  'Returns true when both users are participants in the same event. Used by RLS to let an event host/guest resolve co-participant names for casting.';

-- ── Name-visibility policies (additive; mirror the jam co-participant policies) ─
DROP POLICY IF EXISTS "users_select_event_coparticipant" ON public.users;
CREATE POLICY "users_select_event_coparticipant"
  ON public.users FOR SELECT TO authenticated
  USING (are_event_coparticipants((select auth.uid()), users.id));

DROP POLICY IF EXISTS "user_profiles_select_event_coparticipant" ON public.user_profiles;
CREATE POLICY "user_profiles_select_event_coparticipant"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (are_event_coparticipants((select auth.uid()), user_id));

-- ============================================================================
-- Migration Complete
-- ============================================================================
