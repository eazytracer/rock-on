# Songs (catalog)

**Purpose:** the current context's song catalog: find, look up, tidy (`workflows/04`, `05`).

**Must**

- The context comes from the switcher; there are no Band/My tabs.
- Toolbar:
  - Search.
  - Filters: tuning, upcoming show, tags.
  - Sort: name, newest, oldest, next show.
  - **View options.**
  - **Show hidden** toggle.
  - **Add song.**
- **Song row (catalog variant):**
  - Always: **title**, **tuning** (colour plus name), **duration**.
  - Optional, via view options: key, BPM, artist, up to 2 link icons (tap to open), notes indicator (none / mine / band / both), next show.
  - Personal only: a "from ‹band›" tag on linked copies.
- Tap a row → **song view**.
- Row menu:
  - Edit.
  - **Add to setlist** [Not built].
  - Add to My Songs (band) / Add to ‹band› (Personal).
  - **New version** [Explore].
  - Hide / Unhide.
  - Delete (names the setlists and shows that use it).
- Personal: **Songs in my bands not in my catalog**, with copy all or pick some.

**Must not**

- Artist shown by default (bands playing originals don't need their own name 20 times).
- A Duplicate action. A sync-status icon. An initials avatar.

**States**

- No songs → "Add your first song".
- No matches → "Clear all filters".
