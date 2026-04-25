---
title: Calendar Event Integration
created: 2026-04-24T17:04
status: Specification Complete
description: Auto-send calendar invites (.ics) to band members when shows and practices are created, updated, or cancelled. v1 uses Resend + iCalendar attachments; v2/v3 layer on native calendar APIs and availability sharing.
---

# Calendar Event Integration

## Executive Summary

When a band admin creates a show or schedules a practice in Rock On,
every band member should get the event on their phone's calendar
automatically — without manually copying date, time, venue. That's
the v1 goal: one-click "Add to Calendar" delivery via standards-
based iCalendar (`.ics`) attachments over email.

**v1 scope** (this spec):

- `.ics` attachment sent via Resend to all band members when an
  event is created / updated / cancelled
- Per-user opt-out preference
- Timezone-aware scheduling with IANA zone support
- Update + cancel semantics via stable UID + SEQUENCE

**v2 scope** (deferred; noted in § Future):

- Native Google Calendar API + Microsoft Graph Calendar API with
  per-user OAuth for richer UX
- RSVP capture (`/rsvp/:token` links + inbound email parsing)
- External `ShowContact` invitees (venue manager, sound engineer)
- Bounce webhook ingestion
- Recurring events (RRULE)

**v3 scope** (deferred; noted in § Future):

- Member availability sharing with conflict-free slot suggestions
- Native Rock-On availability (not Calendly/Cal.com — see
  `./research.md` § 5)

---

## Dependencies

- `../email-infrastructure/shared-services.md` — Resend setup, edge
  function patterns, `email_logs` table, rate limiting
- Existing `shows` + `practice_sessions` tables (schema deltas in § 4)
- Existing `users` table for recipient resolution

This feature can be built alongside, before, or after the
`email-invitations` feature. Both depend on the same shared
infrastructure.

---

## 1. User Stories

### US-1: Admin creates a show, all members get it on their calendar

**As a** band admin
**I want to** have calendar invites go out automatically when I schedule a show
**So that** my bandmates don't have to manually add it themselves and nobody forgets the date

**Acceptance Criteria:**

- [ ] When a show is saved (first time), a calendar invite is sent to every band member with a valid email and `email_event_invites=true`
- [ ] The email includes a `.ics` attachment that calendars auto-detect
- [ ] Recipients can tap "Add to Calendar" (Gmail/Apple Mail) or accept the invite
- [ ] The event appears with correct date, time, timezone, name, and location
- [ ] The event description links back to the show in the Rock-On app
- [ ] The send happens within 30 seconds of the show being saved
- [ ] The admin sees no loading blocker — send is async
- [ ] Failures are logged in `email_logs` but don't block show creation

### US-2: Admin schedules a practice, all members get it

Same as US-1 but for practice sessions. In v1, recipients are the
same as for shows (all band members). The `attendees` array on
`practice_sessions` is **not** used to filter recipients in v1 —
it's about post-practice attendance tracking, not pre-practice
inviting. (Revisit in v2 if the distinction matters.)

### US-3: Admin edits a show, calendar updates in place

**As a** band admin
**I want to** have calendar entries update automatically when I change a show
**So that** bandmates see the new time without duplicate entries cluttering their calendars

**Acceptance Criteria:**

- [ ] When a show is updated (date, time, venue, name, or notes change), an updated `.ics` is sent to all prior recipients
- [ ] The update uses the same `UID` as the original send
- [ ] `SEQUENCE` is incremented by 1
- [ ] Recipients' calendars update the existing event in place — no duplicates
- [ ] If the update changes the date, the event moves to the new date on the calendar
- [ ] If the recipient has already declined, the update still reaches them but respects their existing RSVP status

### US-4: Admin cancels a show, calendar entries are removed

**As a** band admin
**I want to** have calendar entries removed when I cancel a show
**So that** bandmates don't show up to a cancelled gig

**Acceptance Criteria:**

- [ ] When a show's `status` becomes `cancelled`, a cancellation `.ics` is sent to all prior recipients
- [ ] The `.ics` uses `METHOD:CANCEL` and `STATUS:CANCELLED`
- [ ] `SEQUENCE` is incremented
- [ ] Compatible calendars remove the event automatically (Gmail, Apple, Outlook)
- [ ] The cancel email body includes context: "{Show name} on {date} has been cancelled by {admin name}"

### US-5: Member opts out of calendar invite emails

**As a** band member
**I want to** be able to turn off automatic calendar invite emails
**So that** I can manage my calendar my own way without getting emails for every schedule change

