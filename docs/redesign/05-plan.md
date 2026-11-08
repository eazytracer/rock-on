# 05 · Build plan

Eight phases, each one release (version bump + CHANGELOG + `release_notes` row, per CLAUDE.md), each shippable
on its own. Order follows dependency and traffic: foundations first, then the screens people use every week,
then the net-new tools, then the jam.

**Order confirmed Nov 7 2026** with Part A settled (`design/source/DECISIONS.md`). `redesign/integration` is at
**0.6.1** (unreleased), so the phases are numbered from **0.7.0**. The app is online-only: no phase has offline work.

**Before phase 0's code: API conventions.** The build agent adds a short step that fixes how the operations in
`design/OPERATIONS.md` are exposed (Postgres RPC vs PostgREST + RLS vs edge function, naming, error shape,
`version` conflicts, pagination) so the web app and the Flutter apps call the same contract. Logic goes behind
the API, not in React.

Run each phase through the repo's loop: `/research` → plan in `.hermes/plans/` → `/implement` (tests first) →
`/finalize` → PR → merge → `/release`. A prompt that works for kicking off a phase:

> Implement phase N of `docs/redesign/05-plan.md`. Read `docs/redesign/README.md`, the guides it links,
> `design/OPERATIONS.md` for the phase's areas, and the phase's design screens (listed below) before planning. Follow this repo's CLAUDE.md. Ask before removing any
> existing capability.

Feature flags: add `REDESIGN_<AREA>` flags to `src/config/featureFlags.ts` only where a phase **removes** an old
flow (the Shows / Practices list pages, the old song modal), so the old path can come back without a revert.
Pure restyles ship unflagged.

---

## Phase 0 · Foundations (0.7.0)

Guides: 01, 02 (primitives + overlays). Design: `source/Foundations.html`, `source/Components.html`.

- Tokens in `src/index.css` (dark + `[data-theme='light']` + `[data-ctx='personal']`), new variables (`--on-accent`, `--accent-ink`, `--chord`, `--danger-fill`, three event-type colours), Tailwind mappings.
- Fonts swap (index.html, `tailwind.config.js` `display` / `sans` / `mono`).
- `ThemeContext` (system / light / dark) and `data-ctx` on the layout root from the current context.
- Tuning colours in `utils/tunings.ts`: Palette A with Drop D lime, Drop C fuchsia, + C Standard violet, light values (01 §7), `TuningPill`.
- Primitives: `Button`, `IconButton`, `Chip`, `Switch`, `Segmented` (restyle `TabSwitcher`), `ListRow`, `SectionCard` as group, `TypeLabel`, `BottomSheet` (restyle `SlideOutTray`), `SkeletonRow`, `RetryCard`, `EmptyState`, toast + banner restyle, custom icons.
- Migration: `user_preferences` (theme first; other columns can arrive empty).
- Remove the dead sync icons and indicators.
- Accept: every existing screen renders in the new palette and fonts with no cold-grey hex left (`grep` check in CI); light theme toggles from Settings; switching to Personal turns the accent indigo; tuning pills match `source/Foundations.html`.

## Phase 1 · Shell and Home (0.8.0)

Guide: 03 → Shell, Home. Design: Core Navigation 1–11, Tools on Home 1–2 and 4, FP 19; desktop Home, sidebar.

- Context switcher dropdown + switch prompt; desktop sidebar IA; bottom nav restyle; More reorganised.
- Home (band / new band / Personal), walkthroughs, Quick actions; Tools row hidden behind `REDESIGN_TOOLS` until phase 5.
- Notifications popout + stream; App updates tab.
- Global search (Home on mobile, ⌘K on desktop), scoped + "All contexts".
- One offline banner (edits blocked while offline).
- Accept: the Core navigation checks in the mobile demo's checklist pass on a phone and at 1280 px.

## Phase 2 · Songs (0.9.0)

