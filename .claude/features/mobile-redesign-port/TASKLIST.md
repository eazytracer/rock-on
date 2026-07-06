# Rock On redesign — Master task list

Branch: `feature/events-friends-and-ui-oh-my`. Living checklist covering **all** remaining
redesign work (nav, forms, features). Detail lives in `2026-07-06T01:54_per-page-sync-tasklist.md`

- `2026-07-06T02:20_part2-progress.md`. **Flags:** `[SCHEMA]` needs a migration (local-only, held
  for review before prod) · `[DECISION]` needs your call — **the actual questions + options are in
  [`DECISIONS.md`](./DECISIONS.md)** (answer there) · `[UI]` I'll show in Playwright before commit.

---

## 🌙 Overnight session log (2026-07-06)

6 commits, all local + tests-green + rigor-applied. Nothing pushed to prod.
`feaa9e4` Part 1 · `3e01fe4` context switch + Songs · `cf423fa` Setlists personal ·
`e4c8240` tunings DB hardened (security review + 12 negative pgTAP) · `96ec7bd` tuning
foundation (C0 Dropdown + service, 18 tests) · `1699b2a` song tuning picker (Playwright-verified).
**Paused before** the Settings › Tunings _create_ flow (per-string note pickers) and the
schema forks — flagged for your review + go-ahead so they get full attention, not tail-end effort.

## ✅ Done (committed, verified)

- **Part 1** — design-token migration + styling fidelity across every page (`feaa9e4`)
- **Context switching** — brand-chip switcher (Personal ↔ band), persisted; Songs + Setlists
  personal-capable (`3e01fe4`, `cf423fa`)
- **Tunings DB** — hardened: third-party RLS security review, ownership-lock trigger, full negative
  pgTAP matrix, app↔DB parity (`e4c8240`)
