# 03 · Screens: every route, what it becomes

For each area: the design (mobile phones in `demo/Rock On Mobile.html`, desktop view in `demo/Rock On Desktop.html`;
the checklist in the mobile demo jumps to every phone), the route and files here, and what changes.
"FP n" = phone n in `demo/screens/Final Pass.html` (the Nov 7 additions).

Desktop (≥1024) is a sidebar app with list + detail panes; mobile is the five-tab app. One React tree, responsive:
use `hooks/useResponsive.ts` to pick the layout, never two route trees.

---

## Shell and navigation

| Design | Route / files | Changes |
|---|---|---|
| Core Navigation 4–6: context dropdown, switch prompt (long once, then short) | `layout/ContextSwitcher.tsx`, `MobileHeader.tsx`, `Sidebar.tsx` | Dropdown anchored to the chip (mobile header; desktop sidebar top). Personal · bands (dot on bands with unread activity, no count) · Create or join. Opening something from another band shows the switch prompt: full explanation the first time only, then "Switch to ‹Band›? Not now / Switch". Sets `data-ctx` (01 §3) |
| Desktop sidebar | `layout/Sidebar.tsx`, `ModernLayout.tsx` | New IA (02 → desktop sidebar). Footer: avatar, theme toggle, bell with dot |
| Global search: Core Navigation 7 (mobile, on Home), desktop ⌘K palette | **new** `components/search/` | Scoped to the current context with "All contexts"; songs, setlists, calendar items (by name **or** a song in their set / lineup), jams. Enter opens the first hit. Mobile: search lives on Home only (DECISIONS) |
| Notifications popout + All (Activity / App updates): Core Navigation 9–11 | `pages/NotificationsPage.tsx`, `hooks/useNotifications.ts` | Bell opens a dropdown of unread items with one action, Mark all read. Full page is a stream; reading clears the dot. Big icon = band mark, small badge = type. App updates tab reads `release_notes` (exists) |
| Offline | `sync/OfflineIndicator.tsx`, `SyncIcon` | Online-only (DECISIONS Part A · 3): one banner at the top when the connection drops, edits blocked. Delete the per-row sync icons and indicators (dead code) |

## Home `/`

| Design | Files | Changes |
|---|---|---|
| Core Navigation 1–3, Tools on Home 1–2; desktop Home | `pages/HomePage.tsx` | Band: next show card (confirmed dot, countdown), next practice card, **Tools row** (Tuner · Metronome · Chords with live hints), Upcoming (3, typed), Quick actions (Add song, New setlist, Schedule practice, Book show). No stats. New band: self-ticking walkthrough. Personal: its own walkthrough + a "Playing with others?" card that never returns once dismissed. **Book show** → New show (FP 4). Offline banner: FP 19 |

## Songs `/songs`

