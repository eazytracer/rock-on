---
title: Calendar Event Integration - Technical Research
created: 2026-04-24T17:04
status: Research Complete
description: Technical research on iCalendar (RFC 5545), library options, provider compatibility, native calendar APIs, timezone handling, and v2/v3 availability features (Calendly/Cal.com)
---

# Technical Research: Calendar Event Integration

This document supports `./spec.md`. It covers the technical choices
behind v1 (`.ics` attachments over Resend) and the deferred v2/v3 paths
(native calendar APIs, availability sharing).

## 1. iCalendar (RFC 5545) Crash Course

### 1.1 Why RFC 5545?

RFC 5545 — _Internet Calendaring and Scheduling Core Object
Specification (iCalendar)_ — defines the `.ics` text format that
every mainstream calendar app understands. Built on RFCs 2445/2446
(1998), with companion RFCs for:

- **RFC 5546** — iTIP (iCalendar Transport-Independent
  Interoperability Protocol) — how calendar systems exchange events
- **RFC 6047** — iMIP (iCalendar Message-Based Interoperability
  Protocol) — how to send iCalendar over email
- **RFC 7953** — VAVAILABILITY — availability sharing (relevant for
  v3)

When an `.ics` file is attached to an email with the right MIME type,
every major email client (Gmail, Apple Mail, Outlook, Yahoo, etc.)
recognizes it as a calendar invite and offers a one-click
"Add to Calendar" action. No OAuth, no per-user integration setup.

### 1.2 Minimum viable VEVENT

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Rock On//Event Invite 1.0//EN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:20261101T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20260308T020000
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:show-b1d2e3f4-rockon-app
DTSTAMP:20260424T170400Z
DTSTART;TZID=America/New_York:20260508T200000
DTEND;TZID=America/New_York:20260508T220000
SUMMARY:iPod Shuffle at The Bowery
DESCRIPTION:Load-in 6:00 PM\, soundcheck 7:00 PM. See details in Rock On: https://rockon.app/shows/b1d2e3f4
LOCATION:The Bowery Ballroom\, 6 Delancey St\, New York\, NY
ORGANIZER;CN=Eric Admin:mailto:eric@rockon.app
ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=Jane:mailto:jane@example.com
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
```

Every character matters:

- **Line endings MUST be CRLF** (`\r\n`) per RFC 5545 § 3.1
- **Lines over 75 octets MUST be folded** (continue on next line
  prefixed with a single space); libraries handle this, hand-rolled
  templates must too
- **Commas, semicolons, backslashes in text values MUST be escaped**
  (`\,` `\;` `\\`), and newlines become `\n`

### 1.3 Critical properties

| Property            | Purpose                       | Notes                                                                                           |
| ------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `VERSION:2.0`       | iCalendar spec version        | Always `2.0`                                                                                    |
| `PRODID`            | Identifies the generator      | `-//Rock On//Event Invite 1.0//EN`                                                              |
| `METHOD`            | What kind of iTIP message     | `REQUEST` (create/update), `CANCEL` (cancel), `REPLY` (RSVP)                                    |
| `UID`               | Stable per-event ID           | **Must never change** across updates — this is how calendars recognize an update vs a new event |
| `DTSTAMP`           | When the `.ics` was generated | UTC; required                                                                                   |
| `DTSTART` / `DTEND` | Event time                    | With `TZID=` parameter for timezone                                                             |
| `SEQUENCE`          | Update counter                | `0` on create, `+1` per update; calendars only honor updates with `SEQUENCE > current`          |
| `STATUS`            | Event status                  | `CONFIRMED`, `TENTATIVE`, `CANCELLED`                                                           |
| `ORGANIZER`         | Event owner                   | **MUST match** between create and update for calendars to apply the update                      |
| `ATTENDEE`          | Invitee                       | One per recipient; `PARTSTAT` = RSVP status                                                     |
| `LOCATION`          | Display location              | Free-form text                                                                                  |
| `SUMMARY`           | Event title                   | Free-form text                                                                                  |
| `DESCRIPTION`       | Body                          | Free-form text; `\n` for line breaks                                                            |
| `TRANSP`            | Busy/free flag                | `OPAQUE` (busy) or `TRANSPARENT` (free)                                                         |

