---
title: Calendar Event Integration - Flow Diagrams
created: 2026-04-24T17:04
status: Reference
description: Sequence diagrams and flow charts for every major path in the calendar-events feature - event creation, updates, cancellation, opt-out, and error handling
---

# Calendar Event Flow Diagrams

Companion to `./spec.md`. Diagrams are ASCII for terminal + code
review friendliness. See spec.md for narrative context on each flow.

---

## 1. Happy Path: Admin creates a show

### 1.1 High-level flow

```
┌──────────────┐   create    ┌──────────────┐   invoke    ┌────────────────────┐
│  Admin (UI)  │ ──────────▶ │ ShowService  │ ──────────▶ │ send-event-invite  │
└──────────────┘             │  (client)    │             │  (edge function)   │
                             └──────────────┘             └────────────────────┘
                                    │                              │
                                    ▼                              ▼
                             ┌──────────────┐             ┌────────────────────┐
                             │  IndexedDB   │             │    Supabase DB     │
                             │  + Supabase  │             │ (reads + writes)   │
                             └──────────────┘             └────────────────────┘
                                                                   │
                                                                   ▼
                                                         ┌────────────────────┐
                                                         │   Resend API       │
                                                         └────────────────────┘
                                                                   │
                                                                   ▼
                                                         ┌────────────────────┐
                                                         │ Recipient inboxes  │
                                                         │  (N members)       │
                                                         └────────────────────┘
```

### 1.2 Sequence diagram — create show

```
Admin UI      ShowService       Edge Fn       Supabase DB     Resend     Member Inbox
   │              │                │               │             │             │
   │ click Save   │                │               │             │             │
   │─────────────▶│                │               │             │             │
   │              │ addShow()      │               │             │             │
   │              │─────────────────────────────── ▶│             │             │
   │              │ ◀── ok (row created, UID gen'd)│             │             │
   │              │                │               │             │             │
   │              │ invoke('send-event-invite',    │             │             │
   │              │  {eventType: 'show',           │             │             │
   │              │   eventId, method: 'REQUEST'}) │             │             │
   │              │───────────────▶│               │             │             │
   │              │                │               │             │             │
   │              │                │ verify JWT + admin role     │             │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀──── ok ─────│             │             │
   │              │                │               │             │             │
   │              │                │ SELECT show + band + members + prefs      │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── rows ─────│             │             │
   │              │                │               │             │             │
   │              │                │ generate .ics (SEQUENCE=0)  │             │
   │              │                │ (ical-generator, local CPU) │             │
   │              │                │               │             │             │
   │              │                │ for each recipient:         │             │
   │              │                │   resend.emails.send(...)   │             │
   │              │                │────────────────────────────▶│             │
   │              │                │ ◀── {id: "resend-abc"} ─────│             │
   │              │                │               │             │             │
   │              │                │ INSERT email_logs ...       │             │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │             │
   │              │                │ UPDATE shows SET calendar_sequence=0      │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │             │
   │              │                │ Resend delivers email       │             │
   │              │                │                ─────────────────────────▶│
   │              │                │               │             │             │
   │              │ ◀── {success: true, sent: 4,   │             │             │
   │              │     failed: 0, skipped: 1,     │             │             │
   │              │     sequenceSent: 0} ──────────│             │             │
   │              │                │               │             │             │
   │ ◀── show saved, UI closes form                │             │             │
   │   (toast: "Calendar invite sent to 4 members")│             │             │
```

Note: the client fires `invoke` asynchronously. The UI doesn't
block on send completion — toast appears after edge function
returns, but the show creation itself is already persisted.

### 1.3 Resolution of recipients (step inside the edge function)

