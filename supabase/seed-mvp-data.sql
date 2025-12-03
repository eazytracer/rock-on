-- =====================================================
-- MVP SEED DATA (Based on seedMvpData.ts)
-- =====================================================
-- This seed file matches the TypeScript seed data exactly
-- Updated for Phase 4a schema (includes last_modified_by, version)
-- =====================================================

BEGIN;

-- Generate consistent UUIDs for our test users and band
DO $$
DECLARE
  v_eric_id UUID := '6ee2bc47-0014-4cdc-b063-68646bb5d3ba';
  v_mike_id UUID := 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  v_sarah_id UUID := 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e';
  v_band_id UUID := 'accfd37c-2bac-4e27-90b1-257659f58d44';
BEGIN

  -- ========================================
  -- 1. AUTH USERS
  -- ========================================
  RAISE NOTICE '👥 Seeding auth.users...';

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES
    (
      v_eric_id,
      '00000000-0000-0000-0000-000000000000',
      'eric@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Eric Johnson"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_mike_id,
      '00000000-0000-0000-0000-000000000000',
      'mike@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Mike Thompson"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_sarah_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Sarah Chen"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- ========================================
  -- 2. PUBLIC USERS
  -- ========================================
  RAISE NOTICE '👤 Seeding public.users...';

  INSERT INTO public.users (id, email, name, created_date, auth_provider) VALUES
    (v_eric_id, 'eric@testband.demo', 'Eric Johnson', '2024-01-15', 'email'),
    (v_mike_id, 'mike@testband.demo', 'Mike Thompson', '2024-01-20', 'email'),
    (v_sarah_id, 'sarah@testband.demo', 'Sarah Chen', '2024-02-01', 'email')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ========================================
  -- 3. USER PROFILES
  -- ========================================
  RAISE NOTICE '🎸 Seeding user_profiles...';

  INSERT INTO public.user_profiles (id, user_id, display_name, instruments, primary_instrument, created_date, updated_date) VALUES
    (gen_random_uuid(), v_eric_id, 'Eric', ARRAY['Guitar', 'Vocals'], 'Guitar', NOW(), NOW()),
    (gen_random_uuid(), v_mike_id, 'Mike', ARRAY['Bass', 'Harmonica', 'Vocals', 'Guitar'], 'Bass', NOW(), NOW()),
    (gen_random_uuid(), v_sarah_id, 'Sarah', ARRAY['Drums', 'Percussion'], 'Drums', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  -- ========================================
  -- 4. BAND
  -- ========================================
  RAISE NOTICE '🎵 Seeding band...';

  INSERT INTO public.bands (
    id, name, description, created_by, created_date, updated_date,
    settings
  ) VALUES (
    v_band_id,
    'Demo Band',
    'A demo band for testing Rock-On features',
    v_eric_id,
    '2024-01-15',
    NOW(),
    '{"defaultPracticeTime":120,"reminderMinutes":[60,30,10],"autoSaveInterval":30}'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_by = EXCLUDED.created_by;

  -- ========================================
  -- 5. BAND MEMBERSHIPS
  -- ========================================
  RAISE NOTICE '👥 Seeding band_memberships...';

  INSERT INTO public.band_memberships (id, user_id, band_id, role, joined_date, status, permissions) VALUES
    (gen_random_uuid(), v_eric_id, v_band_id, 'admin', '2024-01-15', 'active', ARRAY['owner', 'admin']),
    (gen_random_uuid(), v_mike_id, v_band_id, 'admin', '2024-01-20', 'active', ARRAY['admin']),
    (gen_random_uuid(), v_sarah_id, v_band_id, 'member', '2024-02-01', 'active', ARRAY['member'])
  ON CONFLICT (band_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- ========================================
  -- 6. INVITE CODE
  -- ========================================
  RAISE NOTICE '🔑 Seeding invite_codes...';

  INSERT INTO public.invite_codes (
    id, band_id, code, created_by, created_date, expires_at, max_uses, current_uses, is_active
  ) VALUES (
    gen_random_uuid(),
    v_band_id,
    'ROCK2025',
    v_eric_id,
    NOW(),
    NOW() + INTERVAL '30 days',
    999,
    2,
    TRUE
  ) ON CONFLICT (code) DO UPDATE SET current_uses = EXCLUDED.current_uses;

  -- ========================================
  -- 7. SONGS (46 songs from TypeScript seed)
  -- ========================================
  RAISE NOTICE '🎶 Seeding songs...';

  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo, difficulty,
    context_type, context_id, created_by, visibility,
    created_date, notes, version
  ) VALUES
    -- 90s Hits
    (gen_random_uuid(), 'All Star', 'Smash Mouth', 194, 'F#', 104, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), 'Fun crowd pleaser. Start with palm muted power chords.', 1),
    (gen_random_uuid(), 'Wonderwall', 'Oasis', 258, 'F#m', 87, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Man in the Box', 'Alice In Chains', 287, 'Ebm', 108, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), 'Heavy riff. Watch the wah-wah pedal timing.', 1),
    (gen_random_uuid(), 'Smells Like Teen Spirit', 'Nirvana', 301, 'F', 116, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Creep', 'Radiohead', 238, 'G', 92, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Just A Girl', 'No Doubt', 210, 'D', 108, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Losing my Religion', 'R.E.M.', 269, 'Am', 125, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Zombie', 'The Cranberries', 306, 'Em', 84, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'No Rain', 'Blind Melon', 217, 'A', 148, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Plush', 'Stone Temple Pilots', 310, 'Gm', 73, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Cumbersome', 'Seven Mary Three', 362, 'B', 87, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Buddy Holly', 'Weezer', 160, 'Ab', 121, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Everything Zen', 'Bush', 278, 'Em', 134, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Lump', 'The Presidents of the United States of America', 134, 'F#', 142, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Lightning Crashes', 'Live', 326, 'B', 90, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Shine', 'Collective Soul', 306, 'F#', 150, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    -- 80s Classics
    (gen_random_uuid(), 'Sweet Child O'' Mine', 'Guns N'' Roses', 356, 'Db', 122, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Livin'' on a Prayer', 'Bon Jovi', 249, 'Em', 123, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Jump', 'Van Halen', 241, 'C', 130, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Kickstart My Heart', 'Mötley Crüe', 284, 'Gm', 179, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    -- 70s Legends
    (gen_random_uuid(), 'Hotel California', 'Eagles', 390, 'Bm', 74, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), 'Don''t rush the intro. Let it breathe.', 1),
    (gen_random_uuid(), 'Dream On', 'Aerosmith', 265, 'Fm', 84, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Free Bird', 'Lynyrd Skynyrd', 548, 'G', 60, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'La Grange', 'ZZ Top', 271, 'Am', 162, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Heartache Tonight', 'Eagles', 266, 'G', 113, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'White Rabbit', 'Jefferson Airplane', 153, 'F#m', 105, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Mary Jane''s Last Dance', 'Tom Petty and the Heartbreakers', 272, 'Gm', 170, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    -- 2000s Hits
    (gen_random_uuid(), 'Mr. Brightside', 'The Killers', 223, 'D', 148, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Hey There Delilah', 'Plain White T''s', 233, 'D', 104, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Seven Nation Army', 'The White Stripes', 231, 'E', 124, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'When I Come Around', 'Green Day', 178, 'B', 98, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Kryptonite', '3 Doors Down', 233, 'Bm', 100, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Burn It to the Ground', 'Nickelback', 212, 'B', 132, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Dance, Dance', 'Fall Out Boy', 181, 'Bm', 114, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Broken', 'Seether', 259, 'Ebm', 124, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Harder to Breathe', 'Maroon 5', 174, 'C#m', 150, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Short Skirt/Long Jacket', 'Cake', 197, 'D', 120, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'When You Were Young', 'The Killers', 220, 'B', 130, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Take A Picture', 'Filter', 263, 'D', 99, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Monkey Wrench', 'Foo Fighters', 231, 'B', 174, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    -- More variety
    (gen_random_uuid(), 'Black', 'Pearl Jam', 343, 'E', 107, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Enter Sandman', 'Metallica', 331, 'Em', 123, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Sad But True', 'Metallica', 325, 'G', 89, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'The Remedy', 'Jason Mraz', 254, 'G', 150, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),
    (gen_random_uuid(), 'Ocean Avenue', 'Yellowcard', 213, 'C', 190, 3, 'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1)
  ON CONFLICT (id) DO NOTHING;

  -- ========================================
  -- 8. SHOWS
  -- ========================================
  RAISE NOTICE '🎤 Seeding shows...';

  INSERT INTO public.shows (
    id, band_id, name, venue, scheduled_date, duration,
    status, notes, created_by, created_date,
    version
  ) VALUES
    (
      gen_random_uuid(),
      v_band_id,
      'Toys 4 Tots Benefit Concert',
      'The Crocodile',
      '2025-12-08 20:00:00',
      90,
      'scheduled',
      'Charity event. Bring extension cords. Sound check at 7 PM.',
      v_eric_id,
      '2024-11-01',
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'New Year''s Eve Party',
      'The Showbox',
      '2025-12-31 22:00:00',
      120,
      'scheduled',
      'Two sets. Midnight countdown. Confetti cannons.',
      v_eric_id,
      '2024-11-10',
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'Summer Music Festival',
      'Woodland Park',
      '2025-11-30 17:00:00',
      60,
      'scheduled',
      'Outdoor festival. Bring sun hats. Generator power only.',
      v_eric_id,
      '2024-11-05',
      1
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ MVP seed data complete!';
  RAISE NOTICE 'Test users: eric@testband.demo, mike@testband.demo, sarah@testband.demo';
  RAISE NOTICE 'Password for all: test123';
  RAISE NOTICE 'Band: Demo Band';

END $$;

COMMIT;

-- Display counts
SELECT 'Auth Users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Public Users', COUNT(*) FROM public.users
UNION ALL
SELECT 'Bands', COUNT(*) FROM public.bands
UNION ALL
SELECT 'Memberships', COUNT(*) FROM public.band_memberships
UNION ALL
SELECT 'Songs', COUNT(*) FROM public.songs
UNION ALL
SELECT 'Shows', COUNT(*) FROM public.shows;
