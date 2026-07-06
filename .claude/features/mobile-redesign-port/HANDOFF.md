# Handoff prompt — continue the Rock On redesign

Copy everything in the fenced block below into a fresh agent. It is self-contained.

---

```
You are continuing a large, in-progress UI/feature redesign of the "rock-on" app
(React 18 + TypeScript + Vite + TailwindCSS front end; Supabase/Postgres with RLS;
offline-first via IndexedDB + a sync engine). Work happens on the branch
`feature/events-friends-and-ui-oh-my`. Do NOT create a new branch; commit to this one.

## 1. Read these first (in order), then start
- `CLAUDE.md` (repo root) — project rules: migration policy, testing policy, date/time
  helpers, "no native dialogs/scrollbars", the logger, testability (id + data-testid),
  repository-layer guardrails. Follow it exactly.
- `.claude/features/mobile-redesign-port/TASKLIST.md` — THE master task list: what's done,
  what's next, and per-item flags [SCHEMA]/[DECISION]/[UI]. This is your source of truth
  for scope + order. Keep it updated as you finish items.
- `.claude/features/mobile-redesign-port/2026-07-06T01:54_per-page-sync-tasklist.md` — the
  detailed per-page/per-fork breakdown ([STYLE] vs [LOGIC/DATA] vs [SCHEMA], regression risks).
- `.claude/features/mobile-redesign-port/2026-07-06T02:20_part2-progress.md` — fork-by-fork
  progress notes.

## 2. Operating rules (non-negotiable — the human set these explicitly)
- LOCAL ONLY, NEVER PROD. Never run `supabase db push --linked`, never deploy edge
  functions, never push the branch. Migrations apply to LOCAL supabase only and are held
  for the human's review before prod.
- ONE MIGRATION FILE PER FEATURE. Amend the feature's EXISTING migration in place (they are
  local-only, unshipped) — do not add new per-change files. After any schema edit run:
  `supabase db reset` → `npm run test:db` (pgTAP) → `npm run lint:migrations`. All must pass.
- SECURITY: every RLS/permission change gets reviewed by a DEDICATED security sub-agent that
  checks for RLS recursion loops (use SECURITY DEFINER helpers owned by postgres), over-
  permissive USING / missing WITH CHECK, service_role leakage, and cross-tenant exposure.
- NEGATIVE TESTS: for anything access-related, add pgTAP/e2e tests proving what SHOULD NOT
  happen (a user cannot read/edit another band's or user's data; denied actions stay denied).
- TESTS GREEN before AND after each commit: `npm run type-check`, `npm run test:unit`,
  `npm run lint`, targeted `npm run test:e2e`, `npm run test:db`. NEVER skip/delete a test to
  go green — fix the source; if a test is genuinely wrong, fix it to match intended behavior.
- Aim for SIMPLICITY and CLARITY; match existing code style; commit SMALL, tested increments.
- Surface UI in Playwright (screenshot) for the human's review; commit UI work for a.m. review.
- STOP and leave a note (don't guess) on any [DECISION] item — see §5. Do not change nav
  semantics, pick a canonical create surface, or reorder onboarding unilaterally.

## 3. Immediate next task — finish fork #2 (Custom tunings UI)
The DB layer + the song-form picker are DONE (see TASKLIST fork #2). Build the
**Settings › Tunings manager + create flow**, reusing what already exists:
- UI control: `src/components/common/Dropdown.tsx` — the C0 anchored dropdown (use it; NEVER
  a native <select>). Supports `groups`, `footerActions`, keyboard nav. Tests:
  `tests/unit/components/common/Dropdown.test.tsx`.
- Data: `src/utils/tunings.ts` — `BUILTIN_TUNINGS` (16 built-ins w/ MIDI pitches),
  `midiToNoteName(midi)` (flats), `canonicalTuningId` (mirrors the SQL slug — keep in lockstep).
- Model: `src/models/Tuning.ts` — `Tuning`, `NewCustomTuning`.
- Service (authenticated client only, NO service_role; RLS enforces tenancy):
  `src/services/TuningService.ts` — `getAllTunings()`, `getCustomTunings()`,
  `createCustomTuning(newTuning, { contextType, contextId, createdBy })`,
  `updateCustomTuning(id, patch)`, `deleteCustomTuning(id)`. Tests:
  `tests/unit/services/TuningService.test.ts`.
- Hook: `src/hooks/useTunings.ts` — `{ builtins, customs, loading, error, refetch }`.
- Wiring reference (how the picker was done): `src/components/songs/EditSongModal.tsx`
  (search "tuningGroups"/"handleTuningChange").
- Extend this page: `src/pages/SettingsPage.tsx` (add a "Tunings" section).
- DB (do NOT change unless a real gap): `supabase/migrations/20260704191222_tunings.sql`
  (table, RLS, `trg_tunings_lock_ownership`, `builtin_tuning_slug`, seed) +
  `supabase/tests/020-tunings.test.sql` (pgTAP, plan 31).

Build:
1. A "Tunings" section in Settings: list built-ins grouped by instrument (guitar/bass) shown
   with a LOCK (read-only) + their note string via `midiToNoteName` (octave omitted per spec,
   e.g. "E A D G B E"); list the user's customs with a kebab (edit / delete via ConfirmDialog).
2. A "Create custom tuning" flow (themed modal — no native dialogs): instrument segmented
   (Guitar/Bass) + string-count stepper (3–12) → N per-string note pickers PREFILLED from the
   matching standard in `BUILTIN_TUNINGS` (each picker a `Dropdown` of note names); name
   REQUIRED, color optional (swatch, neutral fallback). Save →
   `TuningService.createCustomTuning(newTuning, { contextType:'personal', contextId: <currentUserId>,
   createdBy: <currentUserId> })` (get the user id from `useAuth()`), then `refetch`.
   Built-ins are read-only (no delete offered; RLS also blocks it).
3. Add `footerActions` to the EditSongModal tuning `Dropdown`: "＋ New tuning" (opens the same
   create modal) and "Manage tunings" (navigate to Settings).
Verify: component tests (list renders; create calls the service with the right context; a
built-in offers no delete), `npm run type-check`, `npm run test:unit`, and a Playwright
screenshot (Settings tunings list + the create modal). Commit.

## 4. After that — work the queue top-down (TASKLIST §B and §C)
Only the items NOT marked [DECISION] until the human answers §5. Good non-blocked next items:
Setlist `BrowseSongsDrawer` desktop-dock/mobile-sheet; Event-create centered modal; the
song-notes 4-state notepad (#4). Then the [SCHEMA] forks (#3 source-filter `songs.hidden`,
#9 practice enrichment, #5 casting) — these are approved but each needs a migration (amend the
right feature file), a security review, and negative tests, per §2.

## 5. DECISIONS — ANSWERED (see `DECISIONS.md` top "RESOLVED — build directives" block)
All answered 2026-07-06. Read `.claude/features/mobile-redesign-port/DECISIONS.md` for the full
directives; also pull the two updated design rows via the design MCP (project
`019df065-4ee1-707b-bfd9-d821331f5cad`): `app/spec-rows/23 C2 - Create and edit model.html` (the
page-vs-modal convention) and `app/spec-rows/14 07 - Schedule a show.html`. Summary:
1. **Calendar-parent nav = YES (Option A).** Nest Shows/Practices/Events under Calendar,
   deep-link `/calendar?filter=…`; those lists become Calendar-filtered views; items are pages.
   Rewrite `tests/e2e/layout/persistent-layout.spec.ts`.
2. **Create/edit = ONE PAGE per entity (C2), NOT modals.** `ShowViewPage`/`PracticeViewPage` are
   canonical (`/new` + `/:id`, one component, inline-edit + autosave, Save only in new-mode,
   Delete only when it exists). **RETIRE `ScheduleShowModal` and `PracticeBuilderPage`.** Modals
   stay only for routeless sub-objects (song/contact/tuning) + confirmations.
3. **Onboarding = YES** — "Just me" first-class top option in `GetStartedPage` (`AuthPages.tsx`).
4. **Schema:** #3 source filter → a **`song_hidden` join table** (not a boolean); #5 casting →
   **yes** (hands-raised table + `events.allow_suggestions`/`auto_approve`); **#9 practice
   enrichment → NO** (keep only the two existing notes; no type/objectives/rating).

## 6. Dev environment + verification
- Start (if not running): `npm run start:dev` (local Supabase + edge functions + Vite on :5173).
- Quick login for Playwright: go to `/auth`, click "Show Mock Users for Testing" → "Eric".
- Context switcher lives in the sidebar/mobile brand chip (Personal ↔ band); it persists via
  `localStorage.rockon.context` and reloads to re-scope.
- Commit style: end messages with `Co-Authored-By: <your model line>`; keep commits small.
```

