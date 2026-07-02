---
created: 2026-04-29T06:06
status: research / open-questions
related:
  - .claude/artifacts/context-specific-casting-system.md
  - .claude/artifacts/2026-04-02T20:34_jam-session-user-flows.md
  - .claude/artifacts/2026-04-03T00:50_jam-user-goals-and-scenarios.md
  - .claude/artifacts/2026-04-19T21:21_schema-review-and-forward-compat.md
  - .claude/artifacts/2026-04-24T02:30_v0.3.1-post-mortem-and-next-session-handoff.md
  - .claude/specifications/functionality-catalog.md
  - .claude/backlog/BACKLOG.md (social-catalog initiative)
prompt-summary: |
  Captured the five open product decisions that gate design work on
  "open-jam venue mode" — a redirection of the jam-session feature
  toward venues hosting open-jam events with anonymous walk-up
  participants who pick instruments and get assigned to songs by the
  host. Also folds in instrument-based casting for regular band
  setlists/shows.
---

# Open-jam venue mode — open questions

This document captures **decisions that need product answers** before any
schema or UI work proceeds. It assumes the reader has not seen the prior
research conversation, so it inlines just enough context to make the
questions answerable without re-running the exploration.

When you bring this to a future prompt, the right opening move is:

> Read `.claude/backlog/open-jam-venue-mode/2026-04-29T06:06_open-questions.md`,
> then ask me the five decisions in §3 one at a time. Once I've answered
> all five, draft the design artifact (schema deltas + UI spec + phased
> rollout) and write it to `.claude/artifacts/`.

---

## 1. The directional shift

The jam-session feature was originally built as a host broadcasting a
setlist to band members + anonymous viewers (read-only). The new direction
is two layered changes:

| Layer             | Today                                                                                | Proposed                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Casting model     | Per-song member assignments with closed `RoleType` enum, member = authenticated user | Same idea, but accept anon "session participants" as assignable identities, and let the participant declare which instruments they can play |
| Jam session model | Host broadcasts a setlist; participants see what's coming                            | Host runs an open-jam **event**: anyone scans/joins, picks instruments they play, host assigns them per song as the night progresses        |

Both changes converge in one place: a per-song "who's playing what" view
that needs to handle both authenticated band members and anonymous
walk-ups. Same data model serves regular band setlists/shows AND open-jam
events.

---

## 2. Current-state cheat sheet (so the questions make sense)

### Casting today is dead code

All five casting tables exist in the baseline migration
(`supabase/migrations/20251106000000_baseline_schema.sql:444-502`) and the
TS models exist (`src/models/SongCasting.ts:1-164`), but:

- **No UI mounts it.** The four components in `src/components/casting/`
  are imported by zero pages or routes. Dead.
- **Bypasses the repository layer.** `CastingService.ts` writes Dexie
  directly — would never reach Supabase even if mounted. Violates the
  CLAUDE.md repository guardrails.
- **Three runtime-fatal SQL/TS mismatches:**
  1. `assignment_roles.type` SQL CHECK is `'instrument'|'vocal'|'technical'`,
     TS enum is `'vocals_lead'|'guitar_rhythm'|...` — every insert would
     violate the check.
  2. `song_castings.context_type` SQL allows `'band'|'setlist'|'session'`;
     TS allows `'template'`.
  3. `casting_templates.context_type` SQL is `'band'|'setlist'|'session'`;
     TS is `'acoustic'|'electric'|'practice'|'custom'`.
- **Broken Dexie compound index** in `CastingService.getCasting`
  (`src/services/CastingService.ts:38-39`) — would throw on first call.
- **RLS hole.** All 5 casting tables have RLS enabled with **zero
  policies** — already flagged as RLS-3 in
  `.claude/artifacts/2026-04-19T21:21_schema-review-and-forward-compat.md`.
- **Two unconnected instrument concepts coexist:**
  - Free-text `UserProfile.instruments: string[]` — what the app actually
    uses (auth, band membership, members page).
  - Closed `RoleType` enum — only referenced inside the dead casting tree.

