# 11 · Build brief: Jam (Phase 7)

**Status: research, Nov 16 2026. Not decided yet.** The open questions at the end need answers before `/plan`.
**Nov 16: the plan order stands** — Jam stays Phase 7 (0.14.0), after 5 and 6; open question 1 (renumber) is
moot. The brief was written as if Jam were pulled ahead; its findings still hold, and there's no hard
dependency on 5 or 6 (see "Dependencies on Phases 5 and 6").

**Nov 19 refresh (Phases 5 and 6 built):**

- **`/j/:code` is taken** by band invites (Phase 6). Jam guests either share it or get another path (Q10).
- **Get started → "Got a jam code?"** exists at `/get-started/jam` (thin, calls `EventService.joinByCode`); Jam
  rebuilds it. The auth pages are restyled; the web guest's "Sign up free · Log in" uses them, with `returnTo`.
- **Delete account** hands a band's events to the band owner and deletes personal events (with their lineup,
  hands and participants). Guest rows with a nullable `user_id` must survive a host's deletion the same way.
- **Kit since Nov 16:** phone app bar `BackCrumb`, `MoreButton` (⋯ ends the line under the title), `DockAction`
  for a page's main phone action, `ConfirmDialog` with `typedConfirm`, `PersonAvatar` and personal colours
  (`user_profiles.personal_color`), band marks. Use them rather than drawing new ones.
- **Instruments** are an ordered list with no primary, so "Parts I play" can default to the first ones.
- Q1 (version) is moot: Jam is 0.14.0.

| Slice                              | What                                                                                                                                                            | Ships                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **7a** · Hub and plan              | Jam hub, Host a jam, the planned jam page (Lineup / Requests / People, access, settings), on the Events tables, behind `REDESIGN_JAM`                           | Commits on `redesign/integration`, version "in progress"            |
| **7b** · Live night                | Go live, host console (Up next, fill, call up, queue actions, walk-ups), app guests live (hands, pitches, who knows your songs), End, Save tonight as a setlist | Same release                                                        |
| **7c** · Guests without an account | Web guest at `/j/:code` with a jam-scoped token, bar TV, counter iPad, group sets, rate limits                                                                  | Same release                                                        |
| **7d** · Retire 0.3                | Remove `/jam` jam-session screens, their services, hooks, two edge functions and the co-participant song policy; stop writing `jam_*`                           | Same release (the drop of the `jam_*` tables waits for a later one) |

Precedent: Phase 3 landed as "3a (0.10.0 in progress)" then "3". Same here: one version, one migration file
amended in place across the slices, one `release_notes` row.

## Read first

- `docs/redesign/06-open-decisions.md` (option A) and `design/source/DECISIONS.md` → "Jam (locked Oct 31)",
  "Prototype review fixes (Nov 1)" (part picker), Part A · 1.6, 1.7, 1.9, 2.5, and **Part A · 2** (the guest-write rules).
- `design/OPERATIONS.md` §13 (the operation list this brief maps to functions).
- `docs/redesign/04-data.md` → "Jams — option A", `08-api-conventions.md`.
- Design, in this order:
  - `design/demo/Jam Night.html` (+ `jam-night.js`): run a whole night with **Open a guest window**. Its state model
    (people · pitches with `parts {part: [personIds]}`, `cast`, `state` · queue · stage) is the shape this brief maps to tables.
  - `design/demo/screens/Final Pass.html` FP 20–22: empty hub, **Host a jam (two fields)**, Jam settings. These
    supersede Jam Plan 2's long create form.
  - `screens/Jam Plan.html` (hub, planned, walk-up, Go live, guest, web, table tent, Calendar · Jams),
    `Jam Live.html` (share picker, who knows your songs, compare, pitch, coverage, quiet stage, web guest),
    `Jam Host.html` (Up next, fill, called up, back from playing, clear / hold, walk-up, lock screen),
    `Jam TV.html` (three rotating slides), `Jam Venue.html` (counter iPad, group sets).
  - Desktop: `demo/desktop-jam.js` (hub, planned split with Access + Settings side pane, host console split with
    Hands up / House players / Looking for someone, TV, kiosk).
- `design/PLATFORM-NOTES.md` rows: wake lock, full screen, kiosk, share sheet, QR, links, table tent print, live updates.
- `design/source/PARITY.md` rows 42–47: kiosk and TV are desktop / iPad only; the guest flow is phone / web only.

The prototypes are reference, not code. Rebuild with the kit (`src/components/ui/*`), the shared song row
(`components/songs/SongLine.tsx`), the shared Add songs drawer (`components/setlists/SongBrowser.tsx`), TanStack
Query hooks and `src/services/api/*` wrappers.

---

## Part 1 · Where things stand

Schema checked against the running local DB (`supabase_db_rock-on`, migrations through `20261111120000`) and the
files in `supabase/migrations/`. **The local DB is missing `20261118120000_redesign_phase_4.sql`**; it doesn't touch
the event tables, but run `supabase db reset` before building.

### 1.1 Two features today

