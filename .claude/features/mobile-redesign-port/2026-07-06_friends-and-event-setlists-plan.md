---
feature: mobile-redesign-port / Friends + Event Setlists (lineup)
doc: Updated task list + OPEN QUESTIONS (grounded in the Claude Design "Rock On" project)
created: 2026-07-06
status: NEEDS ANSWERS — task list is provisional until the Open Questions below are resolved
---

# Friends + Event "Setlists" (Lineup) — plan & open questions

> **Source of truth = the Claude Design "Rock On" project**
> `https://claude.ai/design/p/019df065-4ee1-707b-bfd9-d821331f5cad`
> Reviewed: `app/DESIGN_NOTES.md`, `app/events-data.js`, `app/screens-friends.jsx` (+ the event
> screens referenced there). The local dated `.claude/features/mobile-redesign-port/*.md` planning
> docs are **largely superseded** by that project + what's already shipped — see “Docs to clean up”
> at the bottom.

**"Event setlist" == the event LINEUP.** In the design an event's song list is the **lineup**: an
ordered set of source-tagged songs, each with **roles** (vox/gtr/bass/drums/keys/bvox) that guests
**raise a hand** for and the host **casts**. There is no separate "event setlist" object — a saved
Setlist can _seed_ an event's lineup (`events.setlist_id`), but the lineup is the working artifact.

> **⭐ Design principle (user, 2026-07-06): casting is a SHARED model, not an events-only feature.**
> The lineup + roles + raise-a-hand + cast mechanic is intended to be reused for **jam sessions** and
> eventually **bands** (setlists/shows), once the UX is proven on events and the clunkiness is worked
> out. **Events are the first testbed.** Build the casting/lineup pieces — the data shape
> (`source`/roles/hands/assigned), the `SongCastPanel`, the resolve/match flow, and the List/Grid
> views — as **surface-agnostic, reusable components/services** keyed by a generic
> `{contextType: 'event'|'jam'|'setlist', contextId}`, so jam + band adoption is a wiring exercise, not
> a rewrite. Avoid event-only assumptions in the shared layer (e.g. `SongCastPanel` is already shared
> with setlist casting — keep event-only behavior behind guards, per the regression register). This
> shifts several "which catalog / which roles" questions below from event-specific to
> **context-generic** answers.

---

## 0. OPEN QUESTIONS — please answer inline (these gate the task list)

**A. Events ↔ bands**