| Design | Files | Changes |
|---|---|---|
| Song Row (catalog, view options, sort, swipe, hold); desktop Songs table | `pages/SongsPage.tsx` (2.4k lines), `common/SongListItem.tsx`, `songs/SongList.tsx` | New song row (02). **Sort** = field (Title, Artist, Date added, Next show) + separate direction toggle; chip shows field + arrow. **View** = Comfortable / Compact + Artist, Key, BPM, Links, Next show + Show hidden, saved per list per user. Tuning chips filter. Swipe left: Hide, Add to set; long-press: full menu, which keeps **Duplicate** (Part A · 9). Desktop: table with the same Sort / View controls (header click = shortcut to the same state), hover actions, right-click menu, detail pane on the right. Hidden songs already exist (`useHiddenSongs`) |
| States: FP 15–17 | same | Skeleton rows; empty with Add song / Paste a list; no matches with Clear filters |
| Personal catalog: FP 13; desktop banner | same + `songs/SongLinkingSuggestions.tsx` | In Personal: dismissable "N songs in your bands aren't in My Songs · Copy all · Pick some". Copies carry a band tag and stay linked (`linkedFromSongId` exists) |
| Song view: FP 6 (mobile), desktop detail pane | `songs/LinkedSongView.tsx`, `SongNotesModal`, `notes/*` | Read-first: facts → **Chords & lyrics** (or "Add chords & lyrics") → links → notes (In ‹setlist› when opened from a set, **one** Band note (`songs.notes`) with last editor and a small "Practice log · N" link to the `song_note_entries` (Part A · 7), My notes with lock; edit in place with a pencil, Markdown bar) → **Used in** (setlists, shows, planned practices). Full screen notes from here only **Nov 8: superseded by the song page** ([10](10-song-page-and-setlist-nav.md) Part 1): one page edits everything in place, Back from `?from=`, desktop pane read-only with Open. |
| Add / edit song: Song Editor and View 1–5, 8; desktop New song | `songs/EditSongModal.tsx` (1.4k lines), `SpotifySearch.tsx`, `CircleOfFifths.tsx` | Full-screen route on mobile, two-pane page on desktop; Cancel / Save. Only title required. Spotify matches appear quietly under the title and fill title, artist, album, length, Spotify link. Tuning picker sheet (+ New tuning, Manage). Key = circle of fifths. Links: paste a URL, type auto-detected. In a band: "Also add to My Songs". **No notes, no delete, no chart in the form**: one row "Add / Edit chords & lyrics" opens the chart editor. Cancel with changes names the changes **Nov 8: Add song only** ([10](10-song-page-and-setlist-nav.md) 1.5); existing songs are edited on the song page. Desktop Add song keeps the sidebar. |

## Chart and tools (net new)

| Design | Files | Changes |
|---|---|---|
| Chart reader: Song Chart, Sound Tools 1; desktop Chart | **new** `pages/ChartPage.tsx`, `components/chart/` | One continuous scroll; big Back / Next scroll most of a screen (keep 2 lines overlap); tap zones and Bluetooth pedal page; screen awake; edge swipe-back off. Offline is native-only (`design/PLATFORM-NOTES.md`). Controls (bottom sheet / toolbar): Key −/+ (transpose live), Size, Show / Hide chords, starting-note speaker, chord viewer. Notes button opens notes in a sheet over the chart. Landscape: two columns |
| Chart editor: Song Chart 5–8; desktop chart editor | **new** `components/chart/ChartEditor.tsx` | Paste chords-over-lyrics or ChordPro (auto-detected); lyrics mode keeps chords pinned to letters; chords mode = palette by key, tap a letter; "Chords from Verse 1" copies to the next verse; starting note row. Desktop: edit left, live preview right, Lyrics + chords / Chords only. Storage: `source/CHART-DATA-MODEL.md` |
| Starting note sheet, chord viewer | **new** | One-octave piano, octave −/+, "G chord" and "D4 note" buttons, saves as you pick. Chord viewer: "Chord n of N", diagram + fingering, Play. In-app synth (Karplus-Strong pluck, sine note) |
| Tools: Tuner · Metronome · Chords (one screen, three tabs): Sound Tools 3, Metronome, Tools on Home 3; desktop Tools | **new** `pages/ToolsPage.tsx` (`/tools/:tab`) | Tuner: opens on the song's / next song's tuning, chevron "pilot" arrows, N of 6 in tune. Metronome: tempo hero, tap, time sig, subdivisions, accents, edge flash, count-in, Save to song. **Schedule clicks on the AudioContext clock with ~1 s lookahead; drive visuals from rAF; never JS timers.** Chords: root + quality → diagram + Play |
| Custom tuning: Custom Tuning; desktop Settings → Tunings → New | `tunings/CreateTuningModal.tsx`, `TuningsSection.tsx` | Neck layout: vertical strings under an orange nut, ↑/↓ per string (−12 to +7 st), "½ step" goal-post for all strings, tap a note to pluck, Guitar 6/7 · Bass 4/5, duplicate check shows the existing tuning and disables Save, colour dot (auto or 12 picks). Table exists (`tunings`) |

## Setlists `/setlists`, `/setlists/:id`