### 1.4 UID stability — the critical rule

**For updates and cancellations to work, the UID must be stable.**

```typescript
// When a show is created, generate UID once and persist it:
const uid = `show-${show.id}@rockon.app`
// Save to DB: shows.calendar_uid = uid

// On update: reuse the SAME UID, bump SEQUENCE:
const sequence = show.calendar_sequence + 1
// Save to DB: shows.calendar_sequence = sequence

// On cancel: reuse the SAME UID, METHOD:CANCEL, SEQUENCE+1:
// The calendar locates the existing event by UID and removes it
```

If the UID ever changes for the same event, the recipient's calendar
will treat the update as a new event — and they'll have two copies of
the same show on their calendar. This is the #1 bug in calendar invite
implementations.

### 1.5 SEQUENCE semantics

- `SEQUENCE:0` on first send (REQUEST)
- `SEQUENCE:1, 2, 3, ...` on each update — monotonically increasing
- A calendar receiving `SEQUENCE:5` when it last saw `SEQUENCE:4` will
  apply the update
- A calendar receiving `SEQUENCE:3` when it last saw `SEQUENCE:4` will
  IGNORE the message (stale)
- CANCEL must have `SEQUENCE > last REQUEST` (typically `+1`)

### 1.6 ORGANIZER identity

The `ORGANIZER` field matters enormously. Rules:

1. The ORGANIZER email **must match** across all messages for the same
   UID. If you send the initial REQUEST as `eric@rockon.app` and the
   update as `noreply@rockon.app`, most calendars will reject the
   update.

2. The ORGANIZER is generally the address the email comes **from**.
   If the `From:` header is `noreply@rockon.app` but ORGANIZER is
   `eric@rockon.app`, some clients flag it as suspicious.

**Recommendation:** make ORGANIZER match the `From:` header, i.e.
`noreply@rockon.app`. The admin's identity is surfaced in the
`DESCRIPTION` and HTML body, not in ORGANIZER.

Tradeoff: RSVPs go to the ORGANIZER. With `noreply@rockon.app`, RSVPs
would bounce. That's fine for v1 since we're not capturing RSVPs. For
v2, use a parseable reply-to address like `rsvp+<token>@rockon.app`
and route inbound to an RSVP ingestion function.

### 1.7 VTIMEZONE component

When `DTSTART` / `DTEND` use a `TZID` parameter, the `.ics` MUST
include a matching `VTIMEZONE` component defining that timezone's
offsets and DST rules. Without it, some clients (notably older
Outlook) mis-interpret the time.

Libraries handle VTIMEZONE generation from an IANA timezone name
automatically. Hand-rolled templates need to ship a hardcoded set of
VTIMEZONE blocks for common zones, OR use a library.

This is the single biggest reason to use a library over hand-rolling.

---

## 2. Library Evaluation

### 2.1 `ical-generator` (recommended)

- **npm:** https://www.npmjs.com/package/ical-generator
- **GitHub:** https://github.com/sebbo2002/ical-generator
- **Deno import:** `https://esm.sh/ical-generator@7`
- **License:** MIT
- **Stars:** 1.3k+
- **Maintenance:** Active (monthly releases)
- **TypeScript:** First-class
- **Timezone support:** Excellent — uses Luxon or moment-timezone
  for IANA zones, generates full VTIMEZONE blocks

**Sample:**

```typescript
import ical, { ICalCalendarMethod } from 'https://esm.sh/ical-generator@7'

const cal = ical({ name: 'Rock On' })
cal.method(ICalCalendarMethod.REQUEST)
cal.prodId({ company: 'Rock On', product: 'Event Invite', language: 'EN' })

const event = cal.createEvent({
  id: `show-${showId}@rockon.app`, // UID
  sequence: show.calendar_sequence,
  start: show.scheduledDate, // Date object
  end: new Date(show.scheduledDate.getTime() + show.duration * 60_000),
  timezone: show.timezone, // IANA name, e.g., 'America/New_York'
  summary: show.name,
  description: buildDescription(show),
  location: formatLocation(show),
  organizer: { name: 'Rock On', email: 'noreply@rockon.app' },
  status: show.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
  transparency: 'OPAQUE',
})

for (const recipient of recipients) {
  event.createAttendee({
    email: recipient.email,
    name: recipient.name,
    rsvp: true,
    role: 'REQ-PARTICIPANT',
    status: 'NEEDS-ACTION',
  })
}

const icsString = cal.toString()
```

