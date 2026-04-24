# Social Catalog + Jam Sessions + UI Unification — Summary

**Completed:** 2026-04-23
**Version:** 0.3.0
**PR:** #10
**Branch:** `feature/social-catalog` (16 commits)

## Overview

Large combined release that ships three intertwined streams of work:

1. **Social catalog** — per-user ownership of songs and setlists
   (`context_type = 'personal'`) alongside the existing band-scoped model.
2. **Jam sessions** — ephemeral collaborative sessions that match common
   songs across participants' personal catalogs. Short-code join flow,
   server-computed matches broadcast via Realtime, anonymous follow-along
   via edge function.
3. **UI unification** — extraction of shared components (MetaPill,
   SectionCard, MarkdownField, UnsavedChangesDialog) and a full rebuild of
   the practice session viewer with four responsive layouts (TV / tablet
   landscape / tablet portrait / mobile), Kindle-style scroll controls,
   and a tuning color system on song cards.

Also pivots the project from the pre-1.0 "modify baseline directly"
schema policy to per-feature incremental migrations now that production
data exists.

## Key Changes

### New Files

**Utilities + hooks**

- `src/utils/tunings.ts` — canonical tuning registry (Palette A, 9
  tunings) with `tuningColor()`, `tuningLabel()`, `canonicalTuningId()`,
  `builtInTuningLabels()` helpers. Designed to accept user-defined
  extensions for the future custom-tunings feature.
- `src/hooks/useUnsavedChanges.ts` — promise-based guard. Registers a
  `beforeunload` handler while dirty, exposes `requestClose()` that
  resolves after the user picks Keep / Discard / Save from the dialog.

**Shared components**

- `src/components/common/MetaPill.tsx` — unified metadata chip with
  `KeyPill` / `BpmPill` / `DurationPill` / `TuningPill` helpers. Caption
  above the pill on `size="md"`, hidden on `size="sm"` with a tooltip.
- `src/components/common/SectionCard.tsx` — dark-card container with
  title + optional `actions` slot + optional `description`.
- `src/components/common/UnsavedChangesDialog.tsx` — blocking three-button
  confirm (Keep editing / Discard / Save); Escape = keep editing; default
  focus on Keep.
- `src/components/notes/MarkdownField.tsx` — render-first notes with
  pencil-to-edit, click-out auto-save + green "Notes saved" flash,
  discard confirm on dirty cancel.
- `src/components/practice/ScrollableNotes.tsx` — Kindle-style top/bottom
  tap zones + PageUp/PageDown/Space keyboard + BT foot-pedal shortcuts.
- `src/components/practice/FooterNextPreview.tsx` — shared next-song block
  (NEXT + title + TuningPill + pulsing change indicator).

**Dev sandbox**

- `src/pages/DevUIPreview/` — dev-only design sandbox at `/dev/ui-preview`
  with 5 tabs (practice layouts, tuning colors, markdown field, unsaved
  changes, section card). Kept around for ongoing iteration.

**Social catalog code** (earlier commits in the branch)

- `src/services/JamSessionService.ts`, `src/hooks/useJamSession.ts`,
  `src/hooks/usePersonalSongs.ts`, `src/hooks/usePersonalSetlists.ts`
- `src/utils/songMatcher.ts` — fuzzy song matching algorithm
- `supabase/functions/jam-view/` — anonymous follow-along edge function
- `supabase/functions/jam-recompute/` — server-side match recomputation
- `supabase/functions/_shared/songMatcher.ts` — Deno-compatible matcher
- `scripts/test-harness/` — multi-user jam CLI (alice/bob/carol personas)

**Migration + docs**

- `supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql`
  — first post-baseline incremental migration (~550 lines). Idempotent
  via `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / exception-handler
  wrappers. Applied to production 2026-04-23.
- `.claude/artifacts/2026-04-22T20:57_ui-unification-and-cleanup-assessment.md`
  — design-of-record for the UI unification pass.
- `.claude/specifications/functionality-catalog.md` — plain-English
  index of all app capabilities with test references.

### Modified Files

- `src/pages/PracticeSessionPage.tsx` — complete rewrite; four
  responsive layouts; full-screen; localStorage-persisted font + layout
  toggles; window-scoped keyboard shortcuts.
- `src/pages/PracticeViewPage.tsx` — adopts `<SectionCard>` for Details
  - Wrap-up cards, `<MarkdownField>` for both notes fields.
- `src/pages/SetlistViewPage.tsx` — adopts `<SectionCard>` for Details
  - Notes, `<MarkdownField>` for notes.
- `src/pages/ShowViewPage.tsx` — adopts `<SectionCard>` for Details +
  Contacts + Setlist, `<MarkdownField>` for notes.
- `src/components/common/SongListItem.tsx` — tuning-color left-border
  stripe + colored Guitar icon per tuning.
- `src/components/songs/EditSongModal.tsx` — uses
  `builtInTuningLabels()` from the registry; band-notes textarea
  replaced by `<MarkdownField>` in edit mode and removed in add mode;
  wired to `useUnsavedChanges` with backdrop / X / Cancel all routed
  through `requestClose()`.
- `src/components/notes/MarkdownRenderer.tsx` — migrated off legacy
  color tokens (`steel-gray`, `energy-orange`, `smoke-white`) to the
  modern hex palette (`#f17827ff`, `#d4d4d4`, `#1f1f1f`).
- `src/App.tsx` — added `/dev/ui-preview` route alongside
  `/dev/dashboard`.
- `CLAUDE.md` — rewrote Migration Policy section (per-feature
  incrementals) and Supabase Commands section (secure remote access
  procedure with secret-handling rules).
