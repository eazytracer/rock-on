# 09 · Design review: editing a song vs editing its notes

**Status: open. Asking the designer to re-look** (Nov 7 2026, after the Phase 2 tidy-up on `redesign/integration`).
Screenshots: `review/songs-notes/`.

## What prompted it

Phase 2 shipped the song pane and the song editor as specified (Song Editor and View · 6). The facts live in a
full-screen editor, the notes live in the view, and the editor has no notes field. Live testing turned up two
problems: the tuning chips overflowed the bar, and writing notes inline in a narrow desktop pane was unpleasant.
The tidy-up fixed both literally:

- **Tuning filter:** each chip is drawn in its tuning's colour (no pill inside a chip). On desktop the row shows the
  chips that fit, then "+N", which opens a sheet listing every tuning. On phones the row scrolls.
- **Pane:** widened to 440 px (520 px at ≥1536 px) and shown only at ≥1440 px. Below that width a song opens on
  its own page. Notes in the pane are a read-only preview; "Full screen" (or clicking the preview) opens
  `/songs/:id#notes`, where they're edited in a wide column.

The result is functional, but the flow is now inconsistent. **"Edit" for the song and "edit" for its notes are two
very different views, and neither can reach the other.**

## The two edit flows today

|                    | Edit song (facts)                                              | Edit notes                                                                     |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Entry points       | Edit button on the view/pane · row menu → Edit · Links "+ Add" | Song page, in place · pane preview / "Full screen" → song page                 |
| Surface            | Full-screen overlay, no app chrome (screenshot 2)              | Inline inside the song page, sidebar visible (screenshots 3–4)                 |
| Controls           | Cancel / Save in a sticky header                               | Per field: Edit / Preview tabs, ✕ / ✓                                          |
| Save model         | One explicit Save for all fields; discard prompt on Cancel     | Each note saves on its own (band note: versioned, `stale_version` on conflict) |
| Reaches the other? | No (no notes in the editor)                                    | Only by scrolling up to the view's Edit button, which leaves the notes         |

The pane adds a third mode: a read-only view whose Edit opens the overlay, while its notes send you to a different
page.

## Questions for the designer

1. **One edit surface or two?** Options we can see:
   - **a.** Notes join the editor as a section or tab (Details · Notes), so Edit means one place.
   - **b.** The song page becomes the editing surface for everything: facts edit inline like the notes do, and
     the overlay goes away (or stays only for Add song).
   - **c.** Keep them separate but cross-link them: "Edit notes" in the editor, "Edit details" beside the
     notes, with the same chrome for both.
2. **What is the pane for?** Read-only preview with one "Open" into a full page for every edit, or a place to
   edit in? If it's read-only, should the pane's Edit go to the page too?
3. **One save model.** Explicit Save (editor) or save-per-field (notes)? Band notes need conflict handling
   either way.
4. **Pane breakpoint and width.** Currently ≥1440 px and 440/520 px. At exactly 1440 the tuning row has room only
   for "All tunings" and "+4" (screenshot 1).
5. **Chrome.** The editor overlay hides the sidebar on desktop; the song page keeps it. Is that intended?

## Screenshots (`review/songs-notes/`)

1. `1-pane-1440.png`: list and pane at 1440 px, notes preview with "Full screen"
2. `2-edit-song-1440.png`: Edit song overlay
3. `3-song-page-notes-1440.png`: song page opened from "Full screen"
4. `4-editing-band-note-1440.png`: editing the band note in place
5. `5-no-pane-1280.png`: 1280 px, no pane (rows open the song page)
6. `6-mobile-390.png`: phone, scrolling tuning chips

## After the decision

Record it in `design/source/DECISIONS.md` and here, then fold the change into Phase 2 (or the next phase) in
`05-plan.md`. The data layer doesn't constrain the choice: `set_band_note` and the song update are independent
calls, so a combined editor can save both.
