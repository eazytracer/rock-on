---
feature: mobile-redesign-port
doc: Screen-by-screen validation checklist (token system + design-doc match + regression risk)
created: 2026-07-05T06:40
validate-against:
  - design project "Rock On" → app/Rock On - Design Spec.html (etag 1783293001916681, 502 KB — the
    post-sweep spec: Pass 1/2 page rows 00–08, Pass 3 = C0 pickers row + D1–D4 desktop parity + 9 flows)
  - app/DESIGN_NOTES.md §10 (sweep summary), guitar-tuning-system/PROGRESS.md
state at time of writing: UI-consistency pass DONE + green (type-check/lint/810 unit/e2e no-regressions),
  uncommitted on feature/events-friends-and-ui-oh-my.
---

# How to use this

Two things changed since the last spec read: (1) the spec grew ~309 KB → ~502 KB (a full "sweep" that
**locked** several previously-optional decisions and added a pickers-convention row, desktop-parity
section, and 9 user-flow strips), and (2) **custom tunings** now has a real DB layer built on the
separate `guitar-tuning-system` track, with the App UI still pending.

For each screen, validate three axes and tick the boxes. Method per screen:

- **Token system:** `grep -nE '\[#[0-9a-fA-F]{3,8}\]|text-(red|green|blue|amber|yellow|gray)-[0-9]' <file>`
  → should be empty except intentional brand/data colors. Confirm surfaces use `bg-bg-*`, ink uses
  `text-ink-*`, accents use `accent`/semantic tokens.
- **Design-doc match:** open the matching spec row's mobile + desktop frame; compare layout/states.
- **Regression risk:** does the change alter behavior, routing, data shape, or a tested flow?

Legend: ✅ done/matches · ⚠️ partial/known-gap · 🚩 not built (flagged) · ❓ needs eyes-on QA.

---

# A. Locked decisions in the new spec (read before validating)

- **Row 03 Setlists → Option A LOCKED:** stays top-level, keeps the **Sets** tab. Merge-into-Songs is
  **dropped**. (We already ship this — good.)
- **Row 02·B Songs → LOCKED:** flat catalog + **Source** filter; **global search (⌘K)** is the only
  cross-context surface. (Not built — flagged fork.)
- **Row 06 dashboard → LOCKED** + now has band-scoped desktop variant **and** mobile Home (full parity).
- **New `C0 · Inputs & pickers` row** = canonical kit every screen must reuse: custom **DatePicker**
  (month popover, accent=selected, ring=today, type-to-edit), **TimePicker** (15-min slots, AM/PM
  chips), one **anchored-menu dropdown (never native `<select>`/sheet)**, segmented, toggle, status
  pills, field states.
- **Custom tunings → simplified:** song form is a **names-only `<select>`** grouped Built-in / Your
  tunings, with **+ New tuning** and **Manage tunings** actions under it; string/octave detail lives
  in **Settings › Tunings**. Octaves hidden (show `E A D G B E`), MIDI stored underneath.

---

# B. Per-screen checklist (mobile + desktop)

> Token column reflects the UI-consistency pass just completed (all pages migrated). Design-doc &
> Regression columns are the NEW validation work.

### Shell — Sidebar (desktop) + MobileHeader + BottomNav → spec row 00

- [ ] **Token:** ✅ chrome→`bg-1`, badges→`info`, sync→dot. Verify no `#141414`/`bg-blue-500` remain.
- [ ] **Design-doc:** ⚠️ Spec row 00 wants **Calendar as parent** with Shows/Practices/Events **nested**
      (deep-link `/calendar?filter=…`). We deferred this — desktop still lists Shows/Practices as
      top-level primary. **Decide + (if adopting) update `persistent-layout.spec`.**
- [ ] **Regression 🚩:** MobileHeader **dropped** the always-visible email + "Connected" text (now
      offline-only dot); Sidebar **dropped** "last synced Xm ago" + "N pending" pill. Intentional per m-1/m-3
      — confirm no one relied on them. Mobile bottom nav unchanged (correct).

### Calendar → spec row 01

- [ ] **Token:** ✅ already clean.
- [ ] **Design-doc:** ✅ agenda + segmented filter present. ⚠️ `?filter=` query-param deep-link **not**
      wired (TODO left) — required only if row-00 nesting is adopted.
- [ ] **Regression:** none.

### Songs (SongsPage + EditSongModal) → rows 02 / 02·A / 02·B / 02·NOTES / 02·TUNINGS

