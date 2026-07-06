# Open decisions — need your answer before the flagged work proceeds

Each item is a real question. Fill in the **ANSWER:** line (and any notes). The next agent
reads this file and will not touch the corresponding `[DECISION]` items until it's answered.
My recommendation is first, but it's your call.

---

## ✅ RESOLVED — build directives (answered 2026-07-06; these OVERRIDE the per-item recs below)

Read the two updated design rows via the claude_design MCP (project `019df065-4ee1-707b-bfd9-d821331f5cad`):
`app/spec-rows/23 C2 - Create and edit model.html` (NEW convention) and
`app/spec-rows/14 07 - Schedule a show.html` (updated render).

- **D1 → Option A (adopt Calendar-parent nav).** Sidebar nests **Shows · Practices · Events**
  under **Calendar**, each deep-linking to `/calendar?filter=shows|practices|events`; `CalendarPage`
  reads the `?filter=` query param and renders the segmented All·Shows·Practices·Events agenda.
  The Shows/Practices/Events _lists become the Calendar-filtered views_ (no separate primary list
  pages); individual items are pages. Rewrite `tests/e2e/layout/persistent-layout.spec.ts`
  (`shows-link`/`practices-link` now go to `/calendar?filter=…`). Scope the ShowsPage/PracticesPage
  list content into the filtered Calendar (keep the component, reach it via the filter, OR merge).
- **D2 → PAGES, not modals (C2 convention — flips my earlier rec).** "One control surface per
  entity": Show/Practice/Event/Setlist = a single page that is create (`/new`) + view + edit
  (`/:id`) via one component with an `isNewMode` flag. Fields **inline-editable in place** (tap →
  C0 picker opens anchored); existing records **autosave on change/blur** (brief "Saved" cue),
  **Save button only in new-mode**, **Delete only once the record exists**.
  - Shows canonical = **`ShowViewPage`**; **RETIRE `ScheduleShowModal`/`ShowFormModal`**.
  - Practices canonical = **`PracticeViewPage`**; **RETIRE `PracticeBuilderPage`**. Confirm which
    owns `/practices/new` and route both `/new` + `/:id` to it.
  - Modals/sheets remain ONLY for routeless sub-objects (a song, a contact, a tuning) +
    confirmations. (The tuning picker + tuning create modal already follow this — no change.)
- **D3 → Yes.** Make "Just me" (solo) the first-class top option on `GetStartedPage`
  (`src/pages/AuthPages.tsx`), "OR WITH A BAND" divider below. Preserve testids.
- **D4 schema:**
  - **#3 Source filter → a `song_hidden` JOIN table** (user_id + song_id), NOT a boolean on songs.
  - **#5 Casting → Yes:** add a hands-raised table + `events.allow_suggestions` / `events.auto_approve`.
  - **#9 Practice enrichment → NO.** Do **not** add type / objectives / rating / completed. Keep only
    the two existing notes (pre-notes + wrap-up). So #9's schema work is CANCELLED; the practice
    page consolidation (D2b) still happens, just with the current fields.

Order unblocked by this: D1 nav, D2 show/practice page consolidation, D3 onboarding are all buildable
now. Schema forks #3 (join table) and #5 (hands + event cols) are buildable with the §2 rigor.

---

## D1 — Calendar-parent navigation (spec row 00)

**Question:** In the **desktop sidebar**, should **Shows · Practices · Events** become _children
nested under Calendar_ that open the Calendar pre-filtered (`/calendar?filter=shows|practices|
events`), instead of the current flat, top-level items that route to their own pages?

**Why it matters:** Today the desktop sidebar lists Shows/Practices as primary items → `/shows`,
`/practices`; mobile reaches them _through_ Calendar. So desktop and mobile disagree on what's
primary. The spec wants Calendar to be the single time axis.

**Options:**

- **A (spec-faithful):** Nest them under Calendar + deep-link to `/calendar?filter=…`; make
  `CalendarPage` read the `?filter=` param. Standalone `/shows` `/practices` routes still exist
  but the sidebar points at the filtered Calendar. **Cost:** changes nav semantics; rewrites
  `tests/e2e/layout/persistent-layout.spec.ts` (it asserts `shows-link`→`/shows`).
- **B (pragmatic, my rec):** _Visually_ nest/indent Shows·Practices·Events under Calendar in the
  sidebar, but keep them routing to their own pages (`/shows`, etc.). Resolves the "what's
  primary" mismatch, no route/e2e changes. Later upgrade to A if wanted.
- **C:** Leave the sidebar flat as-is.

