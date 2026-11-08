# 10 · Build brief: the song page, and setlist navigation

**Status: decided by Eric, Nov 8 2026. Ready to build.** This answers [09](09-design-review-songs.md) and adds a
second change found while reviewing it. It's two pieces of work in two releases:

| Release | What | When |
|---|---|---|
| **0.9.1** · Phase 2 follow-up | **Song page**: one surface that edits the whole song; Back follows where you came from | Now, before Phase 3 |
| **0.10.0** · Phase 3 | **Setlist navigation**: an index of setlists, then the set full width, with the name as a switcher | Built as part of Phase 3 (scope added to 05-plan) |

Plus one kit-wide rule (**caret vs swap icon**) that applies from 0.9.1 on.

## Read first

- `design/source/DECISIONS.md`:
  - **"Song editor and song view"**. Its first bullet is superseded by this brief; the note there says so.
  - **"Nov 7 2026 · setlist navigation and the swap icon"**.
- [09](09-design-review-songs.md) → "Designer's answer": the reasoning behind each choice.
- Clickable mocks (open from disk):
  - `design/demo/Song Page.html`. The panel at the bottom left opens the page from a setlist, Songs, search or a link.
  - `design/demo/Setlist Nav.html?nav=ab`.
- Screenshots:
  - `review/song-page/`, 19 shots (numbers below refer to these).
  - `review/setlist-nav/`, the chosen option only.

The mocks are reference, not code: rebuild in this app's components (`SongDetail`, `SongSheets`, the kit primitives)
and hooks (`useSongCatalog`, `useSaveSong`).

---

## Part 1 · Song page (0.9.1)

### What changes, in one paragraph

`/songs/:songId` becomes **the** place a song is edited, on desktop and phone:
- Title, artist and the four facts (tuning, key, BPM, length) edit **in place** and save per field. So do album, tags and links.
- Notes edit in place with an explicit **Done**.
- `EditSongModal` survives **only as Add song**.
- The desktop Songs pane becomes a **read-only preview** with **Open**.
- **Back is named after where you came from**, and ‹ › steps through that same list.

### 1.1 Route and origin

- URL: `/songs/:songId?from=<origin>`. The origin survives a reload and is shareable.

  | `from` | Back label | Back goes to | ‹ › steps through | Extra |
  |---|---|---|---|---|
  | absent or `songs` | ← Songs | `/songs` with this song selected and the list's scroll kept | the Songs list **as currently sorted, filtered and hidden-filtered** | — |
  | `setlist:<id>` | ← ‹setlist name› | `/setlists/<id>` with this song's row selected | the set's songs in order (breaks and sections skipped) | "In ‹setlist›" note layer first (1.4) |
  | `search:<q>` | ← Search "‹q›" | search with `q` re-run | the results that are songs | — |
  | `show:<id>`, `practice:<id>` | ← ‹show / practice name› | that page | its songs in order | — |
  | anything unknown | ← Songs | `/songs` | the Songs list | — |
