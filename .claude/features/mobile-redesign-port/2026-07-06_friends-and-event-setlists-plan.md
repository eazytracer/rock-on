---
feature: mobile-redesign-port / Friends + Event Lineup ("event setlist")
doc: Updated task list + OPEN QUESTIONS — grounded in the FINALIZED static design specs
created: 2026-07-06
status: v1 SHIPPED (V1–V4 all done + verified) — Friends surface + Resolve + public-songs HELD/deferred
---

# Friends + Event Lineup ("event setlist") — plan & open questions

> **Source of truth = the FINALIZED static design specs** in the Claude Design "Rock On" project:
> `app/spec-rows/` (per-row split) + `app/Rock On - Design Spec.html` (master). Manifest: `_INDEX.md`.
> The `.js` prototype files (`events-data.js`, `screens-*.jsx`) are an **older prototype** — close but
> superseded by the static specs; do not treat them as authoritative.
> Rows reviewed for this doc: **15 Events · 16 EC1 Casting console · 17 EC2 Raise-a-hand/request/invite
> · 18 Friends & Notifications**, and FLOWs **06 Host an event · 07 Guest joins & plays · 08 Host
> manages**. Project: `https://claude.ai/design/p/019df065-4ee1-707b-bfd9-d821331f5cad`.

**"Event setlist" == the event LINEUP.** An event's song list is its **lineup**: ordered, source-tagged
songs, each carrying **parts** (per-instrument slots) that guests **raise a hand** for and the host
**casts**. A saved Setlist is _not_ the object here — the lineup is built on the event page (add
songs → set parts). `events.setlist_id` exists in schema but the finalized host flow adds songs
individually (see Q on seeding).

> **⭐ Casting is a SHARED model (user, 2026-07-06):** the lineup + parts + raise-a-hand + cast mechanic
> will be reused for **jam sessions** and eventually **bands**, after the UX is proven on events
> (the testbed). Build the casting/lineup layer — the parts data shape, `SongCastPanel`, the
> resolve/match flow, and List/Grid views — **surface-agnostic** (keyed by a generic context) so
> jam/band adoption is wiring, not a rewrite. `SongCastPanel` is already shared with setlist casting —
> keep event-only behavior behind guards (per the regression register).

---

## 0. OPEN QUESTIONS — please answer inline (these gate the task list)

**A. Events ↔ bands — ✅ ANSWERED (user, 2026-07-06)**

