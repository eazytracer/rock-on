# 06 · Open decision: Events vs Jam

**Status: not decided.** Eric will settle it in the final design review after trying the jam flow.
Until then: don't delete, rename or restyle `/events` or the casting code; phases 0–6 don't need it.

## What's in the app today (v0.5.0)

Two separate social features:

- **Events** (0.4, Jul 2026): `/events`, `/events/new`, `/events/:id`. A hosted event with a join code, RSVP, a lineup of songs, guest song requests (approve / auto-approve), **casting** (parts per song, raised hands per part, a cast grid, a cast-assign sheet, co-hosts), and a public view. Tables: `events`, `event_participants` (access tier + RSVP), `event_lineup_items`, `event_lineup_requests`, `event_hands`, plus `band_roles` / `casting_*`.
- **Jam sessions** (0.3, Apr 2026): `/jam`, `/jam/:id`, `/jam/view/:code`. Participants share their catalogs and the app finds songs in common (`jam_song_matches`); can be saved as a setlist. Tables: `jam_sessions`, `jam_participants`, `jam_song_matches`.

## What the redesign specifies

**One type, called Jam**, on the calendar beside shows and practices (DECISIONS → Jam, Oct 31):

- **Planned** phase: lineup, requests (pitches with the parts they need), people, access (code, QR, table tent), settings (who can join, requests on, approve myself, group sets).
- **Go live**: a host console (on stage, Up next with open parts, fill from hands / house players / ask the room, Call up anyway, queue actions), guests raise hands per part and pitch songs; coverage ranks the pitches; a bar TV and a counter iPad.
- **Never required**: walk-ups by name, web guests without an account, "just tell the host". No logging; marking songs played is optional.
- **Casting** stays an exploration (future / Pro).

The whole flow runs in `demo/Jam Night.html` (design project): open it, use **Open a guest window**, and run a jam with
host and guest side by side, or use **Simulate the room**.

## How the two overlap

The redesign's Jam is closer to today's **Events** than to today's **Jam sessions**: code + public view, lineup,
requests with approval, hands per part, RSVP. What Events lacks for the Jam design is mostly the live night:
a `live` status, a per-item queue state, walk-ups and kiosk people without accounts, house players, group size
(04-data → Jams has the column-level list). Catalog matching (today's Jam sessions) maps to the design's
"who knows your songs" and coverage ranking.

## Options

| | What it means | Cost | Risk |
|---|---|---|---|
| **A. Jam on the Events tables** | Rename Events → Jam in the UI; extend `events` / `event_*` for live mode, walk-ups, queue state; fold catalog matching in as a service; casting UI hidden behind a `CASTING` flag (tables kept) | Medium: additive migration, new host console and guest screens, retire the 0.3 jam UI | Users of Events see a renamed, reshaped feature; casting disappears from view until re-enabled |
| **B. Keep Events + casting, add Jam** | Events stays as built (restyled in the new look); the redesign's Jam is built on the 0.3 jam tables, extended | High: two social features to maintain and explain; two "join with a code" flows | Overlap confuses people ("is this an event or a jam?") |
| **C. Jam on Events, drop casting** | As A, but the casting UI and tables are retired (data migration or archive) | Medium + a removal migration | Removes a shipped capability; DECISIONS requires asking first |

Questions to answer in the review, ideally after running a jam in Jam Night:

1. Is "Jam" the right word for every social night (open mic, birthday jam, house session), or is "Event" the umbrella with jam as one kind?
2. Does anyone use casting (assigning parts ahead of time)? If yes, is it part of planning a jam (the Lineup tab already shows parts per song), or a separate Pro tool?
3. Is the 0.3 catalog matching worth keeping as "who knows your songs" in the guest view?

## What happens after the decision

Write the choice into `source/DECISIONS.md` (design project) and here, then plan phase 7 in `05-plan.md`
with the data changes from 04 → Jams for the chosen option.
