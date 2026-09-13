-- ============================================================================
-- v0.5.0 release notes
-- ----------------------------------------------------------------------------
-- Data-only migration: upserts the in-app "what's new" entry for 0.5.0. No
-- schema change. Idempotent via ON CONFLICT (version). This is the Phase 1
-- release_notes row required by CLAUDE.md "Versioning & Release Policy".
-- ============================================================================

INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.5.0',
  'Calendar & practice fixes, smoother sign-in',
  $md$This update cleans up a few things around practices and your calendar:

- **A practice stays in "upcoming" until it actually ends.** Before, a practice
  dropped out of your upcoming list the moment its start time passed — now it
  sticks around through its whole scheduled window.
- **No more surprise "cancelled" tags.** Past practices used to show up as
  "cancelled" on their own. Cancelling is now something only you set on purpose;
  a practice that simply happened shows as "completed".
- **Sign-in is clearer and steadier.** When you're signed out for being away a
  while, the app now says so plainly instead of "session invalid", and recovers
  more gracefully from brief drops in connection.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ============================================================================
-- Migration Complete
-- ============================================================================