**Acceptance Criteria:**

- [ ] Settings page has toggles for: "Send calendar invites via email", "Send update emails for calendar changes", "Send cancellation emails"
- [ ] Toggles persist to `user_notification_prefs`
- [ ] Future sends respect the toggles — opt-out users are filtered out at recipient resolution
- [ ] Opt-out takes effect immediately (not cached)
- [ ] Existing events already on the user's calendar are NOT retroactively removed (calendar is client-side state we don't control)
- [ ] UI explains the limitation: "Opting out prevents future emails from being sent; events already on your calendar will remain."

### US-6: Member receives a `.ics` in their preferred email client

**As a** band member
**I want to** get a calendar invite that works in whatever email client I use
**So that** I don't have to change my workflow

**Acceptance Criteria:**

- [ ] Invites render correctly in Gmail web + mobile, Apple Mail macOS + iOS, Outlook web + desktop
- [ ] Yahoo/ProtonMail users get the `.ics` as a downloadable attachment that imports correctly
- [ ] Event times display in the recipient's local timezone (not sender's)
- [ ] HTML body is readable even without downloading the attachment
- [ ] Plain-text fallback body exists for clients that strip HTML

### US-7: Admin sees a list of who got the invite

**As a** band admin
**I want to** see which members received (or failed to receive) each calendar invite
**So that** I can follow up manually if someone didn't get it

**Acceptance Criteria:**

- [ ] Show detail page and practice detail page have a "Calendar invites" section
- [ ] For each member: name, delivery status (sent / pending / failed / opted-out), last sent timestamp, iCal SEQUENCE at last send
- [ ] Admin can trigger a manual re-send to a specific member
- [ ] Failures show the error message

### US-8: Timezone works correctly for distributed bands

**As a** band with members across timezones
**I want to** have each event's time display correctly in each member's local timezone
**So that** nobody misses a show because they got confused about timezone conversions

**Acceptance Criteria:**

- [ ] Every show/practice has a `timezone` field (IANA identifier)
- [ ] New events default to the creator's browser-detected IANA timezone
- [ ] The event form shows the timezone and allows editing
- [ ] The `.ics` includes `VTIMEZONE` for the event's timezone
- [ ] Recipients' calendars render the event in their own local timezone
- [ ] DST transitions are handled correctly (library responsibility)

---

## 2. Architecture Decision: `.ics` over native APIs for v1

**Chosen approach:** send iCalendar (`.ics`) files as MIME attachments
over email via Resend. Every mainstream email client recognizes this
format and surfaces a one-click "Add to Calendar" action.

**Rationale:**

| Concern                         | `.ics` via email                           | Native APIs (Google/Microsoft)             |
| ------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Per-user OAuth setup            | None                                       | Required per provider per user             |
| Works for all email clients     | Yes (Gmail, Apple, Outlook, Yahoo, Proton) | Only for users who OAuth                   |
| Apple user support              | Full (native calendar opens it)            | **No public API** — always `.ics`          |
| Setup complexity                | Low                                        | High (OAuth flows, refresh tokens, scopes) |
| Google security review required | No                                         | Yes for `calendar.events` scope            |
| Two-way sync                    | No                                         | Yes (via polling or webhooks)              |
| Inline RSVP                     | Partial (depends on client)                | Full                                       |
| Engineering cost                | ~1-2 weeks                                 | ~4-6 weeks                                 |

For v1, `.ics` covers 100% of users at ~25% of the engineering cost.
v2 can layer native APIs on top for users who opt into OAuth
integration — without replacing the `.ics` fallback.

Full analysis: `./research.md` §§ 3-4.

---

## 3. User Flows