| Design | Files | Changes |
|---|---|---|
| Setlists list: FP 9–11, 23; desktop left pane | `pages/SetlistsPage.tsx` (2.3k lines) | Cards: name, songs · min · retunes, the attached show. Sort chip (Next show / Name / Updated). Visible ⋯ per card: Open, Duplicate (not attached to a show), Delete (confirm says catalog and show copies are untouched). FAB New setlist **Nov 8: desktop is an index page of cards, not a left pane** ([10](10-song-page-and-setlist-nav.md) Part 2). |
| Editor: Setlist Editor 2–9; desktop editor | `pages/SetlistViewPage.tsx`, `hooks/useDragAndDrop.ts` | Saves as you go (no Save). Totals line. Retune lines + Tune. Drag by grip or 300 ms hold; Move sheet (Up / Down / To top / After…). One full-width **Add** on mobile (Songs / Break / Section); desktop has three buttons that insert **after the selected row** and open an inline editor. Breaks default 15 min. Set notes (FP 12) from the header. Timeline rail: fixed gutter, tap toggles, hold picks Clock / Set time; Clock only with a show start. **Remove "Open on stage"** until a stage view exists **Nov 8: full width with ← Setlists and a name switcher** (caret dropdown on desktop, ⇄ sheet on phones); Rename / Duplicate / Delete in the header ⋯; song rows open the song page ([10](10-song-page-and-setlist-nav.md) 1.7, Part 2). |
| Song browser: Setlist Editor 4 | `common/BrowseSongsDrawer.tsx` | Pushed route on mobile, right pane on desktop. Band songs + "From my songs" (copied in). Tuning chips (most-used first). Songs already in the set keep their row with a muted set icon |

## Calendar `/calendar` (shows, practices, jams)

