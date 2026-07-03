---
feature: mobile-redesign-port / social events + friends integration
doc: Plan — make events user-hosted & social (guests, invites, volunteering)
created: 2026-07-03T07:00
status: PLAN — provisional defaults adopted; HOLD build until user confirms direction
---

# Social Events + Friends Integration

## The insight (user)

Events shouldn't be band-tied — an **event is hosted by a USER**, and **guests (incl. non-band,
lightweight accounts) volunteer to play parts**. Casting today only offers band members. Friends is
built but not wired to events.

## Where we actually are (verified)

- **DB already supports the vision:** `events.band_id` is NULLABLE (user-hosted, no band OK);
  `event_participants` has `guest`/`viewer` tiers + RSVP; **casting scopes assignable people to
  `is_event_participant` (event participants), NOT band membership** (casting migration L161/185).
- **The bias is in the UI/service:** `SongCastPanel` picks from `useBandMembers` (band-only); roles
  come from `band_roles` (band-only → band-less events have no parts); no invite/join/volunteer flow.
- **Friends** = standalone (codes/requests/friendships/FriendsPage), NOT connected to events.

## Pieces to realize it

| #   | Piece                                   | Notes / risk                                                                                                                                                                                                                                       |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Cast from PARTICIPANTS not band members | `EventService.getParticipants()`; `SongCastPanel` takes a members list. Needs a **co-participant name-visibility RLS policy** (mirror the proven `users_select_jam_coparticipant` pattern) so guest names resolve. LOW risk (established pattern). |
| B   | Band-less role set                      | `useCasting` falls back to a default lineup when no `bandId`. Trivial.                                                                                                                                                                             |
| C   | Invite flow                             | friends multi-select + share link/`short_code` + QR → `event_participants` + RSVP. New UI/service. Friends↔Events.                                                                                                                                |
| D   | Guest volunteering ("raise hand")       | guest self-nominates for a part; host casts from volunteers (prototype's core). New mechanic.                                                                                                                                                      |
| E   | Lightweight guest accounts              | join unlisted event by link/code, minimal/anonymous signup, no band. **Security-sensitive** (anonymous RLS, abuse).                                                                                                                                |

## Provisional decisions (my recommendation — awaiting user confirm)

1. **Order:** "Core first" = A + B + C (user-hosted + cast guests + invite). Defer D + E.
2. **Guest accounts (for E):** minimal signup (email + name, no band) over anonymous — durable identity
   for history/notifications, simpler/safer RLS. (Only matters once we do E.)

## Recommended build order once confirmed (each = validate loop, LOCAL, security-reviewed)

1. **A + B** — un-bias casting to participants + band-less roles + the co-participant visibility policy
   (new migration, mirror jam pattern). Directly fixes "I can only cast band members." Lowest risk.
2. **C** — invite friends/guests to an event (link/code/QR + RSVP). Wires Friends into Events.
3. **D + E** — volunteering + lightweight/anonymous guest accounts. Do a security/RLS design pass
   FIRST (anonymous access is the sharp edge; mirror the jam anon-view + view_token model).

## Open questions to resolve before D/E

- Anonymous vs minimal-signup guests (RLS/history/abuse tradeoffs).
  Correct, I want to be able to support members joining the app with personal accounts--this needs to be folded in to the auth flow, as well. When someone signs up we should ask if they have a band code or an event code, if they want to start a new band, or if they just want to make a personal account.
- How volunteers ("hands") relate to casting rows (separate volunteer state vs `is_primary=false`
  pre-cast) — likely a distinct `event_volunteers` concept so a hand ≠ a cast.
  Volunteering is someone saying they are willing to play a part in a given song, multiple people might volunteer, the host will select who is playing it actually and "cast"/"assign" them to the part on the song. The UI for this was really well done in the design doc--use for reference, ours is a bit different still. We should also support a host just typing in a text field name for someone that can't/won't make/join the app.
- Reuse the jam `view_token` + `short_code` + confusable-free alphabet for unlisted guest join. We won't support unlisted guest for events, but we will keep that for jam sessions for now--as I see those being ran by venues in the future if we add venues as a user group.