The original PRD `.claude/artifacts/context-specific-casting-system.md`
is more coherent than what shipped — re-read before any redesign.

### Jam sessions today are solid but single-purpose

- **Working:** short-code create/join, host setlist edits broadcast to
  participants via `jam_sessions` row UPDATE, anonymous view via signed
  token + `jam-view` edge function (5s poll), Supabase presence channel
  for "watchers", save-as-setlist terminal action.
- **Anonymous access is read-only at the DB layer.**
  `jam_participants.user_id NOT NULL REFERENCES users(id)`; RLS
  `WITH CHECK (user_id = auth.uid())` makes anon participant rows
  impossible. Anon viewers exist only as ephemeral presence entries with
  a chosen display name.
- **No "now playing" / advance / playback concept.** Setlist is a static
  ordered list — adding a current-song pointer is greenfield.
- **No casting integration whatsoever.** `SongCasting.contextType` doesn't
  include `'jam'`.
- **Lifecycle is binary terminal:** `active → expired | saved`.
- The "lightweight guest contribution without account" question is
  already raised in
  `.claude/artifacts/2026-04-02T20:34_jam-session-user-flows.md:319`
  but never decided.

---

## 3. The five decisions

Until at least #1, #2, and #5 are answered, schema work cannot start.
#3 and #4 affect product surface but not the core schema shape.

### Q1. Anonymous identity model

**The question:** how does a walk-up at a venue become an entity that can
be assigned to a song?

**Options:**

| Option                                     | Mechanics                                                                                                      | Pros                                                                                  | Cons                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **A. Pure ephemeral guest**                | New `jam_guests` row with UUID + display name + instruments[]. UUID stored in localStorage. No email, no auth. | Lowest friction; matches existing anon-view pattern; easy to ship                     | No cross-event memory ("Sarah played guitar last Friday"); guest data is throwaway           |
| **B. Lightweight account on first commit** | Anon browses, but picking up an instrument silently provisions a magic-link account (email or phone)           | Friction at the right moment; cross-event memory; converts walk-ups to retained users | More auth surface to build; depends on email/SMS infra (`email-infrastructure` backlog item) |
| **C. Venue-issued check-in code**          | Host hands out a card or QR at the door that creates a one-night identity tied to the venue's account          | Best for paid/managed events; ties revenue to the venue                               | New product surface; requires venue-mode primitives (see Q4); slowest to ship                |

**Recommended starting point:** A (ephemeral) for MVP, with the upgrade
path to B always available via the existing
`/auth?view=signup&redirect=/jam/${shortCode}` flow already wired in
`JamViewPage.tsx:258-260`.

**Decision needed:** A, B, or C — and if A, do guests survive a session
ending (snapshot to history) or get pruned?

---

### Q2. Instrument vocabulary

**The question:** what is the canonical list of instruments/roles, and is
it the same across the whole app?

**Options:**

| Option                                    | Mechanics                                                                              | Pros                                                                                     | Cons                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **A. Free text**                          | Continue using `UserProfile.instruments: string[]`; anon walk-ups type free-form       | Matches what the app does today; max flexibility                                         | Host can't filter "who can play bass" reliably (string variants); breaks the casting suggestion service |
| **B. Closed enum**                        | Adopt `RoleType` (13 values) everywhere; retire free-text on the casting path          | Suggestion service works; deduplication is automatic; fixes the SQL/TS drift permanently | Anyone outside the 13 values is shut out                                                                |
| **C. Closed enum + "Other" escape hatch** | Closed enum for the common 13, free-text for "Other (specify)" stored alongside        | Best of both; host filtering still works for the 95% case                                | One more field; some assignments end up un-suggestable                                                  |
| **D. Venue-curated per-event**            | Venue picks a list per event ("Tonight: vocals, guitar, bass, drums, keys, harmonica") | Cleanest UX per event                                                                    | Most product surface; requires venue mode (Q4)                                                          |

**Recommended starting point:** C (closed enum + "Other" free text). Keep
`UserProfile.instruments` as decoration on the profile but stop using it
for casting decisions.