**Recommendation:** **B** — gets the IA intent with near-zero risk; A is the literal spec but
churns nav + e2e for modest gain.

**ANSWER:** **A** (notes: I don't see a ton of value in having unique pages just for displaying calendar items that effectively work the same way. If a user was on the calendar and clicked into an event and then wanted to go back, it would be confusing to keep track of which page to go back to and doesn't add any real value.)

---

## D2a — Canonical create/edit surface for **Shows** (spec row 07)

**Question:** There are **two** show surfaces. Which is THE canonical create+edit surface (the
other gets retired for that purpose)?

- `ScheduleShowModal` (a focused modal inside `src/pages/ShowsPage.tsx`) — currently only opens
  on _edit_.
- `ShowViewPage` (`src/pages/ShowViewPage.tsx`, routed at `/shows/new` and `/shows/:id`) — an
  inline-edit page; today "Schedule Show" navigates here.

**Why it matters:** Spec row 07 shows a **focused modal on desktop / full-screen on mobile**.
Right now creation goes to the inline page while a modal exists too — duplicated logic that
drifts.

**Recommendation:** Make **`ScheduleShowModal`** the canonical create+edit surface (matches the
spec's "focused modal"); keep `ShowViewPage` only if it's needed as a read-only detail view,
else fold it in. The next agent should first confirm the modal has feature parity (contacts,
load-in, payment, setlist fork-on-attach) before retiring the page path.

**ANSWER:** **This was a valid callout--I pushed back on the designer to make this a consistent behavior, there are new renders for schedule/edit practice and shows. Please use the MCP to pull the updates to the files, we should only use modals for things that can be edited from multiple views. ** (notes: )

---

## D2b — Canonical create/edit surface for **Practices** (spec row 04)

**Question:** Same situation for practices:

- `PracticeBuilderPage` (`src/pages/PracticeBuilderPage.tsx`) — a full-screen modal.
- `PracticeViewPage` in `isNew` mode (`src/pages/PracticeViewPage.tsx`) — inline page.
  Which is canonical for create+edit?

**Note:** the router currently sends `/practices/new` to one of these — confirm which owns the
route before consolidating (flagged in the research). Enrichment fields (Type / objectives /
rating — decision D-related, `[SCHEMA]`) get added to whichever wins.

**Recommendation:** Pick the one already routed at `/practices/new` as canonical and retire the
twin, to avoid drift. If they're equivalent, prefer `PracticeBuilderPage` (matches the "form"
modal shape in the spec).

**ANSWER:** **See answer to previous issue--design was updated.** (notes: )

---

## D3 — Onboarding: make "Just me" (solo) first-class? (spec row 11 / flow 01)

**Question:** On `GetStartedPage` (in `src/pages/AuthPages.tsx`), should **"Just me" (solo /
personal account)** become the **top, visually-primary** option, above an "OR WITH A BAND"
divider (Join by code / Create band)?

**Why it matters:** Today solo is a small link at the bottom; the spec makes it first-class
(the band-less flow already fully works). Low-risk reorder, but it changes the primary
onboarding path — and testids (`personal-account-button`, `create-band-button`,
`join-band-button`) must be preserved.

**Recommendation:** **Yes** — matches the spec and the already-shipped band-less capability;
purely a layout/hierarchy change.

**ANSWER:** **Yes, follow the spec here** (notes: )

---

## D4 — Schema forks: confirm scope of DB changes (already approved "maximal")

You approved writing+testing migrations locally for the `[SCHEMA]` forks. Just confirm the
intended data model so the agent builds the right thing (each: amend the feature's migration,
security-review, negative tests, local-only):

- **#3 Source filter** — add `songs.hidden` (per-user "hide a band-sourced song from My Songs")?
  Or a separate `song_hidden` join table? **Recommendation:** a boolean/flag on the personal
  mirror row is simplest. **ANSWER:** **I think the number will be small, the hidden join table should work well**
- **#5 Casting** — add a **hands-raised** table + `events.allow_suggestions` / `auto_approve`
  columns (for guest raise-a-hand + Access controls)? **ANSWER:** **Yes**
- **#9 Practice enrichment** — add `practice_sessions.type` (text+CHECK), `objectives` (jsonb),
  `session_rating` (smallint 1–5), `completed_objectives` (jsonb)? **ANSWER:** **No, I don't see a need to add those features for now. We just need to store the two notes we have now. Leave out objectives and rating**

---

_Referenced from `TASKLIST.md` (every `[DECISION]` item) and `HANDOFF.md` §5._
