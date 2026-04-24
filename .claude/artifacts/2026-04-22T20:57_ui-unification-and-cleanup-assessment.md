---
created: 2026-04-22T20:57
appended: 2026-04-22T21:05
prompt_summary: >
  Revisit UI unification and cleanup plans. Audit pages for consistency and
  component reuse; redesign the practice viewer for monitor/TV, tablet, and
  mobile; add a markdown view/edit toggle everywhere notes are entered;
  introduce a fixed tuning color system on song cards. Deliver a consolidated
  list of proposed updates and open questions — no code changes to the
  functioning app yet.
status: preview-approved / implementation-in-progress
---

## Decisions (locked 2026-04-22T21:05)

Answers from product review, used as inputs to the mock preview and
subsequent PRs:

1. **Practice viewer layout switching** — auto-default by aspect ratio
   (`min-width: 1280px AND min-aspect-ratio: 3/2` → TV mode); plus a manual
   icon toggle in the session header that persists choice to localStorage.
2. **Font size in session** — small / medium / large toggle icon in the
   session header, persisted to localStorage.
3. **Sidebar in active session** — hidden on ALL viewports (not just TV).
   `PracticeSessionPage` goes truly full-screen. Implement via a
   layout-skip prop on the protected route or a portal — must not touch
   `ModernLayout` or the auth guard.
4. **Markdown field default state** — idle opens in rendered view with a
   pencil icon overlay. Click pencil → edit mode. Save via click-out or an
   explicit check button. Unsaved changes trigger a **blocking** confirm
   dialog on close/route-change. This pattern must also extend to
   `EditSongModal` (add and edit) and setlist edit flows — users have been
   bitten by assuming auto-save.
5. **Per-song session notes** — stay plain-text single-line (150 chars). No
   markdown.
6. **New Song modal** — remove band-notes field entirely. Notes are added
   from the song detail/edit view after creation.
7. **Tuning color treatment** — multiple options to prototype in the mock:
   icon-only, left-border stripe, pill, and stripe+icon combo. Architect
   the color lookup as a **registry** (built-in canonical tunings + future
   user-defined tunings with optional per-color override) — no hardcoded
   hex scattered in components. Custom tuning feature is coming.
8. **Standard tuning color** — NOT neutral gray. All tunings get unique,
   identifiable colors so users can locate the tuning marker at a glance.
9. **Hex palette** — finalize during mock preview review.
10. **Mock preview route** — build at `/dev/ui-preview` (dev-only), shows:
    - Practice viewer TV/tablet/mobile layouts side-by-side with font toggle
    - Tuning color treatment variants × palette variants on a mixed setlist
    - MarkdownField render→edit→save behavior + unsaved-changes dialog
    - Unified `<SectionCard>` / `<SongSection>` before-after
11. **Phasing** — proceed in the order: (PR1) safe refactor + orphan removal,
    (PR2) markdown rollout + unsaved-changes guard, (PR3) tuning colors,
    (PR4) practice viewer responsive + full-screen session. Unsaved-changes
    dialog gets its own unified implementation early so all surfaces can
    adopt it.

### Cross-cutting additions discovered during review

- **Unsaved-changes guard** is larger than "markdown rollout" — it's a
  cross-cutting UX fix for EditSongModal (add/edit), setlist edit, and the
  new MarkdownField. Shared `useUnsavedChanges()` hook + blocking
  `<UnsavedChangesDialog>` component. Blocking confirm is the chosen flavor.
- **Full-screen session** requires a way to opt out of `ModernLayout` on a
  per-route basis. Simpler than a portal: add an `isFullscreen` flag to
  `ProtectedLayoutRoute` route config, or move the session route outside
  the `ModernLayout`-wrapped block while keeping auth protection.

# UI Unification & Cleanup Assessment

## 1. Scope and method

Scope covers Songs, Setlists, Shows, Practices (builder + live session), the
song modals, and the shared note components. Findings are grounded in direct
reads of the current source:

- `src/pages/PracticeViewPage.tsx`, `PracticeSessionPage.tsx`
- `src/pages/SetlistViewPage.tsx`, `ShowViewPage.tsx`, `SongsPage.tsx`
- `src/components/common/SongListItem.tsx`, `EntityHeader`, `InlineEditableField`
- `src/components/songs/{EditSongModal,NewSongModal}.tsx`
- `src/components/notes/{MarkdownEditor,MarkdownRenderer}.tsx`
- `src/components/setlists/SetlistBuilder.tsx` (legacy, light-themed)

**Note on screenshots:** The Playwright browser tool was blocked in this
session. Findings below are code-grounded — if we want visual deltas, we can
capture them in a follow-up once the browser tool is available, or I can
generate them from a focused script that writes PNGs directly.

**Prior art referenced:**

- `.claude/artifacts/2026-04-03T01:58_ui-component-audit.md` — consolidation
  backlog (KebabMenu, EmptyState, Modal, SearchBar, etc.). Many items there are
  still open and feed into this pass.

---

## 2. Cross-page consistency — small-ticket cleanup

The Setlist / Show / Practice view pages already share `EntityHeader`,
`InlineEditableField`, `SongListItem`, and `BrowseSongsDrawer`. That is the
foundation — below are the remaining rough edges where each page still rolls
something slightly different.

### 2a. "Start" call-to-action button (view pages)

| Page               | CTA                       | Styling                                             |
| ------------------ | ------------------------- | --------------------------------------------------- |
| `PracticeViewPage` | "Start Practice Session"  | Orange gradient, full-width, shadow, icon — bespoke |
| `SetlistViewPage`  | "View in Jam Mode" / play | Different treatment                                 |
| `ShowViewPage`     | (none / different layout) | —                                                   |

**Proposal:** lift the practice "Start" button into a shared
`<PrimaryActionBanner>` (icon + label + gradient) so every view page gets the
same hero action presentation when there's a meaningful "go live" step.

### 2b. Details / Wrap-up notes cards

Practice has two separate cards ("Details" and "Wrap-up Notes"). Setlist and
Show use the same `bg-[#121212] border border-[#2a2a2a] rounded-lg p-4 sm:p-6`
container with an `h2` title. This is already 90% consistent — the asks:

- Extract a shared `<SectionCard title="...">` (replaces the raw `<div>` +
  inline Tailwind + `<h2>`). Same pattern appears in at least 8 places across
  view pages.
- The heading weight/spacing differs subtly between pages (`mb-4` vs `mb-3`,
  `text-lg` vs `text-xl` in a couple of spots). Normalize.

### 2c. Song section divider + "Add Songs" button

All three view pages (`Setlist`, `Show`, `Practice`) render the same pattern:
`border-t` divider → `h2` with count → orange "+ Add Songs" button → either the
empty state or a `SongListItem` list. They are close but not identical — tidy
up into a `<SongSection>` wrapper that takes `{ items, isEditing, onAdd,
onReorder, ...handlers }` and renders the consistent header + empty state +
sortable list.

This is the single biggest duplication wedge in the view pages. It also lets us
finally collapse the three empty states (ListMusic icon + copy variations) into
one.

### 2d. Orphan / inconsistent modal

`NewSongModal.tsx` is unused (no imports found). It also uses the legacy blue
palette and `console.log` placeholder submit. `EditSongModal` already handles
both add and edit modes — delete the orphan in the same cleanup pass.

### 2e. Tuning vocabulary mismatch

`NewSongModal` vs `EditSongModal` disagree on tuning labels:

- `"Standard (EADGBE)"` vs `"Standard"`
- `"Half Step Down"` vs `"Half-step down"`
- `"Whole Step Down"` vs `"Whole-step down"`

Pick one canonical list (see §5) and extract to `src/utils/tunings.ts`.