```
┌─────────────────────────────────────────────────────────────┐
│  SQL executed by service-role client inside edge function   │
└─────────────────────────────────────────────────────────────┘

  SELECT
    u.id       AS user_id,
    u.email    AS email,
    u.name     AS name,
    COALESCE(p.email_event_invites, TRUE) AS opted_in
  FROM users u
  INNER JOIN band_memberships bm ON bm.user_id = u.id
  LEFT JOIN user_notification_prefs p ON p.user_id = u.id
  WHERE bm.band_id = $1                              -- the show's band
    AND u.email IS NOT NULL
    AND u.email != ''
  ORDER BY u.name

┌─────────────────────────────────────────────────────────────┐
│  In-function filter                                         │
└─────────────────────────────────────────────────────────────┘

  recipients = rows.filter(r => r.opted_in)
  skipped    = rows.filter(r => !r.opted_in)

  // For METHOD=REQUEST, check email_event_invites
  // For METHOD=CANCEL, check email_event_cancellations
  // For METHOD=REQUEST (update), check email_event_updates

  return { recipients, skipped }
```

---

## 2. Update Flow: Show edited

### 2.1 Sequence — admin changes show date

```
Admin UI      ShowService       Edge Fn       Supabase DB     Resend     Member Inbox
   │              │                │               │             │             │
   │ edit + save  │                │               │             │             │
   │─────────────▶│                │               │             │             │
   │              │ getShow(id)    │               │             │             │
   │              │────────────────────────────── ▶│             │             │
   │              │ ◀── before ────────────────────│             │             │
   │              │                │               │             │             │
   │              │ updateShow(id, patch)          │             │             │
   │              │────────────────────────────── ▶│             │             │
   │              │ ◀── after (row updated)────────│             │             │
   │              │                │               │             │             │
   │              │ isCalendarRelevantChange(before, after)? YES │             │
   │              │                │               │             │             │
   │              │ invoke('send-event-invite', method: 'REQUEST')│            │
   │              │───────────────▶│               │             │             │
   │              │                │               │             │             │
   │              │                │ SELECT show.calendar_uid,   │             │
   │              │                │        show.calendar_sequence              │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── uid, seq=0 │             │             │
   │              │                │               │             │             │
   │              │                │ SELECT prior recipients from email_logs   │
   │              │                │   WHERE event_id = $1                     │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── [user1, user2, user3]  │             │
   │              │                │               │             │             │
   │              │                │ SELECT additional members + prefs         │
   │              │                │   (members added since original)          │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── additional recipients  │             │
   │              │                │               │             │             │
   │              │                │ generate .ics (SEQUENCE=1)  │             │
   │              │                │   (same UID as before)      │             │
   │              │                │               │             │             │
   │              │                │ send to union of prior + new│             │
   │              │                │────────────────────────────▶│             │
   │              │                │               │             │             │
   │              │                │ INSERT email_logs           │             │
   │              │                │   (purpose='event-update',  │             │
   │              │                │    sequence_sent=1)         │             │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │             │
   │              │                │ UPDATE shows SET calendar_sequence=1      │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │             │
   │              │                │               │             │ update email delivered
   │              │                │               │             │──────────▶│
   │              │                │               │             │             │
   │              │                │               │             │   Calendar matches UID:
   │              │                │               │             │   SEQUENCE 1 > stored 0
   │              │                │               │             │   → apply update in place
   │              │                │               │             │   (no duplicate event)
```

### 2.2 The "is this a calendar-relevant change" gate

```
         ┌─────────────────────┐
         │   Show updated      │
         └──────────┬──────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ Compare before/after   │
       │ for calendar-relevant  │
       │ fields:                │
       │  • scheduledDate       │
       │  • duration            │
       │  • timezone            │
       │  • name                │
       │  • venue               │
       │  • location            │
       └──────────┬─────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
     CHANGED             UNCHANGED
        │                   │
        ▼                   ▼
  ┌───────────┐       ┌───────────┐
  │ Send      │       │ Skip      │
  │ update    │       │ send      │
  │ (METHOD=  │       │ (no user- │
  │ REQUEST,  │       │ visible   │
  │ SEQ+1)    │       │ calendar  │
  └───────────┘       │ change)   │
                      └───────────┘
```

