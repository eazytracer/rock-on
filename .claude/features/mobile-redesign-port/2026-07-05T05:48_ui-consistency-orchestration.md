---
feature: mobile-redesign-port
doc: UI-consistency pass — sub-agent orchestration plan (desktop + mobile, ALL pages)
created: 2026-07-05T05:48
sources:
  - design project "Rock On" → app/Rock On - Design Spec.html  (16-row target spec, source of truth)
  - design project "Rock On" → app/Rock On - Implementation Review.html  (gap map: C-1…D-1)
  - .claude/features/mobile-redesign-port/2026-07-02T15:00_design-fidelity-audit.md
baseline (2026-07-05T05:48, before any change):
  - type-check: clean (exit 0)
  - unit: 810 passed / 48 files (exit 0)
  - lint: not yet captured
  - e2e: Supabase + Vite up; not yet run
---

# ✅ PHASE A — DONE (2026-07-05, green)

- **A1 tailwind.config.js:** repointed all 6 legacy light values (`surface`/`text`/`smoke-white`/
  `steel-gray`/`electric-yellow`/`secondary`) → dark tokens; added `accent-hot`/`accent-deep`
  utilities. Kills the `bg-surface` white flash. (smoke-white/steel-gray/electric-yellow consumers
  are all **dead code** — auth `*Form` + `SongNotesPanel→NoteEntryCard/Form→MarkdownEditor` chain,
  imported by 0 live files; kept, not deleted.)
- **A2 global recolor (deterministic, 47 files):** `#f17827`→`accent`, `#D7263D`→`danger`, orange
  hover shades `#d96a1f/d96820/d96920/e53d01`→`accent-deep`, `#ff8c3d/ff8f4d`→`accent-hot`.
  CircleOfFifths SVG fill/stroke → `var(--accent)`. **0 stale hex remain in src.**
- **A3 shell:** `MobileHeader` (chrome→`bg-1`, dropped email + "Connected" clutter, connection→a
  danger dot on the bell shown only offline, unread badge→`info`). `Sidebar` (chrome→`bg-1`, badges
  blue-500 + accent → unified `info`, slimmed the sync block to one status dot + inline pending).
- **Gate:** type-check ✓ · unit 810/810 ✓ · lint ✓. Nav routing/testids preserved.

## ⚠️ New flag (found during A3): full row-00 Calendar-parent IA is a behavior change

Design-spec row 00 wants Shows/Practices/Events **nested under Calendar** and deep-linking to
`/calendar?filter=…`. But `tests/e2e/layout/persistent-layout.spec.ts` asserts `shows-link`→`/shows`
and `practices-link`→`/practices`, and `/shows`//`/practices` are used across many e2e specs. So the
deep-link change **breaks e2e** and alters nav semantics — a decision (it's the same M-3 the review
flagged for you). **Deferred.** Sidebar got the visual/token fixes only; structure/routes unchanged.

---

# ✅ PHASES B + C — DONE (2026-07-05, green)

**Phase B (9 page agents, all disjoint files):** Songs, Setlists, Shows, Practices, Jam, Band
Members, Auth+Settings, Home/Calendar/More/Dev, Events+casting — plus a shared-components agent
(common/·notes/·sync/). Each did M-1 arbitrary-hex→token + its row's visual fixes, ran type-check.
Highlights: Shows `ShowStatusBadge` now routes through shared `Badge`+`SHOW_TONE`; Practices
tuning-change warning→`text-warn`, live chrome→`bg-0/bg-1`; Setlists status tones + 14 red→danger;
DevDashboard converted to dark theme; Events pages were already clean (no-op).

**My consolidated follow-ups:** swept the orange hover-shade `#d66920`/`#d66620`/`#e07830`/`#c4340a`
→`accent-deep` (missed in Phase A); off-ramp grays (`#0f0f0f`→bg-1 ×45, `#333/#353535/#404040/#4a4a4a`
→border-2, `#555/#606060/#808080`→ink-4/5, `#909090`→ink-3, `#c0c0c0/#d4d4d4/#e0e0e0`→ink-2, `#151515`
→bg-2); added `danger-deep` token (+swept danger hover shades); added missing `surface-elevated`
token (SettingsPage cards were transparent); fixed `SHOW_TONE` to spec (scheduled→neutral,
completed→info); fixed a lone `linkDetection.ts` ramp straggler.

