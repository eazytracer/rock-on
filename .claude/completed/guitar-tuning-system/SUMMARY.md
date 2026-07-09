# Guitar Tuning System — Summary

**Completed:** 2026-07-04
**Version:** 0.4.0–0.4.1 (custom tunings manager shipped in 0.4.0; Drop Db built-in + picker order/hide-bass + reusable TuningTag in 0.4.1)

## Overview

Replaced the free-text `songs.guitar_tuning` label with a structured, per-string tuning registry. A tuning is a named, ordered list of each string's pitch for an instrument (guitar/bass, 3–12 strings). The app ships a set of common built-in tunings and lets users create their own custom tunings; every song references exactly one tuning. The per-string model exists so future setlist "retuning effort" diffs and change-key tuning suggestions become simple pitch math.

## What shipped

- **Tunings data model** — one unified `tunings` table holds both global built-ins (stable `slug`, `is_builtin=true`, no owner) and personal/band custom tunings (`context_type`/`context_id` owner, no slug), enforced by a builtin-XOR-owned CHECK. Songs reference it via an additive, nullable `songs.tuning_id` FK (`ON DELETE SET NULL`).
- **16 seeded built-ins** — 9 six-string guitar (Standard, Drop D, Eb/half-step, D/whole-step, Drop C, Drop B, Open G, Open D, DADGAD), 7- and 8-string standard, and 5 bass (standard 4, Drop D, Eb, 5-string, 6-string); Drop Db added later (0.4.1).
- **Custom tunings manager + create flow** — Settings-side manager and a create modal: pick instrument → string count → note-per-string (prefilled from the matching standard) → name/color. Owners/bands can edit and delete their own; built-ins are read-only.
- **Song-form tuning picker** — replaces the free-text field; built-ins grouped by instrument plus the user's/band's customs, writing `tuning_id`. Unmatched legacy songs show an "unset / choose a tuning" state. Later polish: picker ordering and hidden/de-emphasized bass tunings (0.4.1).
- **Warmth/color spine + TuningTag unification** — the colored tuning spine/chips on song cards unified into a reusable `TuningTag` (0.4.1); built-ins carry a brand color, customs fall back to neutral.
- **Safe migration + backfill** — idempotent migration seeds built-ins (`ON CONFLICT (slug)`), adds the nullable FK (no row rewrite), and best-effort backfills existing songs via a `builtin_tuning_slug()` mapping; unmatched free-text is left `NULL` with its original label preserved. All 53 seed songs resolve (0 NULL).

## Key decisions / notes

- **Pitch source of truth = ordered `smallint[]` of MIDI numbers, low→high string.** Chosen over JSONB `{note,octave}` because the two named future features — set retuning-diff and change-key suggestions — are pure integer pitch math (element-wise subtract / uniform transpose).
- **Note-name spelling (Eb vs D#) is derived in-app** from MIDI with a flat-preference default; no `spelling[]` column in v1.
- **One tuning per song** (single `tuning_id`); a per-instrument join table is a clean additive v2.
- **Ownership mirrors songs** (personal + band) with per-context duplication (no global dedup). When a band song is copied to a personal catalog, its custom tuning is copied too so it never orphans — an app-layer rule on the copy path.
- **`songs.guitar_tuning` TEXT is kept** as a denormalized human-label snapshot for offline display and rollback safety; not dropped.
- **Tunings are Supabase-direct + RLS** (like the notifications/friends/events features); the offline SyncEngine is untouched. Built-ins are also shipped as app constants for zero-round-trip offline resolution. RLS: built-ins world-readable and non-writable by `authenticated`; customs scoped to owner/band with WITH-CHECK guards against re-homing or flipping to built-in.

## Key files / migrations

- `src/utils/tunings.ts` — canonical registry (`CANONICAL_TUNINGS`, `canonicalTuningId()`, `tuningColor()`/`tuningLabel()`), with per-string MIDI pitch data for offline built-ins.
- `supabase/migrations/20260704191222_tunings.sql` — `tunings` table + CHECKs + grants + RLS + 16 seeded built-ins + `songs.tuning_id` + index + `builtin_tuning_slug()` backfill helper.
- `supabase/tests/020-tunings.test.sql` — 19 pgTAP assertions (schema/CHECKs/RLS/seed/backfill).
- `supabase/seed-mvp-data.sql` — tuning backfill appended after song seed.
- `CreateTuningModal` (custom-tuning creator) and the `EditSongModal` tuning picker; reusable `TuningTag` for card spines/chips.
- `src/models/Song.ts` (`tuningId`) + `RemoteRepository` mapping for the FK.