### 2f. Remaining items from the April 3 audit that still apply

Pull these into the same cleanup batch since they overlap with the surfaces
above:

1. `SearchBar` — still light-themed and unused; pages still roll their own.
2. Hand-rolled kebab menus — `SongListItem` and several pages each have their
   own dropdown implementation.
3. `DarkCard` / `SectionCard` — same bg/border/rounded string literal appears
   dozens of times.

---

## 3. Practice Session Viewer — responsive redesign (biggest item)

**File:** `src/pages/PracticeSessionPage.tsx`

### 3a. Current anatomy (all viewports)

```
┌─ Header (back | title+artist | timer)                 ~68px ─┐
├─ Progress dots                                        ~24px ─┤
├─ Metadata chips row (centered, fixed-height cards)    ~72px ─┤
├─ Reference links row                                  ~32px ─┤
├─ Band Notes panel  (max-w-2xl, centered)        flex-1      │
└─ Navigation (prev | next-preview | next/end)          ~72px ─┘
```

### 3b. Problems on a wide landscape monitor / TV

1. The metadata chips and reference links are **centered in a narrow column**
   (notes are `max-w-2xl ≈ 672px`) — on a 1920×1080 TV the notes use maybe 35%
   of screen width, with large empty margins on either side.
2. Header, dots, metadata row, and nav together eat ~270px of vertical space
   out of 1080 — close to 25% — before lyrics/chords get any room.
3. Metadata is horizontal and repeats every song change; a fixed sidebar would
   be far more useful as a glanceable reference while eyes are on the notes.
4. Next-song tuning warning is a small amber chip buried in the nav row; on a
   TV a band member glancing over won't catch it.

### 3c. Proposed three-tier layout

Driven by viewport class, not just breakpoints — we should sniff width
**and** aspect ratio so a tablet in landscape gets the tablet layout, not the
TV layout.

**TV / monitor (landscape, ≥ 1280px wide, aspect ≥ 1.5):**

```
┌────────────────────────────────────────────────────────────────────┐
│ ←  PRACTICE • Song 3 of 12 •  22:14 elapsed                  ✕ Exit│  ~48px
├─────────────────────┬──────────────────────────────────────────────┤
│ Wonderwall          │                                              │
│ Oasis               │                                              │
│                     │                                              │
│  KEY   Em           │            BAND NOTES                        │
│  TUN   Drop D  (●)  │       (lyrics / chords / cues)               │
│  BPM   86           │            — full width, full height —       │
│  ⏱    4:18         │                                              │
│                     │                                              │
│  [YT] [Tabs] [Spot] │                                              │
│                     │                                              │
│ ─────────────────── │                                              │
│ NEXT  (●) Drop D    │                                              │
│ Champagne Supernova │                                              │
│ Oasis  ·  Em  ·  82 │                                              │
│                     │                                              │
├─────────────────────┴──────────────────────────────────────────────┤
│  ◀ Prev        ● ● ● ● ● ○ ○ ○ ○ ○ ○ ○            Next ▶ / End ✓  │  ~64px
└────────────────────────────────────────────────────────────────────┘
```

Left rail ≈ 280–320px, Notes panel takes the remainder. Metadata is stacked
vertically on the left and persists without fighting the notes for horizontal
space. The tuning dot (●) in the left rail and next-song preview use the §5
tuning color — a changed tuning is visible from across the room without
reading.

**Tablet (600–1279px, or landscape tablets):**

Keep the current single-column flow but:

- Collapse header+progress into one 40px row (title/artist can be an overline
  over the notes panel rather than its own row).
- Widen notes panel to `max-w-none` with side padding — no more narrow column.
- Keep metadata chips as a horizontal row above the notes panel.

**Mobile (< 600px or portrait phone):**

Essentially the current layout, already close to optimal. Minor tweaks:

- Drop the reference-links row when there are zero links (currently still
  takes margin).