**Pros:**

- Handles CRLF, folding, escaping automatically
- Generates VTIMEZONE blocks from IANA names
- Active maintenance, wide usage
- Good defaults

**Cons:**

- ~100KB minified (fine for edge functions, which have no hard size
  limit, but worth noting)
- Pulls in a timezone library transitively

### 2.2 `ics` (lighter alternative)

- **npm:** https://www.npmjs.com/package/ics
- **Deno import:** `https://esm.sh/ics@3`
- **License:** ISC
- **Stars:** 900+
- **TypeScript:** Types included

**Sample:**

```typescript
import { createEvent } from 'https://esm.sh/ics@3'

const { value: icsString, error } = createEvent({
  uid: `show-${showId}@rockon.app`,
  sequence: show.calendar_sequence,
  start: [2026, 5, 8, 20, 0], // [year, month, day, hour, minute]
  duration: { hours: 2 },
  title: show.name,
  description: buildDescription(show),
  location: formatLocation(show),
  organizer: { name: 'Rock On', email: 'noreply@rockon.app' },
  attendees: recipients.map(r => ({
    name: r.name,
    email: r.email,
    rsvp: true,
    role: 'REQ-PARTICIPANT',
    partstat: 'NEEDS-ACTION',
  })),
  status: 'CONFIRMED',
  method: 'REQUEST',
})
```

**Pros:**

- Lighter (~30KB)
- Cleaner API
- Good TypeScript types

**Cons:**

- **Weak timezone handling** — emits floating times (no TZID) by
  default. Can pass `startInputType: 'utc'` but doesn't ship full
  VTIMEZONE blocks. This is a dealbreaker for cross-timezone bands.
- Less actively maintained (occasional month+ gaps between releases)

### 2.3 Hand-rolled template

**Pros:**

- Zero dependency
- Fully auditable
- ~150 lines of code

**Cons:**

- Must implement VTIMEZONE generation (or hardcode common zones)
- Must implement CRLF line endings, 75-char folding, escape rules
- Easy to get wrong in subtle ways that break specific clients
- Maintenance burden as edge cases emerge

**Sample VTIMEZONE problem:** generating a VTIMEZONE for
`Australia/Lord_Howe` (which has a 30-minute DST shift, not 60) or
`Pacific/Chatham` (12:45 offset) requires knowing the IANA DST rules.
Libraries handle this via the `@tubular/time` or Luxon IANA database.

### 2.4 Recommendation

**Use `ical-generator`.** The extra weight is worth the correct
timezone handling. Hand-rolled is tempting for a "v1 simple" case but
calendar invites break in interesting and hard-to-reproduce ways, and
the cost of getting a timezone wrong is a band member arriving at
6 PM instead of 9 PM for a show.

If bundle size concerns ever surface, revisit `ics` with explicit
VTIMEZONE passthrough (the library supports `tzid` param per event).

---

## 3. Provider / Email Client Compatibility Matrix

Behavior of `.ics` attachments across major clients.

### 3.1 Gmail (web + mobile)

- **Detects** `.ics` attachment when MIME is
  `text/calendar; method=REQUEST; charset=utf-8`
- **Inline preview:** shows event summary + date + time; "RSVP" and
  "Add to Google Calendar" buttons
- **One-click add:** directly into user's primary Google Calendar
- **Update handling:** matches by UID, applies if SEQUENCE higher
- **Cancel handling:** METHOD:CANCEL removes the event, shows
  "Event cancelled" banner
- **Gotcha:** Gmail sometimes strips `.ics` if there's no HTML body
  to accompany it. Always include an HTML body.

### 3.2 Apple Mail (macOS + iOS)

- **Best-in-class** iCal handling — the format originated on Apple
  platforms
- **Inline banner:** shows event details + Accept/Maybe/Decline
  buttons that directly fire an iTIP REPLY email back to ORGANIZER
- **Update handling:** perfect UID/SEQUENCE matching
- **Cancel handling:** removes event automatically

### 3.3 Outlook / Microsoft 365 (web + desktop + mobile)