### Flow 1: Create show → send invites

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Admin fills out "Create Show" form                        │
│    - Name, date, time, duration, venue                       │
│    - Timezone auto-populated from browser, editable          │
│    - [ ] "Send calendar invite to band" (on by default)     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Admin clicks Save                                         │
│    - ShowService.createShow() writes to local IndexedDB      │
│    - Sync engine queues for Supabase write                   │
│    - If "Send invite" is checked AND admin is online:        │
│      ShowService invokes send-event-invite edge function     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. send-event-invite edge function runs                      │
│    - Verify caller is band admin                             │
│    - Look up band members with email_event_invites=true      │
│    - Generate .ics (METHOD:REQUEST, SEQUENCE=0)              │
│    - Send via Resend (one email per recipient)               │
│    - Log each send to email_logs                             │
│    - Update shows.calendar_sequence=0                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Each recipient's email client                             │
│    - Detects .ics attachment                                 │
│    - Shows inline preview + "Add to Calendar" button         │
│    - Tap → event lands in their primary calendar             │
└──────────────────────────────────────────────────────────────┘
```

### Flow 2: Edit show → send update

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Admin edits show (e.g., date moved from 5/8 to 5/15)     │
│    - ShowService.updateShow() writes changes                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ShowService detects calendar-relevant change              │
│    - Date/time, duration, timezone, name, or location       │
│    - Invokes send-event-invite edge function with method=update │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. send-event-invite edge function                           │
│    - Reuses shows.calendar_uid (stable)                      │
│    - Increments shows.calendar_sequence                      │
│    - Resolves recipients: prior recipients from email_logs   │
│      + any new band members added since                      │
│    - Generates new .ics (METHOD:REQUEST, SEQUENCE=N+1)       │
│    - Sends via Resend                                        │
│    - Logs to email_logs with purpose='event-update'          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Recipients' calendars                                     │
│    - Match UID to existing event                             │
│    - See SEQUENCE higher than stored → apply update          │
│    - Event moves to new date in place (no duplicate)         │
└──────────────────────────────────────────────────────────────┘
```

### Flow 3: Cancel show → remove from calendars

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Admin marks show status='cancelled'                       │
│    - ShowService.updateShow({ status: 'cancelled' })        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ShowService detects status transition to 'cancelled'      │
│    - Invokes send-event-invite edge function, method=cancel  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. send-event-invite edge function                           │
│    - Reuses calendar_uid                                     │
│    - Increments calendar_sequence                            │
│    - Generates .ics with METHOD:CANCEL + STATUS:CANCELLED    │
│    - Sends to all prior recipients                           │
│    - Logs as purpose='event-cancel'                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Recipients' calendars                                     │
│    - Match UID, see CANCEL → remove event                    │
│    - Gmail/Outlook show "Event was cancelled" banner         │
└──────────────────────────────────────────────────────────────┘
```

### Flow 4: Member opts out

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Member opens Settings → Notifications                     │
│    - Toggles "Email calendar invites" to OFF                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. UpSERTs user_notification_prefs row                       │
│    - email_event_invites=false                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Future send-event-invite invocations                      │
│    - Recipient resolution query filters on                   │
│      user_notification_prefs.email_event_invites=true        │
│    - This member is skipped                                  │
│    - Their existing calendar entries are NOT removed         │
└──────────────────────────────────────────────────────────────┘
```

More detailed sequence diagrams in `./flow-diagrams.md`.

---

## 4. Schema Deltas

### 4.1 `shows` table additions

```sql
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS
  timezone TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS
  end_time TIMESTAMPTZ;
  -- If NULL at calendar-invite generation time, compute as
  -- scheduled_date + (duration * INTERVAL '1 minute')

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS
  calendar_uid UUID DEFAULT gen_random_uuid();
  -- Stable iCalendar UID. Generated on row insert, never changes.

ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS
  calendar_sequence INTEGER NOT NULL DEFAULT 0;
  -- RFC 5545 SEQUENCE. Incremented on every calendar-relevant update.
```

**Note on default timezone:** `'America/New_York'` is a pragmatic
default for the current user base. Applications should populate
`timezone` from the creator's browser at creation time so this
default is rarely hit in practice.

### 4.2 `practice_sessions` table additions

```sql
ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS
  timezone TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS
  end_time TIMESTAMPTZ;

ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS
  calendar_uid UUID DEFAULT gen_random_uuid();

ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS
  calendar_sequence INTEGER NOT NULL DEFAULT 0;
```

### 4.3 `user_notification_prefs` — new table

Specified in `../email-infrastructure/shared-services.md` § 9.1.
Repeating here for completeness:

```sql
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_invitations BOOLEAN NOT NULL DEFAULT true,
  email_event_invites BOOLEAN NOT NULL DEFAULT true,
  email_event_updates BOOLEAN NOT NULL DEFAULT true,
  email_event_cancellations BOOLEAN NOT NULL DEFAULT true,
  email_digest BOOLEAN NOT NULL DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.user_notification_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_prefs TO service_role;

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own prefs"
  ON public.user_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own prefs"
  ON public.user_notification_prefs FOR ALL
  USING (auth.uid() = user_id);
```

Resolution rule: if a user has no row in `user_notification_prefs`,
all defaults apply (sends are enabled).

### 4.4 `email_logs` — shared table