- Collapse timer into the back button row more tightly.

### 3d. Implementation notes

- A single component decides layout via `useMediaQuery` / `window.matchMedia`:
  ```
  tv:      (min-width: 1280px) and (min-aspect-ratio: 3/2)
  tablet:  (min-width: 600px) and not(tv)
  mobile:  else
  ```
- Content (metadata chips, notes, next-song preview) should be extracted into
  small presentational components that each layout composes differently.
- The existing `MarkdownRenderer` stays the sole renderer for notes; the
  redesign is purely a layout change.
- Keep keyboard shortcuts identical (ArrowLeft/Right/Home/End/Escape).

### 3e. Open behavioral questions

See §7 for the list of clarifying questions on this redesign specifically.

---

## 4. Markdown view/edit toggle rollout

### 4a. Current state

- `MarkdownEditor` (with Edit | Preview toggle) exists at
  `src/components/notes/MarkdownEditor.tsx` but is only used in the
  `SongNotesPanel` / `NoteEntryForm` flows.
- `MarkdownRenderer` is used in one place: `PracticeSessionPage`.
- Everywhere else notes are entered — `EditSongModal` (song band notes),
  practice pre-notes, wrap-up notes, session-specific per-song notes,
  setlist/show/practice-level notes — they use plain `<textarea>` via
  `InlineEditableField type="textarea"`. Users can type markdown but can't
  preview it before practice, and it renders as raw text everywhere except
  during a live session.

### 4b. What the user asked for

View/edit toggle wherever markdown is entered, so you can confirm the render
after editing. Two UX options floated: (a) explicit "Edit" icon to flip to
markdown, (b) pencil/eyeball toggle like some markdown apps.

### 4c. Proposal

Introduce a `<MarkdownField>` component that replaces the `textarea`-mode
`InlineEditableField` for any markdown-typed value. Behavior:

- **Idle state:** rendered markdown (via `MarkdownRenderer`), with a small
  `pencil` icon in the top-right corner on hover.
- **Edit state:** `textarea` + `eye` / `pencil` segmented toggle (reuse the
  existing `MarkdownEditor` toggle), save/cancel buttons consistent with
  `InlineEditableField`.
- **Empty state:** shows the placeholder text in the rendered area.
- **Character counter** from `MarkdownEditor` is preserved.

Adopt it in:

1. `EditSongModal` "Band Notes" textarea.
2. `PracticeViewPage` pre-practice Notes card.
3. `PracticeViewPage` wrap-up Notes card.
4. Per-song session notes (`SongListItem` inline editable) — probably keep the
   character-limited single-line flavor, so this one might NOT need markdown.
5. `SetlistViewPage` description/notes (if it has one — verify).
6. `ShowViewPage` notes field.

### 4d. Also addresses: band notes in NewSong modal

The user asked whether the band-notes field should be removed from the new
song modal since it's cramped. Two options:

- **Option A (keep but upgrade):** replace the plain textarea with the new
  `MarkdownField`. Space is tight, but a collapsed markdown field with an
  "Add band notes" toggle works in a modal.
- **Option B (remove entirely):** delete the notes field from the new song
  modal and rely on users adding notes afterwards (songs you create from
  scratch are almost always edited immediately anyway).

**Recommendation:** Option B. Song creation should be a fast "minimum viable"
step; notes are a second-click action. Many users paste chord/lyric blocks
there and appreciate more room. The `EditSongModal` already has a wider
notes pane — rely on that.

### 4e. Styling fix the rollout should include

`MarkdownRenderer` and `MarkdownEditor` still reference legacy color tokens
(`steel-gray`, `energy-orange`, `smoke-white`, `electric-yellow`, `amp-red`).
Per the prior audit, the app has moved to hex-literal palette
(`#f17827ff`, `#1a1a1a`, `#a0a0a0`, etc.). Update both files to the modern
palette as part of this rollout so the rendered markdown matches the rest of
the app.

