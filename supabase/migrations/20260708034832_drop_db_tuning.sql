-- ============================================================================
-- Add the "Drop Db" built-in guitar tuning (a.k.a. Drop C#), keep the free-text
-- normalizer in lock-step with src/utils/tunings.ts canonicalTuningId(), and
-- backfill any songs whose label now resolves to a built-in.
-- Idempotent + additive; no data loss.
-- ============================================================================

-- 1. Seed the Drop Db built-in (upsert by slug — safe to re-run).
INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin, color) VALUES
  ('guitar', 6, '{37,44,49,54,58,63}', 'Drop Db', 'drop-db', true, '#f59e0b')
ON CONFLICT (slug) DO UPDATE SET
  instrument   = EXCLUDED.instrument,
  string_count = EXCLUDED.string_count,
  pitches      = EXCLUDED.pitches,
  name         = EXCLUDED.name,
  color        = EXCLUDED.color;

-- 2. Recognize legacy "Drop Db" / "Drop C#" free-text labels (mirrors
--    canonicalTuningId — parity is asserted in tests/unit/utils/tunings.test.ts).
CREATE OR REPLACE FUNCTION public.builtin_tuning_slug(p_label TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL OR d = '' THEN NULL
    WHEN d LIKE 'standard%' OR d IN ('e-standard','e','eadgbe') THEN 'standard'
    WHEN d = 'drop-d'                                    THEN 'drop-d'
    WHEN d IN ('drop-db','drop-c#','drop-csharp','drop-c-sharp') THEN 'drop-db'
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

-- 3. Backfill any song whose label now resolves to a built-in but has no link.
UPDATE public.songs s
   SET tuning_id = t.id
  FROM public.tunings t
 WHERE t.is_builtin
   AND t.slug = public.builtin_tuning_slug(s.guitar_tuning)
   AND s.tuning_id IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================
