# Rock On · app index

A map of the app: what each area does, its routes and where it lives. The code is the source of truth; this
page only points at it. Hard rules live in [DECISIONS.md](DECISIONS.md). Keep this page current when an area is
added, moved or removed. Routes are in `src/App.tsx`.

## App areas

**Shell and layout.** The persistent frame around every signed-in page. `ProtectedLayoutRoute` checks the
session (`hooks/useAuthCheck.ts`) and renders `ModernLayout`: desktop `Sidebar`, phone `MobileHeader` (app bar,
`BackCrumb`) and `PhoneDock` (bottom nav and a page's `DockAction`), `ContextSwitcher` (band / Personal), and
`OfflineBanner`. More: `/more` (`pages/MorePage.tsx`). Key files: `components/layout/*`,
`contexts/ThemeContext.tsx`, `contexts/SwitchPromptContext.tsx`, `hooks/useMyContexts.ts`. Kit primitives:
`components/ui/*`; older shared pieces: `components/common/*`.

**Home.** `/`. Next show and practice, upcoming items, Tools row, quick actions, recent activity, per context.
`pages/HomePage.tsx`, `components/tools/ToolsRow.tsx`.

**Search.** Global search scoped to the current context, with All contexts (Home on phones, ⌘K on desktop).
`components/search/SearchOverlay.tsx`, `hooks/useSearch.ts`, `services/api/search.ts`.

**Songs.** `/songs` (catalog: sort, view options, tuning filter, hidden songs, desktop preview pane),
`/songs/new` (Add song), `/songs/:songId?from=` (the song page: every field edits in place; Back follows the
origin). `pages/SongsPage.tsx`, `SongNewPage.tsx`, `SongViewPage.tsx`; `components/songs/*` (`SongLine` is the
one song row, `SongDetail`, `SongSheets`, `EditSongModal` for Add only, `SpotifySearch`), `components/notes/*`
(band note, My notes, practice log); hooks `useSongs`, `useSongCatalog`, `useSongOrigin`, `useNotes`,
`useHiddenSongs`; `services/api/songs.ts`; `domain/songs.ts`, `domain/sort.ts`. Spotify matches:
`services/spotify/`, `hooks/useSpotifySearch.ts`, edge function `spotify-search`.

**Chart.** `/songs/:songId/chart` (reader: paging, transpose, size, chord viewer, starting note, notes sheet),
`/songs/:songId/chart/edit` (editor: paste / ChordPro, lyrics and chords modes). `pages/ChartPage.tsx`,
`ChartEditPage.tsx`, `components/chart/*`; hooks `useChart`, `useChartSaver`, `useChartPrefs`,
`useLinkedChartCopy`; `services/api/charts.ts`; `domain/chordpro.ts`, `chartView.ts`, `chartEdit.ts`,
`chords.ts`.

**Setlists.** `/setlists` (index of cards), `/setlists/new`, `/setlists/:setlistId` (editor full width; saves as
you go; retune lines, breaks, sections, timeline, name switcher). `pages/SetlistsPage.tsx`,
`SetlistViewPage.tsx`, `components/setlists/*` (`SongBrowser` is the one Add songs picker), `hooks/useSetlists.ts`,
`services/api/setlists.ts`, `domain/setlist.ts`.

**Calendar, shows, practices.** `/calendar` (agenda, All · Shows · Practices · Jams filters; `/shows` and
`/practices` redirect here), `/shows/new`, `/shows/:showId` (show page, edit in place, set copy),
`/practices/new`, `/practices/:practiceId` (practice page, edit in place), `/practices/:practiceId/session`
(stage screen). `pages/CalendarPage.tsx`, `ShowViewPage.tsx`, `PracticeViewPage.tsx`, `PracticeSessionPage.tsx`,
`components/calendar/*`; hooks `useCalendar`, `useShows`, `usePractices`, `useWakeLock`,
`useStageKeys`; `services/api/calendar.ts`; `domain/calendar.ts`. `ShowsPage.tsx` is the old list, behind the
`REDESIGN_CALENDAR` flag (`config/featureFlags.ts`).

**Tools.** `/tools`, `/tools/:tab` (Tuner · Metronome · Chords); retune lines and Tune buttons link in
(`domain/toolsLink.ts`); the practice session opens tools in place as a layer (`ToolLayer`). `pages/ToolsPage.tsx`, `components/tools/*`,
custom tunings in `components/tunings/*`; hooks `useTuner`, `useTunings`; audio in `services/audio/*` (shared
`AudioContext`, metronome scheduler, synth, pitch worklet); `domain/tuner.ts`, `pitch.ts`, `metronome.ts`,
`pluck.ts`, `tuningEdit.ts`; `utils/tunings.ts` (colours), `utils/toolsMemory.ts` (per-device memory);
`services/api/tunings.ts`. Dev harness: `/dev/audio-harness`.

**Band.** `/band` (band card, invite card, members and roles, transfer, leave, delete), `/band/profile` (mark,
city, genres, links), `/band/new` (create), `/j/:code` and `/j` (join preview by code). `pages/BandPage.tsx`,
`BandProfilePage.tsx`, `BandNewPage.tsx`, `JoinBandPage.tsx`, `components/band/*`, `components/ui/BandMark.tsx`;
hooks `useBands`, `useBandAdmin`; `services/api/bands.ts`; `domain/invites.ts`, `domain/marks.ts`.

**Friends.** `/friends` (requests, friends, sent; add by name or friend code; privacy). `pages/FriendsPage.tsx`,
`components/friends/*`, `hooks/useFriends.ts`, `services/api/friends.ts`.

**Settings and delete account.** `/settings`, `/settings/:section` (Appearance, Profile with ordered
instruments, Tunings, Music, Notifications, Account incl. change password, About, Delete account).
`pages/SettingsPage.tsx`, `components/settings/*` (`DeleteAccount.tsx`), `hooks/useAccount.ts`,
`services/api/account.ts`, `services/api/preferences.ts`. Delete account calls the `delete-account` edge function.

**Auth.** Public routes `/auth` (sign in), `/auth/signup`, `/auth/forgot`, `/auth/reset`, `/auth/callback`,
`/get-started`, `/get-started/jam`, `/terms`, `/privacy`. `pages/auth/*`, `pages/LegalPage.tsx`,
`contexts/AuthContext.tsx`, `services/auth/*` (`SupabaseAuthService`), `hooks/useAuthCheck.ts`,
`utils/returnTo.ts`. The Supabase session is the single source of truth (CLAUDE.md → Auth flow).

**Notifications.** Bell popout and `/notifications` (Activity and App updates streams; "what's new" from
`release_notes` vs `users.last_seen_release_version`). `pages/NotificationsPage.tsx`,
`components/notifications/*`, `hooks/useNotifications.ts`, `services/api/notifications.ts`,
`domain/notifications.ts`.

**Jam.** Hub `/jam` (hosting, invited, friends' jams), `/jam/new`, the jam `/jam/:id` (planned: lineup,
requests, people, Grid view, settings; live: Tonight; ended: Save tonight as a setlist), host console
`/jam/:id/live`, Jam songs builder `/jam/songs`. Public: `/j/:code` (resolves a band invite or a jam; web guest
without an account), bar TV `/j/:code/tv`, counter iPad `/kiosk`. `pages/jam/*`, `components/jams/*` (`live/`
console + Tonight, `guest/` web guest / TV / kiosk), `hooks/useJam.ts` (jam*state + realtime `jam:<code>`),
`services/api/jams.ts`. Data: the Events tables (`events`, `event_participants`, `event_lineup_items`,
`event_hands`, `event_guest_tokens`, `event_kiosk_pairings`, `jam_rate_limits`); RPCs and the anonymous
surface in `supabase/migrations/20261121120000_redesign_phase_7.sql`. The 0.3 `jam*\*` tables remain unused
until a later release drops them.

## Data layer

- **Calls:** `services/api/<area>.ts`, one thin typed function per operation (RPC or table call), errors mapped
  to `ApiError { key, message }` in `services/api/errors.ts`. Older areas still go through `repository`
  (`services/data/RepositoryFactory.ts` → `RemoteRepository.ts`, implementing `IDataRepository.ts`) and the
  `services/*Service.ts` classes. Supabase client: `services/supabase/client.ts`.
- **Cache:** TanStack Query; client and the central `queryKeys` in `services/queryClient.ts`. Reference hook:
  `hooks/useSongs.ts`.
- **Live updates:** `services/data/RealtimeManager.ts` listens to `audit_log` and emits `{entity}:changed`;
  `hooks/useRealtimeInvalidate.ts` turns those into query invalidations. A table needs an audit trigger to
  produce live updates.
- **Pure logic:** `src/domain/*` (no I/O, unit-tested, portable to Dart). Models: `src/models/*`. Date helpers:
  `utils/dateHelpers.ts`. Logger: `utils/logger.ts`.

## Database

- **The schema is the migrations + `src/types/database.types.ts`** (regenerate with `just types`; inspect the
  local DB with `\d <table>`). Migrations: `supabase/migrations/` (frozen baseline
  `20251106000000_baseline_schema.sql`, then one incremental file per feature or phase; `archive/` is pre-baseline
  history). Seed: `supabase/seed-mvp-data.sql`, `src/database/seedCatalog.ts`, `scripts/generateSeedSQL.ts`.
- **pgTAP:** `supabase/tests/*.test.sql` (contract tests for every RPC; `000-setup-test-helpers.sql` first).
- **Gates:** `npm run lint:migrations` (`scripts/lint-migrations.mjs`, grants on every new table),
  `npm run test:db`.

## Edge functions

`supabase/functions/<name>/index.ts` (`delete-account`, `spotify-search`; shared code
in `_shared/`). The `AUTH_MODE` map in `scripts/deploy-edge-functions.sh` is the record of each function's auth
mode and role context; `scripts/smoke-edge-functions.sh` holds the expected unauthenticated status. Deploy and
smoke only through those scripts.

## Tests

`tests/README.md` is the single source for commands and layout. `tests/unit/` mirrors `src/` (Vitest),
`tests/integration/`, `tests/e2e/<area>/` (Playwright, needs the stack up), `tests/fixtures/`,
`tests/helpers/`. pgTAP lives in `supabase/tests/`.

## Scripts and just

- `justfile`: `just dev`, `setup`, `up` / `down`, `reset`, `types`, `studio`, `lint`, `type-check`, `test`,
  `test-quick`, `check`, `build`, `test-db`, `test-e2e`. Node runs in `node:24-alpine`.
- `scripts/`: `start-dev.sh` / `start-test.sh` / `start-staging.sh` (stack start), `setup-local-env.sh`,
  `env-setup.sh`, `deploy-edge-functions.sh`, `smoke-edge-functions.sh`, `check-release-metadata.mjs` and
  `check-release-tag.mjs` (release gate, `.github/workflows/release-metadata.yml`), `lint-migrations.mjs`,
  `prod-db.sh`, `test-harness/` (CLI personas against a stack).

## Design

`design/`: the clickable prototypes (`demo/`), the kit and locked design decisions (`source/`, incl.
`source/DECISIONS.md`, the design team's record), the server contract (`OPERATIONS.md`) and web vs native notes
(`PLATFORM-NOTES.md`). Reference, not code.

## Docs

- `CLAUDE.md`: coding rules and project policy.
- `docs/DECISIONS.md`: hard product and technical rules, dated, with why.
- `docs/INDEX.md`: this map.
- `docs/DEVELOPMENT.md`: how we build (research → plan → implement → release).
- `docs/LOCAL_DEV.md`: running the stack locally. `ENVIRONMENTS.md`: environments.
- `tests/README.md`: test commands and layout.
- `CHANGELOG.md`: release history.
- `docs/redesign/`: the redesign guide, in use until Phase 7 ships (`11-jam.md` is the Jam brief;
  `LAUNCH-TODO.md` lists manual hosted-project steps).
- `.claude/backlog/`: future ideas. `.claude/agents/`, `.claude/commands/`, `.claude/process/`: agent workflow.