**Phase C (docs):** superseded banners on `.claude/style-guide.md` + `.claude/design-specification.md`
pointing to `src/index.css`/`tokens.ts` as the token source of truth.

## Final verification (all green)

- `type-check` 0 · `lint` 0 errors (44 pre-existing warnings) · **unit 810/810** (1 test updated:
  `ContentLoadingSpinner.test` asserted the pre-migration hardcoded `bg-[#0a0a0a]`; now asserts the
  correct token class `bg-bg-0`).
- **0** `#f17827`, **0** `#D7263D`, **0** orange-hover-shade refs in `src`. Remaining arbitrary hex is
  all intentional (Spotify/YouTube/Google brand, branded white Google button, danger tints, DatePicker
  "today" marker, amber blockquote).
- **e2e (chromium, changed surfaces + solo-user flow): no regressions.** 5 failures triaged: 3
  settings/delete-account are on the **unchanged** SettingsPage (pre-existing); songs `member-can-delete`
  **fails at baseline too** (pre-existing); setlists tab-switching passes **3/3 in isolation** (flaky
  under parallel load, not a color regression).
- **79 files changed, ~1500 lines** — all className/token swaps + the shell + token-config additions.

## 🚩 Consolidated flags for you (nothing below was built this pass)

1. **Multi-band context switching** (Spec 02·A/B, 03, 06) — style-only; backbone for provenance/Source-filter/aggregation. Real logic, likely no DB change.
2. **Event casting console** parts/grid model (Spec EC1) — style-only; the "advanced casting" logic.
3. **Custom tunings** (Spec 02·TUNINGS) — excluded; separate `guitar-tuning-system` DB track (migration already staged).
4. **Calendar-parent sidebar IA** (Spec row 00) — deferred; deep-linking Shows/Practices under Calendar breaks `persistent-layout.spec` + changes nav semantics. `// TODO(ui-pass)` left in CalendarPage.
5. **Desktop two-column Home dashboard** (Spec row 06) — net-new; `// TODO(ui-pass)` left in HomePage.
6. **Legacy light-themed casting components** — `MemberRoleSelector` + `SongCastingEditor` are LIVE and still light-themed (raw `bg-gray-*`/`text-gray-*`, ~200 classes = separate migration); `CastingComparison` + `SetlistCastingView` are dead. `CastingComparison:198` has a native `alert()` (CLAUDE.md violation, in dead code).
7. **Residual Tailwind-default semantic colors** — required-field asterisks (`text-red-*`), some error text, the ContentLoadingSpinner `border-amber-500`/`text-gray-400` — a minor consistency follow-up (→ danger/ink/accent).
8. **Also-stale docs** — `.claude/specifications/2025-10-22T14:01_design-style-guide.md` and `.claude/mobile-navbar-spec.md` still describe the light theme (banners added only to the two primary docs; these two left since CLAUDE.md references the specifications path).
9. **Dead code noted (not deleted):** auth `*Form` components + `SongNotesPanel→NoteEntryCard/Form→MarkdownEditor` chain.

Nothing committed. Branch: `feature/events-friends-and-ui-oh-my`.

---

# What this is

The token migration was **half-finished**. Net-new IA screens (Home, Events, Friends,
Calendar, More) are built on the token system. The older ported pages + nearly every shared
input/picker/dialog still hard-code the pre-unification orange **`#f17827`** and the stale
amp-red **`#D7263D`**, and paint surfaces with arbitrary hex instead of the mapped Tailwind
utilities. Result: two visibly different oranges ship side-by-side.

