# Rock On — Design Spec Overview

Usability specs for the redesign and the native mobile apps. They say what each
screen must and must not do. They are not about implementation, and they don't
cover styling, except where styling carries meaning.

## Markers

- **[Not built]** — required, but missing or faked in the current app. Design it properly.
- **[Future]** — not required now. Leave room for it; don't build it.
- **[Explore]** — undecided. Mock up options; see `explorations/`.

## What Rock On is

A band's shared workspace: the song catalog, setlists, practices and gigs, plus
live jams with other musicians. The current users are a working band; the
design must hold up for any band, from a duo to a School of Rock–sized group.

**Goals:** less admin between rehearsals; the right info at a glance at practice
and on stage; never lose a song, note or set the band has worked on.

## Users & roles

| Who         | Can                                                                       |
| ----------- | ------------------------------------------------------------------------- |
| Band owner  | Everything an admin can, plus transfer ownership and delete the band      |
| Band admin  | Manage members, invites and band info; see bandmates' emails              |
| Band member | Add, edit and delete all band content (songs, setlists, shows, practices) |
| No band     | Personal catalog, personal setlists, jams, events, friends                |

- Content isn't gated by role. Roles only control people and band settings.
- Non-admins see names, never emails.
- [Future] A band director role and casting, as Pro-plan features.

## Contexts

- You're always in exactly one context: **Personal** or **one band**. A switcher at the top changes it.
- Songs, setlists, shows and practices show only the current context. There are no Band/My tabs.
- Switching is instant and must not reload the app.
- Personal context has a view of **"Songs in my bands that aren't in my catalog"**, with copy all or pick some.
- Songs move from Personal → a band, and from a band → Personal as a linked copy. Never band → band.

## Navigation

- **Phone bottom bar:** Home · Songs · Setlists · Calendar · More.
- **More holds:** band card (→ Band Members), your profile, Jam, Events, Friends, Band Members, Settings, Help & feedback, Sign out.
- **Header:** context switcher; notifications bell with an unread badge.
- **Desktop/web:** same features and groups in a sidebar. Phone first, with full parity.

## Event model

Everything on the calendar is an **event** of a type. Each type uses shared
building blocks plus its own extras.

| Type                           | Building blocks                   | Own extras                                                              |
| ------------------------------ | --------------------------------- | ----------------------------------------------------------------------- |
| Show (gig)                     | Basics, Song list, Attendance     | Load-in, soundcheck, set length, pay, contacts, Confirmed ☑, Cancelled |
| Practice [Explore]             | Basics, Song list, Attendance     | Optional title, focus notes, wrap-up notes, session mode                |
| Jam night                      | Basics, Song list, Access, Guests | Requests, hand-raising, co-hosts                                        |
| Scheduled jam                  | Basics, Access, Guests            | Becomes a live jam: the host taps **Go live** at start time             |
| [Future] Open jam, tip jukebox | —                                 | —                                                                       |

- **Basics:** date, time, venue/location, notes.
- **Song list:** an attached setlist (shows copy it in, labelled "Copied from X") or a lineup.
- **Attendance:** the whole band is invited by default (you can untick people); RSVP is Going / Maybe / Can't.
- **Guests:** outsiders signing up to play. Jam types only; same RSVP control.
- **Access:** visibility (public / unlisted / private), join code, link, QR.
- **Casting:** who plays which part per song. Off by default; see `explorations/casting.md`.
- **Live jam phases:** _before_ (requests, volunteering) and _live_ (setlist, common songs).

## Rules on every screen

- **States:**
  - Every list has an empty state that says what to do next, with the action button.
  - Loading never blanks the page.
  - Errors say what failed and offer a retry.
- **Destructive actions:**
  - Confirm in an in-app dialog that names the consequence ("Used in 2 setlists").
  - Never use native alert/confirm dialogs.
- **Feedback:** short toasts confirm actions.
- **Live updates:** bandmates' changes arrive as gentle, grouped in-app banners ("3 changes by Mike"). They are never push notifications.
- **Lists:**
  - Search plus simple sort: name, newest, oldest, next show.
  - **View options** sit on the list itself, like a column picker. They're saved per list and per user, and follow you across devices.
- **Theme:** light and dark, following the system setting.
- **Offline (native):** the next show and next practice stay readable offline (setlist, notes, details, contacts). Editing needs a connection.
- **Cross-context links:** e.g. a notification from another band. Ask "Switch to ‹Band›?" before switching.

## Stage & practice realities

- It's read at a glance, from a music stand or the floor, often in a dark room. Use big type and high contrast.
- One hand, maybe while holding an instrument: big targets, swipe between songs.
- Bluetooth page-turner pedals must work; they send arrow keys.
- Keep the screen awake during practice sessions.
- Many bands still use a printed setlist. [Future] Export or print a setlist as a PDF.

## Meaningful colour — tunings

Every song shows its tuning as a colour plus a name. Keep these mappings so
bands' muscle memory carries over.

| Tuning          | Colour                     |
| --------------- | -------------------------- |
| Standard        | `#60a5fa`                  |
| Half-step down  | `#14b8a6`                  |
| Whole-step down | `#0ea5e9`                  |
| Drop D          | `#f97316`                  |
| Drop Db         | `#f59e0b`                  |
| Drop C          | `#ef4444`                  |
| Drop B          | `#a855f7`                  |
| Open G          | `#eab308`                  |
| Open D          | `#ec4899`                  |
| DADGAD          | `#10b981`                  |
| Custom tuning   | The colour the user picked |
| Unknown         | `#6b7280`                  |

The colour is never the only signal; the name is always available.

## Glossary

- **Catalog:** the songs in a context (Personal or a band).
- **Linked copy:** a band song added to My Songs; it follows the band version. See `explorations/song-versions.md`.
- **Setlist:** an ordered list of songs, **breaks** (a length plus notes) and **sections** (titled dividers).
- **Jam session:** a live, code-joined session that finds **common songs**, i.e. songs at least two participants know.
- **Part:** a role in a song (Lead guitar, Harmony vocals…). Used only by casting.