---

## 5. Guitar tuning color system

### 5a. Current state

- Tunings are free-text strings scattered across `NewSongModal` (9 inline),
  `EditSongModal` (9 inline), displayed on `SongListItem` with no color.
- Labels disagree between modals (see §2e).
- `SetlistBuilder` (legacy light-theme) has a color-by-index palette but it
  assigns colors dynamically based on the tunings present in a given setlist —
  so the same tuning shows different colors across different setlists. Not
  what we want.
- `PracticeSessionPage` warns on tuning change via amber text in the nav bar —
  that's all the visual signal we have today.

### 5b. Goal

A **fixed, deterministic** color per canonical tuning. Same tuning → same
color everywhere, forever. Used on song avatars / chips / icons in lists and
cards, and as a strong signal in the practice viewer.

### 5c. Proposed canonical set (v1)

| Tuning          | Color   | Swatch      | Notes                       |
| --------------- | ------- | ----------- | --------------------------- |
| Standard        | neutral | #6b7280     | "no color" / default        |
| Drop D          | #3b82f6 | blue        |                             |
| Drop C          | #8b5cf6 | purple      |                             |
| Drop B          | #7c3aed | deep purple |                             |
| Half-step down  | #14b8a6 | teal        |                             |
| Whole-step down | #0ea5e9 | sky         |                             |
| Open G          | #f59e0b | amber       |                             |
| Open D          | #ef4444 | red         |                             |
| DADGAD          | #10b981 | green       |                             |
| _(any other)_   | #6b7280 | neutral     | fallback for custom strings |

(Exact hex values up for debate — these are a first cut picked to be
distinguishable on a dark bg and accessible at small sizes.)

### 5d. Where to apply color

1. **SongListItem** — color the Guitar icon and/or the tuning label.
   Two options:
   - subtle: color the `Guitar` icon only (current `text-[#606060]`).
   - strong: colored pill around the tuning label text.

   Recommend a 2-3px left border stripe on the song card in tuning color, so a
   whole setlist reads at-a-glance as stripes of tuning changes. Non-
   intrusive, doesn't shout when all songs are the same tuning.

2. **Browse songs drawer** — small colored dot next to the tuning filter
   options.
3. **Practice session viewer** — dot next to tuning in the left rail AND on the
   next-song preview. A tuning _change_ between current and next should
   highlight the next-song dot with a pulsing ring (replaces the tiny amber
   warning).
4. **Song avatars** — out of scope for v1. The song initials avatar already
   uses a per-song color; overloading it would be noisy. Keep tuning color on
   the icon/stripe, not the avatar.

### 5e. Canonicalization

Create `src/utils/tunings.ts`:

```ts
export const CANONICAL_TUNINGS = [
  { id: 'standard', label: 'Standard', color: '#6b7280' },
  { id: 'drop-d',   label: 'Drop D',   color: '#3b82f6' },
  // ...
] as const

export function tuningColor(tuning: string | undefined): string { ... }
export function canonicalTuning(input: string): string { ... }
```

- Rationalize the two divergent label lists in the modals to `label`.
- `canonicalTuning()` gracefully maps existing strings in DB (e.g.
  `"Half Step Down"` → `"Half-step down"`) so we don't need a migration — but
  we probably _should_ do a one-time normalization pass.

---

## 6. Other small findings worth batching

1. `EditSongModal` uses `id="markdown-content"` inside the shared
   `MarkdownEditor`, which is non-unique if we ever render two editors on the
   same page (we might, when adopting `MarkdownField` in more places). Make the
   id prop-driven.
2. The `NewSongModal` orphan removal is a win for the `KNOWN_VIOLATIONS`
   cleanup — it's one fewer place using the legacy blue accent.
3. `PracticeSessionPage` still uses `console.error('Error loading practice')`
   (line 240 equivalent). Should be the namespaced logger per CLAUDE.md.
   Low priority but trivial to batch.
