-- =====================================================
-- Rock On - FULL CATALOG (19 SONGS)
-- =====================================================
-- Auto-generated from src/database/seedCatalog.ts
-- Generated: 2025-10-29T17:52:54.853Z
-- =====================================================

DO $$
DECLARE
  v_band_id UUID := 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid;
  v_eric_id UUID := '7e75840e-9d91-422e-a949-849f0b8e2ea4'::uuid;
BEGIN

  -- Delete existing songs for clean slate
  DELETE FROM public.songs WHERE context_id = v_band_id::text;

  -- Insert songs from catalog
  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo,
    created_date, updated_date, created_by,
    context_type, context_id
  ) VALUES
    ('00000000-0000-0000-0000-000000000010', 'All Star', 'Smash Mouth', 194, 'F#', 104, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000011', 'Wonderwall', 'Oasis', 258, 'F#m', 87, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000012', 'Man in the Box', 'Alice In Chains', 287, 'Ebm', 108, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000013', 'Smells Like Teen Spirit', 'Nirvana', 301, 'F', 116, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000014', 'Black', 'Pearl Jam', 343, 'E', 107, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000015', 'Enter Sandman', 'Metallica', 331, 'Em', 123, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000020', 'Sweet Child O'' Mine', 'Guns N'' Roses', 356, 'D', 125, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000021', 'Livin'' on a Prayer', 'Bon Jovi', 249, 'Em', 123, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000022', 'Jump', 'Van Halen', 241, 'C', 130, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000030', 'Hotel California', 'Eagles', 390, 'Bm', 74, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000031', 'Dream On', 'Aerosmith', 265, 'Fm', 84, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000032', 'Free Bird', 'Lynyrd Skynyrd', 548, 'G', 60, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000040', 'Mr. Brightside', 'The Killers', 223, 'D', 148, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000041', 'Hey There Delilah', 'Plain White T''s', 233, 'D', 104, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000042', 'Seven Nation Army', 'The White Stripes', 231, 'E', 124, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000043', 'The Remedy', 'Jason Mraz', 254, 'G', 150, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000044', 'Ocean Avenue', 'Yellowcard', 213, 'C', 190, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('00000000-0000-0000-0000-000000000050', 'Shallow', 'Lady Gaga & Bradley Cooper', 215, 'G', 96, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'),
    ('c2946b79-3ecf-4483-86d4-cb9c08c3e1f6', 'A song', 'Someone', 180, 'G', 120, NOW(), NOW(), '7e75840e-9d91-422e-a949-849f0b8e2ea4', 'band', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d');

  RAISE NOTICE '✅ Seeded % songs to Supabase', (SELECT COUNT(*) FROM public.songs WHERE context_id = v_band_id::text);

END $$;

-- Verify
SELECT COUNT(*) as total_songs FROM public.songs WHERE context_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
