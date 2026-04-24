# UI Component Audit

**Created:** 2026-04-03T01:58  
**Purpose:** Identify consolidation opportunities before building new jam session UI

---

## Top Consolidation Priorities

### 1. KebabMenu — 7–8 hand-rolled implementations

Every page rolls its own: `<button><MoreVertical/></button>` + `fixed inset-0 z-10` backdrop + `absolute right-0 top-8 w-40/48 bg-[#1f1f1f] rounded-lg` dropdown. ~30–40 lines of near-identical JSX each time, with inconsistencies:

- Dropdown bg: `#1f1f1f` (SongsPage, SongListItem) vs `#1a1a1a` (all others)
- Backdrop z-index: `z-10`, `z-40`, or **absent** (ShowsPage, PracticesPage — closes unreliably)
- Dropdown width: `w-48` vs `w-40`
- Mobile BandMembersPage card: dropdown render block is missing entirely
- No shared component exists. Every new feature will add another hand-rolled copy.

**Files:** `SongsPage` (×2 desktop+mobile), `SetlistsPage`, `ShowsPage`, `PracticesPage`, `BandMembersPage` (×2), `SongListItem`

### 2. EmptyState — 9+ inline patterns, inconsistent

Pattern repeats: icon (32–48px, opacity-30) → headline → subtext → optional CTA. But padding, icon size, icon opacity, and button styling vary across every occurrence. No shared component exists.

**Files:** `SongsPage`, `SetlistsPage`, `ShowsPage`, `PracticesPage`, `JamSessionPage` (×2 panels), `SetlistViewPage`, `PracticeViewPage`, `BrowseSongsDrawer`

### 3. TabSwitcher — 2 implementations (will grow)

Both SongsPage (Band/Personal tabs) and JamSessionPage (Common Songs/My Song Queue tabs) use the identical pill-container tab pattern but implement it separately. Notably, JamSessionPage uses two different active colors (`amber-500` vs `#f17827ff` orange) for its two tabs — an inconsistency within the same page.

**Files:** `SongsPage`, `JamSessionPage`

### 4. Modal Shell — 10+ bare implementations

Pattern: `fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4` + `bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md`. No `<Modal>` wrapper component. `ConfirmDialog` exists and works but 4 pages built custom confirmation modals from scratch.

**Violation files (using `window.confirm`/`window.alert`/`prompt()` instead of ConfirmDialog):**

- `EditableHeader.tsx` — `window.confirm` on nav away
- `CastingComparison.tsx`, `SetlistCastingView.tsx`, `SongCastingEditor.tsx` — all use `window.confirm`
- `SetlistsPage.tsx` line 952 — uses `prompt()` for section title input

### 5. SearchBar — exists but wrong theme, unused

`src/components/common/SearchBar.tsx` uses **light theme** (`bg-white`, `border-gray-300`, blue focus rings). Every page rolls its own dark-themed search input inline. The existing component needs to be rewritten to match the dark theme and adopted across all 6+ pages that each have their own search input.

### 6. SongAvatar + generateAvatarColor/generateInitials — duplicated in 4 files

The colored circle avatar with artist initials appears in every song list, setlist item, browse drawer, and member row. The helper functions `generateAvatarColor` and `generateInitials` are duplicated verbatim in `SongListItem`, `BrowseSongsDrawer`, `SetlistsPage`, and possibly more.

### 7. StatusBadge — 3 separate implementations

`InlineStatusBadge` (editable, for view pages), `ShowStatusBadge` (component, read-only for shows list), and inline `getStatusBadge()` functions in `PracticesPage` and `SetlistsPage`. Should be one `<StatusBadge status variant />` for read-only display.

### 8. DarkCard container — 25+ hardcoded instances

`bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5` appears as a literal Tailwind string ~25+ times. A `<DarkCard>` wrapper (or a Tailwind `@apply` class `.dark-card`) would eliminate this.

---

## Stale / Misaligned Design Specs

| Spec File                                     | Issue                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `2025-10-22T14:01_design-style-guide.md`      | Lists `#3b82f6` (blue) as primary accent. App has evolved to use `#f17827ff` (orange) as the primary brand/CTA color. Needs updating. |
| `2025-10-22T22:28_app-pages-and-workflows.md` | Pre-database integration. Likely describes flows that no longer match the current UI.                                                 |
| `2025-10-22T22:59_functional-mvp-spec.md`     | Correctly lists orange as brand color but is otherwise pre-sync-engine and stale for most feature specs.                              |

---

## Orphaned / Problematic Components

| Component                                         | Issue                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/components/songs/SongCard.tsx`               | `SongsPage` defines its own inline `SongCard` — this file likely orphaned                                                  |
| `src/components/songs/SongList.tsx`               | Replaced by inline code in `SongsPage` — likely orphaned                                                                   |
| `src/components/songs/SongContextTabs.tsx`        | `SongsPage` does this inline — likely orphaned                                                                             |
| `src/components/songs/SongLinkingSuggestions.tsx` | Usage unclear — likely orphaned                                                                                            |
| `src/components/common/SearchBar.tsx`             | Wrong theme — not used anywhere meaningful                                                                                 |
| `src/components/common/Header.tsx`                | Legacy header using CSS class names, not Tailwind                                                                          |
| `src/components/common/TouchButton.tsx`           | Uses old brand color tokens (`energy-orange`, `amp-red`) not in the current design                                         |
| `src/services/database/SetlistBuilder.tsx`        | Full white/light-themed legacy component. Dark theme setlist editing now done via `SongListItem` + `EntityHeader` pattern. |

---

## Jam Session Page — Current Structure for Reference

**Landing state** (no `sessionId`):

- "Your Active Sessions" amber resume cards
- Create/Join 2-column grid

**Active session state**:

- `JamSessionCard` (full width, session info)
- 3-col grid: `JamParticipantList` (1/3) + tab panels (2/3)
- Tab 1 — "Common Songs": renders `<JamMatchList>` (read-only, no setlist building)
- Tab 2 — "My Song Queue": host's manually queued songs, editable list

**Key gap for new UI:** Common Songs panel is fully read-only. There is no setlist builder — no way to accept matched songs into an ordered list, no participant nominations, no "this is what we're playing tonight" output. The "Save as Setlist" button flattens queue+matches into a setlist in one shot with no curation step.

---

## Recommended Build Order Before New Jam UI

Build these components first. Each one is used directly in the new jam setlist builder.

| Order | Component            | Why needed for jam                                     |
| ----- | -------------------- | ------------------------------------------------------ |
| 1     | `KebabMenu`          | Setlist song rows will have kebab actions              |
| 2     | `EmptyState`         | Every new panel in the jam UI will have an empty state |
| 3     | `TabSwitcher`        | Refactor existing jam tabs, add new "Setlist" tab      |
| 4     | `QueueSongRow`       | Lightweight reorderable row for setlist in progress    |
| 5     | `SongAvatar` utility | Used in QueueSongRow and everywhere else               |

`Modal` and `DarkCard` are lower priority — can be addressed in a subsequent cleanup pass.