|                               | 0.3 Jam sessions (Apr 2026)                                                                                                                                                          | 0.4 Events (Jul 2026)                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes                        | `/jam`, `/jam/:sessionId` (`JamSessionPage.tsx`, 1,081 lines); public `/jam/view/:shortCode` (`JamViewPage.tsx`, 578)                                                                | `/events` (`EventsPage.tsx`, 284), `/events/new` (`EventCreatePage.tsx`, 142), `/events/:eventId` (`EventDetailPage.tsx`, 1,528); share link `/events?join=CODE`                                                                                                                                                                                           |
| Components                    | `components/jam/*`: `JamInviteQR`, `JamMatchList`, `JamParticipantList`, `JamSessionCard`, `JamWatcherList`                                                                          | `components/events/InviteFriendsSheet`, `JoinEventForm`; `components/casting/*`: `CastAssignSheet`, `EventCastGrid`, `LineupCard`, `SongCastPanel`, `instrumentMeta`                                                                                                                                                                                       |
| Services / hooks              | `JamSessionService`, `useJamSession`, `useJamSessionMatches`, `useJamPresence` (anon Realtime Presence), `utils/songMatcher.ts`                                                      | `EventService`, `EventHandsService`, `CastingAssignmentService`, `useEvents` (useState + `useRealtimeTable`, **not** TanStack), `useCasting`                                                                                                                                                                                                               |
| Tables                        | `jam_sessions`, `jam_participants` (`shared_contexts jsonb`), `jam_song_matches`; `setlists.jam_session_id` FK                                                                       | `events`, `event_participants`, `event_lineup_items`, `event_lineup_requests`, `event_hands`; casting: `casting_assignments`, `casting_templates`, `band_roles`                                                                                                                                                                                            |
| Functions                     | `get_jam_session_by_code`, `join_jam_session`, `replace_jam_matches`, `is_jam_participant`, `are_jam_coparticipants`, `normalize_text` (also behind `songs.normalized_title/artist`) | `join_event_by_code`, `gen_event_code` (8 chars, `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), `set_event_short_code` trigger, `is_event_manager`, `is_event_participant`, `are_event_coparticipants`, `event_allows_suggestions`, `event_auto_approve`, `event_lineup_item_in_event`, `on_event_request_approved`, `on_event_hand_autoapprove`, `casting_*_ctx_ok` |
| Edge functions                | `jam-view` (anon, service_role), `jam-recompute` (JWT)                                                                                                                               | none                                                                                                                                                                                                                                                                                                                                                       |
| Policies outside their tables | `songs_select_jam_coparticipant` (co-participants read **all** of each other's personal songs), `users_select_jam_coparticipant`, `user_profiles_select_jam_coparticipant`           | `users_select_event_coparticipant`, `user_profiles_select_event_coparticipant`                                                                                                                                                                                                                                                                             |
| Live updates                  | `postgres_changes` on `jam_*` (in `supabase_realtime`) + Presence                                                                                                                    | `postgres_changes` on `event_participants`, `event_lineup_items`, `event_lineup_requests`, `event_hands`. **`events` itself is not in the publication**, and none of the event tables has an `audit_log` trigger                                                                                                                                           |
| Local rows                    | 587 `jam_sessions`, 0 `jam_song_matches`, 0 setlists with `jam_session_id`                                                                                                           | 58 `events` (all `scheduled`), 0 `casting_assignments`                                                                                                                                                                                                                                                                                                     |

Shell links today: Sidebar "Jam" → `/jam` (0.3) and Calendar `match` includes `/events`; More has both "Jam"
(`/jam`) and "Events" (`/events`); `BottomNavigation` lists both; Calendar `NEW_ROUTE.jam = '/events/new'` and
jam rows `to: /events/:id` (`domain/calendar.ts`); Home's upcoming jam rows → `/events/:id`; search
`SearchOverlay` jam → `/events/:id`; `AuthPages` "join event" path → `/events/:id`.

### 1.2 Screen by screen

| Today                                                                                                                                       | Becomes                                                                                                                                                   | Verdict                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `EventsPage` (hosting / invited cards, cast %, going count)                                                                                 | **Jam hub** `/jam` (Jam Plan 1, FP 20, desktop hub)                                                                                                       | **Replace.** Hosting · N and Invited · N lists, live hero; cast % goes (casting is flagged)                |
| `EventCreatePage` (form)                                                                                                                    | **Host a jam** `/jam/new` (FP 21: name, date + start, where optional)                                                                                     | **Replace**                                                                                                |
| `EventDetailPage` tabs Lineup / Requests / People / Access                                                                                  | **Planned jam** `/jam/:id`: Lineup / Requests / People segmented; Access + Settings in the desktop side pane, phone share icon + ⋯ → Jam settings (FP 22) | **Restyle and reshape.** Access tab becomes a card; visibility radio becomes Who can join (Code / Friends) |
| `EventDetailPage` add-song sheet (free title / artist / tuning / key)                                                                       | Lineup ends with `AddSongsRow` → `SongBrowser`; free-text pitch sheet for songs not in the catalog                                                        | **Replace with the shared drawer** (see 2.5)                                                               |
| `EventDetailPage` hand chips per part, `LineupCard`                                                                                         | Part chips on `SongLine` rows (`sub` slot), raise-hand part picker sheet (Jam Live 1b)                                                                    | **Restyle**                                                                                                |
| `EventDetailPage` RSVP, `InviteFriendsSheet`, co-host tier                                                                                  | People tab rows; row menu Make co-host / House player / Remove; Invite friends stays                                                                      | **Keep, restyle**                                                                                          |
| `EventDetailPage` cancel                                                                                                                    | Not drawn. OPERATIONS has `delete_jam` (planned only)                                                                                                     | **Ask** (Q9)                                                                                               |
| Casting: `EventCastGrid`, `CastAssignSheet`, `SongCastPanel`, cast-view toggle                                                              | Hidden behind `CASTING` (default off); data kept                                                                                                          | **Flag** (DECISIONS Part A · 9)                                                                            |
| `JoinEventForm` (Calendar "Join with a code")                                                                                               | Join with a code → **preview first** (`jam_preview_by_code`) → join with parts and shared songs (Jam Live 0)                                              | **Restyle + add preview**                                                                                  |
| —                                                                                                                                           | Host console `/jam/:id/live`, bar TV `/jam/:id/tv`, counter iPad `/jam/:id/kiosk`, web guest `/j/:code`                                                   | **New**                                                                                                    |
| `JamSessionPage` (create, join, common-songs list, confirm / dismiss matches, seed setlist, broadcast setlist, save as setlist, end dialog) | Gone. Common songs → "who knows your songs" + compare (Jam Live 1, 2). Save as setlist → "Save tonight as a setlist" on an ended jam                      | **Retire** (7d)                                                                                            |
| `JamViewPage` (anon view with code + view token, name entry, watcher count, sign-up CTA)                                                    | Web guest `/j/:code` (Jam Plan 11–12, Live 7)                                                                                                             | **Retire**; its sign-up CTA and "change name" idea carry over                                              |
| `useJamPresence` watcher list                                                                                                               | Not in the design                                                                                                                                         | **Retire**                                                                                                 |

### 1.3 Worth keeping from 0.3 that the design doesn't spell out

- **Song matching.** `normalize_text()` and the generated `songs.normalized_title` / `normalized_artist` make
  "who knows your songs" a plain SQL join. Keep them. The **fuzzy** matcher (`utils/songMatcher.ts`,
  `_shared/songMatcher.ts`, Levenshtein) has no SQL twin (`pg_trgm` isn't installed). Q6.
- **Confirm / dismiss a match** (host curates common songs). The design has no equivalent: matches are shown, not
  curated. Drop it.
- **Seed from a setlist.** Jam Plan 2 drew "Start from: a setlist"; FP 21 dropped it. `SongBrowser`'s "filter by
  setlist → Add all" covers it with no new UI.
- **Broadcast setlist to anonymous viewers.** Replaced by the web guest lineup.
- **Privacy lesson.** `songs_select_jam_coparticipant` lets co-participants read _all_ of each other's personal
  songs. The design promises matches only "from the songs each of you chose to share". The new read goes through
  a `SECURITY DEFINER` function over `shared_contexts`, and that policy is dropped in 7d.

### 1.4 Design gaps and conflicts found

| Gap                                                                                                                  | Where                                                                                                                                                                                                                                                        | Proposal                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jam Plan 2 (long create form) vs FP 21 (two fields)                                                                  | Jam Plan, Final Pass                                                                                                                                                                                                                                         | FP 21 wins (DECISIONS 1.9)                                                                                                                               |
| Who can join: "Anyone with the link / Invite only" (Jam Plan 2) vs "Code / Friends" (FP 22, desktop)                 |                                                                                                                                                                                                                                                              | Code / Friends. Q3 for storage                                                                                                                           |
| Codes drawn as `LUCK-42` (word + 2 digits)                                                                           | all jam screens                                                                                                                                                                                                                                              | Keep today's 8-char random codes. A mnemonic code is guessable, and it's the only secret for anonymous joins and the TV feed. Display as `ABCD-EFGH`. Q4 |
| **Group sets need a link between songs** ("Dana's group: Plush, Black, Everlong", "song 2 of 3")                     | Jam Venue 5–7, desktop queue                                                                                                                                                                                                                                 | 04-data only has `events.group_size`. Add `event_lineup_items.group_id`                                                                                  |
| Hands on a **pending** request (Jam Plan 4: "who's raised a hand"; Approve "puts it on the lineup with those hands") | Jam Plan 4                                                                                                                                                                                                                                                   | Today hands need a lineup item (`event_hands.event_lineup_item_id NOT NULL`). So a pitch must be a lineup item from the start. Q2                        |
| "Song requests" setting vs live "close requests"                                                                     | FP 22, OPERATIONS                                                                                                                                                                                                                                            | Same column, `events.allow_suggestions`                                                                                                                  |
| "Approve requests myself"                                                                                            | FP 22                                                                                                                                                                                                                                                        | `NOT events.auto_approve` (exists)                                                                                                                       |
| Order of the night for Save tonight / "called 12 min ago"                                                            | Host 4, DECISIONS Part A · 9                                                                                                                                                                                                                                 | Add `event_lineup_items.called_at`                                                                                                                       |
| "Jam list" (Jam Live 0b: a one-time offer to make one)                                                               | Jam Live                                                                                                                                                                                                                                                     | Not modelled anywhere. Q5                                                                                                                                |
| Lock-screen card with Call up (Host 6)                                                                               | Jam Host                                                                                                                                                                                                                                                     | Web can't draw on the lock screen. Native-only; note in PLATFORM-NOTES                                                                                   |
| Kiosk exit "hold the logo 3 s, host PIN"                                                                             | Jam Venue notes                                                                                                                                                                                                                                              | No PIN exists. Q8                                                                                                                                        |
| Kiosk "who you're with" (keep friends together)                                                                      | Jam Venue 2                                                                                                                                                                                                                                                  | Defer; it needs a people-group concept the design doesn't define                                                                                         |
| Go-live "reminder at start time"                                                                                     | Jam Plan 7                                                                                                                                                                                                                                                   | Push isn't in scope (05-plan). In-app only: the hub's planned row says "Starts now · Go live"                                                            |
| Parts vocabulary                                                                                                     | Jam Plan (Vocals, Guitar, Bass, Drums, Keys, Harmonica, Other); prototype (Vox, Gtr, Bass, Drums, Keys); `models/Casting.ts DEFAULT_LINEUP` keys `guitar, bass, drums, vox, keys, other`; profiles store labels (`Guitar, Vocals, Harmonica, Percussion, …`) | Store `DEFAULT_LINEUP` keys; map profile instruments to keys in `domain/jam.ts`; Harmonica / Percussion → `other` with a label. Q7                       |

---

## Part 2 · The target

### 2.1 Routes

| Route            | Auth                                          | What                                                                                                                                                                                                             | Design                                  |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/jam`           | signed in                                     | Hub: live hero ("Return to jam" / desktop "Return to console"), Hosting · N, Invited · N, Host a jam, Join with a code, one-line explainer; empty state                                                          | Jam Plan 1, FP 20, desktop hub          |
| `/jam/new`       | signed in                                     | Host a jam: Name, Date + Start (kit pickers), Where (optional), hint line. Create → `/jam/:id`                                                                                                                   | FP 21                                   |
| `/jam/:id`       | participant                                   | Planned jam (host: Lineup / Requests / People + Go live dock; guest: Lineup / My hands / Request). Live: guest "Tonight" view; host gets a "Open console" button. Ended: summary + **Save tonight as a setlist** | Jam Plan 3–10, Live 1–6                 |
| `/jam/:id/live`  | host / co-host                                | Host console                                                                                                                                                                                                     | Jam Host 1–5, Live 4–5, desktop console |
| `/jam/:id/tv`    | host's device, full screen                    | Bar TV (reads the anon feed, so it also works from `/j/:code/tv`)                                                                                                                                                | Jam TV, Venue 7                         |
| `/jam/:id/kiosk` | host session, full screen, outside the layout | Counter iPad                                                                                                                                                                                                     | Jam Venue 1–3                           |
| `/j/:code`       | **none**                                      | Web guest (arriving → in). Signed-in visitors get the app join (preview → parts → shared songs)                                                                                                                  | Jam Plan 11–12, Live 7                  |
| `/j/:code/tv`    | none                                          | Bar TV from a link or a cast                                                                                                                                                                                     | Jam TV                                  |

Redirects (behind `REDESIGN_JAM`, so the old pages come back with the flag off, as `REDESIGN_CALENDAR` did):
`/events` → `/jam`, `/events/new` → `/jam/new`, `/events/:id` → `/jam/:id`, **`/events?join=CODE` → `/j/CODE`**
(those links are in the wild), `/jam/view/:code` → `/j/:code` (a 0.3 code finds nothing: "That jam has ended").
After 7d, `/jam/:sessionId` with a 0.3 id shows the not-found state.

PLATFORM-NOTES suggested `/jam/<code>` for links; `/j/:code` matches the drawn URL (`rockon.band/j/LUCK-42`) and
can't collide with `/jam/:id`. Q10.

### 2.2 Shell, Calendar, Home, search

- **Sidebar** "Jam" → `/jam` (already points there); drop `/events` from Calendar's `match`. **More**: keep "Jam",
  remove "Events" (DECISIONS Part A · 9). `BottomNavigation`'s `/events` entry goes.
- **Calendar** (`pages/CalendarPage.tsx`, `domain/calendar.ts`): `NEW_ROUTE.jam` → `/jam/new`; `jamRow.to` →
  `/jam/:id`; a live jam's row shows a LIVE mark. **Join with a code** keeps its chip and opens the new
  preview-first join. Desktop: jams still navigate (no pane), as today. `AgendaJam.status` gets `'live'`.
- **Home** (`pages/HomePage.tsx`): Upcoming jam rows → `/jam/:id`; a **live jam you're in is a hero card** with
  Return (Jam Plan 14 caption: "A live jam also shows on Home").
- **Search** (`components/search/SearchOverlay.tsx`): `jam: id => /jam/${id}`. The search RPC's `jam_hits`
  (phase 1 migration) needs no change.
- **Get started** "Got a jam code?" (Phase 6's four paths): until then `AuthPages`' existing event-code join
  routes to `/jam/:id` instead of `/events/:id`.

### 2.3 Screens and states, desktop and phone

**Hub.** Phone: app bar + PageTitle "Jam", live hero, `Group` lists of jam rows (date block, name, "Lucky's · 8 PM ·
scheduled", "3 requests", TypeLabel JAM), two large buttons, explainer. Desktop: `PageTitle` with actions
Join with a code + Host a jam (primary), same lists. States: skeleton rows, `Empty` (FP 20: "No jams yet · Host one
in two fields…"), `RetryCard`.

**Host a jam.** Phone: full-screen editor route (Cancel / Create). Desktop: a page inside the layout (sidebar
kept, as `/songs/new`). Fields as FP 21; date / time with the Calendar's pickers; dates via `utils/dateHelpers`
(`parseDateInputAsLocal`, `formatDateForInput`), stored as `events.scheduled_date` + `timezone`.

**Planned jam (host).** Kicker "JAM · Tue, Nov 3 · 8 PM · Lucky's", display title (edit in place, like the show
page), code line "CODE ABCD-EFGH · 14 joined · 3 without the app".

- **Lineup**: `SongLine` rows with `lead` = grip + `LineNumber`, `sub` = part chips (filled: initial · name; open:
  outlined; yours: accent), "added by ‹name›", group label "song 2 of 3" when grouped. Drag to reorder (dnd-kit,
  as the setlist editor). Ends with `AddSongsRow`. Empty: "No one on the lineup yet · Share the code…".
- **Requests**: pending pitches: song, who asked, I'll play / looking for, hands; Approve / Decline. Chips
  "Approve myself" and "Requests open" toggle the settings. Empty: "No requests yet".
- **People**: avatar, name, parts, via (APP / WEB / WALK-UP / KIOSK), house mark; "14 ON THE APP · 3 WALK-UPS";
  Add walk-up (sheet: Name + PLAYS chips, Jam Plan 6); row menu Make co-host / House player / Remove…; Invite friends.
- **Access** (desktop side pane; phone share icon → sheet): QR (`qrcode.react`, already a lazy dep), code, link,
  Copy link (`navigator.share` on phones), **Print table tent** (print stylesheet, Jam Plan 13), Show on TV,
  Counter iPad.
- **Settings** (desktop side pane; phone ⋯ → Jam settings sheet, FP 22): Who can join (Code / Friends), Song
  requests, Approve requests myself, Suggest groups of N (0 = off, 1–5).
- **Go live**: phone dock button → sheet "Go live?" with the three counts (songs, hands, people), Not yet / Go
  live (Jam Plan 7). Desktop: header button, same confirm as a dialog.

**Planned jam (guest, app).** "You play Bass, Vocals · Change", segmented Lineup / My hands / Request; tap a part
chip or the hand → part picker sheet (multi-select, your open parts preselected, who's already up); Request =
song + artist + I'LL PLAY + LOOKING FOR chips (Jam Plan 10).

**Live (guest, app)** (Jam Live 1–3, 6). People who know your songs (counts), then songs the room can cover
sorted by coverage, "one player away" in yellow. Compare with a person (in common / only you / only them,
Pitch one together). Pitch a song (from your shared songs or free text) with parts. Nudged banner ("Plush needs
drums · I'm in"). Joining asks which songs to share (Jam Live 0): a band, all your songs, a setlist (and a jam list,
Q5).

**Host console** (Jam Host 1–5, Live 4–5). One quiet **On stage** line (song, group, "called 12 min ago", Mark
played). **Up next** card: group, songs, big part chips, "Open: Bass" with **From hands / House player / Ask the
room**, primary **Call up anyway** (or "Call them up" when full), × Skip. **After that · N**: rows with Next;
phone swipe right = up next, left = Played / Left / Remove with Undo, hold = the same menu, a one-time peek and
hint line; desktop hover actions, right-click menu, drag. Pitches ranked by coverage (Live 4). Quiet-stage card
(Live 5) after N minutes without a pitch or call, or on tap. Walk-up (Host 5: name + part, Call up now / Add after
next). Desktop side pane: Hands up · N (Add), House players, Looking for someone. Header: Walk-up, Show on TV,
End jam. Stage screen: 64 px targets, wake lock (copy `PracticeSessionPage`'s `navigator.wakeLock` block).

**Ended.** "Ended · N songs played"; **Save tonight as a setlist** (pick context, then opens the new set);
nothing to log.

**Web guest** (`/j/:code`, phone width on any screen). Arriving: kicker, title, "Let the host know you're here",
Your name, parts chips (or Just listening), **I'm here**. In: "You're Dana · Bass · Change", lineup / pitches with
hands, Request a song, quiet "Get the app… Sign up free · Log in". Errors: wrong code ("No jam with that code.
Check the letters, or ask the host."), locked, ended ("This jam has ended. Thanks for playing."), removed.

**Bar TV** (1920×1080, dark): top bar LIVE · name · venue · slide dots; slides On stage / Looking for someone /
Come play rotate every 9 s and drop out when empty; QR + code panel on every slide; "Or just tell the host";
group on stage shows its songs with the current one outlined. First names and parts only. Full screen from a
button; wake lock.

**Counter iPad** (landscape, 60–80 px targets): left, songs one player away; right, first name + parts → raise a
hand on songs that fit (needs first) or request one → big confirmation, clears after 10 s, "Add another". Exit
behind a host action (Q8).

### 2.4 Kit and shared pieces

Reuse: `Button`, `IconButton`, `Chip`, `Switch`, `Segmented`, `Group` / `ListRow`, `Sheet` / `SheetItem`,
`SkeletonRow` / `RetryCard` / `Empty`, `PageTitle`, `TypeLabel` (`jam`), `BandMark`, `useConfirm` +
`ConfirmDialog`, `useToast`, `useLongPress`, `useDragAndDrop`, `useResponsive`.

New, each with one job:

- `components/jam/PartChip.tsx` (+ `PartChips`): filled / open / mine / looking-for (violet, the JAM colour) /
  big (console). Colours from `INSTRUMENT_COLOR` (`utils/tokens.ts`) via `casting/instrumentMeta.ts` (move it to
  `components/jam/` if casting stays flagged).
- `components/jam/PartPicker.tsx`: the multi-select chip grid used by walk-up, join, request, raise-hand, kiosk.
- `components/jam/CoverageBar.tsx`: "3/4" plus pips.
- `components/jam/JamQr.tsx`: replaces `jam/JamInviteQR.tsx`.
- `domain/jam.ts` (pure, unit-tested, Dart-portable): status mapping, open parts, coverage, "one player away",
  up next (first `queued` by position), cast for display, part key ↔ label ↔ profile instrument, group label
  "song 2 of 3", TV slide selection, quiet-stage timer.

### 2.5 Song rows and Add songs: same as everywhere

- **Every song list in Jam is a `SongLine`** (lineup, requests, pitches, queue group songs, compare lists, "who
  knows your songs" detail, kiosk song list). Lineup items map to `SongLineData` from `display_title`,
  `display_artist`, `tuning`, `key`, `seconds: 0` (a `toLineupSongLine` helper in `domain/jam.ts`). Part chips
  go in `sub`, coverage in `trail`. The TV is the one exception (bar-distance type).
- **Host adds songs with `SongBrowser`**, unchanged in behaviour: catalog of the jam's context (band or
  personal, plus "From my songs"), filter by another setlist + Add all, tuning chips; `onAdd(songIds)` calls
  `add_lineup_songs`, `onRemove` removes an `open` item. Two small, general additions (both fit setlists too):
  1. an optional `partsNeeded` default the caller applies (no UI in the drawer), and
  2. **an optional "Add ‹query› as a title" row when the search has no match** (`onAddTitle?(title)`), because
     a jam lineup often has songs nobody's catalogued. Q11.
- Guests pitching from their catalog use the same `SongLine` rows in a single-pick sheet over their **shared**
  songs; a web guest pitches free text only (title ≤ 80, artist).

---

## Part 3 · Data and API

### 3.1 The 05-plan migration list, checked

| 05-plan item                                | Today                                                                                                        | Change (in `supabase/migrations/<ts>_redesign_phase_7.sql`, `<ts>` after `20261118120000`)                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `live` status                               | `events.status` CHECK scheduled / confirmed / completed / cancelled                                          | Drop + re-add `events_status_check` with `'live'`. UI: scheduled / confirmed = planned, completed = ended                                                                                                                                                                                                                                                          |
| `group_size`                                | missing                                                                                                      | `events.group_size SMALLINT NOT NULL DEFAULT 0 CHECK (group_size BETWEEN 0 AND 5)`                                                                                                                                                                                                                                                                                 |
| `joining_locked`                            | missing                                                                                                      | `events.joining_locked BOOLEAN NOT NULL DEFAULT false`                                                                                                                                                                                                                                                                                                             |
| (who can join)                              | `events.visibility` private / unlisted / public, **ignored by `join_event_by_code`**                         | Q3: recommended new `events.who_can_join TEXT NOT NULL DEFAULT 'code' CHECK (IN ('code','friends'))`, leaving `visibility` alone                                                                                                                                                                                                                                   |
| (requests on / approve)                     | `events.allow_suggestions`, `events.auto_approve`                                                            | exists, no change                                                                                                                                                                                                                                                                                                                                                  |
| nullable `user_id` on participants          | `event_participants.user_id NOT NULL`, UNIQUE `(event_id, user_id)`                                          | `DROP NOT NULL`; the unique stays (NULLs don't collide)                                                                                                                                                                                                                                                                                                            |
| `guest_name` / `via` / `is_house` / `parts` | missing                                                                                                      | `guest_name TEXT CHECK (char_length(guest_name) BETWEEN 1 AND 40)`, `via TEXT NOT NULL DEFAULT 'app' CHECK (IN ('app','web','walkup','kiosk'))`, `is_house BOOLEAN NOT NULL DEFAULT false`, `parts TEXT[] NOT NULL DEFAULT '{}'`; CHECK `user_id IS NOT NULL OR guest_name IS NOT NULL`                                                                            |
| `shared_contexts`                           | only on `jam_participants` (jsonb)                                                                           | `event_participants.shared_contexts JSONB NOT NULL DEFAULT '[]'` of `{type: 'personal'\|'band'\|'setlist', id}` (UUID[] can't say which kind)                                                                                                                                                                                                                      |
| `event_guest_tokens`                        | missing                                                                                                      | **New table** `(token_hash BYTEA PRIMARY KEY, event_id UUID NOT NULL → events ON DELETE CASCADE, participant_id UUID NOT NULL → event_participants ON DELETE CASCADE, created_at, revoked_at)`; RLS on with **no policies** (functions only); GRANTs to `authenticated` and `service_role` (CLAUDE.md; the lint requires them, RLS still denies)                   |
| lineup `state`                              | missing                                                                                                      | `event_lineup_items.state TEXT NOT NULL DEFAULT 'open' CHECK (IN ('pending','open','queued','stage','played','left','removed'))`. **Up next is derived** (first `queued` by `position`), never stored, so there can't be two                                                                                                                                       |
| lineup `parts_needed`                       | missing (requests have `parts` = what the requester offers)                                                  | `event_lineup_items.parts_needed TEXT[] NOT NULL DEFAULT '{vox,guitar,bass,drums}'` (Q7)                                                                                                                                                                                                                                                                           |
| `pitched_by_participant`                    | `event_lineup_requests.requester_id UUID NOT NULL → users`                                                   | `event_lineup_items.pitched_by UUID → event_participants ON DELETE SET NULL` (so played songs survive `end_jam`)                                                                                                                                                                                                                                                   |
| hands by participant                        | `event_hands.user_id NOT NULL`, UNIQUE `(event_lineup_item_id, role_key, user_id)`, `user_name` denormalised | Add `participant_id UUID → event_participants ON DELETE CASCADE`; backfill from `(event_id, user_id)`; `user_id DROP NOT NULL`; new UNIQUE `(event_lineup_item_id, role_key, participant_id)`; a BEFORE INSERT trigger fills `participant_id` from `user_id` so the flagged legacy casting UI keeps working                                                        |
| — (**gap**) group sets                      | —                                                                                                            | `event_lineup_items.group_id UUID` (same value = one set, ordered by `position`)                                                                                                                                                                                                                                                                                   |
| — (**gap**) order of the night              | —                                                                                                            | `event_lineup_items.called_at TIMESTAMPTZ` (set by `call_up`)                                                                                                                                                                                                                                                                                                      |
| — rate limits                               | none anywhere                                                                                                | **New table** `jam_rate_limits (bucket TEXT, key TEXT, window_start TIMESTAMPTZ, hits INT, PRIMARY KEY (bucket, key, window_start))`, RLS on, no policies, GRANTs as above; old windows pruned by the check itself                                                                                                                                                 |
| Live updates                                | `postgres_changes` (RLS-filtered: anon gets nothing; `events` not published)                                 | AFTER triggers on `events` and the four `event_*` tables call `realtime.send(jsonb_build_object('at', now()), 'changed', 'jam:' \|\| short_code, false)` (available locally). Every client (app, web guest, TV, kiosk) listens to `jam:<code>` and refetches its read, debounced; a 20 s poll is the fallback. Ask the room uses the same topic with event `nudge` |

Backfill for today's events (they "show up as Jams"): lineup items get `state = 'open'`; pending requests become
items with `state = 'pending'` plus their offered `parts` as hands (Q2); `event_hands.participant_id` from
participants. Fields stay as they are: `visibility`, `view_token`, `setlist_id`, `calendar_uid`, `description`,
`location`, `end_time` (shown as "1:42 LEFT" when set).

Concurrency: queue writes come from host + co-hosts at once. Each queue function locks the jam row
(`SELECT … FROM events WHERE id = p_event FOR UPDATE`) rather than taking `p_expected_version` (lineup items have
no `version`). `update_jam` takes `p_expected_version` (events has `version`).

### 3.2 Functions (all `SECURITY DEFINER`, `SET search_path = public`, `p_` params, `RAISE … MESSAGE = key, HINT = copy`)

One contract for the app, the web guest and Flutter. **Participant-facing writes take an optional
`p_guest_token TEXT DEFAULT NULL`.** A shared helper `_jam_actor(p_event, p_guest_token)` resolves the caller to
a participant: through `auth.uid()`, or through `digest(p_guest_token, 'sha256')` (pgcrypto) on a token that's
not revoked, for this event, whose jam isn't ended or cancelled. Otherwise it raises `forbidden`. The same
function then serves both callers, and the anon grant is safe because the token is the only key.

| Function                                                                                                                 | Grant                   | Notes / error keys                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_jam(p_name, p_at, p_timezone, p_where, p_band_id)`                                                               | authenticated           | Caller becomes host participant (today's `EventService.createEvent` does two client writes: move behind the API). `name_required`                                                                                                                                                                     |
| `update_jam(p_event, p_patch, p_expected_version)`                                                                       | authenticated           | Host only (not co-hosts). `stale_version`                                                                                                                                                                                                                                                             |
| `set_jam_settings(p_event, p_who_can_join, p_requests_open, p_approve_myself, p_group_size)`                             | authenticated           | Host                                                                                                                                                                                                                                                                                                  |
| `set_cohost(p_event, p_participant, p_on)`                                                                               | authenticated           | Host. Replaces the client-side `setParticipantTier`                                                                                                                                                                                                                                                   |
| `delete_jam(p_event)`                                                                                                    | authenticated           | Planned only. `end_jam_first`                                                                                                                                                                                                                                                                         |
| `jam_preview_by_code(p_code)`                                                                                            | **anon**, authenticated | name, when, where, host first name, people count. Rate-limited per IP. `no_jam`, `rate_limited`                                                                                                                                                                                                       |
| `join_jam(p_code, p_parts, p_shared_contexts)`                                                                           | authenticated           | Replaces `join_event_by_code` (keep that one until the flag goes). Respects `who_can_join` (friends via `are_friends` or bandmates of `band_id`) and `joining_locked`. `not_taking_people`                                                                                                            |
| `join_jam_as_web_guest(p_code, p_name, p_parts)`                                                                         | **anon**, authenticated | Returns `{participant_id, token}`; token = 32 random bytes, base64url, **returned once, only the hash stored**. Name trimmed 1–40, parts from the vocabulary. Rate-limited per IP. `not_taking_people`, `name_required`, `rate_limited`                                                               |
| `update_me(p_event, p_name, p_parts, p_shared_contexts, p_guest_token)`                                                  | anon, authenticated     | Own row only                                                                                                                                                                                                                                                                                          |
| `leave_jam(p_event, p_guest_token)`                                                                                      | anon, authenticated     | Removes own hands; own pitches stay unless no one else has a hand on them; revokes own token                                                                                                                                                                                                          |
| `add_walkup(p_event, p_name, p_parts, p_via 'walkup'\|'kiosk', p_item, p_pitch_title, p_pitch_artist)`                   | authenticated           | Host / co-host. Kiosk = the same call from the kiosk screen. Optional hand or pitch in the same transaction                                                                                                                                                                                           |
| `add_lineup_songs(p_event, p_song_ids, p_parts_needed)` / `add_lineup_title(p_event, p_title, p_artist, p_parts_needed)` | authenticated           | Host. Copies display fields from `songs`                                                                                                                                                                                                                                                              |
| `pitch_song(p_event, p_song_id, p_title, p_artist, p_my_parts, p_parts_needed, p_group_id, p_guest_token)`               | anon, authenticated     | `pending` if approval on, else `open`; pitcher's hands raised in the same call. Guests: free text only, title ≤ 80. Rate-limited per participant + IP. `requests_closed`, `rate_limited`                                                                                                              |
| `approve_pitch` / `decline_pitch(p_item)`                                                                                | authenticated           | Host. Declined = `removed`                                                                                                                                                                                                                                                                            |
| `raise_hand(p_item, p_parts, p_guest_token)` / `lower_hand(p_hand, p_guest_token)`                                       | anon, authenticated     | Only parts in `parts_needed`; one per person per part; own hands only (host may lower any). `part_not_needed`, `rate_limited`                                                                                                                                                                         |
| `jam_state(p_event, p_guest_token)`                                                                                      | anon, authenticated     | **The one read** for planned page, guest views, kiosk and console: jam, me, people (guests see first names + parts only), items with hands, cast, state, `rank` (coverage = parts with ≥ 1 hand ÷ parts needed, then age), stage, queue. Replaces the five `EventService` / `EventHandsService` reads |
| `who_knows_your_songs(p_event)`                                                                                          | authenticated           | People here who share songs with mine, with counts and titles; joins `normalized_title` + `normalized_artist` over each side's `shared_contexts` only. Compare = the same function with `p_other`                                                                                                     |
| `queue_pitch(p_item, p_position)` / `move_queue_item` / `make_up_next` / `skip_up_next`                                  | authenticated           | Host / co-host                                                                                                                                                                                                                                                                                        |
| `set_cast(p_item, p_part, p_participant)`                                                                                | authenticated           | Marks that hand `accepted` (creates one for house players / anyone here). Casting tables untouched                                                                                                                                                                                                    |
| `ask_the_room(p_item, p_part)`                                                                                           | authenticated           | `realtime.send` `nudge` {item, part}; clients show it to people whose `parts` include it. No table, no push                                                                                                                                                                                           |
| `call_up(p_item)`                                                                                                        | authenticated           | Item → `stage`, `called_at = now()`; previous `stage` → `played`. Returns both so Undo can restore. Works with open parts                                                                                                                                                                             |
| `set_queue_state(p_item, p_state)`                                                                                       | authenticated           | played / left / removed / back to open (Undo)                                                                                                                                                                                                                                                         |
| `mark_house_player(p_participant, p_on)` / `remove_person(p_participant)`                                                | authenticated           | Remove takes hands and their open / pending pitches with them, revokes the token                                                                                                                                                                                                                      |
| `lock_joining(p_event, p_on)`                                                                                            | authenticated           | Existing participants unaffected                                                                                                                                                                                                                                                                      |
| `go_live(p_event)`                                                                                                       | authenticated           | From scheduled / confirmed only. `not_planned`                                                                                                                                                                                                                                                        |
| `end_jam(p_event)`                                                                                                       | authenticated           | One transaction: `live` → `completed`; hands deleted; un-played items → `removed`; **participants with `via` in web / walkup / kiosk deleted** (cascades their hands and tokens; `pitched_by` nulls); remaining tokens revoked                                                                        |
| `save_jam_as_setlist(p_event, p_context_type, p_context_id)`                                                             | authenticated           | Host. `played` + `stage` items ordered by `called_at`; songs not in the context's catalog created there (personal or band, as `add_songs_to_setlist`'s "From my songs" rule); returns the setlist. Tags `{'jam'}`                                                                                     |
| `jam_tv_feed(p_code)`                                                                                                    | **anon**, authenticated | On stage, up next, looking-for list, code. `split_part(name, ' ', 1)` + parts only. Rate-limited per IP (generous; a TV polls)                                                                                                                                                                        |
| `_jam_rate_check(p_bucket, p_key, p_max, p_window)`                                                                      | none (internal)         | IP from `current_setting('request.headers', true)::json->>'x-forwarded-for'` (first hop). **Verify on prod** in 7c: local Kong and the hosted gateway set it differently                                                                                                                              |

Web wrappers: `src/services/api/jams.ts`, one thin function per row. Hooks: `hooks/useJam.ts` (TanStack,
`queryKeys.jam(id)` / `jamByCode(code)`, the `jam:<code>` subscription invalidates). The guest token lives in
`localStorage` under `rockon.jam.<code>`, **never in a URL**. `useEvents` stays for the Calendar until it
moves to the API (`list_calendar` in OPERATIONS §10 can wait).

### 3.3 Guest-token security rules (each one a pgTAP assertion)

1. `anon` can't select, insert, update or delete any `events`, `event_*`, `event_guest_tokens` or `jam_rate_limits` row directly (RLS; the default anon table grants stay but no policy is `TO anon`).
2. `jam_preview_by_code` / `join_jam_as_web_guest` / `jam_tv_feed` with a wrong code return `no_jam` and reveal nothing; a near-miss code gives the same answer.
3. The token row stores only `sha256`; the plaintext is never selectable.
4. A token works only for its own jam (a token from jam A on jam B → `forbidden`).
5. A revoked token, a removed guest's token, and any token after `end_jam` → `forbidden`.
6. A guest can raise / lower only **their own** hands, only on parts in `parts_needed`, once per part.
7. A guest pitch is refused while requests are closed; it lands `pending` when approval is on; title > 80 refused.
8. A guest can't call any host function (`queue_pitch`, `call_up`, `remove_person`, …) even with a valid token.
9. `join_jam_as_web_guest` refuses when `joining_locked`, when `who_can_join = 'friends'`, and when the jam is ended / cancelled.
10. `jam_state` with a guest token returns first names and parts only: no `user_id`, no emails, no songs outside the jam.
11. `end_jam` leaves no `guest_name` anywhere in the jam, no hands, no live tokens; played songs remain.
12. Rate limits: the N+1th join / pitch / hand in the window → `rate_limited`, per IP and per token.

### 3.4 Anonymous RPCs and the edge-function scripts

No new edge function is needed (08: edge functions are for third parties and secrets). Phase 7 opens the
**first anonymous-write surface** through Postgres functions; per decision 12 each guest-callable function
records its own rule (token check first, one-line comment) and pgTAP sweeps every `anon` grant. In 7d remove
`jam-view` and `jam-recompute` from `scripts/deploy-edge-functions.sh` (`AUTH_MODE`, `ALL_FUNCTIONS`) and
`scripts/smoke-edge-functions.sh`, and undeploy both from prod.

### 3.5 Retiring the 0.3 data

- **7d (this release):** stop writing. Remove routes `/jam/:sessionId`, `/jam/view/:shortCode` (redirect), the
  files in 1.1's 0.3 column, `e2e/jam/jam-*.spec.ts` (4 files), `tests/unit/utils/songMatcher.test.ts` if the
  fuzzy matcher goes (Q6). In the migration: `DROP POLICY IF EXISTS songs_select_jam_coparticipant ON songs`,
  `users_select_jam_coparticipant`, `user_profiles_select_jam_coparticipant`; `REVOKE EXECUTE` on
  `join_jam_session`, `get_jam_session_by_code`, `replace_jam_matches` from `authenticated`. Keep
  `normalize_text`. Update `supabase/tests/013-jam-sessions.test.sql` to assert the revokes, and
  `027-privacy-lockdown.test.sql` where it covers the jam policies.
- **A later release:** before dropping, read prod (read-only, `supabase migration list --linked` first per
  CLAUDE.md): `SELECT status, count(*), max(created_date) FROM jam_sessions GROUP BY 1` and
  `SELECT count(*) FROM setlists WHERE jam_session_id IS NOT NULL`. Saved sets keep their songs either way
  (`ON DELETE SET NULL`). Then drop `setlists.jam_session_id`, `jam_song_matches`, `jam_participants`,
  `jam_sessions`, the five 0.3 functions, and remove them from the realtime publication.

---

## Part 4 · Slices

All slices amend one migration and one CHANGELOG `[0.x.0]` section; the version bump and `release_notes` row
land in the first slice and are amended (Q1 for the number). Every slice: `just check`, `npm run lint:migrations`,
`npm run test:db`, both layouts at 390 and 1280, dark and light, band and Personal.

### 7a · Hub and planned jam on the Events tables

Scope:

- Migration: all of 3.1 except tokens / rate limits / tick (they can land now, unused, if simpler). Backfills.
- Functions: `create_jam`, `update_jam`, `set_jam_settings`, `set_cohost`, `delete_jam`, `jam_preview_by_code`,
  `join_jam`, `update_me`, `leave_jam`, `add_walkup`, `add_lineup_songs`, `add_lineup_title`, `pitch_song`,
  `approve_pitch`, `decline_pitch`, `raise_hand`, `lower_hand`, `jam_state`, `mark_house_player`, `remove_person`.
- Pages: `JamHubPage`, `JamNewPage`, `JamPage` (planned, host + guest). Kit pieces in 2.4. `SongBrowser`
  additions (2.5). Shell rewiring (2.2). Flags `REDESIGN_JAM` (on) and `CASTING` (off) in
  `config/featureFlags.ts`. Schema of record gets `events` / `event_*` / casting sections.
- Accept: the hub with live / hosting / invited / empty / error; Host a jam in two fields → planned page with code
  and QR; add songs through `SongBrowser`; a second signed-in user joins by code (preview first), raises hands on
  two parts, requests a song; host approves (hands carry over), adds a walk-up, makes a co-host; settings
  persist; `/events?join=CODE` lands on the join; Calendar New jam and Jams rows open the new pages; with
  `REDESIGN_JAM=false` the old Events pages are back.
- Tests: unit `domain/jam.test.ts` (coverage, open parts, up next, part mapping, group label, status map).
  pgTAP `034-jam-plan.test.sql` (each function: happy path, every error key, non-participant `forbidden`;
  backfill of an existing event). e2e `tests/e2e/jam/plan.spec.ts` (two contexts); replace
  `tests/e2e/events/create-and-join.spec.ts`.

### 7b · The live night (app users)

Scope: `go_live`, `queue_pitch`, `move_queue_item`, `make_up_next`, `skip_up_next`, `set_cast`, `ask_the_room`,
`call_up`, `set_queue_state`, `lock_joining`, `end_jam`, `save_jam_as_setlist`, `who_knows_your_songs`; the tick
triggers and `useJam` subscription. Pages: host console `/jam/:id/live` (phone swipes + hold menu + Undo;
desktop hover / right-click / drag + side pane), guest live view, share-songs picker on join, compare, pitch,
nudges, quiet stage, ended state.

- Accept: the 05-plan flow for app users: plan → share code → join → pitches and hands → Go live → Up next / fill
  from hands / house / ask the room → Call up anyway → queue actions with Undo → End → Save tonight as a setlist
  (songs in called order, missing ones added to the catalog). A second browser sees each change within 2 s
  without reload. Wake lock on the console.
- Tests: pgTAP `035-jam-live.test.sql` (state machine: only one `stage`; call_up moves the previous to played;
  co-host may run the queue, guest may not; `end_jam` clean-up; `who_knows_your_songs` never returns an unshared
  song). e2e `tests/e2e/jam/live.spec.ts` (host + guest contexts), plus a phone-viewport swipe test.

### 7c · Guests without an account, TV, counter iPad, group sets

Scope: `event_guest_tokens`, `join_jam_as_web_guest`, the `p_guest_token` path in every participant function,
`jam_rate_limits` + `_jam_rate_check`, `jam_tv_feed`; public routes `/j/:code`, `/j/:code/tv`; `/jam/:id/tv`,
`/jam/:id/kiosk`; group sets (setting, "Pitch a set", grouped queue, "song 2 of 3", TV group slide); table tent
print; the `anon` grant sweep in pgTAP (decision 12).

- Accept: the 05-plan acceptance in full: host signed in, guest in a **fresh browser with no account** joins
  from `/j/:code`, raises hands, pitches; kiosk entry and walk-up show in People with their via; the TV rotates
  and drops empty slides; End deletes the guest names and the guest window shows "This jam has ended". Rate
  limit verified against the hosted gateway's IP header.
- Tests: pgTAP `036-jam-guests.test.sql` = the twelve rules in 3.3. e2e `tests/e2e/jam/web-guest.spec.ts`
  (anonymous context), `tv.spec.ts`, `kiosk.spec.ts`.

### 7d · Retire 0.3

Scope: 3.5's "this release" list; Sidebar / More / BottomNavigation cleanup; `PLATFORM-NOTES.md` lock-screen
note; 03-screens and 05-plan updated.

- Accept: `grep -r "JamSession\|jam_sessions\|jam-view" src/ supabase/functions/` finds nothing; `/jam/view/X`
  redirects; the co-participant song policy is gone (pgTAP: a former co-participant can't read a personal song);
  smoke script passes with the two functions removed.
- Release (CLAUDE.md Phase 1): `package.json` bump, CHANGELOG `## [x.y.z]` with Database notes (new columns,
  two new tables, dropped policies, revoked 0.3 functions), `release_notes` upsert. Suggested title "Jam, in
  one place"; body "Plan a jam, share one code, and run the night from your phone. Guests can join from the web
  without an account."

---

## Dependencies on Phases 5 and 6

- **Phase 5 (Tools & chart): none.** No Tune or chart entry points are drawn in Jam. `REDESIGN_TOOLS` isn't read.
- **Phase 6 (Account, band, friends): soft, none blocking.**
  - "Parts I play" defaults from `user_profiles.instruments` (exists, a text array of labels). Phase 6 makes it
    an ordered list with no primary; Jam only reads it, so order doesn't matter yet.
  - Who can join = Friends uses `are_friends` and `friendships` (exist since 0.4). Invite friends reuses
    `events/InviteFriendsSheet.tsx` (Phase 6 restyles Friends, not this sheet).
  - Get started's "Got a jam code?" is a Phase 6 screen; until then the existing event-code join in `AuthPages`
    is repointed (2.2).
  - The web guest's "Sign up free · Log in" uses today's auth pages; Phase 6 restyles them.
- **Phase 1 / 4 touch points** (already built, edited here): Sidebar, More, BottomNavigation, Home, search
  overlay, Calendar and `domain/calendar.ts`.
- **Version numbers** shift if Jam ships before 5 and 6 (Q1).

---

## Open questions (each with a recommendation)

1. **Version.** 05-plan numbers Jam 0.14.0 after 5 (0.12.0) and 6 (0.13.0). _Recommend:_ ship Jam as **0.12.0**
   and renumber 5 → 0.13.0, 6 → 0.14.0 in 05-plan. Name the migration `redesign_phase_7` anyway.
2. **Is a pitch a lineup item from the start?** The design puts hands on pending requests. _Recommend yes:_ every
   pitch is an `event_lineup_items` row (`state = 'pending'` until approved); backfill today's pending requests;
   stop writing `event_lineup_requests` (drop it with the 0.3 tables later). The alternative (hands on requests)
   needs a second hands table.
3. **Who can join: where is it stored?** _Recommend_ a new `events.who_can_join` ('code' / 'friends') and leaving
   `visibility` as is. Reusing `visibility` would quietly change who can join today's 58+ `private` events.
4. **Code format.** The design draws `LUCK-42`. _Recommend_ keeping the 8-character random code (displayed
   `ABCD-EFGH`): it's the only secret for anonymous joins and the TV feed.
5. **"Jam list".** Jam Live 0b offers to make one. _Recommend:_ a personal setlist tagged `jam` (`setlists.tags`
   exists), offered once at join; shared as `{type: 'setlist', id}`. Or cut it for now and offer bands / all
   songs / a setlist.
6. **Fuzzy matching for "who knows your songs".** _Recommend_ exact match on `normalize_text` only (SQL, no
   extension), and delete the fuzzy matcher with 0.3. Revisit with `pg_trgm` if people miss matches.
7. **Parts.** _Recommend_ `DEFAULT_LINEUP` keys (`vox, guitar, bass, drums, keys, other`) everywhere; default
   `parts_needed` = vox, guitar, bass, drums; Harmonica / Percussion / anything else = `other` with the label
   shown. Per-jam custom parts later.
8. **Kiosk exit.** The design says "host PIN". _Recommend:_ the host sets a 4-digit PIN when starting kiosk mode,
   kept only in that device's `sessionStorage` (never on the server); hold the logo 3 s, enter the PIN. Plus
   PLATFORM-NOTES' Guided Access advice.
9. **Cancel a jam.** Events can be cancelled today; the design only has Delete (planned only). _Recommend:_ ⋯ →
   Delete jam for planned jams (confirm names the consequence); keep rendering existing `cancelled` jams struck
   through; no new Cancel.
10. **Public URL.** `/j/:code` is now band invites (Phase 6), and `/jam/:code` would collide with `/jam/:id`.
    _Recommend_ sharing `/j/:code`: the page asks the server what the code is (a band invite or a jam) and shows
    that preview; both code generators check the other table so a code is never both. Keeps the drawn
    `rockon.band/j/…`, and one link format to explain. TV stays `/j/:code/tv`. (Alternative: a separate prefix
    such as `/live/:code`.)
11. **`SongBrowser` free-text row.** _Recommend_ adding "Add ‹query› as a title" (shown only with no exact match,
    opt-in prop), so the jam lineup adds uncatalogued songs in the same drawer. Setlists don't turn it on.
12. **Where anonymous RPCs are recorded.** Answered by decision 12 below (in the code and pgTAP, no doc section).
13. **Casting with `CASTING` on.** Where does it show? _Recommend:_ a "Casting" item in the planned jam's ⋯
    that opens the old `EventDetailPage` lineup / cast view at `/jam/:id/casting`; nothing else. Old pages stay
    in the tree until both flags are retired.
14. **RSVP on jams.** `event_participants.rsvp` exists and the hub shows "Going". _Recommend:_ keep the data and
    the label; the Coming / Maybe / Can't control waits for Phase 8 so shows, practices and jams match.
15. **Scope cuts for v1.** _Recommend_ deferring: the lock-screen card (native), kiosk "who you're with", the
    compare screen's "Say hi" wave, and the go-live reminder. Keep everything else drawn.

## Risks

- **Anonymous writes are new here.** Any `SECURITY DEFINER` function granted to `anon` that forgets
  `_jam_actor` is a hole. Mitigation: every anon function's first line is `_jam_actor`; pgTAP 036 loops over
  `pg_proc` granted to `anon` and asserts each refuses a missing / foreign token.
- **Client IP behind the gateway** may not be what the local stack shows. Verify before relying on per-IP limits;
  per-token limits still hold.
- **Realtime broadcast from the database** (`realtime.send`) is new to this repo. If it misbehaves on prod, the
  20 s poll keeps every screen correct, just slower.
- **Legacy pages under the flag** write lineup items and hands with direct table calls. The `participant_id`
  fill trigger and the column defaults keep them working; one e2e run with `REDESIGN_JAM=false` proves it.
- **Size.** Four slices of new UI on stage-grade screens (swipes, drag, TV, kiosk). 7c is the biggest; it can
  split again (web guest first, then TV + kiosk + group sets).

## Decisions (Nov 20, answered one at a time)

2. **Pitches are pending lineup entries** (`state = 'pending'`), hands work on them. New jam setting **"Show song
   requests to everyone"** (default on) under an Advanced fold: off = pending entries visible only to the host
   and the pitcher. On probation: it's a column, so count how many jams turn it off and drop it if nobody does.
3. **One "Who can join" setting replaces visibility**, three levels: **Invite only** (not listed; host and
   co-hosts invite), **Friends** (listed in the host's friends' hub under a new "Friends' jams" section; friends
   tap Join; participants invite), **Anyone with the code** (default; code, link, QR, walk-ups, web guests,
   kiosk; participants invite). Codes only work in "Anyone"; elsewhere the code card is hidden and a typed code
   says "This jam is invite only". Participants invite friends from inside the jam (notification + hub), no
   code needed. The "58 private events" were local test data; no migration concern. Revisit once seen live.
4. **Codes: random 8 characters shown `ABCD-EFGH`** (no look-alikes), like band invites. QR, links and friend
   invites are the main ways in; `LUCK-42` is not used.
5. **Jam songs = a "jam" tag on your personal songs** (no Jam list setlist, no per-user tag table). Joining a jam
   shares from your personal catalog only. Tags belong to the song's context: a band song's tags are the band's,
   your My Songs copy has its own, and a song page shows only the tags of the context you're in. First jam join
   opens a setlist-style builder ("Songs you'd jam on") over My Songs with a ✓ per song; band songs you pick are
   copied to My Songs (existing Copy to My Songs, which keeps the link) and tagged there. Skippable; later a
   "Jam" toggle on the song page and a "Jam songs" filter on Songs. **Fix:** `songs.tags` is shown and edited in
   the UI but never saved (no column; RemoteRepository drops it). Phase 7 adds `songs.tags TEXT[]` and saves it.
6. **Matching: normalised exact match** on title + artist (lowercase; strip punctuation, apostrophes, a leading
   "the", bracketed extras like "(Live)"), in SQL. The 0.3 fuzzy matcher goes with 7d. **Later idea:** an
   alias table (alternate titles) built from the catalogue, by an LLM pass or MusicBrainz IDs; titles/artists
   only, no user links, covered by the privacy policy. Needs a legal check first.
7. **Parts: the host sets the jam's starting parts** at setup (picked from Vocals, Guitar, Bass, Drums, Keys,
   plus any custom part typed in, e.g. Harmonica; default Vox, Guitar, Bass, Drums; venues without keys leave it
   off). Every song starts with those. Per song the host can add a part to call out to the crowd (any of the
   list or custom). Hands are raised for a part; more hands than slots is fine ("Guitar 2", "Vocals 2"), and the
   host accepting a second guitar adds a second guitar slot. A part is stored as a key plus an optional label.
   "Parts I play" at join defaults from the profile's ordered instruments.
8. **Kiosk exit: a 4-digit PIN** set when kiosk starts, kept in that device's `sessionStorage` only; hold the
   logo 3 s, enter the PIN. Kiosk routes refuse non-kiosk actions. Hosts are pointed at iPad Guided Access for
   real lock-down (a web page can't block Home or closing the tab).
   **The kiosk never holds the host's login:** the host taps "Open counter iPad", which shows a QR for
   `rockon.band/kiosk#k=<token>` (token in the hash, so it stays out of server logs) and a short one-time pairing
   code (10 min) for typing in at `rockon.band/kiosk`. The iPad runs on a jam-scoped kiosk token (kiosk actions
   only) that dies when the jam ends.
9. **No Cancel.** Planned jams: ⋯ → Delete jam (confirm names what goes); joined people get a "‹Host› called off
   ‹Jam›" notification. Live and ended jams can't be deleted. Existing `cancelled` events keep rendering struck
   through.
10. **Shared `/j/:code`** for band invites and jams: the page asks the server what the code is and shows that
    preview; each code generator checks the other table so a code is never both. TV at `/j/:code/tv`. Get
    started keeps both rows, each accepting either kind. `/events?join=…` and `/jam/view/…` redirect to `/j/…`.
11. **Free-text "Add ‹query› as a title"** row in `SongBrowser` (opt-in prop; jam lineup only, not setlists).
    Plus, on any lineup song, a signed-in user gets one action matched against My Songs (normalised match, Q6):
    no match → **"Add to My Songs"** (creates the personal song with title / artist, tagged "jam"); a match
    without the tag → **"Add to jam songs"**; already tagged → shows as one of your jam songs. Web guests don't
    see it.
12. **No doc section for anonymous functions** (Nov 20: code is the source of truth). Each guest-callable
    function starts with the token check and a one-line comment saying what it allows; pgTAP sweeps every
    function granted to `anon` and asserts each refuses a missing / foreign token.
13. **Casting = hands + host accept**, one data model. The host can also put someone on a part directly (tap an
    open part, pick a person in the jam). The old separate cast grid goes with 0.3, but its overview comes back
    as a **Grid view** of the same data on the planned jam and the host console: songs × parts, each cell the
    accepted name, a hand count, or an empty gap (highlighted), tap a cell to fill it. Built as a reusable
    component. **Future "band director" tier** (e.g. School of Rock style groups that swap members per song):
    casting on band songs / setlists / shows reuses that grid; the band casting tables (`song_castings`,
    `casting_templates`, `song_assignments`, empty today) stay until then.
14. **RSVP waits for Phase 8.** Joining a jam counts as "Going"; keep the data and the label. Jams are mostly
    ad hoc, so RSVP isn't a priority.
15. **Cut from v1:** lock-screen card (native), kiosk "who you're with" (walk-ups sign in one at a time), the
    "Say hi" wave, the go-live reminder. Everything else drawn ships.