- **Back is a link to the origin, never `navigate(-1)`.** Replace `back()` in `SongViewPage.tsx`. A deep link must never leave the app.
- No list to step through (a link, or the song isn't in the origin list any more): hide ‹ › and show nothing in its place.
- Put the origin parsing in one tested helper:
  - Suggested: `src/utils/songOrigin.ts`, exporting `parseOrigin(search) → { kind, id?, q? }`, `originLabel`, `originHref`.
  - Unit-test every row above, plus garbage input.
- **Every link to a song passes its origin:**
  - Songs rows and pane → `?from=songs`.
  - Setlist rows → `?from=setlist:<id>`.
  - Search results → `?from=search:<q>`.
  - Song "Used in" rows → nothing; they go to the setlist, and that page's own origin rules apply.
  - Show and practice song rows → `show:` / `practice:`.
- **Keys:**
  - Esc = Back, when nothing is being edited.
  - J / K = next / previous.
  - E = edit the band note.
  - Keys are ignored while an input has focus.
- Keep `#notes`: it scrolls to the notes.
- `?edit=band|mine|set` opens that note in edit mode on arrival (used by the pane, 1.6).

### 1.2 Layout

**Desktop (≥1024).** Inside `ProtectedLayoutRoute`, so the **sidebar stays**. Screenshots 03–06.

- **Top bar** (sticky, full width):
  - Left: the Back button and a breadcrumb in mono caps (`‹band› / ‹origin crumbs› / ‹song title›`).
  - Right: ‹ n of N › and the song ⋯ (`SongMenu`): Duplicate, Copy to My Songs, Hide, Delete.
- **Header:**
  - The artist line.
  - The title, display face, large.
  - A row of four fact tiles: TUNING (pill), KEY, BPM, LENGTH.
  - Buttons: **Chords & lyrics** (primary; still "soon" until Phase 5), **Tune**, **Click ‹bpm›**.
- **Body:** two columns. `minmax(0,1fr) 340px`, gap 32. Under 1180: `minmax(0,1fr) 300px`, gap 24. Max width 1180, centred.
  - **Left · Notes:**
    - "In ‹setlist›", only when `from=setlist`.
    - **Band note**, with "‹editor› · ‹when›" and **Practice log · N**.
    - **My notes**.
  - **Right:**
    - **Details:** Album, Tags.
    - **Links:** inline add, edit and remove.
    - **Used in.**
    - One muted context line ("In ‹band›. Linked copy in My Songs: your edits here are the band's.").
    - The keyboard hint.

**Phone.** `SongViewPage` keeps its single column. The changes are:
- The Back label follows 1.1.
- The facts become tappable (1.3).
- The Edit button goes; the full-screen editor is Add song only.
- There's no ‹ ›: phones swipe back, and stepping isn't drawn for mobile.

### 1.3 Editing facts and details: each field saves itself

- **Title / artist:**
  - Click to edit (an input in the same type style, with an orange 2 px ring). Screenshot 07.
  - Enter or blur saves; Esc cancels.
  - An empty title reverts, with the toast "A song needs a title · kept the old one".
- **Tuning:**
  - Desktop: the picker anchored to the tile, built-ins in pitch order plus custom tunings, then New tuning…. Screenshot 08.
  - Phone: the existing tuning picker **sheet**.
  - Picking saves.
- **Key:**
  - Desktop: a major/minor grid anchored to the tile. Screenshot 09.
  - Phone: the existing circle of fifths sheet.
  - Picking saves.
- **BPM / length:**
  - Type straight into the tile. Screenshot 10. Validation is as in the editor today.
  - Phone: the number pad.
- **Album, tags:** click the value to edit; Enter or blur saves.
- **Links:**
  - "+ Add" pastes a URL; the type is auto-detected (`utils/linkDetection.ts`).
  - Each row has edit and remove on hover (desktop) or a swipe (phone).
- **After each save:** a toast "‹Field› saved · Undo". Undo writes the previous value back (screenshot 11).
- **Every save sends `version`:**
  - On `stale_version`: refetch, show the latest value, and toast "Someone just changed this. Showing the latest."
  - Don't retry automatically.
- **Transport:** use the existing song update (`useSaveSong` → the update op) with only the changed field. No new operation is needed.
  - If the update op today requires the whole row, add a partial-update variant behind the API (08: no client-side merge of other people's fields).

### 1.4 Notes: in place, with Done

- Each layer shows rendered Markdown. A click on the text, or its **Edit**, opens the editor in place:
  - **Write / Preview** tabs.
  - A formatting bar: H, B, I, list.
  - A tall monospace textarea.
  - **Cancel** (Esc) and **Done** (⌘↵ / Ctrl↵).
  - Screenshots 12–13.
- **One note open at a time.** Trying to open a second toasts "Finish or cancel the note you're editing". ‹ › and J/K are blocked while editing.
- **Band note:**
  - Saves via `setBandNote` with `version`.
  - On `stale_version`, **keep the draft** and show an inline warning above the editor:
    - Text: "‹Name› saved a newer band note while you were typing. Yours isn't lost. Pick which to keep."
    - **Show theirs**: loads theirs into the editor; your draft goes into Undo.
    - **Keep mine**: re-saves your draft with the fresh version.
    - Screenshot 14.
  - Below the band note, in mono: "‹EDITOR› · ‹WHEN›" and **PRACTICE LOG · N**. The log opens inline, newest first (screenshot 15), per Part A · 7.
- **My notes:** private; same editor.
- **"In ‹setlist›":** this set's per-song note (the setlist item's `notes`). It saves through the setlist item update. It only shows with `from=setlist`.
- Reuse the Markdown editor from the current song page (screenshot 4 in `review/songs-notes/`). Add the formatting bar and keyboard keys; don't build a second editor.

### 1.5 Add song and the old editor

- `EditSongModal` is opened **only** by Add song (Songs header, Home quick action, and anywhere else that creates a song).
- Remove every **edit** entry point:
  - the pane's Edit;
  - the row menu's Edit;
  - the Edit button on `SongViewPage`;
  - Links "+ Add" on the pane. It now goes to the page and opens the add-link input.
- Each of these navigates to the page instead.
- Delete the edit-only code paths in `EditSongModal` that this orphans (CLAUDE.md: remove orphans your change creates). Keep Spotify matching, "Also add to My Songs" and the discard prompt for Add.
- **Desktop Add song keeps the sidebar.** Render it inside the layout (a page at `/songs/new`, two columns as drawn in the desktop demo), not as a full-screen overlay. On phones it stays a full-screen route.

### 1.6 The Songs pane and rows (desktop)

- **The pane is read-only:**
  - An **Open** button top right (expand icon) → `/songs/:id?from=songs`.
  - **Edit** → the same page.
  - The notes header "Full screen" becomes **Open to edit** → `?from=songs&edit=band`.
  - A click on a note's preview → `?edit=band` or `?edit=mine`.
  - Screenshot 01.
- **Rows:** single click selects (as now). **Double-click or Enter** opens the page. Below the pane breakpoint, a click opens the page (as now).
- **Pane width:** 400 px (480 at ≥1536). The breakpoint stays at ≥1440.
- **Tuning filter (desktop):** replace the chips and "+N" with **one "Tuning" filter chip**.
  - It opens an anchored menu (multi-select, pitch order, a colour dot per tuning).
  - The chip's label shows the selection ("Tuning", "D DROP", "2 tunings").
  - The phone keeps the scrolling chips as built.

### 1.7 Setlist rows → song page (lands with 0.9.1)

In the setlist editor:
- Each **song** row gets an open icon (external-link style, at the row's end, before remove).
- Double-click also opens it.
- Both go to `/songs/:id?from=setlist:<setlistId>`.
- Breaks and sections don't get one.
- Phone: the row's hold menu gets **Open song**.

Screenshot `review/setlist-nav/` isn't needed for this; see `design/demo/Song Page.html` → "Go to Fall Set".

### 1.8 Accept (0.9.1)

**Unit (Vitest):**
- `parseOrigin`, `originLabel`, `originHref`.
- Prev/next from each origin, including the song missing from the list.
- The title-empty revert.

**Playwright, desktop 1440:**
1. Songs → select a row → **Open** → the page shows "← Songs" and "n of N".
   - J goes to the next song in the list's order.
   - Esc returns to Songs with that song selected.
2. Setlist → a song's open icon → "← ‹set›", "In ‹set›" shown, "2 of 8".
   - Back lands in the set with the row selected.
3. A direct link `/songs/:id` → "← Songs", no ‹ ›.
   - A reload keeps `?from=`.
4. Edit the title, BPM, tuning and key in place → each shows "saved · Undo". Undo restores the value.
5. Edit the band note → Done saves.
6. Simulate `stale_version` (a second session) → the conflict banner. Keep mine saves; Show theirs swaps the text.
7. The pane's Edit / Open to edit / note click all land on the page. With `edit=band`, the band note editor is open.
8. Add song still opens the editor, with the sidebar visible.

**Playwright, phone 390:**
- Song view → tap BPM → the number pad → saves.
- Tap tuning → the sheet → saves.
- No Edit button.

**Other checks:**
- `data-testid` on every new control:
  - `song-page-back`, `song-page-prev`, `song-page-next`
  - `song-fact-{tuning|key|bpm|length}`
  - `song-title-input`
  - `song-note-{band|mine|set}-edit`, `song-note-done`, `song-note-cancel`
  - `song-note-conflict-keep`, `song-note-conflict-theirs`
  - `songs-pane-open`, `setlist-row-open-song`
- Release (CLAUDE.md, Phase 1):
  - `package.json` → **0.9.1**.
  - A CHANGELOG `## [0.9.1]` section.
  - A `release_notes` upsert in a migration. Title "Open a song as a page"; body: "Edit everything about a song in one place. Back takes you to where you came from."

---

## Part 2 · Setlist navigation (in Phase 3, 0.10.0)

### What changes

**Desktop:**
- The **nested column of setlists between the sidebar and the editor goes**.
- **Setlists** opens an **index**, and a set opens **full width** (`review/setlist-nav/ab1`, `ab2`; compare `0-today`).
- Beside the set's name, a **switcher** jumps to any other set.

**Phone:** already list → editor. The name gets the switcher as a bottom sheet.

### 2.1 Routes

- `/setlists`: the index (desktop and phone).
- `/setlists/:id`: the editor, full width on desktop.
- `?from=` works as for songs (`show:<id>`, `search:<q>`). Without it, Back says **← Setlists**.
- **Sidebar Setlists always opens the index**, not the last set.

### 2.2 Index (desktop; the phone list is restyled per Phase 3 as already planned)

- **Grid of cards,** `repeat(auto-fill, minmax(300px, 1fr))`, gap 14. Each card shows:
  - The show line in mono caps ("THE CROCODILE · SAT, NOV 7", or "NOT ATTACHED TO A SHOW").
  - The name in display caps.
  - Songs / min / retunes.
  - The first five song titles, ellipsised.
  - ⋯ (Open, Duplicate, Delete, with the existing precise confirm).
- **Sort:** next show first (soonest date), then sets without a show by name. The existing Sort control (Next show / Name / Updated) stays.
- **The next show's set** gets a 2 px accent outline and "NEXT SHOW ·" in its show line.
- **New setlist:** a primary button in the header and a dashed "New setlist" card at the end.
- **States:** empty, loading and error as Phase 3 already specifies.

### 2.3 Editor header

- **Back:**
  - A small "← Setlists" button (or the origin label) sits above the title, beside the show line.
  - Phone: the existing "‹ Setlists" in the app bar.
- **The name switcher:**
  - **Desktop:** a 40 px round **caret ⌄** button right of the title. It opens an **anchored dropdown** (`review/setlist-nav/ab3`) with:
    - The heading "Setlists · N" and "NEXT SHOW FIRST".
    - Each set: name, plus "date · songs · min · retunes". The current one is ticked and tinted.
    - A divider, then **All setlists** (→ index) and **New setlist**.
  - **Phone:** a 38 px round **swap ⇄** button right of the title (`m2-editor`). Tapping the name or the button opens a **bottom sheet** "Switch setlist" (`m3-switcher`) with:
    - The subtitle "Next show first".
    - Rows: a show line in mono, "TONIGHT · ‹venue›" in accent for today; then the name; then "songs · min · retunes". The current set is ticked.
    - Two buttons at the bottom: **All setlists** and **New setlist** (primary).
  - **The switcher only switches.** No Duplicate, Delete or Rename inside it.
- **⋯ in the header** (right of Add songs): **Rename, Duplicate, Delete…**. These move here from the old list column's cards.
- With **Add songs** open, the editor and the song browser share the width (`a3-add-songs`); there's no third column.

### 2.4 Accept (folded into Phase 3's)

- Desktop:
  - Sidebar Setlists → the index.
  - A card → the editor full width with "← Setlists".
  - Caret → dropdown → another set opens in place.
  - "All setlists" → the index.
- Phone: the swap button → the sheet → another set. The sheet's All setlists → the list.
- No element renders between the sidebar and the editor on `/setlists/:id` at 1280 and 1440.
- Header ⋯ Rename / Duplicate / Delete work. Duplicate isn't attached to a show; Delete's confirm text is unchanged.

---

## Part 3 · Icon rule: caret ⌄ vs swap ⇄ (from 0.9.1)

| Icon | Means | Lucide | Use for |
|---|---|---|---|
| **Caret ⌄** | Opens **right here**: a dropdown anchored to the control, or a section that rolls open in place | `ChevronDown` | Desktop switchers and menus, the band switcher chip, the friend privacy line, Sort / View menus on desktop |
| **Swap ⇄** | Opens a **bottom sheet to change what you're looking at** | `ArrowLeftRight` | The phone setlist switcher, and any later "switch the current thing" sheet |
| **Chevron ›** | **Go there**, or **pick a value** on its own screen or sheet | `ChevronRight` | List rows, form field rows (Tuning in Add song) |

- The design kit has the matching icon as `swap` in `design/source/kit/rock.js`.
- **Audit in 0.9.1:** check each `ChevronDown` in `src/` (currently in `SetlistsPage`, `ContextSwitcher`, `Dropdown`, `AddItemDropdown`, `TimePickerDropdown`, `DurationPicker`, `DatePicker`, `ExpandableSongNotes`, `ScrollableNotes`, `InlineStatusBadge`, `ShowsPage`, `AuthPages`, `JamSessionPage`, `LineupCard`).
  - If a `ChevronDown` opens a **bottom sheet on phones** to switch the current item, change it to `ArrowLeftRight`.
  - If it opens a field picker, change it to `ChevronRight`.
  - Note each one you change in the PR description.
  - Pickers that drop down in place keep the caret.

## What this changes in the other guides

- `05-plan.md`: a new **Phase 2.1 · Song page (0.9.1)**, and Phase 3's scope gets Part 2.
- `03-screens.md`: Songs (the song view, the editor, the pane) and Setlists (list, editor) point here.
- `09-design-review-songs.md`: status decided, see this brief.