**Decision needed:** A, B, C, or D — and if C, does "Other" get
auto-promoted to the enum after N usages, or stay free-text forever?

---

### Q3. Persistence scope of jam-mode casts

**The question:** when the open-jam ends, do the per-song castings
persist in the regular `song_castings` tables (so later you can review
"who played what at last week's jam"), or are they ephemeral?

**Options:**

| Option                 | Mechanics                                                                                                                      | Pros                                                              | Cons                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A. Ephemeral**       | Casts live only while session is `active`; deleted on `expired`/`saved`                                                        | No data accumulation; simple lifecycle                            | No history; can't analyze "Sarah played 14 songs Friday"            |
| **B. Persist + scrub** | Casts persist; on session end, anon assignee identities are snapshotted to `displayName` and the FK to `jam_guests` is dropped | History survives; same pattern as `JamSetlistItem` display tuples | More schema surface; need a migration job at session end            |
| **C. Persist with FK** | Casts persist with FK to `jam_guests`; guests live forever                                                                     | Simplest; richest data                                            | Privacy concern; guest UUIDs pile up; GDPR-style retention concerns |

**Recommended starting point:** B (persist + scrub display name). Mirrors
the existing `JamSetlistItem` pattern (`src/models/JamSession.ts:26-30`)
where display strings are snapshot-frozen.

**Decision needed:** A, B, or C.

---

### Q4. Venue / multi-tenant

**The question:** is "venue" an account type with its own primitives, or
just a host with a different mode toggle?

**Options:**

| Option                                      | Mechanics                                                                                                      | Pros                                       | Cons                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **A. Mode toggle on existing host account** | Existing user creates a "Open Jam" session instead of a "Band Jam"; same auth, same routes                     | Ship next week                             | No org concept; no venue-shared regulars; awkward billing if monetized                       |
| **B. Venue org type**                       | New account tier ("Venue") that owns multiple events, has multiple host operators, sees regulars across events | Clean billing tier; venue staff can rotate | Significant product surface; depends on `account-tiers-and-access` backlog work; multi-month |
| **C. Hybrid**                               | Ship A now; add B later as a tier upgrade without breaking schema                                              | Pragmatic                                  | Risk of painting in to a corner if A's data model can't extend                               |

**Recommended starting point:** A for v1 (validate the open-jam UX),
explicit tier upgrade path to B once we know what venues actually need.

**Decision needed:** A, B, or C.

**Cross-reference:** see `.claude/backlog/account-tiers-and-access/`
for related tier-system thinking.

---

### Q5. "Now playing" concept

