# Workflow: Schedule a show

**Goal:** capture a gig with everything the band needs on the day (when, where, timings, contact, set), and see at a glance whether it's confirmed.

## Flow

1. **Start:** Calendar → **New** → Show, or Home → **Book show**. Band context only.
2. **Basics:** name, date, start time, venue.
3. **Gig details:** address, load-in time, soundcheck time, set length, pay, notes (Markdown).
4. **Contacts:** name, role, phone, email. Add several; tap to call or email.
5. **Set:**
   - Attach an existing setlist; it's **copied** in ("Copied from ‹Setlist›, ‹date›", with an option to re-copy).
   - Or **Create new setlist**, named after the show.
   - The show page shows the set read-only, with song count, total time and "52 of 45 min".
6. **Confirm:** tick **Confirmed** when the gig is locked in.
7. **Attendance:** the whole band is invited by default; members answer Going / Maybe / Can't. [Not built]
8. **It appears** on Home (next-show card with a countdown) and on the Calendar.

## Must

- Each field is editable in place on the show page.
- **Duplicate** from the calendar: copies details and contacts, lets you pick a setlist, then opens the new show.
- **Cancelled** toggle: the show stays on the calendar struck through. **Delete** is separate, for mistakes.
- Available offline (native) in the days before the show.

## Must not

- Statuses beyond Confirmed and Cancelled. "Past" is worked out from the date.
- Edits to the original setlist silently changing this show's set.

## Future

- [Future] Calendar sync (.ics, Google/Apple), with push for changes.
- [Future] Push when the set for an upcoming show changes.
- [Explore] Performance mode on stage, for solo and duo acts.
