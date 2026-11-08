# 02 · Components: kit → this codebase

Kit catalog: `source/Components.html` and `source/kit/rock.css` (classes are `r-` prefixed) in the design project.
Verdicts: **keep** (restyle via tokens only) · **restyle** (markup/classes change, API stays) · **replace** · **new**.

## Primitives

| Kit | What it is | Here | Verdict |
|---|---|---|---|
| `r-btn` (+ `pri`, `out`, `text`, `dng`, `lg`, `xl`, `back`, `w`) | Pill button, 44 / 52 / 60 px | `common/TouchButton.tsx` + ad-hoc `<button>`s | **restyle** `TouchButton` into a `Button` with `variant` + `size`; migrate ad-hoc buttons as screens are touched |
| `r-ib` | 44 px round icon button, optional badge dot | ad-hoc | **new** `IconButton` (requires `aria-label`) |
| `r-chip` (+ `on`) | Filter chip, 38 px, outlined → filled when on | ad-hoc in pages | **new** `Chip` |
| `r-seg` | Segmented control | `common/TabSwitcher.tsx` | **restyle** |
| `r-sw` | Switch, 50 × 30 | ad-hoc | **new** `Switch` (role="switch") |
| `r-radio` | Radio dot | ad-hoc | **new** |
| `r-step` | − value + stepper | `common/DurationPicker.tsx` | **restyle** |
| `r-tp` | Tuning pill (tinted, coloured label) | `common/MetaPill.tsx` + tuning colour code in `SongListItem` | **new** `TuningPill` reading the tuning colours (01 §7) |
| `r-lk` | 30 px outlined link tile, typed glyph | `songs/LinkIcons.tsx` | **restyle**: Tabs yellow, Spotify green soundwave, YouTube red filled play, Lyrics, Cloud, Link; 44 px hit area |
| `r-nm` | Notes mark (band / mine / both) | `songs/ExpandableSongNotes` shows content | **new** small mark; grey, never accent |
| `r-ty` | Event-type label (icon + word) | `utils/tokens.ts` `SHOW_TONE` etc. | **replace** with `TypeLabel type="show|practice|jam"` |
| avatars | Person: photo or initials on neutral grey. Band mark: initials on one of 8 colours, symbol, or photo | `common/Avatar.tsx`, `songs/SongAvatar` | **restyle** `Avatar`; **new** `BandMark` |

## Patterns