- **Detects** `.ics` and converts to a native meeting invite
- **Inline RSVP:** Accept/Tentative/Decline buttons, sends REPLY
- **Update handling:** matches by UID; occasional issues if ORGANIZER
  doesn't match `From:` address
- **Gotcha:** Outlook.com sometimes duplicates the event if the
  METHOD line is missing. Always set METHOD explicitly.
- **Gotcha:** Classic Outlook desktop has historically ignored
  `SEQUENCE` updates when the sender domain doesn't match a corporate
  account — this is rare in 2026 but worth knowing.

### 3.4 Yahoo Mail

- **Basic handling:** shows `.ics` as downloadable attachment
- **No inline preview / RSVP**
- Users double-click attachment → opens in their system calendar
- Update/cancel: depends on receiving calendar app

### 3.5 ProtonMail

- **Shows attachment;** clicking opens in Proton Calendar (if user
  has it) or prompts download
- Handles UID/SEQUENCE correctly once imported

### 3.6 Mobile "Add to Calendar" behavior

- **iOS Mail:** tapping `.ics` in attachment preview opens system
  calendar with Accept/Decline options
- **Android Gmail:** tapping opens Google Calendar with a pre-filled
  event; "Save" button commits it
- **Android non-Gmail clients:** variable; usually downloads file
  and opens calendar app

### 3.7 Summary

| Client         | Attachment recognized | Inline preview | RSVP support   | Update by UID    | Cancel by UID     |
| -------------- | --------------------- | -------------- | -------------- | ---------------- | ----------------- |
| Gmail          | ✅                    | ✅             | ✅             | ✅               | ✅                |
| Apple Mail     | ✅                    | ✅ (best)      | ✅             | ✅               | ✅                |
| Outlook / M365 | ✅                    | ✅             | ✅             | ✅               | ✅ (with caveats) |
| Yahoo          | ✅                    | ❌             | Via download   | Via calendar app | Via calendar app  |
| ProtonMail     | ✅                    | Limited        | Via Proton Cal | ✅               | ✅                |

Bottom line: **`.ics` works everywhere.** There's no client that
outright fails to import. The RSVP / inline-preview polish varies but
that's cosmetic for v1.

---

## 4. Native Calendar APIs (v2 deferred)

### 4.1 Why v2, not v1

Native calendar APIs (Google Calendar API, Microsoft Graph Calendar)
offer a better experience than `.ics`:

- Events appear instantly, not "Click Accept first"
- Two-way sync — if user edits on their side, we can see it
- Richer metadata (attendee avatars, conferencing links)
- No email clutter

But they come with meaningful complexity:

- **OAuth 2.0 per-user consent flow** — new login screen users must
  navigate, consent decisions to store and respect
- **Refresh token lifecycle** — tokens expire, require periodic
  refresh, can be revoked
- **Scope creep requirement** — `calendar.events` scope is broader
  than users may expect; Google's security review flags apps that
  request write scopes without a strong justification
- **Per-provider code paths** — Google and Microsoft diverge; Apple
  has no public API; fallback to `.ics` for others
- **Not covering 100% of users** — users who don't OAuth in still
  need `.ics` delivery

For v1, `.ics` gives us 90% of the value at 10% of the engineering
cost. v2 layers native APIs on top for opted-in users.

### 4.2 Google Calendar API

- **Auth:** OAuth 2.0, scope `https://www.googleapis.com/auth/calendar.events`
  (write) or `.../calendar.events.owned` (narrower)
- **Endpoint:** `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
- **Event creation:**

```typescript
const event = {
  summary: show.name,
  location: formatLocation(show),
  description: buildDescription(show),
  start: {
    dateTime: show.scheduledDate.toISOString(),
    timeZone: show.timezone,
  },
  end: {
    dateTime: endTime.toISOString(),
    timeZone: show.timezone,
  },
  attendees: recipients.map(r => ({ email: r.email })),
  guestsCanModify: false,
  sendUpdates: 'all', // Google sends invite emails too
}