Specified in `../email-infrastructure/shared-services.md` § 4.1.
Used by both `email-invitations` and `calendar-events`. Key fields
used by this feature:

- `purpose` — `event-invite` | `event-update` | `event-cancel`
- `event_type` — `show` | `practice`
- `event_id` — UUID (polymorphic, no FK)
- `sequence_sent` — iCal SEQUENCE at send time (for dedupe /
  troubleshooting)
- `method` — `REQUEST` | `CANCEL`

### 4.5 Migration policy notes

Per CLAUDE.md:

- **All new tables MUST include explicit grants** for `authenticated`
  AND `service_role`. `npm run lint:migrations` enforces this.
- **Idempotent migrations** — `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` before `CREATE POLICY`.
- **One consolidated migration file per feature** — all of the above
  lives in a single file named `supabase/migrations/<timestamp>_calendar_events.sql`.
- Baseline migration is **frozen**; never modify it.

### 4.6 Backfill

Existing rows in `shows` and `practice_sessions`:

- `timezone` = `'America/New_York'` (default)
- `end_time` = NULL (computed on demand)
- `calendar_uid` = NULL initially; backfill via `UPDATE shows SET calendar_uid = gen_random_uuid() WHERE calendar_uid IS NULL;` as part of the migration
- `calendar_sequence` = 0

Add NOT NULL constraint on `calendar_uid` AFTER backfill:

```sql
UPDATE public.shows SET calendar_uid = gen_random_uuid() WHERE calendar_uid IS NULL;
ALTER TABLE public.shows ALTER COLUMN calendar_uid SET NOT NULL;

UPDATE public.practice_sessions SET calendar_uid = gen_random_uuid() WHERE calendar_uid IS NULL;
ALTER TABLE public.practice_sessions ALTER COLUMN calendar_uid SET NOT NULL;
```

### 4.7 TypeScript model updates

```typescript
// src/models/Show.ts
export interface Show {
  // ... existing fields ...
  timezone: string // NEW — IANA, e.g., 'America/New_York'
  endTime?: Date // NEW — optional; computed from duration if absent
  calendarUid: string // NEW — stable UID for iCalendar
  calendarSequence: number // NEW — default 0
}

// src/models/PracticeSession.ts — same additions
```

Repository mapping (`RemoteRepository.ts`) adds snake_case ↔
camelCase translation for each new column.

---

## 5. Edge Function: `send-event-invite`

### 5.1 Request / response contract

```typescript
// POST /functions/v1/send-event-invite
interface SendEventInviteRequest {
  eventType: 'show' | 'practice'
  eventId: string // UUID of the show or practice
  method: 'REQUEST' | 'CANCEL'
  // If 'REQUEST', this covers both create (new event) and update (existing)
  // The function reads calendar_sequence from DB and treats 0 as create, >0 as update
}

interface SendEventInviteResponse {
  success: boolean
  sent: number // How many recipients got it
  failed: number
  skipped: number // Opted-out members
  sequenceSent: number // The SEQUENCE value used
  logIds: string[] // email_logs row IDs
  error?: string // Only on full failure
}
```

### 5.2 Handler logic

```
1. Parse request body, validate eventType + eventId
2. Extract caller from Authorization header (JWT)
3. Load event from DB
   - If show: SELECT * FROM shows WHERE id=$1
   - If practice: SELECT * FROM practice_sessions WHERE id=$1
4. Authorization: verify caller is a member of event's band AND (admin role OR the event creator)
   - v1 limits sends to admins; v2 may relax to all members
5. Rate limit check (per-band-per-hour bucket, not per-user)
6. Resolve recipients:
   - SELECT u.id, u.email, u.name FROM users u
     INNER JOIN band_memberships bm ON bm.user_id = u.id
     LEFT JOIN user_notification_prefs p ON p.user_id = u.id
     WHERE bm.band_id = $1
       AND u.email IS NOT NULL
       AND COALESCE(p.email_event_invites, TRUE) = TRUE  -- for REQUEST
       -- OR COALESCE(p.email_event_cancellations, TRUE) for CANCEL
7. Early returns:
   - Empty recipient list → return success=true, sent=0
   - Event in the past (scheduled_date < now - 1h) → return success=true, sent=0, skipped=all (log reason)
8. Compute sequence:
   - For REQUEST: new sequence = current DB sequence + 1 (if update) or 0 (if fresh)
   - For CANCEL: sequence = current DB sequence + 1
   - Determine "is update" by checking if email_logs has any prior row for this event_id
9. Generate .ics via ical-generator library:
   - VCALENDAR with METHOD
   - VTIMEZONE for event.timezone
   - VEVENT with stable UID, SEQUENCE, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, ORGANIZER, ATTENDEE (repeated)
10. For each recipient, send via Resend:
    - to: recipient.email
    - subject: subject line (see § 6)
    - html: HTML body with event details
    - text: plain-text fallback
    - attachments: [{ filename: 'invite.ics', content: icsString, contentType: 'text/calendar; method=REQUEST|CANCEL; charset=utf-8' }]
    - headers: List-Unsubscribe (mailto + https)
11. Log each send to email_logs (status='sent' on success, 'failed' with error_message otherwise)
12. Update event row: calendar_sequence = new sequence
13. Return aggregate response
```

