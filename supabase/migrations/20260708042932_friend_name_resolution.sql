-- ============================================================================
-- Friend name resolution + name search (bug fix).
--
-- The app never populates user_profiles.display_name, and users RLS has no
-- "friend" read policy — so friend/request names fell back to "Someone" and
-- name search (which matched display_name) found nobody. Resolve the reliable
-- public.users.name via two SECURITY DEFINER RPCs, each tightly scoped so a
-- caller can only see names for people they're actually connected to (or who
-- opted into discovery).
--
-- Additive; read-only; no data loss.
-- ============================================================================

-- Names for a set of user ids the caller is CONNECTED to (a friend, or the
-- counterparty of a friend_request in either direction). Scoped so it cannot
-- enumerate arbitrary users' names.
CREATE OR REPLACE FUNCTION public.related_names(p_ids UUID[])
RETURNS TABLE (user_id UUID, name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.id = ANY(p_ids)
    AND (
      public.are_friends((select auth.uid()), u.id)
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE (fr.requester_id = (select auth.uid()) AND fr.addressee_id = u.id)
           OR (fr.addressee_id = (select auth.uid()) AND fr.requester_id = u.id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.related_names(UUID[]) TO authenticated;

-- Find DISCOVERABLE people by their real name (public.users.name). Only returns
-- users who opted into discovery (user_profiles.discoverable), never the caller.
-- LIKE wildcards in the query are escaped so input matches literally.
CREATE OR REPLACE FUNCTION public.search_discoverable_users(p_query TEXT)
RETURNS TABLE (user_id UUID, name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT up.user_id, u.name
  FROM public.user_profiles up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.discoverable
    AND up.user_id <> (select auth.uid())
    AND length(btrim(p_query)) >= 2
    AND u.name ILIKE '%' ||
        replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_')
        || '%' ESCAPE '\'
  ORDER BY u.name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_discoverable_users(TEXT) TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================
