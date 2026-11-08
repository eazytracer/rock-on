# Workflow: Plan & run a practice

**Goal:** everyone knows when, where and what you're working on; during practice the app shows the song, notes and what's next; afterwards you capture how it went.

## Plan

1. **Start:** Calendar → **New** → Practice, or Home → **Schedule practice**. Band context only.
2. **Basics:** optional title (falls back to the date), date, time, duration, location.
3. **Focus notes** (Markdown): "What to work on".
4. **Songs:**
   - Add from the song browser, or **add all from a setlist**.
   - Drag to reorder; add a note per song.
5. **Attendance:** the band is invited by default; Going / Maybe / Can't. [Not built]

## Run (practice session)

**Start practice session** opens a full-screen, song-by-song view.

- Song X of N, with a running timer.
- Big title; key, BPM, tuning and duration.
- Band notes, scrollable.
- **Up next**, with a **tuning-change alert** when the next song's tuning differs.
- Prev / Next / End; adjustable text size.
- Layouts for TV, tablet and phone. Desktop/TV behaviour is the reference and is well liked.
- Phone layout:
  - Portrait first; swipe between songs, with big Prev/Next buttons as well.
  - Sideways uses the tablet layout.
- Arrow keys and **Bluetooth page-turner pedals** move between songs; keep the screen awake.

## Wrap up

- Wrap-up notes (Markdown): "How did it go?"

## Must

- **Duplicate** from the calendar: copies details and songs, then opens the new practice.
- Status (upcoming / in progress / done) is worked out from the time; never set by hand.
- Available offline (native) before it starts.

## Must not

- Hide the session behind more than one tap from the practice page.
- Show controls that need precision during a session.

## Future

- [Future] Recurring practices, with calendar sync and a reminder that gets the band to fill in the songs to practise.
- [Future] A 5-point "how do I feel" rating per song per member, combined on setlist and show pages.
- [Explore] Practice as a calendar event type (`explorations/event-types.md`).