Rate limit choices (same as shared-services.md):

- Per-band-per-hour: 100 event-invite sends max
- Per-event-per-hour: 20 re-sends max (prevents save-keystroke loops)

### 5.3 FUNCTIONS.md manifest entry

Add to `supabase/functions/FUNCTIONS.md`:

```
| send-event-invite | verify JWT | service_role (writes) + caller (auth check) | No  | shows, practice_sessions, band_memberships, users, user_notification_prefs, email_logs | 401 |
```

### 5.4 Grants required

Per CLAUDE.md migration lint rules, the following tables must have
`GRANT ... TO service_role` because the edge function queries them:

- `shows` — already granted in baseline
- `practice_sessions` — already granted in baseline
- `band_memberships` — already granted in baseline
- `users` — already granted in baseline
- `user_notification_prefs` — **NEW** — must be granted in this
  feature's migration (shared-services.md § 9.1 includes the grant)
- `email_logs` — **NEW** — must be granted (shared-services.md § 4.1
  includes the grant)

---

## 6. Email Content

### 6.1 Subject line templates

| Method           | Subject template                                    |
| ---------------- | --------------------------------------------------- |
| REQUEST (create) | `{bandName}: {showName} on {shortDate}`             |
| REQUEST (update) | `Updated: {bandName} — {showName} on {shortDate}`   |
| CANCEL           | `Cancelled: {bandName} — {showName} on {shortDate}` |

Example: `iPod Shuffle: Bowery Ballroom show on May 8`

### 6.2 HTML body outline

```
┌─────────────────────────────────────┐
│  Rock On logo                       │
├─────────────────────────────────────┤
│  You're invited to {show.name}      │
│                                     │
│  📅 Friday, May 8, 2026             │
│  🕐 8:00 PM – 10:00 PM EDT          │
│  📍 The Bowery Ballroom, NY         │
│                                     │
│  {admin_name} added this show to    │
│  {band_name}'s schedule.            │
│                                     │
│  [ View in Rock On ]                │
│                                     │
│  This email includes a calendar     │
│  invite. Tap below to add to your   │
│  calendar.                          │
├─────────────────────────────────────┤
│  Notification prefs                 │
│  Unsubscribe from event invites     │
└─────────────────────────────────────┘
```

Rendered server-side in the edge function. See shared-services.md
§ 3 for HTML template conventions (hand-rolled HTML strings for v1,
always escape user input, always ship plain-text fallback).

### 6.3 Plain-text fallback

```
You're invited to {show.name}

{band.name} has a show coming up:

  Date:     {long date}
  Time:     {start time} – {end time} {timezone abbr}
  Location: {venue}, {location}

{admin name} added this show to your band's schedule.

View in Rock On: {APP_URL}/shows/{show.id}

This email includes a calendar invite (invite.ics). Open it to
add the event to your calendar.

---
To stop receiving these emails, visit:
{APP_URL}/settings/notifications
```

### 6.4 Special cases

- **Cancel email:** HTML body leads with "This show has been
  cancelled" banner; includes original event details for
  reference
- **Update email:** HTML body leads with "This show has been
  updated" banner; shows old → new diff (e.g., "Date: ~~May 8~~ → May 15")

---

## 7. Client Integration

### 7.1 ShowService changes