**Goal:** apply the redesign styling to **every** page (desktop + mobile) so the whole app
reads as one system, per the 16-row Design Spec, with **minimal logic change** and **no DB
schema change**. Keep the 810 unit tests + type-check + e2e green before and after.

## Hard numbers (measured on branch, 2026-07-05)

| Sweep                                                                   | Count                    | Where                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#f17827` stale orange                                                  | **329 refs / ~46 files** | ShowsPage 33, SetlistsPage 31, BandMembersPage 30, EditSongModal 22, SongsPage 21, AuthPages 21, ShowViewPage 15, PracticesPage 10, SongNotesModal 11, + ~20 shared components   |
| `#D7263D` stale red                                                     | **19 refs / 4 files**    | AuthPages 10, SongsPage 5, EditSongModal 3, SongListItem 1                                                                                                                       |
| arbitrary hex (`bg-[#1a1a1a]`, `text-[#a0a0a0]`, `border-[#2a2a2a]`, …) | ~40 files                | most of `common/`, all older pages                                                                                                                                               |
| legacy light aliases                                                    | 5 aliases                | `smoke-white`/`steel-gray` (auth + notes comps), `bg-surface` (App/AuthGuard/AuthCallback/DevDashboard/Settings), `text-text` (DevDashboard), `electric-yellow` (MarkdownEditor) |

## Token vocabulary (what agents replace hex WITH)

Source of truth: `src/index.css` + `tailwind.config.js` + `src/utils/tokens.ts`.
Prefer **Tailwind utilities**; use `token.*`/`var(--…)` only for JS-computed inline styles.

- `#f17827` / `#f17827ff` → `accent` utilities (`bg-accent`, `text-accent`, `border-accent`,
  `bg-accent/10` ≈ accent-soft, `border-accent/30` ≈ accent-line). Hover shades →
  `accent-hot` / `accent-deep` (defined in index.css).
- `#D7263D` → `danger` (`text-danger`, `bg-danger`, `--danger`). `bg-red-600`/`red-500` on
  destructive actions → `danger`.
- `bg-[#0a0a0a]`→`bg-bg-0`, `#121212`→`bg-1`, `#1a1a1a`→`bg-2`, `#1f1f1f`→`bg-3`,
  `#252525`→`bg-4`; `text-[#c8c8c8]`→`text-ink-2`, `#a0a0a0`→`ink-3`, `#707070`→`ink-4`,
  `#505050`→`ink-5`; `border-[#2a2a2a]`→`border-border-1`, `#3a3a3a`→`border-2`.
- semantic: info `#5aa9ff`, success `#3ec986`, warn `#ffb648` (`text-amber-400`→`text-warn`),
  danger `#ff5d5d`.
- tuning warmth: `tuningColor()` from `utils/tunings.ts` (Palette A — standard = blue). Drives
  song-card left border, `TuningPill`, `TuningDot`. Never hard-code tuning colors.

**Rule for every agent:** each changed line must trace to the recolor/token task or its page's
Design-Spec row. No refactors, no logic rewrites, match surrounding style. Add `id` +
`data-testid` if you touch an interactive element that lacks them (per CLAUDE.md), but don't
churn unrelated markup. Run `npm run type-check` + the page's unit tests after editing.

---

# Phasing (dependency-ordered — DO NOT fan out pages before Phase A lands)

Phase A migrates **shared** files that every page imports. If per-page agents ran first they'd
collide on these. So A is serial/supervised; B fans out once A is green.

## Phase A — Foundation & shared chrome (serial, supervised)

**A1. Tailwind aliases (M-2)** — `tailwind.config.js`: repoint the 5 legacy light aliases at
dark tokens (or delete + fix consumers). Kills the `bg-surface` white-flash (AuthCallback,
DevDashboard). Verify no consumer renders light-on-dark.