await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(event),
})
```

- **Update:** `PATCH /events/{eventId}`
- **Delete:** `DELETE /events/{eventId}`
- **Two-way sync:** subscribe to push notifications via `watch`
  endpoint (requires webhook URL)
- **Google security review:** required if app publishes to non-G-
  Suite users; `.../calendar.events` is a "restricted scope" and
  requires annual third-party security audit (~$10k USD). Using
  `.../calendar.events.owned` avoids this but limits writes to events
  the user owns. Workaround: model Rock-On events as
  "user-scheduled events invited to band members" — still requires
  audit if the app touches other users' events.

### 4.3 Microsoft Graph Calendar API

- **Auth:** OAuth 2.0 via Microsoft Identity Platform, scope
  `Calendars.ReadWrite`
- **Endpoint:** `POST https://graph.microsoft.com/v1.0/me/events`
- **Event creation:**

```typescript
const event = {
  subject: show.name,
  body: { contentType: 'HTML', content: buildHtmlBody(show) },
  start: {
    dateTime: show.scheduledDate.toISOString(),
    timeZone: show.timezone,
  },
  end: { dateTime: endTime.toISOString(), timeZone: show.timezone },
  location: { displayName: formatLocation(show) },
  attendees: recipients.map(r => ({
    emailAddress: { address: r.email, name: r.name },
    type: 'required',
  })),
}

await fetch(`https://graph.microsoft.com/v1.0/me/events`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(event),
})
```

- **Update:** `PATCH /events/{id}`
- **Cancel:** `POST /events/{id}/cancel` (preserves history)
- **Two-way sync:** delta query or webhooks via `/subscriptions`
- **Approval process:** less onerous than Google's for basic
  `Calendars.ReadWrite`

### 4.4 Apple

No public Calendar API. Apple users will always receive `.ics`
attachments. Apple's handling is excellent, so this is not a
problem in practice.

### 4.5 v2 architecture sketch

```
user_calendar_connections
├─ user_id
├─ provider ('google' | 'microsoft')
├─ access_token (encrypted)
├─ refresh_token (encrypted)
├─ expires_at
├─ scopes
├─ connected_at
└─ external_calendar_id (for scoped writes)

send-event-invite edge function (v2):
  for each recipient:
    if recipient has active calendar connection:
      use native API (Google/Microsoft)
    else:
      fall back to .ics via Resend
