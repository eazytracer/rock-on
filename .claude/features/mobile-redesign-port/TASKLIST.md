# Rock On redesign — Master task list (START HERE)

**This file is the single living source of truth for the mobile-redesign-port feature.**
Branch: `feature/events-friends-and-ui-oh-my` (not on `main`/prod). Every other `.md` in this
folder is a **dated historical design/research artifact** from the feature's planning — kept for
rationale only, **not current instructions**. If they disagree with this file or the code, the
code + this file win.

---

## Operating rules (non-negotiable)

- **LOCAL ONLY, NEVER PROD.** Never `supabase db push --linked`, never deploy edge functions, never
  push the branch. Migrations apply to local Supabase only, held for the human's review before prod.
- **ONE MIGRATION FILE PER FEATURE.** Amend the feature's existing (unshipped, local-only) migration
  in place. After any schema edit: `supabase db reset` → `npm run test:db` (pgTAP) →
  `npm run lint:migrations`. All must pass.
- **Every RLS/permission change → a dedicated security-review sub-agent** (RLS recursion, over-broad
  USING / missing WITH CHECK, service_role leakage, cross-tenant). Add **negative tests** proving what
  must NOT happen.
- **Tests green before AND after each commit:** `type-check` · `test:unit` · `lint` · targeted
  `test:e2e` · `test:db`. Never skip/delete a test to go green — fix the source.
- Small, tested increments; match existing style; surface UI in Playwright before committing.

## Resolved decisions (were the old `DECISIONS.md`; kept here for the unbuilt items)

- **D1 — Calendar-parent nav = Option A** (DONE). Shows·Practices·Events nest under Calendar,
  deep-link `/calendar?filter=…`.
- **D2 — one page per entity** (DONE). `ShowViewPage`/`PracticeViewPage` are canonical create+view+edit;
  `ScheduleShowModal`/`PracticeBuilderPage` retired. Modals only for routeless sub-objects + confirms.