**A2. Shared inputs / pickers / dialogs token sweep (C-1, C-2, M-1)** — recolor to tokens, no
behavior change, in: `common/` (DatePicker, TimePickerDropdown, DurationPicker, EntityHeader,
MetadataCard, MetadataSection, InlineStatusBadge, InlineEditableField, EditableField,
EditableHeader, ViewPageHeader, SongListItem, TabSwitcher, BrowseSongsDrawer, AddItemDropdown,
CalendarDateBadge, ConfirmDialog, UnsavedChangesDialog, EmptyState, QueueSongRow, SectionCard),
`notes/` (MarkdownField, MarkdownRenderer, MarkdownEditor), `songs/CircleOfFifths`,
`setlists/ShadowEntry`, `practice/ScrollableNotes`. These are the shared dependencies of many
pages — must land first.

**A3. Shell + IA (Design Spec row 00; findings m-1, m-2, m-3)** —

- `layout/Sidebar.tsx`: chrome `#141414` → snap to `bg-1`; unify request/unread badges to one
  `info` token (drop `bg-blue-500`); collapse the heavy sync block to a single status dot +
  tooltip; IA = Primary `Home · Songs · Setlists · Calendar(▸ Shows/Practices/Events nested,
deep-link `/calendar?filter=…`)`, "More" group `Jam · Band · Friends`, footer
  `Notifications · Settings · Sign out`. Active parent + child both highlight; child indent 34px.
- `layout/MobileHeader.tsx`: chrome → `bg-1`; **drop email + "Connected" text**; keep brand +
  bell; connection → small dot on the bell. Bottom nav unchanged (per user).
- `CalendarPage.tsx`: read `?filter=shows|practices|events` on mount into existing Filter state
  (enables the sidebar deep-links). Already token-clean otherwise.

Gate A: `npm run type-check` + `npm test` (unit) + `npm run lint` all green; quick visual smoke
of one clean page (Home) and one migrated page (Songs).

## Phase B — Per-page styling + design-spec fidelity (fan out, ~1 agent/page)

Each agent owns its page(s) + page-only components. All share the Phase-A foundation, so they
no longer collide. Every agent: finish the token sweep on its files (recolor remaining
`#f17827`/`#D7263D`/arbitrary hex), then apply the **styling-only** parts of its Design-Spec
row. Anything requiring net-new data/logic → leave a `// TODO(ui-pass): <fork>` and report it;
do NOT build it.

- **B1 Songs** — `SongsPage.tsx`, `songs/*` (EditSongModal, SongNotesModal, SpotifySearch,
  ExpandableSongNotes, LinkIcons). Row 02 + 02·CLEANUP + 02·NOTES: recolor; left border =
  `tuningColor()`; restore external-link glyphs on every card/row (must not regress); notes
  notepad color grey/blue(personal `info`)/orange(band `accent`)/gradient. **Flag, don't build:**
  multi-band context chip + Source filter + provenance "from ‹band›" (needs context switching),
  custom-tuning picker (needs the separate tunings DB track).
- **B2 Setlists** — `SetlistsPage.tsx`, `SetlistViewPage.tsx`, `setlists/*`. Row 03 + 03·BUILDER:
  recolor (active badge/duration/show-link `#f17827`→accent; delete `bg-red-600`→danger); status
  pill tones (active accent / draft ink-5 / archived bg-3); builder section-tint + remove-hover
  danger. dnd-kit + Browse drawer already exist — style only. **Flag:** cross-context aggregation.