- **Events + Friends finalize (fork #5)** — event detail tabbed (Lineup·Requests·People·Access),
  guest raise-a-hand + host resolve, Access controls (visibility/code/QR + suggestion toggles),
  EventsPage avatar-stack. Schema `b4f40e0` (security-reviewed, 29 pgTAP) + UI `f7b21f5`.
  Friends already conformed (no change). Playwright round-trip verified.

---

## A. Navigation & IA ← (you asked about this)

- [x] **Calendar-parent sidebar nav — DONE (2026-07-06, Option A).** Sidebar nests **Shows · Practices
      · Events** under Calendar, deep-linking `/calendar?filter=…`; Events moved out of More.
      `persistent-layout.spec` rewritten (13/13 green). **Also fixed the back-nav bug** (Calendar →
      new event → Back returns to the Calendar) via a history-aware `useGoBack` + `replace` on create.
      Standalone `/shows` `/practices` `/events` routes still exist for direct access.
- [x] **Calendar `?filter=` query-param — DONE.** `CalendarPage` reads + writes `?filter=`.
- [ ] **D2 modal retirement (remaining):** retire `ScheduleShowModal`/`ShowFormModal`/`PracticeBuilderPage`
      for the canonical `ShowViewPage`/`PracticeViewPage` (dual-implementation cleanup).
- [x] **Date/time pickers — DONE.** De-finicked: no double-click-to-type, no duplicate icons,
      single-click opens, type-ahead field; native inputs dark-themed.
- [ ] Mobile bottom nav — **unchanged** per spec (Home · Songs · Sets · Calendar · More).

## B. Add / Edit form layouts ← (you asked about this)

- [ ] **Song add/edit** — tuning **picker** (C0 dropdown, grouped Built-in/Your, writes `tuning_id`,
      keeps `guitarTuning` fallback). `[UI]` — fork #2, DB ready.
- [ ] **Show create/edit — RESOLVED: `ShowViewPage` is canonical** (DECISIONS D2; spec C2 + row 07).
      One page = create (`/shows/new`) + view + edit (`/:id`), one component (`isNewMode`), fields
      **inline-editable in place** (C0 pickers anchored), **autosave on existing** (brief "Saved"),
      **Save only in new-mode**, **Delete only once it exists**. **RETIRE `ScheduleShowModal`/
      `ShowFormModal`.** Keep setlist fork-on-attach. Status tones already correct (SHOW_TONE).
- [ ] **Practice create/edit — RESOLVED: `PracticeViewPage` is canonical** (D2 + C2). Same page
      pattern; **RETIRE `PracticeBuilderPage`**; route `/practices/new` + `/:id` to it. **NO new
      fields** (D4 #9 = No) — keep only the two existing notes (pre-notes + wrap-up); no Type /
      objectives / rating.
- [ ] **Setlist builder** — `BrowseSongsDrawer` → desktop-**docked** panel / mobile **bottom-sheet**
      (today a 480px overlay everywhere). `[UI]` shared component (3 pages).
- [ ] **Event create** — desktop **centered modal** (today full page). `[UI]` minor.

## C. Feature forks (top-down)

- [~] **#1 Context switching** — core done. Cross-band aggregation for Shows/Practices **DEFERRED**
  (simplicity; they stay band-scoped in personal — switch to a band to view).
- [~] **#2 Custom tunings** — DB done + hardened. **C0 `<Dropdown>` DONE** (10 tests). **Tuning
  data/model/service/hook DONE** (`BUILTIN_TUNINGS`, `Tuning`, RLS-scoped `TuningService`,
  `useTunings`; 8 service + 5 data tests). **Song-form picker DONE** — EditSongModal native
  `<select>`→C0 Dropdown (grouped built-in/custom, color dots), writes `tuning_id` + keeps
  `guitarTuning` fallback, legacy→built-in auto-resolve on edit; Song model `tuning_id` + repo
  mapping. Verified in Playwright. **Next:** Settings › Tunings manager + create flow + "＋ New
  tuning" field action. `[UI]`
- [ ] **#3 Catalog provenance / Source filter** — "from ‹band›" tag, Source filter, Hide/Re-add.
      `[SCHEMA]` — RESOLVED (D4): a **`song_hidden` JOIN table** (`user_id` + `song_id`), NOT a
      boolean on songs. New table → grants + RLS (own rows only) + security review + negative tests.
- [ ] **#4 Song-notes notepad 4-state** — grey/blue/orange/gradient by note contents (batched
      per-song personal-note presence). `[UI]` logic.
- [x] **#5 Event casting console** — DONE (2026-07-06). `event_hands` table + `events.allow_suggestions`
      /`auto_approve` amended into `20260703045901_casting.sql` (local-only); dedicated security review
      (no Critical/High; folded in its Medium+Low fixes — cross-tenant retarget, resolved_by forgery,
      slot↔event binding); 29 pgTAP negative/positive tests (`021-event-hands.test.sql`). UI: event
      detail is tabbed (**Lineup·Requests·People·Access**); guest **raise-a-hand** per part (info-blue) + host accept(→casts)/decline in `SongCastPanel` (event-gated, setlist casting untouched);
      **Access** tab (visibility tiers, join code+QR+copy, allow-suggestions/auto-approve toggles).
      Playwright-verified full round-trip (guest raises → host accepts → cast). `[SCHEMA]`✓ `[UI]`✓
- [ ] **#6 Desktop two-pane layouts** — Home two-column dashboard, Events master/detail, Settings
      left-nav, Friends right-rail. `[UI]`
- [ ] **#7 C0 anchored `<Dropdown>`** — reusable; **retire the 24 native `<select>`s**. Started as
      part of #2. `[UI]` per-file e2e updates (breaks `selectOption`).
- [ ] **#8 Onboarding — RESOLVED (D3): yes.** Make **"Just me" (solo)** the first-class top option
      on `GetStartedPage` (`AuthPages.tsx`), "OR WITH A BAND" divider below; preserve testids. (The
      one-time "auto-add band songs?" prompt stays a smaller follow-up.)
- [x] **#9 Practice enrichment — CANCELLED (D4).** No type/objectives/rating/completed; keep the two
      existing notes. Practice page consolidation lives in §B.
- [ ] **#10 Notifications cross-context** — items name their band/event; opening switches context.

## D. Cross-cutting / cleanup

- [x] Native dialogs: `SettingsPage confirm()`, `SetlistEditor prompt()` → themed (Part 1 / fork #1).
- [ ] Dead code (mention, don't delete unless asked): 4 legacy casting comps, auth `*Form`s,
      `SetlistBuilder.tsx`, `ShadowEntry.tsx`.
- [ ] Dual implementations — consolidate Shows / Setlists / Practices create+view surfaces (see B).

---

## 🌙 Proposed overnight autonomous work — for your approval

I'll work **top-down, one small tested increment at a time, committing each to the branch** for
your a.m. review, in this order:

1. **Finish fork #2 — tuning UI** (`[UI]`): C0 anchored `<Dropdown>` (+retire native selects where
   safe) → song-form tuning picker (`tuning_id` + fallback) → Settings › Tunings manager + create
   flow. Screenshots captured for your review.
2. **B. Add/edit polish** that needs no decision: Setlist `BrowseSongsDrawer` dock/sheet, Event
   create modal, Song notes 4-state (#4).
3. **#6 desktop two-pane** layouts (Home/Events/Settings/Friends) — pure UI.

**Guardrails (hard rules while you sleep):**

- **Local only. NO prod:** never `db push --linked`, never deploy, never push the branch. Migrations
  applied to **local** Supabase only, held for your review.
- **One migration file per feature**; amend existing, never proliferate; `db reset` + pgTAP +
  `lint:migrations` before commit.
- **Every RLS/permission change → security-review sub-agent**; **negative tests** (attacker-can't)
  for anything access-related.
- **Tests green before+after** each commit (type-check · unit · e2e · pgTAP). No skipping/deleting
  tests to go green.
- **STOP and leave a note** (don't guess) on anything marked `[DECISION]` — the **Calendar-parent
  nav (A)**, the **Show/Practice canonical-surface** choice, and **onboarding hierarchy** — I'll
  queue those for your morning call rather than change behavior/semantics unilaterally.
- Simplicity first; UI committed for your scrutiny; nothing destructive.

**What I will NOT do overnight without your explicit OK:** the Calendar-parent nav rewrite (A),
the Practice `[SCHEMA]` enrichment (#9), and the casting `[SCHEMA]` work (#5) — all flagged for
your morning review.