```

---

## 5. Calendly / Cal.com (v3 deferred)

### 5.1 The v3 problem

The user's v3 goal:

> "support band members sharing their availability so that someone
> can find days without conflicts for scheduling shows and practices"

Three implementation paths:

1. **Calendly integration** — bands use Calendly; Rock-On reads each
   member's availability via Calendly API
2. **Cal.com integration** — same idea, with Cal.com (open source)
3. **Native availability** — build availability directly into
   Rock-On (members set busy blocks; we compute conflict-free slots)

### 5.2 Calendly API

- **Pricing:** API access requires **Professional plan** ($12/user/mo)
  or higher. Free tier has no API access.
- **Auth:** OAuth 2.0 (per-user consent)
- **Relevant endpoints:**
  - `GET /users/{uuid}/busy_times` — returns scheduled meetings (not
    raw calendar availability)
  - `GET /event_types` — user's bookable event types
  - Webhooks for new meeting creation
- **Limitation:** Calendly exposes only _Calendly-booked_ meetings
  as "busy", not the user's full calendar. For full availability
  you'd need the user's underlying calendar (Google, Outlook) which
  Calendly connects to internally but doesn't expose through its API.
- **Verdict:** **Poor fit.** Calendly's API is designed for
  scheduling links, not availability sharing.

### 5.3 Cal.com API

- **Pricing:** free tier has API access (generous)
- **Open source:** self-hostable; can run inside the Rock-On
  infrastructure if desired
- **Relevant endpoints:**
  - `GET /availability` — returns available time slots for a user
  - `GET /bookings` — user's booked meetings
  - Full calendar integration via user's connected providers
- **Auth:** API key (per user) or OAuth (v2 of their API)
- **Verdict:** **Much better fit** than Calendly. Cal.com genuinely
  exposes availability, not just booked meetings.
- **Caveat:** each band member needs a Cal.com account and must
  connect their Google/Outlook to it. That's a real setup burden.

### 5.4 Native availability (recommended v3 path)

Skip third parties. Build availability as a first-class Rock-On
concept:

- **Pull-based:** members whose Google/Outlook is OAuth'd in (from
  v2 native calendar API work) can have their busy blocks pulled on
  demand. We compute conflict-free slots and show to the admin.
- **Push-based:** members not OAuth'd in can mark themselves busy
  in-app (weekly recurring unavailability; one-off blackout dates).

This path:

- Reuses v2's OAuth infrastructure
- Works for members who don't want a Cal.com account
- Keeps UX inside Rock-On (no context switch to a third-party tool)
- Builds toward VAVAILABILITY (RFC 7953) standards compliance

**Recommendation:** native availability in v3, potentially with a
future "Cal.com connect" option for users who already have that
setup.

### 5.5 Schema sketch (v3, not final)

```sql
CREATE TABLE user_availability_blocks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  band_id UUID REFERENCES bands(id),           -- Scope to a band, or NULL = all bands
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  kind TEXT CHECK (kind IN ('busy', 'preferred', 'unavailable')),
  recurrence_rule TEXT,                        -- RFC 5545 RRULE if recurring
  source TEXT CHECK (source IN ('manual', 'google', 'microsoft', 'calcom')),
  external_id TEXT,                            -- If imported from external calendar
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);
```

Event scheduler shows a heat map of member availability; admin picks
a conflict-free slot; creates show; v1/v2 invite delivery kicks in.

---

## 6. Timezone Handling

### 6.1 IANA zones

All timezone identifiers follow IANA:

- `America/New_York`, `America/Los_Angeles`, `Europe/London`
- Full list: https://www.iana.org/time-zones
- There are ~600 identifiers; most apps support all of them

### 6.2 Detecting user's timezone

**In the browser:**

```typescript
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
// e.g., 'America/New_York'
```

Supported in all modern browsers. Falls back to 'UTC' in rare cases.

**Storage:** persist the `timezone` string on `shows` / `practice_sessions`,
default to creator's browser-detected value, allow edit.

### 6.3 DTSTART/DTEND with TZID

```ics
DTSTART;TZID=America/New_York:20260508T200000
DTEND;TZID=America/New_York:20260508T220000
```

Means "8 PM to 10 PM local time in America/New_York." If the recipient
is in Los Angeles, their calendar displays "5 PM to 7 PM PDT" (correct
absolute time).

### 6.4 DST transitions

- **Spring forward:** 2:30 AM on the DST transition day doesn't
  exist. If a show is scheduled for that instant, the event is
  ambiguous. Libraries usually push it to 3:30 AM.
- **Fall back:** 1:30 AM on the DST transition day happens twice.
  Events scheduled at that local time are ambiguous; libraries
  usually interpret as the first occurrence.

For a band app, this is mostly irrelevant (nobody schedules a
practice for 2:30 AM), but worth knowing.

### 6.5 Touring bands edge case

What if a band does a show in Berlin on Tuesday and a show in New
York on Friday? Each show should have its own `timezone` field:

- Berlin show: `timezone = 'Europe/Berlin'`
- NYC show: `timezone = 'America/New_York'`

Each band member's calendar renders in their own local time, but the
absolute event time is unambiguous.

This is why per-event timezone (v1's choice) is better than
per-band timezone.

---

## 7. Update/Cancel Semantics

### 7.1 The update flow

```
Show created:
  ├─ Generate UID: "show-{id}@rockon.app" (once, immutable)
  ├─ Set SEQUENCE: 0
  ├─ Send REQUEST to all recipients
  └─ DB: calendar_uid=<uid>, calendar_sequence=0

Show edited (date/time/location/name change):
  ├─ Reuse UID (same as original)
  ├─ Increment SEQUENCE: 1
  ├─ Send REQUEST to all recipients with higher SEQUENCE
  ├─ Recipients' calendars: update in place (no duplicate)
  └─ DB: calendar_sequence=1

Show cancelled:
  ├─ Reuse UID (same)
  ├─ Increment SEQUENCE: 2
  ├─ Change METHOD to CANCEL
  ├─ Change STATUS to CANCELLED
  ├─ Send to all recipients
  ├─ Recipients' calendars: remove event
  └─ DB: calendar_sequence=2, status='cancelled'
