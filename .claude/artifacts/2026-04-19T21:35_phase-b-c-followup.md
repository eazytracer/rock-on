---
title: Phase B/C Follow-Up — Decided Items After Schema Review
created: 2026-04-19T21:35
prompt: User answered the 5 product questions in the schema review artifact. Capture decisions, queue specific next-session work items, and note items dropped or deferred.
status: Backlog — ready for prioritization
related:
  - .claude/artifacts/2026-04-19T21:21_schema-review-and-forward-compat.md
  - .claude/specifications/unified-database-schema.md
  - .claude/features/social-catalog/2026-04-03T03:44_session-summary.md
---

# Phase B/C Follow-Up

This document captures the decisions from the product-questions section of the schema review artifact and translates them into concrete work items for upcoming sessions.

## Phase A — Done (this session)

| Item                                                                              | Done | Where                                                 |
| --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| RLS-1: `user_profiles_select_jam_coparticipant` policy                            | ✅   | baseline migration line ~1245                         |
| Code: drop PostgREST embed in `getJamParticipants`, use parallel `.in()` lookup   | ✅   | `RemoteRepository.ts:1641-1681`                       |
| RLS-2: replace `users_select_authenticated USING (true)` with 3 scoped policies   | ✅   | baseline migration line ~1200-1228                    |
| Schema spec refresh — `last_active_at`, RLS notes, ghost tables, embed limitation | ✅   | `unified-database-schema.md`                          |
| `supabase db reset` + tests + type check                                          | ✅   | 244 quick tests + 23 jam tests passing, 0 type errors |

---

## Decisions Recorded

### Q1 — Anonymous interaction depth

**Decision:** View-only for now. Possible future: text-only song nominations (typed title + artist, no full song record).

**Implication for schema:**

- No changes to `jam_participants` (`user_id` stays NOT NULL).
- If/when text-only nominations ship, the existing `jam_song_nominations` proposal (G6 below) needs a tweak — the `external_title` / `external_artist` path becomes how anon nominations are represented, with a separate `nominated_by_anon_session_id` column (browser-local UUID) instead of `nominated_by`.
- UX note for that future feature: visually distinguish "anon-typed song" from "registered-user-with-app-record" so participants don't confuse them.

### Q2 — Song copy semantics

**Decision:** Full deep copy, no provenance link.

**Implication for schema:**

- **G4 is dropped.** No `forked_from_song_id` column needed on `songs`.
- `SongLinkingService.copyBandSongToPersonal` already does a deep copy and is correct.
- New work: a "save jam matches to my catalog" flow needs to pick ONE source song from `jam_song_matches.matched_songs[]` (which contains all participants' versions of the song) and deep-copy it. The match list represents N copies of the same logical song; we pick one (probably the first or the host's) and copy it to the user's catalog.

### Q3 — Multi-band UX

**Decision:**

