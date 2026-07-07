---
feature: tunings (structured, per-string tuning registry + custom tunings)
created: 2026-07-04T17:01
status: RESEARCH / DB DESIGN PROPOSAL — no code written; DB-only scope per user
scope: database only (schema, RLS, seed, migration safety). NO UI in this doc.
---

# Tunings — Database Design Proposal

## 1. What we're building (from the user)

- Ship **a good number of common built-in tunings** out of the box, each storing
  **every string's pitch individually** (not just a label like "Drop D").
- Let users **add custom tunings** (number of strings + note per string).
- Every song references **either a built-in tuning or a custom tuning** — one uniform
  reference.
- Support **guitar and bass** now; **3–12 strings**.
- **Future (not now, but the model must not block it):**
  - Change a song's key → **propose alternate tunings** (e.g. E standard → Eb/½-down
    to reduce tuning changes across a set).
  - **Highlight tuning differences within a set**: "tune one string" vs "retune the
    whole guitar" vs "swap guitars/instrument".
- **Constraint:** minimal disruption to existing features; **migrations must be safe
  on existing songs.**

## 2. What exists today (verified in code)

- `songs.guitar_tuning` is a **free-text `TEXT` column** (baseline schema, default
  `'Standard'`). No per-string data anywhere.
- `src/utils/tunings.ts` is an **app-side constant registry** (`CANONICAL_TUNINGS`:
  id/label/color for 9 tunings) + `canonicalTuningId()` that normalizes legacy label
  drift ("Standard (EADGBE)", "Half Step Down", …) to a stable id, + `tuningColor()`.
  It already anticipates this feature (comment: "Future custom-tuning feature: user
  entries layer on top… lookup helpers accept an optional second arg that merges user
  entries in").
- **No tunings table exists.** No octave/MIDI/per-string pitch data exists anywhere.
- Ownership pattern to mirror: songs use `context_type ∈ ('personal','band')` +
  `context_id TEXT` (userId for personal, bandId for band), with RLS via
  `is_band_member(band_id, user)` and personal-own checks.
- Newer features (notifications, friends, events, casting) are **Supabase-direct +
  RLS** and do **not** go through the offline `SyncEngine` (which only handles
  `songs`, `setlists`, `practices`, `shows`). **Tunings should follow the newer
  pattern → the offline sync engine stays untouched.**

## 3. Core representation decision — per-string pitch as MIDI integers ⭐

The single most important choice. It determines whether the future features are cheap
or painful.

**Recommendation: store each tuning's pitches as an ordered `smallint[]` of MIDI note
numbers, lowest string → highest string.**

Example (6-string guitar):

| Tuning      | String order (low→high) | `pitches` (MIDI)      |
| ----------- | ----------------------- | --------------------- |
| Standard    | E2 A2 D3 G3 B3 E4       | `{40,45,50,55,59,64}` |
| Drop D      | D2 A2 D3 G3 B3 E4       | `{38,45,50,55,59,64}` |
| Eb / ½-down | Eb2 Ab2 Db3 Gb3 Bb3 Eb4 | `{39,44,49,54,58,63}` |

Why MIDI integers (and not a label, or note-name strings, or `{note,octave}` JSON):

- **"Highlight tuning differences in a set"** = element-wise subtraction of two
  `pitches` arrays. `[0,0,0,0,0,0]` → identical (no change). One nonzero entry →
  "**tune 1 string** (string N, ±k semitones)". Many nonzero → "**retune the whole
  guitar**". **Different array length** (different `string_count`) or different
  `instrument` → "**swap guitar / different instrument**". All trivial integer math.
- **"Change key → propose alternate tunings"** = transposition is `pitches + n` for a
  whole-instrument shift; "Eb reduces changes" falls out because Eb standard is exactly
  `standard − 1` (uniform offset), which the app can detect by comparing offset vectors.
- Compact, homogeneous, index-friendly, and **no JSON parsing** on a hot path (song
  cards render the tuning constantly).
- Absolute pitch (includes octave) — required to distinguish e.g. Drop C from a
  capo'd standard.

Note-name **spelling** (Eb vs D#) is a _display_ concern, derived in-app from MIDI with
a flat-preference default. If a specific tuning needs explicit spelling, add an
**optional** `spelling TEXT[]` override column (same length as `pitches`). Not required
for v1.

Alternative considered — JSONB `[{note,octave}]`: idiomatic to the codebase
(reference_links/items are JSONB) but worse for the diff/transpose math, needs parsing,
and can't be range-checked as cleanly. **Rejected as the source of truth**; MIDI array
wins because the two named future features are pitch-math features.

## 4. Schema

### 4.1 One unified `tunings` table (built-in + custom)

A single table so songs get **one uniform `tuning_id` FK** (built-ins must be rows for
the FK to resolve; custom tunings are rows too). Built-ins are seeded rows with stable
slugs; customs are owned rows.

```sql
CREATE TABLE IF NOT EXISTS public.tunings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument    TEXT NOT NULL DEFAULT 'guitar'
                  CHECK (instrument IN ('guitar','bass')),   -- TEXT+CHECK, extensible
  string_count  SMALLINT NOT NULL CHECK (string_count BETWEEN 3 AND 12),
  pitches       SMALLINT[] NOT NULL,                          -- MIDI, low→high string
  name          TEXT NOT NULL,                                -- "Drop D" / user's name
  slug          TEXT,                                         -- built-ins only, unique
  is_builtin    BOOLEAN NOT NULL DEFAULT false,
  color         TEXT,                                         -- Palette A for built-ins
  description   TEXT,

  -- Ownership (custom tunings only; NULL for built-ins) — mirrors songs
  context_type  TEXT CHECK (context_type IN ('personal','band')),
  context_id    TEXT,
  created_by    UUID REFERENCES public.users(id),

  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  last_modified_by UUID REFERENCES public.users(id),

  -- pitches length must match string_count
  CONSTRAINT tunings_pitch_len CHECK (array_length(pitches,1) = string_count),
  -- sane MIDI range (B0=23 covers low 5-string bass; keep a generous ceiling)
  CONSTRAINT tunings_pitch_range CHECK (
    (SELECT bool_and(p BETWEEN 12 AND 108) FROM unnest(pitches) AS p)
  ),
  -- built-in XOR owned: a row is either a global built-in (slug, no owner) or a
  -- context-owned custom (owner, no slug)
  CONSTRAINT tunings_builtin_xor_owned CHECK (
    (is_builtin  AND context_type IS NULL AND context_id IS NULL AND slug IS NOT NULL)
    OR
    (NOT is_builtin AND context_type IS NOT NULL AND context_id IS NOT NULL AND slug IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tunings_slug
  ON public.tunings (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tunings_owner
  ON public.tunings (context_type, context_id) WHERE context_id IS NOT NULL;

-- REQUIRED for any new table (baseline snapshot grant does NOT cover it):
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tunings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tunings TO service_role;
```

Optional (dedup exact-duplicate customs): a unique index on
`(context_type, context_id, instrument, pitches)` — deferred; flag, don't force.

### 4.2 Song → tuning reference (additive, safe)

```sql
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS tuning_id UUID REFERENCES public.tunings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_songs_tuning ON public.songs (tuning_id);
```

- Nullable → adding it is an instant metadata change, **no rewrite of existing song
  rows** (Postgres does not rewrite the table for a nullable column with no default).
- `ON DELETE SET NULL`: deleting a custom tuning leaves the song intact (falls back to
  the `guitar_tuning` label snapshot — see below).
- **Keep `songs.guitar_tuning TEXT`.** It becomes the **denormalized human-label
  snapshot** (offline display, history/robustness, rollback safety). App keeps it in
  sync with the referenced tuning's `name`. This mirrors how `event_lineup_items`
  snapshot `display_title`.

## 5. RLS (mirror songs' ownership model)

```sql
ALTER TABLE public.tunings ENABLE ROW LEVEL SECURITY;

-- SELECT: everyone sees built-ins; owners see their own; band members see the band's.
CREATE POLICY "tunings_select" ON public.tunings FOR SELECT TO authenticated
  USING (
    is_builtin
    OR (context_type = 'personal' AND context_id = (select auth.uid())::text)
    OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
  );

-- INSERT/UPDATE/DELETE: only NON-builtin rows the caller owns (personal) or the
-- caller's band (band). Built-ins are seed/service_role only — no authenticated write.
-- (WITH CHECK repeats on UPDATE so a row can't be re-homed to another owner.)
```

- Built-ins are never writable by `authenticated` (the write policies exclude
  `is_builtin` and require ownership) → they're managed by the seed / service_role only.
- Write policies must include `NOT is_builtin` in **both** `USING` and `WITH CHECK` so
  a user can neither edit a built-in nor flip their custom row into a built-in, nor
  re-assign `context_id` to someone else. (Same class of WITH-CHECK discipline we just
  applied to `event_participants` in Phase 2.)

## 6. Seed set (initial built-ins)

Proposed starting catalog (all `is_builtin=true`, colors reuse Palette A where one
exists). `pitches` are MIDI, low→high.

**Guitar (6-string):**

| slug              | name             | pitches               |
| ----------------- | ---------------- | --------------------- |
| `standard`        | Standard         | `{40,45,50,55,59,64}` |
| `drop-d`          | Drop D           | `{38,45,50,55,59,64}` |
| `half-step-down`  | Eb / ½-step down | `{39,44,49,54,58,63}` |
| `whole-step-down` | D / whole down   | `{38,43,48,53,57,62}` |
| `drop-c`          | Drop C           | `{36,43,48,53,57,62}` |
| `drop-b`          | Drop B           | `{35,42,47,52,56,61}` |
| `open-g`          | Open G           | `{38,43,50,55,59,62}` |
| `open-d`          | Open D           | `{38,45,50,54,57,62}` |
| `dadgad`          | DADGAD           | `{38,45,50,55,57,62}` |

**Guitar (extended range):**

| slug         | name              | pitches                     |
| ------------ | ----------------- | --------------------------- |
| `standard-7` | 7-string standard | `{35,40,45,50,55,59,64}`    |
| `standard-8` | 8-string standard | `{30,35,40,45,50,55,59,64}` |

**Bass:**

| slug            | name              | pitches               |
| --------------- | ----------------- | --------------------- |
| `bass-standard` | Bass standard (4) | `{28,33,38,43}`       |
| `bass-drop-d`   | Bass Drop D       | `{26,33,38,43}`       |
| `bass-eb`       | Bass Eb / ½-down  | `{27,32,37,42}`       |
| `bass-5`        | 5-string bass     | `{23,28,33,38,43}`    |
| `bass-6`        | 6-string bass     | `{23,28,33,38,43,48}` |

(The existing 9 `CANONICAL_TUNINGS` slugs are preserved so `canonicalTuningId()` keeps
mapping legacy free-text onto these rows during backfill.) Easy to extend later.

## 7. Migration safety for existing songs (the explicit ask)

All steps idempotent; existing data preserved; reversible.

1. `CREATE TABLE IF NOT EXISTS tunings …` + grants + RLS.
2. Seed built-ins with **stable slugs**, `ON CONFLICT (slug) DO UPDATE` (re-runnable).
3. `ALTER TABLE songs ADD COLUMN IF NOT EXISTS tuning_id …` — nullable, instant, **no
   row rewrite**.
4. **Best-effort backfill** — for each song, map `canonicalTuningId(guitar_tuning)` →
   the built-in row with that slug and set `tuning_id`:
   ```sql
   UPDATE public.songs s
      SET tuning_id = t.id
     FROM public.tunings t
    WHERE t.is_builtin AND t.slug = <canonical slug of s.guitar_tuning>
      AND s.tuning_id IS NULL;
   ```
   (The canonicalization currently lives in TS. Two options: (a) replicate the small
   normalization map in SQL for the backfill, or (b) do the backfill in an app-side
   one-shot using `canonicalTuningId`. Recommend **(a)** — a compact `CASE`/mapping in
   the migration keeps it deterministic and offline; the legacy label set is tiny.)
5. Free-text tunings that don't match any built-in slug → **leave `tuning_id` NULL and
   keep `guitar_tuning` as-is** (no data loss; the app can offer "save as custom
   tuning" later). Optionally, later, auto-mint per-owner custom rows for unmatched
   values — deferred (needs pitch inference we don't have for arbitrary text).
6. **Do NOT drop `guitar_tuning`.** It stays as the label snapshot + fallback + rollback
   anchor. A future release may deprecate it once `tuning_id` coverage is complete.

Net: existing songs keep working unchanged; those on a recognized tuning gain a
resolved `tuning_id`; nothing is destructive.

## 8. Offline / sync considerations (app-layer, no schema impact)

- Songs are offline-first (IndexedDB + SyncEngine); tunings are Supabase-direct. To keep
  song rendering offline-capable:
  - **Ship the built-ins as app constants too** — expand `src/utils/tunings.ts`
    `CANONICAL_TUNINGS` entries with `instrument`, `stringCount`, `pitches` (same data as
    the seed rows, keyed by slug). Built-ins then resolve with **zero DB round-trip** and
    work fully offline; the DB row is just the referential anchor for the FK.
  - Keep the **`guitar_tuning` label snapshot** on the song so a card can render the
    tuning name even if a custom `tuning_id` isn't cached locally.
  - Custom tunings: cache in IndexedDB on first fetch (a small `tunings` object store),
    refreshed opportunistically. Not part of the write-sync queue — they're
    read-mostly reference data written directly to Supabase.
- **No changes to `SyncEngine` are required** (it keeps its `songs/setlists/practices/
shows` switch). This satisfies "don't touch too many existing features."

## 9. Future features — how this model serves them (no schema change needed)

- **Tuning diff in a set:** consecutive songs → compare `(instrument, string_count,
pitches)`. Same instrument & count → per-string delta array; classify as
  none / single-string / multi-string retune. Different instrument or count →
  "swap instrument". Pure client math over stored `pitches`.
- **Change key → propose alternate tunings:** transpose target = `pitches + n`; rank
  candidate built-ins/customs by how few strings differ from the current tuning
  (minimize retunes across the set). "Eb reduces changes" is detected because
  `bass-eb`/`half-step-down` are uniform `−1` offsets of standard.
- **Capo / per-instrument tunings:** if needed later, add `songs.capo SMALLINT` (adds a
  uniform offset for display) and/or a `song_tunings` join table (see §10) — both are
  additive.

## 10. Decisions — RESOLVED (user, 2026-07-04)

1. **One tuning per song.** Single `songs.tuning_id` for v1. A per-instrument
   `song_tunings` join stays a clean, additive v2 if ever needed.
2. **Pitch source of truth = `smallint[]` MIDI.** Confirmed.
3. **Ownership = personal + band, with per-context duplication (no global dedup).**
   Tunings aren't secret, so identical copies across contexts are acceptable. Key rule:
   **when a band song is copied into a user's personal catalog, its custom tuning is
   copied too** — a new personal-context `tunings` row, and the personal song points at
   _that_ copy — so leaving the band never orphans the tuning. Built-ins are global and
   never copied. This is an **app-layer rule on the song-copy path**
   (`handleCopySongToPersonal` in SetlistsPage today); the schema already supports it via
   `context_type`/`context_id`. A **future admin tool** will scan for frequently-used
   custom tunings that aren't in the base set and promote them into the built-in catalog
   (periodic curation) — out of scope for v1.
4. **Backfill of unmatched free-text → `tuning_id` NULL, original `guitar_tuning` label
   left intact** (users re-pick in UI later). Prod is <100 songs, mostly Standard, so
   most backfill cleanly; the few oddballs are non-destructively left NULL. (Alt the user
   floated: hard-reset unmatched labels — not chosen; NULL-and-repick is safer.)
5. **No `spelling[]` column in v1** — derive note names in-app from MIDI with a
   flat-preference default (correct for all common tunings; F#-based tunings special-cased
   in-app). Adding the override column later is non-destructive if ever needed.

**Net effect on the schema in §4:** drop the `spelling TEXT[]` column and its
`tunings_spelling_len` CHECK; everything else stands.

## 11. Deliverables when approved (DB-only)

- One incremental migration `<ts>_tunings.sql`: `tunings` table + constraints + grants
  - RLS + seed built-ins + `songs.tuning_id` + index + best-effort backfill. Idempotent.
- pgTAP `0xx-tunings.test.sql`: table/columns/constraints exist; `pitch_len` and
  `builtin_xor_owned` CHECKs reject bad rows; RLS (built-ins world-readable, custom
  scoped, built-ins not writable by authenticated, no owner re-homing); backfill maps a
  seeded legacy label to the right slug.
- `lint:migrations` + `test:db` green; `supabase db reset` clean. **LOCAL only** — no
  remote `db push` until the PR (per your standing instruction).
- No UI, no SyncEngine changes, no touch to existing song read/write paths beyond the
  additive column.

```

```
