# Cluster G (songs) — Product bugs (Category B)

## BUG-G1: Pristine "Add Song" modal is falsely marked dirty after tunings load → spurious "unsaved changes" dialog blocks close

**Test:** `tests/e2e/songs/personal-mirroring.spec.ts:142`
"checkbox is shown in band-tab add mode but hidden in personal-tab add mode"

**Failing assertion:** the `toHaveCount` at spec lines 163–167 — after clicking
the modal's close button, the test expects the add-song modal to disappear:

```ts
await page.locator('[data-testid="edit-song-modal-close"]').click()
await expect(page.locator('[data-testid="song-title-input"]')).toHaveCount(0, {
  timeout: 5000,
})
```

The count stays 1 (modal never closes), so it times out.

### Expected behavior

Opening the Add Song modal and immediately closing it (no fields touched)
should close the modal directly — there are no user edits, so no
"unsaved changes" prompt should appear.

### Actual behavior

Closing the pristine add modal pops the `UnsavedChangesDialog` on top of the
still-open EditSongModal. The modal does not close; `song-title-input` remains
in the DOM. (The test never dismisses that dialog, so it hangs and fails.)

### Root cause (code evidence)

The unsaved-changes guard compares a JSON snapshot of `formData` captured on
first render against the current `formData`. A progressive-backfill effect
mutates `formData.tuningId` _after_ the snapshot is captured, so the form
reads as dirty without any user interaction.

- `src/components/songs/EditSongModal.tsx:137-149` — initial `formData` has
  `tuning: 'Standard'`, `tuningId: null` (add mode, `song` undefined).
- `src/components/songs/EditSongModal.tsx:268-284` — `initialSnapshotRef` is
  captured on the first render (line 277-281 effect, guarded by
  `!initialSnapshotRef.current`). `isDirty = currentSnapshot !== initialSnapshot`.
  The snapshot (line 269-276) includes the whole `formData`, i.e. `tuningId: null`.
- `src/components/songs/EditSongModal.tsx:163-169` — once `builtinTunings`
  loads it resolves the built-in id and does
  `setFormData(f => ({ ...f, tuningId: match.id }))`.
- `src/hooks/useTunings.ts:22,26-41` — `all` starts `[]` and is populated by an
  async `refetch()` in an effect, so `builtins` is empty on first render and
  arrives a tick later. Therefore the snapshot is always taken with
  `tuningId: null`, then the backfill flips it to a real id → `isDirty === true`.
- `src/hooks/useUnsavedChanges.ts:103-108` — `requestClose()` returns a pending
  promise (opens the dialog) whenever `isDirtyRef.current` is true; the caller
  `handleClose` (EditSongModal.tsx:661-664) only calls `onClose()` when the
  promise resolves true. There is no `markClean` after the backfill (the hook
  doesn't even expose one), so the spurious dirty state is never cleared.

### Why only this test trips it

The passing add-song tests (`crud.spec.ts`) all **submit** the form
(`song-submit-button`), which closes the modal via SongsPage's `onSave`
(`setIsAddModalOpen(false)`) regardless of `isDirty`. This checkbox-visibility
test is the only songs e2e that opens the add modal and closes it with the **X**
button without submitting, so it's the only one that hits the dirty-guard path.

### Note on the test's own intent

The checkbox visibility logic itself is CORRECT and not the cause:
`SongsPage.tsx:2099` passes `showAlsoSaveToPersonal={!isPersonalTab}` and
`EditSongModal.tsx:133` gates the checkbox on `isAddMode && showAlsoSaveToPersonal`,
so the checkbox correctly shows on the band tab and hides on the personal tab.
The test fails earlier, at the close step, due to BUG-G1.

### Suggested fix direction (NOT applied — awaiting review)

Make the tuning-id backfill not count as a user edit. Options:

- Exclude `tuningId` from the dirty snapshot (it's a derived/backfilled field), or
- Re-capture `initialSnapshotRef` (or call a `markClean`) after the backfill
  effect settles when the modal is in add mode and untouched.