Rationale: admin editing `notes` or `payment` doesn't need to
re-send 10 calendar invites. That would be noise.

---

## 3. Cancel Flow: Show cancelled

### 3.1 Sequence

```
Admin UI      ShowService       Edge Fn       Supabase DB     Resend     Member Inbox
   │              │                │               │             │             │
   │ Cancel show  │                │               │             │             │
   │─────────────▶│                │               │             │             │
   │              │ updateShow(id, {status: 'cancelled'})        │             │
   │              │────────────────────────────── ▶│             │             │
   │              │ ◀── ok ────────────────────────│             │             │
   │              │                │               │             │             │
   │              │ Detected transition to 'cancelled' → CANCEL  │             │
   │              │                │               │             │             │
   │              │ invoke('send-event-invite', method: 'CANCEL')│             │
   │              │───────────────▶│               │             │             │
   │              │                │               │             │             │
   │              │                │ SELECT uid, current sequence │             │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── uid, seq=1 │             │             │
   │              │                │               │             │             │
   │              │                │ SELECT prior recipients      │             │
   │              │                │──────────────▶│             │             │
   │              │                │ ◀── [user1, user2, user3]  │             │
   │              │                │               │             │             │
   │              │                │ Check email_event_cancellations prefs     │
   │              │                │   filter opted-out           │             │
   │              │                │               │             │             │
   │              │                │ generate .ics with:          │             │
   │              │                │   METHOD:CANCEL              │             │
   │              │                │   SEQUENCE=2 (was 1, +1)     │             │
   │              │                │   STATUS:CANCELLED           │             │
   │              │                │               │             │             │
   │              │                │ send cancellation emails     │             │
   │              │                │────────────────────────────▶│             │
   │              │                │               │             │             │
   │              │                │ INSERT email_logs            │             │
   │              │                │   (purpose='event-cancel',   │             │
   │              │                │    method='CANCEL',          │             │
   │              │                │    sequence_sent=2)          │             │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │             │
   │              │                │ UPDATE shows SET calendar_sequence=2      │
   │              │                │──────────────▶│             │             │
   │              │                │               │             │ cancel email delivered
   │              │                │               │             │──────────▶│
   │              │                │               │             │             │
   │              │                │               │             │   Calendar matches UID
   │              │                │               │             │   Sees METHOD:CANCEL
   │              │                │               │             │   → removes event
   │              │                │               │             │   Shows "Cancelled" banner
```

### 3.2 Edge case: show was never sent in the first place

```
         ┌─────────────────────┐
         │   Show cancelled    │
         └──────────┬──────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ Query email_logs for   │
       │ any prior sends        │
       └──────────┬─────────────┘
                  │
         ┌────────┴────────┐
         │                 │
      NO PRIOR          HAS PRIOR
      SENDS             SENDS
         │                 │
         ▼                 ▼
   ┌───────────┐     ┌───────────┐
   │ Skip      │     │ Send      │
   │ CANCEL    │     │ CANCEL    │
   │ (no one   │     │ to prior  │
   │ has this  │     │ recipients│
   │ in their  │     │ only      │
   │ calendar) │     │           │
   └───────────┘     └───────────┘
```

---

## 4. Opt-Out Flow

### 4.1 User flips the toggle

```
User UI         SettingsService        Supabase DB
   │                   │                     │
   │ toggle off        │                     │
   │──────────────────▶│                     │
   │                   │                     │
   │                   │ UPSERT user_notification_prefs   │
   │                   │   (user_id, email_event_invites=false)  │
   │                   │────────────────────▶│
   │                   │ ◀── ok ─────────────│
   │                   │                     │
   │ ◀── saved, toast displayed              │
```

### 4.2 Effect on subsequent sends

