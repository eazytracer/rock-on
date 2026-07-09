# PRODUCT / CODE bugs (Category B)

**STATUS: all RESOLVED** (user-approved 2026-07-09; shipped in 0.4.4). The three
below were found by the e2e sweep; a fourth (BUG-S1, song delete) was uncovered
while implementing the fixes — same cloud-first-race class as BUG-B1, fixed with
the same approved pattern.

- **BUG-B1** — member removal persistence → FIXED (`BandMembershipService.removeMember`
  - `SyncRepository.updateBandMembership` awaits the push; UI removal flow re-tested via
    new kebab testids).
- **BUG-R1** — practice Location field → FIXED (`ScheduleMetaRow` renders when editable;
  practices labelled "Location"; crud tests updated, incl. MarkdownField notes helper).
- **BUG-G1** — Add-Song modal false-dirty → FIXED (excluded backfilled `tuningId` from
  the dirty snapshot).
- **BUG-S1** _(found during fixes)_ — deleting the last song in a context re-materialized
  it via `getSongs` empty-cache recovery fetching the not-yet-deleted remote row → FIXED
  (`SyncRepository.deleteSong` awaits the remote delete, push-only, before returning).

Original triage below (for reference).

---

---

## BUG-B1 — Removing a band member does not persist (`PRODUCT-BUGS-B.md`)

- **Test:** `tests/e2e/bands/manage-members.spec.ts` "admin can remove member
  from band".
- **Symptom:** after removing, the member row reappears; `expect(memberStillVisible).toBe(false)` gets `true`.
- **Root cause:** `useRemoveBandMember` (`src/hooks/useBands.ts:448-459`) writes
  `status:'inactive'` **directly to IndexedDB**, bypassing the sync queue (a
  known Repository-Layer guardrail violation). The cloud-first members read
  (`SyncRepository.getBandMemberships`) re-fetches the still-`active` row from
  Supabase and clobbers the local edit → the member is never actually removed.
- **Proposed fix (needs sign-off):** route removal through
  `BandMembershipService` / `repository.updateBandMembership`
  (`BandMembershipService.ts:240` already has a synced path) so it reaches
  Supabase.
- **Caveat:** the test's click flow (row-click → "Remove" button) may ALSO be
  stale (removal now lives behind a kebab menu). Even if the flow is updated,
  the persistence bug is real. Recommend fixing the product bug first, then
  updating the test's interaction.

## BUG-R1 — Cannot set a location/venue on a new practice (`PRODUCT-BUGS-R.md`)

- **Tests:** all 6 in `tests/e2e/practices/crud.spec.ts` fail at the first step
  (setting the location).
- **Root cause:** the redesigned practice header renders venue via the shared
  `ScheduleMetaRow`, which only shows the venue field when a value already
  exists: `const hasVenue = !!(venue || location)` (`ScheduleMetaRow.tsx:74`).
  A brand-new practice has no location, so there is **no "Add venue" affordance
  at all** — an empty venue can never be filled (a deadlock). `InlineEditableField`
  is designed to be clickable while empty (`placeholder="Add venue"`).
- **Proposed fix (needs sign-off):** gate on editability, not on a pre-existing
  value: `const hasVenue = !!(venue || location || onVenueSave)`. **Shared
  component** — also affects Shows / Setlists / Events headers, so review the
  cross-entity impact.
- **Follow-up (Category A, deferred until B decided):** after the field renders,
  the crud tests still need selector updates (`practice-location` →
  `practice-header-venue`; `practice-notes` is now a `MarkdownField`). Listed in
  `PRODUCT-BUGS-R.md`.

## BUG-G1 — Pristine "Add Song" modal is falsely "dirty" → won't close via X (`PRODUCT-BUGS-G.md`)

- **Test:** `tests/e2e/songs/personal-mirroring.spec.ts:127` (the checkbox
  visibility logic itself is correct; the test fails earlier at the modal-close
  step).
- **Root cause:** an async tunings backfill mutates `formData.tuningId` from
  `null` → a real id **after** the unsaved-changes snapshot is captured
  (`EditSongModal.tsx:163-169` vs `:268-284`; `useTunings` loads async). So an
  untouched Add-Song modal reads as dirty; closing via X pops a spurious
  `UnsavedChangesDialog` and the modal never closes.
- **Proposed fix (needs sign-off):** exclude the backfilled `tuningId` from the
  dirty snapshot, or re-capture the snapshot / `markClean` after the backfill
  settles in add mode.
- **Impact beyond tests:** real users clicking X on a just-opened Add-Song modal
  hit an unexpected "unsaved changes" prompt.
