---
created: 2026-07-09T20:38
purpose: Triage + assignment doc for the chromium e2e failure sweep on branch fix/0.4-small-patch
---

# E2E Failure Triage (chromium baseline)

## Context / ground rules

- The devcontainer crashes when Playwright runs with its default worker count
  (~16 on this 32-core box). **Root cause of the "flaky" failures was resource
  contention, not the tests.** Always run with `--workers=2` (or `--workers=1`
  for a single spec) and one folder/file at a time.
- A persistent Vite dev server is already running on :5173 (`/tmp/vite-dev.log`).
  Local Supabase + edge functions are up. `reuseExistingServer` is on, so
  Playwright reuses the running server — do NOT start another.
- Environment is local dev (`.env.local` → local Supabase). Fixtures use the
  well-known local service key.

## CLASSIFICATION RULE (from the user — non-negotiable)

Each failing test is exactly one of:

- **Category A — stale test / testid / UI-change.** The product behaves as
  intended (verified via manual testing) but the test's selectors or
  expectations are out of date because _we_ changed the UI (redesign, renamed
  testids, moved elements). → **FIX IT**: update the test's selectors, and/or
  add a stable `data-testid` to the source element per the project's testability
  guidance (prefer adding a logical id over brittle text/nth selectors).
- **Category B — genuine product/code bug.** The test is correct and necessary,
  but the app is actually broken (feature not working, wrong behavior, error).
  → **DO NOT change source or test.** Record it in `PRODUCT-BUGS.md` with
  evidence and STOP. The user reviews these before any code change.

When unsure which category, treat as **B** and report — do not guess-fix.

## Testability guidance (project rule)

Add logical, unique `data-testid`s to elements that need checking rather than
using text/nth/CSS fallbacks. Convention: `{context}-{field}-{type}`
(kebab-case). Form inputs also get `name` + `id`.

## Verified fixes already landed (reference examples of Category A)

