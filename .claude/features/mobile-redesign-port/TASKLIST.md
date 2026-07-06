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

---

## A. Navigation & IA ← (you asked about this)

- [ ] **Calendar-parent sidebar nav** — nest **Shows · Practices · Events** under Calendar; each
      deep-links to `/calendar?filter=…` (spec row 00). `[DECISION]` changes nav semantics + **breaks
      `persistent-layout.spec`** (asserts `shows-link`→`/shows`) → needs a coordinated e2e update.
- [ ] **Calendar `?filter=` query-param** reading in `CalendarPage` (paired with the above).
- [ ] Mobile bottom nav — **unchanged** per spec (Home · Songs · Sets · Calendar · More).

## B. Add / Edit form layouts ← (you asked about this)

- [ ] **Song add/edit** — tuning **picker** (C0 dropdown, grouped Built-in/Your, writes `tuning_id`,
      keeps `guitarTuning` fallback). `[UI]` — fork #2, DB ready.
- [ ] **Show create/edit** — **consolidate** the two surfaces (`ScheduleShowModal` vs the
      `/shows/new` `ShowViewPage`) into one canonical create surface (spec row 07 = focused modal
      desktop / full-screen mobile). `[DECISION]` which surface wins. Fields/pickers already token-clean.
- [ ] **Practice create/edit** — **consolidate** `PracticeBuilderPage` vs `PracticeViewPage(isNew)`;
      add **Type** dropdown, **goals/objectives[]** checklist, **session rating (1–5)**. `[SCHEMA]`
      (practice_sessions cols) `[DECISION]` canonical surface.
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
      `[SCHEMA]` (songs `hidden` flag on the personal mirror).
- [ ] **#4 Song-notes notepad 4-state** — grey/blue/orange/gradient by note contents (batched
      per-song personal-note presence). `[UI]` logic.
- [ ] **#5 Event casting console** — parts/grid model, **raise-a-hand** `[SCHEMA]`, request→resolve,
      **Access** tab (visibility/QR + `allow_suggestions`/`auto_approve` `[SCHEMA]`). Biggest fork.
- [ ] **#6 Desktop two-pane layouts** — Home two-column dashboard, Events master/detail, Settings
      left-nav, Friends right-rail. `[UI]`
- [ ] **#7 C0 anchored `<Dropdown>`** — reusable; **retire the 24 native `<select>`s**. Started as
      part of #2. `[UI]` per-file e2e updates (breaks `selectOption`).
- [ ] **#8 Onboarding** — make **"Just me" (solo)** the first-class top option; one-time **auto-add
      band songs?** prompt on join/create. `[SCHEMA]`-lite (settings field) `[UI]`.
- [ ] **#9 Practice enrichment** — same as the Practice add/edit item (B). `[SCHEMA]`.
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