- **B3 Shows** — `ShowsPage.tsx`, `ShowViewPage.tsx`. Row 07: recolor (33+15 refs); status
  colors scheduled ink-4 / confirmed success / completed info / cancelled danger; delete=danger.
  Native date/time inputs → custom `DatePicker`/`TimePickerDropdown` (audit item #4) if low-risk;
  else flag. **Flag:** band-only "pick a band" step in personal context.
- **B4 Practices** — `PracticesPage.tsx`, `PracticeBuilderPage.tsx`, `PracticeSessionPage.tsx`,
  `PracticeViewPage.tsx`, `practice/*`. Rows 04 + 04·LIVE: recolor; live-session chrome
  `#0a0a0a/#0f0f0f`→`bg-0/bg-1`; tuning-change warning `text-amber-400`→`text-warn`; layout
  toggle/spinner accent.
- **B5 Jam** — `JamSessionPage.tsx`, `JamViewPage.tsx`, `jam/*`. Row 05: recolor (small);
  join-code font-mono; keep semantic tokens; `text-primary` radio already maps to accent — verify.
- **B6 Band Members** — `BandMembersPage.tsx`. 30 refs → accent/tokens. Page is richer than the
  mock; recolor only, do not strip features.
- **B7 Home / Desktop dashboard** — `HomePage.tsx`. Row 06: mobile Home already clean; build the
  desktop two-column dashboard (focus+agenda left / stats+actions+"Your bands" right) reusing
  existing hooks. **Flag:** cross-band aggregation (depends on context switching).
- **B8 Auth / sign-up** — `AuthPages.tsx`, `auth/*`, `pages/auth/AuthCallback.tsx`. 21×`#f17827`
  +10×`#D7263D` → accent/danger; fix `bg-surface` flash (paired with A1). Solo-user-without-band
  sign-up flow: PROGRESS says Phase 1+2 already landed locally — **verify + polish + restyle**,
  don't rebuild.
- **B9 Settings + More** — `SettingsPage.tsx`, `MorePage.tsx`. Recolor; fix `bg-surface`. More
  is mostly clean. **Flag:** Settings › Tunings manager (separate tunings DB track).
- **B10 Events + casting** — `EventsPage.tsx`, `EventDetailPage.tsx`, `EventCreatePage.tsx`,
  `casting/*`. List is clean (keep). Row 08 + EC1: recolor; host=accent / guest=info; source tags
  (mine accent / band info / public success / external grey). **Casting depth = the scope
  question below.**
- **B11 Dev surfaces** — `pages/DevDashboard/*` (`bg-white`/`text-text`→tokens),
  `pages/DevUIPreview/*` (13+ f17827 refs). Low priority, dev-only, but on the list for a clean
  grep. Can be one cheap agent or folded into A1.

## Phase C — Docs + full verification

- **C1 Docs (D-1)** — replace `.claude/style-guide.md` + `.claude/design-specification.md` with
  a short pointer to `src/index.css` / `tokens.ts` as source of truth + the tuning-warmth /
  semantic-tone conventions. Retire all `#FE4401` / smoke-white light-theme language.
- **C2 Verify** — `npm run type-check`, `npm test`, `npm run lint`, then targeted `npm run
test:e2e`. Grep must show **0** `#f17827` / `#D7263D` outside deliberate exceptions. Visual
  smoke of each page at 390×844 (mobile) + desktop via Playwright.

---

# Flagged for user — major logic / scope forks (NOT built in this pass without a call)

1. **Multi-band context switching** (Spec 02·MULTI-BAND / 02·CLEANUP / 03 / 06) — GitHub-style
   personal-vs-band context, persisted per user, scoping Songs/Setlists/Shows/Practices, with a
   brand-chip switcher, provenance tags, and clone-on-add. Spec says it builds on existing
   `useBands()` + `currentBandId` (likely **no DB change**) but it is **real logic** and is the
   backbone the Songs/Setlists/Dashboard rows assume. Big scope fork.
2. **Custom tunings** (Spec 02·TUNINGS) — needs a `tunings` table. A migration
   (`supabase/migrations/20260704191222_tunings.sql`) + `guitar-tuning-system` feature dir are
   already **in flight on a separate track**. Excluded from this styling pass; we keep the
   tuning-warmth spine only. (Confirm we're not double-tracking.)
3. **Event casting console** (Spec EC1) — the parts/grid casting model (per-part instrument+label,
   hands-raised grid, Simple/Detailed modes). "More advanced event-casting logic" you mentioned.
   Depth TBD — see question.
4. **Desktop native date/time inputs** (audit #4) — migrating Show/Practice forms off native
   `<input type=date|time>` to the custom pickers is styling-adjacent but touches form logic;
   done per-page only if low-risk, else flagged.