1. Should an event be **associated with a band**? Today `createEvent` leaves `events.band_id` NULL
   (host-owned, band-less). My just-shipped EC2 (request→catalog auto-link) matches against the
   **host's current band context** to avoid this decision. Do you want events to actually carry a
   `band_id` (set to the host's current band at create), or stay band-less + always resolve catalog
   via "host's current band"? _Answer:_

**B. Seeding a lineup from a setlist (`events.setlist_id`)** 2. When a host attaches a saved **Setlist** to an event, should it **one-time seed** the lineup
(copy songs in, then they diverge) or stay **live-linked** (setlist edits reflect on the event)?
_Answer:_ 3. Which songs from the setlist become lineup rows — songs only (skip breaks/section headers), and
what `source` do they get (`band` if it's a band setlist, `mine` if personal)? _Answer:_

**C. Casting people + roles** 4. Confirm casting draws from **event participants** (guests), not band members (the design + your
earlier note say anyone who joins can volunteer for any role — no instrument gating). Yes? _Answer:_ 5. For a **band-less** event, what is the default **role set**? Design uses vox · gtr · bass · drums ·
keys · bvox. Use that as the default lineup role spine? _Answer:_ 6. You said a host should be able to **type a free-text name** for someone who won't/can't join the
app and cast them. Store that as a cast row with a `display_name` and no `user_id`? _Answer:_

**D. Request → resolve depth** 7. EC2 already auto-links an approved request when title/artist matches the catalog (→ "Band" pill).
The design's **ResolveSheet** is richer: it shows the auto-match with a **confidence (exact/fuzzy)**
and lets the host choose **"Link & add"** (pull tuning/links/credit owner) vs **"Add as external
reference"**. Do you want that explicit resolve UI now, or is the current auto-link-on-approve
enough for v1? _Answer:_ 8. Do we support **`public`** source (linking to _another user's_ public catalog song, credited), or
just `mine` / `band` / `external` for now? (`public` needs a public-song visibility + read path.)
_Answer:_

**E. Casting views** 9. Ship the **Grid/matrix** casting view (songs × parts, sticky song column) alongside the current
list, behind a host **View: List / Grid** toggle (design EC1)? Or defer Grid? _Answer:_
9b. **Shared-model build strategy** (given casting → jam → bands): build the reusable
context-generic casting layer **up front** (a bit more work now, cheap jam/band adoption later), or
keep iterating **event-first** and extract the shared abstraction once jam adoption starts?
_Answer:_

**F. Friends depth** 10. **Name finder:** the design lets you search **discoverable** users by name and send a request
(not just add-by-code, which is all we ship today). Build it? It needs a SECURITY-DEFINER search
RPC over `user_profiles WHERE discoverable` (mirrors the existing `resolve_friend_code` pattern).
_Answer:_ 11. **"Who can send you requests"** = Everyone / Friends-of-friends / Code-only. Add this setting +
enforce it on friend-request creation? _Answer:_ 12. **Mutual-friends count** (shown on requests + finder). Compute via an RPC over the friend graph?
Any privacy limit (e.g. only show mutuals if both are discoverable)? _Answer:_ 13. **Regenerate friend code** (design has a reset button). Add it? _Answer:_ 14. The design shows **per-user instruments** on friend rows + uses them for role hints. We don't
store instruments per user today. Add a `UserProfile.instruments`? (Also useful for casting
suggestions.) _Answer:_

**G. Notifications wiring (ties to #10)** 15. Friend requests, event invites, and casting decisions are the natural notification triggers. When
we mint those server-side, populate `notifications.payload` with `{ bandId, bandName }` /
`{ eventId, eventName }` so the (already-built) cross-context chip + deep links work. Confirm we
should add that minting as part of this work? _Answer:_

**H. Guest accounts / join flow (from your earlier notes)** 16. You want signup to ask: **have a band code? event code? start a band? or just a personal
account?** (partially built — #8 onboarding + event-code-at-signup). Do you want the **event-code**
path fully wired into signup here, and **no unlisted-guest** for events (that stays jam-only)?
_Answer:_

---

## 1. What's already shipped (baseline)

**Friends (built):** `FriendsPage` (right-rail on desktop), friends list, incoming/sent requests,
**add-by-code**, friend code + copy + QR, `discoverable` toggle. DB: `user_profiles.discoverable` +
`friend_code` + `gen_friend_code()` + `resolve_friend_code()` SECURITY-DEFINER RPC + friendships /
friend_requests tables (`20260702142222_friends.sql`).

**Events / lineup / casting (#5, built):** host-owned events (`events`, band_id NULLABLE),
`event_participants` (host/cohost/guest/viewer + rsvp), tabbed EventDetail (**Lineup · Requests ·
People · Access**), guest **raise-a-hand** (`event_hands`) → host accept/decline, **cast**
(`SongCastPanel`), request → approve (promote trigger → lineup item), Access tab (visibility/code/QR

- allow_suggestions/auto_approve), source pills (mine/band/public/external), Events master/detail on
  desktop. **EC2 (just shipped):** approving a request auto-links it to the host's current-band catalog
  (→ "Band" pill) when title/artist matches.

**Not built (the gaps this plan covers):** friend **name-finder**, "who can send requests", mutuals,
code-reset; event **invite-friends** flow, **seed-lineup-from-setlist** (`setlist_id` unused),
**resolve-with-confidence** UI, **Grid** casting view, **free-text cast name**, richer create-flow
presets.

---

## 2. Task list — FRIENDS track (each = local-only, security-reviewed where RLS changes, e2e + Playwright)

- **F1 — Friend name-finder.** SECURITY-DEFINER RPC to search `user_profiles WHERE discoverable=true`
  by name (never leak hidden users), exclude self + existing friends; `FriendsService.search()` +
  wire the `AddFriend` finder UI (search box + results + Add → request). _Gated by Q10._
- **F2 — "Who can send you requests."** Add `user_profiles.request_privacy ∈
(everyone|fof|code)` (migration + grant + RLS); enforce on friend-request INSERT (policy or RPC);
  segmented control in the Friends profile-visibility card. _Gated by Q11._ **RLS → security review +
  negative tests.**
- **F3 — Mutual-friends count.** RPC counting shared friends between me and a target; show on
  incoming requests + finder rows. _Gated by Q12._
- **F4 — Regenerate friend code.** `FriendsService.resetCode()` (re-run `gen_friend_code`, enforce
  UNIQUE); button in the code card. _Gated by Q13._
- **F5 — (optional) per-user instruments.** `user_profiles.instruments TEXT[]`; edit in profile;
  render on friend rows; feed casting role-suggestions. _Gated by Q14._

## 3. Task list — EVENT SETLISTS / LINEUP track

- **E1 — Seed lineup from a saved setlist.** Use existing `events.setlist_id`. On event create/detail
  let the host **attach a setlist**; expand its songs into `event_lineup_items` (source `band`/`mine`,
  default empty roles). Seed-vs-live per Q2; song mapping per Q3. _Gated by Q2, Q3._
- **E2 — Invite friends to an event.** `InviteSheet`: multi-select from friends → `event_participants`
  (guest, rsvp pending) + the existing share code/link/QR. Wires Friends↔Events. Needs the
  co-participant name-visibility RLS (mirror `users_select_jam_coparticipant`) so guest names resolve.
  **RLS → security review.**
- **E3 — Resolve-with-confidence (deepen EC2).** A `ResolveSheet` on approve: show auto-match +
  `confidence` (exact/fuzzy), host picks **Link & add** (adopt tuning/links, credit owner) vs **Add as
  external**. Builds on EC2's matcher. _Gated by Q7 (and Q8 for `public`)._
- **E4 — Casting depth.** Confirm cast-from-participants + band-less default roles (Q4/Q5); **free-text
  cast name** (Q6); **Grid/matrix** view behind a **View: List/Grid** host toggle (Q9, = EC1).
- **E5 — Create-flow presets.** Extend `EventCreatePage` (today name/date/venue only) with **type**
  (gig / open jam / party / blank) seeding visibility + allow-suggestions defaults (`TYPE_PRESET`),
  and band association per Q1.
- **E6 — Notification minting.** On friend-request / event-invite / cast, mint `notifications` with
  `payload.{bandId,bandName}` / `{eventId,eventName}` so the shipped #10 chip + deep-links light up.
  _Gated by Q15._

**Suggested order:** F1 → F2 → E2 (friends become useful _in_ events) → E1 → E3 → E4 → E5 → F3/F4/F5
→ E6. Adjust once questions are answered.

---

## 4. Docs to clean up (superseded by the Claude Design project + shipped code)

These local dated planning docs are **historical rationale only** and now superseded — recommend
archiving/removing after you've confirmed nothing unique is lost (I've folded the still-live
decisions into this doc + TASKLIST):

- `2026-07-02T04:55_research.md`, `2026-07-02T05:00_plan.md` — pre-build research/plan; the app is now
  built well past them.
- `2026-07-02T13:44_db-schema-proposal.md` — schema landed in the real migrations (baseline + feature
  files); this proposal is stale.
- `2026-07-02T22:49_casting-design.md` — casting shipped as #5; design detail now lives in the Claude
  Design project.
- `2026-07-03T07:00_social-events-plan.md` — **has your inline answers** (personal-account join flow;
  volunteering = willing-to-play + host casts + free-text name; no unlisted-guest for events, jam-only).
  Those are captured in Q6/Q16 here — safe to archive after you confirm.
- `2026-07-03T17:04_bandless-user-flow-plan.md` — band-less flow shipped.
- `2026-07-02T15:00_design-fidelity-audit.md` — Part 1 styling done.

**Keep:** `TASKLIST.md` (living source of truth) and this doc.
