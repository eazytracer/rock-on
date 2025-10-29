-- =====================================================
-- SEED FULL SONG CATALOG WITH RANDOM IDs (FOR COLORS)
-- =====================================================
-- Uses gen_random_uuid() for diverse avatar colors
-- =====================================================

DO $$
DECLARE
  v_band_id UUID := '00000000-0000-0000-0000-000000000002'::uuid;
  v_eric_id UUID := '7e75840e-9d91-422e-a949-849f0b8e2ea4'::uuid;
BEGIN

  -- Delete existing songs for clean slate
  DELETE FROM public.songs WHERE context_id = v_band_id::text;

  -- Insert full song catalog with RANDOM UUIDs for color diversity
  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo,
    created_date, updated_date, created_by,
    context_type, context_id
  ) VALUES
    -- 90s Rock
    (gen_random_uuid(), 'All Star', 'Smash Mouth', 194, 'F#', 104, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Wonderwall', 'Oasis', 258, 'F#m', 87, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Man in the Box', 'Alice In Chains', 287, 'Ebm', 108, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Smells Like Teen Spirit', 'Nirvana', 301, 'F', 116, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Black', 'Pearl Jam', 343, 'E', 107, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Enter Sandman', 'Metallica', 331, 'Em', 123, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),

    -- 80s Rock
    (gen_random_uuid(), 'Sweet Child O'' Mine', 'Guns N'' Roses', 356, 'Db', 122, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Livin'' on a Prayer', 'Bon Jovi', 249, 'Em', 123, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Jump', 'Van Halen', 241, 'C', 130, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),

    -- 70s Rock
    (gen_random_uuid(), 'Hotel California', 'Eagles', 390, 'Bm', 74, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Dream On', 'Aerosmith', 265, 'Fm', 84, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Free Bird', 'Lynyrd Skynyrd', 548, 'G', 60, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),

    -- 2000s
    (gen_random_uuid(), 'Mr. Brightside', 'The Killers', 223, 'D', 148, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Hey There Delilah', 'Plain White T''s', 233, 'D', 104, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Seven Nation Army', 'The White Stripes', 231, 'E', 124, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'The Remedy', 'Jason Mraz', 254, 'G', 150, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),
    (gen_random_uuid(), 'Ocean Avenue', 'Yellowcard', 213, 'C', 190, NOW(), NOW(), v_eric_id, 'band', v_band_id::text),

    -- Custom song (keep existing ID if it exists, or random)
    (COALESCE((SELECT id FROM songs WHERE title = 'A song' LIMIT 1), gen_random_uuid()), 'A song', 'Someone', 180, 'G', 120, NOW(), NOW(), v_eric_id, 'band', v_band_id::text);

  RAISE NOTICE '✅ Seeded % songs to Supabase with diverse avatar colors', (SELECT COUNT(*) FROM public.songs WHERE context_id = v_band_id::text);

END $$;

-- Verify
SELECT COUNT(*) as total_songs FROM public.songs WHERE context_id = '00000000-0000-0000-0000-000000000002';
