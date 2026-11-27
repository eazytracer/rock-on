# Data implications of the refresh design

What the locked design needs stored or synced. This is written from the design, not the code: **diff it against the real schema in `src/` (IndexedDB + Supabase) and mark each item as exists / change / new.** Items marked (future) only need room left for them.

## Users and preferences
- Profile: display name, photo, instruments (multi-select, **no primary**; see DECISIONS "instruments"). Email is never shown to bandmates (admins only, on Members).
- Personal context colour: user-pickable; the default is indigo.
- Preferences (per user, synced):
  - theme (system / light / dark)
  - song list view per list: density (comfortable / compact) and fields (artist, key, BPM, links, next show)
  - sort per list: field (title / artist / date added / next show) and direction
  - setlist timeline mode (clock / set time)
  - chart text size and chord labels on/off
  - metronome: click sound, count-in on/off + length, flash, vibrate
  - push preferences: master switch, per type, per-band mute, quiet hours
- Friends: friend code, requests (pending / accepted / declined), privacy (findable by name: bool; who can send requests: everyone / friends of friends / code only).

## Bands and membership
- Band: name, mark `{kind: initials | symbol | photo, initials, lettering, symbol, colour, image_url}`, city, region, country, genres[], description, links[], visibility (private now; public (future)), created_at.
- Member: role (owner / admin / member), instruments, joined_at. Exactly one owner; transfer is supported.
- Invite: a band code plus a link, regenerable (old code stops working). Join always shows a preview first.

## Songs
- Song: title, artist, album, tuning (built-in id or custom tuning id), key, BPM, duration, added_at, created_by, context (personal or band).
- Links[]: type (tabs / audio / video / lyrics / cloud / link), url, label.
- Notes: **band notes** (shared, markdown, edited_by / edited_at) and **my notes** (private per user per song). The row shows a notes icon only when notes exist (band / mine / both).
- Hidden per user (swipe Hide) with a "Hidden" section.
- Copy into a band: adding a personal song to a band setlist copies it into the band catalogue ("From my songs").
- Chart: one ChordPro text field per song (see `source/CHART-DATA-MODEL.md`), plus a starting note (MIDI) for vocal starts. Transposition and text size are view state, not stored on the song.
- BPM can be written back from the metronome ("Save to song").

## Tunings
- Built-ins (read-only): E std, E♭ std, D std, Drop D, Drop C, C std, Drop B, 7-string B std, bass 4 / 5 std.
- Custom tuning (per user): name, instrument (guitar / bass), string count (6 / 7 or 4 / 5), notes as MIDI[], colour (auto from pitch, or a custom hex). Uniqueness: the same notes as an existing tuning are blocked ("That's Drop D").

## Setlists
- Setlist: name, context, notes (setlist-level), created_at.
- Ordered items: song | break (length in minutes, default 15, optional note) | section label. A per-set song note is attached to the item, not the song.
- Derived, not stored: totals, retune count, start times for the timeline.

## Calendar
- One calendar of three types: **show**, **practice**, **jam** (a "jam night event" is now just a planned jam).
- Show: start, load-in, soundcheck, slot length (for "52 of 45 min"), venue (name, address), pay, contacts[] (name, role, phone, email), confirmed (bool), cancelled (bool; kept and struck through, with undo), notes. **Set = a copy** of setlist items with copied_from_setlist_id and copied_at (Re-copy replaces it). RSVP per member: going / maybe / can't.
- Practice: start, duration, location, focus notes, songs[] with a per-practice note.
- Practice session / history: started_at, ended_at, elapsed, songs reached with time per song, skipped songs, wrap-up notes (shared), attendance. Feeds Practice history (Practices and Songs: last practised, count).

## Jams (one type: planned, then live)
- Jam: host(s), venue, start, status (planned → live → ended), join code (and QR / link), optional group-set length (1–5 songs, suggestion only).
- People: accounts **or walk-ups by name only** (no account), plus web guests (no account; name + session token) and kiosk entries.
- Guest shared songs: the source a guest chose to share (personal jam list, all songs, a band, a setlist). Used for "who knows your songs", compare, and coverage.
- Pitches / requests: song, pitched_by, parts[] with the people filling each, created_at. Ranked by coverage (parts filled).
- Hands: person, song, parts[] (multi-select).
- Queue: ordered groups with state (queued / up next / on stage / played / left / removed). **Marking played is optional;** there is no audit log requirement. House players are flagged per jam.
- Live updates use in-app realtime (not push). The TV view shows first names and parts only.

## Notifications
- Activity (in-app bell): actor, verb, object (type + id), context (band id or none for friends), created_at, read_at per user. Never your own actions. Covers songs, setlists, shows, practices, jams, RSVPs, members, friends. Tapping opens the object (with a switch-context prompt if it's another band).
- App updates: release notes kept separately ("What's new"), with seen-state per user.
- Push: a small set (reminders, changes to plans you're in, set edits within 7 days of a show, invites, friend requests). When in doubt, less.

## Parked / future
- Band history and restore (admin audit trail): parked; don't build yet.
- Public band profile and press kit: the band fields above already cover it; add visibility later.
- Casting (Pro): exploration only.
