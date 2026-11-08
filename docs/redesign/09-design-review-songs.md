# 09 · Design review: editing a song vs editing its notes

**Status: decided Nov 8 2026. Build from [10-song-page-and-setlist-nav.md](10-song-page-and-setlist-nav.md).** Was: asking the designer to re-look (Nov 7 2026, after the Phase 2 tidy-up on `redesign/integration`).
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

## Designer's answer (Nov 7 2026) · proposed, Eric decides

Mockup: `design/demo/Song Page.html` (also on the design canvas as "Song page (proposal)"). It's the desktop demo
with the song page added. The panel at the bottom left opens it from a setlist, Songs, search or a shared link.

**1. One surface: option b.** The song page is where a song is edited, all of it. The title, artist and the four
facts (tuning, key, BPM, length) edit in place. Tuning and key open their pickers anchored to the fact. Album, tags
and links sit in a Details column on the right. Notes are the wide left column, edited in place as today. The
**Edit song overlay goes away for existing songs.** It stays only as **Add song**, because adding needs the title
first, the Spotify matches and "Also add to My Songs". On desktop, Add song should keep the sidebar too (see 5).
This is the same model as the show page (edit in place, saves as you go). Jira, Linear and Notion all open an item
as a page you edit, so people already know it (**Jakob's Law**). It also removes the "two edits that can't reach
each other" problem instead of cross-linking it (option c just adds a hop).

**2. The pane is a read-only preview.** Its job is to answer "which song is this?" without leaving the list. It
gets an **Open** button. Its Edit, a click on a note, and "Full screen" (renamed **Open to edit**) all go to the
page. Double-clicking a row or pressing Enter opens the page too. Below the pane breakpoint, a click opens the page
(as built). Setlist rows get the same: an open icon on each song row and double-click.

**3. One save model: each field saves itself.** Facts and details save on Enter, on blur, or on a pick, with a
"‹Field› saved · Undo" toast. Title can't be emptied (it reverts with a toast). Notes keep an explicit **Done**,
because they're long text (draft, then commit). ⌘↵ is Done and Esc cancels. Every save sends `version`. A conflict
on a fact shows the latest value with a toast. A conflict on a note keeps your draft and asks "Show his / Keep
mine" (the mockup shows this on the first Done of Monkey Wrench's band note).

**4. Pane breakpoint.** Keep ≥1440 for the pane. The pane is now read-only, so it can be 400 px (480 at ≥1536).
Fix the tuning row by not competing for width: on the list header, put the search on its own line above the chips
when the pane is open, or collapse the chips into one **Tuning** filter chip with a menu (selected tunings show as
its label). I'd take the menu. It also fixes "All tunings · +4".

**5. Chrome: the sidebar stays everywhere on desktop**, the song page and Add song included. Only stage screens
(chart reader, practice session, jam host) take the full window. The overlay hiding the sidebar was a leftover of
the mobile full-screen route.

**Back is named after where you came from**, and ‹ › (J / K) steps through that same list:

| Opened from | Back says | ‹ › steps through | Extra |
|---|---|---|---|
| Songs (list or pane) | ← Songs | the list as sorted and filtered | — |
| A setlist | ← ‹Fall Set› | the set's songs in order | the "In ‹Fall Set›" note layer appears first |
| Search | ← Search "‹q›" | the results | — |
| Used in, a show, a practice | ← ‹that item› | that item's songs | the set's note layer when it's a set |
| A link, or a reload | ← Songs | nothing ("Opened from a link") | — |

Put the origin in the URL so it survives a reload and can be shared: `/songs/:id?from=setlist:<id>` (or
`from=search:<q>`, `from=show:<id>`). No `from` means Songs. Back is a link to the origin with its selection and
scroll restored. It's not `history.back()`, so a deep link never leaves the app. Esc goes back when nothing is being
edited.

**Mobile changes little.** The song view is already a full-screen route with notes edited in place. Make its facts
tappable the same way (each opens its existing sheet: tuning picker, circle of fifths, number pad), so the
full-screen Edit form is also only Add song there. The back label follows the same table.

**What this changes in DECISIONS:** "Song editor and song view" (the editor becomes Add song only; the view edits
in place; one save model). Record it there if Eric agrees, then fold it into Phase 2's follow-up in 05-plan.
