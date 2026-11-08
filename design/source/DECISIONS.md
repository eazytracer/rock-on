# Rock On — Locked decisions (source of truth)

> Nov 1 2026: the locked screen pages now live inside the demos (`demo/screens/`, `demo/Rock On Desktop.html`). Mobile vs desktop coverage: `PARITY.md`. Parked, out of the demos: Casting, Band History, wordmark tweaks (`refresh/archive/`).

Last updated Nov 7 2026 (Part A of the build handoff settled the same day; see the last section). Use this folder when building. `refresh/` is exploration history; open it
only to see why something was decided. Precedence: **this folder > spec Must / Must not > refresh/ > app/**.
Every rule cites a law from `LAWS-OF-UX.md`.

## Files

| File | What it locks |
|---|---|
| `Foundations.html` | Colour roles (dark + light), context accents, tuning spine, custom tuning colour, spacing, radii, elevation, motion, targets, overlays, Flutter token mapping |
| `Song Row.html` | Song row (catalog + setlist), View options, sort, swipe / hold, drag + retune recount, link icons |
| `Song Editor and View.html` | Add / edit song, tuning + key pickers, link entry, song view, notes editing |
| `Song Chart.html` | Chart reader (paging, transpose, size), full-screen notes, chart entry |
| `Sound Tools.html` | Hear a chord, starting note, tuner |
| `Setlist Editor.html` | Setlists list, editor, one Add menu (songs / break / section), Move tiles, song browser, fixed-gutter timeline |
| `Practice.html` | Practice page, practice session (stage), Up next + tuning change, wrap-up, tablet landscape |
| `Core Navigation.html` | Home (band / new / Personal), context switcher dropdown, switch prompts, global search (trial), More, notifications popout + stream |
| `Brand.html` | Strung wordmark + horns icon, colourways, usage |
| `Metronome.html` | Metronome beside the tuner: tempo, tap, time sig, subdivision, accents, edge flash, count-in, save to song |
| `Calendar and Shows.html` | Agenda with type icons + filters, New picker, show page (confirmed / cancelled / no set / offline), delete |
| `Account and Settings.html` | Sign in (Apple/Google), get started, settings, tunings list, profile, instrument order, push notifications, delete account |
| `Band and Friends.html` | Members, roles, invite, transfer, create, join preview, band of one, leave, friends, privacy |
| `Band Identity.html` | Band mark picker (Initials / Symbol / Upload + colour), band profile, future public profile |
| `Custom Tuning.html` | Custom tuning editor (neck style): guitar 6/7, bass 4/5, per-string steppers, ½-step all strings, tap-to-pluck, colour picker, duplicate check |
| `Tools on Home.html` | Tools row on Home (Tuner / Metronome / Chords), Tools screen with tabs, chord lookup, trimmed More |
| `Jam Plan.html` | One Jam type: hub, host, planned lineup / requests / people, walk-ups, Go live, guest app + web, table tent |
| `Jam Live.html` | Crowd-first live jam: share-songs picker, people who know your songs, compare, pitch, coverage ranking, quiet-stage nudges, web guest |
| `Jam TV.html` | Bar TV rotation: On stage / Looking for someone / Come play (wordmark, app optional), QR on every slide |
| `Jam Venue.html` | Counter iPad kiosk, optional group sets |
| `Jam Host.html` | Host on the night: Up next card, Call up anyway, fill from hands / house / room, swipe right = up next, left = Played / Left / Remove |
| `Practice History.html` | Calendar → Practices History card, Practices / Songs tabs, past-practice recap, plan next from this |
| `Components.html` + `kit/` | The kit: `kit/rock.css` (tokens for dark, light and Personal, plus every component, `r-` prefixed), `kit/rock.js` (builders + 4 screen templates: list, detail, editor, stage), `kit/Template.html` (starter page for explorations) |
| `CHART-DATA-MODEL.md` | Chart storage (ChordPro), tables, anchor maths, conflicts |

## Building new screens

1. Start from a template: **list**, **detail**, **editor** or **stage**. 2. Fill with groups under mono labels. 3. One accent action per screen. 4. Pick the overlay by job (route / sheet / dialog / toast / banner). 5. Check in dark, light and Personal, with empty / loading / error states. Use tokens only, no hex in components. When a new part is locked, add it to rock.css, rock.js, Components.html and this file.

## Global rules

- **Look:** Direction A, fully custom, one build for phone, tablet and desktop. Type: Big Shoulders Display (display, caps), Atkinson Hyperlegible Next (UI), Martian Mono (meta).
- **Theme:** light and dark, following the system; Settings → Appearance overrides. Stage screens suggest dark. (**Postel's Law**)
- **Context accent:** band = orange `#ff7a1a` / ink `#1a0c02`; Personal = indigo `#7c86f5` / ink `#0b0d2b`. Accent fills big areas only. (**Law of Similarity**)
- **Tuning:** colour **and** name, always. In rows: a tinted pill with the label in the tuning colour. **Colours: superseded Nov 7 (Part A · 1):** the app's existing hues stay; only Drop D and Drop C move. See the table in the last section. The OKLCH spine described in Foundations.html is no longer the palette; its pitch order still sets the tuning picker's order. (**Von Restorff**, **Mental Model**)
- **Overlays:** full-screen route for anything with fields; bottom sheet for picks and actions; dialog only for destructive confirms that name the consequence. Toast for your own actions, grouped banner for bandmates'. (**Jakob's Law**, **Hick's Law**)
- **Targets:** 44pt / 48dp minimum; 64 on stage screens. Body text 16, never below 13. (**Fitts's Law**)
- **Motion:** 100 / 200 / 280 / 400ms; Reduce Motion turns slides into fades. (**Doherty Threshold**)
- **States:** every list has empty (with its action), skeleton loading, and error with retry.
- **Sync status:** no per-row icon; one offline / syncing banner at the top of the list.
- **Process:** any change that removes or hides an existing capability is flagged and asked first.

## Song row

- Grouped sections (one surface per section, dividers). Line 1: grip and number (ordered lists only) · title · artist · notes mark. Line 2: **tuning pill → time → key (#) → BPM (pulse)**, then ≤2 link tiles on the right. Key never touches tuning. (**Law of Proximity**, **Law of Common Region**)
- **No ⋯ button.** Tap opens the song view. Swipe left gives 2 quick actions (catalog: Hide, Add to set; setlist: Note, Remove). Press and hold opens the full menu in the catalog, or lifts the row in a setlist; releasing without moving opens Move / Note / Remove. (**Occam's Razor**, **Jakob's Law**)
- **Notes mark** is always on and appears only when a song has notes: a sheet for band notes, a sheet with a lock for mine, stacked sheets for both. Grey, never accent. It isn't a view option.
- **View options** are saved per list per user: Comfortable / Compact; Artist, Key, BPM, Links, Next show; Show hidden. Title, tuning and time are always shown. Compact is one line with 1 link and no key / BPM / next show.
- **Defaults:** catalog shows artist, key, BPM and links. Setlist shows key and links. Links are off on the read-only Show.
- **Sort (catalog):** Name, **Artist**, Newest, Oldest, Next show.
- **Reorder:** grip drags straight away; a 300ms hold lifts with a haptic tick; there's a non-drag Move sheet. Retune lines and the retune count recalculate on drop, and a mid-drag pill previews the cost. (**Fitts's Law**, **Doherty Threshold**)
- **Retune line** between songs whose tuning differs: "RETUNE ‹from› → ‹to›" plus a **Tune** button.
- **Links:** 30px outlined tile, 16px glyph, 44 hit area. Types: Tabs (yellow), Audio (Spotify green, soundwave), Video (YouTube red, filled play), Lyrics, Cloud file, Link (neutral). The first 2 in the song's link order show, auto-sorted Tabs → Audio → Video → Lyrics → Cloud → Link and reorderable. Tapping opens the link directly.

## Song editor and song view

- **Superseded Nov 8 (song page):** existing songs are edited on the song page itself, in place, each field saving on its own, with notes using Done; this editor is **Add song only**. Back on the song page follows where you came from. Build brief: `docs/redesign/10-song-page-and-setlist-nav.md`.
- **Editor:** full-screen route, Cancel / Save. Only the title is required. Spotify matches appear quietly under the title and fill in title, artist, album, length and the Spotify link. Tuning picker: sheet sorted by pitch, with strings listed, plus New tuning and Manage. Key picker: Circle of Fifths. Links: paste a URL, the type is auto-detected and editable inline. In a band, "Also add to My Songs" (linked copy). Cancel with changes opens a dialog that names the changes. No notes and no delete in the form. (**Parkinson's Law**, **Postel's Law**)
- **Song view:** read-first. Facts (tuning pill, key, BPM, length) → links → note layers. The primary button is **Chords & lyrics** (or "Add chords & lyrics"). There's no chart preview.
- **Notes:** three labelled layers. "In ‹setlist›" comes first, only when opened from that set. Then Band notes (shared, with last editor) and My notes (private, lock). Edit in place with a pencil, Markdown and a formatting bar; Done saves. A Full screen option opens the chart reader's Notes tab. (**Flow**)

## Chart

- A per-song **Chart** (chords + lyrics), separate from notes. *This deviates from the spec, which takes chords from notes; the user has approved the direction.*
- **Reader:** no auto-scroll. Large **Next** (orange, wider) and **Back** buttons page about a screen and keep 2 lines of overlap. Top / bottom tap zones and a Bluetooth pedal also page. Key −/+ transposes live; text size control; progress bar on the edge. Chart | Notes tabs. Screen stays awake, works offline, edge swipe-back is off. Landscape uses two columns with the buttons on the right. (**Fitts's Law**, **Working Memory**)
- **Entry:** paste (chords-over-lyrics or ChordPro, auto-detected). Lyrics mode keeps chords pinned to letters, so they move with edits. Chords mode: pick from a key-based palette, then tap a letter; tap a chord to nudge ◀ ▶, change or remove it. Other chords: keypad for root, type and bass, or type the name. "Chords from Verse 1" copies chords to the next verse. (**Tesler's Law**)
- **Data:** see `CHART-DATA-MODEL.md`. Transpose and size are saved per user.

## Sound tools

- **Hear a chord:** tap a chord in the strip (chords in first-use order) or inline in the chart. Uses an in-app synth, so it's offline; follows transpose.
- **Starting note:** per chart, for vocal-first songs. Shown in a pill relative to the key ("D · 5th"). Plays the key chord, then the note. Set on a one-octave piano.
- **Tuner:** opens on the song's or next song's tuning; strings changed from the previous tuning are shown in orange. Auto-detect or pick a string; tap a string for its reference. "N of 6 in tune". Pedal-style feedback: note, needle and arrows go from red (±50 cents) to green (in tune); the arrow on the flat or sharp side blinks faster as you close in, and both arrows go solid when in tune. Reduce Motion stops the blinking. Reached from More → Tuner, every retune line, and the practice-session tuning alert.

## Scope (launch)

- Push is in, for: show / practice added or changed, RSVP requested, upcoming set changed, friend request.
- Global search is in, **on Home only** (mobile; ⌘K on desktop). Confirmed for launch Nov 7.
- Tools (tuner, metronome, chords) and the chart reader + editor are in. Confirmed for launch Nov 7.
- ~~Practice history is its own page~~ **Deferred (Nov 7):** not in launch. Wrap-up notes still save; the History card, Songs tab and recap come later.
- Casting stays Future / Pro.
- The setlist timeline rail (off by default, clock ⇄ set time, 15-min marks) is in, as an addition to the spec. Setlist header: songs · time · retunes · "52 of 45 min" when attached to a show.

## Open (not locked)

- ~~Events vs Jam~~ **Decided Nov 7 (Part A · 2): option A**, see the last section.
- Month view: deferred until calendar sync ships (see Nov 7, 2.8). Revisit with sync.

(Closed since Oct 30: Tabs glyph → "Staff + nut · thin"; fonts → Big Shoulders / Atkinson / Martian; setlist timeline, practice and session, show page and custom tuning are all redrawn in the source style.)

## Setlist editor (locked Oct 30)

- Saves as you go; no Save button. Totals: songs, min (or "ends …" with the timeline on), retunes, "N of M min" only when attached to a show; over = warning colour. (**Doherty Threshold**, **Goal-Gradient**)
- One full-width **Add** in the dock opens Songs / Break / Section label. No icon-only insert button. (**Hick's Law**, **Fitts's Law**)
- Reorder: drag the grip or hold the row. Hold sheet = Up / Down / To top / After… tiles, set note, open, edit, remove last. (**Fitts's Law**)
- Breaks default 15 min, optional note, no number. Remove confirms what isn't affected (catalog, show copy).
- Song browser is a pushed route. Band songs plus "From my songs" (copied in). Tuning chips = tunings the band uses, most-used first, plus More. Songs already in the set keep their row and show a muted setlist icon in the pick circle, so columns stay aligned. (**Law of Common Region**)
- **Timeline:** a fixed gutter left of the cards (cards keep rounded corners). Start times sit on the rail, breaking the line; orange dots every 15 min. Tap = on/off; hold = choose Clock or Set time. Default Set time; Clock time only when there's a show start (greyed otherwise). (**Mental Model**)

## Practice (locked Oct 30)

- Status from time, never a field. Practice rows show every link as a labelled button and the per-practice song note. Start is the docked action.
- Session is a stage screen: 96px Prev/Next naming the destination song; last becomes End practice. Swipe also works. (**Working Memory**, **Peak-End Rule**)
- Up next card is neutral; turns warning-yellow with **Tune now** only when the next song changes tuning. (**Von Restorff**)
- Notes default, Chart one tap away; text size remembered. Wake lock, offline, keyboard and pedal mapping per spec.
- Wrap-up: time played, songs reached (skipped marked), shared notes → Practice history.
- Tablet landscape: song + Up next left, notes right, pager across the bottom.

## Context switcher (decided Oct 30)

- A dropdown anchored to the header chip (desktop: the sidebar chip), not a bottom sheet. The chevron promises a dropdown, and the list should appear where you tapped. (**Law of Proximity**, **Mental Model**)
- Bottom sheets stay for row and item menus (⋯), which are about something mid-screen.

## Core navigation (locked Oct 30)

- Home: next show, next practice, 3 events, quick actions; no stats. New band gets a self-ticking walkthrough. Personal gets its own walkthrough (songs, setlist, chart) and a dismissable "Playing with others?" card that never returns.
- Switch prompt: full explanation the first time only; after that, "Switch to ‹Band›?" with Not now / Switch; tapping outside dismisses. (**Hick's Law**)
- Global search on Home, scoped to the current context with "Search all contexts". Trial.
- Notifications: the bell opens a dropdown of unread items with one action, Mark all read. Full page is a constant stream (Activity / App updates); reading clears the dot, nothing is dismissed. Big icon = band mark; small badge = type; context-free items (friend requests) have no mark.
- Band history / restore: exploration in refresh/Band History.html, not planned for launch.

## Tabs link glyph (decided Oct 30)

- "Staff + nut · thin": four thin strings, a heavy nut on the left, two finger dots, no frets. Reads as tab and fretboard at 16px. In `kit/rock.js` as `tabs`. Options kept in archive/Song Row B v2 and the Open Decisions history.

## Settled Oct 30 (from Open Decisions)

- Fonts confirmed: Big Shoulders Display, Atkinson Hyperlegible Next, Martian Mono.
- Band marks: photo, or initials on a colour picked at creation from a set of 8. Accent stays orange in any band.
- Person avatars: photo, else initials on neutral grey (not tuning colours).
- Logo: see Brand (locked Oct 30).
- Show "Open set" → setlist editor in clock time; stage view later.
- RSVP: drawn now, ships after launch.
- Calendar FAB label follows the filter.
- Sign in: standard Apple and Google buttons with their logos.
- Create band: one field, then straight to the band (invite card on top). No confirmation screen.
- Join preview: Join is the largest button; Not now is a small text button.
- Switcher: a dot on bands with unread activity (no count).
- Typed confirmation for deletes only (account, band); transfer ownership is a plain confirm.
- No primary instrument (spec change, see refresh/03 SPEC-RECONCILIATION.md). Instruments are an ordered list; first shows first. Jam sign-up picks per session.

## Calendar types and notifications (Oct 30)

- Event types: icon + label in a per-type colour. Show = ticket, `--ty-show` (orange); Practice = calendar, `--ty-prac` (blue); Event = party popper, `--ty-evt` (violet). Colour on the icon and label only, never the date block. Kit: `.r-ty.show|prac|evt`, icons `ticket`, `cal`, `party`.
- Notifications: in-app bell = everything per band (songs, setlists, shows, practices, events, RSVPs, members, friends; app updates in their own tab; never your own actions). Push = small set (reminders, changes to plans you're in, set edits within 7 days of a show, invites, friend requests), own settings page with master switch, per-band mute, quiet hours. **Rule: when in doubt, less intrusive and less frequent.** To be honed after the first build.

## Brand mark (locked Oct 30)

- Wordmark "Strung": Big Shoulders Display 800 uppercase, orange nut bar on the left, faint strings behind the letters, ON in accent.
- Icon: metal-horns hand with a studded, spiked strap (line art). Light: ink lines, deep-orange strap (`kit/horns-ink.png`). Dark: bone line art, monochrome (`kit/horns-bone.png`). App icon: orange tile, dark line art (`kit/horns-dark.png`).
- Needs an illustrator pass (heavier stroke) for 29px and below.

## Metronome (locked Oct 30)

- Tuner | Metronome switch at the top of Sound Tools.
- Tempo is the hero (±1, hold to repeat, slider, tap tempo from last 4 taps). Start/Stop is the 84px dock button.
- 2/4, 3/4, 4/4, 6/8; quarter, eighth, triplet, sixteenth. Tap a beat: accent / normal / silent.
- Flash = an edge pulse on beat 1 only (no full-screen flashing). Vibrate optional.
- From a song: loads its BPM; changing it offers Save to song. Practice sessions: optional 1-bar count-in.
- Build note: schedule clicks on the audio clock with ~1 s lookahead; drive visuals from rAF against that clock. Never rely on JS timers for timing.

## Tuner arrows (Oct 30)

- Replaced blinking arrows with stacked chevrons pointing toward the note, like a pilot director guiding a plane in: 3 lit beyond ±25 cents, 2 at ±12–25, 1 at ±5–12. In tune (±5) = one chevron each side, both green. No blinking or motion; colour still shifts red → green. (**Law of Common Fate** avoided as noise; **Doherty Threshold** for steady, instant feedback.)

## Starting note sheet (Oct 30)

- No settings to explain: two buttons, "G chord" (always the song's key) and "D4 note" (the starting note, accent), each plays on its own. No Preview, no key-chord toggle, no Save; the note saves as you pick it, and Done closes.
- The chart pill plays the note only.
- Piano: C carries a small octave number (C₄) that follows octave − / +; the key note is tagged KEY.
- Chart reader with sound tools = the Song Chart reader exactly (Key ± with value, Size with value, pager), plus a speaker button for the starting note at the end of the controls row and the chord strip under it. No "Vocals first" banner, no HEAR label.
- Chord diagrams: tapping a chord (strip or inline) opens (no auto-play; sound only from Play) a small card with a fretboard diagram (× muted, ○ open, dots, barre bar, fret number when above the nut), the fingering as text (e.g. x32010), and a Play button. Tap the chord again or × to close. Open shapes for ~24 common chords; anything else (e.g. after transposing) uses a computed E- or A-shape barre for major, minor, 7 and m7; otherwise "No diagram yet".
- Chord viewer (supersedes the strip): one Chords button (chord-box icon) grouped with the starting-note speaker at the end of the controls row. Opens a centred card: "Chord n of N", ‹ › to step, the diagram and fingering, chips for every chord in the song (current = orange), and Play. Tapping a chord in the lyrics opens the viewer on that chord. No chord strip; no auto-play.
- Starting note entry points: set in the chart editor (Starting note row), or hold the 🔈 button in the chart reader to open the same sheet over the chart. Tap = play.
- Sound: softer voices. Note = sine with quiet 2nd/3rd harmonics, 12 ms attack, exponential decay, low-pass (felt-piano feel). Chords = plucked string with a smoothed pick, low-pass 2.3 kHz, gentler strum (42 ms between strings).
- Chart reader is performance-first: controls start hidden. A labelled **Controls** button (sliders icon) top right shows Key, Size, 🔈 starting note, Chords viewer, a **Hide chords / Show chords** button (chip with chord-box icon; filled while chords show, outlined while hidden, matching filter chips; the label says what a tap will do). Switches stay reserved for settings rows, and a **Notes** button. No Chart | Notes toggle in the header (karaoke mode hides chord rows and tightens lines). Back and Next are the same 88px height.
- No Chart | Notes toggle anywhere. In the chart, a notes button (44px, beside Controls in the header) opens notes in a bottom sheet over the chart (62% height; swipe down, × or tap outside closes); the chart never swaps out. Notes full screen is only reached from the song view ("Full screen"). Landscape uses the same Controls button.

## Locked Oct 30: Calendar & Shows, Account & Settings, Band & Friends, Band Identity

As drawn, including all decisions logged above. Band History remains an exploration in refresh/ (not for launch).

## Extended-range naming (draft, Oct 30)

- Instruments: Guitar 6 / 7, Bass 4 / 5. "Standard" is per instrument: 6-str E A D G B E; 7-str B E A D G B E; 4-str bass E A D G; 5-str bass B E A D G.
- Pills name the tuning the way players do, by its lowest-string root, and add a small string-count superscript only for 7-string guitar and 5-string bass: **B STD⁷** (7-string standard), **A DROP⁷** (Drop A, deathcore staple: A E A D G B E), **A STD⁷** (whole step down), **G♯ DROP⁷**. Avoids clashing with 6-string **B STD** (baritone, B E A D F♯ B).
- Editor rows: string number, big centred note between ↓ / ↑ buttons (48px), play. Changed strings turn accent; no strikethrough or offsets. Sounds are plucked strings (same as the tuner), only from Play; stepping is silent. Each row has a string line drawn at the instrument's standard gauge (guitar .046–.010, 7th .059; bass .105–.045, 5th .130; wound strings textured), so string order reads at a glance.
- Settings → Tunings has one **Tuner** button in its top bar (no per-row buttons).
- Editor fits on one screen with no scrolling (up to 7 strings): the name is the pill at the top (edited in place) with a colour dot beside it; Guitar/Bass + string count on one row; 54px string rows. No separate Name field or Colour row.
- No "Start from…": new tunings start at the instrument's standard. If the strings match an existing tuning, the editor shows that tuning's pill and name and Save is disabled.
- Custom tuning range per string: a full octave down to 7 half-steps up from that string's standard (e.g. low E: E1 to B2). The ↓ / ↑ button dims at the limit. Beyond that strings flop or snap.
- Custom tuning: an **All strings** ↓ / ↑ control above the rows moves every string a half-step together (stops if any string would pass its limit).
- **Layout rule (kit-wide):** when a screen's content is shorter than the viewport, centre it vertically in the body (`.r-body.vc` + an inner wrapper with `margin:auto 0`). Lists and feeds stay top-aligned.

## Custom tuning (locked Oct 31, final)

- Style B "neck": vertical strings under an orange nut, low string left, gauge widths per instrument. No colour change on altered strings.
- Guitar (6 / 7) or Bass (4 / 5). Per-string ↑ / ↓ (silent), range −12 to +7 semitones from standard; limits dim the arrow.
- Tap a note to pluck it (Karplus-Strong, same as the tuner). Speaker icon for play elsewhere; the waveform stays Spotify-only.
- All strings: a goal-post frame wraps the neck and comes down to `↓ ½ step ↑` (down on the left), implying every string.
- "½ step" label: 18px bold UI font, full text colour.
- Name uses the standard kit field (Name · REQUIRED, muted example "Open C, DADGAD…"), colour dot at its trailing edge. No custom input styles. Save is grey until there is a name and no duplicate; a duplicate shows the existing tuning's pill instead.
- **Press feedback (kit-wide rule):** a single 320 ms orange fade on the pressed stepper, run once after the press. No :active flash or transitions on nodes that re-render (that caused flicker).
- Name pill = the tuning name; colour dot opens Automatic (from pitch) or 12 picks. Matching an existing tuning shows its name and greys out Save.
- Content shorter than the screen is vertically centred.
- Tunings list has a Tuner shortcut.

## Tools on Home (locked Oct 31)

- Home shows a Tools row (Tuner, Metronome, Chords) between the practice card and Quick actions; on Personal it leads the page.
- One Tools screen with three tabs; each tile opens its tab. Tools also open in context (retune lines, Tune now, chart chord viewer).
- More: band card, you, Jam, Friends, Settings, Help, Sign out. Events and Band members removed (Calendar filter / band card).

## Closed

- T1 Tuner accuracy: tested against a real tuner, no issue.
- Band History: good idea, parked. Stays in refresh/ as reference; not for launch.

## Jam (locked Oct 31, pending user testing)

- One Jam type: planned phase (lineup, requests, people) then Go live. Replaces separate jam session vs jam-night event.
- The live jam is crowd-first: guests choose which songs to share (jam list suggested), see who knows their songs, compare, and pitch songs with parts. The host picks from pitches ranked by coverage.
- Never required: walk-ups by name, kiosk iPad, web view with no account, "or tell the host" everywhere. No logging; marking songs played is optional.
- Host: one Up-next card, Call up anyway with open parts, fill from hands / house players / Ask the room. Swipe right = up next, left = Played / Left / Remove, with Undo; hold opens the same actions as a menu (fallback). Hallway-test the swipes.
- Bar TV rotates three slides; slides with nothing to show drop out. First names and parts only.
- Group sets: optional, suggested length 1–5, shown as "song 2 of 3"; never blocks a single-song pitch.
- Casting stays an exploration (refresh/Casting.html).

## Practice history (locked Oct 31, to use with the band)

- Reached from a History card on Calendar → Practices. Practices tab: played time, songs covered, skipped, wrap-up notes. Songs tab: last practised + count, longest ago first, set songs not practised lately flagged. Recap ends with Plan next practice from this.
- Dates use real weekdays (Thursdays in Oct 2026).
- Calendar's Events filter is renamed **Jams** (one type). Jam hub lists Hosting and Invited with counts.
- Queue rows: hold opens the same actions as the swipes (Move up next, Played, Left, Edit group, Remove).

## Prototype review fixes (Nov 1)

- Song sort: pick the field (Title, Artist, Date added, Next show), then a separate direction toggle (A–Z / Z–A, Oldest / Newest first). Chip shows field + arrow.
- Chart reader: one continuous scroll (also swipeable); the big Back / Next buttons scroll by most of a screen. Controls open as a bottom sheet with Done.
- More: sun / moon theme toggle top right. A **Band** section: band card, Members, Band profile, Invite. Then You, Jam, Friends, Settings.
- Search: Calendar results include shows, practices and jams by name or by a song in their set, lineup or requests.
- Jam: raising a hand opens a part picker (multi-select; your open parts preselected).
- Friends: no separate privacy screen. A status line under your code rolls open to the Findable switch and who can send requests.
- Prototype v2 (prototype/) is assembled from the locked source phones; v1 (redrawn screens) is archived in prototype/v1.

- Tools are one screen everywhere: back (to wherever you came from) + a three-way Tuner | Metronome | Chords switch. Same header on all three tabs.

## Pickers + practice editor (Oct 31)

- **Pickers come from the existing app's C0 decision** (app/spec-rows/22), now in the kit as `source/kit/pickers.js` + `pickers.css` (`RP.date`, `RP.time`, `RP.dur`, `RP.menu`). Never native date/time inputs or `<select>`.
  - Date: month calendar, accent = selected, ring = today; typing a digit or "/" flips to MM/DD/YYYY.
  - Time: **Google-Calendar list** of every time in 15-min steps, scrolled to the current value (supersedes the C0 Hour · Min · AM/PM columns). Typing flips to entry with AM/PM chips. Stored 24h.
  - **Start + End** instead of a length field: End lists times after the start, each with its duration, e.g. "9:00 PM (2 hrs)", up to 24 hours; past midnight allowed. Typing an end shows the duration on the chip. Stored as duration. (`RP.dur` stepper stays in the kit for set lengths, unused here.)
  - Menu: anchored, grouped, checkmarked, optional lead (tuning pill) and count.
- **New practice = Duplicate**: one editor. Duplicate prefills name, date (+1 week), time, length, place, focus and songs, with a "Copied from" line.
- **Song browser** (ported from the app's BrowseSongs): search, Tuning / Setlist / Artist menus with counts, sort, Clear, "Add all from ‹setlist› (N)", click a row to add or remove (filled check = added). Songs header shows "N · X of Y min" against the practice length.

## Nov 7 2026 · final pass (all of source/REVIEW-NOV-2.md applied)

Drawn in `demo/screens/Final Pass.html` (mobile) and `demo/desktop-final.js` + edits in `desktop*.js` (desktop). Item numbers refer to REVIEW-NOV-2.md.

- **1.1 New show = the show page, blank.** Shows are edited in place, so New show opens the show page with Venue focused and saves as you go; "Discard draft" until it has a venue or name. Practices keep their New / Duplicate editor (made in bulk, duplicated weekly). (**Jakob's Law** within each type, **Tesler's Law**)
- **1.2 Chart editing is its own screen on both.** The song editor keeps one row, "Add / Edit chords & lyrics", which opens the chart editor (mobile route; desktop wide two-pane: edit left, live preview right, Lyrics + chords / Chords only, starting note). Mobile song view's primary button routes there when no chart exists. (**Law of Common Region**, **Flow**)
- **1.3 No Notes | Chart toggle in the practice session.** Notes is a button: a 62 % sheet on phone, a side panel on tablet / desktop. Chart and Tune are plain buttons beside it. (**Working Memory**, one mental model for where notes live)
- **1.4 Setlist dock.** Mobile keeps one Add menu. Desktop keeps three buttons (Break, Section, Add songs) because the room is there, but Break and Section insert **after the selected row** and open an inline editor (length ±5 min and note; section label). Click a row to select it. (**Fitts's Law**; behaviour matches mobile)
- **1.5 "Open on stage" removed** from the desktop setlist until a stage view exists. (No promise the app can't keep)
- **1.6 Jams everywhere.** Calendar filters read All · Shows · Practices · Jams; New offers Show / Practice / Jam; type label JAM. "Events" stays only as the umbrella word in the Calendar title. Home's list is "Upcoming". (**Law of Similarity**) — terminology is still on the final-review list above.
- **1.7 One New button on Calendar, both platforms.** Its label follows the filter (New show / practice / jam); on All it opens a type menu. History sits beside it on All and Practices. (Consistency, **Hick's Law**)
- **1.8 Desktop song list has visible Sort and View controls.** Sort = field (Title, Artist, Date added, Next show) + direction; header click is a shortcut to the same state. View = density + Artist / Key / BPM / Links / Next show + Show hidden. Tuning chips stay as the filter. Row hover shows Hide / Add to set; right-click opens the full menu. (**Visibility of system status**, **Jakob's Law**)
- **1.9 Host a jam is two fields** (name, when; where optional) on both. Who can join, song requests, approve requests myself and group sets live on the planned jam's page (desktop side panel, mobile ⋯ → Jam settings). (**Doherty Threshold**)
- **1.10 Regenerate invite code on desktop** with the same warning as mobile.
- **2.1 Setlists list:** sort (Next show / Name / Updated), a visible ⋯ per card (Duplicate, Delete with a confirm that says the catalog and show copies are untouched), and set-level Markdown notes from the editor header. New setlist creates an empty set with an empty state and a rename-in-place title.
- **2.2 Personal catalog:** a dismissable banner, "N songs in your bands aren't in My Songs · Copy all · Pick some". Copies carry a small band tag and stay linked. Same component on both.
- **2.3 RSVP** drawn on the practice page on both platforms (Coming / Maybe / Can't), matching the show. Ships after launch.
- **2.4 Add a friend:** by name (if findable) or by friend code, with your own code to share. Sheet on mobile, dialog on desktop.
- **2.5 States, one drawn instance each:** Songs loading (skeleton), empty, no matches (Clear filters); Calendar error + Retry; Home offline banner; Jam hub empty; empty setlist. Desktop has a demo-only **States** panel (bottom right) to open any of them. Rule: every list uses skeleton rows while loading and an error card with Retry.
- **2.6 Mobile song view "Used in":** setlists, shows whose set copied it, planned practices.
- **2.7 Desktop Settings:** About (version, What's new, Help) and Account → Change password.
- **2.8 Month view deferred** until calendar sync ships. The agenda answers "what's next"; Month is browsing. The Month segment on desktop says so.
- **2.9 Desktop practice session:** the tablet layout scaled up, full window (sidebar hidden): song as the hero, the practice's note for the song, link buttons, Up next (yellow with Tune now on a tuning change), 96 px Prev / Next naming the destination, notes as a side panel (N toggles), ← → / pedal, End practice → wrap-up → Practice history.
- **§3 Desktop dead ends wired on primary paths:** global search (⌘K or the sidebar; scoped to the context with "All contexts"), New setlist, Join with a code (jam or band, preview first), the circle-of-fifths key picker, Forgot password → Check your email, plus album, Spotify matches, "Also add to My Songs" and Manage tunings in the song editor, member ⋯ menus, Edit band info, Edit instruments (ordered list). Still partial and marked so in PARITY: QR full screen, Delete band typed confirm, Change photo, inline notes editing on desktop.
- **§4 Fixture:** one set of dates on every new screen and both demos (fixed in the locked Calendar, Practice, Setlist Editor, Tools on Home and Practice History pages): Tuesday Open Jam **Tue Nov 3**, Thursday run **Thu Nov 5** and **Thu Nov 12**, Fall Kickoff **Sat Nov 7** at The Crocodile, Birthday Jam **Sat Nov 14**, Halloween Bash **Sat Nov 21** (cancelled), last practice **Thu Oct 29**. "Today" in the demos is Sun Nov 1.
- **§5 Docs:** CLAUDE.md rewritten to point at `demo/` + `source/`; PARITY re-graded with "partial" where a control is still a stub.

## Nov 7 2026 · build handoff, Part A (settled with Eric)

Answers to `docs/redesign/07-handoff-to-build.md` Part A. Each also changes the guides named in brackets.

1. **Tuning colours: keep today's hues, nudge the two that clash.** Bands' muscle memory wins over the pitch spine (spec 00-overview). Drop D moves off orange (it read as the band accent) and Drop C off red (it read as danger). Light theme uses the Tailwind 700 shade of each hue so pills stay readable on cream. C Standard, a new built-in, takes violet. Custom tunings: the user picks from 12 swatches; the picker opens on the first swatch not used by a built-in or another custom tuning in that context. Kit: `kit/rock.js` `PALETTE`. (**Jakob's Law**, **Von Restorff**) [01 §7]

   | Tuning | Dark | Light | Change |
   |---|---|---|---|
   | Standard | `#60a5fa` | `#1d4ed8` | — |
   | Half-step down | `#14b8a6` | `#0f766e` | — |
   | Whole-step down | `#0ea5e9` | `#0369a1` | — |
   | **Drop D** | **`#84cc16`** lime | `#4d7c0f` | was `#f97316` orange |
   | Drop D♭ | `#f59e0b` | `#b45309` | — |
   | **Drop C** | **`#d946ef`** fuchsia | `#a21caf` | was `#ef4444` red |
   | Drop B | `#a855f7` | `#7e22ce` | — |
   | Open G | `#eab308` | `#a16207` | — |
   | Open D | `#ec4899` | `#be185d` | — |
   | DADGAD | `#10b981` | `#047857` | — |
   | C Standard (new) | `#8b5cf6` | `#6d28d9` | new built-in |
   | Unknown | `#6b7280` | `#4b5563` | — |

2. **Events vs Jam: option A.** One social type called **Jam**, built on the Events tables (`events`, `event_participants`, `event_lineup_items`, `event_lineup_requests`, `event_hands`), extended for the live night: a `live` status, a queue state per lineup item, people without accounts, house players, group size. It sits on the calendar beside shows and practices. **Casting** is hidden behind a `CASTING` feature flag; its tables and data stay. The 0.3 jam-session screens are retired; catalog matching survives as "who knows your songs" in the guest view. Today's Events data shows up as Jams. [03, 04, 05, 06]
   - **Who writes without an account: web guests only, narrowly.**
     - Walk-ups (added by the host) and the counter iPad (a kiosk mode running under the host's signed-in account) write **as the host**. They aren't anonymous.
     - A web guest who joins with the exact code gets a **guest token scoped to that one jam**, expiring when the jam ends. With it they may: set a first name (≤ 40 characters) and the parts they play; raise and lower **their own** hands; pitch a song **while requests are open**; leave. They can't edit or remove anything that isn't theirs, can't see other guests' contact details (there are none), and can't read anything outside the jam.
     - **The host stops abuse with:** remove a person (their hands and pitches go with them); require approval for pitches; close requests; lock joining; end the jam (deletes guest names, as the design promises). The server rate-limits joins, hands and pitches per token and per IP.
3. **Offline: not in this redesign.** The web app is online-only and always reads from the database; ordinary browser caching is fine, nothing more. With no connection it shows the one offline banner and blocks edits. Every "works offline" line above (stage screens, chart reader, practice session, the spec's "Offline (native)" rule) is **deferred to the native apps**, to be decided in Flutter planning. [01, 03, PLATFORM-NOTES]
4. **Owner is a role: exactly one per band.** Stored as `role='owner'`, enforced by the database. Migration: today's `'owner' = ANY(permissions)` holders become `role='owner'`; if a band has several, the earliest joined wins and the others become admins; if none, `bands.created_by` (or the earliest admin, if the creator has left). Transfer is a plain confirm and one atomic server call (old owner → admin, new → owner). Delete band is owner-only and typed. An owner must transfer before leaving. [04, 05]
5. **Instruments: an ordered list, no ★.** First shown first; no "primary". Migration puts today's starred instrument first, then stops using `primary_instrument` (column dropped later). The five spec mentions of ★ (profile, band members, workflows 02, 12, 13) are superseded. [04]
6. **Show Confirmed is its own field.** `shows.confirmed` (bool) beside `status` (scheduled / cancelled / completed), so Undo of Cancelled restores exactly what was there. Backfill: `status='confirmed'` → `confirmed=true, status='scheduled'`. [04]
7. **Band notes: one shared note + a link to the practice log.** The song view shows one Markdown band note (`songs.notes`) with "last edited by ‹name› · ‹when›". `song_note_entries` become the **practice log**: a small "Practice log · N" link on the song view opens them, newest first. [03, 04]
8. **Launch scope:** global search **in**, tools (tuner, metronome, chords) **in**, chart reader + editor **in**, **Practice history deferred** (see Scope above). [05]
9. **Removed or hidden capabilities (each approved by Eric):**
   - Shows and Practices list pages → Calendar filters; old URLs redirect.
   - Events casting console → hidden behind the `CASTING` flag, data kept.
   - Setlist statuses (draft / active / archived) → gone; sort by Next show / Name / Updated; archived sets become ordinary sets.
   - Home quick-stats rail → gone.
   - Events list page and More's Events / Band members rows → Jam hub, Calendar → Jams, the band card.
   - 0.3 jam-session screens (common songs) → "who knows your songs" in the jam guest view.
   - Per-row sync icons → gone (dead code since the online-only switch).
   - **Kept** (not in the drawn design, added back): song **Duplicate** in the long-press / right-click menu; **"Save tonight as a setlist"** on an ended jam.
   - Note: "Open on stage" was only ever in the old desktop prototype, never in the live app; nothing to remove.

## Nov 7 2026 · setlist navigation and the swap icon (settled with Eric)

- **Song page (decided Nov 8).** A song opens as a full page (sidebar kept) that edits everything: title and facts in place, saving per field with Undo; notes in place with Done and a keep-my-draft conflict prompt; details, links and Used in in a right column. Back is named after the origin (`?from=`), and ‹ › / J K step through that list. The desktop pane is a read-only preview with Open. The full-screen editor is Add song only. Mock: `demo/Song Page.html`; answers to 09.

- **Setlists: an index, then the set full width (option A), plus the name as a switcher.** The nested column of setlists next to the editor goes, on desktop. Setlists in the sidebar opens an index of cards (show, counts, first songs; next show first and outlined; New setlist). A set opens full width with **← Setlists** (or Back named after wherever it was opened from, as on the song page). Beside the set's name, a switcher lists every set, next show first, with the current one ticked, and ends with **All setlists** and **New setlist**. The switcher only switches: Rename, Duplicate and Delete move to the editor header's ⋯. Phone: the list → editor flow is unchanged; the name gets the switcher as a bottom sheet ("Switch setlist"). Mock: `demo/Setlist Nav.html?nav=ab`. (**Jakob's Law**: same pattern as the song page and the band switcher; **Fitts's Law**: the set gets the width)
- **Icon rule: caret ⌄ vs swap ⇄.** A caret only on things that open **right there**: a dropdown anchored to the control, or a section that rolls open in place. A control that opens a **bottom sheet to change what you're looking at** shows the **swap** icon (⇄, kit `swap`), never a caret. A chevron › still means "go there" or "pick a value" (list rows, form field rows). So the setlist switcher is ⌄ on desktop (a real dropdown) and ⇄ on the phone (a sheet). (**Consistency**: an icon promises what happens next)