```
                ┌──────────────────────────────┐
                │ send-event-invite invoked    │
                │ for event X                  │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │ Resolve recipients:          │
                │   JOIN user_notification_prefs│
                │   filter where               │
                │   email_event_invites=true   │
                └──────────────┬───────────────┘
                               │
                 ┌─────────────┴────────────┐
                 │                          │
           OPTED IN                   OPTED OUT
                 │                          │
                 ▼                          ▼
        ┌────────────────┐        ┌──────────────────┐
        │ Receive email  │        │ Skipped          │
        │ + .ics invite  │        │ email_logs row   │
        │                │        │ NOT created      │
        └────────────────┘        │ (no audit trail  │
                                  │  of non-send)    │
                                  └──────────────────┘
```

**Important:** opting out does NOT remove events already on the
user's calendar. Calendar state is client-side; Rock-On doesn't
control it. The Settings UI must communicate this:

```
  ┌──────────────────────────────────────────────┐
  │  ☑ Email calendar invites                    │
  │                                              │
  │  When on, we'll send you a calendar invite   │
  │  for every new show and practice.            │
  │                                              │
  │  ⓘ Turning this off stops future emails.     │
  │     Events already on your calendar will     │
  │     remain — you can remove them manually.   │
  └──────────────────────────────────────────────┘
```

### 4.3 List-Unsubscribe one-click flow

```
Gmail Bulk UI          Unsubscribe URL         App Backend
   │                         │                      │
   │ user clicks             │                      │
   │ "Unsubscribe"           │                      │
   │────────────────────────▶│                      │
   │                         │                      │
   │                         │ validate HMAC token  │
   │                         │ extract user_id      │
   │                         │                      │
   │                         │ UPSERT prefs         │
   │                         │   email_event_invites│
   │                         │   = false            │
   │                         │─────────────────────▶│
   │                         │                      │
   │                         │ render confirmation  │
   │                         │ "Unsubscribed. You   │
   │                         │  can re-enable in    │
   │                         │  Settings."          │
   │ ◀── 200 HTML ───────────│                      │
```

---

## 5. Error Handling

### 5.1 Partial send failure

```
┌───────────────────────────────────────────────────────────┐
│  send-event-invite — sending to 5 recipients               │
└───────────────────────────────────────────────────────────┘

  Recipient A: Resend returns 200 {id: "r_a"}
     → INSERT email_logs {status: 'sent',   resend_id: 'r_a'}
  Recipient B: Resend returns 200 {id: "r_b"}
     → INSERT email_logs {status: 'sent',   resend_id: 'r_b'}
  Recipient C: Resend returns 422 "invalid email"
     → INSERT email_logs {status: 'failed', error_message: 'invalid email'}
  Recipient D: Resend returns 200 {id: "r_d"}
     → INSERT email_logs {status: 'sent',   resend_id: 'r_d'}
  Recipient E: network timeout
     → INSERT email_logs {status: 'failed', error_message: 'timeout'}

  Function returns:
    {success: true, sent: 3, failed: 2, skipped: 0, sequenceSent: 0,
     logIds: [... 5 UUIDs ...]}

  Admin UI:
    Toast: "Calendar invite sent to 3 of 5 members. 2 failed — see details."
    Event detail page → Calendar invites section shows failures.
```

### 5.2 Complete send failure (edge function errors before any send)

```
   ┌─────────────────────────────┐
   │ Edge function throws        │
   │ (e.g., service_role client  │
   │  init failed, auth failed)  │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │ Return 4xx/5xx with         │
   │ {success: false, error}     │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │ Client catches error        │
   │ Event save is already       │
   │ persisted — not rolled back │
   └──────────────┬──────────────┘
                  │
                  ▼
   ┌─────────────────────────────┐
   │ Toast:                      │
   │ "Event saved, but calendar  │
   │  invites could not be sent. │
   │  Try resending from the     │
   │  event page."               │
   └─────────────────────────────┘
```