```

### 7.2 Recipient drift

What if recipients change between send #1 and send #2?

- **Added members:** must receive the _full history_ or the current
  state as a REQUEST with current SEQUENCE. They won't care they
  missed earlier sequences.
- **Removed members:** no canonical way to un-invite via iCalendar.
  Best-effort: send them a CANCEL with their email as sole attendee,
  which removes the event from _their_ calendar. Some implementations
  call this a "partial cancel" — it's supported by Google Calendar
  and Outlook but not formally part of RFC 5546.

### 7.3 Identity-only changes don't need re-sends

If only the `description` changes (e.g., admin adds setlist notes),
arguably no update needs to go out. But it's cleaner UX to always
re-send on any save — calendar will just update in place, no user-
visible noise. Recommended for v1.

v2 could diff and only send on "material" changes (time, location,
cancel).

---

## 8. Edge Cases

### 8.1 Event in the past

Don't send. An event 3 hours ago doesn't need a calendar invite.
Filter in the edge function: skip send if `scheduled_date < NOW() - 1h`.

### 8.2 Member has no email

Users in Rock-On always have an email (it's the primary login).
But for practice attendees pulled from `attendees` by `memberId`,
validate email existence before attempting send.

### 8.3 All-day events

Rock-On has no all-day events (all shows/practices have a
`duration` in minutes). If v2 introduces all-day shows, the
`.ics` changes:

```ics
DTSTART;VALUE=DATE:20260508
DTEND;VALUE=DATE:20260509
```

Note: DTEND is the day _after_ the event for all-day (RFC 5545
half-open interval convention).

### 8.4 Multi-day shows

Same as above but with DTEND a later date. No code change beyond
computing the right DTEND.

### 8.5 Timezone change

What if the admin changes a show's timezone mid-flight (e.g., venue
relocated from Berlin to New York)? The `.ics` update handles this
cleanly — new TZID, same UID, SEQUENCE+1. Calendars will update.

### 8.6 Attendee opts out after first invite

If a user sets `email_event_invites=false` after receiving the
initial REQUEST, they:

- Won't receive future updates/cancels
- Their calendar still shows the event (it's locally stored)
- If the event is later cancelled, their calendar won't auto-remove

Accept this as a known limitation in v1. Document it in the UI:
"Opting out prevents future invites from being sent; existing
events may remain on your calendar."

### 8.7 Recurring events

Deferred. Rock-On doesn't model recurring practices yet. When it
does (e.g., "every Tuesday 7 PM"), RRULE support is straightforward
in `ical-generator`:

```typescript
event.repeating({
  freq: 'WEEKLY',
  byDay: ['TU'],
  until: new Date('2026-12-31'),
})
```

---

## 9. Testing Strategy

### 9.1 Unit tests: `.ics` generation

Snapshot tests for the rendered ics string, with stable UID and
DTSTAMP:

```typescript
// tests/unit/functions/icsGenerator.test.ts
describe('generateShowIcs', () => {
  it('produces valid REQUEST for a basic show', () => {
    const ics = generateShowIcs({
      show: mockShow,
      recipients: [mockMember],
      method: 'REQUEST',
    })
    expect(ics).toMatchSnapshot()
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('UID:show-abc-123@rockon.app')
    expect(ics).toContain('SEQUENCE:0')
  })

  it('increments SEQUENCE on update', () => {
    /* ... */
  })
  it('sets METHOD:CANCEL with STATUS:CANCELLED on cancel', () => {
    /* ... */
  })
  it('includes VTIMEZONE for non-UTC timezones', () => {
    /* ... */
  })
  it('escapes commas and semicolons in SUMMARY', () => {
    /* ... */
  })
})
```

### 9.2 Contract tests: edge function

Test the HTTP-level behavior:

```typescript
// tests/contract/edge-functions/send-event-invite.test.ts
it('returns 401 without JWT', async () => {
  /* ... */
})
it('returns 403 when caller is not band admin', async () => {
  /* ... */
})
it('returns 200 and logs send on success', async () => {
  /* ... */
})
it('filters recipients by notification prefs', async () => {
  /* ... */
})
it('respects rate limit', async () => {
  /* ... */
})
```

### 9.3 Validation: online `.ics` validators

- https://icalendar.org/validator.html — manual paste-in check
- CI can pipe the generated ics through `https://www.npmjs.com/package/node-ical`'s parser as a quick validation (if it parses cleanly, it's at least structurally valid)