Guide: 03 → Songs; 04 → Songs. Design: Song Row, Song Editor and View, Song Chart 1 and 3, FP 6, 13, 15–17; desktop Songs, New song.

- New song row (comfortable / compact), Sort (field + direction) and View (saved in `user_preferences.list_views`), hidden songs, swipe / hold (mobile), hover / right-click (desktop).
- Song editor as a route (mobile) / page (desktop): Spotify matches, album, tuning picker, circle of fifths, link paste, Also add to My Songs; Cancel names the changes. Flag `REDESIGN_SONG_EDITOR` retires `EditSongModal`.
- Song view: facts, Chords & lyrics button (disabled "Coming soon" until phase 5, or hidden), links, one band note with last editor + "Practice log · N" link, My notes, edit-in-place, Used in.
- Long-press / right-click menu keeps Duplicate.
- Personal "band songs not in My Songs" banner.
- Loading / empty / no-matches / error states.
- Accept: Songs section of the mobile checklist; desktop table sorts and filters the same as mobile.

## Phase 2.1 · Song page (0.9.1)

Brief: [10](10-song-page-and-setlist-nav.md) Part 1 and Part 3. Design: `design/demo/Song Page.html`, `review/song-page/`.

- `/songs/:id?from=` is the one place a song is edited: facts and details in place (per-field save + Undo), notes in place with Done and the conflict prompt, Back and ‹ › from the origin.
- `EditSongModal` becomes Add song only; desktop Add song keeps the sidebar. The pane becomes read-only with Open; rows open on double-click / Enter; one Tuning filter chip on desktop.
- Setlist song rows get an open icon. Icon rule audit (caret / swap / chevron).
- Accept: 10 → 1.8.

## Phase 3 · Setlists (0.10.0)

Guide: 03 → Setlists. Design: Setlist Editor 1–9, FP 9–12, 23; desktop Setlists.

- List: sort, ⋯ (Duplicate / Delete with the precise confirm), New setlist with empty state.
- Editor: saves as you go, totals, retune lines + Tune (links to the tuner once phase 5 lands), drag + hold Move sheet, Add menu (mobile) / insert-after-selection (desktop), break + section inline edit, set notes, song browser, timeline rail.
- **Navigation (10 → Part 2):** `/setlists` is an index of cards; `/setlists/:id` is the editor full width with ← Setlists (or the origin); the name is a switcher (caret dropdown on desktop, ⇄ bottom sheet on phones) ending with All setlists / New setlist; Rename / Duplicate / Delete move to the header ⋯. No setlist column beside the editor.
- Setlist statuses go (archived sets become ordinary sets). ("Open on stage" was never in the live app: nothing to remove.)
- Accept: Setlists section of the checklist; desktop insert-after-selection; 10 → 2.4.

## Phase 4 · Calendar, shows, practices (0.11.0)

Guide: 03 → Calendar; 04 → Calendar. Design: FP 1–5, 7–8, 18, Calendar and Shows, Practice, New Practice; desktop Calendar, practice session.

- Agenda with All · Shows · Practices · Jams, one New (type picker on All), row menu, empty / error.
- Redirect `/shows` and `/practices` lists to filtered Calendar (flag `REDESIGN_CALENDAR`). `/events` moves in phase 7.
- New show = blank show page; show page edit-in-place, Confirmed / Cancelled + Undo, set **copy** with Re-copy, no-set state, delete.
- Practice page; New / Duplicate editor with kit pickers (Start + End lists) and the filtered song browser.
- Practice session (stage): named Prev / Next, Notes as sheet / panel, Up next + Tune now, wake lock, keyboard + pedal, wrap-up notes saved. Desktop full-window layout.
- Practice history is **deferred** (Part A · 8). Keep recording session data.
- Migration: `setlists.copied_at`; `shows.confirmed` + backfill from `status='confirmed'` (04).
- Accept: Calendar section of the checklist; a show's set edits never change the source setlist (unit test).