```typescript
// src/services/ShowService.ts
class ShowService {
  async createShow(input: CreateShowInput): Promise<Show> {
    const show = await this.repository.addShow({
      ...input,
      timezone:
        input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      // calendar_uid populated by DB default
      // calendar_sequence defaults to 0
    })

    // Fire-and-forget calendar invite send
    if (input.sendCalendarInvite !== false) {
      this.sendCalendarInviteAsync(show.id, 'REQUEST')
    }

    return show
  }

  async updateShow(id: string, patch: UpdateShowInput): Promise<Show> {
    const before = await this.repository.getShow(id)
    const show = await this.repository.updateShow(id, patch)

    // Only re-send if calendar-relevant fields changed
    if (this.isCalendarRelevantChange(before, show)) {
      this.sendCalendarInviteAsync(show.id, 'REQUEST')
    }

    return show
  }

  async cancelShow(id: string): Promise<Show> {
    const show = await this.repository.updateShow(id, { status: 'cancelled' })
    this.sendCalendarInviteAsync(show.id, 'CANCEL')
    return show
  }

  private isCalendarRelevantChange(before: Show, after: Show): boolean {
    return (
      before.scheduledDate.getTime() !== after.scheduledDate.getTime() ||
      before.duration !== after.duration ||
      before.timezone !== after.timezone ||
      before.name !== after.name ||
      before.venue !== after.venue ||
      before.location !== after.location
    )
  }

  private async sendCalendarInviteAsync(
    showId: string,
    method: 'REQUEST' | 'CANCEL'
  ): Promise<void> {
    try {
      await supabase.functions.invoke('send-event-invite', {
        body: { eventType: 'show', eventId: showId, method },
      })
    } catch (err) {
      // Don't throw — send failure must not block the UI action
      log.error('Calendar invite send failed', err)
    }
  }
}
```

Same pattern for `PracticeSessionService`.

### 7.2 Create/edit form UI changes

- Add a **timezone selector** to the show and practice forms
  - Defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - Searchable dropdown of common IANA zones (curated list of ~50)
    - fallback to full list
  - Displayed in a compact format: `America/New_York (EST/EDT)`
- Add a **"Send calendar invite to band"** checkbox
  - Checked by default
  - Unchecking skips the send for this specific save
  - Useful for correcting typos without spamming members

### 7.3 Settings page

New "Notifications" section under Settings:

- **Email settings**
  - [x] Receive email invitations to new bands
  - [x] Receive calendar invites when events are scheduled
  - [x] Receive update emails when events change
  - [x] Receive cancellation emails when events are cancelled

Each toggle upserts a row in `user_notification_prefs`.

### 7.4 Event detail page

Show a new "Calendar invites" section (visible to admins only in
v1):

| Member      | Status      | Last sent        | SEQUENCE |
| ----------- | ----------- | ---------------- | -------- |
| Jane Doe    | ✓ Sent      | Apr 24, 10:15 AM | 0        |
| Bob Smith   | ⚠ Failed   | Apr 24, 10:15 AM | 0        |
| Alice Jones | — Opted out | —                | —        |

Each row has a "Resend" action (admin only; rate-limited).

---

## 8. Error States

| Error                              | Behavior                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Event not found                    | 404 from edge function; admin UI shows "Event deleted"                             |
| Caller not band admin              | 403; admin-only action                                                             |
| Rate limit hit                     | 429; show toast "Too many calendar invites sent recently. Try again in X minutes." |
| Recipient email invalid            | Skip that recipient; log as status='failed'                                        |
| Resend API error                   | Log as status='failed' with error_message; continue with remaining recipients      |
| Network failure to edge function   | Client-side retry once, then surface failure; event save is not rolled back        |
| Clock skew between DB and function | Use DB NOW() for "event in past" check, not edge function clock                    |

---

## 9. Security Considerations

### 9.1 Authorization

- Only band admins can trigger sends (v1)
- Edge function verifies JWT and checks `band_memberships.role`
- Service-role client inside function bypasses RLS but explicit checks enforce authorization

### 9.2 Email address verification

- v1 uses the email from `users.email`, which is set at auth time
  and trusted
- No risk of spoofing because the caller can't specify recipient
  emails directly — only the band

### 9.3 Rate limiting

See § 5.2; also shared-services.md § 5. Prevents:

- Accidental save loops sending thousands of emails
- Malicious admin abuse
- Resend API quota exhaustion

### 9.4 Resend API key security

- Never exposed to client
- Stored as Supabase edge function secret
- Rotated on suspected compromise

### 9.5 List-Unsubscribe compliance

Include one-click unsubscribe header per Gmail/Yahoo Feb 2024
requirements:

```
List-Unsubscribe: <mailto:unsubscribe+event-invites@rockon.app>, <https://rockon.app/unsubscribe?token=...>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Clicking the URL flips `user_notification_prefs.email_event_invites`
to `false` for the user associated with the token.

Token generation: HMAC(user_id, purpose) with server secret.
Deferred to same feature scope since it's required for compliance.

### 9.6 No sensitive data in .ics

- `.ics` can be forwarded. Don't put sensitive info in
  `DESCRIPTION`.
- OK to include: show name, venue, public address, general time,
  link to app
- Don't include: member names lists, internal notes, payment
  amounts, setlist song names (arguably the setlist is a band
  secret until showtime)

### 9.7 Observability / audit

- `email_logs` captures every send
- Admin UI surfaces delivery status per recipient
- Failed sends are visible in Supabase logs + Resend dashboard

---

## 10. Files to Create / Modify (when implemented)

### Files to create

```
src/
├── components/
│   ├── events/
│   │   ├── TimezoneSelector.tsx         # IANA timezone picker
│   │   ├── CalendarInviteToggle.tsx     # Checkbox on create/edit forms
│   │   └── InviteDeliveryList.tsx       # Admin status view on detail page
│   └── settings/
│       └── NotificationPrefsSection.tsx # Toggles in Settings
├── services/
│   └── CalendarInviteService.ts         # Client-side invoke + state
└── hooks/
    └── useNotificationPrefs.ts           # CRUD for user_notification_prefs

supabase/
├── functions/
│   └── send-event-invite/
│       └── index.ts                      # Main handler
│   └── _shared/
│       ├── cors.ts                       # New (shared with send-invitation)
│       ├── email.ts                      # New (shared)
│       ├── logging.ts                    # New (shared)
│       ├── rateLimit.ts                  # New (shared)
│       └── icsGenerator.ts               # .ics building via ical-generator
└── migrations/
    └── <timestamp>_calendar_events.sql   # Schema deltas + user_notification_prefs + email_logs

tests/
├── unit/
│   └── functions/
│       ├── icsGenerator.test.ts          # Snapshot tests
│       └── recipientResolution.test.ts   # Opt-out filtering
├── contract/
│   └── edge-functions/
│       └── send-event-invite.test.ts     # HTTP-level behavior
└── e2e/
    └── calendar-invites/
        ├── create-show-sends-invite.spec.ts
        ├── update-show-updates-invite.spec.ts
        └── opt-out-suppresses-send.spec.ts
```

### Files to modify

```
src/
├── models/
│   ├── Show.ts                           # Add timezone, endTime, calendarUid, calendarSequence
│   └── PracticeSession.ts                # Same
├── services/
│   ├── ShowService.ts                    # Call CalendarInviteService on save/update/cancel
│   ├── PracticeSessionService.ts         # Same
│   └── data/
│       └── RemoteRepository.ts           # Add snake_case ↔ camelCase mapping for new columns
├── pages/
│   ├── ShowViewPage.tsx                  # Add "Calendar invites" section (admin only)
│   ├── PracticeViewPage.tsx              # Same
│   └── SettingsPage.tsx                  # Add NotificationPrefsSection
└── components/
    ├── sessions/
    │   └── ShowForm.tsx                  # Add TimezoneSelector + CalendarInviteToggle
    └── practice/
        └── PracticeForm.tsx              # Same

supabase/
├── functions/
│   └── FUNCTIONS.md                      # Manifest row for send-event-invite
├── migrations/
│   └── <timestamp>_calendar_events.sql   # See § 4
supabase/tests/
└── <nnn>-calendar-events.test.sql        # pgTAP tests for new schema