Rationale: saving the event is more important than sending invites.
The admin can always manually re-send.

### 5.3 Rate limit hit

```
   ┌─────────────────────────────┐
   │ Edge function checks        │
   │ rate limit                  │
   │   key: band_id              │
   │   limit: 100 / hour         │
   └──────────────┬──────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │ Over limit?     │
        └────────┬────────┘
                 │
        ┌────────┴────────┐
       NO                YES
        │                 │
        ▼                 ▼
  ┌──────────┐   ┌─────────────────────────┐
  │ proceed  │   │ Return 429              │
  │          │   │ {success: false,        │
  │          │   │  error: 'rate limit'}   │
  │          │   │                         │
  │          │   │ Client toast:           │
  │          │   │ "Too many invites sent  │
  │          │   │  recently. Try again    │
  │          │   │  in X minutes."         │
  └──────────┘   └─────────────────────────┘
```

---

## 6. Admin Resend Action

### 6.1 Manual resend from event detail page

```
Admin UI                     Edge Fn                 DB / Resend
   │                            │                       │
   │ click "Resend" for         │                       │
   │ member Bob (failed)        │                       │
   │───────────────────────────▶│                       │
   │                            │                       │
   │                            │ invoke with           │
   │                            │   eventId, method='REQUEST',│
   │                            │   specificRecipient='bob'  │
   │                            │                       │
   │                            │ Same flow as normal send   │
   │                            │ but scoped to 1 recipient  │
   │                            │──────────────────────▶│
   │                            │                       │
   │                            │ INSERT email_logs     │
   │                            │   (current sequence)  │
   │                            │──────────────────────▶│
   │                            │                       │
   │ ◀── toast + updated status │                       │
```

Note: this is a new `specificRecipient` parameter to the edge
function, not part of the initial v1 ship. Documented here as a
near-term polish item.

---

## 7. Timezone Edge Cases

### 7.1 Sender vs recipient in different timezones

```
Event scheduled: 2026-05-08 20:00 America/New_York
Event ends:      2026-05-08 22:00 America/New_York (duration 120 min)

.ics content:
  DTSTART;TZID=America/New_York:20260508T200000
  DTEND;TZID=America/New_York:20260508T220000
  VTIMEZONE[...]  ← full NYC DST rules embedded

Recipient in Los Angeles (America/Los_Angeles):
  Calendar computes: 2026-05-08 17:00 - 19:00 PDT
  Displays: "5:00 PM - 7:00 PM"

Recipient in Berlin (Europe/Berlin):
  Calendar computes: 2026-05-09 02:00 - 04:00 CEST
  Displays: "2:00 AM Sat - 4:00 AM Sat"

Same absolute time, each rendered in local time. ✓
```

### 7.2 Admin changes timezone mid-flight

```
  Original:   timezone=America/New_York, scheduled_date=2026-05-08 20:00
               Sent .ics with VTIMEZONE=NYC

  Venue relocated. Admin updates:
               timezone=Europe/London, scheduled_date=2026-05-08 20:00
               (keeps wall-clock time, changes absolute time)

  Update .ics:
    Same UID
    SEQUENCE+1
    VTIMEZONE=Europe/London
    DTSTART;TZID=Europe/London:20260508T200000

  Recipients' calendars:
    Match UID, apply update. Event moves from 8pm NYC to 8pm London.
    Absolute time shifted by 5 hours.
```

---

## 8. Database State Transitions

### 8.1 `shows.calendar_sequence` lifecycle

```
  Show created           ──────▶  calendar_sequence = 0
                                  send-event-invite (REQUEST, seq=0)

  Show name changed      ──────▶  calendar_sequence = 1
                                  send-event-invite (REQUEST, seq=1)

  Show notes changed     ──────▶  calendar_sequence = 1 (unchanged;
                                  notes aren't calendar-relevant)

  Show date changed      ──────▶  calendar_sequence = 2
                                  send-event-invite (REQUEST, seq=2)

  Show cancelled         ──────▶  calendar_sequence = 3
                                  send-event-invite (CANCEL, seq=3)

  Show un-cancelled?     ──────▶  (not supported in v1 — create new show)
```

