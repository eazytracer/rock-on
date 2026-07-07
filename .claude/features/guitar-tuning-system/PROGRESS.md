# Guitar Tuning System — Progress Log

Promoted from `.claude/backlog/guitar-tuning-system/` on 2026-07-04. Branch:
`feature/events-friends-and-ui-oh-my`. **All work LOCAL — nothing pushed to remote
Supabase** (per standing rule: no `db push --linked` until a PR).

## Documents in this folder

- **`2026-07-04T17:01_tunings-db-design.md`** — ⭐ current DB design, all decisions
  RESOLVED (source of truth for the data model).
- **`2026-07-04T17:20_tunings-for-designer.md`** — plain-language handoff for the UI
  designer (how tunings are stored, built-in vs custom, the create-custom flow).
- `tuning.png` — design reference/mockup asset.
- `2026-01-22T15:25_research.md`, `2026-01-06T16:31_research.md` — **superseded**
  historical research. Kept for context. They proposed a JSONB per-string type; the
  shipped design instead stores pitches as a **MIDI `smallint[]`** (better for the
  retuning-diff and change-key math). Where they disagree, the 2026-07-04 design wins.

## Resolved decisions (2026-07-04)

- One tuning per song (single `songs.tuning_id`); per-instrument join is a clean v2.
- Pitch source of truth = ordered `smallint[]` of MIDI numbers, low→high string.
- Ownership = personal + band (mirrors songs); per-context duplication accepted (no
  global dedup). Copy the custom tuning when a band song is copied to personal (app-layer
  rule). Future admin tool promotes popular customs into the built-in set.
- Unmatched legacy free-text on backfill → `tuning_id` NULL, original label preserved.
- No `spelling[]` column; note-name spelling (Eb vs D#) derived in-app from MIDI.

## Status board

| Layer  | Item                                                                          | Status     |
| ------ | ----------------------------------------------------------------------------- | ---------- |
| DB     | `tunings` table + CHECKs + grants + RLS                                       | ✅ built   |
| DB     | 16 seeded built-ins (9 guitar 6-str + 7/8-str + 5 bass), MIDI pitches         | ✅         |
| DB     | `songs.tuning_id` FK (additive, nullable) + index                             | ✅         |
| DB     | `builtin_tuning_slug()` helper + best-effort backfill (migration + seed)      | ✅         |
| DB     | pgTAP `020-tunings.test.sql` (19 assertions: schema/CHECKs/RLS/seed/backfill) | ✅         |
| DB     | `db reset` clean · full pgTAP **882** · `lint:migrations` clean               | ✅         |
| App    | `Song` TS model `tuningId` + RemoteRepository mapping                         | ⬜ pending |
| App    | Expand `src/utils/tunings.ts` with per-string pitch data (offline built-ins)  | ⬜ pending |
| App    | Align TS `canonicalTuningId` with SQL `builtin_tuning_slug` (Eb/D Standard)   | ⬜ pending |
| App    | Tuning picker (built-ins grouped by instrument + customs) in song editor      | ⬜ pending |
| App    | Custom-tuning creator (instrument → string count → note per string → name)    | ⬜ pending |
| App    | Copy custom tuning on band-song → personal copy path                          | ⬜ pending |
| Future | Setlist retuning-diff indicators (per-string / whole / swap)                  | ⬜ future  |
| Future | Change-key → suggest alternate tunings                                        | ⬜ future  |
| Future | Admin tool: promote frequently-used customs into built-ins                    | ⬜ future  |

## Deliverables built (files)

- `supabase/migrations/20260704191222_tunings.sql`
- `supabase/tests/020-tunings.test.sql`
- `supabase/seed-mvp-data.sql` — added tuning backfill after song seed (all 53 seed songs
  resolve; 0 NULL).

## Notes

- The DB `builtin_tuning_slug` is intentionally a bit more generous than today's TS
  `canonicalTuningId` (it maps "Eb Standard"→half-step-down, "D Standard"→whole-step-down).
  Align the TS side when wiring the app layer.
- No existing song read/write path was changed beyond the additive `tuning_id` column; the
  offline SyncEngine is untouched (tunings are Supabase-direct + RLS like the newer
  features).