### 9.4 Cross-client manual testing matrix

Pre-v1-ship, manually verify:

| Test                                             | Gmail web | Gmail iOS | Apple Mail macOS | Apple Mail iOS | Outlook web | Outlook desktop | Yahoo |
| ------------------------------------------------ | --------- | --------- | ---------------- | -------------- | ----------- | --------------- | ----- |
| New show invite lands                            |           |           |                  |                |             |                 |       |
| Add-to-calendar works                            |           |           |                  |                |             |                 |       |
| Update lands (time change)                       |           |           |                  |                |             |                 |       |
| Update does NOT duplicate                        |           |           |                  |                |             |                 |       |
| Cancel removes event                             |           |           |                  |                |             |                 |       |
| Timezone displays correctly for remote recipient |           |           |                  |                |             |                 |       |

Tedious, but the only way to catch client-specific quirks (Outlook
desktop especially).

### 9.5 E2E (Playwright)

```typescript
// tests/e2e/calendar-invites/send-on-create.spec.ts
test('creates show and sends invite to all members', async ({ page }) => {
  // Set Resend key to test mode
  // Create show in UI
  // Verify email_logs row for each member
  // Verify Resend test-mode captured send
})
```

---

## 10. Open Questions Resolved

| Question              | Answer                                                      |
| --------------------- | ----------------------------------------------------------- |
| Which iCal library?   | `ical-generator` (VTIMEZONE handling matters)               |
| Delivery mechanism?   | `.ics` over Resend for v1; native APIs v2                   |
| Timezone source?      | Per-event `timezone` column; default to creator's browser   |
| ORGANIZER identity?   | `noreply@rockon.app` (matches From:)                        |
| How to trigger sends? | Client call from ShowService/PracticeSessionService on save |
| RSVP capture?         | Deferred to v2                                              |
| Recurring events?     | Deferred to v2                                              |
| All-day events?       | Not in data model yet; deferred                             |
| External contacts?    | Deferred to v2 (per spec)                                   |
| Availability sharing? | v3 — recommend native, not Calendly or Cal.com              |

---

## 11. Future Considerations

### 11.1 VAVAILABILITY (RFC 7953)

For v3 availability sharing, RFC 7953 defines a standard iCalendar
component for a user's availability. A Rock-On member could publish
their VAVAILABILITY as a read-only calendar feed; admins see it when
scheduling. Deferred.

### 11.2 Two-way sync

Once native APIs are in place (v2), polling for calendar changes or
subscribing to webhooks lets Rock-On detect when a member moves an
event on their side. Useful for conflict detection but complex to
implement correctly (conflict resolution, event merging, loops).
Deferred to a potential v2.5.

### 11.3 Conferencing links

v2+ could attach Zoom/Meet/Teams links automatically. Requires
integration per-provider. Nice-to-have, deferred.

### 11.4 Rich HTML bodies with event details

v1 ships a minimal HTML body. v2+ could include the setlist, the
member roster, venue photos, etc. — making the email itself a
mini-event-page.

### 11.5 Multiple notification channels

Beyond email: push notifications (mobile), SMS reminders, in-app
notifications. Calendar invites are one channel among many — v1
ships email only.

---

## 12. References

- [RFC 5545 — iCalendar Core](https://datatracker.ietf.org/doc/html/rfc5545)
- [RFC 5546 — iTIP](https://datatracker.ietf.org/doc/html/rfc5546)
- [RFC 6047 — iMIP](https://datatracker.ietf.org/doc/html/rfc6047)
- [RFC 7953 — VAVAILABILITY](https://datatracker.ietf.org/doc/html/rfc7953)
- [ical-generator](https://github.com/sebbo2002/ical-generator)
- [ics (npm)](https://www.npmjs.com/package/ics)
- [Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Calendly API](https://developer.calendly.com/)
- [Cal.com API](https://cal.com/docs/api-reference)
- [IANA Time Zones](https://www.iana.org/time-zones)
- [iCalendar Validator](https://icalendar.org/validator.html)
- Existing Rock On specs:
  - `./spec.md` — v1 calendar-events spec
  - `../email-invitations/spec.md` — band invitations spec
  - `../email-infrastructure/shared-services.md` — shared email setup