---

## File map (quick reference for the human)

**State / plan docs** (`.claude/features/mobile-redesign-port/`)

- `TASKLIST.md` — master checklist (start here)
- `2026-07-06T01:54_per-page-sync-tasklist.md` — detailed per-page deltas
- `2026-07-06T02:20_part2-progress.md` — fork-by-fork progress
- `2026-07-05T05:48_ui-consistency-orchestration.md` — Part 1 record

**Fork #2 (tunings) code already built**

- DB: `supabase/migrations/20260704191222_tunings.sql`, `supabase/tests/020-tunings.test.sql`
- App: `src/utils/tunings.ts`, `src/models/Tuning.ts`, `src/services/TuningService.ts`,
  `src/hooks/useTunings.ts`, `src/components/common/Dropdown.tsx`,
  `src/components/songs/EditSongModal.tsx` (picker wiring)
- Tests: `tests/unit/utils/tunings.test.ts`, `tests/unit/services/TuningService.test.ts`,
  `tests/unit/components/common/Dropdown.test.tsx`
- Extend next: `src/pages/SettingsPage.tsx`

**Context switching (fork #1) code**

- `src/contexts/AuthContext.tsx` (`setContext`, `contextType`, `rockon.context`),
  `src/components/layout/ContextSwitcher.tsx`, `Sidebar.tsx`, `MobileHeader.tsx`,
  `src/pages/SongsPage.tsx` + `SetlistsPage.tsx` (personal reactivity)

**Decision-blocked files** (see §5): `src/pages/ShowsPage.tsx`, `ShowViewPage.tsx`,
`PracticeBuilderPage.tsx`, `PracticeViewPage.tsx`, `AuthPages.tsx`,
`src/components/layout/Sidebar.tsx` + `src/pages/CalendarPage.tsx`,
`tests/e2e/layout/persistent-layout.spec.ts`