- [ ] **Token:** ✅ swept; tuning-warmth left border via `tuningColor()` verified intact; external
      LinkIcons preserved; notes indicator personal=`info`/band=`accent`.
- [ ] **Design-doc 🚩 (context):** context chip / "My Songs default" persistence / flat catalog +
      **Source** filter / per-row provenance ("from ‹band›") — **not built** (needs context switching).
- [ ] **Design-doc ⚠️ (TUNING — NEW):** song form tuning field is still a **built-ins-only `<select>`
      writing `guitarTuning` text**. Spec now wants a **names-only select grouped Built-in/Your tunings +
      "＋ New tuning" + "Manage tunings"** actions, writing **`tuningId`** (legacy `guitarTuning` kept as
      fallback). DB is READY (`tunings` table, `songs.tuning_id` FK, 16 seeded built-ins). **App UI = the
      guitar-tuning-system pending track.**
- [ ] **Regression 🚩 (TUNING):** wiring `tuningId` must NOT drop existing songs' `guitarTuning` display
      (fallback path) and must keep the `song-tuning-select` testid + tuning-warmth color working.

### Setlists list (SetlistsPage) → row 03

- [ ] **Token:** ✅ status tones (active=accent/draft=ink-5/archived=bg-3), delete→danger.
- [ ] **Design-doc:** ✅ grid + Sets tab (Option A locked). 🚩 "On deck" pin-to-top sort + personal
      cross-band aggregation + band SourceTag not built.
- [ ] **Regression:** none (className-only).

### Setlist builder (SetlistViewPage) → row 03·BUILDER

- [ ] **Token:** ✅ section accent-tint / break dashed / remove→danger.
- [ ] **Design-doc ❓:** verify dnd-kit item row (grip/position/avatar/duration/key/tuning/notes) + Browse
      drawer against desktop-docked vs mobile-sheet frames.
- [ ] **Regression:** status badge renders via `EntityHeader`/`InlineStatusBadge` (shared) — re-check.

### Shows list + view (ShowsPage / ShowViewPage) → row 07

- [ ] **Token:** ✅ swept; delete→danger.
- [ ] **Design-doc:** ✅ status via `SHOW_TONE`. Uses custom DatePicker/TimePickerDropdown already.
- [ ] **Regression 🚩:** **`ShowStatusBadge` was refactored** (removed local `getStatusConfig` + its
      Circle/CheckCircle2/XCircle icons; now renders shared `Badge`+`SHOW_TONE`). AND **`SHOW_TONE` values
      changed** (scheduled `info`→`neutral`, completed `neutral`→`info`) to match spec row 07 — this
      **visibly recolors status badges on Shows/Home/Calendar/Events**. Eyes-on all four. Easy revert.

### Practices (PracticesPage/BuilderPage/SessionPage/ViewPage) → rows 04 / 04·LIVE

- [ ] **Token:** ✅ live chrome→`bg-0/bg-1`; tuning-change warning→`text-warn`; status via `PRACTICE_TONE`.
- [ ] **Design-doc ❓:** validate the 4 Play-Along layouts (TV/tablet-landscape/tablet-portrait/mobile)
  - up-next tuning-change pulsing dot against row 04·LIVE.
- [ ] **Regression:** none (className-only).

### Jam (JamSessionPage / JamViewPage) → row 05

- [ ] **Token:** ✅ swept; join code font-mono; LIVE indicator = accent.
- [ ] **Design-doc ❓:** validate tablet vs mobile participant-collapse against row 05.
- [ ] **Regression:** none.

### Home / Dashboard (HomePage) → row 06

- [ ] **Token:** ✅ mobile Home clean.
- [ ] **Design-doc 🚩:** **desktop two-column dashboard** (focus+agenda / stats+actions+"Your bands")
      **not built** (TODO left; needs cross-band aggregation = context switching). Mobile Home has parity;
      desktop currently reuses mobile layout.
- [ ] **Regression:** none.

### Events (EventsPage/EventDetailPage/EventCreatePage + casting/) → row 08 + EC1 + D1/D2

- [ ] **Token:** ✅ already token-clean (no-op this pass); host=accent/guest=info convention present.
- [ ] **Design-doc 🚩:** host **Casting console** (parts/grid model, List/Grid, Simple/Detailed,
      source tags) **not built**. Desktop master/detail (D1) + Access tab (D2) not built.