4. The "X of Y" overline in the current practice session nav lives inside a
   progress-dots component; we could expose a shared `<SessionProgress>` that
   renders either the dots (mobile) or a numeric/percent overline (TV) —
   dots at 10 songs on a TV feel lost.

---

## 7. Open questions (please confirm before implementation)

### On the practice viewer redesign

1. **TV/monitor trigger** — do you want "TV mode" auto-enabled by viewport
   (≥ 1280px + aspect ≥ 1.5), or explicit (a toggle button, e.g. "Present
   Mode")? Auto is zero-click but can surprise; explicit is predictable and
   lets laptops choose.
2. **Notes font size on TV** — should the notes panel auto-scale text size
   (say 1.3× on TVs) or leave it to the user's browser zoom? Auto-scale is
   friendlier for someone reading from a music stand 8 ft away.
3. **Sidebar placement** — left rail (as drawn) vs right rail? Left is
   conventional; right keeps the eye naturally flowing from notes to "what's
   next". I'd default to left unless you feel strongly.
4. **Dark header on TV** — the current fixed-inset layout overlays the app
   sidebar/navbar (`md:left-60` offset). On a TV we probably want a fully
   full-screen mode (no app chrome at all). Fine by you?

### On markdown toggle

5. **Default view when re-opening** — when you tap into a notes field that has
   content, do you want it to open in **rendered view** (idle state) with
   pencil-to-edit, or drop straight into **edit** mode? I'd default to
   rendered-view; you tap pencil to edit. Matches what you described and feels
   less aggressive.
6. **Per-song session notes** — current single-line 150-char limit on the
   session-notes input (e.g. "skipped bridge today"). Leave as plain text, or
   also markdown? I'd keep it single-line plain; it's not the right surface
   for chord charts.
7. **NewSongModal band notes field** — confirm: remove entirely? (My
   recommendation in §4d.)

### On tuning colors

8. **Color intensity** — subtle icon-only color vs. a left-border stripe on
   the whole card vs. a full colored pill on the tuning chip? (I lean: stripe
   - colored icon, keep text neutral).
9. **Standard tuning color** — intentionally neutral gray (so the eye only
   catches _changes_), or should it also get a distinctive color? Neutral
   makes exceptions stand out, which matches the user story of "spot tuning
   changes in a setlist."
10. **Color palette sign-off** — want to review the hex values in §5c before
    we commit, or are you happy to refine during implementation?

### On process

11. **Mock page** — you said I _could_ build a mock-at-another-endpoint of the
    proposed changes (e.g. a route like `/dev/ui-preview` showing the three
    practice viewer layouts side-by-side with fake data). Do you want me to do
    that as the next step, or proceed straight to implementation once
    questions above are answered?
12. **Phasing** — I'd sequence this as three PRs:
    - **PR 1 (safe cleanup):** `NewSongModal` removal, tuning canonicalization
      helper, `SectionCard` + `SongSection` extractions, unify view-page
      details/notes styling. No behavioral changes.
    - **PR 2 (markdown rollout):** `MarkdownField` component; adopt in
      `EditSongModal`, `PracticeView`, `ShowView`, `SetlistView` notes.
      Modernize `MarkdownRenderer` palette. Remove/relocate band notes in
      new-song flow per answer to Q7.
    - **PR 3 (tuning colors + practice viewer responsive):** both are
      user-visible changes and bigger reviews. Could also be split into
      3a (tuning colors everywhere) and 3b (practice viewer responsive).

    OK with this ordering? Anything else you want to bundle in?

---

## 8. Quick scoreboard

| Area                                     | Effort  | User-visible?      | Risk |
| ---------------------------------------- | ------- | ------------------ | ---- |
| NewSongModal removal                     | Trivial | No                 | None |
| Tuning vocabulary canonicalization       | S       | Small              | Low  |
| `SectionCard` / `SongSection` extraction | M       | No (pure refactor) | Low  |
| `MarkdownField` + rollout                | M–L     | Yes                | Low  |
| `MarkdownRenderer` palette fix           | S       | Yes (fixes bug)    | None |
| Tuning color system                      | M       | Yes                | Low  |
| Practice viewer responsive               | L       | Yes (big)          | Med  |

---

_End of assessment. Please respond inline to §7 questions and I'll turn this
into a concrete implementation plan._

---

## 9. Final preview decisions (iterated at `/dev/ui-preview`)

The following patterns were reviewed and approved in the `/dev/ui-preview`
sandbox and are what ships to production.

### 9a. MetaPill (unified metadata chip)

- **Pill:** always icon + value, rounded-full chip shape.
- **Caption above pill** (small uppercase, 9px, per-pill color) when
  `size="md"` — hidden on `size="sm"` with a hover tooltip providing the
  full label.
- **Accent color** applied to both caption and pill for the tuning variant;
  neutral (`#1a1a1a` bg, `#2a2a2a` border, `#707070` caption) for Key / BPM /
  Duration.
- **Block variant** for the TV left rail — full-width, captions left-aligned.
- **Icons:** `Music` (Key), `Activity` (BPM), `Clock` (Duration), `Guitar`
  (Tuning).

### 9b. Tuning color registry

- **Palette A** (bright & saturated) chosen as v1. Hex values in
  `src/utils/tunings.ts` (promoted from the preview `tuningColors.ts`).
- **All tunings** get distinctive colors — Standard is NOT neutral; it's sky
  blue `#60a5fa`. Rationale: users wanted every tuning easy to locate at a
  glance, not just "exceptions stand out."
- **Registry API**: `tuningColor(tuning, paletteKey)`, `tuningLabel(tuning)`,
  `canonicalTuningId(tuning)`. Registry is a pure lookup — custom tunings
  (future feature) slot in by extending the palette array.
- **Fallback** `#6b7280` reserved for unrecognized custom strings until a
  color is chosen.

### 9c. Tuning color treatment on song cards

- **Combo treatment** chosen: **pill + stripe**. Colored `TuningPill` plus a
  left-border stripe on the song-list row. Non-tuning pills (Key/BPM/Dur) do
  not drive the stripe.
- Applied to `SongListItem` across Setlist / Show / Practice views and the
  SongsPage list.

### 9d. FooterNextPreview (shared next-song footer block)

- **Desktop / tablet:** `[NEXT label] Song Title [TuningPill] [pulsing dot +
CHANGE badge]` centered, uses the same `TuningPill` as the main metadata.
- **Mobile (`compact`):** drops the `NEXT` caption and the `CHANGE` text
  (only the pulsing dot remains, with `title` + `aria-label` for a11y).
- Used identically in tablet landscape / tablet portrait / mobile practice
  session footers. TV footer keeps setlist-progress dots (TV has the
  next-song preview in the left rail).

### 9e. NotesPanel (scrollable + Kindle-style tap zones)

- **Panel styling** — `bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg
overflow-hidden`. Applied uniformly across all viewports by the component
  itself (no more per-layout wrapper duplication).
- **Page-turner zones** — full-width transparent-gradient buttons at top and
  bottom of the notes panel. Gradient `from-black/70 via-black/30 to-
transparent`, orange chevron arrow centered with `drop-shadow`. Zones
  auto-hide at content edges. Hover bumps to `#f17827ff` tint and scales the
  arrow 110%.
- **Zone heights:** 36px (sm / mobile), 48px (md / tablet), 64px (lg / TV).
- **Keyboard shortcuts (window-scoped on prod session page):**
  - `PageDown` / `Space` → scroll down ~70% of panel height (smooth)
  - `PageUp` / `Shift+Space` → scroll up
  - Focus-scoped in the preview to avoid four panels fighting; in production
    they attach to window on the practice session route.
- **BT foot-pedal compatibility** — standard pedals emit PageUp/PageDown, so
  they work without app-side pairing.

### 9f. Practice session viewer — layouts

- **TV / Monitor** (≥1280px, aspect ≥ 3:2): 240px left rail with title +
  stacked metadata pills + next-song preview block; wide notes panel takes
  all remaining width.
- **Tablet landscape** (600–1279px, aspect > 1): compact header, horizontal
  metadata pill row, full-width notes.
- **Tablet portrait** (600–1279px, aspect < 1): same as landscape but with
  vertical-space priority — compact pills, larger notes area, centered
  metadata wraps if needed.
- **Mobile** (<600px): minimal header with clock, progress dots row,
  centered wrapping pills, notes panel, nav with shared `FooterNextPreview`.
- **Font size toggle** (S / M / L) in the session header; persisted to
  localStorage. Affects notes panel only.
- **Layout toggle** in the session header lets users override the
  auto-detected layout; persisted to localStorage.
- **Full-screen** — sidebar removed on all viewports while in active session.
  Implemented via a per-route layout-skip flag (not a portal).
- **Exit** — the single back arrow in the top-left is the only exit
  affordance across all viewports.

### 9g. MarkdownField (notes editing surface)

- **Idle** — rendered markdown with a pencil icon overlay (top-right, shown
  on hover or always-visible on touch).
- **Edit** — textarea with Edit / Preview toggle chips, Cancel (X) / Save
  (✓) buttons. Click-out saves automatically.
- **Save feedback** — brief green toast ("Notes saved") and green border
  flash on the field for ~1.8s when click-out or explicit save commits.
- **Dirty cancel** — triggers a discard-confirmation dialog to prevent
  accidental loss.

### 9h. Unsaved changes guard (blocking confirm)

- **Hook:** `useUnsavedChanges(isDirty)` registers a `beforeunload` handler
  while the form is dirty and exposes a `confirmClose()` helper that returns
  a promise resolving to the user's choice.
- **Dialog:** `<UnsavedChangesDialog>` with three buttons — **Keep editing**
  (default focus), **Discard**, **Save**. Orange-amber icon + warning tone.
- **Surfaces that adopt it:** `EditSongModal` (add/edit), setlist edit
  flows, and any modal with non-autosaving inputs.
- **Not needed on:** `InlineEditableField` (already auto-saves on blur),
  per-song session notes (150-char single-line input; same auto-save
  behavior).

### 9i. NewSongModal / band notes

- `src/components/songs/NewSongModal.tsx` — deleted (orphaned).
- `EditSongModal` in add mode — **no Band Notes field**. Users create the
  song with essentials, then add notes from the song detail view. Band notes
  remain in edit mode.

### 9j. SectionCard

- `<SectionCard title="...">` extracted to `src/components/common/`.
- Replaces the hand-rolled `bg-[#121212] border border-[#2a2a2a] rounded-lg
p-4 sm:p-6` + `<h2>` pattern in PracticeViewPage, SetlistViewPage,
  ShowViewPage (and eventually other surfaces).
- Supports optional `actions` slot (right-side button group next to the
  heading).

---

## 10. Implementation phasing (recap, tracked in this session)

| PR  | Scope                                                                                               | Risk        | Status      |
| --- | --------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| PR1 | Orphan removal, tuning utils, canonicalization, SectionCard + adoption                              | Low         | in progress |
| PR2 | MarkdownRenderer palette, MarkdownField, useUnsavedChanges, adoption                                | Medium      | pending     |
| PR3 | MetaPill/TuningPill production, tuning color stripe on SongListItem                                 | Low         | pending     |
| PR4 | PracticeSessionPage rebuild with 4 layouts, ScrollableNotes, FooterNextPreview, full-screen session | Medium-high | pending     |

Tests run before and after each PR per CLAUDE.md policy.