- `.claude/specifications/2025-10-22T14:01_design-style-guide.md` —
  appended "2026-04-22 Update" section documenting every new pattern.
- `.devcontainer/setup.sh` — installs `gh` CLI alongside supabase and
  vercel CLIs.

### Deleted Files

- `src/components/songs/NewSongModal.tsx` — orphaned. Had legacy blue
  accent and `console.log` placeholder submit. `EditSongModal` handles
  both add and edit modes.

## Database Changes

All packaged into one incremental migration
(`20260422220000_social_catalog_and_jam_sessions.sql`), already applied
to production:

**Tables added**

- `jam_sessions` — ephemeral sessions with short-code, view-token,
  settings JSONB for host catalog selection
- `jam_participants` — UNIQUE(session, user) with `shared_contexts`
  JSONB + active/left/kicked status
- `jam_song_matches` — pre-computed matches with canonical + display
  titles/artists and per-participant match detail

**Columns added**

- `users.account_tier` + `tier_updated_at` (free/pro, default free)
- `songs.normalized_title`, `songs.normalized_artist` (GENERATED STORED)
- `setlists.context_type`, `context_id`, `jam_session_id`, `tags`
- `setlists.band_id` made nullable

**Functions added**

- `normalize_text(input)` — title/artist normalization for matching
- `is_jam_participant(session, user)` — SECURITY DEFINER, prevents
  RLS recursion
- `are_jam_coparticipants(caller, song_owner)` — SECURITY DEFINER,
  used by cross-participant personal song visibility policy
- `replace_jam_matches(session_id, matches JSONB)` — atomic replacement
  called by jam-recompute edge function

**RLS policies — replaced** (old permissive → new scoped)

- Users: `users_select_authenticated` → `users_select_self` +
  `users_select_band_member` + `users_select_jam_coparticipant`
- Songs: band-only `*_only` variants split into `*_personal_*` (owner
  only) + `*_band_members` (band-scoped) + `songs_select_jam_coparticipant`
- Setlists: similar band/personal split
- Jam tables (jam_sessions, jam_participants, jam_song_matches): all
  new policies for select/insert/update/delete by host + participants

**Indexes added**

- `idx_songs_normalized` (normalized_title, normalized_artist)
- `idx_jam_sessions_host`, `_short_code`, `_status`, `_view_token`
  (partial WHERE NOT NULL)
- `idx_jam_participants_session`, `_user`
- `idx_jam_song_matches_session`, `_canonical`

**Realtime**

- `jam_sessions`, `jam_participants`, `jam_song_matches` added to
  `supabase_realtime` publication with `REPLICA IDENTITY FULL`

## Testing

- **Unit/integration:** 780/780 tests pass across 45 files. 6 new unit
  test files added during this feature
  (`useJamSession`, `usePersonalSetlists`, `usePersonalSongs`,
  `JamSessionService`, `songMatcher`, and a `db-direct-write` guardrail).
- **Database (pgTAP):** 488/488 tests pass across 13 files. New suite
  `013-jam-sessions.test.sql` added.
- **E2E:** 5 new Playwright specs (3 jam, personal-setlists,
  personal-songs) plus modifications to practices/session and
  reference-links specs.
- **Multi-user test harness:** `npm run harness -- <command>` exercises
  real RLS paths with alice/bob/carol personas.

## Breaking Changes

None at the API level. UI-facing changes:

- Practice session viewer is a full layout rewrite — previous
  single-column layout is gone. Keyboard shortcuts preserved
  (ArrowLeft/Right/Home/End/Escape) plus new scroll shortcuts.
- `EditSongModal` add mode no longer has a Band Notes field — notes get
  added from the song detail view after creation.
- Tuning dropdown now only offers 9 canonical labels; legacy stored
  variants (`"Standard (EADGBE)"`, etc.) still display via
  `canonicalTuningId()` normalization but will snap to the canonical
  label the next time the user edits.

## Infrastructure

- **Migration policy pivot:** pre-1.0 "modify baseline directly" →
  per-feature incremental migrations. Baseline (`20251106000000`) is
  frozen for production parity. Future schema changes go into new
  incremental files with `IF NOT EXISTS` / `DROP POLICY IF EXISTS` /
  exception-handler guards.
- **Supabase remote access:** documented secure procedure in `CLAUDE.md`
  — never dump env file contents; use length/prefix checks only; rewrite
  env files with heredocs rather than appending.
- **gh CLI:** added to devcontainer setup for PR + release management.

## Production deploys

Completed pre-merge (out of caution — schema changes applied first
to verify compatibility):

- ✅ Incremental migration applied to Supabase project
  `khzeuxxhigqcmrytsfux`
- ✅ Edge functions deployed: `jam-view`, `jam-recompute`
- ⏳ Frontend deploy pending merge (normal Vercel pipeline)

## Related

- **Depends on:** `persistent-layout` (completed), `audit-log-sync`
  (completed) — session page builds on those layout + sync patterns.
- **Enables:**
  - Custom tunings feature (registry structure already supports
    user-defined entries with color overrides — UI work pending)
  - Tier-limit enforcement for jam sessions (columns added, no enforcement
    yet)
  - Broader `<SectionCard>` adoption on BandMembersPage, SettingsPage,
    etc.
  - `<MarkdownField>` adoption on any future notes surface

## References

- `CHANGELOG.md` — [0.3.0] section with full bullet list
- `.claude/artifacts/2026-04-22T20:57_ui-unification-and-cleanup-assessment.md`
  — the design-of-record for the UI pass, with all approved patterns and
  palette decisions
- `.claude/specifications/2025-10-22T14:01_design-style-guide.md` —
  "2026-04-22 Update" section with component contracts
- `.claude/specifications/functionality-catalog.md` — index of app
  capabilities with test references
