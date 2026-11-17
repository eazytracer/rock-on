# 12 · Build brief: Tools and chart (Phase 5)

**Status: research, Nov 16 2026. Decisions answered Nov 16** (see Decisions at the end). Next: `/plan`.

Phase 5 is next in the plan ([05](05-plan.md)). It's all net-new: a Tools screen (Tuner · Metronome · Chords), an
in-app synth, the chart reader and editor, and the neck-style custom tuning editor. Nothing is removed except the
"Soon" placeholders and the old custom-tuning form.

| Slice                           | What                                                                                                                                                                                                      | Ships                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **5a** · Tools hub + tuner      | `/tools/:tab` shell, shared audio context, Karplus-Strong pluck, the tuner (mic + worklet), Tune from the song page, retune lines and the practice session                                                | Commits on `redesign/integration`, under `[Unreleased]` |
| **5b** · Metronome              | Lookahead scheduler on the audio clock, rAF visuals, tap / sig / subdivisions / accents / flash, Click from the song page, Save to song, the drift test                                                   | Same release                                            |
| **5c** · Chords + way in        | Chord domain (parse, transpose, shapes), the chord card + strum, Chords tab, **Home Tools row**, **desktop sidebar Tools group**                                                                          | Same release                                            |
| **5d** · Chart reader           | `song_charts` + RPCs (migration starts here), ChordPro parser, the reader (phone stage + desktop), Controls, chord viewer, starting note, notes sheet, Chart from the song page / pane / practice session | Same release                                            |
| **5e** · Chart editor (text)    | Paste / ChordPro / chords-over-lyrics, live preview, Lyrics + chords / Chords only, starting note row, save with conflict check: desktop two-pane and phone                                               | Same release                                            |
| **5f** · Phone chord placing    | Lyrics mode (chords ride their letters), Chords mode (key palette, tap a letter, nudge, Other… keypad), Chords from Verse 1                                                                               | Same release, built last (decision 3)                   |
| **5g** · Custom tuning + finish | Neck editor replaces `CreateTuningModal`, `create_tuning` / `update_tuning` RPCs, unique index, extended-range seeds, Settings → Tunings Tuner shortcut, release metadata                                 | Same release                                            |

No version number of its own (decision 3): CHANGELOG `[Unreleased]`, one migration file
(`supabase/migrations/20261119120000_redesign_phase_5.sql`, created in 5d and amended in place), one `release_notes` row.

## Read first

- `design/source/DECISIONS.md`: **Chart**, **Sound tools**, **Metronome (locked Oct 30)**, **Tuner arrows**, **Starting note
  sheet**, **Extended-range naming**, **Custom tuning (locked Oct 31, final)**, **Tools on Home**, **Prototype review fixes
  (Nov 1)** (continuous scroll; "Tools are one screen everywhere"), Part A · 1 (tuning colours) and 1.2 / 1.3.
- `design/source/CHART-DATA-MODEL.md` (but see 3.1: its table shape is superseded by 04's).
- `design/OPERATIONS.md` §7 Charts, §8 Tunings, §2 `get_preferences` / `set_preferences`.
- `design/PLATFORM-NOTES.md` → Stage screens, Audio. Those two tables are the web rules for this phase.
- `docs/redesign/03-screens.md` → "Chart and tools (net new)", plus the Home, song view, setlist editor, practice session,
  Settings rows; `04-data.md` → "Songs, notes, charts, tunings"; `08-api-conventions.md`.
- Design, in this order:
  - `design/demo/screens/Tools on Home.html` (1 Home band, 2 Home Personal, 3 Tools · Chords, 4 More trimmed).
  - `screens/Sound Tools.html` (1 chart with chord viewer, 2 starting note, 3 tuner, 4 where the tuner opens).
  - `screens/Metronome.html` (1 try it, 2 from a song + Save to song, 3 count-in, 4 metronome settings).
  - `screens/Song Chart.html` (1 song view, 2 reader, 3 notes full screen, 4 rotated, 5 chords mode, 6 lyrics mode, 7 other chord, 8 paste).
  - `screens/Custom Tuning.html` (style B "neck" is the locked one).
  - Desktop: `demo/Rock On Desktop.html`, views `tuner` / `metro` (`desktop-tools.js`), `chords` / `chart` (`desktop.js` ~L120–130),
    `chartedit` (`desktop-final.js` ~L53–62), `tuning` + chart starting note (`desktop-more.js` ~L41–58). The desktop sidebar
    has a **Tools** group (Tuner, Metronome, Chords) under the main nav (`desktop.js` `TOOLS`).
  - The mobile demo checklist group **Chart and tools** (`Rock On Mobile.html`): chart, starting note, tuner, metronome, chord
    lookup, custom tuning. That's the phase's acceptance list.
- `design/demo/desktop-tools.js` is the cited synth reference: copy the **Karplus-Strong** maths, not the metronome loop (2.4).

The demos are reference, not code. Rebuild in this app's kit (`components/ui/*`: `Segmented`, `Sheet`, `Button`, `IconButton`,
`Chip`, `Switch`, `TuningPill`, `Group` / `ListRow`), hooks and `services/api` layer.

---

## Part 1 · Where things stand

### 1.1 Tunings (exists, mostly)

- **Table `public.tunings`** (0.4, `20260704191222_tunings.sql`; verified in the local DB): `id`, `instrument` (`guitar` | `bass`),
  `string_count` (3–12), `pitches SMALLINT[]` (MIDI, low → high, `cardinality = string_count`), `name`, `slug` (unique, built-ins
  only), `is_builtin`, `color`, `description`, `context_type` (`personal` | `band`), `context_id TEXT`, `created_by`,
  `created_date`, `updated_date`, `version`, `last_modified_by`. Check `tunings_builtin_xor_owned`. RLS: everyone reads built-ins;
  context members read / insert / update / delete their context's customs. Trigger `tunings_lock_ownership`. Function
  `builtin_tuning_slug(label)`. `songs.tuning_id → tunings(id) ON DELETE SET NULL`.
- **No unique index on pitches.** The only indexes are the PK, `idx_tunings_instrument`, `idx_tunings_owner`, `tunings_slug_key`.
- **Built-in seeds (18 rows, local DB):** guitar 6 (standard, half-step-down, whole-step-down, drop-d, drop-db, drop-c, drop-b,
  c-standard, open-g, open-d, dadgad), `standard-7`, `standard-8`; bass `bass-standard`, `bass-drop-d`, `bass-eb`, `bass-5`, `bass-6`.
  **C Standard already landed in Phase 0** (`20261107120000_redesign_phase_0.sql`). The extended-range rows have `color = NULL`.
  **Missing** against DECISIONS "Extended-range naming": A DROP⁷ (A E A D G B E), A STD⁷, G♯ DROP⁷, and 6-string baritone B STD.
- **`src/utils/tunings.ts`**: `CANONICAL_TUNINGS` (11 built-in colours as `var(--tuning-*)` + `hex`), `BUILTIN_TUNINGS` (a client
  mirror of the seed with `pitches`), `canonicalTuningId` (lock-step with `builtin_tuning_slug`, parity-tested),
  `tuningColor`, `tuningLabel`, `tuningShortLabel` (`SHORT_LABELS`: "E STD", "D DROP"…; **no** 7-string / bass labels, so
  `standard-7` renders "7-STRING STANDARD"), `midiToNoteName` (flats, "Eb3"), `pitchNames`.
- **`components/ui/TuningPill.tsx`**: label + colour, optional `color` for customs.
- **Custom tunings UI:** `components/tunings/CreateTuningModal.tsx` (305 lines): instrument, string count **3–12**, one dropdown
  per string (C1–G4), 12 swatches, **no duplicate check**. Opened from `songs/SongFacts.tsx` (tuning sheet → New tuning…),
  `songs/EditSongModal.tsx` (Add song) and `tunings/TuningsSection.tsx` (Settings). `TuningsSection` lists customs with
  delete only (no edit, no Tuner shortcut).
- **Data access:** `services/TuningService.ts` calls `supabase.from('tunings')` directly (pre-08 style); `hooks/useTunings.ts`
  is `useState` + `useEffect`, not TanStack Query, and has no query key.