| Kit | Here | Verdict |
|---|---|---|
| `r-grp` + `r-gl` (group surface + mono label, rows divided) | `common/SectionCard.tsx`, `MetadataSection` | **restyle** `SectionCard` to the group pattern; label is mono 10.5 uppercase with an optional trailing action ("+ ADD", "EDIT SET") |
| `r-item` list row (lead, title, sub, trail) | various | **new** `ListRow` |
| `r-fld` field row (label above value, focus ring) | `common/InlineEditableField.tsx` | **restyle**: edit-in-place pages use this |
| `r-sr` **song row** | `common/SongListItem.tsx` (479 lines), `songs/SongCard.tsx` | **replace**. Line 1: grip + number (ordered lists only) · title · artist · notes mark. Line 2: tuning pill → time → key (#) → BPM (pulse), then ≤ 2 link tiles right. Comfortable / Compact. No ⋯ button: tap opens; swipe left = 2 quick actions; long-press = full menu (catalog) or lift (setlist). Desktop: hover actions + right-click menu. See `demo/screens/Song Row.html` |
| `r-retune` | — | **new**: "RETUNE ‹from› → ‹to›" line between songs whose tuning differs, with Tune |
| `r-brk`, `r-sec` | setlist break / section | in `SetlistViewPage` | **restyle**; breaks default 15 min with optional note |
| `r-tot` totals line | setlist header | **restyle**: songs · min · retunes · "52 of 45 min" when attached to a show (over = warn) |
| `r-facts` | song/practice facts (TUNING / KEY / BPM / LENGTH) | `common/ScheduleMetaRow`, `MetadataCard` | **restyle** |
| `r-kick` + display title | page kicker + big title | `common/EntityHeader.tsx`, `ViewPageHeader.tsx` | **restyle** to Big Shoulders 800 caps |
| `r-search` | search field | `common/SearchBar.tsx` | **restyle** |
| `r-fab` | floating pill action above the nav, label follows context ("New show") | in pages | **new** `Fab` |
| `r-nav` | bottom nav: Home · Songs · Setlists · Calendar · More | `common/BottomNavigation.tsx` | **restyle** (already the same five tabs) |
| `r-ab` app bar with context chip + bell | `layout/MobileHeader.tsx` + `ContextSwitcher.tsx` | **restyle**: chip opens a **dropdown anchored to it**, not a sheet |
| desktop sidebar | `layout/Sidebar.tsx` | **restyle** IA: context chip, Search ⌘K, Home · Songs · Setlists · Calendar · Jam, TOOLS (Tuner, Metronome, Chords), BAND (Members & profile), YOU (Friends, Settings), footer: you, theme, bell. Drop the separate Shows / Practices / Events items (Calendar filters) |

## Overlays

| Kit | Here | Verdict |
|---|---|---|
| `r-sheet` bottom sheet (picks, row menus, notes over a stage screen) | `common/SlideOutTray.tsx` | **restyle** into `BottomSheet` (grab handle, 28 px top radius, swipe-down / × / scrim close). Desktop: render as an anchored menu or centred dialog depending on job |
| `r-dlg` destructive confirm that names the consequence | `common/ConfirmDialog.tsx` + `useConfirm` | **restyle**; add `typedConfirmation` for delete account / delete band |
| `r-toast` (+ Undo) | `contexts/ToastContext.tsx` | **restyle**: one line, optional Undo; bandmates' changes go in a grouped banner instead (spec C1) |
| `r-banner` (info / warn / alert) | `sync/OfflineIndicator.tsx`, `SyncStatusIndicator` | **restyle**: one offline banner at the top of a list; remove per-row `SyncIcon` |
| `r-empty` | `common/EmptyState.tsx` | **restyle**: icon tile, title, one-line why, the action |
| `r-skel` skeleton rows | `common/LoadingSpinner`, `ContentLoadingSpinner` | **new** `SkeletonRow` in the real row shape; lists stop using spinners |
| error + Retry card | ad-hoc | **new** `RetryCard` |
| unsaved changes dialog naming the changes | `common/UnsavedChangesDialog.tsx` | **keep**, restyle |

## Pickers (C0, in the kit as `source/kit/pickers.js`)

Never native date / time inputs or `<select>`.

| Kit | Here | Verdict |
|---|---|---|
| `RP.date` month calendar (accent = selected, ring = today; typing a digit flips to MM/DD/YYYY) | `common/DatePicker.tsx` | **restyle** |
| `RP.time` Google-Calendar list in 15-min steps, scrolled to the value; typing flips to entry with AM/PM | `common/TimePickerDropdown.tsx` | **replace** (supersedes Hour · Min · AM/PM columns) |
| `RP.end` End time list after Start, each with its duration "9:00 PM (2 hrs)", past midnight allowed | — | **new** (practices store duration; this edits it as an end time) |
| `RP.menu` anchored, grouped, check-marked menu with optional lead + count | `common/Dropdown.tsx`, `KebabMenu.tsx` | **restyle** |
| Key picker: circle of fifths (major outside, minor inside) | `songs/CircleOfFifths.tsx` | **keep**, restyle to the demo |
| Tuning picker sheet sorted by pitch, strings listed, + New tuning, Manage | `tunings/TuningsSection.tsx` | **restyle** |

## Stage components (64 px targets, wake lock)

| Kit | Here | Verdict |
|---|---|---|
| `r-pager` 96 px Back / Next naming the destination | `practice/FooterNextPreview.tsx` | **restyle** |
| Up next card (neutral; yellow + Tune now on a tuning change) | in `PracticeSessionPage` | **new** component |
| Chart reader, chord viewer, starting-note sheet, tuner, metronome, custom tuning neck | — | **new** (see 03-screens, Tools and Chart) |
