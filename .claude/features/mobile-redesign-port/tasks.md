---
feature: mobile-redesign-port
created: 2026-07-02T05:00
status: in-progress
based-on: 2026-07-02T05:00_plan.md
---

> Foundation passes (P0–P2) are broken to executable granularity. Screen re-skins (P3–P9)
> and DB features (P10–P12) are pass-level here; expand each into fine tasks at its own
> `/implement` cycle. Every screen pass MUST carry its research-§6 parity checklist as
> acceptance criteria. Run `npm run type-check` + `npm run test:quick` + `npm run lint`
> before and after every pass.

## Phase P0: Token foundation (UI-only, app-wide)

- [ ] T001: Add token `:root` block to `src/index.css`
  - Files: `src/index.css`
  - Acceptance: all research-§2 vars defined (`--bg-0..4`, `--ink-1..6`, `--border-1/2`,
    `--accent` + `-hot/-deep/-soft/-line` via color-mix, `--info/--success/--warn/--danger` + `-soft`).
    App still builds.
- [ ] T002: Map tokens into `tailwind.config.js`; add Geist + JetBrains Mono font families
  - Files: `tailwind.config.js`, `index.html` (font `<link>`)
  - Depends: T001
  - Acceptance: `bg-bg-1`/`text-ink-2`/`border-accent`/`text-danger` classes resolve; `font-mono`
    = JetBrains Mono, `font-sans` = Geist. Keep existing `confidence.*` ramp + touch spacing.
- [ ] T003: Create `src/utils/tokens.ts` TS mirror
  - Files: `src/utils/tokens.ts`
  - Depends: T001
  - Acceptance: exports accent/bg/ink/semantic hex + badge tone map; re-exports tuning colors from
    `tunings.ts` (Palette A canonical) and `avatarColor` from `songAvatar.ts`; instrument spine.
- [x] T004: Unify the two oranges → `--accent` (REVISED — done via config remap, 0 component edits)
  - Done: `energy-orange`/`primary` Tailwind names remapped to the accent var (T002), which
    unified the only visually-divergent orange (`#FE4401` red-orange, reached only via those
    names). The 325 `#f17827` literals ≈ `#ff7a1a` visually (rgb 241,120,39 vs 255,122,26) —
    tokenizing them to `bg-accent`/`var(--accent)` is DEFERRED to each screen's pass to avoid
    double-touching ~48 files (minimize footprint). No live `#FE4401` color values remain
    (only comments).
- [ ] T005: Sanity verify P0
  - Acceptance: `npm run build` + `npm run type-check` pass; spot-check Songs + an auth screen
    render dark with single accent; no console errors.

## Phase P1: Shared primitives

- [ ] T006: [P] `src/components/common/Badge.tsx` (static semantic badge)
  - Acceptance: tone ∈ info/success/warn/danger/neutral/accent from tokens; optional dot; unit test.
    Refactor `InlineStatusBadge` to render `Badge` internally (no behavior change).
- [ ] T007: [P] `src/components/common/Eyebrow.tsx` (mono uppercase label)
  - Acceptance: renders JetBrains Mono, letter-spaced, `--ink-4`.
- [ ] T008: Generalize `SongAvatar` → generic `Avatar`
  - Files: `src/components/common/SongAvatar.tsx` (+ maybe new `Avatar.tsx`)
  - Acceptance: accepts `{label,color,photo,size,rounded}`; `SongAvatar` becomes thin wrapper;
    existing usages unchanged; unit test for deterministic color.
- [ ] T009: Add bottom-sheet variant to `SlideOutTray`
  - Files: `src/components/common/SlideOutTray.tsx`
  - Acceptance: `position:'bottom'` prop slides up from bottom, covers viewport, themed scrollbar;
    side-tray behavior unchanged (regression check on existing usages).

## Phase P2: Navigation / shell

- [ ] T010: Re-skin `common/BottomNavigation.tsx` to tokens + 5 tabs (Home·Songs·Sets·Calendar·More), lucide icons
  - Acceptance: dark tokens, active = `--accent`; `data-testid` per tab; no light-theme classes remain.
- [ ] T011: Wire bottom nav into `ModernLayout`; add `<main>` bottom padding on mobile
  - Files: `src/components/layout/ModernLayout.tsx`
  - Depends: T010
  - Acceptance: bottom nav visible mobile-only (`md:hidden`), sidebar desktop-only; shell persists
    across nav (persistent-layout intact); active tab reflects route.
- [ ] T012: Reconcile desktop `Sidebar` to same IA (superset)
  - Files: `src/components/layout/Sidebar.tsx`
  - Acceptance: sidebar lists Home/Songs/Sets/Calendar + expanded More items; existing links work.
- [ ] T013: Add routes + placeholders in `App.tsx`
  - Files: `src/App.tsx`, stub `HomePage`/`CalendarPage`/`MorePage`/`NotificationsPage`
  - Depends: T011
  - Acceptance: `/`, `/calendar`, `/more`, `/notifications` render stubs; `/` no longer redirects;
    header `NotifBell` placeholder → `/notifications`; E2E: all 5 tabs navigate.

## Phase P3–P9: Screen re-skins (one `/implement` cycle each; migrate that area's hex to tokens)

