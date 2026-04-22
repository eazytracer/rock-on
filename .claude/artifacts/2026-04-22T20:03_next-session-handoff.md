---
title: Next-Session Handoff — Social Catalog Feature Work
created: 2026-04-22T20:03
prompt: Document remaining work after this session so a fresh conversation can pick up exactly where we left off. Include what's committed, what's next in priority order with specific implementation pointers, and verification steps using the new test harness.
status: Handoff — ready for next session
related:
  - .claude/artifacts/2026-04-19T21:21_schema-review-and-forward-compat.md
  - .claude/artifacts/2026-04-19T21:35_phase-b-c-followup.md
  - .claude/specifications/functionality-catalog.md
  - scripts/test-harness/README.md
---

# Next-Session Handoff

**Branch:** `feature/social-catalog`
**Session date:** 2026-04-22
**Session length:** ~1 hour

## What shipped this session

Three commits on top of `cd4eb3a`:

```
6f8cf63 docs: add functionality catalog (plain-English index + test references)
24b4933 feat(test-harness): CLI for multi-user jam session testing
d3bd973 feat(social-catalog): component library + jam UX overhaul + RLS hardening
```

- **`d3bd973`** cleared two prior sessions of uncommitted work: the Apr 3 component-library foundation + jam UX overhaul + sync guardrails, and the Apr 19 Phase A RLS hardening + schema review.
- **`24b4933`** added `scripts/test-harness/` — a CLI that drives multi-user jam flows (alice/bob/carol personas) through real RLS paths. Smoke-tested end to end.
- **`6f8cf63`** added the functionality catalog (`.claude/specifications/functionality-catalog.md`) — plain-English index of all app capabilities with test references, 11 domains, 350 lines.

## What you can now do from the CLI

```
npm run harness -- ensure                          # provision alice/bob/carol
npm run harness -- seed-songs alice                # RLS-gated insert
npm run harness -- seed-songs bob
OUT=$(npm run harness -- create-jam alice --json)  # returns { id, joinCode, hostUserId }
npm run harness -- join-jam bob $(echo "$OUT" | jq -r .joinCode)
npm run harness -- recompute $(echo "$OUT" | jq -r .id)
npm run harness -- dump-session $(echo "$OUT" | jq -r .id)
npm run harness -- watch <sessionId>               # stream realtime events
```

See `scripts/test-harness/README.md` for the full reference.

## Outstanding work — in priority order

### 1. In-session setlist builder + live broadcast (HIGHEST VALUE)

**Source of truth:** `.claude/artifacts/2026-04-19T21:35_phase-b-c-followup.md` item #1.

**What's already scaffolded** (in `d3bd973`, model-only — no UI yet):

- `src/models/JamSession.ts`:
  - `JamSetlistItem` interface (`id`, `displayTitle`, `displayArtist`) — object not just ID, so participants/anon viewers without the song in their catalog can still see it
  - `JamSessionSettings.setlistItems?: JamSetlistItem[]` — the new field
  - `JamSessionSettings.setlistSongIds?: string[]` — marked `@deprecated`, read-only fallback
  - `JamViewPublicPayload.setlist?` — anon broadcast field

**What needs to happen:**

1. **Decide storage shape.** The follow-up artifact suggested a new `working_setlist_items JSONB` column. The model scaffolding went a different direction: store in `settings.setlistItems` instead. **Recommendation: use `settings.setlistItems`** (already scaffolded, one fewer migration, realtime already configured on `jam_sessions`). No migration needed beyond what's already in the baseline.

2. **Third tab in `JamSessionPage`.** Current tabs are `Common Songs` and `My Queue`. Add `Setlist`. Use the existing `<TabSwitcher>`. `<SortableQueueSongRow>` is already built (committed in `d3bd973`) — wire it up with `@dnd-kit` for reorder.

3. **Add-from-matches interaction.** On a row in the `Common Songs` tab, add an "Add to Setlist" action (probably via `<KebabMenu>` — already available). Appends a `JamSetlistItem` to `settings.setlistItems`.

4. **Persistence.** `JamSessionService.updateSetlistItems(sessionId, items)` that writes `settings.setlistItems` atomically. Hook: `useJamSession` already has `updateSettings`; either extend or add a dedicated mutator.

5. **`jam-view` Edge Function update.** Read `settings.setlistItems` from `jam_sessions`, expose as `setlist` in `JamViewPublicPayload`. Shape the payload to include only `displayTitle`/`displayArtist` (no IDs — nothing for an anon to do with them).

6. **Realtime for participants.** Already works — `jam_sessions` is in the publication with `REPLICA IDENTITY FULL`. When `settings` JSONB changes, participants receive the update via their existing realtime subscription on that row.

**Files that will change:**

- `src/pages/JamSessionPage.tsx` — third tab + setlist panel
- `src/services/JamSessionService.ts` — setlist-items mutator
- `src/hooks/useJamSession.ts` or a new `useJamSetlist` — optimistic update + realtime merge
- `supabase/functions/jam-view/index.ts` — include setlist in public payload
- No migration (data shape already supported by `settings JSONB`)