scripts/
└── deploy-edge-functions.sh              # Will pick up new function from manifest
└── smoke-edge-functions.sh               # Add assertion for send-event-invite (expects 401)
```

---

## 11. Implementation Phases

### Phase 1: Infrastructure

1. Run migration (new tables + column additions)
2. Add `ical-generator` dependency
3. Create `_shared/` edge function utilities (cors, email, logging,
   rateLimit, icsGenerator)
4. Deploy `user_notification_prefs` UI toggles in Settings (can
   be wired without email sending yet — just persist)

### Phase 2: .ics Generation + Edge Function

1. Build `icsGenerator.ts` with snapshot tests
2. Build `send-event-invite` edge function
3. Deploy edge function; smoke test with manual invoke
4. Verify `.ics` renders correctly in Gmail + Apple Mail test
   accounts
5. Add to `FUNCTIONS.md`

### Phase 3: Client Integration — Create Flow

1. Update `Show` + `PracticeSession` models
2. Update `ShowService.createShow` to invoke edge function
3. Update `PracticeSessionService.createPracticeSession` similarly
4. Add `TimezoneSelector` + `CalendarInviteToggle` to forms
5. E2E test create → invite received

### Phase 4: Update + Cancel Flows

1. Implement `isCalendarRelevantChange` diff
2. Wire update flow in both services
3. Implement cancel flow (on `status='cancelled'` transition)
4. Manual test across Gmail / Apple / Outlook:
   - Update: no duplicates
   - Cancel: event removed

### Phase 5: Admin Visibility + Unsubscribe

1. Build `InviteDeliveryList` component
2. Add "Resend" action
3. Implement unsubscribe token route + handler
4. Add `List-Unsubscribe` header to sends

### Phase 6: Testing + Polish

1. Full unit + contract + E2E suite passing
2. Cross-client manual testing matrix (research.md § 9.4)
3. mail-tester.com deliverability check
4. Performance: edge function cold-start profiling
5. Documentation in README + in-app help tooltip

Estimated total effort: **3-4 weeks for one engineer** if shared
infrastructure (Resend setup, `_shared/` helpers, `email_logs`) is
already in place from the `email-invitations` feature. Add ~1 week
if building from scratch.

---

## 12. Dependencies

### NPM packages

```json
{
  "dependencies": {
    "ical-generator": "^7.0.0"
  }
}
```

The edge function uses the Deno import
(`https://esm.sh/ical-generator@7`). No separate npm install is
required for the function, but adding to `package.json` enables
local unit tests to import the same library.

### Supabase secrets (from shared infrastructure)

- `RESEND_API_KEY`
- `APP_URL`
- `EMAIL_FROM_ADDRESS`

No additional secrets for calendar-events.

### New tables

- `user_notification_prefs`
- `email_logs` (if not already created by email-invitations)

### New functions

- `send-event-invite`

### New columns

- `shows`: `timezone`, `end_time`, `calendar_uid`, `calendar_sequence`
- `practice_sessions`: same

---

## 13. Success Metrics

- [ ] `.ics` delivered within 30 seconds of event save
- [ ] > 95% delivery success rate (`email_logs.status='sent'` / total)
- [ ] Invite verified working in Gmail web, Gmail iOS, Apple Mail
      macOS, Apple Mail iOS, Outlook web
- [ ] Update with same UID never creates duplicate on recipient's
      calendar
- [ ] Cancel removes event from Gmail + Apple + Outlook
- [ ] User who toggles off `email_event_invites` stops receiving sends
- [ ] Cross-timezone band (members in different zones) all see
      correct absolute times
- [ ] No calendar-invite-related UI blocking on event save
- [ ] `mail-tester.com` score ≥ 9/10 on a sample invite

---

## 14. Future Considerations (v2 / v3)

### v2: Richer delivery

- **Native Google Calendar API** integration for opted-in users
- **Native Microsoft Graph Calendar API** integration
- **RSVP capture** via `/rsvp/:token` links in email body (not
  iTIP REPLY — simpler, single-click)
- **Bounce webhook** ingestion (Resend → `resend-webhook` function)
  flips `users.email_suppressed=true` on hard bounces
- **External contacts as invitees:** toggle on show form to include
  `ShowContact[]` with email (venue managers, sound engineers)
- **Recurring events** via iCalendar RRULE (weekly practices)

### v2.5: Two-way sync

- Poll native calendar APIs (or subscribe webhooks) to detect when
  members move/cancel events on their side
- Surface conflicts in the Rock-On UI
- Optionally push Rock-On changes back to their calendar

### v3: Availability sharing

- Members mark busy/unavailable blocks inside Rock-On
- Native calendar integrations (v2) auto-import busy blocks
- New "Schedule Assistant" UI: admin picks a date range; system
  shows conflict-free slots colored by member availability
- Based on research.md § 5: **build native, don't use Calendly or
  Cal.com**
  - Calendly's API doesn't expose availability (only booked
    meetings)
  - Cal.com is a better fit but requires each member to maintain a
    separate Cal.com account
  - Native implementation reuses v2 OAuth infrastructure and keeps
    UX inside Rock-On

---

## 15. References

- `./research.md` — Technical research on iCalendar, libraries,
  providers, and v2/v3 paths
- `./flow-diagrams.md` — Detailed sequence diagrams
- `../email-infrastructure/shared-services.md` — Shared Resend +
  edge function setup
- `../email-invitations/spec.md` — Sibling feature sharing infra
- CLAUDE.md § "Edge Function Policy"
- CLAUDE.md § "Migration Policy"
- [RFC 5545 — iCalendar](https://datatracker.ietf.org/doc/html/rfc5545)
- [Resend attachments](https://resend.com/docs/api-reference/emails/send-email#body-parameters)