- [ ] **Regression 🚩:** **live legacy casting components** `MemberRoleSelector` + `SongCastingEditor`
      are still **light-themed** (raw `bg-gray-*`/`text-gray-*`) and render in flows — separate migration.
      Dead `CastingComparison` has a native `alert()` (CLAUDE.md violation).

### Friends (FriendsPage) → D3

- [ ] **Token:** ✅ clean. **Design-doc ❓:** validate against desktop parity D3 (sidebar + list).
- [ ] **Regression:** none.

### Band Members (BandMembersPage) → D3/D4

- [ ] **Token:** ✅ 105 swaps; destructive→danger. Note: page is **richer** than the mock (intentional).
- [ ] **Design-doc ⚠️:** don't down-scope to the mock; validate it still reads on-system.
- [ ] **Regression:** required-field `text-red-400` asterisk left (minor → could be `danger`).

### Settings (SettingsPage) → D4 + Settings › Tunings

- [ ] **Token:** ✅ fixed the undefined `surface-elevated` token (cards were transparent).
- [ ] **Design-doc 🚩 (TUNING — NEW):** **Settings › Tunings manager not built** — spec wants the full
      built-in/custom list + Create flow (instrument + string-count → N note pickers, name required, color
      optional) living here. Part of the guitar-tuning-system App track.
- [ ] **Regression:** the 3 e2e `Delete Account` failures are **pre-existing** (page unchanged by the
      pass) — investigate separately, not a regression.

### Notifications (NotificationsPage) + More (MorePage)

- [ ] **Token:** ✅ clean. **Design-doc ❓:** validate NotificationCenter segments + More hub sections.
- [ ] **Regression:** none.

### Auth / sign-up (AuthPages + AuthCallback) → flow 01

- [ ] **Token:** ✅ swept; toasts tokenized; `bg-surface` flash fixed; Google button intentionally
      branded-white (kept).
- [ ] **Design-doc ❓:** validate the **solo-user-without-band** path against flow 01 + flow 09
      (join/create band + context switching).
- [ ] **Regression:** auth is e2e-tested — those specs passed. Keep the dead `*Form` components out.

### C0 · Inputs & pickers (DatePicker, TimePickerDropdown, DurationPicker, dropdowns) → NEW conventions row

- [ ] **Token:** ✅ swept (shared-components agent).
- [ ] **Design-doc ❓:** validate each against the **canonical kit**: month popover (accent=selected,
      ring=today, type-to-edit), 15-min TimePicker with AM/PM chips, **anchored-menu dropdowns — no native
      `<select>`/sheet**. ⚠️ The tuning field is a **native `<select>`** — spec's C0 says use the
      anchored-menu dropdown; reconcile when the tuning picker is built.

---

# C. Consolidated MAJOR regression-risk callouts (before commit)

1. **`SHOW_TONE` recolor (shipped this pass)** — scheduled & completed swapped tones; visibly changes
   status badges on **Shows + Home + Calendar + Events**. Cosmetic, not functional. Confirm intended;
   one-line revert in `src/utils/tokens.ts`.
2. **Shell information removed** — mobile header no longer shows email/"Connected"; sidebar no longer
   shows last-synced/pending. Functional reduction (intentional per m-1/m-3). Confirm acceptable.
3. **`ShowStatusBadge` refactor** — component internals changed (now shared `Badge`+`SHOW_TONE`).
   Behavior same; verify all 4 statuses render.
4. **Tuning migration (NOT in this pass, but next)** — moving the song form from `guitarTuning` text →
   `tuningId` select is a **data-shape change**; must preserve legacy-text fallback + tuning-warmth
   color + `song-tuning-select` testid, and the DB `builtin_tuning_slug` ↔ TS `canonicalTuningId`
   alignment (⬜ pending) must land or built-in matching drifts.
5. **Calendar-parent IA (if adopted)** — changes nav routing; **breaks `persistent-layout.spec`** as-is.
6. **Config alias repoints** — `surface`/`text`/`smoke-white`/`steel-gray`/`electric-yellow`/`secondary`
   now resolve to dark tokens. Live consumers were dev/dead; re-scan if any new consumer appears.

# D. Not-built forks the spec now assumes (gaps, not regressions)

Context switching (02·A) · Source filter + provenance (02·B) · **Custom-tuning picker + Settings
manager (guitar-tuning-system App layer — DB ready)** · Casting console (EC1) · desktop dashboard
(06) · Events desktop master/detail + Access (D1/D2) · Calendar `?filter` deep-link (row 00).