## Phase 5 · Tools and chart (0.12.0)

Guide: 03 → Chart and tools; 04 → charts, tunings. Design: Song Chart, Sound Tools, Metronome, Custom Tuning, Tools on Home 3; desktop Tuner, Metronome, Chords, Chart, chart editor, custom tuning.

- `/tools/:tab` (Tuner · Metronome · Chords). Tuner via `getUserMedia` + pitch detection (autocorrelation / YIN in an AudioWorklet); chevron guidance; opens on the relevant tuning. Metronome on the AudioContext clock (lookahead scheduler), visuals from rAF.
- In-app synth: Karplus-Strong pluck for strings and chords, soft sine for notes (see `demo/desktop-tools.js` for a reference implementation).
- Chart reader (continuous scroll, Back / Next, pedal, transpose, size, chords on / off, chord viewer, starting note, notes sheet) and chart editor (paste / ChordPro, lyrics and chords modes).
- Custom tuning neck editor; C Standard + extended-range built-ins.
- Turn on `REDESIGN_TOOLS` (Home Tools row, retune-line Tune buttons, practice Tune now).
- Migration: `song_charts`; tuning seeds; unique index on custom tunings.
- Accept: Chart and tools section of the checklist; metronome drift under 1 ms over 5 minutes in a Playwright audio-clock test.

## Phase 6 · Account, band, friends (0.13.0)

Guide: 03 → Account…; 04 → Bands. Design: Account and Settings, Band and Friends, Band Identity, FP 14; desktop sign-in, Settings, Band, Friends.

- Auth screens (Apple / Google, wrong-password, forgot, check email, Get started's four paths).
- Settings (Appearance, Tunings, Profile with ordered instruments, Push preferences, Account incl. change password and typed delete, About).
- Band: invite with Regenerate, member menus by permission, owner role + transfer, create band (one field), band mark picker, join preview, leave (owner routed to transfer).
- Friends: privacy roll-open, Add a friend by name or code.
- Migration: `bands.mark` + profile fields; `'owner'` role backfilled from the `permissions` flag (04), unique owner index, transfer function; instruments reordered with the old primary first; `band_preview_by_code` RPC; `user_profiles.personal_color`.
- Accept: Account and band section of the checklist; ownership transfer is atomic (pgTAP).

## Phase 7 · Jam (0.14.0)

Guide: 03 → Jam; 04 → Jams; `design/OPERATIONS.md` §13. Design: Jam Plan, Jam Live, Jam Host, Jam TV, Jam Venue, FP 20–22; desktop Jam; `demo/Jam Night.html` for the end-to-end flow.
Decided: option A, on the Events tables (Part A · 2).

- Migration: `live` status, `group_size`, `joining_locked`, nullable `user_id` + `guest_name` / `via` / `is_house` / `parts` on participants, `event_guest_tokens`, lineup `state` + `parts_needed`, hands by participant, `shared_contexts`.
- Anonymous web-guest join and writes through the jam-scoped token only; rate limits; `end_jam` deletes guest names. pgTAP for every guest rule. Record the new functions in `supabase/functions/FUNCTIONS.md`.
- `/events` → the Jam hub (flag `REDESIGN_JAM`); casting UI behind `CASTING`; retire the 0.3 `/jam` screens; Save tonight as a setlist.
- Accept: run the flow below in the app with two browsers (host signed in, guest with no account), matching `Jam Night.html`: plan → share code → people join (app, web, kiosk, walk-up) → pitches and hands → Go live → Up next / call up / queue → bar TV → end.

## Phase 8 · RSVP (post-launch)

`calendar_rsvps` table and the Coming / Maybe / Can't rows already drawn on show and practice pages.

---

## Not in scope

Month view (deferred until calendar sync), practice history (Part A · 8), offline reading (native apps decide, `design/PLATFORM-NOTES.md`), band history / restore, public band profile, push delivery.