- **auth/** — logout redirect now carries `?returnTo=` (intended deep-link
  preservation). Tests waited for the exact URL `/auth`. Fixed by matching
  `/\/auth/` in `tests/fixtures/auth.ts` (`logoutViaUI`) and
  `tests/e2e/auth/protected-routes.spec.ts`. **auth folder now fully green.**
- **practices/session.spec.ts** — the practice _session_ screen was redesigned
  into 4 responsive layouts (`PracticeSessionPage.tsx`: TV / tablet-landscape /
  tablet-portrait / mobile) rendering song key/bpm/tuning via `MetaPill`
  components. Added `data-testid="session-song-key|session-song-bpm|
session-song-tuning"` to the current-song pills in all 4 layouts, and
  `data-testid="session-next-preview"` to the TV "Up next" block; updated the
  next-tuning assertion to target `session-next-preview`. 5/6 session tests now
  pass. **Remaining session failure is listed below (markdown notes).**

## Remaining failing clusters (chromium)

### Cluster R — practices (assigned: agent-R)

- `tests/e2e/practices/session.spec.ts:137` "displays markdown notes correctly
  in practice session" — asserts
  `[data-testid="session-notes"] strong:has-text("Important")` visible; not
  found. `session-notes` is now rendered by `ScrollableNotes`. Determine whether
  ScrollableNotes renders markdown to `<strong>` and forwards the testid to a
  container that includes the rendered HTML. Likely Category A (testid/markdown
  container) but confirm the bold actually renders in the app.
- `tests/e2e/practices/crud.spec.ts` (6 tests: 34,77,113,147,185,267) — first
  failure: `page.waitForSelector('[data-testid="practice-location-display"]')`
  times out (via `helpers/inlineEditable.ts:34`). The practice _detail/CRUD_
  page (`PracticeViewPage.tsx`) likely renamed/removed that testid in the
  redesign. Check the current PracticeViewPage testids vs what the helper +
  tests expect.

### Cluster J — jam (assigned: agent-J)

- `tests/e2e/jam/jam-save-setlist.spec.ts` (1: "...correct heading and
  structure") — `toBeVisible` fail.
- `tests/e2e/jam/jam-view-anon.spec.ts` (4) — `toBeVisible` / `toHaveCount`
  fails ("host curated setlist", "hasn't added any songs yet state", "edits and
  picks them up live", ...). Edge functions (jam-view) ARE running. Likely a
  redesign of the jam view / anon page testids, but watch for real jam-view
  data issues (Category B) since this touches edge functions.

### Cluster S — settings / account deletion (assigned: agent-S)

- `tests/e2e/settings/settings-page.spec.ts` "Delete Account Workflow" (3 tests
  incl. :241 "should show warning messages in modal", "...DELETE confirmation
  text", "...modal when delete clicked"). NOTE: account-deletion was just
  _scaffolded_ (commit 498e323 "scaffold feature folder + design"). If the
  delete-account modal/UI is not actually implemented yet, these tests are
  testing an unbuilt feature → that is **Category B** (or the tests are
  premature). Report; do not fabricate the feature.

### Cluster Y — sync (assigned: agent-Y)

- `tests/e2e/sync/setlist-show-sync.spec.ts` (3: "...to Supabase without
  errors", "...no off-by-one error", "...sourceSetlistId correctly") —
  `toBeVisible` fails. Could be redesign selectors OR a real sync/date bug.
  Classify carefully — sync + date correctness are high-value; if the app
  actually mis-syncs or has an off-by-one, that's Category B.

### Cluster B — bands member management (assigned: agent-B)

- `tests/e2e/bands/manage-members.spec.ts:252` "admin can remove member from
  band" — `expect(received).toBe(expected)` fail. Determine whether the remove
  actually fails (Category B) or the assertion/selector is stale (Category A).

### Cluster P — permissions RBAC (assigned: agent-P)

- `tests/e2e/permissions/rbac.spec.ts:211` "member cannot promote themselves to
  admin". If a member CAN promote themselves, that's a security bug (Category
  B). If the test is asserting on a stale selector, Category A. Classify with
  care — this is a privilege check.

### Cluster G — songs (assigned: agent-G)

- `tests/e2e/songs/crud.spec.ts:260` "member can delete song" — `toBeVisible`
  fail.
- `tests/e2e/songs/personal-mirroring.spec.ts:127` "checkbox is shown in
  band-tab add mode but hidden in personal-tab add mode" — `toHaveCount` fail.
  Likely Category A (add-mode checkbox testid / visibility) but confirm.

## Status board

| Cluster                    | Owner   | Category (A/B/mixed)                  | Fixed | Notes                                                                     |
| -------------------------- | ------- | ------------------------------------- | ----- | ------------------------------------------------------------------------- |
| auth                       | (done)  | A                                     | ✅    | logout returnTo                                                           |
| practices/session metadata | (done)  | A                                     | ✅    | pill testids                                                              |
| R practices                | agent-R | ?                                     | ⬜    |                                                                           |
| J jam                      | agent-J | ?                                     | ⬜    |                                                                           |
| S settings                 | agent-S | ?                                     | ⬜    |                                                                           |
| Y sync                     | agent-Y | ?                                     | ⬜    |                                                                           |
| B bands                    | agent-B | ?                                     | ⬜    |                                                                           |
| P perms                    | agent-P | ?                                     | ⬜    |                                                                           |
| G songs                    | agent-G | mixed (A: delete, B: add-modal dirty) | 1/2   | crud delete testids fixed; checkbox test = BUG-G1 (see PRODUCT-BUGS-G.md) |

---

## FINAL RESULTS (chromium sweep complete)

All Category A (stale test / testid / UI-redesign) and contention-flaky failures
are FIXED and verified green, in small batches with `--workers=2`:

| Folder            | Result             | Fix summary                                                                                                                    |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| auth              | ✅ 40              | logout redirect `?returnTo=` matcher                                                                                           |
| bands             | ⚠️ 19 pass / 1 red | remove-member = **BUG-B1** (Category B)                                                                                        |
| events (NEW)      | ✅ 2               | new create + join-by-code coverage; added `event-name` testid to non-host header                                               |
| friends           | ✅ 4               | new request→accept coverage (inline login for band-less user)                                                                  |
| jam               | ✅ 35              | tabbed jam + anon name-gate; `jam-common-panel` testid                                                                         |
| layout            | ✅ 13              | (already green)                                                                                                                |
| permissions       | ✅ 7               | `has-text("Promote")` matched band name "Self **Promote** Test"; exact-name selector + renamed band. App is secure (UI + RLS). |
| practices/session | ✅ 6               | pill testids (4 layouts) + `session-next-preview`; edit-modal notes helper                                                     |
| practices/crud    | ❌ 6 red           | **BUG-R1** (Category B) — venue field never renders empty                                                                      |
| settings          | ✅ 19              | afterEach couldn't log out with modal open (blocked click). NOT flaky — real test bug S missed.                                |
| songs             | ⚠️ 33 pass / 1 red | delete-dialog testids fixed; personal-mirroring:127 = **BUG-G1** (Category B)                                                  |
| sync              | ✅ 4               | inline-edit create flow + custom DatePicker; date off-by-one check rewritten                                                   |

**Only remaining red = the 3 Category B product bugs** (see PRODUCT-BUGS.md),
awaiting user sign-off before any source change.

**Not yet run:** firefox / webkit / Mobile Chrome / Mobile Safari projects.

---

## UPDATE — user approved all fixes (2026-07-09), shipped in 0.4.4

All Category B bugs fixed (+ a 4th found during the work). Chromium e2e now fully
green in small batches; unit tests 326/326; type-check + lint clean.

| Bug                                      | Fix                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| B1 member removal                        | service/repo path + awaited push (SyncRepository.updateBandMembership); real kebab remove-flow testids |
| R1 practice Location                     | ScheduleMetaRow renders when editable; "Location" label; crud tests + MarkdownField notes helper       |
| G1 add-song false-dirty                  | exclude backfilled tuningId from dirty snapshot                                                        |
| S1 (found here) delete last song re-adds | SyncRepository.deleteSong awaits remote delete before refetch                                          |

Version bumped 0.4.3 → 0.4.4; CHANGELOG updated. Tag + release_notes row: run
`/release` (steps 3–4 of the versioning policy) — no migration in this PR.
Firefox/webkit/mobile projects still deferred.