### 1.2 Charts, chords, lyrics (nothing real)

- **No chart table.** `song_charts` doesn't exist (no `*chart*` relation in `public`).
- `songs` has legacy `lyrics_url` and `chords_url` text columns (0 of 6,252 local rows use either). The `Song` model has
  `lyrics?: string` and `chords: string[]`, which `RemoteRepository` fills with `''` / `[]` and never persists. Leave them alone
  (pre-existing dead code); the chart doesn't use them.
- `songs.time_signature` exists but is unmapped in the app and empty locally. The metronome doesn't read it (decision 9).
- `songs.tempo` is the BPM (`bpm` in the app). `songs.key` holds the key as typed ("Em", "Bb").
- **`user_preferences.chart` and `.metronome`** exist (JSONB, default `{}`, Phase 0), but `services/api/preferences.ts` only
  reads / writes `theme` and `list_views`.
- No `AudioContext`, `getUserMedia`, ChordPro, transpose or chord-shape code anywhere in `src/`.
- `src/domain/format.ts` has `KEY_ROOTS` (flats, ASCII), `showKey` (♭ / ♯ glyphs) and `sameKey`. Reuse them for transpose spelling.
- `index.css` already defines `--chord` (dark and light).

### 1.3 Placeholders already wired for Phase 5

| Where                    | File                                                           | What's there now                                                                    | testid                                                        |
| ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Song page buttons        | `components/songs/SongFacts.tsx` (`SoonButton`, ~L381–397)     | Disabled **Chords & lyrics** (primary), **Tune**, **Click ‹bpm›**, each with "Soon" | `song-chords-button`, `song-tune-button`, `song-click-button` |
| Songs pane (desktop)     | `components/songs/SongDetail.tsx` (~L86–98)                    | Disabled **Chords & lyrics** "Soon"                                                 | `song-chords-button` (same id as the page: rename one)        |
| Setlist retune line      | `components/setlists/SetlistRows.tsx` `RetuneLine` (~L420–445) | "RETUNE ‹from› → ‹to›" + disabled **Tune** ("The tuner arrives with Tools")         | `setlist-retune`, `setlist-retune-tune`                       |
| Practice session Up next | `pages/PracticeSessionPage.tsx` (~L362–372)                    | Warn card with disabled **Tune now**                                                | `session-tune-now`                                            |
| Practice session toolbar | `pages/PracticeSessionPage.tsx` (~L452–470)                    | Disabled **Chart** and **Tune**                                                     | `session-chart`, `session-tune`                               |

**Surprises:**

- **`REDESIGN_TOOLS` doesn't exist.** `src/config/featureFlags.ts` has only `SYNC_USE_AUDIT_LOG` and `REDESIGN_CALENDAR`. 05-plan
  Phase 1 said the Home Tools row would be hidden behind it; **the Tools row was never built** (`HomePage.tsx` goes practice card →
  Upcoming → Quick actions). So Phase 5 builds the row, and no flag (decision 1).
- **No Tools entry in the desktop sidebar** (`layout/Sidebar.tsx`), which the desktop demo draws.
- `PracticeSessionPage` keeps its place (song index, elapsed, per-song time, played set) in React state only. **Navigating away
  to a `/tools` or chart route would lose the session.** Tune now and Chart must open over the session, not as a route (2.3).
- The session already has a working wake lock (`useWakeLock`, local to the page) and pedal keys (← → / PgUp PgDn, N, S). Extract
  both into hooks so the chart reader reuses them (2.5).

### 1.4 Design gaps and conflicts found

1. **Chart table shape.** `CHART-DATA-MODEL.md` has `id`, `song_id` unique, `body`, `original_key`, `revision`, `updated_at`, a
   `{x_start_note: D4}` directive and a separate `chart_prefs` table. `04-data.md` (later, against this schema) has `song_id` PK,
   `chordpro`, `starting_note SMALLINT`, `version`, `updated_date`, with transpose / size in `user_preferences.chart`.
   OPERATIONS follows 04 (`set_starting_note` takes MIDI 0–127). **Use 04's shape, plus an `id` column** (3.1 explains why).
2. **Server-side conversion.** OPERATIONS `save_chart` says "convert chords-over-lyrics on save". Writing that parser in PL/pgSQL
   is a poor fit. Recommend: the client converts with a pure `src/domain/chordpro.ts` (portable to Dart line for line, per 08),
   and the server stores ChordPro and enforces only the size cap and version (decision 4).
3. **Tuner chevron thresholds.** DECISIONS: 3 beyond ±25 ¢, 2 at ±12–25, 1 at ±5–12, in tune within ±5. `desktop-tools.js`
   uses 25 / 10 / 3. **Follow DECISIONS.**
4. **Chart keys vs pedals.** The desktop chart demo maps ← → to transpose. PLATFORM-NOTES says pedals send ← → ↑ ↓ / PgUp PgDn /
   Space, and the practice session already uses ← → for songs. A pedal in arrow mode would transpose instead of paging (decision 5).
5. **Tempo range.** The demo slider is 30–260; OPERATIONS `save_song_bpm` accepts 20–300. Pick one constant (decision 10).
6. **Where the tuner lives on phones.** Sound Tools says "More → Tuner"; the later Tools on Home (Oct 31) trims More and puts
   the Tools row on Home. **Later wins:** Home row plus the in-context buttons; no More row.
7. **Metronome settings** (click sound, count-in, flash, vibrate) are drawn under **Settings → Music**, which is Phase 6's
   Settings rebuild. Phase 5 keeps flash on the Metronome tab (as drawn on desktop) and leaves the Settings page for 6 (decision 8).
8. **String counts.** The neck editor is drawn for Guitar 6 / 7 and Bass 4 / 5. Today's modal allows 3–12, and built-ins
   include 8-string guitar and 6-string bass. Shrinking to 6/7 + 4/5 would remove a capability (decision 6).
9. **Reference metronome.** `desktop-tools.js` lights beats with `setTimeout`, looks ahead only 0.12 s, and accumulates
   `nx += interval`. All three break the platform rules or drift over long runs (2.4).

---

## Part 2 · The target

### 2.1 Routes

| Route                                            | What                                               | Layout                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/tools`                                         | Redirects to `/tools/tuner` (or the last tab used) | —                                                                                                                                  |
| `/tools/:tab` (`tuner` · `metronome` · `chords`) | One Tools screen, three tabs                       | Inside `ProtectedLayoutRoute`: sidebar on desktop, bottom nav on phones                                                            |
| `/songs/:songId/chart`                           | Chart reader                                       | Phone: stage layer (`fixed inset-0`, like the practice session). Desktop: inside the layout, full width, with a Full screen button |
| `/songs/:songId/chart/edit`                      | Chart editor                                       | Phone: full-screen route. Desktop: two-pane page inside the layout                                                                 |

**Query parameters:**

- Tuner: `?tuning=<tuning id or built-in slug>&prev=<id or slug>`. `prev` marks the strings that change (orange). An unknown
  value falls back to the last tuning used.
- Metronome: `?song=<songId>` loads the song's BPM and enables Save to song. `?bpm=` alone sets the tempo.
- Chords: `?chord=G7`.
- Chart routes carry the song page's `?from=` unchanged (`utils/songOrigin.ts`), so Back from the chart lands on the song page
  with the same origin, and Back from there goes where the song came from.
- **Back on Tools** uses `useGoBack('/')` (history back, Home on a direct load), as drawn ("back to wherever you came from").
- Put the param parsing in one tested helper, e.g. `src/domain/toolsLink.ts`: `toolsHref(tab, params)` and `parseToolsParams(search)`.

### 2.2 Ways in

| From                              | Control                                                                                                                                                                            | Goes to                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Home (band)                       | **Tools row** between the practice card and Quick actions: three tiles with live hints (Tuner · "E STD" = last tuning used, Metronome · "124 BPM" = last tempo, Chords · "Lookup") | `/tools/<tab>`                                                               |
| Home (Personal)                   | The same row **leads the page**                                                                                                                                                    | same                                                                         |
| Desktop sidebar                   | **Tools** group: Tuner, Metronome, Chords (icons fork / metro / chord-box), after the main nav                                                                                     | same                                                                         |
| Song page                         | **Chords & lyrics** (chart exists) or **Add chords & lyrics** (no chart)                                                                                                           | reader / editor                                                              |
| Song page                         | **Tune**                                                                                                                                                                           | `/tools/tuner?tuning=<song's tuning>`                                        |
| Song page                         | **Click ‹bpm›**                                                                                                                                                                    | `/tools/metronome?song=<id>`                                                 |
| Songs pane (desktop)              | **Chords & lyrics**                                                                                                                                                                | reader (`?from=songs`)                                                       |
| Setlist retune line               | **Tune**                                                                                                                                                                           | `/tools/tuner?tuning=<to>&prev=<from>`                                       |
| Practice session Up next (retune) | **Tune now**                                                                                                                                                                       | Tuner **over the session** (2.3) on the next song's tuning, `prev` = current |
| Practice session toolbar          | **Tune**, **Chart**                                                                                                                                                                | Tuner / reader over the session for the current song                         |
| Chart reader Controls             | **Chords** viewer, starting note 🔈                                                                                                                                                | in place                                                                     |
| Settings → Tunings                | **Tuner** button in the section's top bar (one, not per row); **New tuning**                                                                                                       | `/tools/tuner`; the neck editor                                              |
| Song tuning picker                | **New tuning…**                                                                                                                                                                    | the neck editor, and the new tuning is picked on save (as today)             |

