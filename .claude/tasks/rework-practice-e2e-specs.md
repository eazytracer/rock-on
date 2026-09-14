# Task: Rework practice e2e specs after `/practices` list removal

**Status:** ready
**Type:** test-maintenance
**Risk:** low (test-only; no app code)
**Surface:** e2e (Playwright) — requires the full local stack to verify
**Branch:** `feature/db-simplification-and-qol` (or a child branch off it)

## Context

The standalone practices list page was retired. `src/pages/PracticesPage.tsx`
is **deleted**, and the `/practices` route now **redirects** to
`/calendar?filter=practices` (see `src/App.tsx`). The calendar agenda
(`src/pages/CalendarPage.tsx`) is the reachable practices surface now.

Still live and unchanged:

- `/practices/new` → `PracticeViewPage` (create flow)
- `/practices/:id` → `PracticeViewPage` (detail / inline edit)
- `/practices/:id/session` → `PracticeSessionPage`

So the practice **create/detail/session** flows work exactly as before; only the
**list page** is gone. Several e2e specs used `/practices` as a launchpad
(navigate there, click "Schedule Practice" → `/practices/new`) or tested the old
list UI directly (cards, kebab, delete-modal).

## What needs to change

Run the suite first to see real failures (do NOT guess):

```
just up            # local Supabase
just dev-host      # app on host (separate terminal) OR just dev
just test-e2e      # Playwright — capture failures
```

### 1. Launchpad navigations → start from the calendar

Files with `await page.goto('/practices')` used only to then click
"Schedule Practice":

- `tests/e2e/practices/session.spec.ts` (lines ~55, 184, 251, 335, 410, 473)
- `tests/e2e/practices/crud.spec.ts` (lines ~40, 195, 269–270, 291)

For each: either

- (a) navigate straight to `/practices/new` if the test only needs the create
  flow, OR
- (b) navigate to `/calendar?filter=practices` and click the calendar's
  "New Practice" affordance (`data-testid="calendar-new-button"` on a specific
  filter; verify the exact testid/flow in `CalendarPage.tsx`).
  Prefer (a) where the test's intent is "create then act on a practice" — it's the
  least brittle.

### 2. `crud.spec.ts` — the hard one

This suite tests the OLD list page's own UI (list rows, per-card kebab, delete
confirmation modal). Those UI elements no longer exist on a reachable page.

- Create/detail assertions: repoint to `/practices/new` + `PracticeViewPage`
  (these still exist).
- List/kebab/delete-from-list assertions: the calendar agenda currently has **no
  per-item action menu** (that's a separate planned feature — "calendar kebab").
  Until it lands, these specific tests cannot pass against the reachable UI.
  Options: mark them `test.skip()` with a comment referencing the calendar-kebab
  feature, OR delete the ones that only made sense for the retired list page.
  Decide per-test; do not leave silently-failing tests.

### 3. Page-inventory / band-required specs

- `tests/e2e/layout/persistent-layout.spec.ts` (~line 351): the entry
  `{ route: '/practices', testId: 'practices-page' }` — `/practices` no longer
  renders `practices-page` (it redirects). Remove that row, or change it to
  assert the redirect to `/calendar`.
- `tests/e2e/auth/band-less-flow.spec.ts` (~line 117):
  `['/practices', 'practices-band-required']` — verify what this asserts; if it
  depended on the list page, repoint to the calendar or drop it.

### 4. Leave these alone (verified fine)

- `tests/e2e/auth/protected-routes.spec.ts` (~44, 142): `goto('/practices')` then
  expect redirect to `/auth`. Still valid — unauthenticated hitting `/practices`
  still ends at `/auth` via the protected-layout guard.

## Acceptance criteria

- `just test-e2e` practice-related specs pass (or are explicitly, commented-
  skipped where they depend on the unbuilt calendar-kebab feature).
- No spec references a rendered `/practices` **list** page.
- `just check` (lint + type-check + unit) stays green.
- Summarize: which specs repointed, which skipped/deleted and why.

## Notes

- This is test-only; if a test reveals an app bug, STOP and report — don't work
  around it in the test.
- Follow `docs/LOCAL_DEV.md` for running the stack; e2e needs it up.
