# 05 · Build plan

Eight phases, each one release (version bump + CHANGELOG + `release_notes` row, per CLAUDE.md), each shippable
on its own. Order follows dependency and traffic: foundations first, then the screens people use every week,
then the net-new tools, then the jam (blocked on 06).

Run each phase through the repo's loop: `/research` → plan in `.hermes/plans/` → `/implement` (tests first) →
`/finalize` → PR → merge → `/release`. A prompt that works for kicking off a phase:

> Implement phase N of `docs/redesign/05-plan.md`. Read `docs/redesign/README.md`, the guides it links, and the
> phase's design screens (listed below) before planning. Follow this repo's CLAUDE.md. Ask before removing any
> existing capability.

Feature flags: add `REDESIGN_<AREA>` flags to `src/config/featureFlags.ts` only where a phase **removes** an old
flow (the Shows / Practices list pages, the old song modal), so the old path can come back without a revert.
Pure restyles ship unflagged.

---

## Phase 0 · Foundations (0.6.0)

Guides: 01, 02 (primitives + overlays). Design: `source/Foundations.html`, `source/Components.html`.

- Tokens in `src/index.css` (dark + `[data-theme='light']` + `[data-ctx='personal']`), new variables (`--on-accent`, `--accent-ink`, `--chord`, `--danger-fill`, three event-type colours), Tailwind mappings.
- Fonts swap (index.html, `tailwind.config.js` `display` / `sans` / `mono`).
- `ThemeContext` (system / light / dark) and `data-ctx` on the layout root from the current context.
- Tuning spine in `utils/tunings.ts` (+ C Standard), `TuningPill`.
- Primitives: `Button`, `IconButton`, `Chip`, `Switch`, `Segmented` (restyle `TabSwitcher`), `ListRow`, `SectionCard` as group, `TypeLabel`, `BottomSheet` (restyle `SlideOutTray`), `SkeletonRow`, `RetryCard`, `EmptyState`, toast + banner restyle, custom icons.
- Migration: `user_preferences` (theme first; other columns can arrive empty).
- Accept: every existing screen renders in the new palette and fonts with no cold-grey hex left (`grep` check in CI); light theme toggles from Settings; switching to Personal turns the accent indigo; tuning pills match `source/Foundations.html`.

## Phase 1 · Shell and Home (0.7.0)

Guide: 03 → Shell, Home. Design: Core Navigation 1–11, Tools on Home 1–2 and 4, FP 19; desktop Home, sidebar.

- Context switcher dropdown + switch prompt; desktop sidebar IA; bottom nav restyle; More reorganised.
- Home (band / new band / Personal), walkthroughs, Quick actions; Tools row hidden behind `REDESIGN_TOOLS` until phase 5.
- Notifications popout + stream; App updates tab.
- Global search (Home on mobile, ⌘K on desktop), scoped + "All contexts".
- Offline banner; remove per-row sync icons.
- Accept: the Core navigation checks in the mobile demo's checklist pass on a phone and at 1280 px.

## Phase 2 · Songs (0.8.0)

Guide: 03 → Songs; 04 → Songs. Design: Song Row, Song Editor and View, Song Chart 1 and 3, FP 6, 13, 15–17; desktop Songs, New song.

- New song row (comfortable / compact), Sort (field + direction) and View (saved in `user_preferences.list_views`), hidden songs, swipe / hold (mobile), hover / right-click (desktop).
- Song editor as a route (mobile) / page (desktop): Spotify matches, album, tuning picker, circle of fifths, link paste, Also add to My Songs; Cancel names the changes. Flag `REDESIGN_SONG_EDITOR` retires `EditSongModal`.
- Song view: facts, Chords & lyrics button (disabled "Coming soon" until phase 5, or hidden), links, notes edit-in-place, Used in.
- Personal "band songs not in My Songs" banner.
- Loading / empty / no-matches / error states.
- Accept: Songs section of the mobile checklist; desktop table sorts and filters the same as mobile.

## Phase 3 · Setlists (0.9.0)

Guide: 03 → Setlists. Design: Setlist Editor 1–9, FP 9–12, 23; desktop Setlists.

