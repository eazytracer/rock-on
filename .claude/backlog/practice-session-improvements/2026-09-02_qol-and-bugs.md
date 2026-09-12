---
feature: Practice Session QOL & Bugfix
created: 2026-09-02
status: research-complete
kind: qol-and-bugs
---

# Practice Session — QOL & Bugfix batch

Two small, practice-session-scoped items. Both verified against v0.4.5 code.
Low risk, ship together.

---

## BUG 1 — Practices leave "planned" at start time instead of end time

**Report:** As soon as a practice session's start time passes, it disappears
from "planned"/upcoming and is treated as historical. It should remain planned
until its **end time** (start + duration) has passed — an in-progress or
about-to-start practice is not history.

**Root cause:** categorization compares `scheduledDate` (the _start_) to `now`,
ignoring `duration`/`endTime`. This exists in **three** places (fix the class,
not one site):

1. `src/hooks/usePractices.ts:152-158` — `useUpcomingPractices`:
   ```ts
   const upcomingPractices = practices.filter(
     p => new Date(p.scheduledDate) >= now
   )
   const pastPractices = practices.filter(p => new Date(p.scheduledDate) < now)
   ```
2. `src/pages/PracticesPage.tsx:317-324` — inline `upcoming`/`past` filter, same
   `scheduledDate` vs `now` comparison. (Note: `PracticesPage.tsx:36` _already_
   computes `endDate = startDate + durationMinutes` elsewhere — the concept
   exists, just isn't used for categorization.)
3. `src/services/PracticeSessionService.ts:397-412` — `getSessionStatus`: if
   `scheduledTime <= now` and never started it returns **`'cancelled'`** (a
   scheduled-but-past practice is mislabeled cancelled, not "still scheduled
   until its end time").

**Model facts** (`src/models/PracticeSession.ts`): `scheduledDate: Date` (start),
`duration: number` (planned minutes), optional `startTime`/`endTime` (actual).

**Proposed fix:**

- Add one shared helper — the single source of "when does this practice stop
  being upcoming" — e.g. `getPracticeEffectiveEnd(session)` in
  `src/utils/` (near `dateHelpers`):
  ```
  effectiveEnd = endTime ?? (scheduledDate + duration * 60_000)
  ```
- Categorize on `effectiveEnd > now` (upcoming) vs `effectiveEnd <= now` (past)
  in both (1) and (2).
- In `getSessionStatus` (3): a session past its scheduled start but before its
  effective end and not yet started should stay `'scheduled'` (or a new
  in-window state) — it must **not** silently become `'cancelled'`. Revisit the
  past+never-started → `cancelled` branch: absent an explicit cancel, a missed
  past practice is arguably still `scheduled` history, not `cancelled`. Confirm
  intended semantics before changing this branch (it may affect filters/labels).
- Respect the date-helper rules in CLAUDE.md (no raw UTC `toISOString().split`
  round-trips for display/parse).

**Tests:** `tests/unit/services/PracticeSessionService.test.ts` already covers
status; add cases for "now is between start and end" (→ still upcoming/scheduled)
and "now past end" (→ past). Add a `useUpcomingPractices` unit test for the
in-window boundary.

---

## QOL 2 — Duplicate a practice session ("use as starting point")

**Ask:** Google-Calendar-style "Duplicate" — click an existing practice, pick
Duplicate, and get a new _planned_ practice pre-filled from it as a starting
point.

**Where it plugs in:**

- Service: add `PracticeSessionService.duplicateSession(sessionId, overrides?)`
  mirroring `createSession` (`PracticeSessionService.ts:114-150`). It loads the
  source via `getSessionById`, then builds a fresh session.
- Hook: add `useDuplicatePractice()` alongside `useCreatePractice` in
  `src/hooks/usePractices.ts` (same shape/error handling).
- UI: add a **"Duplicate"** action to the existing per-practice action menu on
  `PracticesPage.tsx` (the shipped unified `KebabMenu` — the page already has a
  per-practice delete/confirm flow to sit beside). Follow-up: land the user on
  the edit form / open the new practice so they can set the new date.

**Copy vs. reset (the important part):**

Carry over (template content):

- `type`, `duration`, `location`, `setlistId`, `objectives`, `notes`
- `songs` — copy the song _references_ but **reset per-song progress**
  (`timeSpent: 0`, `status: 'not-started'`, cleared `sectionsWorked` /
  `improvements` / `needsWork` / `memberRatings`) — same shape `createSession`
  builds at `PracticeSessionService.ts:128-137`.
- `attendees` — copy the invitee list but **reset** `confirmed: false`,
  `attended: false` (like `createSession:138-143`).

Reset / do not copy (this is a new planned session):

- new `id` (`crypto.randomUUID()`), new `createdDate`
- `status: 'scheduled'`, clear `startTime` / `endTime`
- clear `wrapupNotes`, `completedObjectives`, `sessionRating`
- `scheduledDate` → sensible default (e.g. next week same time) or prompt; let
  `overrides.scheduledDate` win so the UI can pass a chosen date.
- do **not** copy `version` / `lastModifiedBy` (fresh row).

**Guardrail:** go through `repository.addPracticeSession` (as `createSession`
does) — never write `db.*` directly (CLAUDE.md repo-layer rule).

**Tests:** unit-test `duplicateSession` asserts template fields copied, progress
fields reset, new id/date, status scheduled, start/end/rating cleared.

---

## Effort / risk

| Item                        | Effort | Risk    | Notes                                                                                |
| --------------------------- | ------ | ------- | ------------------------------------------------------------------------------------ |
| Bug 1 (planned vs end-time) | S      | Low–Med | 3 call sites + 1 helper; confirm `cancelled` semantics before touching status branch |
| QOL 2 (duplicate)           | S–M    | Low     | mirrors existing createSession; new service method + hook + menu action              |

Not a production DB change (no migration). Ships behind the normal version-bump
release gate (both are user-facing). Suitable for the quick-win batch, not the
grill-me feature track.
