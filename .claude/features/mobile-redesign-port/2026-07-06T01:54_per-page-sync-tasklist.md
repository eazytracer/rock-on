---
feature: mobile-redesign-port
doc: Per-page sync task list — code vs the split design spec (spec-rows/, 36 sections)
created: 2026-07-06T01:54
supersedes: 2026-07-05T06:40_screen-validation-checklist.md (coarser; keep for history)
method:
  6 read-only sub-agents, each reading its spec-rows/*.html via the claude_design MCP +
  the matching src/, returning [STYLE]/[LOGIC-DATA] deltas + regression flags. Compiled here.
caveats (unchanged):
  styling-only work now; flag major logic/DB; NO schema changes; keep
  type-check + 810 unit + e2e green before/after.
baseline: UI-consistency token pass DONE + green, uncommitted on feature/events-friends-and-ui-oh-my.
---

# Read me first

Now that the spec is split into 36 readable rows (`app/spec-rows/`), we have exact per-screen
requirements. Two headlines:

1. **The token pass already closed most pure-styling gaps.** Several screens now **fully conform**
   (see Part 5). What's left splits into a **small safe [STYLE] backlog** (Part 1) and a **large
   [LOGIC/DATA] set** that is really the unbuilt feature backlog the spec assumes (Part 2).
2. **The design doc's "sync" is mostly feature work, not restyle.** Context switching, the tuning
   picker, the casting console, desktop dashboards, onboarding hierarchy, C0 anchored dropdowns —
   these are behavior/data/schema, correctly **flagged, not built** under the caveats.

**Correction to the prior checklist:** the 4 legacy casting components (`CastingComparison`,
`SetlistCastingView`, `SongCastingEditor`, `MemberRoleSelector`) are **all dead** — they only import
each other; nothing on a route reaches them. (Earlier I flagged two as "live" — wrong.)

Legend: `[STYLE]` safe now · `[STYLE⚠]` styling but carries test/behavior risk · `[LOGIC/DATA]` flag,
don't build · `[SCHEMA]` needs a migration (hard no this pass) · `[BUG]` correctness/guardrail ·
✅ already conforms.

---

# Part 1 — Safe-now [STYLE] backlog (the actual "make UI changes" list)

Ordered roughly by value/effort. Each is a real, low-risk styling task under the caveats.

### Songs (`SongsPage.tsx`, `SongNotesModal.tsx`, `MarkdownField.tsx`)

- [ ] `[STYLE]` Active-tab tinting: **My Songs active → `info`**, **Band active → `accent`** (today both render `bg-accent`). Add the context chip by the title (personal=`info`/band=`accent`) from AuthContext.
- [ ] `[STYLE]` `MarkdownField` gains an `accent|info` color variant prop (default = current) so the **personal** notes field reads blue per spec; band stays accent. Shared comp — default must not change EditSongModal.
- [ ] `[STYLE]`(gated) Notepad 4-state **rendering** (grey none / `info` personal / `accent` band / gradient both incl. the `#notesBoth` linearGradient). _Rendering is style; the state computation is [LOGIC/DATA] — see Part 2._

### Jam Live (`JamSessionPage.tsx` / `JamSessionCard.tsx`)

- [ ] `[STYLE]` Add the prominent red pulsing **LIVE** pill (`danger-soft`/`danger`) to the session header (spec row 12). Everything else here already conforms.

### Events / Casting (`EventsPage.tsx`, `EventDetailPage.tsx`, `EventCreatePage.tsx`) — data mostly exists

- [ ] `[STYLE]` **Source-tag pills** per lineup item (mine=`accent`/band=`info`/public=`success`/external=neutral "Not linked") — DB `source` column already populated, render-only.
- [ ] `[STYLE]` **Cast-progress bar** ("7 of 16 parts · 44%") from existing assignment counts.
- [ ] `[STYLE]` Detail **tabs scaffold** (Lineup · Requests(badge) · People · Access) — Lineup/Requests wired today; People/Access can be present-but-stubbed.
- [ ] `[STYLE]` **Instrument color spine** on role rows (gtr=blue/bass=purple/drums=red/vox=accent tinted squares+icons) via `INSTRUMENT_COLOR`; host=`accent`/guest=`info`.
- [ ] `[STYLE]` EventsPage cards → **date-tile + avatar-stack** shape; rename **"New" → "Host"**.

### Band Members (`BandMembersPage.tsx`) — the biggest remaining off-token page

- [ ] `[STYLE]` Tokenize default-palette badges the hex pass missed: `bg-blue-500/20 text-blue-400`→`info`, `bg-yellow-500/10 text-yellow-400`→`warn`, `text-red-400`→`danger`. Route role/status through the shared `Badge` (drop bespoke `getRoleBadge`).
- [ ] `[BUG]` Replace the bespoke inline toast (`toastMessage` + setTimeout) with `useToast`.

### Settings (`SettingsPage.tsx`)

- [ ] `[STYLE]` Tokenize legacy classes (`bg-blue-500/10`→`info-soft`, `border-white/5`→`border-border-1`). `surface-elevated` token already added.
- [ ] `[BUG]` L86 `confirm('Clear all local data?')` → `useConfirm`/`ConfirmDialog` (CLAUDE.md native-dialog ban).

### Setlist builder (`SetlistViewPage.tsx`, `SetlistEditorPage` in `SetlistsPage.tsx`)

- [ ] `[STYLE]` `BrowseSongsDrawer` → **desktop-docked panel / mobile bottom-sheet** (today a 480px overlay on all viewports).
- [ ] `[BUG]` `SetlistEditorPage` L953 `prompt('Enter section title:')` → themed modal (port the one `SetlistViewPage` already uses).
- [ ] `[STYLE]`(opt) `SetlistCard.getStatusColor` → route through `SETLIST_TONE`/`Badge` (currently hardcoded, matches visually but diverges from the token source).

### Shows / Toasts / Onboarding cleanup

- [ ] `[STYLE]` `ScheduleShowModal` setlist-attach copy → the spec's fork hint ("A copy is forked — edits here won't change the original").
- [ ] `[STYLE]` `ToastContext` colors → semantic `info/success/danger` tokens (today raw `green-500/red-500/blue-500`); mobile placement top-full-width below header.
- [ ] `[STYLE]` `AuthPages` — remove the unused local `Toast` component (L313-343); use `useToast`. Tokenize the GoogleButton's `#2a2a2a/#1a1a1a` (or keep as intentional brand — confirm).

---

# Part 2 — Flagged [LOGIC/DATA] forks (spec assumes these; DO NOT build without a call)

Grouped by feature; each notes whether it needs schema.

1. **Multi-band context switching** (rows 02·MULTI-BAND, 05, 08, 13, 09) — the backbone. Global
   `{personal | band:id}` context, persisted per user, scoping Songs/Setlists/Shows/Practices.
   Drives: Songs **default→My Songs** flip (⚠ e2e + band-less interaction), Setlists **cross-band
   aggregation + SourceTag**, **desktop dashboard** union, Notifications **cross-context switch**,
   the context chip's real behavior. Builds on existing `useBands()`/`currentBandId`. **No schema.**
2. **Custom tunings — App layer** (row 02·TUNINGS) — DB is DONE (`tunings`, `songs.tuning_id`, 16
   seeded, pgTAP 882). Pending: expand `tunings.ts` with per-string MIDI; align TS
   `canonicalTuningId` ↔ SQL `builtin_tuning_slug`; rebuild the song-form field as a grouped
   names-only **anchored menu** writing `tuningId` (legacy `guitarTuning` as fallback); **Settings ›
   Tunings** manager + create flow (instrument + string-count → N note pickers). **No schema** (table
   exists). ⚠ Regression: preserve `song-tuning-select` testid + warmth color + text fallback.
3. **Catalog provenance & Source filter** (row 02·CLEANUP) — flat catalog ✅; but "from ‹band›"
   provenance text, the **Source** filter (All/Original/From band/Hidden), and kebab **Hide/Re-add**
   need a **`hidden` field on the personal mirror → [SCHEMA]** + band-name lookups. Hard no this pass.
4. **Song-notes notepad state** (row 02·NOTES) — the 4-state color needs per-row personal-note
   presence (batch `usePersonalNote` to avoid N-queries). Data/logic, **no schema**.
5. **Casting console** (rows EC1/EC2/D2/D3, flows 06-08) — parts model `{instrument,label}`,
   Simple/Detailed, **Grid** matrix, **raise-a-hand** (zero backing today → needs a **hands table
   [SCHEMA]**), **request→resolve** (link to catalog vs external), **Access** tab (needs
   `allow_suggestions`/`auto_approve` **[SCHEMA]** + QR), count aggregates in `useEvents`. Biggest
   build. ⚠ Don't mutate shared `SongCastPanel` (setlist casting uses it) — add event-specific comps.
   ⚠ Spec conflict: row 15 says "no casting in main app" vs EC rows spec it as event-detail — **confirm target**.
6. **Practice enrichment** (row 04) — `type` dropdown, `objectives[]` chips, `sessionRating` stars,
   `completedObjectives` → all **[SCHEMA]**. Play-Along itself ✅ conforms.
7. **Sidebar Calendar-parent IA + Calendar `?filter=` deep-link** (rows 00, 01) — nests
   Shows/Practices/Events under Calendar routing to `/calendar?filter=…`. ⚠ **Breaks
   `persistent-layout.spec`** (asserts shows-link→/shows, practices-link→/practices) + changes nav
   semantics. Routing change, coordinate an e2e update. **No schema.**
8. **Shows→Calendar-filtered IA** (row 14) — converge the standalone `/shows` list into the Calendar
   segmented agenda. Large IA; ties to #7.
9. **Desktop two-pane / dashboards** (rows 06, D1, D4) — desktop Home two-column, Events master/detail,
   Settings left-nav ↔ pane, Friends right-rail. Net-new layouts; Home also needs #1's aggregation.
10. **Settings/onboarding data** (rows 10, 11, FLOW-09) — profile display-name edit, **per-band
    "Auto-add band songs to My Songs" toggle**, theme selector, and the one-time **auto-add prompt
    modal** on join/create — need a settings field. **Onboarding hierarchy flip**: make **"Just me"
    (solo) the top, first-class option** (today it's a buried bottom link) — lighter UX reorder but
    changes the primary path; preserve testids.
11. **Notifications cross-context** (row 09) — item names its band/event + opening switches context
    (depends on #1).

---

# Part 3 — Cross-cutting

- **C0 anchored `<Dropdown>` (row 21) — `[STYLE⚠]`, cross-cutting.** Spec mandates "anchored menu,
  **never native `<select>`.**" There are **24 native `<select>`s across 15 files** (SetlistsPage ×5,
  SongsPage ×3, ShowsPage ×2, BrowseSongsDrawer ×2, + Practices/ShowView/Jam/EditSong/SessionForm/
  SongContextTabs/EditableField/InlineEditableField, and 2 in dead casting comps). **Sequence:** build
  ONE reusable grouped anchored `<Dropdown>` (mono eyebrows, check on active, ▾→▴), add stable
  `id`/`data-testid`, migrate incrementally, update the e2e that use `selectOption` per file. **Do not
  bulk-swap** — element-type change breaks Playwright select semantics. This is also the unlock for the
  tuning picker (#2) and Songs Source filter.
- **C1 realtime toasts (row 22) — mostly EXISTS.** `RealtimeManager` already fires info toasts for
  song/setlist/show/practice changes, skips own edits, batches. Only the **[STYLE]** token retune +
  mobile placement (Part 1) is needed. Note the two overlapping paths (audit-gated vs `@deprecated
queueToast`) — a data-layer cleanup, not styling.
- **Native-dialog `[BUG]`s:** `SettingsPage:86 confirm()`, `SetlistEditorPage:953 prompt()`
  (`CastingComparison` `alert()` is in dead code). Fix the two live ones.
- **Dead code (mention, don't delete):** `components/setlists/SetlistBuilder.tsx` (35 KB),
  `ShadowEntry.tsx`, the 4 legacy casting comps, the unused `AuthPages` local `Toast`.
- **Dual implementations (structural debt):** Setlists (grid + `SetlistViewPage` route + inline
  `SetlistEditorPage`), Shows (`ScheduleShowModal` edit-only + `ShowViewPage` create at `/shows/new`),
  Practices (`PracticeBuilderPage` + `PracticeViewPage` isNewMode). **Any design pass must touch all
  copies or consolidate first** — confirm which owns each route before editing.

---

# Part 4 — Regression register (guard on every change)

1. **`SHOW_TONE`** is one source for Calendar/Shows/Home/Events — currently spec-correct (scheduled=
   neutral, completed=info). Don't touch again; a change ripples 4 surfaces. (This pass already set it.)
2. **Native `<select>`→Dropdown** (24 sites) breaks Playwright `selectOption`. Migrate per-file w/ ids.
3. **Songs default-context flip** breaks e2e asserting Band-default + interacts with band-less (null
   `currentBandId`).
4. **Sidebar Calendar-parent IA** breaks `persistent-layout.spec` (shows/practices links + routes).
5. **Tuning `guitarTuning`→`tuningId`** — keep text fallback + `song-tuning-select` testid + warmth
   color; align TS `canonicalTuningId` ↔ SQL slug or built-in matching drifts.
6. **`SongCastPanel` is shared** with setlist casting (`contextType`) — add event comps, don't mutate.
7. **Preserve testids** on BandMembers/Settings/Onboarding while retinting/reordering.
8. **Dual implementations drift** — style all copies or consolidate.

---

# Part 5 — Screens that already fully conform (✅ no action)

- **Practice Session Play-Along** (row 11): 4 viewport layouts, tuning-change warning, transport — all match.
- **Calendar** (row 01): row anatomy, segmented filter, dual-CTA empty state (only `?filter=` deferred).
- **Setlists list + builder** (rows 03): aspect-square cards, status pills, dnd items, context-scoped
  Browse, clone-on-add — match (only aggregation/on-deck/dock deferred).
- **Schedule a show** (row 07): all fields, custom pickers, status via SHOW_TONE, setlist fork-on-attach.
- **Jam Live** (row 12): Setlist/Common tabs, mobile participant collapse, join-code+QR, end-confirm (only LIVE badge to add).
- **More hub** (row 10): band identity card, account row, feature groups, version footer — excellent match.
- **Friends** (row 18) + **Notifications** (row 18): token-clean; match (only cross-context switch deferred).
- **Event create** (row 15): name/date/venue form — matches (desktop-modal minor).
- **C0 Date/Time pickers** (row 21): DatePicker + TimePickerDropdown match.
