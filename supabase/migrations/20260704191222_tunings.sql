-- ============================================================================
-- Tunings (structured, per-string tuning registry + custom tunings)
-- ============================================================================
-- Design: .claude/artifacts/2026-07-04T17:01_tunings-db-design.md (decisions RESOLVED).
--
-- One unified `tunings` table holds BOTH built-in (global, seeded) and custom
-- (context-owned) tunings, so every song gets one uniform `tuning_id` FK.
--
-- Pitches are stored as an ordered smallint[] of MIDI note numbers, LOW string →
-- HIGH string (e.g. guitar standard E2 A2 D3 G3 B3 E4 = {40,45,50,55,59,64}).
-- This makes the planned features cheap: per-string set diff = element-wise
-- subtraction; change-key/transpose = pitches + n; different length/instrument =
-- "swap guitar". Note-name spelling (Eb vs D#) is derived in-app from MIDI.
--
-- Ownership mirrors songs: personal (context_id = userId) or band (context_id =
-- bandId, gated by is_band_member). Tunings aren't secret, so identical copies
-- across contexts are acceptable (no global dedup); a future admin tool will
-- promote frequently-used customs into the built-in set. Idempotent.
-- ============================================================================

-- ── tunings table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tunings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument    TEXT NOT NULL DEFAULT 'guitar'
                  CHECK (instrument IN ('guitar','bass')),   -- TEXT+CHECK, extensible
  string_count  SMALLINT NOT NULL CHECK (string_count BETWEEN 3 AND 12),
  pitches       SMALLINT[] NOT NULL,                          -- MIDI, low→high string
  name          TEXT NOT NULL,                                -- "Drop D" / user's name
  slug          TEXT,                                         -- built-ins only
  is_builtin    BOOLEAN NOT NULL DEFAULT false,
  color         TEXT,                                         -- Palette A for built-ins
  description   TEXT,

  -- Ownership (custom tunings only; NULL for built-ins) — mirrors songs.
  context_type  TEXT CHECK (context_type IN ('personal','band')),
  context_id    TEXT,
  created_by    UUID REFERENCES public.users(id),

  created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version          INTEGER NOT NULL DEFAULT 1,
  last_modified_by UUID REFERENCES public.users(id),

  -- Built-ins are unique by slug; custom tunings have NULL slug (many allowed).
  CONSTRAINT tunings_slug_key UNIQUE (slug),

  -- pitches length must match string_count (cardinality → 0 for '{}', so empties reject).
  CONSTRAINT tunings_pitch_len CHECK (cardinality(pitches) = string_count),

  -- A row is EITHER a global built-in (slug, no owner) OR a context-owned custom
  -- (owner, no slug) — never both, never neither.
  CONSTRAINT tunings_builtin_xor_owned CHECK (
    (is_builtin      AND context_type IS NULL AND context_id IS NULL AND slug IS NOT NULL)
    OR
    (NOT is_builtin  AND context_type IS NOT NULL AND context_id IS NOT NULL AND slug IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tunings_owner
  ON public.tunings (context_type, context_id) WHERE context_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tunings_instrument ON public.tunings (instrument);

-- New table → explicit grants required (baseline snapshot grant does NOT cover it).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tunings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tunings TO service_role;

-- ── RLS (mirror songs' ownership) ────────────────────────────────────────────
ALTER TABLE public.tunings ENABLE ROW LEVEL SECURITY;

-- SELECT: built-ins are world-readable; owners see personal-own; band members
-- see the band's customs.
DROP POLICY IF EXISTS "tunings_select" ON public.tunings;
CREATE POLICY "tunings_select" ON public.tunings FOR SELECT TO authenticated
  USING (
    is_builtin
    OR (context_type = 'personal' AND context_id = (select auth.uid())::text)
    OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
  );

-- Writes: NON-builtin rows the caller owns only. `NOT is_builtin` in both USING and
-- WITH CHECK means: can't edit a built-in, can't flip a custom into a built-in, and
-- can't re-home a row to another owner. Built-ins are seed/service_role only.
DROP POLICY IF EXISTS "tunings_insert_own" ON public.tunings;
CREATE POLICY "tunings_insert_own" ON public.tunings FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_builtin
    AND created_by = (select auth.uid())
    AND (
      (context_type = 'personal' AND context_id = (select auth.uid())::text)
      OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
    )
  );

DROP POLICY IF EXISTS "tunings_update_own" ON public.tunings;
CREATE POLICY "tunings_update_own" ON public.tunings FOR UPDATE TO authenticated
  USING (
    NOT is_builtin
    AND (
      (context_type = 'personal' AND context_id = (select auth.uid())::text)
      OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
    )
  )
  WITH CHECK (
    NOT is_builtin
    AND (
      (context_type = 'personal' AND context_id = (select auth.uid())::text)
      OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
    )
  );

DROP POLICY IF EXISTS "tunings_delete_own" ON public.tunings;
CREATE POLICY "tunings_delete_own" ON public.tunings FOR DELETE TO authenticated
  USING (
    NOT is_builtin
    AND (
      (context_type = 'personal' AND context_id = (select auth.uid())::text)
      OR (context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid())))
    )
  );

-- ── Ownership lock (defense-in-depth) ────────────────────────────────────────
-- RLS already blocks cross-tenant writes. This trigger additionally pins the
-- ownership/identity columns on UPDATE so an *authorized* owner cannot forge
-- created_by (attribution) or re-home a band tuning into personal ownership
-- (which WITH CHECK alone would allow, since the new row is self-owned). Legit
-- edits (name/pitches/color/description) are unaffected. Owned by postgres.
CREATE OR REPLACE FUNCTION public.tunings_lock_ownership()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.created_by   := OLD.created_by;
  NEW.context_type := OLD.context_type;
  NEW.context_id   := OLD.context_id;
  NEW.is_builtin   := OLD.is_builtin;
  NEW.slug         := OLD.slug;
  RETURN NEW;
END $$;
ALTER FUNCTION public.tunings_lock_ownership() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_tunings_lock_ownership ON public.tunings;
CREATE TRIGGER trg_tunings_lock_ownership
  BEFORE UPDATE ON public.tunings
  FOR EACH ROW EXECUTE FUNCTION public.tunings_lock_ownership();

-- ── Seed built-ins (idempotent upsert by slug) ───────────────────────────────
-- Pitches are MIDI, low→high string. Colors reuse Palette A where one exists.
INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin, color) VALUES
  -- Guitar (6-string)
  ('guitar', 6, '{40,45,50,55,59,64}', 'Standard',              'standard',        true, '#60a5fa'),
  ('guitar', 6, '{38,45,50,55,59,64}', 'Drop D',                'drop-d',          true, '#f97316'),
  ('guitar', 6, '{39,44,49,54,58,63}', 'Eb / Half-step down',   'half-step-down',  true, '#14b8a6'),
  ('guitar', 6, '{38,43,48,53,57,62}', 'D / Whole-step down',   'whole-step-down', true, '#0ea5e9'),
  ('guitar', 6, '{36,43,48,53,57,62}', 'Drop C',                'drop-c',          true, '#ef4444'),
  ('guitar', 6, '{35,42,47,52,56,61}', 'Drop B',                'drop-b',          true, '#a855f7'),
  ('guitar', 6, '{38,43,50,55,59,62}', 'Open G',                'open-g',          true, '#eab308'),
  ('guitar', 6, '{38,45,50,54,57,62}', 'Open D',                'open-d',          true, '#ec4899'),
  ('guitar', 6, '{38,45,50,55,57,62}', 'DADGAD',                'dadgad',          true, '#10b981'),
  -- Guitar (extended range)
  ('guitar', 7, '{35,40,45,50,55,59,64}',    '7-string standard', 'standard-7', true, NULL),
  ('guitar', 8, '{30,35,40,45,50,55,59,64}', '8-string standard', 'standard-8', true, NULL),
  -- Bass
  ('bass', 4, '{28,33,38,43}',       'Bass standard',           'bass-standard', true, NULL),
  ('bass', 4, '{26,33,38,43}',       'Bass Drop D',             'bass-drop-d',   true, NULL),
  ('bass', 4, '{27,32,37,42}',       'Bass Eb / Half-step down','bass-eb',       true, NULL),
  ('bass', 5, '{23,28,33,38,43}',    '5-string bass',           'bass-5',        true, NULL),
  ('bass', 6, '{23,28,33,38,43,48}', '6-string bass',           'bass-6',        true, NULL)