| Design | Files | Changes |
|---|---|---|
| Agenda: FP 1–3; desktop Calendar | `pages/CalendarPage.tsx` | One agenda, three types; filters **All · Shows · Practices · Jams**; Upcoming then Past (dimmed); cancelled rows struck through. One **New** whose label follows the filter; on All it opens the type picker (FP 2). Jams filter adds Join with a code. Month view: **deferred** until sync. Error state FP 18 |
| `/shows`, `/practices`, `/events` list pages | `ShowsPage.tsx` (1.3k), `PracticesPage`, `EventsPage.tsx` | Spec Must not: no separate lists. Redirect `/shows` → `/calendar?type=show`, `/practices` → `/calendar?type=practice`. `/events` → the Jam hub (Part A · 2), in the Jam phase. Detail routes stay |
| New show: FP 4; desktop blank show in the detail pane | `pages/ShowViewPage.tsx` (`/shows/new`), `ShowsPage.ScheduleShowModal` | New show **is the show page, blank**: Venue focused, saves as you go, "Discard draft" until it has a venue or name. Retire `ScheduleShowModal` |
| Show page: Calendar and Shows 5–9 | `pages/ShowViewPage.tsx` | Edit in place. Confirmed is a checkbox; Cancelled strikes through and keeps it, with Undo. When (start, load-in, soundcheck, set length), venue + directions, pay, contacts (tap to call / email). **Set = a copy** ("Copied from Fall Set · Re-copy"; "52 of 45 min" turns warn). No set yet: Copy a setlist (primary) / New set. RSVP row. Delete names what goes and points to Cancelled |
| Practice page: Practice 1, FP 5 | `pages/PracticeViewPage.tsx` | Status from time, never a field. Focus. Songs with every link as a labelled button and the per-practice note. **RSVP** (Coming / Maybe / Can't). Start session docked. Duplicate |
| New / duplicate practice: New Practice 1–3; desktop editor | `PracticeViewPage` (`/practices/new`, `/:id/edit`) | One editor for both; Duplicate prefills +7 days with "Copied from". Kit date picker; Start + End lists (stored as duration). Song browser with Tuning / Setlist / Artist / Sort, "Showing X of N", Add all from a setlist; "N · X of Y min" against the practice length |
| Practice session: FP 7–8, Practice 2–4; desktop full-window session | `pages/PracticeSessionPage.tsx` (1k lines), `practice/*` | Stage screen. 96 px Prev / Next naming the destination; last becomes End practice. **No Notes | Chart toggle**: Notes is a button → sheet (phone) / side panel (tablet, desktop); Chart and Tune are buttons. Up next card turns warn with Tune now on a tuning change. Wrap-up: time played, songs reached (skipped marked), shared wrap-up notes (saved; Practice history itself is deferred). Keys: ← → / PgUp PgDn / pedal, N notes |
| Practice history: Practice History 1–4; desktop History | **deferred** (Part A · 8). Not in this redesign | The session data is still recorded. When it returns: History card on Calendar → Practices. Practices tab (played, songs covered, skipped, wrap-up excerpt); Songs tab (last practised + count, longest ago first, set songs flagged); recap ends with Plan next practice from this |

## Jam `/jam` — option A (Part A · 2)

| Design | Files | Changes |
|---|---|---|
| Jam Plan, Jam Live, Jam Host, Jam TV, Jam Venue; FP 20–22; desktop Jam; **working prototype `demo/Jam Night.html`** | `pages/JamSessionPage.tsx`, `JamViewPage.tsx`, `components/jam/*`, and possibly `pages/Event*.tsx`, `components/casting/*` | One Jam type: **planned** (lineup / requests / people, access card, settings) → **Go live** (host console: on stage, Up next with open parts, fill from hands / house / ask the room, Call up anyway, queue actions) → ended (nothing to log). Guests: app, web without an account, counter iPad, walk-ups by name. Host a jam is two fields. Bar TV rotates On stage / Looking for someone / Come play. Ended jam keeps **Save tonight as a setlist**. **Decided: built on the Events tables.** `/events` routes redirect to the Jam hub; casting UI behind `CASTING`; the 0.3 `/jam/:id` screens retire, their catalog matching becomes "who knows your songs". Web guests use a jam-scoped token (`design/OPERATIONS.md` §13) |

## Account, settings, band, friends

| Design | Files | Changes |
|---|---|---|
| Sign in, errors, forgot, check email, get started: Account and Settings 1–4, 10; desktop full-screen auth | `pages/AuthPages.tsx` (1.9k lines) | Apple and Google buttons with their logos; wrong-password message offers reset; Get started has four paths (Create a band, Join a band, Got a jam code?, Continue solo) |
| Settings: Account and Settings 5–9, 11; desktop Settings (Profile, Appearance, Tunings, Notifications, Account, About) | `pages/SettingsPage.tsx` | Appearance (theme). Tunings list with Tuner shortcut and New. Profile: instruments as an ordered list (**no primary**: first shows first). Push: master switch, per type, per-band mute, quiet hours. Account: change password, delete account (typed). About: version, What's new, Help |
| More (mobile): Tools on Home 4 | `pages/MorePage.tsx` | Sun / moon top right. Band section (band card, Members, Band profile, Invite). Then You, Jam, Friends, Settings, Help, Sign out. Events and Band members rows go (Calendar filter / band card) |
| Band members, invite, transfer, leave, create, mark, join preview: Band and Friends 1–9, Band Identity; desktop Band | `pages/BandMembersPage.tsx` (1.4k lines) | Invite card with code + share + QR + **Regenerate** (warning). Member ⋯ by permission. Transfer = plain confirm; delete band = typed. Create band = one field, then straight to the band with the invite card on top. Band mark picker (Initials / Symbol / Upload + 8 colours). Join always previews first; Join is the biggest button |
| Friends: Band and Friends 10–11, FP 14; desktop Friends | `pages/FriendsPage.tsx`, `events/InviteFriendsSheet.tsx` | Code + QR + copy; privacy as a status line that rolls open (Findable switch, who can send requests). Requests / Friends / Sent. **Add a friend**: by name (if findable) or by code. Data exists (`friend_code`, `discoverable`, policy) |
