-- ============================================================================
-- Redesign phase 0 · Foundations (0.7.0)
-- ----------------------------------------------------------------------------
-- 1. user_preferences: one row per user, synced across devices (theme now;
--    list views, chart, metronome and push settings arrive in later phases).
-- 2. Tuning colours per design/source/DECISIONS.md Part A · 1: Drop D → lime,
--    Drop C → fuchsia, new C Standard built-in (violet). The client resolves
--    built-in colours by slug (light theme has its own shades); these are the
--    dark-theme values for any client that reads the column.
-- 3. Normalizer recognises "C Standard" (lock-step with canonicalTuningId).
-- 4. release_notes row for 0.7.0.
-- Idempotent + additive.
-- ============================================================================

-- 1. user_preferences --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme        TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  list_views   JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeline     JSONB NOT NULL DEFAULT '{}'::jsonb,
  chart        JSONB NOT NULL DEFAULT '{}'::jsonb,
  metronome    JSONB NOT NULL DEFAULT '{}'::jsonb,
  push         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version      INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO service_role;

CREATE OR REPLACE FUNCTION public.user_preferences_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_date := NOW();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_touch ON public.user_preferences;
CREATE TRIGGER user_preferences_touch
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.user_preferences_touch();

-- 2. Tuning colours + C Standard ---------------------------------------------
UPDATE public.tunings SET color = '#84cc16' WHERE is_builtin AND slug = 'drop-d';
UPDATE public.tunings SET color = '#d946ef' WHERE is_builtin AND slug = 'drop-c';

INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin, color) VALUES
  ('guitar', 6, '{36,41,46,51,55,60}', 'C Standard', 'c-standard', true, '#8b5cf6')
ON CONFLICT (slug) DO UPDATE SET
  instrument   = EXCLUDED.instrument,
  string_count = EXCLUDED.string_count,
  pitches      = EXCLUDED.pitches,
  name         = EXCLUDED.name,
  color        = EXCLUDED.color;

-- 3. Normalizer (mirrors canonicalTuningId in src/utils/tunings.ts) ----------
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
    WHEN d IN ('c-standard','c-std')                     THEN 'c-standard'
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

UPDATE public.songs s
   SET tuning_id = t.id
  FROM public.tunings t
 WHERE t.is_builtin
   AND t.slug = public.builtin_tuning_slug(s.guitar_tuning)
   AND s.tuning_id IS NULL;

-- 4. Release notes -----------------------------------------------------------
INSERT INTO public.release_notes (version, title, body) VALUES (
  '0.7.0',
  'A fresh coat of paint',
  $md$The first step of the redesign:

- **New look.** Warmer colours, bigger and easier-to-read type.
- **Light mode.** Settings → Appearance: follow your phone, or pick light or dark.
- **Personal has its own colour.** When you're in Personal, the accent turns indigo, so you always know whose songs you're looking at.
- **Clearer tuning colours.** Drop D is now lime and Drop C fuchsia, so neither looks like a warning. C Standard is new.$md$
) ON CONFLICT (version) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