ON CONFLICT (slug) DO UPDATE SET
  instrument   = EXCLUDED.instrument,
  string_count = EXCLUDED.string_count,
  pitches      = EXCLUDED.pitches,
  name         = EXCLUDED.name,
  color        = EXCLUDED.color;

-- ── builtin_tuning_slug(): normalize legacy free-text → a built-in slug ──────
-- Mirrors src/utils/tunings.ts canonicalTuningId(). Returns NULL for unmatched.
CREATE OR REPLACE FUNCTION public.builtin_tuning_slug(p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL OR d = '' THEN NULL
    WHEN d LIKE 'standard%' OR d IN ('e-standard','e','eadgbe') THEN 'standard'
    WHEN d = 'drop-d'                                    THEN 'drop-d'
    WHEN d = 'drop-c'                                    THEN 'drop-c'
    WHEN d = 'drop-b'                                    THEN 'drop-b'
    -- ½-step down is often labelled "Eb Standard" / "Eb"
    WHEN d IN ('half-step-down','half-down','half-step',
               'eb-standard','e-flat-standard','eb','e-flat') THEN 'half-step-down'
    -- whole-step down is often labelled "D Standard"
    WHEN d IN ('whole-step-down','whole-down','whole-step',
               'd-standard','d-flat-standard') THEN 'whole-step-down'
    WHEN d = 'open-g'                                    THEN 'open-g'
    WHEN d = 'open-d'                                    THEN 'open-d'
    WHEN d = 'dadgad'                                    THEN 'dadgad'
    ELSE NULL
  END
  FROM (SELECT lower(regexp_replace(trim(COALESCE(p_label, '')), '[_\s]+', '-', 'g')) AS d) x;
$$;

GRANT EXECUTE ON FUNCTION public.builtin_tuning_slug(TEXT) TO authenticated, service_role;

-- ── songs.tuning_id (additive, safe) ─────────────────────────────────────────
-- Nullable → instant metadata change, NO rewrite of existing song rows. Keep the
-- existing songs.guitar_tuning TEXT as the human-label snapshot (offline display,
-- history, rollback). ON DELETE SET NULL: deleting a custom tuning never breaks a song.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS tuning_id UUID REFERENCES public.tunings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_songs_tuning ON public.songs (tuning_id);

-- ── Best-effort backfill of EXISTING songs (prod has rows at migration time) ──
-- Fresh local resets seed songs AFTER migrations, so this no-ops locally; the seed
-- file runs the same backfill after its inserts. Unmatched free-text → tuning_id
-- stays NULL and the original guitar_tuning label is preserved (non-destructive).
UPDATE public.songs s
   SET tuning_id = t.id
  FROM public.tunings t
 WHERE t.is_builtin
   AND t.slug = public.builtin_tuning_slug(s.guitar_tuning)
   AND s.tuning_id IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