- List: sort, ⋯ (Duplicate / Delete with the precise confirm), New setlist with empty state.
- Editor: saves as you go, totals, retune lines + Tune (links to the tuner once phase 5 lands), drag + hold Move sheet, Add menu (mobile) / insert-after-selection (desktop), break + section inline edit, set notes, song browser, timeline rail.
- Remove "Open on stage".
- Accept: Setlists section of the checklist; desktop insert-after-selection.

## Phase 4 · Calendar, shows, practices (0.10.0)

Guide: 03 → Calendar; 04 → Calendar. Design: FP 1–5, 7–8, 18, Calendar and Shows, Practice, New Practice, Practice History; desktop Calendar, practice session, history.

- Agenda with All · Shows · Practices · Jams, one New (type picker on All), row menu, empty / error.
- Redirect `/shows` and `/practices` lists to filtered Calendar (flag `REDESIGN_CALENDAR`). Leave `/events` alone (06).
- New show = blank show page; show page edit-in-place, Confirmed / Cancelled + Undo, set **copy** with Re-copy, no-set state, offline, delete.
- Practice page; New / Duplicate editor with kit pickers (Start + End lists) and the filtered song browser.
- Practice session (stage): named Prev / Next, Notes as sheet / panel, Up next + Tune now, wake lock, keyboard + pedal, wrap-up → history. Desktop full-window layout.
- Practice history.
- Migration: `setlists.copied_at`; `shows.confirmed` if chosen (04).
- Accept: Calendar section of the checklist; a show's set edits never change the source setlist (unit test).

## Phase 5 · Tools and chart (0.11.0)

Guide: 03 → Chart and tools; 04 → charts, tunings. Design: Song Chart, Sound Tools, Metronome, Custom Tuning, Tools on Home 3; desktop Tuner, Metronome, Chords, Chart, chart editor, custom tuning.

- `/tools/:tab` (Tuner · Metronome · Chords). Tuner via `getUserMedia` + pitch detection (autocorrelation / YIN in an AudioWorklet); chevron guidance; opens on the relevant tuning. Metronome on the AudioContext clock (lookahead scheduler), visuals from rAF.
- In-app synth: Karplus-Strong pluck for strings and chords, soft sine for notes (see `demo/desktop-tools.js` for a reference implementation).
- Chart reader (continuous scroll, Back / Next, pedal, transpose, size, chords on / off, chord viewer, starting note, notes sheet) and chart editor (paste / ChordPro, lyrics and chords modes).
- Custom tuning neck editor; C Standard + extended-range built-ins.
- Turn on `REDESIGN_TOOLS` (Home Tools row, retune-line Tune buttons, practice Tune now).
- Migration: `song_charts`; tuning seeds; unique index on custom tunings.
- Accept: Chart and tools section of the checklist; metronome drift under 1 ms over 5 minutes in a Playwright audio-clock test.

## Phase 6 · Account, band, friends (0.12.0)

Guide: 03 → Account…; 04 → Bands. Design: Account and Settings, Band and Friends, Band Identity, FP 14; desktop sign-in, Settings, Band, Friends.

- Auth screens (Apple / Google, wrong-password, forgot, check email, Get started's four paths).
- Settings (Appearance, Tunings, Profile with ordered instruments, Push preferences, Account incl. change password and typed delete, About).
- Band: invite with Regenerate, member menus by permission, owner role + transfer, create band (one field), band mark picker, join preview, leave (owner routed to transfer).
- Friends: privacy roll-open, Add a friend by name or code.
- Migration: `bands.mark` + profile fields; `'owner'` role, backfill, unique owner index, transfer function; `band_preview_by_code` RPC; `user_profiles.personal_color`.
- Accept: Account and band section of the checklist; ownership transfer is atomic (pgTAP).

## Phase 7 · Jam (after the 06 decision)

Design: Jam Plan, Jam Live, Jam Host, Jam TV, Jam Venue, FP 20–22; desktop Jam; `demo/Jam Night.html` for the end-to-end flow.
Scope and data depend on the decision. Whatever is chosen, build against `Jam Night.html`'s flow: plan → share code → people join (app, web, kiosk, walk-up) → pitches and hands → Go live → Up next / call up / queue → bar TV → end.

## Phase 8 · RSVP (post-launch)

`calendar_rsvps` table and the Coming / Maybe / Can't rows already drawn on show and practice pages.

---

## Not in scope

Month view (deferred until calendar sync), band history / restore, public band profile, push delivery.