- Setlists, shows, practices stay band-scoped (require `currentBandId`).
- Songs page gets an optional "all bands" view with a visual signifier showing which band each song belongs to (or whether it's personal).

**Implication for schema:** None — the data model already supports this. Songs already have `(context_type, context_id)`. The Songs page hook needs to switch from `getSongsByBand(currentBandId)` to `getAllSongsForUser(userId)` when in "all bands" mode, and the row component needs a context badge.

**New work items:**

- B1: Songs page "All my bands" toggle
- B2: Song row context badge (band name or "Personal")
- B3: Repository method `getAllSongsForUser(userId)` that fetches across all of user's bands + personal context

### Q4 — Setlist as fork target

**Decision:**

- Jam sessions still produce personal setlists only.
- New feature: starting a jam can pre-seed the host's queue from a personal setlist.

**Implication for schema:** Add a nullable `seed_setlist_id` to `jam_sessions`:

```sql
ALTER TABLE jam_sessions
  ADD COLUMN seed_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL;
```

**New work items:**

- B4: Schema — add `seed_setlist_id` to baseline migration
- B5: `JamSessionService.create()` accepts optional seed setlist; pre-populates `settings.hostSongIds` from that setlist's `items`
- B6: Create-session UI — "start from setlist" optional picker

### Q5 — Tier limits

**Decision:**

- Free tier: 1 active jam session at a time.
- Pro tier: long-running jams (effectively a "lightweight band" for recurring groups).

**Implication for schema:** None right now. Hardcode the limit in `JamSessionService.create()` so the enforcement lives in one place. Defer the `tier_limits` table until we add a 3rd tier or want to A/B test limits.

**New work items:**

- B7: `JamSessionService.create()` checks `count(active jam_sessions where host_user_id = me) < limitForTier(tier)`. Limit constant lives in one file (e.g., `src/config/tierLimits.ts`).
- B8: Pro-tier expiry: when host is `account_tier = 'pro'`, default `expires_at` to `NOW() + INTERVAL '30 days'` (or whatever feels right). Free tier stays at 24h.
- C1 (deferred): `tier_limits` table once we have a 3rd tier.

---

## Active Work Queue (next sessions)

Ordered by user-facing value × implementation cost.

### Immediate (next session, 1-2 hours)

**1. In-session setlist builder + live broadcast (G5 from review)**

- Add `jam_sessions.working_setlist_items JSONB NOT NULL DEFAULT '[]'`
- Promote `settings.hostSongIds` data into `working_setlist_items` on migration
- New "Setlist" tab in `JamSessionPage` (third tab next to Common Songs / My Queue)
- Wire `<SortableQueueSongRow>` (already built last session) into the setlist tab
- Edge function `jam-view` returns `working_setlist_items` so anon viewers see live updates
- Realtime already works for `jam_sessions` row updates — no new channel needed

**2. Seed jam from setlist (B4-B6)**

- `seed_setlist_id` column + service method + UI picker
- Small. Bundle with #1.

### Short-term (within ~5 sessions)

**3. Songs page "all bands" view (B1-B3)**

- Toggle in Songs page header
- New `getAllSongsForUser(userId)` repository method
- Context badge component on song rows showing band name or "Personal"

**4. Tier limit enforcement (B7-B8)**

- One active jam per free user, hardcoded
- Pro-tier longer expiry

### Deferred until requested

**5. Anonymous text-only song nominations (Q1 future direction)**

- Requires UX decision about visual distinction
- Requires `jam_song_nominations` table

**6. Participant nomination queue (G6)**

- Deferred per Q5 decision in original artifact

---

## Pre-1.0 Cleanup Backlog (Phase C)

These don't block any specific feature but should be done before production data exists. Track separately.

| ID  | Item                                                                              | Trigger                                                             |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| C1  | Add `tier_limits` table                                                           | When we add a 3rd tier or want data-driven tier config              |
| C2  | Replace polymorphic `context_type`+`context_id` (TEXT) with real FKs (R1)         | Before going to production OR when next major schema change happens |
| C3  | Drop `bands.memberIds` from IndexedDB schema (R3)                                 | Whenever we touch the local Dexie schema next                       |
| C4  | Add `users.preferred_band_id` for cross-device current band (G2)                  | When users complain about "wrong band on phone"                     |
| C5  | Drop or add policies to the 7 RLS-no-policy ghost tables (RLS-3)                  | Either drop now, or before first feature uses them                  |
| C6  | Tighten `audit_log_select_if_member` to also allow personal record owners (RLS-4) | If we expose personal-record audit history in UI                    |
| C7  | Tier-aware band creation limit (RLS-5)                                            | When Pro tier ships                                                 |
| C8  | Harden `jam_song_matches_insert_participant` against spam (RLS-6)                 | Post-1.0 hardening                                                  |

---

## Items Explicitly Dropped

| Item                                                | Why                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| G4 — `songs.forked_from_song_id` provenance column  | User chose deep-copy without link. No tracking needed.                                                                       |
| Allowing `currentBandId = null` in normal app state | User wants band-scoped pages to require a current band. Songs-page "all bands" mode is just a UI filter, not a state change. |
| `jam_anonymous_participants` table                  | Anon stays view-only; no contribution path needs storage.                                                                    |
| Multi-band catalog sharing in jams (G3)             | User answered "personal-only" implicitly via Q1; jam matching stays personal-context only.                                   |

---

## Suggested Next Session

Pick item #1 (in-session setlist builder + broadcast) and item #2 (seed from setlist) together — they touch the same code paths in `JamSessionPage` and `JamSessionService`, and both are blocked on the same small migration (`working_setlist_items` + `seed_setlist_id`). Doing them in one go avoids a second `supabase db reset` cycle.

Estimated: 2-3 hours including tests and the Edge Function update.
