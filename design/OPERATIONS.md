# Operations · the API contract

Every user action in the redesign, as a server operation that the web app and the Flutter apps both call.
Written Nov 7 2026 from the demos in `design/demo/`, `source/DECISIONS.md` (incl. Part A) and the schema on
`redesign/integration`. Names are suggestions; the build agent's **API conventions** step (05-plan) fixes the
transport (Postgres RPC, PostgREST + RLS, or edge function) and the naming.

## Reading this

- **Who may:** `self` = the signed-in user acting on their own things · `member` / `admin` / `owner` = role in the
  item's band (owner ⊃ admin ⊃ member) · `context` = whoever owns the item's context: the user for Personal, any
  band member for a band · `host` = the jam's host or a co-host · `participant` = signed-in person in the jam ·
  `web guest` = holder of a jam guest token (no account) · `anyone` = no sign-in.
- **Content isn't gated by role** (spec): any band member can add, edit and delete band songs, setlists, shows and
  practices. Roles gate only people and band settings.
- **Every write** checks the caller's access server-side, bumps `version`, sets `last_modified_by`, and writes
  `audit_log` (that's what drives live updates for bandmates). A write sent with a stale `version` is refused.
- **Errors every operation can return** (not repeated below): "You're offline. Changes need a connection." ·
  "Someone just changed this. Showing the latest." (stale version) · "You don't have access to this." · a generic
  "Couldn't save. Try again." with Retry.
- **Left out on purpose:** display maths (totals, minutes, retune counts, "52 of 45 min", start times on the
  timeline, coverage bars). The build agent decides where those live.
- **Existing today** lines name functions already in `supabase/migrations/` that cover part of an area.

---

## 1. Account and session

Existing today: Supabase Auth, `handle_new_user`, `update_user_activity`.

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `sign_in_password` | anyone | email, password | session | Rate-limit per email + IP | "That email and password don't match. Check for typos, or reset your password." |
| `sign_in_oauth` | anyone | provider (apple, google) | session | New user → creates `users` + `user_profiles` | "Couldn't sign in with ‹Apple›. Try again." |
| `sign_up` | anyone | email, password | pending account, email sent | Password ≥ 8; email unique | "An account with that email already exists. Sign in instead?" |
| `request_password_reset` | anyone | email | email sent (always reports success) | Never reveal whether the email exists; link valid 1 hour | — |
| `change_password` | self | current, new | done | Current must match; new ≥ 8; other sessions stay signed in | "Your current password isn't right." |
| `delete_account` | self | typed confirmation | account deleted | Refuse while the user owns any band; typed text must match | "Transfer ‹Band› first. You own it." |
| `get_started_state` | self | — | which of the four paths apply (has bands, pending invites) | — | — |

## 2. Profile and preferences

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `update_profile` | self | display name, photo, instruments (ordered list) | profile | Name 1–60 chars; instruments from the fixed list or "Other: text"; **order is meaningful, no primary** | "Add a name." |
| `upload_avatar` | self | image | photo URL | Square crop; ≤ 5 MB; image types only | "That file isn't an image we can use." |
| `get_profile` | self, or anyone sharing a band / jam / friendship | user | name, photo, instruments | Email only via `get_user_emails` (band admins/owners; exists) | — |
| `set_personal_color` | self | colour | done | One of the offered swatches | — |
| `get_preferences` / `set_preferences` | self | theme; list views {list id → density, fields, sort field, direction}; timeline mode; chart text size + chords on/off; metronome settings; push settings | preferences | Per user, follows them across devices | — |
| `mark_release_seen` | self | version | done | Sets `last_seen_release_version` (exists) | — |

## 3. Context, search, notifications

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_my_contexts` | self | — | Personal + each band (name, mark, role, has-unread dot) | Only active memberships | — |
| `search` | self | query, scope (current context / all) | songs, setlists, calendar items (shows, practices, jams), each with its context | Matches calendar items **by name or by a song in their set / lineup**; only contexts the user belongs to | "Nothing matches ‹q› in ‹context›." (with Search all contexts) |
| `list_notifications` | self | tab (activity / app updates), cursor | items: actor, verb, object, band, time, read | Never the user's own actions | — |
| `mark_notifications_read` | self | ids or all | done | — | — |
| `open_notification_target` | self | notification | the object, plus whether it's in another context | If another band: client asks "Switch to ‹Band›?" | "This was deleted." |

## 4. Bands and membership

Existing today: `is_band_member`, `is_band_admin`, `user_belongs_to_band`, `auto_add_band_creator`, invite codes + `increment_invite_code_usage`, `get_user_emails`.

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `create_band` | self | name | band, caller as **owner**, an invite code | Name 1–60; exactly one owner | "Give the band a name." |
| `update_band` | admin | name, mark {initials / symbol / photo, colour, lettering}, city, region, country, genres, description, links | band | Mark colour from the 8; visibility stays private (public later) | — |
| `band_preview_by_code` | anyone signed in | code | band name, mark, member first names, song count | Active code only; reveals nothing else; rate-limited | "That code isn't valid any more. Ask for a new link." |
| `join_band` | self | code | membership (member) | Must have previewed (client); active code; not already a member | "You're already in ‹Band›." |
| `regenerate_invite_code` | admin | band | new code | Old code stops working immediately; members stay | — |
| `list_members` | member | band | name, photo, role, instruments, joined; **email only for admins/owner** | Uses `get_user_emails` rule | — |
| `set_member_role` | admin | member, admin/member | done | Can't change the owner's role here; can't demote yourself if you're the last admin besides the owner | "‹Band› needs at least one admin." |
| `remove_member` | admin | member | done | Can't remove the owner | "Transfer ownership before removing ‹name›." |
| `transfer_ownership` | owner | new owner (a member) | done | **One atomic step:** old owner → admin, new → owner; exactly one owner at all times | — |
| `leave_band` | member | band | done | **Owner must transfer first**; their band content stays with the band | "You own ‹Band›. Transfer it first." |
| `delete_band` | owner | band, typed name | band deleted (soft) | Typed name must match; owner only; members lose access; songs already copied into members' personal catalogs stay | "Type the band name to confirm." |

## 5. Friends

Existing today: `friend_requests`, `friendships`, `gen_friend_code`, `ensure_friend_code`, `resolve_friend_code`, `search_discoverable_users`, `are_friends`.

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `find_people` | self | name query | people (name, instruments, mutual count) | Only users with Findable on; never emails | "No one findable by that name. Ask for their code instead." |
| `resolve_friend_code` | self | code | person | — | "No one with that code yet." |
| `send_friend_request` | self | person | pending request | Respect their policy (everyone / friends of friends / code only); no duplicates | "‹Name› only accepts requests by code." |
| `respond_friend_request` | self (recipient) | request, accept/decline | friendship or nothing | — | — |
| `cancel_friend_request` | self (sender) | request | done | — | — |
| `remove_friend` | self | friend | done | — | — |
| `set_friend_privacy` | self | findable, who can send requests | done | — | — |

## 6. Songs

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_songs` | context | context, sort field + direction, filters (tuning), show hidden | songs with tuning, key, BPM, length, links, notes marks (band / mine / both), next-show flag | Hidden songs excluded unless asked; sort Title / Artist / Date added / Next show | — |
| `get_song` | context | song | facts, links, band note (+ last editor, when), my note, practice-log count | — | "This song was deleted." |
| `create_song` | context | title (required), artist, album, tuning, key, BPM, length, links; in a band: "also add to My Songs" | song (+ linked personal copy if asked) | Title required; link types tabs / audio / video / lyrics / cloud / link | "Add a title." |
| `update_song` | context | any song field | song | Linked personal copies follow the band version | — |
| `duplicate_song` | context | song | new song "‹title› (copy)" | Copies facts, links and chart, not notes | — |
| `delete_song` | context | song | done | Confirm text comes from `song_usage`; removes it from setlists in this context; shows keep their own set copies | — |
| `song_usage` (**Used in**) | context | song | setlists (with position), shows whose set copy contains it, upcoming practices | Same context only | — |
| `hide_song` / `unhide_song` | self | song | done | Per user | — |
| `spotify_lookup` | self | title query | up to 3 matches (title, artist, album, length, link) | Exists: `spotify-search` edge function | "Couldn't reach Spotify. Fill it in by hand." |
| `band_songs_not_in_my_catalog` | self | — | songs across the user's bands with no linked personal copy | — | — |
| `copy_band_songs_to_personal` | self | song ids or "all" | linked personal copies | Never band → band; skip ones already linked | — |
| `copy_personal_song_to_band` | member | song, band | band song | Personal → band only; the personal song keeps its link | — |
| `set_band_note` | member | song, Markdown | note + last editor + time | One shared note per song | — |
| `set_my_note` | self | song, Markdown | note | Private to the user | — |
| `list_practice_log` | member | song | entries (who, when, session, text), newest first | `song_note_entries` | — |
| `add_practice_log_entry` | member | song, text, optional practice / show | entry | — | — |

## 7. Charts

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `get_chart` | context | song | ChordPro text, starting note, last editor | — | — |
| `save_chart` | context | song, text (ChordPro or chords-over-lyrics), starting note | chart | Store ChordPro (convert chords-over-lyrics on save, `CHART-DATA-MODEL.md`); size cap ~200 KB; version check | "That's too long for one chart." |
| `set_starting_note` | context | song, MIDI note | done | 0–127 | — |
| `save_song_bpm` (from the metronome) | context | song, BPM | done | 20–300 | — |

Transpose and text size are view state (preferences), never stored on the song.

## 8. Tunings

Existing today: `tunings` table, `builtin_tuning_slug`, `tunings_lock_ownership`.

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_tunings` | context | — | built-ins (pitch order) + this context's custom tunings | Colours per DECISIONS Part A · 1 | — |
| `create_tuning` | context | name, instrument (guitar / bass), string count (6/7, 4/5), pitches, colour | tuning | **Unique by notes** within the context and against built-ins; per-string range −12…+7 semitones from standard | "That's ‹Drop D›. It's already in your tunings." |
| `update_tuning` / `delete_tuning` | context | tuning | done | Built-ins read-only; deleting one in use leaves songs showing its name in grey (Unknown) | "Used by 4 songs. They'll show it as Unknown." (confirm) |

## 9. Setlists

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_setlists` | context | sort (next show / name / updated) | name, attached show, counts | No statuses | — |
| `create_setlist` | context | name (default "New setlist") | empty setlist | — | — |
| `rename_setlist` | context | setlist, name | done | 1–80 chars | — |
| `duplicate_setlist` | context | setlist | copy, **not attached to a show** | Copies items, breaks, sections, per-set notes | — |
| `delete_setlist` | context | setlist | done | Songs stay in the catalog; shows keep their own set copy | — |
| `add_songs_to_setlist` | context | setlist, songs, position | items | In a band, a personal song is first copied into the band ("From my songs") | "‹Song› is already in this set." |
| `insert_break` | context | setlist, after item, minutes (default 15), note | item | 5–60 min | — |
| `insert_section` | context | setlist, after item, label | item | — | — |
| `update_item` | context | item, break minutes / note / section label / per-set song note | item | Per-set note attaches to the item, not the song | — |
| `move_item` | context | item, new position | ordered items | Saves as you go | — |
| `remove_item` | context | item | done | Catalog and show copies untouched | — |
| `set_setlist_notes` | context | setlist, Markdown | done | — | — |

## 10. Calendar: shows

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_calendar` | context | type filter (all / show / practice / jam), range | shows, practices, jams merged, soonest first, with type, status, confirmed | Jams from the Events tables (Part A · 2) | — |
| `create_show` | member | — (blank) or any show field | draft show | A draft with no name and no venue can be discarded silently | — |
| `update_show` | member | name, venue, address, date, start, load-in, soundcheck, set length, pay, contacts, notes | show | Times in the venue's local time (use the date helpers); pay ≥ 0 | — |
| `set_show_confirmed` | member | show, bool | done | Independent of `status` (Part A · 6) | — |
| `cancel_show` / `uncancel_show` | member | show | done | Keeps the record; Undo restores the previous `status`, `confirmed` untouched | — |
| `delete_show` | member | show | done | Deletes its set copy, contacts and RSVPs; **never** the source setlist | — |
| `attach_set_to_show` | member | show, setlist | the show's set (a copy) | Copy items; record source + copied date ("Copied from ‹Fall Set› · Oct 28"); the source is never changed | "This setlist is empty." |
| `recopy_show_set` | member | show | the show's set, replaced | Replaces the copy from the same source; confirm if the copy was edited | "‹Fall Set› was deleted. The show keeps its copy." |
| `create_show_set` | member | show | an empty set attached to the show | — | — |

## 11. Calendar: practices

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `create_practice` | member | name (optional), date, start, end (stored as duration), place, focus, songs | practice | End after start; past midnight allowed; ≤ 24 h | "End has to be after the start." |
| `duplicate_practice` | member | practice | prefilled draft (+7 days, same songs, focus, place) | Not saved until the user saves | — |
| `update_practice` / `delete_practice` | member | fields / practice | practice / done | Status comes from time, never stored | — |
| `set_practice_songs` | member | practice, ordered songs with per-practice notes | done | — | — |
| `start_session` | member | practice | session (started at) | One active session per practice | "A session is already running for this practice." |
| `record_session_progress` | member | session, song, reached / skipped, time on song | done | — | — |
| `end_session` | member | session, wrap-up notes | saved: time played, songs reached, skipped, notes | Wrap-up notes are shared with the band | — |

Practice history (`list_practice_history`, song "last practised") is **deferred** (Part A · 8); the data above is still recorded.

## 12. Attendance (RSVP) · drawn now, ships after launch

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `set_rsvp` | member | show or practice, going / maybe / can't | done | One answer per person per item | — |
| `list_rsvps` | member | show or practice | who's going / maybe / can't | — | — |

## 13. Jams (Part A · 2: built on the Events tables)

Existing today: `events`, `event_participants`, `event_lineup_items`, `event_lineup_requests`, `event_hands`; `join_event_by_code`, `gen_event_code`, `is_event_manager`, `is_event_participant`, `event_auto_approve`, `event_allows_suggestions`, `on_event_request_approved`, `on_event_hand_autoapprove`. The 0.3 `jam_*` tables and `join_jam_session` retire with their screens.

**Setting up (host)**

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `create_jam` | self | name, date, start, where (optional) | jam (planned), join code, link | Two fields required; code generated; caller is host | "Give the jam a name." |
| `update_jam` | host | name, date, start, where | jam | Only the host edits the jam itself; co-hosts run it | — |
| `set_jam_settings` | host | who can join (code / friends), requests on, approve myself, group size (0, 1–5) | done | Group size is a suggestion only, never blocks a single-song pitch | — |
| `add_cohost` / `remove_cohost` | host | participant | done | Exists (0.4.3) | — |
| `delete_jam` | host | jam | done | Planned jams only; a live jam must be ended first | "End the jam first." |

**Joining**

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `jam_preview_by_code` | anyone | exact code | name, when, where, host first name, people count | Exact code only (no search); rate-limited per IP | "No jam with that code. Check the letters, or ask the host." |
| `join_jam` | self (account) | code, parts I play, songs I share (optional source) | participant | Respects "who can join" and **lock joining** | "This jam isn't taking new people right now." |
| `join_jam_as_web_guest` | anyone | code, first name (≤ 40), parts | **guest token** scoped to this jam + participant | Token valid only for this jam, only until it ends; rate-limited per IP; respects lock joining and who-can-join = code | "This jam isn't taking new people right now." |
| `add_walkup` | host | name, parts, optional song | participant (via walk-up), optional pitch | Written as the host; no account | — |
| `kiosk_sign_up` | host (kiosk mode on the host's device) | name, parts, optional pitch to raise a hand on | participant (via kiosk), optional hand | Written as the host | — |
| `leave_jam` | participant, web guest | — | done | Removes their hands; their pitches stay unless no one else is on them | — |

**Pitches, hands and the queue**

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `pitch_song` | participant, web guest | song (from a shared catalog or free text), artist, my part, parts needed | pitch (open, or pending if approval is on) | **Only while requests are open**; rate-limited; web guests: free-text title ≤ 80 | "The host has closed requests for now." |
| `approve_pitch` / `decline_pitch` | host | pitch | open / declined | — | — |
| `raise_hand` | participant, web guest | pitch, part(s) | hand(s) | Only on parts the pitch needs; one hand per person per part; **web guests only for themselves** | "That part's not needed in this song." |
| `lower_hand` | the hand's owner, host | hand | done | — | — |
| `list_pitches_ranked` | host, participant, web guest | — | pitches ranked by coverage (parts with at least one hand ÷ parts needed), then age | Same view for everyone; web guests see first names only | — |
| `who_knows_your_songs` | participant | — | people here who share songs with mine, and which | From catalogs each participant chose to share; never songs they didn't share | — |
| `queue_pitch` | host | pitch, position (default end) | queued item with a cast (first hand per part, or chosen) | — | — |
| `set_cast` | host | queued item, part, person (hand, house player or anyone here) | done | House players are flagged participants | — |
| `ask_the_room` | host | queued item, part | a nudge to everyone here who plays that part | Shown in-app (realtime), not push | — |
| `move_queue_item` / `make_up_next` | host | item, position | ordered queue | — | — |
| `skip_up_next` | host | item | moved down one | — | — |
| `set_queue_state` | host | item, played / left / removed | done | Removed goes back to pitches; nothing else is logged | — |
| `call_up` | host | item | it's on stage; the previous one becomes played | Works with open parts ("Call up anyway") | — |
| `mark_house_player` | host | participant, bool | done | — | — |
| `remove_person` | host | participant or web guest | done | Their hands and pitches go with them; a web guest's token is revoked | — |
| `close_requests` / `open_requests` | host | jam | done | — | — |
| `lock_joining` / `unlock_joining` | host | jam | done | Existing participants unaffected | — |

**Live and after**

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `go_live` | host | jam | status live | From planned only | — |
| `jam_tv_feed` | anyone with the code (TV / public view) | code | on stage, up next, looking-for-someone list, code | **First names and parts only**; nothing else | — |
| `end_jam` | host | jam | status ended | Clears queue and hands; **deletes walk-up, kiosk and web-guest names**; revokes guest tokens | — |
| `save_jam_as_setlist` | host | ended jam, context | a setlist of the songs played, in order | Songs not in the context's catalog are added (personal or band) | — |

**Casting** (existing 0.4 operations) stays as built, reachable only with the `CASTING` flag on.

## 14. Release notes

| Operation | Who may | Inputs | Result | Rules the server must enforce | Errors the user sees |
|---|---|---|---|---|---|
| `list_release_notes` | self | — | versions, dates, title, body; which are unseen | `release_notes` (exists) | — |
