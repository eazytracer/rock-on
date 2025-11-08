-- =====================================================
-- SEED LOCAL DEVELOPMENT DATA
-- =====================================================
-- Creates test users in auth.users and public schema
-- for local Supabase development
-- =====================================================

-- STEP 1: Create auth users (with hashed passwords)
-- Password for all users: "test123"
-- Hashed using crypt() with bcrypt
DO $$
DECLARE
  v_eric_id UUID := gen_random_uuid();
  v_mike_id UUID := gen_random_uuid();
  v_sarah_id UUID := gen_random_uuid();
  v_band_id UUID := gen_random_uuid();
BEGIN

  -- Create auth users (if they don't exist)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_sso_user,
    is_anonymous
  ) VALUES
    (
      v_eric_id,
      '00000000-0000-0000-0000-000000000000',
      'eric@ipodshuffle.com',
      crypt('test123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Eric"}'::jsonb,
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      FALSE,
      FALSE
    ),
    (
      v_mike_id,
      '00000000-0000-0000-0000-000000000000',
      'mike@ipodshuffle.com',
      crypt('test123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Mike"}'::jsonb,
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      FALSE,
      FALSE
    ),
    (
      v_sarah_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah@ipodshuffle.com',
      crypt('test123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Sarah"}'::jsonb,
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      FALSE,
      FALSE
    )
  ON CONFLICT (id) DO UPDATE
    SET email_confirmed_at = NOW(),
        updated_at = NOW(),
        confirmation_token = '',
        recovery_token = '',
        email_change = '',
        email_change_token_new = '',
        email_change_token_current = '',
        phone_change = '',
        phone_change_token = '',
        reauthentication_token = '';

  -- Create auth identities
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    (
      v_eric_id::text,
      v_eric_id,
      format('{"sub":"%s","email":"eric@ipodshuffle.com"}', v_eric_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_mike_id::text,
      v_mike_id,
      format('{"sub":"%s","email":"mike@ipodshuffle.com"}', v_mike_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_sarah_id::text,
      v_sarah_id,
      format('{"sub":"%s","email":"sarah@ipodshuffle.com"}', v_sarah_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  RAISE NOTICE 'Auth users created: Eric, Mike, Sarah';

  -- STEP 2: Create users in public.users table
  INSERT INTO public.users (id, email, name, created_date, last_login, auth_provider)
  VALUES
    (v_eric_id, 'eric@ipodshuffle.com', 'Eric', NOW(), NOW(), 'email'),
    (v_mike_id, 'mike@ipodshuffle.com', 'Mike', NOW(), NOW(), 'email'),
    (v_sarah_id, 'sarah@ipodshuffle.com', 'Sarah', NOW(), NOW(), 'email')
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        last_login = NOW();

  RAISE NOTICE 'Public users created';

  -- STEP 3: Create test band
  INSERT INTO public.bands (id, name, description, created_date, settings, is_active)
  VALUES (v_band_id, 'iPod Shuffle', 'Dev test band', NOW(), '{}'::jsonb, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Band created: iPod Shuffle';

  -- STEP 4: Create band memberships
  INSERT INTO public.band_memberships (id, band_id, user_id, role, permissions, status, joined_date)
  VALUES
    (gen_random_uuid(), v_band_id, v_eric_id, 'admin', ARRAY['admin']::text[], 'active', NOW()),
    (gen_random_uuid(), v_band_id, v_mike_id, 'member', ARRAY['member']::text[], 'active', NOW()),
    (gen_random_uuid(), v_band_id, v_sarah_id, 'member', ARRAY['member']::text[], 'active', NOW())
  ON CONFLICT (band_id, user_id) DO NOTHING;

  RAISE NOTICE 'Band memberships created';

  -- STEP 5: Create some test songs
  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo, difficulty,
    notes, created_date, confidence_level,
    context_type, context_id, created_by, visibility
  ) VALUES
    (
      gen_random_uuid(),
      'Wonderwall',
      'Oasis',
      258,
      'F#m',
      87,
      2,
      'Classic 90s anthem',
      NOW(),
      4,
      'band',
      v_band_id::text,
      v_eric_id,
      'band'
    ),
    (
      gen_random_uuid(),
      'Sweet Child O'' Mine',
      'Guns N'' Roses',
      356,
      'D',
      125,
      3,
      'Epic guitar intro',
      NOW(),
      3,
      'band',
      v_band_id::text,
      v_mike_id,
      'band'
    ),
    (
      gen_random_uuid(),
      'Shallow',
      'Lady Gaga & Bradley Cooper',
      215,
      'G',
      96,
      2,
      'Duet from A Star Is Born',
      NOW(),
      4,
      'band',
      v_band_id::text,
      v_sarah_id,
      'band'
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test songs created';

  -- Output summary
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LOCAL DEV SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Band ID: %', v_band_id;
  RAISE NOTICE 'Eric ID: %', v_eric_id;
  RAISE NOTICE 'Mike ID: %', v_mike_id;
  RAISE NOTICE 'Sarah ID: %', v_sarah_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Login Credentials (password for all: test123):';
  RAISE NOTICE '  - eric@ipodshuffle.com';
  RAISE NOTICE '  - mike@ipodshuffle.com';
  RAISE NOTICE '  - sarah@ipodshuffle.com';
  RAISE NOTICE '========================================';

END $$;

-- Verify the data
SELECT 'Auth Users' as table_name, COUNT(*) as count FROM auth.users WHERE email LIKE '%ipodshuffle.com'
UNION ALL
SELECT 'Public Users', COUNT(*) FROM public.users WHERE email LIKE '%ipodshuffle.com'
UNION ALL
SELECT 'Bands', COUNT(*) FROM public.bands WHERE name = 'iPod Shuffle'
UNION ALL
SELECT 'Memberships', COUNT(*) FROM public.band_memberships WHERE band_id IN (SELECT id FROM public.bands WHERE name = 'iPod Shuffle')
UNION ALL
SELECT 'Songs', COUNT(*) FROM public.songs WHERE context_id IN (SELECT id::text FROM public.bands WHERE name = 'iPod Shuffle');