### 2.3 Build pieces as components, routes as thin wrappers

So the practice session can open the tuner and the chart over itself without unmounting:

- `components/tools/Tuner.tsx`, `Metronome.tsx`, `ChordLookup.tsx`. `pages/ToolsPage.tsx` = header (Back + `Segmented`
  Tuner | Metronome | Chords) + the tab.
- `components/chart/ChartReader.tsx`. `pages/ChartPage.tsx` loads the song + chart and renders it.
- In `PracticeSessionPage`, Tune now / Tune open `<Tuner>` and Chart opens `<ChartReader>` in a layer above the session (same
  `fixed inset-0` pattern, × / Esc closes, the session's state stays put). The session's ← → keys pause while a layer is open;
  the layer's own keys take over.
- Leaving the Tools tab stops the mic and the metronome. Switching tabs stops the metronome (as the demo does).

### 2.4 Screens and states

**Tools header (all tabs, both platforms).** Back · "Tools" · the three-way `Segmented`. Same header on every tab.

**Tuner** (Sound Tools 3; desktop `tuner`).

- Main area: the note letter + octave, a needle on a ±50 ¢ scale (21 ticks, centre mark), stacked chevrons each side pointing
  toward the note (3 / 2 / 1 per the DECISIONS thresholds; in tune = one each side, both green), "TUNE UP · 18¢" / "TUNE DOWN ·
  9¢" / "IN TUNE". Colour runs red → green with distance. No blinking or motion (Reduce Motion has nothing to stop).
- Strings row low → high: each string's note, string number; **changed from `prev` in orange**; the current string selected;
  tap a string = pick it **and** hear its reference (pluck). "N of 6 in tune" (a string counts once it holds within ±5 ¢ for
  ~300 ms).
- **Auto-detect string** switch (on by default): follows the nearest string to the detected pitch.
- Tuning picker: chips on desktop (side panel: TUNING chips + "+ Custom"), the existing tuning picker sheet on phones. Built-ins
  in pitch order, then the context's customs. Opening "+ Custom" / New tuning opens the neck editor.
- **Hear ‹note›** button (wide, speaker icon).
- **Mic states:** idle ("Start tuner" button; the browser asks on first press), listening, **denied** ("Microphone is off · Turn
  on in browser settings", reference notes still work), no input device, not a secure context (dev over LAN http; see 2.7).
- Desktop: `minmax(0,1fr) 340px` grid (main + side panel: tuning chips, strings, Hear, Auto-detect, the keys hint "1–6 string ·
  Space hear · ← → tuning"). Full width.
- **Instrument** (decision 7): the song's tuning is a guitar tuning; a bassist needs the bass version.

**Metronome** (Metronome 1–2; desktop `metro`).

- Beat squares (one per beat of the bar): tap cycles accent → normal → silent; the current beat lights in time.
- Tempo hero: big number + Italian marking (LARGO … PRESTO), −/+ (hold to repeat), slider, **Tap** (average of the last 4 taps,
  reset after 2.5 s).
- Time: 2/4 · 3/4 · 4/4 · 6/8. Clicks per beat: 1 · 2 · 3 · 4 (quarter, eighth, triplet, sixteenth). New signature resets
  accents (beat 1 accented; 6/8 accents 1 and 4).
- **Start / Stop**: the 84 px dock button on phones; primary large button on desktop.
- **Flash on the beat**: an orange edge pulse on beat 1 only (never full screen). Vibrate: Android only, optional (Phase 6
  setting; skip for now).
- **From a song** (`?song=`): loads its BPM; once you change it, **Save to song** appears and writes `songs.tempo` through the
  existing song update (`useSaveSong`, only the changed field, with `version`), toast "BPM saved · Undo".
- Desktop side panel: Time, Clicks per beat, Flash switch, "From ‹next setlist›" tempo list (click a song row = set its tempo),
  keys hint "Space start · T tap · ↑ ↓ tempo". Full width.
- Count-in in the practice session (Metronome 3) is punted (decision 8).

**Chords** (Tools on Home 3; desktop `chords`).

- Root chips (12, sharps / flats as `showKey`) and quality chips (Major · Minor · 7 · m7). A centred card: the chord name in
  `--chord`, the diagram (× muted, ○ open, dots, barre bar, fret number above the nut), the fingering text ("x32010"), **Play
  ‹chord›** (strum). **The same `ChordCard` as the chart's chord viewer.**
- Anything without a shape: "No diagram yet" (Play still strums the computed notes).

**Chart reader** (Song Chart 2, 4; Sound Tools 1; desktop `chart`). A stage screen.

- One continuous scroll (also swipeable). **Next** (orange, wider) and **Back**, same 88 px height on phones, page by "most of a
  screen" keeping two lines of overlap. Tapping the top / bottom half of the text pages too. An orange progress bar on the right edge.
- Performance-first: only the title, a **Notes** button (44 px) and a labelled **Controls** button (sliders icon) show. Controls
  open as a bottom sheet with **Done** (phones) / a toolbar row (desktop): **Key −/+** (shows the key and "+2"), **Size** (A / A
  with the value), **Hide chords / Show chords** chip (chord-box icon, filled while chords show), the starting note **🔈 D**
  (tap = play the note; hold = open the starting-note sheet), **Chords** (opens the chord viewer).
- **Chord viewer:** centred card "Chord n of N", ‹ ›, the `ChordCard`, chips for every chord in the song in first-use order
  (transposed; current = orange), Play. Tapping a chord in the lyrics opens it on that chord. No auto-play. Targets ≥ 40 px.
- **Starting note sheet:** one octave of large piano keys, octave −/+ (C shows its octave, C₄), the key note tagged KEY; two
  buttons "‹G› chord" (always the song's key, transposed) and "‹D4› note" (accent); **saves as you pick**; Done closes.
  The pill reads relative to the key ("D · 5th") and moves with transpose.
- **Notes:** a bottom sheet over the chart at 62 % height (swipe down / × / tap outside), band note + My notes. Reuse the
  session's `SongNotes` (extract it to `components/songs/SongNotesView.tsx`; don't build a second one).
- "Karaoke" mode: chords hidden → chord rows collapse and lines tighten.
- Landscape phone: two columns, the page buttons stacked down the right edge.
- Desktop: inside the layout, full width. Text in two CSS columns (`columns: 2 340px`), a right panel **Chords in this song**
  (each chord with its diagram; click = viewer / Play), pager buttons bottom right (Back 84 px, Next 120 px tall), the keys hint
  line, a Full screen button (Fullscreen API on press, never automatic). Back / origin button top left, title + "artist ·
  tuning · length" header. A **Tune** button in the toolbar opens the tuner on the song's tuning.
- **States:** loading skeleton; no chart ("No chords yet" + **Add chords & lyrics**); error + Retry; the song deleted (`not_found`).
- **Edit** (pencil in the header, or E on desktop) → the editor.

**Chart editor** (Song Chart 5–8; desktop `chartedit`).

- Header: Back (to the song / reader), "Chords & lyrics · ‹title›", **Cancel** and **Save chart** (explicit save; the editor is
  a working document, not save-as-you-go). Cancel with changes asks with `useConfirm` ("Discard your chart changes?").
- **Desktop two-pane:** left "Edit": a monospace textarea (chord lines above lyric lines, `[Section]` headers, ChordPro works
  too), Paste / Clear / Try a sample, **Chords from Verse 1 → next verse**, the Starting note row (note, Hear it, the piano sheet).
  Right "Preview": the parsed chart with **Lyrics + chords / Chords only** (`Segmented`). Empty preview: "No chart yet · Paste
  chords over lyrics on the left."
- **Phone (5e):** Paste screen (paste, see what was detected: "Sections 4 · chords 22", open in the editor), the same text editor
  - a Preview toggle, starting note row.
- **Phone (5f):** Lyrics mode (type words; chords dim and ride their letters; the [ ] key drops a chord at the cursor) and
  Chords mode (a palette from the song's key; pick a chord, tap a letter; tap a placed chord to select → ◀ ▶ nudge (44 px),
  change, remove; **Other…** keypad: root → type → optional bass, 48 px keys, "Type it instead" accepts "Fmaj7/A").
- **Conflict:** saves send `version`; on `stale_version` keep the draft and show the inline banner pattern from the band note
  (10 · 1.4): "‹Name› saved a newer chart while you were editing. Yours isn't lost." **Show theirs** / **Keep mine**.
- Too long (> 200 KB): toast the server's copy "That's too long for one chart."

**Custom tuning** (Custom Tuning, style B; desktop `tuning`).

- Name field (kit field, Name · REQUIRED, placeholder "Open C, DADGAD…") with the colour dot at its trailing edge (opens
  **Automatic (from pitch)** or 12 swatches; opens on the first swatch not used in this context).
- Guitar / Bass `Segmented` + string count (6 / 7 / 8 or 4 / 5 / 6; decision 6).
- The neck: vertical strings under an orange nut, low string left, each string drawn at its gauge, ↑ / ↓ per string (silent;
  dims at the limit: −12 … +7 semitones from that string's standard), the note + octave between them; **tap a note to pluck it**.
  The goal-post frame comes down to **↓ ½ step ↑** for all strings (stops if any string would pass a limit).
- New tunings start at the instrument's standard (no "Start from…"). **Duplicate:** if the strings match a built-in or a
  custom in this context, show that tuning's pill and name ("That's Drop D · Already in your tunings") and disable Save.
- Save is grey until there's a name and no duplicate. Press feedback: one 320 ms orange fade on the pressed stepper.
- Fits one screen up to 7 strings; content shorter than the viewport is centred vertically.
- Phone: full-screen layer; desktop: a page-like centred panel (decision 11). Editing an existing custom tuning opens the same
  editor (OPERATIONS `update_tuning`); delete keeps the existing confirm and names the songs using it.

### 2.5 Stage-screen rules (chart reader; tuner and chart layers inside the session)

- **Targets:** 64 px minimum on stage screens; the reader's Back / Next are 88 px (phone) and 84 / 120 px (desktop).
- **Wake lock:** extract `useWakeLock` from `PracticeSessionPage.tsx` to `src/hooks/useWakeLock.ts` and use it in the
  session and the chart reader. Not the metronome (decision 12). It already re-acquires on `visibilitychange` and fails
  silently where unsupported.
- **Pedal keys:** a shared `src/hooks/useStageKeys.ts` (ignores keys while an input / textarea / contenteditable has focus).
  Chart reader: ↓ / PgDn / Space / → = Next page, ↑ / PgUp / ← = Back page. Transpose has no keys (decision 5).
  Esc closes a layer or goes Back.
- **Edge swipe:** iOS Safari's edge swipe-back can't be turned off on the web; it loses nothing (everything saves). Set
  `overscroll-behavior-x: none` on the reader so Android Chrome's overscroll navigation doesn't fire.
- Reduce Motion: page turns jump instead of sliding.

### 2.6 Kit and shared pieces (consistency)

- Reuse: `Segmented` (tabs, Lyrics + chords / Chords only, Guitar / Bass), `Sheet` (Controls, starting note, notes, tuning
  picker on phones), `Chip` (roots, qualities, Hide chords), `Switch` (Auto-detect, Flash), `Button` / `IconButton`, `TuningPill`,
  the existing **tuning picker** list (`TuningList`, local to `SongFacts.tsx` today: move it to `components/tunings/` in 5a),
  `RetryCard` / `SkeletonRow` / `Empty`, `useToast`,
  `useConfirm`, `useGoBack`, `songOrigin`.
- New, shared: `components/chart/ChordCard.tsx` (diagram + fingering + Play; Tools Chords, the chord viewer and the desktop chords
  panel), `components/chart/ChordDiagram.tsx` (SVG), `components/chart/StartingNoteSheet.tsx` (reader and editor),
  `components/tools/Piano.tsx`.
- The ForkIcon already in `components/setlists/SetlistStats.tsx` is the tuner glyph; move it to `components/ui` when the second
  user (Tools) appears.
- No new song row: the metronome's "From ‹setlist›" list is a plain `ListRow` list of title + BPM (not a song list), so
  `SongLine` doesn't apply.

### 2.7 Data the screens read and write

| Need                                                 | Source                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Song's tuning (for Tune)                             | `songs.tuning_id` → `tunings.pitches`; fallback `canonicalTuningId(songs.guitar_tuning)` → `BUILTIN_TUNINGS` |
| Customs for the picker                               | `useTunings()` (moves to TanStack Query with `queryKeys.tunings`, 5g)                                        |
| Chart                                                | `get_chart(p_song_id)`                                                                                       |
| Transpose (per user per song), size, chords on / off | `user_preferences.chart` = `{ size, chords, transpose: { <songId>: n } }`                                    |
| Metronome last BPM, sig, subdivision, flash          | `user_preferences.metronome`                                                                                 |
| Tuner last tuning / instrument / auto                | localStorage (device-level, like the session's text size; decision 13)                                       |

---

## Part 3 · Audio and tech approach

Split I/O from maths. **Pure modules in `src/domain/` (no Web Audio, no DOM), unit-tested in Vitest** so they port to Dart;
thin Web Audio wrappers in `src/services/audio/`.

### 3.1 Pure modules (`src/domain/`)

| Module                                         | Exports (suggested)                                                                                                                                                                                                                                                                                                                                                                                     | Tests                                                                                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pitch.ts`                                     | `detectPitch(samples, sampleRate, {minHz, maxHz}) → {hz, clarity} \| null` (YIN difference function computed via FFT autocorrelation, cumulative mean normalised, threshold ~0.12, parabolic interpolation, RMS gate); `centsOff(hz, midi)`; `nearestString(hz, pitches)` (octave-aware); `chevrons(cents) → 0..3`; `inTune(cents)`                                                                     | Synthesised sine / sawtooth / KS buffers at E1 (41.2 Hz), B0 (30.9 Hz, 5-string bass), A2, E4: within ±1 ¢; silence → null; noise → null; octave errors on a strong 2nd harmonic; thresholds 25 / 12 / 5                |
| `metronome.ts`                                 | `clickTimes({anchor, anchorIndex, bpm, sig, sub, accents}, from, until) → {when, beat, sub, kind}[]` with `when = anchor + (n − anchorIndex) · interval` (never accumulated); `retime(state, now, newBpm)` (re-anchors at the next click); `tapTempo(taps)`; `marking(bpm)`; `clampBpm`                                                                                                                 | 5 min at 60 / 124 / 260 BPM, every sig × sub: max error vs the ideal grid < 1 µs; a pump fed jittery 10–80 ms gaps never skips or doubles a click; tempo change lands on the next click; tap averages                   |
| `chords.ts`                                    | `parseChord("Fmaj7/A") → {root, quality, bass}`; `transposeChord(name, n, preferFlats)`; `spellFor(key)` (flats for F, B♭, E♭…, as `KEY_ROOTS`); `chordShape(name) → frets[] \| null` (24 open shapes from `Sound Tools.html` `SHAPES`, then computed E- / A-shape barres for major, m, 7, m7, as `desktop.js` `shapeFor`); `strumNotes(frets, tuning)` → MIDI                                          | Round-trip ±12; slash chords; enharmonics; every shape in the table; barre maths for all 12 roots                                                                                                                       |
| `chordpro.ts`                                  | `parse(text) → Chart` (sections, lines `{text, chords: Anchor[]}`, `{title}`/`{key}`/`{start_of_*}`…); `serialize(chart)`; `detectFormat(text)` (`chordpro` / `chords-over-lyrics` / `plain`); `fromChordsOverLyrics(text)` (chord line above lyric line, `[Verse]` headers, chords snap to the letter under them); `chordsInOrder(chart)`; `copyChords(fromSection, toSection)` (by syllable position) | Fixtures pasted from Ultimate Guitar style text; the CHART-DATA-MODEL Amazing Grace example; trailing chord (`at === text.length`); grapheme indices (accents, emoji) via `Intl.Segmenter`; parse ∘ serialize is stable |
| `chartEdit.ts` (5f)                            | `applyInsert(line, p, n)`, `applyDelete(line, p, q)`, `splitLine`, `joinLines`, `nudge(anchor, ±1)`                                                                                                                                                                                                                                                                                                     | Every rule in CHART-DATA-MODEL "Keeping chords in sync"                                                                                                                                                                 |
| `pluck.ts`                                     | `karplusStrong(midi, sampleRate, seconds) → Float32Array` (the `desktop-tools.js` maths: noise burst smoothed twice, decay `.996 − min(.004, f/50000)`)                                                                                                                                                                                                                                                 | Period ≈ sr / f; decays; no NaN                                                                                                                                                                                         |
| `tuningEdit.ts` (or extend `utils/tunings.ts`) | `standardFor(instrument, count)`, `stepString(pitches, i, ±1)` (−12 … +7 limits), `stepAll`, `matchTuning(pitches, instrument, count, builtins, customs)`, `autoColour(pitches, std)` (port of `rock.js` `customTuning`), `bassEquivalent(guitarPitches)`                                                                                                                                               | Limits, all-strings stop, duplicate match, colour stable                                                                                                                                                                |
| `toolsLink.ts`                                 | `toolsHref`, `parseToolsParams`                                                                                                                                                                                                                                                                                                                                                                         | Every param, garbage input                                                                                                                                                                                              |

### 3.2 Audio wrappers (`src/services/audio/`)

- `audioContext.ts`: **one** shared `AudioContext`, created lazily and `resume()`d inside a tap handler (autoplay rules). Handle
  iOS's `interrupted` state (a call, Siri): resume on the next tap. Never create one per sound.
- `synth.ts`: `pluck(midi, when?)` (cached KS buffers per note → `BufferSource` → low-pass 2.3 kHz → gain .35), `strum(midis,
when?)` (42 ms between strings, low to high), `note(midi)` (sine + quiet 2nd / 3rd harmonics, 12 ms attack, exponential decay,
  low-pass: the "felt piano"). Sound must start within 30 ms of the tap.
- `metronomeEngine.ts`: a pump calls `clickTimes(…, now, now + lookahead)` and schedules each click (triangle oscillator, 1568 /
  1046 / 784 Hz for accent / beat / sub, 2 ms attack, 60 ms decay, as the reference). **Lookahead ~1 s, re-filled every 25 ms**
  (PLATFORM-NOTES). To keep tempo / accent changes instant despite 1 s of queued clicks, keep the scheduled nodes and `stop()`
  the ones not yet played, then re-anchor (`retime`). The pump may use a timer (it only tops up the queue); the **clicks never do**.
  Run the pump in a small Web Worker so background-tab timer throttling doesn't starve it (it will still stop on iOS lock; the
  design promises nothing there).
- Visuals: a rAF loop reads `ctx.currentTime − (ctx.outputLatency ?? ctx.baseLatency ?? 0)` and lights the last click whose
  `when` has passed. No `setTimeout` for beats (the reference does; don't copy it).
- `tuner/pitchWorklet.ts` (an `AudioWorkletProcessor`): fills a ring buffer from 128-frame quanta and every ~40 ms (≈25 Hz
  updates) runs `detectPitch` on the last 4096 samples (2048 is enough above ~60 Hz; 4096 covers B0), then `postMessage({hz,
clarity, rms})`. Main thread smooths (median of 3–5) and drives the face. Load it with Vite's `?worker&url` import
  (verify it bundles the `src/domain/pitch.ts` import under Vite 4.4 in 5a; if not, emit it as its own Rollup input).
  Fallback when `audioWorklet` is missing: an `AnalyserNode` polled in rAF with the same `detectPitch`.
- `useTuner()`: `getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}})` **from a
  button press**; stops every track on unmount / tab switch / `visibilitychange` hidden. While a reference note plays, ignore
  detector frames for ~1.5 s so the tuner doesn't tune to itself.

### 3.3 Browser and permission constraints

- **Secure context:** `getUserMedia` needs HTTPS or `localhost`. The Vite dev server (`host: true`, http) works on the Mac but
  **not from a phone on the LAN**. Testing the tuner on a real phone needs HTTPS (a dev cert via `@vitejs/plugin-basic-ssl`, or a
  tunnel). Call it out in `docs/LOCAL_DEV.md` when 5a lands.
- **Mic permission:** ask on first press, never on load. Safari may ask again each visit. Show the denied state from the
  `NotAllowedError`; `NotFoundError` = no input device. The Permissions API `microphone` query isn't reliable across browsers;
  don't depend on it.
- **iOS Safari:** while the mic is open, iOS switches to a play-and-record session: output gets quieter and may change route.
  Reference notes still play, just softer. With the ring switch on silent, Web Audio may be muted (PLATFORM-NOTES: "no fix").
  No workaround in the web app (decision 14); the Flutter app handles iOS audio.
- **Autoplay:** the first sound must follow a tap (Start, a string, Play). The Tools tiles and Tune buttons are taps, so
  resuming the context there is fine; the tuner face itself doesn't need audio output.
- **Wake lock:** Screen Wake Lock is in current Chrome, Safari (16.4+) and Firefox; no fallback (PLATFORM-NOTES).
- **Fullscreen** on desktop only, from a button.
- **Sample rate:** read `ctx.sampleRate` (44.1 or 48 kHz); never assume.

### 3.4 Testing

- **Unit (Vitest, jsdom):** every `src/domain` module above. No Web Audio needed.
- **The metronome drift test (05-plan: "< 1 ms over 5 minutes in a Playwright audio-clock test").** Real-time for 5 minutes
  would be slow and flaky. Instead, run the **real engine** against an `OfflineAudioContext` in Chromium:
  1. A dev-only harness route (precedent: `/dev/ui-preview`), e.g. `/dev/audio-harness`, exposes `window.__runMetronome({bpm,
sig, sub, seconds})`.
  2. It builds `new OfflineAudioContext(1, seconds · 48000, 48000)` and drives the same pump with `ctx.suspend(t)` every 25 ms of
     audio time (`suspend` → pump → `resume`), so the lookahead logic runs exactly as live, only faster than real time.
  3. `startRendering()`, then onset-detect the clicks in the rendered buffer (first sample above a threshold after silence) and
     return the max |onset − ideal grid| in ms.
  4. `tests/e2e/tools/metronome-drift.spec.ts` asserts `< 1` for 300 s at 124 BPM 4/4, and a shorter run at 260 BPM with
     sixteenths. A tempo change mid-run must land on the next beat.
     Plus a 10 s **real** `AudioContext` smoke in the same spec: record the scheduled `when`s through the harness and check the
     spacing, to catch wiring the offline run can't (resume, the worker pump).
- **Tuner e2e (Chromium only):** launch with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
--use-file-for-fake-audio-capture=tests/fixtures/audio/a2-110hz.wav` and `permissions: ['microphone']`. Assert the face reads
  A and IN TUNE; a second fixture at 107 Hz reads "TUNE UP" with 3 chevrons. A context without the permission shows the denied state.
  Generate the WAVs with a small committed script (`scripts/make-audio-fixtures.mjs`), not by hand.
- Put the audio specs in their own Playwright project (`testMatch: /tools\/.*\.spec\.ts/`, Chromium) rather than skipping them
  in the Firefox / WebKit projects.
- **Flows (Playwright, 1280 + 390):** Home tile → tab; song Tune → tuner on the song's tuning; retune Tune → `prev` strings
  orange; session Tune now → layer → × → same song, timer still running; metronome Save to song → song BPM changed; chart
  paste → save → reader → transpose → chord viewer → starting note saved; custom tuning duplicate disables Save.
- **Manual device QA (in the PR):** iPhone Safari (mic prompt, interrupted resume, landscape two
  columns), Android Chrome, a Bluetooth pedal (or a keyboard) on the reader and the session, desktop Safari.

---

## Part 4 · Data and API

### 4.1 The 05-plan migration list, checked

| 05-plan item                            | Status           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `song_charts`                           | **missing**      | New table (4.2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tuning seeds                            | **partly done**  | C Standard exists (Phase 0); 7-string standard, 8-string, bass 4/5/6 exist with `color = NULL`. Add A DROP⁷ (`{33,40,45,50,55,59,64}`), A STD⁷ (`{33,38,43,48,53,57,62}`), G♯ DROP⁷ (`{32,39,44,49,54,58,63}`), B STD baritone 6 (`{35,40,45,50,54,59}`), each `is_builtin`, idempotent `ON CONFLICT (slug) DO NOTHING`; mirror them in `BUILTIN_TUNINGS`, `CANONICAL_TUNINGS` / `SHORT_LABELS` (B STD⁷, A DROP⁷, A STD⁷, G♯ DROP⁷, B STD) and `builtin_tuning_slug` if they get label aliases. Colours (decision 15): set by an `UPDATE … WHERE slug IN (…)` so the existing NULL-colour rows get them too (`DO NOTHING` alone wouldn't); G♯ DROP⁷ → Drop D; B STD baritone has no same-shape 6-string match, so it stays grey |
| Unique index on custom tunings          | **missing**      | `CREATE UNIQUE INDEX IF NOT EXISTS tunings_unique_pitches ON public.tunings (context_type, context_id, instrument, string_count, pitches) WHERE NOT is_builtin;` (04 omits `context_type`; include it). **Pre-check prod for duplicates first** (a read-only count); if any exist, the migration must merge them (repoint `songs.tuning_id` to the oldest, delete the rest) before creating the index                                                                                                                                                                                                                                                                                                                           |
| Unique against built-ins                | **not an index** | A partial index can't compare customs to built-ins. Enforce in `create_tuning` / `update_tuning` (4.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `user_preferences.chart` / `.metronome` | **exists**       | No schema work; extend `services/api/preferences.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `release_notes` row                     | **new**          | 4.5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 4.2 `song_charts`

```sql
CREATE TABLE IF NOT EXISTS public.song_charts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- log_audit_trail() reads NEW.id
  song_id          UUID NOT NULL UNIQUE REFERENCES public.songs(id) ON DELETE CASCADE,
  chordpro         TEXT NOT NULL DEFAULT '' CHECK (octet_length(chordpro) <= 204800),
  starting_note    SMALLINT CHECK (starting_note BETWEEN 0 AND 127),
  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  last_modified_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.song_charts ENABLE ROW LEVEL SECURITY;
-- SELECT: public.can_access_song(song_id, auth.uid()). No INSERT / UPDATE / DELETE policies: writes go through the RPCs.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_charts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_charts TO service_role;
```

- 04's shape (`song_id`, `chordpro`, `starting_note`, `version`, `updated_date`) plus an **`id`**: the shared
  `log_audit_trail()` writes `COALESCE(NEW.id, OLD.id)` as the record id, so a table keyed only by `song_id` would fail the trigger.
- No `original_key`: the song's `songs.key` is the key. No `chart_prefs` table: transpose and size are `user_preferences.chart`.
- **Live updates:** `log_audit_trail()` stores the whole row (`to_jsonb(NEW)` and `OLD`), which would copy up to 400 KB of
  ChordPro into `audit_log` per save. Use a small dedicated trigger function `log_song_chart_audit()` that writes the audit row
  with `new_values = jsonb_build_object('song_id', …, 'version', …)` and `band_id` from the song's band context. Then add
  `'song_charts:changed'` to `RealtimeEvents` and invalidate `queryKeys.charts.detail(songId)` in `useRealtimeInvalidate`.
- `ON DELETE CASCADE` from `songs` (deleting a song deletes its chart; `delete_song` needs no change).
- Update `.claude/specifications/unified-database-schema.md` and regenerate `src/types/database.types.ts` (`just types`).

### 4.3 Functions (all `SECURITY DEFINER`, `SET search_path = public`, `p_` params, `RAISE … MESSAGE = key, HINT = copy`)

| Function                                                                                                | Shape                                                                                 | Rules / errors                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_chart(p_song_id)`                                                                                  | `RETURNS TABLE(song_id, chordpro, starting_note, version, updated_date, editor_name)` | `_require_song` (exists, Phase 2). Reads the song's own row only (a linked copy has its own, decision 2). No chart → zero rows                                                                                                                                    |
| `save_chart(p_song_id, p_chordpro, p_expected_version DEFAULT NULL)`                                    | `RETURNS public.song_charts`                                                          | Upsert; `stale_version` ("Someone just changed this. Showing the latest."); `chart_too_long` ("That's too long for one chart."); bumps `version`, sets `last_modified_by`, `updated_date`                                                                         |
| `set_starting_note(p_song_id, p_note SMALLINT)`                                                         | `RETURNS public.song_charts`                                                          | Upsert (a chart row may exist with only a starting note); 0–127 else `invalid_note`; NULL clears                                                                                                                                                                  |
| `duplicate_song`                                                                                        | **change** (`CREATE OR REPLACE`)                                                      | OPERATIONS: "Copies facts, links and chart, not notes". Today it copies no chart; add the `song_charts` copy                                                                                                                                                      |
| `create_tuning(p_name, p_instrument, p_string_count, p_pitches, p_color, p_context_type, p_context_id)` | `RETURNS public.tunings`                                                              | Membership check; per-string range −12 … +7 from the instrument's standard (`invalid_pitches`); **duplicate** of a built-in or a custom in the context → `duplicate_tuning`, HINT "That's ‹name›. It's already in your tunings."; name required (`name_required`) |
| `update_tuning(p_tuning_id, p_name, p_pitches, p_color, p_expected_version DEFAULT NULL)`               | `RETURNS public.tunings`                                                              | Same checks; built-ins read-only (`forbidden`); `stale_version`                                                                                                                                                                                                   |
| `save_song_bpm`                                                                                         | **not needed**                                                                        | 04: the metronome uses the normal song update (`useSaveSong` → `tempo`), with `version`                                                                                                                                                                           |

- `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated, service_role`.
- Keep the direct `tunings` INSERT / UPDATE policies for now (the RPCs are the app's path; dropping the policies is a later cleanup
  once nothing else writes). `delete_tuning` stays a table delete under RLS (one row, "who may" only).
- **pgTAP:** `supabase/tests/034-charts-and-tunings.test.sql`: each function's happy path, every error key, a non-member denied,
  the linked-copy snapshot (`copy_band_songs_to_personal` copies the chart; "Copy ‹band›'s chart" on an empty copy), the unique index, the seeds, and `has_table_privilege` for both roles on `song_charts`.
- **Web API:** `src/services/api/charts.ts` (`getChart`, `saveChart`, `setStartingNote`) and `src/services/api/tunings.ts`
  (`createTuning`, `updateTuning`; `TuningService` keeps reads until `useTunings` moves to TanStack Query in 5g).
  `services/api/preferences.ts` gains `getChartPrefs` / `setChartPrefs` and `getMetronomePrefs` / `setMetronomePrefs`
  (same read-merge-upsert as `setListView`). Query keys: `queryKeys.charts.detail(songId)`, `queryKeys.tunings.all(userId)`,
  `queryKeys.prefs.chart(userId)`, `queryKeys.prefs.metronome(userId)`.
- **Edge functions: none.** `supabase/functions/FUNCTIONS.md` doesn't change.

### 4.4 Pre-build checks

- **Local migration history:** the local `supabase_migrations.schema_migrations` stops at `20261111120000`; it lacks
  `20261118120000_redesign_phase_4.sql` although its objects exist (`shows.confirmed`, `setlists.copied_at`, the 0.11.0
  release note). Run `supabase db reset` (then `npm run test:db`) before writing the phase 5 migration, so the new file applies
  on a clean, recorded history. Don't "repair" it by hand.
- Commit the uncommitted Phase 4 follow-ups first so 5a starts from a clean tree.
- The phase 5 migration's timestamp must sort after phase 4's (`20261118120000`): use `20261119120000_redesign_phase_5.sql`.
- Prod read-only: count duplicate custom tunings by `(context_type, context_id, instrument, string_count, pitches)` before
  deciding whether the migration needs a merge step (`supabase migration list --linked` first, per CLAUDE.md).

### 4.5 Release (CLAUDE.md, Phase 1)

- No version bump in Phase 5 (decision 3). Changes go under CHANGELOG `[Unreleased]`; the version, dated section and the
  `release_notes` row below get their number when the whole redesign is finalized.
- In the phase 5 migration:

```sql
INSERT INTO public.release_notes (version, title, body) VALUES (
  '<redesign version>',
  'Tune, click and read the chart',
  $md$Tools are here: a tuner that opens on the song's tuning, a metronome that keeps time, and chord lookup with diagrams you can hear. Every song can have its chords and lyrics: paste them in, transpose them live, and page through on stage with big buttons or a pedal. Make your own tunings on a guitar neck.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
```

---

## Part 5 · Slices

Each slice: tests first (`/implement`), `just check` green, both platforms in dark and light, in a band and in Personal.

### 5a · Tools hub + tuner

- `src/domain/pitch.ts`, `pluck.ts`, `toolsLink.ts` (+ tests). `services/audio/audioContext.ts`, `synth.ts` (pluck only),
  `tuner/pitchWorklet.ts`, `useTuner`.
- `pages/ToolsPage.tsx` at `/tools/:tab` (tuner live; Metronome / Chords tabs show the segment but land in 5b / 5c: until then
  the segment shows only Tuner, so no dead tab is reachable).
- `components/tools/Tuner.tsx`: face, strings, auto-detect, Hear, tuning picker (reuse `TuningList`), every mic state.
- Wire: song page **Tune** (`SongFacts` `SoonButton` → real button), setlist **Tune** (`RetuneLine` gets the `to` / `from`
  tuning refs), practice session **Tune now** and **Tune** as a layer over the session.
- Extract `useWakeLock` (unchanged behaviour) for later reuse.
- **Accept:** fake-mic e2e (A2 in tune; 107 Hz → 3 chevrons; denied state); session Tune now → × → same song and timer;
  retune Tune highlights changed strings; `pitch.ts` accuracy tests.
- testids: `tools-page`, `tools-tab-{tuner|metronome|chords}`, `tools-back`, `tuner-start`, `tuner-note`, `tuner-cents`,
  `tuner-string-{n}`, `tuner-in-tune-count`, `tuner-auto-switch`, `tuner-hear`, `tuner-tuning-picker`, `tuner-mic-denied`,
  `session-tuner-layer`.

### 5b · Metronome

- `src/domain/metronome.ts` (+ tests), `services/audio/metronomeEngine.ts` (+ worker pump), rAF visuals.
- `components/tools/Metronome.tsx`: beats, tempo hero, tap, sig, subdivisions, flash, Start / Stop, From a song + Save to
  song (Undo), desktop side panel incl. "From ‹next setlist›".
- `user_preferences.metronome` read / write (last BPM, sig, sub, flash).
- Wire song page **Click ‹bpm›**.
- `/dev/audio-harness` + `tests/e2e/tools/metronome-drift.spec.ts` (offline 300 s < 1 ms, 260 BPM sixteenths, tempo change,
  10 s real-time smoke).
- **Accept:** drift test green; Save to song writes `tempo` with `version` and Undo restores; Space / T / ↑ ↓ on desktop;
  switching tabs stops the clicks.
- testids: `metro-bpm`, `metro-minus`, `metro-plus`, `metro-slider`, `metro-tap`, `metro-start`, `metro-beat-{i}`,
  `metro-sig`, `metro-sub`, `metro-flash-switch`, `metro-save-to-song`.

### 5c · Chords + the way in

- `src/domain/chords.ts` (+ tests), `synth.strum`, `synth.note`.
- `components/chart/ChordDiagram.tsx`, `ChordCard.tsx`; `components/tools/ChordLookup.tsx`.
- **Home Tools row** (band: between the practice card and Quick actions; Personal: first), live hints from the tuner's
  last tuning and `user_preferences.metronome.bpm`. **Desktop sidebar Tools group.** Both segments of the Tools header now on.
- **Accept:** every root × quality renders a diagram or "No diagram yet"; Play strums; Home tiles open their tab on 390 and
  1280; sidebar item highlights on `/tools/*`.
- testids: `home-tools`, `home-tool-{tuner|metronome|chords}`, `sidebar-tool-{tuner|metronome|chords}`, `chords-root-{X}`,
  `chords-quality-{q}`, `chord-card`, `chord-play`.

### 5d · Chart reader (the migration starts)

- Migration: `song_charts`, `log_song_chart_audit`, `get_chart`, `save_chart`, `set_starting_note`, `duplicate_song` change,
  the release note. pgTAP. `services/api/charts.ts`, `hooks/useChart.ts`, realtime invalidation. Types regenerated.
- `src/domain/chordpro.ts` parse / serialize / `chordsInOrder` (+ tests).
- `components/chart/ChartReader.tsx` + `pages/ChartPage.tsx`: paging (2-line overlap), tap zones, progress bar, Controls,
  transpose / size / chords on-off saved to `user_preferences.chart`, chord viewer (`ChordCard`), starting note sheet, notes
  sheet (`SongNotesView` extracted from the session), landscape two columns, desktop two columns + Chords panel + pager +
  Full screen, `useStageKeys`, `useWakeLock`.
- Wire: song page / pane **Chords & lyrics** vs **Add chords & lyrics** (the add path lands in 5e: until then it's hidden, not
  "Soon"), practice session **Chart** as a layer.
- **Accept:** a seeded chart reads; Next / Back keep two lines; pedal keys page; transpose is per user (a bandmate sees the
  original key); starting note saves on pick; notes sheet shows band + mine; wake lock requested (spy); `duplicate_song` copies
  the chart (pgTAP).
- testids: `chart-page`, `chart-next`, `chart-back`, `chart-controls`, `chart-key-down`, `chart-key-up`, `chart-size-down`,
  `chart-size-up`, `chart-chords-toggle`, `chart-start-note`, `chart-chords-viewer`, `chart-notes`, `chart-edit`,
  `chord-viewer-prev`, `chord-viewer-next`, `start-note-key-{n}`, `start-note-octave-{down|up}`, `session-chart-layer`.

### 5e · Chart editor (text, both platforms)

- `chordpro.ts` `detectFormat` / `fromChordsOverLyrics` / `copyChords` (+ tests with pasted fixtures).
- `components/chart/ChartEditor.tsx` + `/songs/:songId/chart/edit`: desktop two-pane (edit + preview, Lyrics + chords / Chords
  only, Paste / Clear / Try a sample, Chords from Verse 1, starting note row); phone Paste screen + text editor + preview.
- Save with `version`; the conflict banner (Show theirs / Keep mine); Cancel confirm; too-long toast.
- Wire **Add chords & lyrics** (song page, pane).
- **Accept:** paste chords-over-lyrics → detected sections and chord count → Save → reader shows it; a ChordPro paste
  round-trips; simulated `stale_version` shows the banner and both choices work.
- testids: `chart-editor-page`, `chart-editor-text`, `chart-editor-paste`, `chart-editor-clear`, `chart-editor-sample`,
  `chart-editor-copy-verse`, `chart-editor-mode`, `chart-editor-save`, `chart-editor-cancel`, `chart-conflict-keep`,
  `chart-conflict-theirs`.

### 5f · Phone chord placing

- `src/domain/chartEdit.ts` (+ tests for every anchor rule).
- Lyrics mode and Chords mode on phones (key palette from `songs.key`, tap a letter, select → ◀ ▶ / change / remove, Other…
  keypad, Type it instead, Chords from Verse 1).
- **Accept:** Song Chart 5–7 flows on 390; editing a word never moves a chord off its letter; ◀ ▶ moves one grapheme.
- testids: `chart-mode-{lyrics|chords}`, `chart-palette-{chord}`, `chart-letter-{line}-{i}`, `chart-chord-nudge-{left|right}`,
  `chart-chord-remove`, `chart-chord-other`, `chord-keypad-root-{X}`, `chord-keypad-type-{t}`, `chord-keypad-bass-{X}`,
  `chord-keypad-typed-input`.

### 5g · Custom tuning + finish

- Migration (same file): unique index (+ merge step if prod has duplicates), extended-range seeds, `create_tuning`,
  `update_tuning`. pgTAP. `services/api/tunings.ts`; `useTunings` onto TanStack Query (`queryKeys.tunings`).
- `src/domain/tuningEdit.ts` (+ tests). `components/tunings/TuningEditor.tsx` (the neck) **replaces** `CreateTuningModal` with
  the same props (`instrument`, `onClose`, `onCreated`) so `SongFacts`, `EditSongModal` and `TuningsSection` keep working; delete
  the old modal (an orphan this change creates). Edit an existing custom tuning from its row.
- Settings → Tunings: one **Tuner** button in the section header.
- `SHORT_LABELS` for the 7-string and bass built-ins; `BUILTIN_TUNINGS` mirrors the new seeds; parity test still green.
- Release metadata (4.5). Remove every "Soon" / "arrives with Tools" left (`grep` must find none).
- **Accept:** Custom tuning flow (neck, ½ step all strings, tap to pluck, colour); a duplicate disables Save (client) **and**
  `create_tuning` refuses it (pgTAP); the new tuning is picked in the song when created from the song's picker; the whole Chart
  and tools checklist group passes on 390 and 1280.
- testids: `tuning-editor`, `tuning-name-input` (`name="tuningName"`, `id="tuning-name"`), `tuning-colour`,
  `tuning-instrument`, `tuning-count`, `tuning-string-{i}-{up|down}`, `tuning-string-{i}-note`, `tuning-all-{up|down}`,
  `tuning-duplicate`, `tuning-save`, `tuning-cancel`, `settings-tunings-tuner`.

---

## Decisions (Nov 16 2026, answered with the user)

1. **No `REDESIGN_TOOLS` flag.** Each slice replaces its "Soon" buttons as its tool lands. (Add a default-off flag only if
   this work ever has to merge to `main` before it's finished.)
2. **My Songs linked copy: its own chart, copied once.** `copy_band_songs_to_personal` copies the band song's `song_charts`
   row (chordpro + starting note) into the new copy. After that the two are separate: no `get_chart` fallback, no `source`
   column, no "From ‹band›" line. If a copy has no chart and its band song has one, the empty chart offers **Copy ‹band›'s
   chart** (same snapshot). Later, not now: "copy the band's latest" onto a copy that already has a chart.
3. **Phone chord placing (5f) is part of Phase 5**, built last. No per-phase version numbers: the redesign ships as one
   package, so Phase 5 goes under `[Unreleased]` and gets a number when the whole redesign is finalized.
4. **The client converts chords-over-lyrics**, in the pure `chordpro.ts`; `save_chart` stores ChordPro and checks size and
   version. Paste accepts either format and converts only when needed: inline `[G]` chords or `{directives}` → stored as is;
   chord-only lines over lyrics → converted; plain lyrics → stored as is. The preview says what it detected. Add a "Keep as
   pasted" switch only if detection misfires in testing. Update OPERATIONS §7.
5. **Chart reader keys:** every arrow, PgUp / PgDn and Space page. **Transpose has no keys**, only the on-screen buttons
   (so a pedal can never change key). Update the desktop keys hint.
6. **Neck editor string counts:** Guitar 6 / 7 / 8, Bass 4 / 5 / 6. No existing custom tuning is outside those (per the
   user), so there's no "Not editable on the neck" path.
7. **The tuner isn't tied to the song.** Opened from a song, it _starts_ on that song's tuning and you can pick any other.
   A Guitar / Bass switch (remembered per device); on Bass the starting tuning is the matching bass built-in
   (Drop D → `bass-drop-d`, Standard → `bass-standard`, half step → `bass-eb`), else the four lowest strings an octave down
   (`bassEquivalent`). Opened from Tools, it starts on whatever was used last.
8. **Settings → Music moves to Phase 6** (Flash stays on the Metronome tab). **Count-in is punted** to the later list, not
   Phase 6: no count-in setting until it comes back.
9. **`songs.time_signature` stays unused** for now; the metronome remembers the last signature on the device. Later: the
   user expects to add it (song editor field, loaded by the metronome, saved by Save to song).
10. **Tempo range 30–260** everywhere, one constant in `domain/metronome.ts`; tap tempo clamps.
11. **Custom tuning editor:** a full-screen layer on phones, a centred panel on desktop, opened in place (no route) from a
    song's tuning picker, the tuner and Settings → Tunings. From a song's picker the new tuning comes back selected. The
    user wants to see it before settling, especially the tuner entry.
12. **No metronome wake lock in the web app.** Mobile-specific behaviour belongs to the Flutter app. The session's existing
    wake lock stays; the chart reader reuses it (extracted to `src/hooks/useWakeLock.ts`).
13. **Tuner memory is per device** (localStorage: last tuning, instrument, auto-detect). No migration.
14. **No iOS silent-switch handling** (`navigator.audioSession`) in the web app; Flutter handles it. Keep PLATFORM-NOTES'
    "no fix".
15. **Extended-range colours:** each built-in takes the colour of the 6-string tuning with the same shape relative to its own
    standard (7 / 8-string Standard, bass Standard, 5 / 6-string bass → Standard; Drop A⁷ and Bass Drop D → Drop D; A STD⁷ →
    Whole-step down; Bass E♭ → Half-step down), stored as hex in the seed. The ⁷ / ⁸ / ⁵ / ⁶ superscript is what marks the
    extra strings. No same-shape match → grey.

## Risks

- **Pitch detection on phones** is the hardest technical piece (low B on a 5-string bass, noisy rooms, CPU). Start 5a with the
  accuracy tests and an early real-device check, not the UI.
- **Losing a practice session** if any slice opens the tuner or chart as a route from the session. The layer rule (2.3) is the fix.
- **iOS audio** (play-and-record ducking, interruptions) can't be tested in CI; budget manual device time. Silent switch and
  metronome wake lock are left to Flutter (decisions 12, 14).
- **The drift test** depends on `OfflineAudioContext.suspend()` driving the pump; prove the harness in 5b's first commit.
- **Audit volume:** without the dedicated chart audit trigger, every chart save copies the whole chart twice into `audit_log`.
- **Unique index on prod** fails if duplicates already exist; the read-only pre-check decides whether a merge step is needed.
- **Scope:** seven slices. 5f is built last (decision 3).

## What this changes in the other guides

- `05-plan.md`: Phase 5 points here; the `REDESIGN_TOOLS` lines are dropped (decision 1); the migration list notes C Standard done.
- `03-screens.md`: "Chart and tools" rows point here; Song view and practice session rows note the layers.
- `04-data.md`: `song_charts` gains `id` and the dedicated audit trigger; the unique index includes `context_type`.
- `design/OPERATIONS.md` §7: conversion on the client (decision 4); `save_song_bpm` is the normal song update.
- `design/PLATFORM-NOTES.md`: HTTPS for phone testing; silent switch and metronome wake lock are Flutter's (decisions 12, 14).
- `README.md`: add this guide as item 12.