- [ ] T014: P3 Songs re-skin — parity guard: SyncIcon(5 states incl. unread badge), Band/Personal
      tabs, Copy-to-Personal + linked chain, filters+7 sorts, SongNotesModal(band+personal),
      EditSongModal(Spotify/CircleOfFifths/reflinks+sanitization/personal-mirror/unsaved-guard),
      LinkIcons popover. Do NOT restore Add-to-Setlist mock as real.
- [ ] T015: P4 Setlists re-skin — parity guard: song/section/break(+dur/notes), drag+autosave,
      per-song notes, show-link fork, both editors, Band/Personal tabs, status filters.
- [ ] T016: P5 Shows re-skin — parity guard: tap-to-call/mailto contacts, load-in/soundcheck/
      payment(cents→$), notes, setlist fork, filters, next-show hero.
- [ ] T017: P6 Practices re-skin incl. Session — parity guard: 4 responsive layouts + localStorage,
      font S/M/L, foot-pedal/keyboard scroll, song stepping, up-next+tuning-change alert, session notes,
      add-all-from-setlist. Verify `PracticeBuilderPage` (not fully read) separately.
- [ ] T018: P7 Band/Settings/Profile re-skin — parity guard: regenerate invite, transfer ownership,
      make/remove admin, permission gating, edit instruments(+primary), Account read-only, app version.
      (Verify `AuthPages.tsx` 1712-line file if in scope.)
- [ ] T019: P8 Jam re-skin — parity guard: create(seed from personal setlist), join-by-code, QR,
      participants+anon watchers, Common-Songs auto-match, end-session flow, anon `/jam/view` poll.
- [ ] T020: P9 Home dashboard + Calendar aggregator + More hub (net-new UI over existing data)
  - Acceptance: Home = next show/practice + activity + quick actions; Calendar aggregates
    shows(orange)+practices(blue)+events(green) on one axis with filters; More lists Jam/Band/
    Events/Friends/Settings/Profile/Help/Sign-out.

## Phase P10: Notifications (DB feature)

- [ ] T021: Migration `<ts>_notifications.sql` — `notifications`, `release_notes`,
      `users.last_seen_release_version`; indexes; RLS (user-scoped SELECT/UPDATE/DELETE, service_role
      INSERT); GRANTs both roles; publication + REPLICA IDENTITY FULL. CHECK `kind` = TS union.
  - Acceptance: `supabase db reset` + `npm run test:db` (new pgTAP) + `npm run lint:migrations` pass.
- [ ] T022: `Notification` model + `NotificationService` (list, unread count, markRead, digest from
      `notifications`+`users.last_login`) + RemoteRepository mappers + RealtimeManager channel.
- [ ] T023: UI — NotifBell(unread), NotificationCenter(All/Updates/Activity), WelcomeBackCard digest,
      WhatsNewSheet(version-gated). Wire bell into shell. `data-testid`s.

## Phase P11: Friends (DB feature)

- [ ] T024: Migration `<ts>_friends.sql` — `user_profiles` +discoverable/friend_code/
      friend_request_policy (backfill code, then UNIQUE); `friend_requests`; `friendships`(canonical
      `user_a<user_b`); `are_friends` helper; indexes; RLS (+ friend/discoverable user visibility
      without re-opening global enumeration); GRANTs; publication `friend_requests`.
  - Acceptance: db reset + test:db + lint:migrations pass; CHECK unions match TS.
- [ ] T025: Edge fns `resolve-friend-code`, `send-friend-request`(policy enforcement),
      `accept-friend-request`(atomic friendship row) + FUNCTIONS.md rows + smoke.
- [ ] T026: `FriendService` + `Friend` model + User model fields + RealtimeManager(friend_requests).
- [ ] T027: UI — FriendsHome(list+requests+inline visibility card), AddFriend, JoinByCode, QRBlock
      (reuse `qrcode.react`/JamInviteQR). Under More. `data-testid`s.

## Phase P12: Events (DB feature)

- [ ] T028: Migration `<ts>_events.sql` — `events`, `event_participants`(access_tier+rsvp),
      `event_lineup_items`(source+owner+display tuple), `event_lineup_requests`(pending→approve);
      `is_event_participant`/`event_access_tier` helpers; indexes; RLS (unlisted via view_token edge
      fn, not broad policy); GRANTs; publication event_participants+event_lineup_requests.
  - Acceptance: db reset + test:db + lint:migrations pass; CHECK unions match TS; short_code reuses
    jam alphabet.
- [ ] T029: `Event` model + `EventService` (create/join-by-code, RSVP, lineup request/approve,
      source derivation from song) + mappers + RealtimeManager channels.
- [ ] T030: UI — event host console (lineup, requests/resolve sheet, cast, access/invite, RSVP),
      guest view (same card, guest mode), Events hub + create flow. Integrate into Calendar + More.
- [ ] T031: Finalize — run `/finalize`: full `npm run test:all`, docs, parity sign-off across all passes.

## Parallelization notes

- T006/T007 are independent ([P]). T003 can proceed alongside T002.
- P3–P8 screen re-skins are mutually independent once P0–P2 land — can be tackled in any order /
  by parallel agents (each touches a disjoint page set).
- P10/P11/P12 are DB-independent of each other but sequence Notifications→Friends→Events for value
  (Friends/Events emit notifications).