**Verification via harness:**

```bash
# Alice creates jam, adds songs to the setlist via UI; bob joins
npm run harness -- create-jam alice --json
# in browser: sign in as alice, add matches to setlist
npm run harness -- watch <sessionId>    # should emit settings updates
npm run harness -- dump-session <sid>   # setlistItems should show N entries
# hit jam-view edge fn: curl http://127.0.0.1:54321/functions/v1/jam-view?token=<token>
#   → response.setlist should contain the items
```

### 2. Seed jam from a personal setlist

**Source of truth:** `.claude/artifacts/2026-04-19T21:35_phase-b-c-followup.md` items B4–B6.

**What's already scaffolded** (in `d3bd973`):

- `jam_sessions.seed_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL` — column added to baseline
- `JamSession.seedSetlistId?: string` — model field
- `RemoteRepository` maps both directions

**What needs to happen:**

1. **`JamSessionService.create(params)`** accepts optional `seedSetlistId`. When set, loads the setlist via `SetlistService`, projects `items` (songs only, skip breaks/sections) into `JamSetlistItem[]`, populates `settings.setlistItems` at creation time. Also populates `settings.hostSongIds` for backward compat.

2. **Create-session UI** — add an optional "Start from a personal setlist" picker. Default: none. If picked, the create call includes `seedSetlistId`. Only show personal setlists (not band — per the product decision in the Phase B artifact).

3. **`dump-session`** already prints `seedSetlist:` — verify it populates after creation.

**Files that will change:**

- `src/services/JamSessionService.ts` — extend `create()` signature
- `src/pages/JamSessionPage.tsx` (or wherever the create-flow UI lives) — picker
- Optional: `scripts/test-harness/commands/create-jam.ts` — add `--seed-from=<setlistId>` flag

**Verification via harness:**

```bash
# Seed alice's personal setlist (needs a script — or do via Supabase Studio)
# Then: harness create-jam alice --seed-from=<setlistId>
# dump-session should show seedSetlist UUID + setlistItems populated
```

### 3. Tests alongside the features

**Unit:**

- `tests/unit/services/JamSessionService.test.ts` — add cases for
  `updateSetlistItems`, `create({ seedSetlistId })`, and the "setlistItems seeded from setlist.items" projection (songs-only filter).

**Harness:**

- `scripts/test-harness/commands/seed-setlist.ts` — new command: seed a persona's personal setlist with N songs from their catalog. Returns the setlist ID.
- Extend `create-jam.ts` with `--seed-from=<setlistId>`.

**E2E:**

- `tests/e2e/jam/jam-session-core.spec.ts` — extend to cover the new "Setlist" tab (add, reorder, save).
- `tests/e2e/jam/jam-view-anon.spec.ts` — assert broadcast setlist reaches the anon view.

**Catalog update:** in the same commit as the feature, move these entries in `.claude/specifications/functionality-catalog.md` from "(tests in progress alongside feature)" / "(tests will land with feature ...)" to real test references:

- Section 7 → "Host curated queue / setlist"
- Section 7 → "Seed jam from a personal setlist"
- Section 7 → "Anonymous view via link" (after anon broadcast lands)
- Section "Known gaps" → remove "Anonymous jam realtime"

## Not in scope (deferred)

From the Phase B/C artifact, these are still deferred until separately approved:

- B1–B3: Songs page "All my bands" view + context badge
- B7–B8: Tier-limit enforcement (free=1 active jam; pro long-running)
- R1/R2: polymorphic `context_type`+`context_id` → real FKs (Phase C cleanup)
- G6: Participant nomination queue
- Anonymous text-only song nominations

## Loose ends

1. **`.claude/settings.local.json`** is still uncommitted. It was reset during the commit split but has local MCP config that shouldn't be shared. Recommend adding to `.gitignore` next session:

   ```
   # local-only MCP + permission overrides
   .claude/settings.local.json
   ```

   Then `git rm --cached .claude/settings.local.json` once, and it stops showing up in diffs.

2. **`opencode.json`** is untracked (3 lines, opencode.ai OAuth plugin config). Either add to `.gitignore` or commit — user's call. Harmless either way.

3. **Lint warning in `jam-recompute` edge fn** — line 34 has a `deno-lint-ignore no-explicit-any` on `req: any` because the Deno.serve type isn't imported in this Node-typed environment. Low priority; fix by importing `@std/http/server` types or `@ts-ignore` it.

## How to start the next session

Something like:

> "Read `.claude/artifacts/2026-04-22T20:03_next-session-handoff.md` and pick up at the top of the Outstanding Work list. Start with item 1 (in-session setlist builder + live broadcast). Use the test harness (`npm run harness -- ...`) to verify multi-user flows. Update the functionality catalog in the same commit as the feature."

Fresh context will have full room to do both features + tests cleanly. Estimated 2–3 hours per the Phase B artifact.
