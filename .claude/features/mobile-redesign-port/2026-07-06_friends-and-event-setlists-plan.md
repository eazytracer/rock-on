---
feature: mobile-redesign-port / Friends + Event Lineup ("event setlist")
doc: Updated task list + OPEN QUESTIONS — grounded in the FINALIZED static design specs
created: 2026-07-06
status: NEEDS ANSWERS — provisional until the Open Questions are resolved
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
Confirm event-level toggle, default **Simple**? _Answer:_ 4. Default instrument spine for parts = **vox · gtr · bass · drums · keys · bvox**? _Answer:_

**C. Lineup building** 5. Host adds lineup songs from **your catalog / band / new** (each keeps a source tag). Confirm — and
is there a **"Browse songs"** sheet reused from setlists, plus a **new-song** path (→ external)?
_Answer:_ 6. **Seed from a saved setlist** (`events.setlist_id`): still wanted as a shortcut ("attach a setlist →
fill the lineup"), or drop it since the finalized flow adds songs individually? _Answer:_

**D. Request → resolve (EC2 / FLOW 08)** 7. Build the explicit **ResolveSheet**? Finalized: the Requests queue tags each request **match**
(green) or **new** (grey); resolving shows the auto-match with a **confidence** ("**Exact match** in
Jess's public catalog") and offers **Link & add** (pulls links + tuning, credits owner) vs **Add as
external reference** vs **Reject**. (My shipped auto-link-on-approve is a partial — this replaces it
with the host choosing.) _Answer:_ 8. Support **`public`** matches — linking a request to _another user's_ public-catalog song, credited
(the FLOW literally shows "in Jess's public catalog")? Needs a public-song read path. Or v1 =
`mine`/`band`/`external` only? _Answer:_ 9. Confidence tiers: **exact** (normalized title+artist) and **fuzzy** — do we compute fuzzy now, or
just exact-or-none for v1? _Answer:_

**E. Casting views (EC1)** 10. Ship the **List / Grid** host toggle? Grid = songs × parts matrix, **sticky-left song column**,
horizontal scroll + edge fade, rarely-used instruments fold into a **+N** column; cells show cast
avatar or hands-raised number; tap → same Cast sheet. _Answer:_ 11. **Free-text cast** — host casts a name for someone who won't/can't join the app (a cast row with a
`display_name`, no `user_id`). Include? _Answer:_

**F. Invite friends → event (ties Friends↔Events)** 12. Build **Invite friends** (in the Access card): multi-select from your friends → adds
`event_participants` (guest, RSVP pending) + the existing code/link/QR. Needs the co-participant
name-visibility RLS (mirror `users_select_jam_coparticipant`). _Answer:_

**G. Friends surface itself** 13. The **finalized** Friends spec is minimal — "friend-code card (copy + QR) · discoverable toggle ·
Requests · Friends list… **already token-clean**." That's ≈ what's shipped. The elaborate
**name-finder / mutual-friends / "who can send requests" / code-reset / per-user instruments** were
in the **old prototype only** and are **not** in the finalized spec. Confirm we treat Friends as
**done** (just the invite-to-event wiring in F12), or do you still want any of those old-prototype
extras pulled forward? _Answer:_

**H. Notifications (deviation to confirm)** 14. Finalized #9 wants a notification to **name** its band/event AND **opening switches context**. You
earlier scoped #10 to _name-only, manual switch_ (shipped). Keep manual, or add the **auto-switch
on open** to match the finalized spec? And confirm we mint `notifications.payload`
(`{bandId,bandName}`/`{eventId,eventName}`) on friend-request / event-invite / cast events so the
chip + deep-links work. _Answer:_

**I. Build strategy** 15. Given casting → jam → bands: build the **shared, context-generic** casting layer **up front**
(more now, cheap reuse later), or keep iterating **event-first** and extract the shared abstraction
when jam adoption starts? _Answer:_

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

## 2. Gap → task list (finalized spec vs shipped). Each = local-only, security-reviewed where RLS

changes, e2e + Playwright.

**Event lineup / casting (the bulk):**

- **L1 — Parts model.** Per-song editable **parts** list `{instrument,label?}` + **Add part**
  (auto-number dupes) + **Simple/Detailed** naming. Schema: how parts attach to `event_lineup_items`
  (a `parts` child table or JSON). Feeds both List + Grid + Cast sheet. _Gated by Q2–Q4._ **Shared
  layer** (Q15).
- **L2 — Lineup builder.** Host adds songs to the lineup (Browse-songs sheet reused from setlists /
  new-song → external), each source-tagged. Optional **seed-from-setlist** (Q6). _Gated by Q5–Q6._
- **L3 — Resolve flow.** Requests queue **match/new** tags → **ResolveSheet** (confidence + Link & add
  vs external vs reject); replaces the silent auto-link. Since events are user-tied (Q1), match against
  the **host's personal catalog first**, then their band(s), then `public`. `public` support per Q8,
  fuzzy per Q9. _Gated by Q7–Q9._
- **L4 — Grid view.** List/Grid host toggle; matrix with sticky song column + `+N` overflow; cell tap
  → Cast sheet. _Gated by Q10._
- **L5 — Free-text cast.** Cast a `display_name` with no `user_id`. _Gated by Q11._
- **L6 — People + progress.** Roster w/ RSVP + parts-cast count; cast-progress bar + "Fully cast"
  flags. (Partly present — audit + fill.)

**Friends ↔ Events:**

- **X1 — Invite friends.** Multi-select friends → `event_participants` + co-participant name RLS +
  code/link/QR. **RLS → security review.** _Gated by Q12._

**Friends surface:**

- **F0 — Confirm "done."** Per Q13, likely no work beyond X1 unless you want old-prototype extras.

**Notifications:**

- **N1 — Payload minting + (optional) switch-on-open.** Mint `payload` on friend/event/cast; optionally
  auto-switch context on open to match finalized #9. _Gated by Q14._

**Suggested order:** L1 → L2 → L3 → L4 → X1 → L6 → L5 → N1. (F0/friends first only if extras are
wanted.) Finalize after answers.

## 3. Docs to clean up (superseded — recommend archive after you confirm nothing unique is lost)

`2026-07-02T04:55_research.md`, `2026-07-02T05:00_plan.md`, `2026-07-02T13:44_db-schema-proposal.md`,
`2026-07-02T22:49_casting-design.md`, `2026-07-03T07:00_social-events-plan.md` (has your inline notes —
folded into Q above), `2026-07-03T17:04_bandless-user-flow-plan.md`, `2026-07-02T15:00_design-fidelity-
audit.md`. **Keep:** `TASKLIST.md` + this doc. The Claude Design `app/spec-rows/` is the design SoT.