**The question:** does jam-mode introduce a "current song" pointer (host
taps a song → it becomes active → participants see "you're up next on
bass for Wonderwall"), or is it deferred?

**Options:**

| Option                                  | Mechanics                                                                                                                                              | Pros                                                                                                | Cons                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A. Introduce now**                    | Add `current_setlist_item_id` (or `current_song_index`) to `jam_sessions`; host taps to advance; broadcast on `jam_sessions` UPDATE (mechanism exists) | Anchors the host UI; participants get clear next-up signal; ships casting + now-playing in one move | New concept end-to-end (DB column, broadcast, UI on three pages)                                                       |
| **B. Defer; setlist is just the order** | Casting is per-song but no "active" pointer. Host announces verbally.                                                                                  | Simpler v1                                                                                          | Host UI has no anchor for "what should the assignment screen show right now" — falls back to "scroll to find the song" |

**Recommended starting point:** A. The host console layout in §4 below
breaks down without an anchor song. It's a small column add; the
broadcast mechanism is already there.

**Decision needed:** A or B.

---

## 4. Strawman direction (assumes Q1=A, Q2=C, Q3=B, Q4=A, Q5=A)

Documented here so the future prompt can react to it rather than start
from scratch.

**Identity:** ephemeral `jam_guests` (UUID + display name + selected
instruments[] + opt-in `email_for_upgrade`). UUID in localStorage.
Upgrade path via existing `/auth?view=signup&redirect=...`.

**Instrument vocabulary:** closed `RoleType` enum (fix the 13 canonical
values), with `assignment_role.other_text` for the escape hatch. Retire
free-text `UserProfile.instruments` for casting decisions; keep on the
profile as decoration.

**Casting model extension:**

- Add `'jam'` to `SongCasting.contextType` (and fix the SQL CHECK so
  `'template'` isn't already a lie).
- Generalize `SongAssignment.assignee` → polymorphic `(kind: 'user',
userId)` or `(kind: 'guest', guestId)`. On session end, snapshot guest
  display names into `displayName` so the assignment survives the guest
  row's deletion.
- Resolve the SQL/TS drift on `assignment_roles.type` once and for all.

**Jam lifecycle:** add `current_setlist_item_id` on `jam_sessions`. Host
taps a song → it becomes "now playing" → broadcast on `jam_sessions`
UPDATE (mechanism exists). Participants see "You're up on bass for
Wonderwall."

**Existing band-setlist casting:** same data model serves both. Wire the
four orphaned components to a real route at `/setlists/:id/casting`. Fix
RLS holes, dexie index, SQL/TS drift. Route through the repository layer.

---

## 5. UI mockups (textual ASCII — to be Figma'd later)

### A. Walk-up join (anonymous) — `/jam/view/:shortCode`

```
+------------------------------------------------------+
| [Venue Name] Open Jam — Hosted by Tom                |
| 23 in the room  •  4 musicians ready                 |
+------------------------------------------------------+
|                                                      |
|  What's your name?    [ Sarah                    ]   |
|                                                      |
|  What do you play?    (pick all that apply)          |
|   [x] Vocals                                         |
|   [x] Guitar (rhythm)                                |
|   [ ] Guitar (lead)                                  |
|   [ ] Bass                                           |
|   [ ] Drums                                          |
|   [ ] Keys                                           |
|   [ ] Other: [ harmonica         ]                   |
|                                                      |
|  ( ) I'm here to listen                              |
|  (o) I'd like to play                                |
|                                                      |
|        [  Join the jam  ]                            |
+------------------------------------------------------+
```

After joining: row at top changes color when assigned —
"**You're up on rhythm guitar — Wonderwall — 2 songs from now**."

### B. Host event console — `/jam/:sessionId` (host view)

```
+-----------------+---------------------------+----------------------------+
| ROOM (24)       | SETLIST                   | NOW: Wonderwall — Oasis    |
+-----------------+---------------------------+----------------------------+
| Ready to play   | 1. Sweet Caroline   DONE  |  Vocals                    |
|                 | 2. Wonderwall    >NOW<    |   [ Sarah (guest) ] [x]    |
| Sarah  G/V      | 3. Free Fallin'           |   + Add backing            |
| Mike   D        | 4. Don't Stop Believin'   |                            |
| Priya  B        | 5. Brown Eyed Girl        |  Guitar (rhythm)           |
| James  K/V      | + Add song                |   [ Sarah (guest) ] [x]    |
|                 |                           |                            |
| In the queue    | [ Advance to next song ]  |  Guitar (lead)             |
|  Dan   G                                    |   [ Mike (band)   ] [x]    |
|  Kim   V        Tap a song to set Now       |                            |
|                                             |  Bass                      |
| Watching (18)                               |   [ Priya (guest) ] [x]    |
|  + 14 lurkers                               |                            |
|                                             |  Drums                     |
| [ Show QR ]                                 |   ! No one assigned        |
|                                             |   Suggest: Mike, Dan       |
+-----------------+---------------------------+----------------------------+
```

Interactions:

- Drag a person from "Ready to play" onto a role slot. Only people whose
  declared instruments include that role show as drag-eligible.
- "Suggest" uses the existing `CastingSuggestionService` (resurrected).
- "Advance to next song" frees current assignees back to "Ready to play"
  unless host pins them.

### C. Per-song assignment editor (reusable)

Used at both `/setlists/:id/casting` (rebuilt `SongCastingEditor`) and as
the right column of the host console.

```
+----------------------------------------------------+
| Wonderwall — Oasis                          [ x ]  |
+----------------------------------------------------+
| Roles needed for this arrangement:                 |
|                                                    |
|  Vocals (lead)        [ Sarah G/V       v ]   *    |
|    (backing)          [ + add member    v ]        |
|  Guitar (rhythm)      [ Sarah G/V       v ]        |
|         (lead)        [ Mike  D         v ]        |
|  Bass                 [ Priya B         v ]        |
|  Drums                [ + assign        v ]        |
|                                                    |
|  + Add a role (keys, percussion, harmonica...)     |
|                                                    |
|  Notes: "Drop D for the chorus, Sarah leads"       |
+----------------------------------------------------+
```

Member dropdown shows declared instruments next to name (G = guitar,
D = drums, etc.) and groups by source: **Band members** /
**Tonight's guests**. Guests appear only when in jam context.

### D. Member-instrument self-declaration (one-time, band side)

Replace the free-text preset list in `BandMembersPage.tsx`:

```
+------------------------------------------+
| What do you play?                        |
+------------------------------------------+
| Vocals                                   |
|   [ ] lead     [ ] backing   [ ] harmony |
| Guitar                                   |
|   [x] rhythm   [x] lead      [ ] acoustic|
|   How well? ( low ---@-- high )          |
|                  3 / 5                   |
| Bass                                     |
|   [ ]                                    |
| ...                                      |
| Other: [ Harmonica         ]             |
+------------------------------------------+
```

Connects `MemberCapability` to a real input. Same screen — minus
proficiency — is what the anon walk-up sees in (A).

### E. End-of-event recap (post-jam)

When host ends an open-jam session:

```
Tonight, in 18 songs:
  Sarah played 14 songs (mostly vocals + rhythm guitar)
  Mike  played  9 songs (drums)
  Priya played  6 songs (bass)
  ...

  [ Save event recap ] [ Save as setlist ] [ Just close ]
```

The moment guest display names lock into the historical record so the
data survives even when guest rows are pruned.

---

## 6. Suggested phasing (assuming the strawman)

1. **Resurrect band-setlist casting first.** Fix the SQL/TS drift, RLS,
   dexie index, route through repository. Wire `SongCastingEditor` to a
   real route. Adopt the closed `RoleType` enum + proficiency on band
   members. **No jam changes.** Proves the model works end-to-end and
   gives something shippable.
2. **Add anon participation to existing jams.** `jam_guests` table,
   instrument self-declaration on `JamViewPage`, host sees them in the
   room list. Still no per-song assignment.
3. **Open-jam mode proper.** Add `'jam'` to `SongCasting.contextType`,
   polymorphic assignee, "now playing" pointer on `jam_sessions`, host
   console layout, end-of-event recap.

---

## 7. Source pointers (for the future agent)

If you (future agent) need to verify any of the current-state claims:

- Casting TS: `src/models/SongCasting.ts:1-164`
- Casting service (dead): `src/services/CastingService.ts:17-410`
- Casting DB schema: `supabase/migrations/20251106000000_baseline_schema.sql:444-502`
- Casting components (orphaned): `src/components/casting/{SetlistCastingView,SongCastingEditor,MemberRoleSelector,CastingComparison}.tsx`
- Original casting PRD: `.claude/artifacts/context-specific-casting-system.md`
- Jam TS: `src/models/JamSession.ts:1-143`
- Jam service: `src/services/JamSessionService.ts`
- Jam DB schema: `supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql:122-186`
- Jam edge functions: `supabase/functions/jam-view/index.ts`, `supabase/functions/jam-recompute/index.ts`
- Jam pages: `src/pages/JamSessionPage.tsx`, `src/pages/JamViewPage.tsx`
- Jam components: `src/components/jam/{JamSessionCard,JamInviteQR,JamParticipantList,JamWatcherList,JamMatchList}.tsx`
- Existing jam flow doc: `.claude/artifacts/2026-04-02T20:34_jam-session-user-flows.md` (the open-question
  about anon contribution lives at line 319)
- v0.3.1 jam-view post-mortem: `.claude/artifacts/2026-04-24T02:30_v0.3.1-post-mortem-and-next-session-handoff.md`