1. Events are **tied to a USER (personal-hosted), NOT a band** — keep `events.band_id` NULL for now.
   (Future: venue-users; an event may be hosted by a person, band, or venue — but v1 is personal only.)
   → **Implication for resolve/source:** the host's default catalog is their **personal** catalog
   (`mine`); a request/lineup song may still be tagged `band` (from a band they're in) or `public`
   (another user's) or `external`. My shipped auto-link currently matches only the host's _current-band_
   catalog — it should be widened to match the **host's personal catalog first**, then their band(s)
   (see L3). No open question here anymore; noting the follow-up.

**B. The PARTS model (the biggest net-new piece — EC1)** 2. Adopt the finalized model where each lineup song has a **list of parts**, each `{ instrument,
   label? }`, with **"Add part"** (add another of the same instrument, **auto-numbered Gtr 1 / Gtr 2**)?
Today casting derives parts from band roles, not a per-song editable part list. _Answer:_ 3. **Simple vs Detailed** part-naming is a per-event (or per-song?) toggle: **Simple** = by instrument
(auto-number dupes); **Detailed** = named sub-roles (Lead Gtr · Rhythm Gtr · Lead Vox · Backing).
Confirm event-level toggle, default **Simple**? _Answer:_ 4. Default instrument spine for parts = **vox · gtr · bass · drums · keys · bvox**? _Answer:_ How about we don't make any assumptions about what a song needs or what a person plays, when someone wants to raise their hand, they can simply check a box next to the instrument(s) they are open to playing. We can just start with a basic list of guitar, bass, drums, vox, keys, other (let them fill in the blank on other)

**C. Lineup building** 5. Host adds lineup songs from **your catalog / band / new** (each keeps a source tag). Confirm — and
is there a **"Browse songs"** sheet reused from setlists, plus a **new-song** path (→ external)?
_Answer:_ How about we allow users to create a setlist for jams and allow guests to see the setlist they share when creating an event, otherwise guests can manually type in a song and artist, if the host accepts it it is on the host to officially add the song to their catalog and fill in other metadata. 6. **Seed from a saved setlist** (`events.setlist_id`): still wanted as a shortcut ("attach a setlist →
fill the lineup"), or drop it since the finalized flow adds songs individually? _Answer:_ I don't think we need to seed it for now.

**D. Request → resolve (EC2 / FLOW 08)** 7. Build the explicit **ResolveSheet**? Finalized: the Requests queue tags each request **match**
(green) or **new** (grey); resolving shows the auto-match with a **confidence** ("**Exact match** in
Jess's public catalog") and offers **Link & add** (pulls links + tuning, credits owner) vs **Add as
external reference** vs **Reject**. (My shipped auto-link-on-approve is a partial — this replaces it
with the host choosing.) _Answer:_ Come back to this after we get the first parts done and tested. 8. Support **`public`** matches — linking a request to _another user's_ public-catalog song, credited
(the FLOW literally shows "in Jess's public catalog")? Needs a public-song read path. Or v1 =
`mine`/`band`/`external` only? _Answer:_ This is honestly tought to think about--they should likely be public to some degree, but let me think about it more. Perhaps they are just tied to the event itself (new fk) and members of it can see, but no actual user owns it--not sure how difficult that is in our construct. 9. Confidence tiers: **exact** (normalized title+artist) and **fuzzy** — do we compute fuzzy now, or
just exact-or-none for v1? _Answer:_ Don't worry about confidence right now.

**E. Casting views (EC1)** 10. Ship the **List / Grid** host toggle? Grid = songs × parts matrix, **sticky-left song column**,
horizontal scroll + edge fade, rarely-used instruments fold into a **+N** column; cells show cast
avatar or hands-raised number; tap → same Cast sheet. _Answer:_ Yes, this is the main piece we need to see and test. 11. **Free-text cast** — host casts a name for someone who won't/can't join the app (a cast row with a
`display_name`, no `user_id`). Include? _Answer:_ Yes

**F. Invite friends → event (ties Friends↔Events)** 12. Build **Invite friends** (in the Access card): multi-select from your friends → adds
`event_participants` (guest, RSVP pending) + the existing code/link/QR. Needs the co-participant
name-visibility RLS (mirror `users_select_jam_coparticipant`). _Answer:_ Yes

**G. Friends surface itself** 13. The **finalized** Friends spec is minimal — "friend-code card (copy + QR) · discoverable toggle ·
Requests · Friends list… **already token-clean**." That's ≈ what's shipped. The elaborate
**name-finder / mutual-friends / "who can send requests" / code-reset / per-user instruments** were
in the **old prototype only** and are **not** in the finalized spec. Confirm we treat Friends as
**done** (just the invite-to-event wiring in F12), or do you still want any of those old-prototype
extras pulled forward? _Answer:_ We actually probably need more of the old prototype in the spec--standby on this and I will review with the design agent.

**H. Notifications (deviation to confirm)** 14. Finalized #9 wants a notification to **name** its band/event AND **opening switches context**. You
earlier scoped #10 to _name-only, manual switch_ (shipped). Keep manual, or add the **auto-switch
on open** to match the finalized spec? And confirm we mint `notifications.payload`
(`{bandId,bandName}`/`{eventId,eventName}`) on friend-request / event-invite / cast events so the
chip + deep-links work. _Answer:_ Keep name only for now.

**I. Build strategy** 15. Given casting → jam → bands: build the **shared, context-generic** casting layer **up front**
(more now, cheap reuse later), or keep iterating **event-first** and extract the shared abstraction
when jam adoption starts? _Answer:_ Use your judgement.

---

## 1. What's already shipped (baseline)

- **Friends:** `FriendsPage` (right-rail desktop) — friend-code card + copy + QR, `discoverable`
  toggle, incoming/sent requests, add-by-code, friends list. DB: `user_profiles.discoverable` +
  `friend_code` + `gen_friend_code()` + `resolve_friend_code()` RPC + friendships/requests tables.
  **≈ matches the finalized minimal spec.**
- **Events / lineup / casting (#5 + recent):** host-owned events (`band_id` NULLABLE),
  `event_participants` (host/cohost/guest/viewer + rsvp), tabbed EventDetail (Lineup · Requests ·
  People · Access), guest **raise-a-hand** (`event_hands`), host **cast** (`SongCastPanel`), a
  Simple/Detailed cast view, request → approve (promote trigger → lineup item), Access tab
  (visibility/code/QR + allow-suggestions/auto-approve), source pills. **Just shipped:** approving a
  request auto-links it to the host's current-band catalog (→ "Band" pill) when title/artist matches —
  a partial of the ResolveSheet. Events master/detail on desktop.

## 2. DECIDED v1 build (answers recorded 2026-07-06). Each = local-only, security-reviewed where RLS

changes, e2e + Playwright.

**Simplified casting model (per Q4):** NO host-defined per-song parts, NO Simple/Detailed. A **fixed
instrument set** — `guitar · bass · drums · vox · keys · other` (**other = free-text**). A guest
raises a hand by **checking the instrument(s)** they're open to playing on a song; the host casts a
raised hand (or a free-text name) onto an instrument. Maps onto the existing schema: `role_key` =
instrument; band-less events use this fixed default set instead of `band_roles`.

**Build order — ✅ V1–V4 ALL SHIPPED + verified (see commits below):**

- ✅ **V1 (`50d73c0`)** — fixed instrument set. ✅ **V2 (`9d90c00`)** — Grid cast view.
  ✅ **V3** — free-text cast (in Grid `9d90c00` sheet + the List `SongCastPanel` `cast-freetext-*` path).
  ✅ **V4 (`7801c33`)** — invite friends. **Note the RLS turned out to be a no-op:** the
  co-participant name visibility (`users_select_event_coparticipant`) AND the manager-insert branch of
  `event_participants_insert_self` were both already shipped + security-reviewed in the
  social_events / event_code_join migrations — so V4 needed NO schema/RLS change, purely frontend.
- **V1 — Instrument set + raise-a-hand-by-checkbox.** A fixed event role set
  (`guitar/bass/drums/vox/keys/other`, `other` free-text) used for personal (band-less) events instead
  of `band_roles`. Guest raise-a-hand UI = check instrument(s) per song → `event_hands` rows. Build the
  role source **context-generically** (Q15 = my judgement → event-first, thin generic seam so
  jam/bands reuse later). Audit the current `useCasting`/`SongCastPanel` role sourcing for band-less
  events and point it at this set.
- **V2 — Grid casting view (THE priority, Q10).** Songs × instruments matrix on the host event detail,
  List/Grid toggle; sticky-left song column, horizontal scroll + edge fade, rarely-used instruments
  fold into `+N`; cell = cast avatar or hands-raised number; tap → the existing Cast sheet. New
  frontend view over `event_lineup_items` × instruments + `event_hands` + `casting_assignments`.
- **V3 — Free-text cast (Q11).** Cast a name with no app account. `casting_assignments` already has
  `member_name` (+ nullable `member_id`) — wire a "type a name" path in the Cast sheet; render it in
  List + Grid. Little/no schema change.
- **V4 — Invite friends to an event (Q12).** Multi-select from friends → `event_participants` (guest,
  RSVP pending) alongside the existing code/link/QR. Needs a **co-participant name-visibility RLS**
  (mirror `users_select_jam_coparticipant`). **RLS → security review + negative tests.**

**Deferred (user):**

- **Resolve flow / ResolveSheet (Q7)** — revisit after V1–V2 are tested. Keep the current
  auto-link-on-approve for now, but widen its match to the host's **personal** catalog first (events
  are user-tied), then bands.
- **Public / event-owned songs (Q8)** — user thinking; idea floated = songs tied to the event itself
  (new FK, event members see, no user owns). Don't build yet.
- **Confidence / fuzzy match (Q9)** — skip.
- **Seed-lineup-from-setlist (Q6)** — not now. (Q5: a host may _share a setlist_ guests can view; guests
  otherwise type song+artist as a request; on accept the host adds it to their catalog manually.)

**HELD (pending user's designer review):**

- **Friends surface (Q13)** — user wants _more_ of the old prototype than the finalized minimal spec;
  DO NOT touch friends screens until the designer changes land.
- **Notifications (Q14)** — stay name-only (shipped). No switch-on-open, no payload minting yet.

## 3. Docs to clean up (superseded — recommend archive after you confirm nothing unique is lost)

`2026-07-02T04:55_research.md`, `2026-07-02T05:00_plan.md`, `2026-07-02T13:44_db-schema-proposal.md`,
`2026-07-02T22:49_casting-design.md`, `2026-07-03T07:00_social-events-plan.md` (has your inline notes —
folded into Q above), `2026-07-03T17:04_bandless-user-flow-plan.md`, `2026-07-02T15:00_design-fidelity-
audit.md`. **Keep:** `TASKLIST.md` + this doc. The Claude Design `app/spec-rows/` is the design SoT.