- **D3 — Onboarding "Just me" first = YES** (unbuilt, see #8).
- **D4 — schema:** #3 source filter → a **`song_hidden` JOIN table** (not a boolean); #5 casting → YES
  (DONE); **#9 practice enrichment → NO** (cancelled — keep only the two existing notes).

---

## ✅ Done (committed + verified on this branch)

- **Part 1** — design-token migration + styling fidelity across every page (`feaa9e4`).
- **Context switching (#1)** — brand-chip switcher (Personal ↔ band), persisted; Songs + Setlists
  personal-capable (`3e01fe4`, `cf423fa`). Cross-band aggregation for Shows/Practices deferred.
- **Band-less user flow** — event-code join at signup, band-only empty states, upgrade path
  (`904f191`, `26db2e4`).
- **Custom tunings (#2)** — DB hardened (RLS review + negative pgTAP, `e4c8240`); C0 `<Dropdown>`,
  data/model/service/hook, song-form picker (`96ec7bd`, `1699b2a`); **Settings › Tunings manager +
  `CreateTuningModal` + song-form "New tuning"/"Manage tunings" actions** (`fcebebc`). Follow-up:
  edit-an-existing-custom tuning.
- **Event casting console (#5)** — `event_hands` + `events.allow_suggestions`/`auto_approve` amended
  into `20260703045901_casting.sql` (security-reviewed; 29 pgTAP in `021-event-hands.test.sql`);
  tabbed event detail (Lineup·Requests·People·Access), guest **raise-a-hand** → host accept/decline,
  **Access** tab (visibility/code/QR + toggles), EventsPage avatar-stack, and a **Detailed** cast view
  (backups + confidence) (`b4f40e0`, `f7b21f5`, `aae1758`). Friends already conformed (no change).
- **Calendar-parent nav (D1) + history-aware back-nav** — sidebar nesting, `?filter=` deep-links,
  `useGoBack` + `replace`-on-create; `persistent-layout.spec` rewritten, 13/13 e2e green (`0826788`).
- **D2 modal retirement** — `ScheduleShowModal`/`PracticeBuilderPage` → canonical pages (`322236f`,
  `29c68c7`). Their code is left `@deprecated`/dead (mentioned, not deleted).
- **Date/time pickers** — de-finicked: no double-click-to-type, no duplicate icons, single-click open,
  type-ahead field; native inputs dark-themed (`ed0cd30`).
- **#9 Practice enrichment — CANCELLED** (D4): no type/objectives/rating.

---

## 🔜 Remaining work

### UI (no schema)

- [x] **#8 Onboarding — "Just me" first-class** (D3=yes). DONE. `GetStartedPage` reordered
      (`src/pages/AuthPages.tsx`): "Just me" primary card at top (accent border, `Continue solo`
      → `personal-account-button`), event-code card next (both no-band), **"OR WITH A BAND"** divider,
      then Create/Join band grid. All testids preserved. type-check + lint clean; e2e green
      (band-less-flow, protected-routes, create-band, join-band, signup); Playwright visual verified.
- [x] **#4 Song-notes notepad 4-state** — DONE. `SongsPage` notes button (`FileText`, both grid + list
      render spots) now colors by note contents: grey `text-ink-4` (none) / `text-info` (personal) /
      `text-accent` (band) / info→accent SVG gradient stroke (both), with `data-note-state` for
      observability. New `useBulkPersonalNotePresence(songIds,userId,bandId)` in `useNotes.ts` batches
      personal-note presence in ONE Dexie query. type-check + lint clean; all 4 states verified live in
      Playwright (injected+removed test notes); markdown-notes/personal-mirroring e2e green.
      NOTE: `crud.spec.ts:260 "member can delete song"` fails but is **pre-existing** (fails on base
      without this change) — flagged separately, not caused here.
- [~] **#6 Desktop two-pane layouts** — Home two-column dashboard, Events master/detail, Settings
  left-nav, Friends right-rail. Net-new responsive layouts. (per-sub-layout, in progress)
  **Settings left-nav DONE:** `SettingsPage` desktop `lg:grid lg:grid-cols-[200px_1fr]` with a
  sticky left section-nav (`settings-nav`, items `settings-nav-{id}`) using an IntersectionObserver
  **scroll-spy** (highlights the in-view section) + click-to-scroll. Chose scroll-spy over
  "only-active-section" so **all sections stay rendered** → the existing settings e2e (which asserts
  multiple sections at once) is unaffected. Mobile keeps the stacked layout (nav `hidden lg:block`).
  Section anchors added (`settings-account/tunings/privacy/app-info/developer`, `scroll-mt-4`).
  tsc+lint clean; verified live at 1280px (nav + spy jump) and 390px (stacked, nav hidden);
  settings e2e identical to base (16 pass, same pre-existing 3 delete-account-workflow fails).
  **Home two-column dashboard DONE:** `HomePage` widened to `max-w-5xl`; desktop `lg:grid-cols-3` splits
  into a main column (`lg:col-span-2` — upcoming Next-show/Next-practice, or the band-less create-band
  prompt) beside a side rail (stats + quick actions), with "Browse the full repertoire" spanning full
  width below. Removed the stale `TODO(ui-pass) row 06` deferral. Mobile stacks everything in source
  order (grid collapses to 1 col). All testids preserved. tsc+lint clean; verified live at 1280px
  (two-column) + 390px (stacked); 18/18 persistent-layout + band-less-flow e2e green (incl. "home
  dashboard renders stats + quick actions").
  **Friends right-rail DONE:** `FriendsPage` widened to `max-w-5xl`; desktop `lg:grid-cols-3` with a
  **main column** (`lg:col-span-2` — Requests, Sent, Friends list) beside a **right rail**
  (`lg:col-start-3` — your friend code + add-a-friend). The rail is FIRST in DOM (so mobile keeps
  code/add at the top) but placed in col 3 on desktop via explicit `col-start`/`row-start` grid
  placement — mobile source order fully preserved (code→add→requests→list). All testids preserved.
  tsc+lint clean; verified live at 1280px (right-rail) + 390px (stacked, utilities top);
  13/13 persistent-layout e2e green (no friends-specific e2e exists).
  **Remaining sub-layout:** Events master/detail (list ↔ embedded `EventDetailPage` on desktop).
- [x] **#7 Retire the remaining native `<select>`s → C0 `<Dropdown>`** — DONE (all LIVE selects migrated).
      Final gate: `type-check` clean · `npm run lint` 0 errors (44 pre-existing warnings) · `npm run build` ✓.
      **Batch A DONE:** `SongsPage` (sort `song-sort`, tuning filter `song-tuning-filter`, show filter
      `song-show-filter`; also added `song-filter-toggle-button` + `song-row-{id}` testids) and
      `PracticesPage` (filter `practices-filter`). e2e made genuine (were silently skipping): sort test
      now asserts deterministic Title(Z-A) ordering; tuning-filter test sets Drop D via the add-song
      tuning Dropdown then filters; practices `selectOption('all')` → trigger+option clicks. tsc+lint
      clean; migrated controls verified live in Playwright (sort reorders, Drop-D filter → 9 rows).
      **Batch B DONE:** `ShowViewPage` setlist picker (`show-setlist-select`; `__create_new__` option →
      Dropdown `footerActions` "Create new setlist") and `JamSessionPage` seed-setlist
      (`jam-seed-setlist-select`; keeps `disabled` when no personal setlists). jam e2e updated to target
      `-trigger`; 14/14 jam e2e green; both verified live in Playwright (Show picker: 4 setlists + create
      action; Jam picker: disabled). tsc+lint clean.
      **Batch C DONE:** `BrowseSongsDrawer` (shared across setlist/practice/jam) — tuning filter
      (`browse-songs-tuning-filter`) + setlist filter (`browse-songs-setlist-filter`) → `<Dropdown>`.
      No e2e referenced these; verified live (drawer opens with both, Drop-D filter → 9 rows). tsc+lint clean.
      **Batch D DONE:** `SetlistsPage` — all 5 selects → `<Dropdown>`: SetlistEditorPage status+show
      (desktop `setlist-status-select`/`setlist-show-select`, mobile `-mobile` suffix — **duplicate-testid
      landmine resolved**) + list-page status filter (`setlists-status-filter`). Verified live in the
      personal-setlist editor (status/show render + Active selection works); 4/4 personal-setlists e2e green.
      tsc+lint clean.
      **All user-reachable native `<select>`s are now `<Dropdown>`.** The only native `<select>`s left in
      the tree are in DEAD/unreachable code (left in place per "don't delete pre-existing dead code"):
      • `InlineEditableField` has a `select` branch but **no consumer passes `type="select"`** (only
      text/title/date/time/duration are used) → unreachable.
      • Legacy casting chain is fully orphaned — `SetlistCastingView` is rendered nowhere, so
      `SongCastingEditor` → `MemberRoleSelector` + `CastingComparison` are dead (the "4 legacy casting
      comps"). Live casting is the new event console (#5, `SongCastPanel`/`event_hands`).
      • Other orphans (unreferenced): `SongContextTabs`, `SessionForm`, `EditableField`, `SetlistBuilder`;
      ShowsPage's 2 selects live in the `@deprecated ScheduleShowModal`. All use pre-redesign styling.
      • `utils/tunings.ts` "`<select>`" is a code comment (false positive), not JSX.
      → If full retirement (incl. deleting these dead comps) is wanted, that's a separate explicit cleanup.
      NOTE — pre-existing failures (fail on base, NOT caused here, flagged): `songs/crud.spec.ts:260`
      (delete song empty-state), `practices/crud.spec.ts:113` (practice notes), and
      `practices/session.spec.ts:29,137,442` (practice session mode). Also observed:
      "Recently Added" sort can't distinguish same-session adds in E2E (createdDate sync-timestamp
      propagation) — separate concern, not this migration.
- [ ] **#10 Notifications cross-context** — items name their band/event; opening switches context
      (depends on the context switcher). ⚠️ **BLOCKED / under-specified:** notifications are
      Supabase-only with `payload JSONB DEFAULT '{}'`; seed rows leave `payload` empty and there is NO
      live minting path that populates band/event ids or names (INSERT is service_role-only, currently
      only seed data exists). The frontend half (read `payload.bandId`/`eventId`, show a chip, call
      `switchBand` on open before navigating) is buildable but **cannot be verified end-to-end without
      backend payload data** — needs either a seed-payload + minting decision from the human first, or
      scope it as frontend-only-defensive. Deferred pending that call.
- [x] **Setlist builder** — `BrowseSongsDrawer` responsive — DONE. Now picks its `SlideOutTray`
      `position` via `useViewport().isMobile`: **mobile (<768px) → bottom-sheet** (grab handle, rounded
      top, 85vh) and **desktop → right side panel** (480px, unchanged) — was a 480px right overlay on
      every viewport (unusable on a 390px screen). One shared component, so all 3 consumers (setlist /
      practice / jam) get it. tsc+lint clean; verified live at 1280px (panel) + 390px (bottom-sheet),
      add-song still works in the sheet; practices/crud e2e green (only the pre-existing :113 fails).
      NOTE: interpreted "docked" as the existing side-panel overlay; true layout-docking (content
      reflows to make room) would be a larger cross-page change — separate follow-up if wanted.
- [x] **Event create** — desktop centered modal — DONE. `EventCreatePage` form wrapped in a centered
      card (`max-w-lg` + `sm:` card chrome: `sm:bg-bg-2 sm:border sm:rounded-2xl sm:p-8 sm:shadow-xl`),
      so desktop reads as a floating modal while mobile stays full-bleed. All testids/handlers
      unchanged. tsc+lint clean; verified live at 1280px (card) + 390px (full-bleed) and end-to-end
      create flow (fills → navigates to `/events/:id`).
- [ ] **Casting depth (optional)** — EC1 **Grid/matrix** view (songs × parts); EC2 **request→resolve**
      catalog-linking (approving a guest song request currently always tags it "Not linked").

### Schema (each: amend the feature migration, security review, negative tests, local-only)

- [ ] **#3 Catalog provenance / Source filter** — "from ‹band›" tag, Source filter, Hide/Re-add via a
      **`song_hidden` JOIN table** (`user_id` + `song_id`) → grants + RLS (own rows only) + security
      review + negative tests.

### Cleanup / follow-ups

- [ ] Delete the now-dead `@deprecated` `ScheduleShowModal` (in `ShowsPage.tsx`) + `PracticeBuilderPage.tsx`
      once the human confirms.
- [ ] Dead code to consider (mention, don't delete unless asked): 4 legacy casting comps,
      `SetlistBuilder.tsx`, `ShadowEntry.tsx`, auth `*Form`s.

## Regression register (guard on every change)

- `SHOW_TONE` is one source for Calendar/Shows/Home/Events — a change ripples 4 surfaces.
- `SongCastPanel` is shared with setlist casting — event-only behavior must stay behind guards
  (raise-a-hand, Detailed toggle default = Simple).
- Native `<select>`→Dropdown breaks Playwright `selectOption` — migrate per-file with ids.
- Tuning `guitarTuning`→`tuning_id`: keep the text fallback + `song-tuning-select` testid; keep the
  TS `canonicalTuningId` ↔ SQL `builtin_tuning_slug` slugs in lock-step.
