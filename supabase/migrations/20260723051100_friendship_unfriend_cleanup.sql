-- ============================================================================
-- v0.4.5 bugfix: friendship re-add after unfriend
-- ----------------------------------------------------------------------------
-- Accepting a friend request leaves the friend_requests row at status
-- 'accepted' (the accept trigger writes the canonical friendships row but keeps
-- the request row). Unfriending deletes only the friendships row, so the stale
-- 'accepted' request row survives and occupies the UNIQUE (requester_id,
-- addressee_id) slot — blocking the pair from ever re-adding each other
-- ("You're already friends", even though the UI shows no friend and no pending
-- request).
--
-- Fix: an AFTER DELETE trigger on friendships that clears any friend_requests
-- row between the two users (either direction), so the slot is freed on
-- unfriend regardless of which code path performed the delete. SECURITY DEFINER
-- so it can delete request rows independent of the caller's RLS scope.
--
-- Idempotent. No new tables → no new grants required.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.on_friendship_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friend_requests
  WHERE (requester_id = OLD.user_a AND addressee_id = OLD.user_b)
     OR (requester_id = OLD.user_b AND addressee_id = OLD.user_a);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendship_deleted ON public.friendships;
CREATE TRIGGER trg_friendship_deleted
  AFTER DELETE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.on_friendship_deleted();

-- One-time cleanup of rows orphaned by the pre-fix behaviour: 'accepted'
-- friend_requests whose pair no longer has a friendship. The app also
-- self-heals these on the next re-add attempt, but clearing them here means the
-- direct INSERT succeeds instead of taking the reactivation path.
DELETE FROM public.friend_requests fr
WHERE fr.status = 'accepted'
  AND NOT public.are_friends(fr.requester_id, fr.addressee_id);

-- ── Release notes (in-app "what's new"; idempotent upsert) ──────────────────
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.4.5',
  'Sign-in & friends fixes',
  $md$This update fixes a few things that were getting in the way:

- **Existing band members can get back in.** Some returning members were being
  sent to the new-user setup screen and told they were "already in the band"
  when entering their code. You now land straight in your band on sign-in.
- **Signing out always works.** If the app got stuck on an empty screen you can
  now sign out and back in to recover — no more clearing your browser to escape.
- **Re-adding a friend works after unfriending.** Removing a friend and adding
  them again no longer says "you're already friends".$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ============================================================================
-- Migration Complete
-- ============================================================================
