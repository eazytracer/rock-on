# Product bugs — Cluster R (practices)

Recorded by agent-R. Category B findings: the tests are correct/necessary but
the app has a genuine gap. Per triage rules, source/test were NOT changed for
these — the user decides before any code change.

## B1 — Cannot set a location on a new practice (venue field never renders when empty)

- **Failing tests (all 6 in this file fail at the same first step):**
  `tests/e2e/practices/crud.spec.ts`
  - "member can schedule a new practice session"
  - "practice displays duration and location"
  - "practice can include notes"
  - "member can edit existing practice"
  - "member can delete practice"
  - "practice changes sync to all band members"
- **What the test expects:** After landing on `/practices/new`, it sets the
  location via `fillInlineEditableField(page, 'practice-location', '...')`
  (`tests/helpers/inlineEditable.ts:34` → `waitForSelector('[data-testid="practice-location-display"]')`).
- **What the app actually does:** The redesigned `PracticeViewPage` moved
  location out of the Details section and into the header venue slot
  (`src/pages/PracticeViewPage.tsx:588` comment: "location is edited inline in
  the header (venue slot)"; rendered via `EntityHeader` → `ScheduleMetaRow`,
  `venue={practice.location}` at `PracticeViewPage.tsx:536`).
  `ScheduleMetaRow` only renders the venue field when a value already exists:

  ```
  src/components/common/ScheduleMetaRow.tsx:74
    const hasVenue = !!(venue || location)
  ...
  src/components/common/ScheduleMetaRow.tsx:141
    {hasVenue && ( ... <InlineEditableField placeholder="Add venue" ... /> )}
  ```

  A brand-new practice has `practice.location === undefined`, so `hasVenue` is
  false and the venue field is **not rendered at all** — there is no
  clickable "Add venue" affordance. Confirmed empirically in the saved
  snapshot
  `test-results/practices-crud-*/error-context.md` (header row shows only the
  date and time buttons; no venue/location element).

- **Why this is a product gap, not a stale test:** The `InlineEditableField`
  used for venue defines `placeholder="Add venue"`, i.e. it is designed to be
  clickable while empty. The gate should key off editability
  (`onVenueSave` present), not off a pre-existing value. As written, an empty
  location can never be filled from this page (new OR existing practice),
  because the field only appears once a value already exists — a deadlock.
- **Likely one-line fix (needs a decision — cross-entity impact):**
  `ScheduleMetaRow.tsx:74` → `const hasVenue = !!(venue || location || onVenueSave)`.
  This also affects Shows / Setlists / Events headers (any editable-but-empty
  venue would begin showing an "Add venue" affordance), so it is a shared-
  component behavior change that should be reviewed, not guess-fixed here.

### Follow-up test updates required AFTER B1 is resolved (do not apply yet)

Even once the venue field renders, the crud tests will still need selector
updates because the redesign renamed the element. These are Category-A
follow-ups, deferred because they are blocked by B1 and the user is reviewing
B1 first:

1. **`practice-location` → header venue testid.** The venue field is rendered
   by `ScheduleMetaRow` with `data-testid="${testId}-venue"`, where `testId`
   comes from `EntityHeader` (defaults to `entity-header`). Recommended:
   pass `data-testid="practice-header"` to the `EntityHeader` in
   `PracticeViewPage.tsx` (currently uses the default), then update the 6
   `fillInlineEditableField(page, 'practice-location', ...)` calls to
   `'practice-header-venue'`.
2. **`practice-notes` (in "practice can include notes").** The notes field is
   now a `MarkdownField` (`PracticeViewPage.tsx:606`, `data-testid="practice-notes"`),
   which does NOT expose the `-display` / `-input` sub-testids that
   `fillInlineEditableField` requires. That test step would need to drive the
   MarkdownField flow instead (pencil `markdown-field-edit-button` → fill
   `markdown-textarea` → `markdown-save`). Product works; test selector is
   stale.
