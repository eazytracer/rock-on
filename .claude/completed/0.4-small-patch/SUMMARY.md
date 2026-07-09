# 0.4 "Small" Patch — Events/Casting Polish + Co-hosts — Summary

**Completed:** 2026-07-09
**Version:** 0.4.1 → 0.4.3 (shipped across the post-launch hotfix/polish cycle; co-hosts landed in 0.4.2, event-lineup smarts + release-notes surfacing in 0.4.3)

## Overview

Post-launch polish branch (`fix/0.4-small-patch`) on top of the 0.4 Events/Friends
launch. Started as a handful of signup/join-code fixes and grew into a ~22-round
sweep across the event, casting, friends, and home surfaces, capped by the
**co-hosts** feature. Design source of truth was the Claude Design "Rock On"
project (DESIGN_NOTES §17 / spec EC4). "Not so small" by the end.

## What shipped

**Auth / entry**

- Signup no longer shows a false "no session" error for email-password accounts —
  added a "check your email" verification flow.
- Event join-code (`?join=CODE`) is preserved through signup and sign-in.

**Events — hosting & lineup**

- Host adds songs directly to the lineup (no request round-trip); drag-to-reorder
  (`@dnd-kit`), inline edit, and remove lineup items.
- Per-song **tuning + key** overrides on lineup items (independent of the catalog song).
- Remove participants / leave event; **cancel event**; inline edit of event
  date, **time** (was missing), and venue — no modals, consistent with other activities.
- "Request to play": a guest requesting a song can pre-offer parts ("I'd play"
  chips); approving the request drops the song on the lineup with the requester's
  **hand already raised** on those parts.

**Casting console**

- List view (`LineupCard` / `SongCastPanel`) and Grid view (`EventCastGrid`),
  both single-column setlist-style for vertical density.
- Guests can raise/withdraw hands in both views.
- Shortened instrument labels ("Lead Vocals" → **"Vox"**); instrument icons above labels.
- **Highlight yourself** (info pill + ring + "You" badge, "You"-first cast ordering).
- **Songs you're cast on** highlighted with an **orange border / row-lines**
  (the filled-shade + glow treatment was deliberately _reserved_ for the future
  "up next / now playing" live-tracking feature).
- Removed the progress bar and the Simple/Detailed toggle; roomier mobile touch
  targets and bigger song titles.

**Co-hosts (final feature, 0.4.2)**

- Host promotes a participant to **co-host** (and revokes) from the People tab.
- Co-hosts can cast + approve requests (`is_event_manager` = host + cohost) but
  **cannot alter or delete the event** — the events UPDATE policy is narrowed to
  host-only (`events_update_host`).

**Friends / Home / Calendar**

- Friends: name-search primary; "Add by friend code" moved behind a modal button
  (QR scan deferred to the mobile app).
- Home: "Upcoming events" card; "Add song" button deep-links to `/songs?add=song`
  to open the add-song modal (was a dead button).
- Events/Calendar: removed the Scheduled/Confirmed status pill (Cancelled-only now);
  Calendar "+ New" is filter-aware and activity ordering is consistent with the nav.

**Consistency components (reusable)**

- `EntityHeader` (+ `event` type, `PartyPopper` icon to match the navbar),
  `ScheduleMetaRow` (date/time/location inline-edit), `BackLink`, `TuningTag`.

## Database

One additive, idempotent migration —
`supabase/migrations/20260709064907_0.4_event_ops_patch.sql`:

- `event_lineup_requests` + `parts TEXT[]`
- `event_lineup_items` + `tuning TEXT`, `key TEXT`
- `CREATE OR REPLACE FUNCTION on_event_request_approved()` — pre-raises `event_hands`
  for the requester on approve
- Policy swap `events_update_manager` → **`events_update_host`** (host-only UPDATE)
- Idempotent upsert of the `0.4.3` row into `release_notes` (surfaced in-app as
  "what's new" vs `users.last_seen_release_version`)

No new tables, no new grants, no existing migrations modified → clean single `db push`.
New pgTAP: `023-request-pre-raise-hands.test.sql` (8), `024-event-cohost-permissions.test.sql` (6).

## Key files

- `src/services/EventService.ts` — `setParticipantTier`, reorder/update/remove/add
  lineup, remove/leave/detach participant, updateEvent/cancelEvent, updateAccess.
- `src/hooks/useEvents.ts` — `useEventParticipants.setParticipantTier`;
  `useEventDetail.isManager` = host-only.
- `src/pages/EventDetailPage.tsx` — `isHost` vs `isManager = isHost || isCohost`
  gating; People-tab promote/demote (ShieldCheck / ShieldOff).
- `src/components/casting/{SongCastPanel,EventCastGrid,LineupCard}.tsx` — the
  casting console.
- `src/pages/{HomePage,SongsPage,FriendsPage,EventsPage,CalendarPage}.tsx`.
- Shared: `src/components/common/{EntityHeader,ScheduleMetaRow,BackLink}.tsx`,
  `src/utils/returnTo.ts`.
