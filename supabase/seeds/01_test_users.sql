-- Test Users Seed File
-- Created: 2025-10-25
-- Description: Creates test user accounts and profiles for development/testing
--
-- Users created:
-- 1. Lemmy Kilmister (Admin) - lemmy@motorhead.com
-- 2. Slash (Regular Member) - slash@gnr.com
-- 3. Dave Grohl (Viewer) - dave@foofighters.com
-- 4. Joan Jett (Regular Member) - joan@blackhearts.com
-- 5. Eddie Van Halen (Admin) - eddie@vanhalen.com

-- ============================================================================
-- INSERT USERS
-- ============================================================================

INSERT INTO public.users (id, email, name, created_date, last_login, auth_provider) VALUES
  -- Admin user
  ('00000000-0000-0000-0000-000000000001', 'lemmy@motorhead.com', 'Lemmy Kilmister', NOW(), NOW(), 'email'),

  -- Regular members
  ('00000000-0000-0000-0000-000000000002', 'slash@gnr.com', 'Slash', NOW(), NOW(), 'email'),
  ('00000000-0000-0000-0000-000000000004', 'joan@blackhearts.com', 'Joan Jett', NOW(), NOW(), 'email'),

  -- Viewer
  ('00000000-0000-0000-0000-000000000003', 'dave@foofighters.com', 'Dave Grohl', NOW(), NOW(), 'email'),

  -- Second admin
  ('00000000-0000-0000-0000-000000000005', 'eddie@vanhalen.com', 'Eddie Van Halen', NOW(), NOW(), 'email');

-- ============================================================================
-- INSERT USER PROFILES
-- ============================================================================

INSERT INTO public.user_profiles (id, user_id, display_name, primary_instrument, instruments, bio, avatar_url, created_date, updated_date) VALUES
  -- Lemmy's profile
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Lemmy',
    'Bass',
    ARRAY['Bass', 'Vocals'],
    'Motörhead frontman. Born to lose, lived to win.',
    NULL,
    NOW(),
    NOW()
  ),

  -- Slash's profile
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Slash',
    'Guitar',
    ARRAY['Guitar', 'Lead Guitar'],
    'Top hat enthusiast and guitar legend.',
    NULL,
    NOW(),
    NOW()
  ),

  -- Dave's profile
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Dave',
    'Drums',
    ARRAY['Drums', 'Guitar', 'Vocals'],
    'Multi-instrumentalist, former Nirvana drummer, Foo Fighters frontman.',
    NULL,
    NOW(),
    NOW()
  ),

  -- Joan's profile
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    'Joan',
    'Guitar',
    ARRAY['Guitar', 'Rhythm Guitar', 'Vocals'],
    'Rock pioneer and bad reputation owner.',
    NULL,
    NOW(),
    NOW()
  ),

  -- Eddie's profile
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000005',
    'Eddie',
    'Guitar',
    ARRAY['Guitar', 'Lead Guitar'],
    'Tapping innovator and guitar virtuoso.',
    NULL,
    NOW(),
    NOW()
  );
