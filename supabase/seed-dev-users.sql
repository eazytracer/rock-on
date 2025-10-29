-- =====================================================
-- SEED DEV USERS FOR TESTING
-- =====================================================
-- Run this in Supabase SQL Editor to create test users
--
-- IMPORTANT: You must also create these users in Supabase Auth Dashboard:
-- 1. Go to Authentication > Users
-- 2. Add User for each:
--    - eric@ipodshuffle.com (password: test123)
--    - mike@ipodshuffle.com (password: test123)
--    - sarah@ipodshuffle.com (password: test123)
-- 3. Copy the UUID from each user
-- 4. Update the UUIDs in this script below
-- =====================================================

-- STEP 1: Replace these UUIDs with the actual UUIDs from Supabase Auth
-- After creating users in Auth Dashboard, copy their IDs here:

DO $$
DECLARE
  v_eric_id UUID := '7e75840e-9d91-422e-a949-849f0b8e2ea4'::uuid;
  v_mike_id UUID := '0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3'::uuid;
  v_sarah_id UUID := 'b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77'::uuid;
  v_band_id UUID := gen_random_uuid();
BEGIN

  -- STEP 2: Create users in public.users table
  INSERT INTO public.users (id, email, name, created_date, last_login, auth_provider)
  VALUES
    (v_eric_id, 'eric@ipodshuffle.com', 'Eric', NOW(), NOW(), 'email'),
    (v_mike_id, 'mike@ipodshuffle.com', 'Mike', NOW(), NOW(), 'email'),
    (v_sarah_id, 'sarah@ipodshuffle.com', 'Sarah', NOW(), NOW(), 'email')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        last_login = NOW();

  RAISE NOTICE 'Users created: Eric (%), Mike (%), Sarah (%)', v_eric_id, v_mike_id, v_sarah_id;

  -- STEP 3: Create test band
  INSERT INTO public.bands (id, name, description, created_date, settings, is_active)
  VALUES (v_band_id, 'iPod Shuffle', 'Dev test band', NOW(), '{}'::jsonb, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Band created: iPod Shuffle (%)' , v_band_id;

  -- STEP 4: Create band memberships
  INSERT INTO public.band_memberships (id, band_id, user_id, role, permissions, status, joined_date)
  VALUES
    (gen_random_uuid(), v_band_id, v_eric_id, 'admin', ARRAY['admin']::text[], 'active', NOW()),
    (gen_random_uuid(), v_band_id, v_mike_id, 'member', ARRAY['member']::text[], 'active', NOW()),
    (gen_random_uuid(), v_band_id, v_sarah_id, 'member', ARRAY['member']::text[], 'active', NOW())
  ON CONFLICT (band_id, user_id) DO NOTHING;

  RAISE NOTICE 'Band memberships created for all 3 users';

  -- Output the band ID for easy copying
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Band ID: %', v_band_id;
  RAISE NOTICE 'Eric ID: %', v_eric_id;
  RAISE NOTICE 'Mike ID: %', v_mike_id;
  RAISE NOTICE 'Sarah ID: %', v_sarah_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Save the Band ID - you will need it for localStorage.setItem("currentBandId", "...")';
  RAISE NOTICE '========================================';

END $$;

-- STEP 5: Verify the data
SELECT 'Users' as table_name, COUNT(*) as count FROM public.users WHERE email LIKE '%ipodshuffle.com'
UNION ALL
SELECT 'Bands', COUNT(*) FROM public.bands WHERE name = 'iPod Shuffle'
UNION ALL
SELECT 'Memberships', COUNT(*) FROM public.band_memberships WHERE band_id IN (SELECT id FROM public.bands WHERE name = 'iPod Shuffle');
