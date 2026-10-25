# Changelog

All notable changes to Rock-On will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.1] - 2026-09-19

Calendar item duplication. Any show or practice can be cloned from its calendar
row as a starting point for a new one — copying the reusable template parts
(venue/logistics, setlist, songs, invitees) while resetting instance-specific
state (date, status, progress). Also a logging cleanup pass and fixes for
Phase 2 regressions found in end-to-end testing.

### Added

- **Duplicate shows & practices from the calendar.** Each calendar row now has a
  kebab menu (Open / Duplicate / Delete) for shows and practices; the card itself
  still click-opens the detail page.
- **Reusable `DuplicateModal`.** Prefilled, editable scalar fields (name, date,
  venue, duration, etc.) plus read-only summaries of the collections that carry
  over. The new date is required and defaults to today.
- **`ShowService.duplicateShow` / `useDuplicateShow`.** Copies venue, logistics,
  and contacts (with fresh ids), and forks the chosen setlist into a new
  owned copy (defaults to the source show's setlist; may pick another or none) so
  every show still owns a unique setlist. Resets status, dates, and audit fields.

### Changed

- **`PracticeSessionService.duplicateSession` reworked** — the new date now
  defaults to the source's date (was +1 week) and accepts editable overrides
  (type, duration, location, notes). Songs copy over with progress reset and
  invitees copy with RSVP reset.
- **Logging cleanup.** All `console.*` calls now go through the
  environment-aware logger (errors only in production), and ESLint `no-console`
  enforces it. Early troubleshooting traces were removed — including several that
  dumped tokens, invite codes or full user/band objects — and `RemoteRepository.addSong`
  no longer makes a debug-only `auth.getUser()` round trip.
- Removed leftover IndexedDB/sync wording from the Settings page, startup logs,
  comments and `CLAUDE.md`.
- **Local dev works from any machine on the LAN.** On the Vite dev server the
  app now calls local Supabase on the host the page was opened from (port 54321) instead of a baked-in `localhost`, so opening it from a desktop or
  phone just works. This replaces the `HOST_IP` / nginx phone-testing mode.
  Production builds are unchanged.

### Security

- **Other users' emails are no longer readable.** Row-level security let anyone
  who could see a `users` row — bandmates, and jam or event co-participants —
  read its `email`, `last_login` and `last_active_at`. Those columns are no
  longer selectable by clients. Emails come from `get_user_emails()`, which
  returns your own email and, for band admins/owners only, their bandmates'.
  The band roster shows emails to admins only, and member rows are keyed by user
  id instead of email.
- **Jam sessions can't be discovered or joined without the code.** Any signed-in
  user could list every active jam (the code was only checked in the browser)
  and add themselves as a participant. Lookup and join now go through
  `get_jam_session_by_code()` / `join_jam_session()`, which require the exact
  code and an active, unexpired session. Kicked participants stay kicked.

### Fixed

- **Infinite render loop on Songs and Band Members** ("Maximum update depth
  exceeded"). The TanStack hooks returned a fresh `[]` every render while data
  was loading, re-triggering page effects that set state; they now share a
  stable `EMPTY_ARRAY`.
- **Shows page refetched setlists in an endless loop.** `useUpcomingShows` /
  `useUpcomingPractices` rebuilt their upcoming/past arrays every render; now
  memoized.
- **Mirrored songs lost their link to the band song** (no chain icon, "Copy to
  My Songs" not marked as copied, no source-band label). `linkedFromSongId` was
  only ever stored in the removed IndexedDB mirror; it's now a Supabase column.
- Single-row lookups that find nothing (e.g. a song with no personal note) no
  longer log a 406 network error — they use `maybeSingle()`.
- **Sign Out no longer hard-reloads the page.** The route guard never reacted to
  `logout()`, so it fell into its "valid session but no user" recovery path and
  called `window.location.reload()`. `useAuthCheck` now handles `auth-logout`.
- **"You were signed out" redirect was intermittently lost** when a session
  expired: a remount of the route guard re-checked after the stale ids were
  cleared and downgraded `signed-out` to `no-user`. A per-tab marker keeps it.
- **Band-less users can't open the practice builder** — `/practices/new` shows
  the create/join-a-band prompt again (the guard was lost when the standalone
  practices list was retired in 0.5.0).
- **Fewer Supabase round trips on Band Members and Setlists.** Band members
  now load with their user + profile in one embedded query instead of 1 + 2 per
  member, and setlist pages fetch all referenced songs in one `id IN (...)`
  query instead of one per item (and reuse the already-loaded shows). Measured
  on the seed band: Band Members 13 → 7 requests, Setlists 95 → 17.

### Tests

- Practice e2e specs repointed from the retired `/practices` list to the
  calendar agenda and its row menu; page-inventory and band-less specs updated.
- Sign-out-while-navigating specs tolerate the SDK redirecting before the click.

### Removed

- Console troubleshooting helpers: `window.debugRealtime()` (+
  `RealtimeManager.getDiagnostics`), the auto-loaded `testSupabaseConnection`
  self-test, and the unused `envCheck`.

### Database

- **`privacy_lockdown` migration** — column-level `SELECT` on `users`;
  `get_user_emails`, `get_jam_session_by_code`, `join_jam_session` RPCs; drops
  `jam_sessions_select_by_code` and `jam_participants_insert_self` (replaced by
  host-only `jam_participants_insert_host_self`); adds
  `user_profiles_select_band_member` so bandmates see each other's profiles even
  when not discoverable.

- **`songs.linked_from_song_id`** (UUID, FK `songs(id)` ON DELETE SET NULL),
  added to the not-yet-deployed `extend_audit_triggers` migration. Covered by
  pgTAP (`026-song-linked-from`). Songs mirrored before this release can't be
  re-linked (the link was never stored server-side).
- **v0.6.1 `release_notes` row**, folded into the not-yet-deployed
  `extend_audit_triggers` migration and stamped after 0.6.0 (the in-app "what's
  new" shows only the newest note, so it also summarizes 0.6.0).

## [0.6.0] - 2026-09-15

Phase 2 data-layer simplification: the web client is now a naive online Supabase
client. The on-device IndexedDB (Dexie) mirror and the background sync engine are
gone; reads/writes go straight to Supabase, with TanStack Query as an ephemeral
in-memory cache and the `audit_log` change-feed (Supabase Realtime) as the single
freshness push. Net removal of several thousand lines.

### Changed

- **All data access now routes through `RemoteRepository` (direct Supabase).**
  `RepositoryFactory` returns the remote repository; every page, hook, and service
  reads/writes via `repository.*` instead of `db.*` (Dexie).
- **`AuthContext` bootstrap is cloud-first.** Login no longer performs a blocking
  initial sync or populates a local cache; user/profile/band/membership reads come
  straight from Supabase.
- **Auth services (`SupabaseAuthService`, `MockAuthService`) no longer write to
  Dexie.** `MockAuthService` uses an in-memory store; `SupabaseAuthService` only
  provisions the Supabase `users` row.
- **`RealtimeManager` slimmed to a pure change-notifier** — it emits
  `{entity}:changed` events + batched toasts from `audit_log`, and no longer maps
  audit rows back into a local database.
- **"Clear local data" (Settings) now clears the TanStack Query cache** instead of
  deleting an IndexedDB database.

### Removed

- **Dexie/sync layer:** `SyncEngine`, `SyncRepository`, `LocalRepository`, the
  Dexie schema (`services/database`), seed modules, `auditMappers`, `debugSync`,
  `resetDatabase`, and the `dexie` / `dexie-react-hooks` / `fake-indexeddb`
  dependencies.
- **Sync UI:** the sync-conflict modal + `useSyncConflicts` (conflicts can't occur
  without a sync queue); the `DevDashboard` (Dexie inspector / sync-queue viewer)
  and its `mermaid` dependency.
- **Orphaned pre-repository services:** `DatabaseService`, `SyncService`,
  `InitialSetupService`, `CastingSuggestionService`, `MemberCapabilityService`,
  the shelved `CastingService`, and dead `BandService`/`SongService` methods.

### Database

- **`extend_audit_triggers` migration** — adds `audit_log` triggers for `bands`,
  `band_memberships`, `song_castings`, `song_assignments`, and
  `member_capabilities` so their changes reach the realtime change-feed (the web
  client's only push channel). Extends `log_audit_trail()` band_id derivation for
  the new tables. Covered by pgTAP (`025-extended-audit-logging`).

## [0.5.0] - 2026-09-13

Database & session simplification plus calendar/practice quality-of-life fixes,
and a developer-experience pass (containerized workflow, `just` recipes, local
dev guide).

### Added

- **`just` recipes + `docs/LOCAL_DEV.md`** — one-command local dev/test/build via
  a containerized workflow (Node 24 in Docker), so the app and all gates run in a
  reproducible environment regardless of host Node.
- **`getPracticeSessionStatus` shared helper** (`utils/dateHelpers`) — the single
  source of truth for practice status, used by both the calendar filter and the
  detail page.
- **`.claude/tasks/` agent task-file queue** — self-contained, ready-to-execute
  work items (seeded with the practice e2e-spec rework).

### Changed

- **Session management now uses the Supabase SDK as the single source of truth.**
  Removed the bespoke `SessionManager` localStorage session mirror and the
  `SessionExpiredModal`; auth guards read the SDK session plus in-memory auth
  state, with clearer "signed out due to inactivity" messaging instead of the
  blanket "session invalid".
- **Standardized on Node 24** across Dockerfile, docker-compose, CI,
  devcontainer, `.nvmrc`, and `package.json` engines.

### Fixed

- **Practices stay in "upcoming" through their whole window.** The calendar
  agenda now categorizes upcoming-vs-past by an item's effective end
  (start + duration for practices), not its start time, so a practice that has
  begun but not ended no longer jumps to history.
- **Practices no longer default to a "cancelled" status.** `cancelled` is now
  only ever a user-set status; a past, never-started practice reads as
  "completed" instead of being auto-marked cancelled (fixed in both the service
  and the detail page, which had drifted copies of the logic).
- **Retired the orphaned `/practices` list page.** The route now redirects to the
  canonical `/calendar?filter=practices` agenda (the reachable surface since the
  calendar consolidation); the create/detail/session routes are unchanged.

### Database

- `20260913175153_release_notes_0_5_0.sql` — idempotent `release_notes` upsert
  for 0.5.0 (drives the in-app "what's new" notification). Data-only; no schema
  change.

## [0.4.5] - 2026-07-23

Production hotfixes: existing members locked out of onboarding, an
unrecoverable signed-in-but-empty state, and a friend re-add dead-end.

### Fixed

- **Existing band members are no longer forced into new-user onboarding.**
  Returning members (especially on a fresh browser/device) were routed to the
  "join solo / join a band" screen, and entering their band code errored
  "already a member" — a dead end that locked the whole band out. Root cause:
  `AuthContext.loadUserData` resolved membership from the local IndexedDB cache
  only, which is empty for users whose stale `last_full_sync` skipped the
  initial sync; the guard then downgraded a valid member to Personal and wiped
  their `currentBandId`. It now falls back to a cloud-first membership read
  (the same source the join-code path trusts) and never discards a persisted
  band context on an unresolved/cold cache.
- **Signing out always works, even on a degraded network.** `signOut` now
  clears local session state first and unconditionally, then attempts the
  network sign-out under a bounded timeout. Previously a hung
  `supabase.auth.signOut()` could trap a user on a broken/empty screen with no
  way out but purging the browser cache.
- **Re-adding a friend works after unfriending.** Removing a friend and adding
  them again no longer errors "you're already friends". Unfriend now clears the
  stale `accepted` friend-request row (via an `AFTER DELETE` trigger on
  `friendships`), and the send path self-heals any orphaned `accepted` rows
  left by earlier builds.

### Database

- `20260723051100_friendship_unfriend_cleanup.sql` — `AFTER DELETE ON
friendships` trigger that clears the paired `friend_requests` row(s); one-time
  cleanup of orphaned `accepted` rows; `release_notes` upsert for 0.4.5. No new
  tables or grants.

### Notes

- A deeper auth-guard hardening (fail-closed against the real Supabase session
  to close the remaining unauthenticated-access window, plus a recovery screen
  for the signed-in-but-unhydrated state) is scoped as a reviewed follow-up —
  see `.claude/features/production-auth-onboarding-fixes/`.

## [0.4.4] - 2026-07-10

Events-page mobile polish + a casting-flow cleanup. No schema changes.

### Fixed

- **Events page no longer overflows horizontally on mobile.** The tab row's
  host-only "Invite friends" button pushed the page wider than the viewport
  (~100px of dead white space, content appearing to hang off the side). The tab
  strip now scrolls within its own bounds and the invite control collapses to an
  icon on narrow screens; the page can no longer exceed the viewport width.
- **Lineup drag reorder is a clean vertical swap.** Rows could be dragged
  sideways off the grid and downward past the list (growing the page scroll);
  drag is now constrained to the vertical axis and clamped to the list, and is
  disabled entirely when there's only one song. Applies to both the list and
  grid views.

### Changed

- **One shared cast-assign sheet for both the list and grid views** — a side
  tray on desktop, a bottom-sheet on mobile (so a role near the screen bottom is
  never hidden behind the nav bar). Assigning keeps the sheet open for quick
  multi-casting, **"Currently cast" sits at the top**, and the roster is one flat
  list with _you_ included and flagged by a small "You" pill (the old redundant,
  heavily-highlighted "You" section is gone).
- **Roomier, less-cluttered lineup rows.** The per-row kebab is gone — manager
  **Edit / Remove** now live in the expanded card panel; the cast count and
  casting icons are evenly spaced; the grid's song-title column is wider and the
  box padding tighter to use more width on mobile.
- **Bigger finger targets across the events UI.** Kebab menus get a comfortable
  40px hit area on touch devices, and the cast controls/rows have more breathing
  room. (Touch enlargements are gated to coarse pointers, so desktop density is
  unchanged.)

## [0.4.3] - 2026-07-09

Event-ops, co-hosts, and a broad casting/UX polish pass on top of the 0.4
events/friends launch. **One** incremental migration
(`20260709064907_0.4_event_ops_patch`) — additive columns + one trigger + one
RLS-policy narrowing; no new tables. Implementation notes:
`.claude/completed/0.4-small-patch/SUMMARY.md`.

### Added

- **Co-hosts** — the host can promote a participant to co-host (and revoke) from the
  event **People** tab. Co-hosts can cast + approve requests (via `is_event_manager`);
  they **cannot alter or delete the event** (events UPDATE narrowed to host-only).
- **Per-song tuning & key** in the event lineup — the host sets them in the add/edit
  tray; shown on lineup cards and in the grid's song column.
- **Pre-raise hand on request** — a song request can carry optional "I'd play" parts;
  approving it adds the song **and** raises the requester's hands.
- **Host adds a song directly** to the lineup (no request round-trip); **reorder, edit,
  and remove** lineup songs; **remove participant / leave event**.
- **Home "Upcoming events"** card; Home "Add song" now opens the add-song modal
  (`/songs?add`).
- **Grid casting for guests** — tap an open cell to raise/withdraw a hand; a "You're on"
  row highlight and "You"-first cast pickers.

### Changed

- **Consistent activity headers** — shared `ScheduleMetaRow` for date/time/location;
  events edit **inline** (no separate edit page); shared page width; a unified
  `BackLink` (simple arrow above the header) across all detail pages.
- **Event create is a full page** (not a modal); no fields auto-open on create.
- Calendar **"+ New" is filter-aware**; the event **status pill removed** (Cancelled-only)
  everywhere (Calendar + Events list + detail).
- **Friends** — name search is the primary field; **add-by-code moved into a modal**.
- Roomier, mobile-first casting panel + grid; simplified cast panel (removed the
  progress bar and the Simple/Detailed toggle).

### Fixed

- **Signup** — a "check your email" flow instead of a false "account created but no
  session" error when email confirmation is on.
- **Event join code preserved through auth** (`returnTo`, incl. across the emailed
  confirmation link) so a shared `?join=CODE` survives signup/login.
- **Band member removal now persists** — it wrote `status:'inactive'` to local storage
  only, so the cloud-first members list re-added the member; removal now syncs to
  Supabase before the list refetches.
- **Practices can set a Location** — the shared schedule header hid the location field
  when empty, so it could never be filled (the field is labelled "Location" for
  practices, "venue" elsewhere).
- **Deleting your only song no longer brings it back** — an empty local cache tripped a
  recovery read that re-fetched the not-yet-deleted row; delete now removes the remote
  row first.
- **Add Song modal closes cleanly** — a background tuning lookup falsely marked an
  untouched modal "dirty", popping a spurious unsaved-changes prompt on close.

### Tests

- Re-enabled and stabilized the Playwright e2e suite (it had been skipped through the
  0.4 launch): fixed stale selectors/testids from the UI redesign and added stable
  `data-testid`s where elements lacked them. Added coverage for the friends
  (request → accept) and events (create + join-by-code) workflows. Run in small batches
  with `--workers=2` — the default worker count overwhelms the dev container.

### Database

- `20260709064907_0.4_event_ops_patch.sql` — `event_lineup_requests.parts`;
  `event_lineup_items.tuning` + `.key`; `on_event_request_approved` extended to
  pre-raise hands on approve; **events UPDATE policy → host-only** (`events_update_host`,
  co-hosts can't alter the event). pgTAP: `023-request-pre-raise-hands` (8),
  `024-event-cohost-permissions` (6). Applied to production 2026-07-09.

## [0.4.2] - 2026-07-08

Same-day hotfix to the 0.4 events/friends launch (PR #17). No database changes.

### Fixed

- **Friends** — resolve real member names + search-by-name (previously showed
  "Someone" / empty results).
- **Events** — surface the **join-by-code** input on the Calendar → Events view.

## [0.4.1] - 2026-07-08

Same-day hotfix to the 0.4 events/friends launch (PR #16).

### Added

- **Drop Db** built-in tuning; the tuning picker is reordered (Standard · Eb · Drop D ·
  Drop Db · then the rest) and hides bass tunings; song tuning chips are unified via a
  reusable `TuningTag`.

### Fixed

- **Events — join by code** works for a logged-in user (Events-page input + auto-join
  from a shared `?join=CODE` link; previously only signup could use a code).
- **Friends — share code is self-provisioning** (`ensure_friend_code` RPC + column
  default + backfill), fixing a blank friend code with no way to generate one.

### Database

- `event_code_join`, `tunings`, `song_hidden` migrations (additive; applied to
  production 2026-07-08).

## [0.4.0] - 2026-07-08

Mobile-redesign port + the social/event layer. A large release: 72 commits,
~195 files. The design source of truth is the Claude Design "Rock On" project;
implementation notes live in `.claude/completed/mobile-redesign-port/SUMMARY.md`.

### Added

- **Design-system overhaul** — unified design tokens across every page, a 5-tab
  bottom nav, and new Notifications / Friends / Events surfaces.
- **Context switching** — GitHub-style Personal ↔ band switcher (persisted); Songs
  and Setlists are personal-capable in Personal context.
- **Band-less user flow** — personal accounts with no band required, event-code join
  at signup, band-only empty states, and an upgrade path. Onboarding leads with a
  first-class "Just me" solo path.
- **Events** — host/guest event model: create (centered modal on desktop), a
  2-column Lineup **card grid**, a casting console with **List** (per-song panel) and
  **Grid** (songs × instruments matrix) views, guest **raise-a-hand** → host
  accept/decline, song **requests → approve** (auto-links to the band catalog when it
  matches), People roster, an **Access** tab (visibility / join code / QR / toggles),
  **Invite friends**, and **"N going · X% cast"** stats + RSVP badges on list cards.
- **Casting (v1)** — fixed instrument set for personal events
  (guitar/bass/drums/vox/keys/other), a shared casting model (events → jam → bands),
  free-text casts, and a **Detailed** view (backups + confidence).
- **Friends** — code/QR-based connections with **find-by-name search** of discoverable
  people, add-by-code, incoming/sent requests (re-sendable after decline), a
  "who can add you" policy, and a shared-bands count.
- **Custom tunings** — a Settings tunings manager + create flow and a song-form tuning
  picker (writes `tuning_id`). _(Drop Db built-in + picker order + `TuningTag`
  unification landed in 0.4.1.)_
- **Songs** — **Hide / Re-add** from the catalog (`song_hidden`), a catalog
  **provenance tag** + **Source filter**, and a 4-state song-notes indicator.
- **Notifications** — cross-context feed with a "from ‹Band›" chip when an item is from
  another context.
- **Desktop layouts** — two-pane / master-detail for Songs, Setlists, Home, Friends,
  Events, plus a Settings left-nav with scroll-spy.
- **Calendar-parent IA** — Shows / Practices / Events nest under Calendar with
  `?filter=` deep-links, plus history-aware back navigation.

### Changed

- **One control surface per entity** — `Show` / `Practice` / `Event` / `Setlist` each
  have a single page that is create + view + edit (retired `ScheduleShowModal` and
  `PracticeBuilderPage` as edit surfaces).
- **All native `<select>`s migrated** to the themed C0 `<Dropdown>`.
- **Date/time pickers** de-finicked (single-click open, type-ahead, dark-themed native
  inputs, no duplicate icons).
- Setlist builder's BrowseSongsDrawer is responsive (bottom-sheet on mobile, side panel
  on desktop).

### Fixed

- **Realtime** — live hands / casts / participants / lineup requests (no
  leave-and-return); re-raisable hands after withdraw; band-change toasts restored
  (songs/setlists/shows, batched); re-sendable friend requests after decline/cancel.
- **UI** — toggle knob overflow (off looked on; on slid outside the pill).

_(Join-by-code for logged-in users + self-provisioning friend codes landed in 0.4.1;
friends real-name resolution + join-by-code on the Calendar view landed in 0.4.2.)_

### Removed

- **Dead-code sweep** — 14 orphaned components (~5.4k LOC): legacy casting chain
  (`SetlistCastingView`/`SongCastingEditor`/`MemberRoleSelector`/`CastingComparison`),
  legacy setlist builder (`SetlistBuilder`/`ShadowEntry`), orphaned auth forms
  (`LoginForm`/`SignupForm`/`JoinBandForm`/`BandCreationForm`), and
  `SongContextTabs`/`SessionForm`/`EditableField`/`PracticeBuilderPage`.

### Database

Five incremental migrations — `notifications`, `friends`, `events`, `casting`,
`social_events` — all **additive**
(new tables + nullable/defaulted columns; no `DROP`/`DELETE`/`TRUNCATE`/type-change
statements, so no data loss). **Applied to production 2026-07-08** (backed up first;
`Local == Remote` verified). pgTAP coverage: 958 tests across 23 files, all passing.

### Known issues

- Duplicate free-text casts on one part are not de-duplicated (roster only; counts
  unaffected) — see `.claude/artifacts/2026-07-08T01:50_v0.4.0-finalize-review.md`.
- Event casting and Friends ship with thin e2e coverage; several multi-user/realtime
  e2e specs are flaky. Prioritized spec list in the same review doc.

## [0.3.3] - 2026-04-25

### Fixed

- **Jam share — QR code had no in-place dismiss affordance.** The
  Share popover closes on outside click (which fires the moment a
  user moves their attention to the QR), so the popover's own
  Show / Hide toggle became unreachable without re-opening Share.
  Added a dedicated "Hide QR" button beneath the QR image so the
  dismissal affordance is always reachable while the QR is on
  screen, regardless of the popover's open state.
  - Testid: `jam-hide-qr-button`

## [0.3.2] - 2026-04-25

### Anonymous jam-view rebuild + jam UX overhaul

The v0.3.1 hotfix unblocked the jam feature in production but left the
anonymous viewer experience in poor shape (per the v0.3.1 post-mortem):
guests landed on a "Common Songs" list they couldn't contribute to, never
saw the host's actual setlist, and the host page itself felt like a
crowded dashboard on mobile. v0.3.2 rebuilds the anon view around its
real product intent and tightens the host page accordingly.

**No database changes.** No migrations, no schema changes, no RLS
changes. Anonymous-viewer presence is implemented entirely on Supabase
Realtime presence channels, which run in-memory at the realtime server
and don't persist to Postgres. Edge-function `jam-view` ships a new
response shape and must be redeployed.

### Added

- **Anonymous viewer presence (Supabase Realtime)** — guests on the
  `/jam/view/<code>` page can introduce themselves with a name and
  show up live in the host's "Watching" sidebar. Implementation uses
  presence channels (in-memory at the Realtime server, no DB writes,
  auto-cleanup on disconnect) so anonymous clients are first-class
  participants without needing auth or a watcher table.
  - `src/hooks/useJamPresence.ts` — shared presence hook with watcher
    - listener modes
  - `src/components/jam/JamWatcherList.tsx` — host-side watcher list
    with eye icon
  - Channel key `jam:presence:<shortCode>`. Per-tab key in
    sessionStorage so refreshes rejoin with a fresh entry and
    multiple tabs on the same device all show up individually.
- **End Session flow on the host page** — host can deliberately end an
  active jam from a kebab menu item. If there's a curated setlist /
  queue / matches, the dialog offers Save & End / End without saving /
  Cancel; on an empty session the dialog collapses to End / Cancel.
  `JamSessionService.expireSession` (status='expired') is the
  underlying transition; status='saved' (terminal alongside
  'expired') is the alternate path when Save & End is chosen.
- **Live-update polling on the anonymous view** — the page polls the
  edge function every 5s and shows a visible "Live · updated Ns ago"
  indicator next to the session title. Cache-buster query param +
  `cache: 'no-store'` ensures no intermediate cache returns stale
  setlist data.
- **Idempotent save-as-setlist** — clicking Save twice (or retrying
  after a previous failed attempt) returns the existing setlist
  rather than creating a duplicate. Reconciliation branch flips the
  session status to 'saved' if a prior attempt orphaned the link.
- **Compensating rollback on save failure** — if `updateJamSession`
  fails after `addSetlist` succeeded, the new setlist is deleted to
  prevent orphan zombie rows in the user's personal setlists.
- **`SyncEngine.flushPendingWrites()`** — new public method that
  awaits any in-flight sync and then pushes the pending queue. Used
  by `JamSessionService.saveAsSetlist` to guarantee a setlist row
  has reached Supabase before the FK-bearing `jam_sessions` update
  runs.
- **`KebabMenu` items support `data-testid`** — stable E2E selectors
  for individual menu items across the whole app.
- New E2E specs (closing P1 from the v0.3.1 handoff):
  - `tests/e2e/jam/jam-share-url-persistence.spec.ts` — guards the
    v0.3.1 localStorage rehydration + graceful-disable path
  - `tests/e2e/auth/post-signup-profile-state.spec.ts` — pins the
    `users.name` fallback when no `user_profiles` row exists
  - Expanded `tests/e2e/jam/jam-view-anon.spec.ts` with live-session
    coverage (real session seeded via admin client, exercises the
    edge function end-to-end)

### Changed

- **Anonymous jam-view payload — `matches` and `matchCount` removed.**
  The anon page no longer surfaces "common songs" (a guest has no
  catalog and can't contribute to or benefit from the match set).
  Setlist is now the primary content and the only field besides
  session metadata. **Edge function `jam-view` redeploy required**
  before clients on v0.4.0 hit production. Old clients (v0.3.x) will
  see the trimmed payload as `matches=undefined` and degrade
  gracefully.
- **Setlist is the default tab on the host page**, replacing the
  previous default of "Common Songs" (which was empty until a second
  participant joined).
- **"My Queue" tab removed.** Its only function — pre-staging songs
  from the host's personal catalog — is already covered by the
  Setlist tab's "Add from my catalog" CTA. Single source of truth.
  `queuedSongs` state is preserved so older sessions with
  `settings.hostSongIds` still feed `saveAsSetlist`'s auto-merge
  fallback.
- **Action buttons (Save / Refresh / End) consolidated into a kebab
  menu** next to the tab bar. Eliminates the wrapping-to-three-lines
  bug on mobile. testids `jam-save-setlist-button`,
  `jam-refresh-matches-button`, `jam-end-session-button` move to the
  menu items but keep the same names so existing tests need only an
  `openMenu()` step, not testid renames.
- **JamSessionCard compacted from ~150px to ~50px on mobile.** Layout
  is now a single row: session name + expiry on the left, labelled
  "Join code ABC123" chip in the middle, single Share button on the
  right. Copy / QR moved into a popover behind the Share button.
- **Mobile participants section is a self-contained collapsible
  card**, defaulting to collapsed. One-line summary
  ("3 participants · 1 watching") doubles as the toggle header;
  expanded body is the same card's body with an internal divider so
  the relationship between toggle and content is visually
  unambiguous. Desktop sidebar layout unchanged.
- **Brand palette alignment.** Replaced off-palette `bg-blue-600`
  syncing banner, `bg-surface` (`#F5F5F5`) light wrapper, blue
  `LoadingSpinner.primary`, and `amber-500` accents in jam UI with
  the canonical `bg-[#0a0a0a]` dark surface and `text-primary`
  (`#FE4401`) brand orange. Eliminates the "white screen with blue
  text" flash during Suspense / auth checks.

### Fixed

- **FK race in save-as-setlist.** `addSetlist` writes go through the
  offline-safe sync queue (local first, async push to Supabase) but
  `updateJamSession` writes directly to Supabase (no local cache for
  ephemeral sessions). The direct UPDATE could beat the queued
  INSERT to the server, so `jam_sessions.saved_setlist_id`
  referenced a row that didn't exist yet → FK violation. Fixed via
  `flushPendingWrites()` between the two writes.
- **Personal-setlist delete didn't update the UI** until navigation
  or a realtime DELETE event landed. `SetlistsPage.handleDelete`
  was filtering only `uiSetlists` (band scope), missing
  `personalUISetlists`. Now filters both lists optimistically.
- **Anonymous jam-view spinner stuck forever in dev** under React
  StrictMode. A cross-mount ref guard meant the second mount's
  fetch early-returned because the first mount's was still
  "in-flight," and the first mount's `cancelled` closure prevented
  it from clearing the loading state. Removed the ref guard;
  per-effect `cancelled` flag is sufficient.
- **Kebab menu click was swallowed by dnd-kit's pointer listeners**
  on `SortableQueueSongRow`. Spreading `{...listeners}` on the row's
  outer wrapper made the drag sensor capture every pointer event,
  including clicks on the kebab. Listeners now attach only to the
  grip handle (the dnd-kit-recommended pattern). Also added
  `touch-none` so mobile drags don't fight scroll gestures.
- **`LoadingSpinner.primary` was hardcoded to `text-blue-600`** and
  `FullPageSpinner` used `bg-white` — the combination produced
  "blue text on a white screen" during every Suspense fallback.
  Now uses `text-primary` (`#FE4401`) on a dark backdrop.
- **`bg-surface` (`#F5F5F5`) at `App.tsx:154`** caused a light-gray
  flash to show through on every route-level Suspense fallback.
  Replaced with `bg-[#0a0a0a]` to match `ModernLayout`.
- **Off-palette syncing banner** — the "Syncing your data from
  cloud..." header was `bg-blue-600`. Re-themed to dark surface
  with brand-orange spinner.

### Edge functions

- `jam-view` requires redeploy: response shape changed (`matches`
  and `matchCount` removed; `setlist` now always present, possibly
  empty). The legacy `jam_song_matches` table read is now
  fallback-only for pre-`setlistItems` sessions. Documented in
  `supabase/functions/FUNCTIONS.md`.

### Migration / deploy notes

| Asset                    | Action                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Postgres schema          | None                                                                  |
| Migrations               | None                                                                  |
| RLS policies             | None                                                                  |
| Realtime publication     | None (presence is in-memory, not postgres_changes)                    |
| `jam-view` edge function | **Redeploy required** (`./scripts/deploy-edge-functions.sh jam-view`) |
| Frontend bundle          | Standard deploy                                                       |

## [0.3.1] - 2026-04-24

### Fixed

- **Hotfix:** 403 errors on all jam session operations in production. The
  v0.3.0 incremental migration created the `jam_sessions`,
  `jam_participants`, and `jam_song_matches` tables with RLS policies but
  never granted DML privileges to the `authenticated` role. PostgREST
  rejected every SELECT/INSERT/UPDATE/DELETE with 403 despite valid JWTs,
  breaking the entire jam session flow. Fixed by migration
  `20260424000000_hotfix_grant_jam_tables.sql` which explicitly grants
  SELECT/INSERT/UPDATE/DELETE on the three jam tables to `authenticated`.
  Local development Supabase defaults are more permissive, so this didn't
  surface in pre-deploy testing.
- Jam session participant list showed `User abc123` instead of the real
  name for users who had never set an extended profile. The
  `getJamParticipants` query in `RemoteRepository` only read
  `user_profiles.display_name`, but that row is only created when a user
  explicitly visits profile settings — `users.name` (populated at signup)
  is the more reliable source. Now queries both and prefers
  `user_profiles.display_name` when set, falling back to `users.name`.
- Anonymous jam-view page (`/jam/view/:shortCode`) returned 401 because
  the `jam-view` edge function was deployed without `--no-verify-jwt`,
  causing the Supabase gateway to reject unauthenticated requests before
  the function ran. Redeployed with the flag.
- Share URL for a jam session reset to a broken fallback
  (`/jam/view/<code>` with no `?t=` token) after page remount / refresh.
  The raw view token is only known at session creation (DB stores a
  hash), so the host page couldn't rebuild it from server data. Now the
  raw token is persisted to localStorage keyed by session id, rehydrated
  on remount, and the JamSessionCard copy/QR buttons gracefully disable
  themselves when the token isn't available (e.g. shared on a device
  other than the one that created the session) with an explanatory
  tooltip instead of handing out a URL that will 400.
- Anonymous jam-view page returned 404 even with a valid
  `/jam/view/<code>?t=<token>` URL. The `jam-view` edge function queries
  `jam_sessions` via service_role, but the v0.3.0 migration granted DML
  to `authenticated` only. Although `service_role` has `rolbypassrls =
true`, BYPASSRLS does not confer table-level privileges — so every
  service_role read returned "permission denied" and surfaced as 404.
  Audit revealed ALL 19 public tables were missing service_role grants
  (a gap in the original baseline migration, not just the jam tables).
  Fixed by migration `20260424020000_grant_all_public_tables_to_service_role.sql`
  which grants service_role DML on every existing public table AND sets
  default privileges so future tables inherit the grant automatically.
  Preceding migration `20260424013000_grant_jam_tables_to_service_role.sql`
  first grants just the jam tables (kept for history).
- Anonymous jam-view showed `Host` as the session host's display name
  because the edge function only read `user_profiles.display_name`
  (which is empty for users who never set an extended profile). Now
  falls back to `users.name` (populated at signup).

### Changed

- Migration-authoring checklist in `CLAUDE.md` now includes: **any new
  table in an incremental migration needs an explicit `GRANT SELECT,
INSERT, UPDATE, DELETE ... TO authenticated` AND `... TO service_role`
  statement**, because the baseline's "GRANT ON ALL TABLES" is a
  snapshot, not a default-privilege rule.

### Infrastructure (post-mortem from v0.3.0 → v0.3.1)

- `scripts/lint-migrations.mjs` (wired as `npm run lint:migrations`) —
  static analysis of migration SQL text. For every `CREATE TABLE`,
  verifies an explicit `GRANT` for both `authenticated` and `service_role`
  exists in the same or a later migration (or a covering broad grant, or
  prior default-privilege configuration). Runs at the SQL-text level, so
  local Supabase's permissive default privileges cannot mask missing
  grants. Red/green verified: removing the hotfix migrations reports 29
  violations; restoring passes cleanly.
- `supabase/tests/008-role-grants.test.sql` — pgTAP suite (181 tests)
  asserting `has_table_privilege()` for authenticated + service_role on
  every public table × every DML operation. Complements the linter by
  catching runtime drift; stronger when run against hosted Supabase.
- `supabase/functions/FUNCTIONS.md` — manifest of every edge function
  with auth mode, role context, and expected smoke status. Eliminates
  the "forgot `--no-verify-jwt`" class of bug.
- `scripts/deploy-edge-functions.sh` — deploy wrapper that reads the
  manifest and applies the correct auth flag per function. Never deploy
  via ad-hoc `supabase functions deploy <name>`.
- `scripts/smoke-edge-functions.sh` — post-deploy smoke verifying each
  function returns its expected unauthenticated-GET status from the
  manifest.
- `.claude/process/pre-deploy-checklist.md` — required pre-merge and
  pre-deploy gates, each item tied to a specific v0.3.1 production
  failure.
- Functionality catalog template extended — every capability now
  documents "Who can / Who cannot / Tests (positive) / Tests (negative)"
  plus role-grant and RLS-policy pointers. Jam session domain fully
  backfilled as exemplar; remaining domains to follow incrementally.

## [0.3.0] - 2026-04-23

This release ships the social catalog + jam sessions feature set alongside a
comprehensive UI unification pass. It also marks the transition from the
pre-1.0 "modify baseline directly" schema policy to per-feature incremental
migrations now that production data exists.

### Added

#### Social catalog + jam sessions

- Personal song catalogs — songs can now be owned by a user directly (not
  just a band) via `context_type = 'personal'`
- Personal setlists — same treatment, scoped to the owning user
- Jam sessions: ephemeral multi-user sessions for finding common songs
  across participants' personal catalogs. Host creates a session, others
  join via 6-char short code; matches are computed server-side and
  broadcast to all participants via Realtime.
- Anonymous read-only jam view via `jam-view` edge function — attendees
  can follow along with a view-only link without signing in
- `jam-recompute` edge function + atomic `replace_jam_matches()` RPC for
  server-side match computation
- Host in-session setlist mutator + "seed jam from personal setlist" flow
- Test harness CLI (`scripts/test-harness/`) for multi-user jam testing
  with alice/bob/carol personas driving real RLS paths
- pgTAP coverage for jam sessions + RLS policy drift detection (suite
  `supabase/tests/013-jam-sessions.test.sql`)

#### UI unification

- `<MetaPill>` + helpers (`KeyPill` / `BpmPill` / `DurationPill` /
  `TuningPill`) — unified metadata chip used across song lists, detail
  views, and the practice session viewer
- `<SectionCard>` — shared container for the "dark card with section
  heading + optional actions slot" pattern; adopted in PracticeView,
  SetlistView, ShowView
- `<MarkdownField>` — render-first notes editing surface with
  pencil-to-edit, click-out auto-save + green "Notes saved" flash, discard
  confirm on dirty cancel. Adopted for band notes in EditSongModal and for
  notes fields in Practice/Setlist/Show view pages.
- `<UnsavedChangesDialog>` + `useUnsavedChanges()` hook — blocking
  three-button (Keep / Discard / Save) confirm dialog for forms with
  unsaved changes. Wired into EditSongModal.
- Tuning color registry (`src/utils/tunings.ts`) with 9 canonical tunings
  in Palette A; colored left-border stripe + colored Guitar icon on
  `SongListItem` for at-a-glance tuning-change spotting
- Practice session viewer — four responsive layouts (TV / tablet
  landscape / tablet portrait / mobile) auto-detected by viewport aspect
  ratio, with a manual override toggle persisted to localStorage
- Font-size S/M/L toggle in the session header (persisted to localStorage)
- Kindle-style full-width top/bottom tap zones on the notes panel for
  page-by-page scrolling; keyboard + BT foot-pedal shortcuts (PageUp /
  PageDown / Space / Shift+Space)
- Full-screen practice session on all viewports — sidebar hidden during
  an active session
- `<FooterNextPreview>` — shared next-song preview block for the session
  footer across tablet/mobile layouts
- `<ScrollableNotes>` — markdown notes panel with tap-zone scroll controls
  (extracted from the practice session viewer for reuse)
- `/dev/ui-preview` dev route — design sandbox with 5 tabs for reviewing
  proposed patterns (practice layouts, tuning colors, markdown field,
  unsaved changes, section card). Not linked from main nav.
- `.claude/specifications/functionality-catalog.md` — plain-English index
  of all app capabilities with test references across 11 domains

### Changed

- `MarkdownRenderer` migrated off legacy color tokens (`steel-gray`,
  `energy-orange`, `smoke-white`, `electric-yellow`) to the modern hex
  palette (`#f17827ff`, `#d4d4d4`, `#1f1f1f`, etc.)
- Migration policy — now one consolidated incremental migration per
  release/feature, not per-commit. Baseline is frozen for production
  parity; new schema changes go into dated incremental files with
  `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / exception-handler guards
  for idempotency. See `CLAUDE.md` "Migration Policy" section.
- RLS policies hardened:
  - `users_select_authenticated` (permissive) replaced with three scoped
    policies: `users_select_self`, `users_select_band_member`,
    `users_select_jam_coparticipant`
  - Songs and setlists split into `*_personal_*` and `*_band_members`
    policy variants to support per-catalog ownership
  - New `is_jam_participant()` + `are_jam_coparticipants()` helper
    functions (SECURITY DEFINER) to prevent RLS recursion
- Practice session viewer completely rebuilt for the four-layout design;
  previous single-column layout removed
- Guitar tuning strings canonicalized via `canonicalTuningId()` —
  `"Standard (EADGBE)"` and `"Standard"` now resolve to the same registry
  entry; the modal dropdown shows one consistent list
- Supabase production access procedure — documented in `CLAUDE.md` with
  strict secret-handling rules (no byte dumps, no appends to the env
  file, length/prefix checks only)

### Removed

- `src/components/songs/NewSongModal.tsx` — orphaned (unused, legacy blue
  accent, `console.log` submit). `EditSongModal` handles both add and
  edit modes.
- Band Notes field in `EditSongModal` add-mode — users create the song
  first, then add notes from the song detail view
- Pre-1.0 "modify baseline migration directly" policy

### Fixed

- Tuning vocabulary drift between `NewSongModal` and `EditSongModal`
  (`"Standard (EADGBE)"` vs `"Standard"`, `"Half Step Down"` vs
  `"Half-step down"`) — both now source from
  `src/utils/tunings.ts::builtInTuningLabels()`
- Mobile metadata row left-justified instead of centered
- Exit affordance redundancy on the TV layout — back arrow in the
  top-left is now the sole exit

### Infrastructure

- Incremental migration
  `supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql`
  brings existing production databases up to parity with the
  social-catalog baseline changes. Fully idempotent.
- `.devcontainer/setup.sh` now installs the GitHub CLI (`gh`) for PR and
  release management

## [0.2.2] - 2026-01-22

### Fixed

- Practice session notes (wrapupNotes) not saving or syncing to other devices
- Song reorder in practices not syncing to other users despite toast notifications
- Song session notes being stripped when updating practice
- Partial updates wiping unrelated fields due to `?? []` converting undefined to empty arrays
- Scroll position lost during real-time sync updates on practice view page
- Race condition in `useRealtimeSync` where inline array dependencies caused effect re-runs

### Changed

- `useRealtimeSync` now uses stable event key via `useMemo` and executes pending sync on cleanup
- `RemoteRepository` mappers only include fields that are actually present in update objects
- `PracticeViewPage` only shows loading spinner on initial load, not on realtime-triggered refetches

## [0.2.1] - 2026-01-21

### Added

- Feature flag system for toggling experimental features (`src/config/featureFlags.ts`)
- Shared audit log mappers for consistent JSONB to model conversions (`src/services/data/auditMappers.ts`)
- Audit log-based incremental sync (behind feature flag `SYNC_USE_AUDIT_LOG`)
- Docker configuration for mobile browser testing (`Dockerfile`, `docker-compose.yml`, `start-docker.sh`)

### Fixed

- Song updates not syncing to other devices - incremental sync was comparing `createdDate` which never changes after creation, now uses `audit_log` table (#8)

### Changed

- `RealtimeManager` now uses shared audit mappers for consistency with `SyncEngine`
- Incremental sync can use `audit_log` table instead of per-record timestamps (feature flagged)

## [0.2.0] - 2026-01-21

### Added

- **External Links & Spotify Integration** (#7)
  - Reference links for songs (Spotify, YouTube, tabs, lyrics, other)
  - URL auto-detection when pasting/typing links
  - Link icons in song lists with one-click access
  - Spotify search with album art and metadata auto-fill
  - Edge Function proxy for Spotify API authentication
- Persistent layout architecture - sidebar/navbar stay mounted during navigation, eliminating white screen flicker (#6)
- `ContentLoadingSpinner` component for content-area-only loading states
- `ProtectedLayoutRoute` component combining auth check with persistent layout

### Fixed

- Delete song sync issue - songs no longer reappear after deletion
- Navigation flicker - removed loading spinner flash on route changes

### Changed

- Replaced `ProtectedRoute` with `ProtectedLayoutRoute` for all protected routes
- All page components now use `ContentLoadingSpinner` instead of wrapping with `ModernLayout`

## [0.1.0] - 2026-01-18

### Added

- **Improved Auth Flow**
  - Unified auth validation with `useAuthCheck` hook
  - 1.5-hour grace period for expired sessions (supports offline gigs/practices)
  - Automatic cleanup of stale localStorage keys
  - Session expiry detection and redirect

- **Sync-on-Load**
  - Incremental sync on every app load
  - Conflict detection for concurrent edits
  - Cross-device sync improvements

- **E2E Testing**
  - 53 new session expiry E2E tests
  - Test suite remediation (108 tests passing)
  - Test performance optimization with parallel execution
  - Split test scripts (`test:quick`, `test:unit`, `test:services`)

- **Enhanced Practice Workflow**
  - Practice session management
  - Practice builder page
  - Practice view improvements

### Fixed

- Cross-device sync now processes same-user changes correctly
- Sync-on-load performs full sync when no timestamp exists
- `useSongs` hook checking wrong sync status field

### Infrastructure

- pgTAP database test suite (269 tests)
- Consolidated migrations into single baseline schema
- Improved CI/CD pipeline configuration

---

## Version History

| Version | Date        | Highlights                          |
| ------- | ----------- | ----------------------------------- |
| 0.2.0   | 2026-01-21  | External links, Spotify integration |
| 0.1.0   | 2026-01-18  | Auth flow, sync-on-load, E2E tests  |
| 0.0.x   | Pre-release | Initial development                 |