### 8.2 `email_logs` rows for a single show

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ email_logs                                                         │
 ├────────────────────────────────────────────────────────────────────┤
 │ id | purpose        | recipient | seq_sent | method  | status     │
 ├────────────────────────────────────────────────────────────────────┤
 │ 01 | event-invite   | jane      | 0        | REQUEST | sent       │
 │ 02 | event-invite   | bob       | 0        | REQUEST | sent       │
 │ 03 | event-invite   | alice     | 0        | REQUEST | failed     │
 │ 04 | event-update   | jane      | 1        | REQUEST | sent       │
 │ 05 | event-update   | bob       | 1        | REQUEST | sent       │
 │ 06 | event-update   | alice     | 1        | REQUEST | sent       │
 │ 07 | event-update   | dave      | 1        | REQUEST | sent       │ ← new member
 │ 08 | event-cancel   | jane      | 2        | CANCEL  | sent       │
 │ 09 | event-cancel   | bob       | 2        | CANCEL  | sent       │
 │ 10 | event-cancel   | alice     | 2        | CANCEL  | sent       │
 │ 11 | event-cancel   | dave      | 2        | CANCEL  | sent       │
 └────────────────────────────────────────────────────────────────────┘
```

The admin UI on the event detail page queries this table:

```sql
SELECT
  recipient_user_id,
  MAX(sequence_sent) FILTER (WHERE status='sent') AS last_sent_seq,
  MAX(sent_at)       FILTER (WHERE status='sent') AS last_sent_at,
  BOOL_OR(status='failed' AND sequence_sent = (
    SELECT MAX(sequence_sent) FROM email_logs WHERE event_id = $1
  )) AS latest_failed
FROM email_logs
WHERE event_type = 'show' AND event_id = $1
GROUP BY recipient_user_id
```

And joins to `users` + `user_notification_prefs` to show opt-out
status.

---

## 9. Practice vs Show: same pattern

All flows above apply to `practice_sessions` with minor changes:

- `eventType: 'practice'` instead of `'show'`
- Subject lines use "practice" instead of "show"
- Field names differ: `shows.name` vs `practice_sessions.type`
  (e.g., "Rehearsal", "Writing Session")

The `.ics` generation and delivery pipeline are identical.

---

## 10. What Doesn't Happen in v1

Flows explicitly NOT implemented in v1 (all deferred to v2+):

1. **RSVP capture** — recipient's Accept/Decline doesn't write back
   to Rock-On. If their calendar sends a REPLY email to ORGANIZER,
   it goes to `noreply@rockon.app` and is discarded.

2. **External contact invites** — `ShowContact` entries with emails
   (venue manager, sound engineer) are NOT invited. Admin can
   manually forward the show page's link.

3. **Native calendar API push** — no OAuth to Google/Microsoft;
   `.ics` is the only delivery mechanism.

4. **Inbound email** — no `replies@`, no `rsvp+token@`, no
   webhook handling. Outbound-only.

5. **Bounce handling** — Resend's dashboard shows bounces but
   Rock-On doesn't auto-suppress. Admin sees the error in
   `email_logs` and manually removes or fixes the address.

6. **Recurring events** — no RRULE; every practice is a standalone
   event.

All of these are called out in `./spec.md` § 14 "Future
Considerations".

---

## 11. References

- `./spec.md` — full feature specification
- `./research.md` — technical background (RFC 5545, libraries, etc.)
- `../email-infrastructure/shared-services.md` — shared plumbing
- `../email-invitations/flow-diagrams.md` — sibling feature's flows
  (band join code, not calendar)
