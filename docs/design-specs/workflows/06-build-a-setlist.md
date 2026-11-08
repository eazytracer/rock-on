# Workflow: Build a setlist

**Goal:** assemble, order and annotate a set quickly, and see how long it runs and how many tuning changes it has while you build it.

## Flow

1. **Start:**
   - Setlists → **New setlist**, in the current context (Personal or a band).
   - Or from a show: **Create new setlist**, named after the show.
   - Or from a song: **Add to setlist** → pick an existing setlist or create one. [Not built]: today this shows fake setlists.
2. **Name it.** There are no statuses.
3. **Add songs** from the song browser:
   - Search, filter by tuning, or **add all from another setlist**.
   - Songs already in the set are marked.
   - In a band context, a **From my songs** section copies a personal song into the band when you add it.
4. **Shape the set:**
   - Drag to reorder.
   - Insert **breaks**: length (15 min by default) plus notes.
   - Insert **sections**: a titled divider, e.g. "Set 2", "Encore".
5. **Annotate:**
   - Setlist notes (Markdown).
   - A note per song for this set ("start slow", "Jim takes verse 2").
   - Open a song to see its band and personal notes, or to edit it.
6. **Check it** as you go:
   - Song count.
   - Total time, including breaks.
   - Tuning changes, flagged between songs plus a total ("4 tuning changes").
   - "52 of 45 min" when the set is attached to a show.
7. **Done:** every change saves as you make it; there's no Save button.

## Must

- One setlist editor for Personal and band setlists.
- Setlist rows:
  - Position number, title, tuning (colour plus name), duration.
  - A tuning-change flag when a song's tuning differs from the previous song.
  - Optional fields via view options (key, BPM, artist, links, notes indicator).
- Songs are always numbered, and breaks and sections don't consume numbers.
- Removing an item asks for confirmation. Removing never deletes the song from the catalog.
- The song browser only offers songs from the current context, plus "From my songs" in a band.
- Attaching a set to a show happens from the show and **copies** it.
  - The show's copy says "Copied from ‹Setlist›, ‹date›" and offers re-copying the latest version.
  - Edits to the original never change past shows.
- The setlist list:
  - Cards show name, song count, total time, and the next show it's attached to.
  - Sorting: name, newest, oldest, next show.
  - Card actions: duplicate, delete.
- A phone user can build a whole set one-handed: add, reorder and insert breaks without precision dragging.

## Must not

- Statuses (draft / active / archived).
- A separate editor or flow for personal setlists.
- Forced "between songs" time entries.
- Fake or placeholder setlists anywhere.
- Lose the current scroll position or order after adding songs from the browser.

## States

- **No setlists:** explain what a setlist is, and offer **New setlist**.
- **Empty setlist:** show the song browser call to action straight away.
- **No songs in the catalog:** link to **Add a song** first.

## Future

- [Future] Export or print as PDF, for stage use.
- [Future] A between-songs time allowance (ask users first).
- [Future] A combined "how do we feel" score per song (from each member's 5-point rating), shown here and on the show.
- [Explore] Performance mode for solo and duo acts: run the set live with chords and lyrics from the notes.
- [Explore] Setlists pointing at a specific song version (`explorations/song-versions.md`).
